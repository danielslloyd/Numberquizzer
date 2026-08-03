/* ============================================================================
 * patterns.js — the Patterns tab: number sequences, three tiers.
 *
 * Self-contained plug-in, same shape as language-arts.js / polygons.js /
 * sounds.js: one IIFE that injects its own stylesheet, screen and tab,
 * registers into the global TAB_ENTRY / SCREEN_TAB, and touches no other file.
 * Prefix `np`.
 *
 * The shape of the thing:
 *
 *   A FAMILY knows how to build one kind of sequence (count by 7, double each
 *   time, square numbers, Fibonacci…) and how to say its rule in words. Every
 *   family also carries a `holds` predicate that re-derives the pattern from
 *   the finished terms. Nothing here trusts the generator: `npMake` throws a
 *   sequence away if its own family cannot see the pattern in it, which is the
 *   only defence against a question with two defensible answers.
 *
 *   A KIND is what is being asked — the next term, a term missing from the
 *   middle, or the rule itself. Kinds are gated by tier, not by family, so the
 *   same sequence can be asked about three ways.
 *
 * Two rules worth keeping:
 *
 *   Distractors are near misses with a REASON — one step too far, the right
 *   arithmetic on the wrong term, the operation confused for its neighbour.
 *   A random number is not a wrong answer, it is a free pass.
 *
 *   The step labels between the tiles are computed from the terms themselves
 *   (`npStepLabels`), never from the generator's intent. They are revealed on
 *   answering and they are the explanation — so they have to be true of the
 *   numbers on screen even if a generator is wrong.
 * ==========================================================================*/
