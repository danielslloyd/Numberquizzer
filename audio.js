/*
 * audio.js — hearing sounds rather than words.  Prefix: au
 *
 * speech.js asks a recogniser "what word was that". This asks the signal itself
 * "what shape is that". They are not competitors: a recogniser is trained on
 * words and returns junk for a bare phoneme — say /sh/ into one and you get
 * back *she*, *shh*, *sha*, or nothing — while this cannot tell you a word at
 * all. Between them they cover the two halves of a phonics assessment.
 *
 * The physics that makes this possible: a vowel is almost entirely defined by
 * its first two resonances, F1 and F2. Say /ee/ and /ah/ and the tongue moves;
 * F1 and F2 move with it, by hundreds of hertz, in opposite directions. That is
 * visible in a spectrum and needs no model, no training data and no network.
 *
 * WHAT THIS CAN AND CANNOT DO, stated plainly so nobody spends a week on the
 * parts that do not work:
 *
 *   Works — a sustained isolated vowel, held about a second. Steady state, high
 *   signal, and the long/short pairs a phonics ladder cares about (/æ/ vs /eɪ/,
 *   /ɛ/ vs /iː/) sit far apart in F1/F2 space.
 *
 *   Works — sibilant contrast. /s/ against /ʃ/ is a spectral centroid apart,
 *   around 5-7 kHz against 3-4 kHz, and that is twenty lines of code.
 *
 *   Works — voicing. /s/ against /z/ is the presence of a periodic low-frequency
 *   component, which the pitch detector already finds.
 *
 *   Does NOT work — a vowel inside a spoken word. Finding the nucleus needs
 *   segmentation, and coarticulation drags the formants toward whatever
 *   consonants surround them.
 *
 *   Does NOT work — stop consonants. Bursts and formant transitions, on the
 *   order of 20ms. Genuinely hard, and low return for a drill.
 *
 * TWO THINGS THAT DECIDE WHETHER ANY OF IT WORKS AT ALL:
 *
 *   The capture constraints must be OFF. echoCancellation, noiseSuppression and
 *   autoGainControl are tuned to make speech intelligible over a wire, and every
 *   one of them destroys what is measured here — noise suppression in particular
 *   treats sustained frication as noise and gates /s/ away entirely. Left on,
 *   this looks like a broken classifier rather than a broken capture.
 *
 *   Calibration is mandatory. A child's vocal tract is short, so their formants
 *   sit half again as high as the adult figures every table quotes. Absolute
 *   thresholds misclassify every child alive. auCalibrate() anchors the space to
 *   the actual voice in the room and everything downstream works in normalised
 *   coordinates.
 *
 * The DSP below takes plain Float32Arrays and returns plain numbers, with no
 * reference to the browser, so it can be driven from synthesised audio in Node.
 * tools/smoke-audio.js does exactly that: builds vowels with known formants and
 * checks they are found. A classifier nobody can test is a classifier nobody
 * should trust with a child's score.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) Object.keys(api).forEach((k) => { root[k] = api[k]; });
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    // =====================================================================
    // FFT — iterative radix-2, in place, on separate re/im arrays.
    // =====================================================================
    function fft(re, im) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                let t = re[i]; re[i] = re[j]; re[j] = t;
                t = im[i]; im[i] = im[j]; im[j] = t;
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const ang = -2 * Math.PI / len;
            const wr = Math.cos(ang), wi = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let cr = 1, ci = 0;
                for (let k = 0; k < len / 2; k++) {
                    const ur = re[i + k], ui = im[i + k];
                    const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
                    const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
                    re[i + k] = ur + vr; im[i + k] = ui + vi;
                    re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
                    const nr = cr * wr - ci * wi;
                    ci = cr * wi + ci * wr; cr = nr;
                }
            }
        }
    }

    function nextPow2(n) { let p = 1; while (p < n) p <<= 1; return p; }

    function hann(n) {
        const w = new Float32Array(n);
        for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
        return w;
    }
    const windowCache = new Map();
    function windowOf(n) {
        if (!windowCache.has(n)) windowCache.set(n, hann(n));
        return windowCache.get(n);
    }

    /** Magnitude spectrum of a time-domain frame. Returns bins 0..N/2. */
    function auSpectrum(frame, fftSize) {
        const N = fftSize || nextPow2(frame.length);
        const w = windowOf(frame.length);
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < frame.length; i++) re[i] = frame[i] * w[i];
        fft(re, im);
        const half = N / 2;
        const mag = new Float64Array(half);
        for (let i = 0; i < half; i++) mag[i] = Math.hypot(re[i], im[i]);
        return mag;
    }

    function auRms(frame) {
        let s = 0;
        for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
        return Math.sqrt(s / frame.length);
    }

    // =====================================================================
    // Pitch, by autocorrelation.
    // =====================================================================
    /*
     * Wanted for its own sake — voiced/unvoiced is what tells /s/ from /z/ — and
     * because the harmonic comb it produces is the main obstacle to reading
     * formants off a spectrum, so the smoother needs to know its spacing.
     *
     * Range covers a child comfortably: they sit around 250-300 Hz, well above
     * an adult, and going to 500 leaves headroom for an excited five-year-old.
     */
    function auF0(frame, sampleRate, opts) {
        const o = opts || {};
        const minHz = o.minHz || 70, maxHz = o.maxHz || 500;
        const minLag = Math.floor(sampleRate / maxHz);
        const maxLag = Math.min(Math.floor(sampleRate / minHz), frame.length - 1);
        if (maxLag <= minLag) return 0;

        let energy = 0;
        for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
        if (energy <= 1e-12) return 0;

        const norm = new Float64Array(maxLag + 1);
        let best = 0;
        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0, na = 0, nb = 0;
            for (let i = 0; i + lag < frame.length; i++) {
                sum += frame[i] * frame[i + lag];
                na += frame[i] * frame[i];
                nb += frame[i + lag] * frame[i + lag];
            }
            norm[lag] = sum / (Math.sqrt(na * nb) + 1e-12);
            if (norm[lag] > best) best = norm[lag];
        }
        // Below this the "period" found is noise agreeing with itself.
        if (best < (o.threshold === undefined ? 0.35 : o.threshold)) return 0;

        // Octave errors are THE failure of autocorrelation pitch: a signal that
        // repeats every T also repeats every 2T, and at some pitches the double
        // lag correlates fractionally better and the reading halves. So take the
        // SHORTEST lag that is essentially as good as the best, not the best.
        for (let lag = minLag; lag <= maxLag; lag++) {
            if (norm[lag] >= best * 0.92) return sampleRate / lag;
        }
        return 0;
    }

    // =====================================================================
    // Spectral envelope, by cepstral liftering.
    // =====================================================================
    /*
     * The hard part of formant estimation, and the reason a naive peak-pick
     * fails on exactly the voices this app cares about.
     *
     * A voiced spectrum is the vocal-tract envelope multiplied by a comb of
     * harmonics spaced F0 apart. Take the log and that product becomes a sum,
     * which puts the slowly-varying envelope at low quefrency and the comb at
     * one sharp spike at quefrency 1/F0. Cut above the envelope and transform
     * back, and the comb is gone.
     *
     * The lifter length is the whole game. Too long and the comb survives and
     * every harmonic looks like a formant; too short and F1 and F2 merge into
     * one hump. It is set from the measured F0 so a high child voice — where the
     * harmonics are furthest apart and the problem is worst — gets a shorter
     * lifter than an adult, which is exactly backwards from a fixed constant.
     */
    function auEnvelope(mag, sampleRate, f0) {
        const half = mag.length;
        const N = half * 2;
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < half; i++) {
            const v = Math.log(mag[i] + 1e-10);
            re[i] = v;
            re[N - 1 - i] = v;          // mirror: the log spectrum is real and even
        }
        fft(re, im);                     // -> real cepstrum in re

        // Quefrency index q is a lag of q/sampleRate seconds, so the pitch spike
        // lands at sampleRate/F0. Keep comfortably below it.
        //
        // 0.75 rather than something safer because of what happens at 0.55: for
        // a back vowel like /o/, F1 730 and F2 1090 are close enough that a
        // short lifter merges them into a single hump at 840, F2 is then found
        // at F3 instead, and every back vowel lands in the wrong place. Sitting
        // this close to the pitch spike is the price of telling them apart.
        const pitchQ = f0 > 0 ? sampleRate / f0 : 0;
        let keep = pitchQ > 0 ? Math.floor(pitchQ * 0.75) : 96;
        keep = Math.max(30, Math.min(keep, 200));

        for (let i = keep; i < N - keep; i++) { re[i] = 0; im[i] = 0; }
        for (let i = 0; i < N; i++) im[i] = -im[i];      // inverse via conjugation
        fft(re, im);
        const env = new Float64Array(half);
        for (let i = 0; i < half; i++) env[i] = Math.exp(re[i] / N);
        return env;
    }

    /** Peaks in `env` between loHz and hiHz, strongest first, with sub-bin interpolation. */
    function peaksIn(env, sampleRate, loHz, hiHz) {
        const binHz = sampleRate / (env.length * 2);
        const lo = Math.max(1, Math.floor(loHz / binHz));
        const hi = Math.min(env.length - 2, Math.ceil(hiHz / binHz));
        const out = [];
        for (let i = lo; i <= hi; i++) {
            if (env[i] > env[i - 1] && env[i] >= env[i + 1]) {
                // Parabolic interpolation through the three log magnitudes: the
                // true peak rarely sits on a bin centre, and 23 Hz of rounding
                // is a real fraction of the gap between two vowels.
                const a = Math.log(env[i - 1] + 1e-12);
                const b = Math.log(env[i] + 1e-12);
                const c = Math.log(env[i + 1] + 1e-12);
                const denom = a - 2 * b + c;
                const shift = denom === 0 ? 0 : 0.5 * (a - c) / denom;
                out.push({ hz: (i + shift) * binHz, level: env[i] });
            }
        }
        return out.sort((x, y) => y.level - x.level);
    }

    /*
     * F1 and F2 from an envelope.
     *
     * The bands are wide on purpose: a child's F1 can reach 1100 Hz on /a/,
     * which would be an adult's F2 territory. Taking the strongest peak in each
     * band and insisting F2 > F1 is cruder than a proper LPC root-solve, but the
     * decision it feeds is between a handful of vowels that are far apart, and
     * it fails in ways that are easy to see rather than subtle.
     */
    function auFormants(env, sampleRate) {
        // The bands must hold a CHILD, not an adult. Every table of formant
        // frequencies is adult-referenced, and a child's are around half again
        // as high — their /iː/ has F2 above 3300, so an adult-sized band ending
        // at 3200 does not contain it and the search silently returns whatever
        // else was in range. That failure is invisible in the numbers and
        // poisons calibration, since the calibration corners are measured the
        // same way.
        const f1s = peaksIn(env, sampleRate, 200, 1500);
        const f2s = peaksIn(env, sampleRate, 700, 4000);
        const f1 = f1s.length ? f1s[0].hz : 0;
        let f2 = 0;
        for (const p of f2s) {
            if (p.hz > f1 * 1.15) { f2 = p.hz; break; }
        }
        return { f1: f1, f2: f2 };
    }

    /** Brightness, in Hz. /s/ sits far above /ʃ/, which is the whole of that contrast. */
    function auCentroid(mag, sampleRate, loHz, hiHz) {
        const binHz = sampleRate / (mag.length * 2);
        const lo = Math.max(1, Math.floor((loHz === undefined ? 1000 : loHz) / binHz));
        const hi = Math.min(mag.length - 1, Math.ceil((hiHz === undefined ? 11000 : hiHz) / binHz));
        let num = 0, den = 0;
        for (let i = lo; i <= hi; i++) { num += i * binHz * mag[i]; den += mag[i]; }
        return den > 0 ? num / den : 0;
    }

    /** Everything about one frame, in one pass. */
    function auAnalyse(frame, sampleRate) {
        const rms = auRms(frame);
        const f0 = auF0(frame, sampleRate);
        const mag = auSpectrum(frame);
        const env = auEnvelope(mag, sampleRate, f0);
        const f = auFormants(env, sampleRate);
        return {
            rms: rms,
            f0: f0,
            voiced: f0 > 0,
            f1: f.f1,
            f2: f.f2,
            centroid: auCentroid(mag, sampleRate),
            env: env,
            mag: mag,
        };
    }

    // =====================================================================
    // Vowel space
    // =====================================================================
    /*
     * Where the vowels sit, as fractions of the speaker's own range rather than
     * in hertz. The anchors are /iː/ (high front, low F1 high F2), /ɑː/ (low
     * back, high F1 low F2) and /uː/ (high back, low both) — the three corners
     * of the vowel triangle, which is the smallest set that pins the space down.
     *
     * Positions here are from the adult-male averages every phonetics text
     * quotes, converted to corner-relative coordinates. Converting is the point:
     * a child's absolute formants are half again as high, but the *shape* of
     * their vowel space is the same, so the normalised targets hold.
     */
    const CORNERS = { i: { f1: 270, f2: 2290 }, a: { f1: 730, f2: 1090 }, u: { f1: 300, f2: 870 } };

    const VOWELS = [
        { id: 'long-e',  say: 'ee', as: 'feet',  f1: 270, f2: 2290 },
        { id: 'short-i', say: 'i',  as: 'sit',   f1: 390, f2: 1990 },
        { id: 'long-a',  say: 'ay', as: 'day',   f1: 400, f2: 2100 },
        { id: 'short-e', say: 'e',  as: 'bed',   f1: 530, f2: 1840 },
        { id: 'short-a', say: 'a',  as: 'cat',   f1: 660, f2: 1720 },
        { id: 'short-o', say: 'o',  as: 'hop',   f1: 730, f2: 1090 },
        { id: 'short-u', say: 'u',  as: 'cup',   f1: 640, f2: 1190 },
        { id: 'long-oo', say: 'oo', as: 'moon',  f1: 300, f2: 870 },
    ];

    /*
     * Map hertz onto the speaker's own space.
     *
     * Logarithmic, because pitch and formant perception both are — the step from
     * 300 to 400 Hz is the same perceptual distance as 900 to 1200, and a linear
     * map would make every back vowel crowd into one corner.
     */
    function auNormalise(f1, f2, anchors) {
        const A = anchors || CORNERS;
        const lg = Math.log;
        const f1lo = lg(Math.min(A.i.f1, A.u.f1)), f1hi = lg(A.a.f1);
        const f2lo = lg(A.u.f2), f2hi = lg(A.i.f2);
        const clamp = (v) => Math.max(-0.35, Math.min(1.35, v));
        return {
            x: clamp((lg(Math.max(f2, 1)) - f2lo) / (f2hi - f2lo || 1)),   // back <-> front
            y: clamp((lg(Math.max(f1, 1)) - f1lo) / (f1hi - f1lo || 1)),   // close <-> open
        };
    }

    /** Where a target vowel sits for this speaker. */
    function auTarget(vowelId, anchors) {
        const v = VOWELS.find((x) => x.id === vowelId);
        if (!v) return null;
        const p = auNormalise(v.f1, v.f2, CORNERS);      // canonical coordinates
        return { id: v.id, say: v.say, as: v.as, x: p.x, y: p.y, anchors: anchors || null };
    }

    /*
     * Nearest vowel, with a confidence.
     *
     * Confidence is the margin over the runner-up rather than the raw distance,
     * because "somewhere between /e/ and /a/" is a genuinely different situation
     * from "clearly /a/ but a bit off centre", and only the first should be
     * reported as uncertain. Everything downstream weights by this, and nothing
     * on this path may promote a node on its own.
     */
    function auClassifyVowel(f1, f2, anchors, among) {
        if (!(f1 > 0 && f2 > 0)) return { vowel: null, confidence: 0 };
        const here = auNormalise(f1, f2, anchors);
        const pool = (among && among.length ? VOWELS.filter((v) => among.indexOf(v.id) >= 0) : VOWELS);
        if (!pool.length) return { vowel: null, confidence: 0 };

        const scored = pool.map((v) => {
            const t = auNormalise(v.f1, v.f2, CORNERS);
            return { id: v.id, d: Math.hypot(t.x - here.x, t.y - here.y) };
        }).sort((a, b) => a.d - b.d);

        const best = scored[0];
        const next = scored[1];
        const margin = next ? (next.d - best.d) / (next.d + best.d + 1e-6) : 1;
        return {
            vowel: best.id,
            distance: best.d,
            confidence: Math.max(0, Math.min(1, margin * 2)),
            at: here,
        };
    }

    /** /s/ or /ʃ/ or neither, from brightness and whether it is voiced. */
    function auClassifySibilant(analysis) {
        const c = analysis.centroid;
        if (analysis.rms < 0.004 || c <= 0) return { sound: null, confidence: 0 };
        if (analysis.voiced) return { sound: 'voiced', confidence: 0.5 };
        if (c > 4600) return { sound: 's', confidence: Math.min(1, (c - 4600) / 1500) };
        if (c > 2200) return { sound: 'sh', confidence: Math.min(1, (4600 - c) / 1500) };
        return { sound: null, confidence: 0 };
    }

    return {
        auSpectrum: auSpectrum,
        auEnvelope: auEnvelope,
        auFormants: auFormants,
        auCentroid: auCentroid,
        auF0: auF0,
        auRms: auRms,
        auAnalyse: auAnalyse,
        auNormalise: auNormalise,
        auTarget: auTarget,
        auClassifyVowel: auClassifyVowel,
        auClassifySibilant: auClassifySibilant,
        auVowels: VOWELS,
        auCorners: CORNERS,
    };
}));
