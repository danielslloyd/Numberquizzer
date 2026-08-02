/* ============================================================================
 * polygons.js — the Polygons tab: a regular-polygon drawing board and a
 * multiple-choice quiz over polygon properties.
 *
 * Self-contained plug-in, same shape as language-arts.js: one IIFE that injects
 * its own stylesheet, screen and tab, registers into the global TAB_ENTRY /
 * SCREEN_TAB, and touches no other file. Everything is namespaced `py`.
 *
 * Geometry notes, since they are the whole file:
 *
 *  - All work happens in the SVG's own coordinate space (300x300, y DOWN), so
 *    angles increase clockwise from east. A vertex angle of 90 deg is the
 *    BOTTOM of the shape, not the top.
 *  - Vertices start at `90 + 180/n` rather than at -90. That puts an edge flat
 *    along the bottom for every n, which is what makes a square read as a
 *    square instead of a diamond and a pentagon sit the way a pentagon is
 *    always drawn. Do not "simplify" it back to -90.
 *  - Irregular polygons are made by jittering the radius and angle of each
 *    vertex of a regular one while KEEPING THE ANGLES SORTED. That guarantees
 *    a star-shaped, therefore simple (non-self-intersecting), polygon — a
 *    plain random scatter of points does not.
 * ==========================================================================*/
