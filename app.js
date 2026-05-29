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
    wsDifficulty:    'basic',
    wsWords:         [],
    wsStartTime:     null,
    wsTimerInterval: null,
    wsDragState:     null,
    visualizerAnimator: null,
    visualizerOp1: '×',
    visualizerOp2: '×',
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

const TAP_ROUNDS = 10;

function tgRandInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}


const TAP_MODES = {
    'make-ten': {
        title: (o) => `Make ${o.target}`,
        bestKey: (o) => `tapBest_makeTen_${o.target}`,
        genRound(o) {
            const known = tgRandInt(0, o.target);
            const answer = o.target - known;
            const choices = Array.from({ length: o.target + 1 }, (_, i) => i);
            return { tokens: [String(known), '+', '?', '=', String(o.target)], answer, choices };
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
    state.tgRounds = Array.from({ length: TAP_ROUNDS }, () => def.genRound(opts));
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
        `${state.tgIndex + 1} / ${TAP_ROUNDS}`;
    const feedback = document.getElementById('tg-feedback');
    feedback.textContent = '';
    feedback.className = 'feedback-display';

    const choices = document.getElementById('tg-choices');
    choices.innerHTML = '';
    round.choices.forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'tg-choice';
        btn.textContent = n;
        btn.addEventListener('click', () => tgChoose(n, btn));
        choices.appendChild(btn);
    });
}

