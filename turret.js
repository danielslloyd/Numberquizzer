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
 *   THE COCKPIT IS NOT 3D; THE GUNS ARE. The player never leaves the turret,
 *   so the frame, target boxes and HUD are SVG/DOM over the canvas — free to
 *   draw, and the frame covers the edges of the 3D view. The two guns are
 *   meshes on the camera, drawn under the frame so they sit outside the
 *   glass, and turn to wherever each shot goes.
 *
 *   ONE LIGHT, NO SHADOWS, NO POST. The sun is one directional light and
 *   meshes are Lambert, which lights per vertex — the cheapest lit material
 *   there is, and flat-faceted geometry makes per-vertex lighting per face.
 *   Nothing round is fuzzy: the sun, bolts, engine glows and explosion
 *   circles are crisp discs or rings with an outline and a halo, from a few
 *   small canvas textures. Bolts and engine glows are points — one draw call
 *   a pool — with a size clamped in the shader, so a bolt leaving the muzzle
 *   is not a screen-filling disc. The clear colour is the sky — a gradient
 *   sky would be a second full-screen fill, and fill rate is what these GPUs
 *   run out of first.
 *
 *   NOTHING IS ALLOCATED PER FRAME. Every vector is a module-level scratch and
 *   every moving thing comes from a fixed pool. A GC pause on these cores
 *   reads as stutter, and stutter is what the probe is there to catch.
 *
 *   THE SHIP NEVER MOVES. It sits at the origin heading −Z. When the pilot
 *   turns, the world turns the other way: asteroids are rotated by
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
    // `rocks` caps what the spawner keeps in the air; fragments of a shot
    // rock may go past it, up to the pool.
    // `shiny` puts the fighters in Phong — per-pixel lighting with a
    // highlight — instead of per-vertex Lambert. It is the first thing to go
    // when auto steps a slow device down to Low. `flashLight` is a point
    // light at the muzzle for a frame or two after each shot, lighting the
    // barrels and anything near; every lit material pays for it, so High only.
    // `thrustLight` makes each fighter's thrusters a real light; below High
    // they only glow. `rockDetail` is the rock icosphere's subdivision.
    const TIERS = {
        low:  { label: 'Low',  scale: 0.6,  stars: 300, enemies: 3, rocks: 12, shiny: false, flashLight: false, thrustLight: false, rockDetail: 2 },
        med:  { label: 'Med',  scale: 0.75, stars: 500, enemies: 4, rocks: 20, shiny: true, flashLight: false, thrustLight: false, rockDetail: 3 },
        high: { label: 'High', scale: 1.0,  stars: 900, enemies: 5, rocks: 28, shiny: true, flashLight: true, thrustLight: true, rockDetail: 5 },
    };
    // Everything else the benchmark can switch off, one at a time. Every tier
    // has all of it; `tr.q` is the tier with whatever the benchmark has set
    // on top (`tr.qOver`), and is what the rest of the code reads.
    //   nebulae, sun  big additive sprites in the sky — fill rate
    //   booms         explosion sprites;  bite  the crescent maths in them
    //   points        bolts, enemy bolts and engine glows
    //   guns          the two gun meshes, near and large on screen
    //   glass, frame, hud   the DOM layers over the canvas: the three grime
    //                 canvases, the cockpit SVG, the readouts and target boxes
    const KNOBS = { nebulae: true, sun: true, booms: true, bite: true, points: true, guns: true, glass: true, frame: true, hud: true };
    const TIER_ORDER = ['low', 'med', 'high'];
    const MAX_STARS = 900, MAX_ENEMIES = 5, MAX_ROCKS = 40;
    const MAX_BOLTS = 24, MAX_ZAPS = 16, MAX_PUFFS = 56;
    const HALO_K = 2;                       // a shape texture's disc is half its width; the rest is halo

    const BG = 0x05060d;
    const SPEED = 38;                       // world units per second, ship along −Z
    const SUN_DIR = [0.62, 0.3, -0.72];     // where the sun is, in the sky group's frame
    const YAW_LIMIT = 1.2, PITCH_MIN = -0.25, PITCH_MAX = 0.8;

    // Fighter models (Kenney Space Kit, CC0), fetched once on first build and
    // kept across context losses. Until they arrive — or if they never do —
    // fighters are the built-in dart. Each keeps the kit's own colours except
    // its accent faces (the kit's orange `metalRed`), which take the instance
    // colour: the debug accent for a fighter, gold for an ace.
    const SHIP_MODELS = ['craft_racer', 'craft_speederA', 'craft_speederB', 'craft_speederC', 'craft_speederD'];
    const SHIP_KD = { metal: [0.843, 0.871, 0.91], metalDark: [0.675, 0.71, 0.774], dark: [0.275, 0.298, 0.341] };
    const SHIP_ACCENT = 'metalRed';
    const ACCENT_SHINE = 0.35;              // the accent's own highlight; the slider scales it with the rest
    const SHIP_LEN = 3.6;                   // nose to tail, in the dart's units
    const SHIP_GLOW = 0x0c0d10;             // a floor, so a fighter's shadow side is not a hole in the sky
    const SHIP_SPEC = 0xd8d0c8, SHIP_SHINE = 70;
    // Debug: how much of its height a fighter loses, its accent colour, and
    // how strongly the darker panels shine (Phong tiers only).
    const SHIPS = { squish: 0.55, accent: '#cc3300', shine: 2.5, thrust: true, thrustColor: '#5fd0ff' };
    // Thruster light (High): reach, brightness, and how far behind the tail it
    // sits — behind, so it lights what is behind the fighter and its own back
    // panels, not the whole hull from inside it.
    const THRUST_RANGE = 9, THRUST_I = 0.9, THRUST_BACK = 2.2;
    const BITE_ON = true;                   // explosion discs are eaten from inside (trBiteShader)
    const BOOM_RATE = 1;                    // explosion playback speed; the debug slider goes down to 0.05
    // After a lock the answers ignore clicks this long (real seconds), so the
    // second tap of a rapid burst cannot land on the card that just opened.
    const ASK_GUARD = 0.25;
    const SHIP_SCALE = 1.6;                 // a fighter at 60 units is a speck on a 7-inch screen otherwise
    const BOLT_SPEED = 110;                 // defaults; the debug panel can change both
    const MUZZLE_S = 0.09, MUZZLE_I = 3.2;  // muzzle light: how long, how bright
    const SIGHT = 110;                      // past this a fighter is still in the fog: not lockable
    // A shot locks a fighter when it lands within this many CSS px of the
    // fighter's target box. The debug slider sets it; 0 means on the box.
    const NEAR_PX = 24, NEAR_MIN = 0, NEAR_MAX = 160;
    const TAP_SLOP_MOUSE = 24;              // a mouse click while tracking a target moves a little
    // Window grime and the hit flash that shares its stencil. Strength runs
    // from `min` facing away from the sun to `max` facing it; `inset` is how
    // far in from the window's edge grime may show, `soft` how soft its inner
    // boundary is — both as fractions of the stage's short side, so the
    // border is as deep down the sides as across the top.
    const GRIME = { on: true, color: '#efe3d7', min: 0.05, max: 1, inset: 0.16, soft: 0.07, hurt: '#71150e' };
    const HURT_IN = 0.06, HURT_OUT = 0.6;   // hit flash: rise and fall, real seconds
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

    // Rocks. A few come straight at the ship on purpose — that is what the
    // damage flash is for, and shooting one first is the reward. A rock this
    // small or smaller is dust when shot; a bigger one splits.
    const INCOMING = 0.14;                  // fraction of spawned rocks aimed at the ship
    const SPLIT_MIN = 1.7;
    const HULL_R = 2.5;                     // a rock this close to the line of flight hits

    // Enemy fire. Strafing paths carry a window, as a fraction of the path,
    // in which the fighter shoots at the ship. Whether a shot hits is decided
    // when it is fired, like the turret's, so a miss is aimed to pass by.
    const ZAP_SPEED = 75;
    const ZAP_EVERY = 0.36;                 // world seconds between shots on a run
    const ZAP_HIT = 0.17;                   // about one hit a run: a flash every pass would wear thin
    const DEFLECTOR_HIT = 12, DEFLECTOR_REGEN = 5, DEFLECTOR_MIN = 40;   // filler: a number that moves, nothing more

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

    /* ---- enemy flight -----------------------------------------------------
     * Paths are made at spawn, not picked from a list: each starts somewhere
     * the turret is not looking — beside or behind — so a fighter is never
     * seen to appear, and swoops into view. A path is a few knots, each with
     * a heading and a speed, turned into cubic Béziers whose handles are
     * scaled by each segment's duration: that makes velocity continuous
     * through every knot, so there is no lurch where segments meet.
     *
     * Fighters fly like aircraft in air, not like things on rails: the nose
     * follows the velocity, and the bank is whatever tilts the lift vector
     * onto the acceleration the path asks for against a pretend gravity. A
     * level turn banks into it; a pull-up out of a dive does not bank at all.
     */
    const FLIGHT_G = 28;                    // pretend gravity, units/s² — what makes a turn bank
    const ROLL_RATE = 5;                    // how fast the bank follows, 1/s
    const ENTRY_OFF = [1.95, 2.6];          // radians from where the turret looks: off-screen
    const PASS_MIN = 9;                     // no path comes nearer the cockpit than this
    const WING_OFFSET = [5, -3, 4];          // a wingman flies the leader's path, offset
    const WING_DELAY = 0.35;

    const tr = {
        stage: null, canvas: null, renderer: null, scene: null, camera: null, rig: null, sky: null,
        stars: null, sun: null, rockMesh: null, shipMeshes: [], shipTail: [], shipN: null, glows: null,
        boltPts: null, zapPts: null, glowTex: null, discTex: null, ringTex: null, boltTex: null, zapTex: null,
        rocks: [], foes: [], bolts: [], zaps: [], puffs: [], tgts: [], guns: [],
        boom: 0, nearPx: NEAR_PX, sfx: {}, dbgOpen: false, mouse: null, shiny: null,
        grime: null, grimeImg: null, grimeW: 0, grimeH: 0, glassOp: [-1, -1, -1],
        hurtAge: 9, hurtK: 0, boltSpeed: BOLT_SPEED, zapSpeed: ZAP_SPEED, dbgCats: [],
        muzzleLight: null, muzzleK: 0, bite: true, boomRate: BOOM_RATE, askGuard: ASK_GUARD, ships: null, shipShineK: null, shipThrust: null, thrustLights: [], rockDetail: 0,
        pilot: null, spawnAt: 0, rockAt: 0, lockFoe: null, barrel: 1, hits: 0,
        deflector: 100, hudLeft: 0, hud: null,
        running: false, lost: false, raf: 0, last: 0, wt: 0, timeScale: 1,
        tier: 'med', auto: true, cap: 30, q: null, qOver: null, bench: null, benchRep: null, skyGlows: [],
        ask: null, deck: [], aceQ: [], sortie: null, set: null,
        input: 'choice', kidInput: true, timer: 0, fluent: null, sound: true, spDenied: false,
        toastLeft: 0, shake: 0,
        yaw: 0, pitch: 0.12, aimYaw: 0, aimPitch: 0.12,
        cssW: 0, cssH: 0, track: 0, near: 0,
    };

    const probe = {
        iv: new Float32Array(PROBE_N), cpu: new Float32Array(PROBE_N), sorted: new Float32Array(PROBE_N),
        i: 0, n: 0, lastReport: 0, settleUntil: 0,
    };

    let V1, V2, V3, V4, V5, V6, SIZE, DUMMY, DQ, EUL, UP;    // scratch, made once THREE exists
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
        // Debug choices: explosion style, auto-aim radius, a version of each
        // sound. Stored apart from the grown-up settings — they tune the game,
        // not the child's practice.
        const dbg = stJSON('turret.debug', null) || {};
        // Kept by name: the list is renumbered when a style comes or goes. An
        // old numeric choice meant a different list, so it starts over.
        tr.boom = Math.max(0, BOOMS.findIndex(([label]) => label === dbg.boom));
        tr.bite = dbg.bite === undefined ? BITE_ON : !!dbg.bite;
        // `near` replaced an older radius-round-the-tap setting; that one is ignored.
        tr.nearPx = Number.isFinite(dbg.near) ? clamp(dbg.near, NEAR_MIN, NEAR_MAX) : NEAR_PX;
        const g = dbg.grime || {};
        const num = (v, lo, hi, d) => (Number.isFinite(v) ? clamp(v, lo, hi) : d);
        const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
        tr.grime = {
            on: g.on === undefined ? GRIME.on : !!g.on,
            color: hex(g.color, GRIME.color), hurt: hex(g.hurt, GRIME.hurt),
            min: num(g.min, 0, 1, GRIME.min), max: num(g.max, 0, 1, GRIME.max),
            // `reach`/`fade` were fractions of the window each way; those are
            // not these, so they are left behind.
            inset: num(g.inset, 0.02, 0.5, GRIME.inset), soft: num(g.soft, 0, 0.3, GRIME.soft),
        };
        if (tr.grime.min > tr.grime.max) tr.grime.min = tr.grime.max;
        const s = dbg.ships || {};
        tr.ships = { squish: num(s.squish, 0, 0.8, SHIPS.squish), accent: hex(s.accent, SHIPS.accent), shine: num(s.shine, 0, 3, SHIPS.shine),
            thrust: s.thrust === undefined ? SHIPS.thrust : !!s.thrust, thrustColor: hex(s.thrustColor, SHIPS.thrustColor) };
        tr.boomRate = num(dbg.boomRate, 0.05, 1, BOOM_RATE);
        tr.askGuard = num(dbg.guard, 0, 1, ASK_GUARD);
        tr.boltSpeed = num(dbg.bolt, 30, 300, BOLT_SPEED);
        tr.zapSpeed = num(dbg.zap, 20, 200, ZAP_SPEED);
        tr.dbgCats = Array.isArray(dbg.open) ? dbg.open.filter((k) => typeof k === 'string') : [];
        tr.sfx = {};
        Object.keys(SFX).forEach((k) => {
            const v = dbg.sfx && dbg.sfx[k];
            if (Number.isInteger(v) && v > 0 && v < SFX[k].length) tr.sfx[k] = v;
        });
    }

    function trSaveDebug() {
        stSetJSON('turret.debug', { boom: BOOMS[tr.boom][0], bite: tr.bite, boomRate: tr.boomRate, guard: tr.askGuard, near: tr.nearPx, sfx: tr.sfx, grime: tr.grime, ships: tr.ships,
            bolt: tr.boltSpeed, zap: tr.zapSpeed, open: tr.dbgCats });
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
        trToast('Drag to aim · tap a ship to fire · tap rocks to break them', 6);
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

    // A flat disc with a soft rim — one explosion circle.
    /* A crisp round shape: a disc (or a ring) of radius half the texture,
     * a brighter outline on its edge, and a halo fading out to the texture's
     * edge. White ones are tinted per use; bolts bake their colours in, so a
     * white-hot core can have a coloured rim. */
    function trShapeTexture(size, fill, rim, halo, ring) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        const R = size / 2, r = R * 0.5;
        const grad = g.createRadialGradient(R, R, 0, R, R, R);
        // Transparent in the halo's own colour, not transparent black: the
        // gradient blends colour as well as alpha, and fading toward black
        // leaves a dark smudge round every shape.
        const clear = halo.replace(/[\d.]+\)$/, '0)');
        if (ring === 'thin') {
            // A thin ring's halo hugs it, or the halo is the ring.
            grad.addColorStop(0, clear);
            grad.addColorStop(0.47, clear);
            grad.addColorStop(0.5, halo);
            grad.addColorStop(0.535, clear);
            grad.addColorStop(1, clear);
        } else if (ring) {
            grad.addColorStop(0, clear);
            grad.addColorStop(0.3, clear);
            grad.addColorStop(0.5, halo);
            grad.addColorStop(1, clear);
        } else {
            grad.addColorStop(0, halo);
            grad.addColorStop(0.5, halo);
            grad.addColorStop(1, clear);
        }
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        const w = Math.max(1.5, R * (ring === 'thin' ? 0.012 : ring ? 0.1 : 0.08));
        g.beginPath();
        g.arc(R, R, r - w / 2, 0, Math.PI * 2);
        if (fill) { g.fillStyle = fill; g.fill(); }
        g.lineWidth = w;
        g.strokeStyle = rim;
        g.stroke();
        const tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        return tex;
    }

    /* ---- geometry ---------------------------------------------------------
     * Non-indexed, so every face has its own three vertices and its own
     * normal: under per-vertex lighting that is flat shading for free.
     * `rgbOf(k)` gives face k its base colour; the sun does the rest.
     */
    function trFaceted(pos, rgbOf, centreOf) {
        const col = new Float32Array(pos.length);
        const nrm = new Float32Array(pos.length);
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        const n = new THREE.Vector3(), e = new THREE.Vector3(), mid = new THREE.Vector3();
        for (let k = 0; k < pos.length / 9; k++) {
            a.fromArray(pos, k * 9); b.fromArray(pos, k * 9 + 3); c.fromArray(pos, k * 9 + 6);
            n.subVectors(b, a).cross(e.subVectors(c, a)).normalize();
            // Windings are not trusted: a face whose winding points inward is
            // rewound, not just given a flipped normal. A double-sided
            // material lights the face the camera sees by its winding, so a
            // flipped normal alone lights the outside as if it were the
            // inside — which is how the fighters came out reverse-lit.
            // No centre means the file's winding is trusted as it is.
            if (centreOf) mid.copy(a).add(b).add(c).divideScalar(3).sub(typeof centreOf === 'function' ? centreOf(k) : centreOf);
            if (centreOf && n.dot(mid) < 0) {
                n.negate();
                for (let j = 0; j < 3; j++) {
                    const t = pos[k * 9 + 3 + j];
                    pos[k * 9 + 3 + j] = pos[k * 9 + 6 + j];
                    pos[k * 9 + 6 + j] = t;
                }
            }
            const rgb = rgbOf(k);
            for (let j = 0; j < 3; j++) {
                const o = k * 9 + j * 3;
                col[o] = rgb[0]; col[o + 1] = rgb[1]; col[o + 2] = rgb[2];
                nrm[o] = n.x; nrm[o + 1] = n.y; nrm[o + 2] = n.z;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
    }

    // A gun: hexagonal housing, hexagonal barrel and a muzzle collar, all on
    // +Z from the pivot, so Object3D.lookAt points it down the line of fire.
    const GUN_PARTS = [[0.12, 0, 0.45, [0.24, 0.26, 0.31]], [0.048, 0.45, 1.95, [0.42, 0.45, 0.52]],
        [0.068, 1.76, 1.95, [0.62, 0.66, 0.74]]];
    const GUN_LEN = 1.95;

    function trGunGeometry() {
        const tris = [], part = [];
        GUN_PARTS.forEach(([r, z0, z1], p) => {
            const v = (i, z) => {
                const a = (i % 6) * Math.PI / 3 + Math.PI / 6;
                return [r * Math.cos(a), r * Math.sin(a), z];
            };
            for (let i = 0; i < 6; i++) {
                tris.push([v(i, z0), v(i + 1, z0), v(i + 1, z1)], [v(i, z0), v(i + 1, z1), v(i, z1)]);
                tris.push([[0, 0, z0], v(i + 1, z0), v(i, z0)], [[0, 0, z1], v(i, z1), v(i + 1, z1)]);
                part.push(p, p, p, p);
            }
        });
        const pos = new Float32Array(tris.length * 9);
        tris.forEach((t, k) => { for (let j = 0; j < 3; j++) pos.set(t[j], k * 9 + j * 3); });
        const centres = GUN_PARTS.map(([, z0, z1]) => new THREE.Vector3(0, 0, (z0 + z1) / 2));
        return trFaceted(pos, (k) => GUN_PARTS[part[k]][3], (k) => centres[part[k]]);
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
        return trFaceted(pos, (k) => tris[k][3], new THREE.Vector3(0, 0, -0.4));
    }

    // A lumpy rock: an icosphere with each vertex pushed in or out by a
    // fractal function of its direction (trRockShape).

    // Value noise on an integer lattice, smoothly interpolated: 0..1.
    function trLattice(i, j, k) {
        let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    }

    function trValueNoise(x, y, z) {
        const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
        const s = (t) => t * t * (3 - 2 * t);
        const u = s(x - i), v = s(y - j), w = s(z - k);
        const L = (a, b, c) => trLattice(i + a, j + b, k + c);
        const lerp = (a, b, t) => a + (b - a) * t;
        return lerp(lerp(lerp(L(0, 0, 0), L(1, 0, 0), u), lerp(L(0, 1, 0), L(1, 1, 0), u), v),
            lerp(lerp(L(0, 0, 1), L(1, 0, 1), u), lerp(L(0, 1, 1), L(1, 1, 1), u), v), w);
    }

    // Craters: a dish with a raised lip, at fixed directions on the rock.
    const ROCK_CRATERS = [[0.5, 0.7, 0.5, 0.42, 0.16], [-0.8, -0.1, 0.6, 0.3, 0.11], [0.1, -0.9, -0.4, 0.5, 0.14],
        [-0.3, 0.4, -0.85, 0.24, 0.08]].map(([x, y, z, r, d]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l, r, d]; });

    /* How far out the rock's surface is in direction (x, y, z) — a unit
     * vector. Fractal: six octaves of value noise, each twice the frequency
     * and a little over half the height of the last, so there are lumps on
     * the lumps; one octave is folded into ridges; craters dent it. A
     * function of direction, so every tier's mesh samples the same rock and
     * the copies of a shared corner move alike. */
    function trRockShape(x, y, z) {
        let sum = 0, amp = 0.5, fq = 1.35;
        for (let o = 0; o < 6; o++) {
            sum += amp * (trValueNoise(x * fq + 11.3, y * fq + 3.7, z * fq + o * 7.1) * 2 - 1);
            amp *= 0.56; fq *= 2.03;
        }
        const ridge = 1 - Math.abs(trValueNoise(x * 2.6 + 40, y * 2.6, z * 2.6) * 2 - 1);
        let r = 1 + 0.62 * sum + 0.16 * ridge * ridge;
        for (const [cx, cy, cz, cr, cd] of ROCK_CRATERS) {
            const t = Math.acos(clamp(x * cx + y * cy + z * cz, -1, 1)) / cr;
            if (t < 1) r -= cd * (1 - t * t);
            else if (t < 1.4) r += cd * 0.35 * Math.sin((t - 1) / 0.4 * Math.PI);
        }
        return Math.max(0.45, r);
    }

    function trRockGeometry(detail) {
        const src = new THREE.IcosahedronGeometry(1, detail);
        const pos = Float32Array.from(src.attributes.position.array);
        src.dispose();
        for (let i = 0; i < pos.length; i += 3) {
            const l = Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
            const f = trRockShape(pos[i] / l, pos[i + 1] / l, pos[i + 2] / l) / l;
            // Stretched a little, so no two views of it look like a ball.
            pos[i] *= f * 1.18; pos[i + 1] *= f * 0.82; pos[i + 2] *= f;
        }
        // Colour follows the shape too — the bumps a touch lighter than the
        // hollows — plus a little per face, so the facets still read.
        const hash = (k) => { const h = Math.sin(k * 12.9898 + 4.1) * 43758.5453; return h - Math.floor(h); };
        const c = new THREE.Vector3();
        // The icosphere is wound outward, and pushing its corners in and out
        // along their own directions cannot turn a face round as seen from
        // the middle: its winding is trusted. The centre test would misread
        // the steep side of a crater.
        return trFaceted(pos, (k) => {
            c.fromArray(pos, k * 9).add(V1.fromArray(pos, k * 9 + 3)).add(V1.fromArray(pos, k * 9 + 6)).divideScalar(3);
            const v = clamp(0.78 + 0.9 * (c.length() - 1) + 0.14 * (hash(k) - 0.5), 0.45, 1.15);
            return [0.62 * v, 0.55 * v, 0.47 * v];
        }, null);
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
        tr.skyGlows = [];
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
                s.userData.knob = 'nebulae';
                tr.skyGlows.push(s);
                group.add(s);
            });
    }

    /* ---- scene: the sun ---------------------------------------------------
     * Close enough to be a disc, not a star. It lives in the sky group, so it
     * swings round as the pilot turns; the light is moved to match each frame.
     */
    function trBuildSun(group) {
        const dir = new THREE.Vector3().fromArray(SUN_DIR).normalize();
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tr.glowTex, color: 0xffc27a, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        }));
        halo.position.copy(dir).multiplyScalar(135);
        halo.scale.set(70, 70, 1);
        halo.renderOrder = -1;
        const disc = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tr.discTex, color: 0xfff1d0, transparent: true, depthWrite: false, fog: false,
        }));
        disc.position.copy(halo.position);
        disc.scale.set(10 * HALO_K, 10 * HALO_K, 1);
        disc.renderOrder = -1;
        halo.userData.knob = disc.userData.knob = 'sun';
        tr.skyGlows.push(halo, disc);
        group.add(halo, disc);
    }

    /* ---- ship models ------------------------------------------------------
     * A minimal OBJ reader — positions, faces and material names, nothing
     * else — so no loader script has to be added. Faces are fanned into
     * triangles; each triangle remembers its material's shade. The model is
     * centred and scaled to SHIP_LEN; Kenney's craft already point their
     * noses along +Z, which is the dart's convention too.
     */
    let MODELS = null;                      // [{ pos, shade, tail }], once loaded
    let modelsLoading = false;

    function trParseObj(text) {
        const v = [], tris = [], shade = [];
        let cur = 'metal';
        text.split(/\r?\n/).forEach((line) => {
            const p = line.trim().split(/\s+/);
            if (p[0] === 'v') v.push([Number(p[1]), Number(p[2]), Number(p[3])]);
            else if (p[0] === 'usemtl') cur = p[1];
            else if (p[0] === 'f') {
                const idx = p.slice(1).map((t) => parseInt(t, 10)).map((i) => (i < 0 ? v.length + i : i - 1));
                for (let k = 1; k + 1 < idx.length; k++) { tris.push(idx[0], idx[k], idx[k + 1]); shade.push(cur); }
            }
        });
        const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        v.forEach((q) => q.forEach((c, i) => { lo[i] = Math.min(lo[i], c); hi[i] = Math.max(hi[i], c); }));
        const k = SHIP_LEN / Math.max(1e-6, hi[2] - lo[2]);
        const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
        const pos = new Float32Array(tris.length * 3);
        tris.forEach((i, j) => { for (let c = 0; c < 3; c++) pos[j * 3 + c] = (v[i][c] - mid[c]) * k; });
        return { pos, shade, tail: -SHIP_LEN / 2 };
    }

    function trLoadModels() {
        if (MODELS || modelsLoading || typeof fetch !== 'function') return;
        modelsLoading = true;
        const v = window.ASSET_V || '1';
        Promise.all(SHIP_MODELS.map((n) => fetch('models/' + n + '.obj?v=' + v)
            .then((r) => { if (!r.ok) throw new Error(n + ' ' + r.status); return r.text(); })
            .then(trParseObj)))
            .then((list) => {
                MODELS = list.filter((m) => m.pos.length);
                if (tr.scene) trAddShipMeshes();
            })
            // No models is not an error the player needs to see: the dart flies.
            .catch(() => { modelsLoading = false; });
    }

    function trShipMat(kind) {
        return tr.shipMats[tr.shiny ? 'shiny' : 'matte'][kind];
    }

    /* Three per-vertex attributes the stock materials do not have:
     *   accent  1 where the instance colour paints the face, 0 where the
     *           face keeps its own colour
     *   shine   how strongly the face takes the Phong highlight, before the
     *           debug slider's `shineK` scales it
     *   glow    1 on a thruster face: with thrusters on it is the thruster
     *           colour, flat — no diffuse, no highlight, lit by nothing
     * The chunks replaced are r128's color_vertex, color_fragment,
     * specularmap_fragment and emissivemap_fragment. */
    const SHIP_VERT_HEAD = 'attribute float accent;\nattribute float shine;\nattribute float glow;\nvarying float vShine;\nvarying float vGlow;\n';
    const SHIP_COLOR_VERTEX = [
        '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )',
        '  vColor = vec3( 1.0 );',
        '#endif',
        '#ifdef USE_COLOR',
        '  vColor *= color;',
        '#endif',
        '#ifdef USE_INSTANCING_COLOR',
        '  vColor.xyz *= mix( vec3( 1.0 ), instanceColor.xyz, accent );',
        '#endif',
        'vShine = shine;',
        'vGlow = glow;'].join('\n');

    function trShipShader(shader) {
        shader.uniforms.shineK = tr.shipShineK;
        shader.uniforms.thrustK = tr.shipThrust.k;
        shader.uniforms.thrustColor = tr.shipThrust.color;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\n' + SHIP_VERT_HEAD)
            .replace('#include <color_vertex>', SHIP_COLOR_VERTEX);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float shineK;\nuniform float thrustK;\n'
                + 'uniform vec3 thrustColor;\nvarying float vShine;\nvarying float vGlow;')
            .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - vGlow * thrustK;')
            .replace('#include <specularmap_fragment>', 'float specularStrength = vShine * shineK * ( 1.0 - vGlow * thrustK );')
            .replace('#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\ntotalEmissiveRadiance = mix( totalEmissiveRadiance, thrustColor, vGlow * thrustK );');
    }

    // Thruster faces: in the rear quarter of the hull, facing straight back.
    // Found from the geometry, so every model — and the dart — has its own.
    const THRUST_REAR = 0.25, THRUST_FACING = 0.7;

    function trThrustFaces(geo) {
        const p = geo.attributes.position.array, nr = geo.attributes.normal.array;
        let lo = Infinity, hi = -Infinity;
        for (let i = 2; i < p.length; i += 3) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
        const cut = lo + (hi - lo) * THRUST_REAR;
        return (k) => {
            const z = (p[k * 9 + 2] + p[k * 9 + 5] + p[k * 9 + 8]) / 3;
            return z <= cut && nr[k * 9 + 2] <= -THRUST_FACING ? 1 : 0;
        };
    }

    // A ship geometry's extra attributes: per face, then copied to its corners.
    function trShipAttrs(geo, accentOf, shineOf) {
        const n = geo.attributes.position.count;
        const acc = new Float32Array(n), shn = new Float32Array(n), glw = new Float32Array(n);
        const glowOf = trThrustFaces(geo);
        for (let i = 0; i < n; i++) {
            const k = (i / 3) | 0;
            acc[i] = accentOf(k); shn[i] = shineOf(k); glw[i] = glowOf(k);
        }
        geo.setAttribute('accent', new THREE.BufferAttribute(acc, 1));
        geo.setAttribute('shine', new THREE.BufferAttribute(shn, 1));
        geo.setAttribute('glow', new THREE.BufferAttribute(glw, 1));
        return geo;
    }

    // A model: the kit's colours, the accent faces white for the instance
    // colour to paint. A panel's shine is the inverse of how light it is —
    // darker is shinier, the way lacquered dark metal reads.
    function trModelGeometry(m) {
        const isAcc = (k) => m.shade[k] === SHIP_ACCENT;
        const kd = (k) => SHIP_KD[m.shade[k]] || SHIP_KD.metal;
        const geo = trFaceted(Float32Array.from(m.pos), (k) => (isAcc(k) ? [1, 1, 1] : kd(k)), null);
        return trShipAttrs(geo, (k) => (isAcc(k) ? 1 : 0),
            (k) => (isAcc(k) ? ACCENT_SHINE : 1 - Math.max.apply(null, kd(k))));
    }

    function trShipColours() {
        if (FOE_COL) FOE_COL.set(tr.ships.accent);
        if (tr.shipThrust) {
            tr.shipThrust.color.value.set(tr.ships.thrustColor);
            tr.shipThrust.k.value = tr.ships.thrust ? 1 : 0;
            tr.thrustLights.forEach((l) => l.color.set(tr.ships.thrustColor));
        }
    }

    function trShipMesh(geo, kind) {
        const mesh = trInstanced(geo, trShipMat(kind), MAX_ENEMIES);
        // Every slot gets a colour now: the instance-colour attribute changes
        // the shader, and adding it after the first draw would mean a recompile.
        // Made by hand because setColorAt sizes it from `count`, which is 0.
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 3), 3)
            .setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < MAX_ENEMIES; i++) mesh.setColorAt(i, FOE_COL);
        mesh.visible = false;
        mesh.userData.kind = kind;
        return mesh;
    }

    // Model meshes join the dart (mesh 0). Single-sided: the files' windings
    // are sound, and a single side cannot light a face from behind.
    function trAddShipMeshes() {
        if (!MODELS || tr.shipMeshes.length > 1) return;
        MODELS.forEach((m) => {
            const mesh = trShipMesh(trModelGeometry(m), 'model');
            tr.scene.add(mesh);
            tr.shipMeshes.push(mesh);
            tr.shipTail.push(m.tail);
        });
        tr.shipN = new Int32Array(tr.shipMeshes.length);
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

    /* Points for bolts and engine glows. PointsMaterial's attenuation has no
     * ceiling, and a bolt starts a couple of units from the camera, where it
     * would be hundreds of pixels across; this clamps it. Each point is
     * tinted by its own `tint`, and fades into the fog by alpha, which a
     * normal-blended crisp disc needs where an additive glow would not. */
    const PT_VERT = [
        'uniform float size; uniform float scale; uniform float minPx; uniform float maxPx;',
        'attribute vec3 tint; varying vec3 vTint; varying float vDepth;',
        'void main() {',
        '  vTint = tint;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  vDepth = -mv.z;',
        '  gl_PointSize = clamp(size * scale / -mv.z, minPx, maxPx);',
        '  gl_Position = projectionMatrix * mv;',
        '}'].join('\n');
    const PT_FRAG = [
        'uniform sampler2D map; uniform float fogNear; uniform float fogFar;',
        'varying vec3 vTint; varying float vDepth;',
        'void main() {',
        '  vec4 c = texture2D(map, gl_PointCoord);',
        '  c.rgb *= vTint;',
        '  c.a *= 1.0 - smoothstep(fogNear, fogFar, vDepth);',
        '  if (c.a < 0.01) discard;',
        '  gl_FragColor = c;',
        '}'].join('\n');

    function trShapePoints(max, tex, size, minPx, maxPx) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(max * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
        geo.setDrawRange(0, 0);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: tex }, size: { value: size }, scale: { value: 300 },
                minPx: { value: minPx }, maxPx: { value: maxPx }, fogNear: { value: 25 }, fogFar: { value: 120 },
            },
            vertexShader: PT_VERT, fragmentShader: PT_FRAG, transparent: true, depthWrite: false,
        });
        mat.userData.px = [minPx, maxPx];       // CSS px; trResize scales them to the buffer
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        return pts;
    }

    function trBuildPools() {
        tr.rockDetail = tr.q.rockDetail;
        tr.rockMesh = trInstanced(trRockGeometry(tr.rockDetail), new THREE.MeshLambertMaterial({ vertexColors: true }), MAX_ROCKS);
        tr.rocks = [];
        for (let i = 0; i < MAX_ROCKS; i++) {
            // `gen` counts reuses of the slot, so a bolt aimed at a rock that
            // has since been shot, or flown past and respawned, knows it.
            tr.rocks.push({ active: false, gen: 0, safe: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(),
                axis: new THREE.Vector3(), angle: 0, spin: 0, size: 1 });
        }

        // Two materials for each kind of ship, swapped by tier. Phong lights
        // per pixel and adds a highlight; Lambert lights per vertex.
        tr.shipMats = {
            matte: {
                dart: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: SHIP_GLOW }),
                model: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: SHIP_GLOW }),
            },
            shiny: {
                dart: new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: SHIP_GLOW,
                    specular: SHIP_SPEC, shininess: SHIP_SHINE }),
                model: new THREE.MeshPhongMaterial({ vertexColors: true, emissive: SHIP_GLOW,
                    specular: SHIP_SPEC, shininess: SHIP_SHINE }),
            },
        };
        tr.shipShineK = { value: tr.ships.shine };
        tr.shipThrust = { k: { value: 0 }, color: { value: new THREE.Color() } };
        ['matte', 'shiny'].forEach((k) => ['dart', 'model'].forEach((m) => { tr.shipMats[k][m].onBeforeCompile = trShipShader; }));
        trShipColours();
        tr.shiny = tr.q.shiny;
        // Mesh 0 is the built-in dart, painted all over; trAddShipMeshes
        // appends the models.
        tr.shipMeshes = [trShipMesh(trShipAttrs(trShipGeometry(), () => 1, () => 0.5), 'dart')];
        tr.shipTail = [-1.5];
        tr.shipN = new Int32Array(1);
        tr.glows = trShapePoints(MAX_ENEMIES, tr.discTex, 1.5, 3, 20);
        tr.foes = [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
            tr.foes.push({ active: false, locked: false, dodging: false, ace: null, rollDir: 1, strafe: null, shotAt: 0,
                tag: '', model: 0, pts: new Float32Array(30), segs: 1, segEnd: new Float32Array(3), t0: 0, dur: 1, bank: 0,
                pos: new THREE.Vector3(), nose: new THREE.Vector3() });
        }

        tr.boltPts = trShapePoints(MAX_BOLTS, tr.boltTex, 1.6, 7, 30);
        tr.bolts = [];
        for (let i = 0; i < MAX_BOLTS; i++) {
            tr.bolts.push({ active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, t1: 1,
                target: null, rock: null, rockGen: 0 });
        }

        tr.zapPts = trShapePoints(MAX_ZAPS, tr.zapTex, 2, 8, 36);
        tr.zaps = [];
        for (let i = 0; i < MAX_ZAPS; i++) {
            tr.zaps.push({ active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, t1: 1, hit: false });
        }

        // Explosion shapes: one sprite each, each with its own material so
        // each can fade, recolour and change blending on its own.
        tr.puffs = [];
        for (let i = 0; i < MAX_PUFFS; i++) {
            const mat = new THREE.SpriteMaterial({ map: tr.discTex, transparent: true, depthWrite: false, fog: false });
            const sp = new THREE.Sprite(mat);
            sp.visible = false;
            const p = { sp, life: 0, max: 1, delay: 0, r0: 1, r1: 2, curve: 0, fade: 0.6, bite: false, rate: 1,
                biteC: { value: new THREE.Vector2(0.5, 0.5) }, biteR: { value: 0 },
                vel: new THREE.Vector3(), c0: new THREE.Color(), c1: new THREE.Color() };
            // Same source for every puff, so one program; the uniforms are each puff's own.
            mat.onBeforeCompile = (sh) => trBiteShader(sh, p);
            tr.puffs.push(p);
        }

        // The guns: children of the camera, so they turn with the turret. A
        // pivot each, aimed by lookAt; the mesh inside slides back to recoil.
        const gunGeo = trGunGeometry(), gunMat = new THREE.MeshLambertMaterial({ vertexColors: true });
        tr.guns = [-1, 1].map((side) => {
            const pivot = new THREE.Object3D();
            pivot.position.set(side * 0.8, -1.0, -1.25);
            const mesh = new THREE.Mesh(gunGeo, gunMat);
            pivot.add(mesh);
            tr.camera.add(pivot);
            return { side, pivot, mesh, aim: new THREE.Vector3(0, 0, -60), want: new THREE.Vector3(), hold: 0, recoil: 0 };
        });
    }

    function trBuild() {
        if (typeof THREE === 'undefined') { trShowLost('3D graphics did not load. Check the connection and refresh.'); return false; }
        V1 = new THREE.Vector3(); V2 = new THREE.Vector3(); V3 = new THREE.Vector3(); V4 = new THREE.Vector3();
        V5 = new THREE.Vector3(); V6 = new THREE.Vector3();
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
        tr.discTex = trShapeTexture(128, '#d4d4d4', '#ffffff', 'rgba(255,255,255,0.32)', false);
        tr.ringTex = trShapeTexture(128, null, '#ffffff', 'rgba(255,255,255,0.4)', true);
        tr.thinRingTex = trShapeTexture(512, null, '#ffffff', 'rgba(255,255,255,0.5)', 'thin');
        tr.boltTex = trShapeTexture(64, '#f0ffff', '#3fd2ff', 'rgba(63,210,255,0.45)', false);
        tr.zapTex = trShapeTexture(64, '#fff2ea', '#ff4a30', 'rgba(255,74,48,0.45)', false);
        tr.sky = new THREE.Group();
        tr.stars = trBuildStars();
        tr.sky.add(tr.stars);
        trBuildNebulae(tr.sky);
        trBuildSun(tr.sky);
        tr.scene.add(tr.sky);
        // Hard sun, faint fill: the dark side of a rock is nearly black, which
        // is what makes the light read as coming from somewhere.
        tr.sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
        tr.scene.add(tr.sun, new THREE.AmbientLight(0x6a78a8, 0.32));
        // Always in the scene, hidden below High: the light count is part of
        // every lit shader, so showing or hiding it recompiles once, on a
        // tier change — never on a shot.
        tr.muzzleLight = new THREE.PointLight(0x9fe8ff, 0, 30, 2);
        tr.muzzleLight.visible = tr.q.flashLight;
        tr.muzzleK = 0;
        tr.scene.add(tr.muzzleLight);
        // One per fighter, for the same reason: always there, shown on High,
        // dark (intensity 0) when nobody is flying it or thrusters are off.
        tr.thrustLights = [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
            const l = new THREE.PointLight(0xffffff, 0, THRUST_RANGE, 2);
            l.visible = tr.q.thrustLight;
            tr.thrustLights.push(l);
            tr.scene.add(l);
        }
        trBuildPools();
        [tr.rockMesh, tr.shipMeshes[0], tr.glows, tr.boltPts, tr.zapPts].forEach((o) => tr.scene.add(o));
        trLoadGrime();
        trBakeGrime();
        trAddShipMeshes();
        trLoadModels();
        tr.puffs.forEach((p) => tr.scene.add(p.sp));
        tr.deflector = 100;

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
        // Materials not on a mesh at teardown are not reached by the traverse.
        if (tr.shipMats) ['matte', 'shiny'].forEach((k) => { tr.shipMats[k].dart.dispose(); tr.shipMats[k].model.dispose(); });
        tr.shipMats = null;
        tr.shiny = null;
        tr.puffs = [];
        tr.zaps = [];
        tr.guns = [];
        tr.shipMeshes = [];
        tr.shipTail = [];
        tr.hurtAge = 9;
        trHideTargets();
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
        const T = tr.q = Object.assign({}, KNOBS, TIERS[tr.tier], tr.qOver);
        if (tr.renderer) {
            tr.skyGlows.forEach((s) => { s.visible = T[s.userData.knob]; });
            [tr.glows, tr.boltPts, tr.zapPts].forEach((p) => { p.visible = T.points; });
            tr.guns.forEach((g) => { g.pivot.visible = T.guns; });
            tr.stars.geometry.setDrawRange(0, T.stars);
            // Swapping a material compiles its program the first time: a
            // hitch once, when auto steps down, not a cost every frame.
            tr.muzzleLight.visible = T.flashLight;
            tr.thrustLights.forEach((l) => { l.visible = T.thrustLight; });
            // Same attributes, same material: a new rock geometry is an
            // upload, not a recompile.
            if (tr.rockDetail !== T.rockDetail) {
                tr.rockDetail = T.rockDetail;
                tr.rockMesh.geometry.dispose();
                tr.rockMesh.geometry = trRockGeometry(T.rockDetail);
            }
            if (tr.shiny !== T.shiny) {
                tr.shiny = T.shiny;
                tr.shipMeshes.forEach((m) => { m.material = trShipMat(m.userData.kind); });
            }
            trResize();
        }
        if (tr.stage) {
            tr.stage.classList.toggle('tr-no-glass', !T.glass);
            tr.stage.classList.toggle('tr-no-frame', !T.frame);
            tr.stage.classList.toggle('tr-no-hud', !T.hud);
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

    // FOVs are vertical on a landscape stage. On a portrait one the same angle
    // goes across instead, so the guns and the width of the sky stay in view
    // and the extra height is extra sky.
    function trFov(deg) {
        const a = tr.camera.aspect;
        if (a >= 1) return deg;
        return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(deg / 2)) / a));
    }

    function trResize() {
        if (!tr.renderer) return;
        const w = tr.stage.clientWidth, h = tr.stage.clientHeight;
        if (!w || !h) return;                // display:none reports zero; keep the last good size
        tr.cssW = w; tr.cssH = h;
        const s = tr.q.scale;
        const bh = Math.max(1, Math.round(h * s));
        tr.renderer.setSize(Math.max(1, Math.round(w * s)), bh, false);
        const zoomed = tr.camera.fov < trFov(BASE_FOV) - 0.05;
        tr.camera.aspect = w / h;
        tr.camera.fov = trFov(zoomed ? ZOOM_FOV : BASE_FOV);
        tr.camera.updateProjectionMatrix();
        [tr.glows, tr.boltPts, tr.zapPts].forEach((p) => {
            const u = p.material.uniforms, px = p.material.userData.px;
            u.scale.value = bh / 2;
            u.minPx.value = px[0] * s;
            u.maxPx.value = px[1] * s;
        });
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
        // A hidden page gets no frames, so a run cut off by one is over.
        if (tr.bench) trBenchEnd('Stopped: the screen was hidden.');
        // The microphone is not held for a screen nobody is looking at.
        trListenStop();
    }

    function trFrame(now) {
        if (!tr.running) return;
        tr.raf = requestAnimationFrame(trFrame);
        if (tr.bench) { trBenchFrame(now); return; }
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
        // The benchmark holds the world still, so every setting it tries
        // draws the same frame.
        const wdt = tr.bench ? 0 : dt * tr.timeScale;
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
        trUpdateGuns(dt);
        trUpdateMuzzle(dt);
        trUpdateGlass(dt);
        trUpdateRocks(wdt);
        trUpdateSpawner();
        trUpdateFoes(wdt);
        trUpdateBolts();
        trUpdateZaps();
        trUpdatePuffs(wdt);
        trUpdateLockMark();
        trUpdateTargets();
        trUpdateHudText(dt);
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
        tr.sun.position.fromArray(SUN_DIR).applyQuaternion(tr.sky.quaternion);
    }

    /* ---- the world: rocks -------------------------------------------------
     * Rocks drift in world space — the ship's flight carries them past and
     * the pilot's turns swing them round. A fragment has a velocity of its
     * own on top, away from where its parent was shot.
     */
    function trRock() {
        const r = tr.rocks.find((x) => !x.active);
        if (!r) return null;
        r.gen++;
        r.active = true;
        r.safe = false;
        r.vel.set(0, 0, 0);
        r.axis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
        r.angle = rand(0, 6.3);
        r.spin = rand(-0.6, 0.6);
        return r;
    }

    function trSpawnRock(incoming) {
        const r = trRock();
        if (!r) return;
        let x, y;
        if (incoming === undefined ? Math.random() < INCOMING : incoming) {
            // On the line of flight, near enough to hit. It grows on screen
            // for four seconds first — long enough to see it and shoot it.
            x = rand(-1.5, 1.5); y = rand(-1.2, 1.2);
            r.size = rand(1.6, 3);
        } else {
            x = rand(-75, 75); y = rand(-48, 48);
            // Never near the line of flight by accident: a rock through the
            // cockpit is the set piece above, not a coin toss.
            if (Math.abs(x) < 12 && Math.abs(y) < 9) x = x < 0 ? x - 14 : x + 14;
            r.size = rand(1.5, 6);
        }
        r.pos.set(x, y, rand(-185, -150));
    }

    // Shot, a big rock splits into two to four pieces flung out from its
    // centre and a small one is only a flash. Against the hull it breaks
    // with no explosion — rock on glass — and its pieces are thrown off the
    // line of flight, starting outside the hull and marked `safe`, so they
    // cannot hit it again on the way past.
    function trShatter(r, rammed) {
        const big = r.size >= SPLIT_MIN;
        if (!rammed) trRockBoom(r.pos, r.size * 0.9, big ? 3 : 2);
        r.active = false;
        if (!big && !rammed) return;
        const n = r.size > 4 ? 4 : r.size > 2.6 ? 3 : 2;
        const ox = r.pos.x, oy = r.pos.y, oz = r.pos.z, size = r.size;
        for (let k = 0; k < n; k++) {
            const f = trRock();
            if (!f) return;                             // a full pool loses the smaller pieces, nothing else
            f.size = size * rand(0.38, 0.55);
            if (rammed) {
                // Outward from the line of flight, evenly round it.
                const a = (k / n) * Math.PI * 2 + rand(-0.4, 0.4);
                V1.set(Math.cos(a), Math.sin(a), rand(-0.3, 0.1)).normalize();
                f.pos.set(ox, oy, oz).addScaledVector(V1, HULL_R + f.size + 0.5);
                f.vel.copy(V1).multiplyScalar(rand(12, 20));
                f.safe = true;
            } else {
                V1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
                f.pos.set(ox, oy, oz).addScaledVector(V1, size * 0.5);
                f.vel.copy(V1).multiplyScalar(rand(7, 15));
            }
            f.spin = rand(-2.4, 2.4);
        }
    }

    function trUpdateRocks(wdt) {
        const T = tr.q;
        let live = 0;
        for (let i = 0; i < MAX_ROCKS; i++) if (tr.rocks[i].active) live++;

        // There are always some rocks about. A belt is the same rocks spawned
        // much faster, and the field thins out on its own after one.
        if (tr.wt >= tr.rockAt && live < T.rocks) {
            trSpawnRock();
            // A rock lives about five seconds; a belt keeps the field near full.
            tr.rockAt = tr.wt + (tr.pilot.belt ? rand(0.12, 0.3) : rand(0.6, 1.3));
        }

        let n = 0;
        for (let i = 0; i < MAX_ROCKS; i++) {
            const r = tr.rocks[i];
            if (!r.active) continue;
            r.pos.applyQuaternion(DQ);
            r.vel.applyQuaternion(DQ);
            r.pos.addScaledVector(r.vel, wdt);
            r.pos.z += SPEED * wdt;
            // Into the hull: the ship takes it, the rock does not survive it.
            if (!r.safe && r.pos.z > -r.size - 1 && r.pos.z < 1 && Math.hypot(r.pos.x, r.pos.y) < r.size + HULL_R) {
                trShatter(r, true);
                trSfx('crack');
                trHurt(0.9);
                continue;
            }
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
        const tt = clamp(wt - e.t0, 0, e.dur);
        let s = 0;
        while (s < e.segs - 1 && tt > e.segEnd[s]) s++;
        const a = s ? e.segEnd[s - 1] : 0;
        const t = (tt - a) / (e.segEnd[s] - a), it = 1 - t;
        const b0 = it * it * it, b1 = 3 * it * it * t, b2 = 3 * it * t * t, b3 = t * t * t;
        const p = e.pts, o = s * 9;
        return out.set(
            b0 * p[o] + b1 * p[o + 3] + b2 * p[o + 6] + b3 * p[o + 9],
            b0 * p[o + 1] + b1 * p[o + 4] + b2 * p[o + 7] + b3 * p[o + 10],
            b0 * p[o + 2] + b1 * p[o + 5] + b2 * p[o + 8] + b3 * p[o + 11]
        );
    }

    // A point in ship space at a yaw (0 ahead, positive left — the turret's
    // convention), a range, and a height.
    function trAt(yaw, range, y) {
        return new THREE.Vector3(-Math.sin(yaw) * range, y, -Math.cos(yaw) * range);
    }

    // Knots, unit headings and speeds → Bézier control points and segment
    // end times. Handles are speed × duration / 3, the Hermite form.
    function trHermite(knots, heads, speeds) {
        const pts = [], ends = [];
        let t = 0;
        for (let i = 0; i < knots.length - 1; i++) {
            const A = knots[i], B = knots[i + 1];
            const T = 1.1 * A.distanceTo(B) / ((speeds[i] + speeds[i + 1]) / 2);
            if (!i) pts.push(A);
            pts.push(A.clone().addScaledVector(heads[i], speeds[i] * T / 3),
                B.clone().addScaledVector(heads[i + 1], -speeds[i + 1] * T / 3), B);
            t += T;
            ends.push(t);
        }
        return { pts, ends, dur: t };
    }

    // A swoop: in from off-screen, across the view, out into the fog. A
    // strafing run: in from off-screen, round onto a head-on line at the
    // ship, past it over or under, and away behind.
    function trPlanPath(strafe) {
        const cy = tr.yaw, side = Math.random() < 0.5 ? -1 : 1;
        const start = trAt(cy + side * rand(ENTRY_OFF[0], ENTRY_OFF[1]), rand(55, 80), rand(-12, 38));
        const mid = (a, b) => b.clone().sub(a).normalize();
        if (!strafe) {
            const range = rand(35, 65);
            const seen = trAt(cy + rand(-0.35, 0.35), range, range * Math.tan(tr.pitch) + rand(-8, 10));
            const out = Math.random() < 0.5
                ? trAt(cy - side * rand(1.4, 2.2), 135, rand(-10, 50))
                : trAt(cy + rand(-0.6, 0.6), 140, rand(30, 70));
            // Heading in curves toward the view; across it, along the line
            // from entry to exit; out, climbing a little.
            const h0 = mid(start, seen).addScaledVector(V1.set(0, 1, 0).cross(mid(start, seen)), side * 0.6).normalize();
            const h1 = mid(start, out);
            const h2 = mid(seen, out).add(V1.set(0, 0.25, 0)).normalize();
            const p = trHermite([start, seen, out], [h0, h1, h2], [48, rand(34, 46), 62]);
            p.strafe = null;
            return p;
        }
        const lineUp = trAt(cy + rand(-0.3, 0.3), rand(95, 115), rand(5, 24));
        const over = Math.random() < 0.6 ? 1 : -1;
        const pass = new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * rand(5, 9), over * rand(9, 14), -10);
        const away = new THREE.Vector3(pass.x * 6, over * rand(50, 80), rand(80, 110));
        const run = mid(lineUp, pass);
        const h0 = mid(start, lineUp).addScaledVector(V1.set(0, 1, 0).cross(mid(start, lineUp)), side * 0.5).normalize();
        const h1 = mid(start, lineUp).lerp(run, 0.75).normalize();
        const h3 = mid(pass, away);
        const p = trHermite([start, lineUp, pass, away], [h0, h1, run, h3], [52, 44, 52, 66]);
        // Guns open on the head-on leg, and stop short of the pass.
        p.strafe = [p.ends[0] / p.dur, (p.ends[0] + (p.ends[1] - p.ends[0]) * 0.8) / p.dur];
        return p;
    }

    // The planner is not trusted near the cockpit: a path is sampled, and
    // one that comes too close is planned again.
    function trSafePath(strafe) {
        const probeFoe = { pts: null, segs: 0, segEnd: null, t0: 0, dur: 0 };
        for (let tries = 0; tries < 12; tries++) {
            const p = trPlanPath(strafe);
            probeFoe.pts = []; p.pts.forEach((v) => probeFoe.pts.push(v.x, v.y, v.z));
            probeFoe.segs = p.ends.length; probeFoe.segEnd = p.ends; probeFoe.dur = p.dur;
            let near = Infinity;
            for (let i = 0; i <= 60; i++) near = Math.min(near, trPathAt(probeFoe, p.dur * i / 60, V1).length());
            if (near >= PASS_MIN) return p;
        }
        return null;
    }

    function trPickModel() {
        const n = tr.shipMeshes.length;
        return n > 1 ? 1 + Math.floor(Math.random() * (n - 1)) : 0;
    }

    function trSpawnFoe(path, delay, offset, ace, model) {
        const e = tr.foes.find((x) => !x.active);
        if (!e || !path) return;
        e.ace = ace || null;
        e.model = model === undefined ? trPickModel() : model;
        path.pts.forEach((v, i) => {
            e.pts[i * 3] = v.x + (offset ? offset[0] : 0);
            e.pts[i * 3 + 1] = v.y + (offset ? offset[1] : 0);
            e.pts[i * 3 + 2] = v.z + (offset ? offset[2] : 0);
        });
        e.segs = path.ends.length;
        for (let i = 0; i < e.segs; i++) e.segEnd[i] = path.ends[i];
        e.dur = path.dur;
        e.t0 = tr.wt + delay;
        e.locked = false;
        e.dodging = false;
        e.strafe = path.strafe;
        e.shotAt = 0;
        e.bank = 0;
        // A callsign for the target box. Nothing reads it but the player.
        e.tag = e.ace ? 'ACE' : 'ABCDEFGHJKLMNPRSTVXZ'[Math.floor(Math.random() * 20)] + '-' + (10 + Math.floor(Math.random() * 90));
        e.active = true;
        trPathAt(e, e.t0, e.pos);
    }

    function trUpdateSpawner() {
        if (tr.wt < tr.spawnAt) return;
        const T = tr.q;
        let busy = 0;
        for (let i = 0; i < MAX_ENEMIES; i++) if (tr.foes[i].active) busy++;
        if (busy >= T.enemies) { tr.spawnAt = tr.wt + 0.5; return; }
        // About one run in three is a strafing run.
        const path = trSafePath(Math.random() < 0.35);
        if (!path) { tr.spawnAt = tr.wt + 0.3; return; }
        const S = tr.sortie;
        if (S && !S.finishing) {
            // A due ace goes first. With the deck spent there is nothing else
            // to ask, so every waiting ace is due and plain fighters stop.
            const spent = !tr.deck.length;
            for (let i = 0; i < tr.aceQ.length; i++) {
                if (!spent && tr.aceQ[i].at > tr.wt) continue;
                trSpawnFoe(path, 0, null, tr.aceQ.splice(i, 1)[0].q);
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
        const model = trPickModel();
        trSpawnFoe(path, 0, null, null, model);
        if (busy + 2 <= T.enemies && Math.random() < 0.3) trSpawnFoe(path, WING_DELAY, WING_OFFSET, null, model);
        tr.spawnAt = tr.wt + rand(1.2, 2.8);
    }

    function trUpdateFoes(wdt) {
        const gpos = tr.glows.geometry.attributes.position.array;
        const gcol = tr.glows.geometry.attributes.tint.array;
        const H = 0.05;
        const kRoll = 1 - Math.exp(-wdt * ROLL_RATE);
        const N = tr.shipN;
        N.fill(0);
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
            trPathAt(e, tr.wt + H, V2);
            trPathAt(e, tr.wt - H, V3);
            // Velocity and acceleration by central differences. The lift has
            // to supply the acceleration and hold the craft up as well; the
            // bank is the angle that lift leans from the wings-level up.
            V4.subVectors(V2, V3).normalize();          // forward
            V1.copy(V2).add(V3).addScaledVector(e.pos, -2).divideScalar(H * H);   // acceleration
            V1.y += FLIGHT_G;                           // lift
            V1.addScaledVector(V4, -V1.dot(V4));        // across the flight path only
            V5.copy(UP).addScaledVector(V4, -V4.y);     // wings-level up
            if (V5.lengthSq() > 1e-4) {
                V5.normalize();
                V6.crossVectors(V4, V5);                // the pilot's right
                const want = clamp(Math.atan2(V1.dot(V6), V1.dot(V5)), -1.4, 1.4);
                e.bank += (want - e.bank) * kRoll;
            }
            let bank = e.bank;
            // A swerving fighter throws in a full barrel roll, toward its break.
            if (e.dodging) {
                const r = clamp((tr.wt - e.t0) / 0.7, 0, 1);
                bank += e.rollDir * Math.PI * 2 * r * r * (3 - 2 * r);
            }

            // On a strafing run, inside its window, it shoots at the ship.
            // A locked one is held, and one breaking away has other things to do.
            if (e.strafe && !e.locked && !e.dodging && tr.wt >= e.shotAt) {
                const u = (tr.wt - e.t0) / e.dur;
                if (u >= e.strafe[0] && u <= e.strafe[1] && e.pos.length() < SIGHT) {
                    e.nose.copy(e.pos).addScaledVector(V4, 2.2 * SHIP_SCALE);
                    trEnemyFire(e.nose);
                    e.shotAt = tr.wt + ZAP_EVERY * rand(0.8, 1.3);
                }
            }

            DUMMY.position.copy(e.pos);
            // The squish is in the fighter's own frame, so it stays flat
            // through a bank. The instancing shader divides normals by the
            // scale, so a squashed panel is still lit as the panel it is.
            DUMMY.scale.set(SHIP_SCALE, SHIP_SCALE * (1 - tr.ships.squish), SHIP_SCALE);
            DUMMY.lookAt(V2);
            DUMMY.rotateZ(bank);
            DUMMY.updateMatrix();
            const m = e.model < tr.shipMeshes.length ? e.model : 0;
            tr.shipMeshes[m].setMatrixAt(N[m], DUMMY.matrix);
            tr.shipMeshes[m].setColorAt(N[m], e.ace ? ACE_COL : FOE_COL);
            N[m]++;

            // Engine glow behind the hull, along the direction of travel.
            V1.copy(e.pos).addScaledVector(V4, tr.shipTail[m] * SHIP_SCALE);
            gpos[n * 3] = V1.x; gpos[n * 3 + 1] = V1.y; gpos[n * 3 + 2] = V1.z;
            const g = e.ace ? ACE_GLOW : FOE_GLOW;
            gcol[n * 3] = g[0]; gcol[n * 3 + 1] = g[1]; gcol[n * 3 + 2] = g[2];
            const tl = tr.thrustLights[n];
            tl.position.copy(V1).addScaledVector(V4, -THRUST_BACK * SHIP_SCALE);
            tl.intensity = tr.ships.thrust ? THRUST_I : 0;
            n++;
        }
        for (let i = n; i < MAX_ENEMIES; i++) tr.thrustLights[i].intensity = 0;
        for (let m = 0; m < tr.shipMeshes.length; m++) {
            const mesh = tr.shipMeshes[m];
            mesh.count = N[m];
            mesh.visible = N[m] > 0;            // no empty draw call for a model nobody is flying
            if (N[m]) {
                mesh.instanceMatrix.needsUpdate = true;
                mesh.instanceColor.needsUpdate = true;
            }
        }
        tr.glows.geometry.setDrawRange(0, n);
        tr.glows.geometry.attributes.position.needsUpdate = true;
        tr.glows.geometry.attributes.tint.needsUpdate = true;
    }

    /* ---- firing -----------------------------------------------------------*/
    // The nearest fighter to a tap, on screen, inside the lock radius.
    // Locks only happen in a sortie, and a plain fighter is only worth
    // locking while the deck still has a question for it.
    // Half a target box, in CSS px, for a fighter this far into the view.
    // The same size trUpdateTargets draws, so "near the box" means the box
    // the player can see.
    function trBoxHalf(depth, h) {
        const f = (h / 2) / Math.tan(THREE.MathUtils.degToRad(tr.camera.fov / 2));
        return clamp(3.4 * SHIP_SCALE * f / depth, 24, 140) / 2;
    }

    // The fighter a shot is aimed at: the one whose target box the tap lands
    // nearest, if that is within the lock distance. Locks only happen in a
    // sortie, and a plain fighter is only worth locking while the deck still
    // has a question for it.
    function trPickFoe(nx, ny, w, h) {
        const S = tr.sortie;
        if (!S || S.finishing) return null;
        let best = null, bestD = tr.nearPx;
        for (const e of tr.foes) {
            if (!e.active || e.locked || e.dodging || tr.wt < e.t0) continue;
            if (!e.ace && !tr.deck.length) continue;
            if (e.pos.length() > SIGHT) continue;       // still in the fog: the player cannot see it
            V3.copy(e.pos).applyMatrix4(tr.camera.matrixWorldInverse);
            if (V3.z > -1) continue;                    // behind the turret
            V2.copy(e.pos).project(tr.camera);
            const half = trBoxHalf(-V3.z, h);
            // Distance from the tap to the box's edge; inside the box is 0.
            const dx = Math.max(0, Math.abs((V2.x - nx) * w / 2) - half);
            const dy = Math.max(0, Math.abs((V2.y - ny) * h / 2) - half);
            const d = Math.hypot(dx, dy);
            if (d <= bestD) { best = e; bestD = d; }
        }
        return best;
    }

    // The rock under a tap: any rock near enough to see, whose disc on
    // screen — padded, a rock is a small thing to hit with a finger — holds
    // the tap. Nearest the tap wins. No sortie needed: rocks ask nothing.
    function trPickRock(nx, ny, w, h) {
        const f = (h / 2) / Math.tan(THREE.MathUtils.degToRad(tr.camera.fov / 2));
        let best = null, bestD = Infinity;
        for (const r of tr.rocks) {
            if (!r.active) continue;
            const dist = r.pos.length();
            if (dist > SIGHT) continue;
            V3.copy(r.pos).applyMatrix4(tr.camera.matrixWorldInverse);
            if (V3.z > -1) continue;
            V2.copy(r.pos).project(tr.camera);
            const d = Math.hypot((V2.x - nx) * w / 2, (V2.y - ny) * h / 2);
            const reach = Math.max(26, (r.size * f) / -V3.z * 1.3);
            if (d < reach && d < bestD) { best = r; bestD = d; }
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
            t = tr.wt + V2.distanceTo(from) / tr.boltSpeed;
        }
        return t;
    }

    /* ---- the guns ---------------------------------------------------------
     * Both turn to each shot, snapping on the trigger, and hold there a
     * moment before easing back to centre; while a fighter is locked they
     * track it. Barrels alternate, and the one that fires kicks back.
     */
    const GUN_HOLD = 0.6, GUN_KICK = 0.32;

    function trUpdateGuns(dt) {
        tr.rig.updateMatrixWorld();                     // lookAt reads the camera's world matrix
        const k = 1 - Math.exp(-dt * 16), kr = Math.exp(-dt * 26);
        for (const g of tr.guns) {
            if (tr.lockFoe) g.want.copy(tr.lockFoe.pos);
            else if (g.hold > 0) g.hold -= dt;
            else if (tr.mouse) {
                // Where the pointer is, 60 units out along its ray.
                V3.set(tr.mouse.nx, tr.mouse.ny, 0.5).unproject(tr.camera).sub(tr.camera.getWorldPosition(g.want)).normalize();
                g.want.addScaledVector(V3, 60);
            } else tr.camera.localToWorld(g.want.set(0, 0, -60));
            g.aim.lerp(g.want, k);
            g.pivot.lookAt(g.aim);
            g.recoil *= kr;
            g.mesh.position.z = -g.recoil;
        }
    }

    function trAimGuns(point) {
        tr.rig.updateMatrixWorld();
        for (const g of tr.guns) {
            g.want.copy(point);
            g.aim.copy(point);
            g.hold = GUN_HOLD;
            g.pivot.lookAt(point);
            g.pivot.updateMatrixWorld(true);
        }
    }

    // The muzzle light fades on real time, so a shot fired into slow motion
    // still flashes and is gone.
    function trUpdateMuzzle(dt) {
        if (tr.muzzleK <= 0) return;
        tr.muzzleK = Math.max(0, tr.muzzleK - dt / MUZZLE_S);
        tr.muzzleLight.intensity = MUZZLE_I * tr.muzzleK * tr.muzzleK;
    }

    function trGunTip(g, out) {
        return g.mesh.localToWorld(out.set(0, 0, GUN_LEN));
    }

    // A full pool gives up its oldest free shot — one aimed at nothing — so
    // rapid fire never swallows a tap. A locked bolt is never taken: its
    // question is waiting on it.
    function trSpawnBolt(from, to, t1, target) {
        let b = tr.bolts.find((x) => !x.active);
        if (!b) {
            for (const x of tr.bolts) if (!x.target && !x.rock && (!b || x.t0 < b.t0)) b = x;
        }
        if (!b) return null;
        b.from.copy(from);
        b.to.copy(to);
        b.t0 = tr.wt;
        b.t1 = t1;
        b.target = target;
        b.rock = null;
        b.active = true;
        return b;
    }

    // A shot at a rock always hits. Rocks have no question to ask, so there
    // is no reason a fair shot should miss; the bolt is steered onto the rock
    // all the way in (trUpdateBolts), so a turn mid-flight cannot spoil it.
    function trShootRock(r, muzzle) {
        const t = r.pos.distanceTo(muzzle) / (tr.boltSpeed + SPEED);
        const b = trSpawnBolt(muzzle, r.pos, tr.wt + t, null);
        if (!b) return;
        b.rock = r;
        b.rockGen = r.gen;
    }

    function trFire(clientX, clientY) {
        // While a card is asking the stage is not a trigger: a stray tap
        // beside an answer button must not fire. Once it is answered the guns
        // are free again, but nothing locks until the card has gone — one
        // question at a time.
        if (!tr.running || tr.bench || (tr.ask && tr.ask.phase === 'ask')) return;
        const r = tr.stage.getBoundingClientRect();
        const nx = ((clientX - r.left) / r.width) * 2 - 1;
        const ny = -((clientY - r.top) / r.height) * 2 + 1;
        tr.scene.updateMatrixWorld();                   // the camera's matrices, as of this frame's aim
        trSfx('zap');
        tr.shake = Math.max(tr.shake, 0.06);
        trTapMark(clientX - r.left, clientY - r.top, r.width);

        // The target is chosen first, so the guns can turn to it before
        // the bolt leaves. The gun's pivot stands in for the muzzle while
        // leading; the lead is redone from the real muzzle afterwards.
        tr.barrel = -tr.barrel;
        const gun = tr.guns[tr.barrel > 0 ? 1 : 0];
        gun.pivot.getWorldPosition(V5);
        let foe = tr.ask ? null : trPickFoe(nx, ny, r.width, r.height), rock = null;
        if (foe && trLead(foe, V5) >= foe.t0 + foe.dur - 0.15) foe = null;
        if (foe) trPathAt(foe, trLead(foe, V5), V6);
        else {
            rock = trPickRock(nx, ny, r.width, r.height);
            if (rock) V6.copy(rock.pos);
            else {
                // A free shot, along the ray through the tap.
                V2.set(nx, ny, 0.5).unproject(tr.camera).sub(tr.camera.getWorldPosition(V3)).normalize();
                V6.copy(V3).addScaledVector(V2, 150);
            }
        }
        trAimGuns(V6);
        const muzzle = trGunTip(gun, V1);
        gun.recoil = GUN_KICK;
        trPuff({ at: muzzle, c0: 0xeaffff, c1: 0x3fd2ff, r0: 0.1, r1: 0.26, life: 0.07, add: true, fade: 0.3, noBite: true });
        if (tr.muzzleLight.visible) { tr.muzzleLight.position.copy(muzzle); tr.muzzleK = 1; }

        if (foe) { trOnLock(foe, muzzle, trLead(foe, muzzle)); return; }
        if (rock) { trShootRock(rock, muzzle); return; }
        trSpawnBolt(muzzle, V6, tr.wt + muzzle.distanceTo(V6) / tr.boltSpeed, null);
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

        const fov = trFov(A && A.phase === 'ask' ? ZOOM_FOV : BASE_FOV);
        if (Math.abs(tr.camera.fov - fov) > 0.05) {
            tr.camera.fov += (fov - tr.camera.fov) * (1 - Math.exp(-dt * 6));
            tr.camera.updateProjectionMatrix();
        }
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
        tr.ask = { foe, bolt, q, fromAce, mode: trMode(), phase: 'ask', elapsed: 0, left: 0, entry: '', choices: null, sp: null,
            openAt: performance.now() };
        $('tr-hint').classList.add('tr-gone');
        tr.toastLeft = 0;
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

    // Fires the instant the digits are the answer, and misses the instant
    // they cannot become it: for 35, a 4 is wrong on the 4, and so is a
    // leading 0. Otherwise a child could walk the digits until one fired.
    // FIRE on a part-typed answer answers with what is there.
    function trKey(k) {
        const A = tr.ask;
        if (!A || A.phase !== 'ask' || A.mode !== 'keypad') return;
        const want = String(A.q.answer);
        if (k === 'back') A.entry = A.entry.slice(0, -1);
        else if (k === 'fire') { if (A.entry) trAnswer(Number(A.entry)); return; }
        else if (A.entry.length < 4) A.entry += k;
        $('tr-q-entry').textContent = A.entry || '?';
        if (A.entry === want) trAnswer(A.q.answer);
        else if (A.entry && want.indexOf(A.entry) !== 0) trAnswer(Number(A.entry));
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
            foe.segEnd[0] = dur;
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
        const pos = tr.boltPts.geometry.attributes.position.array;
        let n = 0;
        for (let i = 0; i < MAX_BOLTS; i++) {
            const b = tr.bolts[i];
            if (!b.active) continue;
            const live = b.rock && b.rock.active && b.rock.gen === b.rockGen;
            if (live) b.to.copy(b.rock.pos);
            const u = (tr.wt - b.t0) / (b.t1 - b.t0);
            if (u >= 1) {
                b.active = false;
                if (b.target) trHit(b.target);
                else if (live) { trShatter(b.rock, false); trSfx('crack'); }
                continue;
            }
            V1.lerpVectors(b.from, b.to, u);
            pos[n * 3] = V1.x; pos[n * 3 + 1] = V1.y; pos[n * 3 + 2] = V1.z;
            n++;
        }
        tr.boltPts.geometry.setDrawRange(0, n);
        tr.boltPts.geometry.attributes.position.needsUpdate = true;
    }

    function trHit(foe) {
        trPathAt(foe, tr.wt + 0.05, V2);
        trExplode(foe.pos, V2.sub(foe.pos).normalize());
        // Closer blasts shake harder; one in the fog barely at all.
        tr.shake = Math.max(tr.shake, clamp(1.2 - foe.pos.length() / 60, 0.1, 0.6));
        foe.active = false;
        foe.locked = false;
        foe.ace = null;
        if (tr.lockFoe === foe) tr.lockFoe = null;
        tr.hits++;
        trSfx('boom');
    }

    /* ---- enemy fire -------------------------------------------------------
     * Decided at the muzzle, like the turret's: a hit is aimed at the hull
     * and lands when it gets there; a miss is aimed a few units wide and flies
     * on past. Nothing is tested for collision.
     */
    function trEnemyFire(from) {
        const z = tr.zaps.find((x) => !x.active);
        if (!z) return;
        z.hit = Math.random() < ZAP_HIT;
        z.from.copy(from);
        if (z.hit) z.to.set(rand(-1.2, 1.2), rand(-1, 0.4), -1.2);
        else {
            // Wide of the hull, then on behind it.
            V3.set(rand(-1, 1), rand(-0.6, 1), 0).normalize().multiplyScalar(rand(5, 9));
            z.to.subVectors(V3, from).normalize().multiplyScalar(from.length() + 40).add(from);
        }
        z.t0 = tr.wt;
        z.t1 = tr.wt + z.from.distanceTo(z.to) / tr.zapSpeed;
        z.active = true;
        trSfx('pew');
    }

    function trUpdateZaps() {
        const pos = tr.zapPts.geometry.attributes.position.array;
        let n = 0;
        for (let i = 0; i < MAX_ZAPS; i++) {
            const z = tr.zaps[i];
            if (!z.active) continue;
            const u = (tr.wt - z.t0) / (z.t1 - z.t0);
            if (u >= 1) {
                z.active = false;
                if (z.hit) trHurt(0.6);
                continue;
            }
            V1.lerpVectors(z.from, z.to, u);
            pos[n * 3] = V1.x; pos[n * 3 + 1] = V1.y; pos[n * 3 + 2] = V1.z;
            n++;
        }
        tr.zapPts.geometry.setDrawRange(0, n);
        tr.zapPts.geometry.attributes.position.needsUpdate = true;
    }

    // The ship is hit. It cannot be hurt — the player cannot lose — so this
    // is a red flash at the edges, a jolt, and a filler number dipping.
    function trHurt(k) {
        // A hit while the last one is still fading never flashes weaker.
        tr.hurtK = Math.max(k, tr.hurtAge < HURT_IN + HURT_OUT ? tr.hurtK : 0);
        tr.hurtAge = 0;
        tr.shake = Math.max(tr.shake, 0.5 * k);
        tr.deflector = Math.max(DEFLECTOR_MIN, tr.deflector - DEFLECTOR_HIT * k);
        tr.hudLeft = 0;                                 // show the dip now, not at the next tick
        trSfx('hurt');
    }

    /* ---- explosions -------------------------------------------------------
     * Every explosion is a handful of crisp discs and rings from one pool,
     * each with its own size curve, colour fade, drift and delay. A ring of
     * the pool: an explosion when the pool is busy takes the oldest shapes.
     * Eight styles, picked in the debug panel; rocks always crumble the same.
     *
     * Curves: 'out' swells fast then slows; 'pop' grows and shrinks to
     * nothing; 'shrink' starts at r0 and dwindles toward r1.
     */
    let puffNext = 0;

    function trPuff(o) {
        const p = tr.puffs[puffNext];
        puffNext = (puffNext + 1) % MAX_PUFFS;
        const m = p.sp.material;
        m.map = o.ring === 'thin' ? tr.thinRingTex : o.ring ? tr.ringTex : tr.discTex;
        m.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
        p.c0.setHex(o.c0);
        p.c1.setHex(o.c1 === undefined ? o.c0 : o.c1);
        p.sp.position.copy(o.at);
        if (o.off) p.sp.position.add(o.off);
        if (o.vel) p.vel.copy(o.vel); else p.vel.set(0, 0, 0);
        p.r0 = o.r0 || 0;
        p.r1 = o.r1;
        p.curve = o.curve === 'pop' ? 1 : o.curve === 'shrink' ? 2 : 0;
        p.fade = o.fade === undefined ? 0.6 : o.fade;
        p.delay = o.delay || 0;
        p.life = p.max = o.life;
        // Later shapes draw over earlier ones, so smoke covers the core.
        p.sp.renderOrder = o.order || 0;
        p.sp.visible = false;
        // A bite starts a little off the middle, so for a moment it leaves
        // a crescent. Rings and the muzzle flash are never bitten.
        p.bite = tr.bite && !o.ring && !o.noBite;
        // The debug slider slows explosions; the muzzle flash is not one.
        p.rate = o.noBite ? 1 : tr.boomRate;
        p.biteR.value = 0;
        if (p.bite) {
            const a = Math.random() * Math.PI * 2, d = rand(BITE_OFF[0], BITE_OFF[1]);
            p.biteC.value.set(0.5 + d * Math.cos(a), 0.5 + d * Math.sin(a));
        }
    }

    /* The bite: a circle cut out of a puff, centred at biteC in the sprite's
     * texture space (the disc is radius 0.25 there, its halo out to 0.5). It
     * waits BITE_AT of the puff's life, then grows to BITE_R by BITE_END —
     * faster than the disc, so it eats the disc from the inside out.
     *
     * Cutting the texture is not enough: the halo round the eaten part
     * stays, outlines the hole, and the bite reads as a dark disc laid on a
     * bright one. So while bitten a puff draws itself from the distance to
     * the crescent — fill, rim and halo exactly as trShapeTexture bakes them
     * (fill 0.83, a 0.04 rim, halo 0.32 fading over 0.25) — and the rim and
     * halo follow the bite's edge as well as the disc's. Outside both
     * circles, a point whose nearest rim has been eaten measures to the
     * nearer horn of the crescent instead. */
    const BITE_AT = 0.18, BITE_END = 0.7, BITE_R = 0.62, BITE_OFF = [0.05, 0.09];
    const BITE_FRAG = [
        '#include <alphatest_fragment>',
        'if ( biteR > 0.0 ) {',
        '  vec2 c = vec2( 0.5 );',
        '  float L = length( biteC - c );',
        '  if ( biteR >= L + 0.25 ) discard;',
        '  float d1 = length( vUv - c ) - 0.25;',
        '  float d2 = biteR - length( vUv - biteC );',
        '  float a = ( 0.0625 - biteR * biteR + L * L ) / ( 2.0 * L );',
        '  float h2 = 0.0625 - a * a;',
        '  vec2 dir = ( biteC - c ) / L;',
        '  vec2 perp = vec2( -dir.y, dir.x );',
        '  float horn = 1.0;',
        '  if ( h2 > 0.0 ) {',
        '    vec2 m = c + a * dir;',
        '    float h = sqrt( h2 );',
        '    horn = min( length( vUv - m - h * perp ), length( vUv - m + h * perp ) );',
        '  }',
        '  float sd;',
        '  if ( d1 <= 0.0 && d2 <= 0.0 ) sd = max( d1, d2 );',
        '  else if ( d1 > 0.0 ) sd = length( c + 0.25 * normalize( vUv - c ) - biteC ) >= biteR ? d1 : horn;',
        '  else sd = length( biteC + biteR * normalize( vUv - biteC ) - c ) <= 0.25 ? d2 : horn;',
        '  float aa = 0.006;',
        '  float inside = 1.0 - smoothstep( -aa, aa, sd );',
        '  float tone = mix( 0.831, 1.0, smoothstep( -0.04 - aa, -0.04 + aa, sd ) );',
        '  float halo = 0.32 * clamp( 1.0 - sd / 0.25, 0.0, 1.0 );',
        '  diffuseColor = vec4( diffuse * mix( 1.0, tone, inside ), opacity * mix( halo, 1.0, inside ) );',
        '  if ( diffuseColor.a < 0.004 ) discard;',
        '}'].join('\n');

    function trBiteShader(sh, p) {
        sh.uniforms.biteC = p.biteC;
        sh.uniforms.biteR = p.biteR;
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec2 biteC;\nuniform float biteR;')
            .replace('#include <alphatest_fragment>', BITE_FRAG);
    }

    function trUpdatePuffs(wdt0) {
        for (let i = 0; i < MAX_PUFFS; i++) {
            const p = tr.puffs[i];
            if (p.life <= 0) continue;
            const wdt = wdt0 * p.rate;
            const drag = Math.exp(-2 * wdt);
            if (p.delay > 0) { p.delay -= wdt; continue; }
            p.life -= wdt;
            if (p.life <= 0) { p.sp.visible = false; continue; }
            const f = 1 - p.life / p.max;               // 0 → 1 over the shape's life
            let r;
            if (p.curve === 1) r = p.r1 * Math.sin(Math.PI * f);
            else if (p.curve === 2) r = p.r0 + (p.r1 - p.r0) * f;
            else r = p.r0 + (p.r1 - p.r0) * (1 - (1 - f) * (1 - f));
            p.sp.position.addScaledVector(p.vel, wdt);
            p.vel.multiplyScalar(drag);
            p.sp.visible = tr.q.booms;
            p.sp.scale.setScalar(Math.max(0.001, r * 2 * HALO_K));
            p.sp.material.color.copy(p.c0).lerp(p.c1, f);
            p.sp.material.opacity = f < p.fade ? 1 : 1 - (f - p.fade) / (1 - p.fade);
            if (p.bite) p.biteR.value = !tr.q.bite ? 0 : BITE_R * Math.pow(clamp((f - BITE_AT) / (BITE_END - BITE_AT), 0, 1), 0.8);
        }
    }

    const jit = (r) => new THREE.Vector3(rand(-r, r), rand(-r, r), rand(-r, r));

    // [label, fn(at, R, dir, right, up)]. R is the fighter's size; dir its
    // heading; right and up span the screen, for shapes laid out flat to it.
    const BOOMS = [
        ['Circles', (at, R) => {
            trPuff({ at, c0: 0xfff8d8, c1: 0xffc04d, r0: 0.8 * R, r1: 2.2 * R, life: 0.45 });
            [[0xff9e2e, 0xbf3314], [0xff6a1f, 0x5a1a10], [0xf2d8a0, 0x4d4440]].forEach(([a, b], k) =>
                trPuff({ at, off: jit(0.55 * R), c0: a, c1: b, r0: 0.5 * R, r1: rand(1.4, 2) * R,
                    life: rand(0.4, 0.55) + k * 0.05, delay: (k + 1) * 0.06, order: k + 1 }));
            trShock(at, R);
        }],
        // Every circle starts white-hot or yellow and cools to a dark orange
        // as it grows; the later ones start cooler, so the cluster ages.
        ['White hot', (at, R) => {
            trPuff({ at, c0: 0xffffff, c1: 0xb84a12, r0: 0.7 * R, r1: 2.3 * R, life: 0.5 });
            [[0xfffbe0, 0xa8400f, 0.5], [0xfff2a0, 0x9a3a0c, 0.45], [0xffe680, 0x8a320a, 0.6]].forEach(([a, b, s], k) =>
                trPuff({ at, off: jit(0.6 * R), c0: a, c1: b, r0: s * R, r1: rand(1.3, 1.9) * R,
                    life: rand(0.45, 0.6) + k * 0.05, delay: (k + 1) * 0.05, order: k + 1 }));
            trShock(at, R);
        }],
        ['Bolt ring', (at, R) => {
            trPuff({ at, ring: true, add: true, c0: 0xa8f4ff, c1: 0x3fd2ff, r0: 0.2 * R, r1: 2.8 * R, life: 0.28, fade: 0.3 });
            trPuff({ at, add: true, c0: 0xf0ffff, c1: 0x3fd2ff, r0: 0.6 * R, r1: 1.2 * R, life: 0.18, order: 1 });
            for (let k = 0; k < 2; k++) {
                trPuff({ at, add: true, off: jit(0.7 * R), c0: 0x8fe8ff, c1: 0x2a8fd8, r0: 0.4 * R, r1: 0.9 * R, life: 0.3, delay: 0.05, order: 2 });
            }
        }],
        ['Ring and core', (at, R) => {
            trPuff({ at, curve: 'pop', c0: 0xfff6c8, c1: 0xffb040, r1: 1.6 * R, life: 0.35, fade: 1 });
            trPuff({ at, ring: true, add: true, c0: 0xffc060, c1: 0xff5a20, r0: 0.4 * R, r1: 3 * R, life: 0.45, delay: 0.03, order: 1 });
        }],
        ['Double ring', (at, R) => {
            trPuff({ at, curve: 'pop', c0: 0xffffff, c1: 0xbff4ff, r1: 0.8 * R, life: 0.2, fade: 1 });
            trPuff({ at, ring: true, add: true, c0: 0xa8f4ff, c1: 0x3fd2ff, r0: 0.2 * R, r1: 2.4 * R, life: 0.3, order: 1 });
            trPuff({ at, ring: true, add: true, c0: 0xffb060, c1: 0xff4a20, r0: 0.3 * R, r1: 3.4 * R, life: 0.5, delay: 0.1, order: 2 });
        }],
        ['Scatter', (at, R) => {
            trPuff({ at, curve: 'pop', c0: 0xffffff, c1: 0xffd080, r1: R, life: 0.2, fade: 1 });
            for (let k = 0; k < 7; k++) {
                trPuff({ at, vel: jit(1).normalize().multiplyScalar(rand(12, 20)), curve: 'shrink',
                    c0: k % 2 ? 0xffd040 : 0xff7a20, c1: 0xb02a10, r0: 0.55 * R, r1: 0.05 * R, life: rand(0.4, 0.6), order: 1 });
            }
        }],
        ['Flash and smoke', (at, R) => {
            trPuff({ at, add: true, c0: 0xffffff, c1: 0xffe0a0, r0: 1.2 * R, r1: 2.4 * R, life: 0.14, fade: 0.2 });
            for (let k = 0; k < 3; k++) {
                trPuff({ at, off: jit(0.5 * R), vel: jit(1.2).add(V1.set(0, 1.6, 0)), c0: 0x8a8580, c1: 0x3a3836,
                    r0: 0.6 * R, r1: rand(1.4, 1.8) * R, life: rand(0.9, 1.2), delay: 0.05 + k * 0.04, fade: 0.3, order: k + 1 });
            }
        }],
        ['Shockwave', (at, R) => {
            trPuff({ at, curve: 'pop', c0: 0xffd070, c1: 0xff5020, r1: 1.4 * R, life: 0.4, fade: 1, order: 1 });
            trShock(at, R);
        }],
        ['Chain', (at, R, dir) => {
            for (let k = 0; k < 3; k++) {
                const off = dir.clone().multiplyScalar(-k * 1.6 * R);
                trPuff({ at, off, curve: 'pop', c0: 0xfff0b0, c1: 0xff6020, r1: 1.3 * R, life: 0.3, delay: k * 0.12, fade: 1, order: k });
                trPuff({ at, off, ring: true, add: true, c0: 0xffc070, c1: 0xff4020, r0: 0.3 * R, r1: 1.8 * R, life: 0.3, delay: k * 0.12 });
            }
        }],
    ];

    // The shockwave: a thin blue-white ring that races out and is gone. Two
    // coincident copies, because additive blending of two is the only way
    // past the colour's own brightness.
    function trShock(at, R) {
        for (let k = 0; k < 2; k++) {
            trPuff({ at, ring: 'thin', add: true, c0: 0xffffff, c1: 0x8fb4ff, r0: 0.3 * R, r1: 5.5 * R, life: 0.3, fade: 0.4 });
        }
    }

    function trExplode(at, dir) {
        const m = tr.camera.matrixWorld;
        const right = new THREE.Vector3().setFromMatrixColumn(m, 0).normalize();
        const up = new THREE.Vector3().setFromMatrixColumn(m, 1).normalize();
        (BOOMS[tr.boom] || BOOMS[0])[1](at.clone(), 1.6 * SHIP_SCALE, dir.clone(), right, up);
    }

    // A rock crumbles: a pale flash and dusty discs, whatever the style.
    function trRockBoom(at, r, count) {
        trShock(at, 0.8 * r);
        trPuff({ at, c0: 0xffe6b0, c1: 0xcc7a33, r0: 0.6 * r, r1: 1.8 * r, life: 0.32 });
        const dust = [[0xc7a885, 0x524840], [0x9e8d78, 0x38332e]];
        for (let k = 1; k < count; k++) {
            const d = dust[k % 2];
            trPuff({ at, off: jit(0.5 * r), c0: d[0], c1: d[1], r0: 0.5 * r, r1: rand(1.2, 1.7) * r,
                life: rand(0.45, 0.6), delay: k * 0.05, order: k });
        }
    }

    /* ---- sound ------------------------------------------------------------
     * Synthesised, not sampled: nothing to fetch, nothing to decode. One
     * AudioContext, made on the Launch tap because browsers will not start
     * audio before a gesture. Nodes are made per sound — a few per second at
     * most — and are collected once they stop.
     */
    let AC = null, MASTER = null, NOISE = null;

    function trAudioUnlock(force) {
        if (!tr.sound && !force) return;
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

    // Each sound has a few versions to choose between in the debug panel.
    // The first of each is the default; 'Off' silences that one sound.
    const SFX = {
        zap: [['Laser', () => trTone('square', 1500, 240, 0.12, 0.06)],
            ['Pew', () => trTone('sine', 1300, 380, 0.15, 0.12)],
            ['Blip', () => trTone('triangle', 900, 860, 0.06, 0.12)],
            ['Thump', () => { trNoise(0.08, 0.25, 1800); trTone('sine', 220, 90, 0.1, 0.18); }],
            ['Off', null]],
        boom: [['Rumble', () => { trNoise(0.65, 0.55, 2600); trTone('sine', 150, 38, 0.5, 0.35); }],
            ['Crack', () => { trNoise(0.3, 0.6, 7000); trTone('square', 300, 60, 0.18, 0.08); }],
            ['Deep', () => { trNoise(1.0, 0.5, 900); trTone('sine', 90, 28, 0.8, 0.45); }],
            ['Arcade', () => { trTone('square', 440, 40, 0.4, 0.1); trNoise(0.35, 0.3, 3000); }],
            ['Off', null]],
        slow: [['Drop', () => trTone('sine', 440, 80, 0.55, 0.16)],
            ['Whoosh', () => trNoise(0.6, 0.25, 4000)],
            ['Tape stop', () => trTone('sawtooth', 320, 35, 0.7, 0.05)],
            ['Off', null]],
        right: [['Ding-ding', () => { trTone('triangle', 660, 660, 0.09, 0.14); trTone('triangle', 990, 990, 0.16, 0.14, 0.08); }],
            ['Chime', () => [784, 988, 1319].forEach((f, i) => trTone('triangle', f, f, 0.14, 0.12, i * 0.07))],
            ['Coin', () => { trTone('square', 988, 988, 0.07, 0.06); trTone('square', 1319, 1319, 0.22, 0.06, 0.07); }],
            ['Off', null]],
        miss: [['Buzz', () => trTone('sawtooth', 320, 130, 0.32, 0.06)],
            ['Bonk', () => trTone('sine', 210, 120, 0.22, 0.25)],
            ['Wah-wah', () => { trTone('triangle', 420, 300, 0.15, 0.12); trTone('triangle', 300, 180, 0.25, 0.12, 0.15); }],
            ['Off', null]],
        ace: [['Rise', () => trTone('triangle', 880, 1320, 0.2, 0.07)],
            ['Fanfare', () => { trTone('triangle', 660, 660, 0.1, 0.1); trTone('triangle', 990, 990, 0.22, 0.1, 0.1); }],
            ['Shimmer', () => [1320, 1568, 1760].forEach((f, i) => trTone('sine', f, f, 0.12, 0.07, i * 0.05))],
            ['Off', null]],
        done: [['Arpeggio', () => [523, 659, 784, 1047].forEach((f, i) => trTone('triangle', f, f, 0.2, 0.12, i * 0.11))],
            ['Fanfare', () => { trTone('triangle', 523, 523, 0.12, 0.12); trTone('triangle', 523, 523, 0.12, 0.12, 0.14); trTone('triangle', 784, 784, 0.45, 0.12, 0.28); }],
            ['Chord', () => [523, 659, 784].forEach((f) => trTone('triangle', f, f, 0.6, 0.08))],
            ['Off', null]],
        crack: [['Crunch', () => trNoise(0.3, 0.3, 1600)],
            ['Thud', () => { trNoise(0.2, 0.35, 600); trTone('sine', 120, 60, 0.2, 0.2); }],
            ['Glass', () => { trNoise(0.15, 0.25, 8000); trTone('triangle', 2000, 1500, 0.12, 0.05); }],
            ['Off', null]],
        pew: [['Saw', () => trTone('sawtooth', 900, 300, 0.1, 0.025)],
            ['Zip', () => trTone('square', 1800, 600, 0.07, 0.02)],
            ['Low pulse', () => trTone('sine', 500, 250, 0.12, 0.06)],
            ['Off', null]],
        hurt: [['Thud', () => { trNoise(0.4, 0.5, 700); trTone('sine', 90, 45, 0.35, 0.3); }],
            ['Static', () => trNoise(0.35, 0.35, 5000)],
            ['Alarm', () => { trTone('square', 880, 880, 0.08, 0.05); trTone('square', 660, 660, 0.1, 0.05, 0.1); }],
            ['Off', null]],
    };
    const SFX_LABEL = {
        zap: 'Turret shot', boom: 'Fighter explodes', crack: 'Rock breaks', pew: 'Enemy shot', hurt: 'Ship hit',
        slow: 'Lock / slow-mo', right: 'Right answer', miss: 'Wrong answer', ace: 'Ace arrives', done: 'Sortie done',
    };

    function trSfx(name) {
        if (!tr.sound || !AC || AC.state !== 'running') return;
        const list = SFX[name];
        if (!list) return;
        const v = list[tr.sfx[name] || 0] || list[0];
        if (v[1]) v[1]();
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

    /* ---- target boxes: DOM, one per fighter slot -------------------------
     * Sized to the fighter, so a near one gets a big box. Each box is written
     * only when it has moved half a pixel or changed size, and its label only
     * when the text changes — at most five small boxes, so no frame pays much.
     */
    function trBuildTargets() {
        const box = $('tr-tgts');
        box.textContent = '';
        tr.tgts = [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
            const el = trEl('div', 'tr-tgt hidden');
            const label = trEl('span', 'tr-tgt-label');
            el.append(trEl('i'), label);
            box.appendChild(el);
            tr.tgts.push({ el, label, x: -1, y: -1, s: 0, text: '', cls: '', shown: false });
        }
    }

    function trHideTargets() {
        for (const t of tr.tgts) if (t.shown) { t.el.classList.add('hidden'); t.shown = false; }
    }

    function trUpdateTargets() {
        const f = (tr.cssH / 2) / Math.tan(THREE.MathUtils.degToRad(tr.camera.fov / 2));
        const S = tr.sortie;
        const open = S && !S.finishing;
        let track = 0, near = Infinity;
        for (let i = 0; i < MAX_ENEMIES; i++) {
            const e = tr.foes[i], t = tr.tgts[i];
            let show = e && e.active && !e.locked && tr.wt >= e.t0;
            let dist = 0;
            if (show) {
                dist = e.pos.length();
                V3.copy(e.pos).applyMatrix4(tr.camera.matrixWorldInverse);
                show = dist < SIGHT && V3.z < -1;
            }
            if (show) {
                V2.copy(e.pos).project(tr.camera);
                show = Math.abs(V2.x) < 1.05 && Math.abs(V2.y) < 1.05;
            }
            if (!show) {
                if (t.shown) { t.el.classList.add('hidden'); t.shown = false; }
                continue;
            }
            track++;
            if (dist < near) near = dist;
            const x = (V2.x + 1) / 2 * tr.cssW, y = (1 - V2.y) / 2 * tr.cssH;
            const size = 2 * Math.round(trBoxHalf(-V3.z, tr.cssH));
            if (!t.shown) { t.el.classList.remove('hidden'); t.shown = true; }
            if (size !== t.s) { t.s = size; t.el.style.width = t.el.style.height = size + 'px'; t.x = -1; }
            if (Math.abs(x - t.x) > 0.5 || Math.abs(y - t.y) > 0.5) {
                t.x = x; t.y = y;
                t.el.style.transform = 'translate(' + (x - size / 2).toFixed(1) + 'px,' + (y - size / 2).toFixed(1) + 'px)';
            }
            // Dim is not lockable: no sortie, or a plain fighter with the deck spent.
            const cls = e.ace ? 'tr-tgt-ace' : !open || !tr.deck.length ? 'tr-tgt-dim' : '';
            if (cls !== t.cls) {
                t.el.classList.remove('tr-tgt-ace', 'tr-tgt-dim');
                if (cls) t.el.classList.add(cls);
                t.cls = cls;
            }
            const text = e.tag + ' ' + Math.round(dist * 2) * 5 + 'm';
            if (text !== t.text) { t.text = text; t.label.textContent = text; }
        }
        tr.track = track;
        tr.near = near;
    }

    // Where the tap landed. The shot goes there, so the mark is the aim point.
    function trTapMark(x, y, w) {
        const el = $('tr-tap');
        el.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)';
        if (tr.dbgOpen) el.style.setProperty('--r', Math.max(2, tr.nearPx) + 'px');
        el.classList.remove('tr-on');
        void el.offsetWidth;
        el.classList.add('tr-on');
    }

    /* ---- readouts: filler that moves --------------------------------------
     * A heading and an elevation from the pilot's flying, how many contacts
     * are boxed and how far the nearest is, and a deflector number that dips
     * on a hit and recovers. Twice a second, and only changed text is written.
     */
    function trSetText(id, text) {
        const el = $(id);
        if (el.textContent !== text) el.textContent = text;
    }

    function trUpdateHudText(dt) {
        tr.deflector = Math.min(100, tr.deflector + DEFLECTOR_REGEN * dt);
        tr.hudLeft -= dt;
        if (tr.hudLeft > 0) return;
        tr.hudLeft = 0.5;
        // The ship's heading in the sky's frame: the sky holds the inverse of
        // every turn, so undo it on the forward axis.
        DQ.copy(tr.sky.quaternion).invert();
        V1.set(0, 0, -1).applyQuaternion(DQ);
        const hdg = (Math.round(THREE.MathUtils.radToDeg(Math.atan2(-V1.x, -V1.z))) + 360) % 360;
        const elv = Math.round(THREE.MathUtils.radToDeg(Math.asin(clamp(V1.y, -1, 1))));
        trSetText('tr-ro-hdg', 'HDG ' + String(hdg).padStart(3, '0'));
        trSetText('tr-ro-elv', 'ELV ' + (elv >= 0 ? '+' : '') + elv);
        trSetText('tr-ro-trk', 'TRK ' + tr.track);
        trSetText('tr-ro-rng', 'RNG ' + (tr.track ? Math.round(tr.near * 2) * 5 : '----'));
        const d = Math.round(tr.deflector);
        trSetText('tr-ro-dfl', 'DEFL ' + d + '%');
        $('tr-ro-dfl').classList.toggle('tr-ro-low', d < 80);
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

    const T_FLASH = () => !!(tr.muzzleLight && tr.muzzleLight.visible);

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
            + size.x + '×' + size.y + ' (' + TIERS[tr.tier].label + (tr.auto ? ', auto' : '')
            + (tr.shiny ? ', shiny' : ', matte') + (T_FLASH() ? ', muzzle light' : '') + ')';
        $('tr-probe-fps').classList.toggle('tr-bad', s.p95 > budget * 1.35);
    }

    /* ---- benchmark ---------------------------------------------------------
     * About two minutes of trying one setting at a time, for a device whose
     * numbers cannot be sent anywhere: the report is on the screen, and the
     * last one is kept under nq.turret.bench.
     *
     * The world is held still (trUpdate's wdt is 0) on a busy tableau — every
     * fighter in view, a full rock field, explosions mid-bloom, bolts in the
     * air — so every trial draws the same frame and a difference is the
     * setting's. The frame cap is off. Each frame is timed three ways:
     *   frame  rAF to rAF: what the player feels, DOM layers and all, but
     *          snapped to the screen's refresh
     *   draw   render() plus a one-pixel readback, which waits for the GPU to
     *          finish the frame: the 3D cost, not snapped to anything
     *   js     the update
     * A trial waits BENCH_SETTLE and ten frames after its change — shader
     * compiles and buffer reallocations land there — then takes medians over
     * BENCH_MEASURE. Each cost is measured against the runs of the whole
     * setting on either side of it, interpolated, so a device slowing as it
     * warms up is read as drift, not as a cost.
     */
    const BENCH_SETTLE = 700, BENCH_MEASURE = 2000, BENCH_LONGEST = 8000, BENCH_N = 600;
    // [knob, label, value when off]. Rock detail "off" is the coarsest.
    const BENCH_KNOBS = [
        ['enemies', 'Fighters', 0], ['shiny', 'Shiny fighters (Phong)', false], ['thrustLight', 'Thruster lights', false],
        ['flashLight', 'Muzzle light', false], ['rocks', 'Rocks', 0], ['rockDetail', 'Rock detail (720 → 180 faces)', 2],
        ['stars', 'Stars', 0], ['nebulae', 'Nebulae', false], ['sun', 'Sun and halo', false],
        ['booms', 'Explosions', false], ['bite', 'Bite maths in explosions', false], ['points', 'Bolts and engine glows', false],
        ['guns', 'Guns', false], ['glass', 'Window grime (3 canvases)', false], ['frame', 'Cockpit frame (SVG)', false],
        ['hud', 'Readouts and target boxes', false],
    ];
    const BENCH_DOM = ['glass', 'frame', 'hud'];

    function trBenchPlan() {
        const full = Object.assign({}, KNOBS, TIERS.high), low = Object.assign({}, KNOBS, TIERS.low);
        const bare = Object.assign({}, full);
        BENCH_KNOBS.forEach(([k, , off]) => { bare[k] = off; });
        const plan = [];
        const add = (group, label, q, knob) => plan.push({ group, label, q, knob: knob || '' });
        const without = (base, k, off) => { const q = Object.assign({}, base); q[k] = off; return q; };
        add('base', 'High, everything', full);
        BENCH_KNOBS.forEach(([k, label, off]) => add('high', label, without(full, k, off), k));
        add('base', 'High, everything', full);
        [0.5, 0.6, 0.75, 0.9].forEach((s) => add('scale', Math.round(s * 100) + '%', without(full, 'scale', s)));
        add('tier', 'Medium', Object.assign({}, KNOBS, TIERS.med));
        add('lowbase', 'Low, everything', low);
        // Only what Low has to switch off.
        BENCH_KNOBS.forEach(([k, label, off]) => { if (low[k] !== off) add('low', label, without(low, k, off), k); });
        add('lowbase', 'Low, everything', low);
        add('tier', 'Sky colour only', bare);
        add('base', 'High, everything', full);
        return plan;
    }

    // A ray from the camera through a point on screen (NDC), `d` units out.
    function trBenchAt(nx, ny, d, out) {
        V1.set(nx, ny, 0.5).unproject(tr.camera).sub(tr.camera.getWorldPosition(V3)).normalize();
        return out.copy(V3).addScaledVector(V1, d);
    }

    function trBenchClear() {
        tr.foes.forEach((e) => { e.active = false; e.locked = false; e.ace = null; });
        tr.rocks.forEach((r) => { r.active = false; });
        tr.bolts.forEach((b) => { b.active = false; });
        tr.zaps.forEach((z) => { z.active = false; });
        tr.puffs.forEach((p) => { p.life = 0; p.sp.visible = false; });
        tr.lockFoe = null;
    }

    // The tableau. Made once per run; trials only show or hide parts of it.
    function trBenchStage(B) {
        trBenchClear();
        tr.spawnAt = tr.rockAt = Infinity;
        tr.hurtAge = 9;
        tr.shake = 0;
        tr.mouse = null;
        tr.camera.position.set(0, 0, 0);
        tr.yaw = tr.aimYaw = 0;
        tr.pitch = tr.aimPitch = 0.12;
        tr.camera.rotation.set(tr.pitch, tr.yaw, 0);
        tr.scene.updateMatrixWorld();
        const seen = [];
        // Fighters on real paths, each frozen at a moment it is in view and
        // not on top of another.
        const kinds = tr.shipMeshes.length;
        for (let tries = 0; B.foes.length < MAX_ENEMIES && tries < 80; tries++) {
            const path = trSafePath(false), e = tr.foes.find((x) => !x.active);
            if (!path || !e) continue;
            trSpawnFoe(path, 0, null, null, kinds > 1 ? 1 + (B.foes.length % (kinds - 1)) : 0);
            e.strafe = null;
            let found = -1;
            for (let i = 4; i <= 36 && found < 0; i++) {
                const t = e.dur * i / 40;
                trPathAt(e, e.t0 + t, V4);
                const d = V4.length();
                V2.copy(V4).project(tr.camera);
                if (d < 22 || d > 75 || V2.z > 1 || Math.abs(V2.x) > 0.75 || Math.abs(V2.y) > 0.7) continue;
                if (seen.some(([x, y]) => Math.hypot(x - V2.x, y - V2.y) < 0.3)) continue;
                found = t;
                seen.push([V2.x, V2.y]);
            }
            if (found < 0) { e.active = false; continue; }
            e.t0 = tr.wt - found;
            B.foes.push(e);
        }
        for (let i = 0; i < TIERS.high.rocks; i++) {
            const r = trRock();
            if (!r) break;
            trBenchAt(rand(-0.9, 0.9), rand(-0.75, 0.75), rand(22, 100), r.pos);
            r.size = rand(1.5, 5);
            B.rocks.push(r);
        }
        // Explosions a few frames apart, so they are at different stages.
        const rate = tr.boomRate;
        tr.boomRate = 1;
        for (let k = 0; k < 4; k++) {
            trBenchAt(rand(-0.6, 0.6), rand(-0.5, 0.5), rand(28, 55), V5);
            trExplode(V5, V1);
            trUpdatePuffs(0.05);
        }
        for (let k = 0; k < 2; k++) {
            trRockBoom(trBenchAt(rand(-0.7, 0.7), rand(-0.6, 0.6), rand(25, 50), V5), rand(2, 4), 3);
            trUpdatePuffs(0.04);
        }
        trUpdatePuffs(0.06);
        tr.boomRate = rate;
        // Bolts part-way out, and enemy fire part-way in.
        for (let k = 0; k < 8; k++) {
            const from = trGunTip(tr.guns[k % 2], V5);
            const b = trSpawnBolt(from, trBenchAt(rand(-0.7, 0.7), rand(-0.5, 0.6), 150, V6), tr.wt + 1, null);
            if (!b) break;
            const u = rand(0.05, 0.6);
            b.t0 = tr.wt - u;
            b.t1 = tr.wt + 1 - u;
        }
        B.foes.forEach((e, k) => {
            const z = tr.zaps[k];
            const u = rand(0.1, 0.7);
            trPathAt(e, tr.wt, z.from);
            z.to.set(rand(-9, 9), rand(-5, 7), 6);
            z.hit = false;
            z.t0 = tr.wt - u;
            z.t1 = tr.wt + 1 - u;
            z.active = true;
        });
        // The muzzle light held on, where it is when a shot has just gone.
        trGunTip(tr.guns[0], tr.muzzleLight.position);
        tr.muzzleK = 0;
        tr.muzzleLight.intensity = MUZZLE_I * 0.5;
    }

    function trBenchStart() {
        if (tr.bench || !tr.renderer || !tr.running) return;
        if (tr.sortie || tr.ask) {
            trBenchShow({ note: 'End the sortie first: the benchmark clears the sky.', results: [] });
            return;
        }
        trSetDebugOpen(false);
        const gl = tr.renderer.getContext();
        const B = tr.bench = {
            plan: trBenchPlan(), i: -1, t0: 0, m0: 0, frames: 0, n: 0, started: performance.now(),
            iv: new Float32Array(BENCH_N), js: new Float32Array(BENCH_N), draw: new Float32Array(BENCH_N),
            px: new Uint8Array(4), gl, results: [], foes: [], rocks: [], hidden: [], over: tr.qOver, device: trBenchDevice(gl),
        };
        ['tr-brief', 'tr-debrief', 'tr-probe'].forEach((id) => {
            const el = $(id);
            if (!el.classList.contains('hidden')) { el.classList.add('hidden'); B.hidden.push(el); }
        });
        trBenchStage(B);
        const box = $('tr-bench');
        box.textContent = '';
        box.className = 'tr-bench tr-bench-run';
        const text = trEl('span', 'tr-bench-prog');
        text.id = 'tr-bench-prog';
        const stop = trEl('button', 'tr-chip', 'Stop');
        stop.dataset.trBenchAct = 'stop';
        box.append(text, stop);
        trBenchNext();
    }

    function trBenchNext() {
        const B = tr.bench;
        B.i++;
        if (B.i >= B.plan.length) { trBenchEnd(''); return; }
        const P = B.plan[B.i];
        tr.qOver = P.q;
        trApplyTier();
        B.foes.forEach((e, k) => { e.active = k < tr.q.enemies; });
        B.rocks.forEach((r, k) => { r.active = k < tr.q.rocks; });
        B.t0 = performance.now();
        B.m0 = 0;
        B.frames = B.n = 0;
        const left = B.i ? (B.t0 - B.started) / B.i * (B.plan.length - B.i) / 1000 : B.plan.length * (BENCH_SETTLE + BENCH_MEASURE) / 1000;
        const lc = P.label.charAt(0).toLowerCase() + P.label.slice(1);
        const what = P.group === 'high' ? 'High without ' + lc
            : P.group === 'low' ? 'Low without ' + lc
            : P.group === 'scale' ? 'High at ' + P.label + ' resolution' : P.label;
        $('tr-bench-prog').textContent = 'Benchmark ' + (B.i + 1) + '/' + B.plan.length + ' · ' + what + ' · about '
            + Math.floor(left / 60) + ':' + String(Math.round(left % 60)).padStart(2, '0') + ' left';
    }

    function trMedian(a, n) {
        const s = Float32Array.from(a.subarray(0, n)).sort();
        return n ? s[n >> 1] : 0;
    }

    function trBenchFrame(now) {
        const B = tr.bench, gl = B.gl;
        const gap = now - tr.last;
        tr.last = now;
        const t0 = performance.now();
        trUpdate(Math.min(gap / 1000, 0.1));
        const t1 = performance.now();
        tr.renderer.render(tr.scene, tr.camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, B.px);
        const t2 = performance.now();
        B.frames++;
        if (t2 - B.t0 < BENCH_SETTLE || B.frames <= 10) return;
        if (!B.m0) B.m0 = t2;
        // A quarter-second gap is the browser throttling the page, not a frame.
        if (gap < 250 && B.n < BENCH_N) {
            B.iv[B.n] = gap; B.js[B.n] = t1 - t0; B.draw[B.n] = t2 - t1;
            B.n++;
        }
        const done = (t2 - B.m0 >= BENCH_MEASURE && B.n >= 10) || B.n >= BENCH_N || (t2 - B.t0 > BENCH_LONGEST && B.n >= 3);
        if (!done) return;
        const P = B.plan[B.i];
        // Frame is a mean: each interval is a whole number of refreshes, and
        // only the mix of one-refresh and two-refresh frames shows a cost
        // smaller than a refresh. Draw and js are medians, past compile hitches.
        let sum = 0;
        for (let i = 0; i < B.n; i++) sum += B.iv[i];
        B.results.push({ group: P.group, label: P.label, knob: P.knob, n: B.n,
            frame: sum / B.n, draw: trMedian(B.draw, B.n), js: trMedian(B.js, B.n) });
        trBenchNext();
    }

    function trBenchEnd(note) {
        const B = tr.bench;
        if (!B) return;
        tr.bench = null;
        tr.qOver = B.over;
        B.hidden.forEach((el) => el.classList.remove('hidden'));
        if (tr.foes.length) trBenchClear();
        tr.spawnAt = tr.rockAt = tr.wt + 1;
        if (tr.muzzleLight) tr.muzzleLight.intensity = 0;
        trApplyTier();
        tr.last = performance.now();
        const rep = { at: Date.now(), note, device: B.device, results: B.results };
        if (B.results.length) stSetJSON('turret.bench', rep);
        trBenchShow(rep);
    }

    function trBenchDevice(gl) {
        let gpu = '';
        try {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        } catch (err) { /* not told */ }
        return { gpu, webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
            css: [tr.cssW, tr.cssH], dpr: window.devicePixelRatio || 1, ua: navigator.userAgent };
    }

    /* The report, as sections of lines and rows, so the screen and the Copy
     * button say the same thing. A cost is the setting's run subtracted from
     * the whole setting's runs either side of it, weighted by position; `noise`
     * is half their disagreement, or 3%, whichever is more. */
    function trBenchReport(rep) {
        const R = rep.results;
        const out = { lines: [], tables: [] };
        const f1 = (v) => v.toFixed(1);
        const sg = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1);
        const fps = (ms) => Math.round(1000 / ms);
        const D = rep.device || {};
        out.lines.push((D.gpu || 'GPU not reported') + (D.webgl2 ? ' · WebGL2' : ' · WebGL1'));
        if (D.css) out.lines.push('Stage ' + D.css[0] + '×' + D.css[1] + ' CSS px at ' + D.dpr + '× · drawn at '
            + D.css[0] + '×' + D.css[1] + ' on High');
        if (!R.length) return out;

        const around = (i, group) => {
            let a = -1, b = -1;
            for (let j = i - 1; j >= 0 && a < 0; j--) if (R[j].group === group) a = j;
            for (let j = i + 1; j < R.length && b < 0; j++) if (R[j].group === group) b = j;
            if (a < 0 && b < 0) return null;
            if (a < 0) a = b;
            if (b < 0) b = a;
            const w = a === b ? 0 : (i - a) / (b - a);
            const at = (k) => R[a][k] + (R[b][k] - R[a][k]) * w;
            const half = (k) => Math.abs(R[b][k] - R[a][k]) / 2;
            return { draw: at('draw'), frame: at('frame'), js: at('js'),
                nd: Math.max(half('draw'), 0.03 * at('draw'), 0.1), nf: Math.max(half('frame'), 0.03 * at('frame'), 0.1) };
        };
        const costs = (group, baseGroup) => R.map((r, i) => {
            if (r.group !== group) return null;
            const b = around(i, baseGroup);
            if (!b) return null;
            // The DOM layers cost in compositing, which draw cannot see, so
            // they are judged by frame; everything else by draw, which is not
            // snapped to the refresh.
            const draw = b.draw - r.draw, frame = b.frame - r.frame;
            const dom = BENCH_DOM.indexOf(r.knob) >= 0;
            const rank = dom ? frame : draw;
            return { knob: r.knob, label: r.label, draw, frame, rank, real: rank > (dom ? b.nf : b.nd),
                share: clamp(rank / (dom ? b.frame : b.draw), 0, 1) };
        }).filter(Boolean).sort((x, y) => y.rank - x.rank);

        const named = (group) => R.filter((r) => r.group === group);
        const avg = (list, k) => list.reduce((s, r) => s + r[k], 0) / list.length;
        const base = named('base'), low = named('lowbase');
        const summary = (label, list) => {
            if (!list.length) return;
            out.lines.push(label + ': frame ' + f1(avg(list, 'frame')) + ' ms (' + fps(avg(list, 'frame')) + ' fps) · draw '
                + f1(avg(list, 'draw')) + ' · js ' + f1(avg(list, 'js')));
        };
        summary('High', base);
        summary('Medium', R.filter((r) => r.label === 'Medium'));
        summary('Low', low);
        summary('Sky only', R.filter((r) => r.label === 'Sky colour only'));
        const fastest = Math.min.apply(null, R.map((r) => r.frame));
        out.lines.push('Fastest frame seen ' + f1(fastest) + ' ms (' + fps(fastest) + ' fps): probably the screen\'s refresh, the floor every frame time sits on');

        const high = costs('high', 'base'), lowC = costs('low', 'lowbase');
        const top = high.filter((c) => c.real).slice(0, 3);
        if (top.length) out.lines.push('Costliest on High: ' + top.map((c) => c.label + ' (' + sg(c.rank) + ' ms)').join(', '));
        const dom = high.filter((c) => BENCH_DOM.indexOf(c.knob) >= 0);
        if (dom.length) {
            const f = dom.reduce((s, c) => s + Math.max(0, c.frame), 0), d = dom.reduce((s, c) => s + Math.max(0, c.draw), 0);
            out.lines.push('The layers over the canvas (grime, frame, HUD) together: ' + sg(f) + ' ms frame, ' + sg(d) + ' ms draw');
        }
        if (base.length) {
            const js = avg(base, 'js'), draw = avg(base, 'draw');
            out.lines.push(js < draw * 0.3 ? 'Script is ' + f1(js) + ' ms against ' + f1(draw) + ' ms of drawing: the GPU is the limit'
                : 'Script is ' + f1(js) + ' ms against ' + f1(draw) + ' ms of drawing: the CPU matters here too');
        }
        if (base.length > 1) {
            const a = base[0].draw, z = base[base.length - 1].draw;
            if (Math.abs(z - a) > Math.max(0.1 * a, 0.3)) out.lines.push('Drew ' + Math.round(Math.abs(z / a - 1) * 100) + '% ' + (z > a ? 'slower' : 'faster')
                + ' at the end than the start (' + f1(a) + ' → ' + f1(z) + ' ms) — heat, probably; small costs are uncertain');
        }
        if (rep.note) out.lines.push(rep.note);

        const table = (title, list) => {
            if (list.length) out.tables.push({ title, cols: ['draw', 'frame'],
                rows: list.map((c) => ({ label: c.label, a: sg(c.draw), b: sg(c.frame), share: c.share, dim: !c.real })) });
        };
        table('On High, switching each off saves (ms)', high);
        table('On Low, switching each off saves (ms)', lowC);
        const scale = R.filter((r) => r.group === 'scale');
        if (scale.length) {
            const rows = scale.concat(base.length ? [{ label: '100%', draw: avg(base, 'draw'), frame: avg(base, 'frame') }] : []);
            const top = Math.max.apply(null, rows.map((r) => r.draw));
            out.tables.push({ title: 'Resolution on High (ms)', cols: ['draw', 'frame'],
                rows: rows.map((r) => ({ label: r.label, a: f1(r.draw), b: f1(r.frame), share: r.draw / top, dim: false })) });
        }
        out.foot = 'draw: render plus a GPU readback, not snapped to the refresh. frame: mean time from one frame to the next, '
            + 'everything included, built of whole refreshes. Rows are sorted by draw, except the grime, frame and HUD, which '
            + 'are DOM layers and sorted by frame — draw cannot see them. Grey: within the noise between repeated runs. The '
            + 'scene is held still, so things that cost by moving (the target boxes) read low.';
        return out;
    }

    function trBenchText(rep) {
        const r = trBenchReport(rep);
        const lines = ['Turret benchmark · ' + new Date(rep.at || Date.now()).toLocaleString()].concat(r.lines);
        r.tables.forEach((t) => {
            lines.push('', t.title + '   ' + t.cols.join(' / '));
            t.rows.forEach((row) => lines.push('  ' + row.label.padEnd(30) + row.a.padStart(7) + row.b.padStart(7) + (row.dim ? '  ~' : '')));
        });
        if (r.foot) lines.push('', r.foot);
        return lines.join('\n');
    }

    function trBenchShow(rep) {
        tr.benchRep = rep;
        const box = $('tr-bench');
        box.textContent = '';
        box.className = 'tr-bench';
        const card = box.appendChild(trEl('div', 'tr-bench-card'));
        const r = trBenchReport(rep);
        card.appendChild(trEl('div', 'tr-bench-title', 'Benchmark'
            + (rep.results.length ? ' · ' + new Date(rep.at).toLocaleString() : '')));
        if (!rep.results.length && rep.note) card.appendChild(trEl('div', 'tr-bench-line', rep.note));
        else r.lines.forEach((l) => card.appendChild(trEl('div', 'tr-bench-line', l)));
        r.tables.forEach((t) => {
            card.appendChild(trEl('div', 'tr-bench-h', t.title));
            const tbl = card.appendChild(trEl('table', 'tr-bench-t'));
            const head = tbl.appendChild(trEl('tr'));
            head.append(trEl('th'), trEl('th', null, t.cols[0]), trEl('th', null, t.cols[1]), trEl('th'));
            t.rows.forEach((row) => {
                const line = tbl.appendChild(trEl('tr', row.dim ? 'tr-bench-dim' : ''));
                const bar = trEl('i');
                bar.style.width = Math.round(clamp(row.share, 0, 1) * 100) + '%';
                const cell = trEl('td', 'tr-bench-bar');
                cell.appendChild(bar);
                line.append(trEl('td', null, row.label), trEl('td', 'tr-bench-n', row.a), trEl('td', 'tr-bench-n', row.b), cell);
            });
        });
        if (r.foot && rep.results.length) card.appendChild(trEl('div', 'tr-bench-foot', r.foot));
        const acts = card.appendChild(trEl('div', 'tr-card-actions'));
        [['Run again', 'again'], ['Copy', 'copy'], ['Close', 'close']].forEach(([label, act]) => {
            const b = acts.appendChild(trEl('button', 'tr-chip', label));
            b.dataset.trBenchAct = act;
        });
    }

    function trBenchClick(e) {
        const b = e.target.closest('[data-tr-bench-act]');
        if (!b) return;
        const act = b.dataset.trBenchAct;
        if (act === 'stop') trBenchEnd('Stopped part-way: costs are from the trials that finished.');
        else if (act === 'again') { $('tr-bench').className = 'tr-bench hidden'; trBenchStart(); }
        else if (act === 'close') $('tr-bench').className = 'tr-bench hidden';
        else if (act === 'copy' && tr.benchRep) {
            const text = trBenchText(tr.benchRep);
            const done = () => { b.textContent = 'Copied'; };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { b.textContent = 'Copy failed'; });
        }
    }

    /* ---- window grime and the hit flash ------------------------------------
     * Three canvases on the glass, between the 3D view and the cockpit frame
     * — over the guns and the scene, under every piece of HUD — all cut by
     * one stencil: the window shape, shrunk toward its centre by `reach` and
     * blurred by `fade`, erases the middle and fades in toward the edges.
     *
     *   #tr-grime       the texture in the grime colour
     *   #tr-grime-hurt  the same grime in the hit colour
     *   #tr-hurt        a solid wash of the hit colour, no texture
     *
     * All three are baked only on a resize or a settings change. A frame
     * writes opacities, and only those that moved: the grime by how squarely
     * the turret faces the sun; on a hit, the grime crossfades to its hit
     * twin while the wash flashes — a smooth colour change, no re-bake.
     */
    const WINDOW = [[260, 90], [1340, 90], [1520, 300], [1520, 760], [1380, 900], [220, 900], [80, 760], [80, 300]];
    const GRIME_SCALE = 0.5;                // baked at half the stage's size; it is soft anyway
    const GLASS = ['tr-grime', 'tr-grime-hurt', 'tr-hurt'];

    function trLoadGrime() {
        if (tr.grimeImg) return;
        const img = new Image();
        img.onload = () => { tr.grimeImg = img; trBakeGrime(); };
        img.src = 'textures/window-grime.png?v=' + (window.ASSET_V || '1');
    }

    // The window's outline in canvas pixels — stretched to the canvas as the
    // frame SVG is — moved in by `d` pixels square to every edge. The window
    // is convex and wound clockwise on screen, so each edge's inward normal
    // is its direction turned a right angle clockwise, and each new corner is
    // where two neighbouring moved edges cross.
    function trInsetWindow(W, H, d) {
        const P = WINDOW.map((p) => [p[0] / 1600 * W, p[1] / 1000 * H]);
        const n = P.length, L = [];
        for (let i = 0; i < n; i++) {
            const a = P[i], b = P[(i + 1) % n];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;
            L.push([a[0] - ty * d, a[1] + tx * d, tx, ty]);
        }
        return L.map((B, i) => {
            const A = L[(i + n - 1) % n];
            const s = ((B[0] - A[0]) * B[3] - (B[1] - A[1]) * B[2]) / (A[2] * B[3] - A[3] * B[2]);
            return [A[0] + A[2] * s, A[1] + A[3] * s];
        });
    }

    // Erase the middle of a canvas: the stencil. Reach and fade are both
    // fractions of the canvas's SHORT side, the same distance in from every
    // edge, so the shape keeps its border at any aspect ratio.
    function trCutCentre(g, W, H) {
        const U = Math.min(W, H);
        // Never past the middle: the window's inside is about 0.81 H tall.
        const d = Math.min(tr.grime.inset * U, 0.38 * Math.min(W * 0.9, H * 0.81));
        const blur = Math.round(U * tr.grime.soft);
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        if ('filter' in g) {
            if (blur) g.filter = 'blur(' + blur + 'px)';
            g.beginPath();
            trInsetWindow(W, H, d).forEach((p, i) => { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
            g.closePath();
            g.fill();
            g.filter = 'none';
        } else {
            // No canvas filters: an ellipse fading out does the same job, a
            // little less faithfully to the window's corners.
            const rx = W * 0.45 - d + blur, ry = H * 0.405 - d + blur;
            g.save();
            g.translate(W / 2, H * 0.495);
            g.scale(rx, ry);
            const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
            const solid = clamp(1 - (2 * blur) / Math.max(1, Math.min(rx, ry)), 0, 0.99);
            rg.addColorStop(0, 'rgba(0,0,0,1)');
            rg.addColorStop(solid, 'rgba(0,0,0,1)');
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = rg;
            g.fillRect(-1, -1, 2, 2);
            g.restore();
        }
        g.globalCompositeOperation = 'source-over';
    }

    function trTint(g, W, H, color) {
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
    }

    function trBakeGrime() {
        if (!tr.cssW) return;
        const W = Math.max(1, Math.round(tr.cssW * GRIME_SCALE)), H = Math.max(1, Math.round(tr.cssH * GRIME_SCALE));
        const [grime, twin, wash] = GLASS.map((id) => $(id));
        [grime, twin, wash].forEach((cv) => { cv.width = W; cv.height = H; });
        tr.grimeW = tr.cssW; tr.grimeH = tr.cssH;

        // The wash needs no texture, so a hit flashes even before it loads.
        let g = wash.getContext('2d');
        g.fillStyle = tr.grime.hurt;
        g.fillRect(0, 0, W, H);
        trCutCentre(g, W, H);

        const img = tr.grimeImg;
        g = grime.getContext('2d');
        g.clearRect(0, 0, W, H);
        if (img) {
            // Cover, as background-size: cover would — turned a quarter on a
            // portrait stage, so a landscape texture is not cropped to a strip.
            const turn = H > W;
            const iw = turn ? img.height : img.width, ih = turn ? img.width : img.height;
            const k = Math.max(W / iw, H / ih);
            g.save();
            g.translate(W / 2, H / 2);
            if (turn) g.rotate(Math.PI / 2);
            g.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k);
            g.restore();
            trCutCentre(g, W, H);
            const t = twin.getContext('2d');
            t.clearRect(0, 0, W, H);
            t.drawImage(grime, 0, 0);
            trTint(t, W, H, tr.grime.hurt);
            trTint(g, W, H, tr.grime.color);
        }
        tr.glassOp = [-1, -1, -1];
    }

    // The hit envelope: up fast, down smoothly, scaled by how hard the hit was.
    function trHurtLevel() {
        const a = tr.hurtAge;
        if (a >= HURT_IN + HURT_OUT) return 0;
        const e = a < HURT_IN ? a / HURT_IN : 1 - (a - HURT_IN) / HURT_OUT;
        return tr.hurtK * e * (2 - e);                  // eased, so it leaves gently
    }

    function trSetGlass(i, op) {
        if (Math.abs(op - tr.glassOp[i]) < 0.01 && !(op === 0 && tr.glassOp[i] !== 0)) return;
        tr.glassOp[i] = op;
        $(GLASS[i]).style.opacity = op.toFixed(3);
    }

    function trUpdateGlass(dt) {
        if (tr.cssW !== tr.grimeW || tr.cssH !== tr.grimeH) trBakeGrime();
        tr.hurtAge += dt;
        const h = trHurtLevel();
        let base = 0;
        if (tr.grime.on && tr.grimeImg) {
            // The turret's forward against the sun: dead on is `max`, side-on
            // or behind is `min`. Squared, so it builds as the sun comes
            // round into the window rather than all at once.
            V1.set(0, 0, -1).transformDirection(tr.camera.matrixWorld);
            V2.copy(tr.sun.position).normalize();
            const k = Math.max(0, V1.dot(V2));
            base = tr.grime.min + (tr.grime.max - tr.grime.min) * k * k;
        }
        const lit = tr.grime.on && tr.grimeImg ? Math.max(base, 0.5) : 0;
        trSetGlass(0, base * (1 - h));
        trSetGlass(1, lit * h);
        trSetGlass(2, 0.7 * h);
    }

    /* ---- debug overlay ----------------------------------------------------
     * For tuning, not for the child, in collapsible categories: combat (lock
     * distance, bolt speeds), look (explosion style, grime, stencil, hit
     * colour), a version of every sound, buttons that make things happen
     * now, and the frame-time readout. Choices, and which categories are
     * open, are kept under nq.turret.debug.
     */
    function trDbgBtn(text, act, cls) {
        const b = trEl('button', 'tr-chip' + (cls ? ' ' + cls : ''), text);
        b.dataset.trDbgAct = act;
        return b;
    }

    // Sliders, by key: [label, min, max, step, get, set, format, rebake].
    const DBG_SLIDERS = {
        near: ['Lock distance', NEAR_MIN, NEAR_MAX, 4, () => tr.nearPx, (v) => { tr.nearPx = v; }, (v) => v + ' px'],
        bolt: ['Turret bolts', 30, 300, 10, () => tr.boltSpeed, (v) => { tr.boltSpeed = v; }, (v) => v + ' u/s'],
        zap: ['Enemy bolts', 20, 200, 5, () => tr.zapSpeed, (v) => { tr.zapSpeed = v; }, (v) => v + ' u/s'],
        reach: ['Reach', 2, 50, 1, () => Math.round(tr.grime.inset * 100), (v) => { tr.grime.inset = v / 100; }, (v) => v + '%', true],
        fade: ['Fade', 0, 30, 1, () => Math.round(tr.grime.soft * 100), (v) => { tr.grime.soft = v / 100; }, (v) => v + '%', true],
        boomRate: ['Speed', 5, 100, 5, () => Math.round(tr.boomRate * 100), (v) => { tr.boomRate = v / 100; }, (v) => (v / 100).toFixed(2) + '×'],
        guard: ['Answer guard', 0, 1000, 50, () => Math.round(tr.askGuard * 1000), (v) => { tr.askGuard = v / 1000; }, (v) => (v / 1000).toFixed(2) + ' s'],
        squish: ['Squish', 0, 80, 1, () => Math.round(tr.ships.squish * 100), (v) => { tr.ships.squish = v / 100; }, (v) => v + '%'],
        shine: ['Shine', 0, 300, 5, () => Math.round(tr.ships.shine * 100),
            (v) => { tr.ships.shine = v / 100; if (tr.shipShineK) tr.shipShineK.value = tr.ships.shine; }, (v) => v + '%'],
    };

    function trBuildDebug() {
        const box = $('tr-dbg');
        box.textContent = '';
        const cat = (key, title) => {
            const d = trEl('details', 'tr-dbg-cat');
            d.dataset.trCat = key;
            d.open = tr.dbgCats.indexOf(key) >= 0;
            d.appendChild(trEl('summary', null, title));
            box.appendChild(d);
            return d;
        };
        const row = (parent) => parent.appendChild(trEl('div', 'tr-dbg-row'));
        const head = (parent, text) => parent.appendChild(trEl('div', 'tr-dbg-h', text));
        const note = (parent, text) => parent.appendChild(trEl('div', 'tr-dbg-note', text));
        const slider = (parent, key) => {
            const [label, min, max, step, get] = DBG_SLIDERS[key];
            const r = row(parent);
            const inp = trEl('input');
            inp.type = 'range';
            inp.min = String(min); inp.max = String(max); inp.step = String(step);
            inp.value = String(get());
            inp.dataset.trDbg = key;
            const val = trEl('span', 'tr-dbg-val', DBG_SLIDERS[key][6](get()));
            val.id = 'tr-dbg-v-' + key;
            r.append(trEl('span', 'tr-dbg-label', label), inp, val);
        };
        const check = (parent, key, label, on) => {
            const inp = trEl('input');
            inp.type = 'checkbox';
            inp.checked = on;
            inp.dataset.trDbg = key;
            const lab = trEl('label', 'tr-dbg-check');
            lab.append(inp, document.createTextNode(' ' + label));
            parent.appendChild(lab);
            return lab;
        };
        const color = (parent, key, value) => {
            const inp = trEl('input');
            inp.type = 'color';
            inp.value = value;
            inp.dataset.trDbg = key;
            parent.appendChild(inp);
        };

        let d = cat('combat', 'Combat');
        note(d, 'Lock distance: how far outside a fighter\'s target box a shot may land and still lock it — slow-mo and a question. 0 is on the box. While this panel is open, each tap shows it as a dashed ring.');
        slider(d, 'near');
        note(d, 'Answer guard: after a lock, clicks on the answers are ignored this long, so a fast second tap cannot answer by accident.');
        slider(d, 'guard');
        head(d, 'Bolt speed');
        slider(d, 'bolt');
        slider(d, 'zap');

        d = cat('look', 'Look');
        head(d, 'Explosion');
        let r = row(d);
        const boom = trEl('select');
        boom.dataset.trDbg = 'boom';
        BOOMS.forEach(([label], i) => {
            const o = trEl('option', null, (i + 1) + '. ' + label);
            o.value = String(i);
            boom.appendChild(o);
        });
        boom.value = String(tr.boom);
        r.append(boom, trDbgBtn('Test', 'boom'));
        r = row(d);
        check(r, 'bite', 'Bitten circles — each disc is eaten from inside by a faster circle', tr.bite);
        slider(d, 'boomRate');
        head(d, 'Window grime');
        note(d, 'On the glass round the edges. Strength runs from the low end facing away from the sun to the high end facing it.');
        r = row(d);
        check(r, 'grimeOn', 'Show', tr.grime.on);
        color(r, 'grimeColor', tr.grime.color);
        r = row(d);
        const dual = trEl('div', 'tr-dual');
        dual.id = 'tr-dbg-dual';
        ['grimeMin', 'grimeMax'].forEach((k) => {
            const inp = trEl('input');
            inp.type = 'range';
            inp.min = '0'; inp.max = '100'; inp.step = '1';
            inp.value = String(Math.round(tr.grime[k === 'grimeMin' ? 'min' : 'max'] * 100));
            inp.dataset.trDbg = k;
            inp.setAttribute('aria-label', k === 'grimeMin' ? 'Strength facing away' : 'Strength facing the sun');
            dual.appendChild(inp);
        });
        const dv = trEl('span', 'tr-dbg-val');
        dv.id = 'tr-dbg-v-strength';
        r.append(trEl('span', 'tr-dbg-label', 'Strength'), dual, dv);
        trDualShow();
        head(d, 'Stencil');
        note(d, 'Reach: how far in from the window\'s edge grime and the hit flash may show. Fade: how soft their inner edge is. Both are a share of the screen\'s short side, so the border is the same depth on every edge.');
        slider(d, 'reach');
        slider(d, 'fade');
        head(d, 'Hit');
        r = row(d);
        r.append(trEl('span', 'tr-dbg-label', 'Hit colour'));
        color(r, 'hurtColor', tr.grime.hurt);
        r.append(trDbgBtn('Test', 'hurt'));

        d = cat('ships', 'Ships');
        note(d, 'The kit\'s own colours, but for the accent panels. Squish takes height off every fighter. Shine: darker panels shine more; this scales all of it (Medium and High only).');
        r = row(d);
        r.append(trEl('span', 'tr-dbg-label', 'Accent'));
        color(r, 'shipAccent', tr.ships.accent);
        r.append(trDbgBtn('Swoop', 'swoop'));
        slider(d, 'squish');
        slider(d, 'shine');
        r = row(d);
        check(r, 'thrust', 'Thrusters', tr.ships.thrust);
        color(r, 'thrustColor', tr.ships.thrustColor);
        note(d, 'Thrusters: the back-facing panels of each fighter\'s rear quarter glow. On High they are real lights; below that, flat colour.');

        d = cat('sound', 'Sound');
        note(d, 'Changing one plays it.');
        Object.keys(SFX_LABEL).forEach((k) => {
            r = row(d);
            const sel = trEl('select');
            sel.dataset.trDbgSfx = k;
            SFX[k].forEach(([label], i) => {
                const o = trEl('option', null, label);
                o.value = String(i);
                sel.appendChild(o);
            });
            sel.value = String(tr.sfx[k] || 0);
            const play = trDbgBtn('▶', 'play', 'tr-dbg-play');
            play.dataset.trDbgSfxPlay = k;
            play.setAttribute('aria-label', 'Play ' + SFX_LABEL[k]);
            r.append(trEl('span', 'tr-dbg-label', SFX_LABEL[k]), sel, play);
        });

        d = cat('spawn', 'Make it happen');
        r = row(d);
        r.classList.add('tr-dbg-wrap');
        r.append(trDbgBtn('Swoop', 'swoop'), trDbgBtn('Strafing run', 'strafe'), trDbgBtn('Incoming rock', 'rock'),
            trDbgBtn('Rock belt', 'belt'), trDbgBtn('Hit flash', 'hurt'));

        d = cat('perf', 'Performance');
        r = row(d);
        check(r, 'probe', 'Show frame-time readout', !$('tr-probe').classList.contains('hidden'));
        note(d, 'Quality and the frame cap are in the readout. Shiny fighters are on Medium and High; the muzzle light is on High only.');
        note(d, 'Benchmark: about two minutes on a held scene, switching one thing off at a time on High and on Low, then resolution. The report stays on screen.');
        r = row(d);
        r.append(trDbgBtn('Run benchmark', 'bench'));
        if (stJSON('turret.bench', null)) r.append(trDbgBtn('Last result', 'benchLast'));

        r = row(box);
        r.append(trDbgBtn('Reset to defaults', 'reset'));
    }

    // The dual slider's label, and the filled stretch between its thumbs.
    function trDualShow() {
        const a = Math.round(tr.grime.min * 100), b = Math.round(tr.grime.max * 100);
        const dual = $('tr-dbg-dual');
        if (!dual) return;
        dual.style.setProperty('--a', a + '%');
        dual.style.setProperty('--b', b + '%');
        $('tr-dbg-v-strength').textContent = a + '–' + b + '%';
    }

    function trSetDebugOpen(open) {
        tr.dbgOpen = open;
        $('tr-dbg').classList.toggle('hidden', !open);
        tr.stage.classList.toggle('tr-dbg-on', open);
        if (open) trBuildDebug();
    }

    function trPreview(name) {
        trAudioUnlock(true);
        if (!AC) return;
        const v = SFX[name][tr.sfx[name] || 0];
        if (!v || !v[1]) return;
        if (AC.state === 'running') v[1]();
        else AC.resume().then(() => v[1]());
    }

    function trDebugChange(e) {
        const t = e.target;
        const key = t.dataset.trDbg;
        const S = key && DBG_SLIDERS[key];
        if (S) {
            const v = clamp(Number(t.value), S[1], S[2]);
            S[5](v);
            $('tr-dbg-v-' + key).textContent = S[6](v);
            if (S[7]) trBakeGrime();
            trSaveDebug();
            return;
        }
        if (key === 'grimeMin' || key === 'grimeMax') {
            // Two thumbs, one range: a thumb pushed past the other takes it along.
            const v = clamp(Number(t.value) / 100, 0, 1);
            if (key === 'grimeMin') { tr.grime.min = v; if (tr.grime.max < v) tr.grime.max = v; }
            else { tr.grime.max = v; if (tr.grime.min > v) tr.grime.min = v; }
            const other = t.parentNode.querySelector('[data-tr-dbg="' + (key === 'grimeMin' ? 'grimeMax' : 'grimeMin') + '"]');
            other.value = String(Math.round(tr.grime[key === 'grimeMin' ? 'max' : 'min'] * 100));
            trDualShow();
            tr.glassOp = [-1, -1, -1];
            trSaveDebug();
            return;
        }
        if (key === 'boom') { tr.boom = Number(t.value); trSaveDebug(); return; }
        if (key === 'grimeOn') { tr.grime.on = t.checked; tr.glassOp = [-1, -1, -1]; trSaveDebug(); return; }
        if (key === 'grimeColor') { tr.grime.color = t.value; trBakeGrime(); trSaveDebug(); return; }
        if (key === 'hurtColor') { tr.grime.hurt = t.value; trBakeGrime(); trSaveDebug(); return; }
        if (key === 'shipAccent') { tr.ships.accent = t.value; trShipColours(); trSaveDebug(); return; }
        if (key === 'thrust') { tr.ships.thrust = t.checked; trShipColours(); trSaveDebug(); return; }
        if (key === 'thrustColor') { tr.ships.thrustColor = t.value; trShipColours(); trSaveDebug(); return; }
        if (key === 'bite') { tr.bite = t.checked; trSaveDebug(); return; }
        if (key === 'probe') {
            $('tr-probe').classList.toggle('hidden', !t.checked);
            stSet('turret.probe', t.checked ? '1' : '0');
            return;
        }
        const k = t.dataset.trDbgSfx;
        if (k && e.type === 'change') {
            const v = Number(t.value);
            if (v) tr.sfx[k] = v; else delete tr.sfx[k];
            trSaveDebug();
            trPreview(k);
        }
    }

    // <details> toggles do not bubble, so this listens in the capture phase.
    function trDebugToggle(e) {
        const d = e.target;
        if (!d.dataset || !d.dataset.trCat) return;
        const k = d.dataset.trCat, i = tr.dbgCats.indexOf(k);
        if (d.open && i < 0) tr.dbgCats.push(k);
        if (!d.open && i >= 0) tr.dbgCats.splice(i, 1);
        trSaveDebug();
    }

    function trDebugClick(e) {
        const b = e.target.closest('[data-tr-dbg-act]');
        if (!b) return;
        const act = b.dataset.trDbgAct;
        if (act === 'play') { trPreview(b.dataset.trDbgSfxPlay); return; }
        if (act === 'reset') {
            tr.boom = 0; tr.bite = BITE_ON; tr.boomRate = BOOM_RATE; tr.askGuard = ASK_GUARD; tr.nearPx = NEAR_PX; tr.sfx = {};
            tr.boltSpeed = BOLT_SPEED; tr.zapSpeed = ZAP_SPEED;
            tr.grime = Object.assign({}, GRIME);
            tr.ships = Object.assign({}, SHIPS);
            if (tr.shipShineK) tr.shipShineK.value = tr.ships.shine;
            trShipColours();
            trBakeGrime();
            trSaveDebug();
            trBuildDebug();
            return;
        }
        if (act === 'benchLast') {
            const rep = stJSON('turret.bench', null);
            if (rep && Array.isArray(rep.results)) { trSetDebugOpen(false); trBenchShow(rep); }
            return;
        }
        if (!tr.renderer) return;
        if (act === 'bench') { trBenchStart(); return; }
        if (act === 'boom') {
            // Straight ahead of the turret, near enough to see properly.
            tr.scene.updateMatrixWorld();
            const at = tr.camera.localToWorld(new THREE.Vector3(rand(-4, 4), rand(-2, 3), -32));
            trExplode(at, new THREE.Vector3().setFromMatrixColumn(tr.camera.matrixWorld, 0));
            trSfx('boom');
        } else if (act === 'swoop' || act === 'strafe') trSpawnFoe(trSafePath(act === 'strafe'), 0, null);
        else if (act === 'rock') trSpawnRock(true);
        else if (act === 'belt') { tr.pilot.belt = true; tr.pilot.beltUntil = tr.wt + 15; }
        else if (act === 'hurt') trHurt(1);
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
            if (e.target.closest('button, select, input, .tr-probe, .tr-dbg, .tr-bench')) return;
            presses.set(e.pointerId, { sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, t: performance.now(), drag: false });
            // Capture keeps a drag alive when the finger leaves the stage;
            // without it the drag still works, so a refusal is not an error.
            try { st.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ }
        });
        // A mouse is a pointer that moves without a press. While one is over
        // the stage the guns follow it; it is forgotten when it leaves.
        const track = (e) => {
            if (e.pointerType !== 'mouse') return;
            const r = st.getBoundingClientRect();
            if (!tr.mouse) tr.mouse = { nx: 0, ny: 0 };
            tr.mouse.nx = ((e.clientX - r.left) / r.width) * 2 - 1;
            tr.mouse.ny = -((e.clientY - r.top) / r.height) * 2 + 1;
        };
        st.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') tr.mouse = null; });
        st.addEventListener('pointermove', (e) => {
            track(e);
            const p = presses.get(e.pointerId);
            if (!p) return;
            if (!p.drag) {
                const slop = e.pointerType === 'mouse' ? TAP_SLOP_MOUSE : TAP_SLOP;
                if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < slop || aimer !== null) return;
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
                <canvas class="tr-glass" id="tr-grime" aria-hidden="true"></canvas>
                <canvas class="tr-glass" id="tr-grime-hurt" aria-hidden="true"></canvas>
                <canvas class="tr-glass" id="tr-hurt" aria-hidden="true"></canvas>
                <svg class="tr-cockpit" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
                    <path class="tr-frame" fill-rule="evenodd"
                        d="M0 0H1600V1000H0Z M260 90 L1340 90 L1520 300 L1520 760 L1380 900 L220 900 L80 760 L80 300 Z"/>
                    <path class="tr-frame-edge"
                        d="M260 90 L1340 90 L1520 300 L1520 760 L1380 900 L220 900 L80 760 L80 300 Z"/>
                    <path class="tr-frame" d="M770 90 L830 90 L812 210 L788 210 Z"/>
                </svg>
                <div class="tr-slowmo" id="tr-slowmo" aria-hidden="true"></div>
                <div class="tr-tgts" id="tr-tgts" aria-hidden="true"></div>
                <div class="tr-tap" id="tr-tap" aria-hidden="true"><i></i></div>
                <div class="tr-lock hidden" id="tr-lock" aria-hidden="true"><i></i></div>
                <div class="tr-ro tr-ro-l" aria-hidden="true">
                    <span>TURRET 2 · ARMED</span><span id="tr-ro-hdg">HDG 000</span><span id="tr-ro-elv">ELV +0</span>
                </div>
                <div class="tr-ro tr-ro-r" aria-hidden="true">
                    <span id="tr-ro-trk">TRK 0</span><span id="tr-ro-rng">RNG ----</span><span id="tr-ro-dfl">DEFL 100%</span>
                </div>
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
                        <div class="tr-credits">Ships by <a href="https://kenney.nl" target="_blank" rel="noopener">Kenney</a> ·
                            window texture: <a href="https://www.magnific.com/free-photo/top-view-dark-background-texture-concrete-surface_11776758.htm" target="_blank" rel="noopener">Image by KamranAydinov on Magnific</a></div>
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
                <div class="tr-bench hidden" id="tr-bench"></div>
                <button class="tr-icon-btn tr-fs-btn" id="tr-fs" title="Full screen" aria-label="Full screen">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg>
                </button>
                <button class="tr-icon-btn tr-dbg-btn" id="tr-dbg-toggle" title="Debug settings" aria-label="Debug settings">dbg</button>
                <div class="tr-dbg hidden" id="tr-dbg"></div>
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
        trBuildTargets();
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
            // Real time, not world time: the world is nearly stopped by now.
            if (tr.ask && performance.now() - tr.ask.openAt < tr.askGuard * 1000) return;
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
        $('tr-probe').classList.toggle('hidden', stGet('turret.probe', '0') !== '1');
        $('tr-fs').addEventListener('click', trToggleFullscreen);
        $('tr-dbg-toggle').addEventListener('click', () => trSetDebugOpen(!tr.dbgOpen));
        $('tr-dbg').addEventListener('change', trDebugChange);
        $('tr-dbg').addEventListener('input', trDebugChange);
        $('tr-dbg').addEventListener('click', trDebugClick);
        $('tr-dbg').addEventListener('toggle', trDebugToggle, true);
        $('tr-bench').addEventListener('click', trBenchClick);
        $('tr-tap').addEventListener('animationend', (e) => e.currentTarget.classList.remove('tr-on'));

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
        TIERS, state: tr, trPlanPath, trSafePath, BOOMS, SFX, trExplode, trSetDebugOpen, trSpawnFoe, models: () => MODELS, trPickFoe, trBakeGrime, trApplyTier, trShatter, trHurt, trSpawnRock, trEnemyFire, probe, trProbeStats, trSetTier, trPathAt, trFire, trChoices, trAnswer, trKey,
        trBenchStart, trBenchEnd, trBenchPlan, trBenchReport, trBenchText, KNOBS,
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
