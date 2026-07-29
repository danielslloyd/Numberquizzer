#!/usr/bin/env node
/*
 * Does the vowel analysis actually work?
 *
 *   node tools/smoke-audio.js
 *
 * A classifier that has never been tested is a classifier that should not be
 * allowed near a child's score, and "it looked right on my own voice once" is
 * not a test. So this builds vowels from first principles — a glottal pulse
 * train through resonators at chosen frequencies — and checks that audio.js
 * finds the frequencies that were put in.
 *
 * Synthesis is the honest way round. Recording samples would test the analyser
 * against whatever a handful of adult voices happened to do; synthesis lets the
 * pitch be swept from an adult's 110 Hz to an excited child's 400 Hz while the
 * formants stay fixed, which is precisely the axis this is expected to fail on.
 * A high voice puts its harmonics so far apart that they undersample the very
 * envelope being measured, and that is not a hypothetical: it is why children
 * are the hard case in every formant-tracking paper.
 *
 * What is NOT claimed here: that a real microphone in a real room with a real
 * five-year-old behaves like this. Synthetic vowels have no room, no noise, no
 * breath and no wobble. This proves the arithmetic is right. It does not prove
 * the feature works, and only a real child can do that.
 */
'use strict';

const path = require('path');
const A = require(path.join(__dirname, '..', 'audio.js'));

const SR = 48000;
const failures = [];
let checks = 0;

