/*
 * Item generators for the fractions ladder.
 *
 * Fractions get the largest share of the curated list because elementary
 * fraction and whole-number division knowledge predicts high-school algebra
 * years later more strongly than whole-number arithmetic does. So this is the
 * pack that gets built first and gets the most care.
 *
 * Rules for every generator in this file and any other:
 *
 *   - Take `rng` and use it for ALL randomness. Never Math.random(). Determinism
 *     is what makes an item reproducible, printable with a matching key, and
 *     testable.
 *   - Return an item whose own `answer` grades correct through its own declared
 *     grader. tools/smoke-generators.js asserts exactly this for every node,
 *     because showing a child a wrong answer is the worst failure this app has.
 *   - Where a node names a misconception, put it in the distractors. A wrong
 *     option that nobody would pick teaches nothing; the one a learner actually
 *     believes is the whole diagnostic.
 */
(function () {
    'use strict';

    // ---- helpers ---------------------------------------------------------
    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a || 1; }
    function fstr(n, d) { return n + '/' + d; }
    const NAMES = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 8: 'eighths', 10: 'tenths', 12: 'twelfths' };
    const NAME1 = { 2: 'a half', 3: 'a third', 4: 'a quarter', 5: 'a fifth', 6: 'a sixth', 8: 'an eighth', 10: 'a tenth', 12: 'a twelfth' };

    function dens(params) { return (params && params.dens) || [2, 3, 4, 6, 8]; }
    function shape(rng) { return rng.bool() ? 'fraction-bar' : 'fraction-pie'; }

    /*
     * Build a multiple-choice item. Distractors are de-duplicated against the
     * correct label and each other, then everything is shuffled — so `answer` is
     * always the post-shuffle index and never a fixed position a learner could
     * pattern-match.
     */
    function mc(rng, opts) {
        const labels = [opts.correct];
        (opts.distractors || []).forEach((d) => {
            if (d !== null && d !== undefined && labels.indexOf(d) === -1) labels.push(d);
        });
        while (labels.length < 2) labels.push('none of these');

        const order = rng.shuffle(labels.map((l, i) => ({ l: l, orig: i })));
        return {
            type: 'mc',
            stem: opts.stem,
            prompt: opts.prompt,
            choices: order.map((o) => o.l),
            answer: order.findIndex((o) => o.orig === 0),
            grade: 'exact',
            hint: opts.hint,
            explain: opts.explain,
            sig: opts.sig || (opts.stem + '|' + opts.correct),
        };
    }

    function fracAnswer(opts) {
        return {
            type: 'fraction',
            stem: opts.stem,
            prompt: opts.prompt,
            answer: { num: opts.num, den: opts.den },
            grade: 'fraction',
            gradeOpts: opts.lowest ? { lowest: true } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: opts.sig,
        };
    }

    function numAnswer(opts) {
        return {
            type: 'numeric',
            stem: opts.stem,
            prompt: opts.prompt,
            answer: opts.answer,
            grade: 'numeric',
            gradeOpts: opts.tol ? { tol: opts.tol } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: opts.sig,
        };
    }

    function nlItem(opts) {
        return {
            type: 'numberline',
            stem: opts.stem,
            prompt: [{ t: 'text', s: opts.stem }],
            line: opts.line,
            answer: opts.answer,
            grade: 'numeric',
            // A twentieth of the span. The skill is magnitude estimation, not
            // pixel accuracy, so the tolerance is deliberately generous.
            gradeOpts: { tol: ((opts.line.hi - opts.line.lo) || 1) / 20 },
            hint: opts.hint,
            explain: opts.explain,
            sig: opts.sig,
        };
    }

    // ---- generators ------------------------------------------------------
    const G = {};

    G['frac.equalShares'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => NAMES[x]));
        const others = dens(p).filter((x) => x !== d && NAMES[x]);
        return mc(rng, {
            stem: 'This shape is cut into equal pieces. What are the pieces called?',
            prompt: [
                { t: 'text', s: 'This shape is cut into equal pieces. What are the pieces called?' },
                { t: 'svg', draw: shape(rng), args: { num: 0, den: d } },
            ],
            correct: NAMES[d],
            distractors: rng.sample(others, 2).map((x) => NAMES[x]),
            explain: 'It is cut into ' + d + ' equal pieces, so each one is ' + NAME1[d] + '.',
            sig: 'equalShares:' + d,
        });
    };

    G['frac.unit'] = function (rng, p) {
        const d = rng.pick(dens(p));
        const others = dens(p).filter((x) => x !== d);
        return mc(rng, {
            stem: 'What fraction of the shape is shaded?',
            prompt: [
                { t: 'text', s: 'What fraction is shaded?' },
                { t: 'svg', draw: shape(rng), args: { num: 1, den: d } },
            ],
            correct: fstr(1, d),
            // The classic slip is naming the unshaded pieces instead.
            distractors: [fstr(1, d - 1), fstr(d - 1, d)].concat(rng.sample(others, 1).map((x) => fstr(1, x))),
            explain: 'One piece out of ' + d + ' equal pieces is ' + fstr(1, d) + '.',
            sig: 'unit:' + d,
        });
    };

    G['frac.aOverB'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const n = rng.int(2, d - 1);
        return mc(rng, {
            stem: 'What fraction of the shape is shaded?',
            prompt: [
                { t: 'text', s: 'What fraction is shaded?' },
                { t: 'svg', draw: shape(rng), args: { num: n, den: d } },
            ],
            correct: fstr(n, d),
            distractors: [
                fstr(d - n, d),          // counted the unshaded pieces
                fstr(n, d - n),          // shaded over unshaded
                fstr(d, n),              // upside down
            ],
            explain: n + ' pieces are shaded out of ' + d + ' equal pieces, so ' + fstr(n, d) + '.',
            sig: 'aOverB:' + n + ':' + d,
        });
    };

    G['frac.sameWhole'] = function (rng) {
        const people = rng.sample(['Ana', 'Ben', 'Cleo', 'Dev', 'Esme', 'Finn'], 2);
        const a = rng.pick([[1, 2], [1, 3], [2, 3]]);
        const b = rng.pick([[1, 3], [1, 4], [3, 4]].filter((x) => x[0] / x[1] !== a[0] / a[1]));
        return mc(rng, {
            stem: people[0] + ' ate ' + fstr(a[0], a[1]) + ' of a small pizza. '
                + people[1] + ' ate ' + fstr(b[0], b[1]) + ' of a large pizza. Who ate more pizza?',
            prompt: [{
                t: 'text',
                s: people[0] + ' ate ' + fstr(a[0], a[1]) + ' of a small pizza. '
                    + people[1] + ' ate ' + fstr(b[0], b[1]) + ' of a large pizza. Who ate more pizza?',
            }],
            correct: 'You cannot tell',
            distractors: [people[0], people[1], 'They ate the same'],
            explain: 'The pizzas are different sizes, so the fractions are of different wholes. '
                + 'Fractions can only be compared when the whole is the same.',
            sig: 'sameWhole:' + a.join('/') + ':' + b.join('/'),
        });
    };

    G['frac.numberline.unit'] = function (rng, p) {
        const d = rng.pick(dens(p));
        return nlItem({
            stem: 'Show ' + fstr(1, d) + ' on the number line.',
            line: { lo: 0, hi: 1, ticks: d, labels: { 0: '0', [d]: '1' } },
            answer: 1 / d,
            hint: 'The line from 0 to 1 is split into ' + d + ' equal jumps. You want the first one.',
            explain: fstr(1, d) + ' is one jump of ' + d + ' from zero.',
            sig: 'nlUnit:' + d,
        });
    };

    G['frac.numberline'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const n = rng.int(2, d - 1);
        return nlItem({
            stem: 'Show ' + fstr(n, d) + ' on the number line.',
            line: { lo: 0, hi: 1, ticks: d, labels: { 0: '0', [d]: '1' } },
            answer: n / d,
            hint: 'Count ' + n + ' jumps of ' + fstr(1, d) + ' from zero.',
            explain: fstr(n, d) + ' is ' + n + ' jumps of ' + fstr(1, d) + '. Count the gaps, not the marks.',
            sig: 'nl:' + n + ':' + d,
        });
    };

    G['frac.equivalent.recognise'] = function (rng, p) {
        const base = rng.pick([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [2, 5]]);
        const k = rng.int(2, 3);
        const eq = [base[0] * k, base[1] * k];
        const bad = [[base[0] + 1, base[1] + 1], [base[0] + k, base[1] * k], [base[0] * k, base[1] + k]];
        return mc(rng, {
            stem: 'Which fraction is the same as ' + fstr(base[0], base[1]) + '?',
            prompt: [
                { t: 'text', s: 'Which one is the same as ' + fstr(base[0], base[1]) + '?' },
                { t: 'svg', draw: 'fraction-bar', args: { num: base[0], den: base[1] } },
            ],
            correct: fstr(eq[0], eq[1]),
            // "Add the same to both" is the standard wrong rule.
            distractors: bad.map((x) => fstr(x[0], x[1])),
            explain: 'Multiplying the top and the bottom by ' + k + ' gives ' + fstr(eq[0], eq[1])
                + '. Adding to both would change the value.',
            sig: 'eqRec:' + base.join('/') + ':' + k,
        });
    };

    G['frac.equivalent.generate'] = function (rng, p) {
        const base = rng.pick([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [2, 5], [3, 5], [5, 6]]);
        const k = rng.int(2, 4);
        const askNum = rng.bool();
        if (askNum) {
            return numAnswer({
                stem: 'Fill in the missing number: ' + fstr(base[0], base[1]) + ' equals what over ' + (base[1] * k) + '?',
                prompt: [{ t: 'expr', s: fstr(base[0], base[1]) + '  =  ?/' + (base[1] * k) }],
                answer: base[0] * k,
                hint: 'The bottom was multiplied by ' + k + '. Do the same to the top.',
                explain: fstr(base[0], base[1]) + ' = ' + fstr(base[0] * k, base[1] * k) + '.',
                sig: 'eqGenN:' + base.join('/') + ':' + k,
            });
        }
        return numAnswer({
            stem: 'Fill in the missing number: ' + fstr(base[0], base[1]) + ' equals ' + (base[0] * k) + ' over what?',
            prompt: [{ t: 'expr', s: fstr(base[0], base[1]) + '  =  ' + (base[0] * k) + '/?' }],
            answer: base[1] * k,
            hint: 'The top was multiplied by ' + k + '. Do the same to the bottom.',
            explain: fstr(base[0], base[1]) + ' = ' + fstr(base[0] * k, base[1] * k) + '.',
            sig: 'eqGenD:' + base.join('/') + ':' + k,
        });
    };

    G['frac.wholeAsFraction'] = function (rng, p) {
        const d = rng.pick(dens(p));
        if (rng.bool()) {
            return numAnswer({
                stem: 'What does ' + fstr(d, d) + ' equal?',
                prompt: [{ t: 'expr', s: fstr(d, d) + '  =  ?' }],
                answer: 1,
                explain: 'All ' + d + ' pieces out of ' + d + ' is the whole thing, which is 1.',
                sig: 'wholeAs1:' + d,
            });
        }
        const w = rng.int(2, 5);
        return numAnswer({
            stem: 'How many ' + NAMES[d] + ' make ' + w + ' wholes?',
            prompt: [{ t: 'expr', s: w + '  =  ?/' + d }],
            answer: w * d,
            hint: 'Each whole is ' + fstr(d, d) + '.',
            explain: w + ' wholes is ' + fstr(w * d, d) + '.',
            sig: 'wholeAsN:' + w + ':' + d,
        });
    };

    G['frac.compare.sameDen'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const pair = rng.sample([...Array(d - 1).keys()].map((i) => i + 1), 2);
        const hi = Math.max(pair[0], pair[1]), lo = Math.min(pair[0], pair[1]);
        return mc(rng, {
            stem: 'Which is bigger, ' + fstr(hi, d) + ' or ' + fstr(lo, d) + '?',
            prompt: [{ t: 'expr', s: fstr(pair[0], d) + '   or   ' + fstr(pair[1], d) }],
            correct: fstr(hi, d),
            distractors: [fstr(lo, d), 'They are equal'],
            explain: 'The pieces are the same size, so more pieces is more. ' + hi + ' > ' + lo + '.',
            sig: 'cmpSameDen:' + lo + ':' + hi + ':' + d,
        });
    };

    G['frac.compare.sameNum'] = function (rng, p) {
        const ds = rng.sample(dens(p), 2);
        const n = 1;
        const small = Math.min(ds[0], ds[1]), big = Math.max(ds[0], ds[1]);
        return mc(rng, {
            stem: 'Which is bigger, ' + fstr(n, small) + ' or ' + fstr(n, big) + '?',
            prompt: [
                { t: 'expr', s: fstr(n, small) + '   or   ' + fstr(n, big) },
                { t: 'svg', draw: 'fraction-bar', args: { num: n, den: small } },
                { t: 'svg', draw: 'fraction-bar', args: { num: n, den: big } },
            ],
            correct: fstr(n, small),
            // The named misconception for this node: bigger bottom read as bigger.
            distractors: [fstr(n, big), 'They are equal'],
            explain: 'Cutting the same whole into ' + big + ' pieces makes smaller pieces than cutting it into '
                + small + '. A bigger bottom number means smaller pieces.',
            sig: 'cmpSameNum:' + small + ':' + big,
        });
    };

    G['frac.compare.benchmark'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        let n = rng.int(1, d - 1);
        if (n * 2 === d) n = n === 1 ? d - 1 : n - 1;   // avoid exactly a half
        const bigger = n / d > 0.5;
        return mc(rng, {
            stem: 'Is ' + fstr(n, d) + ' more or less than a half?',
            prompt: [{ t: 'expr', s: fstr(n, d) + '   ?   1/2' }],
            correct: bigger ? 'More than a half' : 'Less than a half',
            distractors: [bigger ? 'Less than a half' : 'More than a half', 'Exactly a half'],
            explain: 'Half of ' + d + ' is ' + (d / 2) + ', and ' + n + (bigger ? ' is more' : ' is less') + ' than that.',
            sig: 'cmpBench:' + n + ':' + d,
        });
    };

    G['frac.compare.unlike'] = function (rng, p) {
        let a, b, guard = 0;
        do {
            a = [rng.int(1, 5), rng.pick(dens(p))];
            b = [rng.int(1, 5), rng.pick(dens(p))];
            guard++;
        } while (guard < 40 && (a[0] >= a[1] || b[0] >= b[1] || a[0] / a[1] === b[0] / b[1] || (a[1] === b[1] && a[0] === b[0])));
        if (a[0] >= a[1]) a = [1, 2];
        if (b[0] >= b[1] || a[0] / a[1] === b[0] / b[1]) b = [2, 5];

        const aBig = a[0] / a[1] > b[0] / b[1];
        return mc(rng, {
            stem: 'Which is bigger, ' + fstr(a[0], a[1]) + ' or ' + fstr(b[0], b[1]) + '?',
            prompt: [{ t: 'expr', s: fstr(a[0], a[1]) + '   or   ' + fstr(b[0], b[1]) }],
            correct: aBig ? fstr(a[0], a[1]) : fstr(b[0], b[1]),
            distractors: [aBig ? fstr(b[0], b[1]) : fstr(a[0], a[1]), 'They are equal'],
            hint: 'Try comparing each one to a half.',
            explain: 'As equivalent fractions with the same bottom number: '
                + fstr(a[0] * b[1], a[1] * b[1]) + ' and ' + fstr(b[0] * a[1], b[1] * a[1]) + '.',
            sig: 'cmpUnlike:' + a.join('/') + ':' + b.join('/'),
        });
    };

    // Evaluate an "a/b + c/d + …" string. Distractors here are checked by value
    // rather than trusted by construction, because it is very easy to write a
    // plausible-looking wrong option that is arithmetically correct — 3/8 + 3/8
    // really is 3/4 — and marking a learner's right answer wrong is exactly the
    // failure this app must not have.
    function sumOf(expr) {
        return expr.split('+').reduce((acc, term) => {
            const parts = term.trim().split('/');
            return acc + Number(parts[0]) / Number(parts[1]);
        }, 0);
    }

    G['frac.decompose'] = function (rng, p) {
        // n >= 3 so that "all unit fractions" and "two parts" are genuinely
        // different groupings; at n = 2 they are the same string.
        const d = rng.pick(dens(p).filter((x) => x >= 4));
        const n = rng.int(3, d - 1);
        const target = n / d;
        const unit = fstr(1, d);

        const allUnits = Array(n).fill(unit).join(' + ');
        const split = rng.int(1, n - 1);
        const twoPart = fstr(split, d) + ' + ' + fstr(n - split, d);

        const candidates = [
            fstr(n, d) + ' + ' + fstr(n, d),
            Array(n).fill(fstr(1, d * n)).join(' + '),
            fstr(n + 1, d) + ' + ' + fstr(1, d),
            fstr(1, d) + ' + ' + fstr(1, d + 1),
            fstr(n, d + 1) + ' + ' + fstr(1, d),
        ];

        const right = [allUnits, twoPart].filter((s, i, arr) => arr.indexOf(s) === i);
        const wrong = [];
        candidates.forEach((c) => {
            if (wrong.length >= 3) return;
            if (Math.abs(sumOf(c) - target) < 1e-9) return;      // secretly correct
            if (right.indexOf(c) !== -1 || wrong.indexOf(c) !== -1) return;
            wrong.push(c);
        });

        const labels = rng.shuffle(
            right.map((l) => ({ l: l, right: true }))
                .concat(wrong.map((l) => ({ l: l, right: false })))
        );
        return {
            type: 'multi',
            stem: 'Choose every way of making ' + fstr(n, d) + '. There is more than one.',
            prompt: [{ t: 'text', s: 'Choose every way of making ' + fstr(n, d) + '. There is more than one.' }],
            choices: labels.map((x) => x.l),
            answer: labels.map((x, i) => (x.right ? i : -1)).filter((i) => i >= 0),
            grade: 'set',
            explain: fstr(n, d) + ' is ' + n + ' lots of ' + unit + ', and those can be grouped in more than one way.',
            sig: 'decomp:' + n + ':' + d,
        };
    };

    G['frac.add.likeDen'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const a = rng.int(1, d - 1);
        const plus = rng.bool();
        const b = plus ? rng.int(1, d - a) : rng.int(1, a);
        const res = plus ? a + b : a - b;
        return fracAnswer({
            stem: fstr(a, d) + (plus ? ' plus ' : ' minus ') + fstr(b, d) + '. Give your answer as a fraction.',
            prompt: [{ t: 'expr', s: fstr(a, d) + (plus ? '  +  ' : '  −  ') + fstr(b, d) + '  =  ?' }],
            num: res, den: d,
            hint: 'The pieces are already the same size, so just ' + (plus ? 'add' : 'subtract') + ' how many there are.',
            explain: a + (plus ? ' + ' : ' − ') + b + ' = ' + res + ' pieces, each ' + fstr(1, d)
                + '. The bottom number does not change.',
            sig: 'addLike:' + a + (plus ? '+' : '-') + b + ':' + d,
        });
    };

    G['frac.mixedImproper'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const w = rng.int(1, 4);
        const n = rng.int(1, d - 1);
        return fracAnswer({
            stem: 'Write ' + w + ' and ' + fstr(n, d) + ' as a single fraction.',
            prompt: [{ t: 'expr', s: w + ' ' + fstr(n, d) + '  =  ?' }],
            num: w * d + n, den: d,
            hint: 'Each whole is ' + fstr(d, d) + '.',
            explain: w + ' wholes is ' + fstr(w * d, d) + ', plus ' + fstr(n, d) + ' makes ' + fstr(w * d + n, d) + '.',
            sig: 'mixed:' + w + ':' + n + ':' + d,
        });
    };

    G['frac.add.mixed'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const w1 = rng.int(1, 3), w2 = rng.int(1, 3);
        const n1 = rng.int(1, d - 1), n2 = rng.int(1, d - 1);
        const total = (w1 * d + n1) + (w2 * d + n2);
        return fracAnswer({
            stem: w1 + ' and ' + fstr(n1, d) + ' plus ' + w2 + ' and ' + fstr(n2, d)
                + '. Give your answer as a single fraction.',
            prompt: [{ t: 'expr', s: w1 + ' ' + fstr(n1, d) + '  +  ' + w2 + ' ' + fstr(n2, d) + '  =  ?' }],
            num: total, den: d,
            hint: 'Turn each one into a single fraction first.',
            explain: fstr(w1 * d + n1, d) + ' + ' + fstr(w2 * d + n2, d) + ' = ' + fstr(total, d) + '.',
            sig: 'addMixed:' + w1 + ':' + n1 + ':' + w2 + ':' + n2 + ':' + d,
        });
    };

    G['frac.add.unlikeDen'] = function (rng) {
        const pairs = [[2, 3], [2, 4], [3, 4], [2, 5], [3, 6], [4, 6], [2, 6], [4, 8], [3, 5]];
        const ds = rng.pick(pairs);
        const d1 = ds[0], d2 = ds[1];
        const a = rng.int(1, d1 - 1), b = rng.int(1, d2 - 1);
        const common = d1 * d2 / gcd(d1, d2);
        const total = a * (common / d1) + b * (common / d2);
        return fracAnswer({
            stem: fstr(a, d1) + ' plus ' + fstr(b, d2) + '. Give your answer as a fraction.',
            prompt: [{ t: 'expr', s: fstr(a, d1) + '  +  ' + fstr(b, d2) + '  =  ?' }],
            num: total, den: common,
            hint: 'Make the pieces the same size first. Both ' + d1 + ' and ' + d2 + ' go into ' + common + '.',
            explain: fstr(a, d1) + ' = ' + fstr(a * (common / d1), common) + ' and '
                + fstr(b, d2) + ' = ' + fstr(b * (common / d2), common) + ', which add to ' + fstr(total, common) + '.',
            sig: 'addUnlike:' + a + '/' + d1 + '+' + b + '/' + d2,
        });
    };

    G['frac.mult.byWhole'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const n = rng.int(1, d - 1);
        const w = rng.int(2, 5);
        return fracAnswer({
            stem: w + ' lots of ' + fstr(n, d) + '. Give your answer as a fraction.',
            prompt: [{ t: 'expr', s: w + '  ×  ' + fstr(n, d) + '  =  ?' }],
            num: n * w, den: d,
            hint: fstr(n, d) + ' added ' + w + ' times.',
            explain: w + ' lots of ' + n + ' pieces is ' + (n * w) + ' pieces, each still ' + fstr(1, d) + '.',
            sig: 'multWhole:' + w + ':' + n + ':' + d,
        });
    };

    G['frac.mult.byFraction'] = function (rng, p) {
        const d1 = rng.pick(dens(p)), d2 = rng.pick(dens(p));
        const a = rng.int(1, d1 - 1) || 1, b = rng.int(1, d2 - 1) || 1;
        return fracAnswer({
            stem: fstr(a, d1) + ' of ' + fstr(b, d2) + '. Give your answer as a fraction.',
            prompt: [{ t: 'expr', s: fstr(a, d1) + '  ×  ' + fstr(b, d2) + '  =  ?' }],
            num: a * b, den: d1 * d2,
            hint: '"Of" means multiply. Tops together, bottoms together.',
            explain: fstr(a, d1) + ' × ' + fstr(b, d2) + ' = ' + fstr(a * b, d1 * d2) + '.',
            sig: 'multFrac:' + a + '/' + d1 + '*' + b + '/' + d2,
        });
    };

    G['frac.scaling'] = function (rng, p) {
        const w = rng.int(3, 12);
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const shrink = rng.bool();
        const n = shrink ? rng.int(1, d - 1) : d + rng.int(1, d - 1);
        const f = fstr(n, d);
        return mc(rng, {
            stem: 'Without working it out: is ' + f + ' × ' + w + ' bigger or smaller than ' + w + '?',
            prompt: [{ t: 'text', s: 'Without working it out:' }, { t: 'expr', s: f + '  ×  ' + w }],
            correct: shrink ? 'Smaller than ' + w : 'Bigger than ' + w,
            // "Multiplying always makes bigger" is the whole point of this node.
            distractors: [shrink ? 'Bigger than ' + w : 'Smaller than ' + w, 'Exactly ' + w],
            explain: f + ' is ' + (shrink ? 'less' : 'more') + ' than 1, so multiplying by it makes '
                + w + ' ' + (shrink ? 'smaller' : 'bigger') + '. Multiplying does not always make a number bigger.',
            sig: 'scaling:' + n + ':' + d + ':' + w,
        });
    };

    G['frac.asDivision'] = function (rng, p) {
        const d = rng.pick(dens(p).filter((x) => x >= 3));
        const n = rng.int(1, d - 1);
        if (rng.bool()) {
            return mc(rng, {
                stem: 'Which division does ' + fstr(n, d) + ' mean?',
                prompt: [{ t: 'expr', s: fstr(n, d) }],
                correct: n + ' ÷ ' + d,
                distractors: [d + ' ÷ ' + n, n + ' × ' + d, d + ' − ' + n],
                explain: 'A fraction is a division: ' + fstr(n, d) + ' means ' + n + ' shared between ' + d + '.',
                sig: 'asDivMc:' + n + ':' + d,
            });
        }
        const people = rng.int(2, 6);
        const cakes = rng.int(1, people - 1);
        return fracAnswer({
            stem: cakes + ' cakes shared equally between ' + people
                + ' people. How much does each person get? Give your answer as a fraction.',
            prompt: [{ t: 'text', s: cakes + ' cakes shared equally between ' + people + ' people. How much does each get?' }],
            num: cakes, den: people,
            hint: 'Sharing is dividing, and a division can be written as a fraction.',
            explain: cakes + ' ÷ ' + people + ' = ' + fstr(cakes, people) + '.',
            sig: 'asDivWord:' + cakes + ':' + people,
        });
    };

    G['frac.div.unitByWhole'] = function (rng, p) {
        const d = rng.pick(dens(p));
        const w = rng.int(2, 5);
        return fracAnswer({
            stem: fstr(1, d) + ' shared between ' + w + '. Give your answer as a fraction.',
            prompt: [{ t: 'expr', s: fstr(1, d) + '  ÷  ' + w + '  =  ?' }],
            num: 1, den: d * w,
            hint: 'Cutting ' + NAME1[d] + ' into ' + w + ' makes even smaller pieces.',
            explain: 'Each of the ' + d + ' pieces is split ' + w + ' ways, giving ' + (d * w)
                + ' pieces altogether, so ' + fstr(1, d * w) + '.',
            sig: 'divUnitWhole:' + d + ':' + w,
        });
    };

    G['frac.div.wholeByUnit'] = function (rng, p) {
        const d = rng.pick(dens(p));
        const w = rng.int(2, 6);
        return numAnswer({
            stem: 'How many ' + NAMES[d] + ' are there in ' + w + '?',
            prompt: [{ t: 'expr', s: w + '  ÷  ' + fstr(1, d) + '  =  ?' }],
            answer: w * d,
            hint: 'Each whole holds ' + d + ' of them.',
            explain: 'Each whole contains ' + d + ' ' + NAMES[d] + ', so ' + w + ' wholes contain '
                + (w * d) + '. Dividing by a fraction less than 1 gives a bigger answer.',
            sig: 'divWholeUnit:' + w + ':' + d,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-frac', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
