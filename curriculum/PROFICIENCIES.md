# Curated proficiencies

The list of things this app drills and assesses. **This document is the source of
authority**; `nodes-math.js` and `nodes-english.js` are the same list as data.
Change this first, then the data.

## What this is not

It is not a standards document and does not aim at coverage. Standards frameworks
were read as *inputs* and then aggregated, de-duplicated, filtered, and weighted
by evidence. Framework codes survive only as `provenance`, for authoring and
validation. **No UI code may read `provenance`.**

## No grade levels

The target learner is routinely far ahead in one subject and not another.
Concepts are sequenced into per-strand **ladders** — a `strand` plus a `rung` —
and never bucketed by grade. Two consequences:

- Frameworks disagree far more about *when* a topic is taught than *whether*.
  Being grade-free means placement disagreement costs us nothing, so
  "does every framework contain this?" is a usable filter while
  "which grade is it?" is discarded.
- Every rung is open from a cold start. Nothing is gated, nothing is locked.
  The app tracks mastery and *suggests*; it never blocks.

## The filter

A node must pass **1 and 2**, plus **at least two of 3–6**:

1. **Gate test, or capstone test.** Either failure blocks ≥2 downstream
   proficiencies, *or* the node is a terminal objective — an endpoint the strand
   exists in order to reach.

   The capstone half of this is not a loophole, and the distinction matters when
   reading `validate-curriculum.js` output. Out-degree ≥ 2 is the right bar
   against the **full framework graph** of several hundred standards. Measured
   against this already-curated 201-node list it under-counts badly, because
   pruning removes precisely the downstream nodes that would have supplied the
   edges. `frac.div.wholeByUnit` gates nothing further in elementary math and is
   still the endpoint the entire fractions ladder climbs toward; `dec.div` and
   `mult.comparison` are the same. The validator reports low-out-degree tier-1
   nodes as *review*, never as an error — around half of tier 1 is expected to
   appear there, and each of those earns its place on criteria 4 and 6 instead.
2. **Drillable.** State establishable in ≤60s with machine-scorable items, and
   practice plausibly moves it.
3. **Cross-framework consensus** — appears in ≥3 of {CCSS major clusters, NCTM
   Focal Points, TEKS, Singapore MOE, UK National Curriculum}.
4. **Predictive evidence** in the research literature.
5. **Automaticity-bearing** — has a speed dimension, not just correctness.
6. **Diagnostic yield** — a nameable misconception attaches. If we can't say what
   wrong answer a learner will give, the node is too vague to assess.

### Exclusions

- **No pedagogy artifacts as nodes.** Bar models, CPA, manipulatives, ten-frames
  are *representations* — a `params` axis on generators, not nodes. This is the
  most common way lists like this bloat.
- **No process/practice standards** (CCSS Mathematical Practices, TEKS 1A–1G).
  Cross-cutting, not orderable, not drillable.
- **Collapse the fact fan-out.** "Multiply within 100" is one node with
  parameterised difficulty and a latency threshold, not 100 fact-family nodes.
- **Accuracy and fluency are one node with two thresholds**, not two nodes.
- **Writing and Speaking & Listening get zero nodes.** They are not auto-gradable
  and the app should say so rather than fake coverage.

## Tiers

| Tier | Meaning |
|---|---|
| **1** | Load-bearing. Build for v1. |
| **2** | Real and worth having. Backlog — appears in the ladder marked *not built yet*. |
| **3** | Nice to have. Backlog. |

When a node is arguable, admit it at tier 2 and move on. Only tier 1 blocks progress.

## Why the weighting is deliberately lopsided

Standards documents weight topics roughly evenly. The evidence does not support that.

- **Fractions get ~23% of the math list.** Siegler et al. (2012, *Psychological
  Science*), across two nationally representative longitudinal datasets, found
  elementary knowledge of **fractions and whole-number division uniquely predicted
  high-school algebra and overall math achievement 5–6 years later** — controlling
  for IQ, working memory, and family income, and more strongly than whole-number
  addition, subtraction, or multiplication. Corollary: **long division stays a
  first-class node** even though modern curricula soft-pedal it.
