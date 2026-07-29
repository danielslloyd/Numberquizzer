/*
 * Item generators for geometry.
 *
 * Only the partition node is tier 1, and only because it is where fractions
 * begin: splitting a shape into equal areas is the concrete act that "one part
 * of b equal parts" names. Its misconception — that equal parts must be the same
 * shape — is the one worth catching.
 */
(function () {
    'use strict';

    const G = {};

    G['geom.partition.equalArea'] = function (rng) {
        const d = rng.pick([2, 3, 4, 6, 8]);
        if (rng.bool()) {
            return genMc(rng, {
                stem: 'A shape is split into ' + d + ' equal parts. How much of the whole shape is one part?',
                prompt: [
                    { t: 'text', s: 'One of these ' + d + ' equal parts is how much of the whole?' },
                    { t: 'svg', draw: 'fraction-bar', args: { num: 1, den: d } },
                ],
                correct: '1/' + d,
                distractors: ['1/' + (d - 1), (d - 1) + '/' + d, d + '/1'],
                explain: 'One part out of ' + d + ' equal parts is 1/' + d + ' of the whole.',
                sig: 'part:' + d,
            });
        }
        return genMc(rng, {
            stem: 'A square is cut into 4 equal parts. Two of them are triangles and two are '
                + 'rectangles. Can the parts still be equal?',
            correct: 'Yes, if they cover the same amount',
            distractors: [
                'No, equal parts must be the same shape',
                'No, a square cannot be cut into triangles',
                'Only if they are all triangles',
            ],
            explain: 'Equal parts means equal amount of space, not identical shape. Parts of the '
                + 'same whole can look different and still be equal.',
            sig: 'partShape',
        });
    };


    // ---- tier 2 -------------------------------------------------------------

    const SHAPES_2D = [
        { n: 'triangle', sides: 3, corners: 3 },
        { n: 'square', sides: 4, corners: 4 },
        { n: 'rectangle', sides: 4, corners: 4 },
        { n: 'pentagon', sides: 5, corners: 5 },
        { n: 'hexagon', sides: 6, corners: 6 },
        { n: 'octagon', sides: 8, corners: 8 },
    ];
    const SHAPES_3D = [
        { n: 'cube', faces: 6 }, { n: 'sphere', faces: 1 }, { n: 'cylinder', faces: 3 },
        { n: 'cone', faces: 2 }, { n: 'pyramid', faces: 5 },
    ];

    G['geom.name2d'] = function (rng) {
        const s = rng.pick(SHAPES_2D);
        const others = SHAPES_2D.filter((x) => x.n !== s.n);
        if (rng.bool(0.3)) {
            // The rotated square. Orientation does not change what a shape is,
            // and "diamond" is the answer a lot of children give.
            return genMc(rng, {
                stem: 'A square is turned so it balances on one corner. What shape is it now?',
                correct: 'still a square',
                distractors: ['a diamond', 'a triangle', 'a rectangle'],
                explain: 'Turning a shape does not change it. Four equal sides and four right '
                    + 'angles make a square whichever way up it is.',
                sig: 'rotated',
            });
        }
        return genMc(rng, {
            stem: 'Which shape has ' + s.sides + ' straight sides?',
            correct: s.n,
            distractors: rng.sample(others.map((x) => x.n), 3),
            sig: 'name2d:' + s.n,
        });
    };

    G['geom.name3d'] = function (rng) {
        const s = rng.pick(SHAPES_3D);
        const others = SHAPES_3D.filter((x) => x.n !== s.n);
        const CLUE = {
            cube: 'has six square faces', sphere: 'is perfectly round like a ball',
            cylinder: 'has two circle faces and one curved side, like a tin',
            cone: 'has one circle face and comes to a point',
            pyramid: 'has a square base and triangle sides meeting at a point',
        };
        return genMc(rng, {
            stem: 'Which solid shape ' + CLUE[s.n] + '?',
            correct: s.n,
            distractors: rng.sample(others.map((x) => x.n), 3),
            sig: 'name3d:' + s.n,
        });
    };

    G['geom.attributes'] = function (rng) {
        const s = rng.pick(SHAPES_2D);
        return genMc(rng, {
            stem: 'Which of these makes a shape a ' + s.n + ', no matter how it is drawn?',
            correct: 'having ' + s.sides + ' straight sides',
            // Size and colour are the classic non-defining attributes.
            distractors: ['being coloured blue', 'being small', 'pointing upwards'],
            explain: 'Colour, size and which way up it is can all change. The number of sides '
                + 'cannot — that is what makes it a ' + s.n + '.',
            sig: 'attr:' + s.n,
        });
    };

    G['geom.compose'] = function (rng) {
        const CASES = [
            { made: 'a square', from: 'two triangles', wrong: ['two circles', 'three circles', 'one triangle'] },
            { made: 'a rectangle', from: 'two squares', wrong: ['two circles', 'three triangles', 'one circle'] },
            { made: 'a hexagon', from: 'six triangles', wrong: ['two squares', 'four circles', 'one square'] },
            { made: 'a bigger triangle', from: 'four smaller triangles', wrong: ['two circles', 'three squares', 'one hexagon'] },
            { made: 'a cube', from: 'six squares', wrong: ['four triangles', 'two circles', 'three rectangles'] },
            { made: 'a rhombus', from: 'two equilateral triangles', wrong: ['two circles', 'four squares', 'one pentagon'] },
            { made: 'an octagon', from: 'eight triangles', wrong: ['two squares', 'three circles', 'one triangle'] },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: 'Which shapes could be put together to make ' + c.made + '?',
            correct: c.from,
            distractors: c.wrong,
            sig: 'compose:' + c.made,
        });
    };

    G['geom.linesAngles'] = function (rng) {
        const CASES = [
            { q: 'Two lines that stay the same distance apart and never meet are called…',
              a: 'parallel', w: ['perpendicular', 'diagonal', 'curved'] },
            { q: 'Two lines that cross at a right angle are called…',
              a: 'perpendicular', w: ['parallel', 'diagonal', 'equal'] },
            { q: 'A part of a line with two endpoints is called…',
              a: 'a line segment', w: ['a ray', 'a point', 'an angle'] },
            { q: 'A part of a line with one endpoint that goes on forever the other way is called…',
              a: 'a ray', w: ['a line segment', 'a point', 'a vertex'] },
            { q: 'Lines that meet or cross at a point are called…',
              a: 'intersecting', w: ['parallel', 'perpendicular', 'symmetrical'] },
            { q: 'The point where two sides of a shape meet is called…',
              a: 'a vertex', w: ['an edge', 'a face', 'a ray'] },
            { q: 'An angle smaller than a right angle is called…',
              a: 'acute', w: ['obtuse', 'reflex', 'straight'] },
            { q: 'An angle bigger than a right angle but less than a straight line is called…',
              a: 'obtuse', w: ['acute', 'reflex', 'right'] },
            { q: 'A line that goes on forever in both directions is called…',
              a: 'a line', w: ['a line segment', 'a ray', 'a vertex'] },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: c.q,
            correct: c.a,
            distractors: c.w,
            sig: 'lines:' + c.a,
        });
    };

    /*
     * The quadrilateral hierarchy. "Is a square a rectangle?" catches the
     * misconception that categories are exclusive, which is the thing this node
     * is actually for.
     */
    G['geom.classifyQuad'] = function (rng) {
        const CASES = [
            { q: 'Is a square also a rectangle?', a: 'Yes, always',
              w: ['No, never', 'Only sometimes', 'Only if it is turned'],
              why: 'a rectangle needs four right angles, and a square has them. Every square is a rectangle, but not every rectangle is a square.' },
            { q: 'Is a rectangle also a square?', a: 'Only sometimes',
              w: ['Yes, always', 'No, never', 'Only if it is small'],
              why: 'a square also needs all four sides equal, and most rectangles do not have that.' },
            { q: 'Is a square also a rhombus?', a: 'Yes, always',
              w: ['No, never', 'Only sometimes', 'Only if it is tilted'],
              why: 'a rhombus needs four equal sides, and a square has them.' },
            { q: 'Is a rhombus also a square?', a: 'Only sometimes',
              w: ['Yes, always', 'No, never', 'Only if it is large'],
              why: 'a square also needs four right angles, and most rhombuses do not have them.' },
            { q: 'Is a square also a quadrilateral?', a: 'Yes, always',
              w: ['No, never', 'Only sometimes', 'Only if it is tilted'],
              why: 'a quadrilateral is any four-sided shape, and a square has four sides.' },
            { q: 'Is a rectangle also a parallelogram?', a: 'Yes, always',
              w: ['No, never', 'Only sometimes', 'Only if it is long'],
              why: 'a parallelogram needs two pairs of parallel sides, and a rectangle has them.' },
            { q: 'Is a trapezium also a rectangle?', a: 'No, never',
              w: ['Yes, always', 'Only sometimes', 'Only if it is right-angled'],
              why: 'a rectangle needs two pairs of parallel sides; a trapezium has only one.' },
        ];
        const c = rng.pick(CASES);
        return genMc(rng, {
            stem: c.q,
            correct: c.a,
            distractors: c.w,
            explain: c.a + ' — ' + c.why,
            sig: 'quad:' + c.q.slice(0, 20),
        });
    };

    G['geom.symmetry'] = function (rng) {
        const CASES = [
            { s: 'a square', n: 4 }, { s: 'a rectangle', n: 2 }, { s: 'an equilateral triangle', n: 3 },
            { s: 'a circle drawn with 8 marked lines', n: 8 }, { s: 'the letter A', n: 1 },
            { s: 'the letter H', n: 2 },
        ];
        const c = rng.pick(CASES);
        return genNum({
            stem: 'How many lines of symmetry does ' + c.s + ' have?',
            answer: c.n,
            hint: 'A line of symmetry folds the shape onto itself exactly.',
            sig: 'sym:' + c.s,
        });
    };

    G['geom.coordinate'] = function (rng) {
        const x = rng.int(0, 9), y = rng.int(0, 9);
        if (x === y) return G['geom.coordinate'](rng);
        return genMc(rng, {
            stem: 'A point is ' + x + ' across and ' + y + ' up. How is that written?',
            correct: '(' + x + ', ' + y + ')',
            // Reading the pair backwards is the named misconception.
            distractors: ['(' + y + ', ' + x + ')', x + y + '', '(' + x + ' + ' + y + ')'],
            hint: 'Along the corridor before up the stairs.',
            explain: 'The x-coordinate — how far across — always comes first: (' + x + ', ' + y + ').',
            sig: 'coord:' + x + ':' + y,
        });
    };

    if (typeof CUR !== 'undefined') CUR.registerGens('math-geom', G);
    if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
