/*
 * Item generators for multiplicative reasoning.
 *
 * Long division is here as a first-class node rather than an afterthought:
 * whole-number division is, with fractions, one of the two strongest elementary
 * predictors of later algebra achievement, and modern curricula tend to
 * soft-pedal it.
 */
(function () {
    'use strict';

    const G = {};

    G['mult.equalGroups'] = function (rng, p) {
        const max = p.max || 10;
        const rows = rng.int(2, Math.min(6, max));
        const cols = rng.int(2, Math.min(8, max));
        if (rng.bool()) {
            return genNum({
                stem: 'How many dots altogether?',
                prompt: [
                    { t: 'text', s: 'How many dots altogether?' },
                    { t: 'svg', draw: 'array', args: { rows: rows, cols: cols } },
                ],
                answer: rows * cols,
                hint: rows + ' rows of ' + cols + '.',
                explain: rows + ' × ' + cols + ' = ' + (rows * cols) + '.',
                sig: 'eg:' + rows + ':' + cols,
            });
        }
        const bags = rng.int(2, 6);
        const each = rng.int(2, 8);
        return genMc(rng, {
            stem: 'There are ' + bags + ' bags with ' + each + ' apples in each. Which sum matches?',
            correct: bags + ' × ' + each,
            distractors: [bags + ' + ' + each, each + ' − ' + bags, (bags + each) + ' × 2'],
            explain: bags + ' groups of ' + each + ' is ' + bags + ' × ' + each + ' = ' + (bags * each) + '.',
            sig: 'egMc:' + bags + ':' + each,
        });
    };

    G['mult.commutative'] = function (rng, p) {
        const max = p.max || 10;
        const a = rng.int(2, max), b = rng.int(2, max);
        if (a === b) return G['mult.commutative'](rng, { max: max - 1 });
        return genNum({
            stem: 'If ' + a + ' × ' + b + ' = ' + (a * b) + ', what is ' + b + ' × ' + a + '?',
            prompt: [{ t: 'expr', s: a + ' × ' + b + ' = ' + (a * b) }, { t: 'expr', s: b + ' × ' + a + ' = ?' }],
            answer: a * b,
            hint: 'Turning an array on its side does not change how many dots there are.',
            explain: 'Order does not change a product, so it is still ' + (a * b) + '.',
            sig: 'comm:' + a + ':' + b,
        });
    };

    G['mult.facts'] = function (rng, p) {
        const max = p.max || 10;
        const a = rng.int(2, max), b = rng.int(2, max);
        return genNum({
            stem: a + ' times ' + b,
            prompt: [{ t: 'expr', s: a + ' × ' + b }],
            answer: a * b,
            sig: 'mf:' + a + ':' + b,
        });
    };

    G['mult.divInverse'] = function (rng, p) {
        const max = p.max || 10;
        const b = rng.int(2, max), q = rng.int(2, max);
        return genNum({
            stem: 'What times ' + b + ' makes ' + (b * q) + '?',
            prompt: [{ t: 'expr', s: '?  ×  ' + b + '  =  ' + (b * q) }],
            answer: q,
            hint: 'This is the same as ' + (b * q) + ' ÷ ' + b + '.',
            explain: q + ' × ' + b + ' = ' + (b * q) + ', so ' + (b * q) + ' ÷ ' + b + ' = ' + q + '.',
            sig: 'divInv:' + b + ':' + q,
        });
    };

    G['mult.div.facts'] = function (rng, p) {
        const max = p.max || 10;
        // Zero is never a divisor.
        const d = rng.int(2, max), q = rng.int(1, max);
        return genNum({
            stem: (d * q) + ' divided by ' + d,
            prompt: [{ t: 'expr', s: (d * q) + ' ÷ ' + d }],
            answer: q,
            sig: 'df:' + d + ':' + q,
        });
    };

    G['mult.distributive'] = function (rng) {
        const a = rng.int(3, 9);
        const b = rng.int(11, 19);
        const split = rng.pick([10]);
        return genNum({
            stem: a + ' times ' + b + ', by splitting ' + b + ' into ' + split + ' and ' + (b - split) + '.',
            prompt: [{ t: 'expr', s: a + ' × ' + b + '  =  ' + a + ' × ' + split + '  +  ' + a + ' × ' + (b - split) + '  =  ?' }],
            answer: a * b,
            hint: a + ' × ' + split + ' = ' + (a * split) + ', and ' + a + ' × ' + (b - split) + ' = ' + (a * (b - split)) + '.',
            explain: (a * split) + ' + ' + (a * (b - split)) + ' = ' + (a * b) + '.',
            sig: 'dist:' + a + ':' + b,
        });
    };

    G['mult.byTens'] = function (rng) {
        const a = rng.int(2, 9);
        const t = rng.pick([10, 20, 30, 40, 50, 60, 70, 80, 90]);
        return genNum({
            stem: a + ' times ' + t,
            prompt: [{ t: 'expr', s: a + ' × ' + t }],
            answer: a * t,
            hint: a + ' × ' + (t / 10) + ' = ' + (a * t / 10) + ', and this is ten times that.',
            sig: 'byTens:' + a + ':' + t,
        });
    };

    G['mult.multiDigit.byOne'] = function (rng) {
        const a = rng.int(12, 999);
        const b = rng.int(2, 9);
        return genNum({
            stem: a + ' times ' + b,
            prompt: [{ t: 'expr', s: a + ' × ' + b }],
            answer: a * b,
            sig: 'md1:' + a + ':' + b,
        });
    };

    G['mult.multiDigit.byTwo'] = function (rng) {
        const a = rng.int(11, 99);
        const b = rng.int(11, 99);
        return genNum({
            stem: a + ' times ' + b,
            prompt: [{ t: 'expr', s: a + ' × ' + b }],
            answer: a * b,
            hint: 'Do not lose the place-holding zero in the second row.',
            sig: 'md2:' + a + ':' + b,
        });
    };

    /*
     * Additive versus multiplicative comparison. "5 times as many" read as
     * "5 more than" is the named misconception, so both readings are on offer
     * and the wrong one is the tempting one.
     */
    G['mult.comparison'] = function (rng) {
        const base = rng.int(3, 12);
        const k = rng.int(2, 6);
        const names = rng.sample(['Mia', 'Jonah', 'Priya', 'Sam', 'Leah', 'Omar'], 2);
        return genMc(rng, {
            stem: names[0] + ' has ' + base + ' stickers. ' + names[1] + ' has ' + k
                + ' times as many. How many does ' + names[1] + ' have?',
            correct: String(base * k),
            distractors: [String(base + k), String(base * k + k), String(k)],
            hint: '"Times as many" means multiply, not add.',
            explain: k + ' times as many as ' + base + ' is ' + k + ' × ' + base + ' = ' + (base * k)
                + '. ' + (base + k) + ' would be ' + k + ' *more than* ' + base + ', which is a different question.',
            sig: 'cmp:' + base + ':' + k,
        });
    };

    G['mult.div.longDivision'] = function (rng) {
        const divisor = rng.int(3, 24);
        const quotient = rng.int(12, 400);
        return genNum({
            stem: (divisor * quotient) + ' divided by ' + divisor,
            prompt: [{ t: 'expr', s: (divisor * quotient) + ' ÷ ' + divisor }],
            answer: quotient,
            hint: 'Work from the left, one digit at a time.',
            sig: 'longdiv:' + divisor + ':' + quotient,
        });
    };

    G['mult.div.remainder'] = function (rng) {
        const divisor = rng.int(3, 9);
        const quotient = rng.int(3, 20);
        const rem = rng.int(1, divisor - 1);
        const total = divisor * quotient + rem;

        if (rng.bool()) {
            return genNum({
                stem: 'What is the remainder when ' + total + ' is divided by ' + divisor + '?',
                prompt: [{ t: 'expr', s: total + ' ÷ ' + divisor + '  =  ' + quotient + ' remainder ?' }],
                answer: rem,
                explain: divisor + ' × ' + quotient + ' = ' + (divisor * quotient) + ', and '
                    + total + ' − ' + (divisor * quotient) + ' = ' + rem + '.',
                sig: 'rem:' + total + ':' + divisor,
            });
        }
        // The interpretation case: the arithmetic is the easy part, deciding
        // what the remainder means is the actual skill.
        return genMc(rng, {
            stem: total + ' children need to get into cars. Each car holds ' + divisor
                + '. How many cars are needed so that everybody gets a ride?',
            correct: String(quotient + 1),
            distractors: [String(quotient), quotient + ' remainder ' + rem, String(rem)],
            hint: 'The leftover children still need a car.',
            explain: total + ' ÷ ' + divisor + ' is ' + quotient + ' remainder ' + rem + '. Those '
                + rem + ' left over still need a car, so ' + (quotient + 1) + ' cars.',
            sig: 'remWord:' + total + ':' + divisor,
        });
    };

    G['mult.factorsMultiples'] = function (rng) {
        const n = rng.pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 45, 48]);
        const factors = [];
        for (let i = 1; i <= n; i++) if (n % i === 0) factors.push(i);
        const nonFactors = [];
        for (let i = 2; i < n && nonFactors.length < 6; i++) if (n % i !== 0) nonFactors.push(i);

        if (rng.bool()) {
            return genMulti(rng, {
                stem: 'Choose every number that divides exactly into ' + n + '.',
                right: rng.sample(factors.filter((f) => f !== 1 && f !== n), 3).map(String),
                wrong: rng.sample(nonFactors, 3).map(String),
                explain: 'The factors of ' + n + ' are ' + factors.join(', ') + '.',
                sig: 'factors:' + n,
            });
        }
        const base = rng.int(3, 9);
        const k = rng.int(3, 9);
        return genMc(rng, {
            stem: 'Which of these is a multiple of ' + base + '?',
            correct: String(base * k),
            distractors: [String(base * k + 1), String(base * k - 1), String(base * k + 2)],
            explain: base + ' × ' + k + ' = ' + (base * k)
                + '. A multiple is what you get by multiplying; a factor is what divides in.',
            sig: 'multiple:' + base + ':' + k,
        });
    };


    // ---- tier 2 --------------------------------------------------------------
    G['mult.primeComposite'] = function (rng) {
        const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
        const COMPOSITE = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25];
        if (rng.bool()) {
            const p = rng.pick(PRIMES);
            return genMc(rng, {
                stem: 'Which of these is a prime number?',
                correct: String(p),
                distractors: rng.sample(COMPOSITE, 3).map(String),
                explain: p + ' can only be divided by 1 and itself.',
                sig: 'prime:' + p,
            });
        }
        // 1 is neither, and calling it prime is the standard slip.
        return genMc(rng, {
            stem: 'Is the number 1 prime, composite, or neither?',
            correct: 'Neither',
            distractors: ['Prime', 'Composite', 'Both'],
            explain: 'A prime has exactly two different factors, 1 and itself. 1 has only one '
                + 'factor, so it is neither prime nor composite.',
            sig: 'primeOne',
        });
    };

    G['mult.word.multiStep'] = function (rng) {
        const packs = rng.int(3, 8);
        const each = rng.int(4, 9);
        const eaten = rng.int(2, packs * each - 1);
        return genNum({
            stem: 'There are ' + packs + ' packs with ' + each + ' biscuits in each. '
                + eaten + ' biscuits are eaten. How many are left?',
            answer: packs * each - eaten,
            hint: 'Work out the total first.',
            explain: packs + ' × ' + each + ' = ' + (packs * each) + ', then − ' + eaten
                + ' = ' + (packs * each - eaten) + '.',
            sig: 'mws:' + packs + ':' + each + ':' + eaten,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-mult', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
