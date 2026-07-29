/*
 * Math proficiency nodes.
 *
 * See curriculum/PROFICIENCIES.md — that document is the source of authority,
 * this file is the same list as data. Change the document first.
 *
 * Ladder position (`rung`) is IMPLICIT IN ARRAY ORDER. Reordering a strand's
 * array reorders its ladder, so the two can never drift apart. Do not add a
 * `rung` field by hand.
 *
 * `prereq` holds only the incoming edges. The reverse index (what a node gates)
 * is computed by CUR.registerNodes, so it cannot fall out of sync either.
 *
 * `provenance` is for authoring and validation only. NO UI CODE MAY READ IT —
 * it is where grade level lives, and grade level must never reach the screen.
 * `uknc` references are deliberately absent pending a pass over the UK National
 * Curriculum; do not invent them.
 *
 * Defaults applied by norm(): tier 1, no prereqs, no automaticity target,
 * no misconceptions, types ['numeric'], no practice link, no params.
 */
(function () {
    'use strict';

    const STRANDS = [

    // ---------------------------------------------------------------
    { strand: 'count', pack: 'math-count', label: 'Counting & subitising', nodes: [

        { id: 'count.subitize.small', label: 'Instantly see how many, 1–4',
          automaticity: { targetMs: 2000 }, types: ['numeric', 'mc'],
          misconceptions: ['counts one by one instead of recognising the group'],
          provenance: { ccss: ['K.CC.B.4'] }, params: { max: 4 } },

        { id: 'count.sequence', label: 'Count on from any number',
          types: ['numeric', 'cloze'],
          misconceptions: ['can only start the count at one'],
          provenance: { ccss: ['K.CC.A.1', 'K.CC.A.2', '1.NBT.A.1'] }, params: { max: 120 } },

        { id: 'count.oneToOne', label: 'Count a set accurately, one tag per object',
          prereq: ['count.sequence'], types: ['numeric'],
          misconceptions: ['double-counts or skips objects in a scattered layout'],
          provenance: { ccss: ['K.CC.B.4', 'K.CC.B.5'] }, params: { max: 20 } },

        { id: 'count.cardinality', label: 'The last number said is how many there are',
          prereq: ['count.oneToOne'], types: ['numeric', 'mc'],
          misconceptions: ['recounts the set when asked "how many?"',
                           'thinks the total changes when objects are rearranged'],
          provenance: { ccss: ['K.CC.B.4'] }, params: { max: 20 } },

        { id: 'count.subitize.grouped', label: 'See 7 as 5 and 2 without counting',
          prereq: ['count.subitize.small', 'count.cardinality'],
          automaticity: { targetMs: 3000 }, types: ['numeric', 'mc'],
          practice: ['ten-frame'],
          provenance: { ccss: ['K.CC.B.4', 'K.OA.A.3'] }, params: { max: 10 } },

        { id: 'count.compare.sets', label: 'More, fewer, or the same',
          prereq: ['count.cardinality'], types: ['mc'],
          misconceptions: ['judges by how much space the objects take up'],
          provenance: { ccss: ['K.CC.C.6', 'K.CC.C.7'] }, params: { max: 10 } },

        { id: 'count.numeral', label: 'Read and write numerals to 20',
          prereq: ['count.cardinality'], types: ['numeric', 'mc'],
          misconceptions: ['reverses digits in the teens — writes 41 for 14'],
          provenance: { ccss: ['K.CC.A.3'] }, params: { max: 20 } },

        { id: 'count.skip', label: 'Skip count by 2s, 5s and 10s',
          prereq: ['count.sequence', 'count.numeral'],
          automaticity: { targetMs: 3000 }, types: ['numeric', 'cloze'],
          provenance: { ccss: ['2.NBT.A.2'] }, params: { steps: [2, 5, 10], max: 120 } },

        { id: 'count.ordinal', label: 'Ordinal position', tier: 3,
          prereq: ['count.sequence'], types: ['mc'],
          provenance: { ccss: [] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'pv', pack: 'math-pv', label: 'Place value', nodes: [

        { id: 'pv.teen', label: 'Teens as ten and some ones',
          prereq: ['count.numeral', 'count.cardinality'],
          types: ['numeric', 'mc', 'build'], practice: ['ten-frame', 'visualizer'],
          misconceptions: ['reads 14 as "four-teen" and writes 41'],
          provenance: { ccss: ['K.NBT.A.1', '1.NBT.B.2'] } },

        { id: 'pv.twoDigit', label: 'Two-digit numbers as tens and ones',
          prereq: ['pv.teen'], types: ['numeric', 'build'], practice: ['visualizer'],
          misconceptions: ['treats each digit as a separate whole number'],
          provenance: { ccss: ['1.NBT.B.2'] } },

        { id: 'pv.compare.twoDigit', label: 'Compare two-digit numbers',
          prereq: ['pv.twoDigit'], types: ['mc'],
          misconceptions: ['compares ones before tens'],
          provenance: { ccss: ['1.NBT.B.3'] } },

        { id: 'pv.threeDigit', label: 'Hundreds, tens and ones',
          prereq: ['pv.twoDigit'], types: ['numeric', 'build'], practice: ['visualizer'],
          provenance: { ccss: ['2.NBT.A.1'] } },

        { id: 'pv.expanded', label: 'Expanded form',
          prereq: ['pv.threeDigit'], types: ['numeric', 'mc', 'cloze'], practice: ['visualizer'],
          provenance: { ccss: ['2.NBT.A.3', '4.NBT.A.2'] } },

        { id: 'pv.numberline.whole', label: 'Place a whole number on a number line',
          prereq: ['pv.twoDigit', 'meas.iterateUnits'], types: ['numberline', 'mc'],
          misconceptions: ['counts tick marks rather than intervals',
                           'spaces numbers evenly regardless of value'],
          provenance: { ccss: ['2.MD.B.6'] } },

        { id: 'pv.compare.multiDigit', label: 'Compare multi-digit numbers',
          prereq: ['pv.threeDigit', 'pv.compare.twoDigit'], types: ['mc'],
          misconceptions: ['assumes more digits always means larger, then over-applies it to decimals'],
          provenance: { ccss: ['2.NBT.A.4', '4.NBT.A.2'] } },

        { id: 'pv.round', label: 'Round to any place',
          prereq: ['pv.compare.multiDigit', 'pv.numberline.whole'], types: ['numeric', 'mc'],
          misconceptions: ['rounds digit by digit, cascading right to left'],
          provenance: { ccss: ['3.NBT.A.1', '4.NBT.A.3'] } },

        { id: 'pv.tenTimes', label: 'Each place is ten times the one to its right',
          prereq: ['pv.threeDigit', 'pv.expanded'], types: ['numeric', 'mc'],
          provenance: { ccss: ['4.NBT.A.1', '5.NBT.A.1'] } },

        { id: 'pv.powersOfTen', label: 'Multiply and divide by powers of ten',
          prereq: ['pv.tenTimes', 'mult.byTens'], types: ['numeric'],
          misconceptions: ['"just add a zero" — breaks the moment decimals appear'],
          provenance: { ccss: ['5.NBT.A.2'] } },

        { id: 'pv.numberNames', label: 'Read and write number names', tier: 2,
          prereq: ['pv.threeDigit'], types: ['text', 'mc'], practice: ['visualizer'],
          provenance: { ccss: ['2.NBT.A.3', '4.NBT.A.2'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'add', pack: 'math-add', label: 'Additive reasoning', nodes: [

        { id: 'add.joinSeparate', label: 'Adding joins, subtracting separates',
          prereq: ['count.cardinality'], types: ['numeric', 'mc'],
          provenance: { ccss: ['K.OA.A.1', 'K.OA.A.2'] }, params: { max: 10 } },

        { id: 'add.decompose10', label: 'Break numbers up to ten into pairs',
          prereq: ['add.joinSeparate', 'count.subitize.grouped'],
          types: ['numeric', 'multi'], practice: ['ten-frame', 'make-ten'],
          provenance: { ccss: ['K.OA.A.3'] }, params: { max: 10 } },

        { id: 'add.makeTen', label: 'Pairs that make ten',
          prereq: ['add.decompose10'], automaticity: { targetMs: 2000 },
          types: ['numeric'], practice: ['make-ten', 'ten-frame'],
          provenance: { ccss: ['K.OA.A.4'] } },

        { id: 'add.facts.within10', label: 'Add and subtract within ten',
          prereq: ['add.decompose10'], automaticity: { targetMs: 2500 },
          types: ['numeric'], practice: ['flashcards'],
          provenance: { ccss: ['K.OA.A.5', '1.OA.C.6'] }, params: { max: 10 } },

        { id: 'add.facts.within20', label: 'All single-digit sums and their subtractions',
          prereq: ['add.facts.within10', 'add.makeTen'], automaticity: { targetMs: 3000 },
          types: ['numeric'], practice: ['flashcards'],
          misconceptions: ['still counts on fingers past ten'],
          provenance: { ccss: ['1.OA.C.6', '2.OA.B.2'] }, params: { max: 20 } },

        { id: 'add.equalSign', label: "What the equals sign means",
          prereq: ['add.joinSeparate'], types: ['mc', 'numeric'],
          misconceptions: ['reads = as "the answer comes next", so 8 + 4 = _ + 5 gets 12'],
          provenance: { ccss: ['1.OA.D.7'] } },

        { id: 'add.unknownPosition', label: 'Find the missing number anywhere in an equation',
          prereq: ['add.equalSign', 'add.facts.within20'], types: ['numeric'],
          provenance: { ccss: ['1.OA.D.8', '1.OA.A.1'] }, params: { max: 20 } },

        { id: 'add.unknownAddend', label: 'Subtraction as a missing addend', tier: 2,
          prereq: ['add.unknownPosition'], types: ['numeric', 'mc'],
          provenance: { ccss: ['1.OA.B.4'] }, params: { max: 20 } },

        { id: 'add.within100', label: 'Add and subtract within 100',
          prereq: ['add.facts.within20', 'pv.twoDigit'], types: ['numeric'],
          practice: ['flashcards', 'worksheets'],
          misconceptions: ['subtracts the smaller digit from the larger regardless of position'],
          provenance: { ccss: ['2.NBT.B.5'] }, params: { max: 100 } },

        { id: 'add.within1000', label: 'Add and subtract within 1000',
          prereq: ['add.within100', 'pv.threeDigit'], types: ['numeric'],
          practice: ['worksheets'],
          misconceptions: ['loses a borrow across a zero'],
          provenance: { ccss: ['3.NBT.A.2'] }, params: { max: 1000 } },

        { id: 'add.algorithm', label: 'Multi-digit addition and subtraction',
          prereq: ['add.within1000'], types: ['numeric'], practice: ['worksheets'],
          provenance: { ccss: ['4.NBT.B.4'] } },

        { id: 'add.mental.tensHundreds', label: 'Add or subtract 10 or 100 in your head', tier: 2,
          prereq: ['pv.threeDigit', 'add.within100'], automaticity: { targetMs: 3000 },
          types: ['numeric'],
          provenance: { ccss: ['1.NBT.C.5', '2.NBT.B.8'] } },

        { id: 'add.word.oneStep', label: 'One-step word problems', tier: 2,
          prereq: ['add.within100'], types: ['numeric'],
          provenance: { ccss: ['1.OA.A.1', '2.OA.A.1'] } },

        { id: 'add.word.twoStep', label: 'Two-step word problems', tier: 2,
          prereq: ['add.word.oneStep'], types: ['numeric'],
          provenance: { ccss: ['2.OA.A.1'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'mult', pack: 'math-mult', label: 'Multiplicative reasoning', nodes: [

        { id: 'mult.equalGroups', label: 'Multiplication as equal groups and arrays',
          prereq: ['add.facts.within20', 'count.skip'], types: ['numeric', 'mc'],
          practice: ['times-grid', 'visualizer'],
          provenance: { ccss: ['2.OA.C.4', '3.OA.A.1'] } },

        { id: 'mult.commutative', label: "Order doesn't change a product",
          prereq: ['mult.equalGroups'], types: ['mc', 'numeric'], practice: ['times-grid'],
          provenance: { ccss: ['3.OA.B.5'] } },

        { id: 'mult.facts', label: 'Single-digit multiplication facts',
          prereq: ['mult.equalGroups', 'mult.commutative'], automaticity: { targetMs: 3000 },
          types: ['numeric'], practice: ['times-grid', 'flashcards'],
          provenance: { ccss: ['3.OA.C.7'] }, params: { max: 10 } },

        { id: 'mult.divInverse', label: 'Division as a missing factor',
          prereq: ['mult.equalGroups'], types: ['numeric', 'mc'],
          provenance: { ccss: ['3.OA.A.2', '3.OA.B.6'] } },

        { id: 'mult.div.facts', label: 'Division facts within 100',
          prereq: ['mult.facts', 'mult.divInverse'], automaticity: { targetMs: 3000 },
          types: ['numeric'], practice: ['flashcards'],
          misconceptions: ['treats division as commutative'],
          provenance: { ccss: ['3.OA.C.7'] }, params: { max: 10 } },

        { id: 'mult.distributive', label: 'Break a factor apart to multiply',
          prereq: ['mult.facts', 'meas.area.multiply'], types: ['numeric', 'mc'],
          practice: ['visualizer'],
          provenance: { ccss: ['3.OA.B.5', '3.MD.C.7c'] } },

        { id: 'mult.byTens', label: 'Multiply by multiples of ten',
          prereq: ['mult.facts', 'pv.twoDigit'], types: ['numeric'],
          provenance: { ccss: ['3.NBT.A.3'] } },

        { id: 'mult.multiDigit.byOne', label: 'Multi-digit times one digit',
          prereq: ['mult.byTens', 'mult.distributive'], types: ['numeric'],
          practice: ['worksheets'],
          provenance: { ccss: ['4.NBT.B.5'] } },

        { id: 'mult.multiDigit.byTwo', label: 'Two digits times two digits',
          prereq: ['mult.multiDigit.byOne'], types: ['numeric'], practice: ['worksheets'],
          misconceptions: ['omits the placeholder zero in the second partial product'],
          provenance: { ccss: ['4.NBT.B.5', '5.NBT.B.5'] } },

        { id: 'mult.comparison', label: '"Times as many" versus "more than"',
          prereq: ['mult.equalGroups'], types: ['mc', 'numeric'],
          misconceptions: ['reads "5 times as many" as "5 more than"'],
          provenance: { ccss: ['4.OA.A.1', '4.OA.A.2'] } },

        { id: 'mult.div.longDivision', label: 'Long division',
          prereq: ['mult.div.facts', 'mult.multiDigit.byOne', 'add.algorithm'],
          types: ['numeric'], practice: ['worksheets'],
          provenance: { ccss: ['4.NBT.B.6', '5.NBT.B.6'] } },

        { id: 'mult.div.remainder', label: 'Make sense of a remainder',
          prereq: ['mult.div.facts'], types: ['numeric', 'mc'],
          misconceptions: ['reports the remainder without deciding what the question needs'],
          provenance: { ccss: ['4.OA.A.3', '4.NBT.B.6'] } },

        { id: 'mult.factorsMultiples', label: 'Factors and multiples',
          prereq: ['mult.div.facts'], types: ['multi', 'mc', 'numeric'],
          misconceptions: ['confuses factors with multiples'],
          provenance: { ccss: ['4.OA.B.4'] } },

        { id: 'mult.primeComposite', label: 'Prime and composite', tier: 2,
          prereq: ['mult.factorsMultiples'], types: ['mc', 'sort-bins'],
          misconceptions: ['calls 1 prime, or every odd number prime'],
          provenance: { ccss: ['4.OA.B.4'] } },

        { id: 'mult.word.multiStep', label: 'Multi-step word problems', tier: 2,
          prereq: ['mult.multiDigit.byOne', 'add.word.twoStep'], types: ['numeric'],
          provenance: { ccss: ['3.OA.D.8', '4.OA.A.3'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'frac', pack: 'math-frac', label: 'Fractions', nodes: [

        { id: 'frac.equalShares', label: 'Split a shape into equal shares',
          prereq: ['geom.partition.equalArea'], types: ['mc', 'tap-region'],
          practice: ['fractions'],
          misconceptions: ['accepts unequal parts as halves'],
          provenance: { ccss: ['1.G.A.3', '2.G.A.3'] } },

        { id: 'frac.unit', label: 'What one part of b equal parts means',
          prereq: ['frac.equalShares'], types: ['mc', 'numeric'], practice: ['fractions'],
          provenance: { ccss: ['3.NF.A.1'] }, params: { dens: [2, 3, 4, 6, 8] } },

        { id: 'frac.aOverB', label: 'a/b as a copies of 1/b',
          prereq: ['frac.unit'], types: ['numeric', 'mc'], practice: ['fractions'],
          provenance: { ccss: ['3.NF.A.1'] }, params: { dens: [2, 3, 4, 6, 8] } },

        { id: 'frac.sameWhole', label: 'Fractions only compare against the same whole',
          prereq: ['frac.unit'], types: ['mc'],
          misconceptions: ['compares ½ of a small shape with ⅓ of a large one and calls ⅓ bigger'],
          provenance: { ccss: ['3.NF.A.3d'] } },

        { id: 'frac.numberline.unit', label: 'Find 1/b on a number line',
          prereq: ['frac.unit', 'pv.numberline.whole'], types: ['numberline'],
          misconceptions: ['counts tick marks instead of intervals'],
          provenance: { ccss: ['3.NF.A.2a'] }, params: { dens: [2, 3, 4, 6, 8] } },

        { id: 'frac.numberline', label: 'Find a/b on a number line',
          prereq: ['frac.numberline.unit', 'frac.aOverB'], types: ['numberline'],
          misconceptions: ['treats the whole line as the whole, whatever it is labelled'],
          provenance: { ccss: ['3.NF.A.2b'] }, params: { dens: [2, 3, 4, 6, 8] } },

        { id: 'frac.equivalent.recognise', label: 'Spot equivalent fractions',
          prereq: ['frac.aOverB', 'frac.numberline'], types: ['mc', 'match'],
          practice: ['fractions'],
          provenance: { ccss: ['3.NF.A.3a', '3.NF.A.3b'] } },

        { id: 'frac.equivalent.generate', label: 'Make equivalent fractions',
          prereq: ['frac.equivalent.recognise', 'mult.facts'], types: ['numeric', 'fraction'],
          misconceptions: ['adds the same number to both parts instead of multiplying'],
          provenance: { ccss: ['4.NF.A.1'] } },

        { id: 'frac.wholeAsFraction', label: 'Whole numbers written as fractions',
          prereq: ['frac.aOverB'], types: ['numeric', 'mc'],
          provenance: { ccss: ['3.NF.A.3c'] } },

        { id: 'frac.compare.sameDen', label: 'Compare with the same denominator',
          prereq: ['frac.aOverB', 'frac.sameWhole'], types: ['mc'], practice: ['fractions'],
          provenance: { ccss: ['3.NF.A.3d'] } },

        { id: 'frac.compare.sameNum', label: 'Compare with the same numerator',
          prereq: ['frac.aOverB', 'frac.sameWhole'], types: ['mc'], practice: ['fractions'],
          misconceptions: ['bigger denominator read as bigger fraction'],
          provenance: { ccss: ['3.NF.A.3d'] } },

        { id: 'frac.compare.benchmark', label: 'Compare against a half and one',
          prereq: ['frac.compare.sameDen', 'frac.compare.sameNum'], types: ['mc', 'sort-bins'],
          provenance: { ccss: ['4.NF.A.2'] } },

        { id: 'frac.compare.unlike', label: 'Compare any two fractions',
          prereq: ['frac.equivalent.generate', 'frac.compare.benchmark'], types: ['mc'],
          misconceptions: ['gap thinking — judges by the difference between numerator and denominator'],
          provenance: { ccss: ['4.NF.A.2'] } },

        { id: 'frac.decompose', label: 'Break a fraction into a sum of unit fractions',
          prereq: ['frac.aOverB'], types: ['cloze', 'multi'],
          provenance: { ccss: ['4.NF.B.3b'] } },

        { id: 'frac.add.likeDen', label: 'Add and subtract with the same denominator',
          prereq: ['frac.decompose'], types: ['fraction'],
          misconceptions: ['adds the denominators too'],
          provenance: { ccss: ['4.NF.B.3a'] } },

        { id: 'frac.mixedImproper', label: 'Mixed numbers and improper fractions',
          prereq: ['frac.wholeAsFraction', 'frac.aOverB'], types: ['fraction', 'numeric'],
          provenance: { ccss: ['4.NF.B.3c'] } },

        { id: 'frac.add.mixed', label: 'Add and subtract mixed numbers',
          prereq: ['frac.add.likeDen', 'frac.mixedImproper'], types: ['fraction'],
          misconceptions: ['cannot regroup a whole into fifths in order to subtract'],
          provenance: { ccss: ['4.NF.B.3c'] } },

        { id: 'frac.add.unlikeDen', label: 'Add and subtract with different denominators',
          prereq: ['frac.add.likeDen', 'frac.equivalent.generate'], types: ['fraction'],
          provenance: { ccss: ['5.NF.A.1', '5.NF.A.2'] } },

        { id: 'frac.mult.byWhole', label: 'Multiply a fraction by a whole number',
          prereq: ['frac.decompose', 'mult.equalGroups'], types: ['fraction'],
          provenance: { ccss: ['4.NF.B.4'] } },

        { id: 'frac.mult.byFraction', label: 'Multiply a fraction by a fraction',
          prereq: ['frac.mult.byWhole'], types: ['fraction'],
          provenance: { ccss: ['5.NF.B.4'] } },

        { id: 'frac.scaling', label: 'Multiplying can make a number smaller',
          prereq: ['frac.mult.byFraction'], types: ['mc'],
          misconceptions: ['"multiplication always makes bigger, division always makes smaller"'],
          provenance: { ccss: ['5.NF.B.5'] } },

        { id: 'frac.asDivision', label: 'A fraction is a division',
          prereq: ['frac.unit', 'mult.divInverse'], types: ['numeric', 'mc', 'fraction'],
          misconceptions: ['never connects 3/4 to 3 ÷ 4'],
          provenance: { ccss: ['5.NF.B.3'] } },

        { id: 'frac.div.unitByWhole', label: 'Divide a unit fraction by a whole number',
          prereq: ['frac.asDivision', 'frac.mult.byFraction'], types: ['fraction'],
          provenance: { ccss: ['5.NF.B.7a'] } },

        { id: 'frac.div.wholeByUnit', label: 'Divide a whole number by a unit fraction',
          prereq: ['frac.div.unitByWhole'], types: ['numeric'],
          misconceptions: ['expects the answer to be smaller than the whole number'],
          provenance: { ccss: ['5.NF.B.7b'] } },

        { id: 'frac.estimate', label: 'Estimate to check an answer is sensible', tier: 2,
          prereq: ['frac.compare.benchmark'], types: ['mc'],
          provenance: { ccss: ['5.NF.A.2'] } },

        { id: 'frac.simplify', label: 'Simplest form', tier: 2,
          prereq: ['frac.equivalent.generate', 'mult.factorsMultiples'], types: ['numeric'],
          practice: ['fractions'],
          provenance: { ccss: ['4.NF.A.1'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'dec', pack: 'math-dec', label: 'Decimals', nodes: [

        { id: 'dec.tenthsHundredths', label: 'Tenths and hundredths',
          prereq: ['pv.tenTimes', 'frac.unit'], types: ['numeric', 'mc'],
          provenance: { ccss: ['4.NF.C.6'] } },

        { id: 'dec.fractionLink', label: 'Decimals and fractions are the same thing',
          prereq: ['dec.tenthsHundredths', 'frac.equivalent.generate'], types: ['numeric', 'match'],
          provenance: { ccss: ['4.NF.C.5', '4.NF.C.6'] } },

        { id: 'dec.numberline', label: 'Place a decimal on a number line',
          prereq: ['dec.tenthsHundredths', 'frac.numberline'], types: ['numberline'],
          provenance: { ccss: ['4.NF.C.6'] } },

        { id: 'dec.compare', label: 'Compare decimals',
          prereq: ['dec.numberline', 'pv.compare.multiDigit'], types: ['mc'],
          misconceptions: ['"longer is larger" — 0.45 judged greater than 0.7',
                           '"shorter is larger" from over-correcting that rule'],
          provenance: { ccss: ['4.NF.C.7', '5.NBT.A.3b'] } },

        { id: 'dec.thousandths', label: 'Read and write to thousandths',
          prereq: ['dec.tenthsHundredths', 'pv.tenTimes'], types: ['numeric', 'text'],
          provenance: { ccss: ['5.NBT.A.3a'] } },

        { id: 'dec.round', label: 'Round a decimal',
          prereq: ['dec.compare', 'pv.round'], types: ['numeric'],
          provenance: { ccss: ['5.NBT.A.4'] } },

        { id: 'dec.addSub', label: 'Add and subtract decimals',
          prereq: ['dec.thousandths', 'add.algorithm'], types: ['numeric'],
          misconceptions: ['right-aligns the digits instead of aligning the decimal points'],
          provenance: { ccss: ['5.NBT.B.7'] } },

        { id: 'dec.mult', label: 'Multiply decimals',
          prereq: ['dec.addSub', 'mult.multiDigit.byTwo', 'pv.powersOfTen'], types: ['numeric'],
          provenance: { ccss: ['5.NBT.B.7'] } },

        { id: 'dec.div', label: 'Divide decimals',
          prereq: ['dec.mult', 'mult.div.longDivision'], types: ['numeric'],
          provenance: { ccss: ['5.NBT.B.7'] } },

        { id: 'dec.expanded', label: 'Expanded form with decimals', tier: 2,
          prereq: ['dec.thousandths', 'pv.expanded'], types: ['cloze', 'numeric'],
          provenance: { ccss: ['5.NBT.A.3a'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'meas', pack: 'math-meas', label: 'Measurement & data', nodes: [

        { id: 'meas.compareDirect', label: 'Compare two things directly', tier: 2,
          types: ['mc'],
          provenance: { ccss: ['K.MD.A.1', 'K.MD.A.2', '1.MD.A.1'] } },

        { id: 'meas.iterateUnits', label: 'Length as repeated copies of a unit',
          prereq: ['count.oneToOne'], types: ['numeric', 'mc'],
          misconceptions: ['starts measuring from 1 rather than 0',
                           'counts marks rather than the gaps between them'],
          provenance: { ccss: ['1.MD.A.2', '2.MD.A.1'] } },

        { id: 'meas.ruler', label: 'Measure with a ruler', tier: 2,
          prereq: ['meas.iterateUnits'], types: ['numeric'],
          provenance: { ccss: ['2.MD.A.1', '3.MD.B.4'] } },

        { id: 'meas.time.hourHalf', label: 'Time to the hour and half hour', tier: 2,
          prereq: ['count.numeral'], types: ['mc', 'numeric'],
          provenance: { ccss: ['1.MD.B.3'] } },

        { id: 'meas.time.fiveMin', label: 'Time to five minutes', tier: 2,
          prereq: ['meas.time.hourHalf', 'count.skip'], types: ['numeric', 'mc'],
          provenance: { ccss: ['2.MD.C.7'] } },

        { id: 'meas.time.elapsed', label: 'Time to the minute, and elapsed time', tier: 2,
          prereq: ['meas.time.fiveMin', 'add.within100'], types: ['numeric', 'mc'],
          provenance: { ccss: ['3.MD.A.1'] } },

        { id: 'meas.money.count', label: 'Count coins and notes', tier: 2,
          prereq: ['count.skip', 'add.within100'], types: ['numeric', 'build'],
          practice: ['money'],
          provenance: { ccss: ['2.MD.C.8'] } },

        { id: 'meas.convert', label: 'Convert between units', tier: 2,
          prereq: ['mult.byTens', 'pv.powersOfTen'], types: ['numeric'],
          provenance: { ccss: ['4.MD.A.1', '5.MD.A.1'] } },

        { id: 'meas.area.count', label: 'Area by counting squares',
          prereq: ['count.oneToOne', 'geom.partition.equalArea'], types: ['numeric'],
          provenance: { ccss: ['3.MD.C.5', '3.MD.C.6'] } },

        { id: 'meas.area.multiply', label: 'Area as multiplication',
          prereq: ['meas.area.count', 'mult.equalGroups'], types: ['numeric', 'mc'],
          practice: ['visualizer'],
          misconceptions: ['confuses area with perimeter'],
          provenance: { ccss: ['3.MD.C.7', '4.MD.A.3'] } },

        { id: 'meas.perimeter', label: 'Perimeter, and how it differs from area', tier: 2,
          prereq: ['meas.area.multiply', 'add.within100'], types: ['numeric', 'mc'],
          misconceptions: ['assumes equal perimeter forces equal area'],
          provenance: { ccss: ['3.MD.D.8'] } },

        { id: 'meas.volume', label: 'Volume of a box', tier: 2,
          prereq: ['meas.area.multiply'], types: ['numeric'],
          provenance: { ccss: ['5.MD.C.3', '5.MD.C.4', '5.MD.C.5'] } },

        { id: 'meas.data.graphs', label: 'Read picture and bar graphs', tier: 2,
          prereq: ['count.compare.sets', 'add.within100'], types: ['numeric', 'mc'],
          misconceptions: ['ignores the scale on a scaled picture graph'],
          provenance: { ccss: ['2.MD.D.10', '3.MD.B.3'] } },

        { id: 'meas.data.lineplot', label: 'Line plots', tier: 2,
          prereq: ['meas.data.graphs', 'frac.numberline'], types: ['numeric', 'mc'],
          provenance: { ccss: ['2.MD.D.9', '4.MD.B.4', '5.MD.B.2'] } },

        { id: 'meas.angle', label: 'Measure and add angles', tier: 2,
          prereq: ['meas.iterateUnits'], types: ['numeric', 'mc'],
          misconceptions: ['judges angle size by the length of the drawn rays'],
          provenance: { ccss: ['4.MD.C.5', '4.MD.C.6', '4.MD.C.7'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'geom', pack: 'math-geom', label: 'Geometry', nodes: [

        { id: 'geom.name2d', label: 'Name flat shapes in any orientation', tier: 2,
          types: ['mc'],
          misconceptions: ['a rotated square is called a diamond and not a square'],
          provenance: { ccss: ['K.G.A.2', '2.G.A.1'] } },

        { id: 'geom.name3d', label: 'Name solid shapes', tier: 2,
          prereq: ['geom.name2d'], types: ['mc'],
          provenance: { ccss: ['K.G.A.3', '2.G.A.1'] } },

        { id: 'geom.attributes', label: 'Which properties actually define a shape', tier: 2,
          prereq: ['geom.name2d'], types: ['mc', 'multi'],
          misconceptions: ['treats size or colour as defining'],
          provenance: { ccss: ['1.G.A.1', '3.G.A.1'] } },

        { id: 'geom.compose', label: 'Build shapes out of other shapes', tier: 2,
          prereq: ['geom.name2d'], types: ['mc', 'build'],
          provenance: { ccss: ['K.G.B.6', '1.G.A.2'] } },

        { id: 'geom.partition.equalArea', label: 'Split a shape into equal areas',
          prereq: ['count.oneToOne'], types: ['mc', 'tap-region'],
          misconceptions: ['assumes equal parts must be the same shape'],
          provenance: { ccss: ['2.G.A.3', '3.G.A.2'] } },

        { id: 'geom.linesAngles', label: 'Lines, rays, angles, parallel and perpendicular', tier: 2,
          prereq: ['geom.name2d'], types: ['mc'], practice: ['geo-proofs'],
          provenance: { ccss: ['4.G.A.1'] } },

        { id: 'geom.classifyQuad', label: 'Sort quadrilaterals by their properties', tier: 2,
          prereq: ['geom.attributes', 'geom.linesAngles'], types: ['sort-bins', 'mc'],
          practice: ['geo-proofs'],
          misconceptions: ['denies that a square is a rectangle'],
          provenance: { ccss: ['4.G.A.2', '5.G.B.3', '5.G.B.4'] } },

        { id: 'geom.symmetry', label: 'Lines of symmetry', tier: 3,
          prereq: ['geom.name2d'], types: ['numeric', 'mc'],
          provenance: { ccss: ['4.G.A.3'] } },

        { id: 'geom.coordinate', label: 'Points on a coordinate grid', tier: 2,
          prereq: ['pv.numberline.whole'], types: ['mc', 'numeric'],
          misconceptions: ['reads the ordered pair in the wrong order'],
          provenance: { ccss: ['5.G.A.1', '5.G.A.2'] } },
    ]},

    // ---------------------------------------------------------------
    { strand: 'alg', pack: 'math-alg', label: 'Patterns & pre-algebra', nodes: [

        { id: 'alg.pattern.extend', label: 'Continue a pattern', tier: 2,
          prereq: ['count.skip'], types: ['numeric', 'mc'],
          provenance: { ccss: ['4.OA.C.5'] } },

        { id: 'alg.rule.apply', label: 'Follow a rule to make a sequence', tier: 2,
          prereq: ['alg.pattern.extend'], types: ['numeric', 'cloze'],
          provenance: { ccss: ['4.OA.C.5', '5.OA.B.3'] } },

        { id: 'alg.orderOfOperations', label: 'Brackets and order of operations',
          prereq: ['mult.facts', 'add.facts.within20'], types: ['numeric'],
          misconceptions: ['works strictly left to right, ignoring precedence'],
          provenance: { ccss: ['5.OA.A.1'] } },

        { id: 'alg.expression.interpret', label: 'Read an expression without working it out', tier: 2,
          prereq: ['alg.orderOfOperations'], types: ['mc'],
          provenance: { ccss: ['5.OA.A.2'] } },
    ]},

    ];

    // Expand the compact literal form into full node records.
    function norm() {
        const out = [];
        STRANDS.forEach((s) => {
            s.nodes.forEach((n, i) => {
                out.push({
                    id:             n.id,
                    strand:         s.strand,
                    strandLabel:    s.label,
                    rung:           i + 1,          // implicit in array order
                    label:          n.label,
                    tier:           n.tier || 1,
                    prereq:         n.prereq || [],
                    automaticity:   n.automaticity || null,
                    misconceptions: n.misconceptions || [],
                    provenance:     n.provenance || {},
                    pack:           s.pack,
                    types:          n.types || ['numeric'],
                    practice:       n.practice || [],
                    params:         n.params || {},
                });
            });
        });
        return out;
    }

    const NODES = norm();

    if (typeof CUR !== 'undefined' && CUR.registerNodes) {
        CUR.registerNodes(NODES);
    } else if (typeof window !== 'undefined') {
        // curriculum.js not loaded yet — stash for it to drain on boot.
        (window.__CUR_PENDING = window.__CUR_PENDING || []).push.apply(window.__CUR_PENDING, NODES);
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = NODES;
})();