function check(name, ok, detail) {
    checks++;
    if (!ok) failures.push(name + (detail ? '  — ' + detail : ''));
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${!ok && detail ? '  — ' + detail : ''}`);
}

/*
 * Source-filter synthesis, which is how a voice actually works: a buzzing
 * source at F0 shaped by resonances of the tract above it. Each formant is one
 * two-pole resonator; bandwidth sets how sharp it is (real formants run
 * 50-130 Hz, wider the higher they sit).
 */
function synth(f0, formants, seconds, opts) {
    const o = opts || {};
    const n = Math.floor(SR * seconds);
    const out = new Float32Array(n);

    // Glottal source: an impulse train, softened so it is not a mathematically
    // perfect click. Jitter keeps it from being suspiciously periodic.
    const period = SR / f0;
    let next = 0;
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < n; i++) {
        if (i >= next) {
            out[i] = 1;
            next += period * (1 + (o.jitter || 0) * (rnd() - 0.5));
        }
    }
    // -6 dB/octave source tilt, which a real glottal waveform has and a click
    // does not; without it every formant looks equally loud.
    let prev = 0;
    for (let i = 0; i < n; i++) { prev = out[i] + 0.97 * prev; out[i] = prev * 0.02; }

    formants.forEach((F, k) => {
        const bw = (o.bandwidths && o.bandwidths[k]) || (60 + k * 30);
        const r = Math.exp(-Math.PI * bw / SR);
        const theta = 2 * Math.PI * F / SR;
        const a1 = 2 * r * Math.cos(theta), a2 = -r * r;
        const g = (1 - 2 * r * Math.cos(theta) + r * r);
        let y1 = 0, y2 = 0;
        for (let i = 0; i < n; i++) {
            const y = g * out[i] + a1 * y1 + a2 * y2;
            y2 = y1; y1 = y; out[i] = y;
        }
    });

    if (o.noise) for (let i = 0; i < n; i++) out[i] += (rnd() - 0.5) * o.noise;

    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak * 1.2;
    return out;
}

/** Band-limited noise, for the sibilants. */
function fricative(centreHz, widthHz, seconds) {
    const n = Math.floor(SR * seconds);
    const out = new Float32Array(n);
    let seed = 999;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    for (let i = 0; i < n; i++) out[i] = rnd();
    // Two resonators in series make a rough band-pass; enough to separate a
    // 6 kHz hiss from a 3 kHz one, which is the only decision being made.
    for (let pass = 0; pass < 2; pass++) {
        const r = Math.exp(-Math.PI * widthHz / SR);
        const theta = 2 * Math.PI * centreHz / SR;
        const a1 = 2 * r * Math.cos(theta), a2 = -r * r;
        const g = (1 - 2 * r * Math.cos(theta) + r * r);
        let y1 = 0, y2 = 0;
        for (let i = 0; i < n; i++) {
            const y = g * out[i] + a1 * y1 + a2 * y2;
            y2 = y1; y1 = y; out[i] = y;
        }
    }
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak * 1.2;
    return out;
}

const FRAME = 2048;
function middleFrame(sig) {
    const start = Math.floor(sig.length / 2) - FRAME / 2;
    return sig.subarray(start, start + FRAME);
}

// ---- pitch ------------------------------------------------------------------
console.log('\nPitch');
[110, 150, 200, 250, 300, 380].forEach((f0) => {
    const sig = synth(f0, [700, 1200, 2600], 0.4, { jitter: 0.02 });
    const got = A.auF0(middleFrame(sig), SR);
    const err = Math.abs(got - f0) / f0;
    check(`F0 ${f0} Hz found within 3%`, err < 0.03, `got ${got.toFixed(1)}`);
});

const silence = new Float32Array(FRAME);
check('silence is not voiced', A.auF0(silence, SR) === 0);
check('hiss is not voiced', A.auF0(middleFrame(fricative(6000, 2500, 0.4)), SR) === 0,
    'got ' + A.auF0(middleFrame(fricative(6000, 2500, 0.4)), SR).toFixed(1));

// ---- formants ---------------------------------------------------------------
/*
 * The real test. Each vowel is swept across a pitch range that spans an adult
 * man to a small child, because the pitch is what makes this hard: the higher
 * the voice, the further apart its harmonics and the less of the envelope they
 * sample.
 */
console.log('\nFormants, across voices that could actually exist');
const CASES = [
    { id: 'long-e',  f1: 270, f2: 2290 },
    { id: 'short-i', f1: 390, f2: 1990 },
    { id: 'short-e', f1: 530, f2: 1840 },
    { id: 'short-a', f1: 660, f2: 1720 },
    { id: 'short-o', f1: 730, f2: 1090 },
    { id: 'short-u', f1: 640, f2: 1190 },
    { id: 'long-oo', f1: 300, f2: 870 },
];
const PITCHES = [120, 180, 240, 300];
const TOL = 0.18;          // 18% — well inside the gap between neighbouring vowels

/*
 * Pitch and formants are not independent, and a test that treats them as such
 * asks about voices nobody has. A high F0 comes from a small larynx, which comes
 * with a short vocal tract, which raises every formant together. So the sweep
 * scales the formants with the pitch the way a body does: an adult man at 120
 * Hz, a child at 300 with everything about half again as high.
 */
const tractScale = (f0) => 1 + (f0 - 120) / 400;

let formantHits = 0, formantTries = 0;
CASES.forEach((v) => {
    const misses = [];
    PITCHES.forEach((f0) => {
        const k = tractScale(f0);
        const want1 = v.f1 * k, want2 = v.f2 * k;
        const sig = synth(f0, [want1, want2, 2900 * k, 3600 * k], 0.5, { jitter: 0.02, noise: 0.001 });
        const a = A.auAnalyse(middleFrame(sig), SR);
        formantTries += 2;
        if (Math.abs(a.f1 - want1) / want1 < TOL) formantHits++;
        else misses.push(`F0 ${f0}: F1 ${a.f1.toFixed(0)}≠${want1.toFixed(0)}`);
        if (Math.abs(a.f2 - want2) / want2 < TOL) formantHits++;
        else misses.push(`F0 ${f0}: F2 ${a.f2.toFixed(0)}≠${want2.toFixed(0)}`);
    });
    check(`${v.id}: F1/F2 found at every voice size`, misses.length === 0, misses.join('; '));
});
console.log(`  ${formantHits}/${formantTries} formant readings inside ${(TOL * 100).toFixed(0)}%.`);

/*
 * Where it breaks, reported rather than asserted.
 *
 * Holding the formants still while raising the pitch is physically impossible,
 * but it isolates the one thing that actually limits this method: harmonics
 * spaced F0 apart can only sample so much of the envelope between them. When
 * two formants are closer together than about one and a half harmonics they
 * merge into a single hump and no amount of smoothing separates them. /o/ is
 * the vowel where F1 and F2 sit closest, so it goes first, and knowing at what
 * pitch it goes is worth more than pretending it does not.
 */
console.log('\n  Resolution limit (formants held still while pitch rises — not a real voice):');
CASES.forEach((v) => {
    const gap = v.f2 - v.f1;
    const broke = PITCHES.concat([360, 420]).find((f0) => {
        const sig = synth(f0, [v.f1, v.f2, 2900, 3600], 0.5, { jitter: 0.02, noise: 0.001 });
        const a = A.auAnalyse(middleFrame(sig), SR);
        return Math.abs(a.f2 - v.f2) / v.f2 >= TOL;
    });
    console.log(`    ${v.id.padEnd(8)} F1/F2 gap ${String(gap).padStart(4)} Hz — `
        + (broke ? `F2 lost at F0 ${broke} (${(gap / broke).toFixed(1)} harmonics apart)`
            : 'holds to 420 Hz'));
});

// ---- a child's voice --------------------------------------------------------
/*
 * A short vocal tract raises every formant together, by around half again. The
 * absolute hertz are then nothing like the textbook figures, which is exactly
 * why nothing downstream may use absolute thresholds — the normalised
 * coordinates have to survive the shift, and that is what is checked here.
 */
console.log('\nA child-sized voice (formants scaled 1.45x, pitch 300 Hz)');
const SCALE = 1.45;
let childRight = 0, rawRight = 0;
CASES.forEach((v) => {
    const sig = synth(300, [v.f1 * SCALE, v.f2 * SCALE, 2900 * SCALE, 3600 * SCALE], 0.5,
        { jitter: 0.02, noise: 0.001 });
    const a = A.auAnalyse(middleFrame(sig), SR);

    // Uncalibrated, with adult corners — expected to be wrong, and worth
    // demonstrating rather than asserting, because it is the reason calibration
    // is not optional.
    const raw = A.auClassifyVowel(a.f1, a.f2, null);

    // Calibrated: the corners measured from this same voice.
    const corner = (f1, f2) => {
        const s = synth(300, [f1 * SCALE, f2 * SCALE, 2900 * SCALE, 3600 * SCALE], 0.4, { jitter: 0.02 });
        const m = A.auAnalyse(middleFrame(s), SR);
        return { f1: m.f1, f2: m.f2 };
    };
    const anchors = {
        i: corner(270, 2290),
        a: corner(730, 1090),
        u: corner(300, 870),
    };
    const cal = A.auClassifyVowel(a.f1, a.f2, anchors);
    if (cal.vowel === v.id) childRight++;
    if (raw.vowel === v.id) rawRight++;
    console.log(`  ${v.id.padEnd(8)} uncalibrated → ${String(raw.vowel).padEnd(8)}`
        + `  calibrated → ${String(cal.vowel).padEnd(8)}`
        + `  (F1 ${a.f1.toFixed(0)} F2 ${a.f2.toFixed(0)})`);
});
check('calibrated, a child-sized voice is read correctly',
    childRight >= CASES.length - 1, `${childRight}/${CASES.length}`);
// The claim calibration exists to support. If this ever stops holding, either
// the adult defaults have quietly become good enough — in which case say so —
// or something upstream is broken and the calibration is doing nothing.
check('and uncalibrated it is not — this is why the warm-up is compulsory',
    rawRight < childRight - 2, `uncalibrated ${rawRight}/${CASES.length}, calibrated ${childRight}`);

// ---- the pairs a phonics ladder actually asks about --------------------------
/*
 * The product question, and a much lower bar than naming all eight: a drill
 * asks "is that the short a in cat or the long a in day", which is a decision
 * between two, not among eight.
 */
console.log('\nTelling apart the pairs a drill actually offers');
const PAIRS = [
    ['short-a', 'long-a'], ['short-e', 'long-e'], ['short-i', 'long-e'],
    ['short-o', 'long-oo'], ['short-u', 'long-oo'], ['short-i', 'short-e'],
];
PAIRS.forEach(([a1, a2]) => {
    const among = [a1, a2];
    let right = 0;
    [a1, a2].forEach((id) => {
        const v = A.auVowels.find((x) => x.id === id);
        [180, 300].forEach((f0) => {
            const sig = synth(f0, [v.f1, v.f2, 2900, 3600], 0.5, { jitter: 0.02, noise: 0.001 });
            const an = A.auAnalyse(middleFrame(sig), SR);
            if (A.auClassifyVowel(an.f1, an.f2, null, among).vowel === id) right++;
        });
    });
    check(`${a1} vs ${a2}`, right === 4, `${right}/4`);
});

// ---- sibilants --------------------------------------------------------------
console.log('\nSibilants');
const sSound = A.auAnalyse(middleFrame(fricative(6200, 3000, 0.4)), SR);
const shSound = A.auAnalyse(middleFrame(fricative(3000, 1200, 0.4)), SR);
check('/s/ is brighter than /sh/', sSound.centroid > shSound.centroid + 800,
    `s ${sSound.centroid.toFixed(0)} vs sh ${shSound.centroid.toFixed(0)}`);
check('/s/ classifies as s', A.auClassifySibilant(sSound).sound === 's',
    JSON.stringify(A.auClassifySibilant(sSound)));
check('/sh/ classifies as sh', A.auClassifySibilant(shSound).sound === 'sh',
    JSON.stringify(A.auClassifySibilant(shSound)));
check('a vowel is not mistaken for a sibilant',
    A.auClassifySibilant(A.auAnalyse(middleFrame(synth(200, [730, 1090, 2900], 0.4)), SR)).sound !== 's');
check('silence classifies as nothing', A.auClassifySibilant(A.auAnalyse(silence, SR)).sound === null);

// ---- confidence -------------------------------------------------------------
console.log('\nConfidence');
const clear = A.auAnalyse(middleFrame(synth(200, [270, 2290, 2900, 3600], 0.5, { jitter: 0.02 })), SR);
const clearV = A.auClassifyVowel(clear.f1, clear.f2, null);
// Halfway between /e/ and /a/ in both formants — genuinely ambiguous, and must
// say so rather than picking one with a straight face.
const between = A.auAnalyse(middleFrame(synth(200, [595, 1780, 2900, 3600], 0.5, { jitter: 0.02 })), SR);
const betweenV = A.auClassifyVowel(between.f1, between.f2, null, ['short-e', 'short-a']);
check('a clear vowel is reported confidently', clearV.confidence > 0.25,
    JSON.stringify(clearV));
check('a vowel halfway between two is reported as uncertain',
    betweenV.confidence < clearV.confidence,
    JSON.stringify({ clear: clearV.confidence, between: betweenV.confidence }));

// ---- report -----------------------------------------------------------------
console.log('');
if (failures.length) {
    console.log(`${failures.length} of ${checks} failed:`);
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
}
console.log(`OK — ${checks} checks passed.\n`);
