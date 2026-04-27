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
});