function tgChoose(value, btn) {
    if (!state.tgActive) return;
    const round = state.tgRounds[state.tgIndex];

    if (value === round.answer) {
        state.tgCorrect++;
        state.tgIndex++;
        state.tgActive = false;  // block taps during the flip
        const next = () => {
            if (state.tgIndex >= TAP_ROUNDS) {
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
        state.tgCorrect === TAP_ROUNDS ? 'Perfect!' : 'Done!';

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

function initWordSortMenu() {
    ['basic', 'intermediate', 'advanced', 'numbers'].forEach(diff => {
        const best = wsLoadBestTime(diff);
        document.getElementById(`ws-best-${diff}`).textContent =
            best !== null ? formatTime(best) : '--:--';
    });
}

function generateNumberSet() {
    const numbers = [];
    for (let i = 0; i < 6; i++) {
        numbers.push(Math.floor(Math.random() * 19999) - 9999);
    }
    return shuffleArray(numbers.map(String));
}

function wsPickWords(difficulty) {
    if (difficulty === 'numbers') {
        return generateNumberSet();
    }
    if (difficulty === 'advanced') {
        const groupIndex = Math.floor(Math.random() * WS_WORDS_ADVANCED.length);
        return shuffleArray(WS_WORDS_ADVANCED[groupIndex]);
    }
    const pool = difficulty === 'basic' ? WS_WORDS_BASIC : WS_WORDS_INTERMEDIATE;
    return shuffleArray(pool).slice(0, 6);
}

function startWordSort(difficulty) {
    if (state.wsTimerInterval) {
        clearInterval(state.wsTimerInterval);
        state.wsTimerInterval = null;
    }
    state.wsDifficulty = difficulty;
    state.wsWords = wsPickWords(difficulty);

    document.getElementById('ws-diff-display').textContent = difficulty.toUpperCase();
    document.getElementById('ws-timer-display').textContent = '00:00';

    const prompt = difficulty === 'numbers' ? 'Sort High → Low' : 'Sort A → Z';
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
    if (state.wsDifficulty === 'numbers') {
        const nums = current.map(Number);
        const sorted = [...nums].sort((a, b) => b - a);
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
    document.getElementById('ws-final-diff').textContent = diff.toUpperCase();
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

function handleVisualizerInput() {
    // Read three input fields
    const input1 = document.getElementById('visualizer-input-1').value.trim();
    const input2 = document.getElementById('visualizer-input-2').value.trim();
    const input3 = document.getElementById('visualizer-input-3').value.trim();

    if (!input1 || !input2 || !input3) {
        alert('Please enter all three numbers.');
        return;
    }

    // Build expression from inputs and operators
    const expression = `${input1} ${state.visualizerOp1} ${input2} ${state.visualizerOp2} ${input3}`;
    const result = parseExpression(expression);

    if (!result.valid) {
        alert(result.error);
        return;
    }

    if (!state.visualizerAnimator) {
        alert('Visualizer is not ready yet. Please try again in a moment.');
        return;
    }

    // Pick up the current spacing slider value before this run
    const spacingEl = document.getElementById('visualizer-spacing');
    const spacing = parseFloat(spacingEl.value);
    if (Number.isFinite(spacing) && spacing > 0) {
        state.visualizerAnimator.spacing = spacing;
    }

    // Get visual structure
    const visualStruct = getVisualStructure(result.ast);

    // Run build animation; cubes stay in formation, awaiting DROP
    if (visualStruct.type === 'multiply') {
        state.visualizerAnimator.animateMultiplication(
            visualStruct.a,
            visualStruct.b,
            visualStruct.c
        );
    } else if (visualStruct.type === 'add') {
        state.visualizerAnimator.animateAddition(visualStruct.groups);
    }

    // Show result
    const answerEl = document.getElementById('visualizer-answer');
    setTimeout(() => {
        answerEl.textContent = `= ${result.result}`;
        answerEl.classList.remove('hidden');
    }, 1500);
}

// Derive the cache-bust query string from the loaded app.js script URL,
// so the physics worker stays in sync with the rest of the assets without
// having to remember to bump it separately.
function getAssetCacheVersion() {
    const scripts = document.querySelectorAll('script[src*="app.js"]');
    for (const s of scripts) {
        const match = s.src.match(/app\.js\?(v=\d+)/);
        if (match) return match[1];
    }
    return 'v=1';
}

function handleVisualizerDrop() {
    if (!state.visualizerAnimator) return;

    // Pick up the current "Background physics" toggle and switch backends
    // if it changed since last drop. Worker URL is cache-busted to match.
    const workerToggle = document.getElementById('visualizer-worker-toggle');
    const useWorker = !!(workerToggle && workerToggle.checked);
    const workerUrl = `physics-worker.js?${getAssetCacheVersion()}`;
    state.visualizerAnimator.setUseWorkerPhysics(useWorker, workerUrl);

    state.visualizerAnimator.startDrop();
}

function handleVisualizerReset() {
    if (state.visualizerAnimator) {
        state.visualizerAnimator.snapBackToFormation();
    }
}

function handleVisualizerClear() {
    // Clear input fields
    document.getElementById('visualizer-input-1').value = '';
    document.getElementById('visualizer-input-2').value = '';
    document.getElementById('visualizer-input-3').value = '';

    // Hide answer display
    const answerEl = document.getElementById('visualizer-answer');
    answerEl.classList.add('hidden');
    answerEl.textContent = '';

    if (state.visualizerAnimator) {
        state.visualizerAnimator.clear();
    }
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

function pgSymbolToDisplay(num, size, symbolType) {
    if (num === 0) return '';
    if (symbolType === 'letters') {
        const letters = size === 4 ? 'ABCD' : size === 6 ? 'ABCDEF' : 'ABCDEFGHI';
        return letters[num - 1];
    }
    if (symbolType === 'multiples') {
        return `1×${num}`;
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

// --- Cipher ---

// Glyph mappings (simplified Unicode characters)
const CIPHER_GLYPHS = {
    dingbat: ['✤', '✥', '✦', '✧', '★', '✪', '✫', '✬', '✭', '✮', '✯', '✰', '✱', '✲', '✳', '✴', '✵', '✶', '✷', '✸', '✹', '✺', '✻', '✼', '✽', '✾'],
    rune: ['ᚠ', 'ᚡ', 'ᚢ', 'ᚣ', 'ᚤ', 'ᚥ', 'ᚦ', 'ᚧ', 'ᚨ', 'ᚩ', 'ᚪ', 'ᚫ', 'ᚬ', 'ᚭ', 'ᚮ', 'ᚯ', 'ᚰ', 'ᚱ', 'ᚲ', 'ᚳ', 'ᚴ', 'ᚵ', 'ᚶ', 'ᚷ', 'ᚸ', 'ᚹ'],
    noto: ['🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆', '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏', '🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘', '🀙'],
};

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

function pgMakeCipherMapGlyph(glyphType) {
    const A = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const glyphs = CIPHER_GLYPHS[glyphType] || CIPHER_GLYPHS.dingbat;
    const S = shuffleArray([...glyphs]);
    const fwd = {}, rev = {};
    A.forEach((ch, i) => { fwd[ch] = S[i]; rev[S[i]] = ch; });
    return { fwd, rev };
}

function pgEncrypt(text, fwd) {
    // Encrypt letters, keep numbers and punctuation as-is, remove extra whitespace
    return text.toUpperCase().replace(/[A-Z]/g, ch => fwd[ch]);
}

function pgEncryptWithSpaces(text, fwd) {
    // Return text with each character separated by space for underscore placement
    const encrypted = pgEncrypt(text, fwd);
    return encrypted.split('').map(ch => ch === ' ' ? '  ' : ch).join(' ');
}

function pgChunkText(text, n) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(' '));
    return out;
}

// --- PDF layout constants (letter paper, mm) ---

const PG_DEBUG_GRID = true;   // ← set false to hide red grid lines for print
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

function pgSudokuGrid(doc, grid, size, ox, oy, gs, symbolType = 'numbers') {
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
                const sym = pgSymbolToDisplay(grid[r][c], size, symbolType);
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
            pgSudokuGrid(doc, grid, size, ox, oy, puzSize, symbolType);
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
function pgCipherSplitToPages(words, textW, rowH, gridH, charW, wordGap) {
    const rowsPerPage = Math.floor(gridH / rowH);
    const pages = [];
    let pageWords = [], row = 0, x = 0;

    for (const word of words) {
        if (!word) continue;
        const ww = word.length * charW + wordGap;
        if (x + ww > textW && x > 0) { row++;  x = 0; }
        if (row >= rowsPerPage) {
            pages.push(pageWords.join(' '));
            pageWords = [];  row = 0;
        }
        pageWords.push(word);
        x += ww;
    }
    if (pageWords.length) pages.push(pageWords.join(' '));
    return pages;
}

/**
 * Place encoded cipher text exactly one character per grid cell.
 * Words wrap to the next row if they don't fit; one blank cell separates words.
 */
function pgDrawCipherCells(doc, encChunk, gridX, gridY, cellW, cellH, textCols, totalRows) {
    const words = encChunk.trim().split(/\s+/).filter(Boolean);
    const textY  = cellH * 0.2;    // char at top of cell with margin
    const lineY  = cellH * 0.8;    // blank underline near bottom

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.min(9, cellH * 0.85));
    doc.setLineWidth(0.4);
    doc.setDrawColor(0);

    let col = 0, row = 0;

    for (let wi = 0; wi < words.length; wi++) {
        const word = words[wi];

        // Wrap whole word to next row if it won't fit
        if (col > 0 && col + word.length > textCols) { row++; col = 0; }
        if (row >= totalRows) break;

        for (let c = 0; c < word.length; c++) {
            const char = word[c];
            const isLetter = /[A-Z]/.test(char);

            // Only advance column for letters; punctuation/numbers don't take up space
            if (isLetter) {
                if (col >= textCols) { row++; col = 0; }
                if (row >= totalRows) break;
                const cx = gridX + col * cellW;
                const cy = gridY + row * cellH;
                doc.text(char, cx + cellW / 2, cy + textY, { align: 'center' });
                doc.line(cx + cellW * 0.12, cy + lineY, cx + cellW * 0.88, cy + lineY);
                col++;
            } else {
                // Non-letters: draw at current position without taking up space
                const cx = gridX + col * cellW;
                const cy = gridY + row * cellH;
                doc.text(char, cx + cellW / 2, cy + textY, { align: 'center' });
            }
        }

        // One blank cell between words (only if we have space)
        if (wi < words.length - 1) {
            col++;
            if (col >= textCols) { row++; col = 0; }
        }
    }
}

/**
 * Draw cipher key separate from grid in 2 rows, as pairs with = between them.
 * Pairs are closer together, larger font, no grid cells.
 */
function pgDrawCipherKeySeparate(doc, revMap, keyX, keyY, cipherType) {
    const alpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

    // Split into 2 rows of 13 pairs each
    const row1 = alpha.slice(0, 13);
    const row2 = alpha.slice(13, 26);

    // Large font to fit in 2 rows
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);

    const lineHeight = 8;
    const pairWidth = 14.8;  // Fixed width per pair to fit 13 pairs in ~195mm

    [row1, row2].forEach((row, rowIdx) => {
        const y = keyY + rowIdx * lineHeight;

        for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            const mapped = revMap[ch];
            const x = keyX + i * pairWidth;

            // Draw "A=X  B=Y  C=Z..."
            doc.text(`${ch}=${mapped}`, x, y);
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

    // Grid size determines column count, rows, and cell dimensions
    let GRID_COLS, TEXT_ROWS;
    if (gridSize === 'large') {
        GRID_COLS = 13;
        TEXT_ROWS = 11;  // Fewer, taller rows for large grid
    } else if (gridSize === 'medium') {
        GRID_COLS = 20;
        TEXT_ROWS = 14;
    } else {  // small
        GRID_COLS = 26;
        TEXT_ROWS = 16;
    }

    // Key is now drawn separately (not in grid), so calculate grid dimensions for message only
    const TEXT_COLS = GRID_COLS;
    const cellW = PG_GRID_W / GRID_COLS;
    const cellH = PG_GRID_H / (TEXT_ROWS + 3);  // Account for key space above
    const keyY = PG_GRID_Y;  // Key at top
    const messageY = PG_GRID_Y + 25;  // Grid below the key

    // Split source text into page-sized chunks
    const origChunks = pgCipherSplitToPages(
        text.trim().split(/\s+/), TEXT_COLS * cellW, cellH, TEXT_ROWS * cellH, cellW, cellW
    );

    const ciphers = origChunks.map(() =>
        cipherType === 'letter' ? pgMakeCipherMap()       :
        cipherType === 'number' ? pgMakeCipherMapNumber() :
                                  pgMakeCipherMapGlyph(glyphFont)
    );
    const encChunks = origChunks.map((ch, i) => pgEncrypt(ch, ciphers[i].fwd));

    // ── Encoded text pages ────────────────────────────────────────────────
    encChunks.forEach((enc, i) => {
        if (i > 0) doc.addPage();  // Only add page for 2nd+ iterations; use default first page
        const suffix = encChunks.length > 1 ? ` — Page ${i + 1} of ${encChunks.length}` : '';
        pgHeader(doc, `Encoded Text${suffix}`);

        // Draw the cipher key separately (above the grid, not in it)
        pgDrawCipherKeySeparate(doc, ciphers[i].rev, PG_GRID_X, keyY, cipherType);

        // Draw grid with conditional gridlines (only for message, not key)
        if (showGridlines) {
            pgDrawCipherGrid(doc, PG_GRID_X, messageY, PG_GRID_W, TEXT_ROWS * cellH, GRID_COLS, TEXT_ROWS, 0);
        }

        // Cipher text: in the grid starting at messageY
        pgDrawCipherCells(doc, enc, PG_GRID_X, messageY, cellW, cellH, TEXT_COLS, TEXT_ROWS);
    });

    // ── Answer key section ────────────────────────────────────────────────
    if (includeAnswerKey) {
        // Append answer keys at the end without separate page header or page breaks
        let keyPageAdded = false;
        let y = PG_GRID_Y;

        origChunks.forEach((orig, i) => {
            const rev     = ciphers[i].rev;
            const mapping = alpha.map(ch => `${ch}:${rev[ch]}`).join('   ');

            // Add a new page only for the first answer key
            if (!keyPageAdded) {
                doc.addPage();
                y = pgHeader(doc, 'Answer Keys');
                keyPageAdded = true;
            } else {
                // Add some vertical space between answer keys
                y += 8;
                // Check if there's enough space, otherwise add a new page
                if (y > PG_H - 40) {
                    doc.addPage();
                    y = pgHeader(doc, 'Answer Keys');
                }
            }

            // Cipher key mapping (full, wrapped to multiple lines if needed)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            const keyLabel = `KEY (Page ${i + 1}): ${mapping}`;
            const keyLines = doc.splitTextToSize(keyLabel, PG_GRID_W);
            doc.text(keyLines, PG_GRID_X, y);
            y += keyLines.length * 3.5 + 2;

            // Original text preview
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const origPreview = orig.substring(0, 100) + (orig.length > 100 ? '...' : '');
            doc.text(`Original: ${origPreview}`, PG_GRID_X, y);
            y += 4;
        });
    } else {
        // Original behavior: separate answer key pages with full formatting
        pgAnswerKeySeparator(doc);
        origChunks.forEach((orig, i) => {
            doc.addPage();
            let y = pgHeader(doc, `Answer Key — Page ${i + 1}`) + 3;

            const rev     = ciphers[i].rev;
            const mapping = alpha.map(ch => `${ch}:${rev[ch]}`).join('   ');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`CIPHER KEY`, PG_GRID_X, y);
            y += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const mLines = doc.splitTextToSize(mapping, PG_GRID_W);
            doc.text(mLines, PG_GRID_X, y);
            y += mLines.length * 4 + 8;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`ORIGINAL TEXT  (Page ${i + 1})`, PG_GRID_X, y);
            y += 7;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(doc.splitTextToSize(orig, PG_GRID_W), PG_GRID_X, y);
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
    } else if (type === 'multiplication') {
        const max    = parseInt(activeConfig.querySelector('.pg-max-group .op-toggle.active')?.dataset.max || '10', 10);
        const count  = parseInt(activeConfig.querySelector('.pg-count').value, 10);
        const sheets = parseInt(activeConfig.querySelector('.pg-sheets').value, 10);
        pgPDFMult(1, max, count, sheets, includeAnswerKey);
    } else {
        alert(`${type} worksheets coming soon!`);
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
        initVisualizer();
        handleVisualizerClear();
    },
    'sudoku':     () => showScreen('sudoku'),
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
    document.getElementById('word-sort-menu-screen')
        .querySelectorAll('.ws-diff-btn')
        .forEach(btn => btn.addEventListener('click', () => startWordSort(btn.dataset.diff)));

    document.getElementById('ws-check-btn').addEventListener('click', wsCheckOrder);

    document.getElementById('ws-play-again-btn').addEventListener('click', () => {
        startWordSort(state.wsDifficulty);
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

    // ---- Make Ten ----
    document.getElementById('mt-target-btns').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-target]');
        if (!btn) return;
        document.querySelectorAll('#mt-target-btns [data-target]')
            .forEach(b => b.classList.toggle('active', b === btn));
    });

    document.getElementById('mt-start-btn').addEventListener('click', () => {
        const sel = document.querySelector('#mt-target-btns [data-target].active');
        const target = parseInt(sel ? sel.dataset.target : '10', 10);
        startTapGame('make-ten', { target });
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

    // ---- Visualizer ----
    ['visualizer-input-1', 'visualizer-input-2', 'visualizer-input-3'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleVisualizerInput();
        });
    });

    document.querySelectorAll('.visualizer-op-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const opIndex = btn.dataset.opIndex;
            const stateKey = `visualizerOp${opIndex}`;
            state[stateKey] = state[stateKey] === '×' ? '+' : '×';
            btn.textContent = state[stateKey];
        });
    });

    document.getElementById('visualizer-reset-btn').addEventListener('click', handleVisualizerReset);
    document.getElementById('visualizer-drop-btn').addEventListener('click', handleVisualizerDrop);
    document.getElementById('visualizer-clear-btn').addEventListener('click', handleVisualizerClear);

    const spacingSlider = document.getElementById('visualizer-spacing');
    const spacingValueEl = document.getElementById('visualizer-spacing-value');
    if (spacingSlider && spacingValueEl) {
        const updateSpacingLabel = () => {
            spacingValueEl.textContent = parseFloat(spacingSlider.value).toFixed(1);
        };
        spacingSlider.addEventListener('input', updateSpacingLabel);
        updateSpacingLabel();
    }

    // ---- Sudoku ----
    document.getElementById('sudoku-generate-btn').addEventListener('click', pgGenerateSudoku);
});
