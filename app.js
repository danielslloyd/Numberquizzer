// Math Flash Cards — spoken answer edition

// ============================================
// STATE
// ============================================

const state = {
    questions: [],
    currentIndex: 0,
    correctCount: 0,
    wrongAttempts: 0,
    startTime: null,
    timerInterval: null,
    operation: 'addition',
    maxNumber: 10,
    questionCount: 10,
    recognition: null,
    isListening: false,
    speechSupported: false,
    quizActive: false,
};

// ============================================
// STORAGE
// ============================================

function getBestTimeKey() {
    return `bestTime_${state.operation}_${state.maxNumber}_${state.questionCount}`;
}

function loadBestTime() {
    const stored = localStorage.getItem(getBestTimeKey());
    return stored ? parseInt(stored, 10) : null;
}

function saveBestTime(seconds) {
    localStorage.setItem(getBestTimeKey(), seconds.toString());
}

// ============================================
// HELPERS
// ============================================

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

const SYMBOLS = {
    addition: '+',
    subtraction: '−',
    multiplication: '×',
    division: '÷',
};

function generateQuestions(operation, max, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
        const a = Math.floor(Math.random() * max) + 1;
        const b = Math.floor(Math.random() * max) + 1;
        let display, answer;

        switch (operation) {
            case 'addition':
                display = `${a}\n+\n${b}`;
                answer = a + b;
                break;
            case 'subtraction': {
                const hi = Math.max(a, b), lo = Math.min(a, b);
                display = `${hi}\n−\n${lo}`;
                answer = hi - lo;
                break;
            }
            case 'multiplication':
                display = `${a}\n×\n${b}`;
                answer = a * b;
                break;
            case 'division':
                display = `${a * b}\n÷\n${a}`;
                answer = b;
                break;
        }

        questions.push({ display, answer });
    }
    return questions;
}

// ============================================
// ANSWER NORMALIZATION (speech → number)
// ============================================

// Scan every 1-, 2-, and 3-word n-gram in transcript for a recognisable
// number, return the first one found (or null).
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
        'for': 'four',
        'to': 'two',
        'too': 'two',
        'won': 'one',
        'ate': 'eight',
        'fore': 'four',
        'tree': 'three',
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
    if (compound !== null) {
        return compound.toString();
    }

    if (/^\d+$/.test(normalized)) {
        return normalized;
    }

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
            if (!isNaN(digit)) {
                current += digit;
            } else {
                return null;
            }
        } else if (value === 100) {
            current = (current || 1) * 100;
        } else if (value >= 20) {
            current += value;
        } else {
            current += value;
        }
    }

    total += current;
    return total > 0 ? total : null;
}

// ============================================
// SPEECH RECOGNITION
// ============================================

function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        state.speechSupported = false;
        return false;
    }

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
        // Only examine the latest result (could be interim or final)
        const latest = event.results[event.results.length - 1];
        const transcript = latest[0].transcript.trim();
        document.getElementById('listening-text').textContent = transcript;

        const found = findNumberInSpeech(transcript);
        if (found !== null && state.quizActive) {
            const expected = state.questions[state.currentIndex].answer;
            if (found === expected) {
                advanceQuestion();
            }
        }
    };

    state.recognition.onerror = (event) => {
        state.isListening = false;
        // 'aborted' fires when we call stop() intentionally — ignore it
        if (event.error !== 'aborted' && state.quizActive) {
            setTimeout(startListening, 200);
        }
    };

    state.recognition.onend = () => {
        state.isListening = false;
        // Auto-restart so the mic is always on during the quiz
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
    try {
        state.recognition.start();
    } catch (e) {
        // already running; ignore
    }
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
}

// ============================================
// HOME
// ============================================

function initHome() {
    const bestTime = loadBestTime();
    document.getElementById('best-time-home').textContent =
        bestTime !== null ? formatTime(bestTime) : '--:--';
}

// ============================================
// QUIZ
// ============================================

