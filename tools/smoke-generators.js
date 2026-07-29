#!/usr/bin/env node
/*
 * Generator smoke test.
 *
 *   node tools/smoke-generators.js
 *
 * For every node that has a generator, draw N items with fixed seeds and assert
 * that each item's OWN answer grades correct through its OWN declared grader.
 *
 * This is the test that matters most in the whole repo. Every other failure is
 * cosmetic next to telling a child their right answer is wrong, or marking a
 * wrong answer right. It must pass before any pack ships.
 *
 * It also catches the quieter faults: a generator that is not deterministic, one
 * that emits an item type the node never declared, a multiple-choice item whose
 * correct option is always in the same position, and distractors that duplicate
 * the answer.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const DRAWS = Number(process.env.DRAWS || 50);

// ---- minimal harness: the browser globals the modules expect ---------------
global.window = global;
window.idrEscape = (s) => String(s);
// item-draw.js adapts these two from app.js; stub them so the real DRAW table can
// be loaded and exercised rather than replaced by a no-op.
global.frRenderBar = (n, d) => `<svg data-bar="${n}/${d}"></svg>`;
global.frRenderPie = (n, d) => `<svg data-pie="${n}/${d}"></svg>`;
require(path.join(__dirname, '..', 'item-draw.js'));

const nodes = [];
['curriculum/nodes-math.js', 'curriculum/nodes-english.js'].forEach((rel) => {
    const abs = path.join(__dirname, '..', rel);
    if (fs.existsSync(abs)) require(abs).forEach((n) => nodes.push(n));
});
const byId = new Map(nodes.map((n) => [n.id, n]));

// item-types.js assigns to window.*; document is only touched inside render(),
// which this test never calls.
require(path.join(__dirname, '..', 'item-types.js'));
require(path.join(__dirname, '..', 'item-gen-helpers.js'));
require(path.join(__dirname, '..', 'content', 'words-phonics.js'));
require(path.join(__dirname, '..', 'content', 'words-language.js'));
const GRADERS = window.GRADERS;

// The same xorshift32 curriculum.js uses, so seeds line up with the real app.
function makeRng(seed) {
    let s = (seed | 0) || 0x9e3779b9;
    const rng = function () {
        s ^= s << 13; s |= 0;
        s ^= s >>> 17;
        s ^= s << 5; s |= 0;
        return ((s >>> 0) / 4294967296);
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (a) => a[Math.floor(rng() * a.length)];
    rng.bool = (p) => rng() < (p === undefined ? 0.5 : p);
    rng.shuffle = (a) => {
        const x = a.slice();
        for (let i = x.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const t = x[i]; x[i] = x[j]; x[j] = t;
        }
        return x;
    };
    rng.sample = (a, n) => rng.shuffle(a).slice(0, n);
    return rng;
}

// A generator must not reach for real randomness.
Math.random = function () {
    throw new Error('a generator called Math.random() — use the seeded rng argument');
};

// ---- load packs ------------------------------------------------------------
const genDir = path.join(__dirname, '..', 'gen');
// manifest.js is this script's own output, not a pack.
const packs = fs.existsSync(genDir)
    ? fs.readdirSync(genDir).filter((f) => f.endsWith('.js') && f !== 'manifest.js')
    : [];
if (!packs.length) { console.log('\nNo generator packs yet — nothing to smoke.\n'); process.exit(0); }

const generators = new Map();
packs.forEach((f) => {
    const G = require(path.join(genDir, f));
    Object.keys(G).forEach((id) => {
        // Packs may export data for the tests under a __ prefix.
        if (id.indexOf('__') === 0) return;
        generators.set(id, { fn: G[id], pack: f });
    });
});

// ---- run -------------------------------------------------------------------
const failures = [];
let drawn = 0;
const mcPositions = new Map();

generators.forEach((entry, nodeId) => {
    const node = byId.get(nodeId);
    if (!node) { failures.push(`${entry.pack}: generator for unknown node "${nodeId}"`); return; }

    for (let i = 0; i < DRAWS; i++) {
        const seed = 1000 + i * 7919;
        let item;
        try {
            item = entry.fn(makeRng(seed), node.params || {});
        } catch (e) {
            failures.push(`${nodeId} seed ${seed}: threw — ${e.message}`);
            continue;
        }
        if (!item) { failures.push(`${nodeId} seed ${seed}: returned nothing`); continue; }
        drawn++;

        if (!item.type) failures.push(`${nodeId} seed ${seed}: no item type`);
        if (!item.stem) failures.push(`${nodeId} seed ${seed}: no stem (needed for speech and print)`);
        if (!item.grade) failures.push(`${nodeId} seed ${seed}: no grader named`);
        if (item.answer === undefined || item.answer === null) {
            failures.push(`${nodeId} seed ${seed}: no answer`);
            continue;
        }
        if (node.types && node.types.indexOf(item.type) === -1) {
            failures.push(`${nodeId} seed ${seed}: emits "${item.type}" but the node declares [${node.types}]`);
        }

        const grader = GRADERS[item.grade];
        if (!grader) { failures.push(`${nodeId} seed ${seed}: unknown grader "${item.grade}"`); continue; }

        // THE check: the item's own answer must grade correct.
        const verdict = grader(item.answer, item);
        if (!verdict.correct) {
            failures.push(`${nodeId} seed ${seed}: its own answer (${JSON.stringify(item.answer)}) grades WRONG`);
        }

        // Determinism: same seed, same item.
        const again = entry.fn(makeRng(seed), node.params || {});
        if (JSON.stringify(again) !== JSON.stringify(item)) {
            failures.push(`${nodeId} seed ${seed}: not deterministic for a fixed seed`);
        }

        if (item.type === 'mc' || item.type === 'multi') {
            if (!Array.isArray(item.choices) || item.choices.length < 2) {
                failures.push(`${nodeId} seed ${seed}: needs at least two choices`);
            } else {
                const labels = item.choices.map((c) => (typeof c === 'string' ? c : c.text));
                if (new Set(labels).size !== labels.length) {
                    failures.push(`${nodeId} seed ${seed}: duplicate choices — ${JSON.stringify(labels)}`);
                }
                if (item.type === 'mc') {
                    const key = nodeId;
                    if (!mcPositions.has(key)) mcPositions.set(key, []);
                    mcPositions.get(key).push(Number(item.answer) / Math.max(1, item.choices.length - 1));
                }
            }
        }

        // Every diagram must actually render. A missing DRAW entry or a renderer
        // that throws on unexpected args would otherwise reach a learner as a
        // question with no picture — unanswerable, and silent.
        (item.prompt || []).forEach((b) => {
            if (b.t !== 'svg') return;
            const fn = window.idrDraw[b.draw];
            if (!fn) { failures.push(`${nodeId} seed ${seed}: no DRAW entry for "${b.draw}"`); return; }
            let out;
            try { out = fn(b.args || {}); } catch (e) {
                failures.push(`${nodeId} seed ${seed}: DRAW "${b.draw}" threw — ${e.message}`);
                return;
            }
            if (!out || out.indexOf('<svg') === -1) {
                failures.push(`${nodeId} seed ${seed}: DRAW "${b.draw}" produced no svg`);
            }
        });

        // A wrong answer must actually grade wrong, or the node measures nothing.
        if (item.type === 'mc' && Array.isArray(item.choices) && item.choices.length > 1) {
            const other = (Number(item.answer) + 1) % item.choices.length;
            if (grader(other, item).correct) {
                failures.push(`${nodeId} seed ${seed}: a different choice also grades correct`);
            }
        }
    }
});

// A correct option that never moves is answerable without reading the question.
mcPositions.forEach((positions, nodeId) => {
    if (positions.length < 10) return;
    if (new Set(positions).size === 1) {
        failures.push(`${nodeId}: the correct choice is always in the same position — shuffle it`);
    }
});

// ---- pictures must agree with their answers -----------------------------------
/*
 * The counting items place their dots by rejection sampling, which gives up after
 * a bounded number of tries. If it ever gave up early the picture would show
 * fewer dots than the stated answer — a child counting correctly would be marked
 * wrong, and nothing else in the suite would notice.
 */
