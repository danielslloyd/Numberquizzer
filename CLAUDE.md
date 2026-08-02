# CLAUDE.md — Math Flash Cards

## Project overview

Static single-page app deployed on Netlify. No build step, no dependencies, no
framework, and it is staying that way — the plug-in isolation that lets separate
work-streams avoid conflicts *depends* on classic scripts sharing one global scope.

Two halves:

- **Practice** — twenty bespoke activity modes. Detail in `docs/modes.md`.
- **Learn** — a curated proficiency graph, a generic assessment runner, and a
  mastery model. Detail in `docs/learn.md`.

## File layout

```
index.html         all screens + settings widget + sprite layer
boot.js            THE script manifest and the single asset version
app.js             core: state, deck generation, speech, animation, quiz flow
styles.css         core styles

curriculum/PROFICIENCIES.md   the curated proficiency list — source of authority
curriculum/nodes-*.js         the same list as data (201 nodes)
curriculum.js                 registry, seeded RNG, lazy pack loader (CUR)
gen/                          item generators, lazily loaded; manifest.js is generated
content/                      word and language banks
item-draw.js item-types.js item-gen-helpers.js item-runner.js
progress.js library.js learn.css storage.js
speech.js                     THE page's one SpeechRecognition, claimed by token
audio.js                      on-device vowel/sibilant analysis (no network)

parser.js animator.js physics.js physics-worker.js   visualizer
language-arts.js + .css       lazily loaded plug-in
geometry-proofs.js + .css     lazily loaded plug-in
polygons.js + .css            lazily loaded plug-in
tools/                        manually-run validators; never a build gate
netlify.toml                  publish = ".", must-revalidate on everything
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
**One microphone, therefore one recogniser.** `speech.js` owns it; everything
else borrows it by claim. **Never construct a second `SpeechRecognition`** — two
instances fight over the input stream and the loser fails in a way that reads as
the recogniser being flaky.

```js
const tok = spListen({ onText, onEnd, lang, alternatives, indicator });
spRelease(tok);      // stale tokens are ignored, so releasing twice is safe
```

- A new claim supersedes the old one and tells it so via `onEnd('superseded')`
- `onText` fires on every interim *and* final result, with all alternatives
- Restarts are the module's problem, not the caller's; callers never see `onend`
- `findNumberInSpeech()` scans all 1/2/3-word n-grams for a recognisable number
- Flash cards fall back to typed input (`#typed-section`) with no recogniser;
  the Learn runner falls back to tap items — see `docs/learn.md`

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

## Extension points — treat as a public API

`TAB_ENTRY`, `SCREEN_TAB`, `showScreen()`, body-level `#<name>-screen` divs
inserted before `#sprite-layer`, and `#tab-bar` accepting appended `.tab-btn`
children. Two external plug-ins depend on all of it. Build on top; do not change
the shape.

A new self-contained mode follows `language-arts.js`: one IIFE that injects its
own stylesheet, screens and tab, registers into `TAB_ENTRY`/`SCREEN_TAB`, and
touches no other file. Add it to `LAZY` in `boot.js` if it is large.

## Scripts and cache busting

**`boot.js` owns the script list and the only version number.** Bump `ASSET_V`
on any change to a local `.js` or `.css`. Do not add `<script>` tags to
`index.html` — adding a file is a one-line append to an array in `boot.js`, which
is also what stopped `index.html` being a merge-conflict hotspot.

`language-arts.js`, `geometry-proofs.js` and `polygons.js` are fetched on first
tab click, not at boot. Their tab buttons are created up front so the bar behaves identically;
each plug-in's `injectTab` skips a button that already exists.

## Prefix table

Every module namespaces its globals. Taken: `ws tg tt fr mn pv pg py viz la gp sb`
(activities), `cur ir lb pr st idr gen` (Learn), and `sp` (the shared
recogniser) and `au` (on-device audio analysis). Pick a free one.

## Storage

New keys go through `storage.js` and are namespaced under `nq.`. Legacy keys are
flat and **must stay that way** — the times-tables grid reads `ttFact_*` live, so
migration copies rather than moves and nothing is ever deleted.

## Key constraints / design rules

### Core quiz
- **No card count cap** — the complete deck is always used; never sample randomly
- **No delay between correct answer and next card** — animation is the only pause
- **Zero can never be a divisor**
- **Subtraction and division answers must be whole numbers within the range**
- The settings burger is **only visible on the home screen**
- `state.animations` and `state.showTranscript` are read at quiz start; they do
  not hot-reload mid-quiz

