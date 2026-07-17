// Math Flash Cards

// ============================================
// STATE
// ============================================

const state = {
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    startTime: null,
    timerInterval: null,
    operations: ['addition'],
    maxNumber: 10,
    shuffle: true,
    animations: true,
    showTranscript: true,
    progressBar: true,
    bestTimePacer: null,
    recognition: null,
    isListening: false,
    speechSupported: false,
    quizActive: false,
    wsDifficulty:    'letters_easy',
    wsType:          'letters',
    wsWords:         [],
    wsStartTime:     null,
    wsTimerInterval: null,
    wsDragState:     null,
    visualizerAnimator: null,
    visualizerDropped: false,
    vizPhase: 'idle',
    tgMode:          null,
    tgOpts:          {},
    tgRounds:        [],
    tgIndex:         0,
    tgCorrect:       0,
    tgStartTime:     null,
    tgTimerInterval: null,
    tgActive:        false,
};

// ============================================
// STORAGE
// ============================================

function getBestTimeKey(ops, max) {
    return `bestTime_${[...ops].sort().join(',')}_${max}`;
}

function loadBestTime(ops, max) {
    const stored = localStorage.getItem(getBestTimeKey(ops, max));
    return stored ? parseInt(stored, 10) : null;
}

function saveBestTime(seconds) {
    localStorage.setItem(getBestTimeKey(state.operations, state.maxNumber), seconds.toString());
}

// ============================================
// WORD SORT DATA
// ============================================

const WS_WORDS_BASIC = [
    'acorn','angel','apple','arrow',
    'badge','beach','beast','bench','bird','black','bloom','brave','brush','burst',
    'cabin','candy','chart','chest','child','cloak','cloud','coast','coral','crash','creek','crisp',
    'daisy','dance',
    'flock','flute','frost',
    'globe','goose','grace','groan','grove','growl',
    'hedge','herbs','hover',
    'jewel','juice',
    'label','lance','laugh','layer','leash','light','linen',
    'march','mayor','mercy','model','money','month','mouse','mouth','muddy',
    'nerve','night','noble','nurse',
    'ocean','olive',
    'paint','panic','paper','patch','peace','peach','pearl','penny','phone','photo',
    'quest','quick','quiet',
    'ranch','range','raven','reach','realm','rebel',
    'sauce','scout','serve','shade','shake','shape','shark','shell','shift','shore',
    'teach','teeth','theme','thick','thorn','throw','tiger','title','torch','trout',
    'vapor','vault','verse',
    'watch','water','wedge','whale','wheel','witch',
];

const WS_WORDS_INTERMEDIATE = [
    'abandon','acclaim','achieve','advance','attract',
    'balance','blanket','blossom','bounty','branch',
    'cabinet','captain','carbon','castle','circuit','climate','cluster','commit',
    'compare','compete','complex','concern','confuse','control','council','create',
    'damage','danger','debate','define','design','divide','dragon',
    'effect','effort','employ','engage','entire','escape','evolve','extend',
    'factor','famine','feature','filter','forbid','forest','fossil','frozen',
    'gather','gentle','global','govern','gravel','grieve','growth',
    'handle','happen','harbor','harvest','hidden','hollow','hunger','hurdle',
    'ignore','impact','import','inform','injure','insect','invent','island',
    'jungle','justify','kernel','kingdom',
    'launch','leader','lessen','liquid','locate','logical','lonely',
    'manage','market','mature','meadow','mention','method','mirror','mobile',
    'modest','monster','motion','muscle',
    'nation','nature','needle','notice',
    'object','option','origin','output',
    'palace','parent','parrot','pattern','planet','plastic','pocket','possess',
    'powder','problem','profit','proper',
    'random','reason','refuse','region','release','remote','repair','result',
    'reveal','reward','riddle','rotate',
    'sample','select','series','settle','shadow','signal','simple','sketch',
    'social','soldier','special','sphere','stable','statue','strict','student',
    'symbol','talent','target','temple','theory','timber','tissue','travel',
    'trophy','tunnel','unique','valley','vanish','vessel','village','vision',
    'volume','voyage','wander','wealth','weapon','welcome','wisdom','wonder',
];

const WS_WORDS_ADVANCED = [
    // SPR — spread/spree need 5th; sprig/spring need 5th
    ['spray',  'spread', 'spree',   'sprig',   'spring',  'sprout'],
    // STR — all share "stra" except streak; within "stra" every 5th letter differs
    ['strain', 'strand', 'strap',   'straw',   'stray',   'streak'],
    // SCR — scram/scrap need 5th; scrape/scratch need 5th
    ['scram',  'scrap',  'scrape',  'scratch', 'scrawl',  'screen'],
    // TRA — trail/train share "trai", need 5th letter (l vs n)
    ['track',  'trade',  'trail',   'train',   'tramp',   'trash'],
    // FLA — flash/flask share "flas", need 5th letter (h vs k)
    ['flame',  'flank',  'flare',   'flash',   'flask',   'flat'],
    // BRE — breach/bread/break/breath all share "brea", nearly every pair needs 5th
    ['breach', 'bread',  'break',   'breath',  'breed',   'breeze'],
    // CLA — clam is prefix of clamp; clash/clasp share "clas", need 5th (h vs p)
    ['clam',   'clamp',  'clank',   'clap',    'clash',   'clasp'],
    // GRO — 4th letter distinct throughout (a,o,p,s,v,w), forces 4th-letter work
    ['groan',  'groom',  'grope',   'gross',   'grove',   'growl'],
    // CRA — crash/crass share "cras", need 5th letter (h vs s)
    ['crank',  'crape',  'crash',   'crass',   'crave',   'crawl'],
    // SHR — shriek/shrill/shrimp/shrine/shrink all share "shri", need 5th–6th
    ['shrank', 'shriek', 'shrill',  'shrimp',  'shrine',  'shrink'],
    // SPL — splash/splat/splay share "spla", need 5th; splint/split share "spli", need 5th
    ['splash', 'splat',  'splay',   'spleen',  'splint',  'split'],
    // THR — throb/throne/throng share "thro"; throne/throng share "thron", need 6th!
    ['throb',  'throne', 'throng',  'through', 'throw',   'thrust'],
];

// ============================================
// HELPERS
// ============================================

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getSelectedOps() {
    return [...document.querySelectorAll('.op-toggle.active')].map(b => b.dataset.op);
}

// ============================================
// DECK GENERATION
// ============================================

function generateAllQuestions(operations, max) {
    const questions = [];

    for (const op of operations) {
        if (op === 'addition') {
            for (let a = 1; a <= max; a++)
                for (let b = 1; b <= max; b++)
                    questions.push({ display: `${a}\n+\n${b}`, answer: a + b });

        } else if (op === 'subtraction') {
            for (let sub = 1; sub <= max; sub++)
                for (let ans = 0; ans <= max; ans++)
                    questions.push({ display: `${sub + ans}\n−\n${sub}`, answer: ans });

        } else if (op === 'multiplication') {
            for (let a = 1; a <= max; a++)
                for (let b = 1; b <= max; b++)
                    questions.push({ display: `${a}\n×\n${b}`, answer: a * b });

        } else if (op === 'division') {
            for (let div = 1; div <= max; div++)
                for (let quo = 0; quo <= max; quo++)
                    questions.push({ display: `${div * quo}\n÷\n${div}`, answer: quo });
        }
    }

    return questions;
}

// ============================================
// ANSWER NORMALIZATION
// ============================================

function findNumberInSpeech(transcript) {
    const words = transcript.toLowerCase().trim().split(/\s+/);
    for (let len = 1; len <= Math.min(3, words.length); len++) {
        for (let start = 0; start <= words.length - len; start++) {
            const phrase = words.slice(start, start + len).join(' ');
            const normalized = normalizeAnswer(phrase);
            if (/^\d+$/.test(normalized)) {
                return parseInt(normalized, 10);
            }
        }
    }
    return null;
}

function normalizeAnswer(text) {
    const lowerText = text.toLowerCase().trim();

    const homophones = {
        'for': 'four', 'to': 'two', 'too': 'two',
        'won': 'one',  'ate': 'eight', 'fore': 'four', 'tree': 'three',
    };

    let normalized = lowerText;
    for (const [wrong, right] of Object.entries(homophones)) {
        normalized = normalized.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
    }

    const wordToNumber = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
        'hundred': 100,
    };

    if (Object.prototype.hasOwnProperty.call(wordToNumber, normalized)) {
        return wordToNumber[normalized].toString();
    }

    const compound = parseSpokenNumber(normalized, wordToNumber);
    if (compound !== null) return compound.toString();

    if (/^\d+$/.test(normalized)) return normalized;

    return normalized;
}

function parseSpokenNumber(text, wordToNumber) {
    const words = text.split(/\s+/);
    let total = 0;
    let current = 0;

    for (const word of words) {
        const value = wordToNumber[word];
        if (value === undefined) {
            const digit = parseInt(word, 10);
            if (!isNaN(digit)) { current += digit; }
            else { return null; }
        } else if (value === 100) {
            current = (current || 1) * 100;
        } else {
            current += value;
        }
    }

    total += current;
    return (total === 0 && words.length > 0) ? null : total;
}

// ============================================
// ANIMATION
// ============================================

// Flip the question card: rotate out, run callback to update content, rotate in.
function flipCard(callback, cardId = 'question-display') {
    const card = document.getElementById(cardId);

    // Phase 1: rotate to 90° (hidden edge-on)
    card.style.transition = 'transform 0.14s ease-in';
    card.style.transform = 'rotateY(90deg)';

    setTimeout(() => {
        callback();

        // Jump to -90° with no transition, then ease back to 0°
        card.style.transition = 'none';
        card.style.transform = 'rotateY(-90deg)';
        void card.offsetHeight; // force reflow so the jump registers
        card.style.transition = 'transform 0.14s ease-out';
        card.style.transform = '';
    }, 145);
}

// Spawn three floating number sprites for the question just answered.
// One sprite per value (top number, bottom number, answer).
function spawnSprites(q) {
    if (!state.animations) return;

    const [topStr, , bottomStr] = q.display.split('\n');
    const values = [topStr, bottomStr, String(q.answer)];

    const layer = document.getElementById('sprite-layer');
    const card  = document.getElementById('question-display');
    const rect  = card.getBoundingClientRect();

    values.forEach((val, i) => {
        const sprite = document.createElement('span');
        sprite.className = 'sprite';
        sprite.textContent = val;

        // Spread sprites across the card width
        const baseX = rect.left + rect.width * (0.15 + i * 0.35);
        const baseY = rect.top  + rect.height * (0.25 + Math.random() * 0.5);

        sprite.style.left = `${baseX + (Math.random() - 0.5) * 20}px`;
        sprite.style.top  = `${baseY}px`;

        // Individual drift and rise values
        const dx = (Math.random() - 0.5) * 90;
        const dy = -(90 + Math.random() * 110);
        sprite.style.setProperty('--dx', `${dx}px`);
        sprite.style.setProperty('--dy', `${dy}px`);
        sprite.style.animationDelay = `${i * 60}ms`;

        layer.appendChild(sprite);
        sprite.addEventListener('animationend', () => sprite.remove());
    });
}

// ============================================
// SPEECH RECOGNITION
// ============================================

function buildNumberGrammar() {
    const ones  = ['zero','one','two','three','four','five','six','seven','eight','nine'];
    const teens = ['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
                   'seventeen','eighteen','nineteen'];
    const tensW = ['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    const terms = [...ones, ...teens, ...tensW];
    for (const t of tensW) {
        for (const o of ones.slice(1)) terms.push(`${t} ${o}`);
    }
    const hunds = ['one hundred','two hundred','three hundred','four hundred'];
    for (const h of hunds) {
        terms.push(h);
        for (const o of ones.slice(1)) terms.push(`${h} ${o}`);
        for (const teen of teens)       terms.push(`${h} ${teen}`);
        for (const t of tensW) {
            terms.push(`${h} ${t}`);
            for (const o of ones.slice(1)) terms.push(`${h} ${t} ${o}`);
        }
    }
    return `#JSGF V1.0; grammar numbers; public <number> = ${terms.join(' | ')};`;
}

function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { state.speechSupported = false; return false; }

    state.speechSupported = true;
    state.recognition = new SR();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'en-US';
    state.recognition.maxAlternatives = 3;

    const SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    if (SGL) {
        const grammarList = new SGL();
        grammarList.addFromString(buildNumberGrammar(), 1);
        state.recognition.grammars = grammarList;
    }

    state.recognition.onstart = () => {
        state.isListening = true;
        document.getElementById('mic-btn').classList.add('listening');
    };

    state.recognition.onresult = (event) => {
        const latest = event.results[event.results.length - 1];
        const transcript = latest[0].transcript.trim();

        if (state.showTranscript) {
            document.getElementById('listening-text').textContent = transcript;
        }

        if (!state.quizActive) return;
        for (let i = 0; i < latest.length; i++) {
            const found = findNumberInSpeech(latest[i].transcript.trim());
            if (found !== null && found === state.questions[state.currentIndex].answer) {
                advanceQuestion();
                return;
            }
        }
    };

    state.recognition.onerror = (event) => {
        state.isListening = false;
        if (event.error !== 'aborted' && state.quizActive) {
            setTimeout(startListening, 200);
        }
    };

    state.recognition.onend = () => {
        state.isListening = false;
        if (state.quizActive) {
            setTimeout(startListening, 100);
        } else {
            document.getElementById('mic-btn').classList.remove('listening');
        }
    };

    return true;
}

function startListening() {
    if (state.isListening) return;
    try { state.recognition.start(); } catch (e) { /* already running */ }
}

// ============================================
// PROGRESS BAR
// ============================================

function updateProgressBar() {
    if (!state.progressBar) return;
    const pct = state.questions.length > 0
        ? (state.currentIndex / state.questions.length) * 100
        : 0;
    document.getElementById('progress-bar-fill').style.width = `${pct}%`;
}

function updateGhost(elapsedMs) {
    if (!state.progressBar || state.bestTimePacer === null) return;
    const pct = Math.min((elapsedMs / (state.bestTimePacer * 1000)) * 100, 100);
    document.getElementById('progress-bar-ghost').style.left = `${pct}%`;
}

// ============================================
// TIMER
// ============================================

function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        document.getElementById('timer-display').textContent = formatTime(Math.floor(elapsed / 1000));
        updateGhost(elapsed);
    }, 100);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    return Math.floor((Date.now() - state.startTime) / 1000);
}

// ============================================
// SCREENS & TAB BAR
// ============================================

