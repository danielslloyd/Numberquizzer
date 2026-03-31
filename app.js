// Addition Flash Cards — spoken answer edition

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
    maxNumber: 10,
    questionCount: 10,
    recognition: null,
    isListening: false,
    speechSupported: false,
};

// ============================================
// STORAGE
// ============================================

function getBestTimeKey() {
    return `bestTime_${state.maxNumber}_${state.questionCount}`;
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

function generateQuestions(max, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
        const a = Math.floor(Math.random() * max) + 1;
        const b = Math.floor(Math.random() * max) + 1;
        questions.push({ a, b, answer: a + b });
    }
    return questions;
}

// ============================================
// ANSWER NORMALIZATION (speech → number)
// ============================================

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
    state.recognition.continuous = false;
    state.recognition.interimResults = false;
    state.recognition.lang = 'en-US';

    state.recognition.onstart = () => {
        state.isListening = true;
        document.getElementById('mic-btn').classList.add('listening');
        document.getElementById('listening-text').textContent = 'Listening…';
    };

    state.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('listening-text').textContent = `"${transcript}"`;
        checkAnswer(transcript);
    };

    state.recognition.onerror = (event) => {
        state.isListening = false;
        document.getElementById('mic-btn').classList.remove('listening');
        const msg = event.error === 'no-speech' ? 'No speech — try again' : 'Error — try again';
        document.getElementById('listening-text').textContent = msg;
    };

    state.recognition.onend = () => {
        state.isListening = false;
        document.getElementById('mic-btn').classList.remove('listening');
    };

    return true;
}

function startListening() {
    if (state.isListening) return;

    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'feedback-display';
    document.getElementById('listening-text').textContent = '';

    try {
        state.recognition.start();
    } catch (e) {
        // recognition may already be running; ignore
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
    state.maxNumber = parseInt(document.getElementById('max-number').value, 10);
    state.questionCount = parseInt(document.getElementById('question-count').value, 10);
    state.questions = generateQuestions(state.maxNumber, state.questionCount);
    state.currentIndex = 0;
    state.correctCount = 0;
    state.wrongAttempts = 0;

    document.getElementById('timer-display').textContent = '00:00';
    showScreen('quiz');
    renderQuestion();
    startTimer();

    if (!state.speechSupported) {
        const input = document.getElementById('answer-input');
        input.value = '';
        input.focus();
    }
}

function renderQuestion() {
    const q = state.questions[state.currentIndex];
    document.getElementById('question-display').textContent = `${q.a} + ${q.b}`;
    document.getElementById('progress-display').textContent =
        `${state.currentIndex + 1} / ${state.questionCount}`;
    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'feedback-display';

    if (state.speechSupported) {
        document.getElementById('listening-text').textContent = 'Tap to answer';
    } else {
        const input = document.getElementById('answer-input');
        input.value = '';
        input.focus();
    }
}

function checkAnswer(input) {
    const normalized = normalizeAnswer(input.toString());
    const q = state.questions[state.currentIndex];
    const correct = q.answer.toString();
    const feedback = document.getElementById('feedback-display');

    if (normalized === correct) {
        feedback.textContent = 'Correct!';
        feedback.className = 'feedback-display correct';
        state.correctCount++;

        setTimeout(() => {
            state.currentIndex++;
            if (state.currentIndex >= state.questionCount) {
                endQuiz();
            } else {
                renderQuestion();
            }
        }, 600);
    } else {
        feedback.textContent = 'Not quite — try again!';
        feedback.className = 'feedback-display incorrect';
        state.wrongAttempts++;

        if (!state.speechSupported) {
            const answerInput = document.getElementById('answer-input');
            answerInput.value = '';
            answerInput.focus();
        }
    }
}

// Typed fallback submit
function submitTyped() {
    const input = document.getElementById('answer-input');
    const raw = input.value.trim();
    if (raw === '') return;
    checkAnswer(raw);
}

// ============================================
// RESULTS
// ============================================

function endQuiz() {
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
        document.getElementById('mic-section').classList.remove('hidden');
        document.getElementById('typed-section').classList.add('hidden');
    } else {
        document.getElementById('mic-section').classList.add('hidden');
        document.getElementById('typed-section').classList.remove('hidden');
    }

    initHome();

    document.getElementById('max-number').addEventListener('change', initHome);
    document.getElementById('question-count').addEventListener('change', initHome);

    document.getElementById('start-btn').addEventListener('click', startQuiz);

    // Speech input
    document.getElementById('mic-btn').addEventListener('click', startListening);

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