### Learn
- **No grade level in UI code.** It lives in `node.provenance` for authoring only,
  and the validator fails if a UI file mentions it.
- **Nothing is gated.** Every rung opens from a cold profile.
- **Generators never call `Math.random()`** — they take a seeded `rng`.
- **Every item's own answer must grade correct through its own declared grader.**
- Ladder position is array order. Never hand-write a `rung`.
- An item's `sig` is a de-duplication key. Pass the *kind* of item; the
  helpers append the answer. A sig coarser than the item makes the runner
  throw away good questions as repeats.

### Fractions
- **Every fraction is written over/under** (`frFracHTML` / `.fr-frac`). There is
  no `a/b` slashed form anywhere in the tab, including feedback lines.
- **Every shape is a pie.** `frRenderBar` stays only because `item-draw.js`
  draws Learn's fraction items with it — it is not dead code.
- A one-piece pie is a plain `<circle>`: an SVG arc whose start and end
  coincide renders nothing, and the Build preview starts at 1/1.
- **Build and Simplify have no submit button** — `frCheckWork()` runs on every
  stepper press and the round ends the instant the preview is right.
- Compare's dashed circle is on **every** round. Showing it only when the pair
  is equal announces the answer.
- Simplify's builder starts holding a **copy of the source**, not 1/1. Sweeping
  up from 1/1 passes through every unit fraction, so any source equal to a half
  would be solved by the first press.

### Polygons
- Vertices start at `90 + 180/n` **in SVG screen space** (y down), which puts a
  flat edge along the bottom at every side count. At `-90` a square renders as
  a diamond.
- Irregular polygons jitter radius and angle but **keep the angles sorted**, so
  the outline is star-shaped and therefore cannot self-intersect.
- Questions whose answer depends on regularity (interior angle, exterior angle,
  symmetry) are never asked of an irregular shape. Angle *sum* may be — that it
  holds for any polygon is the point.
- Wrong answers are the right answers for a neighbouring side count, plus the
  classic misconception for that question type.
- **Anything answered in degrees is Hard only.** Easy and Medium count and name.

### Visualizer
- **Canvas sizing** (`animator.js`) — camera aspect from the *container's* real
  size, `renderer.setSize(w, h, false)`, and the `render()` loop's size-drift
  check. Keep all three or the scene renders vertically squished.
- **Fill staging** — `fillBox()` reveals one dimension at a time; delays are
  precomputed into a `delays[]` array indexed to creation order. Change one loop
  order and you must change both. `MathAnimator.FILL_DURATION` and
  `handleVisualizerShow()` must stay in step.
- **Block rotation** — blocks generate axis-aligned; never bake a resting tilt in.
  The tumble is angular momentum given on DROP.

## Verification

```bash
node tools/validate-curriculum.js
node tools/smoke-generators.js          # also regenerates gen/manifest.js — commit it
python3 -m http.server 8765 &
NODE_PATH=/opt/node22/lib/node_modules node tools/smoke-browser.js
```

None is a build gate. Run them before pushing anything that touches Learn.

## Development workflow

Branch: `main`. Work on a short-lived branch and merge back, or commit straight
to `main` for small changes. **Do not push to `main` without explicit permission.**

If push is rejected: `git pull origin main --rebase && git push origin main`.

## Where the rest lives

- `docs/modes.md` — the eighteen activity modes in detail (times tables,
  fractions, make ten, place value, money incl. sizing and currency rules,
  geometric proofs).
- `docs/learn.md` — the curriculum graph, item contract, mastery model, and how
  to add a proficiency or a response type.
- `curriculum/PROFICIENCIES.md` — what is being assessed and why each thing
  earned its place.

CLAUDE.md was split on 2026-07-29. It had grown past the point where anyone would
read it end to end, so it now holds the invariants and the per-mode prose lives
alongside the code it describes.

## Hidden features
- **Number Bonds worksheet** — fully implemented (`pgPDFBonds`, `pgDrawBonds`, `pgDrawBond`, `pgMakeBonds` in `app.js`; config UI at `#pg-bonds-config` in `index.html`). The "Bonds" button in the worksheet type selector is hidden via `class="hidden"`. To re-enable, remove the `hidden` class from the button in `index.html`. Activate programmatically with `pgSetType('bonds')`.

