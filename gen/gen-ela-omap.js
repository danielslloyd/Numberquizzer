/*
 * Item generators for word recognition by sight.
 *
 * Orthographic mapping, not visual memorisation. Sight-word reading is built by
 * bonding spellings to pronunciations, so irregular words get heart-word
 * treatment: find the ONE part that misbehaves, and decode the rest normally.
 * There are no whole-word flashcards here on purpose — treating a word as a
 * picture is the misconception this strand exists to prevent.
 */
(function () {
    'use strict';

    const G = {};
    const W = (typeof WORDS !== 'undefined') ? WORDS : (typeof require === 'function' ? require('../content/words-phonics.js') : {});

    // Real words the bank knows about, so a generated misspelling is never
    // accidentally a different real word.
    const REAL = new Set(
        [].concat(W.hfEarly, W.hfExtended, W.heart.map((h) => h.w), W.blendInitial, W.blendFinal,
            W.twoSyllable, W.multisyllable, W.vce)
            .concat(Object.keys(W.cvc).reduce((a, k) => a.concat(W.cvc[k]), []))
    );

    // Transpose an interior pair. Deterministic, and rejected if it lands on a
    // real word.
    function misspell(rng, word) {
        for (let attempt = 0; attempt < 8; attempt++) {
            const i = rng.int(0, Math.max(0, word.length - 2));
            const a = word.split('');
            const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t;
            const out = a.join('');
            if (out !== word && !REAL.has(out)) return out;
        }
        return word + word[word.length - 1];
    }

    function spotTheWord(rng, list, sig) {
        const word = rng.pick(list);
        const foils = [];
        let guard = 0;
        while (foils.length < 3 && guard < 30) {
            guard++;
            const m = misspell(rng, word);
            if (m !== word && foils.indexOf(m) === -1) foils.push(m);
        }
        return genMc(rng, {
            stem: 'Which one is spelled correctly?',
            correct: word,
            distractors: foils,
            explain: '"' + word + '" is the right spelling.',
            sig: sig + ':' + word,
        });
    }

    G['omap.hfWords.early'] = function (rng) { return spotTheWord(rng, W.hfEarly, 'hfE'); };
    G['omap.hfWords.extended'] = function (rng) { return spotTheWord(rng, W.hfExtended, 'hfX'); };

    G['omap.heartWords'] = function (rng) {
        const h = rng.pick(W.heart);
        // The other parts of the SAME word. Offering pieces of other words would
        // let a learner answer without looking at this one.
        return genMc(rng, {
            stem: 'In the word "' + h.w + '", which part does not follow the usual rules?',
            correct: h.odd,
            distractors: h.parts.filter((x) => x !== h.odd),
            hint: 'Most of the word can be sounded out. Only one bit has to be learned by heart.',
            explain: 'In "' + h.w + '", ' + h.why + '. The rest of the word behaves normally, which '
                + 'is why it is worth finding the odd part rather than memorising the whole shape.',
            sig: 'heart:' + h.w,
        });
    };

    // Timed: the node's whole claim is instant recognition, so it is graded on
    // latency as well as accuracy.
    G['omap.autoRecognition'] = function (rng) {
        const word = rng.pick(W.hfEarly.concat(W.hfExtended));
        const foils = [];
        let guard = 0;
        while (foils.length < 3 && guard < 30) {
            guard++;
            const m = misspell(rng, word);
            if (m !== word && foils.indexOf(m) === -1) foils.push(m);
        }
        return genMc(rng, {
            stem: 'Quickly — which one is a real word?',
            correct: word,
            distractors: foils,
            sig: 'auto:' + word,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-omap', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
