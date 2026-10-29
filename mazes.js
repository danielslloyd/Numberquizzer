/* ============================================================================
 * mazes.js — the Mazes tab. Prefix `mz`.
 *
 * Self-contained plug-in, same shape as language-arts.js / patterns.js /
 * decimals.js: one IIFE that injects its own stylesheet, screen and tab,
 * registers into TAB_ENTRY / SCREEN_TAB, and touches no other file.
 *
 * A number maze is a grid of numbers — squares or hexagons — with ONE route
 * from START to END that obeys a rule. Two families of rule:
 *
 *   SET rules (multiples of X, factors of X, facts that make X, odd numbers,
 *   primes) say which cells you may stand on, in any order. The cells that
 *   pass the rule form a TREE: the true route plus dead-end branches. A tree
 *   has exactly one path between any two of its cells, which is the whole of
 *   the uniqueness argument — so every pass-cell is placed touching exactly
 *   one pass-cell already there, and the route itself never touches itself
 *   except step to step. A route that brushed against its own earlier cells
 *   would be a shortcut.
 *
 *   SEQUENCE rules (count up / down by X) say what the NEXT cell must hold.
 *   Steps are strictly monotonic, so the legal moves form a DAG and paths can
 *   be counted exactly by dynamic programming. Decoys are false branches —
 *   the next number, sitting beside the right one, leading nowhere — and any
 *   decoy that turns out to complete a second route is repaired.
 *
 * Rules worth keeping:
 *
 *   A GENERATED MAZE IS NOT TRUSTED. `mzCount` walks every simple path from
 *   START using only `mzLegal` — the same predicate the player is held to —
 *   and knows nothing about how the maze was built. A maze is kept only if
 *   that count is exactly one. Same stance as patterns.js's `holds`.
 *
 *   An illegal step is REFUSED, not drawn. Dead ends are made of legal steps,
 *   so refusing a wrong number tells the player about the rule without
 *   telling them about the route.
 * ==========================================================================*/
