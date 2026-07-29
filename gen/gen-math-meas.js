/*
 * Item generators for measurement.
 *
 * Only three nodes here are tier 1, and they are the three that feed number
 * rather than the ones that are merely taught. Length as repeated units is the
 * same idea as the number line — equal intervals, not marks — which is what
 * fraction placement depends on; and area as multiplication is where the
 * distributive property becomes something you can see.
 */
(function () {
    'use strict';

    const G = {};

    /*
     * The ruler misread: starting from the 1 rather than the 0, or counting the
     * marks instead of the gaps between them. Both are offered.
     */
    G['meas.iterateUnits'] = function (rng) {
        const len = rng.int(3, 9);
        const startAt = rng.bool(0.4) ? rng.int(1, 3) : 0;
        const endAt = startAt + len;

        if (startAt === 0) {
            return genNum({
                stem: 'A stick starts at 0 on the ruler and ends at ' + endAt + '. How long is it?',
                answer: len,
                explain: 'It covers ' + len + ' whole units.',
                sig: 'iter0:' + len,
            });
        }
        return genMc(rng, {
            stem: 'A stick lies along a ruler from ' + startAt + ' to ' + endAt + '. How long is it?',
            correct: String(len),
            distractors: [String(endAt), String(len + 1), String(endAt + 1)],
            hint: 'Count the gaps it covers, not the numbers it touches.',
            explain: 'From ' + startAt + ' to ' + endAt + ' is ' + len
                + ' units. Reading ' + endAt + ' would only be right if it started at 0.',
            sig: 'iterOff:' + startAt + ':' + len,
        });
    };

    G['meas.area.count'] = function (rng) {
        const rows = rng.int(2, 6);
        const cols = rng.int(2, 8);
        return genNum({
            stem: 'How many unit squares cover this rectangle?',
            prompt: [
                { t: 'text', s: 'This rectangle is covered by unit squares, ' + rows + ' rows of ' + cols + '. How many squares?' },
                { t: 'svg', draw: 'array', args: { rows: rows, cols: cols } },
            ],
            answer: rows * cols,
            explain: rows + ' rows of ' + cols + ' squares is ' + (rows * cols) + ' squares, so the area is '
                + (rows * cols) + ' square units.',
            sig: 'areaCount:' + rows + ':' + cols,
        });
    };

    G['meas.area.multiply'] = function (rng) {
        const w = rng.int(3, 20);
        const h = rng.int(3, 20);
        if (rng.bool(0.3)) {
            // Perimeter offered as the distractor, since confusing the two is the
            // named misconception for this node.
            return genMc(rng, {
                stem: 'A rectangle is ' + w + ' by ' + h + '. What is its area?',
                correct: String(w * h),
                distractors: [String(2 * (w + h)), String(w + h), String(w * h * 2)],
                explain: 'Area is ' + w + ' × ' + h + ' = ' + (w * h) + ' square units. '
                    + (2 * (w + h)) + ' would be the distance all the way round.',
                sig: 'areaMc:' + w + ':' + h,
            });
        }
        return genNum({
            stem: 'A rectangle is ' + w + ' units wide and ' + h + ' units tall. What is its area?',
            answer: w * h,
            explain: w + ' × ' + h + ' = ' + (w * h) + ' square units.',
            sig: 'areaMul:' + w + ':' + h,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-meas', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