- **Number-line magnitude gets its own nodes at three levels** (whole, fraction,
  decimal). Schneider et al. (2018) meta-analysis puts number-line estimation
  against math competence at r ≈ .43–.54. Cheap to build, high diagnostic yield
  per second.
- **Automaticity nodes carry a latency threshold.** Retrieval automaticity frees
  working memory for multi-step work; by grades 3–5 working-memory capacity no
  longer predicts fact fluency, consistent with automatisation shifting the load.
  A learner who is accurate but slow is *not* done — this is the population with
  hidden fluency gaps under advanced conceptual knowledge, which is exactly our
  target audience.
- **Misconception-bearing nodes are kept even when they look small** —
  `add.equalSign`, `frac.sameWhole`, `frac.scaling`, `dec.compare`,
  `mult.comparison`. Each has a documented, nameable wrong answer, and each is
  routinely skipped by drill apps because it isn't a computation.

## Provenance status

`ccss` codes are recorded and reviewed. **`uknc` references are pending** — the UK
National Curriculum (OGL v3, freely reusable including commercially) is the
intended copyable skeleton, especially English Appendix 1 for phonics and
spelling, but its statements have not yet been read against this list. Do not
invent them; fill them in on a dedicated pass.

Licensing discipline: ordering and dependency are uncopyrightable facts; phrasing
and presentation are not. NCTM Focal Points, Texas TEKS, UFLI, Reading Universe,
IXL, and Singapore MOE are **read for judgment and re-expressed**, never pasted.

---

# Math — 113 nodes (79 at tier 1)

Fractions 26 · multiplicative 15 · measurement 15 · additive 14 · place value 11 ·
decimals 10 · counting 9 · geometry 9 · pre-algebra 4.

## `count` — counting & subitising

| # | id | label | tier |
|---|---|---|---|
| 1 | `count.subitize.small` | Instantly see how many, 1–4 | 1 |
| 2 | `count.sequence` | Count on from any number | 1 |
| 3 | `count.oneToOne` | Count a set accurately, one tag per object | 1 |
| 4 | `count.cardinality` | The last number said is how many there are | 1 |
| 5 | `count.subitize.grouped` | See 7 as 5 and 2 without counting | 1 |
| 6 | `count.compare.sets` | More, fewer, or the same | 1 |
| 7 | `count.numeral` | Read and write numerals to 20 | 1 |
| 8 | `count.skip` | Skip count by 2s, 5s and 10s | 1 · **auto** |
| 9 | `count.ordinal` | Ordinal position | 3 |

Cardinality is the gate: a child can recite to 100 and still not know that the
last word answers "how many". Grouped subitising is the seed of every later
decomposition strategy, which is why it sits above plain counting rather than beside it.

`count.skip` is tier 1 rather than the tier 2 it first looks like, because
`mult.equalGroups` depends on it and a tier-1 node may not depend on backlog —
otherwise the suggested-next chain points at something marked *not built yet*.
The validator enforces that closure.

## `pv` — place value

| # | id | label | tier |
|---|---|---|---|
| 1 | `pv.teen` | Teens as ten and some ones | 1 |
| 2 | `pv.twoDigit` | Two-digit numbers as tens and ones | 1 |
| 3 | `pv.compare.twoDigit` | Compare two-digit numbers | 1 |
| 4 | `pv.threeDigit` | Hundreds, tens and ones | 1 |
| 5 | `pv.expanded` | Expanded form | 1 |
| 6 | `pv.numberline.whole` | Place a whole number on a number line | 1 |
| 7 | `pv.compare.multiDigit` | Compare multi-digit numbers | 1 |
| 8 | `pv.round` | Round to any place | 1 |
| 9 | `pv.tenTimes` | Each place is ten times the one to its right | 1 |
| 10 | `pv.powersOfTen` | Multiply and divide by powers of ten | 1 |
| 11 | `pv.numberNames` | Read and write number names | 2 |

`pv.tenTimes` is the hinge of the whole strand — it is what makes decimals an
extension of place value rather than a new topic, and it is the prerequisite the
decimal strand hangs off.

## `add` — additive reasoning

