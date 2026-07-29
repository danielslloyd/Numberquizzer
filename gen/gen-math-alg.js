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

    if (typeof CUR !== 'undefined') CUR.registerGens('math-alg', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
