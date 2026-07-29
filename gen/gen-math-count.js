/*
 * Item generators for counting and subitising.
 *
 * Two things here are easy to get wrong and are deliberately not:
 *
 * Cardinality is not the same as reciting. A child can count to a hundred and
 * still not know that the last word said answers "how many", so those nodes are
 * separate rungs and the cardinality items ask about the total after a
 * rearrangement rather than asking for a recount.
 *
 * Subitising means recognising a quantity WITHOUT counting, so those items carry
 * a latency target. Getting them right slowly is just counting, which is the
 * skill below.
 */
(function () {
    'use strict';

    const G = {};

    // Scattered placement with a minimum separation, so dots stay countable but
    // are not in a helpful row. Uses the seeded rng, so the layout is part of
    // the reproducible item.
    function scatter(rng, n, w, h, pad) {
        const pts = [];
        let guard = 0;
        while (pts.length < n && guard < n * 200) {
            guard++;
            const x = rng.int(pad, w - pad);
            const y = rng.int(pad, h - pad);
            if (pts.every((p) => (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y) > 34 * 34)) {
                pts.push([x, y]);
            }
        }
        return pts;
    }

    G['count.subitize.small'] = function (rng, p) {
        const n = rng.int(1, p.max || 4);
        return genMc(rng, {
            stem: 'How many dots?',
            prompt: [
                { t: 'text', s: 'How many? Try to see it without counting.' },
                { t: 'svg', draw: 'dots', args: { points: scatter(rng, n, 300, 200, 40) } },
            ],
            correct: String(n),
            distractors: genNear(n, 2).filter((x) => x >= 1 && x <= 6).slice(0, 3).map(String),
            sig: 'sub:' + n,
        });
    };

    G['count.sequence'] = function (rng, p) {
        const max = p.max || 120;
        const start = rng.int(1, max - 5);
        const back = rng.bool(0.3);
        const step = back ? -1 : 1;
        const run = [start, start + step, start + 2 * step];
        if (run.some((x) => x < 0 || x > max)) return G['count.sequence'](rng, { max: max });
        return genNum({
            stem: 'What comes next: ' + run.join(', ') + ' …?',
            prompt: [{ t: 'expr', s: run.join(',  ') + ',  ?' }],
            answer: start + 3 * step,
            explain: back ? 'Counting back one each time.' : 'Counting on one each time.',
            sig: 'seq:' + start + ':' + step,
        });
    };

    G['count.oneToOne'] = function (rng, p) {
        const n = rng.int(6, Math.min(20, p.max || 20));
        return genNum({
            stem: 'How many dots are there?',
            prompt: [
                { t: 'text', s: 'How many dots?' },
                { t: 'svg', draw: 'dots', args: { points: scatter(rng, n, 300, 200, 26), r: 11 } },
            ],
            answer: n,
            hint: 'Touch each one as you count so you do not count any twice.',
            sig: 'one2one:' + n,
        });
    };

    /*
     * Cardinality: the total does not change when the objects move. Asking for
     * the count after a rearrangement is the whole point — a child who has to
     * recount has not got it yet.
     */
    G['count.cardinality'] = function (rng, p) {
        const n = rng.int(5, Math.min(20, p.max || 20));
        return genMc(rng, {
            stem: 'You counted ' + n + ' dots. Then they were moved around, without adding or taking any away. '
                + 'How many are there now?',
            correct: String(n),
            distractors: [String(n + 1), String(n - 1), 'You would have to count again'],
            explain: 'Moving things about does not change how many there are. It is still ' + n + '.',
            sig: 'card:' + n,
        });
    };

    G['count.subitize.grouped'] = function (rng, p) {
        const max = Math.min(10, p.max || 10);
        const n = rng.int(6, max);
        return genNum({
            stem: 'How many dots? Look for five and some more.',
            prompt: [
                { t: 'text', s: 'How many? Look for five and some more.' },
                { t: 'svg', draw: 'array', args: { rows: 2, cols: 5 } },
                { t: 'text', s: 'The top row is full. ' + (n - 5) + ' more are filled below.' },
            ],
            answer: n,
            hint: 'Five in the full row, then count on.',
            explain: '5 and ' + (n - 5) + ' more makes ' + n + '.',
            sig: 'subGrp:' + n,
        });
    };

    G['count.compare.sets'] = function (rng, p) {
        const max = Math.min(10, p.max || 10);
        const a = rng.int(2, max);
        let b = rng.int(2, max);
        const same = rng.bool(0.25);
        if (same) b = a;
        else if (a === b) b = a === max ? a - 1 : a + 1;

        const left = scatter(rng, a, 150, 166, 24);
        const right = scatter(rng, b, 150, 166, 24);
        const correct = same || a === b ? 'The same' : (a > b ? 'The blue side' : 'The orange side');
        return genMc(rng, {
            stem: 'Which side has more dots?',
            prompt: [
                { t: 'text', s: 'Which side has more?' },
                { t: 'svg', draw: 'two-sets', args: { left: left, right: right } },
            ],
            correct: correct,
            distractors: ['The blue side', 'The orange side', 'The same'],
            explain: 'Blue has ' + a + ' and orange has ' + b + '.',
            sig: 'cmpSets:' + a + ':' + b,
        });
    };

    G['count.numeral'] = function (rng, p) {
        const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
            'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
            'nineteen', 'twenty'];
        const n = rng.int(0, Math.min(20, p.max || 20));
        if (rng.bool()) {
            return genNum({
                stem: 'Write ' + WORDS[n] + ' as a number.',
                answer: n,
                sig: 'numeralWrite:' + n,
            });
        }
        // The teens trap: 14 read as "four-teen" and written 41.
        const swapped = n >= 13 && n <= 19 ? Number(String(n).split('').reverse().join('')) : null;
        return genMc(rng, {
            stem: 'Which one is ' + WORDS[n] + '?',
            correct: String(n),
            distractors: [swapped, n + 1, n - 1].filter((x) => x !== null && x >= 0).map(String),
            explain: WORDS[n] + ' is written ' + n + '.',
            sig: 'numeralRead:' + n,
        });
    };

    G['count.skip'] = function (rng, p) {
        const step = rng.pick((p && p.steps) || [2, 5, 10]);
        const max = (p && p.max) || 120;
        const startMultiple = rng.int(1, Math.max(1, Math.floor(max / step) - 4));
        const start = startMultiple * step;
        const run = [start, start + step, start + 2 * step];
        return genNum({
            stem: 'Counting in ' + step + 's: ' + run.join(', ') + ' …?',
            prompt: [{ t: 'expr', s: run.join(',  ') + ',  ?' }],
            answer: start + 3 * step,
            explain: 'Each jump adds ' + step + '.',
            sig: 'skip:' + step + ':' + start,
        });
    };


    // ---- tier 2/3 -----------------------------------------------------------
    G['count.ordinal'] = function (rng) {
        const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        const i = rng.int(0, 9);
        return genMc(rng, {
            stem: 'In a line of ten children, which position is the ' + ORD[i] + '?',
            correct: String(i + 1),
            distractors: [String(i), String(i + 2), String(10 - i)].filter((x) => x !== String(i + 1)),
            explain: ORD[i] + ' means position ' + (i + 1) + '.',
            sig: 'ord:' + i,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-count', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