(function () {
    'use strict';

    const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const MINUS = '−';

    /* ---- grids ------------------------------------------------------------
     * Cell centres are in units where a square is 1 wide and a hexagon is 1
     * across its flats. Hexagons are pointy-top with odd rows pushed half a
     * cell right ("odd-r"), so START (top left) and END (bottom right) sit at
     * the corners whichever shape is chosen.
     */
    const HEX_R = 1 / Math.sqrt(3);          // centre-to-vertex, for flats = 1

    function mzGrid(kind, cols, rows) {
        const n = cols * rows;
        const id = (c, r) => r * cols + c;
        const nbrs = [], xy = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let cand;
                if (kind === 'square') {
                    cand = [[c, r - 1], [c + 1, r], [c, r + 1], [c - 1, r]];
                    xy.push([c + 0.5, r + 0.5]);
                } else {
                    const o = r & 1;          // odd rows lean right
                    cand = [[c - 1 + o, r - 1], [c + o, r - 1], [c - 1, r], [c + 1, r],
                        [c - 1 + o, r + 1], [c + o, r + 1]];
                    xy.push([c + 0.5 + o * 0.5, HEX_R + r * 1.5 * HEX_R]);
                }
                nbrs.push(cand.filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows)
                    .map(([x, y]) => id(x, y)));
            }
        }
        const w = kind === 'square' ? cols : cols + (rows > 1 ? 0.5 : 0);
        const h = kind === 'square' ? rows : 2 * HEX_R + (rows - 1) * 1.5 * HEX_R;
        return { kind, cols, rows, n, nbrs, xy, w, h };
    }

    const SIZES = {
        small:  { label: 'Small',  cols: 5, rows: 5 },
        medium: { label: 'Medium', cols: 7, rows: 7 },
        large:  { label: 'Large',  cols: 9, rows: 9 },
    };

    /* ---- number helpers ---------------------------------------------------*/
    const PRIMES = range(2, 97).filter((v) => range(2, Math.floor(Math.sqrt(v))).every((d) => v % d));
    const isPrime = (v) => PRIMES.indexOf(v) !== -1;
    const smallestFactor = (v) => range(2, v).find((d) => v % d === 0);
    const factorsOf = (X) => range(1, X).filter((d) => X % d === 0);

    // Draw from `gen` until `want` holds. Every generator here has a large
    // pool on the right side of the rule, so the guard is a seatbelt only.
    function drawUntil(gen, want) {
        for (let i = 0; i < 200; i++) {
            const v = gen();
            if (want(v)) return v;
        }
        throw new Error('mazes: could not draw a value');
    }

    /* ---- patterns ---------------------------------------------------------
     * kind 'set': `ok(v, X)` says whether a cell may be stood on.
     * kind 'seq': `terms(X, L)` is the route's numbers in order and `step` is
     *             the difference every move must make.
     * `xs` is the menu for X (absent when the rule takes none); `dx` the
     * default. `why` explains a refused step in the feedback line.
     */
    const PATTERNS = {
        multiples: {
            kind: 'set', name: 'Multiples of X', xLabel: 'Multiples of',
            xs: range(2, 12), dx: 3,
            rule: (X) => 'Step only on multiples of ' + X + '.',
            ok: (v, X) => v > 0 && v % X === 0,
            on: (X) => X * ri(1, 12),
            // Near misses mostly: one or two off a multiple is the number
            // that actually gets stepped on by mistake.
            off: (X) => drawUntil(() => (Math.random() < 0.6
                ? X * ri(1, 12) + pick([-2, -1, 1, 2])
                : ri(1, 12 * X)), (v) => v > 0 && v % X !== 0),
            why: (v, X) => v + ' is not a multiple of ' + X + ' — ' + X + ' × '
                + Math.floor(v / X) + ' = ' + X * Math.floor(v / X) + '.',
        },
        factors: {
            kind: 'set', name: 'Factors of X', xLabel: 'Factors of',
            xs: [12, 16, 18, 20, 24, 30, 36, 40, 48, 60, 72, 100], dx: 24,
            rule: (X) => 'Step only on factors of ' + X + ' — numbers that divide ' + X + ' exactly.',
            ok: (v, X) => v > 0 && X % v === 0,
            on: (X) => pick(factorsOf(X)),
            off: (X) => drawUntil(() => ri(2, X + Math.floor(X / 2)), (v) => X % v !== 0),
            why: (v, X) => v + ' is not a factor of ' + X + ' — ' + X + ' ÷ ' + v
                + ' leaves ' + (X % v) + ' over.',
        },
        make: {
            kind: 'set', name: 'Facts that make X', xLabel: 'Facts that make',
            xs: range(5, 20), dx: 10,
            rule: (X) => 'Step only on facts that make ' + X + '.',
            ok: (v, X) => v === X,
            on: (X) => X,
            off: (X) => drawUntil(() => X + pick([-2, -1, 1, 2]), (v) => v >= 3),
            // The cell shows a sum or a difference whose answer is v.
            label: (v) => {
                if (Math.random() < 0.6) {
                    const a = ri(1, v - 1);
                    return a + ' + ' + (v - a);
                }
                const b = ri(1, 9);
                return (v + b) + ' ' + MINUS + ' ' + b;
            },
            why: (v, X, lab) => lab + ' makes ' + v + ', not ' + X + '.',
        },
        odd: {
            kind: 'set', name: 'Odd numbers',
            rule: () => 'Step only on odd numbers.',
            ok: (v) => v % 2 === 1,
            on: () => 2 * ri(0, 49) + 1,
            off: () => 2 * ri(1, 49),
            why: (v) => v + ' is even — it ends in ' + (v % 10) + '.',
        },
        prime: {
            kind: 'set', name: 'Prime numbers',
            rule: () => 'Step only on prime numbers.',
            ok: (v) => isPrime(v),
            on: () => pick(PRIMES),
            // Mostly odd non-primes: an even number gives itself away, 21 and
            // 51 and 91 do not. 1 is in the pool because "1 is prime" is the
            // classic slip.
            off: () => drawUntil(() => (Math.random() < 0.75 ? 2 * ri(0, 49) + 1 : 2 * ri(2, 49)),
                (v) => !isPrime(v)),
            why: (v) => (v === 1
                ? '1 is not prime — a prime has exactly two factors.'
                : v + ' is not prime — ' + smallestFactor(v) + ' × ' + v / smallestFactor(v) + ' = ' + v + '.'),
        },
        up: {
            kind: 'seq', name: 'Count up by X', xLabel: 'Count up by',
            xs: range(1, 12).concat([25, 50, 100]), dx: 2,
            dir: 1,
            rule: (X, t0) => 'Start at ' + t0 + ' and count up by ' + X + '.',
            terms: (X, L) => {
                const t0 = X >= 25 ? X * ri(0, 2) : ri(0, 2 * X);
                return range(0, L - 1).map((i) => t0 + i * X);
            },
            why: (v, X, lab, prev) => 'After ' + prev + ' comes ' + (prev + X) + ', not ' + v + '.',
        },
        down: {
            kind: 'seq', name: 'Count down by X', xLabel: 'Count down by',
            xs: range(1, 12).concat([25, 50, 100]), dx: 2,
            dir: -1,
            rule: (X, t0) => 'Start at ' + t0 + ' and count down by ' + X + '.',
            terms: (X, L) => {
                const end = X >= 25 ? X * ri(0, 2) : ri(0, 2 * X);
                return range(0, L - 1).map((i) => end + (L - 1 - i) * X);
            },
            why: (v, X, lab, prev) => 'After ' + prev + ' comes ' + (prev - X) + ', not ' + v + '.',
        },
    };
    const SET_ORDER = ['multiples', 'factors', 'make', 'odd', 'prime'];
    const SEQ_ORDER = ['up', 'down'];

    /* ---- legality: the one rule the player AND the checker are held to ----*/
    function mzLegal(m, a, b) {
        const P = PATTERNS[m.pattern];
        if (P.kind === 'set') return P.ok(m.vals[b], m.X);
        return m.vals[b] === m.vals[a] + P.dir * m.X;
    }
    // Why a step was refused, for the feedback line.
    function mzWhy(m, a, b) {
        const P = PATTERNS[m.pattern];
        return P.why(m.vals[b], m.X, m.labels[b], m.vals[a]);
    }

    /* Count simple START→END paths that use only legal steps, stopping at
     * `cap`. Knows nothing about how the maze was built. Returns -1 if the
     * search ran out of budget, which the generator treats as a reject. */
    function mzCount(m, cap) {
        const G = m.G, seen = new Uint8Array(G.n);
        const limit = cap || 2;
        let found = 0, budget = 200000;
        (function walk(c) {
            if (c === m.end) { found++; return; }
            if (--budget < 0) return;
            seen[c] = 1;
            for (const nb of G.nbrs[c]) {
                if (seen[nb] || !mzLegal(m, c, nb)) continue;
                walk(nb);
                if (found >= limit || budget < 0) break;
            }
            seen[c] = 0;
        })(m.start);
        return budget < 0 ? -1 : found;
    }

    /* ---- the route --------------------------------------------------------
     * Randomised depth-first walk from START that must arrive at END with a
     * length inside [minLen, maxLen]. `induced` forbids a new cell touching
     * any route cell but the one it steps from — required for set rules,
     * where touching would be a shortcut.
     */
    function mzRoute(G, start, end, induced, minLen, maxLen) {
        const touches = (c, tip, on) => G.nbrs[c].some((x) => on[x] && x !== tip);
        for (let attempt = 0; attempt < 80; attempt++) {
            const on = new Uint8Array(G.n);
            const path = [start];
            const stack = [shuffle(G.nbrs[start])];
            on[start] = 1;
            let budget = 6000;
            while (stack.length && budget-- > 0) {
                const opts = stack[stack.length - 1];
                if (!opts.length) {
                    stack.pop();
                    on[path.pop()] = 0;
                    continue;
                }
                const nx = opts.pop();
                const tip = path[path.length - 1];
                if (on[nx] || (induced && touches(nx, tip, on))) continue;
                if (nx === end) {
                    if (path.length + 1 >= minLen) return path.concat([end]);
                    continue;
                }
                if (path.length + 1 >= maxLen) continue;
                path.push(nx);
                on[nx] = 1;
                stack.push(shuffle(G.nbrs[nx]));
            }
        }
        return null;
    }

    /* ---- building -------------------------------------------------------*/
    function mzBuildSet(G, P, X, path) {
        const on = new Uint8Array(G.n);
        path.forEach((c) => { on[c] = 1; });

        // Dead-end branches. A new pass-cell may touch exactly one existing
        // pass-cell — the one it grows from — so the pass-cells stay a tree.
        const lonely = (c, from) => !on[c] && G.nbrs[c].every((x) => !on[x] || x === from);
        const want = Math.round(G.n * 0.6) - path.length;
        let placed = 0;
        for (let tries = 0; tries < G.n * 12 && placed < want; tries++) {
            let cur = pick(range(0, G.n - 1).filter((c) => on[c] && c !== path[path.length - 1]));
            const len = ri(1, 5);
            for (let k = 0; k < len && placed < want; k++) {
                const opts = G.nbrs[cur].filter((c) => lonely(c, cur));
                if (!opts.length) break;
                const nx = pick(opts);
                on[nx] = 1;
                placed++;
                cur = nx;
            }
        }
        return Array.from(on, (o) => (o ? P.on(X) : P.off(X)));
    }

    function mzBuildSeq(G, P, X, path) {
        const L = path.length;
        const terms = P.terms(X, L);
        const index = new Map(terms.map((t, i) => [t, i]));
        const lo = Math.min(terms[0], terms[L - 1]), hi = Math.max(terms[0], terms[L - 1]);
        const vals = new Array(G.n).fill(null);
        path.forEach((c, i) => { vals[c] = terms[i]; });
        const onPath = new Uint8Array(G.n);
        path.forEach((c) => { onPath[c] = 1; });

        // False branches: the right next number, beside the right one,
        // carried on a step or two and then stopped.
        const branches = Math.round(L * 0.4);
        for (let b = 0; b < branches; b++) {
            let i = ri(0, L - 3), cur = path[i];
            const len = ri(1, 3);
            for (let k = 0; k < len && i + 1 < L - 1; k++) {
                const opts = G.nbrs[cur].filter((c) => vals[c] === null);
                if (!opts.length) break;
                cur = pick(opts);
                vals[cur] = terms[++i];
            }
        }

        // A number that is not on the route at all: a near miss if one exists.
        // With X = 1 every number between the ends is a term, so the near
        // misses all fall outside and the fallback is just past either end.
        const nonTerm = () => {
            const t = pick(terms);
            const near = [t + 1, t - 1, t + X + 1, t + X - 1, t - X + 1, t - X - 1, t + 10, t - 10]
                .filter((v) => v >= 0 && !index.has(v));
            if (near.length) return pick(near);
            return Math.random() < 0.5 && lo > 0 ? ri(Math.max(0, lo - 5), lo - 1) : hi + ri(1, 5);
        };
        for (let c = 0; c < G.n; c++) {
            if (vals[c] !== null) continue;
            vals[c] = Math.random() < (X === 1 ? 0.7 : 0.35) ? pick(terms) : nonTerm();
        }

        // Count routes exactly. Each value has one step index, steps only go
        // up by one, so forward and backward path counts are a sweep each.
        const idx = (c) => (index.has(vals[c]) ? index.get(vals[c]) : -1);
        const sweep = () => {
            const fwd = new Array(G.n).fill(0), bwd = new Array(G.n).fill(0);
            const byStep = Array.from({ length: L }, () => []);
            for (let c = 0; c < G.n; c++) if (idx(c) >= 0) byStep[idx(c)].push(c);
            if (idx(path[0]) === 0) fwd[path[0]] = 1;
            for (let k = 1; k < L; k++) {
                byStep[k].forEach((c) => {
                    fwd[c] = Math.min(9, G.nbrs[c].reduce((s, x) => s + (idx(x) === k - 1 ? fwd[x] : 0), 0));
                });
            }
            bwd[path[L - 1]] = 1;
            for (let k = L - 2; k >= 0; k--) {
                byStep[k].forEach((c) => {
                    bwd[c] = Math.min(9, G.nbrs[c].reduce((s, x) => s + (idx(x) === k + 1 ? bwd[x] : 0), 0));
                });
            }
            return { fwd, bwd };
        };

        // Repair: any off-route cell that lies on a complete route becomes a
        // number with no legal step in or out. Repairs only ever remove legal
        // steps, never add them, so this terminates.
        for (let guard = 0; guard < G.n; guard++) {
            const { fwd, bwd } = sweep();
            if (fwd[path[L - 1]] === 1) break;
            for (let c = 0; c < G.n; c++) {
                if (onPath[c] || !fwd[c] || !bwd[c]) continue;
                const isolated = shuffle(range(0, L - 1)).find((j) =>
                    G.nbrs[c].every((x) => idx(x) !== j - 1 && idx(x) !== j + 1));
                vals[c] = isolated !== undefined ? terms[isolated] : nonTerm();
            }
        }
        return vals;
    }

    function mzMake(gridKind, sizeKey, pattern, X) {
        const S = SIZES[sizeKey];
        const G = mzGrid(gridKind, S.cols, S.rows);
        const P = PATTERNS[pattern];
        const start = 0, end = G.n - 1;
        const set = P.kind === 'set';
        // Set routes are kept shorter so the dead ends have room to grow: a
        // route that uses most of the pass-cells leaves nothing to get lost in.
        const minLen = Math.ceil(G.n * (set ? 0.22 : 0.32));
        const maxLen = Math.floor(G.n * (set ? 0.36 : 0.6));

        for (let attempt = 0; attempt < 30; attempt++) {
            const path = mzRoute(G, start, end, set, minLen, maxLen);
            if (!path) continue;
            const vals = set ? mzBuildSet(G, P, X, path) : mzBuildSeq(G, P, X, path);
            const labels = vals.map((v) => (P.label ? P.label(v) : String(v)));
            const m = { grid: gridKind, size: sizeKey, pattern, X, G, start, end, path, vals, labels };
            // The maze is kept on the checker's word, not the builder's.
            if (path.every((c, i) => i === 0 ? (set ? P.ok(vals[c], X) : true) : mzLegal(m, path[i - 1], c))
                && mzCount(m, 2) === 1) {
                return m;
            }
        }
        throw new Error('mazes: no maze for ' + gridKind + '/' + sizeKey + '/' + pattern + '/' + X);
    }

    const mzRuleText = (m) => PATTERNS[m.pattern].rule(m.X, m.vals[m.start]);
    const mzMoveText = (m) => (m.grid === 'square'
        ? 'Move up, down, left or right.'
        : 'Move to any hexagon that touches yours.');

    /* ---- drawing (SVG) ----------------------------------------------------*/
    const fmt = (v) => +v.toFixed(3);
    function hexPoints(x, y) {
        return [-90, -30, 30, 90, 150, 210].map((a) => {
            const r = a * Math.PI / 180;
            return fmt(x + HEX_R * Math.cos(r)) + ',' + fmt(y + HEX_R * Math.sin(r));
        }).join(' ');
    }
    // Font size in cell units, shrunk to fit the LONGEST label so "13 − 8"
    // fits — and then used for every cell, so the grid reads as one size.
    const fontFor = (labels) => Math.min(0.42,
        0.84 / (0.58 * labels.reduce((n, l) => Math.max(n, l.length), 1)));

    function mzSVG(m, view) {
        const G = m.G;
        const trail = view.trail || [];
        const inTrail = new Set(trail);
        const onSol = new Set(view.showSol ? m.path : []);
        const fs = fmt(fontFor(m.labels));
        const shapes = [], texts = [];
        let ring = '';
        for (let c = 0; c < G.n; c++) {
            const [x, y] = G.xy[c];
            const cls = ['mz-cell'];
            if (c === m.start) cls.push('is-start');
            if (c === m.end) cls.push('is-end');
            if (inTrail.has(c)) cls.push('is-trail');
            if (c === trail[trail.length - 1]) cls.push('is-tip');
            if (onSol.has(c)) cls.push('is-sol');
            const attrs = ` class="${cls.join(' ')}" data-mz-cell="${c}"`;
            const outline = (a) => (G.kind === 'square'
                ? `<rect${a} x="${fmt(x - 0.5)}" y="${fmt(y - 0.5)}" width="1" height="1"/>`
                : `<polygon${a} points="${hexPoints(x, y)}"/>`);
            shapes.push(outline(attrs));
            // The tip's ring is drawn after every cell, or the cells drawn
            // after it would cover half its border.
            if (c === trail[trail.length - 1]) ring = outline(' class="mz-tip-ring"');
            texts.push(`<text class="mz-num" x="${fmt(x)}" y="${fmt(y)}" font-size="${fs}">`
                + m.labels[c] + '</text>');
        }
        const [sx, sy] = G.xy[m.start], [ex, ey] = G.xy[m.end];
        const top = G.kind === 'square' ? 0.5 : HEX_R;
        const labels = `<text class="mz-tag" x="${fmt(sx)}" y="${fmt(sy - top - 0.14)}">START</text>`
            + `<text class="mz-tag" x="${fmt(ex)}" y="${fmt(ey + top + 0.3)}">END</text>`;
        return `<svg class="mz-svg" viewBox="-0.08 -0.55 ${fmt(G.w + 0.16)} ${fmt(G.h + 1.1)}"`
            + ' role="img" aria-label="number maze">'
            + shapes.join('') + ring
            + texts.join('') + labels + '</svg>';
    }

    /* ---- printing (jsPDF, the same engine as the Worksheets tab) ----------*/
    function mzPDF(mazes) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'letter' });
        const W = 215.9, H = 279.4, M = 12, PT = 25.4 / 72;
        const ascii = (s) => s.replace(/−/g, '-').replace(/—/g, '-');

        const header = (title) => {
            if (typeof pgHeader === 'function') return pgHeader(doc, title);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(title, M, 10);
            return 15;
        };

        function draw(m, key) {
            const G = m.G;
            const fs = fontFor(m.labels);
            const top = 34, bottom = H - M - 8;
            const s = Math.min((W - 2 * M) / G.w, (bottom - top - 12) / (G.h + 1.1), 24);
            const ox = (W - G.w * s) / 2;
            const oy = top + 0.55 * s + ((bottom - top) - (G.h + 1.1) * s) / 2;
            const P = (c) => [ox + G.xy[c][0] * s, oy + G.xy[c][1] * s];
            const onKey = new Set(key ? m.path : []);

            const shape = (c, style) => {
                const [x, y] = P(c);
                if (G.kind === 'square') { doc.rect(x - s / 2, y - s / 2, s, s, style); return; }
                const v = [-90, -30, 30, 90, 150, 210].map((a) => {
                    const r = a * Math.PI / 180;
                    return [x + HEX_R * s * Math.cos(r), y + HEX_R * s * Math.sin(r)];
                });
                const deltas = v.slice(1).map((p, i) => [p[0] - v[i][0], p[1] - v[i][1]]);
                doc.lines(deltas, v[0][0], v[0][1], [1, 1], style, true);
            };

            doc.setLineWidth(0.35);
            doc.setDrawColor(0);
            for (let c = 0; c < G.n; c++) {
                const tint = c === m.start || c === m.end ? 205 : (onKey.has(c) ? 225 : null);
                if (tint !== null) { doc.setFillColor(tint); shape(c, 'FD'); } else shape(c, 'S');
            }
            if (key) {
                doc.setDrawColor(150);
                doc.setLineWidth(Math.max(0.5, s * 0.03));
                for (let i = 1; i < m.path.length; i++) {
                    const [ax, ay] = P(m.path[i - 1]), [bx, by] = P(m.path[i]);
                    doc.line(ax, ay, bx, by);
                }
                doc.setDrawColor(0);
            }
            doc.setFont('helvetica', 'normal');
            for (let c = 0; c < G.n; c++) {
                const [x, y] = P(c);
                doc.setFontSize(fs * s / PT);
                doc.text(ascii(m.labels[c]), x, y, { align: 'center', baseline: 'middle' });
            }
            const lift = G.kind === 'square' ? 0.5 : HEX_R;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(Math.min(12, 0.22 * s / PT));
            const [sx, sy] = P(m.start), [ex, ey] = P(m.end);
            doc.text('START', sx, sy - lift * s - 1.5, { align: 'center', baseline: 'bottom' });
            doc.text('END', ex, ey + lift * s + 1.5, { align: 'center', baseline: 'top' });
        }

        const titleOf = (m) => 'Number Maze — ' + PATTERNS[m.pattern].name.replace('X', m.X);
        mazes.forEach((m, i) => {
            if (i) doc.addPage();
            header(ascii(titleOf(m)) + (mazes.length > 1 ? ' · ' + (i + 1) + ' of ' + mazes.length : ''));
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.text(ascii('Find the path from START to END. ' + mzRuleText(m) + ' ' + mzMoveText(m)),
                W / 2, 24, { align: 'center', maxWidth: W - 2 * M });
            draw(m, false);
        });
        if (typeof pgAnswerKeySeparator === 'function') pgAnswerKeySeparator(doc);
        mazes.forEach((m, i) => {
            doc.addPage();
            header(ascii(titleOf(m)) + ' — Answer Key' + (mazes.length > 1 ? ' · ' + (i + 1) : ''));
            draw(m, true);
        });
        window.open(URL.createObjectURL(doc.output('blob')), '_blank');
    }

    /* ---- state ------------------------------------------------------------*/
    const mz = {
        grid: 'square',
        size: 'medium',
        pattern: 'multiples',
        X: 3,
        maze: null,
        trail: [],
        showSol: false,
        solved: false,
        wrong: 0,
        solvedCount: 0,
    };
    const $ = (id) => document.getElementById(id);

    function mzSay(text, tone) {
        const el = $('mz-say');
        el.textContent = text;
        el.className = 'mz-say' + (tone ? ' is-' + tone : '');
    }

    function mzRender() {
        const m = mz.maze;
        $('mz-stage').innerHTML = mzSVG(m, { trail: mz.trail, showSol: mz.showSol });
        $('mz-rule').textContent = mzRuleText(m) + ' ' + mzMoveText(m);
        $('mz-score').textContent = 'Solved: ' + mz.solvedCount;
        $('mz-wrong').textContent = 'Wrong steps: ' + mz.wrong;
        $('mz-show').textContent = mz.showSol ? 'Hide path' : 'Show path';
    }

    function mzNew() {
        mz.maze = mzMake(mz.grid, mz.size, mz.pattern, mz.X);
        mz.trail = [mz.maze.start];
        mz.showSol = false;
        mz.solved = false;
        mz.wrong = 0;
        mzSay('Tap the cells to walk from START to END.');
        mzRender();
    }

    function mzTap(c) {
        const m = mz.maze;
        if (!m || mz.solved) return;
        const at = mz.trail.indexOf(c);
        if (at !== -1) {                      // step back to a cell already walked
            mz.trail = mz.trail.slice(0, at + 1);
            mzSay('Back to ' + m.labels[c] + '.');
            return mzRender();
        }
        const tip = mz.trail[mz.trail.length - 1];
        if (m.G.nbrs[tip].indexOf(c) === -1) {
            mzSay(m.grid === 'square'
                ? 'Pick a square right next to your last one.'
                : 'Pick a hexagon touching your last one.');
            return;
        }
        if (!mzLegal(m, tip, c)) {
            mz.wrong++;
            mzSay('✗ ' + mzWhy(m, tip, c), 'wrong');
            mzRender();
            const el = document.querySelector('[data-mz-cell="' + c + '"]');
            if (el) el.classList.add('is-bad');
            return;
        }
        mz.trail.push(c);
        if (c === m.end) {
            mz.solved = true;
            mz.solvedCount++;
            mzSay('✓ Solved! ' + (mz.trail.length - 1) + ' steps'
                + (mz.wrong ? ', ' + mz.wrong + ' wrong turn' + (mz.wrong === 1 ? '' : 's') + '.' : ' with no wrong turns.'),
                'right');
        } else {
            mzSay('');
        }
        mzRender();
    }

    /* ---- settings ---------------------------------------------------------*/
    function mzFillX() {
        const P = PATTERNS[mz.pattern];
        const row = $('mz-x-row');
        if (!P.xs) { row.classList.add('hidden'); return; }
        row.classList.remove('hidden');
        $('mz-x-label').textContent = P.xLabel;
        if (P.xs.indexOf(mz.X) === -1) mz.X = P.dx;
        $('mz-x').innerHTML = P.xs.map((x) =>
            `<option value="${x}"${x === mz.X ? ' selected' : ''}>${x}</option>`).join('');
    }

    function mzSetGrid(g) {
        mz.grid = g;
        document.querySelectorAll('.mz-grid-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.mzGrid === g));
        mzNew();
    }

    function mzEnter() {
        showScreen('mazes');
        if (!mz.maze) mzNew();
    }

    /* ---- screen -----------------------------------------------------------*/
    const opt = (k) => `<option value="${k}">${PATTERNS[k].name}</option>`;
    const SCREEN_HTML = `
        <div class="container mz-container">
            <div class="tt-btn-group" id="mz-grid-group">
                <button class="btn btn-secondary mz-grid-btn active" data-mz-grid="square">Squares</button>
                <button class="btn btn-secondary mz-grid-btn" data-mz-grid="hex">Hexagons</button>
            </div>
            <div class="pg-config mz-config">
                <div class="setting-row">
                    <label for="mz-pattern">Pattern</label>
                    <select id="mz-pattern" class="setting-select">
                        <optgroup label="Any order">${SET_ORDER.map(opt).join('')}</optgroup>
                        <optgroup label="In order">${SEQ_ORDER.map(opt).join('')}</optgroup>
                    </select>
                </div>
                <div class="setting-row" id="mz-x-row">
                    <label for="mz-x" id="mz-x-label">Multiples of</label>
                    <select id="mz-x" class="setting-select"></select>
                </div>
                <div class="setting-row">
                    <label for="mz-size">Size</label>
                    <select id="mz-size" class="setting-select">
                        ${Object.keys(SIZES).map((k) => `<option value="${k}"${k === 'medium' ? ' selected' : ''}>`
                            + `${SIZES[k].label} (${SIZES[k].cols}×${SIZES[k].rows})</option>`).join('')}
                    </select>
                </div>
            </div>
            <div id="mz-rule" class="mz-rule"></div>
            <div class="mz-score-bar">
                <span id="mz-score">Solved: 0</span>
                <span id="mz-wrong">Wrong steps: 0</span>
            </div>
            <div id="mz-stage" class="mz-stage"></div>
            <div id="mz-say" class="mz-say"></div>
            <div class="mz-actions">
                <button id="mz-new" class="btn btn-primary">New maze</button>
                <button id="mz-show" class="btn btn-secondary">Show path</button>
            </div>
            <div class="mz-print">
                <label for="mz-pages">Pages</label>
                <select id="mz-pages" class="setting-select">
                    ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`).join('')}
                </select>
                <button id="mz-pdf" class="btn btn-secondary">Print PDF</button>
            </div>
        </div>`;

    /* ---- boot -------------------------------------------------------------*/
    function injectStylesheet() {
        if (document.querySelector('link[data-mz-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'mazes.css?v=' + (window.ASSET_V || '1');
        link.dataset.mzCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('mazes-screen')) return;
        const div = document.createElement('div');
        div.id = 'mazes-screen';
        div.className = 'screen mz-screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        if (!bar || bar.querySelector('.tab-btn[data-tab="mazes"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'mazes';
        btn.textContent = 'Mazes';
        bar.appendChild(btn);
    }

    function wire() {
        $('mz-grid-group').addEventListener('click', (e) => {
            const b = e.target.closest('.mz-grid-btn');
            if (b) mzSetGrid(b.dataset.mzGrid);
        });
        $('mz-pattern').addEventListener('change', (e) => {
            mz.pattern = e.target.value;
            mzFillX();
            mzNew();
        });
        $('mz-x').addEventListener('change', (e) => { mz.X = Number(e.target.value); mzNew(); });
        $('mz-size').addEventListener('change', (e) => { mz.size = e.target.value; mzNew(); });
        $('mz-stage').addEventListener('click', (e) => {
            const cell = e.target.closest('[data-mz-cell]');
            if (cell) mzTap(Number(cell.dataset.mzCell));
        });
        $('mz-new').addEventListener('click', mzNew);
        $('mz-show').addEventListener('click', () => { mz.showSol = !mz.showSol; mzRender(); });
        $('mz-pdf').addEventListener('click', () => {
            if (!window.jspdf) {
                if (typeof pgCheckJsPDF === 'function') pgCheckJsPDF();
                return;
            }
            // Page one is the maze on screen; the rest are fresh with the
            // same settings.
            const pages = Number($('mz-pages').value);
            const mazes = [mz.maze];
            while (mazes.length < pages) mazes.push(mzMake(mz.grid, mz.size, mz.pattern, mz.X));
            mzPDF(mazes);
        });
        mzFillX();
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.mazes = 'mazes';
        TAB_ENTRY.mazes = mzEnter;
        wire();
    }

    // Debug handle for the smoke test, same convention as __NP / __DC.
    window.__MZ = { PATTERNS, SIZES, mzGrid, mzMake, mzLegal, mzCount, mzRoute, mzSVG, state: mz };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
