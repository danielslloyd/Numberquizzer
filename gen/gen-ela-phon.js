/*
 * Item generators for phonics and decoding.
 *
 * Decoding is an *oral* skill. Where a microphone is available these nodes ask
 * for it directly — see READ_ALOUD at the foot of this file — and where one is
 * not, they test decoding at one remove but honestly: matching a vowel sound
 * across two written words requires decoding both, and there is no way to answer
 * "which word has the same vowel sound as rain" by looking at letter shapes,
 * because the foils are chosen so the spelling never gives it away.
 *
 * Every foil is drawn from a different pattern group than the answer. A foil
 * that secretly contains the target pattern turns a correct answer into a marked
 * mistake, which is the failure mode this whole layer is built to avoid.
 */
(function () {
    'use strict';

    const G = {};
    const W = (typeof WORDS !== 'undefined') ? WORDS : (typeof require === 'function' ? require('../content/words-phonics.js') : {});

    const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');

    function flat(obj, except) {
        return Object.keys(obj).filter((k) => k !== except)
            .reduce((acc, k) => acc.concat(obj[k]), []);
    }

    /* "Which word has the same X as <example>?" — the workhorse shape. */
    function sameSound(rng, opts) {
        const target = rng.pick(opts.group);
        const example = rng.pick(opts.group.filter((w) => w !== target)) || target;
        return genMc(rng, {
            stem: 'Which word has the same ' + opts.what + ' as "' + example + '"?',
            correct: target,
            distractors: rng.sample(opts.foils.filter((w) => opts.group.indexOf(w) === -1), 3),
            explain: '"' + target + '" and "' + example + '" both have ' + opts.because + '.',
            sig: opts.sig + ':' + example + ':' + target,
        });
    }

    G['phon.letterNames'] = function (rng) {
        const i = rng.int(0, 24);
        if (rng.bool()) {
            return genMc(rng, {
                stem: 'Which letter comes straight after ' + ALPHA[i].toUpperCase() + '?',
                correct: ALPHA[i + 1].toUpperCase(),
                distractors: [ALPHA[i].toUpperCase(), ALPHA[Math.max(0, i - 1)].toUpperCase(),
                    ALPHA[Math.min(25, i + 2)].toUpperCase()],
                sig: 'after:' + ALPHA[i],
            });
        }
        const j = rng.int(0, 25);
        return genMc(rng, {
            stem: 'Which is the small letter that matches ' + ALPHA[j].toUpperCase() + '?',
            correct: ALPHA[j],
            distractors: rng.sample(ALPHA.filter((c) => c !== ALPHA[j]), 3),
            sig: 'case:' + ALPHA[j],
        });
    };

    G['phon.consonants'] = function (rng) {
        const all = flat(W.cvc);
        const word = rng.pick(all);
        const first = word[0];
        // c and k make the same sound, so "different first letter" is not enough
        // to make a word a wrong answer to a question about the first SOUND.
        const SAME_SOUND = { c: 'k', k: 'c' };
        const twin = SAME_SOUND[first];
        const others = all.filter((w) => w[0] !== first && w[0] !== twin);
        return genMc(rng, {
            stem: 'Which word starts with the same sound as "' + word + '"?',
            correct: rng.pick(all.filter((w) => w[0] === first && w !== word)) || word,
            distractors: rng.sample(others, 3),
            explain: 'Both start with the sound of the letter ' + first + '.',
            sig: 'cons:' + word,
        });
    };

    /*
     * The five short vowels are where a microphone earns its keep, because they
     * are the one thing on this ladder that is purely a sound. Every written
     * item about them is a proxy; making the sound is the skill itself.
     *
     * Offered as a choice between two or three neighbours rather than all five —
     * partly because that is the question ("is that the a in cat or in day"),
     * and partly because the classifier is markedly steadier over a few
     * well-separated targets than over the whole vowel space.
     */
    const VOWEL_SAY = { 'short-a': 'a as in cat', 'short-e': 'e as in bed',
        'short-i': 'i as in sit', 'short-o': 'o as in hop', 'short-u': 'u as in cup',
        'long-e': 'ee as in feet', 'long-oo': 'oo as in moon', 'long-a': 'ay as in day' };
    const VOWEL_SETS = [
        ['short-a', 'long-a'], ['short-e', 'long-e'], ['short-i', 'long-e'],
        ['short-o', 'long-oo'], ['short-u', 'long-oo'],
        ['short-a', 'short-o'], ['short-i', 'short-u'],
        ['short-a', 'short-e', 'short-o'],
    ];

    G['phon.shortVowels'] = function (rng, params) {
        if (params && params.sound) {
            const set = rng.pick(VOWEL_SETS);
            const want = rng.pick(set.filter((id) => id.indexOf('short-') === 0)) || set[0];
            return genSound({
                vowel: want,
                among: set,
                stem: 'Make the sound "' + VOWEL_SAY[want].split(' as in ')[0]
                    + '", the one in "' + VOWEL_SAY[want].split(' as in ')[1] + '". Hold it.',
                names: VOWEL_SAY,
                explain: 'That is the ' + VOWEL_SAY[want] + ' sound.',
                sig: 'shortV:sound',
            });
        }
        const v = rng.pick(['a', 'e', 'i', 'o', 'u']);
        return sameSound(rng, {
            what: 'middle sound',
            group: W.cvc[v],
            foils: flat(W.cvc, v),
            because: 'the short ' + v + ' sound in the middle',
            sig: 'shortV:' + v,
        });
    };

    G['phon.cvc'] = function (rng) {
        const v = rng.pick(['a', 'e', 'i', 'o', 'u']);
        const word = rng.pick(W.cvc[v]);
        const rhymes = W.cvc[v].filter((w) => w !== word && w.slice(1) === word.slice(1));
        if (rhymes.length) {
            return genMc(rng, {
                stem: 'Which word rhymes with "' + word + '"?',
                correct: rng.pick(rhymes),
                distractors: rng.sample(flat(W.cvc, v), 3),
                sig: 'cvcRhyme:' + word,
            });
        }
        return sameSound(rng, {
            what: 'vowel sound',
            group: W.cvc[v],
            foils: flat(W.cvc, v),
            because: 'the short ' + v + ' sound',
            sig: 'cvc:' + v,
        });
    };

    /*
     * Foils come from groups with a DIFFERENT sound, not merely a different
     * spelling. Several spellings share a sound — ew and long oo, oi and oy, er
     * and ir and ur — so a foil chosen by spelling alone can be a perfectly
     * correct answer to a question about sound.
     */
    function otherSoundWords(table, tableName, key) {
        const mine = W.soundClassIn ? W.soundClassIn(tableName, key) : key;
        return Object.keys(table)
            .filter((k) => (W.soundClassIn ? W.soundClassIn(tableName, k) : k) !== mine)
            .reduce((acc, k) => acc.concat(table[k]), []);
    }

    function patternItem(rng, table, label, sig, tableName) {
        const key = rng.pick(Object.keys(table));
        const foils = otherSoundWords(table, tableName, key).concat(flat(W.cvc));
        const correct = rng.pick(table[key]);
        return genMc(rng, {
            stem: 'Which word has the "' + key + '" ' + label + '?',
            correct: correct,
            distractors: rng.sample(foils.filter((w) => table[key].indexOf(w) === -1), 3),
            explain: 'Look for the letters "' + key + '" making one sound.',
            // The chosen word belongs in the signature, not just the pattern.
            // The runner de-duplicates on sig, so a signature coarser than the
            // item makes it discard perfectly good questions as repeats.
            sig: sig + ':' + key + ':' + correct,
        });
    }

    G['phon.digraphs'] = function (rng) { return patternItem(rng, W.digraph, 'sound', 'dig', 'digraph'); };
    G['phon.rControlled'] = function (rng) { return patternItem(rng, W.rControlled, 'sound', 'rc', 'rControlled'); };
    G['phon.diphthongs'] = function (rng) { return patternItem(rng, W.diphthong, 'sound', 'dip', 'diphthong'); };
    G['phon.vowelTeams.long'] = function (rng) { return patternItem(rng, W.vowelTeamLong, 'vowel team', 'vtl', 'vowelTeamLong'); };
    /*
     * These groups are separated by SOUND, not spelling — "moon" and "book" both
     * contain oo. Asking "which word has the oo spelling" is therefore ambiguous
     * with its own foils, so this one asks for a matching sound against an
     * example instead. Telling long oo from short oo is the actual skill.
     */
    G['phon.vowelTeams.more'] = function (rng) {
        const key = rng.pick(Object.keys(W.vowelTeamMore));
        const group = W.vowelTeamMore[key];
        const target = rng.pick(group);
        const example = rng.pick(group.filter((w) => w !== target)) || target;
        const foils = otherSoundWords(W.vowelTeamMore, 'vowelTeamMore', key);
        return genMc(rng, {
            stem: 'Which word has the same vowel sound as "' + example + '"?',
            correct: target,
            distractors: rng.sample(foils.filter((w) => group.indexOf(w) === -1), 3),
            explain: '"' + target + '" and "' + example + '" share the ' + key + ' sound.',
            sig: 'vtm:' + key + ':' + example,
        });
    };

    G['phon.blends.initial'] = function (rng) {
        const word = rng.pick(W.blendInitial);
        return genMc(rng, {
            stem: 'Which word begins with two consonants blended together, like "' + word + '"?',
            correct: rng.pick(W.blendInitial.filter((w) => w !== word)),
            distractors: rng.sample(flat(W.cvc), 3),
            explain: 'A blend is two consonants you can still hear separately, as in "' + word + '".',
            sig: 'bi:' + word,
        });
    };

    G['phon.blends.final'] = function (rng) {
        const word = rng.pick(W.blendFinal);
        return genMc(rng, {
            stem: 'Which word ends with two consonants blended together, like "' + word + '"?',
            correct: rng.pick(W.blendFinal.filter((w) => w !== word)),
            distractors: rng.sample(flat(W.cvc), 3),
            sig: 'bf:' + word,
        });
    };

    /*
     * Silent e is tested by the change it makes: the same letters with and
     * without the e are two different words, which is the only thing that
     * matters about the pattern.
     */
    G['phon.vce'] = function (rng) {
        const pair = rng.pick(W.vcePairs);
        if (rng.bool()) {
            return genText({
                stem: 'Add a silent e to the end of "' + pair[0] + '". What word do you get?',
                answer: pair[1],
                hint: 'The e is not said, but it changes the vowel.',
                explain: '"' + pair[0] + '" becomes "' + pair[1] + '" — the e makes the vowel say its name.',
                sig: 'vceAdd:' + pair[0],
            });
        }
        return genMc(rng, {
            stem: 'In "' + pair[1] + '", what does the e at the end do?',
            correct: 'It makes the vowel say its name',
            distractors: ['It is said as an extra sound', 'It makes the word plural',
                'It makes the vowel short'],
            explain: '"' + pair[0] + '" has a short vowel; "' + pair[1] + '" has a long one. '
                + 'The e is silent and does the changing.',
            sig: 'vceWhy:' + pair[1],
        });
    };

    G['phon.inflections'] = function (rng) {
        const e = rng.pick(W.inflect.filter((x) => x.ed));
        const which = rng.pick(['s', 'ed', 'ing']);
        return genText({
            stem: 'Add "-' + which + '" to the word "' + e.base + '".',
            answer: e[which],
            hint: e.rule === 'double' ? 'You may need to double the last letter.'
                : e.rule === 'dropE' ? 'You may need to drop the silent e.'
                    : e.rule === 'yToI' ? 'You may need to change the y.' : null,
            explain: '"' + e.base + '" + "-' + which + '" is "' + e[which] + '".',
            sig: 'infl:' + e.base + ':' + which,
        });
    };

    G['phon.syllableTypes'] = function (rng) {
        const closed = rng.pick(['nap', 'cat', 'pic', 'mag', 'ten']);
        const open = rng.pick(['me', 'go', 'hi', 'she', 'no']);
        if (rng.bool()) {
            return genMc(rng, {
                stem: 'The syllable "' + closed + '" ends in a consonant, so the vowel is short. '
                    + 'What kind of syllable is that?',
                correct: 'A closed syllable',
                distractors: ['An open syllable', 'A silent-e syllable', 'A vowel-team syllable'],
                explain: 'A consonant closes the syllable in and keeps the vowel short.',
                sig: 'sylClosed:' + closed,
            });
        }
        return genMc(rng, {
            stem: 'The syllable "' + open + '" ends in a vowel, and the vowel says its name. '
                + 'What kind of syllable is that?',
            correct: 'An open syllable',
            distractors: ['A closed syllable', 'An r-controlled syllable', 'A silent-e syllable'],
            explain: 'Nothing closes it in, so the vowel is free to say its name.',
            sig: 'sylOpen:' + open,
        });
    };

    G['phon.syllableDivision'] = function (rng) {
        const SPLITS = [
            { w: 'rabbit', right: 'rab/bit', wrong: ['ra/bbit', 'rabb/it', 'r/abbit'] },
            { w: 'napkin', right: 'nap/kin', wrong: ['na/pkin', 'napk/in', 'n/apkin'] },
            { w: 'basket', right: 'bas/ket', wrong: ['ba/sket', 'bask/et', 'b/asket'] },
            { w: 'muffin', right: 'muf/fin', wrong: ['mu/ffin', 'muff/in', 'm/uffin'] },
            { w: 'sunset', right: 'sun/set', wrong: ['su/nset', 'suns/et', 's/unset'] },
            { w: 'magnet', right: 'mag/net', wrong: ['ma/gnet', 'magn/et', 'm/agnet'] },
            { w: 'tennis', right: 'ten/nis', wrong: ['te/nnis', 'tenn/is', 't/ennis'] },
            { w: 'picnic', right: 'pic/nic', wrong: ['pi/cnic', 'picn/ic', 'p/icnic'] },
            { w: 'kitten', right: 'kit/ten', wrong: ['ki/tten', 'kitt/en', 'k/itten'] },
            { w: 'contest', right: 'con/test', wrong: ['co/ntest', 'cont/est', 'c/ontest'] },
            { w: 'puppet', right: 'pup/pet', wrong: ['pu/ppet', 'pupp/et', 'p/uppet'] },
            { w: 'window', right: 'win/dow', wrong: ['wi/ndow', 'wind/ow', 'w/indow'] },
        ];
        const s = rng.pick(SPLITS);
        return genMc(rng, {
            stem: 'Where does "' + s.w + '" split into syllables?',
            correct: s.right,
            distractors: s.wrong,
            hint: 'Every syllable needs a vowel sound.',
            explain: '"' + s.w + '" splits between the two consonants in the middle: ' + s.right + '.',
            sig: 'sylDiv:' + s.w,
        });
    };

    G['phon.twoSyllable'] = function (rng) {
        const two = rng.pick(W.twoSyllable);
        return genMc(rng, {
            stem: 'Which of these words has two syllables?',
            correct: two,
            distractors: rng.sample(flat(W.cvc), 3),
            hint: 'Count the vowel sounds you hear.',
            explain: '"' + two + '" has two vowel sounds, so two syllables.',
            sig: 'two:' + two,
        });
    };

    G['phon.schwa'] = function (rng) {
        const e = rng.pick(W.schwa);
        // Distractors are the word's OWN other syllables. Fragments of other
        // words would be eliminable at a glance, and one of them could easily
        // turn out to be part of this word as well.
        return genMc(rng, {
            stem: 'In "' + e.w + '", which part has the lazy "uh" sound?',
            correct: e.syl,
            distractors: e.syls.filter((x) => x !== e.syl),
            explain: 'In "' + e.w + '" the "' + e.syl + '" part is unstressed, so its vowel '
                + 'flattens to "uh". That is what makes long words hard to read even when you '
                + 'know every letter.',
            sig: 'schwa:' + e.w,
        });
    };

    G['phon.multisyllable'] = function (rng) {
        const long = rng.pick(W.multisyllable);
        return genMc(rng, {
            stem: 'Which of these is the longest word by number of syllables?',
            correct: long,
            distractors: rng.sample(W.twoSyllable, 2).concat(rng.sample(flat(W.cvc), 1)),
            hint: 'Count the vowel sounds.',
            explain: '"' + long + '" has the most vowel sounds, so the most syllables.',
            sig: 'multi:' + long,
        });
    };


    // ---- tier 2 --------------------------------------------------------------
    G['phon.ffllss'] = function (rng) {
        const word = rng.pick(W.ffllss);
        return genMc(rng, {
            stem: 'Which word is spelled correctly?',
            correct: word,
            distractors: [word.slice(0, -1), word + word[word.length - 1], word.slice(0, -2) + word[word.length - 1]]
                .filter((x, i, a) => x !== word && a.indexOf(x) === i),
            explain: 'After one short vowel at the end of a short word, f, l and s are doubled.',
            sig: 'ffllss:' + word,
        });
    };

    G['phon.vowelTeams.exceptions'] = function (rng) {
        const e = rng.pick(W.vowelTeamExceptions);
        const odd = rng.pick(e.odd);
        return genMc(rng, {
            stem: 'These words all contain "' + e.team + '". Which one says it differently from the others?',
            correct: odd,
            distractors: rng.sample(e.usual, 3),
            explain: '"' + odd + '" breaks the usual pattern for "' + e.team
                + '" — the same letters do not always make the same sound.',
            sig: 'vtEx:' + e.team + ':' + odd,
        });
    };

    G['phon.softCG'] = function (rng) {
        const soft = rng.bool();
        const letter = rng.bool() ? 'c' : 'g';
        const softList = letter === 'c' ? W.softC : W.softG;
        const hardList = letter === 'c' ? W.hardC : W.hardG;
        let cgWord;
        return genMc(rng, {
            stem: 'In which word does the "' + letter + '" make its ' + (soft ? 'soft' : 'hard') + ' sound?',
            correct: (function () { cgWord = rng.pick(soft ? softList : hardList); return cgWord; })(),
            distractors: rng.sample(soft ? hardList : softList, 3),
            hint: 'c and g go soft before e, i and y.',
            sig: 'softcg:' + letter + ':' + (soft ? 's' : 'h') + ':' + cgWord,
        });
    };

    G['phon.tchDge'] = function (rng) {
        const key = rng.bool() ? 'tch' : 'dge';
        let tchWord;
        return genMc(rng, {
            stem: 'Which word uses "' + key + '"?',
            correct: (function () { tchWord = rng.pick(W.tchDge[key]); return tchWord; })(),
            distractors: rng.sample(W.tchDge[key === 'tch' ? 'dge' : 'tch'].concat(flat(W.cvc)), 3),
            explain: '"' + key + '" is used straight after a short vowel.',
            sig: 'tchdge:' + key + ':' + tchWord,
        });
    };

    G['phon.silentLetters'] = function (rng) {
        const key = rng.pick(Object.keys(W.silent));
        const word = rng.pick(W.silent[key]);
        return genMc(rng, {
            stem: 'In the word "' + word + '", which letter is not sounded?',
            correct: key[0],
            distractors: word.split('').filter((c) => c !== key[0])
                .filter((c, i, a) => a.indexOf(c) === i).slice(0, 3),
            explain: 'In "' + key + '" the ' + key[0] + ' is silent.',
            sig: 'silent:' + word,
        });
    };

    G['phon.yAsVowel'] = function (rng) {
        const longI = rng.bool();
        let yWord;
        return genMc(rng, {
            stem: 'In which word does the "y" sound like a long ' + (longI ? 'i' : 'e') + '?',
            correct: (function () { yWord = rng.pick(W.yVowel[longI ? 'long i' : 'long e']); return yWord; })(),
            distractors: rng.sample(W.yVowel[longI ? 'long e' : 'long i'], 3),
            hint: 'A y at the end of a one-syllable word usually says long i; at the end of a longer word it usually says long e.',
            sig: 'yv:' + (longI ? 'i' : 'e') + ':' + yWord,
        });
    };

    G['phon.consonantLe'] = function (rng) {
        const LE = ['table', 'little', 'apple', 'purple', 'candle', 'bubble', 'simple', 'handle'];
        const word = rng.pick(LE);
        return genMc(rng, {
            stem: 'Where does "' + word + '" split into syllables?',
            correct: word.slice(0, -3) + '/' + word.slice(-3),
            distractors: [word.slice(0, -2) + '/' + word.slice(-2), word.slice(0, -4) + '/' + word.slice(-4),
                word.slice(0, 2) + '/' + word.slice(2)].filter((x) => x !== word.slice(0, -3) + '/' + word.slice(-3)),
            explain: 'The final syllable takes the consonant before the -le with it.',
            sig: 'cle:' + word,
        });
    };

    // =====================================================================
    // READ IT OUT LOUD
    // =====================================================================
    /*
     * Everything above tests decoding at one remove, because for a long time
     * this was a silent medium. When a microphone is available it is no longer,
     * and asking a child to read the word is a straightforwardly better question
     * than asking them to pick it out of four: a four-option item hands over 25%
     * for guessing and considerably more for eliminating the three that plainly
     * are not it, and neither route requires decoding anything.
     *
     * So: when the caller says a microphone exists, about half the draws for a
     * word-decoding node become "read this". The other half stay as they were,
     * because the recogniser will not hear everything and a run that is entirely
     * read-aloud can stall on a bad microphone.
     *
     * Only nodes whose skill really is turning letters into sounds are listed.
     * phon.letterNames and phon.syllableDivision are not — naming a letter or
     * splitting a word are not reading it — and no node about *spelling* appears
     * anywhere here, because a microphone cannot tell "knot" from "not" and that
     * distinction is the whole of what those nodes assess.
     */
    const READ_ALOUD = {
        'phon.cvc': () => flat(W.cvc),
        'phon.digraphs': () => flat(W.digraph),
        'phon.rControlled': () => flat(W.rControlled),
        'phon.diphthongs': () => flat(W.diphthong),
        'phon.vowelTeams.long': () => flat(W.vowelTeamLong),
        'phon.vowelTeams.more': () => flat(W.vowelTeamMore),
        'phon.vowelTeams.exceptions': () => W.vowelTeamExceptions
            .reduce((a, x) => a.concat(x.usual, x.odd), []),
        'phon.blends.initial': () => W.blendInitial,
        'phon.blends.final': () => W.blendFinal,
        'phon.vce': () => W.vce,
        'phon.softCG': () => W.softC.concat(W.hardC, W.softG, W.hardG),
        'phon.silentLetters': () => flat(W.silent),
        'phon.yAsVowel': () => flat(W.yVowel),
        'phon.tchDge': () => flat(W.tchDge),
        'phon.ffllss': () => W.ffllss,
        'phon.twoSyllable': () => W.twoSyllable,
        'phon.multisyllable': () => W.multisyllable,
        'phon.schwa': () => W.schwa.map((x) => x.w),
        'phon.consonantLe': () => ['table', 'little', 'apple', 'purple', 'candle',
            'bubble', 'simple', 'handle'],
    };

    Object.keys(READ_ALOUD).forEach((id) => {
        const tap = G[id];
        if (!tap) return;
        G[id] = function (rng, params) {
            // The coin is only tossed when a microphone is in play, so a run
            // without one draws exactly the items it always did.
            if (params && params.mic && rng.bool()) {
                const word = rng.pick(READ_ALOUD[id]() || []);
                if (word) {
                    return genRead({
                        word: word,
                        accept: W.heard ? (W.heard[word] || []) : [],
                        sig: id,
                    });
                }
            }
            return tap(rng, params);
        };
    });

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-phon', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
