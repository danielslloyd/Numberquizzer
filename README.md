# MathSpeak

A speech-based math quiz application for young children (ages 5-8) to practice basic arithmetic by answering questions out loud.

## Features

- **Speech Recognition**: Children answer math questions verbally - no typing required
- **Multiple Question Types**:
  - Addition
  - Subtraction
  - Multiplication
  - Division (whole numbers only)
  - Number Identification (reading multi-digit numbers aloud)
- **Deck System**: Parent-created collections of questions
- **Performance Tracking**: Best time per deck, XP counter
- **Clean UI**: High-contrast black and white design, minimal distractions
- **Local Storage**: All data saved in browser

## How to Use

### For Children

1. Open `index.html` in a web browser
2. Select a deck from the menu
3. Click "Start Quiz"
4. When you see a question, click the microphone button and speak your answer
5. Complete all questions as fast as you can!

### For Parents

1. Click "Parent Mode" button in the top-right corner
2. Create new decks by:
   - Entering a deck name
   - Selecting question type
   - Setting number ranges (for arithmetic)
   - Choosing number of questions
3. Click "Create Deck" to save
4. Delete decks if needed
5. Click "Exit Parent Mode" to return

## Browser Requirements

- **Chrome, Edge, or Safari** (for speech recognition support)
- Modern browser with Web Speech API support
- Microphone access required

## Technical Details

- Single-page application (HTML, CSS, JavaScript)
- Uses Web Speech API for voice recognition
- LocalStorage for data persistence
- No server or internet connection required after initial load
- Optimized for tablets and desktop browsers

## Features Implementation

### Speech Recognition
- Handles homophones (four/for, two/to/too, etc.)
- Normalizes spoken numbers to numeric values
- Supports compound numbers (e.g., "twenty three")
- Low-latency feedback

### Timing & Scoring
- Timer starts on first question
- Continues during incorrect answers
- Stops when final card is answered correctly
- Best time saved per deck

### Gamification
- XP counter (+1 per correct answer)
- Visual feedback animations
- Best time tracking
- New record celebrations

## Future Enhancements (v2+)

- Multiple child profiles
- Cloud sync
- Difficulty scaling
- Expanded math curriculum
- Analytics dashboard

## License

Created for educational purposes.
