/*
 * Item generators for morphology.
 *
 * The highest-return strand in the English half, which is why it has more nodes
 * than vocabulary despite vocabulary being the more obvious target: morphological
 * instruction improves reading, spelling and vocabulary together, helps weaker
 * readers most, and doubles as multisyllable decoding.
 *
 * morph.inferMeaning is the node the other eleven exist to reach — working out a
 * word you have never seen from parts you already know is the only vocabulary
 * strategy that scales against 3,000 new words a year.
 */
(function () {
    'use strict';

    const G = {};
    const L = (typeof LANG !== 'undefined') ? LANG : (typeof require === 'function' ? require('../content/words-language.js') : {});

    G['morph.inflect.plural'] = function (rng) {
        const CASES = [
            { one: 'cat', many: 'cats' }, { one: 'box', many: 'boxes' }, { one: 'bus', many: 'buses' },
            { one: 'baby', many: 'babies' }, { one: 'leaf', many: 'leaves' }, { one: 'child', many: 'children' },
            { one: 'foot', many: 'feet' }, { one: 'mouse', many: 'mice' }, { one: 'dish', many: 'dishes' },
            { one: 'story', many: 'stories' },
        ];
        const c = rng.pick(CASES);
        return genText({
            stem: 'What is the word for more than one ' + c.one + '?',
            answer: c.many,
            explain: 'One ' + c.one + ', two ' + c.many + '.',
            sig: 'plural:' + c.one,
        });
    };

    G['morph.inflect.tense'] = function (rng) {
        const t = rng.pick(L.tense);
        const want = rng.pick(['past', 'present']);
        return genText({
            stem: want === 'past'
                ? 'Yesterday I ___ . (' + t.base + ')'
                : 'She ___ every day. (' + t.base + ')',
            answer: t[want],
            explain: '"' + t.base + '" becomes "' + t[want] + '".',
            sig: 'tenseM:' + t.base + ':' + want,
        });
    };

    G['morph.baseWord'] = function (rng) {
        const src = rng.bool()
            ? rng.pick(L.prefixes)
            : rng.pick(L.suffixes);
        const built = src.ex;
        const base = src.base;
        return genText({
            stem: 'What is the base word hidden inside "' + built + '"?',
            answer: base,
            hint: 'Take off the part that was added.',
            explain: '"' + built + '" is "' + base + '" with an extra part on it.',
            sig: 'base:' + built,
        });
    };

    G['morph.prefix.common'] = function (rng) {
        const p = rng.pick(L.prefixes);
        const others = L.prefixes.filter((x) => x.p !== p.p && x.means !== p.means);
        return genMc(rng, {
            stem: 'What does the beginning "' + p.p + '-" mean, as in "' + p.ex + '"?',
            correct: p.means,
            distractors: rng.sample(others.map((x) => x.means), 3),
            explain: '"' + p.p + '-" means ' + p.means + ', so "' + p.ex + '" is "' + p.means
                + ' ' + p.base + '".',
            sig: 'pre:' + p.p,
        });
    };

    G['morph.suffix.common'] = function (rng) {
        const s = rng.pick(L.suffixes);
        const others = L.suffixes.filter((x) => x.s !== s.s && x.means !== s.means);
        return genMc(rng, {
            stem: 'What does the ending "-' + s.s + '" mean, as in "' + s.ex + '"?',
            correct: s.means,
            distractors: rng.sample(others.map((x) => x.means), 3),
            explain: '"-' + s.s + '" means ' + s.means + ', so "' + s.ex + '" is "' + s.base
                + '" with that meaning added.',
            sig: 'suf:' + s.s,
        });
    };

    G['morph.suffix.posShift'] = function (rng) {
        const e = rng.pick(L.posShift);
        return genMc(rng, {
            stem: '"' + e.base + '" is ' + (/^[aeiou]/.test(e.pos) ? 'an ' : 'a ') + e.pos
                + '. Adding "-' + e.sfx + '" makes "' + e.made + '". What kind of word is that now?',
            correct: e.madePos,
            distractors: ['verb', 'noun', 'adjective', 'adverb'].filter((x) => x !== e.madePos),
            explain: 'Endings change a word\'s job, not just its meaning: "' + e.base + '" ('
                + e.pos + ') becomes "' + e.made + '" (' + e.madePos + ').',
            sig: 'pos:' + e.base,
        });
    };

    function rootItem(rng, table, sig) {
        const r = rng.pick(table);
        const others = table.filter((x) => x.r !== r.r && x.means !== r.means);
        if (rng.bool()) {
            return genMc(rng, {
                stem: 'The word part "' + r.r + '" turns up in ' + r.words.slice(0, 2).join(' and ')
                    + '. What does it mean?',
                correct: r.means,
                distractors: rng.sample(others.map((x) => x.means), 3),
                explain: '"' + r.r + '" means ' + r.means + ' — you can hear it in '
                    + r.words.join(', ') + '.',
                sig: sig + ':' + r.r,
            });
        }
        return genMc(rng, {
            stem: 'Which word contains a part meaning "' + r.means + '"?',
            correct: rng.pick(r.words),
            distractors: rng.sample(others.reduce((a, x) => a.concat(x.words), []), 3),
            explain: 'The part "' + r.r + '" means ' + r.means + '.',
            sig: sig + 'W:' + r.r,
        });
    }

    G['morph.roots.latin'] = function (rng) { return rootItem(rng, L.rootsLatin, 'latin'); };
    G['morph.roots.greek'] = function (rng) { return rootItem(rng, L.rootsGreek, 'greek'); };

    G['morph.wordFamily'] = function (rng) {
        const r = rng.pick(L.rootsLatin.concat(L.rootsGreek).filter((x) => x.words.length >= 3));
        const others = L.rootsLatin.concat(L.rootsGreek)
            .filter((x) => x.r !== r.r)
            .reduce((a, x) => a.concat(x.words), [])
            .filter((w) => w.indexOf(r.r) === -1);
        return genMulti(rng, {
            stem: 'Choose every word built from the part "' + r.r + '".',
            right: rng.sample(r.words, Math.min(3, r.words.length)),
            wrong: rng.sample(others, 3),
            explain: 'All of them share "' + r.r + '", meaning ' + r.means + '.',
            sig: 'fam:' + r.r,
        });
    };

    G['morph.decomposeLong'] = function (rng) {
        const CASES = [
            { w: 'unhelpful', parts: 'un + help + ful' },
            { w: 'rewriting', parts: 're + writ(e) + ing' },
            { w: 'disagreement', parts: 'dis + agree + ment' },
            { w: 'carelessly', parts: 'care + less + ly' },
            { w: 'unbreakable', parts: 'un + break + able' },
            { w: 'transportation', parts: 'trans + port + ation' },
        ];
        const c = rng.pick(CASES);
        const wrong = CASES.filter((x) => x.w !== c.w).map((x) => x.parts);
        return genMc(rng, {
            stem: 'How does "' + c.w + '" break into parts?',
            correct: c.parts,
            distractors: rng.sample(wrong, 3),
            hint: 'Find the base word first, then look at what is stuck on each end.',
            explain: '"' + c.w + '" is ' + c.parts + '. Breaking a long word up is how you read it '
                + 'and how you work out what it means.',
            sig: 'decomp:' + c.w,
        });
    };

    /*
     * The payoff node: a word the learner has probably never met, worked out
     * from parts they do know. Distractors are plausible meanings, so guessing
     * from the general topic does not work.
     */
    G['morph.inferMeaning'] = function (rng) {
        const CASES = [
            { w: 'unportable', means: 'not able to be carried', from: 'un (not) + port (carry) + able (can be)',
              wrong: ['very heavy to lift', 'carried by two people', 'able to be carried easily'] },
            { w: 'predictable', means: 'able to be said in advance', from: 'pre (before) + dict (say) + able (can be)',
              wrong: ['said very loudly', 'impossible to know', 'written down first'] },
            { w: 'inspector', means: 'a person who looks at things', from: 'in (into) + spect (look) + or (person who)',
              wrong: ['a tool for looking closely', 'a place where things are looked at', 'the act of looking'] },
            { w: 'microscope', means: 'a device for looking at small things', from: 'micro (small) + scope (look at)',
              wrong: ['a very small telescope', 'a small picture', 'a machine that makes things small'] },
            { w: 'biography', means: 'writing about a life', from: 'bio (life) + graph (write)',
              wrong: ['a drawing of a person', 'the study of living things', 'a very long book'] },
            { w: 'unstructured', means: 'not built to a plan', from: 'un (not) + struct (build) + ure + ed',
              wrong: ['built very carefully', 'built more than once', 'able to be built'] },
            { w: 'retractable', means: 'able to be pulled back in', from: 're (back) + tract (pull) + able (can be)',
              wrong: ['pulled very hard', 'impossible to move', 'pulled by a tractor'] },
            { w: 'visibility', means: 'how well things can be seen', from: 'vis (see) + ible (can be) + ity (the state of)',
              wrong: ['a machine for seeing', 'someone who watches', 'the act of hiding'] },
            { w: 'geothermal', means: 'to do with heat from the earth', from: 'geo (earth) + thermal (heat)',
              wrong: ['a very cold place', 'measuring the earth', 'a kind of map'] },
            { w: 'autobiography', means: 'the story of a life written by that person',
              from: 'auto (self) + bio (life) + graph (write)',
              wrong: ['a story about cars', 'a book about many lives', 'a drawing of a person'] },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'You have probably never met the word "' + c.w + '". Using its parts, what is it likely to mean?',
            correct: c.means,
            distractors: c.wrong,
            hint: 'Break it into parts you already know.',
            explain: c.w + ' = ' + c.from + ', so it means ' + c.means + '.',
            sig: 'infer:' + c.w,
        });
    };


    // ---- tier 2/3 ------------------------------------------------------------
    G['morph.compound'] = function (rng) {
        const COMPOUNDS = [
            ['bird', 'house'], ['rain', 'bow'], ['foot', 'ball'], ['sun', 'flower'],
            ['play', 'ground'], ['tooth', 'brush'], ['book', 'shelf'], ['snow', 'man'],
        ];
        const c = rng.pick(COMPOUNDS);
        const word = c[0] + c[1];
        if (rng.bool()) {
            return genMc(rng, {
                stem: 'Which two words make up "' + word + '"?',
                correct: c[0] + ' + ' + c[1],
                distractors: rng.sample(COMPOUNDS.filter((x) => x[0] !== c[0]), 3)
                    .map((x) => x[0] + ' + ' + x[1]),
                sig: 'compA:' + word,
            });
        }
        return genMc(rng, {
            stem: 'Which of these is a compound word — two whole words joined together?',
            correct: word,
            distractors: ['happiness', 'unhappy', 'quickly'],
            explain: '"' + word + '" is "' + c[0] + '" and "' + c[1] + '" joined. The others have '
                + 'parts added on, but those parts are not whole words.',
            sig: 'compB:' + word,
        });
    };

    G['morph.absorbedPrefix'] = function (rng) {
        const CASES = [
            { w: 'impossible', form: 'im', base: 'possible', why: 'before p, in- becomes im-' },
            { w: 'illegal', form: 'il', base: 'legal', why: 'before l, in- becomes il-' },
            { w: 'irregular', form: 'ir', base: 'regular', why: 'before r, in- becomes ir-' },
            { w: 'incorrect', form: 'in', base: 'correct', why: 'before c, in- stays in-' },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'The word "' + c.w + '" means "not ' + c.base + '". Which prefix is it, really?',
            correct: 'in- (meaning not)',
            distractors: ['im- (meaning into)', 'il- (meaning very)', 'ir- (meaning again)'],
            explain: 'It is in- meaning "not", but it changes shape to match the next letter: ' + c.why + '.',
            sig: 'absorb:' + c.w,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('ela-morph', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
