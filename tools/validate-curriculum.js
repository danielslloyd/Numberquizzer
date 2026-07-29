#!/usr/bin/env node
/*
 * Validate the proficiency node graph.
 *
 * Run manually:  node tools/validate-curriculum.js
 *
 * Never a build gate — this repo has no build step and is not getting one.
 * Exits non-zero on error so it can be wired into CI later if that changes.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const FILES = ['curriculum/nodes-math.js', 'curriculum/nodes-english.js'];

const errors = [];
const warnings = [];
const nodes = [];

FILES.forEach((rel) => {
    const abs = path.join(__dirname, '..', rel);
    if (!fs.existsSync(abs)) { warnings.push(`${rel} not present yet — skipped`); return; }
    const loaded = require(abs);
    if (!Array.isArray(loaded)) { errors.push(`${rel} did not export an array`); return; }
    loaded.forEach((n) => nodes.push(Object.assign({ __file: rel }, n)));
});

if (!nodes.length) {
    console.error('No nodes loaded. Nothing to validate.');
    process.exit(1);
}

const byId = new Map();
const VALID_TYPES = new Set(['numeric', 'mc', 'multi', 'text', 'tap-token', 'tap-region',
    'order', 'match', 'numberline', 'build', 'sort-bins', 'cloze', 'fraction']);

// ---- shape + uniqueness -------------------------------------------------
nodes.forEach((n) => {
    const where = `${n.__file}:${n.id}`;
    if (!n.id) { errors.push(`${n.__file}: node with no id`); return; }
    if (byId.has(n.id)) errors.push(`duplicate id "${n.id}"`);
    byId.set(n.id, n);

    if (!n.strand) errors.push(`${where}: missing strand`);
    if (!n.label) errors.push(`${where}: missing label`);
    if (!Number.isInteger(n.rung) || n.rung < 1) errors.push(`${where}: bad rung ${n.rung}`);
    if (![1, 2, 3].includes(n.tier)) errors.push(`${where}: tier must be 1, 2 or 3 (got ${n.tier})`);
    if (!n.pack) errors.push(`${where}: missing pack`);
    if (!Array.isArray(n.types) || !n.types.length) errors.push(`${where}: no item types`);
    (n.types || []).forEach((t) => {
        if (!VALID_TYPES.has(t)) errors.push(`${where}: unknown item type "${t}"`);
    });
    if (!n.id.startsWith(n.strand + '.')) {
        warnings.push(`${where}: id does not start with its strand prefix "${n.strand}."`);
    }
    if (n.automaticity && !(n.automaticity.targetMs > 0)) {
        errors.push(`${where}: automaticity needs a positive targetMs`);
    }
});

// ---- edges --------------------------------------------------------------
nodes.forEach((n) => {
    (n.prereq || []).forEach((p) => {
        if (!byId.has(p)) errors.push(`${n.id}: prereq "${p}" does not exist`);
        if (p === n.id) errors.push(`${n.id}: is its own prereq`);
    });
});

// ---- acyclicity ---------------------------------------------------------
const WHITE = 0, GREY = 1, BLACK = 2;
const colour = new Map(nodes.map((n) => [n.id, WHITE]));
const stack = [];
let cycleFound = false;

function visit(id) {
    if (cycleFound) return;
    colour.set(id, GREY);
    stack.push(id);
    const n = byId.get(id);
    (n.prereq || []).forEach((p) => {
        if (!byId.has(p)) return;
        const c = colour.get(p);
        if (c === GREY) {
            const from = stack.indexOf(p);
            errors.push(`cycle: ${stack.slice(from).join(' -> ')} -> ${p}`);
            cycleFound = true;
        } else if (c === WHITE) visit(p);
    });
    stack.pop();
    colour.set(id, BLACK);
}
nodes.forEach((n) => { if (colour.get(n.id) === WHITE) visit(n.id); });

// ---- rung consistency within a strand -----------------------------------
nodes.forEach((n) => {
    (n.prereq || []).forEach((p) => {
        const pre = byId.get(p);
        if (pre && pre.strand === n.strand && pre.rung >= n.rung) {
            errors.push(`${n.id} (rung ${n.rung}) depends on same-strand ${p} (rung ${pre.rung}) — reorder the array`);
        }
    });
});

// ---- tier-1 closure -----------------------------------------------------
// A tier-1 node whose prereq is tier 2/3 leaves a hole in the suggested-next
// chain: the ladder points at something marked "not built yet".
nodes.forEach((n) => {
    if (n.tier !== 1) return;
    (n.prereq || []).forEach((p) => {
        const pre = byId.get(p);
        if (pre && pre.tier !== 1) {
            errors.push(`tier-1 ${n.id} depends on tier-${pre.tier} ${p} — promote ${p} or demote ${n.id}`);
        }
    });
});

// ---- gate test (out-degree) --------------------------------------------
const outDeg = new Map(nodes.map((n) => [n.id, 0]));
nodes.forEach((n) => (n.prereq || []).forEach((p) => {
    if (outDeg.has(p)) outDeg.set(p, outDeg.get(p) + 1);
}));

const weakTier1 = nodes
    .filter((n) => n.tier === 1 && outDeg.get(n.id) < 2)
    .map((n) => `${n.id} (gates ${outDeg.get(n.id)})`);

// ---- PROFICIENCIES.md must agree with the data --------------------------
// The document is declared the source of authority, so drift between it and
// these files is a defect in the document, not a cosmetic mismatch.
const docPath = path.join(__dirname, '..', 'curriculum', 'PROFICIENCIES.md');
if (fs.existsSync(docPath)) {
    const doc = fs.readFileSync(docPath, 'utf8');
    const rowRe = /^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|[^|]*\|\s*([123])\b[^|]*\|/gm;
    const documented = new Set();
    let m;
    while ((m = rowRe.exec(doc)) !== null) {
        const [, id, tierStr] = m;
        const tier = parseInt(tierStr, 10);
        documented.add(id);
        const node = byId.get(id);
        if (!node) { errors.push(`PROFICIENCIES.md lists "${id}", which is not in the data`); continue; }
        if (node.tier !== tier) {
            errors.push(`PROFICIENCIES.md gives ${id} tier ${tier}, data says tier ${node.tier}`);
        }
    }
    nodes.forEach((n) => {
        if (!documented.has(n.id)) warnings.push(`${n.id} is in the data but not in PROFICIENCIES.md`);
    });

    // Headline counts stated in prose must match reality.
    const declared = /\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)\*\*/.exec(doc);
    if (declared) {
        const t1 = nodes.filter((n) => n.tier === 1).length;
        if (+declared[1] !== nodes.length) errors.push(`PROFICIENCIES.md totals ${declared[1]} nodes, data has ${nodes.length}`);
        if (+declared[2] !== t1) errors.push(`PROFICIENCIES.md totals ${declared[2]} tier-1, data has ${t1}`);
    }
} else {
    warnings.push('curriculum/PROFICIENCIES.md not found — document/data agreement unchecked');
}