const DOT_NODES = ['count.oneToOne', 'count.subitize.small'];
let dotsChecked = 0;
DOT_NODES.forEach((nodeId) => {
    const entry = generators.get(nodeId);
    const node = byId.get(nodeId);
    if (!entry || !node) return;
    for (let i = 0; i < 200; i++) {
        let item;
        try { item = entry.fn(makeRng(90000 + i * 7919), node.params || {}); } catch (e) { continue; }
        if (!item) continue;
        const svg = (item.prompt || []).find((b) => b.t === 'svg' && b.draw === 'dots');
        if (!svg) continue;
        dotsChecked++;
        // For multiple choice the answer is an index, so read the chosen label.
        const stated = item.type === 'mc' ? Number(item.choices[Number(item.answer)]) : Number(item.answer);
        const drawn = (svg.args.points || []).length;
        if (drawn !== stated) {
            failures.push(`${nodeId}: picture shows ${drawn} dots but the answer says ${stated}`);
        }
    }
});

// The ten-frame must be filled to the number being asked about, and the two-set
// comparison must draw the counts its explanation claims — otherwise "which side
// has more" can show the wrong side.
const frameNode = generators.get('count.subitize.grouped');
if (frameNode) {
    const node = byId.get('count.subitize.grouped');
    for (let i = 0; i < 200; i++) {
        let item;
        try { item = frameNode.fn(makeRng(70000 + i * 7919), node.params || {}); } catch (e) { continue; }
        const frame = ((item || {}).prompt || []).find((b) => b.t === 'svg' && b.draw === 'ten-frame');
        if (!frame) continue;
        dotsChecked++;
        if (Number(frame.args.filled) !== Number(item.answer)) {
            failures.push(`count.subitize.grouped: frame filled to ${frame.args.filled} but the answer says ${item.answer}`);
        }
    }
}

