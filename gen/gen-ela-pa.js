/*
 * Item generators for phonological awareness.
 *
 * Small on purpose. The National Reading Panel meta-analysis found phonemic
 * awareness instruction worked BETTER when fewer skills were taught, when
 * letters were involved, and when it stayed under about twenty hours — so this
 * strand is four tier-1 nodes concentrated on blending and segmenting, not a
 * forty-rung ladder.
 *
 * Phoneme counts below are counted by SOUND, which is the entire point:
 * "ship" is three sounds and four letters, and a learner who answers four has
 * the misconception this node exists to find.
 */
(function () {
    'use strict';

    const G = {};

    /*
     * `first` and `last` are the SOUNDS at each end, which are not always the
     * letters at each end: "ship" begins with /sh/, not /s/, and "bath" ends with
     * /th/, not /h/. Taking the first and last characters — as this once did —
     * asks a phonics question and then marks the phonics answer wrong.
     */
    /*
     * `sounds` is the phoneme sequence, which is NOT the letters: "much" is
     * /m/ /u/ /ch/, three sounds in four letters. Splitting the spelling on
     * characters — as this once did — presents "m u c h" to be blended, which
     * teaches the opposite of what the node is for. `first` and `last` are the
     * sounds at each end, for the same reason.
     */
    const PHONEMES = [
        { w: 'cat', sounds: ['c', 'a', 't'] },
        { w: 'ship', sounds: ['sh', 'i', 'p'] },
        { w: 'chin', sounds: ['ch', 'i', 'n'] },
        { w: 'duck', sounds: ['d', 'u', 'ck'] },
        { w: 'stop', sounds: ['s', 't', 'o', 'p'] },
        { w: 'lamp', sounds: ['l', 'a', 'm', 'p'] },
        { w: 'desk', sounds: ['d', 'e', 's', 'k'] },
        { w: 'that', sounds: ['th', 'a', 't'] },
        { w: 'bath', sounds: ['b', 'a', 'th'] },
        { w: 'grin', sounds: ['g', 'r', 'i', 'n'] },
        { w: 'sun', sounds: ['s', 'u', 'n'] },
        { w: 'thick', sounds: ['th', 'i', 'ck'] },
        { w: 'flag', sounds: ['f', 'l', 'a', 'g'] },
        { w: 'rock', sounds: ['r', 'o', 'ck'] },
        { w: 'sing', sounds: ['s', 'i', 'ng'] },
        { w: 'best', sounds: ['b', 'e', 's', 't'] },
        { w: 'fish', sounds: ['f', 'i', 'sh'] },
        { w: 'much', sounds: ['m', 'u', 'ch'] },
        { w: 'nest', sounds: ['n', 'e', 's', 't'] },
        { w: 'wing', sounds: ['w', 'i', 'ng'] },
    ].map((e) => Object.assign(e, {
        n: e.sounds.length,
        first: e.sounds[0],
        last: e.sounds[e.sounds.length - 1],
    }));

    const SYLLABLES = [
        { w: 'cat', n: 1 }, { w: 'rabbit', n: 2 }, { w: 'napkin', n: 2 }, { w: 'basket', n: 2 },
        { w: 'elephant', n: 3 }, { w: 'banana', n: 3 }, { w: 'butterfly', n: 3 },
        { w: 'fantastic', n: 3 }, { w: 'caterpillar', n: 4 }, { w: 'television', n: 4 },
        { w: 'dog', n: 1 }, { w: 'window', n: 2 }, { w: 'computer', n: 3 },
    ];

    G['pa.syllable'] = function (rng) {
        const e = rng.pick(SYLLABLES);
        return genNum({
            stem: 'How many syllables — beats — are there in the word "' + e.w + '"?',
            answer: e.n,
            hint: 'Clap once for each beat.',
            explain: '"' + e.w + '" has ' + e.n + ' beat' + (e.n > 1 ? 's' : '') + '.',
            sig: 'syl:' + e.w,
        });
    };

    G['pa.isolate'] = function (rng) {
        const e = rng.pick(PHONEMES);
        const where = rng.pick(['first', 'last']);
        const sound = e[where];
        // Distractors are sounds from the other words, minus anything that is
        // also in this one.
        const pool = PHONEMES.reduce((a, x) => a.concat([x.first, x.last]), [])
            .filter((c, i, arr) => arr.indexOf(c) === i)
            .filter((c) => c !== sound && e.w.indexOf(c) === -1);
        return genMc(rng, {
            stem: 'What is the ' + where + ' sound in the word "' + e.w + '"?',
            correct: sound,
            distractors: rng.sample(pool, 3),
            explain: 'Say "' + e.w + '" slowly. The ' + where + ' sound is "' + sound + '"'
                + (sound.length > 1 ? ' — two letters working together as one sound.' : '.'),
            sig: 'iso:' + e.w + ':' + where,
        });
    };

    G['pa.blend'] = function (rng) {
        const e = rng.pick(PHONEMES.filter((x) => x.n <= 4));
        return genText({
            stem: 'Put these sounds together: ' + e.sounds.join(' … ') + '. What word do they make?',
            answer: e.w,
            hint: 'Say them faster and faster until they join up.',
            explain: 'They blend into "' + e.w + '".',
            sig: 'blend:' + e.w,
        });
    };

    G['pa.segment'] = function (rng) {
        const e = rng.pick(PHONEMES);
        return genNum({
            stem: 'How many separate sounds can you hear in the word "' + e.w + '"?',
            answer: e.n,
            hint: 'Count the sounds, not the letters — they are not always the same number.',
            explain: '"' + e.w + '" has ' + e.n + ' sounds'
                + (e.n !== e.w.length ? ' but ' + e.w.length + ' letters, because some letters work together as one sound' : '')
                + '.',
            sig: 'seg:' + e.w,
        });
    };


    // ---- tier 2 --------------------------------------------------------------
    const RHYMES = [
        ['cat', 'hat', 'mat', 'bat'], ['dog', 'log', 'fog', 'jog'], ['pin', 'win', 'tin', 'bin'],
        ['bed', 'red', 'fed', 'led'], ['cake', 'lake', 'make', 'bake'], ['tree', 'bee', 'see', 'free'],
    ];

    G['pa.rhyme'] = function (rng) {
        const group = rng.pick(RHYMES);
        const others = RHYMES.filter((g) => g !== group).reduce((a, g) => a.concat(g), []);
        const word = rng.pick(group);
        return genMc(rng, {
            stem: 'Which word rhymes with "' + word + '"?',
            correct: rng.pick(group.filter((w) => w !== word)),
            distractors: rng.sample(others, 3),
            explain: 'Rhyming words end with the same sound.',
            sig: 'rhyme:' + word,
        });
    };

    G['pa.onsetRime'] = function (rng) {
        const group = rng.pick(RHYMES);
        const word = rng.pick(group);
        const rime = word.slice(1);
        return genText({
            stem: 'Put the beginning sound "' + word[0] + '" together with the ending "' + rime
                + '". What word is that?',
            answer: word,
            explain: word[0] + ' + ' + rime + ' makes "' + word + '".',
            sig: 'onset:' + word,
        });
    };

    G['pa.manipulate'] = function (rng) {
        const CASES = [
            { from: 'cat', op: 'change the c to an h', to: 'hat' },
            { from: 'stop', op: 'take away the s', to: 'top' },
            { from: 'ship', op: 'change the sh to a t', to: 'tip' },
            { from: 'and', op: 'put an h at the front', to: 'hand' },
            { from: 'bring', op: 'take away the b', to: 'ring' },
            { from: 'lamp', op: 'change the l to a c', to: 'camp' },
            { from: 'sand', op: 'take away the s', to: 'and' },
            { from: 'cart', op: 'change the c to a p', to: 'part' },
            { from: 'nice', op: 'change the n to an m', to: 'mice' },
            { from: 'seat', op: 'change the s to an h', to: 'heat' },
            { from: 'flat', op: 'take away the l', to: 'fat' },
            { from: 'best', op: 'change the b to an n', to: 'nest' },
        ];
        const c = rng.pick(CASES);
        return genText({
            stem: 'Say "' + c.from + '". Now ' + c.op + '. What word do you get?',
            answer: c.to,
            explain: '"' + c.from + '" becomes "' + c.to + '".',
            sig: 'manip:' + c.from,
        });
    };

    // Exposed for tools/smoke-generators.js. Checking the answer is merely "at
    // that end of the word" is too weak: "s" really is at the start of "ship",
    // it just is not the first sound. The test needs the recorded sounds.
    G.__PHONEMES = PHONEMES;

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-pa', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
