# CLAUDE.md — Math Flash Cards

## Project overview

Static single-page app deployed on Netlify. No build step, no dependencies, no
framework, and it is staying that way — the plug-in isolation that lets separate
work-streams avoid conflicts *depends* on classic scripts sharing one global scope.

Two halves:

- **Practice** — twenty-two bespoke activity modes. Detail in `docs/modes.md`.
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
sounds.js + .css              lazily loaded plug-in (vowel sandbox over audio.js)
patterns.js + .css            lazily loaded plug-in (number sequences)
clocks.js + .css              lazily loaded plug-in (read/set/elapsed time)
decimals.js + .css            lazily loaded plug-in (hundredths grid, compare, round)
mazes.js + .css               lazily loaded plug-in (number mazes, square/hex, play + PDF)
turret.js + .css              lazily loaded plug-in (3D turret shooter, tablet-budget three.js)
models/                       Kenney Space Kit fighter OBJs (CC0) the turret fetches
textures/                     the turret's window-grime alpha PNG
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
const tok = spListen({ onText, onEnd, onNotice, lang, alternatives, indicator });
spRelease(tok);      // stale tokens are ignored, so releasing twice is safe
```

- A new claim supersedes the old one and tells it so via `onEnd('superseded')`
- `onText` fires on every interim *and* final result, with all alternatives
- Restarts are the module's problem, not the caller's; callers never see `onend`;
  a caller that wants to *display* them asks for the optional `onNotice`
- `speechNumbers()` returns **every** number a transcript could be, longest
  n-gram first, and the caller asks whether its target is among them. Returning
  only the first is how `"twenty three"` used to be read as 20.
- Mishearings are folded in three layers: an explicit table, then any word one
  edit from exactly one number word, then nothing. **The teen/ty pairs are never
  folded** — accepting "fifty" for 15 advances the card on a wrong answer, which
  is worse than not hearing a right one.
- `findNumberInSpeech()` is `speechNumbers()[0]`, kept for callers wanting one
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

`language-arts.js`, `geometry-proofs.js`, `polygons.js`, `sounds.js` and
`patterns.js` are fetched on first tab click, not at boot. Their tab buttons are created up front so the bar behaves identically;
each plug-in's `injectTab` skips a button that already exists.

## Prefix table

Every module namespaces its globals. Taken: `ws tg tt fr mn pv pg py vs np viz la gp sb ck dc mz tr`
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
- `state.animations`, `state.showTranscript` and `state.speechDebug` are read at
  quiz start; they do not hot-reload mid-quiz
- The speech debugger (`sdHeard`, `#speech-debug`) only ever **reports**. Nothing
  in it participates in matching, and it builds its rows from text nodes because
  every string in it came off a microphone

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
- The compare operator lines up with the **fractions**, not the pies. That is
  held by three CSS variables — `--fr-card-pad`, `--fr-card-border` and
  `--fr-label-h` — shared by the card's label row and the operator slot. Change
  the card's padding or border without changing the slot's offset and the
  operator drifts by exactly that much.
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

### Place value
- The count-up frame reserves **ten slots in every place the target uses**, not
  the target's own digits. A place must be able to hold ten before it can spill,
  and a frame that resized mid-count would move everything under the eye.
- Every merge is a **pure translation plus a colour fade** — nothing resizes.
  Ten cubes with their gaps closed *are* a rod; ten rods with their gaps closed
  *are* a flat. `pvClosedXY` and `PV_GEOM` encode that identity and the smoke
  test asserts it; break it and merges need resizing, which looks wrong.
- A tween completes on a **timeout as well as on rAF**. requestAnimationFrame
  does not fire in a hidden tab and the driver only advances from a tween's
  callback, so without it a carry begun as the user switched tabs would hang
  the whole count.

### Patterns
- **A generated sequence is not trusted.** Every family carries a `holds`
  predicate that re-derives the pattern from the finished terms, and `npMake`
  throws the sequence away if its own family cannot see the pattern in it.
- **Exactly one option may fit.** For a next/missing question no distractor may
  sit in the blank and leave `holds` true; for a rule question no distractor
  may be a true description of the terms. Two defensible answers is the failure
  mode this mode has, and the smoke test asserts against it directly.
- Every "add N / subtract N" string comes from `arithRule`. Built by hand it
  reads "add -9 each time" the moment a step goes negative — a different claim
  from the one being made.
- The step labels between the tiles are computed from the **terms on screen**
  (`npStepLabels`), never from the generator's intent. They are the explanation,
  so they stay true even if a generator is wrong.

### Mazes
- **Exactly one route, and the builder is not trusted.** `mzCount` counts
  START→END paths using only `mzLegal` — the predicate the player is held to —
  and a maze is kept only on a count of one.
- For set rules the passable cells must stay a **tree**: the route may not
  touch itself except step to step, and a dead-end cell may touch exactly one
  passable cell. Loosen either and a shortcut appears.
