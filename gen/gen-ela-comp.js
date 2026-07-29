/*
 * Item generators for comprehension.
 *
 * Only three tier-1 nodes, because only the auto-gradable slice of reading
 * comprehension belongs in a drill app. Most comprehension standards ask a
 * learner to explain, and an explanation is not machine-scorable — so those get
 * no node at all rather than a fake one.
 *
 * Passages are original text written for this app, so there is nothing to
 * license. That matters more than it sounds: a static site ships its content as
 * readable JavaScript, and commercial levelled passages are essentially never
 * redistributable.
 *
 * comp.anaphora is the underrated one. Working out who "he" refers to is a real
 * comprehension bottleneck, it is cleanly multiple-choice, and almost nothing
 * tests it directly.
 */
(function () {
    'use strict';

    const G = {};
    const L = (typeof LANG !== 'undefined') ? LANG : (typeof require === 'function' ? require('../content/words-language.js') : {});

    function withPassage(p, question) {
        return [
            { t: 'text', s: p.text },
            { t: 'text', s: question },
        ];
    }

    G['comp.anaphora'] = function (rng) {
        const p = rng.pick(L.passages);
        const q = 'In this passage, who or what does "' + p.pronoun.word + '" refer to?';
        return genMc(rng, {
            stem: p.text + ' — ' + q,
            prompt: withPassage(p, q),
            correct: p.pronoun.refersTo,
            distractors: p.pronoun.options,
            hint: 'Read back to the last thing it could sensibly be.',
            explain: '"' + p.pronoun.word + '" stands for ' + p.pronoun.refersTo
                + '. It is usually not simply the nearest noun — it is the one that makes sense.',
            sig: 'ana:' + p.id,
        });
    };

    G['comp.inference.local'] = function (rng) {
        const p = rng.pick(L.passages);
        return genMc(rng, {
            stem: p.text + ' — ' + p.inference.q,
            prompt: withPassage(p, p.inference.q),
            correct: p.inference.a,
            distractors: p.inference.wrong,
            hint: 'The passage does not say it outright. What must have happened?',
            explain: p.inference.a + '. The passage never says so directly, which is what makes it '
                + 'an inference rather than a lookup.',
            sig: 'inf:' + p.id,
        });
    };

    G['comp.mainIdea'] = function (rng) {
        const p = rng.pick(L.passages);
        const q = 'What is this passage mostly about?';
        return genMc(rng, {
            stem: p.text + ' — ' + q,
            prompt: withPassage(p, q),
            correct: p.mainIdea.a,
            // The wrong options are true details from the passage, since picking
            // a true detail over the overall point is the named misconception.
            distractors: p.mainIdea.wrong,
            hint: 'Not one true detail — the point of the whole thing.',
            explain: p.mainIdea.a + '. The other options may be true, or sound sensible, but they '
                + 'are not what the passage is mostly about.',
            sig: 'main:' + p.id,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-comp', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