const SCREEN_TAB = {
    'home':              'flashcards',
    'quiz':              'flashcards',
    'results':           'flashcards',
    'worksheets':        'worksheets',
    'word-sort-menu':    'sorting',
    'word-sort-game':    'sorting',
    'word-sort-results': 'sorting',
    'ciphers':           'ciphers',
    'make-ten-menu':     'make-ten',
    'tap-game':          'make-ten',
    'tap-game-results':  'make-ten',
    'ten-frame':         'ten-frame',
    'visualizer':        'visualizer',
    'sudoku':            'sudoku',
};

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${name}-screen`).classList.add('active');
    document.getElementById('settings-widget').classList.toggle('hidden', name !== 'home');
    const tab = SCREEN_TAB[name];
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    // Progress bar is only shown during the quiz
    document.getElementById('progress-bar-container').classList.toggle('hidden', name !== 'quiz');
}

// ============================================
// HOME
// ============================================

function initHome() {
    const ops = getSelectedOps();
    const max = parseInt(document.querySelector('#max-number-group .op-toggle.active')?.dataset.max || '10', 10);
    const bestTime = ops.length > 0 ? loadBestTime(ops, max) : null;
    document.getElementById('best-time-home').textContent =
        bestTime !== null ? formatTime(bestTime) : '--:--';
    document.getElementById('start-btn').disabled = ops.length === 0;
}

// ============================================
// QUIZ
// ============================================

function startQuiz() {
    state.operations = getSelectedOps();
    state.maxNumber   = parseInt(document.querySelector('#max-number-group .op-toggle.active')?.dataset.max || '10', 10);
    state.shuffle     = document.getElementById('shuffle-toggle').checked;
    state.animations     = document.getElementById('animations-toggle').checked;
    state.showTranscript = document.getElementById('transcript-toggle').checked;
    state.progressBar    = document.getElementById('progress-bar-toggle').checked;

    // Pacer: saved best time for this exact config, or null if no best or bar is off
    const savedBest = loadBestTime(state.operations, state.maxNumber);
    state.bestTimePacer = (state.progressBar && savedBest !== null) ? savedBest : null;

    let questions = generateAllQuestions(state.operations, state.maxNumber);
    if (state.shuffle) questions = shuffleArray(questions);
    state.questions = questions;

    state.currentIndex = 0;
    state.correctCount = 0;

    // Apply transcript visibility
    document.getElementById('transcript-bar').classList.toggle('hidden', !state.showTranscript);

    // Reset card transform in case it was mid-flip
    const card = document.getElementById('question-display');
    card.style.transition = 'none';
    card.style.transform  = '';

    document.getElementById('timer-display').textContent = '00:00';
    showScreen('quiz');

    // Set up progress bar
    const bar = document.getElementById('progress-bar-container');
    bar.classList.toggle('hidden', !state.progressBar);
    document.getElementById('progress-bar-fill').style.width = '0%';
    const ghost = document.getElementById('progress-bar-ghost');
    ghost.classList.toggle('hidden', state.bestTimePacer === null);
    ghost.style.left = '0%';

    renderQuestion();
    updateProgressBar();
    startTimer();
    state.quizActive = true;

    if (state.speechSupported) {
        startListening();
    } else {
        document.getElementById('answer-input').value = '';
        document.getElementById('answer-input').focus();
    }
}

function renderQuestion() {
    const q = state.questions[state.currentIndex];
    const [top, op, bottom] = q.display.split('\n');
    // Safe: all values are generated numbers and operator symbols
    document.getElementById('question-display').innerHTML =
        `<div class="q-row"><span class="q-op"></span><span class="q-num">${top}</span></div>` +
        `<div class="q-row"><span class="q-op">${op}</span><span class="q-num">${bottom}</span></div>` +
        `<div class="q-line"></div>`;

    document.getElementById('progress-display').textContent =
        `${state.currentIndex + 1} / ${state.questions.length}`;
    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'feedback-display';
    document.getElementById('listening-text').textContent = '';

    if (!state.speechSupported) {
        document.getElementById('answer-input').value = '';
        document.getElementById('answer-input').focus();
    }
}

function advanceQuestion() {
    const answeredQ = state.questions[state.currentIndex];
    state.correctCount++;
    state.currentIndex++;

    spawnSprites(answeredQ);

    updateProgressBar();

    const next = () => {
        if (state.currentIndex >= state.questions.length) endQuiz();
        else renderQuestion();
    };

    if (state.animations) flipCard(next);
    else next();
}

// Typed fallback
function checkTypedAnswer(raw) {
    const normalized = normalizeAnswer(raw.toString());
    const q = state.questions[state.currentIndex];
    if (normalized === q.answer.toString()) {
        advanceQuestion();
    } else {
        const feedback = document.getElementById('feedback-display');
        feedback.textContent = 'Not quite — try again!';
        feedback.className = 'feedback-display incorrect';
        document.getElementById('answer-input').value = '';
        document.getElementById('answer-input').focus();
    }
}

function submitTyped() {
    const raw = document.getElementById('answer-input').value.trim();
    if (raw !== '') checkTypedAnswer(raw);
}

// ============================================
// RESULTS
// ============================================

function endQuiz() {
    state.quizActive = false;
    if (state.speechSupported) state.recognition.stop();
    const elapsed = stopTimer();

    const bestTime  = loadBestTime(state.operations, state.maxNumber);
    const isNewBest = bestTime === null || elapsed < bestTime;
    if (isNewBest) saveBestTime(elapsed);

    document.getElementById('final-time').textContent        = formatTime(elapsed);
    document.getElementById('final-score').textContent       = `${state.correctCount} / ${state.questions.length}`;
    document.getElementById('best-time-results').textContent = formatTime(isNewBest ? elapsed : bestTime);

    document.getElementById('new-record-badge').classList.toggle('hidden', !isNewBest);
    document.getElementById('results-title').textContent =
        state.correctCount === state.questions.length ? 'Perfect!' : 'Done!';

    showScreen('results');
}

// ============================================
// TAP GAMES (Make Ten · Within 20 · Missing Number)
//
// One engine drives three tap-to-answer mini-games. Each mode supplies a
// round generator returning { tokens, answer, choices }:
//   tokens  — full equation incl '=' with exactly one '?' blank
//   answer  — the value that fills the blank
//   choices — numbers shown as tappable buttons (must include answer)
// ============================================

function tgRandInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Fisher–Yates, returns a new shuffled array.
function tgShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const TAP_MODES = {
    'make-ten': {
        title: (o) => `Make ${o.target}`,
        // Best time is per target AND per reps — a 33-card run isn't the same race
        // as an 11-card one.
        bestKey: (o) => `tapBest_makeTen_${o.target}_r${o.reps || 1}`,
        // One card per complement 0..target, so every key (including 0 and the
        // target itself) shows up as an answer across a deck.
        buildDeck(o) {
            const choices = Array.from({ length: o.target + 1 }, (_, i) => i);
            return choices.map(known => ({
                tokens: [String(known), '+', '?', '=', String(o.target)],
                answer: o.target - known,
                choices,
            }));
        },
    },
};

function tgLoadBest() {
    const key = TAP_MODES[state.tgMode].bestKey(state.tgOpts);
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : null;
}

function tgSaveBest(seconds) {
    const key = TAP_MODES[state.tgMode].bestKey(state.tgOpts);
    localStorage.setItem(key, seconds.toString());
}

function startTapGame(mode, opts = {}) {
    state.tgMode = mode;
    state.tgOpts = opts;
    const def = TAP_MODES[mode];
    // reps copies of the whole deck, shuffled together — so it's truly random,
    // not deck 1 then deck 2 then deck 3 in sequence.
    const reps = Math.max(1, opts.reps || 1);
    let deck = [];
    for (let r = 0; r < reps; r++) deck = deck.concat(def.buildDeck(opts));
    state.tgRounds = tgShuffle(deck);
    state.tgIndex = 0;
    state.tgCorrect = 0;

    const card = document.getElementById('tg-question');
    card.style.transition = 'none';
    card.style.transform  = '';

    document.getElementById('tg-title').textContent = def.title(opts);
    document.getElementById('tg-timer-display').textContent = '00:00';
    showScreen('tap-game');
    tgRenderRound();
    tgStartTimer();
    state.tgActive = true;
}

function tgRenderRound() {
    const round = state.tgRounds[state.tgIndex];
    const card = document.getElementById('tg-question');
    // Safe: tokens are generated numbers, operators, and the '?' blank
    card.innerHTML = round.tokens.map(t => {
        if (t === '?') return `<span class="tg-blank">?</span>`;
        if (/^\d+$/.test(t)) return `<span class="tg-num">${t}</span>`;
        return `<span class="tg-op">${t}</span>`;
    }).join('');

    document.getElementById('tg-progress-display').textContent =
        `${state.tgIndex + 1} / ${state.tgRounds.length}`;
    const feedback = document.getElementById('tg-feedback');
    feedback.textContent = '';
    feedback.className = 'feedback-display';

    tgRenderVisual(round);

    // For the 0–10 range, lay the choices out as a keypad: 1–9 in a 3×3 block,
    // 0 to the left of 1 (top-left), 10 to the right of 9 (bottom-right).
    const keypad = round.choices.length === 11 && round.choices[10] === 10;
    const choices = document.getElementById('tg-choices');
    choices.classList.toggle('tg-keypad', keypad);
    choices.innerHTML = '';
    round.choices.forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'tg-choice';
        btn.textContent = n;
        if (keypad) {
            let col, row;
            if (n === 0)       { col = 1; row = 1; }
            else if (n === 10) { col = 5; row = 3; }
            else { col = 2 + ((n - 1) % 3); row = 1 + Math.floor((n - 1) / 3); }
            btn.style.gridColumn = col;
            btn.style.gridRow = row;
        }
        btn.addEventListener('click', () => tgChoose(n, btn));
        choices.appendChild(btn);
    });
}

function tgRenderVisual(round) {
    const wrap = document.getElementById('tg-visual');
    // Only the Make Ten mode with the ten-frame option enabled shows a visual
    if (state.tgMode !== 'make-ten' || !state.tgOpts.tenFrame) {
        wrap.classList.add('hidden');
        wrap.innerHTML = '';
        return;
    }
    const target = state.tgOpts.target;
    const known  = parseInt(round.tokens[0], 10);   // the given addend
    const frameCount = Math.max(1, Math.ceil(target / 10));
    wrap.innerHTML = '';
    for (let f = 0; f < frameCount; f++) {
        const cellsInFrame = Math.min(10, target - f * 10);
        const frame = document.createElement('div');
        frame.className = 'tf-frame';
        for (let i = 0; i < cellsInFrame; i++) {
            const idx = f * 10 + i;
            const cell = document.createElement('div');
            cell.className = 'tf-cell';
            if (idx < known) {
                const dot = document.createElement('span');
                dot.className = 'tf-dot tf-dot-a';
                cell.appendChild(dot);
            }
            frame.appendChild(cell);
        }
        wrap.appendChild(frame);
    }
    wrap.classList.remove('hidden');
}

function tgChoose(value, btn) {
    if (!state.tgActive) return;
    const round = state.tgRounds[state.tgIndex];

    if (value === round.answer) {
        state.tgCorrect++;
        state.tgIndex++;
        state.tgActive = false;  // block taps during the flip
        const next = () => {
            if (state.tgIndex >= state.tgRounds.length) {
                tgEnd();
            } else {
                tgRenderRound();
                state.tgActive = true;
            }
        };
        flipCard(next, 'tg-question');
    } else {
        const feedback = document.getElementById('tg-feedback');
        feedback.textContent = 'Try again!';
        feedback.className = 'feedback-display incorrect';
        btn.classList.add('tg-choice-wrong');
        setTimeout(() => btn.classList.remove('tg-choice-wrong'), 400);
    }
}

function tgStartTimer() {
    state.tgStartTime = Date.now();
    state.tgTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.tgStartTime) / 1000);
        document.getElementById('tg-timer-display').textContent = formatTime(elapsed);
    }, 200);
}

function tgEnd() {
    state.tgActive = false;
    clearInterval(state.tgTimerInterval);
    const elapsed = Math.floor((Date.now() - state.tgStartTime) / 1000);

    const best = tgLoadBest();
    const isNewBest = best === null || elapsed < best;
    if (isNewBest) tgSaveBest(elapsed);

    document.getElementById('tg-final-time').textContent = formatTime(elapsed);
    document.getElementById('tg-best-time').textContent = formatTime(isNewBest ? elapsed : best);
    document.getElementById('tg-new-record').classList.toggle('hidden', !isNewBest);
    document.getElementById('tg-results-title').textContent =
        state.tgCorrect === state.tgRounds.length ? 'Perfect!' : 'Done!';

    showScreen('tap-game-results');
}

// ============================================
// TEN FRAME BUILDER
// ============================================

function tfClampInput(id) {
    const raw = parseInt(document.getElementById(id).value, 10);
    if (isNaN(raw)) return 0;
    return Math.max(0, Math.min(20, raw));
}

function tfShow() {
    const a = tfClampInput('tf-input-a');
    const b = tfClampInput('tf-input-b');
    const total = a + b;

    const frameCount = Math.max(1, Math.ceil(total / 10));
    const container = document.getElementById('tf-frames');
    container.innerHTML = '';

    for (let f = 0; f < frameCount; f++) {
        const frame = document.createElement('div');
        frame.className = 'tf-frame';
        for (let i = 0; i < 10; i++) {
            const idx = f * 10 + i;  // 0-based dot index across all frames
            const cell = document.createElement('div');
            cell.className = 'tf-cell';
            if (idx < total) {
                const dot = document.createElement('span');
                dot.className = idx < a ? 'tf-dot tf-dot-a' : 'tf-dot tf-dot-b';
                cell.appendChild(dot);
            }
            frame.appendChild(cell);
        }
        container.appendChild(frame);
    }

    const sum = document.getElementById('tf-sum');
    sum.textContent = `${a} + ${b} = ${total}`;
    sum.classList.remove('hidden');
}

function tfClear() {
    document.getElementById('tf-input-a').value = '';
    document.getElementById('tf-input-b').value = '';
    document.getElementById('tf-frames').innerHTML = '';
    const sum = document.getElementById('tf-sum');
    sum.classList.add('hidden');
    sum.textContent = '';
}

// ============================================
// WORD SORT
// ============================================

function wsLoadBestTime(difficulty) {
    const stored = localStorage.getItem(`wordSortBest_${difficulty}`);
    return stored ? parseInt(stored, 10) : null;
}

function wsSaveBestTime(difficulty, seconds) {
    localStorage.setItem(`wordSortBest_${difficulty}`, seconds.toString());
}

function wsMenuKey() {
    const type = document.querySelector('.ws-type-btn.active')?.dataset.type || 'letters';
    const diff = document.querySelector('.ws-diff-btn.active')?.dataset.diff || 'easy';
    return `${type}_${diff}`;
}

function initWordSortMenu() {
    const best = wsLoadBestTime(wsMenuKey());
    document.getElementById('ws-best-current').textContent = best !== null ? formatTime(best) : '--:--';
    const type = document.querySelector('.ws-type-btn.active')?.dataset.type || 'letters';
    const diff = document.querySelector('.ws-diff-btn.active')?.dataset.diff || 'easy';
    document.getElementById('ws-best-label').textContent = `${type[0].toUpperCase()+type.slice(1)} / ${diff[0].toUpperCase()+diff.slice(1)} Best`;
}

function generateNumberSet(diff) {
    const [min, max] = diff === 'easy'   ? [1, 20]
                     : diff === 'medium' ? [1, 100]
                     :                    [-9999, 9999];
    const numbers = [];
    const count = diff === 'hard' ? 6 : 6;
    while (numbers.length < count) {
        const n = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!numbers.includes(n)) numbers.push(n);
    }
    return shuffleArray(numbers.map(String));
}

function wsPickWords(type, diff) {
    if (type === 'numbers') {
        return generateNumberSet(diff);
    }
    // Letters
    if (diff === 'hard') {
        const groupIndex = Math.floor(Math.random() * WS_WORDS_ADVANCED.length);
        return shuffleArray(WS_WORDS_ADVANCED[groupIndex]);
    }
    const pool = diff === 'easy' ? WS_WORDS_BASIC : WS_WORDS_INTERMEDIATE;
    return shuffleArray(pool).slice(0, 6);
}

function startWordSort(type, diff) {
    if (state.wsTimerInterval) {
        clearInterval(state.wsTimerInterval);
        state.wsTimerInterval = null;
    }
    state.wsDifficulty = `${type}_${diff}`;
    state.wsType = type;
    state.wsWords = wsPickWords(type, diff);

    document.getElementById('ws-diff-display').textContent = `${type.toUpperCase()} · ${diff.toUpperCase()}`;
    document.getElementById('ws-timer-display').textContent = '00:00';

    const prompt = type === 'numbers' ? 'Smallest → Largest' : 'Sort A → Z';
    document.querySelector('.ws-prompt').textContent = prompt;

    wsRenderBubbles(state.wsWords);

    showScreen('word-sort-game');

    state.wsStartTime = Date.now();
    state.wsTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.wsStartTime) / 1000);
        document.getElementById('ws-timer-display').textContent = formatTime(elapsed);
    }, 200);
}

function wsRenderBubbles(words) {
    const list = document.getElementById('ws-word-list');
    list.innerHTML = '';
    words.forEach(word => {
        const div = document.createElement('div');
        div.className = 'ws-bubble';
        div.dataset.word = word;
        div.textContent = word;
        div.addEventListener('pointerdown', wsDragStart);
        list.appendChild(div);
    });
}

function wsCheckOrder() {
    const list = document.getElementById('ws-word-list');
    const bubbles = [...list.querySelectorAll('.ws-bubble')];
    const current = bubbles.map(b => b.dataset.word);

    let correct;
    if (state.wsType === 'numbers') {
        const nums = current.map(Number);
        const sorted = [...nums].sort((a, b) => a - b);  // smallest first
        correct = sorted.map(String);
    } else {
        correct = [...current].sort((a, b) => a.localeCompare(b));
    }

    let allCorrect = true;
    bubbles.forEach((bubble, i) => {
        bubble.classList.remove('ws-wrong');
        if (current[i] !== correct[i]) {
            bubble.classList.add('ws-wrong');
            allCorrect = false;
        }
    });

    if (allCorrect) wsEndGame();
}

function wsEndGame() {
    clearInterval(state.wsTimerInterval);
    state.wsTimerInterval = null;
    const elapsed = Math.floor((Date.now() - state.wsStartTime) / 1000);
    const diff = state.wsDifficulty;

    const best = wsLoadBestTime(diff);
    const isNewBest = best === null || elapsed < best;
    if (isNewBest) wsSaveBestTime(diff, elapsed);

    document.getElementById('ws-results-title').textContent = isNewBest ? 'New Best!' : 'Sorted!';
    document.getElementById('ws-final-time').textContent = formatTime(elapsed);
    document.getElementById('ws-best-time-results').textContent =
        isNewBest ? formatTime(elapsed) : formatTime(best);
    document.getElementById('ws-final-diff').textContent = diff.replace('_', ' / ').toUpperCase();
    document.getElementById('ws-new-record-badge').classList.toggle('hidden', !isNewBest);

    showScreen('word-sort-results');
}

function wsDragStart(e) {
    if (state.wsDragState) return;
    e.preventDefault();

    const bubble = e.currentTarget;
    const rect = bubble.getBoundingClientRect();

    document.querySelectorAll('.ws-bubble').forEach(b => b.classList.remove('ws-wrong'));

    const placeholder = document.createElement('div');
    placeholder.className = 'ws-placeholder';
    placeholder.style.height = rect.height + 'px';
    bubble.parentNode.insertBefore(placeholder, bubble);

    bubble.classList.add('ws-dragging');
    bubble.style.position = 'fixed';
    bubble.style.width    = rect.width + 'px';
    bubble.style.left     = rect.left + 'px';
    bubble.style.top      = rect.top  + 'px';
    bubble.style.margin   = '0';
    bubble.style.zIndex   = '1000';
    document.body.appendChild(bubble);

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    state.wsDragState = { bubble, placeholder, offsetX, offsetY, lastInsertBefore: undefined };

    bubble.setPointerCapture(e.pointerId);
    document.addEventListener('pointermove', wsDragMove);
    document.addEventListener('pointerup',     wsDragEnd);
    document.addEventListener('pointercancel', wsDragEnd);
}

function wsDragMove(e) {
    const ds = state.wsDragState;
    if (!ds) return;

    ds.bubble.style.left = (e.clientX - ds.offsetX) + 'px';
    ds.bubble.style.top  = (e.clientY - ds.offsetY) + 'px';

    const list = document.getElementById('ws-word-list');
    const siblings = [...list.querySelectorAll('.ws-bubble, .ws-placeholder')];
    let insertBefore = null;
    for (const sib of siblings) {
        const r = sib.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { insertBefore = sib; break; }
    }

    if (insertBefore !== ds.lastInsertBefore) {
        ds.lastInsertBefore = insertBefore;
        if (insertBefore) {
            list.insertBefore(ds.placeholder, insertBefore);
        } else {
            list.appendChild(ds.placeholder);
        }
    }
}

function wsDragEnd(e) {
    const ds = state.wsDragState;
    if (!ds) return;

    document.removeEventListener('pointermove',   wsDragMove);
    document.removeEventListener('pointerup',     wsDragEnd);
    document.removeEventListener('pointercancel', wsDragEnd);

    const list = document.getElementById('ws-word-list');

    ds.bubble.classList.remove('ws-dragging');
    ds.bubble.style.cssText = '';
    list.insertBefore(ds.bubble, ds.placeholder);
    ds.placeholder.remove();

    state.wsDragState = null;
}

// ============================================
// MATH VISUALIZER
// ============================================

function initVisualizer() {
    const container = document.getElementById('visualizer-canvas-container');

    if (state.visualizerAnimator) {
        state.visualizerAnimator.dispose();
    }

    state.visualizerAnimator = new MathAnimator(container);

    // Start rendering loop
    const startRenderLoop = () => {
        if (!state.visualizerAnimator || state.visualizerAnimator.disposed) {
            return;
        }
        state.visualizerAnimator.render();
        requestAnimationFrame(startRenderLoop);
    };
    startRenderLoop();
}

// 'idle' | 'built' | 'dropping'
function vizSetPhase(phase) {
    state.vizPhase = phase;
    const btn = document.getElementById('visualizer-drop-btn');
    if (!btn) return;
    if (phase === 'idle') {
        const filled = vizInputsFilled();
        btn.textContent = 'SHOW';
        btn.disabled = !filled;
        btn.classList.toggle('visualizer-btn-disabled', !filled);
    } else if (phase === 'built') {
        btn.textContent = 'DROP';
        btn.disabled = false;
        btn.classList.remove('visualizer-btn-disabled');
    } else if (phase === 'dropping') {
        btn.textContent = 'RESET';
        btn.disabled = false;
        btn.classList.remove('visualizer-btn-disabled');
    }
}

function vizInputsFilled() {
    const v1 = document.getElementById('visualizer-input-1').value.trim();
    const v2 = document.getElementById('visualizer-input-2').value.trim();
    const v3 = document.getElementById('visualizer-input-3').value.trim();
    return v1 !== '' && v2 !== '' && v3 !== '';
}

function handleVisualizerInputChange() {
    if (state.vizPhase === 'idle') {
        vizSetPhase('idle');  // re-evaluate enabled state
    } else {
        // Inputs changed while blocks are shown — go back to idle
        vizSetPhase('idle');
        if (state.visualizerAnimator) state.visualizerAnimator.clear();
        const answerEl = document.getElementById('visualizer-answer');
        answerEl.classList.add('hidden');
        answerEl.textContent = '';
    }
}

function handleVisualizerShow() {
    const input1 = document.getElementById('visualizer-input-1').value.trim();
    const input2 = document.getElementById('visualizer-input-2').value.trim();
    const input3 = document.getElementById('visualizer-input-3').value.trim();

    if (!state.visualizerAnimator) return;

    const a = parseInt(input1, 10);
    const b = parseInt(input2, 10);
    const c = parseInt(input3, 10);

    if (isNaN(a) || isNaN(b) || isNaN(c) || a < 1 || b < 1 || c < 1) {
        alert('Please enter positive whole numbers.');
        return;
    }

    if (a * b * c > 1000) {
        alert('That expression would create too many blocks (max 1000).');
        return;
    }

    vizSetPhase('built');
    state.visualizerAnimator.spacing = 1.2;
    state.visualizerAnimator.animateMultiplication(a, b, c);

    const answerEl = document.getElementById('visualizer-answer');
    setTimeout(() => {
        answerEl.textContent = `= ${a * b * c}`;
        answerEl.classList.remove('hidden');
    }, 1500);
}

function handleVisualizerDrop() {
    if (!state.visualizerAnimator) return;
    const phase = state.vizPhase;

    if (phase === 'idle') return;

    if (phase === 'dropping') {
        // RESET: snap back and rebuild
        state.visualizerAnimator.snapBackToFormation();
        vizSetPhase('built');
        return;
    }

    // phase === 'built': start drop
    if (!state.visualizerAnimator.hasFilled) return;
    vizSetPhase('dropping');

    const friction   = parseFloat(document.getElementById('viz-friction').value);
    const rowDelay   = parseInt(document.getElementById('viz-row-delay').value, 10);
    const rotRange   = parseFloat(document.getElementById('viz-rotation').value);

    state.visualizerAnimator.startDrop({ friction, rowDelay, rotRange }).then(() => {
        // Drop settled — stay in dropping phase (RESET still available)
    });
}

function handleVisualizerClear() {
    document.getElementById('visualizer-input-1').value = '';
    document.getElementById('visualizer-input-2').value = '';
    document.getElementById('visualizer-input-3').value = '';

    const answerEl = document.getElementById('visualizer-answer');
    answerEl.classList.add('hidden');
    answerEl.textContent = '';

    if (state.visualizerAnimator) {
        state.visualizerAnimator.dropAborted = true;
        state.visualizerAnimator.clear();
    }
    vizSetPhase('idle');
}

// ============================================
// PUZZLE GENERATOR
// ============================================

// --- Sudoku ---

function pgBoxDims(size) {
    if (size === 4) return [2, 2];
    if (size === 6) return [2, 3];
    return [3, 3];
}

function pgSymbolToDisplay(num, size, symbolType, multiplier = 2) {
    if (num === 0) return '';
    if (symbolType === 'letters') {
        const letters = size === 4 ? 'ABCD' : size === 6 ? 'ABCDEF' : 'ABCDEFGHI';
        return letters[num - 1];
    }
    if (symbolType === 'multiples') {
        return String(num * multiplier);
    }
    return String(num);
}

function pgSudokuValid(grid, r, c, n, size) {
    const [bh, bw] = pgBoxDims(size);
    if (grid[r].includes(n)) return false;
    for (let i = 0; i < size; i++) if (grid[i][c] === n) return false;
    const br = Math.floor(r / bh) * bh;
    const bc = Math.floor(c / bw) * bw;
    for (let i = br; i < br + bh; i++)
        for (let j = bc; j < bc + bw; j++)
            if (grid[i][j] === n) return false;
    return true;
}

function pgSudokuFill(grid, size) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c] === 0) {
                const nums = shuffleArray([...Array(size)].map((_, i) => i + 1));
                for (const n of nums) {
                    if (pgSudokuValid(grid, r, c, n, size)) {
                        grid[r][c] = n;
                        if (pgSudokuFill(grid, size)) return true;
                        grid[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function pgMakeSudoku(size, diff) {
    const g = Array.from({ length: size }, () => Array(size).fill(0));
    pgSudokuFill(g, size);
    const sol = g.map(r => [...r]);
    const cuts = {
        4: { easy: 4,  medium: 6,  hard: 8  },
        6: { easy: 10, medium: 14, hard: 18 },
        9: { easy: 36, medium: 46, hard: 52 },
    };
    const cells = shuffleArray([...Array(size * size)].map((_, i) => [Math.floor(i / size), i % size]));
    const n = cuts[size][diff];
    for (let i = 0; i < n; i++) g[cells[i][0]][cells[i][1]] = 0;
    return { puz: g, sol };
}

// --- Multiplication ---

function pgMakeMult(min, max, count) {
    return Array.from({ length: count }, () => {
        const a = min + Math.floor(Math.random() * (max - min + 1));
        const b = min + Math.floor(Math.random() * (max - min + 1));
        return { a, b, ans: a * b };
    });
}

function pgMakeAddition(max, count) {
    return Array.from({ length: count }, () => {
        const a = Math.floor(Math.random() * (max + 1));
        const b = Math.floor(Math.random() * (max + 1));
        return { a, b, ans: a + b };
    });
}

function pgMakeSubtraction(max, count) {
    return Array.from({ length: count }, () => {
        const sub = 1 + Math.floor(Math.random() * max);
        const ans = Math.floor(Math.random() * (max + 1));
        return { a: sub + ans, b: sub, ans };
    });
}

function pgMakeDivision(max, count) {
    return Array.from({ length: count }, () => {
        const divisor  = 1 + Math.floor(Math.random() * max);
        const quotient = Math.floor(Math.random() * (max + 1));
        return { a: divisor * quotient, b: divisor, ans: quotient };
    });
}

// --- Cipher ---

// ZapfDingbats tokens: ASCII 0x21–0x3A map to printable dingbat symbols in the ZapfDingbats font.
// We use 26 of them (one per letter) as cipher tokens — jsPDF renders them correctly.
const ZAPFDINGBATS_TOKENS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(0x21 + i));

function pgMakeCipherMap() {
    const A = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const S = shuffleArray([...A]);
    const fwd = {}, rev = {};
    A.forEach((ch, i) => { fwd[ch] = S[i]; rev[S[i]] = ch; });
    return { fwd, rev };
}

function pgMakeCipherMapNumber() {
    const A = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const S = shuffleArray([...Array(26).keys()].map(i => String(i + 1)));
    const fwd = {}, rev = {};
    A.forEach((ch, i) => { fwd[ch] = S[i]; rev[S[i]] = ch; });
    return { fwd, rev };
}

function pgMakeCipherMapGlyph() {
    const A = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const S = shuffleArray([...ZAPFDINGBATS_TOKENS]);
    const fwd = {}, rev = {};
    A.forEach((ch, i) => { fwd[ch] = S[i]; rev[S[i]] = ch; });
    return { fwd, rev };
}

// Elder Futhark + two Anglo-Saxon Futhorc runes to cover all 26 letters
const RUNE_TOKENS = [...'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᛠᛡ'];

function pgMakeCipherMapRune() {
    const A = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const S = shuffleArray([...RUNE_TOKENS]);
    const fwd = {}, rev = {};
    A.forEach((ch, i) => { fwd[ch] = S[i]; rev[S[i]] = ch; });
    return { fwd, rev };
}

function pgEncrypt(text, fwd) {
    return text.toUpperCase().replace(/[A-Z]/g, ch => fwd[ch]);
}

// Returns array of word-arrays: each inner array holds one cipher token per letter.
// '\n' sentinels pass through as-is (newline markers). Non-letters kept as-is.
function pgEncryptWords(plainWords, fwd) {
    return plainWords.map(word =>
        word === '\n' ? ['\n'] :
        [...word.toUpperCase()].map(ch => /[A-Z]/.test(ch) ? (fwd[ch] ?? ch) : ch)
    );
}

function pgChunkText(text, n) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(' '));
    return out;
}

// --- PDF layout constants (letter paper, mm) ---

const PG_DEBUG_GRID = false;  // set true during layout development to show red grid guidelines
const PG_W = 215.9, PG_H = 279.4, PG_M = 12;
const PG_HEADER_Y = 19;                        // Y returned by pgHeader()
const PG_GRID_X   = PG_M;
const PG_GRID_Y   = PG_HEADER_Y;
const PG_GRID_W   = PG_W - 2 * PG_M;          // 191.9 mm
const PG_GRID_H   = PG_H - PG_HEADER_Y - PG_M; // ~248 mm

/**
 * Draw the invisible page grid.  When PG_DEBUG_GRID is true the lines appear
 * as thin red guidelines so the layout is visible during development.
 */
function pgDrawLayoutGrid(doc, x, y, w, h, cols, rows) {
    const cellW = w / cols;
    const cellH = h / rows;
    if (PG_DEBUG_GRID) {
        doc.setDrawColor(210, 30, 30);
        doc.setLineWidth(0.35);
        for (let c = 0; c <= cols; c++)
            doc.line(x + c * cellW, y, x + c * cellW, y + h);
        for (let r = 0; r <= rows; r++)
            doc.line(x, y + r * cellH, x + w, y + r * cellH);
        doc.setDrawColor(0);
        doc.setLineWidth(0.25);
    }
    return { cellW, cellH };
}

/**
 * Draw light gray gridlines for cipher puzzles - only in key and message areas,
 * not in the blank space between them.
 */
function pgDrawCipherGrid(doc, x, y, w, h, cols, rows, keyRows) {
    const cellW = w / cols;
    const cellH = h / rows;
    const messageStartRow = keyRows + 1;  // Account for blank row

    doc.setDrawColor(200, 200, 200);  // Light gray
    doc.setLineWidth(0.25);

    // Draw vertical lines (full height)
    for (let c = 0; c <= cols; c++) {
        doc.line(x + c * cellW, y, x + c * cellW, y + h);
    }

    // Draw horizontal lines - in key area
    for (let r = 0; r <= keyRows; r++) {
        doc.line(x, y + r * cellH, x + w, y + r * cellH);
    }

    // Draw horizontal lines - in message area
    const messageY = y + messageStartRow * cellH;
    for (let r = messageStartRow; r <= rows; r++) {
        doc.line(x, y + r * cellH, x + w, y + r * cellH);
    }

    doc.setDrawColor(0);
}

// --- PDF helpers ---

function pgHeader(doc, title) {
    const W = 215.9, M = 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title, M, 10);
    doc.text(`Name: _________________     Date: _________`, W - 95, 10);
    doc.setLineWidth(0.4);
    doc.line(M, 12, W - M, 12);
    return 15;
}

function pgSudokuGrid(doc, grid, size, ox, oy, gs, symbolType = 'numbers', multiplier = 2) {
    const [bh, bw] = pgBoxDims(size);
    const cs = gs / size;
    doc.setDrawColor(0);

    // Thin cell lines
    doc.setLineWidth(0.25);
    for (let i = 0; i <= size; i++) {
        doc.line(ox, oy + i * cs, ox + gs, oy + i * cs);
        doc.line(ox + i * cs, oy, ox + i * cs, oy + gs);
    }

    // Thick box boundary lines (drawn on top, extending slightly to ensure corners connect)
    const margin = 0.05;  // Slight extension to ensure corners meet
    doc.setLineWidth(1.0);  // Slightly thinner than before
    for (let r = 0; r <= size; r += bh) doc.line(ox - margin, oy + r * cs, ox + gs + margin, oy + r * cs);
    for (let c = 0; c <= size; c += bw) doc.line(ox + c * cs, oy - margin, ox + c * cs, oy + gs + margin);

    // Clue symbols (centered in cells)
    const fs = symbolType === 'multiples' ? (size === 4 ? 20 : size === 6 ? 14 : 11) : (size === 4 ? 28 : size === 6 ? 22 : 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
            if (grid[r][c]) {
                const sym = pgSymbolToDisplay(grid[r][c], size, symbolType, multiplier);
                doc.text(sym, ox + c * cs + cs / 2, oy + r * cs + cs / 2 + fs / 8, { align: 'center' });
            }
}

/**
 * Render multiplication problems into a COLS×ROWS grid.
 * Numbers are right-aligned so decimal columns line up visually.
 */
function pgDrawMultProblems(doc, probs, gridX, gridY, gridW, gridH, showAnswers) {
    const count = probs.length;
    const COLS  = count > 30 ? 4 : 3;
    const ROWS  = Math.ceil(count / COLS);
    const { cellW, cellH } = pgDrawLayoutGrid(doc, gridX, gridY, gridW, gridH, COLS, ROWS);

    probs.forEach((p, i) => {
        if (i >= COLS * ROWS) return;
        const col = i % COLS;
        const row = Math.floor(i / COLS);

        const cellLeft = gridX + col * cellW;
        const cellTop  = gridY + row * cellH;
        const numRight = cellLeft + cellW - 4;   // Numbers right-align here
        const opX      = numRight - 19;          // × operator x-position

        // Problem index
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${i + 1}.`, cellLeft + 2, cellTop + 6.5);

        // Top number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(String(p.a), numRight, cellTop + 7, { align: 'right' });

        // × operator + bottom number (right-aligned together)
        doc.text('×', opX, cellTop + 13);
        doc.text(String(p.b), numRight, cellTop + 13, { align: 'right' });

        // Underline
        doc.setLineWidth(0.7);
        doc.setDrawColor(0);
        doc.line(opX - 1, cellTop + 15, numRight, cellTop + 15);

        // Answer (blank space when not showing answers)
        if (showAnswers) {
            doc.setFontSize(12);
            doc.text(String(p.ans), numRight, cellTop + 21, { align: 'right' });
        }
    });
}

