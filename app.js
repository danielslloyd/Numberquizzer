// Addition Flash Cards

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
    const el = document.getElementById('best-time-home');
    el.textContent = bestTime !== null ? formatTime(bestTime) : '--:--';
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

    const input = document.getElementById('answer-input');
    input.value = '';
    input.focus();
}

function renderQuestion() {
    const q = state.questions[state.currentIndex];
    document.getElementById('question-display').textContent = `${q.a} + ${q.b}`;
    document.getElementById('progress-display').textContent =
        `${state.currentIndex + 1} / ${state.questionCount}`;
    document.getElementById('feedback-display').textContent = '';
    document.getElementById('feedback-display').className = 'feedback-display';

    const input = document.getElementById('answer-input');
    input.value = '';
    input.focus();
}

function submitAnswer() {
    const input = document.getElementById('answer-input');
    const raw = input.value.trim();

    if (raw === '') return;

    const given = parseInt(raw, 10);
    const q = state.questions[state.currentIndex];
    const feedback = document.getElementById('feedback-display');

    if (given === q.answer) {
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
        feedback.textContent = `Not quite — try again!`;
        feedback.className = 'feedback-display incorrect';
        state.wrongAttempts++;
        input.value = '';
        input.focus();
    }
}

// ============================================
// RESULTS
// ============================================

function endQuiz() {
    const elapsed = stopTimer();
    const bestTime = loadBestTime();
    const isNewBest = bestTime === null || elapsed < bestTime;

    if (isNewBest) {
        saveBestTime(elapsed);
    }

    document.getElementById('final-time').textContent = formatTime(elapsed);
    document.getElementById('final-score').textContent =
        `${state.correctCount} / ${state.questionCount}`;

    const displayedBest = isNewBest ? elapsed : bestTime;
    document.getElementById('best-time-results').textContent = formatTime(displayedBest);

    const badge = document.getElementById('new-record-badge');
    if (isNewBest) {
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    const title = document.getElementById('results-title');
    title.textContent = state.correctCount === state.questionCount ? 'Perfect!' : 'Done!';

    showScreen('results');
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initHome();

    // Settings changes refresh best time display
    document.getElementById('max-number').addEventListener('change', initHome);
    document.getElementById('question-count').addEventListener('change', initHome);

    document.getElementById('start-btn').addEventListener('click', startQuiz);

    document.getElementById('submit-btn').addEventListener('click', submitAnswer);

    document.getElementById('answer-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitAnswer();
    });

    document.getElementById('play-again-btn').addEventListener('click', startQuiz);

    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
        initHome();
    });
});
