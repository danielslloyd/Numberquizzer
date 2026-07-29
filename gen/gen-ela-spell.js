/*
 * Item generators for spelling.
 *
 * Every item is solvable from a written clue as well as from the spoken word.
 * Speech synthesis is an enhancement and not a guarantee — on a browser without
 * it, a "spell the word you hear" item would be unanswerable, and an item a
 * learner cannot attempt is worse than no item.
 *
 * The word itself therefore lives in `stem` (which is what gets spoken) while
 * `prompt` shows only the clue, so hearing it and reading the clue are two ways
 * into the same question rather than one giving the other away.
 */
(function () {
    'use strict';

    const G = {};
    const W = (typeof WORDS !== 'undefined') ? WORDS : (typeof require === 'function' ? require('../content/words-phonics.js') : {});

    function spellFrom(rng, list, sig, hint) {
        const e = rng.pick(list);
        return genText({
            stem: 'Spell the word: ' + e.w,
            prompt: [
                { t: 'text', s: 'Spell the word you hear.' },
                { t: 'text', s: 'Clue: ' + e.clue + '.' },
            ],
            answer: e.w,
            hint: hint,
            explain: 'It is spelled "' + e.w + '".',
            sig: sig + ':' + e.w,
        });
    }

    G['spell.phonetic'] = function (rng) {
        return spellFrom(rng, W.spell.cvc, 'sp0', 'Say it slowly and write a letter for each sound.');
    };
    G['spell.cvcPatterns'] = function (rng) {
        return spellFrom(rng, W.spell.cvc, 'spCvc', 'Three sounds, three letters.');
    };
    G['spell.vceVowelTeams'] = function (rng) {
        return spellFrom(rng, W.spell.vceVowelTeams, 'spVce',
            'The vowel says its name — is that a silent e or a vowel team?');
    };
    G['spell.rControlled'] = function (rng) {
        return spellFrom(rng, W.spell.rControlled, 'spR', 'There is an r bossing the vowel about.');
    };
    G['spell.irregularHF'] = function (rng) {
        return spellFrom(rng, W.spell.irregularHF, 'spHF', 'This one does not follow the usual rules.');
    };

    /*
     * The four suffix rules — add, double, drop-e, y-to-i — as a choice between
     * the correct spelling and the one you get by ignoring the rule. Producing
     * the form is phon.inflections; knowing which rule applies is this.
     */
    G['spell.suffixRules'] = function (rng) {
        const e = rng.pick(W.inflect.filter((x) => x.rule !== 'add' && x.ed));
        const which = rng.pick(['ed', 'ing']);
        const correct = e[which];
        if (!correct) return G['spell.suffixRules'](rng);

        const naive = e.base + (which === 'ed' ? 'ed' : 'ing');       // rule ignored
        const RULE = {
            double: 'the last letter doubles',
            dropE: 'the silent e is dropped',
            yToI: 'the y changes to i',
        };

        return genMc(rng, {
            stem: 'Which is the right way to write "' + e.base + '" with "-' + which + '"?',
            correct: correct,
            distractors: [naive, e.base + '-' + which, e.base.slice(0, -1) + which],
            hint: 'Something has to change to the base word first.',
            explain: '"' + correct + '" — when you add "-' + which + '" to "' + e.base + '", '
                + RULE[e.rule] + '.',
            sig: 'sfx:' + e.base + ':' + which,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-spell', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
