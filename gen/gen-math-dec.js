/*
 * Item generators for decimals.
 *
 * Arithmetic is done in integer units and divided down at the end. Working in
 * floats would make 0.1 + 0.2 fail to equal 0.3, and an item whose own answer
 * does not grade correct is the one failure this app cannot ship.
 *
 * dec.compare carries the best-documented misconception in the strand: "longer
 * is larger", where 0.45 is judged greater than 0.7 because it has more digits.
 * Its distractors are built to catch exactly that, and its counterpart —
 * over-correcting to "shorter is larger".
 */
(function () {
    'use strict';

    const G = {};

    // Integer units in, string out. Avoids float noise in both value and display.
    function dec(units, places) {
        return (units / Math.pow(10, places)).toFixed(places);
    }
    const TOL = 1e-9;

    G['dec.tenthsHundredths'] = function (rng) {
        const hundredths = rng.bool();
        const places = hundredths ? 2 : 1;
        const units = rng.int(1, hundredths ? 99 : 9);
        const value = dec(units, places);
        if (rng.bool()) {
            return genNum({
                stem: 'Write ' + units + ' ' + (hundredths ? 'hundredths' : 'tenths') + ' as a decimal.',
                answer: Number(value),
                tol: TOL,
                explain: units + ' ' + (hundredths ? 'hundredths' : 'tenths') + ' is ' + value + '.',
                sig: 'dth:' + units + ':' + places,
            });
        }
        return genMc(rng, {
            stem: 'What is ' + value + ' as a fraction?',
            correct: units + '/' + Math.pow(10, places),
            distractors: [
                units + '/' + Math.pow(10, places === 1 ? 2 : 1),
                Math.pow(10, places) + '/' + units,
                units + '/' + (units + 1),
            ],
            explain: value + ' is ' + units + ' out of ' + Math.pow(10, places) + '.',
            sig: 'dthFrac:' + units + ':' + places,
        });
    };

    G['dec.fractionLink'] = function (rng) {
        const pairs = [[1, 2, '0.5'], [1, 4, '0.25'], [3, 4, '0.75'], [1, 5, '0.2'], [2, 5, '0.4'],
            [3, 5, '0.6'], [4, 5, '0.8'], [1, 10, '0.1'], [7, 10, '0.7'], [1, 20, '0.05'], [3, 20, '0.15']];
        const pick = rng.pick(pairs);
        return genNum({
            stem: 'Write ' + pick[0] + '/' + pick[1] + ' as a decimal.',
            prompt: [{ t: 'expr', s: pick[0] + '/' + pick[1] + '  =  ?' }],
            answer: Number(pick[2]),
            tol: TOL,
            hint: 'Can you make the bottom number 10 or 100?',
            explain: pick[0] + '/' + pick[1] + ' = ' + pick[2] + '.',
            sig: 'decFrac:' + pick[0] + '/' + pick[1],
        });
    };

    G['dec.numberline'] = function (rng) {
        const tenths = rng.int(1, 9);
        const value = Number(dec(tenths, 1));
        return genNumberline({
            stem: 'Show ' + value.toFixed(1) + ' on the number line.',
            line: { lo: 0, hi: 1, ticks: 10, labels: { 0: '0', 10: '1' } },
            answer: value,
            tol: 0.05,
            hint: 'Each gap is a tenth.',
            explain: value.toFixed(1) + ' is ' + tenths + ' tenths along.',
            sig: 'decNl:' + tenths,
        });
    };

    G['dec.compare'] = function (rng) {
        // Deliberately weighted toward the case where the shorter number is
        // bigger, which is where "longer is larger" gives the wrong answer.
        const aTenths = rng.int(1, 9);
        const a = Number(dec(aTenths, 1));
        const bHundredths = rng.int(1, aTenths * 10 - 1);
        const b = Number(dec(bHundredths, 2));
        if (a === b) return G['dec.compare'](rng, {});
        return genMc(rng, {
            stem: 'Which is bigger, ' + a.toFixed(1) + ' or ' + b.toFixed(2) + '?',
            prompt: [{ t: 'expr', s: a.toFixed(1) + '   or   ' + b.toFixed(2) }],
            correct: a > b ? a.toFixed(1) : b.toFixed(2),
            distractors: [a > b ? b.toFixed(2) : a.toFixed(1), 'They are equal'],
            hint: 'Compare the tenths first.',
            explain: a.toFixed(1) + ' is ' + (aTenths) + ' tenths, and ' + b.toFixed(2) + ' is '
                + bHundredths + ' hundredths, which is ' + (bHundredths / 10).toFixed(1)
                + ' tenths. More digits does not mean bigger.',
            sig: 'decCmp:' + aTenths + ':' + bHundredths,
        });
    };

    G['dec.thousandths'] = function (rng) {
        const units = rng.int(1, 999);
        const value = dec(units, 3);
        return genNum({
            stem: 'Write ' + units + ' thousandths as a decimal.',
            answer: Number(value),
            tol: TOL,
            explain: units + ' thousandths is ' + value + '.',
            sig: 'thou:' + units,
        });
    };

    G['dec.round'] = function (rng) {
        const units = rng.int(100, 9999);
        const value = Number(dec(units, 3));
        const toPlaces = rng.pick([0, 1, 2]);
        const factor = Math.pow(10, toPlaces);
        const rounded = Math.round(value * factor) / factor;
        const names = ['a whole number', 'one decimal place', 'two decimal places'];
        return genNum({
            stem: 'Round ' + value.toFixed(3) + ' to ' + names[toPlaces] + '.',
            answer: rounded,
            tol: TOL,
            hint: 'Look at the digit just after where you are rounding to.',
            explain: value.toFixed(3) + ' rounds to ' + rounded + '.',
            sig: 'decRound:' + units + ':' + toPlaces,
        });
    };

    G['dec.addSub'] = function (rng) {
        const places = 2;
        const a = rng.int(10, 9999);
        const plus = rng.bool();
        if (plus) {
            const b = rng.int(10, 9999);
            return genNum({
                stem: dec(a, places) + ' plus ' + dec(b, places),
                prompt: [{ t: 'expr', s: dec(a, places) + '  +  ' + dec(b, places) }],
                answer: Number(dec(a + b, places)),
                tol: TOL,
                hint: 'Line up the decimal points, not the right-hand ends.',
                sig: 'decAdd:' + a + ':' + b,
            });
        }
        const b = rng.int(10, a);
        return genNum({
            stem: dec(a, places) + ' minus ' + dec(b, places),
            prompt: [{ t: 'expr', s: dec(a, places) + '  −  ' + dec(b, places) }],
            answer: Number(dec(a - b, places)),
            tol: TOL,
            hint: 'Line up the decimal points, not the right-hand ends.',
            sig: 'decSub:' + a + ':' + b,
        });
    };

    G['dec.mult'] = function (rng) {
        const aUnits = rng.int(11, 999);       // 2 decimal places
        const b = rng.int(2, 9);
        return genNum({
            stem: dec(aUnits, 2) + ' times ' + b,
            prompt: [{ t: 'expr', s: dec(aUnits, 2) + '  ×  ' + b }],
            answer: Number(dec(aUnits * b, 2)),
            tol: TOL,
            hint: 'Multiply as if there were no point, then put it back.',
            sig: 'decMul:' + aUnits + ':' + b,
        });
    };

    G['dec.div'] = function (rng) {
        const quotientUnits = rng.int(11, 999);   // 2 decimal places
        const divisor = rng.int(2, 9);
        const dividendUnits = quotientUnits * divisor;
        return genNum({
            stem: dec(dividendUnits, 2) + ' divided by ' + divisor,
            prompt: [{ t: 'expr', s: dec(dividendUnits, 2) + '  ÷  ' + divisor }],
            answer: Number(dec(quotientUnits, 2)),
            tol: TOL,
            hint: 'The point in the answer sits above the point in the number being divided.',
            sig: 'decDiv:' + dividendUnits + ':' + divisor,
        });
    };


    // ---- tier 2 --------------------------------------------------------------
    G['dec.expanded'] = function (rng) {
        const whole = rng.int(1, 99);
        const t = rng.int(1, 9), h = rng.int(1, 9);
        const value = Number(whole + '.' + t + h);
        const parts = [];
        String(whole).split('').forEach((d, i, arr) => {
            const v = Number(d) * Math.pow(10, arr.length - 1 - i);
            if (v > 0) parts.push(String(v));
        });
        parts.push('0.' + t);
        parts.push('0.0' + h);
        return genMc(rng, {
            stem: 'Which is ' + value.toFixed(2) + ' written out in expanded form?',
            correct: parts.join(' + '),
            distractors: [
                parts.slice().reverse().join(' + '),
                parts.map((x) => x.replace('0.0', '0.')).join(' + '),
                String(whole) + ' + ' + t + ' + ' + h,
            ],
            explain: value.toFixed(2) + ' = ' + parts.join(' + ') + '.',
            sig: 'decExp:' + whole + ':' + t + ':' + h,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-dec', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
