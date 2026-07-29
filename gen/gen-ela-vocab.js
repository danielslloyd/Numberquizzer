/*
 * Item generators for vocabulary.
 *
 * Generative rather than a word list, and that is a deliberate refusal. School
 * texts hold 88,500+ word families; children acquire around 3,000 a year, almost
 * all of it incidentally from reading volume, while direct instruction reaches a
 * few hundred. Building a word-list app would be building the wrong thing at
 * roughly ten to one.
 *
 * So these items test the machinery — inferring from context, inferring from
 * word parts, and the general academic words that recur everywhere — and the
 * product should say plainly that wide reading is the part it cannot replace.
 */
(function () {
    'use strict';

    const G = {};
    const L = (typeof LANG !== 'undefined') ? LANG : (typeof require === 'function' ? require('../content/words-language.js') : {});

    G['vocab.contextClues'] = function (rng) {
        const a = rng.pick(L.academic);
        const others = L.academic.filter((x) => x.w !== a.w);
        return genMc(rng, {
            stem: a.s.replace('___', '_____') + '  What does the missing word most likely mean?',
            correct: a.means,
            distractors: rng.sample(others.map((x) => x.means), 3),
            hint: 'The rest of the sentence tells you what would fit.',
            explain: 'The word is "' + a.w + '", which means ' + a.means + '.',
            sig: 'ctx:' + a.w,
        });
    };

    G['vocab.synonymAntonym'] = function (rng) {
        const e = rng.pick(L.synonyms);
        const others = L.synonyms.filter((x) => x.w !== e.w);
        const wantSame = rng.bool();
        return genMc(rng, {
            stem: 'Which word means ' + (wantSame ? 'nearly the same as' : 'the opposite of')
                + ' "' + e.w + '"?',
            correct: wantSame ? e.same : e.opp,
            // The other side of the same pair is the tempting wrong answer.
            distractors: [wantSame ? e.opp : e.same]
                .concat(rng.sample(others.map((x) => (wantSame ? x.same : x.opp)), 2)),
            explain: '"' + e.w + '" is close to "' + e.same + '" and opposite to "' + e.opp + '".',
            sig: 'syn:' + e.w + ':' + (wantSame ? 's' : 'a'),
        });
    };

    G['vocab.multipleMeaning'] = function (rng) {
        const m = rng.pick(L.multiMeaning);
        const useA = rng.bool();
        const others = L.multiMeaning.filter((x) => x.w !== m.w);
        return genMc(rng, {
            stem: 'In this sentence — "' + (useA ? m.sa : m.sb) + '" — what does "' + m.w + '" mean?',
            correct: useA ? m.a : m.b,
            // The word's *other* meaning is the distractor, because keeping the
            // first meaning you know regardless of context is the misconception.
            distractors: [useA ? m.b : m.a].concat(rng.sample(others.map((x) => x.a), 2)),
            hint: 'The same word can mean different things. Let the sentence decide.',
            explain: 'Here "' + m.w + '" means ' + (useA ? m.a : m.b) + '.',
            sig: 'mm:' + m.w + ':' + (useA ? 'a' : 'b'),
        });
    };

    G['vocab.homophone'] = function (rng) {
        const h = rng.pick(L.homophones);
        return genMc(rng, {
            stem: 'Which word belongs in the gap?  ' + h.sentence,
            correct: h.a,
            distractors: [h.b],
            hint: 'They sound the same, so the sound will not help. Think about the meaning.',
            explain: '"' + h.a + '" means ' + h.clue + '.',
            sig: 'homo:' + h.a + ':' + h.sentence.length,
        });
    };

    G['vocab.tier2Academic'] = function (rng) {
        const a = rng.pick(L.academic);
        const others = L.academic.filter((x) => x.w !== a.w);
        return genMc(rng, {
            stem: 'Which word fits the gap?  ' + a.s.replace('___', '_____'),
            correct: a.w,
            distractors: rng.sample(others.map((x) => x.w), 3),
            explain: '"' + a.w + '" means ' + a.means + '. It is a word that turns up in every '
                + 'subject, which is what makes it worth knowing well.',
            sig: 't2:' + a.w,
        });
    };

    G['vocab.figurative.literal'] = function (rng) {
        const f = rng.pick(L.figurative);
        if (f.lit) {
            return genMc(rng, {
                stem: 'Is this sentence saying exactly what it means, or is it a figure of speech?  "' + f.s + '"',
                correct: 'It means exactly what it says',
                distractors: ['It is a figure of speech'],
                explain: 'Nothing surprising here — the words mean what they usually mean.',
                sig: 'figLit:' + f.s.length + ':' + f.s.slice(0, 8),
            });
        }
        const others = L.figurative.filter((x) => !x.lit && x.s !== f.s);
        return genMc(rng, {
            stem: 'What does this really mean?  "' + f.s + '"',
            correct: f.means,
            distractors: rng.sample(others.map((x) => x.means), 3),
            hint: 'It is not meant word for word.',
            explain: 'It is a figure of speech: it means ' + f.means + '.',
            sig: 'figFig:' + f.s.slice(0, 10),
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-vocab', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