- Sequence steps must be **strictly monotonic**. The exact route count relies
  on each value having one step index; a pattern that can repeat a value
  (+2 −1) breaks it.
- An illegal step is **refused, not drawn**. Dead ends are legal steps, so
  refusing tells the player about the rule and nothing about the route.

### Turret
- **Nothing allocated per frame.** Scratch vectors and fixed pools only; a GC
  pause on a Fire tablet reads as stutter. Allocation is fine on a tap, a
  spawn or an answer, never in an `trUpdate*` loop.
- **A hit is decided, not detected.** A locked bolt is aimed at the path's
  intercept; a miss rewrites the fighter's path and checks it clears the bolt
  by `MISS_BY`. A shot at a rock is steered onto it and always lands; enemy
  fire is a hit or a miss from the moment it leaves the muzzle. Never add a
  collision test between a shot and a target. The one proximity test is a
  rock against the hull, and `INCOMING` rocks are aimed there on purpose. A
  rock that hits breaks with no explosion, and its pieces start outside the
  hull marked `safe` — without both, one rock is several hits.
- **The player cannot lose.** Being hit is a red flash, a jolt and a filler
  readout dipping — never a score, a life or a slower sortie.
- **The aim point is where the finger lands.** There is no fixed reticle: a
  shot goes through the tap, `#tr-tap` marks it, and the 3D guns turn to it.
- **Windings are rewound, not just renormalled.** A double-sided Lambert
  material lights the face you see by its winding, so a flipped normal alone
  lights the outside as if it were the inside — the fighters were reverse-lit
  that way. Kenney's models are trusted as wound (`trFaceted(…, null)`): the
  centre test misreads concave shapes.
- **Fighters enter off-screen and fly C1 paths.** `trPlanPath` starts every
  path well outside the turret's view; `trHermite` scales each handle by its
  segment's duration so speed is continuous through knots; `trSafePath`
  re-plans any path that passes within `PASS_MIN` of the cockpit. Bank comes
  from the lift the path needs, never from a hand-set angle.
- **Lock distance is measured from the target box**, the one drawn on screen
  (`trBoxHalf`), not from the fighter's centre: a tap locks when it lands
  within `nearPx` of the box's edge. Rocks have their own fixed reach.
- **Quality features belong to a tier.** Shiny (Phong) fighters are on Medium
  and High; the muzzle light and the thruster lights are High only (below it
  thrusters only glow); rocks are 180, 320 or 720 faces. The rock shape is a
  fractal function of direction (`trRockShape`), so a finer tier is the same
  rock resolved more finely, and its icosphere winding is trusted — the centre
  test misreads a crater's steep side. The thruster lights are a fixed pool
  of `MAX_ENEMIES`, dark when unused, for the same reason as the muzzle light. The light stays in the scene and is
  hidden, because the light count is part of every lit shader: toggling it
  recompiles once on a tier change, adding and removing it would on every shot.
- **The glass is baked, not drawn.** Grime, its hit-coloured twin and the hit
  wash share one stencil and are baked on resize or a settings change only. A
  hit crossfades opacities; it never re-bakes. A lock does not turn the turret.
  Reach and fade are fractions of the stage's **short side**, applied square to
  every window edge (`trInsetWindow`) — a fraction of each axis changes the
  border's shape with the aspect ratio.
- **The stage fills the screen at any shape.** On a portrait stage the FOV
  goes across (`trFov`), so the guns stay in view, and the grime is turned
  a quarter so it is not cropped to a strip.
- **Fighters keep the kit's colours.** Only accent faces (`metalRed`) take
  the instance colour; the `accent`, `shine` and `glow` (thruster)
  attributes and the r128 chunks `trShipShader` replaces carry that. Squish is in the instance
  matrix, never baked into the geometry.
- **A tap is never swallowed.** A full bolt pool gives up its oldest free
  shot; a locked bolt is never taken. Taps fire once a card is answered —
  only a card that is still asking holds the guns.
- **Nothing owed is dropped.** A question open, or an ace in the air, when the
  scene is torn down goes back in the deck or the ace queue.
- **Bests come from whole sorties only**, and the turret never writes
  `ttFact_*` — its own store is `nq.turret.*`.
- **One recogniser claim per question**, released on answer and whenever the
  loop stops. A final result naming another number is a miss; an interim is not.

### Sounds
- The sandbox writes the same `voice.v1` anchors the Learn runner reads, so a
  recalibration here fixes vowel items everywhere.
- A **degenerate calibration is discarded, not saved** — three noises that are
  not three different noises leave a space in which every later reading is
  meaningless, and silently keeping it is worse than staying uncalibrated.
- A frame that is silent or unvoiced **must not move the dot**. Its formant
  estimate is not a quiet reading, it is a meaningless one, and letting it in
  sends the dot to a corner every time the speaker breathes.

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