| # | id | label | tier |
|---|---|---|---|
| 1 | `add.joinSeparate` | Adding joins, subtracting separates | 1 |
| 2 | `add.decompose10` | Break numbers up to ten into pairs | 1 |
| 3 | `add.makeTen` | Pairs that make ten | 1 · **auto** |
| 4 | `add.facts.within10` | Add and subtract within ten | 1 · **auto** |
| 5 | `add.facts.within20` | All single-digit sums and their subtractions | 1 · **auto** |
| 6 | `add.equalSign` | What the equals sign means | 1 |
| 7 | `add.unknownPosition` | Find the missing number anywhere in an equation | 1 |
| 8 | `add.unknownAddend` | Subtraction as a missing addend | 2 |
| 9 | `add.within100` | Add and subtract within 100 | 1 |
| 10 | `add.within1000` | Add and subtract within 1000 | 1 |
| 11 | `add.algorithm` | Multi-digit addition and subtraction | 1 |
| 12 | `add.mental.tensHundreds` | Add or subtract 10 or 100 in your head | 2 |
| 13 | `add.word.oneStep` | One-step word problems | 2 |
| 14 | `add.word.twoStep` | Two-step word problems | 2 |

`add.equalSign` earns tier 1 on diagnostic yield alone. Children taught `=` as
"the answer comes next" reliably answer `8 + 4 = ? + 5` with 12, and that
misreading blocks all later equation work. It is a one-minute check that most
drill apps never make.

## `mult` — multiplicative reasoning

| # | id | label | tier |
|---|---|---|---|
| 1 | `mult.equalGroups` | Multiplication as equal groups and arrays | 1 |
| 2 | `mult.commutative` | Order doesn't change a product | 1 |
| 3 | `mult.facts` | Single-digit multiplication facts | 1 · **auto** |
| 4 | `mult.divInverse` | Division as a missing factor | 1 |
| 5 | `mult.div.facts` | Division facts within 100 | 1 · **auto** |
| 6 | `mult.distributive` | Break a factor apart to multiply | 1 |
| 7 | `mult.byTens` | Multiply by multiples of ten | 1 |
| 8 | `mult.multiDigit.byOne` | Multi-digit times one digit | 1 |
| 9 | `mult.multiDigit.byTwo` | Two digits times two digits | 1 |
| 10 | `mult.comparison` | "Times as many" versus "more than" | 1 |
| 11 | `mult.div.longDivision` | Long division | 1 |
| 12 | `mult.div.remainder` | Make sense of a remainder | 1 |
| 13 | `mult.factorsMultiples` | Factors and multiples | 1 |
| 14 | `mult.primeComposite` | Prime and composite | 2 |
| 15 | `mult.word.multiStep` | Multi-step word problems | 2 |

`mult.comparison` is the additive/multiplicative confusion — "5 times as many"
read as "5 more than". `mult.div.longDivision` is retained on the Siegler finding
rather than on convention.

## `frac` — fractions

The largest strand, deliberately.

| # | id | label | tier |
|---|---|---|---|
| 1 | `frac.equalShares` | Split a shape into equal shares | 1 |
| 2 | `frac.unit` | What one part of b equal parts means | 1 |
| 3 | `frac.aOverB` | a/b as a copies of 1/b | 1 |
| 4 | `frac.sameWhole` | Fractions only compare against the same whole | 1 |
| 5 | `frac.numberline.unit` | Find 1/b on a number line | 1 |
| 6 | `frac.numberline` | Find a/b on a number line | 1 |
| 7 | `frac.equivalent.recognise` | Spot equivalent fractions | 1 |
| 8 | `frac.equivalent.generate` | Make equivalent fractions | 1 |
| 9 | `frac.wholeAsFraction` | Whole numbers written as fractions | 1 |
| 10 | `frac.compare.sameDen` | Compare with the same denominator | 1 |
| 11 | `frac.compare.sameNum` | Compare with the same numerator | 1 |
| 12 | `frac.compare.benchmark` | Compare against a half and one | 1 |
| 13 | `frac.compare.unlike` | Compare any two fractions | 1 |
| 14 | `frac.decompose` | Break a fraction into a sum of unit fractions | 1 |
| 15 | `frac.add.likeDen` | Add and subtract with the same denominator | 1 |
| 16 | `frac.mixedImproper` | Mixed numbers and improper fractions | 1 |
| 17 | `frac.add.mixed` | Add and subtract mixed numbers | 1 |
| 18 | `frac.add.unlikeDen` | Add and subtract with different denominators | 1 |
| 19 | `frac.mult.byWhole` | Multiply a fraction by a whole number | 1 |
| 20 | `frac.mult.byFraction` | Multiply a fraction by a fraction | 1 |
| 21 | `frac.scaling` | Multiplying can make a number smaller | 1 |
| 22 | `frac.asDivision` | A fraction is a division | 1 |
| 23 | `frac.div.unitByWhole` | Divide a unit fraction by a whole number | 1 |
| 24 | `frac.div.wholeByUnit` | Divide a whole number by a unit fraction | 1 |
| 25 | `frac.estimate` | Estimate to check an answer is sensible | 2 |
| 26 | `frac.simplify` | Simplest form | 2 |

