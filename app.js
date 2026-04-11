// Math Flash Cards

// ============================================
// STATE
// ============================================

let currentMode    = 'flashcards';
let lastPlayedMode = 'flashcards';

// Bubble geometry — must match the .bubble height + gap in CSS
const BUBBLE_H      = 72;
const BUBBLE_GAP    = 10;
const BUBBLE_STRIDE = BUBBLE_H + BUBBLE_GAP; // 82 px

const sortState = {
    numbers:     [],   // array of numbers to sort (by value)
    visualOrder: [],   // indices into numbers[], current top-to-bottom visual order
    drag:        null, // null | { numIdx, pointerOffsetY, targetSlot }
    moveCount:   0,
    startTime:   null,
    timerInterval: null,
};

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

function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { state.speechSupported = false; return false; }

    state.speechSupported = true;
    state.recognition = new SR();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = 'en-US';

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
        const found = findNumberInSpeech(transcript);
        if (found !== null && found === state.questions[state.currentIndex].answer) {
            advanceQuestion();
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
    if (currentMode === 'sort') {
        document.getElementById('best-score-display').classList.add('hidden');
        document.getElementById('start-btn').disabled = false;
        return;
    }
    document.getElementById('best-score-display').classList.remove('hidden');
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
    lastPlayedMode = 'flashcards';
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
    document.getElementById('score-stat-label').textContent = 'Score';
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
// SORT MODE
// ============================================

function generateSortNumbers(count, max) {
    // Always distinct: pick `count` values from [1..max], capped so count ≤ max
    const n    = Math.min(count, max);
    const pool = Array.from({ length: max }, (_, i) => i + 1);
    return shuffleArray(pool).slice(0, n);
}

function isSortedOrder(order, numbers) {
    return order.every((numIdx, i) =>
        i === 0 || numbers[order[i - 1]] <= numbers[numIdx]
    );
}

function startSortQuiz() {
    lastPlayedMode = 'sort';
    const count = parseInt(document.getElementById('sort-count').value, 10);
    const max   = parseInt(document.getElementById('max-number').value, 10);

    sortState.numbers = generateSortNumbers(count, max);
    const n = sortState.numbers.length;

    // Ensure the initial order isn't already sorted
    let order;
    do {
        order = shuffleArray(Array.from({ length: n }, (_, i) => i));
    } while (isSortedOrder(order, sortState.numbers));
    sortState.visualOrder = order;

    sortState.drag      = null;
    sortState.moveCount = 0;

    document.getElementById('sort-timer-display').textContent = '00:00';
    showScreen('sort');
    renderBubbles();
    startSortTimer();
}

function startSortTimer() {
    sortState.startTime = Date.now();
    sortState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sortState.startTime) / 1000);
        document.getElementById('sort-timer-display').textContent = formatTime(elapsed);
    }, 200);
}

function stopSortTimer() {
    clearInterval(sortState.timerInterval);
    sortState.timerInterval = null;
    return Math.floor((Date.now() - sortState.startTime) / 1000);
}

function renderBubbles() {
    const container = document.getElementById('bubble-container');
    container.innerHTML = '';
    const n = sortState.visualOrder.length;
    container.style.height = `${n * BUBBLE_STRIDE - BUBBLE_GAP}px`;

    sortState.visualOrder.forEach((numIdx, slot) => {
        const el = document.createElement('div');
        el.className = 'bubble';
        el.dataset.numIdx = numIdx;
        el.textContent = sortState.numbers[numIdx];
        el.style.top = `${slot * BUBBLE_STRIDE}px`;
        el.addEventListener('pointerdown', onBubblePointerDown);
        container.appendChild(el);
    });
}

function getBubbleEl(numIdx) {
    return document.querySelector(`#bubble-container [data-num-idx="${numIdx}"]`);
}

function onBubblePointerDown(e) {
    e.preventDefault();
    const el     = e.currentTarget;
    const numIdx = parseInt(el.dataset.numIdx, 10);

    const containerTop = document.getElementById('bubble-container').getBoundingClientRect().top;
    const bubbleTop    = el.getBoundingClientRect().top;

    sortState.drag = {
        numIdx,
        pointerOffsetY: e.clientY - bubbleTop,
        containerTopAtDown: containerTop,
        targetSlot: sortState.visualOrder.indexOf(numIdx),
    };

    el.classList.add('dragging');

    document.addEventListener('pointermove',   onSortPointerMove);
    document.addEventListener('pointerup',     onSortPointerUp);
    document.addEventListener('pointercancel', onSortPointerUp);
}