/**
 * Render arithmetic problems in a 5-column grid with large numbers.
 * Works for +, −, ×, ÷ problems (each problem has .a, .b, .ans fields).
 */
function pgDrawArithmeticProblems(doc, probs, op, gridX, gridY, gridW, gridH, showAnswers) {
    const COLS = 5;
    const ROWS = Math.ceil(probs.length / COLS);
    const { cellW, cellH } = pgDrawLayoutGrid(doc, gridX, gridY, gridW, gridH, COLS, ROWS);

    const opSymbol = { addition: '+', subtraction: '-', multiplication: 'x', division: ':' }[op] || op;
    const fs = Math.min(28, Math.floor(cellH * 0.50));

    probs.forEach((p, i) => {
        if (i >= COLS * ROWS) return;
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cellLeft = gridX + col * cellW;
        const cellTop  = gridY + row * cellH;
        const numRight = cellLeft + cellW - 4;
        const opX      = numRight - fs * 0.75;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${i + 1}.`, cellLeft + 2, cellTop + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fs);
        doc.text(String(p.a), numRight, cellTop + cellH * 0.30, { align: 'right' });
        doc.text(opSymbol, opX, cellTop + cellH * 0.52);
        doc.text(String(p.b), numRight, cellTop + cellH * 0.52, { align: 'right' });

        doc.setLineWidth(0.8);
        doc.setDrawColor(0);
        doc.line(opX - 2, cellTop + cellH * 0.57, numRight, cellTop + cellH * 0.57);

        if (showAnswers) {
            doc.setFontSize(fs);
            doc.text(String(p.ans), numRight, cellTop + cellH * 0.78, { align: 'right' });
        }
    });
}

function pgPDFArithmetic(op, max, count, sheets, includeAnswerKey) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const opLabel = { addition: 'Addition', subtraction: 'Subtraction',
                      multiplication: 'Multiplication', division: 'Division' }[op] || op;
    const makeProbs = {
        addition:       () => pgMakeAddition(max, count),
        subtraction:    () => pgMakeSubtraction(max, count),
        multiplication: () => pgMakeMult(1, max, count),
        division:       () => pgMakeDivision(max, count),
    }[op];

    const allSheets = Array.from({ length: sheets }, () => makeProbs());

    allSheets.forEach((probs, si) => {
        if (si) doc.addPage();
        const title = sheets > 1
            ? `${opLabel} Practice · Sheet ${si + 1} of ${sheets}`
            : `${opLabel} Practice`;
        pgHeader(doc, title);
        pgDrawArithmeticProblems(doc, probs, op, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, false);
    });

    if (includeAnswerKey) {
        pgAnswerKeySeparator(doc);
        allSheets.forEach((probs, si) => {
            doc.addPage();
            const title = sheets > 1
                ? `${opLabel} — Answer Key · Sheet ${si + 1}`
                : `${opLabel} — Answer Key`;
            pgHeader(doc, title);
            pgDrawArithmeticProblems(doc, probs, op, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, true);
        });
    }

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

function pgAnswerKeySeparator(doc) {
    const W = 215.9;
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.text('ANSWER KEY', W / 2, 140, { align: 'center' });
}

// --- PDF builders ---

function pgPDFSudoku(sheets, size, diff, symbolType = 'numbers') {
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ unit: 'mm', format: 'letter' });
    const label   = `${size}×${size}`;
    const diffTxt = diff[0].toUpperCase() + diff.slice(1);

    const allPuzzles = Array.from({ length: sheets * 6 }, () => pgMakeSudoku(size, diff));
    // One random multiplier per sheet (for multiples symbolType)
    const sheetMultipliers = Array.from({ length: sheets }, () => 2 + Math.floor(Math.random() * 8));

    // 2-column × 3-row grid fills the printable content area
    const COLS   = 2, ROWS = 3;
    const cellW  = PG_GRID_W / COLS;
    const cellH  = PG_GRID_H / ROWS;
    const INSET  = 5;  // mm gap from grid line to puzzle edge
    const puzSize = Math.min(cellW, cellH) - INSET * 2;

    const drawPage = (pageIdx, isSol) => {
        if (pageIdx > 0 || isSol) doc.addPage();
        const base  = isSol ? `Sudoku ${label} — Answer Key` : `Sudoku ${label} — ${diffTxt}`;
        const title = sheets > 1
            ? `${base} · Sheet ${pageIdx + 1}${!isSol ? ` of ${sheets}` : ''}`
            : base;
        pgHeader(doc, title);
        pgDrawLayoutGrid(doc, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, COLS, ROWS);

        for (let idx = 0; idx < 6; idx++) {
            const col = idx % COLS;
            const row = Math.floor(idx / COLS);
            // Centre the puzzle square inside its grid cell
            const ox = PG_GRID_X + col * cellW + (cellW - puzSize) / 2;
            const oy = PG_GRID_Y + row * cellH + (cellH - puzSize) / 2;
            const grid = isSol ? allPuzzles[pageIdx * 6 + idx].sol
                                : allPuzzles[pageIdx * 6 + idx].puz;
            pgSudokuGrid(doc, grid, size, ox, oy, puzSize, symbolType, sheetMultipliers[pageIdx]);
        }
    };

    for (let i = 0; i < sheets; i++) drawPage(i, false);
    pgAnswerKeySeparator(doc);
    for (let i = 0; i < sheets; i++) drawPage(i, true);

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

function pgPDFMult(min, max, count, sheets, includeAnswerKey = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const allSheets = Array.from({ length: sheets }, () => pgMakeMult(min, max, count));

    allSheets.forEach((probs, si) => {
        if (si) doc.addPage();
        const title = sheets > 1
            ? `Multiplication Practice · Sheet ${si + 1} of ${sheets}`
            : 'Multiplication Practice';
        pgHeader(doc, title);
        pgDrawMultProblems(doc, probs, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, false);

        // If including answer key inline, append it on same or next page
        if (includeAnswerKey) {
            let y = PG_GRID_Y + PG_GRID_H + 5;
            if (y > PG_H - 40) {
                doc.addPage();
                y = pgHeader(doc, 'Answer Keys') + 3;
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`Answers — Sheet ${si + 1}:`, PG_GRID_X, y);
            y += 4;
            pgDrawMultProblems(doc, probs, PG_GRID_X, y, PG_GRID_W, PG_H - y - 10, true);
        }
    });

    if (!includeAnswerKey) {
        // Original behavior: separate answer key pages
        pgAnswerKeySeparator(doc);
        allSheets.forEach((probs, si) => {
            doc.addPage();
            const title = sheets > 1
                ? `Multiplication — Answer Key · Sheet ${si + 1}`
                : 'Multiplication — Answer Key';
            pgHeader(doc, title);
            pgDrawMultProblems(doc, probs, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, true);
        });
    }

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

function pgMakeBonds(target, count) {
    // Each bond: whole = target, one part shown, the other blank.
    return Array.from({ length: count }, () => {
        const known = Math.floor(Math.random() * (target + 1));  // 0..target
        const missing = target - known;
        const knownIsLeft = Math.random() < 0.5;
        return { whole: target, known, missing, knownIsLeft };
    });
}

/**
 * Draw a single number-bond diagram centered in its cell.
 * Whole circle on top, two part circles below connected by lines.
 */
function pgDrawBond(doc, bond, cx, cellTop, cellW, cellH, showAnswer) {
    const r = Math.min(cellW, cellH) * 0.16;     // circle radius
    const wholeY = cellTop + cellH * 0.30;       // whole circle center Y
    const partY  = cellTop + cellH * 0.70;       // part circles center Y
    const dx     = cellW * 0.26;                 // horizontal spread of parts
    const leftX  = cx - dx;
    const rightX = cx + dx;

    doc.setDrawColor(0);
    doc.setLineWidth(0.4);

    // Connector lines (drawn first so circles sit on top)
    doc.line(cx, wholeY + r, leftX, partY - r);
    doc.line(cx, wholeY + r, rightX, partY - r);

    // Circles
    doc.circle(cx, wholeY, r);
    doc.circle(leftX, partY, r);
    doc.circle(rightX, partY, r);

    // Values
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.min(18, r * 3.2));
    const ty = (y) => y + r * 0.45;  // vertical centering tweak

    doc.text(String(bond.whole), cx, ty(wholeY), { align: 'center' });

    const leftVal  = bond.knownIsLeft ? bond.known   : bond.missing;
    const rightVal = bond.knownIsLeft ? bond.missing : bond.known;
    const leftShown  = bond.knownIsLeft || showAnswer;
    const rightShown = !bond.knownIsLeft || showAnswer;

    if (leftShown)  doc.text(String(leftVal),  leftX,  ty(partY), { align: 'center' });
    if (rightShown) doc.text(String(rightVal), rightX, ty(partY), { align: 'center' });
}

function pgDrawBonds(doc, bonds, gridX, gridY, gridW, gridH, showAnswers) {
    const count = bonds.length;
    const COLS  = 3;
    const ROWS  = Math.ceil(count / COLS);
    const { cellW, cellH } = pgDrawLayoutGrid(doc, gridX, gridY, gridW, gridH, COLS, ROWS);

    bonds.forEach((bond, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cx       = gridX + col * cellW + cellW / 2;
        const cellTop  = gridY + row * cellH;
        pgDrawBond(doc, bond, cx, cellTop, cellW, cellH, showAnswers);
    });
}

function pgPDFBonds(target, count, sheets, includeAnswerKey = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const allSheets = Array.from({ length: sheets }, () => pgMakeBonds(target, count));

    allSheets.forEach((bonds, si) => {
        if (si) doc.addPage();
        const title = sheets > 1
            ? `Number Bonds — Make ${target} · Sheet ${si + 1} of ${sheets}`
            : `Number Bonds — Make ${target}`;
        pgHeader(doc, title);
        pgDrawBonds(doc, bonds, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, false);

        // If including answer key inline, append it on same or next page
        if (includeAnswerKey) {
            let y = PG_GRID_Y + PG_GRID_H + 5;
            if (y > PG_H - 40) {
                doc.addPage();
                y = pgHeader(doc, 'Answer Keys') + 3;
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`Answers — Sheet ${si + 1}:`, PG_GRID_X, y);
            y += 4;
            pgDrawBonds(doc, bonds, PG_GRID_X, y, PG_GRID_W, PG_H - y - 10, true);
        }
    });

    if (!includeAnswerKey) {
        // Original behavior: separate answer key pages
        pgAnswerKeySeparator(doc);
        allSheets.forEach((bonds, si) => {
            doc.addPage();
            const title = sheets > 1
                ? `Number Bonds — Answer Key · Sheet ${si + 1}`
                : `Number Bonds — Answer Key`;
            pgHeader(doc, title);
            pgDrawBonds(doc, bonds, PG_GRID_X, PG_GRID_Y, PG_GRID_W, PG_GRID_H, true);
        });
    }

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

function pgDrawCipherKeyTable(doc, rev, x, y, compact = false, cipherType = 'letter', colSpacing = 40) {
    const alpha  = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const fs     = compact ? 10 : 12;
    const rowH   = compact ? 8  : 10;
    const perCol = 13;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fs);

    for (let i = 0; i < 26; i++) {
        const row = i % perCol;
        const col = Math.floor(i / perCol);
        const px  = x + col * colSpacing;
        const py  = y + row * rowH;

        const ch = alpha[i];
        let decoded = rev ? rev[ch] : '___';

        doc.text(`${ch}→${decoded}`, px, py);
    }
}

/**
 * Simulate word-wrap layout to build page chunks that respect the grid.
 * Returns an array of strings — one per page.
 */
// Returns an array of pages; each page is an array of plain word-strings (and '\n' sentinels).
// Uses identical col/row tracking as pgDrawCipherCells to guarantee agreement.
function pgCipherSplitToPages(words, textCols, rowsPerPage) {
    const pages = [];
    let pageWords = [], col = 0, row = 0;

    const pushPage = () => { pages.push(pageWords); pageWords = []; col = 0; row = 0; };

    for (let wi = 0; wi < words.length; wi++) {
        const word = words[wi];
        if (!word) continue;

        if (word === '\n') {
            // Force advance to next row
            pageWords.push(word);
            col = 0; row++;
            if (row >= rowsPerPage) pushPage();
            continue;
        }

        const len = word.length;
        // Wrap to next row if word doesn't fit on current row
        if (col > 0 && col + len > textCols) { col = 0; row++; }
        if (row >= rowsPerPage) pushPage();

        pageWords.push(word);
        col += len;

        // Separator cell between words (not after last word)
        if (wi < words.length - 1 && words[wi + 1] !== '\n') {
            col++;
            if (col >= textCols) { col = 0; row++; }
            if (row >= rowsPerPage) pushPage();
        }
    }
    if (pageWords.length) pages.push(pageWords);
    return pages;
}

/**
 * Place encoded cipher text exactly one token per grid cell.
 * @param {Array<string[]>} wordTokens - array of words, each word is array of cipher token strings
 * @param {string} cipherType - 'letter' | 'number' | 'glyph'
 */
function pgDrawCipherCells(doc, wordTokens, gridX, gridY, cellW, cellH, textCols, totalRows, cipherType) {
    const textY = cellH * 0.30;  // cipher char near top of cell
    const lineY = cellH * 0.72;  // underline below, leaving room for decoded letter
    const fs    = Math.min(9, cellH * 0.85);

    doc.setLineWidth(0.4);
    doc.setDrawColor(0);

    let col = 0, row = 0;

    for (let wi = 0; wi < wordTokens.length; wi++) {
        const tokens = wordTokens[wi];

        // Handle newline sentinel: force next row
        if (tokens.length === 1 && tokens[0] === '\n') {
            col = 0; row++;
            if (row >= totalRows) break;
            continue;
        }

        if (col > 0 && col + tokens.length > textCols) { row++; col = 0; }
        if (row >= totalRows) break;

        for (let ti = 0; ti < tokens.length; ti++) {
            if (col >= textCols) { row++; col = 0; }
            if (row >= totalRows) break;

            const token = tokens[ti];
            const cx = gridX + col * cellW;
            const cy = gridY + row * cellH;

            if (cipherType === 'glyph') {
                doc.setFont('zapfdingbats', 'normal');
            } else if (cipherType === 'rune') {
                doc.setFont('helvetica', 'normal');
            } else {
                doc.setFont('helvetica', 'bold');
            }
            doc.setFontSize(fs);
            doc.text(token, cx + cellW / 2, cy + textY, { align: 'center' });
            doc.setFont('helvetica', 'bold');

            // Underline in every cell (student writes decoded letter here)
            doc.line(cx + cellW * 0.12, cy + lineY, cx + cellW * 0.88, cy + lineY);
            col++;
        }

        // One blank separator cell between words (not before a newline sentinel)
        const nextIsNewline = wi + 1 < wordTokens.length &&
            wordTokens[wi + 1].length === 1 && wordTokens[wi + 1][0] === '\n';
        if (wi < wordTokens.length - 1 && !nextIsNewline) {
            col++;
            if (col >= textCols) { col = 0; row++; }
        }
    }
}

/**
 * Draw cipher key: 2 rows of 13 pairs showing plain letter = cipher token.
 * @param {Object} fwdMap - maps plain letter → cipher token
 */
function pgDrawCipherKeySeparate(doc, fwdMap, keyX, keyY, cipherType) {
    const alpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const row1 = alpha.slice(0, 13);
    const row2 = alpha.slice(13, 26);

    const lineHeight = 8;
    const pairWidth  = 14.8;

    [row1, row2].forEach((row, rowIdx) => {
        const y = keyY + rowIdx * lineHeight;

        for (let i = 0; i < row.length; i++) {
            const ch     = row[i];
            const mapped = fwdMap[ch];
            const x      = keyX + i * pairWidth;

            // Draw "A=" in helvetica
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            const prefix = `${ch}=`;
            doc.text(prefix, x, y);

            // Draw the cipher token (may need a different font for glyph/rune ciphers)
            const prefixW = doc.getTextWidth(prefix);
            if (cipherType === 'glyph') {
                doc.setFont('zapfdingbats', 'normal');
            } else if (cipherType === 'rune') {
                doc.setFont('helvetica', 'normal');
            }
            doc.setFontSize(13);
            doc.text(mapped, x + prefixW, y);
            doc.setFont('helvetica', 'bold');
        }
    });
}

/**
 * Draw the A–Z cipher key at the top, with 2 cells per entry (cipher char + equivalent).
 * Rows are filled from left to right based on ENTRIES_PER_KEY_ROW.
 */
function pgDrawCipherKeyTop(doc, revMap, gridX, gridY, cellW, cellH, gridCols, entriesPerRow, cipherType) {
    const alpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const fsLetter = Math.min(10, cellH * 1.0);  // Larger font for plain letters
    const fsValue  = Math.min(11, cellH * 1.1);  // Even larger for cipher values
    const textYTop = cellH * 0.2;  // Position near top of cell with margin

    doc.setLineWidth(0.4);
    doc.setDrawColor(0);

    for (let i = 0; i < 26; i++) {
        const row    = Math.floor(i / entriesPerRow);
        const colPos = i % entriesPerRow;
        const ch = alpha[i];

        // Each entry uses 2 columns
        const col = colPos * 2;
        const letterX = gridX + col * cellW;
        const letterY = gridY + row * cellH;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fsLetter);
        doc.text(ch, letterX + cellW / 2, letterY + textYTop, { align: 'center' });

        // Second cell: decoded equivalent (larger, no underline)
        if (revMap) {
            const decodedX = letterX + cellW;
            const decodedY = letterY;

            const decoded = revMap[ch];
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fsValue);
            try {
                doc.text(decoded, decodedX + cellW / 2, decodedY + textYTop, { align: 'center' });
            } catch (e) {
                // If glyph can't be rendered (unicode issue), show a placeholder or skip
                // For now, just skip rendering if it fails
                console.warn(`Could not render glyph for ${ch}: ${e.message}`);
            }
        }
    }
}

function pgPDFCipher(text, _unused, cipherType = 'letter', glyphFont = 'dingbat', gridSize = 'small', showGridlines = true, showKeyOnPage = false, includeAnswerKey = false) {
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ unit: 'mm', format: 'letter' });
    const alpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

    // Determine if we're using rune cipher (sub-type of glyph)
    const isRune = cipherType === 'glyph' && glyphFont === 'rune';
    const effectiveCipherType = isRune ? 'rune' : cipherType;

    let GRID_COLS, TEXT_ROWS;
    if (gridSize === 'large') {
        GRID_COLS = 13; TEXT_ROWS = 11;
    } else if (gridSize === 'medium') {
        GRID_COLS = 20; TEXT_ROWS = 14;
    } else {
        GRID_COLS = 26; TEXT_ROWS = 16;
    }

    const TEXT_COLS = GRID_COLS;
    const cellW     = PG_GRID_W / GRID_COLS;
    const keyHeight = showKeyOnPage ? 25 : 0;
    const cellH     = (PG_GRID_H - keyHeight) / TEXT_ROWS;
    const keyY      = PG_GRID_Y;
    const messageY  = PG_GRID_Y + keyHeight;

    // Parse input text, preserving newlines as '\n' sentinels between lines
    const inputLines = text.split('\n');
    const allWords = [];
    inputLines.forEach((line, i) => {
        const words = line.split(/\s+/).filter(Boolean);
        allWords.push(...words);
        if (i < inputLines.length - 1) allWords.push('\n');
    });

    // origChunks: array of pages, each page is array of plain word-strings (and '\n' sentinels)
    const origChunks = pgCipherSplitToPages(allWords, TEXT_COLS, TEXT_ROWS);

    const ciphers = origChunks.map(() =>
        effectiveCipherType === 'letter' ? pgMakeCipherMap()       :
        effectiveCipherType === 'number' ? pgMakeCipherMapNumber() :
        effectiveCipherType === 'rune'   ? pgMakeCipherMapRune()   :
                                           pgMakeCipherMapGlyph()
    );

    // Encrypt each page's words into token arrays
    const encWordChunks = origChunks.map((words, i) => pgEncryptWords(words, ciphers[i].fwd));

    // ── Encoded text pages ────────────────────────────────────────────────
    encWordChunks.forEach((wordTokens, i) => {
        if (i > 0) doc.addPage();
        const suffix = encWordChunks.length > 1 ? ` — Page ${i + 1} of ${encWordChunks.length}` : '';
        pgHeader(doc, `Encoded Text${suffix}`);

        if (showKeyOnPage) {
            pgDrawCipherKeySeparate(doc, ciphers[i].fwd, PG_GRID_X, keyY, effectiveCipherType);
        }

        if (showGridlines) {
            pgDrawCipherGrid(doc, PG_GRID_X, messageY, PG_GRID_W, TEXT_ROWS * cellH, GRID_COLS, TEXT_ROWS, 0);
        }

        pgDrawCipherCells(doc, wordTokens, PG_GRID_X, messageY, cellW, cellH, TEXT_COLS, TEXT_ROWS, effectiveCipherType);
    });

    // ── Answer key section ────────────────────────────────────────────────
    if (includeAnswerKey) {
        doc.addPage();
        let y = PG_GRID_Y;

        origChunks.forEach((origWords, i) => {
            const fwd     = ciphers[i].fwd;
            const mapping = alpha.map(ch => `${ch}:${fwd[ch]}`).join('   ');

            const isGlyphType = effectiveCipherType === 'glyph' || effectiveCipherType === 'rune';
            // Estimate height needed for this entry
            const keyBlockH = isGlyphType ? 22 : 10;
            const origText  = origWords.filter(w => w !== '\n').join(' ');
            const origLines = doc.splitTextToSize(`Original: ${origText}`, PG_GRID_W);
            const entryH    = (origChunks.length > 1 ? 8 : 0) + keyBlockH + origLines.length * 3.5 + 4;
            if (i > 0 && y + entryH > PG_H - 15) { doc.addPage(); y = PG_GRID_Y; }

            if (origChunks.length > 1) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text(`Page ${i + 1}:`, PG_GRID_X, y);
                y += 5;
            }

            if (!isGlyphType) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                const keyLines = doc.splitTextToSize(mapping, PG_GRID_W);
                doc.text(keyLines, PG_GRID_X, y);
                y += keyLines.length * 3 + 2;
            } else {
                pgDrawCipherKeySeparate(doc, fwd, PG_GRID_X, y, effectiveCipherType);
                y += 20;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(origLines, PG_GRID_X, y);
            y += origLines.length * 3.5 + 6;
        });
    }

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
}

// --- Per-screen generate functions ---

function pgSetType(type) {
    // Show active button and hide all configs except the selected type
    document.querySelectorAll('#worksheets-screen .pg-type-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.type === type));
    ['addition', 'subtraction', 'multiplication', 'division', 'bonds'].forEach(t => {
        const el = document.getElementById(`pg-${t}-config`);
        if (el) el.classList.toggle('hidden', t !== type);
    });
}

function pgCheckJsPDF() {
    if (!window.jspdf) {
        alert('PDF library is still loading — please try again in a moment.');
        return false;
    }
    return true;
}

function pgGenerateSudoku() {
    if (!pgCheckJsPDF()) return;
    const size    = parseInt(document.getElementById('pg-sudoku-size').value, 10);
    const symbols = document.getElementById('pg-sudoku-symbols').value;
    const diff    = document.getElementById('pg-sudoku-diff').value;
    const sheets  = parseInt(document.getElementById('pg-sudoku-sheets').value, 10);
    pgPDFSudoku(sheets, size, diff, symbols);
}

function pgGenerateWorksheets() {
    if (!pgCheckJsPDF()) return;
    const type = document.querySelector('#worksheets-screen .pg-type-btn.active').dataset.type;
    const activeConfig = document.getElementById(`pg-${type}-config`);
    const includeAnswerKey = activeConfig.querySelector('.pg-answer-key').checked;

    if (type === 'bonds') {
        const target = parseInt(activeConfig.querySelector('select').value, 10);
        const count  = parseInt(activeConfig.querySelectorAll('select')[1].value, 10);
        const sheets = parseInt(activeConfig.querySelectorAll('select')[2].value, 10);
        pgPDFBonds(target, count, sheets, includeAnswerKey);
    } else {
        const max    = parseInt(activeConfig.querySelector('.op-toggle.active')?.dataset.max || '10', 10);
        const count  = parseInt(activeConfig.querySelector('.pg-count').value, 10);
        const sheets = parseInt(activeConfig.querySelector('.pg-sheets').value, 10);
        pgPDFArithmetic(type, max, count, sheets, includeAnswerKey);
    }
}

function pgGenerateCiphers() {
    if (!pgCheckJsPDF()) return;
    const text = document.getElementById('pg-cipher-text').value.trim();
    if (!text) { alert('Please paste some text for the cipher.'); return; }
    const cipherType      = document.getElementById('pg-cipher-type').value;
    const glyphFont       = document.getElementById('pg-cipher-glyph-font').value;
    const gridSize        = document.getElementById('pg-cipher-grid-size').value;
    const showGridlines   = document.getElementById('pg-cipher-gridlines').checked;
    const showKey         = document.getElementById('pg-cipher-show-key').checked;
    const includeAnswerKey = document.getElementById('pg-cipher-answer-key').checked;
    pgPDFCipher(text, null, cipherType, glyphFont, gridSize, showGridlines, showKey, includeAnswerKey);
}

// ============================================
// CIPHER SOLVER
// ============================================

const CS_ALPHA = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];  // index 0 = unset
const CS_ALL26 = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

const csState = {
    cipherText: '',   // raw encoded text (preserves case/punctuation/newlines)
    plainText:  '',   // normalised answer for checking (letters only, uppercase)
    mapping:    {},   // cipherChar(upper) → guessed plainChar(upper) | ''
    solved:     false,
    drag:       null,
    inputMode:  'cipher', // 'cipher' | 'plain'
};

// ---- Setup ----

function csInferMapping(cipherText, plainText) {
    const mapping = {};
    const cl = [...cipherText.toUpperCase()].filter(c => /[A-Z]/.test(c));
    const pl = [...plainText.toUpperCase()].filter(c => /[A-Z]/.test(c));
    const len = Math.min(cl.length, pl.length);
    for (let i = 0; i < len; i++) {
        const c = cl[i], p = pl[i];
        if (!mapping[c]) mapping[c] = p;
        // conflicts stay as first mapping; csMarkCollisions will flag duplicates
    }
    return mapping;
}

function csStart() {
    const cipherRaw = document.getElementById('pg-cipher-text').value;
    if (!cipherRaw.trim()) { alert('Please paste a cipher text to solve.'); return; }
    const plainRaw = document.getElementById('cs-plain-input').value;

    const textChanged = cipherRaw !== csState.cipherText;
    csState.cipherText = cipherRaw;
    csState.plainText  = plainRaw.toUpperCase().replace(/[^A-Z]/g, '');
    csState.solved     = false;

    if (textChanged) {
        csState.mapping = plainRaw.trim() ? csInferMapping(cipherRaw, plainRaw) : {};
    }

    document.getElementById('cs-input-panel').classList.add('hidden');
    document.getElementById('cs-solver').classList.remove('hidden');
    document.getElementById('cs-solved-banner').classList.add('hidden');

    csRenderKeyRow();
    csRenderGrid();
    csUpdateAllCells();
    csMarkCollisions();
    csUpdateStatus();
}

function csEdit() {
    document.getElementById('cs-input-panel').classList.remove('hidden');
    document.getElementById('cs-solver').classList.add('hidden');
}

function csReset() {
    csState.mapping = {};
    csState.solved  = false;
    document.getElementById('cs-grid').classList.remove('cs-solved');
    document.getElementById('cs-solved-banner').classList.add('hidden');
    csUpdateAllCells();
    csMarkCollisions();
    csUpdateStatus();
}

// ---- Share / URL ----

function csShare() {
    const mapStr = CS_ALL26.map(ch => csState.mapping[ch] || '.').join('');
    const encoded = btoa(unescape(encodeURIComponent(csState.cipherText)));
    const url = location.origin + location.pathname + '#cs=' + encodeURIComponent(mapStr + '|' + encoded);
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('cs-share-btn');
        const old = btn.textContent;
        btn.textContent = 'COPIED!';
        setTimeout(() => { btn.textContent = old; }, 1600);
    }).catch(() => { alert('URL:\n' + url); });
}

function csLoadFromHash() {
    if (!location.hash.startsWith('#cs=')) return;
    try {
        const raw = decodeURIComponent(location.hash.slice(4));
        const pipe = raw.indexOf('|');
        if (pipe < 26) return;
        const mapStr     = raw.slice(0, pipe);
        const cipherText = decodeURIComponent(escape(atob(raw.slice(pipe + 1))));
        const mapping = {};
        CS_ALL26.forEach((ch, i) => { if (mapStr[i] && mapStr[i] !== '.') mapping[ch] = mapStr[i]; });
        csState.cipherText = cipherText;
        csState.plainText  = '';
        csState.mapping    = mapping;
        csState.solved     = false;
        // Navigate to the ciphers tab
        document.querySelector('[data-tab="ciphers"]').click();
        document.getElementById('pg-cipher-text').value = cipherText;
        document.getElementById('cs-input-panel').classList.add('hidden');
        document.getElementById('cs-solver').classList.remove('hidden');
        document.getElementById('cs-solved-banner').classList.add('hidden');
        csRenderKeyRow();
        csRenderGrid();
        csUpdateAllCells();
        csMarkCollisions();
        csUpdateStatus();
        csCheckSolved();
    } catch (_) { /* malformed hash — ignore */ }
}

// ---- Key row rendering ----

function csRenderKeyRow() {
    const row = document.getElementById('cs-key-row');
    row.innerHTML = '';
    CS_ALL26.forEach(ch => row.appendChild(csMakeKeyCell(ch)));
    row.addEventListener('pointerdown', csPointerDown);
    row.addEventListener('wheel', csWheel, { passive: false });
}

function csMakeKeyCell(letter) {
    const cell = document.createElement('div');
    cell.className = 'cs-cell cs-key-cell';
    cell.dataset.cipher = letter;
    cell.dataset.isLetter = '1';

    const cipherEl = document.createElement('div');
    cipherEl.className = 'cs-cipher-char';
    cipherEl.textContent = letter;

    const guessWrap = document.createElement('div');
    guessWrap.className = 'cs-guess-wrap';

    const guessEl = document.createElement('div');
    guessEl.className = 'cs-guess-char cs-unset';
    guessEl.textContent = '_';

    guessWrap.appendChild(guessEl);
    cell.appendChild(cipherEl);
    cell.appendChild(guessWrap);
    return cell;
}

// ---- Grid rendering ----

function csRenderGrid() {
    const grid = document.getElementById('cs-grid');
    grid.innerHTML = '';
    grid.classList.remove('cs-solved');

    const lines = csState.cipherText.split('\n');

    lines.forEach((line, li) => {
        if (li > 0) {
            const br = document.createElement('div');
            br.className = 'cs-linebreak';
            grid.appendChild(br);
        }

        const parts = line.split(' ');
        parts.forEach((word, wi) => {
            if (wi > 0) {
                const sp = document.createElement('div');
                sp.className = 'cs-space';
                grid.appendChild(sp);
            }
            if (!word) return;

            const wordDiv = document.createElement('div');
            wordDiv.className = 'cs-word';
            for (const ch of word) wordDiv.appendChild(csMakeCell(ch));
            grid.appendChild(wordDiv);
        });
    });

    grid.addEventListener('pointerdown', csPointerDown);
    grid.addEventListener('wheel', csWheel, { passive: false });
}

function csMakeCell(ch) {
    const upper = ch.toUpperCase();
    const isLetter = /[A-Z]/.test(upper);

    const cell = document.createElement('div');
    cell.className = 'cs-cell' + (isLetter ? '' : ' cs-nonletter');
    cell.dataset.cipher = upper;
    if (isLetter) cell.dataset.isLetter = '1';

    const cipherEl = document.createElement('div');
    cipherEl.className = 'cs-cipher-char';
    cipherEl.textContent = ch;

    const guessWrap = document.createElement('div');
    guessWrap.className = 'cs-guess-wrap';

    const guessEl = document.createElement('div');
    guessEl.className = 'cs-guess-char' + (isLetter ? ' cs-unset' : '');
    guessEl.textContent = isLetter ? '_' : ch;

    guessWrap.appendChild(guessEl);
    cell.appendChild(cipherEl);
    cell.appendChild(guessWrap);
    return cell;
}

// ---- Touch / pointer / wheel interaction ----

function csPointerDown(e) {
    if (csState.solved) return;
    const cell = e.target.closest('.cs-cell[data-is-letter]');
    if (!cell) return;
    e.preventDefault();
    cell.setPointerCapture(e.pointerId);

    csState.drag = {
        cell,
        cipherChar: cell.dataset.cipher,
        startY:     e.clientY,
        prevSteps:  0,
        moved:      false,
    };

    cell.addEventListener('pointermove', csPointerMove);
    cell.addEventListener('pointerup',   csPointerUp);
    cell.addEventListener('pointercancel', csPointerUp);
}

function csPointerMove(e) {
    const d = csState.drag;
    if (!d) return;
    const deltaY = d.startY - e.clientY;

    const guessEl = d.cell.querySelector('.cs-guess-char');
    const subPx = ((deltaY % 28) + 28) % 28 - 14;
    guessEl.style.transform = `translateY(${-subPx * 0.6}px)`;

    const steps = Math.round(deltaY / 28);
    const delta = steps - d.prevSteps;
    if (delta !== 0) {
        d.prevSteps = steps;
        d.moved = true;
        csCycle(d.cipherChar, delta);
    }
}

function csPointerUp(e) {
    const d = csState.drag;
    if (!d) return;

    const guessEl = d.cell.querySelector('.cs-guess-char');
    guessEl.style.transform = '';

    if (!d.moved) csCycle(d.cipherChar, 1);

    d.cell.removeEventListener('pointermove', csPointerMove);
    d.cell.removeEventListener('pointerup',   csPointerUp);
    d.cell.removeEventListener('pointercancel', csPointerUp);
    csState.drag = null;
}

function csWheel(e) {
    if (csState.solved) return;
    const cell = e.target.closest('.cs-cell[data-is-letter]');
    if (!cell) return;
    e.preventDefault();
    csCycle(cell.dataset.cipher, e.deltaY > 0 ? 1 : -1);
}

// ---- Mapping logic ----

function csCycle(cipherChar, delta) {
    if (csState.solved) return;
    const cur  = CS_ALPHA.indexOf(csState.mapping[cipherChar] || '');
    const next = ((cur + delta) % CS_ALPHA.length + CS_ALPHA.length) % CS_ALPHA.length;
    csState.mapping[cipherChar] = CS_ALPHA[next];
    csUpdateCipherChar(cipherChar);
    csMarkCollisions();
    csUpdateStatus();
    csCheckSolved();
}

function csUpdateCipherChar(cipherChar) {
    const guess = csState.mapping[cipherChar] || '';
    // Update grid cells
    document.querySelectorAll(`#cs-grid .cs-cell[data-cipher="${CSS.escape(cipherChar)}"][data-is-letter]`)
        .forEach(cell => {
            const guessEl = cell.querySelector('.cs-guess-char');
            guessEl.textContent = guess || '_';
            guessEl.classList.toggle('cs-unset', !guess);
        });
    // Update key row cell
    const keyCell = document.querySelector(`#cs-key-row .cs-cell[data-cipher="${CSS.escape(cipherChar)}"]`);
    if (keyCell) {
        const guessEl = keyCell.querySelector('.cs-guess-char');
        guessEl.textContent = guess || '_';
        guessEl.classList.toggle('cs-unset', !guess);
    }
}

function csUpdateAllCells() {
    CS_ALL26.forEach(ch => csUpdateCipherChar(ch));
}

function csMarkCollisions() {
    // Build reverse map: plainChar → [cipherChars]
    const reverse = {};
    for (const [cipher, plain] of Object.entries(csState.mapping)) {
        if (!plain) continue;
        (reverse[plain] = reverse[plain] || []).push(cipher);
    }
    const collisions = new Set();
    for (const ciphers of Object.values(reverse)) {
        if (ciphers.length > 1) ciphers.forEach(c => collisions.add(c));
    }
    document.querySelectorAll('.cs-cell[data-is-letter]').forEach(cell => {
        cell.classList.toggle('cs-collision', collisions.has(cell.dataset.cipher));
    });
}

function csUpdateStatus() {
    const chars = new Set();
    document.querySelectorAll('#cs-grid .cs-cell[data-is-letter]').forEach(c => chars.add(c.dataset.cipher));
    const total  = chars.size;
    const filled = [...chars].filter(c => csState.mapping[c]).length;
    document.getElementById('cs-status').textContent =
        total ? `${filled} / ${total} letters mapped` : '';
}

// ---- Win check ----

function csCheckSolved() {
    if (!csState.plainText) return;

    const decoded = [...csState.cipherText.toUpperCase()]
        .filter(ch => /[A-Z]/.test(ch))
        .map(ch => csState.mapping[ch] || '')
        .join('');

    if (decoded === csState.plainText) {
        csState.solved = true;
        document.getElementById('cs-grid').classList.add('cs-solved');
        document.getElementById('cs-solved-banner').classList.remove('hidden');
    }
}

// ============================================
// TIMES TABLES GRID
// ============================================

const ttState = {
    mode: 'explore',   // 'explore' | 'quiz'
    max:  10,
    revealed: {},      // "r,c" → true (explore mode reveal state)
    active:   null,    // {r, c} currently being quizzed
};

function ttInit() {
    ttState.revealed = {};
    ttState.active   = null;
    ttState.max      = parseInt(document.getElementById('tt-max').value, 10);
    ttRenderGrid();
    ttUpdateModeUI();
}

function ttMastery(r, c)        { return parseInt(localStorage.getItem(`ttFact_${r}x${c}`) || '0', 10); }
function ttBumpMastery(r, c)    { localStorage.setItem(`ttFact_${r}x${c}`, String(ttMastery(r, c) + 1)); }

function ttSetMode(mode) {
    ttState.mode   = mode;
    ttState.active = null;
    ttRenderGrid();
    ttUpdateModeUI();
}

function ttUpdateModeUI() {
    document.querySelectorAll('.tt-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.ttMode === ttState.mode));
    const isQuiz = ttState.mode === 'quiz';
    document.getElementById('tt-quiz-bar').classList.toggle('hidden', !isQuiz);
    document.getElementById('tt-equation').classList.toggle('hidden', isQuiz);
    if (isQuiz) {
        ttAutoSelect();
    } else {
        ttClearQuizPrompt();
        document.getElementById('tt-equation').textContent = '';
    }
}

function ttRenderGrid() {
    const grid = document.getElementById('tt-grid');
    const n = ttState.max;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${n + 1}, 1fr)`;

    for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
            const cell = document.createElement('div');
            if (r === 0 && c === 0) {
                cell.className = 'tt-cell tt-corner';
                cell.textContent = '×';
            } else if (r === 0) {
                cell.className = 'tt-cell tt-header';
                cell.textContent = c;
            } else if (c === 0) {
                cell.className = 'tt-cell tt-header';
                cell.textContent = r;
            } else {
                cell.className = 'tt-cell tt-answer';
                cell.dataset.r = r;
                cell.dataset.c = c;
                const key = `${r},${c}`;
                if (ttState.mode === 'explore' && ttState.revealed[key]) {
                    cell.textContent = r * c;
                    cell.classList.add('tt-filled');
                }
            }
            grid.appendChild(cell);
        }
    }

    grid.onclick = ttGridClick;
}

function ttGridClick(e) {
    const cell = e.target.closest('.tt-answer');
    if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;

    if (ttState.mode === 'explore') {
        const key = `${r},${c}`;
        ttState.revealed[key] = !ttState.revealed[key];
        const eq = document.getElementById('tt-equation');
        if (ttState.revealed[key]) {
            cell.textContent = r * c;
            cell.classList.add('tt-filled');
            eq.textContent = `${r} × ${c} = ${r * c}`;
        } else {
            cell.textContent = '';
            cell.classList.remove('tt-filled');
            eq.textContent = '';
        }
        ttHighlightFactors(r, c, ttState.revealed[key]);
    } else {
        ttStartQuiz(r, c, cell);
    }
}

function ttAutoSelect() {
    const n = ttState.max;
    // Prefer cells not yet answered correctly this session; weight toward low mastery
    const candidates = [];
    for (let r = 1; r <= n; r++) {
        for (let c = 1; c <= n; c++) {
            const cell = document.querySelector(`.tt-answer[data-r="${r}"][data-c="${c}"]`);
            if (cell && !cell.classList.contains('tt-filled')) candidates.push({ r, c });
        }
    }
    if (!candidates.length) { ttClearQuizPrompt(); return; }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const cell = document.querySelector(`.tt-answer[data-r="${pick.r}"][data-c="${pick.c}"]`);
    ttStartQuiz(pick.r, pick.c, cell);
}

function ttHighlightFactors(r, c, on) {
    document.querySelectorAll('.tt-header').forEach(h => h.classList.remove('tt-hl'));
    if (!on) return;
    const cells = document.querySelectorAll('.tt-cell');
    const n = ttState.max;
    // header for column c is at index c; header for row r is at index r*(n+1)
    cells[c]?.classList.add('tt-hl');
    cells[r * (n + 1)]?.classList.add('tt-hl');
}

function ttStartQuiz(r, c, cell) {
    document.querySelectorAll('.tt-answer.tt-active').forEach(x => x.classList.remove('tt-active'));
    cell.classList.add('tt-active');
    ttState.active = { r, c };
    ttHighlightFactors(r, c, true);
    document.getElementById('tt-quiz-prompt').textContent = `${r} × ${c} =`;
    const input = document.getElementById('tt-quiz-input');
    input.value = '';
    input.focus();
}

function ttClearQuizPrompt() {
    document.getElementById('tt-quiz-prompt').textContent = '';
    document.getElementById('tt-quiz-input').value = '';
    ttState.active = null;
    document.querySelectorAll('.tt-answer.tt-active').forEach(x => x.classList.remove('tt-active'));
    ttHighlightFactors(0, 0, false);
}

function ttSubmitQuiz() {
    if (!ttState.active) return;
    const { r, c } = ttState.active;
    const input = document.getElementById('tt-quiz-input');
    const guess = parseInt(input.value, 10);
    const cell = document.querySelector(`.tt-answer[data-r="${r}"][data-c="${c}"]`);
    if (guess === r * c) {
        cell.textContent = r * c;
        cell.classList.add('tt-filled');
        cell.classList.remove('tt-active', 'tt-wrong');
        ttBumpMastery(r, c);
        ttAutoSelect();   // auto-advance to the next cell
    } else {
        cell.classList.add('tt-wrong');
        setTimeout(() => cell.classList.remove('tt-wrong'), 400);
        input.value = '';
        input.focus();
    }
}

// ============================================
// FRACTIONS — COMPARE TWO
// ============================================

const frState = {
    mode:   'compare',  // 'compare' | 'identify'
    maxDen: 6,
    shape:  'bar',
    score:  0,
    bigger: 0,   // index (0 or 1) of the larger fraction
    idFrac: null, // {num, den} for identify mode
    locked: false,
};

function frInit() {
    frState.maxDen = parseInt(document.getElementById('fr-max-den').value, 10);
    frState.score  = 0;
    frUpdateScore();
    document.getElementById('fr-feedback').textContent = '';
    frNewRound();
}

function frSetMode(mode) {
    frState.mode = mode;
    document.querySelectorAll('.fr-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.frMode === mode));
    document.getElementById('fr-compare').classList.toggle('hidden', mode !== 'compare');
    document.getElementById('fr-identify').classList.toggle('hidden', mode !== 'identify');
    frNewRound();
}

function frSetShape(shape) {
    frState.shape = shape;
    document.querySelectorAll('.fr-shape-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.frShape === shape));
    frNewRound();
}

function frRandFraction() {
    const den = 2 + Math.floor(Math.random() * (frState.maxDen - 1)); // 2..maxDen
    const num = 1 + Math.floor(Math.random() * (den - 1));            // 1..den-1
    return { num, den };
}

function frNewRound() {
    document.getElementById('fr-feedback').textContent = '';
    if (frState.mode === 'identify') return frNewIdentify();
    return frNewCompare();
}

function frNewIdentify() {
    frState.locked = false;
    const f = frRandFraction();
    frState.idFrac = f;
    document.getElementById('fr-id-shape').innerHTML = frRenderShape(f.num, f.den, frState.shape);
    document.getElementById('fr-id-num').value = '';
    document.getElementById('fr-id-den').value = '';
    document.getElementById('fr-id-num').focus();
}

function frCheckIdentify() {
    if (frState.locked) return;
    const num = parseInt(document.getElementById('fr-id-num').value, 10);
    const den = parseInt(document.getElementById('fr-id-den').value, 10);
    const fb = document.getElementById('fr-feedback');
    if (num === frState.idFrac.num && den === frState.idFrac.den) {
        frState.locked = true;
        fb.textContent = '✓';
        fb.className = 'feedback-display fr-fb-correct';
        frState.score++;
        frUpdateScore();
        setTimeout(frNewRound, 700);
    } else {
        fb.textContent = '✗ Try again';
        fb.className = 'feedback-display fr-fb-wrong';
    }
}

function frNewCompare() {
    frState.locked = false;
    document.getElementById('fr-feedback').textContent = '';

    let a, b, va, vb;
    do {
        a = frRandFraction();
        b = frRandFraction();
        va = a.num / a.den;
        vb = b.num / b.den;
    } while (Math.abs(va - vb) < 1e-9); // reject equal values

    frState.bigger = va > vb ? 0 : 1;

    const wrap = document.getElementById('fr-shapes');
    wrap.innerHTML = '';
    [a, b].forEach((f, i) => {
        const card = document.createElement('div');
        card.className = 'fr-shape-card';
        card.dataset.idx = i;
        card.innerHTML = frRenderShape(f.num, f.den, frState.shape) +
            `<div class="fr-label">${f.num}/${f.den}</div>`;
        card.addEventListener('click', () => frAnswer(i, card));
        wrap.appendChild(card);
    });
}

function frRenderShape(num, den, shape) {
    if (shape === 'pie') return frRenderPie(num, den);
    return frRenderBar(num, den);
}

function frRenderBar(num, den) {
    const W = 160, H = 120;
    const segW = W / den;
    let rects = '';
    for (let i = 0; i < den; i++) {
        const fill = i < num ? 'var(--fr-fill, #2e7d32)' : '#fff';
        rects += `<rect x="${i * segW}" y="0" width="${segW}" height="${H}" fill="${fill}" stroke="#000" stroke-width="2"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="fr-svg" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

function frRenderPie(num, den) {
    const R = 58, cx = 60, cy = 60;
    let paths = '';
    for (let i = 0; i < den; i++) {
        const a0 = (i / den) * 2 * Math.PI - Math.PI / 2;
        const a1 = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2;
        const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
        const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
        const large = (a1 - a0) > Math.PI ? 1 : 0;
        const fill = i < num ? 'var(--fr-fill, #2e7d32)' : '#fff';
        paths += `<path d="M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${fill}" stroke="#000" stroke-width="2"/>`;
    }
    return `<svg viewBox="0 0 120 120" class="fr-svg" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

function frAnswer(idx, card) {
    if (frState.locked) return;
    frState.locked = true;
    const fb = document.getElementById('fr-feedback');
    const cards = document.querySelectorAll('.fr-shape-card');

    if (idx === frState.bigger) {
        card.classList.add('fr-correct');
        fb.textContent = '✓';
        fb.className = 'feedback-display fr-fb-correct';
        frState.score++;
        frUpdateScore();
        setTimeout(frNewRound, 700);
    } else {
        card.classList.add('fr-wrong');
        cards[frState.bigger].classList.add('fr-correct');
        fb.textContent = '✗';
        fb.className = 'feedback-display fr-fb-wrong';
        setTimeout(frNewRound, 1300);
    }
}

function frUpdateScore() {
    document.getElementById('fr-score').textContent = `Score: ${frState.score}`;
}

// ============================================
// VISUALIZER — MAIN MODE TOGGLE
// ============================================

function vizSetMainMode(mode) {
    document.querySelectorAll('.viz-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.vizMode === mode));
    const isPlace = mode === 'place';
    document.getElementById('viz-multiply-mode').classList.toggle('hidden', isPlace);
    document.getElementById('viz-place-mode').classList.toggle('hidden', !isPlace);
    if (isPlace) pvRender(document.getElementById('pv-input').value);
}

// ============================================
// PLACE-VALUE BLOCKS (base-ten)
// ============================================

const PV_PLACES = [
    { name: 'Thousands', color: '#7e57c2' },
    { name: 'Hundreds',  color: '#1e88e5' },
    { name: 'Tens',      color: '#43a047' },
    { name: 'Ones',      color: '#fb8c00' },
];

const pvState = { speech: '' };  // last number in words, for the read-aloud button

function pvRender(raw) {
    const wrap = document.getElementById('pv-svg-wrap');
    const str = String(raw).replace(/\D/g, '');
    if (!str.length) {
        wrap.innerHTML = '<div class="pv-empty">Enter a number</div>';
        document.getElementById('pv-words').innerHTML = '';
        document.getElementById('pv-play').classList.add('hidden');
        pvState.speech = '';
        return;
    }

    // Take up to 4 digits (thousands max); pad to the number's own length
    const digits = str.slice(-4).split('').map(Number); // most-significant first
    const places = digits.length;                       // 1..4
    // Map each digit to its place definition (right-aligned within PV_PLACES)
    const used = PV_PLACES.slice(4 - places); // e.g. 3 digits → Hundreds,Tens,Ones

    const GAP = 4;             // gap between place groups, in cell units
    const LABEL_AREA = 34;     // vertical room beneath blocks for labels (cell units)
    const HEADER_AREA = 12;    // space for the formatted number header

    // Compute each group's footprint (in unit cells) without emitting yet
    const groups = used.map((def, i) => {
        const d = digits[i];
        const placeName = def.name;
        let w = 1, h = 0, pieces = [];
        if (placeName === 'Thousands') {
            // d cubes, each drawn as a 10-wide × 100-tall column (ten stacked hundred-flats)
            for (let k = 0; k < d; k++) pieces.push({ x: k * 11, y: 0, w: 10, h: 100, layers: 10 });
            w = d > 0 ? d * 11 - 1 : 6; h = d > 0 ? 100 : 0;
        } else if (placeName === 'Hundreds') {
            // d flats (10×10) stacked vertically
            for (let k = 0; k < d; k++) pieces.push({ x: 0, y: k * 11, w: 10, h: 10 });
            w = d > 0 ? 10 : 6; h = d > 0 ? d * 11 - 1 : 0;
        } else if (placeName === 'Tens') {
            // d rods (1×10) side by side
            for (let k = 0; k < d; k++) pieces.push({ x: k * 2, y: 0, w: 1, h: 10 });
            w = d > 0 ? d * 2 - 1 : 6; h = d > 0 ? 10 : 0;
        } else { // Ones
            // d unit cubes stacked vertically
            for (let k = 0; k < d; k++) pieces.push({ x: 0, y: k * 2, w: 1, h: 1 });
            w = d > 0 ? 1 : 6; h = d > 0 ? d * 2 - 1 : 0;
        }
        return { def, digit: d, w, h, pieces };
    });

    const maxH = Math.max(...groups.map(g => g.h), 1);
    let totalW = groups.reduce((s, g) => s + g.w, 0) + GAP * (groups.length - 1);

    // Format the full number with commas
    const fullNumberFormatted = parseInt(digits.join(''), 10).toLocaleString('en-US');

    // Emit SVG. Bottom-align each group at baseline = maxH.
    let body = '';
    let cursorX = 0;
    groups.forEach((g, groupIdx) => {
        const groupBottom = maxH;
        const groupTop = groupBottom - g.h;
        g.pieces.forEach(p => {
            const px = cursorX + p.x;
            const py = groupTop + p.y;
            body += pvBlock(px, py, p.w, p.h, g.def.color, p.layers);
        });
        // Label: big bold digit beneath each place group (the place name is now
        // conveyed by the colour-coded words above, so no angled label here).
        const cx = cursorX + g.w / 2;
        const ly = maxH + 13;
        body += `<text x="${cx.toFixed(2)}" y="${ly}" text-anchor="middle" class="pv-digit" fill="${g.def.color}">${g.digit}</text>`;

        // Add comma after thousands digit (when we have 4 digits)
        if (groupIdx === 0 && groups.length === 4) {
            const commaX = cursorX + g.w + GAP / 2;
            body += `<text x="${commaX.toFixed(2)}" y="${ly}" text-anchor="middle" class="pv-comma" fill="${g.def.color}" font-weight="bold">,</text>`;
        }

        cursorX += g.w + GAP;
    });

    const pad = 3;
    const vbW = totalW + pad * 2;
    const vbH = maxH + LABEL_AREA + HEADER_AREA + pad * 2;
    wrap.innerHTML =
        `<svg viewBox="${-pad} ${(-pad - HEADER_AREA)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}" ` +
        `preserveAspectRatio="xMidYMax meet" class="pv-svg" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><pattern id="pvgrid" width="1" height="1" patternUnits="userSpaceOnUse">` +
        `<rect width="1" height="1" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="0.06"/></pattern></defs>` +
        body + `</svg>`;

    pvRenderWords(parseInt(digits.join(''), 10));
}

// The number written out in words, each place coloured to match its blocks and
// digit (thousands purple, hundreds blue, tens green, ones orange; connectors
// grey). British style: "one thousand, two hundred and thirty-four".
const PV_ONES = ['zero','one','two','three','four','five','six','seven','eight','nine'];
const PV_TEENS = ['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const PV_TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

function pvWords(n) {
    const C = {}; PV_PLACES.forEach(p => C[p.name] = p.color);
    const CN = '#888';                       // connectors: commas, "and", hyphen
    const seg = [];
    const push = (text, color) => seg.push({ text, color });

    if (n === 0) {
        push('zero', C.Ones);
    } else {
        const th = Math.floor(n / 1000), rem = n % 1000;
        const h = Math.floor(rem / 100), low = rem % 100;
        if (th)  push(PV_ONES[th] + ' thousand', C.Thousands);
        if (h) { if (seg.length) push(', ', CN); push(PV_ONES[h] + ' hundred', C.Hundreds); }
        if (low) {
            if (seg.length) push(' and ', CN);
            if (low < 10)       push(PV_ONES[low], C.Ones);
            else if (low < 20)  push(PV_TEENS[low - 10], C.Tens);
            else {
                push(PV_TENS[Math.floor(low / 10)], C.Tens);
                if (low % 10) { push('-', CN); push(PV_ONES[low % 10], C.Ones); }
            }
        }
    }
    const speech = seg.map(s => s.text).join('').replace(/\s+/g, ' ').trim();
    return { segments: seg, speech };
}

function pvRenderWords(n) {
    const { segments, speech } = pvWords(n);
    document.getElementById('pv-words').innerHTML =
        segments.map(s => `<span style="color:${s.color}">${s.text}</span>`).join('');
    pvState.speech = speech;
    document.getElementById('pv-play').classList.toggle('hidden', !speech);
}

// Read the current number aloud, preferring a British English voice.
function pvSpeak() {
    if (!pvState.speech || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(pvState.speech);
    u.lang = 'en-GB';
    u.rate = 0.95;
    const voices = speechSynthesis.getVoices();
    const gb = voices.find(v => /en[-_]GB/i.test(v.lang)) ||
               voices.find(v => /United Kingdom|British|Daniel|Kate|Serena|Arthur|Oliver/i.test(v.name));
    if (gb) u.voice = gb;
    speechSynthesis.speak(u);
}

// A single base-ten piece: colored fill + unit-cell grid overlay + bold border.
// `layers` (thousands only) draws horizontal separators every 10 rows to show the
// ten stacked hundred-flats that make up a thousand-cube.
function pvBlock(x, y, w, h, color, layers) {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.85"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#pvgrid)"/>`;
    if (layers) {
        for (let L = 1; L < layers; L++) {
            const ly = y + (h / layers) * L;
            s += `<line x1="${x}" y1="${ly}" x2="${x + w}" y2="${ly}" stroke="#111" stroke-width="0.18"/>`;
        }
    }
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="0.2"/>`;
    return s;
}

// ============================================
// MONEY VISUALIZER
// ============================================

// Every piece carries its real-world width in millimetres (`mm`), and CSS sizes
// it as `mm * --mn-ppm`. So everything is to scale against everything else — a
// dime really is smaller than a penny, a note really is ~6x a quarter. A pile is
// laid out as one column per denomination; mnFitStage() sets --mn-ppm to the
// largest value where those columns still fit 90% of the box width.
//
// USD pieces are real photos hot-linked from Wikimedia Commons (public domain),
// layered over a drawn fallback. Other currencies render as drawn SVG only.
const MN_NOTE_MM = 156;    // a US note is 156 x 66.3 mm; SVG notes reuse the ratio

const MN_CURRENCIES = {
    // USD pieces are real photos hot-linked from Wikimedia Commons (all public
    // domain). `face`/`edge`/`ink` stay so mnPieceHTML can layer the photo over a
    // drawn fallback — a slow or failed fetch still shows a labelled coin/note.
    USD: {
        label: '🇺🇸 US Dollar', symbol: '$', minor: '¢',
        denoms: [
            { v: 1,     kind: 'coin', mm: 19.05, face: '#c98a56', edge: '#9c5f2e', ink: '#40200a', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/US_One_Cent_Obv.png/250px-US_One_Cent_Obv.png' },
            { v: 5,     kind: 'coin', mm: 21.21, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30', img: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/2026-nickel-transparent-512.png' },
            { v: 10,    kind: 'coin', mm: 17.91, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Dime_Obverse_13.png/250px-Dime_Obverse_13.png' },
            { v: 25,    kind: 'coin', mm: 24.26, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30', img: 'https://upload.wikimedia.org/wikipedia/commons/4/44/2014_ATB_Quarter_Obv.png' },
            { v: 100,   kind: 'bill', mm: MN_NOTE_MM, face: '#a7c795', ink: '#1e3d18', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/US_one_dollar_bill%2C_obverse%2C_series_2009.jpg/500px-US_one_dollar_bill%2C_obverse%2C_series_2009.jpg' },
            { v: 500,   kind: 'bill', mm: MN_NOTE_MM, face: '#93bd9f', ink: '#1e3d18', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/US_%245_Series_2006_obverse.jpg/500px-US_%245_Series_2006_obverse.jpg' },
            { v: 1000,  kind: 'bill', mm: MN_NOTE_MM, face: '#9dc4ac', ink: '#1e3d18', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/US_%2410_Series_2004_face.jpg/500px-US_%2410_Series_2004_face.jpg' },
            { v: 2000,  kind: 'bill', mm: MN_NOTE_MM, face: '#84b58c', ink: '#1e3d18', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/US_%2420_Series_2006_Obverse.jpg/500px-US_%2420_Series_2006_Obverse.jpg' },
            { v: 10000, kind: 'bill', mm: MN_NOTE_MM, face: '#b8cca0', ink: '#1e3d18', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/USA_100_Dollar_Bill_Series2009_Obverse.png/500px-USA_100_Dollar_Bill_Series2009_Obverse.png' },
        ],
    },
    GBP: {
        label: '🇬🇧 British Pound', symbol: '£', minor: 'p',
        denoms: [
            { v: 1,    kind: 'coin', mm: 20.30, face: '#c98a56', edge: '#9c5f2e', ink: '#40200a' },
            { v: 2,    kind: 'coin', mm: 25.90, face: '#c98a56', edge: '#9c5f2e', ink: '#40200a' },
            { v: 5,    kind: 'coin', mm: 18.00, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 10,   kind: 'coin', mm: 24.50, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 20,   kind: 'coin', mm: 21.40, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 50,   kind: 'coin', mm: 27.30, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 100,  kind: 'coin', mm: 23.43, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 200,  kind: 'coin', mm: 28.40, face: '#d8b160', edge: '#8f9196', ink: '#3d2c05' },
            { v: 500,  kind: 'bill', mm: 125, face: '#6ec3bd', ink: '#0d3a37' },
            { v: 1000, kind: 'bill', mm: 132, face: '#dd8c54', ink: '#3f1e08' },
            { v: 2000, kind: 'bill', mm: 139, face: '#9b7fc0', ink: '#2a1747' },
            { v: 5000, kind: 'bill', mm: 146, face: '#c8544f', ink: '#3d0f0d' },
        ],
    },
    EUR: {
        label: '🇪🇺 Euro', symbol: '€', minor: 'c',
        denoms: [
            { v: 1,    kind: 'coin', mm: 16.25, face: '#c98a56', edge: '#9c5f2e', ink: '#40200a' },
            { v: 2,    kind: 'coin', mm: 18.75, face: '#c98a56', edge: '#9c5f2e', ink: '#40200a' },
            { v: 5,    kind: 'coin', mm: 21.25, face: '#c98a56', edge: '#9c5f2e', ink: '#40200a' },
            { v: 10,   kind: 'coin', mm: 19.75, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 20,   kind: 'coin', mm: 22.25, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 50,   kind: 'coin', mm: 24.25, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 100,  kind: 'coin', mm: 23.25, face: '#c3c5c9', edge: '#a5822f', ink: '#2b2d30' },
            { v: 200,  kind: 'coin', mm: 25.75, face: '#d8b160', edge: '#8f9196', ink: '#3d2c05' },
            { v: 500,  kind: 'bill', mm: 120, face: '#b0b0b0', ink: '#2b2b2b' },
            { v: 1000, kind: 'bill', mm: 127, face: '#e07a7a', ink: '#451212' },
            { v: 2000, kind: 'bill', mm: 133, face: '#6a9bd8', ink: '#10294a' },
            { v: 5000, kind: 'bill', mm: 140, face: '#e0a253', ink: '#432a08' },
        ],
    },
    CAD: {
        label: '🇨🇦 Canadian Dollar', symbol: '$', minor: '¢',
        denoms: [
            // Canada retired the penny in 2013 — cash totals round to the nearest 5¢.
            { v: 5,    kind: 'coin', mm: 21.20, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 10,   kind: 'coin', mm: 18.03, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 25,   kind: 'coin', mm: 23.88, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 100,  kind: 'coin', mm: 26.50, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 200,  kind: 'coin', mm: 28.00, face: '#d8b160', edge: '#8f9196', ink: '#3d2c05' },
            { v: 500,  kind: 'bill', mm: 152.4, face: '#6f9fd8', ink: '#10294a' },
            { v: 1000, kind: 'bill', mm: 152.4, face: '#9b7fc0', ink: '#2a1747' },
            { v: 2000, kind: 'bill', mm: 152.4, face: '#78b184', ink: '#123a1c' },
            { v: 5000, kind: 'bill', mm: 152.4, face: '#c8544f', ink: '#3d0f0d' },
        ],
    },
    AUD: {
        label: '🇦🇺 Australian Dollar', symbol: '$', minor: 'c',
        denoms: [
            { v: 5,    kind: 'coin', mm: 19.41, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 10,   kind: 'coin', mm: 23.60, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 20,   kind: 'coin', mm: 28.65, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 50,   kind: 'coin', mm: 31.50, face: '#c3c5c9', edge: '#8f9196', ink: '#2b2d30' },
            { v: 100,  kind: 'coin', mm: 25.00, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 200,  kind: 'coin', mm: 20.50, face: '#d8b160', edge: '#a5822f', ink: '#3d2c05' },
            { v: 500,  kind: 'bill', mm: 130, face: '#d68fb4', ink: '#45102c' },
            { v: 1000, kind: 'bill', mm: 137, face: '#6f9fd8', ink: '#10294a' },
            { v: 2000, kind: 'bill', mm: 144, face: '#e08a4f', ink: '#43200a' },
            { v: 5000, kind: 'bill', mm: 151, face: '#e0c05a', ink: '#403205' },
        ],
    },
};

const MN_MAX_AMOUNT = 100000; // $1000.00 ceiling for Change mode
const MN_COL_MAX = 12;      // pieces drawn in one denomination column before a ×N badge
const MN_WIDTH_FILL = 0.98; // pieces may grow to fill this fraction of the box width
const MN_PPM_MAX = 6;       // px per mm when a pile is small enough to show full size
const MN_PPM_MIN = 0.2;     // ...and the floor past which pieces stop shrinking
const MN_BAR_PPM_MAX = 1.6; // denomination toolbar (Build) sizes smaller than the pile
const MN_DIGITS = 6;        // cash-register entry cap -> 9999.99

const mnState = {
    mode:     'identify',   // 'identify' | 'build' | 'change' | 'shop'
    currency: 'USD',
    range:    100,          // exclusive ceiling in minor units: 100 = under $1
    score:    0,
    target:   0,            // identify answer / build goal, in minor units
    tray:     [],           // build mode: denomination values in tap order
    locked:   false,
    changeKey: 'fewest',
};

function mnCur() { return MN_CURRENCIES[mnState.currency]; }

// Denominations usable for the current range — a $1 bill is no use under $1.
function mnPool() {
    return mnCur().denoms.filter(d => d.v < mnState.range);
}

function mnDenom(v) { return mnCur().denoms.find(d => d.v === v); }

// "25¢" for minor units, "$1" / "$20" for whole major units.
function mnLabel(d) {
    const cur = mnCur();
    return d.v < 100 ? d.v + cur.minor : cur.symbol + (d.v / 100);
}

function mnFormat(cents) {
    const s = mnCur().symbol + (Math.abs(cents) / 100).toFixed(2);
    return cents < 0 ? '-' + s : s;
}

// Fewest-pieces breakdown via DP — correct even for non-canonical denomination
// sets, where greedy would not be. Returns [{v, n}] sorted high→low, or null.
function mnFewest(cents, denoms) {
    if (cents === 0) return [];
    const vals = denoms.map(d => d.v).sort((a, b) => a - b);
    if (!vals.length) return null;
    const best = new Array(cents + 1).fill(Infinity);
    const pick = new Array(cents + 1).fill(-1);
    best[0] = 0;
    for (let i = 1; i <= cents; i++) {
        for (const v of vals) {
            if (v > i) break;
            if (best[i - v] + 1 < best[i]) { best[i] = best[i - v] + 1; pick[i] = v; }
        }
    }
    if (best[cents] === Infinity) return null;
    const counts = new Map();
    for (let c = cents; c > 0; c -= pick[c]) counts.set(pick[c], (counts.get(pick[c]) || 0) + 1);
    return mnGroups(counts);
}

function mnGroups(counts) {
    return [...counts].map(([v, n]) => ({ v, n })).sort((a, b) => b.v - a.v);
}

function mnTotal(groups) { return groups.reduce((s, g) => s + g.v * g.n, 0); }
function mnCount(groups) { return groups.reduce((s, g) => s + g.n, 0); }

// A random amount inside the selected range. Stepping by the smallest piece
// keeps it makeable in currencies with no 1¢ (CAD/AUD).
function mnRandomAmount() {
    const step = mnCur().denoms[0].v;
    const steps = Math.floor((mnState.range - 1) / step);
    return (1 + Math.floor(Math.random() * steps)) * step;
}

// ---- Money: pieces ----

function mnPieceHTML(d) {
    const draw = d.kind === 'coin' ? mnCoinSVG(d) : mnBillSVG(d);
    if (!d.img) return draw;
    // Hot-linked photo layered over the drawn piece. If the fetch is slow the
    // drawn coin/note shows until it arrives; if it fails, onerror removes the
    // <img> and the drawing stays. referrerpolicy keeps Wikimedia happy.
    const shape = d.kind === 'coin' ? 'mn-coin' : 'mn-bill';
    return `<span class="mn-piece mn-photo ${shape}" style="--mm:${d.mm}">${draw}` +
        `<img src="${d.img}" alt="${mnLabel(d)}" draggable="false" ` +
        `referrerpolicy="no-referrer" onerror="this.remove()"></span>`;
}

function mnCoinSVG(d) {
    const label = mnLabel(d);
    const fs = label.length >= 4 ? 24 : label.length === 3 ? 29 : 34;
    return `<svg viewBox="0 0 100 100" class="mn-piece mn-coin" style="--mm:${d.mm}" ` +
        `role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="50" cy="50" r="49" fill="${d.edge}"/>` +
        `<circle cx="50" cy="50" r="43" fill="${d.face}"/>` +
        `<circle cx="50" cy="50" r="43" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>` +
        `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="${fs}" ` +
        `font-weight="800" fill="${d.ink}">${label}</text></svg>`;
}

// viewBox units are millimetres, so the drawn note matches a real one's proportions.
function mnBillSVG(d) {
    const label = mnLabel(d);
    return `<svg viewBox="0 0 156 66.3" class="mn-piece mn-bill" style="--mm:${d.mm}" ` +
        `role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect x="1" y="1" width="154" height="64.3" rx="4" fill="${d.face}" stroke="#2b2b2b" stroke-width="1.6"/>` +
        `<rect x="8" y="7" width="140" height="52.3" rx="3" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>` +
        `<circle cx="78" cy="33" r="16" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>` +
        `<text x="78" y="33" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="800" fill="${d.ink}">${label}</text>` +
        `<text x="22" y="16" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="800" fill="${d.ink}">${label}</text>` +
        `<text x="134" y="50" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="800" fill="${d.ink}">${label}</text>` +
        `</svg>`;
}

// Renders [{v, n}] as one column per distinct denomination, largest value on the
// left. A column shows up to MN_COL_MAX real pieces; beyond that it keeps the
// stack readable and marks the true count with a ×N badge (so "all pennies" of a
// big amount is a neat stack labelled ×137, not a wall of 137 coins).
function mnRenderGroups(groups) {
    if (!groups.length) return '';
    const cols = groups.map(g => {
        const d = mnDenom(g.v);
        const show = Math.min(g.n, MN_COL_MAX);
        const badge = g.n > show ? `<span class="mn-col-badge">×${g.n}</span>` : '';
        return `<div class="mn-col">${badge}${mnPieceHTML(d).repeat(show)}</div>`;
    }).join('');
    return `<div class="mn-stage">${cols}</div>`;
}

// Grow the pieces as large as will fit the box, trying BOTH orientations and
// keeping whichever lets the pieces be bigger: 'mn-cols' stacks each
// denomination vertically (columns side by side), 'mn-rows' lays each
// denomination in a horizontal row (rows stacked top to bottom). Wide bills
// usually win in one orientation and not the other, so this picks the larger.
function mnFitStage(box) {
    if (!box) return;
    const stage = box.querySelector('.mn-stage');
    if (!stage) return;
    // Collapse the pieces first, THEN read the box size: a wide pile can inflate
    // the box's own width, so measuring the target while the stage is tiny gives
    // the true, content-independent limit to grow back into.
    box.style.setProperty('--mn-ppm', MN_PPM_MIN);
    const maxW = box.clientWidth * MN_WIDTH_FILL, maxH = box.clientHeight;
    if (!maxH) return;

    let best = { ppm: 0, mode: 'mn-cols' };
    for (const mode of ['mn-cols', 'mn-rows']) {
        stage.classList.remove('mn-cols', 'mn-rows');
        stage.classList.add(mode);
        const ppm = mnMaxPpm(box, stage, maxW, maxH);
        if (ppm > best.ppm) best = { ppm, mode };
    }
    stage.classList.remove('mn-cols', 'mn-rows');
    stage.classList.add(best.mode);
    box.style.setProperty('--mn-ppm', best.ppm);
}

// Largest --mn-ppm at which the stage fits maxW × maxH, by binary search.
function mnMaxPpm(box, stage, maxW, maxH) {
    const fits = (ppm) => {
        box.style.setProperty('--mn-ppm', ppm);
        return stage.offsetWidth <= maxW && stage.offsetHeight <= maxH;
    };
    if (fits(MN_PPM_MAX)) return MN_PPM_MAX;
    let lo = MN_PPM_MIN, hi = MN_PPM_MAX;
    for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
    }
    return lo;
}

// The Build toolbar is a wrap-row of single buttons, not columns; shrink it by
// height alone so it never spills past its fixed strip.
function mnFitHeight(el, maxPpm) {
    if (!el || !el.clientHeight) return;
    el.style.setProperty('--mn-ppm', maxPpm);
    if (el.scrollHeight <= el.clientHeight) return;
    let lo = MN_PPM_MIN, hi = maxPpm;
    for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        el.style.setProperty('--mn-ppm', mid);
        if (el.scrollHeight <= el.clientHeight) lo = mid; else hi = mid;
    }
    el.style.setProperty('--mn-ppm', lo);
}

function mnRenderInto(el, groups) {
    el.innerHTML = mnRenderGroups(groups);
    mnFitStage(el);
}

function mnSummary(groups) {
    if (!groups.length) return '';
    const parts = groups.map(g => `${g.n} × ${mnLabel(mnDenom(g.v))}`);
    const n = mnCount(groups);
    return `${n} ${n === 1 ? 'piece' : 'pieces'}: ${parts.join(' + ')}`;
}

// ---- Money: cash-register amount entry ----

// Digits fill in from the right, so 1 → 0.01, 12 → 0.12, 1234 → 12.34.
// Leading zeros are dropped so the field stays stable as digits accumulate.
function mnFieldCents(el) {
    const digits = el.value.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : null;
}

function mnAttachAmount(el, onChange) {
    el.addEventListener('input', (e) => {
        let digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MN_DIGITS);
        // Without this, backspacing bottoms out at "0.00" and can never clear,
        // because the re-format keeps handing a zero back to the field.
        if (/^0*$/.test(digits) && e.inputType && e.inputType.startsWith('delete')) digits = '';
        el.value = digits ? (parseInt(digits, 10) / 100).toFixed(2) : '';
        if (onChange) onChange(mnFieldCents(el));
    });
}

function mnSetField(el, cents) {
    el.value = cents == null ? '' : (cents / 100).toFixed(2);
}

// ---- Money: shared ----

function mnInit() {
    const saved = localStorage.getItem('mnCurrency');
    if (saved && MN_CURRENCIES[saved]) mnState.currency = saved;
    document.getElementById('mn-currency').value = mnState.currency;
    mnState.range = parseInt(document.getElementById('mn-range').value, 10);
    mnState.score = 0;
    mnUpdateScore();
    mnSyncLabels();
    mnSetMode(mnState.mode);
}

// Currency symbols appear in several places that aren't re-rendered per round.
function mnSyncLabels() {
    const cur = mnCur();
    const sel = document.getElementById('mn-range');
    sel.options[0].textContent = `Under ${cur.symbol}1`;
    sel.options[1].textContent = `Under ${cur.symbol}1000`;
    document.querySelectorAll('.mn-cur-sym').forEach(el => el.textContent = cur.symbol);
}

function mnSetMode(mode) {
    mnState.mode = mode;
    document.querySelectorAll('.mn-mode-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mnMode === mode));
    ['identify', 'build', 'change', 'shop'].forEach(m =>
        document.getElementById('mn-' + m).classList.toggle('hidden', m !== mode));
    // Range and score belong to the two quiz modes only.
    const quiz = mode === 'identify' || mode === 'build';
    document.getElementById('mn-range-row').classList.toggle('hidden', !quiz);
    document.getElementById('mn-score-bar').classList.toggle('hidden', !quiz);
    mnFeedback('', '');
    if (mode === 'identify') mnNewIdentify();
    if (mode === 'build')    mnNewBuild();
    if (mode === 'change')   mnRenderChange();
    // Built on first entry, not up front: the tiles pull ~10 photos off the
    // network, and most visitors never open this mode.
    if (mode === 'shop')     mnShop.results.length ? mnShopRender() : mnShopSearch();
}

function mnSetCurrency(code) {
    mnState.currency = code;
    localStorage.setItem('mnCurrency', code);
    mnSyncLabels();
    mnSetMode(mnState.mode);
}

function mnSetRange(range) {
    mnState.range = range;
    mnSetMode(mnState.mode);
}

function mnFeedback(text, cls) {
    const fb = document.getElementById('mn-feedback');
    fb.textContent = text;
    fb.className = 'feedback-display' + (cls ? ' ' + cls : '');
}

function mnUpdateScore() {
    document.getElementById('mn-score').textContent = `Score: ${mnState.score}`;
}

// Refit the visible pile when the window changes shape.
function mnRefit() {
    if (mnState.mode === 'identify') mnFitStage(document.getElementById('mn-id-pieces'));
    if (mnState.mode === 'build') {
        mnFitStage(document.getElementById('mn-build-pieces'));
        mnFitHeight(document.getElementById('mn-denom-bar'), MN_BAR_PPM_MAX);
    }
    if (mnState.mode === 'change')   mnFitStage(document.getElementById('mn-change-pieces'));
}

// ---- Money: Identify ----

function mnNewIdentify() {
    mnState.locked = false;
    mnState.target = mnRandomAmount();
    mnRenderInto(document.getElementById('mn-id-pieces'),
                 mnFewest(mnState.target, mnPool()) || []);
    const input = document.getElementById('mn-id-input');
    input.value = '';
    input.focus();
}

function mnCheckIdentify() {
    if (mnState.locked) return;
    const cents = mnFieldCents(document.getElementById('mn-id-input'));
    if (cents === null) return mnFeedback('Type the amount', 'fr-fb-wrong');
    if (cents === mnState.target) {
        mnState.locked = true;
        mnFeedback('✓ ' + mnFormat(mnState.target), 'fr-fb-correct');
        mnState.score++;
        mnUpdateScore();
        setTimeout(mnNewIdentify, 900);
    } else {
        mnFeedback('✗ Try again', 'fr-fb-wrong');
    }
}

// ---- Money: Build ----

function mnNewBuild() {
    mnState.locked = false;
    mnState.tray = [];
    mnState.target = mnRandomAmount();
    document.getElementById('mn-target').textContent = mnFormat(mnState.target);
    mnRenderDenomBar();
    mnRenderTray();
}

function mnRenderDenomBar() {
    document.getElementById('mn-denom-bar').innerHTML = mnPool()
        .map(d => `<button class="mn-denom-btn" data-mn-v="${d.v}" aria-label="Add ${mnLabel(d)}">` +
                  `${mnPieceHTML(d)}</button>`)
        .join('');
    mnFitHeight(document.getElementById('mn-denom-bar'), MN_BAR_PPM_MAX);
}

function mnBuildAdd(v) {
    if (mnState.locked) return;
    mnState.tray.push(v);
    mnRenderTray();
    mnCheckBuild();
}

function mnBuildUndo() {
    if (mnState.locked) return;
    mnState.tray.pop();
    mnFeedback('', '');
    mnRenderTray();
}

function mnBuildClear() {
    if (mnState.locked) return;
    mnState.tray = [];
    mnFeedback('', '');
    mnRenderTray();
}

function mnTrayGroups() {
    const counts = new Map();
    mnState.tray.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    return mnGroups(counts);
}

function mnRenderTray() {
    const groups = mnTrayGroups();
    const total  = mnTotal(groups);
    mnRenderInto(document.getElementById('mn-build-pieces'), groups);
    const el = document.getElementById('mn-total');
    el.textContent = mnFormat(total);
    el.classList.toggle('mn-over', total > mnState.target);
    el.classList.toggle('mn-exact', total === mnState.target && total > 0);
}

function mnCheckBuild() {
    const groups = mnTrayGroups();
    const total  = mnTotal(groups);
    if (total < mnState.target) return;
    if (total > mnState.target) {
        mnFeedback(`Too much — that's ${mnFormat(total - mnState.target)} over`, 'fr-fb-wrong');
        return;
    }
    mnState.locked = true;
    mnState.score++;
    mnUpdateScore();
    const fewest = mnFewest(mnState.target, mnPool());
    const best   = fewest ? mnCount(fewest) : Infinity;
    mnFeedback(mnCount(groups) <= best
        ? '✓ Perfect — fewest pieces!'
        : `✓ Correct! It can also be done with ${best} ${best === 1 ? 'piece' : 'pieces'}`, 'fr-fb-correct');
    setTimeout(mnNewBuild, 1500);
}

// ---- Money: Change ----

// Every way of showing the amount that's worth a look: the practical one, a
// coins-only version, and the "all pennies" novelties that divide evenly.
function mnChangeOptions(cents) {
    const cur   = mnCur();
    const coins = cur.denoms.filter(d => d.kind === 'coin');
    const opts  = [];

    const fewest = mnFewest(cents, cur.denoms);
    if (fewest) opts.push({ key: 'fewest', label: 'Exact change', groups: fewest });

    const coinsOnly = mnFewest(cents, coins);
    if (coinsOnly && (!fewest || mnCount(coinsOnly) !== mnCount(fewest))) {
        opts.push({ key: 'coins', label: 'Coins only', groups: coinsOnly });
    }
    for (const d of cur.denoms) {
        if (cents % d.v !== 0) continue;
        const n = cents / d.v;
        if (n < 2) continue; // a single piece is already the "exact change" answer
        opts.push({ key: 'all' + d.v, label: `All ${mnLabel(d)}`, groups: [{ v: d.v, n }] });
    }
    return opts;
}

function mnRenderChange() {
    const cents  = mnFieldCents(document.getElementById('mn-amount'));
    const opts   = document.getElementById('mn-options');
    const sum    = document.getElementById('mn-change-summary');
    const pieces = document.getElementById('mn-change-pieces');
    const clear  = (msg) => { opts.innerHTML = ''; sum.textContent = msg; pieces.innerHTML = ''; };

    if (cents === null || cents <= 0) return clear('');
    if (cents > MN_MAX_AMOUNT) return clear(`Keep it under ${mnFormat(MN_MAX_AMOUNT)}`);

    const list = mnChangeOptions(cents);
    if (!list.length) {
        // Only reachable when the amount isn't a multiple of the smallest piece —
        // e.g. $1.37 in Canada, which retired the penny.
        return clear(`${mnFormat(cents)} can't be made — the smallest piece is ${mnLabel(mnCur().denoms[0])}`);
    }
    if (!list.some(o => o.key === mnState.changeKey)) mnState.changeKey = list[0].key;

    opts.innerHTML = list.map(o =>
        `<button class="mn-opt${o.key === mnState.changeKey ? ' active' : ''}" data-mn-opt="${o.key}">` +
        `${o.label}<span class="mn-opt-n">${mnCount(o.groups)}</span></button>`).join('');

    const chosen = list.find(o => o.key === mnState.changeKey);
    sum.textContent = mnSummary(chosen.groups);
    mnRenderInto(pieces, chosen.groups);
}

function mnSetChangeOption(key) {
    mnState.changeKey = key;
    mnRenderChange();
}

// ---- Money: Shopping ----

// A fixed catalogue rather than a live storefront: a static page can't query a
// retailer (cross-origin requests are blocked and their APIs need server-side
// keys), so prices live here and only the photos are fetched, straight from
// Wikimedia Commons. Each name describes what its photo actually shows.
// Photos are CC-licensed — `by`/`lic` carry the required credit to the tile.
const MN_SHOP_CATALOG = [
    { name: "LEGO City Passenger Train", price: 12999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/LEGO_7897_City_Passenger_Train_-_2006.jpg/500px-LEGO_7897_City_Passenger_Train_-_2006.jpg", by: "Josh Hallett", lic: "CC BY 2.0" },
    { name: "LEGO City Airport", price: 8999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/LEGO_City_10159_LEGO_City_Airport_%2829018734008%29.jpg/500px-LEGO_City_10159_LEGO_City_Airport_%2829018734008%29.jpg", by: "Jinko Cruz", lic: "CC BY 2.0" },
    { name: "LEGO Castle & Knights", price: 7499, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/LEGO_Castle_and_Knights_%286740904281%29.jpg/500px-LEGO_Castle_and_Knights_%286740904281%29.jpg", by: "Tim Moreillon", lic: "CC BY-SA 2.0" },
    { name: "LEGO Technic Tractor", price: 5999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/LEGO_Technic_John_Deere_6130R.jpg/500px-LEGO_Technic_John_Deere_6130R.jpg", by: "Lasse Deleuran", lic: "Public domain" },
    { name: "LEGO Himeji Castle", price: 11999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Himeji_Castle_Lego.jpg/500px-Himeji_Castle_Lego.jpg", by: "Nzquincyma", lic: "CC BY-SA 4.0" },
    { name: "LEGO Pirate Set", price: 4599, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/JLL_Childhood_Collection-_Display_of_Lego-_Pirate_Lego_2760.JPG/500px-JLL_Childhood_Collection-_Display_of_Lego-_Pirate_Lego_2760.JPG", by: "Clem Rutter", lic: "CC BY-SA 3.0" },
    { name: "LEGO Race Car", price: 3999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/2016_Porsche_919_Hybrid_LEGO_Car_Show_%2831410942020%29.jpg/500px-2016_Porsche_919_Hybrid_LEGO_Car_Show_%2831410942020%29.jpg", by: "Prayitno", lic: "CC BY 2.0" },
    { name: "LEGO Mindstorms Robot", price: 6999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/EV3_Robot_fight.jpg/500px-EV3_Robot_fight.jpg", by: "Klaus-Dieter Keller", lic: "CC0" },
    { name: "LEGO Fuel Cell Car", price: 2999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/LEGO_fuel_cell_car_construction_kit.jpg/500px-LEGO_fuel_cell_car_construction_kit.jpg", by: "Matthew Venn", lic: "CC BY-SA 2.0" },
    { name: "LEGO Technic Bits", price: 1499, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/LEGO_Technic_Bits.jpg/500px-LEGO_Technic_Bits.jpg", by: "Windell Oskay", lic: "CC BY 2.0" },
    { name: "LEGO Technic Gear", price: 299, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_LEGO_Technic_gear_with_24_teeth.jpg/500px-A_LEGO_Technic_gear_with_24_teeth.jpg", by: "Didaictor", lic: "CC BY-SA 4.0" },
    { name: "LEGO Duplo Bricks", price: 499, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/2_duplo_lego_bricks.jpg/500px-2_duplo_lego_bricks.jpg", by: "Klasbricks", lic: "Public domain" },
    { name: "LEGO Brick Pile", price: 999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/LEGO-01.jpg/500px-LEGO-01.jpg", by: "Priwo", lic: "Public domain" },
    { name: "LEGO Duplo Tower", price: 1999, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Duplo_bouwwerk.jpg/500px-Duplo_bouwwerk.jpg", by: "Wiki183", lic: "CC BY-SA 3.0" },
    { name: "LEGO House Model", price: 2499, img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Billund_Lego_House_03.jpg/500px-Billund_Lego_House_03.jpg", by: "Andrzej Otrębski", lic: "CC BY-SA 4.0" },
];

const MN_SHOP_TOP = 10;

// These photos are hot-linked, so a URL can rot without warning. On failure the
// tile keeps its name and price and just shows an empty frame, rather than a
// browser broken-image icon.
const MN_IMG_FALLBACK = `referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'"`;

const mnShop = { budget: 7500, cart: [], results: [], term: 'lego' };

// $25–$250 in $5 steps: always affords something, never affords everything.
function mnShopRoll() {
    mnShop.budget = (5 + Math.floor(Math.random() * 46)) * 500;
    mnShop.cart = [];
    mnSetField(document.getElementById('mn-shop-budget'), mnShop.budget);
    mnShopRender();
}

function mnShopSearch() {
    const el = document.getElementById('mn-shop-term');
    const term = (el ? el.value : 'lego').trim().toLowerCase();
    mnShop.term = term;
    mnShop.results = MN_SHOP_CATALOG
        .filter(p => !term || p.name.toLowerCase().includes(term))
        .slice(0, MN_SHOP_TOP);
    mnShopRender();
}

function mnShopSpent() { return mnShop.cart.reduce((s, p) => s + p.price, 0); }
function mnShopLeft()  { return mnShop.budget - mnShopSpent(); }

function mnShopToggle(name) {
    const at = mnShop.cart.findIndex(p => p.name === name);
    if (at >= 0) { mnShop.cart.splice(at, 1); mnShopRender(); return; }
    const item = mnShop.results.find(p => p.name === name);
    if (item && item.price <= mnShopLeft()) { mnShop.cart.push(item); mnShopRender(); }
}

function mnShopRender() {
    const left = mnShopLeft();
    const leftEl = document.getElementById('mn-shop-left');
    leftEl.textContent = mnFormat(left);
    leftEl.classList.toggle('mn-over', left < 0);

    const spent = document.getElementById('mn-shop-spent');
    spent.textContent = mnShop.cart.length
        ? `${mnShop.cart.length} in cart · ${mnFormat(mnShopSpent())} spent` : '';

    const grid = document.getElementById('mn-shop-grid');
    if (!mnShop.results.length) {
        grid.innerHTML = `<div class="mn-shop-empty">Nothing found for “${mnShop.term}” — try “lego”, “castle”, or “duplo”.</div>`;
    } else {
        grid.innerHTML = mnShop.results.map(p => {
            const inCart = mnShop.cart.some(c => c.name === p.name);
            const afford = p.price <= left;
            const cls = 'mn-prod' + (inCart ? ' mn-in-cart' : afford ? '' : ' mn-unafford');
            const credit = `${p.name} — photo: ${p.by} / ${p.lic}, via Wikimedia Commons`;
            return `<button class="${cls}" data-mn-prod="${encodeURIComponent(p.name)}"` +
                `${inCart || afford ? '' : ' disabled'} title="${credit}">` +
                `<img class="mn-prod-img" src="${p.img}" alt="" ${MN_IMG_FALLBACK}>` +
                `<span class="mn-prod-name">${p.name}</span>` +
                `<span class="mn-prod-price">${mnFormat(p.price)}</span>` +
                `<span class="mn-prod-tag">${inCart ? 'In cart ✓' : afford ? 'Add' : 'Too expensive'}</span>` +
                `</button>`;
        }).join('');
    }

    document.getElementById('mn-shop-cart').innerHTML = mnShop.cart.length
        ? mnShop.cart.map(p =>
            `<button class="mn-cart-item" data-mn-cart="${encodeURIComponent(p.name)}" title="Remove ${p.name}">` +
            `<img class="mn-cart-img" src="${p.img}" alt="" ${MN_IMG_FALLBACK}>` +
            `<span class="mn-cart-name">${p.name}</span>` +
            `<span class="mn-cart-price">${mnFormat(p.price)}</span>` +
            `<span class="mn-cart-x">✕</span></button>`).join('')
        : '<div class="mn-cart-empty">Cart is empty — tap something to add it.</div>';
}

// ============================================
// INIT
// ============================================

// What to do when a tab is clicked (entry point for each tab)
const TAB_ENTRY = {
    'flashcards': () => { showScreen('home'); initHome(); },
    'worksheets': () => { showScreen('worksheets'); pgSetType('addition'); },
    'sorting':    () => { showScreen('word-sort-menu'); initWordSortMenu(); },
    'ciphers':    () => showScreen('ciphers'),
    'make-ten':   () => showScreen('make-ten-menu'),
    'ten-frame':  () => { showScreen('ten-frame'); tfClear(); },
    'visualizer': () => {
        showScreen('visualizer');
        vizSetMainMode('multiply');
        initVisualizer();
        handleVisualizerClear();
        vizSetPhase('idle');
    },
    'sudoku':     () => showScreen('sudoku'),
    'times-grid': () => { showScreen('times-grid'); ttInit(); },
    'fractions':  () => { showScreen('fractions');  frInit(); },
    'money':      () => { showScreen('money');      mnInit(); },
};

function onTabLeave(fromTab) {
    // Dispose the Three.js scene when navigating away from the visualizer
    if (fromTab === 'visualizer' && state.visualizerAnimator) {
        state.visualizerAnimator.dispose();
        state.visualizerAnimator = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const speechReady = initSpeechRecognition();
    if (speechReady) {
        document.getElementById('mic-btn').classList.remove('hidden');
        document.getElementById('typed-section').classList.add('hidden');
    } else {
        document.getElementById('mic-btn').classList.add('hidden');
        document.getElementById('typed-section').classList.remove('hidden');
    }

    initHome();

    // ---- Tab bar ----
    document.getElementById('tab-bar').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const toTab = btn.dataset.tab;
        const fromTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (toTab === fromTab) return;
        onTabLeave(fromTab);
        TAB_ENTRY[toTab]?.();
    });

    // ---- Flashcards ----
    document.getElementById('op-toggles').addEventListener('click', (e) => {
        const btn = e.target.closest('.op-toggle');
        if (!btn) return;
        btn.classList.toggle('active');
        initHome();
    });

    document.getElementById('max-number-group').addEventListener('click', (e) => {
        const btn = e.target.closest('.op-toggle');
        if (!btn) return;
        document.querySelectorAll('#max-number-group .op-toggle')
            .forEach(b => b.classList.toggle('active', b === btn));
        initHome();
    });

    // Settings burger
    const settingsBtn   = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsPanel.classList.toggle('hidden');
        });
        settingsPanel.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => settingsPanel.classList.add('hidden'));
    }

    document.getElementById('start-btn').addEventListener('click', startQuiz);

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitTyped);
        document.getElementById('answer-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitTyped();
        });
    }

    document.getElementById('play-again-btn').addEventListener('click', startQuiz);
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });

    // ---- Worksheets ----
    document.getElementById('worksheets-screen')
        .querySelectorAll('.pg-type-btn')
        .forEach(btn => btn.addEventListener('click', () => pgSetType(btn.dataset.type)));

    document.getElementById('worksheets-generate-btn').addEventListener('click', pgGenerateWorksheets);

    document.getElementById('worksheets-screen')
        .querySelectorAll('.pg-max-group')
        .forEach(group => {
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('.op-toggle');
                if (!btn) return;
                group.querySelectorAll('.op-toggle')
                    .forEach(b => b.classList.toggle('active', b === btn));
            });
        });

    // ---- Sorting ----
    const sortMenu = document.getElementById('word-sort-menu-screen');

    sortMenu.querySelectorAll('.ws-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sortMenu.querySelectorAll('.ws-type-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
                b.className = b === btn ? 'btn btn-primary ws-type-btn active' : 'btn btn-secondary ws-type-btn';
            });
            initWordSortMenu();
        });
    });

    sortMenu.querySelectorAll('.ws-diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sortMenu.querySelectorAll('.ws-diff-btn').forEach(b => {
                b.className = b === btn ? 'btn btn-primary ws-diff-btn active' : 'btn btn-secondary ws-diff-btn';
            });
            initWordSortMenu();
        });
    });

    document.getElementById('ws-start-btn').addEventListener('click', () => {
        const type = sortMenu.querySelector('.ws-type-btn.active')?.dataset.type || 'letters';
        const diff = sortMenu.querySelector('.ws-diff-btn.active')?.dataset.diff || 'easy';
        startWordSort(type, diff);
    });

    document.getElementById('ws-check-btn').addEventListener('click', wsCheckOrder);

    document.getElementById('ws-play-again-btn').addEventListener('click', () => {
        startWordSort(state.wsType, state.wsDifficulty.split('_')[1] || 'easy');
    });

    document.getElementById('ws-menu-btn').addEventListener('click', () => {
        showScreen('word-sort-menu');
        initWordSortMenu();
    });

    // ---- Ciphers ----
    document.getElementById('pg-cipher-type').addEventListener('change', (e) => {
        document.getElementById('pg-cipher-glyph-selector')
            .classList.toggle('hidden', e.target.value !== 'glyph');
    });

    document.getElementById('ciphers-generate-btn').addEventListener('click', pgGenerateCiphers);

    // ---- Cipher solver ----
    document.getElementById('cs-start-btn').addEventListener('click', csStart);
    document.getElementById('cs-reset-btn').addEventListener('click', csReset);
    document.getElementById('cs-edit-btn').addEventListener('click', csEdit);
    document.getElementById('cs-share-btn').addEventListener('click', csShare);
    csLoadFromHash();

    // ---- Make Ten ----
    document.getElementById('mt-target-btns').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-target]');
        if (!btn) return;
        document.querySelectorAll('#mt-target-btns [data-target]')
            .forEach(b => b.classList.toggle('active', b === btn));
    });

    document.getElementById('mt-reps-btns').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-reps]');
        if (!btn) return;
        document.querySelectorAll('#mt-reps-btns [data-reps]')
            .forEach(b => b.classList.toggle('active', b === btn));
    });

    document.getElementById('mt-start-btn').addEventListener('click', () => {
        const sel = document.querySelector('#mt-target-btns [data-target].active');
        const target = parseInt(sel ? sel.dataset.target : '10', 10);
        const repSel = document.querySelector('#mt-reps-btns [data-reps].active');
        const reps = parseInt(repSel ? repSel.dataset.reps : '1', 10);
        const tenFrame = document.getElementById('mt-tenframe').checked;
        startTapGame('make-ten', { target, tenFrame, reps });
    });

    document.getElementById('tg-play-again-btn').addEventListener('click', () => {
        startTapGame(state.tgMode, state.tgOpts);
    });

    document.getElementById('tg-results-home-btn').addEventListener('click', () => {
        showScreen('make-ten-menu');
    });

    // ---- Ten Frame ----
    document.getElementById('tf-clear-btn').addEventListener('click', tfClear);
    ['tf-input-a', 'tf-input-b'].forEach(id => {
        document.getElementById(id).addEventListener('input', tfShow);
    });

    // ---- Times Tables ----
    document.getElementById('tt-mode-group').addEventListener('click', (e) => {
        const btn = e.target.closest('.tt-mode-btn');
        if (btn) ttSetMode(btn.dataset.ttMode);
    });
    document.getElementById('tt-max').addEventListener('change', ttInit);
    document.getElementById('tt-quiz-submit').addEventListener('click', ttSubmitQuiz);
    document.getElementById('tt-quiz-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ttSubmitQuiz();
    });

    // ---- Fractions ----
    document.getElementById('fr-mode-group').addEventListener('click', (e) => {
        const btn = e.target.closest('.fr-mode-btn');
        if (btn) frSetMode(btn.dataset.frMode);
    });
    document.getElementById('fr-shape-group').addEventListener('click', (e) => {
        const btn = e.target.closest('.fr-shape-btn');
        if (btn) frSetShape(btn.dataset.frShape);
    });
    document.getElementById('fr-max-den').addEventListener('change', frInit);
    document.getElementById('fr-id-check').addEventListener('click', frCheckIdentify);
    ['fr-id-num', 'fr-id-den'].forEach(id =>
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') frCheckIdentify();
        }));

    // ---- Money visualizer ----
    document.getElementById('mn-mode-group').addEventListener('click', (e) => {
        const btn = e.target.closest('.mn-mode-btn');
        if (btn) mnSetMode(btn.dataset.mnMode);
    });
    document.getElementById('mn-currency').addEventListener('change', (e) => mnSetCurrency(e.target.value));
    document.getElementById('mn-range').addEventListener('change', (e) => mnSetRange(parseInt(e.target.value, 10)));

    // Identify
    mnAttachAmount(document.getElementById('mn-id-input'));
    document.getElementById('mn-id-check').addEventListener('click', mnCheckIdentify);
    document.getElementById('mn-id-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') mnCheckIdentify();
    });

    // Build
    document.getElementById('mn-denom-bar').addEventListener('click', (e) => {
        const btn = e.target.closest('.mn-denom-btn');
        if (btn) mnBuildAdd(parseInt(btn.dataset.mnV, 10));
    });
    document.getElementById('mn-undo').addEventListener('click', mnBuildUndo);
    document.getElementById('mn-clear').addEventListener('click', mnBuildClear);

    // Change
    mnAttachAmount(document.getElementById('mn-amount'), mnRenderChange);
    document.getElementById('mn-options').addEventListener('click', (e) => {
        const btn = e.target.closest('.mn-opt');
        if (btn) mnSetChangeOption(btn.dataset.mnOpt);
    });

    // Shopping
    mnAttachAmount(document.getElementById('mn-shop-budget'), (cents) => {
        mnShop.budget = cents || 0;
        mnShopRender();
    });
    document.getElementById('mn-shop-roll').addEventListener('click', mnShopRoll);
    document.getElementById('mn-shop-go').addEventListener('click', mnShopSearch);
    document.getElementById('mn-shop-term').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') mnShopSearch();
    });
    document.getElementById('mn-shop-grid').addEventListener('click', (e) => {
        const btn = e.target.closest('.mn-prod');
        if (btn) mnShopToggle(decodeURIComponent(btn.dataset.mnProd));
    });
    document.getElementById('mn-shop-cart').addEventListener('click', (e) => {
        const btn = e.target.closest('.mn-cart-item');
        if (btn) mnShopToggle(decodeURIComponent(btn.dataset.mnCart));
    });

    // Piece sizing is measured from live layout, so re-fit when that changes.
    window.addEventListener('resize', mnRefit);

    // ---- Place-value visualizer ----
    document.getElementById('viz-mode-toggle').addEventListener('click', (e) => {
        const btn = e.target.closest('.viz-mode-btn');
        if (btn) vizSetMainMode(btn.dataset.vizMode);
    });
    document.getElementById('pv-input').addEventListener('input', (e) => {
        // Auto-reject input after 4 digits
        const str = String(e.target.value).replace(/\D/g, '');
        if (str.length > 4) {
            e.target.value = str.slice(0, 4);
        }
        pvRender(e.target.value);
    });
    document.getElementById('pv-play').addEventListener('click', pvSpeak);
    // Warm up the voice list so the first tap has en-GB available.
    if ('speechSynthesis' in window) speechSynthesis.getVoices();

    // ---- Visualizer ----
    ['visualizer-input-1', 'visualizer-input-2', 'visualizer-input-3'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', handleVisualizerInputChange);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && state.vizPhase === 'idle' && vizInputsFilled()) handleVisualizerShow();
        });
    });

    document.getElementById('visualizer-drop-btn').addEventListener('click', () => {
        if (state.vizPhase === 'idle') handleVisualizerShow();
        else handleVisualizerDrop();
    });
    document.getElementById('visualizer-clear-btn').addEventListener('click', handleVisualizerClear);

    // Slider live value displays
    document.getElementById('viz-friction').addEventListener('input', (e) => {
        document.getElementById('viz-friction-val').textContent = parseFloat(e.target.value).toFixed(2);
    });
    document.getElementById('viz-row-delay').addEventListener('input', (e) => {
        document.getElementById('viz-row-delay-val').textContent = `${e.target.value}ms`;
    });
    document.getElementById('viz-rotation').addEventListener('input', (e) => {
        document.getElementById('viz-rotation-val').textContent = parseFloat(e.target.value).toFixed(1);
    });

    // ---- Sudoku ----
    document.getElementById('sudoku-generate-btn').addEventListener('click', pgGenerateSudoku);
});
