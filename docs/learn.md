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

**An item's `sig` is a category, not its identity.** The runner de-duplicates a
run by signature, so a signature coarser than the item makes it discard perfectly
good questions as repeats — a node whose sig named only the pattern being tested
could produce two questions per session however large its word bank was. The
shared constructors in `item-gen-helpers.js` append the answer automatically, so
pass a `sig` that names the *kind* of item and let them finish it. If two items
differ in a way a learner would notice, that difference belongs in the sig.

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

## Reading aloud

The page has one microphone, so it has one recogniser. `speech.js` owns it and
hands it out as a **claim** — `spListen()` returns a token, `spRelease()` gives
it back, and a second claim takes it from the first and tells that holder so.
Anything that listens goes through it. Nothing constructs its own
`SpeechRecognition`; two instances fight over the input stream and the loser
fails in a way that reads as flakiness.

A node opts in with `'speech'` in its `types`. The runner then asks generators
for read-aloud items by passing `{mic:true}` through `CUR.generate`, and the
generator turns roughly half its draws into "read this word". A run without a
microphone draws exactly the items it always did — the coin is only tossed when
`params.mic` is set, so no existing seed changes meaning.

Read-aloud beats multiple choice on validity, not just on engagement. "Which
word says /ship/?" pays 25% for guessing and considerably more for eliminating
the three that plainly are not it, and neither route requires decoding anything.
"Read this word" has no such route.

### Three outcomes, not two

A recogniser mishearing a child who read correctly is a certainty. So the
`spoken` grader answers "do we know anything", not "did it match":

| What came back | What happens |
|---|---|
| The word, on any alternative | Correct, `src:'runner-mic'` |
| Silence or noise | **`evidence:false`** — nothing recorded at all. The runner draws a spare item so the run still asks as many real questions, and gives up on the microphone after three. |
| A clear transcript of a different word | Recorded wrong, showing what was heard |

Silence says something about the room and nothing about the reader. The accepted
cost is that a child who cannot decode the word and stays quiet produces no
negative signal; the alternative folds the recogniser's accuracy on a young
voice into the mastery model and marks children wrong for words they read
perfectly.

`verdict.evidence === false` is a general contract, not a speech special case —
any future type may decline to produce evidence.

### The accept list

`W.heard` in `content/words-phonics.js` maps a word to spellings a recogniser
plausibly returns for a *correct* reading: true homophones, plus numerals for
number words. Two rules, both enforced by `tools/smoke-generators.js`:

- **Only true homophones.** Never a word that merely sounds similar — accepting
  *sheep* for *ship* destroys the contrast the node measures.
- **Never another word in the same node's bank.** That would let a genuine
  misread grade correct while every other assertion still passed.

`spell.*`, `vocab.homophone`, `vocab.homograph` and `gram.apostrophe` are barred
from read-aloud outright, in `tools/validate-curriculum.js`. Telling *knot* from
*not* is what those nodes assess and a microphone cannot do it.

### What cannot be tested headlessly

Hearing. Headless Chromium defines `SpeechRecognition` and has no service behind
it, so `tools/smoke-browser.js` tests the *claim bookkeeping* and the whole
heard-nothing path — which is genuinely most of the design — and nothing about
recognition quality. That needs a real microphone and a real child, on Chrome
and on iOS Safari. The permission prompt fires only on an explicit tap; a dialog
nobody expected gets dismissed once and stays dismissed.

Speech recognition is a network service on most browsers, so the audio leaves
the device. The node screen says so.

## Adding a proficiency

1. Add it to `curriculum/PROFICIENCIES.md` first — that document is the source of
   authority and the validator checks the data against it.
2. Add the node to `curriculum/nodes-math.js` or `nodes-english.js`. **Do not add
   a `rung` field**: position is array order, so the two cannot drift.
3. Write the generator in `gen/gen-<pack>.js`.
4. `node tools/smoke-generators.js` — this also regenerates `gen/manifest.js`,
   which must be committed.
5. `node tools/validate-curriculum.js`.

Tier-1 nodes may not depend on tier-2 or tier-3 nodes, and the validator enforces
it: a load-bearing rung whose prerequisite is backlog leaves a hole in the
suggested-next chain.

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
| `node tools/smoke-generators.js` | Draws 10,000+ items, grades each against its own grader, checks passage integrity, reports item variety, regenerates `gen/manifest.js` |
| `NODE_PATH=/opt/node22/lib/node_modules node tools/smoke-browser.js` | Full in-browser run; needs `python3 -m http.server 8765` first |

None of them is a build gate. This repo has no build step and is not getting one.

## Read the items

The generator smoke test proves an item grades its own answer. It cannot tell you
the question is *wrong*. Every one of these came from printing items and reading
them, and all of them passed every assertion at the time:

- A multiple-choice item with three correct options — "which shape has four
  straight sides", offering rhombus, square and trapezium.
- Distractors borrowed from other entries, so one of them was also part of the
  word being asked about.
- Foils differing in spelling but not in sound, so "same vowel sound as *soon*"
  offered *drew*.
- A phonics item asking for the first sound of "ship" and expecting **s**.
- A blending item presenting "m … u … c … h", splitting the digraph in a node
  whose whole subject is that letters and sounds differ.
- A picture showing ten dots whatever the answer was.
- An explanation naming the wrong misreading on a node about precedence.

So: after touching a pack, print a sample and read it. Then, when you find
something, add the check — most of the guards in `smoke-generators.js` exist
because reading found the bug first. And verify the guard actually bites by
reintroducing the bug; one of mine passed against the broken version and proved
nothing until it was strengthened.

## Item variety

`smoke-generators.js` reports how many distinct items each generator can produce
and lists anything under 20. It is informational, not a failure: some spaces are
legitimately small — there are four numbers to subitise and five introductory
denominators — and the runner tolerates a short space by allowing repeats once it
is exhausted.

Treat anything well under a session's length as needing more content, and check
the signature first: a low count often means the sig is collapsing distinct items
rather than the bank being thin.

## Deliberate gaps

Stated plainly rather than papered over:

- **Writing and Speaking & Listening have no nodes.** Not machine-scorable.
- **No oral reading fluency at passage length.** Real ORF is
  words-correct-per-minute against a passage. Single words *are* now read aloud
  where a microphone exists (see below); a whole passage is not, because a long
  utterance gives the recogniser many more chances to drop a word and there is
  no way to tell a dropped word from a skipped one. `flu.*` remains timed word
  recognition.
- **Vocabulary is machinery, not a list.** Texts hold 88,500+ word families
  against roughly 3,000 acquired a year; wide reading is the part the app cannot
  replace, and it should say so.
- **`uknc` provenance is unfilled.** The UK National Curriculum (OGL v3, freely
  reusable) is the intended copyable skeleton, especially English Appendix 1 for
  the phonics and spelling sequence. Do not invent the references.
- **Tier is now about priority, not availability.** All 201 nodes generate items,
  so nothing shows as *not built yet* today. Tier still governs what a new
  proficiency must clear to be treated as load-bearing, and the tier-1 closure
  rule still applies — but the ladder's greyed-out state is currently unused.
  `CUR.isBuilt()` and the manifest remain the mechanism, so adding a node without
  a generator degrades gracefully rather than erroring.
