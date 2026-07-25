/* ============================================================================
 * language-arts.js — five tappable English / language-arts puzzle modes.
 *
 * DESIGN NOTE (clean merges): every line of this feature lives in this file and
 * language-arts.css. Nothing here rewrites app.js / index.html / styles.css, so
 * this branch cannot conflict with other in-flight branches. The modes plug into
 * the existing app by *adding* keys to the global `TAB_ENTRY` / `SCREEN_TAB`
 * const objects declared in app.js (top-level const → shared script scope), and
 * by injecting their own stylesheet, tab buttons, and screen <div>s at load.
 *
 * Namespacing: everything is `la*` (language arts). Per-mode sub-prefixes:
 * vocab / cap / punct / subj / diag. The whole file is wrapped in an IIFE so no
 * extra globals leak.
 * ==========================================================================*/
(function () {
    'use strict';

    /* ---- tiny utilities ---------------------------------------------------*/
    const rand = (n) => Math.floor(Math.random() * n);
    const pick = (arr) => arr[rand(arr.length)];
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = rand(i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    // Resolve a {easy:[], hard:[]} bank for the chosen difficulty tier.
    const poolFor = (bank, diff) =>
        diff === 'mixed' ? bank.easy.concat(bank.hard) : bank[diff];
    // Capitalize / lower-case just the first letter (leave the rest as authored).
    const capFirst = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    const lowerFirst = (w) => w.charAt(0).toLowerCase() + w.slice(1);
    const isCapFirst = (w) => {
        const c = w.charAt(0);
        return c !== c.toLowerCase() && c === c.toUpperCase();
    };

    /* ========================================================================
     * CONTENT BANKS
     * easy ≈ K–2, hard ≈ 3–5. "Mixed" difficulty draws from both.
     * ======================================================================*/
    const LA = {
        vocab: {
            synonym: {
                easy: [
                    { word: 'big', correct: 'large', distractors: ['tiny', 'cold', 'slow'] },
                    { word: 'happy', correct: 'glad', distractors: ['angry', 'sleepy', 'loud'] },
                    { word: 'fast', correct: 'quick', distractors: ['heavy', 'soft', 'late'] },
                    { word: 'small', correct: 'little', distractors: ['huge', 'bright', 'wide'] },
                    { word: 'cold', correct: 'chilly', distractors: ['warm', 'dry', 'sweet'] },
                    { word: 'sad', correct: 'unhappy', distractors: ['funny', 'brave', 'clean'] },
                    { word: 'pretty', correct: 'lovely', distractors: ['ugly', 'rough', 'empty'] },
                    { word: 'begin', correct: 'start', distractors: ['stop', 'close', 'lose'] },
                ],
                hard: [
                    { word: 'enormous', correct: 'gigantic', distractors: ['minor', 'gentle', 'silent'] },
                    { word: 'ancient', correct: 'old', distractors: ['modern', 'eager', 'polite'] },
                    { word: 'furious', correct: 'angry', distractors: ['cheerful', 'weary', 'timid'] },
                    { word: 'brave', correct: 'courageous', distractors: ['fearful', 'clumsy', 'greedy'] },
                    { word: 'wealthy', correct: 'rich', distractors: ['broke', 'hollow', 'plain'] },
                    { word: 'delicious', correct: 'tasty', distractors: ['bitter', 'stale', 'dull'] },
                    { word: 'exhausted', correct: 'tired', distractors: ['alert', 'joyful', 'sturdy'] },
                    { word: 'gigantic', correct: 'massive', distractors: ['petite', 'narrow', 'faint'] },
                ],
            },
            antonym: {
                easy: [
                    { word: 'hot', correct: 'cold', distractors: ['warm', 'red', 'fast'] },
                    { word: 'up', correct: 'down', distractors: ['over', 'far', 'near'] },
                    { word: 'day', correct: 'night', distractors: ['noon', 'week', 'sun'] },
                    { word: 'open', correct: 'closed', distractors: ['wide', 'clear', 'full'] },
                    { word: 'happy', correct: 'sad', distractors: ['glad', 'kind', 'nice'] },
                    { word: 'big', correct: 'small', distractors: ['tall', 'long', 'round'] },
                    { word: 'fast', correct: 'slow', distractors: ['soon', 'quick', 'busy'] },
                    { word: 'new', correct: 'old', distractors: ['clean', 'fresh', 'bright'] },
                ],
                hard: [
                    { word: 'ancient', correct: 'modern', distractors: ['aged', 'dusty', 'stone'] },
                    { word: 'generous', correct: 'stingy', distractors: ['kind', 'giving', 'rich'] },
                    { word: 'brave', correct: 'cowardly', distractors: ['bold', 'daring', 'strong'] },
                    { word: 'expand', correct: 'shrink', distractors: ['grow', 'widen', 'stretch'] },
                    { word: 'praise', correct: 'criticize', distractors: ['cheer', 'honor', 'thank'] },
                    { word: 'victory', correct: 'defeat', distractors: ['win', 'trophy', 'glory'] },
                    { word: 'ascend', correct: 'descend', distractors: ['climb', 'rise', 'soar'] },
                    { word: 'permanent', correct: 'temporary', distractors: ['lasting', 'fixed', 'stable'] },
                ],
            },
            definition: {
                easy: [
                    { word: 'puppy', correct: 'a young dog', distractors: ['a young cat', 'a small bird', 'a baby cow'] },
                    { word: 'ocean', correct: 'a very large sea', distractors: ['a small pond', 'a tall hill', 'a dry desert'] },
                    { word: 'author', correct: 'a person who writes books', distractors: ['a person who bakes', 'a person who sings', 'a person who paints'] },
                    { word: 'brave', correct: 'not afraid of danger', distractors: ['very hungry', 'feeling sleepy', 'very funny'] },
                    { word: 'gentle', correct: 'soft and kind', distractors: ['loud and mean', 'cold and wet', 'fast and hard'] },
                ],
                hard: [
                    { word: 'migrate', correct: 'to move from one place to another', distractors: ['to fall asleep', 'to build a nest', 'to eat quickly'] },
                    { word: 'fragile', correct: 'easily broken', distractors: ['very heavy', 'brightly colored', 'extremely loud'] },
                    { word: 'ancestor', correct: 'a relative who lived long ago', distractors: ['a new neighbor', 'a close friend', 'a family pet'] },
                    { word: 'evaporate', correct: 'to turn from liquid into vapor', distractors: ['to freeze solid', 'to grow larger', 'to sink down'] },
                    { word: 'reluctant', correct: 'unwilling to do something', distractors: ['eager to help', 'very tired', 'full of joy'] },
                ],
            },
            fillblank: {
                easy: [
                    { sentence: 'The bird will ___ to its nest.', correct: 'fly', distractors: ['swim', 'read', 'bake'] },
                    { sentence: 'Please ___ the door quietly.', correct: 'close', distractors: ['eat', 'sing', 'jump'] },
                    { sentence: 'We ___ apples from the tree.', correct: 'picked', distractors: ['painted', 'slept', 'drove'] },
                    { sentence: 'The sun is very ___ today.', correct: 'bright', distractors: ['quiet', 'empty', 'soft'] },
                    { sentence: 'She likes to ___ her bike to school.', correct: 'ride', distractors: ['pour', 'melt', 'sew'] },
                ],
                hard: [
                    { sentence: 'The scientist made an important ___.', correct: 'discovery', distractors: ['blanket', 'staircase', 'whisper'] },
                    { sentence: 'A drought is a long period without ___.', correct: 'rain', distractors: ['friends', 'homework', 'music'] },
                    { sentence: 'The knight showed great ___ in battle.', correct: 'courage', distractors: ['laundry', 'silence', 'furniture'] },
                    { sentence: 'They had to ___ the plan when it started to storm.', correct: 'abandon', distractors: ['celebrate', 'photograph', 'inflate'] },
                    { sentence: 'The old bridge was too ___ to cross safely.', correct: 'fragile', distractors: ['cheerful', 'delicious', 'punctual'] },
                ],
            },
        },

        // Capitalization: author the CORRECT sentence. The engine lower-cases it,
        // and the answer key is derived (any word whose first letter is a capital).
        cap: {
            easy: [
                'My dog can run fast.',
                'We went to the park on Monday.',
                'I like to play with Sam.',
                'The cat sat on my lap.',
                'Anna and I read a book.',
                'On Friday we had pizza.',
                'My friend lives in Ohio.',
                'Can Ben come to my house?',
            ],
            hard: [
                'Last summer we visited Chicago with Aunt Maria.',
                'Doctor Lee said I should drink more water.',
                'The Mississippi River is very long.',
                'On Thanksgiving, Grandma made a huge dinner.',
                'My favorite book is Charlotte\'s Web.',
                'We drove through Texas and New Mexico.',
                'President Lincoln gave a famous speech.',
                'In December, snow fell all over Denver.',
            ],
        },

        punct: {
            // End marks: sentence WITHOUT terminal punctuation + the right mark.
            end: {
                easy: [
                    { s: 'The dog is brown', correct: '.' },
                    { s: 'Are you my friend', correct: '?' },
                    { s: 'Watch out for the ball', correct: '!' },
                    { s: 'I like ice cream', correct: '.' },
                    { s: 'What is your name', correct: '?' },
                    { s: 'We won the game', correct: '!' },
                ],
                hard: [
                    { s: 'How many planets are in our solar system', correct: '?' },
                    { s: 'The library closes at six o\'clock', correct: '.' },
                    { s: 'That was the best surprise ever', correct: '!' },
                    { s: 'Do you know where the museum is', correct: '?' },
                    { s: 'Please remember to feed the fish', correct: '.' },
                    { s: 'Look out, the volcano is erupting', correct: '!' },
                ],
            },
            // Comma: author WITH commas; engine strips them and asks the learner to
            // tap the gaps where a comma belongs.
            comma: {
                easy: [
                    'I bought apples, pears, and grapes.',
                    'We have red, blue, and green paint.',
                    'She likes cats, dogs, and fish.',
                    'Yes, I will help you.',
                    'Sam, please close the door.',
                ],
                hard: [
                    'On Monday, we will visit the aquarium, the zoo, and the park.',
                    'After the storm, the sun came out, and the birds sang.',
                    'My aunt, who lives in Maine, is coming to visit.',
                    'We need flour, sugar, eggs, and butter for the cake.',
                    'Well, I think we should leave now.',
                ],
            },
            // Apostrophe: contraction / possessive multiple choice.
            apos: {
                easy: [
                    { prompt: '___ raining outside.', correct: "It's", distractors: ['Its'] },
                    { prompt: "That is the ___ bone.", correct: "dog's", distractors: ['dogs'] },
                    { prompt: '___ my turn now.', correct: "It's", distractors: ['Its'] },
                    { prompt: "I ___ know the answer.", correct: "don't", distractors: ['dont'] },
                    { prompt: "This is ___ book.", correct: "Anna's", distractors: ['Annas'] },
                ],
                hard: [
                    { prompt: 'The dog wagged ___ tail.', correct: 'its', distractors: ["it's"] },
                    { prompt: 'All the ___ desks were clean.', correct: "students'", distractors: ["student's", 'students'] },
                    { prompt: "They ___ going to the fair.", correct: "they're", distractors: ['their', 'there'] },
                    { prompt: 'We left ___ coats at home.', correct: 'our', distractors: ['are', 'hour'] },
                    { prompt: "The ___ toys were everywhere.", correct: "children's", distractors: ["childrens'", 'childrens'] },
                ],
            },
        },

        // Subject & verb: 0-based word indices into the space-split sentence.
        subj: {
            easy: [
                { s: 'The dog barks loudly.', subject: 1, verb: 2 },
                { s: 'My sister sings well.', subject: 1, verb: 2 },
                { s: 'The red ball rolled away.', subject: 2, verb: 3 },
                { s: 'Birds fly south in winter.', subject: 0, verb: 1 },
                { s: 'The baby laughed happily.', subject: 1, verb: 2 },
                { s: 'A big truck honked twice.', subject: 2, verb: 3 },
            ],
            hard: [
                { s: 'The curious kitten climbed the tall tree.', subject: 2, verb: 3 },
                { s: 'Our whole class visited the science museum.', subject: 2, verb: 3 },
                { s: 'The old wooden bridge creaked in the wind.', subject: 3, verb: 4 },
                { s: 'Several excited fans cheered for the team.', subject: 2, verb: 3 },
                { s: 'The bright morning sun melted the frost.', subject: 3, verb: 4 },
                { s: 'A flock of geese landed on the pond.', subject: 1, verb: 4 },
            ],
        },

        // Diagramming: simple Reed-Kellogg patterns. subjMod / objMod are optional
        // single modifiers (article or adjective) that hang under their word.
        diag: {
            easy: [
                { subject: 'Dogs', verb: 'bark' },
                { subject: 'Birds', verb: 'sing' },
                { subject: 'dog', verb: 'chased', object: 'cat', subjMod: 'The', objMod: 'the' },
                { subject: 'cat', verb: 'drinks', object: 'milk', subjMod: 'The' },
                { subject: 'boy', verb: 'kicked', object: 'ball', subjMod: 'A', objMod: 'the' },
            ],
            hard: [
                { subject: 'farmer', verb: 'grows', object: 'corn', subjMod: 'The', objMod: 'sweet' },
                { subject: 'children', verb: 'built', object: 'castle', subjMod: 'The', objMod: 'sandy' },
                { subject: 'wind', verb: 'shook', object: 'trees', subjMod: 'cold', objMod: 'tall' },
                { subject: 'artist', verb: 'painted', object: 'mural', subjMod: 'young', objMod: 'bright' },
                { subject: 'engine', verb: 'pulled', object: 'cars', subjMod: 'red', objMod: 'heavy' },
            ],
        },
    };

    /* ========================================================================
     * SHARED FEEDBACK + SCORE
     * ======================================================================*/
    function setFeedback(el, kind, text) {
        el.textContent = text;
        el.className = 'feedback-display' +
            (kind === 'correct' ? ' la-fb-correct' : kind === 'wrong' ? ' la-fb-wrong' : '');
    }
    function bumpScore(state, scoreEl) {
        state.score++;
        scoreEl.textContent = 'Score: ' + state.score;
    }

    /* Difficulty toggle group wiring. Each mode has a `.tt-btn-group` with
     * `.la-diff-btn[data-la-diff]`. */
    function wireDiff(groupId, state, onChange) {
        document.getElementById(groupId).addEventListener('click', (e) => {
            const btn = e.target.closest('.la-diff-btn');
            if (!btn) return;
            state.diff = btn.dataset.laDiff;
            document.querySelectorAll('#' + groupId + ' .la-diff-btn').forEach((b) =>
                b.classList.toggle('active', b.dataset.laDiff === state.diff));
            onChange();
        });
    }
    function wireSub(groupId, cls, attr, onPick) {
        document.getElementById(groupId).addEventListener('click', (e) => {
            const btn = e.target.closest('.' + cls);
            if (!btn) return;
            document.querySelectorAll('#' + groupId + ' .' + cls).forEach((b) =>
                b.classList.toggle('active', b === btn));
            onPick(btn.dataset[attr]);
        });
    }

    /* 4-choice engine: renders buttons for a {choices, correct} item and handles
     * lock / feedback / advance. `correct` is the index of the right choice. */
    function renderChoices(choicesEl, feedbackEl, item, state, scoreEl, next) {
        choicesEl.innerHTML = '';
        setFeedback(feedbackEl, '', '');
        let locked = false;
        item.choices.forEach((c, i) => {
            const b = document.createElement('button');
            b.className = 'btn btn-secondary la-choice';
            b.textContent = c;
            b.addEventListener('click', () => {
                if (locked) return;
                locked = true;
                if (i === item.correct) {
                    b.classList.add('la-correct');
                    setFeedback(feedbackEl, 'correct', '✓');
                    bumpScore(state, scoreEl);
                    setTimeout(next, 700);
                } else {
                    b.classList.add('la-wrong');
                    choicesEl.children[item.correct].classList.add('la-correct');
                    setFeedback(feedbackEl, 'wrong', '✗');
                    setTimeout(next, 1400);
                }
            });
            choicesEl.appendChild(b);
        });
    }
    // Build a {choices, correct} from a curated {correct, distractors} item.
    function buildChoices(correct, distractors, n) {
        n = n || 4;
        const opts = shuffle(distractors).slice(0, n - 1);
        opts.push(correct);
        const choices = shuffle(opts);
        return { choices, correct: choices.indexOf(correct) };
    }

    /* Tap-in-sentence engine: render word/gap tokens into a host element.
     * tokens: [{text, kind, idx}], onTap(idx). */
    function renderTokens(host, tokens, onTap) {
        host.innerHTML = '';
        tokens.forEach((t) => {
            const span = document.createElement('span');
            span.className = 'la-token la-token-' + t.kind;
            span.dataset.idx = t.idx;
            span.textContent = t.text;
            if (t.kind !== 'static') span.addEventListener('click', () => onTap(t.idx, span));
            host.appendChild(span);
        });
    }

    /* ========================================================================
     * MODE 1 — VOCABULARY  (screen id: la-vocab)
     * ======================================================================*/
    const vocab = { diff: 'easy', sub: 'synonym', score: 0 };
    function vocabInit() {
        vocab.score = 0;
        document.getElementById('la-vocab-score').textContent = 'Score: 0';
        vocabRound();
    }
    function vocabRound() {
        const promptEl = document.getElementById('la-vocab-prompt');
        const choicesEl = document.getElementById('la-vocab-choices');
        const fbEl = document.getElementById('la-vocab-feedback');
        const scoreEl = document.getElementById('la-vocab-score');
        const item = pick(poolFor(LA.vocab[vocab.sub], vocab.diff));
        let promptHTML;
        if (vocab.sub === 'synonym') promptHTML = 'Which word means the <b>same</b> as<br><span class="la-cue">' + item.word + '</span>?';
        else if (vocab.sub === 'antonym') promptHTML = 'Which word means the <b>opposite</b> of<br><span class="la-cue">' + item.word + '</span>?';
        else if (vocab.sub === 'definition') promptHTML = 'What does <span class="la-cue">' + item.word + '</span> mean?';
        else promptHTML = 'Which word fits the blank?<br><span class="la-cue">' + item.sentence + '</span>';
        promptEl.innerHTML = promptHTML;
        const built = buildChoices(item.correct, item.distractors);
        renderChoices(choicesEl, fbEl, built, vocab, scoreEl, vocabRound);
    }

    /* ========================================================================
     * MODE 2 — CAPITALIZATION  (screen id: la-cap)
     * Tap the words that should be capitalized, then Check.
     * ======================================================================*/
    const cap = { diff: 'easy', score: 0, words: [], key: [], state: [], locked: false };
    function capInit() {
        cap.score = 0;
        document.getElementById('la-cap-score').textContent = 'Score: 0';
        capRound();
    }
    function capRound() {
        cap.locked = false;
        const canonical = pick(poolFor(LA.cap, cap.diff)).split(' ');
        cap.words = canonical.map(lowerFirst);          // what we show (lower-cased)
        cap.key = canonical.map(isCapFirst);            // which SHOULD be capital
        cap.state = canonical.map(() => false);         // learner's current choice
        setFeedback(document.getElementById('la-cap-feedback'), '', '');
        capRender();
    }
    function capRender() {
        const host = document.getElementById('la-cap-sentence');
        host.innerHTML = '';
        cap.words.forEach((w, i) => {
            const span = document.createElement('span');
            span.className = 'la-token la-token-word' + (cap.state[i] ? ' la-token-on' : '');
            span.textContent = cap.state[i] ? capFirst(w) : w;
            span.addEventListener('click', () => {
                if (cap.locked) return;
                cap.state[i] = !cap.state[i];
                capRender();
            });
            host.appendChild(span);
        });
    }
    function capCheck() {
        if (cap.locked) return;
        const fb = document.getElementById('la-cap-feedback');
        const ok = cap.state.every((v, i) => v === cap.key[i]);
        if (ok) {
            cap.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(cap, document.getElementById('la-cap-score'));
            setTimeout(capRound, 900);
        } else {
            setFeedback(fb, 'wrong', '✗ Not quite — try again.');
        }
    }

    /* ========================================================================
     * MODE 3 — PUNCTUATION  (screen id: la-punct)
     * Sub-modes: end marks (choice) / comma (tap gaps) / apostrophe (choice).
     * ======================================================================*/
    const punct = { diff: 'easy', sub: 'end', score: 0, gapKey: [], gapState: [], locked: false };
    function punctInit() {
        punct.score = 0;
        document.getElementById('la-punct-score').textContent = 'Score: 0';
        punctShowPanels();
        punctRound();
    }
    function punctShowPanels() {
        document.getElementById('la-punct-choice-panel').classList.toggle('hidden', punct.sub === 'comma');
        document.getElementById('la-punct-comma-panel').classList.toggle('hidden', punct.sub !== 'comma');
    }
    function punctRound() {
        setFeedback(document.getElementById('la-punct-feedback'), '', '');
        if (punct.sub === 'comma') return punctCommaRound();
        return punctChoiceRound();
    }
    function punctChoiceRound() {
        const promptEl = document.getElementById('la-punct-prompt');
        const choicesEl = document.getElementById('la-punct-choices');
        const fbEl = document.getElementById('la-punct-feedback');
        const scoreEl = document.getElementById('la-punct-score');
        if (punct.sub === 'end') {
            const item = pick(poolFor(LA.punct.end, punct.diff));
            promptEl.innerHTML = 'Which end mark belongs here?<br><span class="la-cue">' + item.s + ' __</span>';
            const marks = ['.', '?', '!'];
            const built = { choices: marks, correct: marks.indexOf(item.correct) };
            renderChoices(choicesEl, fbEl, built, punct, scoreEl, punctRound);
        } else { // apostrophe
            const item = pick(poolFor(LA.punct.apos, punct.diff));
            promptEl.innerHTML = 'Choose the correct word.<br><span class="la-cue">' + item.prompt + '</span>';
            const built = buildChoices(item.correct, item.distractors, Math.min(4, item.distractors.length + 1));
            renderChoices(choicesEl, fbEl, built, punct, scoreEl, punctRound);
        }
    }
    function punctCommaRound() {
        punct.locked = false;
        const canonical = pick(poolFor(LA.punct.comma, punct.diff));
        // Split into words; a comma in the source attaches to the preceding word.
        const raw = canonical.replace(/\.$/, '').split(' ');
        const words = [];
        const commaAfter = [];
        raw.forEach((tok) => {
            const hasComma = tok.endsWith(',');
            words.push(hasComma ? tok.slice(0, -1) : tok);
            commaAfter.push(hasComma);
        });
        // Gaps sit between adjacent words: gap i is after word i (0..words.length-2).
        punct.gapKey = commaAfter.slice(0, words.length - 1);
        punct.gapState = punct.gapKey.map(() => false);
        punct.commaWords = words;
        setFeedback(document.getElementById('la-punct-feedback'), '', '');
        punctCommaRender();
    }
    function punctCommaRender() {
        const host = document.getElementById('la-punct-sentence');
        host.innerHTML = '';
        punct.commaWords.forEach((w, i) => {
            const word = document.createElement('span');
            word.className = 'la-token la-token-static';
            word.textContent = w;
            host.appendChild(word);
            if (i < punct.commaWords.length - 1) {
                const gap = document.createElement('span');
                gap.className = 'la-gap' + (punct.gapState[i] ? ' la-gap-on' : '');
                gap.textContent = punct.gapState[i] ? ',' : '·';
                gap.title = 'Tap to add or remove a comma';
                gap.addEventListener('click', () => {
                    if (punct.locked) return;
                    punct.gapState[i] = !punct.gapState[i];
                    punctCommaRender();
                });
                host.appendChild(gap);
            }
        });
    }
    function punctCommaCheck() {
        if (punct.locked) return;
        const fb = document.getElementById('la-punct-feedback');
        const ok = punct.gapState.every((v, i) => v === punct.gapKey[i]);
        if (ok) {
            punct.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(punct, document.getElementById('la-punct-score'));
            setTimeout(punctRound, 900);
        } else {
            setFeedback(fb, 'wrong', '✗ Not quite — try again.');
        }
    }

    /* ========================================================================
     * MODE 4 — SUBJECT & VERB  (screen id: la-subj)
     * Tap the subject (underlined once), then the verb (underlined twice).
     * ======================================================================*/
    const subj = { diff: 'easy', score: 0, item: null, phase: 'subject', picked: {}, locked: false };
    function subjInit() {
        subj.score = 0;
        document.getElementById('la-subj-score').textContent = 'Score: 0';
        subjRound();
    }
    function subjRound() {
        subj.item = pick(poolFor(LA.subj, subj.diff));
        subj.phase = 'subject';
        subj.picked = {};
        subj.locked = false;
        setFeedback(document.getElementById('la-subj-feedback'), '', '');
        subjSetPrompt();
        subjRender();
    }
    function subjSetPrompt() {
        const p = document.getElementById('la-subj-prompt');
        if (subj.phase === 'subject') p.innerHTML = 'Tap the <b>subject</b> <span class="la-hint">(underline once)</span>';
        else p.innerHTML = 'Tap the <b>verb</b> <span class="la-hint">(underline twice)</span>';
    }
    function subjRender() {
        const host = document.getElementById('la-subj-sentence');
        host.innerHTML = '';
        subj.item.s.split(' ').forEach((w, i) => {
            const span = document.createElement('span');
            let cls = 'la-token la-token-word';
            if (subj.picked.subject === i) cls += ' la-underline-once';
            if (subj.picked.verb === i) cls += ' la-underline-twice';
            span.className = cls;
            span.textContent = w;
            span.addEventListener('click', () => subjTap(i));
            host.appendChild(span);
        });
    }
    function subjTap(i) {
        if (subj.locked) return;
        if (subj.phase === 'subject') {
            subj.picked.subject = i;
            subj.phase = 'verb';
            subjSetPrompt();
            subjRender();
        } else {
            if (i === subj.picked.subject) return; // can't be both
            subj.picked.verb = i;
            subjRender();
            subjCheck();
        }
    }
    function subjCheck() {
        subj.locked = true;
        const fb = document.getElementById('la-subj-feedback');
        const ok = subj.picked.subject === subj.item.subject && subj.picked.verb === subj.item.verb;
        if (ok) {
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(subj, document.getElementById('la-subj-score'));
            setTimeout(subjRound, 1000);
        } else {
            // Reveal the correct answer briefly, then re-ask.
            const host = document.getElementById('la-subj-sentence');
            host.querySelectorAll('.la-token').forEach((el, i) => {
                el.classList.remove('la-underline-once', 'la-underline-twice');
                if (i === subj.item.subject) el.classList.add('la-underline-once');
                if (i === subj.item.verb) el.classList.add('la-underline-twice');
            });
            setFeedback(fb, 'wrong', '✗ The answer is shown — here comes another.');
            setTimeout(subjRound, 1800);
        }
    }

    /* ========================================================================
     * MODE 5 — SENTENCE DIAGRAMMING  (screen id: la-diag)
     * Pointer-drag word chips onto a Reed-Kellogg skeleton. Touch-safe (no HTML5
     * drag-and-drop, which doesn't fire on touch devices).
     * ======================================================================*/
    const STAGE_W = 560, STAGE_H = 230, BASE_Y = 95;
    const diag = { diff: 'easy', score: 0, item: null, slots: [], assign: {}, locked: false, drag: null };

    function diagInit() {
        diag.score = 0;
        diag.chips = null; // fresh chip set on (re)entry
        document.getElementById('la-diag-score').textContent = 'Score: 0';
        diagRound();
    }
    function diagLayout(item) {
        // Returns {slots, lines} in stage coordinates.
        const hasObj = !!item.object;
        const slots = [];
        slots.push({ id: 'subject', cx: 100, cy: BASE_Y - 18, expect: item.subject, label: 'subject' });
        slots.push({ id: 'verb', cx: 290, cy: BASE_Y - 18, expect: item.verb, label: 'verb' });
        if (hasObj) slots.push({ id: 'object', cx: 470, cy: BASE_Y - 18, expect: item.object, label: 'object' });
        if (item.subjMod) slots.push({ id: 'subjMod', cx: 95, cy: BASE_Y + 55, expect: item.subjMod, label: 'modifier' });
        if (item.objMod) slots.push({ id: 'objMod', cx: 465, cy: BASE_Y + 55, expect: item.objMod, label: 'modifier' });
        const lines = [];
        const rightEnd = hasObj ? 545 : 385;
        lines.push(`<line x1="20" y1="${BASE_Y}" x2="${rightEnd}" y2="${BASE_Y}" class="la-diag-line"/>`);        // baseline
        lines.push(`<line x1="195" y1="${BASE_Y - 32}" x2="195" y2="${BASE_Y + 22}" class="la-diag-line"/>`);      // subj|verb divider (crosses)
        if (hasObj) lines.push(`<line x1="385" y1="${BASE_Y - 26}" x2="385" y2="${BASE_Y}" class="la-diag-line"/>`); // verb|obj divider (sits on line)
        if (item.subjMod) lines.push(`<line x1="70" y1="${BASE_Y + 2}" x2="120" y2="${BASE_Y + 80}" class="la-diag-line la-diag-slant"/>`);
        if (item.objMod) lines.push(`<line x1="440" y1="${BASE_Y + 2}" x2="490" y2="${BASE_Y + 80}" class="la-diag-line la-diag-slant"/>`);
        return { slots, lines };
    }
    function diagRound() {
        diag.locked = false;
        diag.assign = {};
        diag.item = pick(poolFor(LA.diag, diag.diff));
        const layout = diagLayout(diag.item);
        diag.slots = layout.slots;
        setFeedback(document.getElementById('la-diag-feedback'), '', '');

        const stage = document.getElementById('la-diag-stage');
        stage.innerHTML =
            `<svg viewBox="0 0 ${STAGE_W} ${STAGE_H}" class="la-diag-svg" preserveAspectRatio="xMidYMid meet">${layout.lines.join('')}` +
            layout.slots.map((s) =>
                `<text x="${s.cx}" y="${s.cy + 34}" class="la-diag-slotlabel">${s.label}</text>`).join('') +
            `</svg>`;
        // Overlay HTML drop-slots positioned as % of the stage box.
        layout.slots.forEach((s) => {
            const el = document.createElement('div');
            el.className = 'la-diag-slot';
            el.dataset.slot = s.id;
            el.style.left = (s.cx / STAGE_W * 100) + '%';
            el.style.top = (s.cy / STAGE_H * 100) + '%';
            stage.appendChild(el);
        });
        diagRenderChips();
    }
    function diagRenderChips() {
        const stage = document.getElementById('la-diag-stage');
        // Remove existing chips.
        stage.querySelectorAll('.la-diag-chip').forEach((c) => c.remove());
        // Clear slot fills.
        stage.querySelectorAll('.la-diag-slot').forEach((s) => s.classList.remove('la-slot-filled'));
        const tray = document.getElementById('la-diag-tray');
        tray.innerHTML = '';

        // Build the full word list once (stable order per round) with unique ids.
        if (!diag.chips) {
            const words = diag.slots.map((s) => s.expect);
            diag.chips = shuffle(words).map((w, i) => ({ id: 'c' + i, word: w }));
        }
        diag.chips.forEach((chip) => {
            const el = document.createElement('div');
            el.className = 'la-diag-chip';
            el.textContent = chip.word;
            el.dataset.chip = chip.id;
            attachDrag(el, chip);
            const slotId = Object.keys(diag.assign).find((k) => diag.assign[k] === chip.id);
            if (slotId) {
                const slotEl = stage.querySelector('.la-diag-slot[data-slot="' + slotId + '"]');
                slotEl.classList.add('la-slot-filled');
                el.classList.add('la-diag-chip-placed');
                // Position the chip over its slot (absolute within the stage).
                el.style.left = slotEl.style.left;
                el.style.top = slotEl.style.top;
                stage.appendChild(el);
            } else {
                tray.appendChild(el);
            }
        });
    }
    function attachDrag(el, chip) {
        el.addEventListener('pointerdown', (e) => {
            if (diag.locked) return;
            e.preventDefault();
            const stage = document.getElementById('la-diag-stage');
            const ghost = el.cloneNode(true);
            ghost.classList.add('la-diag-ghost');
            document.body.appendChild(ghost);
            el.classList.add('la-diag-dragging');
            const move = (ev) => {
                ghost.style.left = ev.clientX + 'px';
                ghost.style.top = ev.clientY + 'px';
            };
            const up = (ev) => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', up);
                ghost.remove();
                el.classList.remove('la-diag-dragging');
                // Hit-test slots.
                let target = null;
                stage.querySelectorAll('.la-diag-slot').forEach((slotEl) => {
                    const r = slotEl.getBoundingClientRect();
                    if (ev.clientX >= r.left && ev.clientX <= r.right &&
                        ev.clientY >= r.top && ev.clientY <= r.bottom) target = slotEl.dataset.slot;
                });
                // Remove this chip from any slot it currently occupies.
                Object.keys(diag.assign).forEach((k) => { if (diag.assign[k] === chip.id) delete diag.assign[k]; });
                if (target) {
                    // If the target slot already holds a different chip, bump it back to tray.
                    if (diag.assign[target]) delete diag.assign[target];
                    diag.assign[target] = chip.id;
                }
                diagRenderChips();
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
            move(e);
        });
    }
    function diagCheck() {
        if (diag.locked) return;
        const fb = document.getElementById('la-diag-feedback');
        // Every slot must hold a chip whose word matches the slot's expected word.
        const allFilled = diag.slots.every((s) => diag.assign[s.id]);
        if (!allFilled) {
            setFeedback(fb, 'wrong', 'Fill every slot first.');
            return;
        }
        const ok = diag.slots.every((s) => {
            const chip = diag.chips.find((c) => c.id === diag.assign[s.id]);
            return chip && chip.word === s.expect;
        });
        if (ok) {
            diag.locked = true;
            setFeedback(fb, 'correct', '✓ Correct!');
            bumpScore(diag, document.getElementById('la-diag-score'));
            diag.chips = null;
            setTimeout(diagRound, 1100);
        } else {
            setFeedback(fb, 'wrong', '✗ Some words are in the wrong place.');
        }
    }
    function diagReset() {
        if (diag.locked) return;
        diag.assign = {};
        diagRenderChips();
        setFeedback(document.getElementById('la-diag-feedback'), '', '');
    }

    /* ========================================================================
     * SCREEN HTML (injected — keeps index.html untouched beyond one <script>)
     * ======================================================================*/
    function diffGroup(mode) {
        return '<div class="tt-btn-group la-diff-group" id="la-' + mode + '-diff">' +
            '<button class="btn btn-secondary la-diff-btn active" data-la-diff="easy">Easy</button>' +
            '<button class="btn btn-secondary la-diff-btn" data-la-diff="hard">Hard</button>' +
            '<button class="btn btn-secondary la-diff-btn" data-la-diff="mixed">Mixed</button>' +
            '</div>';
    }
    function scoreBar(mode) {
        return '<div class="la-score-bar"><span id="la-' + mode + '-score" class="la-score">Score: 0</span></div>';
    }

    const SCREENS = {
        'la-vocab': `
            <div class="container la-container">
                <div class="la-config">
                    <div class="tt-btn-group la-sub-group" id="la-vocab-sub">
                        <button class="btn btn-secondary la-vocab-sub-btn active" data-sub="synonym">Synonym</button>
                        <button class="btn btn-secondary la-vocab-sub-btn" data-sub="antonym">Antonym</button>
                        <button class="btn btn-secondary la-vocab-sub-btn" data-sub="definition">Meaning</button>
                        <button class="btn btn-secondary la-vocab-sub-btn" data-sub="fillblank">Fill Blank</button>
                    </div>
                    ${diffGroup('vocab')}
                </div>
                ${scoreBar('vocab')}
                <div id="la-vocab-prompt" class="la-prompt"></div>
                <div id="la-vocab-choices" class="la-choices"></div>
                <div id="la-vocab-feedback" class="feedback-display"></div>
            </div>`,
        'la-cap': `
            <div class="container la-container">
                <div class="la-config">${diffGroup('cap')}</div>
                ${scoreBar('cap')}
                <div class="la-prompt">Tap every word that should start with a <b>capital</b> letter.</div>
                <div id="la-cap-sentence" class="la-sentence"></div>
                <button id="la-cap-check" class="btn btn-primary la-check-btn">Check</button>
                <div id="la-cap-feedback" class="feedback-display"></div>
            </div>`,
        'la-punct': `
            <div class="container la-container">
                <div class="la-config">
                    <div class="tt-btn-group la-sub-group" id="la-punct-sub">
                        <button class="btn btn-secondary la-punct-sub-btn active" data-sub="end">End Marks</button>
                        <button class="btn btn-secondary la-punct-sub-btn" data-sub="comma">Commas</button>
                        <button class="btn btn-secondary la-punct-sub-btn" data-sub="apos">Apostrophes</button>
                    </div>
                    ${diffGroup('punct')}
                </div>
                ${scoreBar('punct')}
                <div id="la-punct-choice-panel">
                    <div id="la-punct-prompt" class="la-prompt"></div>
                    <div id="la-punct-choices" class="la-choices"></div>
                </div>
                <div id="la-punct-comma-panel" class="hidden">
                    <div class="la-prompt">Tap each <b>·</b> where a comma belongs.</div>
                    <div id="la-punct-sentence" class="la-sentence"></div>
                    <button id="la-punct-check" class="btn btn-primary la-check-btn">Check</button>
                </div>
                <div id="la-punct-feedback" class="feedback-display"></div>
            </div>`,
        'la-subj': `
            <div class="container la-container">
                <div class="la-config">${diffGroup('subj')}</div>
                ${scoreBar('subj')}
                <div id="la-subj-prompt" class="la-prompt"></div>
                <div id="la-subj-sentence" class="la-sentence la-sentence-lg"></div>
                <div id="la-subj-feedback" class="feedback-display"></div>
            </div>`,
        'la-diag': `
            <div class="container la-container la-diag-wide">
                <div class="la-config">${diffGroup('diag')}</div>
                ${scoreBar('diag')}
                <div class="la-prompt">Drag each word onto the diagram.</div>
                <div id="la-diag-stage" class="la-diag-stage"></div>
                <div id="la-diag-tray" class="la-diag-tray"></div>
                <div class="la-diag-buttons">
                    <button id="la-diag-reset" class="btn btn-secondary la-check-btn">Reset</button>
                    <button id="la-diag-check" class="btn btn-primary la-check-btn">Check</button>
                </div>
                <div id="la-diag-feedback" class="feedback-display"></div>
            </div>`,
    };

    const TAB_BUTTONS = [
        ['la-vocab', 'Vocabulary'],
        ['la-cap', 'Capitals'],
        ['la-punct', 'Punctuation'],
        ['la-subj', 'Subject/Verb'],
        ['la-diag', 'Diagramming'],
    ];

    /* ========================================================================
     * BOOTSTRAP — inject stylesheet, screens, tabs; register; wire events.
     * ======================================================================*/
    function injectStylesheet() {
        if (document.querySelector('link[data-la-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'language-arts.css?v=1';
        link.dataset.laCss = '1';
        document.head.appendChild(link);
    }
    function injectScreens() {
        const anchor = document.getElementById('sprite-layer'); // screens are body-level
        Object.keys(SCREENS).forEach((name) => {
            const div = document.createElement('div');
            div.id = name + '-screen';
            div.className = 'screen';
            div.innerHTML = SCREENS[name];
            if (anchor) document.body.insertBefore(div, anchor);
            else document.body.appendChild(div);
        });
    }
    function injectTabs() {
        const bar = document.getElementById('tab-bar');
        if (!bar) return;
        TAB_BUTTONS.forEach(([tab, label]) => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.dataset.tab = tab;
            btn.textContent = label;
            bar.appendChild(btn);
        });
    }
    function register() {
        // TAB_ENTRY / SCREEN_TAB are top-level consts in app.js's shared scope.
        TAB_ENTRY['la-vocab'] = () => { showScreen('la-vocab'); vocabInit(); };
        TAB_ENTRY['la-cap'] = () => { showScreen('la-cap'); capInit(); };
        TAB_ENTRY['la-punct'] = () => { showScreen('la-punct'); punctInit(); };
        TAB_ENTRY['la-subj'] = () => { showScreen('la-subj'); subjInit(); };
        TAB_ENTRY['la-diag'] = () => { showScreen('la-diag'); diagInit(); };
        ['la-vocab', 'la-cap', 'la-punct', 'la-subj', 'la-diag'].forEach((n) => { SCREEN_TAB[n] = n; });
    }

    function wireEvents() {
        // Vocabulary
        wireSub('la-vocab-sub', 'la-vocab-sub-btn', 'sub', (s) => { vocab.sub = s; vocabRound(); });
        wireDiff('la-vocab-diff', vocab, vocabRound);
        // Capitalization
        wireDiff('la-cap-diff', cap, capRound);
        document.getElementById('la-cap-check').addEventListener('click', capCheck);
        // Punctuation
        wireSub('la-punct-sub', 'la-punct-sub-btn', 'sub', (s) => { punct.sub = s; punctShowPanels(); punctRound(); });
        wireDiff('la-punct-diff', punct, punctRound);
        document.getElementById('la-punct-check').addEventListener('click', punctCommaCheck);
        // Subject / verb
        wireDiff('la-subj-diff', subj, subjRound);
        // Diagramming
        wireDiff('la-diag-diff', diag, () => { diag.chips = null; diagRound(); });
        document.getElementById('la-diag-check').addEventListener('click', diagCheck);
        document.getElementById('la-diag-reset').addEventListener('click', diagReset);
    }

    function boot() {
        // Guard: only run if the host app's dispatch tables exist.
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreens();
        injectTabs();
        register();
        wireEvents();
    }

    // Script is loaded at end of <body> after app.js, so the DOM + app globals
    // are ready; run immediately, but fall back to DOMContentLoaded just in case.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
