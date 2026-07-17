# CLAUDE.md — Math Flash Cards

## Project overview

Static single-page app (`index.html` + `app.js` + `styles.css`) deployed on Netlify.
No build step, no dependencies, no framework.

## File layout

```
index.html         — all screens (home, quiz, results) + settings widget + sprite layer
app.js             — all logic: state, deck generation, speech, animation, quiz flow
styles.css         — all styles
parser.js          — math visualizer expression parser (a × b + c)
animator.js        — Three.js InstancedMesh scene + animation for the visualizer
physics.js         — inline + Web Worker Cannon backends
physics-worker.js  — Cannon running on a dedicated Web Worker (loaded via new Worker(...))
netlify.toml       — publish = ".", must-revalidate caching for all assets
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

## Interactive learning modes

These are screen-based games (not PDF generators), each driven from `TAB_ENTRY` in `app.js`:

- **Times Tables** (`times-grid-screen`, `tt*` functions) — 11×11 multiplication grid. Two modes via toggle: **Explore** (tap a cell to reveal/hide the product; shows a big `r × c = p` equation in `#tt-equation` below the grid) and **Quiz** (`ttAutoSelect` auto-picks an unfilled cell; answer in the `#tt-quiz-bar` input; correct fills green and auto-advances, wrong shakes). Active cell highlights its row/column factor headers. Per-fact mastery stored in localStorage as `ttFact_<r>x<c>` (correct-answer counter). Grid size set by `#tt-max` (5/10/12).
- **Fractions** (`fractions-screen`, `fr*` functions) — two sub-modes via toggle (`frSetMode`): **Compare** ("which is bigger?", `frNewCompare`; equal values rejected; tap larger → score) and **Identify** (`frNewIdentify`/`frCheckIdentify`; one shape shown, user types numerator + denominator into `#fr-id-num`/`#fr-id-den`, exact match required). Shapes rendered as SVG (`frRenderBar`/`frRenderPie`); shape toggle (bar/pie) and denominator range (`#fr-max-den`).
- **Make Ten ten-frame** — optional `#mt-tenframe` checkbox on the Make Ten menu adds a ten-frame visual (`tgRenderVisual`) above the choices during the tap game, showing the known addend as filled dots. Only renders for `make-ten` mode with the option on.
- **Place-value visualizer** (`viz-place-mode`, `pv*` functions) — secondary mode of the Visualizer tab (toggle via `vizSetMainMode`). Enter a number (`#pv-input`); `pvRender` draws base-ten blocks as SVG to scale — ones (unit cubes), tens (rods), hundreds (flats), thousands (10×100 columns of stacked hundred-flats) — each place a distinct color with a large bold digit label beneath. viewBox auto-fits (`xMidYMax meet`) for dynamic zoom; updates on every keystroke. The original 3D Three.js multiply visualizer lives in `viz-multiply-mode`.
- **Money visualizer** (`money-screen`, `mn*` functions) — four sub-modes via toggle (`mnSetMode`): **Identify** (`mnNewIdentify`/`mnCheckIdentify`; a random amount is shown as pieces, user types it), **Build** (`mnNewBuild`; tap denomination buttons to reach a target, with live total, undo/clear, and a fewest-pieces check on success), **Change** (`mnRenderChange`; enter an amount and pick a breakdown chip — exact change, coins only, or novelties like "All 1¢") and **Shopping** (`mnShop*`; spend a budget on a catalogue without going over). Five currencies in `MN_CURRENCIES` (USD default, GBP, EUR, CAD, AUD), each a list of denominations valued in **minor units** (cents/pence); choice persists in localStorage as `mnCurrency`. Identify/Build share the range select (`#mn-range`: under $1 / under $1000), which also drives the denomination pool via `mnPool` (a $1 bill is no use under $1).

### Money: sizing and assets

Every denomination carries `mm`, its real-world width. CSS sizes each piece as `mm * --mn-ppm`, so **all pieces are to scale against each other** — a dime really is smaller than a penny, an AUD $2 smaller than an AUD $1, and a note ~6.4x a quarter.

A pile renders as **one column per distinct denomination** (`.mn-stage` > `.mn-col`), highest value on the left, each column a bottom-aligned stack. `mnFitStage()` binary-searches `--mn-ppm` up to the largest value where the columns still fit **90% of the box width** and all of its height — so few denominations show big, many show smaller, always "as large as will fit." A column draws at most `MN_COL_MAX` (12) real pieces; beyond that it shows a `×N` badge with the true count (so "all pennies" is a neat labelled stack, not 137 coins). Because a wide pile can inflate the box's own measured width, `mnFitStage` first collapses `--mn-ppm` to the minimum, reads the true box width, then grows into that fixed reference — measuring against the live width would feed back and overflow. The Build toolbar is a wrap-row, not columns, so it uses `mnFitHeight` (height-only).