const setsNode = generators.get('count.compare.sets');
if (setsNode) {
    const node = byId.get('count.compare.sets');
    for (let i = 0; i < 200; i++) {
        let item;
        try { item = setsNode.fn(makeRng(60000 + i * 7919), node.params || {}); } catch (e) { continue; }
        const svg = ((item || {}).prompt || []).find((b) => b.t === 'svg' && b.draw === 'two-sets');
        const claim = /Blue has (\d+) and orange has (\d+)/.exec((item || {}).explain || '');
        if (!svg || !claim) continue;
        dotsChecked++;
        if (svg.args.left.length !== Number(claim[1]) || svg.args.right.length !== Number(claim[2])) {
            failures.push(`count.compare.sets: drew ${svg.args.left.length}/${svg.args.right.length}`
                + ` but claims ${claim[1]}/${claim[2]} — the wrong side could look bigger`);
        }
    }
}

if (dotsChecked) console.log(`\nChecked ${dotsChecked} pictures against their answers.`);

// ---- "which part of this word" items ------------------------------------------
/*
 * When an item quotes a word and asks which PART of it does something, every
 * option has to be a part of that word. Options borrowed from other entries are
 * eliminable without reading the question, and one of them can easily turn out
 * to be part of this word as well — which makes a correct answer wrong.
 */
[['phon.schwa', /In "(\w+)"/], ['omap.heartWords', /word "(\w+)"/]].forEach(([nodeId, re]) => {
    const entry = generators.get(nodeId);
    const node = byId.get(nodeId);
    if (!entry || !node) return;
    for (let i = 0; i < 150; i++) {
        let item;
        try { item = entry.fn(makeRng(80000 + i * 7919), node.params || {}); } catch (e) { continue; }
        if (!item || !item.choices) continue;
        const m = re.exec(item.stem || '');
        if (!m) { failures.push(`${nodeId}: stem does not name a word`); continue; }
        item.choices.forEach((c) => {
            if (String(m[1]).indexOf(String(c)) === -1) {
                failures.push(`${nodeId}: offers "${c}", which is not part of "${m[1]}"`);
            }
        });
    }
});

