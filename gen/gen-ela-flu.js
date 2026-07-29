/*
 * Item generators for reading fluency.
 *
 * Deliberately thin, and deliberately not called oral reading fluency. Real ORF
 * is words-correct-per-minute against a passage and needs audio capture and
 * scoring; we do not do that, so we do not claim it. Reporting a WCPM figure
 * without measuring speech would be a straightforward lie about what was tested.
 *
 * What is honestly auto-gradable is timed word recognition, which is what this
 * is: the node carries a latency target and the accuracy bar alone will not
 * promote it.
 */
(function () {
    'use strict';

    const G = {};
    const W = (typeof WORDS !== 'undefined') ? WORDS : (typeof require === 'function' ? require('../content/words-phonics.js') : {});

    const POOL = [].concat(
        Object.keys(W.cvc).reduce((a, k) => a.concat(W.cvc[k]), []),
        W.vce, W.blendInitial, W.blendFinal, W.twoSyllable
    );

    G['flu.wordList'] = function (rng) {
        const word = rng.pick(POOL);
        // Near neighbours differing by one letter, so it cannot be answered from
        // word shape alone.
        const neighbours = POOL.filter((w) => w !== word && w.length === word.length
            && w.split('').filter((c, i) => c !== word[i]).length === 1);
        const distractors = neighbours.length >= 3
            ? rng.sample(neighbours, 3)
            : rng.sample(POOL.filter((w) => w !== word), 3);

        return genMc(rng, {
            stem: 'Read quickly: which word is "' + word + '"?',
            correct: word,
            distractors: distractors,
            explain: 'These look alike, so they have to be read rather than guessed from their shape.',
            sig: 'flu:' + word,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-flu', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
