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
   against this already-curated 113-node list it under-counts badly, because
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

# Math — 113 nodes (80 at tier 1)

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
| 8 | `add.unknownAddend` | Subtraction as a missing addend | 1 |
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

# English

Not yet curated. Next pass. The intended shape, from the research:

- Split along the **Simple View of Reading** (`RC = D × LC`, multiplicative — a
  zero in either factor zeroes comprehension). Word recognition and language
  comprehension are **independent ladders whose scores are never averaged**. A
  learner can sit at a high comprehension ceiling behind a low decoding
  bottleneck, and that is the common case for this audience.
- **Word recognition:** phonological awareness (~7, capped — the National Reading
  Panel meta-analysis found *larger* effects from teaching fewer skills, with
  letters, in under 20 hours) · phonics & decoding (~32) · orthographic mapping
  and irregular words (~4) · fluency (~3).
- **Language comprehension:** morphology (~14 — highest ROI in the English list;
  improves reading, spelling *and* vocabulary, strongest effects for weaker
  readers, and doubles as multisyllable decoding) · vocabulary strategy (~10) ·
  comprehension drillables (~4).
- **Alongside:** spelling (~8) · grammar & mechanics (~8).
- Vocabulary is **generative, not a word list**. School texts hold 88,500+ word
  families and children acquire ~3,000 a year, mostly incidentally; direct
  instruction reaches a few hundred. Build morphology and inference strategy, and
  be honest in the product that volume reading is what we cannot substitute for.

UK National Curriculum English Appendix 1 (spelling, ordered, with statutory word
lists) and Appendix 2 (grammar) are the copyable skeleton for this half.
