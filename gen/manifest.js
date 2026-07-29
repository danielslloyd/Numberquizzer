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
    };

    if (typeof CUR !== 'undefined') {
        Object.keys(MANIFEST).forEach((p) => CUR.declareBuilt(p, MANIFEST[p]));
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = MANIFEST;
})();
