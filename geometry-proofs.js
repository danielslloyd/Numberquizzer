/* ============================================================================
 * geometry-proofs.js — step-by-step geometric proof builder in the style of
 * Oliver Byrne's 1847 edition of Euclid's Elements: flat vermilion / ultramarine /
 * gamboge / black shapes on cream paper, and statements written with inline
 * coloured glyphs instead of letter labels.
 *
 * Same clean-merge design as language-arts.js: every line of this feature lives
 * in this file and geometry-proofs.css. It plugs into the host app by adding
 * keys to the global TAB_ENTRY / SCREEN_TAB objects from app.js and injecting
 * its own stylesheet, tab button, and screen <div> at load.
 *
 * Namespacing: everything is `gp*`. Wrapped in an IIFE so no globals leak.
 * ==========================================================================*/
(function () {
    'use strict';

    const SVGNS = 'http://www.w3.org/2000/svg';

    // Byrne's printing inks (after the Rougeux restoration of the 1847 plates)
    const GP_C = {
        red:    '#d33723',   // vermilion
        blue:   '#1e64b4',   // ultramarine
        yellow: '#f0c32e',   // gamboge
        black:  '#2b2926',   // ink
    };

    const rand = (n) => Math.floor(Math.random() * n);
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = rand(i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function gpRoman(n) {
        const R = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        let out = '';
        for (const [v, s] of R) while (n >= v) { out += s; n -= v; }
        return out;
    }

    // Filled pie-slice path. Angles in degrees, SVG screen coordinates
    // (y down, angles increase clockwise from +x). Spans must be < 360.
    function wedgeD(cx, cy, r, a0, a1) {
        const rad = Math.PI / 180;
        const x0 = cx + r * Math.cos(a0 * rad), y0 = cy + r * Math.sin(a0 * rad);
        const x1 = cx + r * Math.cos(a1 * rad), y1 = cy + r * Math.sin(a1 * rad);
        const large = (a1 - a0) > 180 ? 1 : 0;
        const f = (v) => Math.round(v * 100) / 100;
        return `M ${f(cx)} ${f(cy)} L ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)} Z`;
    }

    /* ---- inline coloured glyphs (Byrne's device: shapes instead of letters) */
    function gpGlyphSVG(kind, color) {
        const c = GP_C[color], ink = GP_C.black;
        let vb, body;
        switch (kind) {
            case 'line':
                vb = '0 0 30 16';
                body = `<line x1="2" y1="9" x2="28" y2="9" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/>`;
                break;
            case 'circle':
                vb = '0 0 20 16';
                body = `<circle cx="10" cy="8" r="6.4" fill="none" stroke="${c}" stroke-width="2.8"/>`;
                break;
            case 'angle':
                vb = '0 0 24 16';
                body = `<path d="M2 15 L23 15 A21 21 0 0 0 18.5 2.1 Z" fill="${c}"/>`;
                break;
            case 'square':
                vb = '0 0 16 16';
                body = `<rect x="2" y="2" width="12" height="12" fill="${c}" stroke="${ink}" stroke-width="1"/>`;
                break;
            case 'rect':
                vb = '0 0 16 16';
                body = `<rect x="4.5" y="1.5" width="7" height="13" fill="${c}" stroke="${ink}" stroke-width="1"/>`;
                break;
            case 'tri':
                vb = '0 0 20 16';
                body = `<path d="M10 2 L18.5 14.5 L1.5 14.5 Z" fill="${c}" stroke="${ink}" stroke-width="1"/>`;
                break;
            case 'point':
                vb = '0 0 12 16';
                body = `<circle cx="6" cy="8" r="4" fill="${c}"/>`;
                break;
        }
        return `<svg class="gp-glyph" viewBox="${vb}" aria-label="${color} ${kind}" role="img">${body}</svg>`;
    }
    // Replace tokens like [red-line], [blue-circle], [yellow-angle] with glyphs.
    function gpGlyphs(text) {
        return text.replace(/\[(red|blue|yellow|black)-(line|circle|angle|square|rect|tri|point)\]/g,
            (m, color, kind) => gpGlyphSVG(kind, color));
    }

    /* ========================================================================
     * THE PROPOSITIONS
     * Each shape has s: the step (1-based) after which it appears; s:0 = given.
     * z:0 puts solid fills beneath the linework (default z is 1).
     * Each step: { ask, ok:{t: correct choice, done: ledger line}, no:[{t, why}],
     *              flash:[shape ids to pulse after the reveal] }
     * ======================================================================*/
    const PROPS = [
    {
        id: 'i1', ref: 'Book I. Proposition I.',
        title: 'To build an equilateral triangle',
        enun: 'Upon a given straight line, to describe an equilateral triangle — a triangle whose three sides are all equal.',
        view: '10 56 380 264',
        shapes: [
            { id: 'tri',  t: 'poly', pts: [[140, 190], [260, 190], [200, 86.1]], c: 'yellow', s: 6, z: 0 },
            { id: 'base', t: 'line', x1: 140, y1: 190, x2: 260, y2: 190, c: 'black', w: 5, s: 0 },
            { id: 'ca',   t: 'circle', cx: 140, cy: 190, r: 120, c: 'red',  w: 3.5, s: 1 },
            { id: 'cb',   t: 'circle', cx: 260, cy: 190, r: 120, c: 'blue', w: 3.5, s: 2 },
            { id: 'la',   t: 'line', x1: 140, y1: 190, x2: 200, y2: 86.1, c: 'red',  w: 5, s: 3 },
            { id: 'lb',   t: 'line', x1: 260, y1: 190, x2: 200, y2: 86.1, c: 'blue', w: 5, s: 3 },
            { id: 'da',   t: 'dot', cx: 140, cy: 190, r: 5, c: 'black', s: 0 },
            { id: 'db',   t: 'dot', cx: 260, cy: 190, r: 5, c: 'black', s: 0 },
            { id: 'dc',   t: 'dot', cx: 200, cy: 86.1, r: 5, c: 'black', s: 3 },
        ],
        steps: [
            {
                ask: 'We are given the [black-line]. Euclid allows just two tools — a straightedge and a compass. What is the first move?',
                ok: { t: 'Open the compass to the [black-line] and sweep a [red-circle] about its left end.',
                      done: 'About the left end, a [red-circle] is described, with the [black-line] for its radius.' },
                no: [
                    { t: 'Measure the [black-line] with a ruler, then mark a point above it that looks about right.',
                      why: 'Euclid never measures — a ruler’s numbers prove nothing. The compass will carry the exact length for us.' },
                    { t: 'Fold the page in half to find the middle of the [black-line].',
                      why: 'No folding in Greek geometry! Only a straightedge and a compass are allowed.' },
                ],
            },
            {
                ask: 'Every point of the [red-circle] is one radius away from the left end — but which point do we want? One circle cannot say. What next?',
                ok: { t: 'Sweep an equal [blue-circle] about the right end of the [black-line].',
                      done: 'About the right end, a [blue-circle] is described, with the same radius.' },
                no: [
                    { t: 'Pick the highest point of the [red-circle] and call it the top of the triangle.',
                      why: 'That point is the right distance from the left end — but nothing promises it is the right distance from the right end.' },
                    { t: 'Draw a bigger circle around the whole picture.',
                      why: 'A bigger circle carries a different length. We need the same radius again — the [black-line] itself.' },
                ],
            },
            {
                ask: 'The [red-circle] and the [blue-circle] cross at a point above the line. Why is that point the one we want?',
                ok: { t: 'It lies on both circles at once — join it to both ends of the [black-line].',
                      done: 'From the crossing point, a [red-line] and a [blue-line] are drawn to the two ends.' },
                no: [
                    { t: 'Because it is the highest point the compass can reach.',
                      why: '“Highest” is not a reason. What matters is that the point sits on both circles at once.' },
                    { t: 'Because it looks like it is exactly above the middle.',
                      why: 'It is above the middle — but “looks like” proves nothing. Being on both circles is what makes the distances equal.' },
                ],
            },
            {
                ask: 'Now the proof. Why must the [red-line] be equal to the [black-line]?',
                ok: { t: 'Both run from the centre of the [red-circle] out to its rim — and all radii of one circle are equal.',
                      done: 'The [red-line] is equal to the [black-line], for both are radii of the [red-circle].' },
                flash: ['ca', 'la', 'base'],
                no: [
                    { t: 'Because they look the same length.',
                      why: 'Looks can lie. A proof needs a reason that would convince someone who cannot even see the picture.' },
                    { t: 'Because the triangle is equilateral.',
                      why: 'That is the very thing we are trying to prove! A proof may never assume its own conclusion.' },
                ],
            },
            {
                ask: 'And why must the [blue-line] be equal to the [black-line]?',
                ok: { t: 'Both are radii of the [blue-circle] — from its centre out to its rim.',
                      done: 'The [blue-line] is equal to the [black-line], for both are radii of the [blue-circle].' },
                flash: ['cb', 'lb', 'base'],
                no: [
                    { t: 'Because the [blue-line] equals the [red-line].',
                      why: 'We have not shown that yet — it is the prize at the end. Use the [blue-circle], just as we used the red one.' },
                    { t: 'Because both lines lean at the same slant.',
                      why: 'Slant says nothing about length. The [blue-circle] is what carries the equal length across.' },
                ],
            },
            {
                ask: 'So the [red-line] equals the [black-line], and the [blue-line] equals the [black-line]. What follows?',
                ok: { t: 'Things equal to the same thing are equal to each other — all three sides are equal, and the triangle is equilateral.',
                      done: 'Therefore [red-line] = [blue-line] = [black-line], and the [yellow-tri] is equilateral. Q.E.D.' },
                no: [
                    { t: 'The [red-line] and the [blue-line] are probably close enough.',
                      why: '“Close enough” is not geometry. Euclid’s first common notion finishes it exactly: things equal to the same thing are equal to one another.' },
                    { t: 'We still need to measure the third side to be sure.',
                      why: 'No measuring needed — both new sides were proved equal to the [black-line], so they must equal each other.' },
                ],
            },
        ],
        build: {
            seed: [[[140, 230], [340, 230]]],
            targets: [
                { t: 'circle', cx: 140, cy: 230, r: 200, ink: 'red',
                  instr: 'Sweep a [red-circle] about the left end of the [black-line], passing through its right end.',
                  miss: 'We need a circle about the left end whose rim reaches exactly to the right end — press on the left end and drag to the right.' },
                { t: 'circle', cx: 340, cy: 230, r: 200, ink: 'blue',
                  instr: 'Now sweep an equal [blue-circle] about the right end, passing through the left end.',
                  miss: 'The second circle sits on the right end and reaches exactly to the left end.' },
                { t: 'seg', x1: 140, y1: 230, x2: 240, y2: 56.79, ink: 'red',
                  instr: 'The circles cross above the line. Join that crossing to the left end of the [black-line].',
                  miss: 'Draw from the point where the two circles cross, above the line, down to the left end.' },
                { t: 'seg', x1: 340, y1: 230, x2: 240, y2: 56.79, ink: 'blue',
                  instr: 'And join the crossing to the right end.',
                  miss: 'Draw from the circles’ crossing down to the right end of the line.' },
            ],
            qed: 'An equilateral triangle stands upon the line — every side a radius.',
        },
    },
    {
        id: 'i5', ref: 'Book I. Proposition V.',
        title: 'The isosceles triangle',
        enun: 'In a triangle with two equal sides, the two angles at the base are also equal.',
        view: '92 54 256 224',
        shapes: [
            { id: 'wA', t: 'wedge', cx: 220, cy: 80, r: 44, a0: 60.95, a1: 119.05, c: 'yellow', s: 0, z: 0 },
            { id: 'wB', t: 'wedge', cx: 120, cy: 260, r: 44, a0: -60.95, a1: 0, c: 'red', s: 4, z: 0 },
            { id: 'wC', t: 'wedge', cx: 320, cy: 260, r: 44, a0: 180, a1: 240.95, c: 'blue', s: 4, z: 0 },
            { id: 'sBC', t: 'line', x1: 120, y1: 260, x2: 320, y2: 260, c: 'black', w: 4.5, s: 0 },
            { id: 'sAB', t: 'line', x1: 220, y1: 80, x2: 120, y2: 260, c: 'red', w: 5, s: 0 },
            { id: 'sAC', t: 'line', x1: 220, y1: 80, x2: 320, y2: 260, c: 'blue', w: 5, s: 0 },
        ],
        steps: [
            {
                ask: 'This triangle has two equal sides — the [red-line] and the [blue-line] — and we must show its two bottom corners match. The old trick: compare the triangle with… what?',
                ok: { t: 'With itself, turned over — lift it, flip it like a pancake, and set it back down with its sides exchanged.',
                      done: 'The triangle is compared with its own reflection, the two equal sides exchanging places.' },
                no: [
                    { t: 'With a larger triangle of the same shape.',
                      why: 'No other triangle is needed — the only perfect twin of this triangle is the triangle itself, turned over.' },
                    { t: 'With a square built upon its base.',
                      why: 'Squares belong to another proposition. Here the triangle itself is the only tool we need.' },
                ],
            },
            {
                ask: 'Flipped over, the [blue-line] now lies where the [red-line] stood, and the [red-line] where the [blue-line] was. Do they fit?',
                ok: { t: 'Perfectly — flipping moves a shape without stretching it, and the two sides were given equal.',
                      done: 'The [blue-line] falls upon the [red-line], and the [red-line] upon the [blue-line]: equal upon equal.' },
                flash: ['sAB', 'sAC'],
                no: [
                    { t: 'Only if the triangle is also right-angled.',
                      why: 'No right angle is needed — only the two equal sides, and those were given.' },
                    { t: 'No — turning a shape over changes its lengths.',
                      why: 'Turning never stretches: a shape keeps every length and every angle when it is flipped.' },
                ],
            },
            {
                ask: 'And the [yellow-angle] at the top, held between the two equal sides?',
                ok: { t: 'It lands exactly upon itself — the same opening, only with its two arms exchanged.',
                      done: 'The [yellow-angle] coincides with itself, its arms exchanged.' },
                flash: ['wA'],
                no: [
                    { t: 'It lands upside-down, so it cannot match.',
                      why: 'An angle is only an opening between two arms — exchange the arms and the opening is unchanged.' },
                    { t: 'It grows wider when the triangle is flipped.',
                      why: 'Flipping changes no angle. The opening at the top is carried over exactly.' },
                ],
            },
            {
                ask: 'So the flipped triangle covers the original exactly — side upon side, angle upon angle. What follows for the two bottom corners?',
                ok: { t: 'Each lands upon the other: the [red-angle] at one end of the base equals the [blue-angle] at the other.',
                      done: 'Therefore the [red-angle] equals the [blue-angle]: the base angles of an isosceles triangle are equal. Q.E.D.' },
                flash: ['wB', 'wC'],
                no: [
                    { t: 'They trade places, so nothing can be said of them.',
                      why: 'Trading places is the whole point: each corner fits exactly into the other, so the two must be equal.' },
                    { t: 'Only the top corner is unchanged.',
                      why: 'Every part of the flipped triangle lies on the original — the bottom corners included, each upon the other.' },
                ],
            },
        ],
    },
    {
        id: 'i9', ref: 'Book I. Proposition IX.',
        title: 'To bisect an angle',
        enun: 'To cut a given angle exactly in half, using only compass and straightedge.',
        view: '-26 62 460 356',
        shapes: [
            { id: 'w1', t: 'wedge', cx: 150, cy: 240, r: 55, a0: -30, a1: -15, c: 'red', s: 4, z: 0 },
            { id: 'w2', t: 'wedge', cx: 150, cy: 240, r: 55, a0: -15, a1: 0, c: 'blue', s: 4, z: 0 },
            { id: 'arm1', t: 'line', x1: 150, y1: 240, x2: 314.5, y2: 145, c: 'black', w: 4.5, s: 0 },
            { id: 'arm2', t: 'line', x1: 150, y1: 240, x2: 320, y2: 240, c: 'black', w: 4.5, s: 0 },
            { id: 'cV', t: 'circle', cx: 150, cy: 240, r: 170, c: 'red', w: 3.5, s: 1 },
            { id: 'cD', t: 'circle', cx: 297.2, cy: 155, r: 88, c: 'blue', w: 3.5, s: 2 },
            { id: 'cE', t: 'circle', cx: 320, cy: 240, r: 88, c: 'blue', w: 3.5, s: 2 },
            { id: 'bis', t: 'line', x1: 150, y1: 240, x2: 382.2, y2: 177.8, c: 'yellow', w: 5, s: 3 },
            { id: 'dV', t: 'dot', cx: 150, cy: 240, r: 5, c: 'black', s: 0 },
            { id: 'dD', t: 'dot', cx: 297.2, cy: 155, r: 5, c: 'black', s: 1 },
            { id: 'dE', t: 'dot', cx: 320, cy: 240, r: 5, c: 'black', s: 1 },
            { id: 'dF', t: 'dot', cx: 382.2, cy: 177.8, r: 5, c: 'black', s: 2 },
        ],
        steps: [
            {
                ask: 'An angle sits at its corner. To cut it in half we first need one point on each arm, both equally far from the corner. How?',
                ok: { t: 'Sweep a [red-circle] about the corner — wherever it cuts the two arms, the distances are equal radii.',
                      done: 'A [red-circle] about the corner cuts both arms at equal distances from it.' },
                no: [
                    { t: 'Mark a point on each arm where they look evenly placed.',
                      why: 'Looks prove nothing. A circle makes the two distances equal by its very nature — every radius is the same.' },
                    { t: 'Draw a straight line across the angle.',
                      why: 'A crossbar drawn anywhere may lean toward one arm. First we need equal footholds, and only the compass gives them.' },
                ],
            },
            {
                ask: 'Two equal footholds stand on the arms. Now we need a point out in the middle of the angle that favours neither side. How?',
                ok: { t: 'Sweep equal [blue-circle]s about each foothold, each through the other — where they cross favours neither arm.',
                      done: 'Equal [blue-circle]s about the footholds cross at a point evenly placed between the arms.' },
                no: [
                    { t: 'Join the two footholds — that line is the bisector.',
                      why: 'That crossbar joins the arms but never passes through the corner — and a bisector must begin there.' },
                    { t: 'Pick the middle by eye and mark it.',
                      why: 'The eye flatters and lies. The two equal circles find the true middle without any guessing.' },
                ],
            },
            {
                ask: 'The [yellow-line] joins the corner to the crossing. It looks like it halves the angle — but why must it? Consider the two triangles it makes.',
                ok: { t: 'Their sides match pair for pair: equal red radii, equal blue radii, and the [yellow-line] itself shared by both.',
                      done: 'The two triangles have all three sides equal, pair for pair — red with red, blue with blue, yellow shared.' },
                flash: ['cV', 'cD', 'cE', 'bis'],
                no: [
                    { t: 'They look the same size.',
                      why: 'Byrne would blush — looks are not proof. Count the sides: it is the three equal pairs that force the match.' },
                    { t: 'They stand on the same corner, and that is enough.',
                      why: 'Two very different triangles can share a corner. It is the three matching sides that leave no room for difference.' },
                ],
            },
            {
                ask: 'Triangles that agree in all three sides agree in everything. So the two angles at the corner…',
                ok: { t: '…are equal: the [red-angle] and the [blue-angle] are the two matching halves of the whole.',
                      done: 'Therefore the [red-angle] equals the [blue-angle], and the angle is bisected. Q.E.D.' },
                flash: ['w1', 'w2'],
                no: [
                    { t: '…are each a right angle.',
                      why: 'Only if the whole angle were 180°! The halves are equal to each other — whatever the whole may be.' },
                    { t: '…differ by the width of the [yellow-line].',
                      why: 'A line has no width in geometry — the halves are exactly, not nearly, equal.' },
                ],
            },
        ],
        build: {
            seed: [[[150, 240], [314.5, 145]], [[150, 240], [320, 240]]],
            targets: [
                { t: 'circle', cx: 150, cy: 240, r: 170, ink: 'red',
                  instr: 'Sweep a [red-circle] about the corner of the angle, through the end of its lower arm — so that it cuts both arms.',
                  miss: 'Press on the corner and drag to the end of the lower arm, so one circle cuts both arms at equal distances.' },
                { t: 'circle', cx: 297.2, cy: 155, r: 88, ink: 'blue',
                  instr: 'Sweep a [blue-circle] about the point where the [red-circle] cuts the upper arm, through the point where it meets the lower arm.',
                  miss: 'The circle should sit on the upper crossing and pass exactly through the lower one.' },
                { t: 'circle', cx: 320, cy: 240, r: 88, ink: 'blue',
                  instr: 'Now its twin: an equal [blue-circle] about the lower point, back through the upper one.',
                  miss: 'The twin circle sits on the lower point and passes exactly through the upper one.' },
                { t: 'seg', ink: 'yellow',
                  any: [
                      { t: 'seg', x1: 150, y1: 240, x2: 382.2, y2: 177.8 },
                      { t: 'seg', x1: 150, y1: 240, x2: 235, y2: 217.2 },
                  ],
                  instr: 'Join the corner to a point where the two [blue-circle]s cross: the [yellow-line] cuts the angle exactly in half.',
                  miss: 'Draw from the corner of the angle to one of the points where the two blue circles cross.' },
            ],
            qed: 'The angle is bisected — two equal halves, found by circles alone.',
        },
    },
    {
        id: 'i10', ref: 'Book I. Proposition X.',
        title: 'To bisect a line',
        enun: 'To find the exact middle of a given straight line, using only compass and straightedge.',
        view: '24 42 432 300',
        shapes: [
            { id: 'base', t: 'line', x1: 170, y1: 190, x2: 310, y2: 190, c: 'black', w: 5, s: 0 },
            { id: 'cA', t: 'circle', cx: 170, cy: 190, r: 140, c: 'red', w: 3.5, s: 1 },
            { id: 'cB', t: 'circle', cx: 310, cy: 190, r: 140, c: 'blue', w: 3.5, s: 2 },
            { id: 'cut', t: 'line', x1: 240, y1: 68.76, x2: 240, y2: 311.24, c: 'yellow', w: 5, s: 3 },
            { id: 'dA', t: 'dot', cx: 170, cy: 190, r: 5, c: 'black', s: 0 },
            { id: 'dB', t: 'dot', cx: 310, cy: 190, r: 5, c: 'black', s: 0 },
            { id: 'dT', t: 'dot', cx: 240, cy: 68.76, r: 5, c: 'black', s: 3 },
            { id: 'dU', t: 'dot', cx: 240, cy: 311.24, r: 5, c: 'black', s: 3 },
            { id: 'dM', t: 'dot', cx: 240, cy: 190, r: 6, c: 'red', s: 4 },
        ],
        steps: [
            {
                ask: 'We must find the exact middle of the [black-line] — no ruler, no numbers. Where do we begin?',
                ok: { t: 'Sweep a [red-circle] about the left end, with the whole [black-line] for its radius.',
                      done: 'A [red-circle] is described about the left end, through the right.' },
                no: [
                    { t: 'Fold the line in half.',
                      why: 'No folding in Greek geometry — and a drawn line will not bend. The compass must do the finding.' },
                    { t: 'Guess the middle and check by eye.',
                      why: 'A guess can always be a hair off. Euclid wants the middle exactly, and circles never guess.' },
                ],
            },
            {
                ask: 'One circle alone tells us nothing about the middle. What next?',
                ok: { t: 'Sweep an equal [blue-circle] about the right end, through the left.',
                      done: 'An equal [blue-circle] is described about the right end, through the left.' },
                no: [
                    { t: 'A smaller circle about the same end.',
                      why: 'A different radius carries a different distance. The two circles must be equal for the balance to come.' },
                    { t: 'Mark where the [red-circle] is highest.',
                      why: 'The top of the red circle sits above its own centre — the left end — not above the middle of the line.' },
                ],
            },
            {
                ask: 'The circles cross twice — once above the line, once below. What now?',
                ok: { t: 'Join the two crossings with the [yellow-line].',
                      done: 'The two crossings are joined by the [yellow-line], which cuts the [black-line].' },
                no: [
                    { t: 'Join each crossing to the two ends.',
                      why: 'Fine work — but that builds the equilateral triangle of Proposition I. Today we only join the crossings to each other.' },
                    { t: 'Rub out the circles; the crossings are enough by themselves.',
                      why: 'The crossings alone are just two points. It is the line through them that will cut the [black-line].' },
                ],
            },
            {
                ask: 'Why must the [yellow-line] cut the [black-line] at its exact middle?',
                ok: { t: 'Each crossing is equally far from the two ends — both circles say so — thus the whole [yellow-line] leans toward neither end.',
                      done: 'The [yellow-line] favours neither end; where it meets the [black-line] is the exact middle. Q.E.D.' },
                flash: ['cut', 'base', 'dM'],
                no: [
                    { t: 'Because it stands upright on the page.',
                      why: '“Upright” is about the page, not the geometry. Turn the drawing and the reason must still hold — equal distances are what count.' },
                    { t: 'Because the circles are roughly the same size.',
                      why: 'Not roughly — exactly: each has the whole [black-line] for its radius. On that exactness the whole proof stands.' },
                ],
            },
        ],
        build: {
            seed: [[[170, 190], [310, 190]]],
            targets: [
                { t: 'circle', cx: 170, cy: 190, r: 140, ink: 'red',
                  instr: 'Sweep a [red-circle] about the left end of the [black-line], through its right end.',
                  miss: 'Press on the left end and drag to the right end — the whole line becomes the radius.' },
                { t: 'circle', cx: 310, cy: 190, r: 140, ink: 'blue',
                  instr: 'Sweep an equal [blue-circle] about the right end, through the left.',
                  miss: 'The second circle sits on the right end and passes exactly through the left end.' },
                { t: 'seg', x1: 240, y1: 68.76, x2: 240, y2: 311.24, ink: 'yellow',
                  instr: 'Join the two points where the circles cross — above and below — with the [yellow-line].',
                  miss: 'Draw from the upper crossing of the two circles straight to the lower crossing.' },
            ],
            qed: 'Where the yellow line cuts the black is the exact middle — and no ruler was harmed.',
        },
    },
    {
        id: 'i11', ref: 'Book I. Proposition XI.',
        title: 'To raise a perpendicular',
        enun: 'From a given point on a straight line, to raise a line at right angles to it.',
        view: '-46 84 498 338',
        shapes: [
            { id: 'wL', t: 'wedge', cx: 200, cy: 250, r: 40, a0: 180, a1: 270, c: 'red', s: 4, z: 0 },
            { id: 'wR', t: 'wedge', cx: 200, cy: 250, r: 40, a0: 270, a1: 360, c: 'blue', s: 4, z: 0 },
            { id: 'segL', t: 'line', x1: 120, y1: 250, x2: 200, y2: 250, c: 'black', w: 4.5, s: 0 },
            { id: 'segR', t: 'line', x1: 200, y1: 250, x2: 400, y2: 250, c: 'black', w: 4.5, s: 0 },
            { id: 'cO', t: 'circle', cx: 200, cy: 250, r: 80, c: 'red', w: 3.5, s: 1 },
            { id: 'cD', t: 'circle', cx: 120, cy: 250, r: 160, c: 'blue', w: 3.5, s: 2 },
            { id: 'cE', t: 'circle', cx: 280, cy: 250, r: 160, c: 'blue', w: 3.5, s: 2 },
            { id: 'perp', t: 'line', x1: 200, y1: 250, x2: 200, y2: 111.44, c: 'yellow', w: 5, s: 3 },
            { id: 'dO', t: 'dot', cx: 200, cy: 250, r: 5.5, c: 'black', s: 0 },
            { id: 'dD', t: 'dot', cx: 120, cy: 250, r: 5, c: 'black', s: 1 },
            { id: 'dE', t: 'dot', cx: 280, cy: 250, r: 5, c: 'black', s: 1 },
            { id: 'dF', t: 'dot', cx: 200, cy: 111.44, r: 5, c: 'black', s: 2 },
        ],
        steps: [
            {
                ask: 'From the marked point we must raise a line square to the [black-line]. Euclid first gives the point two equal companions. Why circles?',
                ok: { t: 'A [red-circle] about the point cuts the line on both sides at the same distance — perfectly even companions.',
                      done: 'A [red-circle] about the marked point cuts the line at two equal distances.' },
                no: [
                    { t: 'Skip the companions — just draw a line straight up.',
                      why: 'For Euclid the page has no “up” — only relations between lines. The right angle must be built, not eyeballed.' },
                    { t: 'One companion on one side would be enough.',
                      why: 'One point alone cannot say what “square” means. Balance between the two sides is the whole idea of a right angle.' },
                ],
            },
            {
                ask: 'Two equal companions flank the point — just like the two ends of a line to be bisected. What next?',
                ok: { t: 'Equal [blue-circle]s about each companion, each through the other — they cross above the line.',
                      done: 'Equal [blue-circle]s about the companions cross above the line.' },
                no: [
                    { t: 'Join the companions to each other.',
                      why: 'They already lie on the [black-line] — joining them adds nothing new. The new point must stand off the line.' },
                    { t: 'Two more circles about the marked point.',
                      why: 'Circles about the same centre never cross each other. The crossing must come from two different centres.' },
                ],
            },
            {
                ask: 'The [yellow-line] joins the marked point to the crossing. Why does it lean to neither side?',
                ok: { t: 'The crossing is equally far from both companions — and so is the marked point. Two such points fix a line of perfect balance.',
                      done: 'The [yellow-line] joins two points, each of which favours neither companion.' },
                flash: ['cD', 'cE', 'perp'],
                no: [
                    { t: 'Because the drawing looks symmetrical.',
                      why: 'It is symmetrical — but “looks” is not the reason. The equal circles are what force the balance.' },
                    { t: 'Because it is the shortest line on the page.',
                      why: 'Length is beside the point. Equal distances to the two companions are what hold it upright.' },
                ],
            },
            {
                ask: 'Look at the two angles at the foot of the [yellow-line], left and right. What are they?',
                ok: { t: 'Equal — and two equal angles that together fill a straight line are each half of 180°: right angles.',
                      done: 'The [red-angle] equals the [blue-angle]; each is therefore a right angle, and the perpendicular stands. Q.E.D.' },
                flash: ['wL', 'wR'],
                no: [
                    { t: 'The left one is larger, for the line leans a little.',
                      why: 'It cannot lean: the perfect balance between the companions forbids it. The two angles are exactly equal.' },
                    { t: 'Together they make one right angle.',
                      why: 'Together they fill one side of a straight line — two right angles. Being equal, each takes exactly one.' },
                ],
            },
        ],
        build: {
            seed: [[[120, 250], [200, 250]], [[200, 250], [400, 250]]],
            targets: [
                { t: 'circle', cx: 200, cy: 250, r: 80, ink: 'red',
                  instr: 'Sweep a [red-circle] about the marked point, through the near end of the line — it marks two equal companions, one on each side.',
                  miss: 'Press on the marked middle point and drag to the nearer end, so the circle cuts the line on both sides.' },
                { t: 'circle', cx: 120, cy: 250, r: 160, ink: 'blue',
                  instr: 'Sweep a [blue-circle] about the left companion, through the right one.',
                  miss: 'The circle sits on the left companion and passes exactly through the right one.' },
                { t: 'circle', cx: 280, cy: 250, r: 160, ink: 'blue',
                  instr: 'And its twin: an equal [blue-circle] about the right companion, through the left.',
                  miss: 'The twin circle sits on the right companion and passes exactly through the left one.' },
                { t: 'seg', x1: 200, y1: 250, x2: 200, y2: 111.44, ink: 'yellow',
                  instr: 'Join the marked point to the crossing above the line: the [yellow-line] stands square upon the [black-line].',
                  miss: 'Draw from the marked point up to where the two blue circles cross.' },
            ],
            qed: 'A true right angle, raised with circles alone.',
        },
    },
    {
        id: 'i15', ref: 'Book I. Proposition XV.',
        title: 'Crossing lines make equal angles',
        enun: 'If two straight lines cut one another, the opposite (vertical) angles are equal.',
        view: '30 50 340 200',
        shapes: [
            { id: 'wr', t: 'wedge', cx: 200, cy: 150, r: 52, a0: 209.36, a1: 330.64, c: 'red',    s: 1, z: 0 },
            { id: 'wb', t: 'wedge', cx: 200, cy: 150, r: 52, a0: -29.36, a1: 29.36,  c: 'blue',   s: 1, z: 0 },
            { id: 'wy', t: 'wedge', cx: 200, cy: 150, r: 52, a0: 29.36,  a1: 150.64, c: 'yellow', s: 2, z: 0 },
            { id: 'l1', t: 'line', x1: 40, y1: 60,  x2: 360, y2: 240, c: 'black', w: 4.5, s: 0 },
            { id: 'l2', t: 'line', x1: 40, y1: 240, x2: 360, y2: 60,  c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Two black lines cross. Look at the [red-angle] on top and the [blue-angle] beside it on the right. What do they make together?',
                ok: { t: 'Side by side they fill one whole side of a straight line — together they make two right angles (180°).',
                      done: 'The [red-angle] and the [blue-angle] together make two right angles, for they stand side by side upon a straight line.' },
                no: [
                    { t: 'Together they make a full circle.',
                      why: 'A full circle is four right angles (360°). These two only fill one side of a line — exactly half of that.' },
                    { t: 'Nothing certain — it depends on how the lines lean.',
                      why: 'The lean does not matter! However the lines tilt, two angles filling one side of a straight line always share 180°.' },
                ],
            },
            {
                ask: 'Now look at the [blue-angle] and the [yellow-angle] beneath it. What do they make together?',
                ok: { t: 'They also stand side by side upon a straight line — so they too make two right angles.',
                      done: 'The [blue-angle] and the [yellow-angle] together also make two right angles.' },
                no: [
                    { t: 'Less than the first pair, because the [yellow-angle] hangs below the crossing.',
                      why: 'Above or below makes no difference — they stand together on the other straight line, so they also share 180°.' },
                    { t: 'They must be equal to each other.',
                      why: 'Only if the lines happened to cross squarely. But their sum is always two right angles, however the lines lean.' },
                ],
            },
            {
                ask: '[red-angle] + [blue-angle] = 180°, and [blue-angle] + [yellow-angle] = 180°. What follows?',
                ok: { t: 'Take the [blue-angle] away from both: the [red-angle] and the [yellow-angle] must be equal.',
                      done: 'Taking the common [blue-angle] from both, the [red-angle] equals the [yellow-angle]. Q.E.D.' },
                flash: ['wr', 'wy'],
                no: [
                    { t: 'The [blue-angle] must be exactly 90°.',
                      why: 'Nothing forces the [blue-angle] to be a right angle — both sums balance whatever size it is.' },
                    { t: 'The [red-angle] and the [blue-angle] must be equal.',
                      why: 'Red and blue sit beside each other, not opposite. It is the angles across the crossing that match.' },
                ],
            },
        ],
    },
    {
        id: 'i32', ref: 'Book I. Proposition XXXII.',
        title: 'The angles of a triangle',
        enun: 'The three inside angles of any triangle together make two right angles — 180°.',
        view: '45 55 390 200',
        shapes: [
            { id: 'wB',  t: 'wedge', cx: 60,  cy: 240, r: 44, a0: -54.78, a1: 0,      c: 'red',    s: 0, z: 0 },
            { id: 'wA',  t: 'wedge', cx: 180, cy: 70,  r: 40, a0: 54.78,  a1: 125.22, c: 'yellow', s: 0, z: 0 },
            { id: 'wC',  t: 'wedge', cx: 300, cy: 240, r: 44, a0: 180,    a1: 234.78, c: 'blue',   s: 0, z: 0 },
            { id: 'wCy', t: 'wedge', cx: 300, cy: 240, r: 44, a0: 234.78, a1: 305.22, c: 'yellow', s: 3, z: 0 },
            { id: 'wCr', t: 'wedge', cx: 300, cy: 240, r: 44, a0: 305.22, a1: 360,    c: 'red',    s: 4, z: 0 },
            { id: 'sAB', t: 'line', x1: 60,  y1: 240, x2: 180, y2: 70,  c: 'black', w: 4.5, s: 0 },
            { id: 'sBC', t: 'line', x1: 60,  y1: 240, x2: 300, y2: 240, c: 'black', w: 4.5, s: 0 },
            { id: 'sCA', t: 'line', x1: 300, y1: 240, x2: 180, y2: 70,  c: 'black', w: 4.5, s: 0 },
            { id: 'ext', t: 'line', x1: 300, y1: 240, x2: 420, y2: 240, c: 'black', w: 4.5, s: 1 },
            { id: 'par', t: 'line', x1: 300, y1: 240, x2: 390, y2: 112.5, c: 'black', w: 3.5, dash: 1, s: 2 },
        ],
        steps: [
            {
                ask: 'Here is a triangle wearing its three angles: [red-angle], [yellow-angle], [blue-angle]. We want to show they add to 180°. Euclid begins with a bold stroke — which?',
                ok: { t: 'Stretch the bottom side onwards, out past the [blue-angle] into empty space.',
                      done: 'The base is produced (stretched onwards) past the corner.' },
                no: [
                    { t: 'Tear the three corners off and push them together.',
                      why: 'A lovely trick with paper — but scissors only test one triangle. A proof must hold for every triangle at once.' },
                    { t: 'Measure each angle with a protractor and add them up.',
                      why: 'A protractor checks one triangle, roughly. Euclid wants every triangle, exactly.' },
                ],
            },
            {
                ask: 'Now the clever stroke: through that same corner we draw the dashed line. What makes it special?',
                ok: { t: 'It is drawn parallel to the far side of the triangle.',
                      done: 'Through the corner, a line is drawn parallel to the opposite side.' },
                no: [
                    { t: 'It cuts the [blue-angle] exactly in half.',
                      why: 'Halving the angle would tell us nothing. Being parallel to the far side is what lets angles travel across.' },
                    { t: 'It rises at exactly 45° from the base.',
                      why: 'There is nothing special about 45° here. Parallel to the opposite side — that is the whole secret.' },
                ],
            },
            {
                ask: 'The dashed line and the triangle’s far side are parallels, and the slanting side runs between them like a bridge. What appears at our corner?',
                ok: { t: 'A copy of the [yellow-angle], between the slanting side and the dashed line — alternate angles between parallels are equal.',
                      done: 'The [yellow-angle] reappears at the corner, for alternate angles between parallels are equal.' },
                no: [
                    { t: 'A copy of the [blue-angle], on the other side of the dashed line.',
                      why: 'The [blue-angle] never moves — it already lives at this corner. It is the [yellow-angle] that crosses between the parallels.' },
                    { t: 'A right angle between the dashed line and the slanting side.',
                      why: 'Only in one special triangle. What parallels always promise is equal alternate angles — the yellow pair.' },
                ],
            },
            {
                ask: 'One angle is still missing. The stretched-out base cuts across both parallels in the same direction. What appears?',
                ok: { t: 'A copy of the [red-angle], beyond the dashed line — corresponding angles on parallels are equal.',
                      done: 'The [red-angle] reappears beyond it, for corresponding angles on parallels are equal.' },
                no: [
                    { t: 'Another copy of the [yellow-angle].',
                      why: 'The [yellow-angle] has already crossed over. This time the base cuts both parallels the same way — and that carries the [red-angle].' },
                    { t: 'A brand-new angle that belongs to no one.',
                      why: 'Nothing at this corner is new — every angle here is a messenger sent from the triangle itself.' },
                ],
            },
            {
                ask: 'Now look at that corner: [blue-angle], [yellow-angle] and [red-angle] stand side by side. What do they fill?',
                ok: { t: 'One whole side of the straight base line — 180°. And they are the triangle’s own three angles!',
                      done: 'The three angles fill one side of a straight line: therefore [red-angle] + [yellow-angle] + [blue-angle] = two right angles. Q.E.D.' },
                flash: ['wC', 'wCy', 'wCr'],
                no: [
                    { t: 'A full circle around the corner.',
                      why: 'Not all the way round — only the upper side of the straight line, and that is exactly 180°.' },
                    { t: 'Three right angles.',
                      why: 'Count again: one side of a straight line holds two right angles — 180° — never three.' },
                ],
            },
        ],
        build: {
            seed: [[[60, 250], [180, 80]], [[180, 80], [300, 250]], [[300, 250], [60, 250]]],
            needs: ['para'],
            targets: [
                { t: 'seg', from: [300, 250], dir: [1, 0], minLen: 60, ink: 'black',
                  instr: 'Stretch the base onward past the corner, into empty space.',
                  miss: 'Drag out of the base’s right end, straight on along it.' },
                { t: 'seg', from: [300, 250], dir: [0.5767, -0.817], minLen: 110, ink: 'black',
                  instr: 'Through that same corner, draw the line parallel to the far side of the triangle — the Parallels instrument snaps to it.',
                  miss: 'Drag out of the right corner, aiming up alongside the triangle’s far (left) side, until the line snaps parallel to it.' },
            ],
            qed: 'The triangle’s three angles now stand side by side upon the straight line at the corner: two right angles in all — which is Prop. XXXII.',
        },
    },
    {
        id: 'i47', ref: 'Book I. Proposition XLVII.',
        title: 'The right-angled triangle (Pythagoras)',
        enun: 'In a right-angled triangle, the square on the side opposite the right angle equals the two squares on the other sides put together.',
        view: '14 -54 452 444',
        P: { A: [120, 180], B: [320, 180], C: [192, 84], F: [24, 108], G: [96, 12],
             K: [416, 52], H: [288, -44], D: [120, 380], E: [320, 380], X: [192, 180], L: [192, 380] },
        shapes: [
            { id: 'sqr', t: 'poly', ptsN: ['A', 'C', 'G', 'F'], c: 'red', outline: 1, s: 1, z: 0 },
            { id: 'sqb', t: 'poly', ptsN: ['C', 'B', 'K', 'H'], c: 'blue', outline: 1, s: 1, z: 0 },
            { id: 'rl', t: 'poly', ptsN: ['A', 'X', 'L', 'D'], c: 'red', outline: 1, s: 7, z: 0 },
            { id: 'rr', t: 'poly', ptsN: ['X', 'B', 'E', 'L'], c: 'blue', outline: 1, s: 8, z: 0 },
            { id: 'tri', t: 'poly', ptsN: ['A', 'C', 'B'], c: 'yellow', s: 0, z: 0 },
            { id: 'wFAB', t: 'wedge', at: 'A', from: 'F', to: 'B', r: 34, c: 'yellow', s: 5, z: 0 },
            { id: 'wCAD', t: 'wedge', at: 'A', from: 'C', to: 'D', r: 24, c: 'yellow', s: 5, z: 0 },
            { id: 'sqc', t: 'poly', ptsN: ['A', 'B', 'E', 'D'], c: null, outline: 1, w: 3.5, s: 1 },
            { id: 'ra', t: 'path', d: 'M 186 92 L 194 98 L 200 90', c: 'black', w: 2.5, s: 0 },
            { id: 'sAC', t: 'line', p: 'A', q: 'C', c: 'red', w: 5, s: 0 },
            { id: 'sCB', t: 'line', p: 'C', q: 'B', c: 'blue', w: 5, s: 0 },
            { id: 'sAB', t: 'line', p: 'A', q: 'B', c: 'black', w: 5, s: 0 },
            { id: 'gb', t: 'line', p: 'G', q: 'B', c: 'black', w: 2.5, dash: 1, s: 2 },
            { id: 'perp', t: 'line', p: 'C', q: 'L', c: 'black', w: 3.5, dash: 1, s: 3 },
            { id: 'fb', t: 'line', p: 'F', q: 'B', c: 'black', w: 3, dash: 1, s: 4 },
            { id: 'cd', t: 'line', p: 'C', q: 'D', c: 'black', w: 3, dash: 1, s: 4 },
        ],
        steps: [
            {
                ask: 'A right-angled triangle: a [red-line] side, a [blue-line] side, and the longest side — the [black-line], opposite the right angle. The theorem speaks of squares. On what authority do they appear?',
                ok: { t: 'Proposition XLVI, thrice: the [red-square] on one leg, the [blue-square] on the other, and the great square below the [black-line].',
                      done: 'By Prop. XLVI, the three squares are described upon the three sides.' },
                no: [
                    { t: 'Multiply the two short sides together.',
                      why: 'That would be arithmetic. Euclid proves it with real squares of area, drawn upon the sides themselves — and Prop. XLVI just taught us to draw them.' },
                    { t: 'Sketch three squares that look about the right size.',
                      why: 'Forty-six propositions were spent so that no square need ever be “about” again. Each is described exactly.' },
                ],
            },
            {
                ask: 'Now a subtlety nearly every retelling skips. The [red-square]’s far side and the [blue-line] leg both leave the right-angle corner. What must be certified about them before anything can be compared?',
                ok: { t: 'That they lie in one straight line: square-corner and triangle-corner are each right, two rights side by side — so by Prop. XIV the two lines are one.',
                      done: 'The angles at the corner totalling two rights, the [red-square]’s side and the [blue-line] leg lie in one straight line (Prop. XIV).' },
                no: [
                    { t: 'Nothing — they plainly line up in the picture.',
                      why: 'Byrne’s whole book stands against “plainly”. Prop. XIV certifies the straightness from the two right angles — and without it, the coming argument has no rail to run on.' },
                    { t: 'That they are equal in length.',
                      why: 'They are generally unequal — one is the red square’s side, the other the blue leg. What matters is their straightness together, sworn by Prop. XIV.' },
                ],
            },
            {
                ask: 'Now split the great square. What line, and by what right?',
                ok: { t: 'Through the right-angle corner, a line parallel to the great square’s upright sides (Prop. XXXI), falling through it: two rectangles, one under each leg.',
                      done: 'A parallel through the right angle (Prop. XXXI) divides the great square into two rectangles.' },
                no: [
                    { t: 'A diagonal of the great square.',
                      why: 'The diagonal halves it — and halves answer to nothing here. The split must fall under the right-angle corner, mirroring the two legs.' },
                    { t: 'A cut straight across its middle.',
                      why: 'The middle favours neither leg. The cut must hang from the right angle itself, so each rectangle stands under its own leg.' },
                ],
            },
            {
                ask: 'Euclid now draws two quiet lines: from the [red-square]’s far corner to the [black-line]’s far end, and from the right-angle corner down to the great square’s near corner. What are they for?',
                ok: { t: 'They complete two triangles — one hanging from the red square, one standing in the left rectangle — soon to be proved equal, and through them the regions themselves.',
                      done: 'Two auxiliary triangles are drawn: one on the [red-square]’s side, one on the great square’s side.' },
                no: [
                    { t: 'They are decoration — Byrne loved a diagonal.',
                      why: 'Byrne never decorates: every stroke is a premise. These two carry the entire weight of the theorem between them.' },
                    { t: 'They measure the two squares directly.',
                      why: 'No line measures an area. But a triangle can be congruent to another, and doubled into a region — watch.' },
                ],
            },
            {
                ask: 'The two triangles pivot at the same corner of the triangle. Compare their angles there.',
                ok: { t: 'Each is a right angle plus the very same corner angle — one adds the [red-square]’s corner, the other the great square’s. Equals added to the same: equal (Common Notion 2).',
                      done: 'Each pivot angle is a right angle plus the common corner angle: the two [yellow-angle]s are equal.' },
                flash: ['wFAB', 'wCAD'],
                no: [
                    { t: 'Both are right angles.',
                      why: 'Each exceeds a right angle by the shared slant of the triangle — equal to each other, but more than right.' },
                    { t: 'They are vertical angles (Prop. XV).',
                      why: 'Vertical angles need two crossing lines; these two open from the same corner. Their equality is bought by addition: right + common = right + common.' },
                ],
            },
            {
                ask: 'Equal pivot angles — and flanking each, what sides?',
                ok: { t: 'A [red-square] side equal to a [red-square] side, and a great-square side equal to a great-square side: side-angle-side (Prop. IV) — the two triangles are equal.',
                      done: 'By Prop. IV the hanging triangle equals the standing one.' },
                flash: ['fb', 'cd'],
                no: [
                    { t: 'All three sides — use Prop. VIII.',
                      why: 'The third sides are unknown and unneeded: two sides and the included angle is Prop. IV’s exact signature.' },
                    { t: 'The triangles coincide if the page is folded.',
                      why: 'No folding! Prop. IV does rigorously what folding only gestures at — and leaves a theorem where the crease would be.' },
                ],
            },
            {
                ask: 'Neither triangle matters for itself. What is each to its region — the hanging one to the [red-square], the standing one to the left rectangle?',
                ok: { t: 'Its half, by Prop. XLI: the square doubles the hanging triangle (same base, same parallels — the straight line of step two is the rail!), and the rectangle doubles the standing one. Doubles of equals are equal.',
                      done: 'By Prop. XLI twice, [red-square] = 2 × triangle = left [red-rect]: the red square equals the left rectangle.' },
                flash: ['sqr', 'rl'],
                no: [
                    { t: 'Each is a quarter of its region.',
                      why: 'Half, not quarter: base along a side, peak on the opposite rail — Prop. XLI’s exact scene, played twice.' },
                    { t: 'Each merely overlaps its region.',
                      why: 'Overlap proves nothing. The doubling relation of Prop. XLI is what lets the triangles’ equality climb up into the regions.' },
                ],
            },
            {
                ask: 'The [blue-square] and the right rectangle still wait. What settles them?',
                ok: { t: 'The same chain, mirrored: straightness at the corner (XIV), two joins, right-plus-common angles, Prop. IV, Prop. XLI — the [blue-square] equals the right [blue-rect].',
                      done: 'By the mirrored chain, the [blue-square] equals the right rectangle.' },
                flash: ['sqb', 'rr'],
                no: [
                    { t: 'Symmetry alone — no argument needed.',
                      why: 'The figure is not symmetric (the legs differ!) — but the argument is. Every step re-runs with the colours exchanged, and that is what “mirrored” must mean.' },
                    { t: 'The blue square equals the red square.',
                      why: 'Only in one special triangle with equal legs. Each square answers to its own rectangle, by its own chain.' },
                ],
            },
            {
                ask: 'The finish. [red-square] = [red-rect], [blue-square] = [blue-rect]. Together?',
                ok: { t: 'The two rectangles are the whole great square — so [red-square] + [blue-square] equals the square upon the [black-line]. The Pythagorean theorem, every step accounted for.',
                      done: 'The rectangles together are the great square: [red-square] + [blue-square] = the square on the [black-line]. Q.E.D.' },
                flash: ['rl', 'rr', 'sqr', 'sqb'],
                no: [
                    { t: 'Something bigger than the great square.',
                      why: 'The parallel of step three cut the great square into exactly these two pieces — together they are the square, no more, no less.' },
                    { t: 'We cannot tell without knowing the side lengths.',
                      why: 'That is the wonder of it: no lengths were ever needed — only XIV, IV, XLI, and a straight rail. The proof holds for every right-angled triangle at once.' },
                ],
            },
        ],
    },
    {
        id: 'iii31', ref: 'Book III. Proposition XXXI.',
        title: 'The angle in a semicircle',
        enun: 'Any angle drawn from the two ends of a diameter to a point on the circle is a right angle.',
        view: '78 48 324 324',
        shapes: [
            { id: 'wA', t: 'wedge', cx: 90, cy: 210, r: 42, a0: -60, a1: 0, c: 'red', s: 2, z: 0 },
            { id: 'wCa', t: 'wedge', cx: 165, cy: 80.1, r: 36, a0: 60, a1: 120, c: 'red', s: 2, z: 0 },
            { id: 'wB', t: 'wedge', cx: 390, cy: 210, r: 42, a0: 180, a1: 210, c: 'blue', s: 3, z: 0 },
            { id: 'wCb', t: 'wedge', cx: 165, cy: 80.1, r: 36, a0: 30, a1: 60, c: 'blue', s: 3, z: 0 },
            { id: 'circ', t: 'circle', cx: 240, cy: 210, r: 150, c: 'black', w: 3, s: 0 },
            { id: 'diam', t: 'line', x1: 90, y1: 210, x2: 390, y2: 210, c: 'black', w: 4.5, s: 0 },
            { id: 'sCA', t: 'line', x1: 165, y1: 80.1, x2: 90, y2: 210, c: 'red', w: 5, s: 0 },
            { id: 'sCB', t: 'line', x1: 165, y1: 80.1, x2: 390, y2: 210, c: 'blue', w: 5, s: 0 },
            { id: 'rOC', t: 'line', x1: 240, y1: 210, x2: 165, y2: 80.1, c: 'yellow', w: 5, s: 1 },
            { id: 'dO', t: 'dot', cx: 240, cy: 210, r: 5, c: 'black', s: 0 },
            { id: 'dA', t: 'dot', cx: 90, cy: 210, r: 5, c: 'black', s: 0 },
            { id: 'dB', t: 'dot', cx: 390, cy: 210, r: 5, c: 'black', s: 0 },
            { id: 'dC', t: 'dot', cx: 165, cy: 80.1, r: 5, c: 'black', s: 0 },
        ],
        steps: [
            {
                ask: 'A corner stands on the rim, its arms reaching to the two ends of a diameter. To find its size, Euclid reaches for the circle’s one great gift. Which?',
                ok: { t: 'The [yellow-line] from the centre to the corner — a radius, equal to the two radii lying in the diameter.',
                      done: 'A [yellow-line] is drawn from centre to corner: three equal radii now spread from the centre.' },
                no: [
                    { t: 'The tangent touching the circle at the corner.',
                      why: 'Tangents have their own beautiful uses — but the circle’s first gift is simpler: all its radii are equal.' },
                    { t: 'A ruler, to measure the corner directly.',
                      why: 'Measuring shows one circle only, and roughly. The radii will prove it for every circle, exactly.' },
                ],
            },
            {
                ask: 'The [yellow-line] splits the big triangle in two. Look at the left one: two of its sides are radii. What kind of triangle is it?',
                ok: { t: 'Isosceles — so its base angles match: the [red-angle] at the diameter’s end appears again at the rim corner.',
                      done: 'The left triangle is isosceles; its [red-angle] stands at both of its base corners.' },
                no: [
                    { t: 'Equilateral — surely all three sides are radii.',
                      why: 'Only two: the third side is a chord, free to be any length. Two equal sides are enough for equal base angles.' },
                    { t: 'Right-angled — every triangle drawn in a circle is.',
                      why: 'That is the very theorem we are proving! It may not be assumed — and it belongs to the whole triangle, not this half.' },
                ],
            },
            {
                ask: 'Now the right-hand triangle — again two of its sides are radii. What follows?',
                ok: { t: 'Isosceles again: the [blue-angle] at the far end of the diameter reappears beside the red one at the rim.',
                      done: 'The right triangle is isosceles too; its [blue-angle] stands at both of its base corners.' },
                no: [
                    { t: 'It is the same triangle as the left one.',
                      why: 'They share the yellow radius but nothing else need match — each is isosceles on its own account.' },
                    { t: 'Its angles are half of the left triangle’s.',
                      why: 'Nothing halves between the triangles. Each simply repeats its own base angle, blue with blue.' },
                ],
            },
            {
                ask: 'So the rim corner is a [red-angle] and a [blue-angle] laid side by side. Now count the angles of the whole big triangle.',
                ok: { t: 'A [red-angle], a [blue-angle], and the pair together at the rim — and every triangle’s three angles make 180°.',
                      done: 'The great triangle holds [red-angle] + [blue-angle] + ([red-angle] + [blue-angle]) = 180°.' },
                flash: ['wA', 'wB', 'wCa', 'wCb'],
                no: [
                    { t: 'They make 360°, a full circle.',
                      why: 'That is the count for a square’s corners. A triangle’s three angles always make 180° — Proposition XXXII.' },
                    { t: 'They cannot be counted without their measures.',
                      why: 'No measures needed: Proposition XXXII counts them for every triangle at once — two right angles in all.' },
                ],
            },
            {
                ask: 'Twice the [red-angle] and twice the [blue-angle] make 180°. Then the corner at the rim — one [red-angle] with one [blue-angle] — is…',
                ok: { t: 'Exactly half: 90°, a right angle — wherever on the rim the corner may stand.',
                      done: 'Therefore the angle in the semicircle is a right angle. Q.E.D.' },
                flash: ['wCa', 'wCb'],
                no: [
                    { t: 'A little more than 90°, for it sits high on the rim.',
                      why: 'Height has no vote. Halve the equation and 90° is forced — exactly.' },
                    { t: 'It depends on where the corner sits on the rim.',
                      why: 'That is the wonder: move the corner anywhere on the rim, and the same three radii repeat the same proof. Always right.' },
                ],
            },
        ],
    },
    ];

    // The rest of Book I. These use the named-point format (P + p/q/at/thru/
    // from/to references) so all wedge angles and radii are computed.
    const MORE_PROPS = [
    {
        id: 'i2', ref: 'Book I. Proposition II.',
        title: 'To carry a length to a point',
        enun: 'From a given point, to draw a straight line equal to a given straight line.',
        view: '8 -110 456 452',
        P: { A: [150, 120], B: [200, 190], C: [320, 240], D: [235.6, 111.7], G: [146.2, 308.3], L: [20.6, 132.5] },
        shapes: [
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'dA', t: 'dot', at: 'A', r: 5.5, c: 'black', s: 0 },
            { id: 'dB', t: 'dot', at: 'B', r: 5, c: 'black', s: 0 },
            { id: 'dC', t: 'dot', at: 'C', r: 5, c: 'black', s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'yellow', w: 4.5, s: 1 },
            { id: 'da', t: 'line', p: 'D', q: 'A', c: 'black', w: 3, s: 2 },
            { id: 'db', t: 'line', p: 'D', q: 'B', c: 'black', w: 3, s: 2 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 2 },
            { id: 'cB', t: 'circle', at: 'B', thru: 'C', c: 'red', w: 3.5, s: 3 },
            { id: 'bg', t: 'line', p: 'B', q: 'G', c: 'black', w: 3, dash: 1, s: 3 },
            { id: 'dG', t: 'dot', at: 'G', r: 5, c: 'black', s: 3 },
            { id: 'cD', t: 'circle', at: 'D', thru: 'G', c: 'blue', w: 3.5, s: 4 },
            { id: 'al', t: 'line', p: 'A', q: 'L', c: 'red', w: 5, s: 4 },
            { id: 'dL', t: 'dot', at: 'L', r: 5, c: 'black', s: 4 },
        ],
        steps: [
            {
                ask: 'We must give the lonely point its own copy of the [black-line]. Why not just span the line with the compass and walk it over?',
                ok: { t: 'Euclid’s compass collapses when it leaves the page — it carries nothing. The carrying must be built. First, join the point to one end of the line.',
                      done: 'The point is joined to one end of the [black-line] by the [yellow-line].' },
                no: [
                    { t: 'Do exactly that — lift the compass and swing it at the point.',
                      why: 'Not with Euclid’s instrument: his compass keeps its span only while its foot is planted. Lifted, it forgets. Proposition II exists to earn that power honestly.' },
                    { t: 'Measure the line with a ruler and copy the number.',
                      why: 'There are no numbers in Euclid — only lengths compared with lengths. The copy must be built by construction.' },
                ],
            },
            {
                ask: 'Now the borrowed trick — Proposition I. What do we build on the [yellow-line]?',
                ok: { t: 'An equilateral triangle: its peak now holds two perfectly equal ledges, one reaching to the point, one to the line’s end.',
                      done: 'An equilateral triangle stands on the [yellow-line]; its peak holds two equal ledges.' },
                no: [
                    { t: 'A square — four equal sides are better than three.',
                      why: 'We cannot build a square yet (that waits for Proposition XLVI). The triangle of Proposition I is the only earned tool.' },
                    { t: 'A second point, on the other side.',
                      why: 'Another lonely point helps no one. We need equal ledges from a single peak — the equilateral triangle provides them.' },
                ],
            },
            {
                ask: 'From the peak, one ledge runs down to the line’s end. Stretch that ledge onward and sweep a [red-circle] about the line’s end, through the line’s far end. What has the circle done?',
                ok: { t: 'It has laid the [black-line]’s length onto the stretched ledge: from the peak to the circle’s rim now measures ledge + line.',
                      done: 'A [red-circle] about the near end adds the [black-line]’s length to the stretched ledge.' },
                no: [
                    { t: 'It has moved the line to the point already.',
                      why: 'Not yet — the length now hangs from the wrong ledge. One more circle will swing it across to the other.' },
                    { t: 'Nothing — the circle only decorates the line.',
                      why: 'Look at where the stretched ledge meets the rim: that meeting point is the line’s length, banked onto the ledge.' },
                ],
            },
            {
                ask: 'Now the [blue-circle], swept about the peak through that banked point, cutting the other stretched ledge. Why does this finish it?',
                ok: { t: 'Both ledges are equal, and both reaches from the peak are equal radii — take the ledges away, and what remains at the point equals the [black-line] exactly.',
                      done: 'Equal radii minus equal ledges: the [red-line] at the point equals the [black-line]. Q.E.D.' },
                flash: ['al', 'bc'],
                no: [
                    { t: 'Because the blue circle is bigger than the red one.',
                      why: 'Bigger is not the reason — the reason is subtraction: equal wholes minus equal parts leave equal remainders.' },
                    { t: 'Because the two circles touch each other.',
                      why: 'Whether they touch is an accident of the picture. The proof lives in the two equal ledges and the two equal radii.' },
                ],
            },
        ],
        build: {
            seed: { segs: [[[200, 190], [320, 240]]], pts: [[150, 120]] },
            targets: [
                { t: 'seg', x1: 150, y1: 120, x2: 200, y2: 190, ink: 'yellow',
                  instr: 'The lonely point must receive a copy of the [black-line]. First, join the point to the line’s nearer end.',
                  miss: 'Draw from the floating point to the nearer end of the given line.' },
                { t: 'circle', cx: 150, cy: 120, r: 86.02, ink: 'black',
                  instr: 'Begin an equilateral triangle upon that join (Prop. I): sweep a circle about the point, through the line’s near end.',
                  miss: 'Press on the floating point and drag to the near end of the line — the join is the radius.' },
                { t: 'circle', cx: 200, cy: 190, r: 86.02, ink: 'black',
                  instr: 'And its twin: an equal circle about the near end, back through the point.',
                  miss: 'The twin circle sits on the line’s near end and passes exactly through the floating point.' },
                { t: 'seg', x1: 235.6, y1: 111.7, x2: 200, y2: 190, ink: 'black',
                  instr: 'Join the upper crossing of the circles — the peak — down to the line’s near end.',
                  miss: 'Draw from the upper crossing of the two circles to the near end of the given line.' },
                { t: 'seg', from: [200, 190], dir: [-0.4139, 0.9103], minLen: 131, ink: 'black',
                  instr: 'Produce that ledge onward, well out past the end.',
                  miss: 'Drag out of the line’s near end, straight on along the ledge — a good long way.' },
                { t: 'seg', x1: 235.6, y1: 111.7, x2: 150, y2: 120, ink: 'black',
                  instr: 'Join the peak to the lonely point likewise.',
                  miss: 'Draw from the peak to the floating point — the second ledge.' },
                { t: 'seg', from: [150, 120], dir: [-0.9953, 0.0965], minLen: 131, ink: 'black',
                  instr: 'And produce this ledge too, far out beyond the point.',
                  miss: 'Drag out of the floating point, straight on along the second ledge, well past it.' },
                { t: 'circle', cx: 200, cy: 190, r: 130, ink: 'red',
                  instr: 'Sweep a [red-circle] about the line’s near end, through its far end — banking the line’s length onto the produced ledge.',
                  miss: 'Press on the near end and drag to the far end of the given line.' },
                { t: 'circle', cx: 235.6, cy: 111.7, r: 216.02, ink: 'blue',
                  instr: 'Last: a [blue-circle] about the peak, through the point where the [red-circle] cut the ledge.',
                  miss: 'Press on the peak and drag to the red circle’s crossing on the produced ledge below.' },
            ],
            qed: 'Where the blue circle cuts the other ledge, the piece beyond the point equals the given line: the length has been carried — and the compass is hereby uncollapsed.',
        },
    },
    {
        id: 'i3', ref: 'Book I. Proposition III.',
        title: 'To cut off a lesser from a greater',
        enun: 'Given two unequal straight lines, to cut off from the greater a part equal to the lesser.',
        view: '-30 60 470 250',
        P: { A: [60, 200], B: [400, 200], M: [280, 80], N: [348, 128], D: [101.6, 128], E: [143.2, 200] },
        shapes: [
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 5, s: 0 },
            { id: 'mn', t: 'line', p: 'M', q: 'N', c: 'blue', w: 5, s: 0 },
            { id: 'dA', t: 'dot', at: 'A', r: 5, c: 'black', s: 0 },
            { id: 'dB', t: 'dot', at: 'B', r: 5, c: 'black', s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'blue', w: 5, s: 1 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'cA', t: 'circle', at: 'A', thru: 'D', c: 'yellow', w: 3.5, s: 2 },
            { id: 'dE', t: 'dot', at: 'E', r: 5, c: 'black', s: 2 },
            { id: 'ae', t: 'line', p: 'A', q: 'E', c: 'red', w: 6, s: 3 },
        ],
        steps: [
            {
                ask: 'The [black-line] is long, the [blue-line] short. We must trim a piece of the long one exactly as long as the short one. First?',
                ok: { t: 'Plant a copy of the [blue-line] at the long line’s end — Proposition II just taught us to carry lengths.',
                      done: 'By Proposition II, a copy of the [blue-line] is planted at the end of the [black-line].' },
                no: [
                    { t: 'Slide the short line down until it lies along the long one.',
                      why: 'Sliding is not a construction — Proposition II is how a length travels honestly, and we use it.' },
                    { t: 'Mark off the short line’s length by eye.',
                      why: 'The eye is generous by a hair or stingy by a hair. Circles are neither.' },
                ],
            },
            {
                ask: 'The copy hangs at the end, but points the wrong way. How do we swing it onto the [black-line]?',
                ok: { t: 'A [yellow-circle] about the shared end, through the copy’s tip — every radius is the same, so where it cuts the [black-line] is that same length along it.',
                      done: 'A [yellow-circle] swings the copied length down onto the [black-line].' },
                no: [
                    { t: 'Bend the copy until it lies along the line.',
                      why: 'Straight lines do not bend. But a circle swings a length in any direction without changing it a whit.' },
                    { t: 'Draw a line between the two tips.',
                      why: 'That would make a triangle, not a cut. The circle is what carries length around a corner.' },
                ],
            },
            {
                ask: 'The circle cuts the [black-line]. What have we proved about the piece from the end to the cut?',
                ok: { t: 'It is a radius, the copy is a radius, and the copy equals the [blue-line] — so the [red-line] piece equals the [blue-line]: things equal to the same thing.',
                      done: 'The [red-line] cut from the greater equals the [blue-line], being equal to the same radius. Q.E.D.' },
                flash: ['ae', 'mn'],
                no: [
                    { t: 'That it is roughly the right length.',
                      why: 'Exactly, not roughly: two radii of one circle cannot differ by any amount at all.' },
                    { t: 'That the long line is now shorter.',
                      why: 'The long line is untouched — we have only marked where the lesser length ends upon it.' },
                ],
            },
        ],
        build: {
            seed: [[[60, 200], [400, 200]], [[280, 80], [348, 128]]],
            needs: ['carry'],
            targets: [
                { t: 'circle', cx: 60, cy: 200, r: 83.23, ink: 'yellow',
                  instr: 'Sweep a [yellow-circle] about the greater line’s left end, with the lesser line’s own length — the Carry instrument holds the compass open at it.',
                  miss: 'Press on the greater line’s left end and grow the circle until it sticks at the small line’s length (the small line pulses when it does).' },
            ],
            qed: 'From the end to the crossing is exactly the lesser line: the greater is cut. Prop. II’s gift, spent in a single stroke.',
        },
    },
    {
        id: 'i4', ref: 'Book I. Proposition IV.',
        title: 'Side, angle, side',
        enun: 'If two triangles have two sides equal to two sides, and the angles between those sides equal, the triangles are equal in every way.',
        view: '30 55 440 205',
        P: { A: [120, 90], B: [60, 220], C: [230, 220], D: [330, 90], E: [270, 220], F: [440, 220] },
        shapes: [
            { id: 'wA', t: 'wedge', at: 'A', from: 'B', to: 'C', r: 34, c: 'yellow', s: 0, z: 0 },
            { id: 'wD', t: 'wedge', at: 'D', from: 'E', to: 'F', r: 34, c: 'yellow', s: 0, z: 0 },
            { id: 'wB', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 26, c: 'red', s: 4, z: 0 },
            { id: 'wE', t: 'wedge', at: 'E', from: 'D', to: 'F', r: 26, c: 'red', s: 4, z: 0 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'B', to: 'A', r: 26, c: 'blue', s: 4, z: 0 },
            { id: 'wF', t: 'wedge', at: 'F', from: 'E', to: 'D', r: 26, c: 'blue', s: 4, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'red', w: 5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'blue', w: 5, s: 0 },
            { id: 'ef', t: 'line', p: 'E', q: 'F', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Two triangles: [red-line] equals [red-line], [blue-line] equals [blue-line], and the [yellow-angle] between them equals its twin. Euclid’s boldest move — what is it?',
                ok: { t: 'Pick the first triangle up and lay it upon the second: point upon point, the [yellow-angle] fitted onto its twin.',
                      done: 'The first triangle is applied to the second, [yellow-angle] upon [yellow-angle].' },
                no: [
                    { t: 'Measure all six sides and compare the numbers.',
                      why: 'No numbers, and no need: three matched pieces will drag everything else into place.' },
                    { t: 'Slide it across the page without turning it.',
                      why: 'Turning is allowed! Any rigid carrying — slide, turn, or flip — keeps every length and angle. What matters is where it lands.' },
                ],
            },
            {
                ask: 'The [yellow-angle]s coincide, so the [red-line] lies along its twin. Where does its far end land?',
                ok: { t: 'Exactly on the twin’s far end — equal lengths laid along the same ray must end together.',
                      done: 'The [red-line] falls upon its equal: their far ends coincide.' },
                flash: ['ab', 'de'],
                no: [
                    { t: 'A little short — copies always lose something.',
                      why: 'Rigid placement loses nothing. Equal lines on the same ray end at the same point, exactly.' },
                    { t: 'Somewhere on the twin, but where cannot be said.',
                      why: 'It can: the lines are equal and share a starting point and direction. There is only one place to end.' },
                ],
            },
            {
                ask: 'By the same token the [blue-line] falls upon its twin. Two corners of the laid triangle now sit upon two corners of the other. What of the bases between them?',
                ok: { t: 'They must coincide too — between two points there is only one straight line.',
                      done: 'The [blue-line] falls upon its equal; the bases, joining the same two points, coincide.' },
                flash: ['ac', 'df'],
                no: [
                    { t: 'The bases could bow apart and meet again.',
                      why: 'Then two straight lines would enclose a space — which straight lines can never do.' },
                    { t: 'The bases are equal only if the triangles were right-angled.',
                      why: 'No right angle needed: the bases join the same two points, and one straight line joins two points.' },
                ],
            },
            {
                ask: 'The triangles coincide completely. What may we now harvest?',
                ok: { t: 'Everything: base equals base, the [red-angle]s match, the [blue-angle]s match, and the areas are the same. Side-angle-side seals a triangle whole.',
                      done: 'Bases equal, remaining angles equal, areas equal: the triangles are equal in every respect. Q.E.D.' },
                flash: ['bc', 'ef'],
                no: [
                    { t: 'Only the sides — the angles might still differ.',
                      why: 'Coinciding triangles share every part. Nothing is left over to differ.' },
                    { t: 'Only what we were given at the start.',
                      why: 'The whole point is the harvest: three given equalities have bought us all six, and the area besides.' },
                ],
            },
        ],
    },
    {
        id: 'i6', ref: 'Book I. Proposition VI.',
        title: 'Equal angles, equal sides',
        enun: 'If two angles of a triangle are equal, the sides which face them are also equal.',
        view: '100 40 240 240',
        P: { A: [220, 70], B: [140, 250], C: [300, 250], D: [170.4, 181.6] },
        shapes: [
            { id: 'wB', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 34, c: 'red', s: 0, z: 0 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'B', to: 'A', r: 34, c: 'red', s: 0, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'yellow', w: 4, dash: 1, s: 1 },
        ],
        steps: [
            {
                ask: 'The two base angles are equal (both marked red), and we must show the two slanting sides are equal too — Proposition V turned backwards. How does Euclid corner such a claim?',
                ok: { t: 'Suppose it false: then one side is longer. Cut the longer down to the shorter’s length (Prop. III) and join the cut to the far corner.',
                      done: 'Suppose one side longer: a piece equal to the shorter is cut from it, and joined across.' },
                no: [
                    { t: 'Flip the triangle over, as in Proposition V.',
                      why: 'A fine instinct — but this time the flip needs the sides equal to get started, which is the very thing in question. Euclid works by contradiction instead.' },
                    { t: 'Measure both sides to settle it at once.',
                      why: 'Measuring settles one triangle, roughly. The contradiction will settle every triangle, exactly.' },
                ],
            },
            {
                ask: 'Now compare the little clipped triangle with the whole one. What do they share?',
                ok: { t: 'Clipped side = whole’s short side (by the cut), the base is common, and the angles between them are the given equal pair — side-angle-side (Prop. IV): the triangles are equal.',
                      done: 'By side-angle-side, the clipped triangle equals the whole triangle.' },
                flash: ['dc', 'bc'],
                no: [
                    { t: 'Nothing useful — one is inside the other.',
                      why: 'That nesting is the trap being set! First match them piece for piece: cut side, common base, equal angle — Prop. IV bites.' },
                    { t: 'They share three equal angles.',
                      why: 'We know of one equal angle pair, plus two matched sides. That is Prop. IV’s toll, and it is paid.' },
                ],
            },
            {
                ask: 'The clipped triangle equals the whole triangle. But the clipped one sits wholly inside the other. So?',
                ok: { t: 'The part would equal the whole — absurd. The supposition dies: neither side is longer, and the sides are equal.',
                      done: 'The part cannot equal the whole: therefore the sides facing the equal angles are equal. Q.E.D.' },
                no: [
                    { t: 'So the clipped triangle was drawn wrongly.',
                      why: 'It was drawn perfectly — from a false assumption. When sound steps land in absurdity, it is the assumption that was rotten.' },
                    { t: 'So parts sometimes equal wholes after all.',
                      why: 'Never — that a whole exceeds its part is a common notion, bedrock of the whole book.' },
                ],
            },
        ],
    },
    {
        id: 'i7', ref: 'Book I. Proposition VII.',
        title: 'One peak only',
        enun: 'On the same base, on the same side, there cannot be two different points whose distances to the base’s ends are pairwise equal.',
        view: '80 60 300 230',
        P: { A: [120, 250], B: [340, 250], C: [210, 90], D: [280, 160] },
        shapes: [
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'red', w: 5, s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'red', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bd', t: 'line', p: 'B', q: 'D', c: 'blue', w: 5, s: 0 },
            { id: 'cd', t: 'line', p: 'C', q: 'D', c: 'yellow', w: 4, dash: 1, s: 1 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'D', to: 'A', r: 30, c: 'yellow', s: 2, z: 0 },
            { id: 'wD', t: 'wedge', at: 'D', from: 'C', to: 'A', r: 30, c: 'yellow', s: 2, z: 0 },
        ],
        steps: [
            {
                ask: 'Two peaks claim the same berth: each hangs from the left end by an equal [red-line] cord, and from the right end by an equal [blue-line] cord. (The picture must cheat — that is the point.) First move?',
                ok: { t: 'Join the two pretender peaks with the [yellow-line], and let the cords argue.',
                      done: 'The two peaks are joined; two isosceles triangles now stand on that joint.' },
                no: [
                    { t: 'Erase the uglier peak and be done.',
                      why: 'Tempting — but a proof must show the second peak impossible, not merely unwanted.' },
                    { t: 'Drop a perpendicular from each peak.',
                      why: 'Perpendiculars tell heights, and height is not the issue. The cords themselves carry the contradiction.' },
                ],
            },
            {
                ask: 'The two red cords are equal, so the peaks and the left end make an isosceles triangle. What does Proposition V say at the joint?',
                ok: { t: 'The two angles under the [yellow-line] are equal. But one of them tucks wholly inside the other peak’s corner — so of the pair of corners on the joint, one is both equal to and greater than a matching angle.',
                      done: 'By Prop. V the joint angles are equal — yet one lies inside the other’s corner: equal, and lesser, at once.' },
                flash: ['wC', 'wD'],
                no: [
                    { t: 'That the yellow joint is level with the base.',
                      why: 'Its slant is irrelevant. What Prop. V grants is equal angles at its two ends — and that is what explodes.' },
                    { t: 'That the red cords must also equal the blue cords.',
                      why: 'Red and blue need not match each other — each colour only matches itself. The clash comes from the angles.' },
                ],
            },
            {
                ask: 'Run the same argument from the right end with the blue cords, and the same angles are squeezed the opposite way. What is the verdict?',
                ok: { t: 'An angle cannot be both equal to and less than another. The second peak was a phantom: on one side of a base, matching cords fix a single point.',
                      done: 'Both readings cannot stand: two such peaks are impossible. Q.E.D.' },
                no: [
                    { t: 'The two peaks quietly merge into one.',
                      why: 'They never existed apart — that is the finding. Distinct peaks with matching cords contradict themselves.' },
                    { t: 'The base was too short for two peaks.',
                      why: 'No base is long enough: the contradiction uses no lengths at all, only Prop. V and an angle inside an angle.' },
                ],
            },
        ],
    },
    {
        id: 'i8', ref: 'Book I. Proposition VIII.',
        title: 'Side, side, side',
        enun: 'If two triangles have all three sides equal, side for side, their angles are equal too.',
        view: '30 55 440 205',
        P: { A: [110, 90], B: [60, 220], C: [230, 220], D: [320, 90], E: [270, 220], F: [440, 220] },
        shapes: [
            { id: 'wA', t: 'wedge', at: 'A', from: 'B', to: 'C', r: 30, c: 'yellow', s: 3, z: 0 },
            { id: 'wD', t: 'wedge', at: 'D', from: 'E', to: 'F', r: 30, c: 'yellow', s: 3, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'red', w: 5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'blue', w: 5, s: 0 },
            { id: 'ef', t: 'line', p: 'E', q: 'F', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Two triangles, all three sides matched: red with red, blue with blue, base with base. How do we begin?',
                ok: { t: 'Lay base upon base — they are equal, so the ends coincide, and the two peaks hang over the same berth.',
                      done: 'Base is applied to base; the two peaks now hang over one and the same base.' },
                no: [
                    { t: 'Lay peak upon peak first.',
                      why: 'The peaks are single points with no length to match by. The equal bases give a firm two-point anchor.' },
                    { t: 'Check one pair of angles before anything else.',
                      why: 'No angle is given! Sides are all we have — which is exactly what makes this proposition worth proving.' },
                ],
            },
            {
                ask: 'The laid triangle’s peak hangs from the base’s ends by a [red-line] and a [blue-line] — the same lengths that hold the other peak. Could the two peaks sit at different spots?',
                ok: { t: 'Never — Proposition VII forbade two different points on one side of a base with pairwise equal cords. The peaks coincide.',
                      done: 'By Prop. VII the peaks cannot differ: they coincide, and the triangles lie point for point.' },
                no: [
                    { t: 'They could, if one triangle were flipped.',
                      why: 'Flip it, then — rigid carrying allows it, and once flipped to the same side, Prop. VII closes every loophole.' },
                    { t: 'Only if the triangles are small enough.',
                      why: 'Prop. VII never mentioned size. One base, one side, matching cords: one point. Always.' },
                ],
            },
            {
                ask: 'The triangles coincide entirely. What was the prize we were after?',
                ok: { t: 'The angles: every corner lands on its twin, so all three angle pairs are equal. Three sides alone lock a triangle’s shape.',
                      done: 'The coinciding triangles have all angles equal: side-side-side is proved. Q.E.D.' },
                flash: ['wA', 'wD'],
                no: [
                    { t: 'The areas — angles were never in question.',
                      why: 'The enunciation asks for the angles! (The areas come along free, as with all coinciding figures.)' },
                    { t: 'A fourth equal side.',
                      why: 'Triangles are stubbornly three-sided. The harvest is the three pairs of equal angles.' },
                ],
            },
        ],
    },
    {
        id: 'i12', ref: 'Book I. Proposition XII.',
        title: 'To drop a perpendicular',
        enun: 'From a point above a straight line, to let fall a line meeting it at right angles.',
        view: '40 -108 400 404',
        P: { C: [240, 90], L1: [60, 260], L2: [420, 260], D: [155.15, 260], E: [324.85, 260], F: [240, 260] },
        shapes: [
            { id: 'wL', t: 'wedge', at: 'F', from: 'D', to: 'C', r: 36, c: 'red', s: 4, z: 0 },
            { id: 'wR', t: 'wedge', at: 'F', from: 'C', to: 'E', r: 36, c: 'blue', s: 4, z: 0 },
            { id: 'base', t: 'line', p: 'L1', q: 'L2', c: 'black', w: 4.5, s: 0 },
            { id: 'dC', t: 'dot', at: 'C', r: 5.5, c: 'black', s: 0 },
            { id: 'cC', t: 'circle', at: 'C', thru: 'D', c: 'red', w: 3.5, s: 1 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'dE', t: 'dot', at: 'E', r: 5, c: 'black', s: 1 },
            { id: 'cd', t: 'line', p: 'C', q: 'D', c: 'blue', w: 4, s: 2 },
            { id: 'ce', t: 'line', p: 'C', q: 'E', c: 'blue', w: 4, s: 2 },
            { id: 'dF', t: 'dot', at: 'F', r: 5, c: 'black', s: 3 },
            { id: 'cf', t: 'line', p: 'C', q: 'F', c: 'yellow', w: 5, s: 3 },
        ],
        steps: [
            {
                ask: 'A point hangs above the line, and we must drop a line from it that lands perfectly square. First?',
                ok: { t: 'Sweep a [red-circle] about the point, wide enough to cut the line twice — the point now owns two equal footholds on the line.',
                      done: 'A [red-circle] about the point cuts the line at two equally distant footholds.' },
                no: [
                    { t: 'Drop a line straight down from the point.',
                      why: 'Euclid’s page knows no “down” — only relations. Square to the line must be built out of equal distances.' },
                    { t: 'Join the point to the spot on the line that looks nearest.',
                      why: 'The nearest spot is exactly what we are trying to find — it cannot be assumed by eye.' },
                ],
            },
            {
                ask: 'Two footholds, equally far from the point. What do we draw to see the balance?',
                ok: { t: 'Join the point to both footholds — two equal cords, for both are radii of the [red-circle].',
                      done: 'The point is joined to both footholds by equal [blue-line] cords.' },
                no: [
                    { t: 'Join the two footholds to each other.',
                      why: 'They already lie on the given line — that joins nothing new. The cords from the point are what carry the equality.' },
                    { t: 'Sweep a second, wider circle.',
                      why: 'One circle has done its work. Now the cords must bring its equality down to the line.' },
                ],
            },
            {
                ask: 'Now bisect the stretch between the footholds (Prop. X) and join the point to that middle. Why is this the drop we wanted?',
                ok: { t: 'Wait for the angles: first note the two half-triangles agree — cord equals cord, half equals half, and the [yellow-line] is common to both.',
                      done: 'The foothold-stretch is bisected; the [yellow-line] joins the point to the middle, making two triangles with three equal sides each.' },
                no: [
                    { t: 'Because the middle is the closest point of the line.',
                      why: 'True in the end — but closeness is a conclusion, not a reason. The reason is the matching of the two half-triangles.' },
                    { t: 'Because the yellow line looks upright.',
                      why: 'Byrne never trusts looks. Three matched sides will do what looking cannot.' },
                ],
            },
            {
                ask: 'Side, side, side (Prop. VIII): the two half-triangles are equal. What follows at the landing point?',
                ok: { t: 'The [red-angle] equals the [blue-angle] — and equal neighbours on a straight line are right angles (Def. 10). The perpendicular has landed.',
                      done: 'The angles at the foot are equal, therefore right: the perpendicular is let fall. Q.E.D.' },
                flash: ['wL', 'wR'],
                no: [
                    { t: 'The two footholds become one.',
                      why: 'They stay put — their work is done. It is the two angles at the middle that merge in size.' },
                    { t: 'The point is pulled down onto the line.',
                      why: 'The point never moves. What we have built is the one line from it that meets the line squarely.' },
                ],
            },
        ],
        build: {
            seed: { segs: [[[60, 260], [420, 260]]], pts: [[200, 90]] },
            targets: [
                { t: 'circle', cx: 200, cy: 90, r: 220.23, ink: 'red',
                  instr: 'Sweep a [red-circle] about the floating point, through the line’s left end — wide enough to cut the line twice.',
                  miss: 'Press on the floating point and drag to the line’s left end; the circle will cut the line at a second foothold too.' },
                { t: 'circle', cx: 60, cy: 260, r: 280, ink: 'blue',
                  instr: 'Now bisect the two footholds the old way: a [blue-circle] about the left one, through the right.',
                  miss: 'Press on the left foothold and drag to the right foothold — the whole stretch is the radius.' },
                { t: 'circle', cx: 340, cy: 260, r: 280, ink: 'blue',
                  instr: 'And its twin about the right foothold, back through the left.',
                  miss: 'The twin circle sits on the right foothold and passes exactly through the left one.' },
                { t: 'seg', x1: 200, y1: 17.51, x2: 200, y2: 90, ink: 'yellow',
                  instr: 'Join the blue circles’ crossing above to the floating point.',
                  miss: 'Draw from the crossing of the two blue circles, above the line, down to the floating point.' },
                { t: 'seg', from: [200, 90], dir: [0, 1], minLen: 180, ink: 'yellow',
                  instr: 'Produce it downward, straight on through the line.',
                  miss: 'Drag out of the floating point, straight on down, until you are well past the line.' },
            ],
            qed: 'It falls square upon the line: the perpendicular is let fall, and where it lands is the point’s nearest ground.',
        },
    },
    {
        id: 'i13', ref: 'Book I. Proposition XIII.',
        title: 'Angles on a straight line',
        enun: 'When one straight line stands upon another, the two angles it makes together equal two right angles.',
        view: '40 60 400 220',
        P: { L: [60, 240], R: [420, 240], O: [240, 240], T: [320, 100], Pp: [240, 100] },
        shapes: [
            { id: 'wRd', t: 'wedge', at: 'O', from: 'L', to: 'T', r: 46, c: 'red', s: 0, z: 0 },
            { id: 'wBl', t: 'wedge', at: 'O', from: 'T', to: 'R', r: 46, c: 'blue', s: 0, z: 0 },
            { id: 'base', t: 'line', p: 'L', q: 'R', c: 'black', w: 4.5, s: 0 },
            { id: 'ray', t: 'line', p: 'O', q: 'T', c: 'black', w: 4.5, s: 0 },
            { id: 'perp', t: 'line', p: 'O', q: 'Pp', c: 'black', w: 3, dash: 1, s: 2 },
        ],
        steps: [
            {
                ask: 'A ray stands on a straight line, making a [red-angle] and a [blue-angle]. If it happened to stand perfectly square, what would the pair be worth?',
                ok: { t: 'Two right angles exactly — each one right, by the very definition of standing square (Def. 10).',
                      done: 'Were the ray square, the two angles would be two right angles by definition.' },
                no: [
                    { t: 'It would depend on the length of the ray.',
                      why: 'Angles never care how long their arms are — an angle is an opening, not a reach.' },
                    { t: 'One right angle, shared between them.',
                      why: 'Each side of a square-standing ray holds a full right angle — two in all.' },
                ],
            },
            {
                ask: 'But our ray leans. Euclid raises the true perpendicular at the same foot (Prop. XI), as a measuring rod. What does it show?',
                ok: { t: 'It splits the [red-angle] into two parts — and regrouped against the perpendicular, red-plus-blue makes right-plus-right, just rearranged.',
                      done: 'Against the raised perpendicular, the [red-angle] and [blue-angle] regroup into two right angles.' },
                no: [
                    { t: 'That the leaning ray was drawn in error.',
                      why: 'The ray may lean as it pleases — the perpendicular is scaffolding for counting, not a correction.' },
                    { t: 'That the blue angle equals half a right angle.',
                      why: 'The blue angle can be anything at all; only the sum is pinned. The pieces move, the total holds.' },
                ],
            },
            {
                ask: 'The pieces moved, the total held. State the theorem.',
                ok: { t: 'Any ray standing on a straight line makes two angles that together equal two right angles — 180°, tilt it as you will.',
                      done: 'The [red-angle] and [blue-angle] together equal two right angles. Q.E.D.' },
                flash: ['wRd', 'wBl'],
                no: [
                    { t: 'Two angles on a line are each 90°.',
                      why: 'Only for a square-standing ray. In general they trade between themselves — the sum alone is fixed.' },
                    { t: 'The angles total two right angles only above the line.',
                      why: 'Below the line waits an identical pair with the identical sum — the theorem plays on both sides.' },
                ],
            },
        ],
    },
    {
        id: 'i14', ref: 'Book I. Proposition XIV.',
        title: 'The straight line, certified',
        enun: 'If two angles at a point on a line together equal two right angles, their outer arms form one straight line.',
        view: '40 60 410 220',
        P: { A: [60, 240], O: [240, 240], C: [320, 100], E: [420, 240], B: [430, 180] },
        shapes: [
            { id: 'wRd', t: 'wedge', at: 'O', from: 'A', to: 'C', r: 46, c: 'red', s: 0, z: 0 },
            { id: 'wBl', t: 'wedge', at: 'O', from: 'C', to: 'E', r: 46, c: 'blue', s: 2, z: 0 },
            { id: 'oa', t: 'line', p: 'O', q: 'A', c: 'black', w: 4.5, s: 0 },
            { id: 'oc', t: 'line', p: 'O', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'ob', t: 'line', p: 'O', q: 'B', c: 'black', w: 3, dash: 1, s: 1 },
            { id: 'oe', t: 'line', p: 'O', q: 'E', c: 'black', w: 4.5, s: 2 },
        ],
        steps: [
            {
                ask: 'Two angles at the foot are promised to total two right angles, and we claim their outer arms lie in one straight line. How does the proof begin?',
                ok: { t: 'Suppose not: some pretender ray (dashed) claims to be the true continuation instead.',
                      done: 'Suppose the arm is not the continuation: a pretender ray claims the honour.' },
                no: [
                    { t: 'Hold a straightedge against the two arms.',
                      why: 'The straightedge draws lines; it does not certify them. Certification comes from the angle-sum.' },
                    { t: 'Accept it — it certainly looks straight.',
                      why: 'Byrne’s inks are honest, but proofs may not lean on looks. Suppose it false and watch the collapse.' },
                ],
            },
            {
                ask: 'Draw the true continuation. Against it, Proposition XIII counts the angles. What does the count force?',
                ok: { t: 'Red plus its true neighbour is two rights (Prop. XIII); red plus [blue-angle] was given as two rights — so the neighbour equals the [blue-angle] exactly.',
                      done: 'Both sums are two right angles: the true neighbour equals the given [blue-angle].' },
                flash: ['wRd', 'wBl'],
                no: [
                    { t: 'The pretender to bend until the sums agree.',
                      why: 'Straight lines do not bend to oblige. It is the equations that move, and they move against the pretender.' },
                    { t: 'The red angle to be a right angle.',
                      why: 'Red may be any size — both sums contain it equally, so it cancels from the argument entirely.' },
                ],
            },
            {
                ask: 'The angle to the true continuation equals the angle to the given arm, on the same side. What becomes of the pretender?',
                ok: { t: 'A lesser angle cannot equal a greater: the given arm and the true continuation must be the same ray. The line is certified straight.',
                      done: 'The given arm coincides with the true continuation: one straight line. Q.E.D.' },
                no: [
                    { t: 'The pretender remains as a spare.',
                      why: 'No spares: an angle equal to the blue one, on the same side, is the blue arm’s ray itself. The pretender never existed.' },
                    { t: 'Both rays are continuations at once.',
                      why: 'A straight line has one continuation only — two would make the equal-and-unequal angle absurdity we just refused.' },
                ],
            },
        ],
    },
    {
        id: 'i16', ref: 'Book I. Proposition XVI.',
        title: 'The exterior angle',
        enun: 'When a side of a triangle is stretched out, the outside angle is greater than either of the far-off inside angles.',
        view: '60 60 380 220',
        P: { A: [160, 90], B: [80, 250], C: [300, 250], D: [420, 250], E: [230, 170], F: [380, 90] },
        shapes: [
            { id: 'wExt', t: 'wedge', at: 'C', from: 'A', to: 'D', r: 50, c: 'yellow', s: 1, z: 0 },
            { id: 'wA', t: 'wedge', at: 'A', from: 'B', to: 'C', r: 34, c: 'red', s: 3, z: 0 },
            { id: 'wC2', t: 'wedge', at: 'C', from: 'E', to: 'F', r: 34, c: 'red', s: 3, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'ca', t: 'line', p: 'C', q: 'A', c: 'black', w: 4.5, s: 0 },
            { id: 'ext', t: 'line', p: 'C', q: 'D', c: 'black', w: 4.5, s: 1 },
            { id: 'dE', t: 'dot', at: 'E', r: 5, c: 'black', s: 2 },
            { id: 'bf', t: 'line', p: 'B', q: 'F', c: 'yellow', w: 4, s: 2 },
            { id: 'dF', t: 'dot', at: 'F', r: 5, c: 'black', s: 2 },
        ],
        steps: [
            {
                ask: 'Stretch the base out past the corner: the [yellow-angle] appears outside the triangle. The claim: it beats the far-off inside angles. How to smuggle an inside angle out for comparison?',
                ok: { t: 'Through the midpoint of the slanting side — Euclid is about to build a secret passage.',
                      done: 'The base is produced; the [yellow-angle] stands outside, awaiting comparison.' },
                no: [
                    { t: 'Measure the yellow angle and the far angles.',
                      why: 'Measures prove one triangle. The secret passage will prove them all.' },
                    { t: 'Slide the far angle along the side until it arrives.',
                      why: 'Angles do not slide unescorted — they travel by congruent triangles, as you are about to see.' },
                ],
            },
            {
                ask: 'Bisect the slanting side (Prop. X), then run a line from the far corner through that midpoint, and just as far again beyond. Why the doubling?',
                ok: { t: 'It plants a twin point inside the exterior angle — with two matched arms about the midpoint, ready for a congruence.',
                      done: 'The side is bisected; the [yellow-line] runs to the midpoint and as far again beyond it.' },
                no: [
                    { t: 'To reach the stretched-out base.',
                      why: 'It need not reach the base at all — it needs only to land inside the yellow region, with matching halves behind it.' },
                    { t: 'Doubling makes the drawing symmetrical.',
                      why: 'Not beauty — bookkeeping: equal halves on each side of the midpoint are the makings of Prop. IV.' },
                ],
            },
            {
                ask: 'At the midpoint: half-side equals half-side, half-line equals half-line, and the two angles between them are vertical (Prop. XV). What have we built?',
                ok: { t: 'Side-angle-side (Prop. IV): the little triangles are equal — the far-off [red-angle] is reborn at our corner, inside the [yellow-angle].',
                      done: 'By Props. XV and IV, the far [red-angle] reappears at the corner, wholly inside the [yellow-angle].' },
                flash: ['wA', 'wC2'],
                no: [
                    { t: 'Two triangles that merely look alike.',
                      why: 'Better: two halves and the vertical angles between them — Prop. IV certifies them equal, no looking required.' },
                    { t: 'A parallelogram.',
                      why: 'Parallelograms enter the Elements much later. These are twin triangles, hinged at the midpoint.' },
                ],
            },
            {
                ask: 'The reborn [red-angle] sits inside the [yellow-angle]. Finish it.',
                ok: { t: 'The whole is greater than its part: exterior beats that remote interior. (Stretch the other side, and the same passage defeats the other one.)',
                      done: 'The [yellow-angle] contains a copy of the [red-angle], and so exceeds it. Q.E.D.' },
                flash: ['wExt', 'wC2'],
                no: [
                    { t: 'The red and yellow angles are equal.',
                      why: 'The red copy is a strict part of the yellow — the leftover sliver is exactly its margin of victory.' },
                    { t: 'The exterior beats the adjacent inside angle too.',
                      why: 'Careful — the adjacent one is its partner on a straight line (Prop. XIII); they can even be equal. Only the two far-off angles are always beaten.' },
                ],
            },
        ],
        build: {
            seed: [[[160, 90], [80, 250]], [[80, 250], [300, 250]], [[300, 250], [160, 90]]],
            needs: ['mid'],
            targets: [
                { t: 'seg', from: [300, 250], dir: [1, 0], minLen: 60, ink: 'black',
                  instr: 'Stretch the base out past the far corner — the exterior angle appears there.',
                  miss: 'Drag out of the base’s right end, straight on along it.' },
                { t: 'seg', x1: 80, y1: 250, x2: 230, y2: 170, ink: 'yellow',
                  instr: 'Join the near corner to the midpoint of the slanting side — the Midpoint instrument marks the spot.',
                  miss: 'Draw from the bottom-left corner to the small hollow dot at the middle of the slanting side.' },
                { t: 'circle', cx: 230, cy: 170, r: 170, ink: 'red',
                  instr: 'Sweep a [red-circle] about that midpoint, back through the corner you came from — the doubling gauge.',
                  miss: 'Press on the midpoint and drag back to the bottom-left corner: that reach is the radius.' },
                { t: 'seg', from: [230, 170], dir: [0.8824, -0.4706], minLen: 171, ink: 'yellow',
                  instr: 'Produce the join through the midpoint until it strikes the [red-circle] on the far side.',
                  miss: 'Drag out of the midpoint, straight on along the join, until you have crossed the red circle.' },
            ],
            qed: 'The strike-point doubles the join exactly; the twin triangles match about the midpoint, and the far angle is reborn inside the exterior — which therefore exceeds it (Prop. XVI).',
        },
    },
    {
        id: 'i17', ref: 'Book I. Proposition XVII.',
        title: 'Two angles fall short',
        enun: 'Any two angles of a triangle, taken together, are less than two right angles.',
        view: '60 70 380 220',
        P: { A: [160, 100], B: [80, 260], C: [300, 260], D: [420, 260] },
        shapes: [
            { id: 'wB', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 40, c: 'red', s: 0, z: 0 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'B', to: 'A', r: 40, c: 'blue', s: 0, z: 0 },
            { id: 'wExt', t: 'wedge', at: 'C', from: 'A', to: 'D', r: 40, c: 'yellow', s: 1, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'ca', t: 'line', p: 'C', q: 'A', c: 'black', w: 4.5, s: 0 },
            { id: 'ext', t: 'line', p: 'C', q: 'D', c: 'black', w: 4.5, s: 1 },
        ],
        steps: [
            {
                ask: 'Take the [red-angle] and the [blue-angle]. To weigh them against two right angles, what do we build?',
                ok: { t: 'Stretch the base: the [yellow-angle] appears, and blue-plus-yellow fill a straight line — two right angles on the nose (Prop. XIII).',
                      done: 'The base is produced: the [blue-angle] and [yellow-angle] together make two right angles.' },
                no: [
                    { t: 'A perpendicular from the apex.',
                      why: 'It would split the triangle helpfully for other errands — but the exterior angle is the readier scale.' },
                    { t: 'Nothing — add the red and blue angles directly.',
                      why: 'Added directly they give some amount, unnamed. The straight line gives the amount a benchmark to fall short of.' },
                ],
            },
            {
                ask: 'Blue + yellow = two rights. And Proposition XVI has an opinion about yellow and red. Conclude.',
                ok: { t: 'Yellow beats the far-off red (Prop. XVI) — so red + blue < yellow + blue = two rights. Any pair falls short.',
                      done: 'Since the [yellow-angle] exceeds the [red-angle], red + blue fall short of two right angles. Q.E.D.' },
                flash: ['wB', 'wC', 'wExt'],
                no: [
                    { t: 'Red + blue = two rights exactly.',
                      why: 'Then the yellow exterior would equal the remote red — precisely what Prop. XVI forbids.' },
                    { t: 'It depends which two angles are chosen.',
                      why: 'Stretch a different side and the same argument runs — every pair of the three falls short.' },
                ],
            },
        ],
    },
    {
        id: 'i18', ref: 'Book I. Proposition XVIII.',
        title: 'Greater side, greater angle',
        enun: 'In any triangle, the greater side is faced by the greater angle.',
        view: '70 40 340 260',
        P: { A: [140, 80], B: [100, 260], C: [380, 260], D: [287.5, 190.6] },
        shapes: [
            { id: 'wB1', t: 'wedge', at: 'B', from: 'A', to: 'D', r: 30, c: 'red', s: 2, z: 0 },
            { id: 'wD1', t: 'wedge', at: 'D', from: 'A', to: 'B', r: 30, c: 'red', s: 2, z: 0 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'B', to: 'A', r: 30, c: 'blue', s: 3, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'bd', t: 'line', p: 'B', q: 'D', c: 'yellow', w: 4, dash: 1, s: 1 },
        ],
        steps: [
            {
                ask: 'The [blue-line] side is longer than the [red-line] side; we must show the angle facing blue beats the angle facing red. How is the long side tamed?',
                ok: { t: 'Cut from it a piece equal to the [red-line] (Prop. III) and join the cut point to the opposite corner — a small isosceles triangle is born.',
                      done: 'A piece equal to the [red-line] is cut from the [blue-line]; the cut is joined across.' },
                no: [
                    { t: 'Stretch the red side until the sides are equal.',
                      why: 'Stretching changes the triangle we were asked about. Cutting a marker point changes nothing — it only annotates.' },
                    { t: 'Compare the angles with a protractor.',
                      why: 'For every triangle at once, cut and reason; the protractor only whispers about this one.' },
                ],
            },
            {
                ask: 'The little triangle has two equal sides. What does Proposition V hand us?',
                ok: { t: 'Its two base [red-angle]s are equal — one of them sitting at the cut point, high on the blue side.',
                      done: 'By Prop. V the little triangle’s base angles are equal red twins.' },
                flash: ['wB1', 'wD1'],
                no: [
                    { t: 'That the little triangle is equilateral.',
                      why: 'Only two sides were matched — the joining line came out whatever length it pleased.' },
                    { t: 'That the cut point is the blue side’s midpoint.',
                      why: 'It sits at the red side’s length, not halfway — those coincide only in special triangles.' },
                ],
            },
            {
                ask: 'Now the red twin at the cut point: to the leftover little triangle below it, what is it?',
                ok: { t: 'An exterior angle — so it beats that triangle’s far-off [blue-angle] (Prop. XVI), the very angle facing our red side.',
                      done: 'The red twin, exterior to the leftover triangle, beats the [blue-angle] (Prop. XVI).' },
                flash: ['wD1', 'wC'],
                no: [
                    { t: 'A vertical angle to it.',
                      why: 'Vertical angles need two crossing lines; here a side merely continues past the cut. It is exterior, and Prop. XVI applies.' },
                    { t: 'Its equal, by symmetry.',
                      why: 'No symmetry protects it: exterior beats remote interior — strictly.' },
                ],
            },
            {
                ask: 'Chain it together for the whole triangle.',
                ok: { t: 'The whole angle at the base contains its red twin part, which beats the blue angle: whole > part’s equal > blue. The greater side faces the greater angle.',
                      done: 'The angle facing the [blue-line] contains a part already greater than the [blue-angle]: greater side, greater angle. Q.E.D.' },
                flash: ['wB1', 'wC'],
                no: [
                    { t: 'The two base angles even out in the end.',
                      why: 'They cannot — one contains a part that already outweighs the whole of the other.' },
                    { t: 'The proof works only if the blue side is horizontal.',
                      why: 'Nothing leaned on direction — only cuts, Prop. V, and Prop. XVI. Turn the page freely.' },
                ],
            },
        ],
    },
    {
        id: 'i19', ref: 'Book I. Proposition XIX.',
        title: 'Greater angle, greater side',
        enun: 'In any triangle, the greater angle is faced by the greater side.',
        view: '70 60 300 240',
        P: { A: [180, 90], B: [100, 260], C: [340, 260] },
        shapes: [
            { id: 'wB', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 42, c: 'red', s: 0, z: 0 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'B', to: 'A', r: 30, c: 'blue', s: 0, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'blue', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'red', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'The [red-angle] beats the [blue-angle]; we claim the side facing red beats the side facing blue. Suppose instead the two sides were equal. What breaks?',
                ok: { t: 'Equal sides would make it isosceles, and Prop. V would force the angles equal — but red beats blue. Struck out.',
                      done: 'Equal sides would equalise the angles (Prop. V) — contrary to what is given.' },
                no: [
                    { t: 'Nothing — equal sides could still carry unequal angles.',
                      why: 'Prop. V says otherwise, without exception: equal sides, equal base angles.' },
                    { t: 'The triangle would tip over.',
                      why: 'Triangles are unbothered by gravity. What breaks is Prop. V’s guarantee, not the balance.' },
                ],
            },
            {
                ask: 'Suppose then the side facing red were the lesser. What breaks now?',
                ok: { t: 'Prop. XVIII: the greater side faces the greater angle — so blue’s side being greater would make the [blue-angle] the winner. Worse than before!',
                      done: 'A lesser side facing red would crown blue the greater angle (Prop. XVIII) — contrary again.' },
                no: [
                    { t: 'Nothing breaks; small sides may face big angles.',
                      why: 'Prop. XVIII was proved precisely to forbid that: side order and angle order march together.' },
                    { t: 'Prop. V breaks a second time.',
                      why: 'Prop. V speaks only of equal sides. For unequal ones the sentinel is Prop. XVIII.' },
                ],
            },
            {
                ask: 'Equal is out; lesser is out. Deliver the verdict.',
                ok: { t: 'Only greater remains: the side facing the greater angle is the greater side. Trichotomy leaves no fourth road.',
                      done: 'Neither equal nor less, the side facing the [red-angle] is greater. Q.E.D.' },
                flash: ['ac', 'ab'],
                no: [
                    { t: 'Measure, to be safe.',
                      why: 'There is nothing left to be unsafe about — two of the three possibilities self-destructed.' },
                    { t: 'The sides might be incomparable.',
                      why: 'Two lengths are always comparable: less, equal, or greater. The first two just perished.' },
                ],
            },
        ],
    },
    {
        id: 'i20', ref: 'Book I. Proposition XX.',
        title: 'The triangle inequality',
        enun: 'Any two sides of a triangle, taken together, are greater than the third.',
        view: '80 -25 320 360',
        P: { B: [120, 300], A: [180, 180], C: [320, 300], D: [262.5, 15.1] },
        shapes: [
            { id: 'wD', t: 'wedge', at: 'D', from: 'A', to: 'C', r: 36, c: 'yellow', s: 2, z: 0 },
            { id: 'wC1', t: 'wedge', at: 'C', from: 'A', to: 'D', r: 36, c: 'yellow', s: 2, z: 0 },
            { id: 'ba', t: 'line', p: 'B', q: 'A', c: 'red', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'blue', w: 5, s: 1 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'yellow', w: 4, s: 2 },
        ],
        steps: [
            {
                ask: 'We must show the [red-line] and [blue-line] together outreach the [black-line] base. The two of them meet at a corner — how do we lay them out straight?',
                ok: { t: 'Stretch the [red-line] onward past the corner by exactly the [blue-line]’s length (Prop. III): one straight reach now measures red plus blue.',
                      done: 'The red side is produced by the blue side’s length: one straight line now equals red + blue.' },
                no: [
                    { t: 'Unfold the corner until the two sides lie flat.',
                      why: 'Unfolding would tear the triangle we are studying. Prop. III lets us borrow the length without bending anything.' },
                    { t: 'Walk both routes and see which tires the feet.',
                      why: 'Every dog knows the straight path is shorter, as the proverb ran even in antiquity — but Euclid demands the dog show its working.' },
                ],
            },
            {
                ask: 'Join the stretched tip to the far corner: the tip triangle has two equal blue arms. What does Prop. V place on the joint?',
                ok: { t: 'Equal [yellow-angle]s at its two ends — and the one at the far corner is only a part of that corner’s whole angle.',
                      done: 'By Prop. V, equal yellow angles flank the joint — one of them a mere part of the far corner.' },
                flash: ['wD', 'wC1'],
                no: [
                    { t: 'A right angle at the stretched tip.',
                      why: 'Nothing square was built. What Prop. V grants is a matched pair, not a right angle.' },
                    { t: 'That the joint is parallel to the base.',
                      why: 'Parallels wait for Prop. XXVII. Only the equal pair of angles is on offer, and it suffices.' },
                ],
            },
            {
                ask: 'In the big triangle (base, joint, stretched reach): the whole angle at the far corner beats the yellow angle at the tip. Conclude.',
                ok: { t: 'Greater angle, greater side (Prop. XIX): the stretched reach beats the base — and the reach is red + blue. Two sides beat the third, always.',
                      done: 'By Prop. XIX the straightened red-plus-blue beats the [black-line]: the triangle inequality. Q.E.D.' },
                flash: ['ba', 'ad', 'bc'],
                no: [
                    { t: 'The base beats the reach — it looks shorter.',
                      why: 'Look again at which angle is the whole and which the part: the corner’s whole angle wins, so its facing side wins.' },
                    { t: 'They tie when the triangle is isosceles.',
                      why: 'Never a tie: the whole exceeds its part strictly, so the sum exceeds the third side strictly, in every triangle.' },
                ],
            },
        ],
    },
    {
        id: 'i21', ref: 'Book I. Proposition XXI.',
        title: 'The inside point',
        enun: 'Lines drawn from the base’s ends to a point inside the triangle are shorter than the sides, yet meet at a wider angle.',
        view: '60 50 320 250',
        P: { A: [160, 80], B: [90, 270], C: [350, 270], D: [210, 190], E: [246, 166] },
        shapes: [
            { id: 'wD', t: 'wedge', at: 'D', from: 'B', to: 'C', r: 34, c: 'red', s: 2, z: 0 },
            { id: 'wA', t: 'wedge', at: 'A', from: 'B', to: 'C', r: 34, c: 'blue', s: 2, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bd', t: 'line', p: 'B', q: 'D', c: 'yellow', w: 4.5, s: 0 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'yellow', w: 4.5, s: 0 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'black', w: 3, dash: 1, s: 1 },
            { id: 'dE', t: 'dot', at: 'E', r: 4.5, c: 'black', s: 1 },
        ],
        steps: [
            {
                ask: 'From the base’s ends, two [yellow-line] cords meet at a point tucked inside. To compare them with the sides, Euclid extends one cord until it strikes a side. Then?',
                ok: { t: 'Prop. XX, twice over: in the upper triangle, side-plus-side beats the strike-path; in the lower, strike-path pieces beat the far cord. Chained: the sides beat the cords.',
                      done: 'One cord is produced to strike a side; two doses of Prop. XX chain the sides above the cords.' },
                no: [
                    { t: 'Compare each cord with the side nearest it.',
                      why: 'Nearest is not a relation Euclid can chain. The strike-point makes two triangles, and Prop. XX speaks in each.' },
                    { t: 'The cords are obviously shorter — they are inside.',
                      why: '“Inside” alone proves nothing until the triangle inequality is applied — twice, with the strike-point as the hinge.' },
                ],
            },
            {
                ask: 'Now the angles: the cords’ [red-angle] against the summit’s [blue-angle]. Same strike-point, other weapon?',
                ok: { t: 'Prop. XVI, twice: the red angle is exterior to the lower triangle, beating an angle which is itself exterior above — and that one beats the summit. Shorter cords, wider angle.',
                      done: 'Twice an exterior angle (Prop. XVI): the inside [red-angle] beats the summit’s [blue-angle]. Q.E.D.' },
                flash: ['wD', 'wA'],
                no: [
                    { t: 'Wider angle should mean longer cords, surely.',
                      why: 'That intuition rules single triangles (Prop. XIX). Across nested triangles it inverts — the delight of this proposition.' },
                    { t: 'The angles are equal, being aimed at the same base.',
                      why: 'Aim is nothing, containment is everything: two applications of Prop. XVI leave the inner angle strictly wider.' },
                ],
            },
        ],
    },
    {
        id: 'i22', ref: 'Book I. Proposition XXII.',
        title: 'A triangle from three lines',
        enun: 'To build a triangle whose sides equal three given straight lines — provided any two of them together exceed the third.',
        view: '-16 40 500 372',
        P: { P1: [140, 250], P2: [340, 250], X: [254, 152.5], R1: [140, 60], R2: [340, 60], B1: [60, 100], B2: [210, 100], Y1: [270, 100], Y2: [400, 100] },
        shapes: [
            { id: 'lr', t: 'line', p: 'R1', q: 'R2', c: 'red', w: 5, s: 0 },
            { id: 'lb', t: 'line', p: 'B1', q: 'B2', c: 'blue', w: 5, s: 0 },
            { id: 'ly', t: 'line', p: 'Y1', q: 'Y2', c: 'yellow', w: 5, s: 0 },
            { id: 'base', t: 'line', p: 'P1', q: 'P2', c: 'red', w: 5, s: 1 },
            { id: 'cL', t: 'circle', at: 'P1', thru: 'X', c: 'blue', w: 3.5, s: 2 },
            { id: 'cR', t: 'circle', at: 'P2', thru: 'X', c: 'yellow', w: 3.5, s: 3 },
            { id: 'sL', t: 'line', p: 'P1', q: 'X', c: 'blue', w: 5, s: 3 },
            { id: 'sR', t: 'line', p: 'P2', q: 'X', c: 'yellow', w: 5, s: 3 },
            { id: 'dX', t: 'dot', at: 'X', r: 5, c: 'black', s: 3 },
        ],
        steps: [
            {
                ask: 'Three staves are given: [red-line], [blue-line], [yellow-line]. Before building, Prop. XX posts a warning at the door. What is it?',
                ok: { t: 'Any two must together exceed the third — a triangle’s sides always do, so staves that cannot are hopeless. Ours pass; lay the [red-line] down as base.',
                      done: 'The staves pass Prop. XX’s test; the [red-line] is laid down as the base.' },
                no: [
                    { t: 'The staves must all be different lengths.',
                      why: 'Equal staves are welcome — Prop. I built from three equals. Only the two-beat-one law matters.' },
                    { t: 'The longest stave must be the base.',
                      why: 'Any stave may serve as base; the two-beat-one law is the only doorkeeper.' },
                ],
            },
            {
                ask: 'The [blue-line] must swing from the base’s left end. How does a loose stave’s length arrive there?',
                ok: { t: 'Carried by Prop. II and swept as a [blue-circle]: every point of the rim sits one blue-length from the end.',
                      done: 'A [blue-circle], with the blue stave’s length for radius, is swept about the left end.' },
                no: [
                    { t: 'Lean the blue stave against the base’s end.',
                      why: 'Leaning is not building. Prop. II carries the length; the circle then offers it in every direction at once.' },
                    { t: 'Cut the base down by the blue length.',
                      why: 'The base is a finished side — cutting it would spoil one length to use another.' },
                ],
            },
            {
                ask: 'The [yellow-circle] swings from the right end likewise, and the two rims cross. Why must they cross at all?',
                ok: { t: 'Because two staves together beat the third (the door-test!): each rim reaches past where the other gives out. Join the crossing to both ends — the triangle stands.',
                      done: 'The rims cross — guaranteed by the two-beat-one law — and the crossing, joined down, completes the triangle. Q.E.D.' },
                flash: ['sL', 'sR', 'base'],
                no: [
                    { t: 'Circles that share a page always cross.',
                      why: 'Two circles can sail past each other entirely — unless the triangle inequality forces their rims to overlap, as here.' },
                    { t: 'They cross because the radii are equal.',
                      why: 'These radii are unequal (blue and yellow staves differ). Crossing is owed to the sum beating the base, not to sameness.' },
                ],
            },
        ],
        build: {
            seed: [[[140, 250], [340, 250]], [[60, 80], [210, 80]], [[270, 80], [400, 80]]],
            needs: ['carry'],
            targets: [
                { t: 'circle', cx: 140, cy: 250, r: 150, ink: 'blue',
                  instr: 'The longer loose stave must swing from the base’s left end: sweep a [blue-circle] there with that stave’s length — Carry holds the compass open at it.',
                  miss: 'Press on the base’s left end and grow the circle until it sticks at the longer stave’s length (the stave pulses when it does).' },
                { t: 'circle', cx: 340, cy: 250, r: 130, ink: 'yellow',
                  instr: 'The shorter stave swings from the right end: a [yellow-circle] with its length.',
                  miss: 'Press on the base’s right end and grow the circle until it sticks at the shorter stave’s length.' },
                { t: 'seg', x1: 140, y1: 250, x2: 254, y2: 152.51, ink: 'blue',
                  instr: 'Join the left end to the circles’ crossing above the base.',
                  miss: 'Draw from the base’s left end up to where the two circles cross, above the base.' },
                { t: 'seg', x1: 340, y1: 250, x2: 254, y2: 152.51, ink: 'yellow',
                  instr: 'And the right end to the same crossing: the triangle stands.',
                  miss: 'Draw from the base’s right end up to the same crossing.' },
            ],
            qed: 'Three staves, one triangle — possible exactly because every two together outreach the third (Prop. XX).',
        },
    },
    {
        id: 'i23', ref: 'Book I. Proposition XXIII.',
        title: 'To copy an angle',
        enun: 'At a point on a given line, to build an angle equal to a given angle.',
        view: '40 60 440 290',
        P: { V: [90, 150], A1: [230, 90], A2: [220, 230], D: [172.7, 114.5], E: [166.7, 197.2], L1: [260, 230], L2: [440, 230], P0: [280, 230], F: [370, 230], G: [331.8, 156.4] },
        shapes: [
            { id: 'wV', t: 'wedge', at: 'V', from: 'A1', to: 'A2', r: 34, c: 'yellow', s: 3, z: 0 },
            { id: 'wP', t: 'wedge', at: 'P0', from: 'F', to: 'G', r: 34, c: 'yellow', s: 3, z: 0 },
            { id: 'arm1', t: 'line', p: 'V', q: 'A1', c: 'black', w: 4.5, s: 0 },
            { id: 'arm2', t: 'line', p: 'V', q: 'A2', c: 'black', w: 4.5, s: 0 },
            { id: 'nl', t: 'line', p: 'L1', q: 'L2', c: 'black', w: 4.5, s: 0 },
            { id: 'dP0', t: 'dot', at: 'P0', r: 5.5, c: 'black', s: 0 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'dE', t: 'dot', at: 'E', r: 5, c: 'black', s: 1 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'yellow', w: 3.5, dash: 1, s: 1 },
            { id: 'cP', t: 'circle', at: 'P0', thru: 'G', c: 'red', w: 3, s: 2 },
            { id: 'cF', t: 'circle', at: 'F', thru: 'G', c: 'blue', w: 3, s: 2 },
            { id: 'dF', t: 'dot', at: 'F', r: 5, c: 'black', s: 2 },
            { id: 'dG', t: 'dot', at: 'G', r: 5, c: 'black', s: 2 },
            { id: 'pg', t: 'line', p: 'P0', q: 'G', c: 'black', w: 4.5, s: 3 },
        ],
        steps: [
            {
                ask: 'An angle lives at the left; its equal must be planted at the marked point on the right-hand line. Angles cannot be picked up — what can be?',
                ok: { t: 'Triangles! Mark a point on each arm and join them: the angle is now caged inside a triangle of three definite sides.',
                      done: 'A point on each arm, joined: the angle is caged in a triangle.' },
                no: [
                    { t: 'Trace the angle and slide the tracing across.',
                      why: 'Tracing is drawing’s ghost, not geometry. Sides can be carried (Prop. II); so the angle must ride inside a triangle.' },
                    { t: 'Copy the arms first and hope the opening follows.',
                      why: 'Two arms with no third side can hinge to any opening. The cage needs its crossbar.' },
                ],
            },
            {
                ask: 'Now rebuild that cage on the new line — which proposition is the builder?',
                ok: { t: 'Prop. XXII: one circle carries the arm-length, another the crossbar-length; where they cross, the cage’s peak rises again.',
                      done: 'By Prop. XXII the same-sided triangle is rebuilt upon the new line.' },
                no: [
                    { t: 'Prop. I — the equilateral triangle.',
                      why: 'Prop. I builds only from three equal sides. Our cage has whatever sides it has: Prop. XXII is the general builder.' },
                    { t: 'Prop. IX — bisect and conquer.',
                      why: 'Bisection halves angles; it cannot transplant them. The triangle of Prop. XXII is the carriage.' },
                ],
            },
            {
                ask: 'The new triangle’s three sides equal the old cage’s three sides. The final word belongs to which proposition?',
                ok: { t: 'Prop. VIII: equal sides force equal angles — the [yellow-angle] at the new point is the old angle, reborn.',
                      done: 'By Prop. VIII the rebuilt cage holds the same angles: the [yellow-angle] is copied. Q.E.D.' },
                flash: ['wV', 'wP'],
                no: [
                    { t: 'Prop. IV — side, angle, side.',
                      why: 'Prop. IV spends an angle to earn its keep — and an equal angle is the very thing we do not yet have. Prop. VIII asks only for sides.' },
                    { t: 'No proposition — the copy is close enough.',
                      why: 'Close enough is for carpenters. Prop. VIII makes it exact, and free of charge.' },
                ],
            },
        ],
    },
    {
        id: 'i24', ref: 'Book I. Proposition XXIV.',
        title: 'The wider hinge',
        enun: 'If two triangles have two matching sides, the one with the wider angle between them has the longer base.',
        view: '40 60 440 220',
        P: { A: [110, 100], B: [60, 240], C: [220, 240], D: [300, 100], E: [250, 240], F: [451.2, 193.9] },
        shapes: [
            { id: 'wA', t: 'wedge', at: 'A', from: 'B', to: 'C', r: 30, c: 'yellow', s: 0, z: 0 },
            { id: 'wD', t: 'wedge', at: 'D', from: 'E', to: 'F', r: 34, c: 'yellow', s: 0, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'red', w: 5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'blue', w: 5, s: 0 },
            { id: 'ef', t: 'line', p: 'E', q: 'F', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Two hinges: equal [red-line] arms, equal [blue-line] arms — but the right-hand [yellow-angle] opens wider. To compare the bases, where does Euclid begin?',
                ok: { t: 'Lay the equal red arms together: both blue arms now swing from one pivot, the wider hinge holding its tip farther out.',
                      done: 'The red arms are laid together; two equal blue arms now swing from one pivot.' },
                no: [
                    { t: 'Lay the two bases side by side and squint.',
                      why: 'The bases are the unknowns — they cannot referee their own contest. The shared pivot can.' },
                    { t: 'Open the narrow hinge until it matches.',
                      why: 'Then both triangles would be the wide one, and the question would be gone rather than answered.' },
                ],
            },
            {
                ask: 'From the pivot, two equal blue arms reach to two different tips. Joining those tips makes an isosceles triangle. What do its Prop. V angles arrange?',
                ok: { t: 'Equal angles on the tip-chord — and by containment, in the base-triangle the angle facing the far base beats the angle facing the near one.',
                      done: 'The equal blue arms give equal chord-angles (Prop. V); containment tips the balance toward the wider hinge’s base.' },
                no: [
                    { t: 'Nothing — the tips are too far apart to relate.',
                      why: 'Their chord relates them instantly: isosceles, so Prop. V speaks, and containment does the tipping.' },
                    { t: 'The chord bisects both hinge angles.',
                      why: 'The chord plays no favourites with the hinges — its gift is the equal pair at its own two ends.' },
                ],
            },
            {
                ask: 'A bigger facing angle in the tip triangle. Which proposition converts that into the bases’ verdict?',
                ok: { t: 'Prop. XIX: greater angle, greater side — the wide hinge’s base is the longer. Open a door farther, and farther swings its arc.',
                      done: 'By Prop. XIX the wider [yellow-angle] commands the longer base. Q.E.D.' },
                flash: ['ef', 'bc'],
                no: [
                    { t: 'Prop. IV — side, angle, side.',
                      why: 'Prop. IV needs equal angles and delivers equality; here the angles differ, and inequality is the prize. Prop. XIX handles unequals.' },
                    { t: 'Prop. XX — the triangle inequality.',
                      why: 'Prop. XX compares sides within one triangle. Across the two, the angle-to-side lever is Prop. XIX.' },
                ],
            },
        ],
    },
    {
        id: 'i25', ref: 'Book I. Proposition XXV.',
        title: 'The longer base',
        enun: 'If two triangles have two matching sides, the one with the longer base has the wider angle between the matched sides.',
        view: '40 60 440 220',
        P: { A: [110, 100], B: [60, 240], C: [220, 240], D: [300, 100], E: [250, 240], F: [451.2, 193.9] },
        shapes: [
            { id: 'wA', t: 'wedge', at: 'A', from: 'B', to: 'C', r: 30, c: 'yellow', s: 0, z: 0 },
            { id: 'wD', t: 'wedge', at: 'D', from: 'E', to: 'F', r: 34, c: 'yellow', s: 0, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'red', w: 5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'blue', w: 5, s: 0 },
            { id: 'ef', t: 'line', p: 'E', q: 'F', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Same two hinges, but now the given is the bases: the right one is longer. Claim: its [yellow-angle] is wider. Suppose the angles were equal instead — what then?',
                ok: { t: 'Side-angle-side (Prop. IV) would force the bases equal — but the right base is longer. Struck out.',
                      done: 'Equal hinge angles would equalise the bases (Prop. IV) — against what is given.' },
                no: [
                    { t: 'Equal angles with unequal bases could coexist.',
                      why: 'Not with both arm-pairs matched: Prop. IV would weld the triangles together, bases and all.' },
                    { t: 'The bases would swap lengths.',
                      why: 'Lengths do not trade places. What equal angles would force is equality — which the given denies.' },
                ],
            },
            {
                ask: 'Suppose instead the right-hand angle were the narrower. Which sentinel objects, and what remains?',
                ok: { t: 'Prop. XXIV: the narrower hinge must have the shorter base — but the right base is the longer. Equal is out, narrower is out: wider is all that remains.',
                      done: 'A narrower hinge would shorten the base (Prop. XXIV) — contradiction. The longer base owns the wider angle. Q.E.D.' },
                flash: ['wD', 'ef'],
                no: [
                    { t: 'Prop. V — the isosceles guardian.',
                      why: 'No equal sides within either triangle are in play. Between hinges, the sentinel is Prop. XXIV.' },
                    { t: 'No sentinel — narrower hinges may hold long bases.',
                      why: 'Prop. XXIV was proved one proposition ago precisely to forbid it. The trichotomy closes.' },
                ],
            },
        ],
    },
    {
        id: 'i26', ref: 'Book I. Proposition XXVI.',
        title: 'Angle, side, angle',
        enun: 'If two triangles have two angles equal to two angles, and one matching side, they are equal in every way.',
        view: '30 55 440 205',
        P: { A: [110, 90], B: [60, 220], C: [230, 220], D: [320, 90], E: [270, 220], F: [440, 220], G: [85, 155] },
        shapes: [
            { id: 'wB', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 28, c: 'red', s: 0, z: 0 },
            { id: 'wE', t: 'wedge', at: 'E', from: 'D', to: 'F', r: 28, c: 'red', s: 0, z: 0 },
            { id: 'wC', t: 'wedge', at: 'C', from: 'B', to: 'A', r: 28, c: 'blue', s: 0, z: 0 },
            { id: 'wF', t: 'wedge', at: 'F', from: 'E', to: 'D', r: 28, c: 'blue', s: 0, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'yellow', w: 5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'black', w: 4.5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'black', w: 4.5, s: 0 },
            { id: 'ef', t: 'line', p: 'E', q: 'F', c: 'yellow', w: 5, s: 0 },
            { id: 'dG', t: 'dot', at: 'G', r: 5, c: 'black', s: 1 },
            { id: 'gc', t: 'line', p: 'G', q: 'C', c: 'yellow', w: 3.5, dash: 1, s: 1 },
        ],
        steps: [
            {
                ask: 'Given: [yellow-line] base equals base, [red-angle] equals red, [blue-angle] equals blue. To prove the sides equal too, Euclid supposes one arm longer. Then?',
                ok: { t: 'Cut the longer arm down to the other’s length (Prop. III) and join the cut to the far base corner — a rival triangle appears inside.',
                      done: 'Suppose one arm longer: it is cut to match, and the cut point joined across.' },
                no: [
                    { t: 'Then the bases would already disagree.',
                      why: 'Not yet — the bases were given equal. The disagreement must be flushed out through the angles.' },
                    { t: 'Then the angles were measured wrongly.',
                      why: 'Nothing was measured; the equalities were given. The supposition about the arm is what goes to trial.' },
                ],
            },
            {
                ask: 'The rival: cut-arm, equal [yellow-line] base, and the given [red-angle] between them. What does Prop. IV decree — and against whom?',
                ok: { t: 'Rival ≅ the second triangle — so the rival’s base-corner angle equals the given [blue-angle]. But that angle is a mere part of the first triangle’s blue angle. Part equals whole: absurd.',
                      done: 'By Prop. IV the rival matches the second triangle — making a part of the blue angle equal to the whole of it. Absurd.' },
                flash: ['gc', 'wC'],
                no: [
                    { t: 'The rival is simply a smaller copy — no harm done.',
                      why: 'The harm is exact: its corner angle must equal the whole blue angle it sits inside. Wholes do not fit inside themselves.' },
                    { t: 'Prop. IV cannot apply to imaginary triangles.',
                      why: 'The rival is honestly drawn from the supposition. Prop. IV applies — and detonates the supposition that drew it.' },
                ],
            },
            {
                ask: 'The supposition dies; the arms are equal. Finish the harvest.',
                ok: { t: 'With arms equal, base equal, and the angle between given, Prop. IV now runs forward: the triangles are equal in every respect. (And with the side opposite an angle instead, the same trap springs via Prop. XVI.)',
                      done: 'The arms being equal, Prop. IV completes the congruence: angle-side-angle holds. Q.E.D.' },
                flash: ['bc', 'ef'],
                no: [
                    { t: 'Only the arms are equal — the rest stays open.',
                      why: 'The rest falls in a breath: two sides and the included angle are matched, and Prop. IV harvests everything.' },
                    { t: 'The second triangle must now be redrawn.',
                      why: 'Neither triangle ever moved. Only the false supposition was erased.' },
                ],
            },
        ],
    },
    {
        id: 'i27', ref: 'Book I. Proposition XXVII.',
        title: 'Alternate angles make parallels',
        enun: 'If a line crossing two lines makes equal alternate angles, the two lines never meet.',
        view: '60 40 380 300',
        P: { T1: [80, 120], T2: [400, 120], B1: [80, 260], B2: [400, 260], G: [300, 120], H: [180, 260], X1: [360, 50], X2: [120, 330] },
        shapes: [
            { id: 'wH', t: 'wedge', at: 'H', from: 'G', to: 'B2', r: 36, c: 'red', s: 0, z: 0 },
            { id: 'wG', t: 'wedge', at: 'G', from: 'H', to: 'T1', r: 36, c: 'red', s: 0, z: 0 },
            { id: 'top', t: 'line', p: 'T1', q: 'T2', c: 'black', w: 4.5, s: 0 },
            { id: 'bot', t: 'line', p: 'B1', q: 'B2', c: 'black', w: 4.5, s: 0 },
            { id: 'tr', t: 'line', p: 'X1', q: 'X2', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'A crossing line cuts two lines, making equal alternate [red-angle]s — one tucked on each side. The claim: the two lines never meet. How is “never” proved?',
                ok: { t: 'Suppose they do meet, somewhere far off: with the crossing line they would then pen in a triangle.',
                      done: 'Suppose the lines met: line, line, and crossing line would enclose a triangle.' },
                no: [
                    { t: 'Follow both lines to the edge of the page.',
                      why: 'The page ends; lines do not. “Never” must be proved by contradiction, not by patient drawing.' },
                    { t: 'Check that the lines are the same distance apart at both ends.',
                      why: 'Equidistance is a consequence of parallels, not a permitted starting tool. The alternate angles carry the whole case.' },
                ],
            },
            {
                ask: 'In that far-off triangle, look again at our two red angles. What have they become?',
                ok: { t: 'One is now an exterior angle, the other its remote interior — and Prop. XVI insists exterior beats interior. But ours are equal. The triangle is impossible.',
                      done: 'In the supposed triangle, exterior would have to beat remote interior (Prop. XVI) — yet the angles are equal.' },
                flash: ['wH', 'wG'],
                no: [
                    { t: 'They have become right angles.',
                      why: 'They are whatever size they always were — the crime is not their size but their equality inside a triangle that forbids it.' },
                    { t: 'They vanish, being outside the triangle.',
                      why: 'Look closely: one sits at each crossing, and the supposed meeting makes those crossings two corners of the triangle. Both angles are on trial.' },
                ],
            },
            {
                ask: 'The meeting on that side is refuted — and by symmetry on the other side too. What are such lines called?',
                ok: { t: 'Parallel — lines in one plane which, produced ever so far both ways, meet in neither direction (Def. 35).',
                      done: 'Meeting on neither side, the lines are parallel. Q.E.D.' },
                no: [
                    { t: 'Asymptotic — they creep together forever.',
                      why: 'Straight lines do no creeping: with the meeting refuted, their gap is beyond suspicion. Parallel is the word and Def. 35 the warrant.' },
                    { t: 'Perpendicular.',
                      why: 'Perpendicular lines meet with great enthusiasm — at right angles. These two never meet at all.' },
                ],
            },
        ],
    },
    {
        id: 'i28', ref: 'Book I. Proposition XXVIII.',
        title: 'Two more roads to parallel',
        enun: 'If a crossing line makes corresponding angles equal, or interior angles on one side totalling two right angles, the lines are parallel.',
        view: '60 40 380 300',
        P: { T1: [80, 120], T2: [400, 120], B1: [80, 260], B2: [400, 260], G: [300, 120], H: [180, 260], X1: [360, 50], X2: [120, 330] },
        shapes: [
            { id: 'wGc', t: 'wedge', at: 'G', from: 'T2', to: 'X1', r: 36, c: 'red', s: 0, z: 0 },
            { id: 'wHc', t: 'wedge', at: 'H', from: 'B2', to: 'G', r: 36, c: 'red', s: 0, z: 0 },
            { id: 'wGi', t: 'wedge', at: 'G', from: 'H', to: 'T2', r: 30, c: 'blue', s: 2, z: 0 },
            { id: 'wGa', t: 'wedge', at: 'G', from: 'H', to: 'T1', r: 36, c: 'yellow', s: 1, z: 0 },
            { id: 'top', t: 'line', p: 'T1', q: 'T2', c: 'black', w: 4.5, s: 0 },
            { id: 'bot', t: 'line', p: 'B1', q: 'B2', c: 'black', w: 4.5, s: 0 },
            { id: 'tr', t: 'line', p: 'X1', q: 'X2', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'This time the equal [red-angle]s are corresponding — same side, same station, one at each crossing. How do we reach Prop. XXVII’s door?',
                ok: { t: 'Vertical angles (Prop. XV): the upper red equals the alternate angle across its crossing — so the alternate pair is equal, and Prop. XXVII opens.',
                      done: 'By Prop. XV the corresponding pair converts to an equal alternate pair: parallels by Prop. XXVII.' },
                no: [
                    { t: 'Corresponding angles are alternate angles already.',
                      why: 'Not quite — they sit on the same side of the crossing line. One flip through Prop. XV makes them alternate.' },
                    { t: 'Slide one crossing along to the other.',
                      why: 'Crossings stay where they are. It is the angle equality that travels, by Prop. XV.' },
                ],
            },
            {
                ask: 'Second road: the two interior angles on one side total two right angles. How does this one reach the same door?',
                ok: { t: 'The straight line at either crossing also gives two rights (Prop. XIII); subtracting the shared angle from both sums leaves the alternate pair equal — Prop. XXVII again.',
                      done: 'Two rights against two rights, the common angle withdrawn: alternate angles equal, and the lines are parallel. Q.E.D.' },
                flash: ['wGi', 'wHc'],
                no: [
                    { t: 'Two rights on one side means the lines lean apart.',
                      why: 'Leaning is exactly what the sum forbids: what one angle takes, the other returns, and Prop. XIII balances the books into parallelism.' },
                    { t: 'It cannot — sums say nothing about single angles.',
                      why: 'Alone, no; but set against Prop. XIII’s equal sum, subtraction isolates the pair beautifully.' },
                ],
            },
        ],
    },
    {
        id: 'i29', ref: 'Book I. Proposition XXIX.',
        title: 'Parallels answer back',
        enun: 'A line crossing two parallels makes equal alternate angles — the first theorem to lean on Euclid’s famous Fifth Postulate.',
        view: '60 40 380 300',
        P: { T1: [80, 120], T2: [400, 120], B1: [80, 260], B2: [400, 260], G: [300, 120], H: [180, 260], X1: [360, 50], X2: [120, 330] },
        shapes: [
            { id: 'wH', t: 'wedge', at: 'H', from: 'G', to: 'B2', r: 36, c: 'red', s: 0, z: 0 },
            { id: 'wG', t: 'wedge', at: 'G', from: 'H', to: 'T1', r: 36, c: 'red', s: 0, z: 0 },
            { id: 'wGi', t: 'wedge', at: 'G', from: 'H', to: 'T2', r: 30, c: 'blue', s: 1, z: 0 },
            { id: 'top', t: 'line', p: 'T1', q: 'T2', c: 'black', w: 4.5, s: 0 },
            { id: 'bot', t: 'line', p: 'B1', q: 'B2', c: 'black', w: 4.5, s: 0 },
            { id: 'tr', t: 'line', p: 'X1', q: 'X2', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Now the lines are given parallel, and we must show the alternate [red-angle]s equal — Prop. XXVII sailed the other way. Suppose one red angle were the larger. What follows on its slimmer side?',
                ok: { t: 'Add the [blue-angle] to both: on one side the interior pair then falls short of two right angles.',
                      done: 'Were the alternates unequal, one side’s interior angles would total less than two right angles.' },
                no: [
                    { t: 'The larger angle would spill over the line.',
                      why: 'Angles do not spill — they total. Follow the sums: one side of the crossing line comes up short.' },
                    { t: 'Nothing — alternate angles owe each other nothing.',
                      why: 'Between parallels they owe everything, as the Fifth Postulate is about to collect.' },
                ],
            },
            {
                ask: 'Interior angles short of two rights on one side. Which axiom now speaks — the most argued-over sentence in mathematics?',
                ok: { t: 'The Fifth Postulate: lines so disposed, produced far enough, must meet on that short side. But parallels meet nowhere. Contradiction.',
                      done: 'By the Fifth Postulate the parallels would have to meet — which parallels never do.' },
                flash: ['wGi', 'wH'],
                no: [
                    { t: 'Prop. XVI, the exterior angle.',
                      why: 'Prop. XVI carried the outward voyage (XXVII). The return crossing is deeper water — only the Fifth Postulate reaches it, and two millennia of readers wished otherwise.' },
                    { t: 'The common notion that halves of equals are equal.',
                      why: 'No halving is in sight. What is needed is a licence to force a meeting — the Postulate is that licence.' },
                ],
            },
            {
                ask: 'The supposition collapses. Gather the spoils.',
                ok: { t: 'Alternate angles equal — and with Props. XV and XIII, corresponding angles equal and co-interior angles totalling two rights follow at once.',
                      done: 'Parallels make equal alternate angles (with the corresponding and co-interior facts in train). Q.E.D.' },
                flash: ['wH', 'wG'],
                no: [
                    { t: 'Only the two red angles — nothing more.',
                      why: 'Take the interest with the principal: Prop. XV flips the equality to corresponding angles, Prop. XIII banks the co-interior sum.' },
                    { t: 'That the Fifth Postulate is now proved.',
                      why: 'The reverse — it was spent, not proved. Postulates are the coin proofs are bought with.' },
                ],
            },
        ],
    },
    {
        id: 'i30', ref: 'Book I. Proposition XXX.',
        title: 'Parallels of parallels',
        enun: 'Lines parallel to the same line are parallel to one another.',
        view: '60 40 360 280',
        P: { L1a: [80, 100], L1b: [400, 100], Ma: [80, 180], Mb: [400, 180], L2a: [80, 260], L2b: [400, 260], P1: [180, 100], PM: [240, 180], P2: [300, 260], X1: [150, 60], X2: [330, 300] },
        shapes: [
            { id: 'w1', t: 'wedge', at: 'P1', from: 'X2', to: 'L1b', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'wM', t: 'wedge', at: 'PM', from: 'X2', to: 'Mb', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'w2', t: 'wedge', at: 'P2', from: 'X2', to: 'L2b', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'l1', t: 'line', p: 'L1a', q: 'L1b', c: 'black', w: 4.5, s: 0 },
            { id: 'm', t: 'line', p: 'Ma', q: 'Mb', c: 'black', w: 4.5, s: 0 },
            { id: 'l2', t: 'line', p: 'L2a', q: 'L2b', c: 'black', w: 4.5, s: 0 },
            { id: 'tr', t: 'line', p: 'X1', q: 'X2', c: 'black', w: 4, s: 1 },
        ],
        steps: [
            {
                ask: 'The outer lines are each parallel to the middle one — but are they parallel to each other? A single stroke settles it. Which?',
                ok: { t: 'One crossing line through all three: against the middle line, each outer line answers with the same [red-angle] (Prop. XXIX, twice).',
                      done: 'A crossing line is drawn; by Prop. XXIX each outer line makes the same [red-angle] with it as the middle line does.' },
                no: [
                    { t: 'Measure the two gaps between the lines.',
                      why: 'Gaps are unswearable testimony. One crossing line makes all three lines answer the same question at once.' },
                    { t: 'Remove the middle line — it is in the way.',
                      why: 'The middle line is the witness! Each outer line is sworn parallel to it, and through it their angles are matched.' },
                ],
            },
            {
                ask: 'Both outer lines make equal [red-angle]s with the one crossing line. Final word?',
                ok: { t: 'Things equal to the same thing are equal to each other — so the outer lines make equal angles together, and Prop. XXVII pronounces them parallel.',
                      done: 'Equal to the same angle, equal to each other: the outer lines are parallel (Prop. XXVII). Q.E.D.' },
                flash: ['w1', 'w2'],
                no: [
                    { t: 'They might still cross somewhere beyond the page.',
                      why: 'Not with equal alternate angles — Prop. XXVII patrols beyond every page edge.' },
                    { t: 'Only if all three lines are horizontal.',
                      why: 'Euclid’s page has no horizon. Tilt the whole figure and every cited proposition holds unblinking.' },
                ],
            },
        ],
    },
    {
        id: 'i31', ref: 'Book I. Proposition XXXI.',
        title: 'To draw a parallel',
        enun: 'Through a given point, to draw a line parallel to a given line.',
        view: '60 80 380 210',
        P: { A: [240, 110], L1: [80, 260], L2: [420, 260], D: [180, 260], E1: [80, 110], E2: [420, 110] },
        shapes: [
            { id: 'wD', t: 'wedge', at: 'D', from: 'A', to: 'L2', r: 36, c: 'red', s: 2, z: 0 },
            { id: 'wA', t: 'wedge', at: 'A', from: 'D', to: 'E1', r: 36, c: 'red', s: 2, z: 0 },
            { id: 'base', t: 'line', p: 'L1', q: 'L2', c: 'black', w: 4.5, s: 0 },
            { id: 'dA', t: 'dot', at: 'A', r: 5.5, c: 'black', s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'yellow', w: 4.5, s: 1 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'par', t: 'line', p: 'E1', q: 'E2', c: 'blue', w: 5, s: 2 },
        ],
        steps: [
            {
                ask: 'A point floats above the line, and through it a parallel must pass. The point is unmoored — first?',
                ok: { t: 'Tether it: join the point to any spot on the line. The tether now holds a definite [red-angle] against the line.',
                      done: 'The point is tethered to the line by the [yellow-line].' },
                no: [
                    { t: 'Copy the line a little higher up.',
                      why: '“A little higher” is not a construction — and nothing yet makes the copy pass through our point. The tether will see to that.' },
                    { t: 'Drop a perpendicular and slide along it.',
                      why: 'Workable in spirit (Props. XI and XII could do it) — but Euclid’s route is leaner: one tether, one copied angle.' },
                ],
            },
            {
                ask: 'The tether meets the line at a [red-angle]. What is built at the floating point?',
                ok: { t: 'The same angle, copied (Prop. XXIII) on the tether’s other side — alternate stations, equal angles.',
                      done: 'At the point, the tether’s angle is copied alternately (Prop. XXIII), and the new line drawn through.' },
                no: [
                    { t: 'A right angle to the tether.',
                      why: 'Only if the tether happened to stand square to the line. The angle to copy is the tether’s own, whatever it is.' },
                    { t: 'The same angle on the same side.',
                      why: 'Same-side would aim the new line to converge. Alternate — across the tether — is what makes Prop. XXVII bite.' },
                ],
            },
            {
                ask: 'Equal alternate [red-angle]s across the tether. Which proposition signs the certificate?',
                ok: { t: 'Prop. XXVII: the new line and the old can never meet — parallel, and passing through the given point by construction.',
                      done: 'By Prop. XXVII the drawn line is parallel to the given one, through the given point. Q.E.D.' },
                flash: ['par', 'base'],
                no: [
                    { t: 'Prop. XXIX.',
                      why: 'Prop. XXIX spends parallels to buy angles; here we spend angles to buy a parallel — that is Prop. XXVII’s counter.' },
                    { t: 'The Fifth Postulate.',
                      why: 'Happily not — building this parallel needs no such extravagance. Only its uniqueness would.' },
                ],
            },
        ],
    },
    {
        id: 'i33', ref: 'Book I. Proposition XXXIII.',
        title: 'Joining equal parallels',
        enun: 'Lines joining the same-side ends of two equal parallel lines are themselves equal and parallel.',
        view: '80 80 320 210',
        P: { A: [120, 110], B: [300, 110], C: [180, 250], D: [360, 250] },
        shapes: [
            { id: 'wB1', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'wC1', t: 'wedge', at: 'C', from: 'B', to: 'D', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'wC2', t: 'wedge', at: 'C', from: 'A', to: 'B', r: 24, c: 'blue', s: 2, z: 0 },
            { id: 'wB2', t: 'wedge', at: 'B', from: 'C', to: 'D', r: 24, c: 'blue', s: 2, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 5, s: 0 },
            { id: 'cd', t: 'line', p: 'C', q: 'D', c: 'black', w: 5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'blue', w: 5, s: 0 },
            { id: 'bd', t: 'line', p: 'B', q: 'D', c: 'blue', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'yellow', w: 4, dash: 1, s: 1 },
        ],
        steps: [
            {
                ask: 'Two equal [black-line]s run parallel, and [blue-line]s join their same-side ends. To study the joins, Euclid cuts a diagonal. What does it earn?',
                ok: { t: 'Crossing the two parallels, the diagonal makes equal alternate [red-angle]s (Prop. XXIX) — one at each of its ends.',
                      done: 'The diagonal is drawn: alternate [red-angle]s stand equal at its two ends (Prop. XXIX).' },
                no: [
                    { t: 'It splits the figure into halves of equal area.',
                      why: 'That pleasure belongs to Prop. XXXIV, one door down. Today the diagonal is hired for its angles.' },
                    { t: 'It measures the gap between the parallels.',
                      why: 'The diagonal crosses the gap slantwise, measuring nothing — but harvesting alternate angles.' },
                ],
            },
            {
                ask: 'Equal blacks, the diagonal common, equal red angles between them. Which engine, and what does it yield?',
                ok: { t: 'Side-angle-side (Prop. IV): the two triangles match, so join equals join — and the second pair of alternate [blue-angle]s comes out equal too.',
                      done: 'By Prop. IV the triangles match: the [blue-line] joins are equal, and a second alternate pair emerges equal.' },
                flash: ['ac', 'bd'],
                no: [
                    { t: 'Prop. VIII — all three sides are known.',
                      why: 'Not yet — the joins are the unknowns! Two sides and the red angle between them is exactly Prop. IV’s price.' },
                    { t: 'The triangles merely share the diagonal.',
                      why: 'They share better than that: equal black sides and equal red angles about it. Prop. IV forges the rest.' },
                ],
            },
            {
                ask: 'The new [blue-angle]s are equal alternates across the diagonal. Close the case.',
                ok: { t: 'Prop. XXVII: the joins are parallel — equal and parallel both, as promised.',
                      done: 'Equal alternate blues make the joins parallel (Prop. XXVII): equal and parallel. Q.E.D.' },
                flash: ['ac', 'bd'],
                no: [
                    { t: 'The joins are equal but must tilt apart.',
                      why: 'The equal blue alternates forbid any tilt — Prop. XXVII turns them into a parallelism certificate.' },
                    { t: 'The figure is therefore a square.',
                      why: 'A parallelogram, rather — squares demand right angles and equal sides all round, none of which was asked.' },
                ],
            },
        ],
    },
    {
        id: 'i34', ref: 'Book I. Proposition XXXIV.',
        title: 'Anatomy of the parallelogram',
        enun: 'In a parallelogram, opposite sides are equal, opposite angles are equal, and the diagonal halves the whole.',
        view: '80 80 340 210',
        P: { A: [120, 110], B: [320, 110], C: [180, 250], D: [380, 250] },
        shapes: [
            { id: 'fT', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'red', s: 3, z: 0 },
            { id: 'fB', t: 'poly', ptsN: ['C', 'B', 'D'], c: 'blue', s: 3, z: 0 },
            { id: 'wB1', t: 'wedge', at: 'B', from: 'A', to: 'C', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'wC1', t: 'wedge', at: 'C', from: 'B', to: 'D', r: 30, c: 'red', s: 1, z: 0 },
            { id: 'wC2', t: 'wedge', at: 'C', from: 'A', to: 'B', r: 24, c: 'yellow', s: 1, z: 0 },
            { id: 'wB2', t: 'wedge', at: 'B', from: 'C', to: 'D', r: 24, c: 'yellow', s: 1, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'cd', t: 'line', p: 'C', q: 'D', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bd', t: 'line', p: 'B', q: 'D', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'yellow', w: 4.5, s: 1 },
        ],
        steps: [
            {
                ask: 'A parallelogram — two pairs of parallel sides, nothing more sworn. Cut the diagonal: what does it collect at its two ends?',
                ok: { t: 'Two pairs of equal alternate angles (Prop. XXIX): [red-angle]s across one pair of parallels, [yellow-angle]s across the other.',
                      done: 'The diagonal collects two alternate pairs: equal [red-angle]s and equal [yellow-angle]s at its ends.' },
                no: [
                    { t: 'Two equal segments, cut at its middle.',
                      why: 'The diagonal’s own bisection is true but unproven here — and unneeded. Its angle harvest does the work.' },
                    { t: 'Four right angles.',
                      why: 'Only rectangles would be so tidy. A general parallelogram leans — yet the alternate pairs stay equal.' },
                ],
            },
            {
                ask: 'Two angles and the side between them, matched pair for pair across the diagonal. Which congruence, and what falls out?',
                ok: { t: 'Angle-side-angle (Prop. XXVI): the two triangles match — opposite sides equal, opposite angles equal.',
                      done: 'By Prop. XXVI the triangles match: opposite sides and opposite angles of the parallelogram are equal.' },
                flash: ['ab', 'cd'],
                no: [
                    { t: 'Prop. IV — two sides and the angle between.',
                      why: 'We hold no equal sides yet — only the shared diagonal and two angle pairs upon it. That is Prop. XXVI’s exact diet.' },
                    { t: 'Prop. VIII — all three sides.',
                      why: 'The sides are the loot, not the key. Angle-side-angle opens the door with what the parallels gave.' },
                ],
            },
            {
                ask: 'And the diagonal’s own boast?',
                ok: { t: 'The two matched triangles are equal in area — the diagonal halves the parallelogram, red half and blue half.',
                      done: 'The diagonal parts the parallelogram into two equal triangles: halved. Q.E.D.' },
                flash: ['fT', 'fB'],
                no: [
                    { t: 'It is the longest line in the figure.',
                      why: 'Sometimes not even that (the other diagonal may beat it). Its provable boast is the halving.' },
                    { t: 'It halves the perimeter, not the area.',
                      why: 'It halves both, but area is the theorem: congruent triangles cover equal ground.' },
                ],
            },
        ],
    },
    {
        id: 'i35', ref: 'Book I. Proposition XXXV.',
        title: 'The shear',
        enun: 'Parallelograms on the same base and between the same parallels are equal in area.',
        view: '80 86 340 190',
        P: { A: [100, 110], D: [240, 110], E: [260, 110], F: [400, 110], B: [120, 250], C: [260, 250] },
        shapes: [
            { id: 'trap', t: 'poly', ptsN: ['A', 'F', 'C', 'B'], c: 'yellow', s: 1, z: 0 },
            { id: 'fL', t: 'poly', ptsN: ['A', 'B', 'E'], c: 'red', s: 2, z: 0 },
            { id: 'fR', t: 'poly', ptsN: ['D', 'C', 'F'], c: 'blue', s: 2, z: 0 },
            { id: 'rail', t: 'line', p: 'A', q: 'F', c: 'black', w: 4.5, s: 0 },
            { id: 'base', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'red', w: 5, s: 0 },
            { id: 'eb', t: 'line', p: 'E', q: 'B', c: 'blue', w: 5, s: 0 },
            { id: 'fc', t: 'line', p: 'F', q: 'C', c: 'blue', w: 5, s: 0 },
        ],
        steps: [
            {
                ask: 'Two parallelograms — red-sided and blue-sided — stand on the same base between the same rails, one sheared over. Where does Euclid look first?',
                ok: { t: 'At the whole trapezoid their tops and base enclose together — each parallelogram is that whole, less one triangle.',
                      done: 'The whole trapezoid is marked: each parallelogram is the whole less one outer triangle.' },
                no: [
                    { t: 'At the strip both parallelograms cover.',
                      why: 'The overlap is an awkward, changing shape. The whole-minus-triangle bookkeeping never changes — that is its beauty.' },
                    { t: 'At the bases, to compare their lengths.',
                      why: 'It is one and the same base! The contest is the leaning bodies above it.' },
                ],
            },
            {
                ask: 'Now the two outer triangles, red-shaded and blue-shaded. Why are they equal?',
                ok: { t: 'Their slant sides are the parallelograms’ equal opposite sides (Prop. XXXIV); their top sides are equal (each is a top less — or plus — the same middle piece); and the angles between match as corresponding (Prop. XXIX). Side-angle-side.',
                      done: 'By Props. XXXIV, XXIX and IV, the two outer triangles are equal.' },
                flash: ['fL', 'fR'],
                no: [
                    { t: 'Because both triangles lean at the same slope.',
                      why: 'Only their leading edges do. Equality needs the full toll: two matched sides and the angle between (Prop. IV).' },
                    { t: 'Because each is half of its parallelogram.',
                      why: 'Neither is — the diagonal makes halves, and these triangles hang outside the diagonals. They are trimmings, and equal ones.' },
                ],
            },
            {
                ask: 'Equal trimmings from the same whole. Say the theorem.',
                ok: { t: 'Whole minus red triangle = one parallelogram; whole minus blue triangle = the other; equals from equals — the parallelograms are equal, however far they shear.',
                      done: 'Equal triangles taken from the same trapezoid leave the parallelograms equal. Q.E.D.' },
                flash: ['ab', 'dc', 'eb', 'fc'],
                no: [
                    { t: 'The upright parallelogram is bigger — it stands taller.',
                      why: 'They stand between the same rails: one height for both. The shear steals no area, only posture.' },
                    { t: 'They are equal only for a small shear.',
                      why: 'Shear to the horizon — the two trimmings grow together, and the subtraction cancels as perfectly as ever.' },
                ],
            },
        ],
    },
    {
        id: 'i36', ref: 'Book I. Proposition XXXVI.',
        title: 'Equal bases, equal parallelograms',
        enun: 'Parallelograms on equal bases and between the same parallels are equal in area.',
        view: '40 88 380 186',
        P: { A: [80, 110], D: [200, 110], B: [60, 250], C: [180, 250], E: [260, 110], H: [380, 110], F: [280, 250], G: [400, 250] },
        shapes: [
            { id: 'f1', t: 'poly', ptsN: ['A', 'D', 'C', 'B'], c: 'red', s: 0, z: 0 },
            { id: 'f2', t: 'poly', ptsN: ['E', 'H', 'G', 'F'], c: 'blue', s: 0, z: 0 },
            { id: 'be', t: 'line', p: 'B', q: 'E', c: 'yellow', w: 4, dash: 1, s: 1 },
            { id: 'ch', t: 'line', p: 'C', q: 'H', c: 'yellow', w: 4, dash: 1, s: 1 },
        ],
        steps: [
            {
                ask: 'Two parallelograms, apart on the page, but on equal bases between the same rails. They cannot be subtracted from a common whole — how are they bridged?',
                ok: { t: 'Join base to far top: the joins are equal parallels joined at their ends, so the bridge itself is a parallelogram (Prop. XXXIII).',
                      done: 'Base is joined to far top: by Prop. XXXIII the bridge is itself a parallelogram.' },
                no: [
                    { t: 'Slide one parallelogram along the rails until they touch.',
                      why: 'Sliding is Prop. XXXV’s conclusion, not a move we may make. The bridge earns the same effect lawfully.' },
                    { t: 'Cut both into triangles and compare the pieces.',
                      why: 'A butcher’s method. One elegant bridge, and Prop. XXXV does all the carving unseen.' },
                ],
            },
            {
                ask: 'The bridge shares a base with each parallelogram in turn. Conclude.',
                ok: { t: 'Bridge equals the first (same base, same rails — Prop. XXXV) and equals the second likewise: equal to the same, the two are equal to each other.',
                      done: 'By Prop. XXXV twice, each equals the bridge — and so each other. Q.E.D.' },
                flash: ['f1', 'f2'],
                no: [
                    { t: 'The bridge is bigger than both, spanning farther.',
                      why: 'Span is not area: the bridge stands on a base equal to theirs, between the same rails — Prop. XXXV holds it to their size.' },
                    { t: 'Only if the two bases are aligned end to end.',
                      why: 'Any spacing serves — the bridge stretches to fit, and the two invocations of Prop. XXXV never notice.' },
                ],
            },
        ],
    },
    {
        id: 'i37', ref: 'Book I. Proposition XXXVII.',
        title: 'Triangles between rails',
        enun: 'Triangles on the same base and between the same parallels are equal in area.',
        view: '40 86 360 190',
        P: { B: [140, 250], C: [300, 250], A: [100, 110], D: [340, 110], E1: [260, 110], D2: [180, 110], R1: [60, 110], R2: [380, 110] },
        shapes: [
            { id: 'fA', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'red', s: 2, z: 0 },
            { id: 'fD', t: 'poly', ptsN: ['D', 'B', 'C'], c: 'blue', s: 2, z: 0 },
            { id: 'rail', t: 'line', p: 'R1', q: 'R2', c: 'black', w: 4, s: 0 },
            { id: 'base', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'db', t: 'line', p: 'D', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'e1c', t: 'line', p: 'E1', q: 'C', c: 'black', w: 3, dash: 1, s: 1 },
            { id: 'd2b', t: 'line', p: 'D2', q: 'B', c: 'black', w: 3, dash: 1, s: 1 },
        ],
        steps: [
            {
                ask: 'Two triangles share a base, their peaks on the same rail. Triangles resist comparison — what does Euclid make of each?',
                ok: { t: 'A parallelogram: through each peak’s base-corner runs a parallel to the opposite side (Prop. XXXI), completing each triangle to a parallelogram between the rails.',
                      done: 'Each triangle is completed (Prop. XXXI) into a parallelogram between the same rails.' },
                no: [
                    { t: 'A rectangle of the same height.',
                      why: 'Rectangles want right angles we have not built. The parallelogram completion costs one parallel line each.' },
                    { t: 'A pair of smaller triangles.',
                      why: 'Halving multiplies the problem. Doubling into parallelograms delivers it to Prop. XXXV whole.' },
                ],
            },
            {
                ask: 'Two parallelograms on the same base between the same rails, each holding its triangle as a diagonal-half. Conclude.',
                ok: { t: 'The parallelograms are equal (Prop. XXXV); each triangle is half its own (Prop. XXXIV); halves of equals are equal.',
                      done: 'Equal parallelograms (XXXV), halved by their diagonals (XXXIV): the triangles are equal. Q.E.D.' },
                flash: ['fA', 'fD'],
                no: [
                    { t: 'Equal only if the two peaks lean the same way.',
                      why: 'Lean freely: Prop. XXXV already blessed every shear, and the halving is lean-proof.' },
                    { t: 'The halves might be unequal halves.',
                      why: 'A half is a half — Prop. XXXIV certifies the diagonal’s split exactly, both times.' },
                ],
            },
        ],
    },
    {
        id: 'i38', ref: 'Book I. Proposition XXXVIII.',
        title: 'Equal bases, equal triangles',
        enun: 'Triangles on equal bases and between the same parallels are equal in area.',
        view: '40 86 380 190',
        P: { A: [100, 110], B: [80, 250], C: [200, 250], D: [340, 110], E: [260, 250], F: [380, 250], R1: [60, 110], R2: [400, 110], S1: [60, 250], S2: [400, 250] },
        shapes: [
            { id: 'fA', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'red', s: 1, z: 0 },
            { id: 'fD', t: 'poly', ptsN: ['D', 'E', 'F'], c: 'blue', s: 1, z: 0 },
            { id: 'rail', t: 'line', p: 'R1', q: 'R2', c: 'black', w: 4, s: 0 },
            { id: 'floor', t: 'line', p: 'S1', q: 'S2', c: 'black', w: 4, s: 0 },
            { id: 'b1', t: 'line', p: 'B', q: 'C', c: 'red', w: 6, s: 0 },
            { id: 'b2', t: 'line', p: 'E', q: 'F', c: 'blue', w: 6, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'black', w: 4.5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'black', w: 4.5, s: 0 },
        ],
        steps: [
            {
                ask: 'Same rails, but now the bases are merely equal — a red stretch here, a blue stretch there. What carries Prop. XXXVII across the gap?',
                ok: { t: 'The parallelogram completions again — and Prop. XXXVI, which was minted exactly for equal bases apart on the floor.',
                      done: 'Each triangle is completed to a parallelogram; Prop. XXXVI holds the two completions equal.' },
                no: [
                    { t: 'Slide one base along the floor until they meet.',
                      why: 'No sliding allowed — but Prop. XXXVI’s bridge of joins already did the equivalent, with a licence.' },
                    { t: 'The gap between the bases must first be measured.',
                      why: 'The gap never enters: equal bases and shared rails are all Props. XXXVI and XXXIV consume.' },
                ],
            },
            {
                ask: 'Equal completions, each halved by a diagonal. Finish.',
                ok: { t: 'Halves of equals are equal: the red triangle equals the blue, wherever their equal bases lie along the floor.',
                      done: 'Halves of the equal parallelograms: the triangles are equal. Q.E.D.' },
                flash: ['fA', 'fD'],
                no: [
                    { t: 'Equal only if the triangles also share their peaks’ rail.',
                      why: 'They do share it — that is the “same parallels” in the enunciation, and it was used, not spared.' },
                    { t: 'The nearer triangle is slightly larger.',
                      why: '“Nearer” to what? The page has no favourites: equal bases, equal rails, equal areas.' },
                ],
            },
        ],
    },
    {
        id: 'i39', ref: 'Book I. Proposition XXXIX.',
        title: 'Equal triangles, same rail',
        enun: 'Equal triangles on the same base and side lie between the same parallels: the line joining their peaks is parallel to the base.',
        view: '80 86 300 190',
        P: { B: [120, 250], C: [300, 250], A: [160, 110], D: [320, 110], E: [280, 138] },
        shapes: [
            { id: 'fA', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'red', s: 0, z: 0 },
            { id: 'fD', t: 'poly', ptsN: ['D', 'B', 'C'], c: 'blue', s: 0, z: 0 },
            { id: 'base', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'db', t: 'line', p: 'D', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'yellow', w: 4.5, s: 1 },
            { id: 'ae', t: 'line', p: 'A', q: 'E', c: 'yellow', w: 3, dash: 1, s: 2 },
            { id: 'ec', t: 'line', p: 'E', q: 'C', c: 'black', w: 3, dash: 1, s: 2 },
            { id: 'dE', t: 'dot', at: 'E', r: 4.5, c: 'black', s: 2 },
        ],
        steps: [
            {
                ask: 'The red and blue triangles are equal, on one base, peaks on the same side. Join the peaks: we claim that [yellow-line] runs parallel to the base. Proof by…?',
                ok: { t: 'Contradiction: suppose it tilts — then the true parallel through the first peak (Prop. XXXI) crosses the second peak’s side at some lower point.',
                      done: 'Suppose the join not parallel: the true parallel through one peak meets the other’s side elsewhere.' },
                no: [
                    { t: 'Construction: build the parallel and observe it hit both peaks.',
                      why: 'Observation is not proof — the second peak must be forced onto the parallel, and only absurdity forces.' },
                    { t: 'Symmetry: the triangles are mirror images.',
                      why: 'Equal in area need not mean mirrored in shape — one peak may loom while the other crouches. Area is all we hold.' },
                ],
            },
            {
                ask: 'Join that lower crossing-point to the base’s far end, making a shrunken triangle on the parallel. Count its worth.',
                ok: { t: 'Same base, same rails: shrunken equals the red triangle (Prop. XXXVII) — and the red equals the blue by hypothesis. So the shrunken equals the blue it sits inside.',
                      done: 'By Prop. XXXVII the shrunken triangle equals the red — hence the blue, its own container.' },
                flash: ['fD'],
                no: [
                    { t: 'Smaller, of course — it was drawn lower.',
                      why: 'Lower, but on the full base between full rails: Prop. XXXVII prices it equal to the red regardless. That is the trap.' },
                    { t: 'Its worth depends on where the parallel crossed.',
                      why: 'Anywhere but the peak itself gives the same verdict — equal to red, nested in blue. The peak is the only escape, and that is the theorem.' },
                ],
            },
            {
                ask: 'A triangle equal to the whole it nests within. Deliver the sentence.',
                ok: { t: 'The part cannot equal the whole: the supposed tilt is dead, and the peak-join runs parallel to the base.',
                      done: 'Part equalling whole is absurd: the peaks’ join is parallel to the base. Q.E.D.' },
                flash: ['ad', 'base'],
                no: [
                    { t: 'The shrunken triangle must be quietly enlarged.',
                      why: 'Nothing may be quietly anything — the contradiction stands, and it convicts the tilt, not the triangle.' },
                    { t: 'Equal triangles cannot share a base after all.',
                      why: 'They share it happily — provided their peaks keep to one rail, which is exactly what was proved.' },
                ],
            },
        ],
    },
    {
        id: 'i40', ref: 'Book I. Proposition XL.',
        title: 'Equal triangles, equal bases',
        enun: 'Equal triangles on equal bases of one line, on the same side, lie between the same parallels.',
        view: '40 86 380 190',
        P: { A: [100, 110], B: [80, 250], C: [200, 250], D: [340, 110], E: [260, 250], F: [380, 250], S1: [60, 250], S2: [400, 250] },
        shapes: [
            { id: 'fA', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'red', s: 0, z: 0 },
            { id: 'fD', t: 'poly', ptsN: ['D', 'E', 'F'], c: 'blue', s: 0, z: 0 },
            { id: 'floor', t: 'line', p: 'S1', q: 'S2', c: 'black', w: 4, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'black', w: 4.5, s: 0 },
            { id: 'df', t: 'line', p: 'D', q: 'F', c: 'black', w: 4.5, s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'yellow', w: 4.5, s: 1 },
        ],
        steps: [
            {
                ask: 'Equal red and blue triangles, on equal bases of one floor, same side. Claim: the peak-join is parallel to the floor. The proof rhymes with which proposition?',
                ok: { t: 'Prop. XXXIX — suppose the join tilts, draw the true parallel, and a shrunken triangle appears; only now Prop. XXXVIII (equal bases) prices it.',
                      done: 'As in Prop. XXXIX: a supposed tilt yields a shrunken triangle, priced by Prop. XXXVIII.' },
                no: [
                    { t: 'Prop. XXXV — the shear.',
                      why: 'The shear compares parallelograms already between rails. Here the rail itself is on trial — the XXXIX gambit fits.' },
                    { t: 'No proposition — this one stands alone.',
                      why: 'Book I is a family: XL is XXXIX with Prop. XXXVIII swapped in for XXXVII, nearly word for word.' },
                ],
            },
            {
                ask: 'The shrunken triangle equals the red (Prop. XXXVIII), equals the blue (given), inside the blue. Sentence?',
                ok: { t: 'Part equal to whole — absurd. The join is parallel: equal triangles on equal bases keep their peaks to one rail.',
                      done: 'The absurdity dispatches the tilt: the peaks lie between the same parallels. Q.E.D.' },
                flash: ['ad', 'floor'],
                no: [
                    { t: 'The blue triangle must shed the difference.',
                      why: 'Triangles shed nothing — the false supposition does. It alone leaves the court.' },
                    { t: 'Absurd, unless the bases overlap a little.',
                      why: 'Overlap would break the “equal bases of one line” hypothesis before the absurdity is even reached. As given, the parallel stands.' },
                ],
            },
        ],
    },
    {
        id: 'i41', ref: 'Book I. Proposition XLI.',
        title: 'Double the triangle',
        enun: 'A parallelogram on the same base and between the same parallels as a triangle is double the triangle.',
        view: '40 86 380 190',
        P: { A: [100, 110], D: [240, 110], B: [120, 250], C: [260, 250], E: [340, 110], R1: [60, 110], R2: [400, 110] },
        shapes: [
            { id: 'fT', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'red', s: 1, z: 0 },
            { id: 'fE', t: 'poly', ptsN: ['E', 'B', 'C'], c: 'blue', s: 1, z: 0 },
            { id: 'rail', t: 'line', p: 'R1', q: 'R2', c: 'black', w: 4, s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'black', w: 4.5, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'eb', t: 'line', p: 'E', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ec', t: 'line', p: 'E', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'diag', t: 'line', p: 'A', q: 'C', c: 'yellow', w: 4.5, s: 1 },
        ],
        steps: [
            {
                ask: 'A parallelogram and a triangle share a base and rails. To weigh one against the other, what single line does Euclid add?',
                ok: { t: 'The parallelogram’s diagonal: it conjures a red triangle on the same base and rails as the blue one — equal, by Prop. XXXVII.',
                      done: 'The diagonal makes a red triangle equal to the blue one (Prop. XXXVII).' },
                no: [
                    { t: 'A perpendicular, to compare their heights.',
                      why: 'Heights whisper of measurement. The diagonal converts the whole question into triangles, which Prop. XXXVII settles.' },
                    { t: 'A second parallelogram around the triangle.',
                      why: 'Buildable, but backwards — one diagonal inside what we already have is thriftier.' },
                ],
            },
            {
                ask: 'The diagonal halves the parallelogram (Prop. XXXIV). Assemble the verdict.',
                ok: { t: 'Parallelogram = 2 × red triangle = 2 × blue triangle: the parallelogram is double the triangle.',
                      done: 'The parallelogram, twice its own half, is double the triangle. Q.E.D.' },
                flash: ['fT', 'fE'],
                no: [
                    { t: 'Parallelogram = 3 × triangle — it looks roomier.',
                      why: 'Rooms are counted, not eyeballed: half of it equals the triangle, so the whole is exactly double.' },
                    { t: 'They are equal — same base, same rails.',
                      why: 'Same base and rails equalises like with like: triangle with triangle (XXXVII), parallelogram with parallelogram (XXXV). Across kinds, the rate is two to one.' },
                ],
            },
        ],
    },
    {
        id: 'i42', ref: 'Book I. Proposition XLII.',
        title: 'A parallelogram to order',
        enun: 'To build a parallelogram equal in area to a given triangle, with a corner of any given angle.',
        view: '40 66 380 210',
        P: { A: [140, 90], B: [80, 250], C: [280, 250], E: [180, 250], F: [230, 90], G: [330, 90], R1: [60, 90], R2: [380, 90] },
        shapes: [
            { id: 'fT', t: 'poly', ptsN: ['A', 'B', 'C'], c: 'yellow', s: 0, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'dE', t: 'dot', at: 'E', r: 5, c: 'black', s: 1 },
            { id: 'ae', t: 'line', p: 'A', q: 'E', c: 'black', w: 3, dash: 1, s: 1 },
            { id: 'wE', t: 'wedge', at: 'E', from: 'C', to: 'F', r: 30, c: 'blue', s: 2, z: 0 },
            { id: 'ef', t: 'line', p: 'E', q: 'F', c: 'red', w: 5, s: 2 },
            { id: 'cg', t: 'line', p: 'C', q: 'G', c: 'red', w: 5, s: 2 },
            { id: 'fg', t: 'line', p: 'F', q: 'G', c: 'red', w: 5, s: 2 },
            { id: 'rail', t: 'line', p: 'R1', q: 'R2', c: 'black', w: 3, dash: 1, s: 2 },
        ],
        steps: [
            {
                ask: 'A triangle’s area must be recast as a parallelogram wearing a chosen corner angle. First stroke?',
                ok: { t: 'Bisect the base (Prop. X) and join the peak: two triangles on equal half-bases, each half the original (Prop. XXXVIII).',
                      done: 'The base is bisected; each half-triangle is half the whole (Prop. XXXVIII).' },
                no: [
                    { t: 'Copy the chosen angle onto the triangle’s peak.',
                      why: 'The angle’s hour comes next — first the area must be halved, for Prop. XLI will double whatever we build.' },
                    { t: 'Square the triangle first, then lean it over.',
                      why: 'Squaring is Book II’s feast. The half-base route needs only tools already forged.' },
                ],
            },
            {
                ask: 'On the half-base now: how does the chosen angle enter the build?',
                ok: { t: 'Copy it at the half-base’s end (Prop. XXIII), run the side to the peak’s rail, and close with a parallel (Prop. XXXI): a parallelogram in the chosen angle, on the half-base, between the rails.',
                      done: 'The chosen [blue-angle] is copied at the half-base (XXIII); parallels (XXXI) complete the parallelogram.' },
                no: [
                    { t: 'Bend the half-triangle’s corner to the chosen angle.',
                      why: 'Corners do not bend — they are copied (Prop. XXIII) onto fresh lines, and the parallels do the closing.' },
                    { t: 'The angle must equal the triangle’s own base angle.',
                      why: '“Any given angle” is the luxury on offer — obtuse, acute, whatever the customer ordered.' },
                ],
            },
            {
                ask: 'Parallelogram and half-triangle: same half-base, same rails. Price them.',
                ok: { t: 'The parallelogram is double that half-triangle (Prop. XLI) — and double a half is the whole: it equals the original triangle, in the angle of your choosing.',
                      done: 'By Prop. XLI the parallelogram doubles the half — equalling the whole triangle, in the given angle. Q.E.D.' },
                flash: ['fT', 'ef', 'cg', 'fg'],
                no: [
                    { t: 'The parallelogram falls short — it is visibly slimmer.',
                      why: 'Slim but long: Prop. XLI audits by base and rails, and finds double the half, exactly.' },
                    { t: 'Equal, but only when the chosen angle is right.',
                      why: 'The angle never entered the accounting — XXXVIII and XLI count area, blind to lean.' },
                ],
            },
        ],
    },
    {
        id: 'i43', ref: 'Book I. Proposition XLIII.',
        title: 'The complements',
        enun: 'In a parallelogram cut by its diagonal, the two complements about the diagonal are equal.',
        view: '80 76 320 210',
        P: { A: [100, 100], B: [340, 100], C: [380, 260], D: [140, 260], K: [226, 172], E: [118, 172], H: [358, 172], G: [208, 100], F: [248, 260] },
        shapes: [
            { id: 'cR', t: 'poly', ptsN: ['G', 'B', 'H', 'K'], c: 'red', s: 2, z: 0 },
            { id: 'cB', t: 'poly', ptsN: ['E', 'K', 'F', 'D'], c: 'blue', s: 2, z: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'black', w: 4.5, s: 0 },
            { id: 'bcs', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'cds', t: 'line', p: 'C', q: 'D', c: 'black', w: 4.5, s: 0 },
            { id: 'da', t: 'line', p: 'D', q: 'A', c: 'black', w: 4.5, s: 0 },
            { id: 'diag', t: 'line', p: 'A', q: 'C', c: 'yellow', w: 4.5, s: 0 },
            { id: 'eh', t: 'line', p: 'E', q: 'H', c: 'black', w: 3.5, s: 1 },
            { id: 'gf', t: 'line', p: 'G', q: 'F', c: 'black', w: 3.5, s: 1 },
            { id: 'dK', t: 'dot', at: 'K', r: 5, c: 'black', s: 1 },
        ],
        steps: [
            {
                ask: 'Through a point on the diagonal run two lines, each parallel to a side. Four little parallelograms appear: two threaded on the diagonal, two — the complements — beside it. What does the diagonal do to the big parallelogram and to each threaded one?',
                ok: { t: 'Halves all three (Prop. XXXIV): the whole into two big triangles, and each threaded parallelogram into two little ones.',
                      done: 'The diagonal halves the whole and both threaded parallelograms (Prop. XXXIV).' },
                no: [
                    { t: 'It halves the whole, but merely clips the threaded ones.',
                      why: 'Look truer: the diagonal is a genuine diagonal of each threaded parallelogram too — Prop. XXXIV halves them just the same.' },
                    { t: 'It divides all four little parallelograms.',
                      why: 'The two complements never touch the diagonal — they sit beside it. Only the threaded pair is cut.' },
                ],
            },
            {
                ask: 'Take one big half-triangle. Inside it sit: a little half, a complement, and nothing else. Its twin across the diagonal holds the matching set. Subtract.',
                ok: { t: 'Equal big halves, less equal little halves at each end, leave the two complements — equal, without ever knowing their shapes.',
                      done: 'Equal halves less equal halves: the [red-tri]-side complement equals its opposite. The complements are equal. Q.E.D.' },
                flash: ['cR', 'cB'],
                no: [
                    { t: 'The complements match only if the point is the diagonal’s middle.',
                      why: 'Slide the point anywhere on the diagonal — the subtraction holds at every station. That freedom is the proposition’s power (Prop. XLIV will spend it).' },
                    { t: 'Congruent shapes were needed for equality.',
                      why: 'The complements are usually quite different shapes! Equal area without congruence — area arithmetic at its purest.' },
                ],
            },
        ],
    },
    {
        id: 'i44', ref: 'Book I. Proposition XLIV.',
        title: 'Applying an area to a line',
        enun: 'To a given straight line, to apply a parallelogram equal to a given triangle, in a given angle.',
        view: '60 70 340 210',
        P: { L1: [80, 250], L2: [240, 250], M1: [120, 130], M2: [280, 130], T1: [300, 90], T2: [260, 200], T3: [380, 200] },
        shapes: [
            { id: 'fT', t: 'poly', ptsN: ['T1', 'T2', 'T3'], c: 'yellow', s: 0, z: 0 },
            { id: 'line', t: 'line', p: 'L1', q: 'L2', c: 'black', w: 5.5, s: 0 },
            { id: 's1', t: 'line', p: 'L1', q: 'M1', c: 'red', w: 5, s: 1 },
            { id: 's2', t: 'line', p: 'L2', q: 'M2', c: 'red', w: 5, s: 1 },
            { id: 's3', t: 'line', p: 'M1', q: 'M2', c: 'red', w: 5, s: 1 },
        ],
        steps: [
            {
                ask: 'The customer hands us a line and a triangle: “a parallelogram of exactly this area, standing exactly on this line, in my angle.” Where does the area come from?',
                ok: { t: 'Prop. XLII casts the triangle as a parallelogram in the right angle — but standing loose, not on our line. It must be dragged aboard without changing size.',
                      done: 'By Prop. XLII the triangle becomes a parallelogram in the given angle — loose, beside the line.' },
                no: [
                    { t: 'Stretch the line until a parallelogram fits naturally.',
                      why: 'The line is the customer’s — sacred and unstretchable. The area must come to it.' },
                    { t: 'Cut the triangle into strips and pave the line.',
                      why: 'Paving is for floors. Euclid drags areas whole, with the machinery of the complements.' },
                ],
            },
            {
                ask: 'And the dragging itself — which proposition is the engine?',
                ok: { t: 'Prop. XLIII: build the loose parallelogram as one complement about a diagonal, with our line framing the other — the complements being equal, the area lands on the line, angle intact.',
                      done: 'Prop. XLIII’s equal complements transfer the area onto the given line, in the given angle. Q.E.D.' },
                flash: ['fT', 's1', 's2', 's3'],
                no: [
                    { t: 'Prop. XXXV — shear it along until it arrives.',
                      why: 'Shearing keeps the base — and ours must change base entirely. Only the complements swap an area onto a new line.' },
                    { t: 'Prop. IV — congruent triangles carry it.',
                      why: 'Congruence carries shapes; here the shape must surrender (new base, new proportions) while the area alone survives. That is XLIII’s specialty.' },
                ],
            },
        ],
    },
    {
        id: 'i45', ref: 'Book I. Proposition XLV.',
        title: 'Any figure, one parallelogram',
        enun: 'To build a parallelogram equal to any straight-sided figure, in a given angle.',
        view: '60 60 400 190',
        P: { Q1: [80, 120], Q2: [210, 80], Q3: [260, 200], Q4: [120, 230], P1: [300, 90], P2: [400, 90], P3: [420, 160], P4: [320, 160], P5: [440, 230], P6: [340, 230] },
        shapes: [
            { id: 'fQ', t: 'poly', ptsN: ['Q1', 'Q2', 'Q3', 'Q4'], c: 'yellow', s: 0, z: 0 },
            { id: 'dg', t: 'line', p: 'Q1', q: 'Q3', c: 'black', w: 3, dash: 1, s: 1 },
            { id: 'fP1', t: 'poly', ptsN: ['P1', 'P2', 'P3', 'P4'], c: 'red', s: 2, z: 0 },
            { id: 'fP2', t: 'poly', ptsN: ['P4', 'P3', 'P5', 'P6'], c: 'blue', s: 2, z: 0 },
        ],
        steps: [
            {
                ask: 'A four-sided (or forty-sided!) figure must become a single parallelogram. What is the first act of demolition?',
                ok: { t: 'Diagonals: any straight-sided figure splits into triangles — the universal currency of area.',
                      done: 'The figure is cut by diagonals into triangles.' },
                no: [
                    { t: 'Trim the corners until the figure is rectangular.',
                      why: 'Trimming discards area, and area is the treasure. Diagonals cut without losing a speck.' },
                    { t: 'Roll the figure into a circle for safekeeping.',
                      why: 'The circle keeps its counsel until Book XII. Triangles are the honest bank of Book I.' },
                ],
            },
            {
                ask: 'A pile of triangles, one target angle. How are they minted and merged?',
                ok: { t: 'Each becomes a parallelogram in the angle (Prop. XLII), applied to a shared side in turn (Prop. XLIV) — the pieces stack flush into one parallelogram equal to the whole figure.',
                      done: 'Each triangle, minted by XLII and applied by XLIV, stacks into one parallelogram equal to the figure. Q.E.D.' },
                flash: ['fQ', 'fP1', 'fP2'],
                no: [
                    { t: 'Average the triangles and build from the mean.',
                      why: 'Areas add; they do not average. Each triangle is converted whole and butted against the last.' },
                    { t: 'Only two triangles can ever be merged.',
                      why: 'XLIV applies to a line as often as asked — each new piece docks onto the growing stack’s edge, without limit.' },
                ],
            },
        ],
    },
    {
        id: 'i46', ref: 'Book I. Proposition XLVI.',
        title: 'To describe a square',
        enun: 'Upon a given straight line, to describe a square.',
        view: '100 40 240 250',
        P: { A: [140, 250], B: [300, 250], D: [140, 90], E: [300, 90], Up: [140, 70] },
        shapes: [
            { id: 'fSq', t: 'poly', ptsN: ['A', 'D', 'E', 'B'], c: 'yellow', s: 3, z: 0 },
            { id: 'base', t: 'line', p: 'A', q: 'B', c: 'black', w: 5, s: 0 },
            { id: 'up', t: 'line', p: 'A', q: 'Up', c: 'black', w: 3, dash: 1, s: 1 },
            { id: 'ra', t: 'path', d: 'M 152 250 L 152 238 L 140 238', c: 'black', w: 2.5, s: 1 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'red', w: 5, s: 2 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 2 },
            { id: 'de', t: 'line', p: 'D', q: 'E', c: 'blue', w: 5, s: 3 },
            { id: 'be', t: 'line', p: 'B', q: 'E', c: 'blue', w: 5, s: 3 },
            { id: 'rd', t: 'path', d: 'M 140 102 L 152 102 L 152 90', c: 'black', w: 2.5, s: 3 },
            { id: 're', t: 'path', d: 'M 288 90 L 288 102 L 300 102', c: 'black', w: 2.5, s: 3 },
            { id: 'rb', t: 'path', d: 'M 300 238 L 288 238 L 288 250', c: 'black', w: 2.5, s: 3 },
        ],
        steps: [
            {
                ask: 'At last, the square itself — never yet built in the Elements. Upon the [black-line], the first stroke is?',
                ok: { t: 'A perpendicular raised at one end (Prop. XI): the square’s corner must be right, so a right angle is laid first.',
                      done: 'A perpendicular is raised at one end of the [black-line] (Prop. XI).' },
                no: [
                    { t: 'Four quick strokes of equal length, by eye.',
                      why: 'Forty-five propositions were not suffered so that the square could be guessed at the end. Each stroke is earned.' },
                    { t: 'A circle about each end, as in Prop. I.',
                      why: 'Those circles birth the equilateral triangle. The square’s parent is the right angle, from Prop. XI.' },
                ],
            },
            {
                ask: 'The perpendicular runs long. What tames it?',
                ok: { t: 'Prop. III: cut it to the [black-line]’s own length — the [red-line] side, equal to the base and square to it.',
                      done: 'The perpendicular is cut (Prop. III) to the base’s length: the [red-line] side stands.' },
                no: [
                    { t: 'Leave it long — the top side will trim it.',
                      why: 'Then the “square” would be as tall as chance allowed. The side is cut first, exactly.' },
                    { t: 'Fold it down along the base to compare.',
                      why: 'Ever the folding temptation, ever refused! Prop. III cuts lengths without bending a thing.' },
                ],
            },
            {
                ask: 'Base and one side, equal and square. Complete the figure, and justify its right to the name.',
                ok: { t: 'Parallels through the two loose ends (Prop. XXXI) close it; opposite sides equal (Prop. XXXIV) make all four equal; co-interior angles with the right one total two rights (Prop. XXIX), so every corner is right. A square, certified.',
                      done: 'Closed by parallels (XXXI): all sides equal (XXXIV), all angles right (XXIX). The square is described. Q.E.D.' },
                flash: ['fSq'],
                no: [
                    { t: 'Close it and measure the last two sides to be sure.',
                      why: 'Prop. XXXIV is surer than any ruler: opposite sides of a parallelogram are equal, and the corners follow by XXIX.' },
                    { t: 'The fourth angle must be checked separately.',
                      why: 'No angle escapes: each is co-interior with a right angle between parallels — XXIX squares them all at a stroke.' },
                ],
            },
        ],
        build: {
            seed: [[[140, 250], [300, 250]]],
            needs: ['perp'],
            targets: [
                { t: 'circle', cx: 140, cy: 250, r: 160, ink: 'red',
                  instr: 'Sweep a [red-circle] about the base’s left end, through its right end — the side’s length, held ready.',
                  miss: 'Press on the left end and drag to the right end: the base itself is the radius.' },
                { t: 'seg', from: [140, 250], dir: [0, -1], minLen: 168, ink: 'black',
                  instr: 'Raise a line from the left end, square to the base (the Perpendiculars instrument), up and out through the [red-circle].',
                  miss: 'Drag out of the left end straight upward until the line snaps square — and carry on past the red circle’s rim.' },
                { t: 'circle', cx: 300, cy: 250, r: 160, ink: 'blue',
                  instr: 'Sweep a [blue-circle] about the right end, through the left.',
                  miss: 'Press on the right end and drag to the left end.' },
                { t: 'seg', from: [140, 90], dir: [1, 0], minLen: 168, ink: 'black',
                  instr: 'From the corner where your upright cut the [red-circle], run a line square across, out through the [blue-circle].',
                  miss: 'Drag out of the upright’s crossing with the red circle, straight across until the line snaps square and passes the blue circle.' },
                { t: 'seg', x1: 300, y1: 250, x2: 300, y2: 90, ink: 'yellow',
                  instr: 'Close the square: join the base’s right end up to where that line touched the [blue-circle].',
                  miss: 'Draw from the base’s right end straight up to the top line’s touching point on the blue circle.' },
            ],
            qed: 'Equal sides all round, every corner right — the square stands, and Prop. XLVII is waiting for it.',
        },
    },
    {
        id: 'i48', ref: 'Book I. Proposition XLVIII.',
        title: 'Pythagoras, reversed',
        enun: 'If the square on one side of a triangle equals the squares on the other two together, the angle between those two is right.',
        view: '80 40 340 360',
        P: { A: [160, 220], B: [150, 80], C: [340, 220], D: [160, 360.4] },
        shapes: [
            { id: 'ac', t: 'line', p: 'A', q: 'C', c: 'black', w: 5, s: 0 },
            { id: 'ab', t: 'line', p: 'A', q: 'B', c: 'red', w: 5, s: 0 },
            { id: 'bc', t: 'line', p: 'B', q: 'C', c: 'black', w: 4.5, s: 0 },
            { id: 'ad', t: 'line', p: 'A', q: 'D', c: 'blue', w: 5, s: 1 },
            { id: 'ra', t: 'path', d: 'M 160 232 L 172 232 L 172 220', c: 'black', w: 2.5, s: 1 },
            { id: 'dD', t: 'dot', at: 'D', r: 5, c: 'black', s: 1 },
            { id: 'dc', t: 'line', p: 'D', q: 'C', c: 'yellow', w: 4, dash: 1, s: 2 },
        ],
        steps: [
            {
                ask: 'Given only an equation of squares — far side² = [red-line]² + base² — we must convict the corner of being right. Euclid summons a witness. How is it built?',
                ok: { t: 'At the corner, on the far side of the base, raise a true perpendicular (Prop. XI) and cut it to the [red-line]’s length (Prop. III): the [blue-line] witness.',
                      done: 'A witness [blue-line] is raised truly perpendicular at the corner, equal to the [red-line].' },
                no: [
                    { t: 'Assume the corner right and see if the equation holds.',
                      why: 'It would — but that is Prop. XLVII travelling forwards. The return journey needs a separately built right angle to compare against.' },
                    { t: 'Bisect the suspect corner to inspect its halves.',
                      why: 'Halves of an unknown are two unknowns. The witness triangle, built right by construction, is the standard to hold against it.' },
                ],
            },
            {
                ask: 'Join the witness’s tip to the far end. The witness triangle is right-angled by construction — what does Prop. XLVII certify about its joining side?',
                ok: { t: 'Joining side² = [blue-line]² + base² = [red-line]² + base² = far side²: the joining side equals the triangle’s far side.',
                      done: 'By Prop. XLVII and the given equation, the witness’s joining side equals the far side.' },
                flash: ['dc', 'bc'],
                no: [
                    { t: 'That it equals the base.',
                      why: 'It answers to the squares’ sum, not to one of the summands: XLVII prices it against blue² + base², which is the far side’s worth.' },
                    { t: 'Nothing — Prop. XLVII serves only the original triangle.',
                      why: 'XLVII serves every right triangle, and the witness is one by construction. That is exactly why the witness was built.' },
                ],
            },
            {
                ask: 'Two triangles: [red-line] = [blue-line], the base common, far side = joining side. Deliver the reversal.',
                ok: { t: 'Side-side-side (Prop. VIII): the triangles are equal, so the suspect corner equals the witness’s corner — which was built right. Book I closes with the theorem turned perfectly on its heel.',
                      done: 'By Prop. VIII the suspect angle equals the constructed right angle: it is right. Q.E.D.' },
                flash: ['ab', 'ad', 'ra'],
                no: [
                    { t: 'Prop. IV — but no included angle is known equal.',
                      why: 'Quite so — which is why it must be Prop. VIII, the congruence that runs on sides alone.' },
                    { t: 'The triangles merely overlap; nothing follows.',
                      why: 'They share every side length, pair for pair — Prop. VIII fuses them, corner for corner, and the right angle transfers.' },
                ],
            },
        ],
    },
    // __MORE_PROPS__
    ];
    MORE_PROPS.forEach((p) => PROPS.push(p));
    // Menu order: Book I in Euclid's numbering, then Book III.
    const gpOrd = (id) => (id.startsWith('iii') ? 3000 + parseInt(id.slice(3), 10) : 1000 + parseInt(id.slice(1), 10));
    PROPS.sort((a, b) => gpOrd(a.id) - gpOrd(b.id));

    /* ========================================================================
     * SVG BUILDING
     * ======================================================================*/
    function gpShapeEl(sh) {
        const mk = (t) => document.createElementNS(SVGNS, t);
        const col = sh.c ? GP_C[sh.c] : 'none';
        let el;
        if (sh.t === 'line') {
            el = mk('line');
            el.setAttribute('x1', sh.x1); el.setAttribute('y1', sh.y1);
            el.setAttribute('x2', sh.x2); el.setAttribute('y2', sh.y2);
            el.setAttribute('stroke', col);
            el.setAttribute('stroke-width', sh.w || 4);
            el.setAttribute('stroke-linecap', 'round');
            if (sh.dash) el.setAttribute('stroke-dasharray', '10 8');
            el.setAttribute('fill', 'none');
        } else if (sh.t === 'circle') {
            el = mk('circle');
            el.setAttribute('cx', sh.cx); el.setAttribute('cy', sh.cy); el.setAttribute('r', sh.r);
            el.setAttribute('fill', 'none');
            el.setAttribute('stroke', col);
            el.setAttribute('stroke-width', sh.w || 3);
        } else if (sh.t === 'dot') {
            el = mk('circle');
            el.setAttribute('cx', sh.cx); el.setAttribute('cy', sh.cy); el.setAttribute('r', sh.r || 5);
            el.setAttribute('fill', col);
        } else if (sh.t === 'poly') {
            el = mk('polygon');
            el.setAttribute('points', sh.pts.map((p) => p.join(',')).join(' '));
            el.setAttribute('fill', col);
            el.setAttribute('stroke', sh.outline ? GP_C.black : 'none');
            el.setAttribute('stroke-width', sh.w || 2);
            el.setAttribute('stroke-linejoin', 'round');
        } else if (sh.t === 'wedge') {
            el = mk('path');
            el.setAttribute('d', wedgeD(sh.cx, sh.cy, sh.r, sh.a0, sh.a1));
            el.setAttribute('fill', col);
        } else if (sh.t === 'path') {
            el = mk('path');
            el.setAttribute('d', sh.d);
            el.setAttribute('fill', 'none');
            el.setAttribute('stroke', col);
            el.setAttribute('stroke-width', sh.w || 3);
            el.setAttribute('stroke-linejoin', 'round');
        }
        el.dataset.gpId = sh.id;
        el.dataset.gpStep = sh.s;
        return el;
    }

    // Named-point resolution: props may declare `P: {A:[x,y], ...}` and write
    // shapes as {t:'line',p:'A',q:'B'}, {t:'dot',at:'A'}, {t:'circle',at:'A',
    // thru:'B'}, {t:'poly',ptsN:['A','B','C']}, {t:'wedge',at:'B',from:'A',
    // to:'C'}. Wedge angles are computed (always the non-reflex side), which
    // removes hand-entered trigonometry as an error source.
    function gpResolve(prop, sh) {
        if (!prop.P) return sh;
        const XY = (n) => prop.P[n];
        const out = Object.assign({}, sh);
        if (sh.p) { const [x, y] = XY(sh.p), [x2, y2] = XY(sh.q); out.x1 = x; out.y1 = y; out.x2 = x2; out.y2 = y2; }
        if (sh.at && (sh.t === 'dot' || sh.t === 'circle' || sh.t === 'wedge')) {
            const [cx, cy] = XY(sh.at); out.cx = cx; out.cy = cy;
        }
        if (sh.t === 'circle' && sh.thru) {
            const [tx, ty] = XY(sh.thru);
            out.r = Math.hypot(tx - out.cx, ty - out.cy);
        }
        if (sh.ptsN) out.pts = sh.ptsN.map((n) => XY(n));
        if (sh.t === 'wedge' && sh.from) {
            const [fx, fy] = XY(sh.from), [tx, ty] = XY(sh.to);
            const deg = (dy, dx) => Math.atan2(dy, dx) * 180 / Math.PI;
            let a0 = deg(fy - out.cy, fx - out.cx);
            let a1 = deg(ty - out.cy, tx - out.cx);
            let d = ((a1 - a0) % 360 + 360) % 360;
            if (d > 180) { const t = a0; a0 = a1; a1 = t; d = 360 - d; }
            out.a0 = a0; out.a1 = a0 + d;
            out.r = sh.r || 38;
        }
        return out;
    }

    function gpBuildSVG(prop, revealAll) {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', prop.view);
        // Stable sort: fills (z:0) beneath linework (default z:1)
        prop.shapes
            .slice()
            .sort((a, b) => (a.z ?? 1) - (b.z ?? 1))
            .forEach((sh) => {
                const el = gpShapeEl(gpResolve(prop, sh));
                if (!revealAll && sh.s > 0) el.classList.add('gp-hidden');
                el.dataset.gpId = sh.id;
                el.dataset.gpStep = sh.s;
                svg.appendChild(el);
            });
        return svg;
    }

    // Reveal a shape: stroked outlines draw themselves in; fills fade in.
    function gpReveal(el) {
        el.classList.remove('gp-hidden');
        const stroked = el.getAttribute('fill') === 'none' && !el.getAttribute('stroke-dasharray');
        if (stroked && typeof el.getTotalLength === 'function') {
            try {
                const len = el.getTotalLength();
                el.style.strokeDasharray = len;
                el.style.strokeDashoffset = len;
                void el.getBoundingClientRect();
                el.style.transition = 'stroke-dashoffset 0.8s ease';
                el.style.strokeDashoffset = '0';
                setTimeout(() => {
                    el.style.strokeDasharray = '';
                    el.style.strokeDashoffset = '';
                    el.style.transition = '';
                }, 900);
                return;
            } catch (e) { /* fall through to fade */ }
        }
        el.classList.add('gp-fadein');
    }

    function gpFlash(ids) {
        const svg = document.querySelector('#gp-board svg');
        if (!svg) return;
        ids.forEach((id) => {
            const el = svg.querySelector(`[data-gp-id="${id}"]`);
            if (!el) return;
            el.classList.remove('gp-flash');
            void el.getBoundingClientRect();
            el.classList.add('gp-flash');
        });
    }

    /* ========================================================================
     * GAME FLOW
     * ======================================================================*/
    const gp = { prop: null, step: 0, mistakes: 0 };
    const $ = (id) => document.getElementById(id);
    const doneKey = (p) => `gpDone_${p.id}`;

    function gpShowMenu() {
        $('gp-proof').classList.add('hidden');
        const menu = $('gp-menu');
        menu.classList.remove('hidden');
        menu.innerHTML = '';
        PROPS.forEach((prop) => {
            const card = document.createElement('div');
            card.className = 'gp-card';
            card.dataset.prop = prop.id;
            const seals = [
                localStorage.getItem(doneKey(prop)) === '1' ? '<em class="gp-card-done">∎ proved</em>' : '',
                prop.build && localStorage.getItem(builtKey(prop)) === '1' ? '<em class="gp-card-built">△ built</em>' : '',
            ].filter(Boolean).join(' ');
            card.innerHTML =
                `<span class="gp-card-ref">${prop.ref}</span>` +
                `<span class="gp-card-title">${prop.title}</span>` +
                `<span class="gp-card-meta">${prop.steps.length} steps${seals ? ' · ' + seals : ''}</span>` +
                '<span class="gp-card-acts">' +
                '<button class="gp-btn gp-card-act" data-act="prove">Prove it</button>' +
                (prop.build ? '<button class="gp-btn gp-card-act" data-act="build">Build it</button>' : '') +
                '</span>';
            card.insertBefore(gpBuildSVG(prop, true), card.firstChild);
            menu.appendChild(card);
        });
    }

    function gpStart(prop) {
        gp.prop = prop;
        gp.step = 0;
        gp.mistakes = 0;
        $('gp-menu').classList.add('hidden');
        $('gp-proof').classList.remove('hidden');
        $('gp-qed').classList.add('hidden');
        $('gp-ask').classList.remove('hidden');
        $('gp-ref').textContent = prop.ref;
        $('gp-prop-title').textContent = prop.title;
        $('gp-enun').innerHTML = gpGlyphs(prop.enun);
        $('gp-ledger').innerHTML = '';
        const board = $('gp-board');
        board.innerHTML = '';
        board.appendChild(gpBuildSVG(prop, false));
        gpAsk();
    }

    function gpAsk() {
        const st = gp.prop.steps[gp.step];
        $('gp-stepnum').textContent = `Step ${gp.step + 1} of ${gp.prop.steps.length}`;
        $('gp-prompt').innerHTML = gpGlyphs(st.ask);
        $('gp-note').innerHTML = '';
        const box = $('gp-choices');
        box.innerHTML = '';
        const choices = shuffle([
            { t: st.ok.t, ok: true },
            ...st.no.map((w) => ({ t: w.t, why: w.why })),
        ]);
        choices.forEach((ch, i) => {
            const btn = document.createElement('button');
            btn.className = 'gp-choice';
            btn.innerHTML = gpGlyphs(ch.t);
            btn.dataset.idx = i;
            btn._gpChoice = ch;
            box.appendChild(btn);
        });
    }

    function gpPick(btn) {
        const ch = btn._gpChoice;
        if (!ch || btn.disabled) return;
        if (!ch.ok) {
            gp.mistakes++;
            btn.disabled = true;
            btn.classList.add('gp-wrong', 'gp-shake');
            $('gp-note').innerHTML = gpGlyphs(ch.why);
            return;
        }
        const st = gp.prop.steps[gp.step];
        // Reveal every shape tagged with this step number
        document.querySelectorAll(`#gp-board svg [data-gp-step="${gp.step + 1}"]`)
            .forEach(gpReveal);
        if (st.flash) setTimeout(() => gpFlash(st.flash), 500);
        // Append to the ledger
        const li = document.createElement('li');
        li.className = 'gp-fadein';
        li.innerHTML = `<span class="gp-ln">${gpRoman(gp.step + 1)}.</span>${gpGlyphs(st.ok.done)}`;
        $('gp-ledger').appendChild(li);
        gp.step++;
        if (gp.step >= gp.prop.steps.length) gpFinish();
        else gpAsk();
    }

    function gpFinish() {
        localStorage.setItem(doneKey(gp.prop), '1');
        sbInstrumentsRender(); // a proved proposition may enlarge the sandbox kit
        $('gp-ask').classList.add('hidden');
        const qed = $('gp-qed');
        qed.classList.remove('hidden');
        qed.classList.add('gp-fadein');
        $('gp-qed-score').textContent =
            gp.mistakes === 0
                ? 'Proved without a single misstep — Euclid himself could do no better.'
                : `Proved, after ${gp.mistakes} wrong turn${gp.mistakes === 1 ? '' : 's'} along the way.`;
    }

    /* ========================================================================
     * SANDBOX — free-form straightedge & compass with key-point snapping.
     *
     * Model: points are the atoms ({id,x,y,kind}); segments reference two
     * point ids, circles a centre point id + radius, so constructions stay
     * exact. Every commit recomputes intersections of the new object against
     * all existing ones and registers them as key points ('x'). Snapping:
     *  - segment ends and circle centres snap to the nearest key point,
     *  - a segment dragged out of an existing endpoint snaps to the collinear
     *    extension of a segment through that endpoint (Euclid's "produce"),
     *  - a growing circle rim sticks when its radius passes within tolerance
     *    of a key point's distance from the centre (the Euclidean compass:
     *    centre + a point it passes through).
     * ======================================================================*/
    const SB_SNAP = 14;   // px (viewBox units): point snapping radius
    const SB_RIM  = 11;   // rim stick tolerance
    const sbState = {
        inited: false,
        pts: [], objs: [], undo: [], nextId: 1,
        tool: 'seg', ink: 'red',
        drag: null,
    };
    let gpMode = 'props';

    /* ---- pure geometry ---- */
    function segSegX(a, b) {
        const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1;
        const d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 1e-9) return [];
        const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
        const u = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / den;
        if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return [];
        return [{ x: a.x1 + t * d1x, y: a.y1 + t * d1y }];
    }
    function segCircleX(s, c) {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const fx = s.x1 - c.cx, fy = s.y1 - c.cy;
        const A = dx * dx + dy * dy;
        const B = 2 * (fx * dx + fy * dy);
        const C = fx * fx + fy * fy - c.r * c.r;
        let disc = B * B - 4 * A * C;
        if (disc < 0 || A < 1e-12) return [];
        disc = Math.sqrt(disc);
        const out = [];
        for (const t of [(-B - disc) / (2 * A), (-B + disc) / (2 * A)]) {
            if (t >= -1e-6 && t <= 1 + 1e-6) out.push({ x: s.x1 + t * dx, y: s.y1 + t * dy });
        }
        if (out.length === 2 && Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y) < 1e-6) out.pop();
        return out;
    }
    function circleCircleX(a, b) {
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        const d = Math.hypot(dx, dy);
        if (d < 1e-9 || d > a.r + b.r + 1e-9 || d < Math.abs(a.r - b.r) - 1e-9) return [];
        const al = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
        const h2 = a.r * a.r - al * al;
        const h = h2 > 0 ? Math.sqrt(h2) : 0;
        const mx = a.cx + al * dx / d, my = a.cy + al * dy / d;
        if (h < 1e-9) return [{ x: mx, y: my }];
        return [
            { x: mx + h * dy / d, y: my - h * dx / d },
            { x: mx - h * dy / d, y: my + h * dx / d },
        ];
    }

    /* ---- model ---- */
    function sbPt(id) { return sbState.pts.find((p) => p.id === id); }
    function sbAddPt(x, y, kind) {
        for (const p of sbState.pts) {
            if (Math.hypot(p.x - x, p.y - y) < 0.75) return p.id;
        }
        const id = sbState.nextId++;
        sbState.pts.push({ id, x, y, kind });
        return id;
    }
    function sbGeom(o) {
        if (o.t === 'seg') {
            const a = sbPt(o.a), b = sbPt(o.b);
            return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
        }
        const c = sbPt(o.c);
        return { cx: c.x, cy: c.y, r: o.r };
    }
    // Register intersections with everything already drawn, then add the object.
    function sbCommitObj(o) {
        const A = sbGeom(o);
        for (const other of sbState.objs) {
            const B = sbGeom(other);
            let hits;
            if (o.t === 'seg' && other.t === 'seg') hits = segSegX(A, B);
            else if (o.t === 'seg') hits = segCircleX(A, B);
            else if (other.t === 'seg') hits = segCircleX(B, A);
            else hits = circleCircleX(A, B);
            hits.forEach((h) => sbAddPt(h.x, h.y, 'x'));
        }
        sbState.objs.push(o);
    }
    function sbSnapshot() {
        sbState.undo.push(JSON.stringify({ pts: sbState.pts, objs: sbState.objs, nextId: sbState.nextId }));
        if (sbState.undo.length > 60) sbState.undo.shift();
    }
    function sbUndo() {
        const s = sbState.undo.pop();
        if (!s) return;
        const d = JSON.parse(s);
        sbState.pts = d.pts; sbState.objs = d.objs; sbState.nextId = d.nextId;
        sbRender();
    }

    const SB_SEEDS = {
        blank:    [],
        segment:  [[[140, 230], [340, 230]]],
        cross:    [[[100, 110], [380, 270]], [[100, 270], [380, 110]]],
        triangle: [[[110, 290], [240, 90]], [[240, 90], [380, 290]], [[380, 290], [110, 290]]],
        right:    [[[140, 280], [212, 184]], [[212, 184], [340, 280]], [[340, 280], [140, 280]]],
    };
    // Seed spec: either a plain array of segments, or {segs:[...], pts:[[x,y],...]}
    // (bare points, e.g. the floating point of Prop. I.2 / I.12).
    function sbSeedList(seed) {
        sbState.pts = []; sbState.objs = []; sbState.undo = []; sbState.nextId = 1;
        sbState.drag = null;
        const spec = Array.isArray(seed) ? { segs: seed } : (seed || {});
        (spec.pts || []).forEach(([x, y]) => sbAddPt(x, y, 'end'));
        (spec.segs || []).forEach(([p1, p2]) => {
            const a = sbAddPt(p1[0], p1[1], 'end');
            const b = sbAddPt(p2[0], p2[1], 'end');
            sbCommitObj({ t: 'seg', a, b, ink: 'black' });
        });
        sbRender();
    }
    function sbSeed(name) { sbSeedList(SB_SEEDS[name]); }

    /* ---- instruments: the toolkit grows as propositions are completed ----
     * Completing a proposition (proved or built) unlocks its construction as
     * a snap power, simulating Euclid's own bootstrapping: once a move is
     * proved possible, it may be used in one stroke thereafter. */
    const SB_INSTRUMENTS = [
        { key: 'extend', label: 'Produce lines', prop: null,
          title: 'Drag out of an endpoint to extend a line straight on. Always in the kit (Postulate 2).' },
        { key: 'carry', label: 'Carry lengths', prop: 'i2', also: 'i3', req: 'I.2–3',
          title: 'The compass no longer collapses: a growing circle sticks at the length of any drawn line. Earned by Prop. I.2/I.3.' },
        { key: 'bisect', label: 'Bisect angles', prop: 'i9', req: 'I.9',
          title: 'A line drawn out of a corner snaps to the direction that halves the angle. Earned by Prop. I.9.' },
        { key: 'mid', label: 'Midpoints', prop: 'i10', req: 'I.10',
          title: 'Every line shows its midpoint as a snap point. Earned by Prop. I.10.' },
        { key: 'perp', label: 'Perpendiculars', prop: 'i11', also: 'i12', req: 'I.11–12',
          title: 'A line drawn from a point on a line snaps square to it. Earned by Prop. I.11/I.12.' },
        { key: 'para', label: 'Parallels', prop: 'i31', req: 'I.31',
          title: 'New lines snap parallel to existing lines. Earned by Prop. I.31.' },
    ];
    function sbHas(key) {
        const ins = SB_INSTRUMENTS.find((i) => i.key === key);
        if (!ins || !ins.prop) return true;
        const won = (id) => id && (localStorage.getItem(`gpDone_${id}`) === '1' || localStorage.getItem(`gpBuilt_${id}`) === '1');
        return won(ins.prop) || won(ins.also);
    }
    function sbInstrumentsRender() {
        const el = document.getElementById('gp-sb-instruments');
        if (!el) return;
        el.innerHTML = SB_INSTRUMENTS.map((ins) => {
            const on = sbHas(ins.key);
            return `<span class="gp-sb-inst${on ? ' on' : ''}" title="${ins.title}">` +
                `${ins.label}${on ? '' : ` <small>${ins.req}</small>`}</span>`;
        }).join('');
    }
    // Derived snap points that exist only once earned (currently: midpoints).
    function sbVirtualPts() {
        if (!sbHas('mid')) return [];
        const out = [];
        for (const o of sbState.objs) {
            if (o.t !== 'seg') continue;
            const g = sbGeom(o);
            const mx = (g.x1 + g.x2) / 2, my = (g.y1 + g.y2) / 2;
            if (sbState.pts.some((p) => Math.hypot(p.x - mx, p.y - my) < 1)) continue;
            out.push({ x: mx, y: my, virtual: 'mid' });
        }
        return out;
    }

    /* ---- snapping ---- */
    function sbSnapAt(x, y, excludeId) {
        let best = null, bd = SB_SNAP;
        for (const p of sbState.pts.concat(sbVirtualPts())) {
            if (p.id != null && p.id === excludeId) continue;
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bd) { bd = d; best = p; }
        }
        return best;
    }
    // Radius stick: at a key point's distance from the centre, or (once
    // 'carry' is earned) at the length of any drawn segment.
    function sbRimSnap(cx, cy, r, centerId) {
        let best = null, bd = SB_RIM;
        for (const p of sbState.pts.concat(sbVirtualPts())) {
            if (p.id != null && p.id === centerId) continue;
            const rp = Math.hypot(p.x - cx, p.y - cy);
            if (rp < 6) continue;
            const d = Math.abs(rp - r);
            if (d < bd) { bd = d; best = { x: p.x, y: p.y, r: rp }; }
        }
        if (sbHas('carry')) {
            for (const o of sbState.objs) {
                if (o.t !== 'seg') continue;
                const g = sbGeom(o);
                const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
                if (len < 6) continue;
                const d = Math.abs(len - r);
                if (d < bd) { bd = d; best = { lenOnly: true, r: len, g }; }
            }
        }
        return best;
    }
    // Direction snapping for the straightedge. Candidates grow with the kit:
    //  - always: collinear extension out of an endpoint ("produce the line")
    //  - bisect: the bisector of any two rays out of the start point
    //  - perp:   square to any segment the start point lies on
    //  - para:   parallel to any other segment
    function sbDirSnap(p0id, x0, y0, x, y) {
        const vx = x - x0, vy = y - y0;
        const len = Math.hypot(vx, vy);
        if (len < 1e-6) return null;
        const dirs = [];
        const rays = [];
        for (const o of sbState.objs) {
            if (o.t !== 'seg') continue;
            const g = sbGeom(o);
            const d = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
            if (d < 1e-6) continue;
            const ux = (g.x2 - g.x1) / d, uy = (g.y2 - g.y1) / d;
            const isA = p0id != null && o.a === p0id;
            const isB = p0id != null && o.b === p0id;
            const t = (x0 - g.x1) * ux + (y0 - g.y1) * uy;
            const off = Math.hypot(g.x1 + t * ux - x0, g.y1 + t * uy - y0);
            const onSeg = off < 0.9 && t > -0.9 && t < d + 0.9;
            if (isA) { rays.push([ux, uy]); dirs.push([-ux, -uy]); }
            else if (isB) { rays.push([-ux, -uy]); dirs.push([ux, uy]); }
            else if (onSeg) { rays.push([ux, uy], [-ux, -uy]); dirs.push([ux, uy], [-ux, -uy]); }
            if (onSeg && sbHas('perp')) dirs.push([-uy, ux], [uy, -ux]);
            if (!onSeg && sbHas('para')) dirs.push([ux, uy], [-ux, -uy]);
        }
        if (sbHas('bisect')) {
            for (let i = 0; i < rays.length; i++) {
                for (let j = i + 1; j < rays.length; j++) {
                    const sx = rays[i][0] + rays[j][0], sy = rays[i][1] + rays[j][1];
                    const m = Math.hypot(sx, sy);
                    if (m < 0.05) continue;
                    dirs.push([sx / m, sy / m]);
                }
            }
        }
        let best = null, bestOff = Infinity;
        for (const [ux, uy] of dirs) {
            const dot = vx * ux + vy * uy;
            if (dot <= 0) continue;
            const off = Math.hypot(vx - dot * ux, vy - dot * uy);
            if (off < Math.max(8, len * 0.1) && off < bestOff) {
                bestOff = off;
                best = { x: x0 + dot * ux, y: y0 + dot * uy };
            }
        }
        return best;
    }

    /* ---- rendering ---- */
    function sbMk(tag, attrs) {
        const el = document.createElementNS(SVGNS, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        return el;
    }
    function sbLayer(id) { return document.getElementById(id); }
    function sbRender() {
        const g = sbLayer('gp-sb-content');
        if (!g) return;
        g.innerHTML = '';
        for (const o of sbState.objs) {
            const col = GP_C[o.ink];
            if (o.t === 'seg') {
                const s = sbGeom(o);
                g.appendChild(sbMk('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
                    stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round' }));
            } else {
                const c = sbGeom(o);
                g.appendChild(sbMk('circle', { cx: c.cx, cy: c.cy, r: c.r,
                    fill: 'none', stroke: col, 'stroke-width': 3 }));
            }
        }
        for (const p of sbState.pts) {
            g.appendChild(p.kind === 'x'
                ? sbMk('circle', { cx: p.x, cy: p.y, r: 2.8, fill: GP_C.black, opacity: 0.55 })
                : sbMk('circle', { cx: p.x, cy: p.y, r: 4, fill: GP_C.black }));
        }
        // Earned midpoint stations render as small hollow dots
        for (const p of sbVirtualPts()) {
            g.appendChild(sbMk('circle', { cx: p.x, cy: p.y, r: 3, fill: '#fdf8ea',
                stroke: GP_C.black, 'stroke-width': 1.5, opacity: 0.8 }));
        }
    }
    function sbSetPreview(children) {
        const g = sbLayer('gp-sb-preview');
        if (!g) return;
        g.innerHTML = '';
        children.forEach((c) => g.appendChild(c));
    }
    function sbRing(x, y, col) {
        return sbMk('circle', { cx: x, cy: y, r: 8.5, fill: 'none',
            stroke: col, 'stroke-width': 2.5, class: 'gp-sb-ring' });
    }

    /* ---- interaction ---- */
    function sbCoords(e) {
        const svg = document.getElementById('gp-sb-svg');
        const m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(m.inverse());
    }
    function sbDown(e) {
        e.preventDefault();
        const svg = document.getElementById('gp-sb-svg');
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        const m = sbCoords(e);
        const snap = sbSnapAt(m.x, m.y, null);
        sbState.drag = {
            x0: snap ? snap.x : m.x,
            y0: snap ? snap.y : m.y,
            p0: snap ? snap.id : null,
        };
        sbMove(e);
    }
    function sbMove(e) {
        const ink = GP_C[sbState.ink];
        const d = sbState.drag;
        if (!d) {
            // Hover: show the tool cue at the (snapped) cursor
            const m = sbCoords(e);
            const snap = sbSnapAt(m.x, m.y, null);
            const x = snap ? snap.x : m.x, y = snap ? snap.y : m.y;
            const cue = [];
            if (sbState.tool === 'circle') {
                cue.push(sbMk('circle', { cx: x, cy: y, r: 13, fill: 'none', stroke: ink,
                    'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: 0.8 }));
                cue.push(sbMk('circle', { cx: x, cy: y, r: 2.5, fill: ink }));
            } else {
                cue.push(sbMk('circle', { cx: x, cy: y, r: 3, fill: ink }));
            }
            if (snap) cue.push(sbRing(x, y, ink));
            sbSetPreview(cue);
            return;
        }
        const m = sbCoords(e);
        const prev = [];
        if (sbState.tool === 'seg') {
            let end = { x: m.x, y: m.y, pid: null };
            const ks = sbSnapAt(m.x, m.y, d.p0);
            if (ks) end = { x: ks.x, y: ks.y, pid: ks.id };
            else {
                const ds = sbDirSnap(d.p0, d.x0, d.y0, m.x, m.y);
                if (ds) end = { x: ds.x, y: ds.y, pid: null };
            }
            d.end = end;
            prev.push(sbMk('line', { x1: d.x0, y1: d.y0, x2: end.x, y2: end.y,
                stroke: ink, 'stroke-width': 4, 'stroke-linecap': 'round',
                'stroke-dasharray': '2 7', opacity: 0.9 }));
            if (d.p0 != null) prev.push(sbRing(d.x0, d.y0, ink));
            if (end.pid != null) prev.push(sbRing(end.x, end.y, ink));
        } else {
            let r = Math.hypot(m.x - d.x0, m.y - d.y0);
            const rim = sbRimSnap(d.x0, d.y0, r, d.p0);
            if (rim) r = rim.r;
            d.r = r;
            d.rim = rim;
            prev.push(sbMk('line', { x1: d.x0, y1: d.y0, x2: m.x, y2: m.y,
                stroke: ink, 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: 0.55 }));
            if (r > 1) prev.push(sbMk('circle', { cx: d.x0, cy: d.y0, r,
                fill: 'none', stroke: ink, 'stroke-width': 3,
                'stroke-dasharray': rim ? 'none' : '3 6', opacity: rim ? 1 : 0.85 }));
            prev.push(sbMk('circle', { cx: d.x0, cy: d.y0, r: 2.5, fill: ink }));
            if (rim && rim.lenOnly) {
                // carried length: pulse the source segment
                prev.push(sbMk('line', { x1: rim.g.x1, y1: rim.g.y1, x2: rim.g.x2, y2: rim.g.y2,
                    stroke: ink, 'stroke-width': 7, opacity: 0.5, 'stroke-linecap': 'round', class: 'gp-sb-ring' }));
            } else if (rim) {
                prev.push(sbRing(rim.x, rim.y, ink));
            }
        }
        sbSetPreview(prev);
    }
    function sbUp() {
        const d = sbState.drag;
        sbState.drag = null;
        sbSetPreview([]);
        if (!d) return;
        let committed = null;
        if (sbState.tool === 'seg') {
            const end = d.end;
            if (!end || Math.hypot(end.x - d.x0, end.y - d.y0) < 7) return;
            sbSnapshot();
            const a = d.p0 != null ? d.p0 : sbAddPt(d.x0, d.y0, 'end');
            const b = end.pid != null ? end.pid : sbAddPt(end.x, end.y, 'end');
            if (a === b) { sbState.undo.pop(); return; }
            committed = { t: 'seg', a, b, ink: sbState.ink };
            sbCommitObj(committed);
        } else {
            if (!d.r || d.r < 7) return;
            sbSnapshot();
            const c = d.p0 != null ? d.p0 : sbAddPt(d.x0, d.y0, 'center');
            committed = { t: 'circle', c, r: d.r, ink: sbState.ink };
            sbCommitObj(committed);
        }
        sbRender();
        if (committed && sbChal.prop && !sbChal.complete) sbChalCheck(committed);
    }

    /* ========================================================================
     * BUILD-THIS-PROOF CHALLENGE
     * A proposition's `build` gives a seed plus ordered targets — expected
     * circles (centre + radius) or segments (both endpoints), with tolerance.
     * Snapping makes correct constructions land exactly, so targets are plain
     * coordinates. A committed object matching any unfinished target is
     * accepted (and re-inked to the plate's canonical colour); anything else
     * is auto-undone with a nudge. Progress is recomputed from the canvas, so
     * Undo just works.
     * ======================================================================*/
    const sbChal = { prop: null, done: [], complete: false };
    const builtKey = (p) => `gpBuilt_${p.id}`;

    function sbMatchTarget(o, tg) {
        if (tg.any) return tg.any.some((t2) => sbMatchTarget(o, t2));
        if (o.t !== tg.t) return false;
        const T = 3;
        const g = sbGeom(o);
        if (tg.t === 'circle') {
            return Math.hypot(g.cx - tg.cx, g.cy - tg.cy) < T && Math.abs(g.r - tg.r) < T;
        }
        if (tg.from) {
            // Directional segment ("produce the line ..."): one end at `from`,
            // the other anywhere along `dir` at least `minLen` out.
            const [fx, fy] = tg.from;
            const dn = Math.hypot(tg.dir[0], tg.dir[1]);
            const ux = tg.dir[0] / dn, uy = tg.dir[1] / dn;
            const ray = (ax, ay, bx, by) => {
                if (Math.hypot(ax - fx, ay - fy) >= T) return false;
                const vx = bx - fx, vy = by - fy;
                const dot = vx * ux + vy * uy;
                if (dot < (tg.minLen || 10)) return false;
                return Math.hypot(vx - dot * ux, vy - dot * uy) < T;
            };
            return ray(g.x1, g.y1, g.x2, g.y2) || ray(g.x2, g.y2, g.x1, g.y1);
        }
        const near = (x, y, tx, ty) => Math.hypot(x - tx, y - ty) < T;
        return (near(g.x1, g.y1, tg.x1, tg.y1) && near(g.x2, g.y2, tg.x2, tg.y2))
            || (near(g.x1, g.y1, tg.x2, tg.y2) && near(g.x2, g.y2, tg.x1, tg.y1));
    }

    function sbChalNote(html, bad) {
        const el = $('gp-sb-chal-note');
        el.innerHTML = gpGlyphs(html);
        el.classList.toggle('gp-sb-chal-good', !bad && !!html);
    }
    function sbChalUpdate() {
        const b = sbChal.prop.build;
        const first = sbChal.done.indexOf(false);
        $('gp-sb-pips').innerHTML = b.targets
            .map((_, i) => `<span class="gp-sb-pip${sbChal.done[i] ? ' done' : ''}"></span>`)
            .join('');
        if (first < 0) {
            sbChal.complete = true;
            localStorage.setItem(builtKey(sbChal.prop), '1');
            sbInstrumentsRender(); // a built proposition may enlarge the kit
            $('gp-sb-chal-instr').innerHTML = gpGlyphs(`<strong>∎ Constructed.</strong> ${b.qed || ''}`);
            $('gp-sb-chal-done').classList.remove('hidden');
        } else {
            sbChal.complete = false;
            $('gp-sb-chal-instr').innerHTML = gpGlyphs(b.targets[first].instr);
            $('gp-sb-chal-done').classList.add('hidden');
        }
    }
    function sbChalCheck(obj) {
        const b = sbChal.prop.build;
        let hit = -1;
        for (let i = 0; i < b.targets.length; i++) {
            if (!sbChal.done[i] && sbMatchTarget(obj, b.targets[i])) { hit = i; break; }
        }
        if (hit < 0) {
            sbUndo();
            const first = sbChal.done.indexOf(false);
            sbChalNote(b.targets[first]?.miss || 'Not quite what the construction needs — look again at the instruction.', true);
            return;
        }
        sbChal.done[hit] = true;
        if (b.targets[hit].ink) { obj.ink = b.targets[hit].ink; sbRender(); }
        sbChalNote(sbChal.done.every(Boolean) ? '' : 'Just so.', false);
        sbChalUpdate();
    }
    function sbChalRecalc() {
        if (!sbChal.prop) return;
        sbChal.done = sbChal.prop.build.targets
            .map((tg) => sbState.objs.some((o) => sbMatchTarget(o, tg)));
        sbChalNote('', false);
        sbChalUpdate();
    }
    function sbStartBuild(prop) {
        gpSetMode('sandbox');
        sbChal.prop = prop;
        sbChal.done = prop.build.targets.map(() => false);
        sbChal.complete = false;
        sbSeedList(prop.build.seed);
        $('gp-sb-given').disabled = true;
        $('gp-sb-chal').classList.remove('hidden');
        $('gp-sb-chal-ref').textContent = `${prop.ref} — ${prop.title}`;
        const needsEl = $('gp-sb-chal-needs');
        if (prop.build.needs && prop.build.needs.length) {
            needsEl.innerHTML = 'Instruments called for: ' + prop.build.needs.map((k) => {
                const ins = SB_INSTRUMENTS.find((i) => i.key === k);
                return sbHas(k)
                    ? `<strong>${ins.label}</strong>`
                    : `<em>${ins.label} — still locked; earn it with Prop. ${ins.req}</em>`;
            }).join(' · ');
            needsEl.classList.remove('hidden');
        } else {
            needsEl.classList.add('hidden');
        }
        sbChalNote('', false);
        sbChalUpdate();
    }
    function sbChalExit() {
        sbChal.prop = null;
        sbChal.complete = false;
        $('gp-sb-chal').classList.add('hidden');
        $('gp-sb-given').disabled = false;
    }

    const SB_HINTS = {
        seg: 'Drag from point to point — ends stick to key points, and a line drawn out of an end stays straight with it.',
        circle: 'Press where the centre should be and drag outward — the rim sticks when it reaches a key point.',
    };
    function sbSetTool(tool) {
        sbState.tool = tool;
        document.querySelectorAll('.gp-sb-tool').forEach((b) =>
            b.classList.toggle('active', b.dataset.tool === tool));
        $('gp-sb-hint').textContent = SB_HINTS[tool];
    }
    function sbSetInk(ink) {
        sbState.ink = ink;
        document.querySelectorAll('.gp-sb-ink').forEach((b) =>
            b.classList.toggle('active', b.dataset.ink === ink));
    }
    function sbInit() {
        if (sbState.inited) return;
        sbState.inited = true;
        // ink swatches
        const inks = $('gp-sb-inks');
        Object.keys(GP_C).forEach((ink) => {
            const b = document.createElement('button');
            b.className = 'gp-sb-ink';
            b.dataset.ink = ink;
            b.style.background = GP_C[ink];
            b.title = ink;
            inks.appendChild(b);
        });
        // svg layers: committed content, then live preview on top
        $('gp-sb-svg').innerHTML = '<g id="gp-sb-content"></g><g id="gp-sb-preview"></g>';
        sbSetTool('seg');
        sbSetInk('red');
        sbSeed($('gp-sb-given').value);
    }


    /* ---- mode toggle (Propositions | Sandbox) ---- */
    function gpSetMode(mode) {
        gpMode = mode;
        $('gp-mode-props').classList.toggle('active', mode === 'props');
        $('gp-mode-sandbox').classList.toggle('active', mode === 'sandbox');
        if (mode === 'sandbox') {
            $('gp-menu').classList.add('hidden');
            $('gp-proof').classList.add('hidden');
            $('gp-sandbox').classList.remove('hidden');
            sbInit();
            sbInstrumentsRender();
            sbRender(); // midpoints may have been earned since last visit
        } else {
            $('gp-sandbox').classList.add('hidden');
            gpShowMenu();
        }
    }

    /* ========================================================================
     * SCREEN MARKUP
     * ======================================================================*/
    const GP_SCREEN_HTML = `
    <div class="gp-wrap">
      <div class="gp-container">
        <header class="gp-head">
          <h1>The Elements of Euclid</h1>
          <p class="gp-sub">in which coloured diagrams are used instead of letters · after Oliver Byrne, 1847</p>
        </header>
        <div class="gp-modebar">
          <button id="gp-mode-props" class="gp-modebtn active">Propositions</button>
          <button id="gp-mode-sandbox" class="gp-modebtn">Sandbox</button>
        </div>
        <div id="gp-menu" class="gp-cards"></div>
        <div id="gp-proof" class="hidden">
          <div class="gp-propbar">
            <button id="gp-back" class="gp-btn-plain">← All propositions</button>
            <span id="gp-ref" class="gp-ref"></span>
          </div>
          <h2 id="gp-prop-title" class="gp-prop-title"></h2>
          <p id="gp-enun" class="gp-enun"></p>
          <div id="gp-board" class="gp-board"></div>
          <ol id="gp-ledger" class="gp-ledger"></ol>
          <div id="gp-ask">
            <div class="gp-askbar">
              <span class="gp-asklabel">What comes next?</span>
              <span id="gp-stepnum" class="gp-stepnum"></span>
            </div>
            <p id="gp-prompt" class="gp-prompt"></p>
            <div id="gp-choices"></div>
            <p id="gp-note" class="gp-note"></p>
          </div>
          <div id="gp-qed" class="hidden gp-qed">
            <div class="gp-qed-mark">Q. E. D.</div>
            <p class="gp-qed-sub">quod erat demonstrandum — which was to be shown</p>
            <p id="gp-qed-score" class="gp-qed-score"></p>
            <div class="gp-qed-btns">
              <button id="gp-again" class="gp-btn">Prove it again</button>
              <button id="gp-tomenu" class="gp-btn">All propositions</button>
            </div>
          </div>
        </div>
        <div id="gp-sandbox" class="hidden">
          <p class="gp-enun">The instruments of Euclid: a straightedge for lines, a compass for circles.
            Ends, centres and crossings become key points — and new work sticks to them.</p>
          <div id="gp-sb-chal" class="hidden gp-sb-chal">
            <div class="gp-sb-chal-head">
              <span id="gp-sb-chal-ref" class="gp-ref"></span>
              <button id="gp-sb-chal-exit" class="gp-btn-plain">Exit challenge</button>
            </div>
            <p id="gp-sb-chal-instr" class="gp-sb-chal-instr"></p>
            <p id="gp-sb-chal-needs" class="gp-sb-chal-needs hidden"></p>
            <p id="gp-sb-chal-note" class="gp-note"></p>
            <div class="gp-sb-chal-foot">
              <span id="gp-sb-pips" class="gp-sb-pips"></span>
              <span id="gp-sb-chal-done" class="hidden">
                <button id="gp-sb-chal-prove" class="gp-btn">Now prove it</button>
              </span>
            </div>
          </div>
          <div class="gp-sb-bar">
            <div class="gp-sb-tools">
              <button class="gp-sb-tool active" data-tool="seg">Straightedge</button>
              <button class="gp-sb-tool" data-tool="circle">Compass</button>
            </div>
            <div id="gp-sb-inks" class="gp-sb-inks"></div>
            <div class="gp-sb-actions">
              <button id="gp-sb-undo" class="gp-btn-plain">Undo</button>
              <button id="gp-sb-clear" class="gp-btn-plain">Clear</button>
            </div>
          </div>
          <div id="gp-sb-instruments" class="gp-sb-instruments"></div>
          <div class="gp-board gp-sb-board">
            <svg id="gp-sb-svg" viewBox="0 0 480 360"></svg>
          </div>
          <div class="gp-sb-foot">
            <label class="gp-sb-givenlbl">Begin with
              <select id="gp-sb-given" class="gp-sb-given">
                <option value="segment" selected>a straight line</option>
                <option value="cross">two crossing lines</option>
                <option value="triangle">a triangle</option>
                <option value="right">a right-angled triangle</option>
                <option value="blank">a blank page</option>
              </select>
            </label>
            <span id="gp-sb-hint" class="gp-sb-hint"></span>
          </div>
        </div>
      </div>
    </div>`;

    /* ========================================================================
     * BOOTSTRAP — inject stylesheet, screen, tab; register; wire events.
     * ======================================================================*/
    function injectStylesheet() {
        if (document.querySelector('link[data-gp-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'geometry-proofs.css?v=5';
        link.dataset.gpCss = '1';
        document.head.appendChild(link);
    }
    function injectScreen() {
        const div = document.createElement('div');
        div.id = 'geo-proofs-screen';
        div.className = 'screen';
        div.innerHTML = GP_SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }
    function injectTab() {
        const bar = document.getElementById('tab-bar');
        if (!bar) return;
        // boot.js pre-creates this so the tab keeps its place in the bar while
        // this file is still being fetched. Don't add a second one.
        if (bar.querySelector('.tab-btn[data-tab="geo-proofs"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'geo-proofs';
        btn.textContent = 'Proofs';
        bar.appendChild(btn);
    }
    function register() {
        TAB_ENTRY['geo-proofs'] = () => { showScreen('geo-proofs'); gpSetMode(gpMode); };
        SCREEN_TAB['geo-proofs'] = 'geo-proofs';
    }
    function wireEvents() {
        $('gp-menu').addEventListener('click', (e) => {
            const card = e.target.closest('.gp-card');
            if (!card) return;
            const prop = PROPS.find((p) => p.id === card.dataset.prop);
            if (!prop) return;
            const act = e.target.closest('[data-act]');
            if (act && act.dataset.act === 'build') sbStartBuild(prop);
            else gpStart(prop);
        });
        $('gp-choices').addEventListener('click', (e) => {
            const btn = e.target.closest('.gp-choice');
            if (btn) gpPick(btn);
        });
        $('gp-back').addEventListener('click', gpShowMenu);
        $('gp-tomenu').addEventListener('click', gpShowMenu);
        $('gp-again').addEventListener('click', () => gpStart(gp.prop));
        // ---- sandbox ----
        $('gp-mode-props').addEventListener('click', () => gpSetMode('props'));
        $('gp-mode-sandbox').addEventListener('click', () => gpSetMode('sandbox'));
        document.querySelector('.gp-sb-tools').addEventListener('click', (e) => {
            const btn = e.target.closest('.gp-sb-tool');
            if (btn) sbSetTool(btn.dataset.tool);
        });
        $('gp-sb-inks').addEventListener('click', (e) => {
            const btn = e.target.closest('.gp-sb-ink');
            if (btn) sbSetInk(btn.dataset.ink);
        });
        $('gp-sb-undo').addEventListener('click', () => { sbUndo(); if (sbChal.prop) sbChalRecalc(); });
        $('gp-sb-clear').addEventListener('click', () => {
            if (sbChal.prop) { sbStartBuild(sbChal.prop); return; } // restart the challenge
            sbSnapshot(); sbState.pts = []; sbState.objs = []; sbRender();
        });
        $('gp-sb-given').addEventListener('change', (e) => sbSeed(e.target.value));
        $('gp-sb-chal-exit').addEventListener('click', sbChalExit);
        $('gp-sb-chal-prove').addEventListener('click', () => {
            const prop = sbChal.prop;
            sbChalExit();
            gpSetMode('props');
            gpStart(prop);
        });
        const sbSvg = $('gp-sb-svg');
        sbSvg.addEventListener('pointerdown', sbDown);
        sbSvg.addEventListener('pointermove', sbMove);
        sbSvg.addEventListener('pointerup', sbUp);
        sbSvg.addEventListener('pointercancel', () => { sbState.drag = null; sbSetPreview([]); });
        sbSvg.addEventListener('pointerleave', () => { if (!sbState.drag) sbSetPreview([]); });
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        register();
        wireEvents();
    }

    // Debug/validation handle (used by tests; harmless in production)
    window.__GP = { PROPS, SB_INSTRUMENTS };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