function startQuiz() {
    state.operation = document.getElementById('operation').value;
    state.maxNumber = parseInt(document.getElementById('max-number').value, 10);
    state.questionCount = parseInt(document.getElementById('question-count').value, 10);
    state.questions = generateQuestions(state.operation, state.maxNumber, state.questionCount);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongAttempts = 0;

    document.getElementById('timer-display').textContent = '00:00';
    showScreen('quiz');
    renderQuestion();
    startTimer();
    state.quizActive = true;

    if (state.speechSupported) {
        startListening();
    } else {
        const input = document.getElementById('answer-input');
        input.value = '';
        input.focus();
    }
}

function renderQuestion() {
    const q = state.questions[state.currentIndex];
    const [top, op, bottom] = q.display.split('\n');
    // Safe: top/op/bottom are all generated numbers and operator symbols
    document.getElementById('question-display').innerHTML =
        `<div class="q-row"><span class="q-op"></span><span class="q-num">${top}</span></div>` +
        `<div class="q-row"><span class="q-op">${op}</span><span class="q-num">${bottom}</span></div>` +
        `<div class="q-line"></div>`;
    document.getElementById('progress-display').textContent =
        `${state.currentIndex + 1} / ${state.questionCount}`;
    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'feedback-display';

    if (!state.speechSupported) {
        const input = document.getElementById('answer-input');
        input.value = '';
        input.focus();
    }
}

function advanceQuestion() {
    state.correctCount++;
    state.currentIndex++;
    if (state.currentIndex >= state.questionCount) {
        endQuiz();
    } else {
        renderQuestion();
    }
}

// Typed fallback answer check
function checkTypedAnswer(input) {
    const normalized = normalizeAnswer(input.toString());
    const q = state.questions[state.currentIndex];

    if (normalized === q.answer.toString()) {
        advanceQuestion();
    } else {
        const feedback = document.getElementById('feedback-display');
        feedback.textContent = 'Not quite — try again!';
        feedback.className = 'feedback-display incorrect';
        state.wrongAttempts++;
        const answerInput = document.getElementById('answer-input');
        answerInput.value = '';
        answerInput.focus();
    }
}

// Typed fallback submit
function submitTyped() {
    const input = document.getElementById('answer-input');
    const raw = input.value.trim();
    if (raw === '') return;
    checkTypedAnswer(raw);
}

// ============================================
// RESULTS
// ============================================

function endQuiz() {
    state.quizActive = false;
    if (state.speechSupported) state.recognition.stop();
    const elapsed = stopTimer();
    const bestTime = loadBestTime();
    const isNewBest = bestTime === null || elapsed < bestTime;

    if (isNewBest) saveBestTime(elapsed);

    document.getElementById('final-time').textContent = formatTime(elapsed);
    document.getElementById('final-score').textContent =
        `${state.correctCount} / ${state.questionCount}`;
    document.getElementById('best-time-results').textContent =
        formatTime(isNewBest ? elapsed : bestTime);

    const badge = document.getElementById('new-record-badge');
    badge.classList.toggle('hidden', !isNewBest);

    document.getElementById('results-title').textContent =
        state.correctCount === state.questionCount ? 'Perfect!' : 'Done!';

    showScreen('results');
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const speechReady = initSpeechRecognition();

    // Show correct input mode
    if (speechReady) {
        document.getElementById('mic-btn').classList.remove('hidden');
        document.getElementById('typed-section').classList.add('hidden');
    } else {
        document.getElementById('mic-btn').classList.add('hidden');
        document.getElementById('typed-section').classList.remove('hidden');
    }

    initHome();

    document.getElementById('operation').addEventListener('change', initHome);
    document.getElementById('max-number').addEventListener('change', initHome);
    document.getElementById('question-count').addEventListener('change', initHome);

    document.getElementById('start-btn').addEventListener('click', startQuiz);

    // Typed fallback input
    document.getElementById('submit-btn').addEventListener('click', submitTyped);
    document.getElementById('answer-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitTyped();
    });

    document.getElementById('play-again-btn').addEventListener('click', startQuiz);
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });
});
