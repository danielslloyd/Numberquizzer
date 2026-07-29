/*
 * Shared item constructors for generator packs.  Prefix: gen
 *
 * Every pack needs the same handful of shapes, and the multiple-choice one in
 * particular has a detail worth writing once: distractors must be de-duplicated
 * and the options shuffled, so the correct answer is never at a fixed index a
 * learner could pattern-match without reading the question. Ten packs each
 * reimplementing that is ten chances to get it wrong.
 *
 * Eager (a couple of KB) because every lazily-loaded pack depends on it.
 */
(function () {
    'use strict';

    /*
     * Signatures identify an item for de-duplication inside a run. A generator's
     * explicit `sig` is treated as a CATEGORY, and the answer is appended to it
     * — because a signature coarser than the item makes the runner throw away
     * perfectly good questions as repeats. Several packs had signatures naming
     * only the pattern being tested, which capped a whole node at two or three
     * distinct questions per session however large its word bank was.
     */
    function sigOf(opts, answerPart) {
        const base = opts.sig || opts.stem || '';
        return base + '#' + String(answerPart);
    }

    /*
     * opts: {stem, prompt, correct, distractors, hint, explain, sig}
     *
     * `correct` and each distractor are labels. The returned item's `answer` is
     * the index of the correct label AFTER shuffling.
     */
    window.genMc = function (rng, opts) {
        const labels = [opts.correct];
        (opts.distractors || []).forEach((d) => {
            if (d === null || d === undefined) return;
            const s = String(d);
            if (s !== String(opts.correct) && labels.map(String).indexOf(s) === -1) labels.push(d);
        });
        while (labels.length < 2) labels.push('none of these');

        const order = rng.shuffle(labels.map((l, i) => ({ l: l, orig: i })));
        return {
            type: 'mc',
            stem: opts.stem,
            prompt: opts.prompt || [{ t: 'text', s: opts.stem }],
            choices: order.map((o) => o.l),
            answer: order.findIndex((o) => o.orig === 0),
            grade: 'exact',
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf(opts, opts.correct),
        };
    };

    window.genNum = function (opts) {
        return {
            type: 'numeric',
            stem: opts.stem,
            prompt: opts.prompt || [{ t: 'text', s: opts.stem }],
            answer: opts.answer,
            grade: 'numeric',
            gradeOpts: opts.tol ? { tol: opts.tol } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf(opts, opts.answer),
        };
    };

    window.genText = function (opts) {
        return {
            type: 'text',
            stem: opts.stem,
            prompt: opts.prompt || [{ t: 'text', s: opts.stem }],
            answer: opts.answer,
            grade: 'text',
            gradeOpts: opts.accept ? { accept: opts.accept } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf(opts, opts.answer),
        };
    };

    /*
     * Read it out loud.  opts: {word, accept, stem, prompt, hint, explain, sig}
     *
     * The point of this shape is that it has no options to eliminate. "Which word
     * says /ship/?" hands a child a 25% score for guessing and a much better one
     * for ruling out the three that obviously aren't it — neither of which
     * requires decoding anything. "Read this word" cannot be answered any way but
     * by reading it.
     *
     * `accept` is for transcripts a recogniser plausibly returns for a correct
     * reading — never for words that merely sound similar. Accepting *sheep* for
     * *ship* would destroy the exact contrast the node exists to measure.
     */
    window.genRead = function (opts) {
        const word = String(opts.word);
        return {
            type: 'speech',
            stem: opts.stem || 'Read this out loud.',
            prompt: opts.prompt || [{ t: 'text', s: opts.stem || 'Read this out loud.' },
                                    { t: 'expr', s: word, big: true }],
            say: word,
            answer: word,
            grade: 'spoken',
            gradeOpts: opts.accept && opts.accept.length ? { accept: opts.accept.slice() } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf({ sig: opts.sig || 'read' }, word),
        };
    };

    /*
     * Make the sound.  opts: {vowel, among, stem, hint, explain, sig, names}
     *
     * `answer` is a vowel id from audio.js, and `among` is the small set the
     * mirror draws — a drill asks "is that the a in cat or the a in day", which
     * is a decision between two or three, not among every vowel in the language.
     * Narrowing it is not a shortcut: the classifier is markedly more reliable
     * over a handful of well-separated targets, and that is also the question a
     * phonics ladder actually asks.
     */
    window.genSound = function (opts) {
        return {
            type: 'sound',
            stem: opts.stem,
            prompt: opts.prompt || [{ t: 'text', s: opts.stem }],
            among: (opts.among || []).slice(),
            answer: opts.vowel,
            grade: 'spoken',
            gradeOpts: opts.names ? { names: opts.names } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf({ sig: opts.sig || 'sound' }, opts.vowel + '|' + (opts.among || []).join(',')),
        };
    };

    /*
     * opts: {stem, prompt, right:[labels], wrong:[labels], ...}
     * Shuffled together; `answer` is the list of correct indices.
     */
    window.genMulti = function (rng, opts) {
        const right = (opts.right || []).filter((v, i, a) => a.indexOf(v) === i);
        const wrong = (opts.wrong || []).filter((v, i, a) => a.indexOf(v) === i && right.indexOf(v) === -1);
        const mixed = rng.shuffle(
            right.map((l) => ({ l: l, right: true })).concat(wrong.map((l) => ({ l: l, right: false })))
        );
        return {
            type: 'multi',
            stem: opts.stem,
            prompt: opts.prompt || [{ t: 'text', s: opts.stem }],
            choices: mixed.map((x) => x.l),
            answer: mixed.map((x, i) => (x.right ? i : -1)).filter((i) => i >= 0),
            grade: 'set',
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf(opts, mixed.map((x) => x.l).join('|')),
        };
    };

    // Tolerance defaults to a twentieth of the span: the skill is magnitude
    // estimation, not pixel accuracy.
    window.genNumberline = function (opts) {
        const span = (opts.line.hi - opts.line.lo) || 1;
        return {
            type: 'numberline',
            stem: opts.stem,
            prompt: [{ t: 'text', s: opts.stem }],
            line: opts.line,
            answer: opts.answer,
            grade: 'numeric',
            gradeOpts: { tol: opts.tol === undefined ? span / 20 : opts.tol },
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf(opts, opts.answer),
        };
    };

    window.genFraction = function (opts) {
        return {
            type: 'fraction',
            stem: opts.stem,
            prompt: opts.prompt || [{ t: 'text', s: opts.stem }],
            answer: { num: opts.num, den: opts.den },
            grade: 'fraction',
            gradeOpts: opts.lowest ? { lowest: true } : {},
            hint: opts.hint,
            explain: opts.explain,
            sig: sigOf(opts, opts.num + '/' + opts.den),
        };
    };

    // Common numeric distractors, so packs express a misconception once.
    window.genNear = function (n, spread) {
        const s = spread || 2;
        const out = [];
        for (let d = 1; d <= s; d++) { out.push(n + d); if (n - d >= 0) out.push(n - d); }
        return out;
    };
})();
