/* ============================================================================
 * clocks.js — the Clocks tab: reading and setting an analogue clock.
 *
 * Self-contained plug-in, same shape as language-arts.js / polygons.js /
 * patterns.js: one IIFE that injects its own stylesheet, screen and tab,
 * registers into the global TAB_ENTRY / SCREEN_TAB, and touches no other file.
 * Prefix `ck`.
 *
 * Why this tab exists: Money has an entire tab with five currencies, while
 * meas.time.hourHalf, meas.time.fiveMin and meas.time.elapsed had no mode at
 * all — the clearest subject gap in the app.
 *
 * Three activities, because reading a clock and setting one are not the same
 * skill and the second is the harder half:
 *
 *   READ     a clock is drawn, pick the time it shows.
 *   SET      a time is named, drag the hands to show it.
 *   ELAPSED  two clocks, how much time passed between them.
 *
 * Two rules worth keeping:
 *
 *   THE HOUR HAND MOVES WITH THE MINUTE HAND. Its angle is always
 *   h*30 + m*0.5, never h*30. A clock showing 3:55 with the hour hand still
 *   sitting on the 3 is not a clock — and worse, it teaches the exact
 *   misreading (“the hour is whatever number the short hand is nearest”) that
 *   the hard tier is trying to correct.
 *
 *   Wrong answers are the real misreadings, not random times: the hour taken
 *   from the wrong side of the hand, the minute hand's NUMBER read as the
 *   minutes (ten past when the hand is on 2), and the count going the wrong
 *   way round the face. A random time is not a wrong answer, it is a free pass.
 * ==========================================================================*/