Four of these are misconception nodes and none of them is a calculation:
`frac.sameWhole` (comparing ½ of a small pizza with ⅓ of a large one),
`frac.compare.sameNum` (bigger denominator read as bigger fraction),
`frac.scaling` (multiplication "always makes bigger"), and `frac.asDivision`
(never connecting `3/4` to `3 ÷ 4`). They are cheap to assess and they gate
everything above them.

## `dec` — decimals

| # | id | label | tier |
|---|---|---|---|
| 1 | `dec.tenthsHundredths` | Tenths and hundredths | 1 |
| 2 | `dec.fractionLink` | Decimals and fractions are the same thing | 1 |
| 3 | `dec.numberline` | Place a decimal on a number line | 1 |
| 4 | `dec.compare` | Compare decimals | 1 |
| 5 | `dec.thousandths` | Read and write to thousandths | 1 |
| 6 | `dec.round` | Round a decimal | 1 |
| 7 | `dec.addSub` | Add and subtract decimals | 1 |
| 8 | `dec.mult` | Multiply decimals | 1 |
| 9 | `dec.div` | Divide decimals | 1 |
| 10 | `dec.expanded` | Expanded form with decimals | 2 |

`dec.compare` carries the classic "longer is larger" error — 0.45 judged greater
than 0.7 because it has more digits. Worth a node on its own.

## `meas` — measurement & data

Mostly tier 2: broadly taught, genuinely useful, but low out-degree — very little
later work is blocked by not knowing them. The three exceptions are the ones that
feed number and multiplication.

| # | id | label | tier |
|---|---|---|---|
| 1 | `meas.compareDirect` | Compare two things directly | 2 |
| 2 | `meas.iterateUnits` | Length as repeated copies of a unit | 1 |
| 3 | `meas.ruler` | Measure with a ruler | 2 |
| 4 | `meas.time.hourHalf` | Time to the hour and half hour | 2 |
| 5 | `meas.time.fiveMin` | Time to five minutes | 2 |
| 6 | `meas.time.elapsed` | Time to the minute, and elapsed time | 2 |
| 7 | `meas.money.count` | Count coins and notes | 2 |
| 8 | `meas.convert` | Convert between units | 2 |
| 9 | `meas.area.count` | Area by counting squares | 1 |
| 10 | `meas.area.multiply` | Area as multiplication | 1 |
| 11 | `meas.perimeter` | Perimeter, and how it differs from area | 2 |
| 12 | `meas.volume` | Volume of a box | 2 |
| 13 | `meas.data.graphs` | Read picture and bar graphs | 2 |
| 14 | `meas.data.lineplot` | Line plots | 2 |
| 15 | `meas.angle` | Measure and add angles | 2 |

`meas.iterateUnits` is tier 1 because it is the same idea as the number line —
equal intervals, not marks — and that idea is what fraction placement depends on.
`meas.area.multiply` is tier 1 because the area model is how the distributive
property becomes visible.

## `geom` — geometry

| # | id | label | tier |
|---|---|---|---|
| 1 | `geom.name2d` | Name flat shapes in any orientation | 2 |
| 2 | `geom.name3d` | Name solid shapes | 2 |
| 3 | `geom.attributes` | Which properties actually define a shape | 2 |
| 4 | `geom.compose` | Build shapes out of other shapes | 2 |
| 5 | `geom.partition.equalArea` | Split a shape into equal areas | 1 |
| 6 | `geom.linesAngles` | Lines, rays, angles, parallel and perpendicular | 2 |
| 7 | `geom.classifyQuad` | Sort quadrilaterals by their properties | 2 |
| 8 | `geom.symmetry` | Lines of symmetry | 3 |
| 9 | `geom.coordinate` | Points on a coordinate grid | 2 |

