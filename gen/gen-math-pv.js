/*
 * Item generators for place value.
 *
 * pv.tenTimes is the hinge of the strand: once "each place is ten times the one
 * to its right" is secure, decimals are an extension of a rule already known
 * rather than a new topic. Its items therefore ask about the relationship
 * between places, not just about naming a digit.
 */
(function () {
    'use strict';

    const G = {};

    const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];

    function digitsOf(n) { return String(n).split('').map(Number); }

    G['pv.teen'] = function (rng) {
        const n = rng.int(11, 19);
        if (rng.bool()) {
            return genNum({
                stem: 'Ten and how many more makes ' + n + '?',
                prompt: [{ t: 'expr', s: '10  +  ?  =  ' + n }],
                answer: n - 10,
                explain: n + ' is a ten and ' + (n - 10) + ' ones.',
                sig: 'teen:' + n,
            });
        }
        const swapped = Number(String(n).split('').reverse().join(''));
        return genMc(rng, {
            stem: 'Which number is one ten and ' + (n - 10) + ' ones?',
            correct: String(n),
            distractors: [String(swapped), String(n + 1), String(n - 10)],
            explain: 'One ten and ' + (n - 10) + ' ones is ' + n + '. Careful: the ten is written first.',
            sig: 'teenMc:' + n,
        });
    };

    G['pv.twoDigit'] = function (rng) {
        const n = rng.int(21, 99);
        const d = digitsOf(n);
        if (rng.bool()) {
            return genNum({
                stem: 'How many tens are there in ' + n + '?',
                answer: d[0],
                explain: n + ' is ' + d[0] + ' tens and ' + d[1] + ' ones.',
                sig: 'pv2tens:' + n,
            });
        }
        return genNum({
            stem: 'What is ' + d[0] + ' tens and ' + d[1] + ' ones?',
            prompt: [{ t: 'expr', s: d[0] + ' tens  +  ' + d[1] + ' ones  =  ?' }],
            answer: n,
            sig: 'pv2build:' + n,
        });
    };

    G['pv.compare.twoDigit'] = function (rng) {
        let a = rng.int(10, 99), b = rng.int(10, 99);
        // Prefer pairs where the ones digit points the wrong way, since comparing
        // ones before tens is the named misconception.
        if (rng.bool(0.6)) {
            const t1 = rng.int(1, 8);
            a = t1 * 10 + rng.int(0, 4);
            b = (t1 + rng.int(1, 9 - t1)) * 10 + rng.int(5, 9);
        }
        if (a === b) b = a + 1;
        return genMc(rng, {
            stem: 'Which number is bigger, ' + a + ' or ' + b + '?',
            prompt: [{ t: 'expr', s: a + '   or   ' + b }],
            correct: String(Math.max(a, b)),
            distractors: [String(Math.min(a, b))],
            explain: 'Compare the tens first: ' + Math.floor(a / 10) + ' tens against '
                + Math.floor(b / 10) + ' tens. The ones only matter if the tens are equal.',
            sig: 'cmp2:' + a + ':' + b,
        });
    };

    G['pv.threeDigit'] = function (rng) {
        const n = rng.int(100, 999);
        const d = digitsOf(n);
        const place = rng.int(0, 2);
        const digit = d[2 - place];
        return genNum({
            stem: 'In ' + n + ', what is the digit in the ' + PLACE[place] + ' place?',
            answer: digit,
            explain: n + ' is ' + d[0] + ' hundreds, ' + d[1] + ' tens and ' + d[2] + ' ones.',
            sig: 'pv3:' + n + ':' + place,
        });
    };

    G['pv.expanded'] = function (rng) {
        const n = rng.int(102, 9999);
        const d = digitsOf(n);
        const parts = d.map((x, i) => x * Math.pow(10, d.length - 1 - i)).filter((x) => x > 0);
        if (rng.bool()) {
            return genNum({
                stem: 'What is ' + parts.join(' + ') + '?',
                prompt: [{ t: 'expr', s: parts.join('  +  ') + '  =  ?' }],
                answer: n,
                sig: 'expBuild:' + n,
            });
        }
        return genMc(rng, {
            stem: 'Which is ' + n + ' written out in expanded form?',
            correct: parts.join(' + '),
            distractors: [
                d.filter((x) => x > 0).join(' + '),                       // digits, not values
                parts.slice().reverse().join(' + '),
                parts.map((x, i) => (i === 0 ? x * 10 : x)).join(' + '),
            ],
            explain: n + ' = ' + parts.join(' + ') + '.',
            sig: 'expMc:' + n,
        });
    };

    G['pv.numberline.whole'] = function (rng) {
        const scale = rng.pick([10, 100, 1000]);
        const hi = scale;
        const answer = rng.int(1, scale - 1);
        return genNumberline({
            stem: 'Show roughly where ' + answer + ' goes.',
            line: { lo: 0, hi: hi, ticks: 10, labels: { 0: '0', 10: String(hi) } },
            answer: answer,
            tol: hi / 20,
            hint: 'Each gap is ' + (hi / 10) + '.',
            explain: answer + ' is a bit ' + (answer < hi / 2 ? 'less' : 'more') + ' than halfway to ' + hi + '.',
            sig: 'nlWhole:' + answer + ':' + hi,
        });
    };

    G['pv.compare.multiDigit'] = function (rng) {
        const digits = rng.int(3, 6);
        const lo = Math.pow(10, digits - 1);
        let a = rng.int(lo, lo * 10 - 1);
        let b = rng.int(lo, lo * 10 - 1);
        // Sometimes give them different lengths, since "more digits is bigger"
        // is a rule that works here and then fails badly on decimals.
        if (rng.bool(0.3)) b = rng.int(Math.floor(lo / 10), lo - 1);
        if (a === b) b = a + 1;
        return genMc(rng, {
            stem: 'Which is bigger, ' + a + ' or ' + b + '?',
            prompt: [{ t: 'expr', s: a + '   or   ' + b }],
            correct: String(Math.max(a, b)),
            distractors: [String(Math.min(a, b))],
            explain: 'Line them up and compare from the left.',
            sig: 'cmpMulti:' + a + ':' + b,
        });
    };

    G['pv.round'] = function (rng) {
        const place = rng.pick([10, 100, 1000]);
        const n = rng.int(place, place * 100);
        const rounded = Math.round(n / place) * place;
        const placeName = place === 10 ? 'ten' : place === 100 ? 'hundred' : 'thousand';
        return genNum({
            stem: 'Round ' + n + ' to the nearest ' + placeName + '.',
            answer: rounded,
            hint: 'Which ' + placeName + ' is it closer to?',
            explain: n + ' sits between ' + (Math.floor(n / place) * place) + ' and '
                + (Math.ceil(n / place) * place) + ', and is nearer ' + rounded + '.',
            sig: 'round:' + n + ':' + place,
        });
    };

    G['pv.tenTimes'] = function (rng) {
        const digit = rng.int(1, 9);
        const place = rng.int(0, 3);
        const value = digit * Math.pow(10, place);
        if (rng.bool()) {
            return genNum({
                stem: 'A digit worth ' + value + ' moves one place to the left. What is it worth now?',
                answer: value * 10,
                explain: 'Each place to the left is worth ten times as much, so ' + value
                    + ' becomes ' + (value * 10) + '.',
                sig: 'tenTimesL:' + value,
            });
        }
        return genMc(rng, {
            stem: 'In ' + (digit * 1000 + digit * 100) + ', the first ' + digit
                + ' is worth how much more than the second ' + digit + '?',
            correct: '10 times as much',
            distractors: ['100 times as much', 'The same', '2 times as much'],
            explain: 'The first is ' + (digit * 1000) + ' and the second is ' + (digit * 100)
                + '. Each place is worth ten times the one to its right.',
            sig: 'tenTimesMc:' + digit,
        });
    };

    G['pv.powersOfTen'] = function (rng) {
        const base = rng.int(2, 99);
        const power = rng.int(1, 4);
        const factor = Math.pow(10, power);
        if (rng.bool()) {
            return genNum({
                stem: base + ' times ' + factor,
                prompt: [{ t: 'expr', s: base + ' × ' + factor }],
                answer: base * factor,
                explain: 'Multiplying by ' + factor + ' shifts every digit ' + power
                    + ' place' + (power > 1 ? 's' : '') + ' to the left.',
                sig: 'powMul:' + base + ':' + power,
            });
        }
        return genNum({
            stem: (base * factor) + ' divided by ' + factor,
            prompt: [{ t: 'expr', s: (base * factor) + ' ÷ ' + factor }],
            answer: base,
            hint: 'Think about the digits shifting, not about removing zeros — that rule breaks on decimals.',
            sig: 'powDiv:' + base + ':' + power,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-pv', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
