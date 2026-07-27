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
        const R = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
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
    },
    {
        id: 'i47', ref: 'Book I. Proposition XLVII.',
        title: 'The right-angled triangle (Pythagoras)',
        enun: 'In a right-angled triangle, the square on the side opposite the right angle equals the two squares on the other sides put together.',
        view: '14 -54 452 444',
        shapes: [
            { id: 'sqr', t: 'poly', pts: [[120, 180], [192, 84], [96, 12], [24, 108]],   c: 'red',  outline: 1, s: 1, z: 0 },
            { id: 'sqb', t: 'poly', pts: [[192, 84], [320, 180], [416, 52], [288, -44]], c: 'blue', outline: 1, s: 2, z: 0 },
            { id: 'rl',  t: 'poly', pts: [[120, 180], [192, 180], [192, 380], [120, 380]], c: 'red',  outline: 1, s: 5, z: 0 },
            { id: 'rr',  t: 'poly', pts: [[192, 180], [320, 180], [320, 380], [192, 380]], c: 'blue', outline: 1, s: 6, z: 0 },
            { id: 'tri', t: 'poly', pts: [[120, 180], [192, 84], [320, 180]], c: 'yellow', s: 0, z: 0 },
            { id: 'sqc', t: 'poly', pts: [[120, 180], [320, 180], [320, 380], [120, 380]], c: null, outline: 1, w: 3.5, s: 3 },
            { id: 'ra',  t: 'path', d: 'M 186 92 L 194 98 L 200 90', c: 'black', w: 2.5, s: 0 },
            { id: 'sAC', t: 'line', x1: 120, y1: 180, x2: 192, y2: 84,  c: 'red',   w: 5, s: 0 },
            { id: 'sCB', t: 'line', x1: 192, y1: 84,  x2: 320, y2: 180, c: 'blue',  w: 5, s: 0 },
            { id: 'sAB', t: 'line', x1: 120, y1: 180, x2: 320, y2: 180, c: 'black', w: 5, s: 0 },
            { id: 'perp', t: 'line', x1: 192, y1: 84, x2: 192, y2: 380, c: 'black', w: 3.5, dash: 1, s: 4 },
        ],
        steps: [
            {
                ask: 'A right-angled triangle: a [red-line] side, a [blue-line] side, and the longest side — the [black-line], opposite the right angle. The theorem speaks of squares. What first?',
                ok: { t: 'Build the [red-square]: a perfect square sitting on the [red-line] side.',
                      done: 'Upon the [red-line] side, the [red-square] is described.' },
                no: [
                    { t: 'Multiply the two short sides together.',
                      why: 'That would be arithmetic. Euclid proves it with real squares of area, drawn upon the sides themselves.' },
                    { t: 'Draw a circle through the three corners.',
                      why: 'A fine construction — but it belongs to another proposition. Today we build squares upon the sides.' },
                ],
            },
            {
                ask: 'One side wears its square. What next?',
                ok: { t: 'Build the [blue-square] upon the [blue-line] side.',
                      done: 'Upon the [blue-line] side, the [blue-square] is described.' },
                no: [
                    { t: 'Stop — one square is surely enough.',
                      why: 'The theorem compares three squares. Each side must carry its own.' },
                    { t: 'Build a second, larger square on the [red-line] side.',
                      why: 'The [red-line] already has its square. It is the [blue-line]’s turn.' },
                ],
            },
            {
                ask: 'Two sides wear their squares. What completes the picture?',
                ok: { t: 'The greatest square of all, built upon the [black-line] — the side opposite the right angle.',
                      done: 'Upon the [black-line], the great square is described.' },
                no: [
                    { t: 'Join the tops of the [red-square] and the [blue-square] with a line.',
                      why: 'Pretty, but no use — the prize is the square on the longest side, waiting below the triangle.' },
                    { t: 'Fold the [red-square] and the [blue-square] down over the triangle.',
                      why: 'No folding in Euclid! The great square must be drawn where it lives: upon the [black-line].' },
                ],
            },
            {
                ask: 'Now Byrne’s favourite stroke. From the right-angle corner, we let a line fall straight down through the great square. What does it do?',
                ok: { t: 'It splits the great square into two rectangles — one standing under the [red-line] side, one under the [blue-line] side.',
                      done: 'From the right angle, a perpendicular is let fall, dividing the great square into two rectangles.' },
                no: [
                    { t: 'It cuts the great square into two equal halves.',
                      why: 'Look closely — the two pieces are not equal unless the triangle is perfectly symmetric. Each piece will match its own square instead.' },
                    { t: 'It misses the great square entirely.',
                      why: 'It falls from the right angle squarely onto the [black-line], so it must pass straight on through the square below.' },
                ],
            },
            {
                ask: 'Here is the heart of the proof. By sliding and tilting matching triangles, Euclid shows the [red-square] is equal in area to which piece?',
                ok: { t: 'The [red-rect] — the rectangle standing beneath the [red-line] side’s end of the [black-line].',
                      done: 'The [red-square] is equal in area to the [red-rect] beneath the red side.' },
                flash: ['sqr', 'rl'],
                no: [
                    { t: 'The [blue-rect], on the far side.',
                      why: 'Each side keeps to its own end of the [black-line]: the red square matches the rectangle at the red side’s own end.' },
                    { t: 'The [yellow-tri] in the middle.',
                      why: 'The little triangle is far too small — a square built on a whole side holds much more than the triangle itself.' },
                ],
            },
            {
                ask: 'And by the very same argument on the other side…',
                ok: { t: 'The [blue-square] equals the [blue-rect] — the rectangle beneath the [blue-line] side.',
                      done: 'The [blue-square] is equal in area to the [blue-rect].' },
                flash: ['sqb', 'rr'],
                no: [
                    { t: 'The [blue-square] equals the [red-square].',
                      why: 'Only in one special triangle with equal legs. In general each square matches its own rectangle.' },
                    { t: 'The [blue-square] equals the whole great square.',
                      why: 'Then the [red-square] would be left with nothing! The blue square claims only its own rectangle.' },
                ],
            },
            {
                ask: 'The finish. [red-square] = [red-rect], and [blue-square] = [blue-rect]. What do the two rectangles make together?',
                ok: { t: 'The whole great square — so [red-square] + [blue-square] equals the square upon the [black-line]. The Pythagorean theorem!',
                      done: 'The two rectangles together are the whole great square: therefore [red-square] + [blue-square] = the square upon the [black-line]. Q.E.D.' },
                flash: ['rl', 'rr', 'sqr', 'sqb'],
                no: [
                    { t: 'Something bigger than the great square.',
                      why: 'The perpendicular cut the great square into exactly these two pieces — together they are the square, no more, no less.' },
                    { t: 'We cannot tell without knowing the side lengths.',
                      why: 'That is the wonder of it: no lengths were ever needed. The proof holds for every right-angled triangle at once.' },
                ],
            },
        ],
    },
    ];

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

    function gpBuildSVG(prop, revealAll) {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', prop.view);
        // Stable sort: fills (z:0) beneath linework (default z:1)
        prop.shapes
            .slice()
            .sort((a, b) => (a.z ?? 1) - (b.z ?? 1))
            .forEach((sh) => {
                const el = gpShapeEl(sh);
                if (!revealAll && sh.s > 0) el.classList.add('gp-hidden');
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
            const card = document.createElement('button');
            card.className = 'gp-card';
            card.dataset.prop = prop.id;
            const done = localStorage.getItem(doneKey(prop)) === '1';
            card.innerHTML =
                `<span class="gp-card-ref">${prop.ref}</span>` +
                `<span class="gp-card-title">${prop.title}</span>` +
                `<span class="gp-card-meta">${prop.steps.length} steps${done ? ' · <em class="gp-card-done">∎ proved</em>' : ''}</span>`;
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
    function sbSeed(name) {
        sbState.pts = []; sbState.objs = []; sbState.undo = []; sbState.nextId = 1;
        sbState.drag = null;
        (SB_SEEDS[name] || []).forEach(([p1, p2]) => {
            const a = sbAddPt(p1[0], p1[1], 'end');
            const b = sbAddPt(p2[0], p2[1], 'end');
            sbCommitObj({ t: 'seg', a, b, ink: 'black' });
        });
        sbRender();
    }

    /* ---- snapping ---- */
    function sbSnapAt(x, y, excludeId) {
        let best = null, bd = SB_SNAP;
        for (const p of sbState.pts) {
            if (p.id === excludeId) continue;
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bd) { bd = d; best = p; }
        }
        return best;
    }
    function sbRimSnap(cx, cy, r, centerId) {
        let best = null, bd = SB_RIM;
        for (const p of sbState.pts) {
            if (p.id === centerId) continue;
            const rp = Math.hypot(p.x - cx, p.y - cy);
            if (rp < 6) continue;
            const d = Math.abs(rp - r);
            if (d < bd) { bd = d; best = p; }
        }
        return best;
    }
    // "Produce the line": if the drag leaves an existing endpoint nearly
    // collinear with a segment through it, project onto that direction.
    function sbDirSnap(p0id, x0, y0, x, y) {
        if (p0id == null) return null;
        const vx = x - x0, vy = y - y0;
        const len = Math.hypot(vx, vy);
        if (len < 1e-6) return null;
        for (const o of sbState.objs) {
            if (o.t !== 'seg') continue;
            let other = null;
            if (o.a === p0id) other = sbPt(o.b);
            else if (o.b === p0id) other = sbPt(o.a);
            if (!other) continue;
            const d = Math.hypot(x0 - other.x, y0 - other.y);
            if (d < 1e-6) continue;
            const ux = (x0 - other.x) / d, uy = (y0 - other.y) / d; // away from the far end
            const dot = vx * ux + vy * uy;
            if (dot <= 0) continue;
            const off = Math.hypot(vx - dot * ux, vy - dot * uy);
            if (off < Math.max(8, len * 0.1)) return { x: x0 + dot * ux, y: y0 + dot * uy };
        }
        return null;
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
            if (rim) r = Math.hypot(rim.x - d.x0, rim.y - d.y0);
            d.r = r;
            d.rim = rim;
            prev.push(sbMk('line', { x1: d.x0, y1: d.y0, x2: m.x, y2: m.y,
                stroke: ink, 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: 0.55 }));
            if (r > 1) prev.push(sbMk('circle', { cx: d.x0, cy: d.y0, r,
                fill: 'none', stroke: ink, 'stroke-width': 3,
                'stroke-dasharray': rim ? 'none' : '3 6', opacity: rim ? 1 : 0.85 }));
            prev.push(sbMk('circle', { cx: d.x0, cy: d.y0, r: 2.5, fill: ink }));
            if (rim) prev.push(sbRing(rim.x, rim.y, ink));
        }
        sbSetPreview(prev);
    }
    function sbUp() {
        const d = sbState.drag;
        sbState.drag = null;
        sbSetPreview([]);
        if (!d) return;
        if (sbState.tool === 'seg') {
            const end = d.end;
            if (!end || Math.hypot(end.x - d.x0, end.y - d.y0) < 7) return;
            sbSnapshot();
            const a = d.p0 != null ? d.p0 : sbAddPt(d.x0, d.y0, 'end');
            const b = end.pid != null ? end.pid : sbAddPt(end.x, end.y, 'end');
            if (a === b) { sbState.undo.pop(); return; }
            sbCommitObj({ t: 'seg', a, b, ink: sbState.ink });
        } else {
            if (!d.r || d.r < 7) return;
            sbSnapshot();
            const c = d.p0 != null ? d.p0 : sbAddPt(d.x0, d.y0, 'center');
            sbCommitObj({ t: 'circle', c, r: d.r, ink: sbState.ink });
        }
        sbRender();
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
        link.href = 'geometry-proofs.css?v=2';
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
            if (prop) gpStart(prop);
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
        $('gp-sb-undo').addEventListener('click', sbUndo);
        $('gp-sb-clear').addEventListener('click', () => { sbSnapshot(); sbState.pts = []; sbState.objs = []; sbRender(); });
        $('gp-sb-given').addEventListener('change', (e) => sbSeed(e.target.value));
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
