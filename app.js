// MathSpeak App - Main JavaScript

// ============================================
// STATE MANAGEMENT
// ============================================

const AppState = {
    currentScreen: 'menu',
    selectedDeck: null,
    currentCardIndex: 0,
    currentAnswer: null,
    xp: 0,
    startTime: null,
    timerInterval: null,
    recognition: null,
    isListening: false,
    decks: [],
    childProfile: {
        name: 'Child',
        totalXP: 0,
        deckProgress: {}
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function normalizeAnswer(text) {
    // Convert spoken text to numeric value
    const lowerText = text.toLowerCase().trim();

    // Handle common homophones
    const homophones = {
        'for': 'four',
        'to': 'two',
        'too': 'two',
        'won': 'one',
        'ate': 'eight',
        'fore': 'four',
        'tree': 'three'
    };

    let normalized = lowerText;
    for (const [wrong, right] of Object.entries(homophones)) {
        normalized = normalized.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
    }

    // Try to convert word to number
    const wordToNumber = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
        'hundred': 100, 'thousand': 1000
    };

    // Simple number conversion for single words
    if (wordToNumber.hasOwnProperty(normalized)) {
        return wordToNumber[normalized].toString();
    }

    // Try to parse complex numbers like "twenty three" or "one hundred"
    const numberValue = parseSpokenNumber(normalized, wordToNumber);
    if (numberValue !== null) {
        return numberValue.toString();
    }

    // If already a number, return it
    if (/^\d+$/.test(normalized)) {
        return normalized;
    }

    // Return original for non-numeric answers
    return normalized;
}

function parseSpokenNumber(text, wordToNumber) {
    // Handle compound numbers like "twenty three" -> 23
    const words = text.split(/\s+/);
    let total = 0;
    let current = 0;

    for (const word of words) {
        const value = wordToNumber[word];
        if (value === undefined) {
            // Try to parse as digit
            const digit = parseInt(word);
            if (!isNaN(digit)) {
                current += digit;
            } else {
                // Unknown word, return null
                return null;
            }
        } else if (value === 1000) {
            current = (current || 1) * 1000;
            total += current;
            current = 0;
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

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================
// DECK GENERATION
// ============================================

function generateDeck(name, type, options) {
    const deck = {
        id: Date.now().toString(),
        name,
        type,
        cards: [],
        bestTime: null
    };

    if (type === 'number-identification') {
        // Generate random numbers for identification
        const count = options.count || 10;
        const numbers = [];
        for (let i = 0; i < count; i++) {
            // Generate numbers between 10 and 9999
            const num = Math.floor(Math.random() * 9990) + 10;
            numbers.push(num);
        }

        deck.cards = numbers.map(num => ({
            question: num.toString(),
            answer: num.toString(),
            type: 'number-identification'
        }));
    } else {
        // Generate arithmetic questions
        const min = options.min || 1;
        const max = options.max || 10;
        const count = options.count || 10;
        const cards = [];

        for (let i = 0; i < count; i++) {
            const a = Math.floor(Math.random() * (max - min + 1)) + min;
            const b = Math.floor(Math.random() * (max - min + 1)) + min;
            let question, answer;

            switch (type) {
                case 'addition':
                    question = `${a} + ${b}`;
                    answer = (a + b).toString();
                    break;
                case 'subtraction':
                    // Ensure positive results
                    const larger = Math.max(a, b);
                    const smaller = Math.min(a, b);
                    question = `${larger} − ${smaller}`;
                    answer = (larger - smaller).toString();
                    break;
                case 'multiplication':
                    question = `${a} × ${b}`;
                    answer = (a * b).toString();
                    break;
                case 'division':
                    // Ensure whole number results
                    const product = a * b;
                    question = `${product} ÷ ${a}`;
                    answer = b.toString();
                    break;
            }

            cards.push({ question, answer, type });
        }

        deck.cards = shuffle(cards);
    }

    return deck;
}

// ============================================
// LOCAL STORAGE
// ============================================

function saveToStorage() {
    localStorage.setItem('mathspeakDecks', JSON.stringify(AppState.decks));
    localStorage.setItem('mathspeakProfile', JSON.stringify(AppState.childProfile));
}

function loadFromStorage() {
    const decksData = localStorage.getItem('mathspeakDecks');
    const profileData = localStorage.getItem('mathspeakProfile');

    if (decksData) {
        AppState.decks = JSON.parse(decksData);
    }

    if (profileData) {
        AppState.childProfile = JSON.parse(profileData);
    }

    // Create default decks if none exist
    if (AppState.decks.length === 0) {
        createDefaultDecks();
    }
}

function createDefaultDecks() {
    const defaultDecks = [
        generateDeck('Addition 1-10', 'addition', { min: 1, max: 10, count: 10 }),
        generateDeck('Subtraction 1-10', 'subtraction', { min: 1, max: 10, count: 10 }),
        generateDeck('Multiplication 1-5', 'multiplication', { min: 1, max: 5, count: 10 })
    ];

    AppState.decks = defaultDecks;
    saveToStorage();
}

// ============================================
// SPEECH RECOGNITION
// ============================================

function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Speech recognition not supported');
        return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    AppState.recognition = new SpeechRecognition();

    AppState.recognition.continuous = false;
    AppState.recognition.interimResults = false;
    AppState.recognition.lang = 'en-US';

    AppState.recognition.onstart = () => {
        AppState.isListening = true;
        document.getElementById('mic-btn').classList.add('listening');
        document.getElementById('listening-text').textContent = 'Listening...';
    };

    AppState.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('listening-text').textContent = `You said: "${transcript}"`;
        checkAnswer(transcript);
    };

    AppState.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        AppState.isListening = false;
        document.getElementById('mic-btn').classList.remove('listening');
        document.getElementById('listening-text').textContent = 'Try again';
    };

    AppState.recognition.onend = () => {
        AppState.isListening = false;
        document.getElementById('mic-btn').classList.remove('listening');
    };

    return true;
}

function startListening() {
    if (!AppState.recognition) {
        if (!initSpeechRecognition()) {
            alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
            return;
        }
    }

    if (AppState.isListening) {
        return;
    }

    // Clear previous feedback
    document.getElementById('feedback-text').textContent = '';
    document.getElementById('listening-text').textContent = '';

    try {
        AppState.recognition.start();
    } catch (error) {
        console.error('Error starting recognition:', error);
    }
}

// ============================================
// QUIZ LOGIC
// ============================================

function startQuiz(deck) {
    if (!deck) return;

    AppState.selectedDeck = deck;
    AppState.currentCardIndex = 0;
    AppState.xp = 0;
    AppState.startTime = Date.now();

    // Start timer
    startTimer();

    // Show quiz screen
    showScreen('quiz');

    // Show first question
    showNextCard();
}

function showNextCard() {
    if (AppState.currentCardIndex >= AppState.selectedDeck.cards.length) {
        endQuiz();
        return;
    }

    const card = AppState.selectedDeck.cards[AppState.currentCardIndex];
    AppState.currentAnswer = card.answer;

    document.getElementById('question-text').textContent = card.question;
    document.getElementById('feedback-text').textContent = '';
    document.getElementById('listening-text').textContent = '';
}

function checkAnswer(spokenText) {
    const normalized = normalizeAnswer(spokenText);
    const isCorrect = normalized === AppState.currentAnswer;

    const feedbackEl = document.getElementById('feedback-text');

    if (isCorrect) {
        feedbackEl.textContent = '✓ Correct!';
        feedbackEl.className = 'feedback-text correct';

        // Add XP
        AppState.xp++;
        updateXP();

        // Move to next card after delay
        setTimeout(() => {
            AppState.currentCardIndex++;
            showNextCard();
        }, 1000);
    } else {
        feedbackEl.textContent = '✗ Try again!';
        feedbackEl.className = 'feedback-text incorrect';
    }
}

function updateXP() {
    const xpEl = document.getElementById('xp-value');
    xpEl.textContent = AppState.xp;

    // Ping animation
    const xpCounter = document.querySelector('.xp-counter');
    xpCounter.classList.remove('ping');
    setTimeout(() => xpCounter.classList.add('ping'), 10);
}

function startTimer() {
    const timerEl = document.getElementById('timer-value');

    AppState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - AppState.startTime) / 1000);
        timerEl.textContent = formatTime(elapsed);
    }, 100);
}

