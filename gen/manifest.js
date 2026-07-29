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
        'math-alg': [
            'alg.orderOfOperations',
        ],
        'math-count': [
            'count.cardinality',
            'count.compare.sets',
            'count.numeral',
            'count.oneToOne',
            'count.sequence',
            'count.skip',
            'count.subitize.grouped',
            'count.subitize.small',
        ],
        'math-dec': [
            'dec.addSub',
            'dec.compare',
            'dec.div',
            'dec.fractionLink',
            'dec.mult',
            'dec.numberline',
            'dec.round',
            'dec.tenthsHundredths',
            'dec.thousandths',
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
        'math-geom': [
            'geom.partition.equalArea',
        ],
        'math-meas': [
            'meas.area.count',
            'meas.area.multiply',
            'meas.iterateUnits',
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
        'math-pv': [
            'pv.compare.multiDigit',
            'pv.compare.twoDigit',
            'pv.expanded',
            'pv.numberline.whole',
            'pv.powersOfTen',
            'pv.round',
            'pv.teen',
            'pv.tenTimes',
            'pv.threeDigit',
            'pv.twoDigit',
        ],
    };

    if (typeof CUR !== 'undefined') {
        Object.keys(MANIFEST).forEach((p) => CUR.declareBuilt(p, MANIFEST[p]));
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = MANIFEST;
})();
