# The Learn engine

Curriculum, assessment, and the learner model. The eighteen bespoke activity
modes (`docs/modes.md`) are the *practice* half; this is the *assessment* half.

## The shape of it

```
curriculum/PROFICIENCIES.md   the curated list, and why each thing is on it
curriculum/nodes-math.js      113 nodes, 79 tier-1
curriculum/nodes-english.js    88 nodes, 63 tier-1
curriculum.js                 registry, seeded RNG, lazy pack loader (CUR)
gen/manifest.js               GENERATED — which nodes are buildable
gen/gen-<pack>.js             item generators, lazily loaded
content/words-*.js            word and language banks
item-gen-helpers.js           shared item constructors
item-draw.js                  display blocks + the DRAW table
item-types.js                 response types + GRADERS
item-runner.js                the assessment screen
progress.js                   mastery and review scheduling
library.js                    the ladder browser + section bar
storage.js                    shared localStorage helper
```

## Rules that are not negotiable

**No grade levels in UI code.** The target learner is routinely years ahead in
one subject and behind in another; a single grade is the wrong answer to "where
are you". Position is per-strand — a `strand` plus a `rung`. Grade survives only
inside `node.provenance`, for authoring and validation, and
`tools/validate-curriculum.js` fails the build if any UI file so much as mentions
`provenance`.

**Nothing is gated.** Every rung opens from a cold profile, including the top
one. `prNextUp()` suggests; it never locks. A learner ready for rung 9 should not
have to grind rungs 1 to 8 to prove it.

**Generators never call `Math.random()`.** They take a seeded `rng` and use it
for everything. Determinism is what makes an item reproducible, printable with a
matching answer key, and testable. The smoke test replaces `Math.random` with a
throw, so breaking this fails loudly. (The older activity modes predate the rule
and keep `Math.random()`; new code does not.)

**Every item's own answer must grade correct through its own declared grader.**
`tools/smoke-generators.js` asserts this across every node on every run. Showing
a child a wrong answer — or marking a right one wrong — is the worst failure this
app has, and it is worth a test that is slow and thorough.

**Graders are referenced by string, never as a function.** That keeps items
serialisable, so they can be cached, exported, printed and diffed.

**Never delete legacy localStorage keys.** The times-tables grid reads `ttFact_*`
live. Migration copies, it does not move.

## Mastery

Levels 0–4. Promotion to 3 (proficient) needs **all** of:

- `m >= 0.8` — an EWMA over scored responses, α = 0.25
- `sn >= 8` scored responses
- attempts on **two distinct calendar days**
- for nodes with `automaticity`, median latency at or under `targetMs`

The two-day rule is what stops a node being "mastered" in ninety seconds;
retention across a sleep is the thing worth claiming. The latency rule exists
because a learner who is accurate but slow has not finished — slow retrieval eats
the working memory that later multi-step work needs, and that is precisely the
hidden gap a far-ahead learner tends to have.

Responses under 400 ms are counted in `n` but excluded from `m` and from the
latency window: they were not read. `sn` tracks the scored subset, and promotion
is measured against `sn`, so mashing cannot promote anything.

Review is **Leitner**, boxes 0–5, intervals `[0,1,3,7,16,35]` days. Wrong drops
two boxes, because a miss on a well-spaced item means the spacing was wrong
rather than slightly wrong. Not SM-2: the scheduling unit is a *node* whose items
are regenerated every time, so per-item ease factors have nothing to attach to,
and a box number is something a parent can be told.

## Storage

Two blobs per learner, not one key per node.

```
nq.profile.v1        {v, active, learners:{id:{...}}}
nq.progress.v1.<id>  {v, updatedAt, nodes:{...}, sessions:[...], badges:{...}}
```

Writes are debounced (500 ms, plus `visibilitychange` and `beforeunload`).
`storage.js` falls back to memory when localStorage is full or unavailable, so a
write inside an answer handler can never lose the answer; `stPersistent()` reports
whether that happened.

## Adding a proficiency

1. Add it to `curriculum/PROFICIENCIES.md` first — that document is the source of
   authority and the validator checks the data against it.
2. Add the node to `curriculum/nodes-math.js` or `nodes-english.js`. **Do not add
   a `rung` field**: position is array order, so the two cannot drift.
3. Write the generator in `gen/gen-<pack>.js`.
4. `node tools/smoke-generators.js` — this also regenerates `gen/manifest.js`,
   which must be committed.
5. `node tools/validate-curriculum.js`.

Tier-1 nodes may not depend on tier-2 or tier-3 nodes; the validator enforces it,
because otherwise the suggested-next chain points at something marked *not built
yet*.

## Adding a response type

Add it to `ITEM_TYPES` in `item-types.js` with `render` / `collect` / optional
`autoSubmit`, `focus`, `clear`, `reveal`, add its grader to `GRADERS`, and add the
name to `VALID_TYPES` in `tools/validate-curriculum.js`.

Representation is an orthogonal axis, not a node. A concrete/pictorial/abstract
variant of the same proficiency is a `params` flag on the generator — treating it
as a separate node is the most common way lists like this bloat.

## Tools

| Command | What it does |
|---|---|
| `node tools/validate-curriculum.js` | Graph integrity, tier-1 closure, doc/data agreement, no `provenance` in UI code |
| `node tools/smoke-generators.js` | Draws 7000+ items, grades each against its own grader, regenerates `gen/manifest.js` |
| `NODE_PATH=/opt/node22/lib/node_modules node tools/smoke-browser.js` | Full in-browser run; needs `python3 -m http.server 8765` first |

None of them is a build gate. This repo has no build step and is not getting one.

## Deliberate gaps

Stated plainly rather than papered over:

- **Writing and Speaking & Listening have no nodes.** Not machine-scorable.
- **No oral reading fluency.** Real ORF is words-correct-per-minute against a
  passage and needs audio capture. `flu.*` is timed *word* recognition, which is
  the honest auto-gradable substitute.
- **Vocabulary is machinery, not a list.** Texts hold 88,500+ word families
  against roughly 3,000 acquired a year; wide reading is the part the app cannot
  replace, and it should say so.
- **`uknc` provenance is unfilled.** The UK National Curriculum (OGL v3, freely
  reusable) is the intended copyable skeleton, especially English Appendix 1 for
  the phonics and spelling sequence. Do not invent the references.
- **59 nodes are tier 2/3** and appear in the ladders marked *not built yet*.
