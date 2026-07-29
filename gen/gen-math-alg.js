/*
 * Item generators for pre-algebra.
 *
 * Order of operations is here rather than in the arithmetic strands because the
 * misconception is not arithmetic: it is reading strictly left to right and
 * ignoring precedence. Items are built so that the left-to-right reading gives a
 * different answer, otherwise the node measures nothing.
 */
(function () {
    'use strict';

    const G = {};

    G['alg.orderOfOperations'] = function (rng) {
        const a = rng.int(2, 12);
        const b = rng.int(2, 9);
        const c = rng.int(2, 9);
        const form = rng.int(0, 2);

        let expr, answer, leftToRight;
        if (form === 0) {
            expr = a + ' + ' + b + ' × ' + c;
            answer = a + b * c;
            leftToRight = (a + b) * c;
        } else if (form === 1) {
            expr = '(' + a + ' + ' + b + ') × ' + c;
            answer = (a + b) * c;
            leftToRight = a + b * c;
        } else {
            expr = a + ' × ' + b + ' − ' + c;
            answer = a * b - c;
            leftToRight = a * (b - c);
        }

        // If both readings agree the item cannot discriminate, so redraw.
        if (answer === leftToRight) return G['alg.orderOfOperations'](rng);

        return genNum({
            stem: 'Work out ' + expr,
            prompt: [{ t: 'expr', s: expr }],
            answer: answer,
            hint: 'Brackets first, then multiply and divide, then add and subtract.',
            explain: expr + ' = ' + answer + '. Working strictly left to right would give '
                + leftToRight + ', which is why the order matters.',
            sig: 'ooo:' + form + ':' + a + ':' + b + ':' + c,
        });
    };


    // ---- tier 2 --------------------------------------------------------------
    G['alg.pattern.extend'] = function (rng) {
        const start = rng.int(1, 20);
        const step = rng.pick([2, 3, 4, 5, 10, -2, -3]);
        const run = [0, 1, 2, 3].map((i) => start + i * step);
        if (run.some((x) => x < 0)) return G['alg.pattern.extend'](rng);
        return genNum({
            stem: 'What comes next?  ' + run.join(', ') + ' …',
            prompt: [{ t: 'expr', s: run.join(',  ') + ',  ?' }],
            answer: start + 4 * step,
            hint: 'Work out the jump between each pair.',
            explain: 'Each step ' + (step > 0 ? 'adds ' + step : 'takes away ' + (-step)) + '.',
            sig: 'pat:' + start + ':' + step,
        });
    };

    G['alg.rule.apply'] = function (rng) {
        const mul = rng.int(2, 5);
        const add = rng.int(1, 9);
        const input = rng.int(2, 12);
        return genNum({
            stem: 'The rule is: multiply by ' + mul + ', then add ' + add + '. What comes out if '
                + input + ' goes in?',
            answer: input * mul + add,
            explain: input + ' × ' + mul + ' = ' + (input * mul) + ', then + ' + add + ' = '
                + (input * mul + add) + '.',
            sig: 'rule:' + mul + ':' + add + ':' + input,
        });
    };

    /*
     * Reading an expression without evaluating it. The numbers are deliberately
     * huge so that working it out is not a shortcut — the skill is seeing the
     * structure.
     */
    G['alg.expression.interpret'] = function (rng) {
        const a = rng.int(1000, 99999);
        const b = rng.int(1000, 99999);
        const k = rng.int(2, 9);
        return genMc(rng, {
            stem: 'Without working it out: how does ' + k + ' × (' + a + ' + ' + b + ') compare with ('
                + a + ' + ' + b + ')?',
            correct: k + ' times as large',
            distractors: [k + ' more', 'the same', 'k less'.replace('k', String(k))],
            hint: 'You do not need to add anything up.',
            explain: 'Multiplying the whole bracket by ' + k + ' makes it ' + k + ' times as large.',
            sig: 'expr:' + a + ':' + b + ':' + k,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-alg', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
