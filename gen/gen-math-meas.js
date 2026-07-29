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


    // ---- tier 2 ------------------------------------------------------------
    // Broadly taught and expected by any parent looking at the list, even though
    // little later work is blocked by them.

    function clockWords(h, m) {
        const H = ((h + 11) % 12) + 1;
        if (m === 0) return H + " o'clock";
        if (m === 30) return 'half past ' + H;
        if (m === 15) return 'quarter past ' + H;
        if (m === 45) return 'quarter to ' + (((H) % 12) + 1);
        if (m < 30) return m + ' minutes past ' + H;
        return (60 - m) + ' minutes to ' + (((H) % 12) + 1);
    }
    function digital(h, m) { return h + ':' + (m < 10 ? '0' + m : m); }

    G['meas.compareDirect'] = function (rng) {
        const a = rng.int(3, 14), b = rng.int(3, 14);
        if (a === b) return G['meas.compareDirect'](rng);
        const names = rng.sample(['the pencil', 'the ribbon', 'the straw', 'the stick', 'the string'], 2);
        return genMc(rng, {
            stem: names[0] + ' is ' + a + ' cubes long. ' + names[1] + ' is ' + b
                + ' cubes long. Which is longer?',
            correct: a > b ? names[0] : names[1],
            distractors: [a > b ? names[1] : names[0], 'They are the same'],
            explain: a + ' is ' + (a > b ? 'more' : 'less') + ' than ' + b + '.',
            sig: 'cmpDirect:' + a + ':' + b,
        });
    };

    G['meas.ruler'] = function (rng) {
        const start = rng.int(0, 4);
        const len = rng.int(2, 10);
        return genNum({
            stem: 'A ribbon lies on a ruler from ' + start + ' cm to ' + (start + len) + ' cm. How long is it in cm?',
            answer: len,
            hint: 'Take the start away from the end.',
            explain: (start + len) + ' − ' + start + ' = ' + len + ' cm.',
            sig: 'ruler:' + start + ':' + len,
        });
    };

    G['meas.time.hourHalf'] = function (rng) {
        const h = rng.int(1, 12);
        const m = rng.pick([0, 30]);
        return genMc(rng, {
            stem: 'The clock shows ' + digital(h, m) + '. How do you say that time?',
            correct: clockWords(h, m),
            distractors: [clockWords(h, m === 0 ? 30 : 0), clockWords((h % 12) + 1, m),
                clockWords(h === 1 ? 12 : h - 1, m)],
            sig: 'timeHH:' + h + ':' + m,
        });
    };

    G['meas.time.fiveMin'] = function (rng) {
        const h = rng.int(1, 12);
        const m = rng.pick([5, 10, 15, 20, 25, 35, 40, 45, 50, 55]);
        return genMc(rng, {
            stem: 'The clock shows ' + digital(h, m) + '. How do you say that time?',
            correct: clockWords(h, m),
            distractors: [clockWords(h, 60 - m), clockWords((h % 12) + 1, m), clockWords(h, m === 30 ? 25 : 30)],
            hint: m < 30 ? 'After the half hour we count minutes past.' : 'After the half hour we count minutes to the next hour.',
            sig: 'time5:' + h + ':' + m,
        });
    };

    G['meas.time.elapsed'] = function (rng) {
        const h = rng.int(1, 10);
        const m = rng.pick([0, 10, 15, 20, 30, 45]);
        const mins = rng.pick([20, 25, 40, 45, 50, 90]);
        const total = h * 60 + m + mins;
        const endH = Math.floor(total / 60), endM = total % 60;
        return genMc(rng, {
            stem: 'A film starts at ' + digital(h, m) + ' and lasts ' + mins + ' minutes. When does it end?',
            correct: digital(endH, endM),
            distractors: [digital(endH, (endM + 10) % 60), digital(endH === 12 ? 1 : endH + 1, endM),
                digital(h, (m + mins) % 60)],
            hint: 'Count on to the next whole hour first.',
            explain: digital(h, m) + ' plus ' + mins + ' minutes is ' + digital(endH, endM) + '.',
            sig: 'elapsed:' + h + ':' + m + ':' + mins,
        });
    };

    G['meas.money.count'] = function (rng) {
        // Minor units throughout — money maths is integer-only everywhere in
        // this app, and mixing in floats is how rounding bugs start.
        const COINS = [1, 2, 5, 10, 20, 50, 100];
        const picks = [];
        const n = rng.int(3, 5);
        for (let i = 0; i < n; i++) picks.push(rng.pick(COINS));
        const total = picks.reduce((a, b) => a + b, 0);
        const fmt = (c) => (c >= 100 ? '£' + (c / 100).toFixed(2) : c + 'p');
        return genNum({
            stem: 'How much altogether, in pence?  ' + picks.map(fmt).join(' + '),
            answer: total,
            hint: 'Start with the biggest coin.',
            explain: picks.join(' + ') + ' = ' + total + 'p.',
            sig: 'money:' + picks.join(','),
        });
    };

    G['meas.convert'] = function (rng) {
        const CASES = [
            { from: 'm', to: 'cm', k: 100 }, { from: 'km', to: 'm', k: 1000 },
            { from: 'kg', to: 'g', k: 1000 }, { from: 'l', to: 'ml', k: 1000 },
            { from: 'hours', to: 'minutes', k: 60 }, { from: 'minutes', to: 'seconds', k: 60 },
        ];
        const c = rng.pick(CASES);
        const n = rng.int(2, 9);
        return genNum({
            stem: 'How many ' + c.to + ' are there in ' + n + ' ' + c.from + '?',
            answer: n * c.k,
            explain: '1 ' + c.from + ' is ' + c.k + ' ' + c.to + ', so ' + n + ' is ' + (n * c.k) + '.',
            sig: 'conv:' + c.from + ':' + n,
        });
    };

    G['meas.perimeter'] = function (rng) {
        const w = rng.int(3, 20), h = rng.int(3, 20);
        return genMc(rng, {
            stem: 'A rectangle is ' + w + ' by ' + h + '. What is the distance all the way round?',
            correct: String(2 * (w + h)),
            // Area is the tempting wrong answer, and the confusion runs both ways.
            distractors: [String(w * h), String(w + h), String(2 * w * h)],
            explain: w + ' + ' + h + ' + ' + w + ' + ' + h + ' = ' + (2 * (w + h))
                + '. ' + (w * h) + ' would be the space inside, which is a different question.',
            sig: 'perim:' + w + ':' + h,
        });
    };

    G['meas.volume'] = function (rng) {
        const l = rng.int(2, 9), w = rng.int(2, 9), h = rng.int(2, 9);
        return genNum({
            stem: 'A box is ' + l + ' by ' + w + ' by ' + h + ' unit cubes. How many cubes fill it?',
            answer: l * w * h,
            hint: 'One layer first, then how many layers.',
            explain: l + ' × ' + w + ' = ' + (l * w) + ' in each layer, and ' + h + ' layers gives '
                + (l * w * h) + '.',
            sig: 'vol:' + l + ':' + w + ':' + h,
        });
    };

    G['meas.data.graphs'] = function (rng) {
        const scale = rng.pick([1, 2, 5, 10]);
        const symbols = rng.int(3, 8);
        const other = rng.int(1, 7);
        return genMc(rng, {
            stem: 'On a picture graph each picture stands for ' + scale + ' children. '
                + 'One row has ' + symbols + ' pictures. How many children is that?',
            correct: String(symbols * scale),
            // Ignoring the scale is the named misconception, so it is on offer.
            distractors: [String(symbols), String(symbols + scale), String(other * scale)],
            hint: 'Each picture is worth more than one.',
            explain: symbols + ' × ' + scale + ' = ' + (symbols * scale)
                + '. Counting the pictures alone would give ' + symbols + ', which ignores the key.',
            sig: 'graph:' + scale + ':' + symbols,
        });
    };

    G['meas.data.lineplot'] = function (rng) {
        const vals = [];
        for (let i = 0; i < 6; i++) vals.push(rng.pick([1, 1.5, 2, 2.5, 3]));
        const most = vals.slice().sort((a, b) =>
            vals.filter((v) => v === b).length - vals.filter((v) => v === a).length)[0];
        return genMc(rng, {
            stem: 'A line plot records these lengths in cm: ' + vals.join(', ')
                + '. Which length was recorded most often?',
            correct: String(most),
            distractors: [...new Set(vals.filter((v) => v !== most))].slice(0, 3).map(String),
            explain: most + ' appears ' + vals.filter((v) => v === most).length + ' times.',
            sig: 'lineplot:' + vals.join(','),
        });
    };

    G['meas.angle'] = function (rng) {
        const a = rng.pick([30, 45, 60, 90, 120, 135, 150]);
        const b = rng.pick([20, 30, 40, 45, 60]);
        if (rng.bool()) {
            return genNum({
                stem: 'Two angles of ' + a + '° and ' + b + '° sit side by side. What do they make together?',
                answer: a + b,
                explain: 'Angles side by side add up: ' + a + ' + ' + b + ' = ' + (a + b) + '°.',
                sig: 'angleAdd:' + a + ':' + b,
            });
        }
        const kind = a < 90 ? 'acute' : a === 90 ? 'a right angle' : 'obtuse';
        return genMc(rng, {
            stem: 'An angle measures ' + a + '°. What kind of angle is it?',
            correct: kind,
            distractors: ['acute', 'obtuse', 'a right angle', 'reflex'].filter((k) => k !== kind),
            hint: 'A right angle is exactly 90°.',
            explain: a + '° is ' + kind + '. The length of the drawn arms makes no difference.',
            sig: 'angleKind:' + a,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-meas', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