(function () {
    'use strict';

    const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /* ---- time model -------------------------------------------------------
     * A time is minutes since midnight on a 12-hour face, 0..719. Keeping one
     * number rather than {h, m} makes elapsed arithmetic and wrap-around fall
     * out for free instead of being special-cased.
     */
    const T = {
        of: (h, m) => (((h % 12) * 60 + m) % 720 + 720) % 720,
        h: (t) => (Math.floor(t / 60) % 12) || 12,      // 0 reads as 12
        m: (t) => t % 60,
        digital: (t) => T.h(t) + ':' + String(T.m(t)).padStart(2, '0'),
    };

    const HOUR_WORD = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six',
        'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

    function ckWords(t) {
        const h = T.h(t), m = T.m(t);
        const nextH = (h % 12) + 1;
        if (m === 0) return HOUR_WORD[h] + " o'clock";
        if (m === 15) return 'quarter past ' + HOUR_WORD[h];
        if (m === 30) return 'half past ' + HOUR_WORD[h];
        if (m === 45) return 'quarter to ' + HOUR_WORD[nextH];
        if (m < 30) return m + ' minutes past ' + HOUR_WORD[h];
        return (60 - m) + ' minutes to ' + HOUR_WORD[nextH];
    }

    /* ---- levels -----------------------------------------------------------
     * The step is what the minute hand may land on. Five minutes is the rung
     * where reading stops being recognition and starts being counting.
     */
    const LEVELS = {
        easy:   { step: 30, label: "O'clock & half past" },
        medium: { step: 5,  label: 'To five minutes' },
        hard:   { step: 1,  label: 'To the minute' },
    };

    const randTime = (step) => T.of(ri(1, 12), ri(0, Math.floor(59 / step)) * step);

    /* ---- the face ---------------------------------------------------------*/
    const R = 100;                       // viewBox is 0 0 200 200, centre 100,100
    const polar = (deg, r) => {
        const rad = (deg - 90) * Math.PI / 180;
        return [100 + r * Math.cos(rad), 100 + r * Math.sin(rad)];
    };
    const minuteAngle = (t) => T.m(t) * 6;
    // The half-degree per minute is the whole point — see the header.
    const hourAngle = (t) => ((Math.floor(t / 60) % 12) * 30) + (T.m(t) * 0.5);

    function ckFace(t, opts) {
        const o = opts || {};
        const parts = [];
        parts.push(`<circle class="ck-dial" cx="100" cy="100" r="94"/>`);

        for (let i = 0; i < 60; i++) {
            const big = i % 5 === 0;
            const [x1, y1] = polar(i * 6, big ? 80 : 86);
            const [x2, y2] = polar(i * 6, 90);
            parts.push(`<line class="ck-tick${big ? ' is-hour' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
        }
        for (let n = 1; n <= 12; n++) {
            const [x, y] = polar(n * 30, 66);
            parts.push(`<text class="ck-num" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${n}</text>`);
        }

        const [hx, hy] = polar(hourAngle(t), 48);
        const [mx, my] = polar(minuteAngle(t), 74);
        parts.push(`<line class="ck-hand is-hour" x1="100" y1="100" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"/>`);
        parts.push(`<line class="ck-hand is-minute" x1="100" y1="100" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}"/>`);
        parts.push('<circle class="ck-pin" cx="100" cy="100" r="5"/>');

        if (o.grab) {
            // Fat transparent hit lines, drawn last so they sit on top. A 4px
            // hand is not a touch target; these are 22 wide.
            parts.push(`<line class="ck-grab" data-hand="hour" x1="100" y1="100" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"/>`);
            parts.push(`<line class="ck-grab" data-hand="minute" x1="100" y1="100" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}"/>`);
        }
        return `<svg class="ck-face${o.small ? ' is-small' : ''}" viewBox="0 0 200 200" role="img"`
            + ` aria-label="${o.label || 'clock showing ' + ckWords(t)}">${parts.join('')}</svg>`;
    }

    /* ---- wrong answers that are real misreadings --------------------------*/
    function ckDistractors(t, step) {
        const h = T.h(t), m = T.m(t);
        const out = [];
        const add = (tt) => { if (tt !== t && out.indexOf(tt) === -1) out.push(tt); };

        // The hour hand is past the number, so the next hour gets read instead.
        if (m >= 30) add(T.of(h + 1, m));
        else add(T.of(h === 1 ? 12 : h - 1, m));
        // The minute hand's NUMBER read as the minutes: hand on 10 read as 10 past.
        if (m % 5 === 0 && m !== 0) add(T.of(h, (m / 5) % 60));
        // Counted the wrong way round the face.
        if (m !== 0 && m !== 30) add(T.of(h, 60 - m));
        // Hands swapped — only meaningful when the minute lands on a number.
        if (m % 5 === 0) add(T.of((m / 5) || 12, h * 5));

        let guard = 0;
        while (out.length < 3 && guard++ < 40) add(randTime(step));
        return out.slice(0, 3);
    }

    /* ---- state ------------------------------------------------------------*/
    const ck = {
        level: 'easy',
        activity: 'read',
        score: 0,
        streak: 0,
        target: 0,        // the time being asked about
        set: 0,           // what the learner has dialled up in SET
        endT: 0,          // ELAPSED second clock
        answered: false,
        choices: [],
    };

    const $ = (id) => document.getElementById(id);

    function ckSetLevel(level) {
        if (!LEVELS[level]) return;
        ck.level = level;
        document.querySelectorAll('.ck-level-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.ckLevel === level));
        ckNext();
    }

    function ckSetActivity(a) {
        ck.activity = a;
        document.querySelectorAll('.ck-act-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.ckAct === a));
        ckNext();
    }

    function ckScore(right) {
        if (right) { ck.score++; ck.streak++; } else { ck.streak = 0; }
        $('ck-score').textContent = 'Score: ' + ck.score;
        $('ck-streak').textContent = 'Streak: ' + ck.streak;
    }

    /* ---- rounds -----------------------------------------------------------*/
    function ckNext() {
        ck.answered = false;
        const step = LEVELS[ck.level].step;
        $('ck-explain').textContent = '';
        $('ck-explain').className = 'ck-explain';
        $('ck-next').classList.add('hidden');

        if (ck.activity === 'read') return ckRoundRead(step);
        if (ck.activity === 'set') return ckRoundSet(step);
        return ckRoundElapsed(step);
    }

    function ckRoundRead(step) {
        ck.target = randTime(step);
        ck.choices = shuffle([ck.target].concat(ckDistractors(ck.target, step)));
        $('ck-prompt').textContent = 'What time is it?';
        $('ck-stage').innerHTML = ckFace(ck.target, { label: 'clock to read' });
        $('ck-answer').innerHTML = ck.choices.map((c) =>
            `<button type="button" class="btn btn-secondary ck-choice" data-ck-choice="${c}">`
            + `${T.digital(c)}</button>`).join('');
        $('ck-answer').className = 'ck-answer is-choices';
    }

    function ckRoundSet(step) {
        ck.target = randTime(step);
        // Never start on the answer, and never start where a single nudge lands
        // on it either.
        do { ck.set = randTime(step); } while (ck.set === ck.target);
        $('ck-prompt').innerHTML = 'Show <strong>' + ckWords(ck.target) + '</strong>';
        $('ck-stage').innerHTML = ckFace(ck.set, { grab: true, label: 'clock to set' });
        $('ck-answer').innerHTML =
            '<button type="button" class="btn btn-primary ck-check">Check</button>';
        $('ck-answer').className = 'ck-answer';
        ckWireDrag();
    }

    function ckRoundElapsed(step) {
        const gapStep = ck.level === 'easy' ? 30 : ck.level === 'medium' ? 15 : 5;
        ck.target = randTime(step);
        const gap = ri(1, ck.level === 'easy' ? 6 : 8) * gapStep;
        ck.endT = T.of(0, 0) + ((ck.target + gap) % 720);
        ck.gap = gap;

        const opts = shuffle([gap].concat(ckGapDistractors(gap, gapStep)));
        ck.choices = opts;
        $('ck-prompt').textContent = 'How much time goes by?';
        $('ck-stage').innerHTML =
            '<div class="ck-pair">'
            + '<figure>' + ckFace(ck.target, { small: true, label: 'start time' })
            + '<figcaption>Start</figcaption></figure>'
            + '<figure>' + ckFace(ck.endT, { small: true, label: 'end time' })
            + '<figcaption>End</figcaption></figure></div>';
        $('ck-answer').innerHTML = opts.map((g) =>
            `<button type="button" class="btn btn-secondary ck-choice" data-ck-gap="${g}">`
            + `${ckGapWords(g)}</button>`).join('');
        $('ck-answer').className = 'ck-answer is-choices';
    }

    function ckGapWords(mins) {
        const h = Math.floor(mins / 60), m = mins % 60;
        if (!h) return m + ' min';
        if (!m) return h + (h === 1 ? ' hour' : ' hours');
        return h + 'h ' + m + 'm';
    }

    function ckGapDistractors(gap, step) {
        const out = [];
        const add = (g) => { if (g > 0 && g !== gap && out.indexOf(g) === -1) out.push(g); };
        add(gap + 60);            // counted an extra hour on the wrap
        add(Math.abs(gap - 60));  // lost one
        add(gap + step);
        add(Math.abs(120 - gap));
        let guard = 0;
        while (out.length < 3 && guard++ < 30) add(ri(1, 8) * step);
        return out.slice(0, 3);
    }

    /* ---- dragging the hands ----------------------------------------------
     * Pointer events, not mouse events, so a finger works. The pointer is
     * captured on the SVG itself: a hand that slides out from under the finger
     * mid-drag would otherwise stop receiving moves the instant it did so.
     */
    function ckWireDrag() {
        const svg = $('ck-stage').querySelector('.ck-face');
        if (!svg) return;
        let hand = null;

        /* Returns null rather than a number when the face has no size — which
         * happens if a drag arrives while the screen is hidden or before layout
         * has run. Dividing by a zero width yields NaN, and a NaN time is not a
         * wrong time, it is an unrecoverable one: it propagates into ck.set and
         * every subsequent render reads "12:NaN" until the tab is reloaded. */
        const angleAt = (ev) => {
            const r = svg.getBoundingClientRect();
            if (!r.width || !r.height) return null;
            const x = ((ev.clientX - r.left) / r.width) * 200 - 100;
            const y = ((ev.clientY - r.top) / r.height) * 200 - 100;
            if (!isFinite(x) || !isFinite(y)) return null;
            const deg = Math.atan2(y, x) * 180 / Math.PI + 90;
            return (deg % 360 + 360) % 360;
        };

        /* Moves the existing lines rather than re-rendering the face. Rebuilding
         * the SVG mid-drag would destroy the very element holding the pointer
         * capture, and the drag would die the moment the finger left the hand. */
        const redraw = () => {
            const [hx, hy] = polar(hourAngle(ck.set), 48);
            const [mx, my] = polar(minuteAngle(ck.set), 74);
            const move = (sel, x, y) => svg.querySelectorAll(sel).forEach((l) => {
                l.setAttribute('x2', x.toFixed(1));
                l.setAttribute('y2', y.toFixed(1));
            });
            move('.ck-hand.is-hour, .ck-grab[data-hand="hour"]', hx, hy);
            move('.ck-hand.is-minute, .ck-grab[data-hand="minute"]', mx, my);
            svg.setAttribute('aria-label', 'clock showing ' + ckWords(ck.set));
        };

        const apply = (ev) => {
            const deg = angleAt(ev);
            if (deg === null) return;
            const step = LEVELS[ck.level].step;
            if (hand === 'minute') {
                const m = (Math.round(deg / 6 / step) * step) % 60;
                // Keep the hour, change the minutes. The hour HAND still moves,
                // because its angle is derived from both.
                ck.set = T.of(T.h(ck.set), m);
            } else {
                const h = Math.round(deg / 30) % 12;
                ck.set = T.of(h === 0 ? 12 : h, T.m(ck.set));
            }
            redraw();
        };

        svg.addEventListener('pointerdown', (e) => {
            const g = e.target.closest('.ck-grab');
            if (!g || ck.answered) return;
            hand = g.dataset.hand;
            svg.setPointerCapture(e.pointerId);
            apply(e);            // jump to the finger, so the first touch counts
            e.preventDefault();
        });
        svg.addEventListener('pointermove', (e) => { if (hand) apply(e); });
        svg.addEventListener('pointerup', () => { hand = null; });
        svg.addEventListener('pointercancel', () => { hand = null; });
    }

    /* ---- answering --------------------------------------------------------*/
    function ckAnswerRead(chosen) {
        if (ck.answered) return;
        ck.answered = true;
        const right = chosen === ck.target;
        document.querySelectorAll('.ck-choice').forEach((b) => {
            const v = Number(b.dataset.ckChoice);
            if (v === ck.target) b.classList.add('is-correct');
            else if (v === chosen) b.classList.add('is-wrong');
        });
        ckScore(right);
        ckExplain(right, 'It is ' + ckWords(ck.target) + ' — ' + T.digital(ck.target) + '.');
    }

    function ckAnswerElapsed(chosen) {
        if (ck.answered) return;
        ck.answered = true;
        const right = chosen === ck.gap;
        document.querySelectorAll('.ck-choice').forEach((b) => {
            const v = Number(b.dataset.ckGap);
            if (v === ck.gap) b.classList.add('is-correct');
            else if (v === chosen) b.classList.add('is-wrong');
        });
        ckScore(right);
        ckExplain(right, ckWords(ck.target) + ' to ' + ckWords(ck.endT)
            + ' is ' + ckGapWords(ck.gap) + '.');
    }

    function ckCheckSet() {
        if (ck.answered) return;
        ck.answered = true;
        const right = ck.set === ck.target;
        ckScore(right);
        ckExplain(right, right
            ? 'That is ' + ckWords(ck.target) + '.'
            : 'You showed ' + ckWords(ck.set) + '. ' + ckWords(ck.target)
              + ' is ' + T.digital(ck.target) + '.');
        if (!right) {
            // Show the answer on the face rather than only describing it.
            $('ck-stage').innerHTML = ckFace(ck.target, { label: 'the answer' });
        }
    }

    function ckExplain(right, text) {
        const el = $('ck-explain');
        el.textContent = (right ? '✓ ' : '✗ ') + text;
        el.className = 'ck-explain ' + (right ? 'is-right' : 'is-wrong');
        $('ck-next').classList.remove('hidden');
    }

    function ckEnter() {
        showScreen('clocks');
        if (!ck.target && !ck.set) ckNext();
    }

    /* ---- screen -----------------------------------------------------------*/
    const SCREEN_HTML = `
        <div class="container ck-container">
            <div class="ck-config">
                <div class="tt-btn-group" id="ck-act-group">
                    <button class="btn btn-secondary ck-act-btn active" data-ck-act="read">Read</button>
                    <button class="btn btn-secondary ck-act-btn" data-ck-act="set">Set</button>
                    <button class="btn btn-secondary ck-act-btn" data-ck-act="elapsed">Elapsed</button>
                </div>
                <div class="tt-btn-group" id="ck-level-group">
                    <button class="btn btn-secondary ck-level-btn active" data-ck-level="easy">Easy</button>
                    <button class="btn btn-secondary ck-level-btn" data-ck-level="medium">Medium</button>
                    <button class="btn btn-secondary ck-level-btn" data-ck-level="hard">Hard</button>
                </div>
            </div>
            <div class="ck-score-bar">
                <span id="ck-score">Score: 0</span>
                <span id="ck-streak">Streak: 0</span>
            </div>
            <div id="ck-prompt" class="ck-prompt"></div>
            <div id="ck-stage" class="ck-stage"></div>
            <div id="ck-answer" class="ck-answer"></div>
            <div id="ck-explain" class="ck-explain"></div>
            <button id="ck-next" class="btn btn-primary ck-next hidden">Next</button>
        </div>`;

    /* ---- boot -------------------------------------------------------------*/
    function injectStylesheet() {
        if (document.querySelector('link[data-ck-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'clocks.css?v=' + (window.ASSET_V || '1');
        link.dataset.ckCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('clocks-screen')) return;
        const div = document.createElement('div');
        div.id = 'clocks-screen';
        div.className = 'screen ck-screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');   // screens are body-level
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        // boot.js pre-creates this so the tab keeps its place while the file is
        // still being fetched. Don't add a second one.
        if (!bar || bar.querySelector('.tab-btn[data-tab="clocks"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'clocks';
        btn.textContent = 'Clocks';
        bar.appendChild(btn);
    }

    function wire() {
        $('ck-act-group').addEventListener('click', (e) => {
            const b = e.target.closest('.ck-act-btn');
            if (b) ckSetActivity(b.dataset.ckAct);
        });
        $('ck-level-group').addEventListener('click', (e) => {
            const b = e.target.closest('.ck-level-btn');
            if (b) ckSetLevel(b.dataset.ckLevel);
        });
        $('ck-answer').addEventListener('click', (e) => {
            const c = e.target.closest('.ck-choice');
            if (c && c.dataset.ckChoice !== undefined) return ckAnswerRead(Number(c.dataset.ckChoice));
            if (c && c.dataset.ckGap !== undefined) return ckAnswerElapsed(Number(c.dataset.ckGap));
            if (e.target.closest('.ck-check')) ckCheckSet();
        });
        $('ck-next').addEventListener('click', ckNext);
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.clocks = 'clocks';
        TAB_ENTRY.clocks = ckEnter;
        wire();
    }

    // Debug handle for the smoke test, same convention as __GP / __PY / __NP.
    window.__CK = { T, LEVELS, ckWords, ckFace, ckDistractors, hourAngle, minuteAngle, state: ck };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
