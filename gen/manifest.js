/*
 * GENERATED FILE — do not edit by hand.
 *   node tools/smoke-generators.js
 *
 * Declares which nodes each pack can generate, so the ladder can show what
 * is built without fetching every pack. Written from the packs themselves,
 * so it cannot disagree with them.
 */
(function () {
    'use strict';
    const MANIFEST = {
        'math-add': [
            'add.algorithm',
            'add.decompose10',
            'add.equalSign',
            'add.facts.within10',
            'add.facts.within20',
            'add.joinSeparate',
            'add.makeTen',
            'add.unknownPosition',
            'add.within100',
            'add.within1000',
        ],
        'math-frac': [
            'frac.aOverB',
            'frac.add.likeDen',
            'frac.add.mixed',
            'frac.add.unlikeDen',
            'frac.asDivision',
            'frac.compare.benchmark',
            'frac.compare.sameDen',
            'frac.compare.sameNum',
            'frac.compare.unlike',
            'frac.decompose',
            'frac.div.unitByWhole',
            'frac.div.wholeByUnit',
            'frac.equalShares',
            'frac.equivalent.generate',
            'frac.equivalent.recognise',
            'frac.mixedImproper',
            'frac.mult.byFraction',
            'frac.mult.byWhole',
            'frac.numberline',
            'frac.numberline.unit',
            'frac.sameWhole',
            'frac.scaling',
            'frac.unit',
            'frac.wholeAsFraction',
        ],
        'math-mult': [
            'mult.byTens',
            'mult.commutative',
            'mult.comparison',
            'mult.distributive',
            'mult.div.facts',
            'mult.div.longDivision',
            'mult.div.remainder',
            'mult.divInverse',
            'mult.equalGroups',
            'mult.factorsMultiples',
            'mult.facts',
            'mult.multiDigit.byOne',
            'mult.multiDigit.byTwo',
        ],
    };

    if (typeof CUR !== 'undefined') {
        Object.keys(MANIFEST).forEach((p) => CUR.declareBuilt(p, MANIFEST[p]));
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = MANIFEST;
})();