function stopTimer() {
    if (AppState.timerInterval) {
        clearInterval(AppState.timerInterval);
        AppState.timerInterval = null;
    }
}

function endQuiz() {
    stopTimer();

    const finalTime = Math.floor((Date.now() - AppState.startTime) / 1000);

    // Update profile
    AppState.childProfile.totalXP += AppState.xp;

    // Check for best time
    const deck = AppState.selectedDeck;
    let isNewRecord = false;

    if (!deck.bestTime || finalTime < deck.bestTime) {
        deck.bestTime = finalTime;
        isNewRecord = true;
    }

    // Save progress
    saveToStorage();

    // Show results
    showResults(finalTime, isNewRecord);
}

function showResults(finalTime, isNewRecord) {
    document.getElementById('final-time').textContent = formatTime(finalTime);
    document.getElementById('final-xp').textContent = AppState.xp;

    const bestTimeEl = document.getElementById('best-time-value');
    const bestTimeStat = document.getElementById('best-time-stat');
    const newRecordBadge = document.getElementById('new-record-badge');

    if (AppState.selectedDeck.bestTime) {
        bestTimeEl.textContent = formatTime(AppState.selectedDeck.bestTime);
        bestTimeStat.style.display = 'block';
    } else {
        bestTimeStat.style.display = 'none';
    }

    if (isNewRecord) {
        newRecordBadge.style.display = 'block';
    } else {
        newRecordBadge.style.display = 'none';
    }

    showScreen('results');
}

// ============================================
// UI MANAGEMENT
// ============================================

