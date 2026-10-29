/* ============================================================================
 * turret.js — the Turret tab. Prefix `tr`.
 *
 * Self-contained plug-in, same shape as mazes.js: one IIFE that injects its
 * own stylesheet, screen and tab, registers into TAB_ENTRY / SCREEN_TAB, and
 * touches no other file. Uses the three.js r128 that index.html already loads
 * for the visualizer.
 *
 * The player sits in a ship's gun turret while an NPC pilot flies. Enemy
 * fighters swoop past; tapping near one locks it and fires. Built to the
 * budget of a budget Fire tablet (Cortex-A53, 2 GB, 1024×600–1280×800).
 * Rules that keep it inside that budget:
 *
 *   RENDER FEWER PIXELS. Pixel ratio is pinned to 1 and each quality tier sets
 *   a render scale; CSS upscales the canvas. Dark space with glowing things
 *   hides the softness far better than it hides a dropped frame.
 *
 *   THE COCKPIT IS NOT 3D. The player never leaves the turret, so the frame,
 *   barrels, reticle and HUD are SVG/DOM over the canvas — free to draw, and
 *   the frame covers the edges of the 3D view.
 *
 *   NO LIGHTS, NO SHADOWS, NO POST. Meshes are MeshBasicMaterial with lighting
 *   baked into vertex colours once. Glow is an additive sprite, not bloom.
 *   The clear colour is the sky — a gradient sky would be a second full-screen
 *   fill, and fill rate is what these GPUs run out of first.
 *
 *   NOTHING IS ALLOCATED PER FRAME. Every vector is a module-level scratch and
 *   every moving thing comes from a fixed pool. A GC pause on these cores
 *   reads as stutter, and stutter is what the probe is there to catch.
 *
 *   THE SHIP NEVER MOVES. It sits at the origin heading −Z. When the pilot
 *   turns, the world turns the other way: dust and asteroids are rotated by
 *   the inverse of each frame's turn and the sky group accumulates it. No
 *   float drift on a long flight, and no camera maths for the turret.
 *
 *   ENEMIES AND BOLTS LIVE IN SHIP SPACE. Fighters fly scripted Bézier swoops
 *   around the ship, so they stay in the turret's arc whatever the pilot
 *   does. A HIT IS DECIDED, NOT DETECTED: a locked bolt is aimed at where the
 *   path says the target will be when the bolt arrives, so there is no
 *   collision test — so the outcome can depend on the answer to a question.
 *
 *   TWO CLOCKS. `wt` is world time and advances by dt × timeScale; aiming and
 *   the probe run on real time. Bullet time is a timeScale, nothing more.
 *
 *   THE LOOP STOPS WHEN THE SCREEN DOES. A MutationObserver on the screen's
 *   class starts and stops it, and a hidden page stops it too — rAF does not
 *   fire in a hidden tab, and the frame after coming back would otherwise be
 *   a several-second dt.
 *
 *   A LOST CONTEXT IS REBUILT. Fire OS drops WebGL contexts under memory
 *   pressure; the scene is rebuilt from scratch on a fresh canvas rather than
 *   trusting the old one to come back whole. A question or an ace lost with
 *   the scene goes back in the queue; nothing owed is ever dropped.
 *
 * The game: a sortie is one pass through the chosen set and ends when every
 * fact has been answered right once. The player cannot lose. A miss comes
 * back on an ace (a gold fighter carrying that fact). Every answer goes into
 * the turret's own proficiency store under nq.turret.* — never the flash
 * cards' ttFact_* keys. A grown-up panel behind a three-second hold on the
 * gear picks the set, the answer mode and the timer, and resets the data.
 * ==========================================================================*/
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
    const rand = (lo, hi) => lo + Math.random() * (hi - lo);

    // Buffers and pools are allocated once at the largest tier; a tier only
    // changes how much of each is drawn or spawned.
    const TIERS = {
        low:  { label: 'Low',  scale: 0.6,  stars: 300, dust: 80,  enemies: 3, rocks: 6 },
        med:  { label: 'Med',  scale: 0.75, stars: 500, dust: 150, enemies: 4, rocks: 10 },
        high: { label: 'High', scale: 1.0,  stars: 900, dust: 250, enemies: 5, rocks: 14 },
    };
    const TIER_ORDER = ['low', 'med', 'high'];
    const MAX_STARS = 900, MAX_DUST = 250, MAX_ENEMIES = 5, MAX_ROCKS = 14;
    const MAX_BOLTS = 10, MAX_SPARKS = 192;

    const BG = 0x05060d;
    const SPEED = 38;                       // world units per second, ship along −Z
    const DUST_W = 70, DUST_H = 46, DUST_D = 140;
    const STREAK = SPEED * 0.06;            // streak length tracks speed — longer reads faster
    const YAW_LIMIT = 1.2, PITCH_MIN = -0.25, PITCH_MAX = 0.8;

    const SHIP_SCALE = 1.6;                 // a fighter at 60 units is a speck on a 7-inch screen otherwise
    const BOLT_SPEED = 110;
    const SIGHT = 110;                      // past this a fighter is still in the fog: not lockable
    const LOCK_PX = 56;                     // minimum lock radius around a tap, CSS px
    const TAP_SLOP = 10, TAP_MS = 400;      // a press that moves less, and lifts sooner, is a tap

    // Bullet time. The world eases to SLOW on a lock, then to a stop as the
    // bolt nears HOLD_U of its flight, so however long the answer takes, the
    // bolt is hanging in mid-air when it comes.
    const SLOW = 0.06, HOLD_U = 0.4;
    const BASE_FOV = 70, ZOOM_FOV = 56;
    const REVEAL_S = 1.4;                   // a missed answer stays on screen this long, in real seconds
    const RIGHT_S = 0.35;
    const MISS_BY = 8;                      // a swerve clears the bolt by at least this much
    const TIMERS = [0, 8, 15];              // seconds; 0 is no timer

    // Sorties. A missed fact comes back on an ace — a gold fighter carrying
    // that one question — a few seconds later, not on the very next ship.
    const ACE_DELAY = [4, 7];               // world seconds
    const FINISH_S = 1.8;                   // the last hit plays out before the debrief
    const HISTORY_N = 100;

    const MODES = ['choice', 'keypad', 'spoken'];
    const MODE_CH = { choice: 'c', keypad: 'k', spoken: 's' };
    const CH_MODE = { c: 'choice', k: 'keypad', s: 'spoken' };
    const MODE_LABEL = { choice: 'Choice', keypad: 'Keypad', spoken: 'Spoken' };
    // A fact is fluent when its last three answers were right and their
    // median beats the threshold for the mode each was given in. Typing and
    // speaking take longer than tapping, so one number would be unfair to both.
    const FLUENT_MS = { choice: 3000, keypad: 4000, spoken: 3500 };
    const FLUENT_CHOICES = [2000, 3000, 4000, 5000, 6000];
    const LEVELS = [['fluent', 'Fluent'], ['learning', 'Learning'], ['shaky', 'Shaky'], ['new', 'New']];
    const OPS = [['addition', '+'], ['subtraction', '−'], ['multiplication', '×'], ['division', '÷']];
    const OP_NAME = { '+': 'addition', '−': 'subtraction', '×': 'multiplication', '÷': 'division' };
    const OP_SYM = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' };
    const MAXES = [5, 10, 20];

    const PROBE_N = 120;                    // ring of recent frames
    const PROBE_EVERY = 500;                // ms between HUD writes — DOM writes cost too

    /* ---- the pilot --------------------------------------------------------
     * Turn rates in rad/s, eased toward, so manoeuvres blend. A weave's yaw
     * is a sine on the manoeuvre's own clock.
     */
    const MANOEUVRES = [
        { yaw: 0, pitch: 0, dur: [4, 7] },
        { yaw: 0.16, pitch: 0, dur: [4, 6] },
        { yaw: -0.16, pitch: 0, dur: [4, 6] },
        { weave: true, pitch: 0, dur: [6, 9] },
        { yaw: 0, pitch: 0.1, dur: [3, 5] },
        { yaw: 0, pitch: -0.1, dur: [3, 5] },
    ];

    /* ---- enemy swoops -----------------------------------------------------
     * Chained cubic Béziers in ship space (x right, y up, −z ahead), each
     * starting and ending out in the fog. Where two segments join, the
     * control points either side of the joint are collinear with it, so the
     * flight is smooth through it. Every path may be mirrored in x.
     */
    const PATHS = [
        { dur: 6, pts: [[-90, 10, -110], [-30, 22, -60], [30, -6, -42], [95, 8, -75]] },
        { dur: 7, pts: [[10, 45, -130], [6, 30, -70], [0, 6, -36], [-8, 0, -28],
            [-16, -6, -20], [-50, 10, -20], [-100, 25, -75]] },
        { dur: 8, pts: [[60, 5, -120], [20, 30, -60], [-30, 30, -50], [-30, 5, -70],
            [-30, -20, -90], [20, -10, -100], [85, 25, -115]] },
        { dur: 7, pts: [[-95, -20, -80], [-20, -10, -45], [20, 40, -50], [60, 50, -95]] },
        { dur: 8, pts: [[-60, 15, -110], [-20, 40, -90], [0, -8, -80], [30, 15, -75],
            [60, 38, -70], [80, 10, -90], [100, 20, -130]] },
    ];
    const WING_OFFSET = [5, -3, 4];          // a wingman flies the leader's path, offset
    const WING_DELAY = 0.35;

    const tr = {
        stage: null, canvas: null, renderer: null, scene: null, camera: null, rig: null, sky: null,
        stars: null, dust: null, dustP: null, rockMesh: null, enemyMesh: null, glows: null,
        boltMesh: null, boltGlows: null, sparks: null, glowTex: null,
        rocks: [], foes: [], bolts: [], spark: null,
        pilot: null, spawnAt: 0, rockAt: 0, lockFoe: null, barrel: 1, hits: 0,
        running: false, lost: false, raf: 0, last: 0, wt: 0, timeScale: 1,
        tier: 'med', auto: true, cap: 30,
        ask: null, deck: [], aceQ: [], sortie: null, set: null,
        input: 'choice', kidInput: true, timer: 0, fluent: null, sound: true, spDenied: false,
        toastLeft: 0, shake: 0, flash: null, flashLife: 0,
        yaw: 0, pitch: 0.12, aimYaw: 0, aimPitch: 0.12,
        cssW: 0, cssH: 0,
    };

    const probe = {
        iv: new Float32Array(PROBE_N), cpu: new Float32Array(PROBE_N), sorted: new Float32Array(PROBE_N),
        i: 0, n: 0, lastReport: 0, settleUntil: 0,
    };

    let V1, V2, V3, V4, SIZE, DUMMY, DQ, EUL, UP;    // scratch, made once THREE exists
    let FOE_COL, ACE_COL;
    const FOE_GLOW = [1, 0.54, 0.24], ACE_GLOW = [1, 0.86, 0.4];

    /* ---- settings ---------------------------------------------------------*/
    function trLoadSettings() {
        const tier = stGet('turret.tier', 'med');
        tr.tier = TIERS[tier] ? tier : 'med';
        tr.auto = stGet('turret.tierAuto', '1') === '1';
        tr.cap = stGet('turret.cap', '30') === '60' ? 60 : 30;
        const input = stGet('turret.input', 'choice');
        tr.input = MODES.indexOf(input) >= 0 ? input : 'choice';
        tr.kidInput = stGet('turret.kidInput', '1') === '1';
        const timer = Number(stGet('turret.timer', '0'));
        tr.timer = TIMERS.indexOf(timer) >= 0 ? timer : 0;
        tr.sound = stGet('turret.sound', '1') === '1';
        const fl = stJSON('turret.fluent', null) || {};
        tr.fluent = {};
        MODES.forEach((m) => { tr.fluent[m] = FLUENT_CHOICES.indexOf(Number(fl[m])) >= 0 ? Number(fl[m]) : FLUENT_MS[m]; });
        tr.set = trCleanSet(stJSON('turret.set', null));
    }

    function trSaveSettings() {
        stSet('turret.tier', tr.tier);
        stSet('turret.tierAuto', tr.auto ? '1' : '0');
        stSet('turret.cap', String(tr.cap));
        stSet('turret.input', tr.input);
        stSet('turret.kidInput', tr.kidInput ? '1' : '0');
        stSet('turret.timer', String(tr.timer));
        stSet('turret.sound', tr.sound ? '1' : '0');
        stSetJSON('turret.fluent', tr.fluent);
        stSetJSON('turret.set', tr.set);
    }

    // A stored set is not trusted: it may predate a change to the ranges, or
    // be half of a blob from a full disk.
    function trCleanSet(s) {
        s = s && typeof s === 'object' ? s : {};
        const ops = OPS.map((p) => p[0]).filter((o) => Array.isArray(s.ops) && s.ops.indexOf(o) >= 0);
        const max = MAXES.indexOf(Number(s.max)) >= 0 ? Number(s.max) : 10;
        const tables = {};
        OPS.forEach(([o]) => {
            const t = s.tables && Array.isArray(s.tables[o]) ? s.tables[o].map(Number).filter((n) => n >= 1 && n <= max) : [];
            if (t.length) tables[o] = t.filter((n, i) => t.indexOf(n) === i).sort((a, b) => a - b);
        });
        return { ops: ops.length ? ops : ['multiplication'], max, tables, locked: !!s.locked };
    }

    /* ---- questions --------------------------------------------------------
     * The set is the turret's own — operations, a range, and optionally a few
     * tables — chosen in the adult panel, or by the child unless the adult has
     * locked it. A sortie is the complete deck for that set, shuffled: every
     * fact once, exactly as the flash cards do it.
     *
     * A table filter keeps a fact when either number of its family is listed:
     * 7 × 8 belongs to the sevens and the eights, and so does 56 ÷ 7.
     */
    function trParse(q) {
        const [a, op, b] = q.display.split('\n');
        return { a: Number(a), op, b: Number(b), answer: q.answer, key: op + ':' + a + ':' + b, text: a + ' ' + op + ' ' + b };
    }

    function trFamily(q) {
        return q.op === '÷' || q.op === '−' ? [q.b, q.answer] : [q.a, q.b];
    }

    function trBuildDeck(set) {
        const out = [];
        generateAllQuestions(set.ops, set.max).forEach((raw) => {
            const q = trParse(raw);
            const t = set.tables[OP_NAME[q.op]];
            if (t) {
                const f = trFamily(q);
                if (t.indexOf(f[0]) < 0 && t.indexOf(f[1]) < 0) return;
            }
            out.push(q);
        });
        return out;
    }

    function trShuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // One best per exact set, the way the flash cards key bestTime_<ops>_<max>.
    function trSetKey(set) {
        const ops = set.ops.slice().sort();
        const t = Object.keys(set.tables).sort().filter((o) => ops.indexOf(o) >= 0)
            .map((o) => o.slice(0, 3) + set.tables[o].join('.'));
        return ops.join(',') + '_' + set.max + (t.length ? '_' + t.join('-') : '');
    }

    function trSetLabel(set) {
        return OPS.filter(([o]) => set.ops.indexOf(o) >= 0).map(([o, sym]) =>
            sym + (set.tables[o] ? ' ' + set.tables[o].join(', ') : '')).join('  ') + ' · up to ' + set.max;
    }

    function trQueueAce(q, delay) {
        tr.aceQ.push({ q, at: tr.wt + delay });
    }

    /* ---- proficiency ------------------------------------------------------
     * One record per fact, all in one blob under turret.facts, written
     * through a debounced writer so an answer costs a stringify only now and
     * then (and always on the way out of the page).
     *   n  attempts      c  correct      t  last seen, epoch ms
     *   r  the last five answers: [right 1|0, ms, mode c|k|s]
     * Never the flash cards' ttFact_* keys: the times-tables grid reads those
     * live, and a turret answer is not timed the way a flash card is.
     */
    let facts = null, factsW = null;

    function trFacts() {
        if (!facts) {
            const f = stJSON('turret.facts', null);
            facts = f && typeof f === 'object' && !Array.isArray(f) ? f : {};
            factsW = stDebounced('turret.facts', 800);
        }
        return facts;
    }

    function trRecord(q, right, ms, mode) {
        const F = trFacts();
        const r = F[q.key] || (F[q.key] = { n: 0, c: 0, r: [], t: 0 });
        r.n++;
        if (right) r.c++;
        r.r.push([right ? 1 : 0, ms, MODE_CH[mode]]);
        if (r.r.length > 5) r.r.shift();
        r.t = Date.now();
        factsW.set(F);
    }

    //   new       never answered
    //   shaky     a miss among the last three
    //   fluent    the last three right, and quick
    //   learning  everything else: right lately, but slow or not yet three times
    function trLevel(rec) {
        if (!rec || !rec.n || !rec.r || !rec.r.length) return 'new';
        const last = rec.r.slice(-3);
        if (last.some((x) => !x[0])) return 'shaky';
        if (last.length < 3) return 'learning';
        const k = last.map((x) => x[1] / tr.fluent[CH_MODE[x[2]] || 'choice']).sort((a, b) => a - b);
        return k[1] < 1 ? 'fluent' : 'learning';
    }

    function trLevelCounts(deck) {
        const F = trFacts();
        const c = { fluent: 0, learning: 0, shaky: 0, new: 0 };
        deck.forEach((q) => { c[trLevel(F[q.key])]++; });
        return c;
    }

    function trMedian(arr) {
        if (!arr.length) return null;
        const s = arr.slice().sort((a, b) => a - b);
        const m = s.length >> 1;
        return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    }

    function trBest(key) {
        const b = stJSON('turret.best.' + key, null);
        return b && typeof b === 'object' ? b : null;
    }

    function trHistory() {
        const h = stJSON('turret.history', []);
        return Array.isArray(h) ? h : [];
    }

    /* ---- sorties ----------------------------------------------------------
     * One pass through the set. It ends when every fact has been answered
     * right once — first time, or on its ace. The player cannot lose; what is
     * scored is how many were right first time, the sortie's length, and the
     * median time to a right answer. Times are real seconds the loop ran, so
     * a tab left in the background does not count against anyone.
     */
    function trLaunch() {
        trAudioUnlock();
        const deck = trShuffle(trBuildDeck(tr.set));
        if (!deck.length) return;
        tr.deck = deck;
        tr.aceQ = [];
        for (let i = 0; i < tr.foes.length; i++) tr.foes[i].ace = null;
        tr.sortie = {
            set: trCleanSet(tr.set), key: trSetKey(tr.set), label: trSetLabel(tr.set),
            total: deck.length, keys: deck.map((q) => q.key), before: trLevelCounts(deck),
            cleared: 0, firstTry: 0, seen: {}, missed: [], times: [],
            elapsed: 0, finishing: 0, toldAce: false, hudSec: -1, hudCleared: -1, hudAces: -1,
        };
        $('tr-brief').classList.add('hidden');
        $('tr-debrief').classList.add('hidden');
        $('tr-hud').classList.remove('hidden');
        $('tr-end').classList.remove('hidden');
        $('tr-gear').classList.add('hidden');
        trToast('Drag to aim · tap a ship to fire', 6);
        trHud();
    }

    function trScore(q, right, ms) {
        const S = tr.sortie;
        if (!S) return;
        if (!S.seen[q.key]) {
            S.seen[q.key] = true;
            if (right) S.firstTry++;
        }
        if (right) {
            S.cleared++;
            S.times.push(ms);
            if (S.cleared >= S.total) S.finishing = FINISH_S;
        } else if (S.missed.indexOf(q.text) < 0) S.missed.push(q.text);
    }

    function trUpdateSortie(dt) {
        if (tr.toastLeft > 0) {
            tr.toastLeft -= dt;
            if (tr.toastLeft <= 0) $('tr-hint').classList.add('tr-gone');
        }
        const S = tr.sortie;
        if (!S) return;
        if (S.finishing > 0) {
            S.finishing -= dt;
            if (S.finishing <= 0) trEndSortie(true);
            return;
        }
        S.elapsed += dt;
        trHud();
    }

    function trAcesLeft() {
        let n = tr.aceQ.length;
        for (let i = 0; i < tr.foes.length; i++) {
            const e = tr.foes[i];
            if (e.active && e.ace && !e.dodging) n++;
        }
        return n;
    }

    function trClock(s) {
        const t = Math.floor(s);
        return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    }

    // Written only when a number on it changes — DOM writes cost too.
    function trHud() {
        const S = tr.sortie;
        const sec = Math.floor(S.elapsed), aces = trAcesLeft();
        if (sec === S.hudSec && S.cleared === S.hudCleared && aces === S.hudAces) return;
        S.hudSec = sec; S.hudCleared = S.cleared; S.hudAces = aces;
        $('tr-hud-cleared').textContent = S.cleared + ' / ' + S.total;
        $('tr-hud-time').textContent = trClock(S.elapsed);
        $('tr-hud-aces').textContent = aces ? aces + ' gold' : '';
    }

    function trToast(msg, secs) {
        const el = $('tr-hint');
        el.textContent = msg;
        el.classList.remove('tr-gone');
        tr.toastLeft = secs;
    }

    function trEndSortie(complete) {
        const S = tr.sortie;
        if (!S) return;
        if (tr.ask) trAbortAsk();
        tr.sortie = null;
        tr.deck = [];
        tr.aceQ = [];
        for (let i = 0; i < tr.foes.length; i++) tr.foes[i].ace = null;
        if (factsW) factsW.flush();

        const median = trMedian(S.times);
        const rec = {
            at: Date.now(), key: S.key, label: S.label, total: S.total, cleared: S.cleared,
            firstTry: S.firstTry, timeMs: Math.round(S.elapsed * 1000), medianMs: median, complete,
        };
        const hist = trHistory();
        hist.push(rec);
        while (hist.length > HISTORY_N) hist.shift();
        stSetJSON('turret.history', hist);

        // Bests only from a whole sortie: a short one would always be "fastest".
        const prev = trBest(S.key);
        const news = {};
        let best = prev;
        if (complete) {
            best = Object.assign({ sorties: 0 }, prev || {});
            if (best.firstTry === undefined || rec.firstTry > best.firstTry) { best.firstTry = rec.firstTry; news.firstTry = !!prev; }
            if (best.timeMs === undefined || rec.timeMs < best.timeMs) { best.timeMs = rec.timeMs; news.time = !!prev; }
            if (median !== null && (best.medianMs === undefined || median < best.medianMs)) { best.medianMs = median; news.median = !!prev; }
            best.sorties++;
            best.total = S.total;
            stSetJSON('turret.best.' + S.key, best);
            trSfx('done');
        }

        $('tr-hud').classList.add('hidden');
        $('tr-end').classList.add('hidden');
        trShowDebrief(S, rec, best, prev, news);
    }

    /* Four options, one right. The wrong three are the mistakes this question
     * actually invites: an off-by-one or two, the neighbouring fact (7 × 9
     * for 7 × 8), and the wrong operation (7 + 8 for 7 × 8). Never negative,
     * never a duplicate. */
    function trChoices(q) {
        const { a, b, op, answer } = q;
        let near, neighbour, wrongOp;
        if (op === '×') { near = [1, -1]; neighbour = [a, -a, b, -b]; wrongOp = a + b; }
        // For division the slip is answering with the divisor.
        else if (op === '÷') { near = [1, -1, 2]; neighbour = [-2, 3]; wrongOp = b; }
        else if (op === '+') { near = [1, -1, 2, -2]; neighbour = [10, -10]; wrongOp = Math.abs(a - b); }
        else { near = [1, -1, 2, -2]; neighbour = [10, -10]; wrongOp = a + b; }

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const out = [];
        const add = (v) => { if (v >= 0 && v !== answer && out.indexOf(v) < 0 && out.length < 3) out.push(v); };
        add(answer + pick(near));
        add(answer + pick(neighbour));
        add(wrongOp);
        const fill = [1, -1, 2, -2, 3, -3, 4, 5, 6, 7, 8, 9, 10];
        for (let i = 0; out.length < 3 && i < fill.length; i++) add(answer + fill[i]);
        out.push(answer);
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    /* ---- textures ---------------------------------------------------------*/
    function trGlowTexture(size, falloff) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        const r = size / 2;
        const grad = g.createRadialGradient(r, r, 0, r, r, r);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(falloff, 'rgba(255,255,255,0.35)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;  // no mipmaps: they would cost memory for a sprite that never gets small
        return tex;
    }

    /* ---- geometry ---------------------------------------------------------
     * Shading is baked per face from a fixed light, so no material needs
     * lights. `rgbOf(k)` gives face k its base colour.
     */
    function trBake(pos, rgbOf, centre) {
        const col = new Float32Array(pos.length);
        const light = new THREE.Vector3(0.4, 1, 0.3).normalize();
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        const n = new THREE.Vector3(), e = new THREE.Vector3(), mid = new THREE.Vector3();
        for (let k = 0; k < pos.length / 9; k++) {
            a.fromArray(pos, k * 9); b.fromArray(pos, k * 9 + 3); c.fromArray(pos, k * 9 + 6);
            n.subVectors(b, a).cross(e.subVectors(c, a)).normalize();
            // Windings are not trusted, so take whichever normal faces away
            // from the centre. Materials are double-sided where it matters.
            mid.copy(a).add(b).add(c).divideScalar(3).sub(centre);
            if (n.dot(mid) < 0) n.negate();
            const shade = 0.35 + 0.65 * Math.max(0, n.dot(light));
            const rgb = rgbOf(k);
            for (let j = 0; j < 3; j++) {
                const o = k * 9 + j * 3;
                col[o] = rgb[0] * shade; col[o + 1] = rgb[1] * shade; col[o + 2] = rgb[2] * shade;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
    }

    // A fighter: a diamond-section dart, two wings and a fin, nose along +Z
    // so Object3D.lookAt points it where it is going. Baked in grey: the
    // colour is per instance, so an ace is the same mesh painted gold.
    function trShipGeometry() {
        const N = [0, 0, 2.2], T = [0, 0.55, -0.7], B = [0, -0.4, -0.7],
            L = [-0.55, 0, -0.7], R = [0.55, 0, -0.7], A = [0, 0, -1.3];
        const HULL = [1, 1, 1], WING = [0.64, 0.64, 0.64];
        const tris = [
            [N, T, R, HULL], [N, R, B, HULL], [N, B, L, HULL], [N, L, T, HULL],
            [A, R, T, HULL], [A, B, R, HULL], [A, L, B, HULL], [A, T, L, HULL],
            [[-0.4, 0, 0.3], [-2.0, -0.15, -1.35], [-0.35, 0, -1.0], WING],
            [[0.4, 0, 0.3], [2.0, -0.15, -1.35], [0.35, 0, -1.0], WING],
            [[0, 0.45, -0.5], [0, 1.0, -1.4], [0, 0.3, -1.25], WING],
        ];
        const pos = new Float32Array(tris.length * 9);
        tris.forEach((t, k) => { for (let j = 0; j < 3; j++) pos.set(t[j], k * 9 + j * 3); });
        return trBake(pos, (k) => tris[k][3], new THREE.Vector3(0, 0, -0.4));
    }

    // A lumpy rock: an icosphere with each vertex pushed in or out by a hash
    // of where it is. The geometry is non-indexed, so a shared corner exists
    // once per face — hashing the rounded position moves every copy alike,
    // where a random number per vertex would tear the faces apart.
    function trRockGeometry() {
        const src = new THREE.IcosahedronGeometry(1, 1);
        const pos = Float32Array.from(src.attributes.position.array);
        src.dispose();
        const hash = (x, y, z) => {
            const h = Math.sin(Math.round(x * 1000) * 12.9898 + Math.round(y * 1000) * 78.233
                + Math.round(z * 1000) * 37.719) * 43758.5453;
            return h - Math.floor(h);
        };
        for (let i = 0; i < pos.length; i += 3) {
            const f = 0.75 + 0.45 * hash(pos[i], pos[i + 1], pos[i + 2]);
            pos[i] *= f; pos[i + 1] *= f * 0.85; pos[i + 2] *= f;
        }
        return trBake(pos, (k) => {
            const v = 0.85 + 0.3 * hash(k, k * 0.37, 1);
            return [0.44 * v, 0.39 * v, 0.34 * v];
        }, new THREE.Vector3());
    }

    /* ---- scene: sky -------------------------------------------------------*/
    function trBuildStars() {
        const pos = new Float32Array(MAX_STARS * 3);
        const col = new Float32Array(MAX_STARS * 3);
        for (let i = 0; i < MAX_STARS; i++) {
            // Uniform on a sphere inside the far plane. The first N of a random
            // list are random, so a draw range is a fair thinning.
            const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
            const s = Math.sqrt(1 - u * u), R = 140;
            pos[i * 3] = R * s * Math.cos(th); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * s * Math.sin(th);
            const lum = 0.35 + Math.random() * 0.65, warm = Math.random() * 0.2;
            col[i * 3] = lum * (0.85 + warm); col[i * 3 + 1] = lum * 0.9; col[i * 3 + 2] = lum * (1.05 - warm);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false });
        const pts = new THREE.Points(geo, mat);
        pts.renderOrder = -2;
        return pts;
    }

    function trBuildNebulae(group) {
        const tex = trGlowTexture(128, 0.45);
        [[0x5a2a8a, -0.5, 0.35, -1, 95], [0x1f5a6a, 0.7, 0.1, -0.8, 80], [0x7a2450, 0.1, 0.7, -0.6, 70]]
            .forEach(([hex, x, y, z, size]) => {
                const mat = new THREE.SpriteMaterial({
                    map: tex, color: hex, transparent: true, opacity: 0.35,
                    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
                });
                const s = new THREE.Sprite(mat);
                s.position.set(x, y, z).normalize().multiplyScalar(130);
                s.scale.set(size, size, 1);
                s.renderOrder = -1;
                group.add(s);
            });
    }

    /* ---- scene: dust ------------------------------------------------------*/
    function trRespawnDust(i, anywhere) {
        const p = tr.dustP;
        let x, y;
        // Keep streaks off the line of flight: one passing through the camera
        // is a full-screen flash, not dust.
        do {
            x = (Math.random() - 0.5) * DUST_W;
            y = (Math.random() - 0.5) * DUST_H;
        } while (Math.abs(x) < 3 && Math.abs(y) < 3);
        p[i * 3] = x; p[i * 3 + 1] = y;
        p[i * 3 + 2] = anywhere ? -DUST_D * 0.8 + Math.random() * DUST_D : -DUST_D * 0.8;
    }

    function trBuildDust() {
        tr.dustP = new Float32Array(MAX_DUST * 3);
        for (let i = 0; i < MAX_DUST; i++) trRespawnDust(i, true);
        const pos = new Float32Array(MAX_DUST * 6);
        const col = new Float32Array(MAX_DUST * 6);
        for (let i = 0; i < MAX_DUST; i++) {
            // Bright head, black tail: under additive blending black is
            // nothing, so the streak fades out behind itself for free.
            const lum = 0.45 + Math.random() * 0.55;
            col[i * 6] = 0.75 * lum; col[i * 6 + 1] = 0.85 * lum; col[i * 6 + 2] = lum;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const lines = new THREE.LineSegments(geo, mat);
        lines.frustumCulled = false;         // the bounding sphere would be computed once, from the first frame
        return lines;
    }

    /* ---- scene: pools -----------------------------------------------------
     * Each pool is an InstancedMesh drawn with `count` = the live ones, packed
     * to the front each frame. Pool slots and instance slots are not the
     * same index, which is why gameplay code holds pool objects, never
     * instance numbers. frustumCulled is off on all of them: an instanced
     * mesh's bounding sphere is its base geometry's, at the origin.
     */
    function trInstanced(geo, mat, max) {
        const mesh = new THREE.InstancedMesh(geo, mat, max);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        return mesh;
    }

    function trGlowPoints(max, hex, size) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setDrawRange(0, 0);
        const mat = new THREE.PointsMaterial({
            map: tr.glowTex, color: hex, size, sizeAttenuation: true,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        return pts;
    }

    function trBuildPools() {
        tr.rockMesh = trInstanced(trRockGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_ROCKS);
        tr.rocks = [];
        for (let i = 0; i < MAX_ROCKS; i++) {
            tr.rocks.push({ active: false, pos: new THREE.Vector3(), axis: new THREE.Vector3(), angle: 0, spin: 0, size: 1 });
        }

        tr.enemyMesh = trInstanced(trShipGeometry(),
            new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), MAX_ENEMIES);
        // Every slot gets a colour now: the instance-colour attribute changes
        // the shader, and adding it after the first draw would mean a recompile.
        // Made by hand because setColorAt sizes it from `count`, which is 0.
        tr.enemyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 3), 3)
            .setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < MAX_ENEMIES; i++) tr.enemyMesh.setColorAt(i, FOE_COL);
        tr.glows = trGlowPoints(MAX_ENEMIES, 0xffffff, 2.4);
        tr.glows.material.vertexColors = true;
        tr.glows.geometry.setAttribute('color',
            new THREE.BufferAttribute(new Float32Array(MAX_ENEMIES * 3), 3).setUsage(THREE.DynamicDrawUsage));
        tr.foes = [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
            tr.foes.push({ active: false, locked: false, dodging: false, ace: null, rollDir: 1,
                pts: new Float32Array(21), segs: 1, t0: 0, dur: 1, pos: new THREE.Vector3() });
        }

        const boltGeo = new THREE.OctahedronGeometry(1, 0);
        boltGeo.scale(0.16, 0.16, 2.0);
        tr.boltMesh = trInstanced(boltGeo, new THREE.MeshBasicMaterial({
            color: 0x8ff3ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }), MAX_BOLTS);
        tr.boltGlows = trGlowPoints(MAX_BOLTS, 0x5fd8ff, 2.6);
        tr.bolts = [];
        for (let i = 0; i < MAX_BOLTS; i++) {
            tr.bolts.push({ active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, t1: 1, target: null });
        }

        // Sparks fade by darkening — under additive blending a black point is
        // no point — so dead sparks need no compaction, just a zero colour.
        const sgeo = new THREE.BufferGeometry();
        sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3).setUsage(THREE.DynamicDrawUsage));
        sgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3).setUsage(THREE.DynamicDrawUsage));
        tr.sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({
            map: tr.glowTex, size: 1.8, sizeAttenuation: true, vertexColors: true,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        tr.sparks.frustumCulled = false;
        tr.spark = {
            vel: new Float32Array(MAX_SPARKS * 3), base: new Float32Array(MAX_SPARKS * 3),
            life: new Float32Array(MAX_SPARKS), max: new Float32Array(MAX_SPARKS), next: 0,
        };
    }

    function trBuild() {
        if (typeof THREE === 'undefined') { trShowLost('3D graphics did not load. Check the connection and refresh.'); return false; }
        V1 = new THREE.Vector3(); V2 = new THREE.Vector3(); V3 = new THREE.Vector3(); V4 = new THREE.Vector3();
        SIZE = new THREE.Vector2(); DUMMY = new THREE.Object3D();
        DQ = new THREE.Quaternion(); EUL = new THREE.Euler(0, 0, 0, 'YXZ'); UP = new THREE.Vector3(0, 1, 0);
        FOE_COL = new THREE.Color(0.82, 0.24, 0.2); ACE_COL = new THREE.Color(1.0, 0.78, 0.2);

        const canvas = document.createElement('canvas');
        canvas.className = 'tr-canvas';
        tr.stage.insertBefore(canvas, tr.stage.firstChild);
        try {
            tr.renderer = new THREE.WebGLRenderer({
                canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance',
            });
        } catch (err) {
            canvas.remove();
            trShowLost('This device could not start 3D graphics.');
            return false;
        }
        tr.canvas = canvas;
        tr.renderer.setPixelRatio(1);
        tr.renderer.setClearColor(BG);
        canvas.addEventListener('webglcontextlost', trOnContextLost);
        canvas.addEventListener('webglcontextrestored', trOnContextRestored);

        tr.scene = new THREE.Scene();
        tr.scene.fog = new THREE.Fog(BG, 25, 120);
        tr.camera = new THREE.PerspectiveCamera(70, 16 / 10, 0.5, 160);
        tr.camera.rotation.order = 'YXZ';    // yaw, then pitch — a turret, not a free camera
        tr.rig = new THREE.Object3D();
        tr.rig.add(tr.camera);
        tr.scene.add(tr.rig);

        tr.glowTex = trGlowTexture(64, 0.3);
        tr.sky = new THREE.Group();
        tr.stars = trBuildStars();
        tr.sky.add(tr.stars);
        trBuildNebulae(tr.sky);
        tr.scene.add(tr.sky);
        tr.dust = trBuildDust();
        tr.scene.add(tr.dust);
        trBuildPools();
        [tr.rockMesh, tr.enemyMesh, tr.glows, tr.boltMesh, tr.boltGlows, tr.sparks].forEach((o) => tr.scene.add(o));
        // One flash for an explosion, reused: a sprite swelling and fading
        // reads as a fireball for the price of one quad.
        tr.flash = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tr.glowTex, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }));
        tr.flash.visible = false;
        tr.flashLife = 0;
        tr.scene.add(tr.flash);

        tr.pilot = { m: MANOEUVRES[0], since: tr.wt, until: tr.wt + 3, yawRate: 0, pitchRate: 0, belt: false, beltUntil: tr.wt + 6 };
        tr.spawnAt = tr.wt + 1;
        tr.lockFoe = null;
        trApplyTier();
        return true;
    }

    function trTeardown() {
        // Aces in the air go with the scene, but their facts are still owed.
        if (tr.sortie) {
            for (let i = 0; i < tr.foes.length; i++) {
                const e = tr.foes[i];
                if (e.active && e.ace && !e.locked && !e.dodging) trQueueAce(e.ace, 1);
            }
        }
        tr.foes = [];
        if (tr.scene) {
            tr.scene.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    if (o.material.map) o.material.map.dispose();
                    o.material.dispose();
                }
            });
        }
        if (tr.renderer) tr.renderer.dispose();
        if (tr.canvas) tr.canvas.remove();
        tr.renderer = tr.scene = tr.camera = tr.rig = tr.sky = tr.canvas = null;
        tr.lockFoe = null;
        $('tr-lock').classList.add('hidden');
        // The fighter and bolt a question was about are gone with the scene.
        // The fact is not answered, so it goes back where it came from.
        if (tr.ask) {
            if (tr.ask.phase === 'ask' && tr.sortie) {
                if (tr.ask.fromAce) trQueueAce(tr.ask.q, 1);
                else tr.deck.unshift(tr.ask.q);
            }
            trListenStop();
            trCloseAsk();
        }
        tr.timeScale = 1;
        tr.flash = null;
    }

    /* ---- context loss -----------------------------------------------------*/
    function trShowLost(msg) {
        const el = $('tr-lost');
        el.textContent = msg;
        el.classList.toggle('hidden', !msg);
    }

    function trOnContextLost(e) {
        e.preventDefault();                  // without this the browser never offers it back
        tr.lost = true;
        trStop();
        trShowLost('Graphics paused. Restoring…');
    }

    function trOnContextRestored() {
        tr.lost = false;
        trShowLost('');
        trTeardown();
        if (trScreenActive() && !document.hidden) trStart();
    }

    /* ---- tiers and sizing -------------------------------------------------*/
    function trApplyTier() {
        const T = TIERS[tr.tier];
        if (tr.renderer) {
            tr.stars.geometry.setDrawRange(0, T.stars);
            tr.dust.geometry.setDrawRange(0, T.dust * 2);
            trResize();
        }
        trProbeReset();
        document.querySelectorAll('[data-tr-tier]').forEach((b) => {
            const k = b.dataset.trTier;
            b.classList.toggle('active', k === 'auto' ? tr.auto : k === tr.tier);
        });
        document.querySelectorAll('[data-tr-cap]').forEach((b) =>
            b.classList.toggle('active', Number(b.dataset.trCap) === tr.cap));
    }

    function trSetTier(name, auto) {
        tr.tier = name;
        tr.auto = auto;
        trSaveSettings();
        trApplyTier();
    }

    function trResize() {
        if (!tr.renderer) return;
        const w = tr.stage.clientWidth, h = tr.stage.clientHeight;
        if (!w || !h) return;                // display:none reports zero; keep the last good size
        tr.cssW = w; tr.cssH = h;
        const s = TIERS[tr.tier].scale;
        tr.renderer.setSize(Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), false);
        tr.camera.aspect = w / h;
        tr.camera.updateProjectionMatrix();
    }

    /* ---- loop -------------------------------------------------------------*/
    function trScreenActive() {
        const s = $('turret-screen');
        return !!s && s.classList.contains('active');
    }

    function trStart() {
        if (tr.running || tr.lost || tr.adminOpen) return;
        if (!tr.renderer && !trBuild()) return;
        tr.running = true;
        tr.last = performance.now();
        trResize();
        trProbeReset();
        tr.raf = requestAnimationFrame(trFrame);
        // A spoken question left open while the screen was away listens again.
        if (tr.ask && tr.ask.phase === 'ask' && tr.ask.mode === 'spoken') trListenStart();
    }

    function trStop() {
        tr.running = false;
        cancelAnimationFrame(tr.raf);
        // The microphone is not held for a screen nobody is looking at.
        trListenStop();
    }

    function trFrame(now) {
        if (!tr.running) return;
        tr.raf = requestAnimationFrame(trFrame);
        // rAF lands within a millisecond or so of the vsync, so without the
        // slack a 30 fps cap on a 60 Hz panel would skip a frame it should take.
        const gap = now - tr.last;
        if (gap < 1000 / tr.cap - 2) return;
        tr.last = now;
        const dt = Math.min(gap / 1000, 0.1);    // a stall must not teleport anything

        const t0 = performance.now();
        trUpdate(dt);
        tr.renderer.render(tr.scene, tr.camera);
        trProbeRecord(gap, performance.now() - t0, now);
    }

    function trUpdate(dt) {
        trUpdateTime(dt);
        const wdt = dt * tr.timeScale;
        tr.wt += wdt;

        // The turret eases toward the aim on real time, so it stays
        // responsive whatever the world clock is doing.
        const k = 1 - Math.exp(-dt * 14);
        tr.yaw += (tr.aimYaw - tr.yaw) * k;
        tr.pitch += (tr.aimPitch - tr.pitch) * k;
        tr.camera.rotation.set(tr.pitch, tr.yaw, 0);
        // Recoil and blast shake: a decaying jitter of the camera inside the
        // rig, on real time so a hit during the snap-back still shakes.
        tr.shake *= Math.exp(-dt * 9);
        if (tr.shake > 0.002) tr.camera.position.set((Math.random() - 0.5) * tr.shake, (Math.random() - 0.5) * tr.shake, 0);
        else if (tr.shake) { tr.shake = 0; tr.camera.position.set(0, 0, 0); }

        trUpdatePilot(wdt);
        trUpdateDust(wdt);
        trUpdateRocks(wdt);
        trUpdateSpawner();
        trUpdateFoes();
        trUpdateBolts();
        trUpdateSparks(wdt);
        trUpdateFlash(wdt);
        trUpdateLockMark();
        trUpdateAsk(dt);
        trUpdateSortie(dt);
    }

    /* ---- the pilot --------------------------------------------------------*/
    function trPilotNext() {
        const P = tr.pilot;
        let m;
        do { m = MANOEUVRES[Math.floor(Math.random() * MANOEUVRES.length)]; } while (m === P.m);
        P.m = m;
        P.since = tr.wt;
        P.until = tr.wt + rand(m.dur[0], m.dur[1]);
    }

    // Sets DQ to this frame's turn of the WORLD — the inverse of the ship's.
    function trUpdatePilot(wdt) {
        const P = tr.pilot;
        if (tr.wt >= P.until) trPilotNext();
        const yawTo = P.m.weave ? 0.2 * Math.sin(1.2 * (tr.wt - P.since)) : P.m.yaw;
        const k = 1 - Math.exp(-wdt * 1.2);
        P.yawRate += (yawTo - P.yawRate) * k;
        P.pitchRate += (P.m.pitch - P.pitchRate) * k;

        if (tr.wt >= P.beltUntil) {
            P.belt = !P.belt;
            P.beltUntil = tr.wt + (P.belt ? rand(14, 24) : rand(12, 28));
        }

        // Bank into the turn — a positive yaw rate is a left turn, and a
        // positive roll of the rig is left wing down. The sway and bob are
        // the pilot's hands; they are what make a straight line feel flown.
        tr.rig.rotation.z = P.yawRate * 1.8 + 0.035 * Math.sin(0.83 * tr.wt);
        tr.rig.rotation.x = 0.03 * Math.sin(0.47 * tr.wt);
        tr.rig.position.y = 0.3 * Math.sin(0.6 * tr.wt);

        EUL.set(-P.pitchRate * wdt, -P.yawRate * wdt, 0);
        DQ.setFromEuler(EUL);
        tr.sky.quaternion.premultiply(DQ).normalize();   // thousands of products drift off unit length
    }

    /* ---- the world: dust and rocks ----------------------------------------*/
    function trUpdateDust(wdt) {
        const T = TIERS[tr.tier];
        const p = tr.dustP;
        const arr = tr.dust.geometry.attributes.position.array;
        const step = SPEED * wdt;
        for (let i = 0; i < T.dust; i++) {
            V1.fromArray(p, i * 3).applyQuaternion(DQ);
            V1.z += step;
            V1.toArray(p, i * 3);
            // A hard turn sweeps dust out of the box sideways as well as past.
            if (V1.z > DUST_D * 0.2 || V1.z < -DUST_D || Math.abs(V1.x) > DUST_W || Math.abs(V1.y) > DUST_H) {
                trRespawnDust(i, false);
            }
            const o = i * 6;
            arr[o] = arr[o + 3] = p[i * 3];
            arr[o + 1] = arr[o + 4] = p[i * 3 + 1];
            arr[o + 2] = p[i * 3 + 2];
            arr[o + 5] = p[i * 3 + 2] - STREAK;
        }
        tr.dust.geometry.attributes.position.needsUpdate = true;
    }

    function trUpdateRocks(wdt) {
        const T = TIERS[tr.tier];
        let live = 0;
        for (let i = 0; i < MAX_ROCKS; i++) if (tr.rocks[i].active) live++;

        // A belt is the same rocks spawned faster. Between belts nothing new
        // is spawned and the field thins out on its own.
        if (tr.pilot.belt && tr.wt >= tr.rockAt && live < T.rocks) {
            const r = tr.rocks.find((x) => !x.active);
            let x = rand(-70, 70), y = rand(-45, 45);
            // Never on the line of flight: a rock through the cockpit is not a set piece.
            if (Math.abs(x) < 12 && Math.abs(y) < 9) x = x < 0 ? x - 14 : x + 14;
            r.pos.set(x, y, rand(-180, -150));
            r.axis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
            r.angle = rand(0, 6.3);
            r.spin = rand(-0.6, 0.6);
            r.size = rand(1.5, 5.5);
            r.active = true;
            // A rock lives about five seconds, so this keeps a belt near full.
            tr.rockAt = tr.wt + rand(0.3, 0.7);
        }

        let n = 0;
        for (let i = 0; i < MAX_ROCKS; i++) {
            const r = tr.rocks[i];
            if (!r.active) continue;
            r.pos.applyQuaternion(DQ);
            r.pos.z += SPEED * wdt;
            if (r.pos.z > 15) { r.active = false; continue; }
            r.angle += r.spin * wdt;
            DUMMY.position.copy(r.pos);
            DUMMY.quaternion.setFromAxisAngle(r.axis, r.angle);
            DUMMY.scale.setScalar(r.size);
            DUMMY.updateMatrix();
            tr.rockMesh.setMatrixAt(n++, DUMMY.matrix);
        }
        tr.rockMesh.count = n;
        tr.rockMesh.instanceMatrix.needsUpdate = true;
    }

    /* ---- enemies ----------------------------------------------------------*/
    function trPathAt(e, wt, out) {
        const u = clamp((wt - e.t0) / e.dur, 0, 1);
        const f = u * e.segs;
        const s = Math.min(e.segs - 1, Math.floor(f));
        const t = f - s, it = 1 - t;
        const b0 = it * it * it, b1 = 3 * it * it * t, b2 = 3 * it * t * t, b3 = t * t * t;
        const p = e.pts, o = s * 9;
        return out.set(
            b0 * p[o] + b1 * p[o + 3] + b2 * p[o + 6] + b3 * p[o + 9],
            b0 * p[o + 1] + b1 * p[o + 4] + b2 * p[o + 7] + b3 * p[o + 10],
            b0 * p[o + 2] + b1 * p[o + 5] + b2 * p[o + 8] + b3 * p[o + 11]
        );
    }

    function trSpawnFoe(path, mirror, delay, offset, ace) {
        const e = tr.foes.find((x) => !x.active);
        if (!e) return;
        e.ace = ace || null;
        const last = path.pts.length - 1;
        path.pts.forEach((pt, i) => {
            // Jitter the inner control points so no two passes are identical;
            // the end points stay out in the fog where they belong.
            const j = i === 0 || i === last ? 0 : 6;
            e.pts[i * 3] = (mirror ? -pt[0] : pt[0]) + rand(-j, j) + (offset ? offset[0] : 0);
            e.pts[i * 3 + 1] = pt[1] + rand(-j, j) + (offset ? offset[1] : 0);
            e.pts[i * 3 + 2] = pt[2] + rand(-j, j) + (offset ? offset[2] : 0);
        });
        // Jitter breaks the collinearity at a joint; restore it by putting
        // each joint back at the midpoint of its neighbours.
        for (let s = 3; s < last; s += 3) {
            for (let c = 0; c < 3; c++) e.pts[s * 3 + c] = (e.pts[(s - 1) * 3 + c] + e.pts[(s + 1) * 3 + c]) / 2;
        }
        e.segs = last / 3;
        e.dur = path.dur;
        e.t0 = tr.wt + delay;
        e.locked = false;
        e.dodging = false;
        e.active = true;
        trPathAt(e, e.t0, e.pos);
    }

    function trUpdateSpawner() {
        if (tr.wt < tr.spawnAt) return;
        const T = TIERS[tr.tier];
        let busy = 0;
        for (let i = 0; i < MAX_ENEMIES; i++) if (tr.foes[i].active) busy++;
        if (busy >= T.enemies) { tr.spawnAt = tr.wt + 0.5; return; }
        const path = PATHS[Math.floor(Math.random() * PATHS.length)];
        const mirror = Math.random() < 0.5;
        const S = tr.sortie;
        if (S && !S.finishing) {
            // A due ace goes first. With the deck spent there is nothing else
            // to ask, so every waiting ace is due and plain fighters stop.
            const spent = !tr.deck.length;
            for (let i = 0; i < tr.aceQ.length; i++) {
                if (!spent && tr.aceQ[i].at > tr.wt) continue;
                trSpawnFoe(path, mirror, 0, null, tr.aceQ.splice(i, 1)[0].q);
                trSfx('ace');
                if (!S.toldAce && !tr.ask) {
                    S.toldAce = true;
                    trToast('Gold ships carry the ones you missed', 3.5);
                }
                tr.spawnAt = tr.wt + rand(1.2, 2.8);
                return;
            }
            if (spent) { tr.spawnAt = tr.wt + 0.5; return; }
        }
        trSpawnFoe(path, mirror, 0, null);
        if (busy + 2 <= T.enemies && Math.random() < 0.3) trSpawnFoe(path, mirror, WING_DELAY, WING_OFFSET);
        tr.spawnAt = tr.wt + rand(1.2, 2.8);
    }

    function trUpdateFoes() {
        const gpos = tr.glows.geometry.attributes.position.array;
        const gcol = tr.glows.geometry.attributes.color.array;
        let n = 0;
        for (let i = 0; i < MAX_ENEMIES; i++) {
            const e = tr.foes[i];
            if (!e.active) continue;
            if (tr.wt < e.t0) continue;                 // a wingman not yet airborne
            // A locked fighter is held to the end of its path until its bolt
            // lands; a lock is refused too close to the end for that to matter.
            if (tr.wt >= e.t0 + e.dur && !e.locked) {
                // An ace that got away unasked comes round again. One that
                // swerved has already been queued by its miss.
                if (e.ace && !e.dodging && tr.sortie) trQueueAce(e.ace, 1.5);
                e.ace = null;
                e.active = false;
                continue;
            }

            trPathAt(e, tr.wt, e.pos);
            trPathAt(e, tr.wt + 0.05, V2);
            trPathAt(e, tr.wt - 0.05, V3);
            // Bank from lateral acceleration: the second difference over the
            // step squared, projected on the side axis.
            V4.subVectors(V2, V3);                      // velocity × 0.1
            V1.copy(V2).add(V3).addScaledVector(e.pos, -2);
            const lateral = V1.dot(V4.cross(UP).normalize()) / 0.0025;
            let bank = clamp(lateral * 0.015, -1.2, 1.2);
            // A swerving fighter throws in a full barrel roll, toward its break.
            if (e.dodging) {
                const r = clamp((tr.wt - e.t0) / 0.7, 0, 1);
                bank += e.rollDir * Math.PI * 2 * r * r * (3 - 2 * r);
            }

            DUMMY.position.copy(e.pos);
            DUMMY.scale.setScalar(SHIP_SCALE);
            DUMMY.lookAt(V2);
            DUMMY.rotateZ(bank);
            DUMMY.updateMatrix();
            tr.enemyMesh.setMatrixAt(n, DUMMY.matrix);
            tr.enemyMesh.setColorAt(n, e.ace ? ACE_COL : FOE_COL);

            // Engine glow behind the hull, along the direction of travel.
            V1.subVectors(e.pos, V2).normalize().multiplyScalar(1.5 * SHIP_SCALE).add(e.pos);
            gpos[n * 3] = V1.x; gpos[n * 3 + 1] = V1.y; gpos[n * 3 + 2] = V1.z;
            const g = e.ace ? ACE_GLOW : FOE_GLOW;
            gcol[n * 3] = g[0]; gcol[n * 3 + 1] = g[1]; gcol[n * 3 + 2] = g[2];
            n++;
        }
        tr.enemyMesh.count = n;
        tr.enemyMesh.instanceMatrix.needsUpdate = true;
        tr.enemyMesh.instanceColor.needsUpdate = true;
        tr.glows.geometry.setDrawRange(0, n);
        tr.glows.geometry.attributes.position.needsUpdate = true;
        tr.glows.geometry.attributes.color.needsUpdate = true;
    }

    /* ---- firing -----------------------------------------------------------*/
    // The nearest fighter to a tap, on screen, inside the lock radius.
    // Locks only happen in a sortie, and a plain fighter is only worth
    // locking while the deck still has a question for it.
    function trPickFoe(nx, ny, w, h) {
        const S = tr.sortie;
        if (!S || S.finishing) return null;
        let best = null, bestD = Math.max(LOCK_PX, w * 0.08);
        for (const e of tr.foes) {
            if (!e.active || e.locked || e.dodging || tr.wt < e.t0) continue;
            if (!e.ace && !tr.deck.length) continue;
            if (e.pos.length() > SIGHT) continue;       // still in the fog: the player cannot see it
            V3.copy(e.pos).applyMatrix4(tr.camera.matrixWorldInverse);
            if (V3.z > -1) continue;                    // behind the turret
            V2.copy(e.pos).project(tr.camera);
            const d = Math.hypot((V2.x - nx) * w / 2, (V2.y - ny) * h / 2);
            if (d < bestD) { best = e; bestD = d; }
        }
        return best;
    }

    // World time at which a bolt from `from` meets the fighter, by fixed-point
    // iteration on the known path: aim, see how long that takes, re-aim. Four
    // rounds is far past the precision a 0.2-unit-wide bolt needs.
    function trLead(e, from) {
        let t = tr.wt;
        for (let i = 0; i < 4; i++) {
            trPathAt(e, t, V2);
            t = tr.wt + V2.distanceTo(from) / BOLT_SPEED;
        }
        return t;
    }

    function trMuzzle(out) {
        // The overlay's barrel tips, put into the 3D view: 12.5% of the half-
        // width either side of centre, 58% of the half-height down.
        const hh = 1.6 * Math.tan(THREE.MathUtils.degToRad(tr.camera.fov / 2));
        tr.barrel = -tr.barrel;
        out.set(tr.barrel * 0.125 * hh * tr.camera.aspect, -0.58 * hh, -1.6);
        return tr.camera.localToWorld(out);
    }

    function trSpawnBolt(from, to, t1, target) {
        const b = tr.bolts.find((x) => !x.active);
        if (!b) return null;
        b.from.copy(from);
        b.to.copy(to);
        b.t0 = tr.wt;
        b.t1 = t1;
        b.target = target;
        b.active = true;
        return b;
    }

    function trFire(clientX, clientY) {
        // While a card is up the stage is not a trigger: a stray tap beside
        // an answer button must not fire, and one lock at a time keeps one
        // question at a time.
        if (!tr.running || tr.ask) return;
        const r = tr.stage.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1;
        const ny = -((clientY - r.top) / r.height) * 2 + 1;
        tr.scene.updateMatrixWorld();                   // the camera's matrices, as of this frame's aim

        const muzzle = trMuzzle(V1);
        const flash = $(tr.barrel > 0 ? 'tr-barrel-r' : 'tr-barrel-l');
        flash.classList.remove('tr-fire');
        void flash.getBoundingClientRect();             // restart the flash if the same barrel fires twice
        flash.classList.add('tr-fire');
        trSfx('zap');
        tr.shake = Math.max(tr.shake, 0.06);

        const foe = trPickFoe(nx, ny, r.width, r.height);
        if (foe) {
            const tHit = trLead(foe, muzzle);
            if (tHit < foe.t0 + foe.dur - 0.15) {
                trOnLock(foe, muzzle, tHit);
                return;
            }
        }
        // A free shot, along the ray through the tap.
        V2.set(nx, ny, 0.5).unproject(tr.camera).sub(tr.camera.getWorldPosition(V3)).normalize();
        V3.addScaledVector(V2, 150);
        trSpawnBolt(muzzle, V3, tr.wt + muzzle.distanceTo(V3) / BOLT_SPEED, null);
    }

    // A lock fires a bolt that WILL hit — it is aimed at where the path puts
    // the fighter on arrival — and then asks. A right answer lets it land; a
    // wrong one changes the fighter's path, not the bolt's.
    function trOnLock(foe, muzzle, tHit) {
        trPathAt(foe, tHit, V2);
        const bolt = trSpawnBolt(muzzle, V2, tHit, foe);
        if (!bolt) return;                              // every bolt in flight: the tap is simply lost
        foe.locked = true;
        tr.lockFoe = foe;
        trSfx('slow');
        trAsk(foe, bolt);
    }

    /* ---- bullet time ------------------------------------------------------*/
    function trUpdateTime(dt) {
        const A = tr.ask;
        let target = 1;
        if (A && A.phase === 'ask') {
            // Slow at once, then stop as the bolt reaches the hold point. The
            // ramp is linear in how far the bolt has to go, so it approaches
            // the hold point and never passes it.
            const u = (tr.wt - A.bolt.t0) / (A.bolt.t1 - A.bolt.t0);
            target = SLOW * clamp((HOLD_U - u) / 0.15, 0, 1);
        }
        // Into slow motion fast, out of it a little slower: the snap back is
        // the payoff and reads better with a beat of acceleration.
        const rate = target < tr.timeScale ? 10 : 5;
        tr.timeScale += (target - tr.timeScale) * (1 - Math.exp(-dt * rate));
        if (target === 1 && tr.timeScale > 0.995) tr.timeScale = 1;

        const fov = A && A.phase === 'ask' ? ZOOM_FOV : BASE_FOV;
        if (Math.abs(tr.camera.fov - fov) > 0.05) {
            tr.camera.fov += (fov - tr.camera.fov) * (1 - Math.exp(-dt * 6));
            tr.camera.updateProjectionMatrix();
        }
    }

    // Swing the turret so the target sits under the crosshair, where the
    // question card does not cover it.
    function trSlewTo(pos) {
        tr.rig.updateMatrixWorld();
        V3.copy(pos);
        tr.rig.worldToLocal(V3);
        tr.aimYaw = clamp(Math.atan2(-V3.x, -V3.z), -YAW_LIMIT, YAW_LIMIT);
        tr.aimPitch = clamp(Math.atan2(V3.y, Math.hypot(V3.x, V3.z)), PITCH_MIN, PITCH_MAX);
    }

    /* ---- the question -----------------------------------------------------
     * Phases: 'ask' (card up, world slowing to a stop), then 'right' or
     * 'reveal' (world back to speed, card showing the outcome), then closed.
     * Its clocks are real time accumulated from the loop's dt, so a question
     * left open while the tab is hidden does not time out or count as slow.
     */
    // Spoken falls back to the keypad where there is no recogniser, or the
    // microphone was refused — never to a card with no way to answer it.
    function trMode() {
        if (tr.input !== 'spoken') return tr.input;
        return typeof spSupported === 'function' && spSupported() && !tr.spDenied ? 'spoken' : 'keypad';
    }

    function trAsk(foe, bolt) {
        const fromAce = !!foe.ace;
        const q = fromAce ? foe.ace : tr.deck.shift();
        tr.ask = { foe, bolt, q, fromAce, mode: trMode(), phase: 'ask', elapsed: 0, left: 0, entry: '', choices: null, sp: null };
        $('tr-hint').classList.add('tr-gone');
        tr.toastLeft = 0;
        trSlewTo(foe.pos);
        trRenderAsk();
        if (tr.ask.mode === 'spoken') trListenStart();
    }

    function trRenderAsk() {
        const A = tr.ask;
        const card = $('tr-q');
        card.classList.remove('tr-right', 'tr-wrong');
        card.classList.toggle('tr-ace', A.fromAce);
        $('tr-q-text').textContent = A.q.text;
        $('tr-q-entry').textContent = '?';
        $('tr-q-said').textContent = '';
        $('tr-q-heard').textContent = '';
        $('tr-mic').classList.toggle('hidden', A.mode !== 'spoken');
        $('tr-timer').classList.toggle('hidden', !tr.timer);
        $('tr-timer-fill').style.transform = 'scaleX(1)';

        const choice = A.mode === 'choice';
        $('tr-pad').classList.toggle('hidden', A.mode !== 'keypad');
        ['tr-opts-l', 'tr-opts-r'].forEach((id) => {
            $(id).classList.toggle('hidden', !choice);
            $(id).textContent = '';
        });
        if (choice) {
            // Two under each thumb.
            A.choices = trChoices(A.q);
            A.choices.forEach((v, i) => {
                const btn = document.createElement('button');
                btn.className = 'tr-opt';
                btn.dataset.trChoice = String(v);
                btn.textContent = String(v);
                $(i < 2 ? 'tr-opts-l' : 'tr-opts-r').appendChild(btn);
            });
        }
        $('tr-ask').classList.remove('hidden');
        $('tr-slowmo').classList.add('tr-on');
    }

    function trKey(k) {
        const A = tr.ask;
        if (!A || A.phase !== 'ask' || A.mode !== 'keypad') return;
        const need = String(A.q.answer).length;
        if (k === 'back') A.entry = A.entry.slice(0, -1);
        else if (k === 'fire') { if (A.entry) trAnswer(Number(A.entry)); return; }
        else if (A.entry.length < 4) A.entry = (A.entry === '0' ? '' : A.entry) + k;
        $('tr-q-entry').textContent = A.entry || '?';
        // Fires the instant the value is right. As many digits as the answer
        // has, and wrong, is a miss — otherwise a child could walk the digits
        // up until one fired.
        if (A.entry && Number(A.entry) === A.q.answer) trAnswer(A.q.answer);
        else if (A.entry.length >= need && A.entry !== '0') trAnswer(Number(A.entry));
    }

    /* Spoken answers. The claim lasts one question: taken when the card goes
     * up, given back when it is answered, and dropped while the screen is
     * away. Every alternative is searched for the answer, and every number a
     * transcript could be (speechNumbers), so "twenty three" is 23 as well as
     * 20. A FINAL result naming some other number is a miss, the spoken twin
     * of the keypad's rule; an interim one is not — the child may still be
     * mid-word. The transcript is shown through textContent only. */
    // Every number the words could be. Older app.js has only the single best
    // reading; that is worse at "twenty three" but far better than nothing.
    function trHeard(text) {
        if (typeof speechNumbers === 'function') return speechNumbers(text);
        const n = typeof findNumberInSpeech === 'function' ? findNumberInSpeech(text) : null;
        return n === null ? [] : [n];
    }

    function trListenStart() {
        const A = tr.ask;
        if (!A || A.sp || typeof spListen !== 'function') return;
        const tok = spListen({
            lang: 'en-US',
            alternatives: 5,
            grammar: typeof buildNumberGrammar === 'function' ? buildNumberGrammar() : undefined,
            indicator: 'tr-mic',
            indicatorClass: 'tr-on',
            onEnd: (why) => {
                if (A.sp) A.sp = null;
                if (why === 'denied') {
                    tr.spDenied = true;
                    // This question carries on, on the keypad.
                    if (tr.ask === A && A.phase === 'ask') { A.mode = 'keypad'; trRenderAsk(); }
                }
            },
            onText: (text, info) => {
                if (tr.ask !== A || A.phase !== 'ask') return;
                $('tr-q-heard').textContent = text;
                let hit = false;
                for (let i = 0; i < info.alternatives.length; i++) {
                    if (trHeard(info.alternatives[i]).indexOf(A.q.answer) >= 0) { hit = true; break; }
                }
                if (hit) { trAnswer(A.q.answer); return; }
                if (info.final) {
                    const said = trHeard(text);
                    if (said.length) trAnswer(said[0]);
                }
            },
        });
        if (tok) A.sp = tok;
        else { A.mode = 'keypad'; trRenderAsk(); }
    }

    function trListenStop() {
        const A = tr.ask;
        if (A && A.sp) {
            const tok = A.sp;
            A.sp = null;
            spRelease(tok);
        }
    }

    // `value` is null for a timeout.
    function trAnswer(value) {
        const A = tr.ask;
        if (!A || A.phase !== 'ask') return;
        trListenStop();
        const right = value === A.q.answer;
        const ms = Math.round(A.elapsed * 1000);
        trRecord(A.q, right, ms, A.mode);
        trScore(A.q, right, ms);

        $('tr-q-entry').textContent = String(A.q.answer);
        $('tr-slowmo').classList.remove('tr-on');
        document.querySelectorAll('#tr-ask .tr-opt').forEach((b) => {
            const v = Number(b.dataset.trChoice);
            b.disabled = true;
            if (v === A.q.answer) b.classList.add('tr-opt-right');
            else if (v === value) b.classList.add('tr-opt-wrong');
        });
        if (right) {
            $('tr-q').classList.add('tr-right');
            A.phase = 'right';
            A.left = RIGHT_S;
            trSfx('right');
        } else {
            $('tr-q').classList.add('tr-wrong');
            if (value === null) $('tr-q-said').textContent = 'out of time';
            else if (A.mode !== 'choice') $('tr-q-said').textContent = 'not ' + value;
            trSwerve(A.foe, A.bolt);
            if (tr.sortie) trQueueAce(A.q, rand(ACE_DELAY[0], ACE_DELAY[1]));
            A.phase = 'reveal';
            A.left = REVEAL_S;
            trSfx('miss');
        }
    }

    function trCloseAsk() {
        tr.ask = null;
        $('tr-ask').classList.add('hidden');
        $('tr-slowmo').classList.remove('tr-on');
    }

    // Ending a sortie mid-question: nothing is recorded, the fighter breaks
    // away as if missed so the bolt does not pass through it.
    function trAbortAsk() {
        const A = tr.ask;
        trListenStop();
        if (A.phase === 'ask' && tr.renderer) trSwerve(A.foe, A.bolt);
        if (tr.lockFoe === A.foe) tr.lockFoe = null;
        trCloseAsk();
    }

    function trUpdateAsk(dt) {
        const A = tr.ask;
        if (!A) return;
        if (A.phase === 'ask') {
            A.elapsed += dt;
            if (tr.timer) {
                $('tr-timer-fill').style.transform = 'scaleX(' + Math.max(0, 1 - A.elapsed / tr.timer).toFixed(3) + ')';
                if (A.elapsed >= tr.timer) trAnswer(null);
            }
            return;
        }
        A.left -= dt;
        if (A.left <= 0) trCloseAsk();
    }

    /* The miss. The bolt keeps its line and flies on past the point it was
     * aimed at; the fighter breaks off that line. Its new path leaves from
     * where it is along the way it was going — so there is no kink — then
     * pulls hard sideways, away from the bolt, and out into the fog.
     *
     * The break is not trusted to be wide enough: where the fighter will be
     * when the bolt passes is checked, and the break is widened until it
     * clears by MISS_BY. A close fighter leaves little flight time to get
     * out of the way, and a "miss" that visibly passes through the wing is
     * worse than no swerve at all. */
    function trSwerve(foe, bolt) {
        const passAt = bolt.t1;
        const aimed = V4.copy(bolt.to);
        V1.subVectors(bolt.to, bolt.from);
        const len = V1.length(), speed = len / (bolt.t1 - bolt.t0);
        V1.divideScalar(len);
        bolt.to.copy(bolt.from).addScaledVector(V1, 160);
        bolt.t1 = bolt.t0 + 160 / speed;
        bolt.target = null;

        const p0 = trPathAt(foe, tr.wt, new THREE.Vector3());
        const vel = trPathAt(foe, tr.wt + 0.05, new THREE.Vector3()).sub(p0).multiplyScalar(20);
        const side = new THREE.Vector3().crossVectors(V1, UP).normalize();
        if (Math.random() < 0.5) side.negate();
        side.y += rand(-0.3, 0.6);
        side.normalize();

        const dur = 2.4, p = foe.pts;
        const at = new THREE.Vector3();
        for (let push = 14; push < 200; push *= 1.4) {
            const P1 = p0.clone().addScaledVector(vel, dur / 3).addScaledVector(side, push * 0.5);
            const P2 = p0.clone().addScaledVector(vel, dur * 0.45).addScaledVector(side, push);
            const P3 = P2.clone().addScaledVector(side, push * 1.5).addScaledVector(vel, dur * 0.3);
            if (P3.length() < 135) P3.setLength(135);   // leave through the fog, not in plain sight
            [p0, P1, P2, P3].forEach((v, i) => v.toArray(p, i * 3));
            foe.segs = 1;
            foe.t0 = tr.wt;
            foe.dur = dur;
            if (trPathAt(foe, passAt, at).distanceTo(aimed) >= MISS_BY) break;
        }
        foe.locked = false;
        foe.dodging = true;
        // Roll toward the break: positive roll is right wing down, and the
        // fighter's right is velocity × up.
        foe.rollDir = side.dot(vel.cross(UP)) > 0 ? 1 : -1;
        if (tr.lockFoe === foe) tr.lockFoe = null;
    }

    function trUpdateBolts() {
        const gpos = tr.boltGlows.geometry.attributes.position.array;
        let n = 0;
        for (let i = 0; i < MAX_BOLTS; i++) {
            const b = tr.bolts[i];
            if (!b.active) continue;
            const u = (tr.wt - b.t0) / (b.t1 - b.t0);
            if (u >= 1) {
                b.active = false;
                if (b.target) trHit(b.target);
                continue;
            }
            V1.lerpVectors(b.from, b.to, u);
            DUMMY.position.copy(V1);
            DUMMY.scale.setScalar(1);
            DUMMY.lookAt(b.to);
            DUMMY.updateMatrix();
            tr.boltMesh.setMatrixAt(n, DUMMY.matrix);
            gpos[n * 3] = V1.x; gpos[n * 3 + 1] = V1.y; gpos[n * 3 + 2] = V1.z;
            n++;
        }
        tr.boltMesh.count = n;
        tr.boltMesh.instanceMatrix.needsUpdate = true;
        tr.boltGlows.geometry.setDrawRange(0, n);
        tr.boltGlows.geometry.attributes.position.needsUpdate = true;
    }

    function trHit(foe) {
        trBurst(foe.pos, 28, 18, 1.0, 0.55, 0.2);
        trBurst(foe.pos, 10, 8, 1.0, 0.95, 0.8);
        tr.flash.position.copy(foe.pos);
        tr.flash.visible = true;
        tr.flashLife = 1;
        // Closer blasts shake harder; one in the fog barely at all.
        tr.shake = Math.max(tr.shake, clamp(1.2 - foe.pos.length() / 60, 0.1, 0.6));
        foe.active = false;
        foe.locked = false;
        foe.ace = null;
        if (tr.lockFoe === foe) tr.lockFoe = null;
        tr.hits++;
        trSfx('boom');
    }

    function trUpdateFlash(wdt) {
        if (!tr.flashLife) return;
        tr.flashLife = Math.max(0, tr.flashLife - wdt / 0.4);
        const f = tr.flashLife;
        tr.flash.scale.setScalar(4 + 14 * (1 - f));
        tr.flash.material.opacity = f * f;
        if (!f) tr.flash.visible = false;
    }

    /* ---- sound ------------------------------------------------------------
     * Synthesised, not sampled: nothing to fetch, nothing to decode. One
     * AudioContext, made on the Launch tap because browsers will not start
     * audio before a gesture. Nodes are made per sound — a few per second at
     * most — and are collected once they stop.
     */
    let AC = null, MASTER = null, NOISE = null;

    function trAudioUnlock() {
        if (!tr.sound) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!AC) {
            try { AC = new Ctx(); } catch (err) { return; }
            MASTER = AC.createGain();
            MASTER.gain.value = 0.5;
            MASTER.connect(AC.destination);
            NOISE = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.7), AC.sampleRate);
            const d = NOISE.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (AC.state === 'suspended') AC.resume();
    }

    function trTone(type, f0, f1, dur, vol, delay) {
        const t = AC.currentTime + (delay || 0);
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(MASTER);
        o.start(t); o.stop(t + dur + 0.02);
    }

    function trNoise(dur, vol, freq) {
        const t = AC.currentTime;
        const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
        s.buffer = NOISE;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(freq, t);
        f.frequency.exponentialRampToValueAtTime(100, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f); f.connect(g); g.connect(MASTER);
        s.start(t); s.stop(t + dur);
    }

    function trSfx(name) {
        if (!tr.sound || !AC || AC.state !== 'running') return;
        if (name === 'zap') trTone('square', 1500, 240, 0.12, 0.06);
        else if (name === 'boom') { trNoise(0.65, 0.55, 2600); trTone('sine', 150, 38, 0.5, 0.35); }
        else if (name === 'slow') trTone('sine', 440, 80, 0.55, 0.16);
        else if (name === 'right') { trTone('triangle', 660, 660, 0.09, 0.14); trTone('triangle', 990, 990, 0.16, 0.14, 0.08); }
        else if (name === 'miss') trTone('sawtooth', 320, 130, 0.32, 0.06);
        else if (name === 'ace') trTone('triangle', 880, 1320, 0.2, 0.07);
        else if (name === 'done') [523, 659, 784, 1047].forEach((f, i) => trTone('triangle', f, f, 0.2, 0.12, i * 0.11));
    }

    /* ---- sparks -----------------------------------------------------------*/
    function trBurst(at, count, speed, r, g, b) {
        const S = tr.spark;
        const pos = tr.sparks.geometry.attributes.position.array;
        for (let k = 0; k < count; k++) {
            const i = S.next;
            S.next = (i + 1) % MAX_SPARKS;              // a ring: the oldest spark gives way
            const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            const v = speed * (0.3 + 0.7 * Math.random());
            S.vel[i * 3] = v * s * Math.cos(th); S.vel[i * 3 + 1] = v * u; S.vel[i * 3 + 2] = v * s * Math.sin(th);
            pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
            S.base[i * 3] = r; S.base[i * 3 + 1] = g; S.base[i * 3 + 2] = b;
            S.life[i] = S.max[i] = rand(0.45, 0.9);
        }
    }

    function trUpdateSparks(wdt) {
        const S = tr.spark;
        const pos = tr.sparks.geometry.attributes.position.array;
        const col = tr.sparks.geometry.attributes.color.array;
        const drag = Math.exp(-2.5 * wdt);
        for (let i = 0; i < MAX_SPARKS; i++) {
            if (S.life[i] <= 0) continue;
            S.life[i] -= wdt;
            const f = S.life[i] > 0 ? S.life[i] / S.max[i] : 0;
            const o = i * 3;
            S.vel[o] *= drag; S.vel[o + 1] *= drag; S.vel[o + 2] *= drag;
            pos[o] += S.vel[o] * wdt; pos[o + 1] += S.vel[o + 1] * wdt; pos[o + 2] += S.vel[o + 2] * wdt;
            col[o] = S.base[o] * f * f; col[o + 1] = S.base[o + 1] * f * f; col[o + 2] = S.base[o + 2] * f * f;
        }
        tr.sparks.geometry.attributes.position.needsUpdate = true;
        tr.sparks.geometry.attributes.color.needsUpdate = true;
    }

    /* ---- lock bracket: DOM, following the projected target ----------------*/
    function trUpdateLockMark() {
        const el = $('tr-lock');
        const foe = tr.lockFoe;
        if (!foe) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); return; }
        V2.copy(foe.pos).project(tr.camera);
        if (V2.z > 1) { el.classList.add('hidden'); return; }
        el.classList.remove('hidden');
        el.style.transform = 'translate(' + ((V2.x + 1) / 2 * tr.cssW).toFixed(1) + 'px,'
            + ((1 - V2.y) / 2 * tr.cssH).toFixed(1) + 'px)';
    }

    /* ---- probe ------------------------------------------------------------
     * Frame interval is what the player feels; CPU time is update + render
     * submission, which says whether the JS or the GPU is the bottleneck: a
     * long interval with a short CPU time means the GPU is behind.
     */
    function trProbeReset() {
        probe.i = probe.n = 0;
        probe.settleUntil = performance.now() + 1000;   // the first second after any change is not representative
    }

    function trProbeRecord(iv, cpu, now) {
        if (now < probe.settleUntil) return;
        // A quarter-second gap is the browser throttling a backgrounded or
        // occluded page, not this device rendering slowly. Counting it would
        // let auto drop a tier — and remember the drop — for no reason.
        if (iv > 250) return;
        probe.iv[probe.i] = iv;
        probe.cpu[probe.i] = cpu;
        probe.i = (probe.i + 1) % PROBE_N;
        if (probe.n < PROBE_N) probe.n++;
        if (now - probe.lastReport >= PROBE_EVERY) {
            probe.lastReport = now;
            trProbeReport();
        }
    }

    function trProbeStats() {
        const n = probe.n;
        let sIv = 0, sCpu = 0;
        for (let i = 0; i < n; i++) { sIv += probe.iv[i]; sCpu += probe.cpu[i]; probe.sorted[i] = probe.iv[i]; }
        const sorted = probe.sorted.subarray(0, n).sort();
        return {
            n, avg: sIv / n, cpu: sCpu / n,
            p95: sorted[Math.min(n - 1, Math.floor(n * 0.95))],
        };
    }

    function trProbeReport() {
        if (!probe.n) return;
        const s = trProbeStats();

        // Auto only ever steps down. Stepping back up invites oscillation —
        // up, stutter, down, smooth, up — which is worse than either tier.
        // Two seconds of frames before it judges, so one GC pause is not a verdict.
        const budget = 1000 / tr.cap;
        if (tr.auto && s.n >= tr.cap * 2 && s.p95 > budget * 1.35) {
            const idx = TIER_ORDER.indexOf(tr.tier);
            if (idx > 0) { trSetTier(TIER_ORDER[idx - 1], true); return; }
        }

        // The stage can change size without a resize event (the tab bar
        // wrapping, an orientation change mid-transition).
        if (tr.stage.clientWidth !== tr.cssW || tr.stage.clientHeight !== tr.cssH) trResize();

        const info = tr.renderer.info.render;
        const size = tr.renderer.getDrawingBufferSize(SIZE);
        $('tr-probe-fps').textContent = (1000 / s.avg).toFixed(0) + ' fps';
        $('tr-probe-frame').textContent = 'frame ' + s.avg.toFixed(1) + ' ms · p95 ' + s.p95.toFixed(1);
        $('tr-probe-cpu').textContent = 'cpu ' + s.cpu.toFixed(1) + ' ms';
        $('tr-probe-gpu').textContent = info.calls + ' calls · ' + info.triangles + ' tris · '
            + size.x + '×' + size.y + ' (' + TIERS[tr.tier].label + (tr.auto ? ', auto' : '') + ')';
        $('tr-probe-fps').classList.toggle('tr-bad', s.p95 > budget * 1.35);
    }

    /* ---- input ------------------------------------------------------------
     * Every pointer is tracked on its own, so one hand can hold a drag while
     * the other taps. The first pointer to move past the slop owns the aim;
     * any pointer that lifts quickly without moving is a tap, and fires.
     */
    function trWireInput() {
        const st = tr.stage;
        const presses = new Map();
        let aimer = null;
        st.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button, .tr-probe')) return;
            presses.set(e.pointerId, { sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t: performance.now(), drag: false });
            // Capture keeps a drag alive when the finger leaves the stage;
            // without it the drag still works, so a refusal is not an error.
            try { st.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ }
        });
        st.addEventListener('pointermove', (e) => {
            const p = presses.get(e.pointerId);
            if (!p) return;
            if (!p.drag) {
                if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < TAP_SLOP || aimer !== null) return;
                p.drag = true;
                aimer = e.pointerId;
                $('tr-hint').classList.add('tr-gone');
            }
            if (aimer !== e.pointerId) return;
            // A full-width drag swings the turret about 140°. Finger right aims
            // right — the player is pointing a gun, not dragging the sky.
            const k = 2.4 / Math.max(1, st.clientWidth);
            tr.aimYaw = clamp(tr.aimYaw - (e.clientX - p.px) * k, -YAW_LIMIT, YAW_LIMIT);
            tr.aimPitch = clamp(tr.aimPitch - (e.clientY - p.py) * k, PITCH_MIN, PITCH_MAX);
            p.px = e.clientX; p.py = e.clientY;
        });
        const end = (e, fire) => {
            const p = presses.get(e.pointerId);
            if (!p) return;
            presses.delete(e.pointerId);
            if (aimer === e.pointerId) aimer = null;
            if (fire && !p.drag && performance.now() - p.t < TAP_MS) {
                $('tr-hint').classList.add('tr-gone');
                trFire(e.clientX, e.clientY);
            }
        };
        st.addEventListener('pointerup', (e) => end(e, true));
        st.addEventListener('pointercancel', (e) => end(e, false));
    }

    function trToggleFullscreen() {
        const doc = document;
        const fsEl = doc.fullscreenElement || doc.webkitFullscreenElement;
        if (fsEl) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
        else {
            const req = tr.stage.requestFullscreen || tr.stage.webkitRequestFullscreen;
            if (req) req.call(tr.stage);
        }
    }

    function trEnter() {
        showScreen('turret');
        if (!tr.sortie && $('tr-debrief').classList.contains('hidden')) trShowBrief();
    }

    /* ---- briefing and debrief ---------------------------------------------
     * DOM cards over the stage. The world keeps flying behind the briefing —
     * it costs nothing extra and it is the best advert for pressing Launch.
     * Everything is built with textContent; nothing here takes HTML.
     */
    function trEl(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function trChip(text, data, active) {
        const b = trEl('button', 'tr-chip' + (active ? ' active' : ''), text);
        b.type = 'button';
        Object.keys(data).forEach((k) => { b.dataset[k] = data[k]; });
        return b;
    }

    function trSecs(ms) {
        return ms === null || ms === undefined ? '–' : (ms / 1000).toFixed(1) + ' s';
    }

    function trSpeechOK() {
        return typeof spSupported === 'function' && spSupported() && !tr.spDenied;
    }

    function trFactText(key) {
        const p = key.split(':');
        return p[1] + ' ' + p[0] + ' ' + p[2];
    }

    function trRenderLevels(box, counts, before) {
        box.textContent = '';
        const bar = trEl('div', 'tr-lv-bar');
        LEVELS.forEach(([k]) => {
            if (!counts[k]) return;
            const seg = trEl('i', 'tr-lv-' + k);
            seg.style.flexGrow = String(counts[k]);
            bar.appendChild(seg);
        });
        box.appendChild(bar);
        const key = trEl('div', 'tr-lv-key');
        LEVELS.forEach(([k, label]) => {
            const s = trEl('span', 'tr-lv-item');
            s.appendChild(trEl('i', 'tr-lv-dot tr-lv-' + k));
            s.appendChild(document.createTextNode(label + ' ' + counts[k]));
            const d = before ? counts[k] - before[k] : 0;
            if (d) s.appendChild(trEl('b', 'tr-lv-delta', (d > 0 ? ' +' : ' −') + Math.abs(d)));
            key.appendChild(s);
        });
        box.appendChild(key);
    }

    function trShowBrief() {
        if (tr.sortie) return;
        const deck = trBuildDeck(tr.set);
        $('tr-brief-set').textContent = trSetLabel(tr.set) + ' · ' + deck.length + ' facts';
        trRenderLevels($('tr-brief-levels'), trLevelCounts(deck), null);
        const b = trBest(trSetKey(tr.set));
        $('tr-brief-best').textContent = b && b.timeMs !== undefined
            ? 'Best: ' + b.firstTry + ' / ' + (b.total || deck.length) + ' first try · ' + trClock(b.timeMs / 1000)
                + ' · ' + trSecs(b.medianMs) + ' median'
            : 'No sortie flown on this set yet';

        // The child may pick the set unless a grown-up has locked it; tables
        // are only ever chosen in the grown-up panel.
        const ps = $('tr-pick-set');
        ps.textContent = '';
        ps.classList.toggle('hidden', tr.set.locked);
        if (!tr.set.locked) {
            OPS.forEach(([o, sym]) => ps.appendChild(trChip(sym, { trPickOp: o }, tr.set.ops.indexOf(o) >= 0)));
            ps.appendChild(trEl('span', 'tr-pick-gap'));
            MAXES.forEach((m) => ps.appendChild(trChip('to ' + m, { trPickMax: String(m) }, tr.set.max === m)));
        }
        const pi = $('tr-pick-input');
        pi.textContent = '';
        pi.classList.toggle('hidden', !tr.kidInput);
        if (tr.kidInput) {
            MODES.forEach((m) => {
                if (m === 'spoken' && !trSpeechOK()) return;
                pi.appendChild(trChip(MODE_LABEL[m], { trPickInput: m }, trMode() === m));
            });
        }
        $('tr-sound').textContent = tr.sound ? 'Sound on' : 'Sound off';
        $('tr-launch').disabled = !deck.length;
        $('tr-brief').classList.remove('hidden');
        $('tr-debrief').classList.add('hidden');
        $('tr-gear').classList.remove('hidden');
        $('tr-end').classList.add('hidden');
        $('tr-hud').classList.add('hidden');
    }

    function trShowDebrief(S, rec, best, prev, news) {
        $('tr-deb-title').textContent = rec.complete ? 'Sortie complete' : 'Sortie ended';
        const stats = $('tr-deb-stats');
        stats.textContent = '';
        const tile = (label, value, sub, isNew) => {
            const t = trEl('div', 'tr-stat');
            t.appendChild(trEl('div', 'tr-stat-label', label));
            t.appendChild(trEl('div', 'tr-stat-value', value));
            if (isNew) t.appendChild(trEl('div', 'tr-stat-new', 'New best!'));
            else if (sub) t.appendChild(trEl('div', 'tr-stat-best', sub));
            stats.appendChild(t);
        };
        if (rec.complete) {
            tile('First try', rec.firstTry + ' / ' + rec.total, prev ? 'best ' + prev.firstTry : '', news.firstTry);
            tile('Time', trClock(rec.timeMs / 1000), prev ? 'best ' + trClock(prev.timeMs / 1000) : '', news.time);
            tile('Median answer', trSecs(rec.medianMs),
                prev && prev.medianMs !== undefined ? 'best ' + trSecs(prev.medianMs) : '', news.median);
        } else {
            tile('Cleared', rec.cleared + ' / ' + rec.total, 'finish one to set a best', false);
            tile('First try', String(rec.firstTry), '', false);
            tile('Time', trClock(rec.timeMs / 1000), '', false);
        }
        trRenderLevels($('tr-deb-levels'), trLevelCounts(S.keys.map((key) => ({ key }))), S.before);

        const m = $('tr-deb-missed');
        m.textContent = '';
        if (!S.missed.length) m.appendChild(trEl('span', 'tr-missed-none', rec.cleared ? 'No misses!' : ''));
        else {
            m.appendChild(trEl('span', 'tr-missed-label', 'Practise:'));
            S.missed.slice(0, 18).forEach((t) => m.appendChild(trEl('span', 'tr-missed-fact', t)));
            if (S.missed.length > 18) m.appendChild(trEl('span', 'tr-missed-label', '+' + (S.missed.length - 18) + ' more'));
        }
        $('tr-brief').classList.add('hidden');
        $('tr-debrief').classList.remove('hidden');
        $('tr-gear').classList.remove('hidden');
    }

    function trBriefClick(e) {
        const op = e.target.closest('[data-tr-pick-op]');
        const max = e.target.closest('[data-tr-pick-max]');
        const inp = e.target.closest('[data-tr-pick-input]');
        if (op && !tr.set.locked) trToggleOp(op.dataset.trPickOp);
        else if (max && !tr.set.locked) trSetMax(Number(max.dataset.trPickMax));
        else if (inp && tr.kidInput) tr.input = inp.dataset.trPickInput;
        else if (e.target.closest('#tr-sound')) tr.sound = !tr.sound;
        else return;
        trSaveSettings();
        trShowBrief();
    }

    function trToggleOp(o) {
        const i = tr.set.ops.indexOf(o);
        if (i >= 0) { if (tr.set.ops.length > 1) tr.set.ops.splice(i, 1); }
        else tr.set.ops.push(o);
    }

    function trSetMax(m) {
        tr.set.max = m;
        tr.set = trCleanSet(tr.set);         // tables above the new range go
    }

    /* ---- grown-up panel ---------------------------------------------------
     * Behind a three-second hold on the gear and a sum a young player cannot
     * do in their head. A speed bump, not security: the point is that a child
     * exploring does not reset a month of tracking by accident.
     */
    let holdTimer = 0, gateAnswer = 0, adminTab = 'progress', disarmTimer = 0;

    function trWireGear() {
        const g = $('tr-gear');
        const cancel = () => { clearTimeout(holdTimer); holdTimer = 0; g.classList.remove('tr-holding'); };
        g.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            cancel();
            g.classList.add('tr-holding');
            holdTimer = setTimeout(() => { cancel(); trOpenGate(); }, 3000);
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => g.addEventListener(ev, cancel));
        g.addEventListener('click', () => {
            if (!$('tr-admin').classList.contains('hidden')) return;
            trToast('Grown-ups: hold the gear for 3 seconds', 2.5);
        });
        g.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    function trOpenGate() {
        // The panel lives outside the stage, so it cannot be seen from inside
        // the stage's full screen.
        if (document.fullscreenElement || document.webkitFullscreenElement) trToggleFullscreen();
        const a = 12 + Math.floor(Math.random() * 8), b = 6 + Math.floor(Math.random() * 4);
        gateAnswer = a * b;
        const box = $('tr-admin-box');
        box.textContent = '';
        box.appendChild(trEl('h2', 'tr-admin-title', 'Grown-ups only'));
        box.appendChild(trEl('p', 'tr-admin-note', 'To open the settings, answer this:'));
        const form = trEl('form', 'tr-gate');
        form.appendChild(trEl('label', 'tr-gate-q', a + ' × ' + b + ' ='));
        const inp = trEl('input', 'tr-gate-input');
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.autocomplete = 'off';
        inp.setAttribute('aria-label', 'Answer');
        form.appendChild(inp);
        const ok = trEl('button', 'tr-launch tr-gate-ok', 'Open');
        ok.type = 'submit';
        form.appendChild(ok);
        const no = trChip('Cancel', { trAdmin: 'close' }, false);
        form.appendChild(no);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (Number(inp.value.trim()) === gateAnswer) { adminTab = 'progress'; trRenderAdmin(); }
            else trCloseAdmin();
        });
        box.appendChild(form);
        tr.adminOpen = true;
        trStop();                             // nothing needs to fly behind a settings page
        $('tr-admin').classList.remove('hidden');
        inp.focus();
    }

    function trCloseAdmin() {
        $('tr-admin').classList.add('hidden');
        $('tr-admin-box').textContent = '';
        tr.adminOpen = false;
        if (trScreenActive() && !document.hidden) trStart();
        trShowBrief();
    }

    function trRenderAdmin() {
        const box = $('tr-admin-box');
        const scroll = box.scrollTop;
        box.textContent = '';
        const head = trEl('div', 'tr-admin-head');
        head.appendChild(trEl('h2', 'tr-admin-title', 'Turret settings'));
        const close = trChip('Close', { trAdmin: 'close' }, false);
        head.appendChild(close);
        box.appendChild(head);
        const tabs = trEl('div', 'tr-admin-tabs');
        [['progress', 'Progress'], ['questions', 'Questions'], ['answers', 'Answers'], ['reset', 'Reset']].forEach(([k, l]) => {
            const b = trEl('button', 'tr-admin-tab' + (k === adminTab ? ' active' : ''), l);
            b.type = 'button';
            b.dataset.trAdminTab = k;
            tabs.appendChild(b);
        });
        box.appendChild(tabs);
        const body = trEl('div', 'tr-admin-body');
        box.appendChild(body);
        ({ progress: trAdminProgress, questions: trAdminQuestions, answers: trAdminAnswers, reset: trAdminReset })[adminTab](body);
        box.scrollTop = scroll;
    }

    function trSection(body, title, note) {
        const s = trEl('section', 'tr-admin-sec');
        s.appendChild(trEl('h3', null, title));
        if (note) s.appendChild(trEl('p', 'tr-admin-note', note));
        body.appendChild(s);
        return s;
    }

    function trRow(parent) {
        const r = trEl('div', 'tr-admin-row');
        parent.appendChild(r);
        return r;
    }

    // Every fact the op has at this range, laid out the way the family runs:
    // rows and columns are the two numbers trFamily names.
    function trGrid(op, max, F) {
        const sym = OP_SYM[op];
        const names = {
            addition: ['Addition', 'rows: first number · columns: second'],
            subtraction: ['Subtraction', 'rows: number taken away · columns: answer'],
            multiplication: ['Multiplication', 'rows: first number · columns: second'],
            division: ['Division', 'rows: divide by · columns: answer'],
        };
        const s = trEl('div', 'tr-grid-wrap');
        const cap = trEl('div', 'tr-grid-title', names[op][0] + ' ');
        cap.appendChild(trEl('span', 'tr-admin-note', names[op][1]));
        s.appendChild(cap);
        const lo = op === 'subtraction' || op === 'division' ? 0 : 1;
        const cols = [];
        for (let c = lo; c <= max; c++) cols.push(c);
        const grid = trEl('div', 'tr-grid');
        grid.style.gridTemplateColumns = '1.6em repeat(' + cols.length + ', minmax(0, 1fr))';
        grid.style.maxWidth = (2 + cols.length * 1.6) + 'rem';      // small squares at every range
        grid.appendChild(trEl('span', 'tr-grid-h', sym));
        cols.forEach((c) => grid.appendChild(trEl('span', 'tr-grid-h', String(c))));
        const t = tr.set.tables[op];
        for (let r = 1; r <= max; r++) {
            grid.appendChild(trEl('span', 'tr-grid-h', String(r)));
            cols.forEach((c) => {
                let key, q;
                if (op === 'subtraction') { key = '−:' + (r + c) + ':' + r; q = { op: '−', b: r, answer: c }; }
                else if (op === 'division') { key = '÷:' + (r * c) + ':' + r; q = { op: '÷', b: r, answer: c }; }
                else { key = sym + ':' + r + ':' + c; q = { op: sym, a: r, b: c }; }
                const rec = F[key];
                const cell = trEl('span', 'tr-cell tr-lv-' + trLevel(rec));
                if (t) {
                    const f = trFamily(q);
                    if (t.indexOf(f[0]) < 0 && t.indexOf(f[1]) < 0) cell.classList.add('tr-cell-off');
                }
                const med = rec ? trMedian(rec.r.filter((x) => x[0]).map((x) => x[1])) : null;
                cell.title = trFactText(key) + ' — ' + (rec ? rec.c + ' of ' + rec.n + ' right'
                    + (med !== null ? ', ' + trSecs(med) + ' lately' : '') : 'not tried yet');
                grid.appendChild(cell);
            });
        }
        s.appendChild(grid);
        return s;
    }

    function trAdminProgress(body) {
        const F = trFacts();
        const deck = trBuildDeck(tr.set);
        const sec = trSection(body, 'This set: ' + trSetLabel(tr.set),
            'Fluent: last three right, and quick. Shaky: a miss among the last three. Learning: right lately, but slow or not yet three times.');
        const lv = trEl('div', 'tr-levels');
        trRenderLevels(lv, trLevelCounts(deck), null);
        sec.appendChild(lv);
        tr.set.ops.forEach((op) => sec.appendChild(trGrid(op, tr.set.max, F)));

        const all = Object.keys(F).map((k) => ({ k, r: F[k] }));
        const slow = all.map((x) => ({ k: x.k, ms: trMedian(x.r.r.filter((v) => v[0]).map((v) => v[1])) }))
            .filter((x) => x.ms !== null).sort((a, b) => b.ms - a.ms).slice(0, 8);
        const missed = all.map((x) => ({ k: x.k, m: x.r.n - x.r.c, n: x.r.n }))
            .filter((x) => x.m > 0).sort((a, b) => b.m - a.m || b.n - a.n).slice(0, 8);
        const lists = trEl('div', 'tr-admin-lists');
        const list = (title, rows, empty) => {
            const l = trEl('div', 'tr-admin-list');
            l.appendChild(trEl('h3', null, title));
            if (!rows.length) l.appendChild(trEl('p', 'tr-admin-note', empty));
            rows.forEach(([a, b]) => {
                const r = trEl('div', 'tr-admin-li');
                r.appendChild(trEl('span', null, a));
                r.appendChild(trEl('span', 'tr-admin-note', b));
                l.appendChild(r);
            });
            lists.appendChild(l);
        };
        list('Slowest', slow.map((x) => [trFactText(x.k), trSecs(x.ms)]), 'Nothing answered yet.');
        list('Most missed', missed.map((x) => [trFactText(x.k), x.m + ' of ' + x.n + ' missed']), 'No misses yet.');
        body.appendChild(lists);

        const hs = trSection(body, 'Recent sorties');
        const hist = trHistory().slice(-12).reverse();
        if (!hist.length) { hs.appendChild(trEl('p', 'tr-admin-note', 'None flown yet.')); return; }
        const table = trEl('table', 'tr-admin-table');
        const hr = trEl('tr');
        ['When', 'Set', 'First try', 'Time', 'Median'].forEach((h) => hr.appendChild(trEl('th', null, h)));
        table.appendChild(hr);
        hist.forEach((h) => {
            const row = trEl('tr');
            const d = new Date(h.at);
            [d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                h.label + (h.complete ? '' : ' (ended early)'),
                h.firstTry + ' / ' + h.total, trClock(h.timeMs / 1000), trSecs(h.medianMs)]
                .forEach((v) => row.appendChild(trEl('td', null, String(v))));
            table.appendChild(row);
        });
        hs.appendChild(table);
    }

    function trAdminQuestions(body) {
        const S = tr.set;
        let r = trRow(trSection(body, 'Operations'));
        OPS.forEach(([o, sym]) => r.appendChild(trChip(sym, { trSetOp: o }, S.ops.indexOf(o) >= 0)));
        r = trRow(trSection(body, 'Numbers up to'));
        MAXES.forEach((m) => r.appendChild(trChip(String(m), { trSetMax: String(m) }, S.max === m)));
        S.ops.forEach((o) => {
            const sec = trSection(body, OP_SYM[o] + ' — only these numbers',
                'A fact is kept when either of its two numbers is picked. None picked means all of them.');
            const row = trRow(sec);
            row.appendChild(trChip('All', { trSetTable: o + ':all' }, !S.tables[o]));
            for (let n = 1; n <= S.max; n++) {
                row.appendChild(trChip(String(n), { trSetTable: o + ':' + n }, !!S.tables[o] && S.tables[o].indexOf(n) >= 0));
            }
        });
        r = trRow(trSection(body, 'Child can change operations and range', 'No hides the picker on the Turret screen.'));
        r.appendChild(trChip('Yes', { trOpt: 'locked:0' }, !S.locked));
        r.appendChild(trChip('No', { trOpt: 'locked:1' }, S.locked));
        body.appendChild(trEl('p', 'tr-admin-count', 'A sortie on this set is ' + trBuildDeck(S).length + ' facts.'));
    }

    function trAdminAnswers(body) {
        let sec = trSection(body, 'Answer with', trSpeechOK() ? '' : 'Spoken answers need a browser with speech recognition; this one has none, so Spoken uses the keypad.');
        let r = trRow(sec);
        MODES.forEach((m) => r.appendChild(trChip(MODE_LABEL[m], { trOpt: 'input:' + m }, tr.input === m)));
        r = trRow(trSection(body, 'Child can switch answer mode'));
        r.appendChild(trChip('Yes', { trOpt: 'kidInput:1' }, tr.kidInput));
        r.appendChild(trChip('No', { trOpt: 'kidInput:0' }, !tr.kidInput));
        r = trRow(trSection(body, 'Timer', 'Running out of time counts as a miss. Off is gentlest.'));
        TIMERS.forEach((s) => r.appendChild(trChip(s ? s + ' s' : 'Off', { trOpt: 'timer:' + s }, tr.timer === s)));
        sec = trSection(body, 'Fluent under',
            'A fact is fluent when its last three answers were right and their middle time is under this.');
        MODES.forEach((m) => {
            const row = trRow(sec);
            row.appendChild(trEl('span', 'tr-admin-label', MODE_LABEL[m]));
            FLUENT_CHOICES.forEach((ms) => row.appendChild(trChip(ms / 1000 + ' s', { trOpt: 'fluent.' + m + ':' + ms }, tr.fluent[m] === ms)));
        });
        r = trRow(trSection(body, 'Sound'));
        r.appendChild(trChip('On', { trOpt: 'sound:1' }, tr.sound));
        r.appendChild(trChip('Off', { trOpt: 'sound:0' }, !tr.sound));
    }

    function trAdminReset(body) {
        const sec = trSection(body, 'Reset', 'Only the Turret\'s own data. Flash cards, times tables and Learn are not touched. Tap a button twice.');
        [['scores', 'Reset scores', 'Bests and the sortie history.'],
            ['tracking', 'Reset tracking', 'Every fact back to New.'],
            ['all', 'Reset everything', 'Scores, tracking and these settings.']].forEach(([k, label, note]) => {
            const row = trRow(sec);
            const b = trEl('button', 'tr-danger', label);
            b.type = 'button';
            b.dataset.trReset = k;
            b.dataset.label = label;
            row.appendChild(b);
            row.appendChild(trEl('span', 'tr-admin-note', note));
        });
        sec.appendChild(trEl('p', 'tr-admin-note tr-reset-done', ''));
    }

    function trReset(what) {
        if (what === 'scores' || what === 'all') {
            stKeys('turret.best.').forEach((k) => stRemove(k));
            stRemove('turret.history');
        }
        if (what === 'tracking' || what === 'all') {
            trFacts();
            factsW.discard();                 // a queued write would put it all back
            facts = {};
            stRemove('turret.facts');
        }
        if (what === 'all') {
            stKeys('turret.').forEach((k) => stRemove(k));
            trLoadSettings();
            trApplyTier();
        }
    }

    function trSetOpt(k, v) {
        if (k === 'locked') tr.set.locked = v === '1';
        else if (k === 'input') tr.input = v;
        else if (k === 'kidInput') tr.kidInput = v === '1';
        else if (k === 'timer') tr.timer = Number(v);
        else if (k === 'sound') tr.sound = v === '1';
        else if (k.indexOf('fluent.') === 0) tr.fluent[k.slice(7)] = Number(v);
    }

    function trAdminClick(e) {
        const t = e.target;
        if (t.closest('[data-tr-admin="close"]')) { trCloseAdmin(); return; }
        const tab = t.closest('[data-tr-admin-tab]');
        if (tab) { adminTab = tab.dataset.trAdminTab; $('tr-admin-box').scrollTop = 0; trRenderAdmin(); return; }
        const reset = t.closest('[data-tr-reset]');
        if (reset) {
            // Two taps: the first arms the button for a few seconds.
            if (reset.dataset.armed !== '1') {
                document.querySelectorAll('[data-tr-reset]').forEach((b) => { b.dataset.armed = ''; b.textContent = b.dataset.label; });
                reset.dataset.armed = '1';
                reset.textContent = 'Tap again to confirm';
                clearTimeout(disarmTimer);
                disarmTimer = setTimeout(() => { reset.dataset.armed = ''; reset.textContent = reset.dataset.label; }, 4000);
                return;
            }
            clearTimeout(disarmTimer);
            trReset(reset.dataset.trReset);
            trRenderAdmin();
            const done = document.querySelector('.tr-reset-done');
            if (done) done.textContent = reset.dataset.label + ': done.';
            return;
        }
        const op = t.closest('[data-tr-set-op]');
        const max = t.closest('[data-tr-set-max]');
        const table = t.closest('[data-tr-set-table]');
        const opt = t.closest('[data-tr-opt]');
        if (op) trToggleOp(op.dataset.trSetOp);
        else if (max) trSetMax(Number(max.dataset.trSetMax));
        else if (table) {
            const [o, n] = table.dataset.trSetTable.split(':');
            if (n === 'all') delete tr.set.tables[o];
            else {
                const list = tr.set.tables[o] || [];
                const i = list.indexOf(Number(n));
                if (i >= 0) list.splice(i, 1); else list.push(Number(n));
                tr.set.tables[o] = list;
                tr.set = trCleanSet(tr.set);    // sorts, and drops an emptied list
            }
        } else if (opt) {
            const s = opt.dataset.trOpt, i = s.indexOf(':');
            trSetOpt(s.slice(0, i), s.slice(i + 1));
        } else return;
        trSaveSettings();
        trRenderAdmin();
    }

    /* ---- screen -----------------------------------------------------------*/
    const SCREEN_HTML = `
        <div class="container tr-container">
            <div class="tr-stage" id="tr-stage">
                <svg class="tr-cockpit" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
                    <path class="tr-frame" fill-rule="evenodd"
                        d="M0 0H1600V1000H0Z M260 90 L1340 90 L1520 300 L1520 760 L1380 900 L220 900 L80 760 L80 300 Z"/>
                    <path class="tr-frame-edge"
                        d="M260 90 L1340 90 L1520 300 L1520 760 L1380 900 L220 900 L80 760 L80 300 Z"/>
                    <path class="tr-frame" d="M770 90 L830 90 L812 210 L788 210 Z"/>
                    <path class="tr-barrel" id="tr-barrel-l" d="M540 1000 L650 1000 L730 790 L700 784 Z"/>
                    <path class="tr-barrel" id="tr-barrel-r" d="M1060 1000 L950 1000 L870 790 L900 784 Z"/>
                </svg>
                <div class="tr-slowmo" id="tr-slowmo" aria-hidden="true"></div>
                <div class="tr-reticle" aria-hidden="true"></div>
                <div class="tr-lock hidden" id="tr-lock" aria-hidden="true"><i></i></div>
                <div class="tr-ask hidden" id="tr-ask">
                    <div class="tr-q" id="tr-q" role="status" aria-live="polite">
                        <div class="tr-q-line"><span class="tr-mic hidden" id="tr-mic" aria-label="Listening"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span><span id="tr-q-text"></span> = <span class="tr-q-entry" id="tr-q-entry">?</span></div>
                        <div class="tr-q-heard" id="tr-q-heard"></div>
                        <div class="tr-q-said" id="tr-q-said"></div>
                        <div class="tr-timer hidden" id="tr-timer"><div class="tr-timer-fill" id="tr-timer-fill"></div></div>
                    </div>
                    <div class="tr-opts tr-opts-l" id="tr-opts-l"></div>
                    <div class="tr-opts tr-opts-r" id="tr-opts-r"></div>
                    <div class="tr-pad hidden" id="tr-pad">
                        ${['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => `<button class="tr-key" data-tr-key="${d}">${d}</button>`).join('')}
                        <button class="tr-key tr-key-fn" data-tr-key="back" aria-label="Delete">⌫</button>
                        <button class="tr-key" data-tr-key="0">0</button>
                        <button class="tr-key tr-key-fire" data-tr-key="fire">FIRE</button>
                    </div>
                </div>
                <div class="tr-hint tr-gone" id="tr-hint"></div>
                <div class="tr-hud hidden" id="tr-hud" aria-live="off">
                    <span class="tr-hud-cleared" id="tr-hud-cleared"></span>
                    <span class="tr-hud-time" id="tr-hud-time"></span>
                    <span class="tr-hud-aces" id="tr-hud-aces"></span>
                </div>
                <div class="tr-panel" id="tr-brief">
                    <div class="tr-card">
                        <div class="tr-card-title">Turret</div>
                        <div class="tr-brief-set" id="tr-brief-set"></div>
                        <div class="tr-pick" id="tr-pick-set"></div>
                        <div class="tr-levels" id="tr-brief-levels"></div>
                        <div class="tr-brief-best" id="tr-brief-best"></div>
                        <div class="tr-pick" id="tr-pick-input"></div>
                        <div class="tr-card-actions">
                            <button class="tr-launch" id="tr-launch">Launch</button>
                            <button class="tr-chip tr-sound" id="tr-sound"></button>
                        </div>
                    </div>
                </div>
                <div class="tr-panel hidden" id="tr-debrief">
                    <div class="tr-card">
                        <div class="tr-card-title" id="tr-deb-title"></div>
                        <div class="tr-stats" id="tr-deb-stats"></div>
                        <div class="tr-levels" id="tr-deb-levels"></div>
                        <div class="tr-missed" id="tr-deb-missed"></div>
                        <div class="tr-card-actions">
                            <button class="tr-launch" id="tr-again">Fly again</button>
                            <button class="tr-chip" id="tr-deb-done">Done</button>
                        </div>
                    </div>
                </div>
                <div class="tr-probe" id="tr-probe">
                    <div class="tr-probe-read">
                        <span id="tr-probe-fps" class="tr-probe-fps">…</span>
                        <span id="tr-probe-frame">measuring</span>
                        <span id="tr-probe-cpu"></span>
                        <span id="tr-probe-gpu"></span>
                    </div>
                    <div class="tr-probe-row">
                        <span class="tr-probe-label">Quality</span>
                        <button class="tr-chip" data-tr-tier="low">Low</button>
                        <button class="tr-chip" data-tr-tier="med">Med</button>
                        <button class="tr-chip" data-tr-tier="high">High</button>
                        <button class="tr-chip" data-tr-tier="auto">Auto</button>
                    </div>
                    <div class="tr-probe-row">
                        <span class="tr-probe-label">Cap</span>
                        <button class="tr-chip" data-tr-cap="30">30</button>
                        <button class="tr-chip" data-tr-cap="60">60</button>
                    </div>
                </div>
                <button class="tr-icon-btn tr-fs-btn" id="tr-fs" title="Full screen" aria-label="Full screen">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg>
                </button>
                <button class="tr-icon-btn tr-probe-btn" id="tr-probe-toggle" title="Performance" aria-label="Performance">ms</button>
                <button class="tr-icon-btn tr-side-btn hidden" id="tr-end" title="End sortie" aria-label="End sortie">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
                <button class="tr-icon-btn tr-side-btn" id="tr-gear" title="Grown-ups: hold for 3 seconds" aria-label="Grown-up settings, hold for 3 seconds">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>
                    <i class="tr-gear-fill"></i>
                </button>
                <div class="tr-lost hidden" id="tr-lost"></div>
            </div>
            <div class="tr-admin hidden" id="tr-admin" role="dialog" aria-modal="true" aria-label="Grown-up settings">
                <div class="tr-admin-box" id="tr-admin-box"></div>
            </div>
        </div>`;

    /* ---- boot -------------------------------------------------------------*/
    function injectStylesheet() {
        if (document.querySelector('link[data-tr-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'turret.css?v=' + (window.ASSET_V || '1');
        link.dataset.trCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('turret-screen')) return;
        const div = document.createElement('div');
        div.id = 'turret-screen';
        div.className = 'screen tr-screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        if (!bar || bar.querySelector('.tab-btn[data-tab="turret"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'turret';
        btn.textContent = 'Turret';
        bar.appendChild(btn);
    }

    function wire() {
        tr.stage = $('tr-stage');
        trWireInput();

        $('tr-probe').addEventListener('click', (e) => {
            const tierBtn = e.target.closest('[data-tr-tier]');
            if (tierBtn) {
                const k = tierBtn.dataset.trTier;
                // Auto restarts from the top, so it can find this device's level again.
                if (k === 'auto') trSetTier('high', true);
                else trSetTier(k, false);
                return;
            }
            const capBtn = e.target.closest('[data-tr-cap]');
            if (!capBtn) return;
            tr.cap = Number(capBtn.dataset.trCap);
            trSaveSettings();
            trApplyTier();
        });

        $('tr-brief').addEventListener('click', trBriefClick);
        $('tr-launch').addEventListener('click', trLaunch);
        $('tr-again').addEventListener('click', trLaunch);
        $('tr-deb-done').addEventListener('click', trShowBrief);
        $('tr-end').addEventListener('click', () => trEndSortie(false));
        $('tr-admin').addEventListener('click', trAdminClick);
        trWireGear();

        $('tr-ask').addEventListener('click', (e) => {
            const opt = e.target.closest('[data-tr-choice]');
            if (opt && !opt.disabled) { trAnswer(Number(opt.dataset.trChoice)); return; }
            const key = e.target.closest('[data-tr-key]');
            if (key) trKey(key.dataset.trKey);
        });
        // A keyboard works too — for testing on a laptop, and for a tablet
        // with one attached.
        document.addEventListener('keydown', (e) => {
            if (!tr.ask || tr.ask.phase !== 'ask' || !trScreenActive()) return;
            if (tr.ask.mode === 'spoken') return;
            if (tr.ask.mode === 'keypad') {
                if (/^[0-9]$/.test(e.key)) trKey(e.key);
                else if (e.key === 'Backspace') trKey('back');
                else if (e.key === 'Enter') trKey('fire');
                else return;
            } else {
                const i = '1234'.indexOf(e.key);
                if (i < 0) return;
                trAnswer(tr.ask.choices[i]);
            }
            e.preventDefault();
        });
        $('tr-probe-toggle').addEventListener('click', () => {
            const hide = !$('tr-probe').classList.contains('hidden');
            $('tr-probe').classList.toggle('hidden', hide);
            stSet('turret.probe', hide ? '0' : '1');
        });
        $('tr-probe').classList.toggle('hidden', stGet('turret.probe', '1') !== '1');
        $('tr-fs').addEventListener('click', trToggleFullscreen);
        ['tr-barrel-l', 'tr-barrel-r'].forEach((id) =>
            $(id).addEventListener('animationend', (e) => e.currentTarget.classList.remove('tr-fire')));

        new MutationObserver(() => {
            if (trScreenActive() && !document.hidden) trStart();
            else trStop();
        }).observe($('turret-screen'), { attributes: true, attributeFilter: ['class'] });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) trStop();
            else if (trScreenActive()) trStart();
        });

        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(trResize).observe(tr.stage);
        else window.addEventListener('resize', trResize);
        document.addEventListener('fullscreenchange', trResize);
        document.addEventListener('webkitfullscreenchange', trResize);

        trApplyTier();
        trShowBrief();
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        trLoadSettings();
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.turret = 'turret';
        TAB_ENTRY.turret = trEnter;
        wire();
    }

    // Debug handle for the smoke test, same convention as __MZ / __NP.
    window.__TR = {
        TIERS, PATHS, state: tr, probe, trProbeStats, trSetTier, trPathAt, trFire, trChoices, trAnswer, trKey,
        trLaunch, trEndSortie, trBuildDeck, trSetKey, trLevel, trReset, trOpenGate, trSfx,
        facts: () => trFacts(), gateAnswer: () => gateAnswer,
        // Advance the simulation by hand — a backgrounded test page gets no rAF.
        step(frames, dt) {
            for (let i = 0; i < frames; i++) trUpdate(dt || 1 / 30);
            if (tr.renderer) tr.renderer.render(tr.scene, tr.camera);
        },
        loseContext() {
            const ext = tr.renderer && tr.renderer.getContext().getExtension('WEBGL_lose_context');
            if (ext) { ext.loseContext(); setTimeout(() => ext.restoreContext(), 500); }
            return !!ext;
        },
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
