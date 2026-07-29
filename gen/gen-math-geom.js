/*
 * Item generators for geometry.
 *
 * Only the partition node is tier 1, and only because it is where fractions
 * begin: splitting a shape into equal areas is the concrete act that "one part
 * of b equal parts" names. Its misconception — that equal parts must be the same
 * shape — is the one worth catching.
 */
(function () {
    'use strict';

    const G = {};

    G['geom.partition.equalArea'] = function (rng) {
        const d = rng.pick([2, 3, 4, 6, 8]);
        if (rng.bool()) {
            return genMc(rng, {
                stem: 'A shape is split into ' + d + ' equal parts. How much of the whole shape is one part?',
                prompt: [
                    { t: 'text', s: 'One of these ' + d + ' equal parts is how much of the whole?' },
                    { t: 'svg', draw: 'fraction-bar', args: { num: 1, den: d } },
                ],
                correct: '1/' + d,
                distractors: ['1/' + (d - 1), (d - 1) + '/' + d, d + '/1'],
                explain: 'One part out of ' + d + ' equal parts is 1/' + d + ' of the whole.',
                sig: 'part:' + d,
            });
        }
        return genMc(rng, {
            stem: 'A square is cut into 4 equal parts. Two of them are triangles and two are '
                + 'rectangles. Can the parts still be equal?',
            correct: 'Yes, if they cover the same amount',
            distractors: [
                'No, equal parts must be the same shape',
                'No, a square cannot be cut into triangles',
                'Only if they are all triangles',
            ],
            explain: 'Equal parts means equal amount of space, not identical shape. Parts of the '
                + 'same whole can look different and still be equal.',
            sig: 'partShape',
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-geom', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
