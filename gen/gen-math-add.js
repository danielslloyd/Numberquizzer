/*
 * Item generators for additive reasoning.
 *
 * Four of these nodes carry a latency target rather than only an accuracy bar,
 * because automatic recall is what frees working memory for multi-step work.
 * A learner who is accurate but slow on sums within 20 will struggle with
 * two-digit subtraction for reasons that look like "careless mistakes".
 */
(function () {
    'use strict';

    const G = {};

    G['add.joinSeparate'] = function (rng, p) {
        const max = p.max || 10;
        const a = rng.int(1, max - 1);
        const b = rng.int(1, max - a);
        const joining = rng.bool();
        const things = rng.pick(['apples', 'marbles', 'stickers', 'shells', 'buttons', 'grapes']);

        if (joining) {
            return genNum({
                stem: 'You have ' + a + ' ' + things + ' and get ' + b + ' more. How many now?',
                answer: a + b,
                explain: 'Getting more means adding: ' + a + ' + ' + b + ' = ' + (a + b) + '.',
                sig: 'join:' + a + ':' + b,
            });
        }
        const total = a + b;
        return genNum({
            stem: 'You have ' + total + ' ' + things + ' and give away ' + b + '. How many are left?',
            answer: a,
            explain: 'Giving away means subtracting: ' + total + ' − ' + b + ' = ' + a + '.',
            sig: 'sep:' + total + ':' + b,
        });
    };

    G['add.decompose10'] = function (rng, p) {
        const n = rng.int(4, p.max || 10);
        const right = [];
        for (let i = 0; i <= n; i++) right.push(i + ' + ' + (n - i));
        const chosen = rng.sample(right, Math.min(3, right.length));
        const wrong = [];
        [1, 2, 3].forEach((d) => {
            const a = rng.int(0, n);
            wrong.push(a + ' + ' + (n - a + d));
        });
        return genMulti(rng, {
            stem: 'Choose every pair that makes ' + n + '.',
            right: chosen,
            wrong: wrong.filter((w) => {
                const parts = w.split('+').map((x) => Number(x.trim()));
                return parts[0] + parts[1] !== n;
            }).slice(0, 3),
            explain: 'A number can be split up in more than one way, and all of them still make ' + n + '.',
            sig: 'decomp10:' + n + ':' + chosen.join(','),
        });
    };

    G['add.makeTen'] = function (rng) {
        const a = rng.int(0, 10);
        return genNum({
            stem: 'What goes with ' + a + ' to make ten?',
            prompt: [{ t: 'expr', s: a + '  +  ?  =  10' }],
            answer: 10 - a,
            explain: a + ' + ' + (10 - a) + ' = 10.',
            sig: 'mk10:' + a,
        });
    };

    function factItem(rng, max, sig) {
        const plus = rng.bool();
        if (plus) {
            const a = rng.int(0, max);
            const b = rng.int(0, max - a);
            return genNum({
                stem: a + ' plus ' + b,
                prompt: [{ t: 'expr', s: a + ' + ' + b }],
                answer: a + b,
                sig: sig + ':+' + a + ':' + b,
            });
        }
        const b = rng.int(0, max);
        const ans = rng.int(0, max - b);
        return genNum({
            stem: (b + ans) + ' minus ' + b,
            prompt: [{ t: 'expr', s: (b + ans) + ' − ' + b }],
            answer: ans,
            sig: sig + ':-' + (b + ans) + ':' + b,
        });
    }

    G['add.facts.within10'] = function (rng, p) { return factItem(rng, p.max || 10, 'f10'); };
    G['add.facts.within20'] = function (rng, p) { return factItem(rng, p.max || 20, 'f20'); };

    /*
     * The equals-sign node. Its whole value is the misconception: a learner
     * taught that "=" means "the answer comes next" reads 8 + 4 = _ + 5 as
     * asking for 12. So the wrong answer is deliberately the plausible one.
     */
    G['add.equalSign'] = function (rng) {
        const a = rng.int(3, 9);
        const b = rng.int(3, 9);
        const c = rng.int(2, Math.min(8, a + b - 1));
        const total = a + b;
        if (rng.bool()) {
            return genNum({
                stem: 'What number goes in the box? ' + a + ' + ' + b + ' = box + ' + c,
                prompt: [{ t: 'expr', s: a + ' + ' + b + '  =  ?  +  ' + c }],
                answer: total - c,
                hint: 'Both sides have to be worth the same.',
                explain: 'The left side is ' + total + ', so the right side must also be ' + total + '. '
                    + (total - c) + ' + ' + c + ' = ' + total + '. The equals sign means "the same as", '
                    + 'not "here comes the answer".',
                sig: 'eqBox:' + a + ':' + b + ':' + c,
            });
        }
        const trueOne = rng.bool();
        const shown = trueOne ? total : total + rng.pick([1, 2, -1, -2]);
        return genMc(rng, {
            stem: 'Is this true or false?  ' + a + ' + ' + b + ' = ' + shown,
            prompt: [{ t: 'expr', s: a + ' + ' + b + '  =  ' + shown }],
            correct: trueOne ? 'True' : 'False',
            distractors: [trueOne ? 'False' : 'True'],
            explain: a + ' + ' + b + ' is ' + total + ', so the statement is ' + (trueOne ? 'true' : 'false') + '.',
            sig: 'eqTF:' + a + ':' + b + ':' + shown,
        });
    };

    G['add.unknownPosition'] = function (rng, p) {
        const max = p.max || 20;
        const a = rng.int(1, max - 1);
        const b = rng.int(1, max - a);
        const total = a + b;
        const slot = rng.int(0, 2);
        const expr = slot === 0 ? '?  +  ' + b + '  =  ' + total
            : slot === 1 ? a + '  +  ?  =  ' + total
                : a + '  +  ' + b + '  =  ?';
        const ans = slot === 0 ? a : slot === 1 ? b : total;
        return genNum({
            stem: 'Find the missing number: ' + expr.replace(/\s+/g, ' '),
            prompt: [{ t: 'expr', s: expr }],
            answer: ans,
            hint: slot === 2 ? null : 'What is left when you take the part you know away from the whole?',
            explain: a + ' + ' + b + ' = ' + total + '.',
            sig: 'unk:' + a + ':' + b + ':' + slot,
        });
    };

    function columnItem(rng, max, sig) {
        const plus = rng.bool();
        if (plus) {
            const a = rng.int(Math.floor(max / 10), max - 1);
            const b = rng.int(1, max - a);
            return genNum({
                stem: a + ' plus ' + b,
                prompt: [{ t: 'expr', s: a + ' + ' + b }],
                answer: a + b,
                sig: sig + ':+' + a + ':' + b,
            });
        }
        // Built from the answer up, so borrowing appears without ever going
        // negative.
        const b = rng.int(1, max - 1);
        const ans = rng.int(1, max - b);
        return genNum({
            stem: (b + ans) + ' minus ' + b,
            prompt: [{ t: 'expr', s: (b + ans) + ' − ' + b }],
            answer: ans,
            hint: 'Line up the ones under the ones and the tens under the tens.',
            sig: sig + ':-' + (b + ans) + ':' + b,
        });
    }

    G['add.within100'] = function (rng, p) { return columnItem(rng, p.max || 100, 'c100'); };
    G['add.within1000'] = function (rng, p) { return columnItem(rng, p.max || 1000, 'c1000'); };

    G['add.algorithm'] = function (rng) {
        const plus = rng.bool();
        if (plus) {
            const a = rng.int(1000, 99999);
            const b = rng.int(1000, 99999);
            return genNum({
                stem: a + ' plus ' + b,
                prompt: [{ t: 'expr', s: a + ' + ' + b }],
                answer: a + b,
                sig: 'alg:+' + a + ':' + b,
            });
        }
        const b = rng.int(1000, 50000);
        const ans = rng.int(1000, 50000);
        return genNum({
            stem: (b + ans) + ' minus ' + b,
            prompt: [{ t: 'expr', s: (b + ans) + ' − ' + b }],
            answer: ans,
            hint: 'Watch the zeros when you borrow.',
            sig: 'alg:-' + (b + ans) + ':' + b,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-add', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