function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    // Show target screen
    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }

    AppState.currentScreen = screenName;

    // Hide/show parent toggle based on screen
    const parentToggle = document.getElementById('parent-toggle');
    if (screenName === 'quiz') {
        parentToggle.style.display = 'none';
    } else {
        parentToggle.style.display = 'block';
    }

    // Update deck list when showing menu
    if (screenName === 'menu') {
        renderDeckList();
    }
}

function renderDeckList() {
    const deckList = document.getElementById('deck-list');
    deckList.innerHTML = '';

    if (AppState.decks.length === 0) {
        deckList.innerHTML = '<p style="text-align: center; opacity: 0.5;">No decks available. Enter Parent Mode to create one.</p>';
        return;
    }

    AppState.decks.forEach(deck => {
        const deckCard = document.createElement('div');
        deckCard.className = 'deck-card';

        const deckName = document.createElement('div');
        deckName.className = 'deck-name';
        deckName.textContent = deck.name;

        const deckInfo = document.createElement('div');
        deckInfo.className = 'deck-info';
        deckInfo.textContent = `${deck.cards.length} questions`;

        deckCard.appendChild(deckName);
        deckCard.appendChild(deckInfo);

        if (deck.bestTime) {
            const bestTime = document.createElement('div');
            bestTime.className = 'deck-best-time';
            bestTime.textContent = `Best: ${formatTime(deck.bestTime)}`;
            deckCard.appendChild(bestTime);
        }

        deckCard.addEventListener('click', () => selectDeck(deck));

        deckList.appendChild(deckCard);
    });
}

function selectDeck(deck) {
    AppState.selectedDeck = deck;

    // Update UI
    document.querySelectorAll('.deck-card').forEach(card => {
        card.classList.remove('selected');
    });

    event.target.closest('.deck-card').classList.add('selected');

    // Enable start button
    document.getElementById('start-quiz-btn').disabled = false;
}

// ============================================
// PARENT MODE
// ============================================

function renderParentDeckList() {
    const parentDeckList = document.getElementById('parent-deck-list');
    parentDeckList.innerHTML = '';

    if (AppState.decks.length === 0) {
        parentDeckList.innerHTML = '<p style="text-align: center; opacity: 0.5;">No decks created yet.</p>';
        return;
    }

    AppState.decks.forEach(deck => {
        const item = document.createElement('div');
        item.className = 'parent-deck-item';

        const info = document.createElement('div');
        info.className = 'parent-deck-info';

        const name = document.createElement('div');
        name.className = 'parent-deck-name';
        name.textContent = deck.name;

        const meta = document.createElement('div');
        meta.className = 'parent-deck-meta';
        meta.textContent = `${deck.type} • ${deck.cards.length} cards`;

        info.appendChild(name);
        info.appendChild(meta);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-deck-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteDeck(deck.id));

        item.appendChild(info);
        item.appendChild(deleteBtn);

        parentDeckList.appendChild(item);
    });
}

function deleteDeck(deckId) {
    if (confirm('Are you sure you want to delete this deck?')) {
        AppState.decks = AppState.decks.filter(d => d.id !== deckId);
        saveToStorage();
        renderParentDeckList();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load data from storage
    loadFromStorage();

    // Initialize speech recognition
    initSpeechRecognition();

    // Menu screen
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
        if (AppState.selectedDeck) {
            startQuiz(AppState.selectedDeck);
        }
    });

    // Quiz screen
    document.getElementById('mic-btn').addEventListener('click', startListening);

    // Results screen
    document.getElementById('try-again-btn').addEventListener('click', () => {
        if (AppState.selectedDeck) {
            startQuiz(AppState.selectedDeck);
        }
    });

    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
        showScreen('menu');
    });

    // Parent mode toggle
    document.getElementById('parent-mode-btn').addEventListener('click', () => {
        showScreen('parent');
        renderParentDeckList();
    });

    document.getElementById('exit-parent-mode-btn').addEventListener('click', () => {
        showScreen('menu');
    });

    // Parent mode form
    const deckForm = document.getElementById('deck-form');
    const questionTypeSelect = document.getElementById('question-type');
    const arithmeticOptions = document.getElementById('arithmetic-options');
    const numberIdOptions = document.getElementById('number-id-options');

    questionTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'number-identification') {
            arithmeticOptions.style.display = 'none';
            numberIdOptions.style.display = 'block';
        } else {
            arithmeticOptions.style.display = 'block';
            numberIdOptions.style.display = 'none';
        }
    });

    deckForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('deck-name').value;
        const type = document.getElementById('question-type').value;

        let deck;
        if (type === 'number-identification') {
            const count = parseInt(document.getElementById('number-count').value) || 10;
            deck = generateDeck(name, type, { count });
        } else {
            const min = parseInt(document.getElementById('range-min').value) || 1;
            const max = parseInt(document.getElementById('range-max').value) || 10;
            const count = parseInt(document.getElementById('card-count').value) || 10;
            deck = generateDeck(name, type, { min, max, count });
        }

        AppState.decks.push(deck);
        saveToStorage();

        // Reset form
        deckForm.reset();

        // Update parent deck list
        renderParentDeckList();

        alert(`Deck "${name}" created successfully!`);
    });

    // Initial render
    showScreen('menu');
});
