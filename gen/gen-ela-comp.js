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


    // ---- tier 2 --------------------------------------------------------------
    G['comp.textStructure'] = function (rng) {
        const CASES = [
            { s: 'First, gather your materials. Next, cut the card. Finally, glue the pieces together.',
              a: 'sequence — steps in order', w: ['cause and effect', 'compare and contrast', 'problem and solution'] },
            { s: 'Cats sleep for most of the day, while dogs are awake and active far more of the time.',
              a: 'compare and contrast', w: ['sequence', 'cause and effect', 'problem and solution'] },
            { s: 'Because the river burst its banks, the fields flooded and the crops were ruined.',
              a: 'cause and effect', w: ['sequence', 'compare and contrast', 'problem and solution'] },
            { s: 'The bees were disappearing. To help them, the school planted a meadow of wild flowers.',
              a: 'problem and solution', w: ['sequence', 'compare and contrast', 'cause and effect'] },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'How is this passage organised?  "' + c.s + '"',
            prompt: [{ t: 'text', s: c.s }, { t: 'text', s: 'How is this organised?' }],
            correct: c.a,
            distractors: c.w,
            hint: 'Look at the joining words.',
            sig: 'struct:' + c.a,
        });
    };

    G['comp.evidence'] = function (rng) {
        const p = rng.pick(L.passages);
        const sentences = p.text.split(/(?<=\.)\s+/).filter((x) => x.trim());
        const claim = p.mainIdea.a;
        // The supporting sentence is the one the inference answer draws on; the
        // rest of the passage supplies the foils, so all options are true.
        const best = sentences[sentences.length - 1];
        return genMc(rng, {
            stem: 'Which sentence best supports the idea that: ' + claim + '?',
            prompt: [{ t: 'text', s: p.text }, { t: 'text', s: 'Which sentence best supports: ' + claim + '?' }],
            correct: best,
            distractors: sentences.slice(0, -1),
            hint: 'All of them are in the passage. Which one actually backs up that idea?',
            explain: 'Being true is not the same as being evidence for this particular claim.',
            sig: 'evid:' + p.id,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-comp', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
