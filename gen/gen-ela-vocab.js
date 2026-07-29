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


    // ---- tier 2 --------------------------------------------------------------
    G['vocab.shadesOfMeaning'] = function (rng) {
        const SCALES = [
            { weak: 'warm', mid: 'hot', strong: 'boiling' },
            { weak: 'cool', mid: 'cold', strong: 'freezing' },
            { weak: 'liked', mid: 'loved', strong: 'adored' },
            { weak: 'annoyed', mid: 'angry', strong: 'furious' },
            { weak: 'tired', mid: 'exhausted', strong: 'shattered' },
            { weak: 'good', mid: 'great', strong: 'outstanding' },
            { weak: 'damp', mid: 'wet', strong: 'soaked' },
            { weak: 'small', mid: 'tiny', strong: 'microscopic' },
            { weak: 'quiet', mid: 'silent', strong: 'soundless' },
            { weak: 'surprised', mid: 'astonished', strong: 'dumbfounded' },
            { weak: 'hungry', mid: 'starving', strong: 'ravenous' },
            { weak: 'pretty', mid: 'beautiful', strong: 'stunning' },
            { weak: 'old', mid: 'elderly', strong: 'ancient' },
        ];
        const s = rng.pick(SCALES);
        return genMc(rng, {
            stem: 'Which word is the strongest?  ' + [s.weak, s.mid, s.strong].join(', '),
            correct: s.strong,
            distractors: [s.weak, s.mid],
            explain: 'They all mean something similar, but "' + s.strong + '" is the strongest.',
            sig: 'shades:' + s.strong,
        });
    };

    G['vocab.categories'] = function (rng) {
        const CATS = [
            { name: 'furniture', in: ['chair', 'table', 'sofa', 'wardrobe'], out: ['apple', 'river', 'trumpet'] },
            { name: 'instruments', in: ['violin', 'drum', 'flute', 'piano'], out: ['carrot', 'ladder', 'cloud'] },
            { name: 'vegetables', in: ['carrot', 'pea', 'cabbage', 'leek'], out: ['hammer', 'kitten', 'ocean'] },
            { name: 'weather', in: ['rain', 'snow', 'fog', 'thunder'], out: ['pencil', 'giraffe', 'sofa'] },
        ];
        const c = rng.pick(CATS);
        return genMulti(rng, {
            stem: 'Choose every word that belongs with ' + c.name + '.',
            right: rng.sample(c.in, 3),
            wrong: c.out,
            sig: 'cat:' + c.name,
        });
    };

    G['vocab.homograph'] = function (rng) {
        const CASES = [
            { w: 'read', a: 'I like to read before bed.', b: 'I read that book last year.',
              why: 'said "reed" in one and "red" in the other' },
            { w: 'live', a: 'They live near the park.', b: 'It was a live broadcast.',
              why: 'the vowel changes' },
            { w: 'tear', a: 'A tear rolled down her cheek.', b: 'Try not to tear the paper.',
              why: 'said "teer" in one and "tair" in the other' },
            { w: 'wind', a: 'The wind blew hard.', b: 'Wind the string round the stick.',
              why: 'the vowel changes' },
            { w: 'bow', a: 'She tied a bow in her hair.', b: 'The actors bow at the end.',
              why: 'said "boh" in one and "bau" in the other' },
            { w: 'close', a: 'Please close the gate.', b: 'The shop is close to the park.',
              why: 'the s sounds different in each' },
            { w: 'lead', a: 'She will lead the way.', b: 'The pipes were made of lead.',
              why: 'said "leed" in one and "led" in the other' },
            { w: 'minute', a: 'Wait one minute.', b: 'A minute speck of dust.',
              why: 'the stress and the vowels change' },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'These two sentences use "' + c.w + '". What is true about them?',
            prompt: [{ t: 'text', s: c.a }, { t: 'text', s: c.b }],
            correct: 'Same spelling, said differently',
            distractors: ['Same spelling, said the same', 'Different spelling, said the same',
                'They mean exactly the same thing'],
            explain: '"' + c.w + '" is a homograph: ' + c.why + '.',
            sig: 'homog:' + c.w,
        });
    };

    G['vocab.simileMetaphor'] = function (rng) {
        const CASES = [
            { s: 'She ran like the wind.', kind: 'simile' },
            { s: 'He was as quiet as a mouse.', kind: 'simile' },
            { s: 'The classroom was a zoo.', kind: 'metaphor' },
            { s: 'Her voice is music to my ears.', kind: 'metaphor' },
            { s: 'The snow was like a blanket.', kind: 'simile' },
            { s: 'Time is a thief.', kind: 'metaphor' },
            { s: 'The road was a ribbon of moonlight.', kind: 'metaphor' },
            { s: 'His hands were as cold as ice.', kind: 'simile' },
            { s: 'The city is a furnace in August.', kind: 'metaphor' },
            { s: 'She sang like a bird.', kind: 'simile' },
            { s: 'That exam was a nightmare.', kind: 'metaphor' },
            { s: 'The lake was as flat as glass.', kind: 'simile' },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'Is this a simile or a metaphor?  "' + c.s + '"',
            correct: c.kind,
            distractors: [c.kind === 'simile' ? 'metaphor' : 'simile'],
            hint: 'A simile uses "like" or "as". A metaphor says one thing IS another.',
            explain: 'It is a ' + c.kind + (c.kind === 'simile'
                ? ', because it compares using "like" or "as".'
                : ', because it says one thing simply is the other.'),
            sig: 'simile:' + c.s.slice(0, 12),
        });
    };

    G['vocab.idiom'] = function (rng) {
        const IDIOMS = [
            { s: 'break the ice', m: 'make people feel more comfortable' },
            { s: 'under the weather', m: 'feeling unwell' },
            { s: 'a piece of cake', m: 'very easy' },
            { s: 'bite your tongue', m: 'stop yourself from saying something' },
            { s: 'the last straw', m: 'the final thing that makes it too much' },
            { s: 'once in a blue moon', m: 'very rarely' },
            { s: 'hit the nail on the head', m: 'say exactly the right thing' },
            { s: 'let sleeping dogs lie', m: 'leave a problem alone rather than stir it up' },
            { s: 'a blessing in disguise', m: 'something that seems bad but turns out well' },
            { s: 'burn the midnight oil', m: 'stay up late working' },
            { s: 'jump on the bandwagon', m: 'join something because it has become popular' },
        ];
        const c = rng.pick(IDIOMS);
        return genMc(rng, {
            stem: 'What does "' + c.s + '" mean?',
            correct: c.m,
            distractors: rng.sample(IDIOMS.filter((x) => x.s !== c.s).map((x) => x.m), 3),
            explain: '"' + c.s + '" means ' + c.m + '. It is not meant word for word.',
            sig: 'idiom:' + c.s,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-vocab', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