Only the partition node is load-bearing, and only because it is where fractions
start.

## `alg` — patterns & pre-algebra

| # | id | label | tier |
|---|---|---|---|
| 1 | `alg.pattern.extend` | Continue a pattern | 2 |
| 2 | `alg.rule.apply` | Follow a rule to make a sequence | 2 |
| 3 | `alg.orderOfOperations` | Brackets and order of operations | 1 |
| 4 | `alg.expression.interpret` | Read an expression without working it out | 2 |

Commutativity, associativity and distributivity are **not** nodes here — they
live inside `add` and `mult`, attached to the operations they describe, rather
than floating as abstractions.

---

# English — 88 nodes (63 at tier 1)

Phonics & decoding 25 · morphology 13 · grammar 13 · vocabulary 11 · spelling 8 ·
phonological awareness 7 · comprehension 5 · sight recognition 4 · fluency 2.

## Structure: the Simple View of Reading

`RC = D × LC` — reading comprehension is decoding **times** language
comprehension. It is multiplicative, so a zero in either factor zeroes the
product and neither factor alone is sufficient.

Two consequences that are load-bearing for this app, not decoration:

- **Word recognition and language comprehension are separate ladders whose scores
  are never averaged.** A learner can sit at a high comprehension ceiling behind a
  low decoding bottleneck. Averaging those into one "reading level" hides exactly
  the thing worth finding, and for an audience that is routinely far ahead in one
  dimension it is the common case rather than the edge case.
- **Remediation routes by which factor is limiting**, which is only possible if
  the two are measured apart.

Word recognition: `pa` → `phon` → `omap` → `flu`.
Language comprehension: `morph` → `vocab` → `comp`.
Production, drawing on both: `spell`, `gram`.

## `pa` — phonological awareness (7 nodes, 4 at tier 1)

Deliberately small, and the smallness is the evidence-based choice. The National
Reading Panel meta-analysis (Ehri et al. 2001; 52 studies) found phonemic
awareness instruction produced **larger** effects when only one or two skills were
taught rather than many, when children **manipulated letters** (d = 0.59) rather
than sounds alone (d = 0.36), and when total instruction ran **under 20 hours**.

That is direct evidence against the 30-to-40-skill awareness ladders many programs
ship. So: seven nodes, four at tier 1, concentrated on **blending and segmenting
with letters**. Rhyme, onset-rime and phoneme manipulation are kept at tier 2 —
real, but not where the effect lives.

| # | id | label | tier |
|---|---|---|---|
| 1 | `pa.rhyme` | Hear when words rhyme | 2 |
| 2 | `pa.syllable` | Count and blend syllables | 1 |
| 3 | `pa.onsetRime` | Blend onset and rime | 2 |
| 4 | `pa.isolate` | Hear the first, last and middle sound | 1 |
| 5 | `pa.blend` | Blend sounds into a word | 1 |
| 6 | `pa.segment` | Break a word into its sounds | 1 |
| 7 | `pa.manipulate` | Add, take away or swap a sound | 2 |

Every node here is `audio: true` — the stem is meaningless as text. This is why
TTS is a Phase-1 requirement and not a later enhancement.

## `phon` — phonics & decoding (25 nodes, 18 at tier 1)

The largest English strand, and the one CCSS serves worst: Reading Foundational
Skills gives roughly five standards per grade for a domain that structured
programs decompose into 100+ ordered steps. A node here means **a set of
correspondences testable in one 20-item screen**, which compresses a 128-lesson
program sequence to 25 assessable rungs without losing an ordering distinction
that matters.