(function () {
    'use strict';

    /* ---- tiny utilities ---------------------------------------------------*/
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
    const signed = (n) => (n >= 0 ? '+' + n : '−' + Math.abs(n));   // real minus sign
    const neat = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));
    /* Every "add N / subtract N" rule string in the file comes from here. Built
     * by hand it reads "add -9 each time" the moment a step goes negative,
     * which is both ugly and a different claim from the one being made. */
    const arithRule = (d) => (d >= 0 ? 'add ' + d + ' each time' : 'subtract ' + (-d) + ' each time');

    /* ========================================================================
     * FAMILIES
     *
     * gen()   -> { terms, rule, meta }
     * holds() -> is the pattern actually present in these terms?
     * ======================================================================*/

    const diffs = (t) => t.slice(1).map((v, i) => v - t[i]);
    const allSame = (a) => a.every((v) => v === a[0]);

    const FAMILIES = {
        /* Count by X. The easy tier starts on a multiple of the step so it is
         * literally the counting sequence a child has chanted. */
        arith: {
            label: 'counting on',
            gen: function (level) {
                let d, a, n;
                if (level === 'easy') {
                    // The classic skip-counting set. Counting by ONE is not a
                    // pattern anybody has to spot, so it is not in here.
                    d = pick([2, 2, 3, 4, 5, 5, 10]);
                    a = d * ri(0, 3);
                    n = 6;
                } else if (level === 'medium') {
                    d = pick([3, 4, 6, 7, 8, 9, 11, 12, 15, 20, 25, -2, -3, -5, -10]);
                    a = d > 0 ? ri(1, 40) : ri(60, 120);
                    n = 6;
                } else {
                    d = pick([13, 14, 17, 19, 23, 25, 40, 50, -4, -7, -9, -12, -15]);
                    a = d > 0 ? ri(-20, 60) : ri(50, 140);
                    n = 6;
                }
                const terms = [];
                for (let i = 0; i < n; i++) terms.push(a + i * d);
                return { terms: terms, rule: arithRule(d), meta: { d: d } };
            },
            holds: function (t) { return t.length > 2 && allSame(diffs(t)); },
        },

        /* Double, treble, times ten — and halving, which is the same idea run
         * backwards and the one that catches people out. */
        geom: {
            label: 'multiplying',
            gen: function (level) {
                const r = level === 'medium' ? pick([2, 2, 3, 10]) : pick([2, 3, 3, 10, 0.5]);
                const n = r === 10 ? 5 : 6;
                let a;
                if (r === 0.5) a = Math.pow(2, n - 1) * ri(1, 3);    // stays whole all the way down
                else if (r === 10) a = ri(1, 9);
                else a = ri(1, r === 2 ? 6 : 3);
                const terms = [];
                let v = a;
                for (let i = 0; i < n; i++) { terms.push(v); v *= r; }
                return {
                    terms: terms,
                    rule: r === 0.5 ? 'halve it each time' : 'multiply by ' + r + ' each time',
                    meta: { r: r },
                };
            },
            holds: function (t) {
                if (t.length < 3 || t.some((v) => v === 0)) return false;
                const r = t[1] / t[0];
                return t.slice(1).every((v, i) => Math.abs(v / t[i] - r) < 1e-9);
            },
        },

        /* The step itself grows. This is where "find the difference, then find
         * the difference of the differences" starts paying off. */
        grow: {
            label: 'a growing step',
            gen: function (level) {
                const inc = level === 'medium' ? 1 : ri(1, 4);
                const d0 = ri(1, level === 'medium' ? 3 : 6);
                let v = ri(1, 8), step = d0;
                const terms = [];
                for (let i = 0; i < 6; i++) { terms.push(v); v += step; step += inc; }
                return {
                    terms: terms,
                    rule: 'the step grows by ' + inc + ' each time',
                    meta: { inc: inc },
                };
            },
            holds: function (t) { return t.length > 3 && allSame(diffs(diffs(t))); },
        },

        square: {
            label: 'square numbers',
            gen: function () {
                const s = ri(1, 4);
                const terms = [];
                for (let i = 0; i < 6; i++) terms.push((s + i) * (s + i));
                return { terms: terms, rule: 'square numbers', meta: { s: s } };
            },
            holds: function (t) {
                return t.every((v) => v > 0 && Number.isInteger(Math.sqrt(v)))
                    && allSame(diffs(diffs(t)));
            },
        },

        triangle: {
            label: 'triangular numbers',
            gen: function () {
                const s = ri(1, 4);
                const terms = [];
                for (let i = 0; i < 6; i++) { const n = s + i; terms.push((n * (n + 1)) / 2); }
                return { terms: terms, rule: 'add one more each time (triangular numbers)', meta: {} };
            },
            holds: function (t) { return t.length > 3 && diffs(diffs(t)).every((v) => v === 1); },
        },

        fib: {
            label: 'adding the two before',
            gen: function () {
                const a = ri(1, 4), b = a + ri(1, 5);
                const terms = [a, b];
                for (let i = 2; i < 7; i++) terms.push(terms[i - 1] + terms[i - 2]);
                return { terms: terms, rule: 'add the two before it', meta: {} };
            },
            holds: function (t) {
                if (t.length < 5) return false;
                for (let i = 2; i < t.length; i++) if (t[i] !== t[i - 1] + t[i - 2]) return false;
                // A constant difference would also satisfy the above only by
                // accident, but an arithmetic run is a different question — so
                // reject anything that is ALSO plain counting.
                return !allSame(diffs(t));
            },
        },

        /* Two operations taking turns. Rising overall, so it never reads as a
         * mistake in the sequence. */
        alt: {
            label: 'two steps taking turns',
            gen: function () {
                const p = ri(4, 12), q = ri(1, p - 2);
                let v = ri(2, 20);
                const terms = [];
                for (let i = 0; i < 7; i++) { terms.push(v); v += (i % 2 === 0) ? p : -q; }
                return {
                    terms: terms,
                    rule: 'add ' + p + ', then subtract ' + q + ', over and over',
                    meta: { p: p, q: q },
                };
            },
            holds: function (t) {
                const d = diffs(t);
                if (d.length < 4) return false;
                const odd = d.filter((_, i) => i % 2 === 1);
                const even = d.filter((_, i) => i % 2 === 0);
                return allSame(even) && allSame(odd) && even[0] !== odd[0];
            },
        },

        /* Two sequences woven together — the one that looks like nonsense until
         * you read every other number. */
        weave: {
            label: 'two patterns woven together',
            gen: function () {
                const a1 = ri(1, 6), d1 = ri(1, 5);
                const a2 = ri(20, 60), d2 = pick([10, 10, 5, -5, -10]);
                const terms = [];
                for (let i = 0; i < 4; i++) {
                    terms.push(a1 + i * d1);
                    terms.push(a2 + i * d2);
                }
                return { terms: terms, rule: 'two patterns taking turns — read every other number', meta: {} };
            },
            holds: function (t) {
                const even = t.filter((_, i) => i % 2 === 0);
                const odd = t.filter((_, i) => i % 2 === 1);
                return even.length > 2 && odd.length > 2
                    && allSame(diffs(even)) && allSame(diffs(odd))
                    && !allSame(diffs(t));       // must not also be plain counting
            },
        },
    };

    const TIERS = {
        easy:   { families: ['arith'], kinds: ['next'] },
        medium: { families: ['arith', 'geom', 'grow', 'alt', 'triangle'], kinds: ['next', 'next', 'missing', 'rule'] },
        hard:   { families: ['arith', 'geom', 'grow', 'square', 'triangle', 'fib', 'alt', 'weave'],
            kinds: ['next', 'missing', 'missing', 'rule'] },
    };

    // Nothing on screen should need more than four digits to read.
    const MAXV = 9999;

    /* ---- the labels between the tiles -------------------------------------
     * Derived from the terms, never from the generator's intent. They are the
     * explanation, so they must be true of the numbers actually shown. */
    function npStepLabels(terms, family) {
        if (family === 'geom') {
            return terms.slice(1).map((v, i) => {
                const r = v / terms[i];
                return r === 0.5 ? '÷2' : '×' + r;
            });
        }
        return terms.slice(1).map((v, i) => signed(v - terms[i]));
    }

    /* ---- distractors ------------------------------------------------------
     * Every wrong answer is a mistake somebody actually makes: one step too
     * far or short, the step applied to the wrong term, or the operation
     * mistaken for its neighbour. */
    function npDistractors(ans, terms, at, family, meta) {
        const prev = at > 0 ? terms[at - 1] : null;
        const d = prev === null ? null : ans - prev;
        const cands = [];

        if (d !== null) {
            cands.push(ans + d, ans - d);        // one step over, one step short
            if (family === 'geom') {
                cands.push(prev + meta.r, prev + prev);   // added instead of multiplied
                cands.push(ans * meta.r);
            }
            if (family === 'grow' || family === 'square' || family === 'triangle') {
                cands.push(prev + (d - (meta.inc || 1)));  // forgot the step grows
                cands.push(prev + d + (meta.inc || 1));    // grew it twice
            }
            if (family === 'alt') cands.push(prev - (ans - prev));   // wrong turn
        }
        cands.push(ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10);

        const seen = new Set([ans]);
        const out = [];
        cands.forEach((v) => {
            if (!Number.isInteger(v) || seen.has(v) || Math.abs(v) > MAXV) return;
            if (terms.every((t) => t >= 0) && v < 0) return;   // no negatives in a positive run
            seen.add(v);
            out.push(v);
        });
        return out.slice(0, 3);
    }

    // Rule questions: the wrong rules are other families' real rules, plus a
    // near-miss of the right one, so "it goes up" is not enough to choose.
    function npRuleChoices(q) {
        const wrong = [];
        const m = q.meta || {};
        // The near miss keeps the direction of travel and steps away from zero,
        // so a run going down never offers "add 0 each time".
        const firstStep = arithRule(q.terms[1] - q.terms[0]);
        if (q.family === 'arith') {
            wrong.push(arithRule(m.d + (m.d >= 0 ? 1 : -1)), 'multiply by 2 each time',
                'the step grows by 1 each time');
        } else if (q.family === 'geom') {
            wrong.push(firstStep, 'the step grows by 1 each time', 'add the two before it');
        } else if (q.family === 'grow' || q.family === 'triangle') {
            wrong.push(firstStep, 'multiply by 2 each time', 'add the two before it');
        } else if (q.family === 'alt') {
            wrong.push(firstStep, 'the step grows by 1 each time', 'multiply by 2 each time');
        } else {
            wrong.push(firstStep, 'multiply by 2 each time', 'the step grows by 1 each time');
        }
        const out = [];
        wrong.forEach((w) => { if (w !== q.rule && out.indexOf(w) === -1 && out.length < 3) out.push(w); });
        return shuffle([q.rule].concat(out));
    }

    /* ---- building one question -------------------------------------------*/

    function npMake(level) {
        const tier = TIERS[level] || TIERS.easy;
        for (let attempt = 0; attempt < 60; attempt++) {
            const familyId = pick(tier.families);
            const F = FAMILIES[familyId];
            const built = F.gen(level);
            const terms = built.terms;

            if (terms.some((v) => !Number.isInteger(v) || Math.abs(v) > MAXV)) continue;
            if (level === 'easy' && terms.some((v) => v < 0)) continue;
            // The generator is not trusted: if the family cannot see its own
            // pattern in the finished terms, the question is thrown away.
            if (!F.holds(terms)) continue;

            const kind = pick(tier.kinds);
            const q = {
                level: level, family: familyId, terms: terms, rule: built.rule, meta: built.meta,
                kind: kind, steps: npStepLabels(terms, familyId),
            };

            if (kind === 'rule') {
                q.at = -1;
                q.prompt = 'What is the rule?';
                q.answer = built.rule;
                q.choices = npRuleChoices(q);
                q.explain = 'The rule is: ' + built.rule + '.';
            } else {
                // `next` hides the last tile; `missing` hides one from the
                // middle, which cannot be answered by carrying on and has to be
                // answered from the rule.
                q.at = kind === 'next' ? terms.length - 1 : ri(1, terms.length - 2);
                q.prompt = kind === 'next' ? 'What comes next?' : 'Which number is missing?';
                q.answer = terms[q.at];
                const wrong = npDistractors(q.answer, terms, q.at, familyId, built.meta);
                if (wrong.length < 3) continue;
                q.choices = shuffle([q.answer].concat(wrong));
                q.explain = 'It is ' + neat(q.answer) + ' — ' + built.rule + '.';
            }
            return q;
        }
        // Falls back to the plainest possible question rather than returning
        // nothing; unreachable in practice, but a quiz with no question is not
        // a failure mode worth having.
        const terms = [2, 4, 6, 8, 10, 12];
        return { level: level, family: 'arith', terms: terms, rule: 'add 2 each time', meta: { d: 2 },
            kind: 'next', at: 5, answer: 12, choices: shuffle([12, 14, 11, 10]),
            steps: npStepLabels(terms, 'arith'), prompt: 'What comes next?',
            explain: 'It is 12 — add 2 each time.' };
    }

    /* ========================================================================
     * STATE AND UI
     * ======================================================================*/

    const np = { level: 'easy', score: 0, streak: 0, best: 0, locked: false, q: null };

    function npRenderSequence(reveal) {
        const q = np.q;
        const host = document.getElementById('np-seq');
        let html = '';
        q.terms.forEach((v, i) => {
            const hidden = i === q.at && !reveal;
            let cls = 'np-tile';
            if (hidden) cls += ' np-tile-blank';
            else if (i === q.at) cls += reveal === 'right' ? ' np-tile-filled' : ' np-tile-missed';
            html += `<span class="${cls}">${hidden ? '?' : neat(v)}</span>`;
            if (i < q.terms.length - 1) {
                html += `<span class="np-step${reveal ? ' np-step-show' : ''}">${q.steps[i]}</span>`;
            }
        });
        host.innerHTML = html;
    }

    function npNewQuestion() {
        np.locked = false;
        np.q = npMake(np.level);
        document.getElementById('np-prompt').textContent = np.q.prompt;
        document.getElementById('np-explain').textContent = '';
        npRenderSequence(null);

        const wide = np.q.kind === 'rule';
        const box = document.getElementById('np-choices');
        box.classList.toggle('np-choices-wide', wide);
        box.innerHTML = np.q.choices.map((c) => {
            const label = typeof c === 'number' ? neat(c) : c;
            return `<button class="np-choice" data-np-choice="${String(c).replace(/"/g, '&quot;')}">${label}</button>`;
        }).join('');
    }

    function npAnswer(raw) {
        if (np.locked) return;
        np.locked = true;
        const q = np.q;
        const value = typeof q.answer === 'number' ? Number(raw) : raw;
        const correct = value === q.answer;

        document.querySelectorAll('#np-choices .np-choice').forEach((btn) => {
            btn.disabled = true;
            const v = typeof q.answer === 'number' ? Number(btn.dataset.npChoice) : btn.dataset.npChoice;
            if (v === q.answer) btn.classList.add('np-right');
            else if (v === value) btn.classList.add('np-wrong');
        });

        // The steps between the tiles come out either way — a wrong answer is
        // the moment the pattern is most worth seeing.
        npRenderSequence(correct ? 'right' : 'wrong');
        document.getElementById('np-explain').textContent = (correct ? '✓ ' : '✗ ') + q.explain;

        if (correct) {
            np.score++;
            np.streak++;
            np.best = Math.max(np.best, np.streak);
        } else {
            np.streak = 0;
        }
        npScore();
        // Naming the rule and continuing the sequence are different skills and
        // the curriculum already separates them.
        if (typeof recordPractice === 'function') {
            recordPractice(q.kind === 'rule' ? 'alg.rule.apply' : 'alg.pattern.extend', correct, 'patterns');
        }
        setTimeout(npNewQuestion, correct ? 1700 : 2900);
    }

    function npScore() {
        document.getElementById('np-score').textContent = 'Score: ' + np.score;
        document.getElementById('np-streak').textContent = 'Streak: ' + np.streak +
            (np.best > 1 ? ' (best ' + np.best + ')' : '');
    }

    function npSetLevel(level) {
        np.level = level;
        np.streak = 0;
        document.querySelectorAll('.np-level-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.npLevel === level));
        npScore();
        npNewQuestion();
    }

    function npEnter() {
        showScreen('patterns');
        npScore();
        npNewQuestion();
    }

    const SCREEN_HTML = `
        <div class="container np-container">
            <div class="np-config">
                <div class="tt-btn-group" id="np-level-group">
                    <button class="btn btn-secondary np-level-btn active" data-np-level="easy">Easy</button>
                    <button class="btn btn-secondary np-level-btn" data-np-level="medium">Medium</button>
                    <button class="btn btn-secondary np-level-btn" data-np-level="hard">Hard</button>
                </div>
            </div>
            <div class="np-score-bar">
                <span id="np-score">Score: 0</span>
                <span id="np-streak">Streak: 0</span>
            </div>
            <div id="np-prompt" class="np-prompt"></div>
            <div id="np-seq" class="np-seq"></div>
            <div id="np-choices" class="np-choices"></div>
            <div id="np-explain" class="np-explain"></div>
        </div>`;

    /* ---- boot -------------------------------------------------------------*/

    function injectStylesheet() {
        if (document.querySelector('link[data-np-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'patterns.css?v=' + (window.ASSET_V || '1');
        link.dataset.npCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('patterns-screen')) return;
        const div = document.createElement('div');
        div.id = 'patterns-screen';
        div.className = 'screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');   // screens are body-level
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        // boot.js pre-creates this so the tab keeps its place while the file is
        // still being fetched. Don't add a second one.
        if (!bar || bar.querySelector('.tab-btn[data-tab="patterns"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'patterns';
        btn.textContent = 'Patterns';
        bar.appendChild(btn);
    }

    function wire() {
        document.getElementById('np-level-group').addEventListener('click', (e) => {
            const btn = e.target.closest('.np-level-btn');
            if (btn) npSetLevel(btn.dataset.npLevel);
        });
        document.getElementById('np-choices').addEventListener('click', (e) => {
            const btn = e.target.closest('.np-choice');
            if (btn) npAnswer(btn.dataset.npChoice);
        });
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.patterns = 'patterns';
        TAB_ENTRY.patterns = npEnter;
        wire();
    }

    // Debug handle for the smoke test, same convention as __GP / __PY / __VS.
    window.__NP = { FAMILIES, TIERS, npMake, npStepLabels, npDistractors, state: np };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
