# CLAUDE.md — Math Flash Cards

## Project overview

Static single-page app (`index.html` + `app.js` + `styles.css`) deployed on Netlify.
No build step, no dependencies, no framework.

## File layout

```
index.html       — all screens (home, quiz, results) + settings widget + sprite layer
app.js           — all logic: state, deck generation, speech, animation, quiz flow
styles.css       — all styles
netlify.toml     — publish = ".", must-revalidate caching for all assets
```

## Architecture

### Screens
Three `<div class="screen">` elements. `showScreen(name)` removes `.active` from all
and adds it to `${name}-screen`. The settings burger is shown only on the home screen.

### State
One flat `state` object at the top of `app.js`. No framework reactivity — DOM is
updated directly in `renderQuestion()`, `endQuiz()`, etc.

### Question format
Each question is `{ display: "a\nOP\nb", answer: Number }`.
`renderQuestion()` splits `display` on `\n` to get `[top, op, bottom]` and builds
three HTML elements: `.q-op`/`.q-num` rows + `.q-line` underline.

### Deck generation
`generateAllQuestions(operations, max)` produces every valid question for every
selected operation. The deck is always the same set; shuffle is applied afterwards.
**Do not add random sampling inside this function** — completeness is a design requirement.

Constraints:
- Subtraction: subtrahend ∈ [1, max], answer ∈ [0, max]; minuend = subtrahend + answer (may exceed max)
- Division: divisor ∈ [1, max] (never 0), quotient ∈ [0, max]; dividend = divisor × quotient (may exceed max)

### Best time key
`bestTime_<sorted-ops-csv>_<max>` — one record per exact operation+range combination.

### Speech recognition
- `continuous: true`, `interimResults: true`
- `onresult` fires on every interim/final result; only the latest result is examined
- `findNumberInSpeech()` scans all 1/2/3-word n-grams for a recognisable number
- `onend` auto-restarts within 100ms while `state.quizActive`; stops cleanly on `endQuiz()`
- Falls back to typed input (`#typed-section`) when `SpeechRecognition` is unavailable

### Card flip animation
`flipCard(callback)`:
1. Sets `transform: rotateY(90deg)` with `ease-in` (145ms) — card rotates edge-on
2. At 145ms: runs `callback()` to update DOM, then jumps to `rotateY(-90deg)` with `transition: none`
3. Forces reflow (`void card.offsetHeight`), then sets `ease-out` back to `rotateY(0deg)` (145ms)
Only runs when `state.animations === true`.

### Floating sprites
`spawnSprites(q)` reads the card's `getBoundingClientRect()`, creates three `<span class="sprite">`
elements on `#sprite-layer` (fixed overlay, z-index 999), each positioned at a spread across the
card width. CSS custom properties `--dx`/`--dy` drive the drift in the `sprite-float` keyframe.
Sprites remove themselves on `animationend`.

## Development workflow

Branch: `claude/flashcard-app-netlify-BlGXx`

Always push to this branch. Do not push to `main` without explicit permission.

```bash
git add <files>
git commit -m "description"
git push -u origin claude/flashcard-app-netlify-BlGXx
```

If push is rejected (remote has new commits), pull with rebase first:
```bash
git pull origin claude/flashcard-app-netlify-BlGXx --rebase
git push -u origin claude/flashcard-app-netlify-BlGXx
```

## Cache busting

`index.html` links assets with a `?v=N` query string. **Increment `N` whenever
`app.js` or `styles.css` change** so browsers don't serve stale cached files.

```html
<link rel="stylesheet" href="styles.css?v=2">
<script src="app.js?v=2"></script>
```

## Key constraints / design rules

- **No card count cap** — the complete deck is always used; never sample randomly
- **No delay between correct answer and next card** — `advanceQuestion()` advances instantly (animation is the only pause)
- **Zero can never be a divisor**
- **Subtraction and division answers must be whole numbers within the selected range**
- The settings burger is **only visible on the home screen** (managed in `showScreen()`)
- `state.animations` and `state.showTranscript` are read at quiz start from the burger toggles; they do not hot-reload mid-quiz