USD pieces are real **photos hot-linked from Wikimedia Commons** (`d.img`, all public domain — 4 individual coin obverses + 5 individual note obverses; **not** stored in the repo). `mnPieceHTML` layers the `<img>` over the drawn SVG (`mnCoinSVG`/`mnBillSVG`) inside a `.mn-photo` wrapper, so a slow fetch shows the drawing until the photo arrives and a failed fetch (`onerror` removes the img) leaves the drawing in place — which is why USD denoms keep their `face`/`edge`/`ink` colours even though they normally show a photo. `.mn-photo` is `overflow:hidden` so the wrapper's `border-radius` (50% for coins, 3px for notes) clips the photo; sources are tight-cropped so `object-fit:cover` needs no per-image tuning. Non-USD currencies render as drawn SVG only.

The bills are **individual** note images, not the old `USDnotes.png` composite — you can't hot-link one note out of a 7-note composite (and it's 8.9 MB). To swap or add USD art, resolve a Commons thumbnail URL (keep it public-domain) and drop it in `d.img`; nothing to commit.

### Money: rules to preserve

- **Denomination values are always minor units** (`v: 25` is 25¢, `v: 2000` is a $20 bill) — never store floats, money math is integer-only
- `mnFewest` uses **DP, not greedy** — greedy is wrong for non-canonical denomination sets, so keep it if new currencies are added
- `mnRandomAmount` steps by the **smallest denomination**, so the target stays makeable in currencies with no 1¢ — do not switch to a plain random integer
- Not every amount is makeable: CAD/AUD have no 1¢, so `mnChangeOptions` can return empty (e.g. $1.37 CAD) — that path must stay handled
- `MN_COL_MAX` caps pieces drawn per column; higher counts get a `×N` badge so "All 1¢" of a large amount stays responsive
- Amount fields are **cash-register entry** (`mnAttachAmount`): digits fill from the right (1234 → 12.34), so there is never an ambiguous bare integer and no placeholder is needed. Read them with `mnFieldCents`, not `parseFloat`
- The mode panels (`#mn-identify` etc.) must stay `width: 100%` — the container centres its children, so without it the pile box shrinks to content and the 90%-width sizing has nothing to work against

`.tt-btn-group` (shared by Fractions, Times Tables, and Money mode toggles) has `flex-wrap: wrap`, and `.tt-container`/`.fr-container` trim their side padding under 420px — both needed so those tabs don't overflow a phone viewport.

### Money: Shopping mode

A **fixed catalogue** (`MN_SHOP_CATALOG`), not a live storefront. A static page cannot query a retailer: cross-origin requests are blocked, and Amazon's Product Advertising API needs server-side credential signing that would leak in a public page. So prices live in the catalogue and only the **photos** are fetched, hot-linked from Wikimedia Commons; the search term filters the catalogue. Photos are CC-licensed, so each item carries `by`/`lic` and renders a credit in its tile `title` — keep that if you edit the catalogue. The grid is built on first entry to the mode (not in `mnInit`) so visitors who never open Shopping don't fetch ~10 external images; `MN_IMG_FALLBACK` hides a tile's image if a hot-linked URL ever rots.

## Hidden features

- **Number Bonds worksheet** — fully implemented (`pgPDFBonds`, `pgDrawBonds`, `pgDrawBond`, `pgMakeBonds` in `app.js`; config UI at `#pg-bonds-config` in `index.html`). The "Bonds" button in the worksheet type selector is hidden via `class="hidden"`. To re-enable, remove the `hidden` class from the button in `index.html`. Activate programmatically with `pgSetType('bonds')`.

## Key constraints / design rules

- **No card count cap** — the complete deck is always used; never sample randomly
- **No delay between correct answer and next card** — `advanceQuestion()` advances instantly (animation is the only pause)
- **Zero can never be a divisor**
- **Subtraction and division answers must be whole numbers within the selected range**
- The settings burger is **only visible on the home screen** (managed in `showScreen()`)
- `state.animations` and `state.showTranscript` are read at quiz start from the burger toggles; they do not hot-reload mid-quiz
