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
function flipCard(callback) {
    const card = document.getElementById('question-display');

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
// TIMER
// ============================================

function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        document.getElementById('timer-display').textContent = formatTime(elapsed);
    }, 200);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    return Math.floor((Date.now() - state.startTime) / 1000);
}

// ============================================
// SCREENS
// ============================================

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${name}-screen`).classList.add('active');
    document.getElementById('settings-widget').classList.toggle('hidden', name !== 'home');
}

// ============================================
// HOME
// ============================================

function initHome() {
    const ops = getSelectedOps();
    const max = parseInt(document.getElementById('max-number').value, 10);
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
    state.maxNumber   = parseInt(document.getElementById('max-number').value, 10);
    state.shuffle     = document.getElementById('shuffle-toggle').checked;
    state.animations  = document.getElementById('animations-toggle').checked;
    state.showTranscript = document.getElementById('transcript-toggle').checked;

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
    renderQuestion();
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
    const S = shuffleArray([...Array(26).keys()].map(i => String(i + 1).padStart(2, '0')));
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

// --- PDF helpers ---

function pgHeader(doc, title) {
    const W = 215.9, M = 19;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, W / 2, 26, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Name: ______________________________', M, 36);
    doc.text('Date: _____________', 152, 36);
    doc.setLineWidth(0.4);
    doc.line(M, 41, W - M, 41);
    return 47;
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

    // Thick box boundary lines
    doc.setLineWidth(1.5);
    for (let r = 0; r <= size; r += bh) doc.line(ox, oy + r * cs, ox + gs, oy + r * cs);
    for (let c = 0; c <= size; c += bw) doc.line(ox + c * cs, oy, ox + c * cs, oy + gs);

    // Clue symbols
    const fs = symbolType === 'multiples' ? (size === 4 ? 20 : size === 6 ? 14 : 11) : (size === 4 ? 28 : size === 6 ? 22 : 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
            if (grid[r][c]) {
                const sym = pgSymbolToDisplay(grid[r][c], size, symbolType);
                doc.text(sym, ox + c * cs + cs / 2, oy + r * cs + cs * 0.65, { align: 'center' });
            }
}

function pgDrawMultProblems(doc, probs, startY, showAnswers, M, W) {
    const cols = 3;
    const colW = (W - M * 2) / cols;
    const rowH = 18; // Space for stacked format
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    probs.forEach((p, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = M + col * colW + 5;
        const y = startY + row * rowH;

        // Problem number
        doc.text(`${i + 1}.`, x, y);

        // Stacked format
        doc.text(`${p.a}`, x + 12, y);
        doc.text('×', x + 8, y + 4);
        doc.text(String(p.b), x + 12, y + 4);
        doc.setLineWidth(0.5);
        doc.line(x + 8, y + 6, x + 18, y + 6);

        const ans = showAnswers ? String(p.ans) : '___';
        doc.text(ans, x + 12, y + 10);
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
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = 215.9, M = 12, H = 279.4;
    const label = `${size}×${size}`;
    const diffTxt = diff[0].toUpperCase() + diff.slice(1);

    // Generate all puzzles first
    const totalPuzzles = sheets * 6; // 6 per page
    const allPuzzles = Array.from({ length: totalPuzzles }, () => pgMakeSudoku(size, diff));

    // Larger grid sizes for 2×3 layout
    const gs = { 4: 55, 6: 65, 9: 75 }[size]; // Much larger grids
    const colW = (W - M * 2) / 2;
    const rowH = (H - M * 2 - 30) / 3; // 30mm for header

    // Puzzle pages
    for (let pageIdx = 0; pageIdx < sheets; pageIdx++) {
        if (pageIdx > 0) doc.addPage();
        const title = sheets > 1
            ? `Sudoku ${label} — ${diffTxt} · Sheet ${pageIdx + 1} of ${sheets}`
            : `Sudoku ${label} — ${diffTxt}`;
        pgHeader(doc, title);

        // Draw 6 grids in 2×3 layout
        for (let gridIdx = 0; gridIdx < 6; gridIdx++) {
            const puzzleIdx = pageIdx * 6 + gridIdx;
            const col = gridIdx % 2;
            const row = Math.floor(gridIdx / 2);
            const ox = M + col * colW + (colW - gs) / 2;
            const oy = 32 + row * rowH + (rowH - gs) / 2;
            pgSudokuGrid(doc, allPuzzles[puzzleIdx].puz, size, ox, oy, gs, symbolType);
        }
    }

    // Answer key
    pgAnswerKeySeparator(doc);
    for (let pageIdx = 0; pageIdx < sheets; pageIdx++) {
        doc.addPage();
        const title = sheets > 1
            ? `Sudoku ${label} — Answer Key · Sheet ${pageIdx + 1}`
            : `Sudoku ${label} — Answer Key`;
        pgHeader(doc, title);

        for (let gridIdx = 0; gridIdx < 6; gridIdx++) {
            const puzzleIdx = pageIdx * 6 + gridIdx;
            const col = gridIdx % 2;
            const row = Math.floor(gridIdx / 2);
            const ox = M + col * colW + (colW - gs) / 2;
            const oy = 32 + row * rowH + (rowH - gs) / 2;
            pgSudokuGrid(doc, allPuzzles[puzzleIdx].sol, size, ox, oy, gs, symbolType);
        }
    }

    doc.save(`sudoku-${label}-${diff}.pdf`);
}

function pgPDFMult(min, max, count, sheets) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = 215.9, M = 19;
    const allSheets = Array.from({ length: sheets }, () => pgMakeMult(min, max, count));

    allSheets.forEach((probs, si) => {
        if (si) doc.addPage();
        const title = sheets > 1
            ? `Multiplication Practice · Sheet ${si + 1} of ${sheets}`
            : 'Multiplication Practice';
        const y0 = pgHeader(doc, title);
        pgDrawMultProblems(doc, probs, y0, false, M, W);
    });

    pgAnswerKeySeparator(doc);
    allSheets.forEach((probs, si) => {
        doc.addPage();
        const title = sheets > 1
            ? `Multiplication — Answer Key · Sheet ${si + 1}`
            : 'Multiplication — Answer Key';
        const y0 = pgHeader(doc, title);
        pgDrawMultProblems(doc, probs, y0, true, M, W);
    });

    doc.save(`multiplication-${min}-to-${max}.pdf`);
}

function pgDrawCipherKeyTable(doc, rev, x, y, compact = false, cipherType = 'letter') {
    const alpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    const fs = compact ? 7 : 9;
    const rowH = compact ? 6 : 8;
    const perCol = 13;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fs);

    for (let i = 0; i < 26; i++) {
        const row = i % perCol;
        const col = Math.floor(i / perCol);
        const px = x + col * 35;
        const py = y + row * rowH;

        const ch = alpha[i];
        let decoded = rev ? rev[ch] : '___';

        // Format based on cipher type
        if (cipherType === 'number' && decoded !== '___') {
            decoded = decoded.padStart(2, '0');
        }

        doc.text(`${ch}→${decoded}`, px, py);
    }
}

function pgDrawCipherTextWithBlanks(doc, encText, x, y, maxWidth) {
    const glyphs = encText.split('');
    let currentX = x;
    let currentY = y;
    const lineHeight = 8;
    const charSpacing = 3;

    doc.setFont('courier', 'normal');
    doc.setFontSize(12);

    for (const glyph of glyphs) {
        if (glyph === ' ') {
            currentX += charSpacing * 2;
        } else {
            doc.text(glyph, currentX, currentY);
            doc.setLineWidth(0.3);
            doc.line(currentX - 1, currentY + 2, currentX + 3, currentY + 2);
            currentX += charSpacing;
        }

        if (currentX > maxWidth) {
            currentX = x;
            currentY += lineHeight;
        }
    }

    return currentY;
}

function pgPDFCipher(text, chunkSize, cipherType = 'letter', glyphFont = 'dingbat', showKeyOnPage = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const W = 215.9, M = 19;
    const origChunks = pgChunkText(text, chunkSize);
    const alpha = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

    // Generate ciphers based on type
    let ciphers;
    if (cipherType === 'letter') {
        ciphers = origChunks.map(() => pgMakeCipherMap());
    } else if (cipherType === 'number') {
        ciphers = origChunks.map(() => pgMakeCipherMapNumber());
    } else {
        ciphers = origChunks.map(() => pgMakeCipherMapGlyph(glyphFont));
    }

    const encChunks = origChunks.map((ch, i) => pgEncrypt(ch, ciphers[i].fwd));

    // Page 1: master decoding key
    const y0 = pgHeader(doc, 'Code Breaker — Master Key');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const inst = `Each page has its own cipher. Look for patterns in the encoded text and use the key table to track your discoveries.${showKeyOnPage ? ' A key table appears on each page to help you.' : ''}`;
    const instLines = doc.splitTextToSize(inst, W - M * 2);
    doc.text(instLines, M, y0 + 2);

    const tableY = y0 + instLines.length * 5 + 10;
    const colW = (W - M * 2) / 3;
    const perCol = 9;
    const rowH = 9;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    for (let i = 0; i < 26; i++) {
        const col = Math.floor(i / perCol);
        const row = i % perCol;
        const x = M + col * colW;
        const y = tableY + row * rowH;
        doc.text(alpha[i], x, y);
        doc.setFont('helvetica', 'normal');
        doc.text('  →  ___', x + 5, y);
        doc.setFont('helvetica', 'bold');
    }

    // Encoded text pages
    encChunks.forEach((enc, i) => {
        doc.addPage();
        const startY = pgHeader(doc, `Encoded Text — Page ${i + 1} of ${encChunks.length}`);

        if (showKeyOnPage) {
            // Display with key table on the side
            doc.setFont('courier', 'normal');
            doc.setFontSize(11);
            const textW = 110;
            pgDrawCipherTextWithBlanks(doc, enc, M, startY + 8, M + textW);

            // Key table on right
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('KEY:', M + textW + 8, startY);
            pgDrawCipherKeyTable(doc, null, M + textW + 6, startY + 5, true, cipherType);
        } else {
            // Just display encrypted text with blanks
            pgDrawCipherTextWithBlanks(doc, enc, M, startY + 8, W - M);
        }
    });

    // Answer key
    pgAnswerKeySeparator(doc);

    origChunks.forEach((orig, i) => {
        doc.addPage();
        let y = pgHeader(doc, `Answer Key — Page ${i + 1}`);
        y += 3;

        const rev = ciphers[i].rev;
        const mapping = alpha.map(ch => `${ch}→${rev[ch]}`).join('  ');

        // Cipher mapping
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`CIPHER KEY  (${cipherType === 'number' ? 'encoded → 01-26' : 'encoded → original'})`, M, y);
        y += 6;

        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        const mLines = doc.splitTextToSize(mapping, W - M * 2);
        doc.text(mLines, M, y);
        y += mLines.length * 4 + 8;

        // Original text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`ORIGINAL TEXT  (Page ${i + 1})`, M, y);
        y += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const oLines = doc.splitTextToSize(orig, W - M * 2);
        doc.text(oLines, M, y);
    });

    doc.save('cipher-puzzle.pdf');
}

// --- UI ---

function pgSetType(type) {
    document.querySelectorAll('.pg-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    document.querySelectorAll('.pg-config').forEach(el => el.classList.add('hidden'));
    document.getElementById(`pg-${type}-config`).classList.remove('hidden');
}

function pgGenerate() {
    if (!window.jspdf) {
        alert('PDF library is still loading — please try again in a moment.');
        return;
    }
    const type = document.querySelector('.pg-type-btn.active').dataset.type;

    if (type === 'sudoku') {
        const size  = parseInt(document.getElementById('pg-sudoku-size').value, 10);
        const symbols = document.getElementById('pg-sudoku-symbols').value;
        const diff  = document.getElementById('pg-sudoku-diff').value;
        const sheets = parseInt(document.getElementById('pg-sudoku-sheets').value, 10);
        pgPDFSudoku(sheets, size, diff, symbols);

    } else if (type === 'multiplication') {
        const min    = Math.max(1, parseInt(document.getElementById('pg-mult-min').value, 10) || 1);
        const max    = Math.max(min, parseInt(document.getElementById('pg-mult-max').value, 10) || 10);
        const count  = parseInt(document.getElementById('pg-mult-count').value, 10);
        const sheets = parseInt(document.getElementById('pg-mult-sheets').value, 10);
        pgPDFMult(min, max, count, sheets);

    } else if (type === 'cipher') {
        const text = document.getElementById('pg-cipher-text').value.trim();
        if (!text) { alert('Please paste some text for the cipher.'); return; }
        const chunkSize = parseInt(document.getElementById('pg-cipher-chunk').value, 10);
        const cipherType = document.getElementById('pg-cipher-type').value;
        const glyphFont = document.getElementById('pg-cipher-glyph-font').value;
        const showKey = document.getElementById('pg-cipher-show-key').checked;
        pgPDFCipher(text, chunkSize, cipherType, glyphFont, showKey);
    }
}

// ============================================
// INIT
// ============================================

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

    // Operation toggles
    document.getElementById('op-toggles').addEventListener('click', (e) => {
        const btn = e.target.closest('.op-toggle');
        if (!btn) return;
        btn.classList.toggle('active');
        initHome();
    });

    document.getElementById('max-number').addEventListener('change', initHome);

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

    // Typed fallback
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

    // ---- Word Sort ----
    document.getElementById('word-sort-btn').addEventListener('click', () => {
        showScreen('word-sort-menu');
        initWordSortMenu();
    });

    document.getElementById('word-sort-menu-screen')
        .querySelectorAll('.ws-diff-btn')
        .forEach(btn => btn.addEventListener('click', () => startWordSort(btn.dataset.diff)));

    document.getElementById('ws-home-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });

    document.getElementById('ws-check-btn').addEventListener('click', wsCheckOrder);

    document.getElementById('ws-play-again-btn').addEventListener('click', () => {
        startWordSort(state.wsDifficulty);
    });

    document.getElementById('ws-menu-btn').addEventListener('click', () => {
        showScreen('word-sort-menu');
        initWordSortMenu();
    });

    document.getElementById('ws-home-from-results-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });

    // ---- Math Visualizer ----
    document.getElementById('visualizer-btn').addEventListener('click', () => {
        showScreen('visualizer');
        initVisualizer();
        handleVisualizerClear();
    });

    // Three input fields: Enter key on any triggers animation
    ['visualizer-input-1', 'visualizer-input-2', 'visualizer-input-3'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleVisualizerInput();
            }
        });
    });

    // Operator buttons: toggle between × and +
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

    // Spacing slider: keep displayed value in sync as the user drags
    const spacingSlider = document.getElementById('visualizer-spacing');
    const spacingValueEl = document.getElementById('visualizer-spacing-value');
    if (spacingSlider && spacingValueEl) {
        const updateSpacingLabel = () => {
            spacingValueEl.textContent = parseFloat(spacingSlider.value).toFixed(1);
        };
        spacingSlider.addEventListener('input', updateSpacingLabel);
        updateSpacingLabel();
    }

    document.getElementById('visualizer-home-btn').addEventListener('click', () => {
        if (state.visualizerAnimator) {
            state.visualizerAnimator.dispose();
            state.visualizerAnimator = null;
        }
        showScreen('home');
        initHome();
    });

    // ---- Puzzle Generator ----
    document.getElementById('puzzle-btn').addEventListener('click', () => {
        showScreen('puzzle-generator');
        pgSetType('sudoku');
    });

    document.querySelectorAll('.pg-type-btn').forEach(btn => {
        btn.addEventListener('click', () => pgSetType(btn.dataset.type));
    });

    // Cipher type selector: show/hide glyph font option
    document.getElementById('pg-cipher-type').addEventListener('change', (e) => {
        const glyphSelector = document.getElementById('pg-cipher-glyph-selector');
        glyphSelector.classList.toggle('hidden', e.target.value !== 'glyph');
    });

    document.getElementById('pg-generate-btn').addEventListener('click', pgGenerate);

    document.getElementById('pg-home-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });
});