| # | id | label | tier |
|---|---|---|---|
| 1 | `phon.letterNames` | Name every letter, capital and small | 1 · **auto** |
| 2 | `phon.consonants` | The sound each consonant makes | 1 · **auto** |
| 3 | `phon.shortVowels` | The five short vowel sounds | 1 · **auto** |
| 4 | `phon.cvc` | Read short-vowel words like cat and hop | 1 |
| 5 | `phon.digraphs` | Two letters, one sound — sh, ch, th, ck | 1 |
| 6 | `phon.blends.initial` | Blends at the start — st, bl, tr | 1 |
| 7 | `phon.blends.final` | Blends at the end — nd, st, mp | 1 |
| 8 | `phon.ffllss` | Doubling f, l and s at the end | 2 |
| 9 | `phon.vce` | Silent e makes the vowel say its name | 1 |
| 10 | `phon.vowelTeams.long` | Vowel teams — ai, ee, oa, igh | 1 |
| 11 | `phon.vowelTeams.more` | More vowel teams — oo, ew, au, aw | 1 |
| 12 | `phon.vowelTeams.exceptions` | When a vowel team changes its sound | 2 |
| 13 | `phon.rControlled` | When r changes the vowel — ar, or, er, ir, ur | 1 |
| 14 | `phon.diphthongs` | Gliding vowels — oi, oy, ou, ow | 1 |
| 15 | `phon.softCG` | Soft c and soft g | 2 |
| 16 | `phon.tchDge` | tch and dge after a short vowel | 2 |
| 17 | `phon.silentLetters` | Silent letters — kn, wr, mb | 2 |
| 18 | `phon.yAsVowel` | When y acts as a vowel | 2 |
| 19 | `phon.inflections` | Reading -s, -ed and -ing endings | 1 |
| 20 | `phon.syllableTypes` | The six kinds of syllable | 1 |
| 21 | `phon.consonantLe` | The -le ending | 2 |
| 22 | `phon.syllableDivision` | Where to split a long word | 1 |
| 23 | `phon.twoSyllable` | Read two-syllable words | 1 |
| 24 | `phon.schwa` | The lazy vowel in unstressed syllables | 1 |
| 25 | `phon.multisyllable` | Read long unfamiliar words | 1 |

`phon.cvc` is the single most load-bearing English node (out-degree 7) — it is the
first point at which the alphabetic principle actually pays out.

**Ordering caveat, recorded honestly.** r-controlled vowels, diphthongs and
hard/soft c-g have **no explicit home in CCSS** — they fall under "additional
common vowel teams" and "inconsistent but common spelling-sound
correspondences" (RF.2.3b, RF.2.3e). Their placement here is convention, not
standard, and the affected nodes carry a `provenance.note` saying so. Relatedly:
there is **no canonical Orton-Gillingham sequence** — OG is an approach, and
published programs differ in the middle of the order. Where three sequences agree
the ordering is real; where they diverge it is arbitrary and we chose.

## `omap` — word recognition by sight (4 nodes, all tier 1)

Orthographic mapping, not visual memorisation. Sight-word reading is acquired by
bonding spellings to pronunciations — "gluing phonemes to graphemes" — so
irregular words get **heart-word treatment**: map the regular parts, flag the one
grapheme that misbehaves. There are no whole-word flashcards here, and
`omap.heartWords` carries "memorises the whole word as a picture" as its named
misconception precisely because that is the failure this strand exists to prevent.

| # | id | label | tier |
|---|---|---|---|
| 1 | `omap.hfWords.early` | The first everyday words | 1 · **auto** |
| 2 | `omap.heartWords` | Tricky words — which part is the odd one | 1 |
| 3 | `omap.hfWords.extended` | More everyday words | 1 · **auto** |
| 4 | `omap.autoRecognition` | Know a word the instant you see it | 1 · **auto** |

## `flu` — reading fluency (2 nodes)

| # | id | label | tier |
|---|---|---|---|
| 1 | `flu.wordList` | Read a list of words quickly and accurately | 1 · **auto** |
| 2 | `flu.phrase` | Read a phrase without stumbling | 2 · **auto** |

**Deliberately only two nodes, and prosody is absent.** Real oral reading fluency
means words-correct-per-minute against a passage, which requires audio capture and
scoring. We do not do that, so we do not claim it — reporting a WCPM figure
without audio scoring would be a straightforward lie about what was measured. The
honest auto-gradable substitute is **timed word and phrase recognition**, which
is what these two nodes are. Prosody and expression fail the drillable filter
outright and get no node at all.