// ---- one correct option only ---------------------------------------------------
/*
 * "Which shape has four straight sides?" is broken if three of the four options
 * do. The grader cannot notice — it compares indices, so a semantically correct
 * alternative still grades wrong — which is exactly why this needs its own check.
 */
const geomPack = fs.existsSync(path.join(genDir, 'gen-math-geom.js'))
    ? require(path.join(genDir, 'gen-math-geom.js')) : null;
if (geomPack && geomPack.__SHAPES_2D && generators.has('geom.name2d')) {
    const sides = {};
    geomPack.__SHAPES_2D.forEach((x) => { sides[x.n] = x.sides; });
    const entry = generators.get('geom.name2d');
    const node = byId.get('geom.name2d');
    for (let i = 0; i < 200; i++) {
        let item;
        try { item = entry.fn(makeRng(40000 + i * 7919), node.params || {}); } catch (e) { continue; }
        const m = /has (\d+) straight sides/.exec((item || {}).stem || '');
        if (!m || !item.choices) continue;
        const alsoRight = item.choices.filter((c, idx) =>
            idx !== Number(item.answer) && sides[c] === Number(m[1]));
        if (alsoRight.length) {
            failures.push(`geom.name2d: "${item.stem}" also admits ${alsoRight.join(', ')}`);
        }
    }
}

// ---- item variety -------------------------------------------------------------
/*
 * How many distinct questions can each generator actually produce? A node backed
 * by six hand-authored entries will repeat itself inside a single ten-item run,
 * and once a learner remembers the answers it stops measuring anything.
 *
 * Reported rather than failed: some nodes legitimately have a small space (there
 * are only eleven ways to make ten), and the runner's own de-duplication handles
 * a short run. It is the ones well under a session's length that need more
 * content.
 */
const VARIETY_DRAWS = Number(process.env.VARIETY_DRAWS || 300);
const variety = [];
generators.forEach((entry, nodeId) => {
    const node = byId.get(nodeId);
    if (!node) return;
    const seen = new Set();
    for (let i = 0; i < VARIETY_DRAWS; i++) {
        try {
            const item = entry.fn(makeRng(500000 + i * 104729), node.params || {});
            if (item) seen.add(item.sig || (item.stem + '|' + JSON.stringify(item.answer)));
        } catch (e) { /* already reported above */ }
    }
    variety.push({ id: nodeId, n: seen.size });
});

const thin = variety.filter((v) => v.n < 20).sort((a, b) => a.n - b.n);
console.log(`\nItem variety (${VARIETY_DRAWS} draws each): median ${
    variety.map((v) => v.n).sort((a, b) => a - b)[Math.floor(variety.length / 2)]} distinct.`);
if (thin.length) {
    console.log(`${thin.length} generator(s) produce fewer than 20 distinct items:`);
    thin.slice(0, 25).forEach((v) => console.log(`  ${String(v.n).padStart(3)}  ${v.id}`));
    if (thin.length > 25) console.log(`  … and ${thin.length - 25} more`);
}

// ---- passage integrity -------------------------------------------------------
/*
 * Passages are hand-authored, and the failure modes are quiet: a pronoun that
 * does not appear in the text, an "option" that is actually the right answer, or
 * a distractor list too short to make a question. None of those throw — they just
 * produce an item that is unfair or unanswerable.
 */
