# Math Flash Cards

A speech-based math flash card app for kids. Speak your answer — no tapping, no typing. Race against your best time.

## Features

- **Always-on microphone** — no button to tap; the mic listens continuously and accepts the answer the moment it hears a number anywhere in speech ("I think twelve" → ✓)
- **Four operations** — addition, subtraction, multiplication, division; select any combination
- **Column-arithmetic layout** — questions display like written math:
  ```
    7
  + 5
  ───
  ```
- **Complete decks** — every valid question for the selected operations and number range is always included (no random subsets); deck size scales with range
- **Subtraction & division constraints** — answers are always whole numbers within the chosen range; minuends and dividends may exceed the range (e.g. `35 ÷ 5 = 7` with max=10 is valid)
- **Zero safety** — zero can never be a divisor; it can be a dividend or quotient
- **Best time tracking** — per operation-combination and number range, stored in localStorage
- **Animations** — card flip on each correct answer; three floating number sprites (top number, bottom number, answer) burst from the card and drift upward
- **Live transcript** — spoken audio shown at the bottom of the screen while the mic is active

## Settings (hamburger menu ☰)

| Setting | Default | Description |
|---|---|---|
| Shuffle deck | On | Randomise question order each run |
| Animations | On | Card flip + floating number sprites |
| Show transcript | On | Display live speech recognition text at the bottom |

## Deployment

Hosted as a static site on [Netlify](https://www.netlify.com/). No build step required — connect the repo and deploy.

```toml
# netlify.toml
[build]
  publish = "."
```

All assets use `must-revalidate` caching so deploys are picked up immediately.

## Browser Support

Speech recognition requires the **Web Speech API**:

| Browser | Support |
|---|---|
| Chrome / Edge | ✓ Full support |
| Safari (desktop + iOS) | ✓ Full support |
| Firefox | ✗ Falls back to typed input |

The app falls back to a number input + submit button automatically on unsupported browsers.

## How It Works

### Speech pipeline

1. `SpeechRecognition` runs in `continuous` mode with `interimResults: true`
2. Every result (interim or final) is scanned for a matching number using `findNumberInSpeech()`
3. `findNumberInSpeech()` checks every 1-, 2-, and 3-word n-gram in the transcript against a word-to-number map, handling homophones (`for→four`, `ate→eight`, `won→one`, etc.) and compound numbers (`twenty three → 23`)
4. If a matching number is found, the question advances instantly — no confirmation needed
5. On silence the browser ends the session; the app restarts it within 100ms

### Deck generation

Questions are generated exhaustively for each selected operation:

| Operation | Formula | Cards (max=10) |
|---|---|---|
| Addition | a ∈ [1,max], b ∈ [1,max] | 100 |
| Subtraction | subtrahend ∈ [1,max], answer ∈ [0,max] | 110 |
| Multiplication | a ∈ [1,max], b ∈ [1,max] | 100 |
| Division | divisor ∈ [1,max], quotient ∈ [0,max] | 110 |

The same set of cards is always produced for a given configuration; shuffle is applied on top.

### Best time key

Best times are stored per exact configuration:
```
bestTime_addition,multiplication_10
```

Changing any setting (operations or number range) gives a separate best time record.

## Stack

- Vanilla HTML / CSS / JavaScript — no frameworks, no build tools
- Web Speech API
- localStorage