## `morph` — word parts & meaning (13 nodes, 11 at tier 1)

**The highest-return strand in the English list**, and it is why morphology gets
more nodes than vocabulary despite vocabulary being the more obvious target.

Three findings converge on it. Bowers, Kirby & Deacon's meta-analysis of 22
morphological-instruction studies found gains in reading, spelling **and**
vocabulary together, with the **strongest effects for younger and weaker readers**
— the opposite of the usual pattern where interventions help the already-strong.
Chall & Jacobs' fourth-grade-slump work found the decline shows up **first in word
meaning**, before comprehension degrades, making this the leading indicator.
And morphology does double duty: breaking a long word into morphemes is also how
multisyllable decoding works, so these nodes serve both halves of the Simple View
at once.

| # | id | label | tier |
|---|---|---|---|
| 1 | `morph.compound` | Two words joined into one | 2 |
| 2 | `morph.inflect.plural` | Making things plural | 1 |
| 3 | `morph.inflect.tense` | Endings that change the time | 1 |
| 4 | `morph.baseWord` | Find the base word inside a longer one | 1 |
| 5 | `morph.prefix.common` | Prefixes that flip or repeat a meaning | 1 |
| 6 | `morph.suffix.common` | Suffixes that add a meaning | 1 |
| 7 | `morph.suffix.posShift` | Suffixes that change a word's job | 1 |
| 8 | `morph.roots.latin` | Latin roots — port, dict, spect | 1 |
| 9 | `morph.roots.greek` | Greek word parts — photo, graph, tele | 1 |
| 10 | `morph.wordFamily` | Build a family from one root | 1 |
| 11 | `morph.decomposeLong` | Break a long word into its parts to read it | 1 |
| 12 | `morph.inferMeaning` | Work out a new word from its parts | 1 |
| 13 | `morph.absorbedPrefix` | Prefixes that change shape — in-, im-, il-, ir- | 3 |

`morph.inferMeaning` is the payoff node the other twelve exist to reach.

## `vocab` — vocabulary (11 nodes, 6 at tier 1)

**Generative, not a word list — and this is a deliberate refusal.** School texts
between grades 3 and 9 contain 88,500+ distinct word meanings, and children
acquire roughly 3,000 a year, overwhelmingly incidentally from reading volume.
Direct instruction can realistically reach a few hundred. So building a
vocabulary *list* app would be building the wrong thing at a ratio of about
ten to one.

What is buildable is the **machinery**: inferring from context, inferring from
word parts (which is why `vocab.tier2Academic` depends on `morph.inferMeaning`),
and the general academic words that recur across every subject. The app should
say plainly somewhere that wide reading is the part it cannot substitute for.

| # | id | label | tier |
|---|---|---|---|
| 1 | `vocab.contextClues` | Work out a word from the sentence around it | 1 |
| 2 | `vocab.synonymAntonym` | Words that mean the same or the opposite | 1 |
| 3 | `vocab.multipleMeaning` | One word, more than one meaning | 1 |
| 4 | `vocab.shadesOfMeaning` | How close words differ in strength | 2 |
| 5 | `vocab.categories` | How words group together | 2 |
| 6 | `vocab.homophone` | Sound the same, spelled differently | 1 |
| 7 | `vocab.homograph` | Spelled the same, said differently | 2 |
| 8 | `vocab.tier2Academic` | Words that turn up across every subject | 1 |
| 9 | `vocab.figurative.literal` | When words do not mean what they say | 1 |
| 10 | `vocab.simileMetaphor` | Similes and metaphors | 2 |
| 11 | `vocab.idiom` | Idioms, adages and proverbs | 2 |

## `comp` — comprehension (5 nodes, 3 at tier 1)

Only the auto-gradable slice. Most reading-comprehension standards want an
explanation, and an explanation is not machine-scorable, so it gets no node.

| # | id | label | tier |
|---|---|---|---|
| 1 | `comp.anaphora` | Who does this word point back to? | 1 |
| 2 | `comp.inference.local` | Work out what is not said outright | 1 |
| 3 | `comp.mainIdea` | What the passage is mostly about | 1 |
| 4 | `comp.textStructure` | How a passage is put together | 2 |
| 5 | `comp.evidence` | Which sentence backs this up | 2 |