(function () {
    'use strict';

    /* ---- tiny utilities ---------------------------------------------------*/
    const rand = (n) => Math.floor(Math.random() * n);
    const pick = (arr) => arr[rand(arr.length)];
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = rand(i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    const rad = (deg) => (deg * Math.PI) / 180;

    /* ========================================================================
     * NAMES AND FACTS
     * ======================================================================*/

    const PY_NAMES = {
        3: 'Triangle', 4: 'Quadrilateral', 5: 'Pentagon', 6: 'Hexagon',
        7: 'Heptagon', 8: 'Octagon', 9: 'Nonagon', 10: 'Decagon',
        11: 'Hendecagon', 12: 'Dodecagon', 13: 'Triskaidecagon',
        14: 'Tetradecagon', 15: 'Pentadecagon', 16: 'Hexadecagon',
        17: 'Heptadecagon', 18: 'Octadecagon', 19: 'Enneadecagon',
        20: 'Icosagon',
    };

    // A regular 3-gon and a regular 4-gon have names of their own, and those are
    // the names anyone would actually say.
    const PY_REGULAR_NAMES = { 3: 'Equilateral triangle', 4: 'Square' };

    function pyName(n, regular) {
        return (regular && PY_REGULAR_NAMES[n]) || PY_NAMES[n];
    }

    const MIN_SIDES = 3;
    const MAX_SIDES = 20;

    const pyAngleSum  = (n) => (n - 2) * 180;
    const pyInterior  = (n) => ((n - 2) * 180) / n;
    const pyExterior  = (n) => 360 / n;
    const pyDiagonals = (n) => (n * (n - 3)) / 2;

    function pyDeg(v) {
        return (Number.isInteger(v) ? v : Number(v.toFixed(1))) + '°';
    }

    const PY_FILLS = ['#ef5350', '#ffa726', '#ffee58', '#66bb6a',
        '#26c6da', '#42a5f5', '#7e57c2', '#ec407a'];
    const pyFill = (n) => PY_FILLS[(n - MIN_SIDES) % PY_FILLS.length];

    /* ========================================================================
     * GEOMETRY
     * ======================================================================*/

    const VB = 300, CX = 150, CY = 150, R = 116;

    // Regular n-gon, flat edge at the bottom. See the header note on `90 + 180/n`.
    function pyRegularPts(n, r) {
        const rr = r || R;
        const pts = [];
        for (let i = 0; i < n; i++) {
            const a = rad(90 + 180 / n + (i * 360) / n);
            pts.push([CX + rr * Math.cos(a), CY + rr * Math.sin(a)]);
        }
        return pts;
    }

    const pyDist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

    function pySideLengths(pts) {
        return pts.map((p, i) => pyDist(p, pts[(i + 1) % pts.length]));
    }

    /* An obviously-not-regular polygon. Angles stay sorted so the outline never
     * crosses itself; the retry loop is there because a small jitter can land
     * on something that still looks regular, and "spot the irregular one" is
     * only a fair question if the answer is visible. */
    function pyIrregularPts(n) {
        const step = 360 / n;
        let best = null, bestRatio = 0;
        for (let attempt = 0; attempt < 40; attempt++) {
            const pts = [];
            for (let i = 0; i < n; i++) {
                const a = 90 + 180 / n + i * step + (Math.random() - 0.5) * step * 0.7;
                const rr = R * (0.52 + Math.random() * 0.53);
                pts.push([CX + rr * Math.cos(rad(a)), CY + rr * Math.sin(rad(a))]);
            }
            const lens = pySideLengths(pts);
            const ratio = Math.max(...lens) / Math.min(...lens);
            if (ratio > bestRatio) { bestRatio = ratio; best = pts; }
            if (ratio >= 1.6) return pts;
        }
        return best;
    }

    /* ---- SVG assembly -----------------------------------------------------*/

    const fmt = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

    function pyDiagonalsSVG(pts) {
        const n = pts.length;
        let out = '';
        for (let i = 0; i < n; i++) {
            for (let j = i + 2; j < n; j++) {
                if (i === 0 && j === n - 1) continue;      // that pair is a side
                out += `<line class="py-diag" x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}"` +
                    ` x2="${pts[j][0].toFixed(1)}" y2="${pts[j][1].toFixed(1)}"/>`;
            }
        }
        return out;
    }

    /* A regular n-gon has exactly n axes of symmetry: through every vertex and
     * through every edge midpoint. For odd n each axis is one of each, for even
     * n they pair up vertex-to-vertex and midpoint-to-midpoint — so rather than
     * special-casing parity, collect both families of directions and dedupe
     * modulo 180 deg, which lands on n either way. */
    function pySymmetrySVG(n) {
        const dirs = [];
        for (let i = 0; i < n; i++) {
            [90 + 180 / n + (i * 360) / n, 90 + (i * 360) / n].forEach((a) => {
                const d = ((a % 180) + 180) % 180;
                if (!dirs.some((e) => Math.abs(e - d) < 0.01 || Math.abs(e - d - 180) < 0.01)) dirs.push(d);
            });
        }
        const L = R * 1.1;
        return dirs.map((d) => {
            const dx = L * Math.cos(rad(d)), dy = L * Math.sin(rad(d));
            return `<line class="py-sym" x1="${(CX - dx).toFixed(1)}" y1="${(CY - dy).toFixed(1)}"` +
                ` x2="${(CX + dx).toFixed(1)}" y2="${(CY + dy).toFixed(1)}"/>`;
        }).join('');
    }

    // Interior-angle arc at every vertex, with the measurement written in when
    // there is room for it (past ~9 sides the labels collide).
    function pyAnglesSVG(pts, label) {
        const n = pts.length;
        let out = '';
        for (let i = 0; i < n; i++) {
            const v = pts[i], p = pts[(i - 1 + n) % n], q = pts[(i + 1) % n];
            const u1 = [(p[0] - v[0]) / pyDist(p, v), (p[1] - v[1]) / pyDist(p, v)];
            const u2 = [(q[0] - v[0]) / pyDist(q, v), (q[1] - v[1]) / pyDist(q, v)];
            const r = Math.min(20, Math.min(pyDist(p, v), pyDist(q, v)) * 0.3);
            const s = [v[0] + r * u1[0], v[1] + r * u1[1]];
            const e = [v[0] + r * u2[0], v[1] + r * u2[1]];
            // Interior angle of a convex polygon is under 180, so always the
            // short arc; the cross product only settles which way round it goes.
            const sweep = u1[0] * u2[1] - u1[1] * u2[0] > 0 ? 1 : 0;
            out += `<path class="py-arc" d="M ${s[0].toFixed(1)} ${s[1].toFixed(1)}` +
                ` A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${e[0].toFixed(1)} ${e[1].toFixed(1)}"/>`;
            if (label) {
                const bx = u1[0] + u2[0], by = u1[1] + u2[1];
                const bl = Math.hypot(bx, by) || 1;
                const tx = v[0] + ((r + 15) * bx) / bl, ty = v[1] + ((r + 15) * by) / bl;
                out += `<text class="py-angle-text" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${label}</text>`;
            }
        }
        return out;
    }

    function pyVertsSVG(pts) {
        return pts.map((p) =>
            `<circle class="py-vertex" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"/>`).join('');
    }

    /* Build the whole figure. `opts`: {diagonals, symmetry, angles, spin, fill}.
     * Symmetry axes and angle labels are only meaningful for a regular polygon,
     * so the caller passes `regular` and this decides. */
    function pySVG(pts, n, regular, opts) {
        const o = opts || {};
        let inner = '';
        if (o.symmetry && regular) inner += pySymmetrySVG(n);
        inner += `<polygon class="py-shape" points="${fmt(pts)}" fill="${o.fill || pyFill(n)}"/>`;
        if (o.diagonals) inner += pyDiagonalsSVG(pts);
        if (o.angles) inner += pyAnglesSVG(pts, regular && n <= 9 ? pyDeg(pyInterior(n)) : '');
        inner += pyVertsSVG(pts);
        return `<svg class="py-svg" viewBox="0 0 ${VB} ${VB}" xmlns="http://www.w3.org/2000/svg">` +
            `<g class="${o.spin ? 'py-spin' : ''}">${inner}</g></svg>`;
    }

    /* ========================================================================
     * STATE
     * ======================================================================*/

    /* Anything answered in degrees — angle sum, interior angle, exterior turn —
     * is Hard only. Easy and Medium stay on counting and naming. */
    const PY_LEVELS = {
        easy:   { min: 3, max: 6,  types: ['name', 'sides', 'regular'] },
        medium: { min: 3, max: 10, types: ['name', 'sides', 'regular', 'symmetry'] },
        hard:   { min: 3, max: 12, types: ['name', 'sides', 'regular', 'symmetry',
            'sum', 'interior', 'exterior', 'diagonals'] },
    };

    const py = {
        mode: 'draw',            // 'draw' | 'quiz'
        sides: 6,
        show: { diagonals: false, symmetry: false, angles: false, spin: false },
        level: 'easy',
        irregular: false,        // include irregular shapes in the quiz
        score: 0,
        locked: false,
        q: null,                 // the live question
    };

    /* ========================================================================
     * DRAW MODE
     * ======================================================================*/

    function pyRenderDraw() {
        const n = py.sides;
        document.getElementById('py-sides-val').textContent = n;
        document.getElementById('py-slider').value = n;
        document.getElementById('py-minus').disabled = n <= MIN_SIDES;
        document.getElementById('py-plus').disabled = n >= MAX_SIDES;
        document.getElementById('py-name').textContent = pyName(n, true);

        document.getElementById('py-draw-stage').innerHTML =
            pySVG(pyRegularPts(n), n, true, {
                diagonals: py.show.diagonals,
                symmetry: py.show.symmetry,
                angles: py.show.angles,
                spin: py.show.spin,
            });

        const facts = [
            ['Sides', n],
            ['Corners', n],
            ['Angles add to', pyDeg(pyAngleSum(n))],
            ['Each angle', pyDeg(pyInterior(n))],
            ['Turn at each corner', pyDeg(pyExterior(n))],
            ['Lines of symmetry', n],
            ['Fits onto itself', n + ' ways'],
            ['Diagonals', pyDiagonals(n)],
        ];
        document.getElementById('py-facts').innerHTML = facts.map(([k, v]) =>
            `<div class="py-fact"><span class="py-fact-k">${k}</span><span class="py-fact-v">${v}</span></div>`).join('');
    }

    function pySetSides(n) {
        py.sides = Math.max(MIN_SIDES, Math.min(MAX_SIDES, n));
        pyRenderDraw();
    }

    /* ========================================================================
     * QUIZ MODE
     * ======================================================================*/

    /* Wrong answers are the RIGHT answers to a neighbouring side count, which
     * makes them plausible rather than random — a distractor of "417 degrees"
     * teaches nothing. `extra` adds the classic misconception for that type. */
    function pyNumericChoices(n, lvl, compute, format, extra) {
        const correct = format(compute(n));
        const seen = new Set([correct]);
        const wrong = [];
        // Walk outwards from n so the distractors are the nearest neighbours.
        for (let d = 1; d <= lvl.max - lvl.min + 2 && wrong.length < 6; d++) {
            [n - d, n + d].forEach((m) => {
                if (m < MIN_SIDES || m > MAX_SIDES) return;
                const v = format(compute(m));
                if (seen.has(v)) return;
                seen.add(v);
                wrong.push(v);
            });
        }
        (extra || []).forEach((v) => {
            const s = format(v);
            if (!seen.has(s)) { seen.add(s); wrong.unshift(s); }   // misconceptions first
        });
        return { correct, choices: shuffle([correct].concat(wrong.slice(0, 3))) };
    }

    function pyNameChoices(n, regular, lvl) {
        const correct = pyName(n, regular);
        const others = [];
        for (let m = MIN_SIDES; m <= Math.max(lvl.max, 8); m++) {
            if (m === n) continue;
            others.push(pyName(m, regular));
        }
        return { correct, choices: shuffle([correct].concat(shuffle(others).slice(0, 3))) };
    }

    function pyMakeQuestion() {
        const lvl = PY_LEVELS[py.level];
        const types = lvl.types.filter((t) => t !== 'regular' || py.irregular);
        const type = pick(types);
        const n = lvl.min + rand(lvl.max - lvl.min + 1);

        // Which shapes may be drawn irregular: the ones where the answer does
        // not depend on the shape being regular. Interior angle, exterior angle
        // and symmetry all do, so those stay regular.
        const mayVary = py.irregular && ['name', 'sides', 'sum', 'diagonals'].indexOf(type) !== -1;
        let regular = type === 'regular' ? Math.random() < 0.5 : !(mayVary && Math.random() < 0.5);
        // A jittered many-sided blob is unreadable, so keep big shapes regular.
        if (n > 8) regular = type === 'regular' ? true : regular;
        const pts = regular ? pyRegularPts(n) : pyIrregularPts(n);

        const q = { n, regular, pts };

        if (type === 'name') {
            const c = pyNameChoices(n, regular, lvl);
            q.text = 'What is this shape called?';
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `${c.correct} — ${n} sides, ${n} corners.`;
            q.node = 'geom.name2d';
        } else if (type === 'sides') {
            const c = pyNumericChoices(n, lvl, (m) => m, String);
            q.text = 'How many sides does this shape have?';
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `${n} sides — that makes it a ${pyName(n, false).toLowerCase()}.`;
            q.node = 'geom.name2d';
        } else if (type === 'regular') {
            q.text = 'Is this polygon regular?';
            q.choices = ['Regular', 'Irregular'];
            q.correct = regular ? 'Regular' : 'Irregular';
            q.explain = regular
                ? 'Regular — every side the same length, every angle the same size.'
                : 'Irregular — the sides are not all the same length.';
            q.node = 'geom.attributes';
        } else if (type === 'symmetry') {
            const c = pyNumericChoices(n, lvl, (m) => m, String, [pyDiagonals(n)]);
            q.text = `How many lines of symmetry does this regular ${pyName(n, false).toLowerCase()} have?`;
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `${n} — one through each corner and each edge, and for a regular polygon that always comes to the number of sides.`;
            q.node = 'geom.symmetry';
        } else if (type === 'sum') {
            const c = pyNumericChoices(n, lvl, pyAngleSum, pyDeg, [n * 180, 360]);
            q.text = 'What do the angles inside this shape add up to?';
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `(${n} − 2) × 180° = ${pyDeg(pyAngleSum(n))}. It only depends on the number of sides, regular or not.`;
            q.node = 'geom.linesAngles';
        } else if (type === 'interior') {
            const c = pyNumericChoices(n, lvl, pyInterior, pyDeg, [pyExterior(n), pyAngleSum(n)]);
            q.text = `How big is each angle in this regular ${pyName(n, false).toLowerCase()}?`;
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `${pyDeg(pyAngleSum(n))} shared between ${n} equal corners = ${pyDeg(pyInterior(n))}.`;
            q.node = 'geom.linesAngles';
        } else if (type === 'exterior') {
            const c = pyNumericChoices(n, lvl, pyExterior, pyDeg, [pyInterior(n)]);
            q.text = 'Walking right round the edge, how far do you turn at each corner?';
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `360° ÷ ${n} = ${pyDeg(pyExterior(n))} — one full turn shared between the corners.`;
            q.node = 'geom.linesAngles';
        } else {
            const c = pyNumericChoices(n, lvl, pyDiagonals, String, [n, n * (n - 3)]);
            q.text = 'How many diagonals can be drawn inside this shape?';
            q.choices = c.choices;
            q.correct = c.correct;
            q.explain = `${n} × (${n} − 3) ÷ 2 = ${pyDiagonals(n)}.`;
            q.node = 'geom.attributes';
        }
        return q;
    }

    function pyNewQuestion() {
        py.locked = false;
        py.q = pyMakeQuestion();
        const q = py.q;

        document.getElementById('py-question').textContent = q.text;
        document.getElementById('py-quiz-stage').innerHTML = pySVG(q.pts, q.n, q.regular, {});
        document.getElementById('py-explain').textContent = '';
        document.getElementById('py-choices').innerHTML = q.choices.map((c) =>
            `<button class="py-choice" data-py-choice="${String(c).replace(/"/g, '&quot;')}">${c}</button>`).join('');
    }

    function pyAnswer(value) {
        if (py.locked) return;
        py.locked = true;
        const q = py.q;
        const correct = value === q.correct;

        document.querySelectorAll('#py-choices .py-choice').forEach((btn) => {
            btn.disabled = true;
            if (btn.dataset.pyChoice === q.correct) btn.classList.add('py-right');
            else if (btn.dataset.pyChoice === value) btn.classList.add('py-wrong');
        });
        document.getElementById('py-explain').textContent = (correct ? '✓ ' : '✗ ') + q.explain;

        if (typeof recordPractice === 'function') recordPractice(q.node, correct, 'polygons');
        if (correct) {
            py.score++;
            document.getElementById('py-score').textContent = 'Score: ' + py.score;
        }
        setTimeout(pyNewQuestion, correct ? 1600 : 2600);
    }

    /* ========================================================================
     * MODE SWITCHING
     * ======================================================================*/

    function pySetMode(mode) {
        py.mode = mode;
        document.querySelectorAll('.py-mode-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.pyMode === mode));
        document.getElementById('py-draw').classList.toggle('hidden', mode !== 'draw');
        document.getElementById('py-quiz').classList.toggle('hidden', mode !== 'quiz');
        if (mode === 'draw') pyRenderDraw();
        else pyNewQuestion();
    }

    function pySetLevel(level) {
        py.level = level;
        document.querySelectorAll('.py-level-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.pyLevel === level));
        pyNewQuestion();
    }

    function pyEnter() {
        showScreen('polygons');
        if (py.mode === 'draw') pyRenderDraw();
        else pyNewQuestion();
    }

    /* ========================================================================
     * MARKUP
     * ======================================================================*/

    const SCREEN_HTML = `
        <div class="container py-container">
            <div class="py-config">
                <div class="tt-btn-group" id="py-mode-group">
                    <button class="btn btn-secondary py-mode-btn active" data-py-mode="draw">Draw</button>
                    <button class="btn btn-secondary py-mode-btn" data-py-mode="quiz">Quiz</button>
                </div>
            </div>

            <div id="py-draw">
                <div class="py-sides-row">
                    <button id="py-minus" class="py-round-btn" aria-label="One fewer side">−</button>
                    <span id="py-sides-val" class="py-sides-val">6</span>
                    <button id="py-plus" class="py-round-btn" aria-label="One more side">+</button>
                    <input type="range" id="py-slider" class="py-slider"
                           min="${MIN_SIDES}" max="${MAX_SIDES}" step="1" value="6" aria-label="Number of sides">
                </div>
                <div id="py-name" class="py-name">Hexagon</div>
                <div id="py-draw-stage" class="py-stage"></div>
                <div class="py-toggles" id="py-toggles">
                    <button class="py-chip" data-py-show="diagonals">Diagonals</button>
                    <button class="py-chip" data-py-show="symmetry">Lines of symmetry</button>
                    <button class="py-chip" data-py-show="angles">Angles</button>
                    <button class="py-chip" data-py-show="spin">Spin</button>
                </div>
                <div id="py-facts" class="py-facts"></div>
            </div>

            <div id="py-quiz" class="hidden">
                <div class="py-config">
                    <div class="tt-btn-group" id="py-level-group">
                        <button class="btn btn-secondary py-level-btn active" data-py-level="easy">Easy</button>
                        <button class="btn btn-secondary py-level-btn" data-py-level="medium">Medium</button>
                        <button class="btn btn-secondary py-level-btn" data-py-level="hard">Hard</button>
                    </div>
                    <button id="py-irregular" class="py-chip">Include irregular</button>
                </div>
                <div class="py-score-bar"><span id="py-score">Score: 0</span></div>
                <div id="py-question" class="py-question"></div>
                <div id="py-quiz-stage" class="py-stage"></div>
                <div id="py-choices" class="py-choices"></div>
                <div id="py-explain" class="py-explain"></div>
            </div>
        </div>`;

    /* ========================================================================
     * BOOT
     * ======================================================================*/

    function injectStylesheet() {
        if (document.querySelector('link[data-py-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'polygons.css?v=' + (window.ASSET_V || '1');
        link.dataset.pyCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('polygons-screen')) return;
        const div = document.createElement('div');
        div.id = 'polygons-screen';
        div.className = 'screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');   // screens are body-level
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        // boot.js pre-creates this so the tab keeps its place in the bar while
        // this file is still being fetched. Don't add a second one.
        if (!bar || bar.querySelector('.tab-btn[data-tab="polygons"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'polygons';
        btn.textContent = 'Polygons';
        bar.appendChild(btn);
    }

    function wire() {
        document.getElementById('py-mode-group').addEventListener('click', (e) => {
            const btn = e.target.closest('.py-mode-btn');
            if (btn) pySetMode(btn.dataset.pyMode);
        });
        document.getElementById('py-minus').addEventListener('click', () => pySetSides(py.sides - 1));
        document.getElementById('py-plus').addEventListener('click', () => pySetSides(py.sides + 1));
        document.getElementById('py-slider').addEventListener('input', (e) =>
            pySetSides(parseInt(e.target.value, 10)));
        document.getElementById('py-toggles').addEventListener('click', (e) => {
            const btn = e.target.closest('.py-chip');
            if (!btn) return;
            const key = btn.dataset.pyShow;
            py.show[key] = !py.show[key];
            btn.classList.toggle('active', py.show[key]);
            pyRenderDraw();
        });
        document.getElementById('py-level-group').addEventListener('click', (e) => {
            const btn = e.target.closest('.py-level-btn');
            if (btn) pySetLevel(btn.dataset.pyLevel);
        });
        document.getElementById('py-irregular').addEventListener('click', (e) => {
            py.irregular = !py.irregular;
            e.currentTarget.classList.toggle('active', py.irregular);
            pyNewQuestion();
        });
        document.getElementById('py-choices').addEventListener('click', (e) => {
            const btn = e.target.closest('.py-choice');
            if (btn) pyAnswer(btn.dataset.pyChoice);
        });
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.polygons = 'polygons';
        TAB_ENTRY.polygons = pyEnter;
        wire();
    }

    // Debug handle for the validation scripts, same convention as __GP.
    window.__PY = { PY_NAMES, PY_LEVELS, pyRegularPts, pyIrregularPts, pySideLengths,
        pyMakeQuestion, state: py };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
