/* ============================================================================
 * decimals.js — the Decimals tab. Prefix `dc`.
 *
 * Self-contained plug-in, same shape as language-arts.js / polygons.js /
 * patterns.js / clocks.js: one IIFE that injects its own stylesheet, screen and
 * tab, registers into TAB_ENTRY / SCREEN_TAB, and touches no other file.
 *
 * Why this tab exists: `dec.*` is ten curriculum nodes — the largest strand
 * with no presence in the app at all. The Fractions tab is fractions only.
 *
 * The organising idea is the HUNDREDTHS GRID. A hundred-square with some cells
 * shaded is to a decimal what a pie is to a fraction: it makes "0.4 and 0.40
 * are the same" something you can see rather than a rule to accept, and it
 * makes 0.4 > 0.35 obvious to an eye that "more digits means bigger" has
 * already fooled. Every activity below is built on the same grid so those
 * comparisons carry across.
 *
 * Rules worth keeping:
 *
 *   FRACTIONS ARE WRITTEN OVER AND UNDER, never as a/b — the same rule the
 *   Fractions tab holds, including in feedback lines. `dcFrac` defers to the
 *   app's own frFracHTML so there is one implementation, not two.
 *
 *   Wrong answers are the decimal misconceptions, not random numbers: the
 *   longer-is-bigger error (0.35 > 0.4), the decimal point ignored, tenths and
 *   hundredths swapped. A random decimal is not a wrong answer, it is a
 *   free pass.
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

    /* Decimals are held as an integer count of thousandths, so comparison and
     * equality are exact. 0.1 + 0.2 !== 0.3 in binary floating point, and a
     * quiz that marks a correct answer wrong once in a hundred rounds is worse
     * than no quiz. Everything converts to a string only at the edges. */
    const K = 1000;
    const dcStr = (t, places) => {
        const p = places === undefined ? (t % 100 === 0 ? 1 : (t % 10 === 0 ? 2 : 3)) : places;
        return (t / K).toFixed(p);
    };
    const dcFrac = (n, d) => (typeof frFracHTML === 'function'
        ? frFracHTML(n, d)
        : '<span class="dc-frac"><span>' + n + '</span><span>' + d + '</span></span>');

    /* ---- levels -----------------------------------------------------------*/
    const LEVELS = {
        easy:   { places: 1, step: 100, label: 'Tenths' },
        medium: { places: 2, step: 10,  label: 'Hundredths' },
        hard:   { places: 3, step: 1,   label: 'Thousandths' },
    };
    const randDec = (lvl, maxWhole) => {
        const L = LEVELS[lvl];
        const whole = maxWhole === undefined ? 0 : ri(0, maxWhole);
        const frac = ri(1, (K / L.step) - 1) * L.step;
        return whole * K + frac;
    };

    /* ---- the hundredths grid ---------------------------------------------
     * Always a hundred cells. Tenths shade ten at a time — a whole column —
     * which is exactly the point: a tenth IS ten hundredths, and the picture
     * says so without a rule being quoted.
     */
    function dcGrid(thousandths, opts) {
        const o = opts || {};
        const hundredths = Math.round((thousandths % K) / 10);
        const cells = [];
        for (let i = 0; i < 100; i++) {
            const col = i % 10, row = Math.floor(i / 10);
            // Fill column by column so a tenth reads as one full column.
            const filled = (col * 10 + row) < hundredths;
            cells.push(`<rect class="dc-cell${filled ? ' is-on' : ''}" x="${col * 10}" y="${row * 10}"`
                + ' width="10" height="10"/>');
        }
        const grid = [];
        for (let i = 0; i <= 10; i++) {
            const big = i % 10 === 0;
            grid.push(`<line class="dc-rule${big ? ' is-edge' : ''}" x1="${i * 10}" y1="0" x2="${i * 10}" y2="100"/>`);
            grid.push(`<line class="dc-rule${big ? ' is-edge' : ''}" x1="0" y1="${i * 10}" x2="100" y2="${i * 10}"/>`);
        }
        return `<svg class="dc-grid${o.small ? ' is-small' : ''}" viewBox="-2 -2 104 104" role="img"`
            + ` aria-label="${o.label || dcStr(thousandths) + ' shaded'}">`
            + cells.join('') + grid.join('') + '</svg>';
    }

    /* ---- a number line ----------------------------------------------------*/
    function dcLine(lo, hi, marks, at) {
        const span = hi - lo || 1;
        const x = (t) => 6 + ((t - lo) / span) * 88;
        const ticks = marks.map((m) =>
            `<line class="dc-tick" x1="${x(m).toFixed(2)}" y1="12" x2="${x(m).toFixed(2)}" y2="20"/>`
            + `<text class="dc-lbl" x="${x(m).toFixed(2)}" y="30">${dcStr(m)}</text>`).join('');
        const pin = at === undefined ? ''
            : `<circle class="dc-pin" cx="${x(at).toFixed(2)}" cy="16" r="3.2"/>`;
        return '<svg class="dc-line" viewBox="0 0 100 36" role="img" aria-label="number line">'
            + '<line class="dc-axis" x1="6" y1="16" x2="94" y2="16"/>' + ticks + pin + '</svg>';
    }

    /* ---- wrong answers that are real misconceptions -----------------------*/
    function dcDistractors(t, lvl) {
        const L = LEVELS[lvl];
        const out = [];
        const add = (v) => {
            if (v > 0 && v !== t && v < 10 * K && out.indexOf(v) === -1) out.push(v);
        };
        const digits = dcStr(t, L.places).split('.')[1] || '';
        // "Longer is bigger": read 0.4 as 0.04, or pad it out a place.
        add(Math.round(t / 10) * 10 === t ? t / 10 : t * 10);
        // Tenths and hundredths swapped.
        if (digits.length >= 2) {
            const swapped = digits[1] + digits[0] + digits.slice(2);
            add(Math.round(parseFloat('0.' + swapped) * K));
        }
        // One step out, in each direction — the honest near miss.
        add(t + L.step);
        add(t - L.step);
        let guard = 0;
        while (out.length < 3 && guard++ < 40) add(randDec(lvl));
        return out.slice(0, 3);
    }

    /* ---- state ------------------------------------------------------------*/
    const dc = {
        level: 'medium',
        activity: 'grid',
        score: 0,
        streak: 0,
        answered: false,
        target: 0,
        other: 0,
        answer: null,
    };
    const $ = (id) => document.getElementById(id);

    function dcSetLevel(l) {
        if (!LEVELS[l]) return;
        dc.level = l;
        document.querySelectorAll('.dc-level-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.dcLevel === l));
        dcNext();
    }
    function dcSetActivity(a) {
        dc.activity = a;
        document.querySelectorAll('.dc-act-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.dcAct === a));
        dcNext();
    }
    function dcScore(right) {
        if (right) { dc.score++; dc.streak++; } else { dc.streak = 0; }
        $('dc-score').textContent = 'Score: ' + dc.score;
        $('dc-streak').textContent = 'Streak: ' + dc.streak;
    }

    /* ---- rounds -----------------------------------------------------------*/
    function dcNext() {
        dc.answered = false;
        $('dc-explain').textContent = '';
        $('dc-explain').className = 'dc-explain';
        $('dc-next').classList.add('hidden');
        if (dc.activity === 'grid') return dcRoundGrid();
        if (dc.activity === 'compare') return dcRoundCompare();
        if (dc.activity === 'line') return dcRoundLine();
        return dcRoundRound();
    }

    function dcChoices(values, fmt) {
        return values.map((v) =>
            `<button type="button" class="btn btn-secondary dc-choice" data-dc-val="${v}">`
            + (fmt ? fmt(v) : dcStr(v, LEVELS[dc.level].places)) + '</button>').join('');
    }

    // Thousandths cannot be drawn on a hundred-square, so that level asks the
    // same question on the number line instead of pretending the grid can.
    function dcRoundGrid() {
        if (dc.level === 'hard') return dcRoundLine();
        dc.target = randDec(dc.level);
        dc.answer = dc.target;
        const opts = shuffle([dc.target].concat(dcDistractors(dc.target, dc.level)));
        $('dc-prompt').textContent = 'What decimal is shaded?';
        $('dc-stage').innerHTML = dcGrid(dc.target, { label: 'hundred square' });
        $('dc-answer').innerHTML = dcChoices(opts);
        $('dc-answer').className = 'dc-answer is-choices';
    }

    function dcRoundCompare() {
        const lvl = dc.level;
        do {
            dc.target = randDec(lvl);
            dc.other = randDec(lvl);
        } while (dc.target === dc.other);
        // Force the classic trap often: a shorter decimal that is larger.
        dc.answer = dc.target > dc.other ? '>' : '<';
        $('dc-prompt').innerHTML = 'Which sign belongs between them?';
        const big = lvl === 'hard';
        $('dc-stage').innerHTML =
            '<div class="dc-pair">'
            + '<figure>' + (big ? '' : dcGrid(dc.target, { small: true }))
            + '<figcaption>' + dcStr(dc.target, LEVELS[lvl].places) + '</figcaption></figure>'
            + '<div class="dc-op">?</div>'
            + '<figure>' + (big ? '' : dcGrid(dc.other, { small: true }))
            + '<figcaption>' + dcStr(dc.other, LEVELS[lvl].places) + '</figcaption></figure>'
            + '</div>';
        $('dc-answer').innerHTML = ['<', '=', '>'].map((s) =>
            `<button type="button" class="btn btn-secondary dc-choice" data-dc-val="${s}">${s}</button>`).join('');
        $('dc-answer').className = 'dc-answer is-choices';
    }

    function dcRoundLine() {
        const L = LEVELS[dc.level];
        const whole = ri(0, 3);
        dc.target = whole * K + ri(1, (K / L.step) - 1) * L.step;
        dc.answer = dc.target;
        const lo = whole * K, hi = (whole + 1) * K;
        const marks = [lo, lo + K / 2, hi];
        const opts = shuffle([dc.target].concat(dcDistractors(dc.target, dc.level)
            .filter((v) => v > lo && v < hi)));
        while (opts.length < 4) {
            const v = lo + ri(1, (K / L.step) - 1) * L.step;
            if (opts.indexOf(v) === -1) opts.push(v);
        }
        $('dc-prompt').textContent = 'Which number is the dot on?';
        $('dc-stage').innerHTML = dcLine(lo, hi, marks, dc.target);
        $('dc-answer').innerHTML = dcChoices(shuffle(opts));
        $('dc-answer').className = 'dc-answer is-choices';
    }

    function dcRoundRound() {
        const L = LEVELS[dc.level];
        // Rounding to a whole is the tenths job; to a tenth, the hundredths job.
        const toWhole = dc.level === 'easy';
        dc.target = randDec(dc.level === 'easy' ? 'medium' : dc.level, 3);
        const unit = toWhole ? K : K / 10;
        dc.answer = Math.round(dc.target / unit) * unit;
        const opts = shuffle([dc.answer, dc.answer + unit, Math.max(0, dc.answer - unit),
            Math.floor(dc.target / unit) * unit + (dc.answer === Math.floor(dc.target / unit) * unit ? 2 * unit : 0)]
            .filter((v, i, a) => a.indexOf(v) === i));
        while (opts.length < 3) opts.push(dc.answer + (opts.length + 1) * unit);
        $('dc-prompt').innerHTML = 'Round <strong>' + dcStr(dc.target, L.places === 1 ? 2 : L.places)
            + '</strong> to the nearest ' + (toWhole ? 'whole number' : 'tenth');
        const lo = Math.floor(dc.target / unit) * unit;
        $('dc-stage').innerHTML = dcLine(lo, lo + unit, [lo, lo + unit], dc.target);
        $('dc-answer').innerHTML = dcChoices(opts, (v) => dcStr(v, toWhole ? 0 : 1));
        $('dc-answer').className = 'dc-answer is-choices';
    }

    /* ---- answering --------------------------------------------------------*/
    function dcAnswer(raw) {
        if (dc.answered) return;
        dc.answered = true;
        const isSign = dc.activity === 'compare';
        const chosen = isSign ? raw : Number(raw);
        const right = chosen === dc.answer;

        document.querySelectorAll('.dc-choice').forEach((b) => {
            const v = isSign ? b.dataset.dcVal : Number(b.dataset.dcVal);
            if (v === dc.answer) b.classList.add('is-correct');
            else if (v === chosen) b.classList.add('is-wrong');
        });
        dcScore(right);
        dcExplain(right, dcWhy());
    }

    function dcWhy() {
        const L = LEVELS[dc.level];
        if (dc.activity === 'compare') {
            const a = dcStr(dc.target, L.places), b = dcStr(dc.other, L.places);
            const bigger = dc.target > dc.other ? a : b;
            return a + ' ' + dc.answer + ' ' + b + '. Line the decimal points up and compare '
                + 'the tenths first — ' + bigger + ' is the larger, however many digits each has.';
        }
        if (dc.activity === 'grid') {
            const h = Math.round((dc.target % K) / 10);
            return dcStr(dc.target) + ' is ' + h + ' hundredths — '
                + dcFrac(h, 100) + ' of the square.';
        }
        if (dc.activity === 'round') {
            return dcStr(dc.target) + ' rounds to ' + dcStr(dc.answer,
                dc.level === 'easy' ? 0 : 1) + '. Look at which mark the dot is nearer.';
        }
        return 'The dot is on ' + dcStr(dc.answer) + '.';
    }

    function dcExplain(right, text) {
        const el = $('dc-explain');
        el.innerHTML = (right ? '✓ ' : '✗ ') + text;
        el.className = 'dc-explain ' + (right ? 'is-right' : 'is-wrong');
        $('dc-next').classList.remove('hidden');
    }

    function dcEnter() {
        showScreen('decimals');
        if (!dc.answer && dc.answer !== 0) dcNext();
    }

    /* ---- screen -----------------------------------------------------------*/
    const SCREEN_HTML = `
        <div class="container dc-container">
            <div class="dc-config">
                <div class="tt-btn-group" id="dc-act-group">
                    <button class="btn btn-secondary dc-act-btn active" data-dc-act="grid">Grid</button>
                    <button class="btn btn-secondary dc-act-btn" data-dc-act="compare">Compare</button>
                    <button class="btn btn-secondary dc-act-btn" data-dc-act="line">Number line</button>
                    <button class="btn btn-secondary dc-act-btn" data-dc-act="round">Round</button>
                </div>
                <div class="tt-btn-group" id="dc-level-group">
                    <button class="btn btn-secondary dc-level-btn" data-dc-level="easy">Tenths</button>
                    <button class="btn btn-secondary dc-level-btn active" data-dc-level="medium">Hundredths</button>
                    <button class="btn btn-secondary dc-level-btn" data-dc-level="hard">Thousandths</button>
                </div>
            </div>
            <div class="dc-score-bar">
                <span id="dc-score">Score: 0</span>
                <span id="dc-streak">Streak: 0</span>
            </div>
            <div id="dc-prompt" class="dc-prompt"></div>
            <div id="dc-stage" class="dc-stage"></div>
            <div id="dc-answer" class="dc-answer"></div>
            <div id="dc-explain" class="dc-explain"></div>
            <button id="dc-next" class="btn btn-primary dc-next hidden">Next</button>
        </div>`;

    /* ---- boot -------------------------------------------------------------*/
    function injectStylesheet() {
        if (document.querySelector('link[data-dc-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'decimals.css?v=' + (window.ASSET_V || '1');
        link.dataset.dcCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('decimals-screen')) return;
        const div = document.createElement('div');
        div.id = 'decimals-screen';
        div.className = 'screen dc-screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        if (!bar || bar.querySelector('.tab-btn[data-tab="decimals"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'decimals';
        btn.textContent = 'Decimals';
        bar.appendChild(btn);
    }

    function wire() {
        $('dc-act-group').addEventListener('click', (e) => {
            const b = e.target.closest('.dc-act-btn');
            if (b) dcSetActivity(b.dataset.dcAct);
        });
        $('dc-level-group').addEventListener('click', (e) => {
            const b = e.target.closest('.dc-level-btn');
            if (b) dcSetLevel(b.dataset.dcLevel);
        });
        $('dc-answer').addEventListener('click', (e) => {
            const c = e.target.closest('.dc-choice');
            if (c) dcAnswer(c.dataset.dcVal);
        });
        $('dc-next').addEventListener('click', dcNext);
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.decimals = 'decimals';
        TAB_ENTRY.decimals = dcEnter;
        wire();
    }

    // Debug handle for the smoke test, same convention as __GP / __PY / __NP / __CK.
    window.__DC = { K, LEVELS, dcStr, dcGrid, dcLine, dcDistractors, randDec, state: dc };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