const langPath = path.join(__dirname, '..', 'content', 'words-language.js');
if (fs.existsSync(langPath)) {
    const L = require(langPath);
    (L.passages || []).forEach((p) => {
        const where = `passage "${p.id}"`;
        if (!p.text || p.text.length < 60) failures.push(`${where}: text missing or too short`);

        if (!p.pronoun || !p.pronoun.refersTo || !Array.isArray(p.pronoun.options)) {
            failures.push(`${where}: no usable pronoun block`);
        } else {
            if (p.pronoun.options.length < 2) failures.push(`${where}: fewer than 2 pronoun distractors`);
            if (p.text.toLowerCase().indexOf(String(p.pronoun.word).toLowerCase()) === -1) {
                failures.push(`${where}: pronoun "${p.pronoun.word}" does not appear in the text`);
            }
            if (p.pronoun.options.indexOf(p.pronoun.refersTo) !== -1) {
                failures.push(`${where}: the correct referent is also listed as a distractor`);
            }
        }

        ['inference', 'mainIdea'].forEach((k) => {
            const q = p[k];
            if (!q || !q.a) { failures.push(`${where}: missing ${k}.a`); return; }
            if (!Array.isArray(q.wrong) || q.wrong.length < 2) {
                failures.push(`${where}: ${k} needs at least 2 distractors`);
            } else if (q.wrong.indexOf(q.a) !== -1) {
                failures.push(`${where}: ${k} lists its own answer as a distractor`);
            }
        });
    });
    console.log(`\nChecked ${(L.passages || []).length} passages.`);
}

// ---- regenerate the manifest ------------------------------------------------
/*
 * gen/manifest.js is a committed artifact, written from the packs themselves so
 * it cannot drift from what they actually generate. The ladder needs to know
 * which nodes are buildable WITHOUT fetching every pack — otherwise drawing it
 * would download the whole generator layer, which is the cost lazy loading
 * exists to avoid.
 */
const byPackIds = {};
generators.forEach((entry, nodeId) => {
    const pack = entry.pack.replace(/\.js$/, '').replace(/^gen-/, '');
    (byPackIds[pack] = byPackIds[pack] || []).push(nodeId);
});

const manifestPath = path.join(genDir, 'manifest.js');
const manifestBody =
    '/*\n'
    + ' * GENERATED FILE — do not edit by hand.\n'
    + ' *   node tools/smoke-generators.js\n'
    + ' *\n'
    + ' * Declares which nodes each pack can generate, so the ladder can show what\n'
    + ' * is built without fetching every pack. Written from the packs themselves,\n'
    + ' * so it cannot disagree with them.\n'
    + ' */\n'
    + '(function () {\n'
    + "    'use strict';\n"
    + '    const MANIFEST = {\n'
    + Object.keys(byPackIds).sort().map((p) =>
        `        '${p}': [\n`
        + byPackIds[p].sort().map((id) => `            '${id}',`).join('\n')
        + '\n        ],').join('\n')
    + '\n    };\n\n'
    + '    if (typeof CUR !== \'undefined\') {\n'
    + '        Object.keys(MANIFEST).forEach((p) => CUR.declareBuilt(p, MANIFEST[p]));\n'
    + '    }\n'
    + '    if (typeof module !== \'undefined\' && module.exports) module.exports = MANIFEST;\n'
    + '})();\n';

const previous = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
if (previous !== manifestBody) {
    fs.writeFileSync(manifestPath, manifestBody);
    console.log('\nRewrote gen/manifest.js — commit it.');
}

// ---- report ----------------------------------------------------------------
const missing = nodes.filter((n) => n.tier === 1 && !generators.has(n.id));
const byPack = {};
missing.forEach((n) => { (byPack[n.pack] = byPack[n.pack] || []).push(n.id); });

console.log(`\nDrew ${drawn} items across ${generators.size} generators (${DRAWS} per node).`);
console.log(`Tier-1 nodes still without a generator: ${missing.length} of ${nodes.filter((n) => n.tier === 1).length}`);
Object.keys(byPack).sort().forEach((p) => {
    console.log(`  ${p.padEnd(12)} ${byPack[p].length}`);
});

if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    failures.slice(0, 40).forEach((f) => console.log(`  x ${f}`));
    if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
    console.log('');
    process.exit(1);
}

console.log('\nOK — every generated item grades its own answer correct.\n');