// ---- provenance must not leak into UI code ------------------------------
const UI_FILES = ['app.js', 'library.js', 'item-runner.js', 'item-types.js', 'progress.js'];
UI_FILES.forEach((rel) => {
    const abs = path.join(__dirname, '..', rel);
    if (!fs.existsSync(abs)) return;
    const src = fs.readFileSync(abs, 'utf8');
    if (/\bprovenance\b/.test(src)) {
        errors.push(`${rel} references "provenance" — grade level must never reach the UI`);
    }
});

// ---- report -------------------------------------------------------------
const strands = [...new Set(nodes.map((n) => n.strand))];
console.log('\nProficiency graph\n');
strands.forEach((s) => {
    const inStrand = nodes.filter((n) => n.strand === s);
    const t1 = inStrand.filter((n) => n.tier === 1).length;
    console.log(`  ${s.padEnd(7)} ${String(inStrand.length).padStart(3)} nodes   ${String(t1).padStart(3)} tier-1`);
});
console.log(`\n  total   ${String(nodes.length).padStart(3)} nodes   ${String(nodes.filter((n) => n.tier === 1).length).padStart(3)} tier-1`);

const auto = nodes.filter((n) => n.automaticity);
const misc = nodes.filter((n) => n.misconceptions && n.misconceptions.length);
console.log(`  ${auto.length} carry a latency target, ${misc.length} carry a named misconception`);

const topGates = [...outDeg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('\nMost load-bearing (by out-degree):');
topGates.forEach(([id, d]) => console.log(`  ${String(d).padStart(2)}  ${id}`));

if (weakTier1.length) {
    console.log(`\nTier-1 nodes gating fewer than 2 others (justified by other filter criteria — review):`);
    weakTier1.forEach((s) => console.log(`  ${s}`));
}

if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(`  ! ${w}`));
}

if (errors.length) {
    console.log(`\n${errors.length} error(s):`);
    errors.forEach((e) => console.log(`  x ${e}`));
    console.log('');
    process.exit(1);
}

console.log('\nOK — graph is valid.\n');