function onSortPointerMove(e) {
    if (!sortState.drag) return;

    const containerTop = document.getElementById('bubble-container').getBoundingClientRect().top;
    const n = sortState.visualOrder.length;

    let newTop = e.clientY - containerTop - sortState.drag.pointerOffsetY;
    newTop = Math.max(0, Math.min((n - 1) * BUBBLE_STRIDE, newTop));

    // Follow the pointer
    const dragEl = getBubbleEl(sortState.drag.numIdx);
    dragEl.style.transition = 'none';
    dragEl.style.top = `${newTop}px`;

    // Determine which slot the dragged bubble's centre is closest to
    const centre     = newTop + BUBBLE_H / 2;
    const targetSlot = Math.max(0, Math.min(n - 1, Math.round(centre / BUBBLE_STRIDE)));
    sortState.drag.targetSlot = targetSlot;

    // Slide every other bubble into its new position live
    const others = sortState.visualOrder.filter(idx => idx !== sortState.drag.numIdx);
    others.forEach((otherIdx, i) => {
        const slot    = i < targetSlot ? i : i + 1;
        const otherEl = getBubbleEl(otherIdx);
        otherEl.style.transition = 'top 0.15s ease';
        otherEl.style.top = `${slot * BUBBLE_STRIDE}px`;
    });
}

function onSortPointerUp() {
    document.removeEventListener('pointermove',   onSortPointerMove);
    document.removeEventListener('pointerup',     onSortPointerUp);
    document.removeEventListener('pointercancel', onSortPointerUp);

    if (!sortState.drag) return;

    const { numIdx, targetSlot } = sortState.drag;
    sortState.drag = null;

    // Commit the new visual order
    const others = sortState.visualOrder.filter(idx => idx !== numIdx);
    sortState.visualOrder = [
        ...others.slice(0, targetSlot),
        numIdx,
        ...others.slice(targetSlot),
    ];

    // Snap the released bubble to its final slot with a smooth transition
    const dragEl = getBubbleEl(numIdx);
    dragEl.classList.remove('dragging');
    dragEl.style.transition = 'top 0.15s ease';
    dragEl.style.top = `${targetSlot * BUBBLE_STRIDE}px`;

    sortState.moveCount++;
    checkSortComplete();
}

function checkSortComplete() {
    if (isSortedOrder(sortState.visualOrder, sortState.numbers)) {
        setTimeout(endSortQuiz, 500);
    }
}

function endSortQuiz() {
    const elapsed = stopSortTimer();

    document.getElementById('results-title').textContent    = 'Sorted!';
    document.getElementById('score-stat-label').textContent = 'Moves';
    document.getElementById('final-time').textContent       = formatTime(elapsed);
    document.getElementById('final-score').textContent      = sortState.moveCount;
    document.getElementById('best-time-results').textContent = '--:--';
    document.getElementById('new-record-badge').classList.add('hidden');

    showScreen('results');
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

    // Mode selector
    document.getElementById('mode-selector').addEventListener('click', (e) => {
        const btn = e.target.closest('.mode-btn');
        if (!btn) return;
        currentMode = btn.dataset.mode;
        document.querySelectorAll('.mode-btn').forEach(b =>
            b.classList.toggle('active', b === btn)
        );
        document.getElementById('ops-setting').classList.toggle('hidden', currentMode !== 'flashcards');
        document.getElementById('bubble-count-setting').classList.toggle('hidden', currentMode !== 'sort');
        initHome();
    });

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

    document.getElementById('start-btn').addEventListener('click', () => {
        if (currentMode === 'sort') startSortQuiz();
        else startQuiz();
    });

    // Sort screen back button
    document.getElementById('sort-back-btn').addEventListener('click', () => {
        if (sortState.drag) {
            document.removeEventListener('pointermove',   onSortPointerMove);
            document.removeEventListener('pointerup',     onSortPointerUp);
            document.removeEventListener('pointercancel', onSortPointerUp);
            sortState.drag = null;
        }
        clearInterval(sortState.timerInterval);
        sortState.timerInterval = null;
        showScreen('home');
        initHome();
    });

    // Typed fallback
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitTyped);
        document.getElementById('answer-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitTyped();
        });
    }

    document.getElementById('play-again-btn').addEventListener('click', () => {
        if (lastPlayedMode === 'sort') startSortQuiz();
        else startQuiz();
    });
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });
});