`comp.anaphora` is the underrated one: pronoun-referent resolution is a genuine
comprehension bottleneck, it is cleanly multiple-choice, and almost nothing tests
it directly.

## `spell` — spelling (8 nodes, 6 at tier 1)

Spelling mirrors the phonics ladder one step behind — you can read a pattern
before you can produce it — so `spell.*` nodes depend on their `phon.*`
counterparts rather than duplicating them.

| # | id | label | tier |
|---|---|---|---|
| 1 | `spell.phonetic` | Spell a word the way it sounds | 1 |
| 2 | `spell.cvcPatterns` | Spell short-vowel words | 1 |
| 3 | `spell.vceVowelTeams` | Spell long-vowel words | 1 |
| 4 | `spell.rControlled` | Spell words with ar, or, er, ir, ur | 1 |
| 5 | `spell.plurals` | Spell plurals, regular and odd | 2 |
| 6 | `spell.suffixRules` | Doubling, dropping e, and y to i | 1 |
| 7 | `spell.irregularHF` | Spell the tricky everyday words | 1 |
| 8 | `spell.positionRules` | Which spelling goes where — ck, tch, dge | 2 |

`spell.suffixRules` is one node covering four rules — doubling, drop-silent-e,
y-to-i, and plain addition. Those four generate a very large clean typed-answer
item bank from a modest word list, which makes it the best value in the strand.

## `gram` — grammar & mechanics (13 nodes, 10 at tier 1)

Highly auto-gradable, and the strand where the app already has the most built:
five existing language-arts modes attach here as practice.

| # | id | label | tier |
|---|---|---|---|
| 1 | `gram.sentence` | What makes a complete sentence | 1 |
| 2 | `gram.partsOfSpeech` | Nouns, verbs, adjectives, adverbs | 1 |
| 3 | `gram.endPunctuation` | Full stops, question marks, exclamation marks | 1 |
| 4 | `gram.capitalisation` | What gets a capital letter | 2 |
| 5 | `gram.subjectVerb` | Matching the subject and the verb | 1 |
| 6 | `gram.tense` | Past, present and future — and staying put | 1 |
| 7 | `gram.pronouns` | Pronouns and who they stand for | 1 |
| 8 | `gram.apostrophe` | Apostrophes for shortening and owning | 1 |
| 9 | `gram.conjunctions` | Joining words that build longer sentences | 1 |
| 10 | `gram.comma` | Where commas go | 1 |
| 11 | `gram.fragmentRunOn` | Spot a fragment or a run-on | 1 |
| 12 | `gram.sentenceTypes` | Statements, questions, commands, exclamations | 2 |
| 13 | `gram.quotation` | Punctuating what someone said | 2 |

## What English deliberately excludes

- **Writing composition** (CCSS W.1–W.10) — no nodes. Not machine-scorable. The
  auto-gradable *edge* of writing (pick the best topic sentence, the right linking
  word, the correctly punctuated dialogue) is already covered by `gram.*`.
- **Speaking & listening** (SL.1–SL.6) — no nodes. Needs a human.
- **Handwriting** — no nodes.
- **Oral reading fluency as WCPM** — see `flu` above.

The app should state these gaps rather than imply coverage it does not have.

---

# Totals

| | nodes | tier 1 |
|---|---|---|
| Math | 113 | 79 |
| English | 88 | 63 |
| **Total** | **201** | **142** |

Tier 1 landed at 142 against a ~120 aspiration. The overshoot is almost entirely
the decoding ladder, and it is defensible: a phonics sequence with holes in it is
not a usable phonics sequence, because a learner who reaches a missing rung has
nowhere to go. Eighteen tier-1 `phon` nodes is the floor for a coherent ladder,
not padding. The math half is the more compressible one if this needs to come
down further.

All counts in this document are verified by the validator; if they disagree with
its output, the validator is right.

Run `node tools/validate-curriculum.js` after any edit here. It enforces
uniqueness, edge resolution, acyclicity, rung-versus-prerequisite consistency,
tier-1 closure (a tier-1 node may not depend on backlog), and that no UI file
reads `provenance`.
