/*
 * Item generators for grammar and mechanics.
 *
 * The most auto-gradable strand in the English half, and the one where the app
 * already has the most built — five existing language-arts modes attach here as
 * practice, so these items are the assessment counterpart rather than a
 * replacement.
 */
(function () {
    'use strict';

    const G = {};
    const L = (typeof LANG !== 'undefined') ? LANG : (typeof require === 'function' ? require('../content/words-language.js') : {});

    G['gram.sentence'] = function (rng) {
        const good = rng.pick(L.fragments.filter((f) => f.kind === 'sentence'));
        const bad = rng.sample(L.fragments.filter((f) => f.kind === 'fragment'), 3);
        return genMc(rng, {
            stem: 'Which one is a complete sentence?',
            correct: good.text,
            distractors: bad.map((f) => f.text),
            hint: 'A sentence needs someone or something, and something they do or are.',
            explain: '"' + good.text + '" has both a subject and a verb and makes sense on its own.',
            sig: 'sent:' + good.text.slice(0, 12),
        });
    };

    G['gram.partsOfSpeech'] = function (rng) {
        const s = rng.pick(L.sentences);
        const which = rng.pick(['noun', 'verb', 'adj', 'adv']);
        const NAME = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb' };
        const others = ['noun', 'verb', 'adj', 'adv'].filter((k) => k !== which);
        return genMc(rng, {
            stem: 'In this sentence — "' + s.s + '" — which word is the ' + NAME[which] + '?',
            correct: s[which],
            distractors: others.map((k) => s[k]),
            hint: 'Think about the job the word does in the sentence, not what it means on its own.',
            explain: '"' + s[which] + '" is the ' + NAME[which] + ' here.',
            sig: 'pos:' + s.noun + ':' + which,
        });
    };

    G['gram.endPunctuation'] = function (rng) {
        const CASES = [
            { s: 'Where are you going', mark: '?', why: 'it asks something' },
            { s: 'The dog is asleep', mark: '.', why: 'it tells you something' },
            { s: 'Look out', mark: '!', why: 'it is a shout or a warning' },
            { s: 'What time is it', mark: '?', why: 'it asks something' },
            { s: 'We had toast for breakfast', mark: '.', why: 'it tells you something' },
            { s: 'How wonderful that is', mark: '!', why: 'it shows strong feeling' },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'Which mark should end this sentence?  "' + c.s + '___"',
            correct: c.mark,
            distractors: ['.', '?', '!'].filter((m) => m !== c.mark),
            explain: 'It ends with "' + c.mark + '" because ' + c.why + '.',
            sig: 'end:' + c.s.slice(0, 10),
        });
    };

    G['gram.subjectVerb'] = function (rng) {
        const a = rng.pick(L.agreement);
        return genMc(rng, {
            stem: 'Which is correct?  "' + a.subj + ' ___ ."',
            correct: a.right,
            distractors: [a.wrong],
            hint: 'Is the subject one thing or more than one?',
            explain: '"' + a.subj + ' ' + a.right + '" — the verb has to match the subject.',
            sig: 'sva:' + a.subj + ':' + a.right,
        });
    };

    G['gram.tense'] = function (rng) {
        const t = rng.pick(L.tense);
        const want = rng.pick(['past', 'present', 'future']);
        const WHEN = { past: 'Yesterday', present: 'Every day', future: 'Tomorrow' };
        const others = ['past', 'present', 'future'].filter((k) => k !== want);
        return genMc(rng, {
            stem: WHEN[want] + ' she ___ . Which form of "' + t.base + '" fits?',
            correct: t[want],
            distractors: others.map((k) => t[k]),
            explain: '"' + WHEN[want] + '" tells you the time, so the verb has to match: "'
                + t[want] + '".',
            sig: 'tense:' + t.base + ':' + want,
        });
    };

    G['gram.pronouns'] = function (rng) {
        const CASES = [
            { s: 'Sam lost his hat, so ___ went back to look for it.', right: 'he', wrong: ['him', 'his', 'they'] },
            { s: 'The girls finished early, so ___ went outside.', right: 'they', wrong: ['them', 'their', 'she'] },
            { s: 'Give the book to Anna. It belongs to ___ .', right: 'her', wrong: ['she', 'hers', 'they'] },
            { s: 'The cat washed ___ paws.', right: 'its', wrong: ["it's", 'their', 'his'] },
            { s: 'Jack and I are ready. Wait for ___ .', right: 'us', wrong: ['we', 'them', 'our'] },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'Which word belongs in the gap?  ' + c.s,
            correct: c.right,
            distractors: c.wrong,
            explain: '"' + c.right + '" is the form that fits here.',
            sig: 'pron:' + c.right + ':' + c.s.length,
        });
    };

    G['gram.apostrophe'] = function (rng) {
        const a = rng.pick(L.apostrophe);
        return genMc(rng, {
            stem: 'Which belongs in the gap?  ' + a.s,
            correct: a.right,
            distractors: [a.wrong],
            hint: 'Is it a shortened form, or does it show belonging?',
            explain: '"' + a.right + '" — ' + a.clue + '.',
            sig: 'apos:' + a.right + ':' + a.s.length,
        });
    };

    G['gram.conjunctions'] = function (rng) {
        const c = rng.pick(L.conjunctions);
        return genMc(rng, {
            stem: 'Which joining word fits?  ' + c.s,
            correct: c.right,
            distractors: c.wrong,
            explain: '"' + c.right + '" is the one that makes the two parts fit together.',
            sig: 'conj:' + c.right + ':' + c.s.length,
        });
    };

    G['gram.comma'] = function (rng) {
        const c = rng.pick(L.commas);
        return genMc(rng, {
            stem: 'Which sentence uses commas correctly?',
            correct: c.right,
            distractors: [c.wrong],
            explain: 'A comma is needed ' + c.why + '.',
            sig: 'comma:' + c.why,
        });
    };

    G['gram.fragmentRunOn'] = function (rng) {
        const kind = rng.pick(['fragment', 'runon']);
        const bad = rng.pick(L.fragments.filter((f) => f.kind === kind));
        const good = rng.sample(L.fragments.filter((f) => f.kind === 'sentence'), 3);
        return genMc(rng, {
            stem: kind === 'fragment'
                ? 'Which one is NOT a complete sentence?'
                : 'Which one is a run-on — two sentences squashed together?',
            correct: bad.text,
            distractors: good.map((f) => f.text),
            hint: kind === 'fragment'
                ? 'One of these is missing something it needs.'
                : 'Length alone does not make a run-on. Look for two complete thoughts with nothing joining them.',
            explain: kind === 'fragment'
                ? '"' + bad.text + '" does not stand on its own as a sentence.'
                : '"' + bad.text + '" is two complete sentences with no full stop or joining word between them.',
            sig: 'frag:' + kind + ':' + bad.text.slice(0, 10),
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-gram', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
