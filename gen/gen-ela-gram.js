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

    const words = (s) => String(s).trim().split(/\s+/);

    /*
     * The capitals and commas banks each store a right/wrong PAIR, which means
     * the tap answer can be derived rather than authored a second time: the
     * indices where the two versions disagree are exactly the answer. Authoring
     * it twice would let the two copies drift, and a tap item whose answer
     * disagrees with its own sentence is worse than no item.
     *
     * Both derivations return null if the pair does not line up word for word,
     * and the caller falls back to multiple choice. A malformed bank entry then
     * costs one weaker question instead of one wrong one.
     */
    function capsDiff(pair) {
        const right = words(pair.right);
        const wrong = words(pair.wrong);
        if (right.length !== wrong.length) return null;
        const answer = [];
        for (let i = 0; i < right.length; i++) {
            if (right[i].toLowerCase() !== wrong[i].toLowerCase()) return null;
            if (right[i] !== wrong[i]) answer.push(i);
        }
        return answer.length ? { tokens: wrong, answer: answer } : null;
    }

    /*
     * Slot i sits after token i, so a comma ending right-word i means slot i.
     *
     * Derived from `right` alone, with the commas stripped for display, rather
     * than from the right/wrong pair. Some bank entries are wrong because a
     * comma is MISPLACED ("It was cold but, we went anyway") rather than
     * missing, and diffing the pair silently rejected those — handing the
     * fallback a fifth of the bank. Stripping treats both faults the same:
     * whatever the wrong version does, the student places commas into a
     * sentence that has none.
     */
    function commaSlots(pair) {
        const right = words(pair.right);
        const answer = [];
        right.forEach((w, i) => {
            // A comma on the last word would be a slot that does not exist.
            if (w.indexOf(',') >= 0 && i < right.length - 1) answer.push(i);
        });
        if (!answer.length) return null;
        return { tokens: right.map((w) => w.replace(/,/g, '')), answer: answer };
    }

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
        /* A third of draws sort words from three different sentences into
         * Nouns and Verbs. Only those two classes: the bank's nouns are
         * concrete things and its verbs inflected past forms, so each word is
         * unambiguous OUT of its sentence — which adjectives ("light"?) would
         * not be. The dedupe guard falls through rather than risk one word
         * with two homes. */
        if (rng.int(0, 2) === 0) {
            const three = rng.sample(L.sentences, 3);
            const nouns = three.map((x) => x.noun);
            const verbs = three.map((x) => x.verb);
            if (new Set(nouns.concat(verbs)).size === 6) {
                return genSortBins(rng, {
                    stem: 'Sort each word: is it a noun or a verb?',
                    bins: [{ id: 'noun', label: 'Nouns' }, { id: 'verb', label: 'Verbs' }],
                    put: { noun: nouns, verb: verbs },
                    hint: 'A noun is a thing you could point at; a verb is something being done.',
                    explain: 'Nouns: ' + nouns.join(', ') + '. Verbs: ' + verbs.join(', ') + '.',
                    sig: 'posSort:' + nouns.join(','),
                });
            }
        }

        const s = rng.pick(L.sentences);
        const which = rng.pick(['noun', 'verb', 'adj', 'adv']);
        const NAME = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb' };
        const others = ['noun', 'verb', 'adj', 'adv'].filter((k) => k !== which);

        // Tapping the word where it stands beats picking it out of a list: the
        // list quietly does half the work by naming four candidates, when the
        // skill is finding the one word among all of them.
        const toks = words(s.s);
        const at = toks.findIndex((t) => t.replace(/[^A-Za-z'-]/g, '') === s[which]);
        if (at >= 0) {
            return genTapToken({
                stem: 'Tap the ' + NAME[which] + ' in this sentence.',
                tokens: toks,
                answer: [at],
                hint: 'Think about the job the word does in the sentence, not what it means on its own.',
                explain: '"' + s[which] + '" is the ' + NAME[which] + ' here.',
                sig: 'pos:' + s.noun + ':' + which,
            });
        }
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
            { s: 'Do not touch the wet paint', mark: '!', why: 'it is a warning' },
            { s: 'My cousin lives in Cardiff', mark: '.', why: 'it tells you something' },
            { s: 'Who left the door open', mark: '?', why: 'it asks something' },
            { s: 'That was the best day ever', mark: '!', why: 'it shows strong feeling' },
            { s: 'Have you finished your homework', mark: '?', why: 'it asks something' },
            { s: 'The train leaves at half past four', mark: '.', why: 'it tells you something' },
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
            { s: 'The teachers marked the books, then ___ went home.', right: 'they', wrong: ['them', 'their', 'he'] },
            { s: 'This coat is mine and that one is ___ .', right: 'hers', wrong: ['her', 'she', 'their'] },
            { s: 'Between you and ___ , I think it will rain.', right: 'me', wrong: ['I', 'my', 'mine'] },
            { s: 'The birds built ___ nest in the hedge.', right: 'their', wrong: ["they're", 'there', 'its'] },
            { s: 'Nobody knew where ___ had gone.', right: 'he', wrong: ['him', 'his', 'them'] },
            { s: 'My sister and ___ walked to school.', right: 'I', wrong: ['me', 'my', 'mine'] },
        ];
        /*
         * Two different skills live under this node, so it alternates rather
         * than converting. The gap-fill tests pronoun CASE ("me" vs "I"), which
         * tapping cannot ask; tapping tests recognising a pronoun at all, which
         * the gap-fill cannot ask because it has already pointed at the gap.
         */
        if (rng.pick([true, false])) {
            const FIND = [
                'She gave him the book that we found.',
                'They told us it was our turn.',
                'I asked her if you were coming.',
                'We saw them at the park with their dog.',
                'You can keep mine if she wants hers.',
                'Our teacher showed us how they work.',
                'He knows that I like it.',
                'They are meeting him and me later.',
            ];
            const PRON = new Set(['i', 'me', 'my', 'mine', 'you', 'your', 'yours',
                'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its',
                'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs']);
            const sent = rng.pick(FIND);
            const toks = words(sent);
            // Derived, not hand-indexed — a hand-written index list silently
            // goes wrong the moment anyone edits a sentence above it.
            const answer = toks
                .map((t, i) => (PRON.has(t.replace(/[^A-Za-z']/g, '').toLowerCase()) ? i : -1))
                .filter((i) => i >= 0);
            if (answer.length) {
                return genTapToken({
                    stem: 'Tap every pronoun in this sentence.',
                    tapNote: 'Tap each one, then press Check.',
                    tokens: toks,
                    answer: answer,
                    hint: 'A pronoun stands in for a name — I, you, he, she, it, we, they and their forms.',
                    explain: 'The pronouns here are ' + answer.map((i) => '"' + toks[i].replace(/[^A-Za-z']/g, '') + '"').join(', ') + '.',
                    sig: 'pronfind:' + sent.slice(0, 14),
                });
            }
        }

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
        const d = commaSlots(c);
        if (d) {
            return genTapToken({
                stem: 'Tap each gap where a comma belongs.',
                tapNote: 'Tap the gaps, then press Check.',
                mode: 'slot',
                tokens: d.tokens,
                answer: d.answer,
                hint: 'Read it aloud. A comma goes where you would pause.',
                explain: 'A comma is needed ' + c.why + ' — "' + c.right + '"',
                sig: 'comma:' + c.why,
            });
        }
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


    // ---- tier 2 --------------------------------------------------------------
    G['gram.capitalisation'] = function (rng) {
        const c = rng.pick(L.capitals);
        const d = capsDiff(c);
        if (d) {
            return genTapToken({
                stem: 'Tap every word that should start with a capital letter.',
                tapNote: 'Tap each one, then press Check.',
                tokens: d.tokens,
                answer: d.answer,
                hint: 'Look for the start of the sentence, names, days and places.',
                explain: 'Capitals are needed for the ' + c.why + ' — "' + c.right + '"',
                sig: 'caps:' + c.why,
            });
        }
        return genMc(rng, {
            stem: 'Which sentence uses capital letters correctly?',
            correct: c.right,
            distractors: [c.wrong],
            explain: 'Capitals are needed for the ' + c.why + '.',
            sig: 'caps:' + c.why,
        });
    };

    G['gram.sentenceTypes'] = function (rng) {
        const CASES = [
            { s: 'The cat is asleep.', kind: 'a statement' },
            { s: 'Where did you put my shoes?', kind: 'a question' },
            { s: 'Please close the door.', kind: 'a command' },
            { s: 'What a beautiful morning!', kind: 'an exclamation' },
            { s: 'We walked to the shops.', kind: 'a statement' },
            { s: 'Pass me the salt.', kind: 'a command' },
            { s: 'How did you do that?', kind: 'a question' },
            { s: 'Stand behind the line.', kind: 'a command' },
            { s: 'What a mess this is!', kind: 'an exclamation' },
            { s: 'The library closes at five.', kind: 'a statement' },
            { s: 'Are these seats free?', kind: 'a question' },
            { s: 'How cold it is today!', kind: 'an exclamation' },
        ];
        /* Two kinds, two sentences of each. The pair that actually confuses is
         * command vs exclamation — both can end in "!" in the wild — so any
         * two kinds sorted against each other is a sharper question than one
         * sentence against four names. */
        if (rng.bool()) {
            const kinds = rng.sample(['a statement', 'a question', 'a command', 'an exclamation'], 2);
            const label = (k) => { const w = k.replace(/^an? /, ''); return w[0].toUpperCase() + w.slice(1) + 's'; };
            const of = (k) => rng.sample(CASES.filter((c) => c.kind === k), 2).map((c) => c.s);
            const a = of(kinds[0]), b = of(kinds[1]);
            return genSortBins(rng, {
                stem: 'Sort each sentence by what kind it is.',
                bins: [{ id: 'a', label: label(kinds[0]) }, { id: 'b', label: label(kinds[1]) }],
                put: { a: a, b: b },
                hint: 'Ask what each one is FOR — telling, asking, ordering, or exclaiming.',
                sig: 'stypeSort:' + kinds.join('+'),
            });
        }

        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'What kind of sentence is this?  "' + c.s + '"',
            correct: c.kind,
            distractors: ['a statement', 'a question', 'a command', 'an exclamation']
                .filter((k) => k !== c.kind),
            sig: 'stype:' + c.s.slice(0, 12),
        });
    };

    G['gram.quotation'] = function (rng) {
        const CASES = [
            { right: '"I am ready," said Ella.', wrong: '"I am ready" said Ella.',
              why: 'a comma goes inside the speech marks before "said"' },
            { right: 'Tom asked, "Is it raining?"', wrong: 'Tom asked "Is it raining"?',
              why: 'the question mark belongs to the spoken words, so it goes inside' },
            { right: '"Wait for me!" shouted Ravi.', wrong: '"Wait for me"! shouted Ravi.',
              why: 'the exclamation mark belongs to the spoken words' },
            { right: '"Come inside," called Mum, "it is freezing."', wrong: '"Come inside" called Mum "it is freezing."',
              why: 'each part of the speech needs its own speech marks, with commas inside' },
            { right: 'The sign read, "No entry."', wrong: 'The sign read "No entry".',
              why: 'the full stop belongs to the quoted words' },
            { right: '"Did you hear that?" whispered Jo.', wrong: '"Did you hear that"? whispered Jo.',
              why: 'the question mark belongs to the spoken words' },
            { right: 'Ben said, "I will be there by six."', wrong: 'Ben said "I will be there by six".',
              why: 'a comma introduces the speech and the full stop goes inside' },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'Which line is punctuated correctly?',
            correct: c.right,
            distractors: [c.wrong],
            explain: c.why + '.',
            sig: 'quote:' + c.why.slice(0, 15),
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-gram', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
