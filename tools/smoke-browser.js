#!/usr/bin/env node
/*
 * Browser smoke test.
 *
 *   python3 -m http.server 8765 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/smoke-browser.js
 *
 * Checks the things that are easy to break and invisible in a diff: that every
 * tab still opens and highlights, that the lazily-loaded modules are genuinely
 * not fetched at boot, and that the curriculum registry came up.
 */
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.SMOKE_URL || 'http://localhost:8765/index.html';

const EAGER_TABS = ['flashcards', 'worksheets', 'sorting', 'ciphers', 'make-ten',
    'ten-frame', 'times-grid', 'fractions', 'money', 'visualizer', 'place-value', 'sudoku'];
const LAZY_TABS = ['la-vocab', 'la-cap', 'la-punct', 'la-subj', 'la-diag', 'geo-proofs', 'polygons'];

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail && !ok ? '  — ' + detail : ''}`);
}

(async () => {
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' })
        .catch(() => chromium.launch());
    const page = await browser.newPage();

    const consoleErrors = [];
    const requested = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    page.on('request', (r) => requested.push(r.url()));

    console.log('\nLoading ' + BASE + '\n');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // TAB_ENTRY is a top-level `const` in app.js, so it lives in the global
    // lexical environment rather than on `window` — probe the bare name.
    await page.waitForFunction(() => typeof TAB_ENTRY !== 'undefined' && !!window.CUR, { timeout: 15000 });

    // ---- lazy loading -------------------------------------------------
    const fetched = (name) => requested.some((u) => u.includes(name));
    check('geometry-proofs.js not fetched at boot', !fetched('geometry-proofs.js'));
    check('language-arts.js not fetched at boot', !fetched('language-arts.js'));
    check('polygons.js not fetched at boot', !fetched('polygons.js'));
    check('app.js fetched at boot', fetched('app.js'));
    check('nodes-math.js fetched at boot', fetched('nodes-math.js'));

    // ---- registry -----------------------------------------------------
    const curCount = await page.evaluate(() => (window.CUR ? window.CUR.all().length : -1));
    check('curriculum registry populated (201 nodes)', curCount === 201, 'got ' + curCount);

    const ladderOk = await page.evaluate(() => {
        const l = window.CUR.ladder('frac');
        return l.length === 26 && l[0].rung === 1 && l[25].rung === 26;
    });
    check('fractions ladder ordered by rung', ladderOk);

    const gatesOk = await page.evaluate(() => window.CUR.gates('frac.aOverB').length === 7);
    check('reverse edge index derived', gatesOk);

    const rngOk = await page.evaluate(() => {
        const a = window.CUR.rng(42), b = window.CUR.rng(42);
        return a() === b() && a.int(1, 100) === b.int(1, 100);
    });
    check('seeded RNG is deterministic', rngOk);

    const noGrade = await page.evaluate(() =>
        window.CUR.all().every((n) => n.grade === undefined && !('gradeLevel' in n)));
    check('no grade field on any node', noGrade);

    // ---- tab bar ------------------------------------------------------
    const tabs = await page.$$eval('#tab-bar .tab-btn', (els) => els.map((e) => e.dataset.tab));
    check('all 20 tabs present', tabs.length === 20, 'got ' + tabs.length + ': ' + tabs.join(','));
    check('no duplicate tab buttons', new Set(tabs).size === tabs.length);
    check('lazy tabs in place', LAZY_TABS.every((t) => tabs.includes(t)));

    // ---- section bar groups the tabs -----------------------------------
    const sections = await page.$$eval('.section-btn', (els) => els.map((e) => e.dataset.section));
    check('section bar has four sections',
        JSON.stringify(sections) === JSON.stringify(['learn', 'maths', 'english', 'tools']),
        JSON.stringify(sections));
    check('app opens on Maths',
        await page.evaluate(() => (document.querySelector('.screen.active') || {}).id === 'home-screen'
            && document.querySelector('.section-btn.active').dataset.section === 'maths'));
    check('Learn hides the activity row entirely',
        await page.evaluate(() => {
            lbApplySection('learn', { enter: true });
            return document.getElementById('tab-bar').classList.contains('hidden');
        }));

    // Every tab must be reachable through exactly one section, and an unlisted
    // tab must still land somewhere rather than vanishing.
    const coverage = await page.evaluate(() => {
        const out = {};
        document.querySelectorAll('#tab-bar .tab-btn').forEach((b) => {
            const s = window.ACTIVITY_SECTION[b.dataset.tab] || 'tools';
            (out[s] = out[s] || []).push(b.dataset.tab);
        });
        return out;
    });
    const covered = Object.keys(coverage).reduce((n, k) => n + coverage[k].length, 0);
    check('every tab belongs to a section', covered === 20, JSON.stringify(coverage));

    // ---- every eager tab opens and highlights --------------------------
    for (const tab of EAGER_TABS) {
        // Select the tab's section first — the row is filtered now, so a tab
        // outside the active section is genuinely not on screen.
        await page.evaluate((t) => lbApplySection(window.ACTIVITY_SECTION[t] || 'tools'), tab);
        await page.waitForTimeout(60);
        await page.click(`#tab-bar .tab-btn[data-tab="${tab}"]`);
        await page.waitForTimeout(120);
        const state = await page.evaluate((t) => {
            const active = document.querySelector('.screen.active');
            const btn = document.querySelector(`.tab-btn[data-tab="${t}"]`);
            return {
                screen: active ? active.id : null,
                highlighted: btn ? btn.classList.contains('active') : false,
                activeCount: document.querySelectorAll('.tab-btn.active').length,
            };
        }, tab);
        check(`tab ${tab}: screen shown + highlighted`,
            !!state.screen && state.highlighted && state.activeCount === 1,
            JSON.stringify(state));
    }

    // ---- lazy tab actually loads on click ------------------------------
    await page.evaluate((t) => lbApplySection(window.ACTIVITY_SECTION[t] || 'tools'), 'geo-proofs');
    await page.waitForTimeout(60);
    await page.click('#tab-bar .tab-btn[data-tab="geo-proofs"]');
    await page.waitForFunction(() => !!document.getElementById('geo-proofs-screen'), { timeout: 15000 })
        .catch(() => {});
    await page.waitForTimeout(400);
    check('geometry-proofs.js fetched on click', fetched('geometry-proofs.js'));
    const gpState = await page.evaluate(() => ({
        screen: (document.querySelector('.screen.active') || {}).id,
        highlighted: !!document.querySelector('.tab-btn[data-tab="geo-proofs"].active'),
        tabCount: document.querySelectorAll('#tab-bar .tab-btn').length,
        gpTabs: document.querySelectorAll('.tab-btn[data-tab="geo-proofs"]').length,
    }));
    check('proofs screen opened after lazy load', gpState.screen === 'geo-proofs-screen', JSON.stringify(gpState));
    check('proofs tab highlighted', gpState.highlighted);
    check('lazy load did not duplicate the tab', gpState.gpTabs === 1 && gpState.tabCount === 20,
        JSON.stringify(gpState));

    await page.evaluate((t) => lbApplySection(window.ACTIVITY_SECTION[t] || 'tools'), 'la-vocab');
    await page.waitForTimeout(60);
    await page.click('#tab-bar .tab-btn[data-tab="la-vocab"]');
    await page.waitForTimeout(800);
    const laState = await page.evaluate(() => ({
        screen: (document.querySelector('.screen.active') || {}).id,
        tabCount: document.querySelectorAll('#tab-bar .tab-btn').length,
    }));
    check('language-arts lazy load works', laState.screen === 'la-vocab-screen', JSON.stringify(laState));
    check('language-arts did not duplicate tabs', laState.tabCount === 20, JSON.stringify(laState));

    // ---- Fractions: three modes, three tiers ---------------------------
    // Round generation is the part with no visible failure mode: a compare pair
    // that is secretly equal, or a simplify source already in lowest terms,
    // looks like a working screen and is an unanswerable question.
    await page.evaluate(() => lbApplySection('maths'));
    await page.waitForTimeout(60);
    await page.click('#tab-bar .tab-btn[data-tab="fractions"]');
    await page.waitForTimeout(150);

    const frGen = await page.evaluate(() => {
        const gcd = (a, b) => (b ? gcd(b, a % b) : a);
        const errs = [];
        ['easy', 'medium', 'hard'].forEach((lvl) => {
            frState.level = lvl;
            const L = FR_LEVELS[lvl];
            let equal = 0;
            for (let i = 0; i < 300; i++) {
                frState.mode = 'compare';
                frNewCompare();
                const [a, b] = frState.pair;
                const diff = a.num / a.den - b.num / b.den;
                const want = Math.abs(diff) < 1e-9 ? 0 : Math.sign(diff);
                if (want !== frState.rel) errs.push(lvl + ': rel disagrees with the values');
                if (frState.rel === 0) equal++;
                else if (Math.abs(diff) < L.gap - 1e-9) errs.push(lvl + ': pair closer than the tier gap');
                if (!L.dens.includes(a.den) || !L.dens.includes(b.den)) errs.push(lvl + ': denominator outside the tier pool');
            }
            if (!equal) errs.push(lvl + ': never produced an equal pair');
            for (let i = 0; i < 200; i++) {
                frState.mode = 'build';
                frNewWork();
                if (frState.target.den > frState.maxDen) errs.push(lvl + ': build target beyond the builder ceiling');
                frState.mode = 'simplify';
                frNewWork();
                const t = frState.target;
                if (gcd(t.num, t.den) === 1) errs.push(lvl + ': simplify source is already in lowest terms');
                if (t.den > L.simpMax) errs.push(lvl + ': simplify source over simpMax');
                if (frState.locked) errs.push(lvl + ': simplify round is already won at the start');
            }
        });
        return [...new Set(errs)];
    });
    check('fractions: every tier generates sound rounds', frGen.length === 0, frGen.join(' | '));

    const frUI = await page.evaluate(() => {
        document.querySelector('.fr-mode-btn[data-fr-mode="compare"]').click();
        // Pin a known unequal pair so the expected operator is decidable.
        frState.locked = false;
        frState.pair = [{ num: 3, den: 4 }, { num: 1, den: 4 }];
        frState.rel = 1;
        document.querySelectorAll('#fr-versus .fr-shape-card').forEach((c, i) => {
            const f = frState.pair[i];
            c.className = 'fr-shape-card';
            c.innerHTML = frRenderPie(f.num, f.den) +
                `<div class="fr-label">${frFracHTML(f.num, f.den)}</div>`;
        });
        const box = (el) => el.getBoundingClientRect();
        const f = document.querySelector('#fr-versus .fr-frac');
        const n = box(f.querySelector('.fr-frac-n'));
        const bar = box(f.querySelector('.fr-frac-bar'));
        const d = box(f.querySelector('.fr-frac-d'));
        const cards = [...document.querySelectorAll('#fr-versus .fr-shape-card')].map(box);
        const slot = box(document.querySelector('.fr-op-slot'));
        const circle = box(document.getElementById('fr-eq-btn'));

        document.querySelectorAll('#fr-versus .fr-shape-card')[0].click();
        const op = document.getElementById('fr-op');
        const r = box(op);
        return {
            stacked: n.bottom <= bar.top + 1 && bar.bottom <= d.top + 1,
            sideBySide: cards[0].right <= slot.left + 1 && slot.right <= cards[1].left + 1,
            slashed: /\//.test(document.querySelector('#fr-versus .fr-label').textContent),
            text: op.textContent,
            size: parseFloat(getComputedStyle(op).fontSize),
            inSlot: Math.abs((r.left + r.width / 2) - (circle.left + circle.width / 2)) < 2,
        };
    });
    check('fractions: labels are stacked over/under, never a/b', frUI.stacked && !frUI.slashed, JSON.stringify(frUI));
    check('fractions: compare puts the two shapes side by side', frUI.sideBySide, JSON.stringify(frUI));
    check('fractions: picking a card reveals a big operator in the slot',
        frUI.text === '>' && frUI.size >= 40 && frUI.inSlot, JSON.stringify(frUI));

    // ---- Polygons ------------------------------------------------------
    await page.evaluate(() => lbApplySection('maths'));
    await page.waitForTimeout(60);
    await page.click('#tab-bar .tab-btn[data-tab="polygons"]');
    await page.waitForFunction(() => !!window.__PY && !!document.getElementById('py-draw-stage'), { timeout: 15000 })
        .catch(() => {});
    await page.waitForTimeout(300);
    check('polygons.js fetched on click', fetched('polygons.js'));

    const pyState = await page.evaluate(() => {
        const P = window.__PY;
        const errs = [];
        const state = {
            screen: (document.querySelector('.screen.active') || {}).id,
            highlighted: !!document.querySelector('.tab-btn[data-tab="polygons"].active'),
            tabCount: document.querySelectorAll('#tab-bar .tab-btn').length,
        };
        // Draw mode: the overlays must match the maths for every side count.
        const slider = document.getElementById('py-slider');
        P.state.show.symmetry = true;
        P.state.show.diagonals = true;
        for (let n = 3; n <= 20; n++) {
            slider.value = n;
            slider.dispatchEvent(new Event('input'));
            const svg = document.querySelector('#py-draw-stage svg');
            if (svg.querySelectorAll('.py-sym').length !== n) errs.push('n=' + n + ': symmetry axes != n');
            if (svg.querySelectorAll('.py-diag').length !== (n * (n - 3)) / 2) errs.push('n=' + n + ': diagonal count wrong');
            const lens = P.pySideLengths(P.pyRegularPts(n));
            if (Math.max(...lens) / Math.min(...lens) > 1.0001) errs.push('n=' + n + ': regular sides unequal');
        }
        P.state.show.symmetry = false;
        P.state.show.diagonals = false;

        // Irregular polygons must stay simple — a self-crossing outline is not
        // a polygon at all, and the jitter is what could produce one.
        const crosses = (a, b, c, d) => {
            const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
            return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
        };
        for (let t = 0; t < 200; t++) {
            const n = 3 + Math.floor(Math.random() * 6);
            const pts = P.pyIrregularPts(n);
            const lens = P.pySideLengths(pts);
            if (Math.max(...lens) / Math.min(...lens) < 1.25) errs.push('irregular polygon looks regular');
            for (let i = 0; i < n; i++) {
                for (let j = i + 2; j < n; j++) {
                    if (i === 0 && j === n - 1) continue;
                    if (crosses(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) {
                        errs.push('irregular polygon self-intersects');
                    }
                }
            }
        }

        // Quiz: every question must have its answer among the choices, exactly
        // one of them, and that answer must be the true one.
        const NAMES = P.PY_NAMES;
        const deg = (v) => (Number.isInteger(v) ? v : Number(v.toFixed(1))) + '°';
        const truth = (q) => {
            const n = q.n;
            if (/called/.test(q.text)) return (q.regular && (n === 3 ? 'Equilateral triangle' : n === 4 ? 'Square' : null)) || NAMES[n];
            if (/how many sides/i.test(q.text)) return String(n);
            if (/regular\?$/.test(q.text)) return q.regular ? 'Regular' : 'Irregular';
            if (/lines of symmetry/.test(q.text)) return String(n);
            if (/add up to/.test(q.text)) return deg((n - 2) * 180);
            if (/how big is each angle/i.test(q.text)) return deg(((n - 2) * 180) / n);
            if (/how far do you turn/i.test(q.text)) return deg(360 / n);
            if (/diagonals/.test(q.text)) return String((n * (n - 3)) / 2);
            return '??';
        };
        ['easy', 'medium', 'hard'].forEach((lvl) => {
            [false, true].forEach((irr) => {
                P.state.level = lvl;
                P.state.irregular = irr;
                const L = P.PY_LEVELS[lvl];
                for (let i = 0; i < 250; i++) {
                    const q = P.pyMakeQuestion();
                    if (lvl !== 'hard' && /°/.test(q.correct)) errs.push(lvl + ': a question answered in degrees outside Hard');
                    if (q.n < L.min || q.n > L.max) errs.push(lvl + ': side count outside the tier');
                    if (new Set(q.choices).size !== q.choices.length) errs.push(lvl + ': duplicate choices');
                    if (q.choices.indexOf(q.correct) === -1) errs.push(lvl + ': correct answer missing from the choices');
                    if (truth(q) !== q.correct) errs.push(lvl + ': "' + q.text.slice(0, 20) + '" answer is wrong');
                    if (!irr && !q.regular) errs.push(lvl + ': irregular shape drawn with irregulars off');
                    if (/symmetry|each angle|do you turn/i.test(q.text) && !q.regular) {
                        errs.push(lvl + ': regular-only question asked of an irregular shape');
                    }
                }
            });
        });
        P.state.irregular = false;
        return { state, errs: [...new Set(errs)] };
    });
    check('polygons screen opened after lazy load',
        pyState.state.screen === 'polygons-screen' && pyState.state.highlighted, JSON.stringify(pyState.state));
    check('polygons lazy load did not duplicate the tab', pyState.state.tabCount === 20, JSON.stringify(pyState.state));
    check('polygons: drawing and quiz are mathematically sound',
        pyState.errs.length === 0, pyState.errs.join(' | '));

    // ---- Learn: browse a ladder and run an assessment -------------------
    await page.evaluate(() => lbApplySection('learn', { enter: true }));
    await page.waitForTimeout(250);
    check('Learn tab opens the strand list',
        await page.evaluate(() => (document.querySelector('.screen.active') || {}).id === 'lb-strands-screen'));

    const strandCards = await page.$$eval('[data-strand]', (els) => els.map((e) => e.dataset.strand));
    check('all 18 strands listed', strandCards.length === 18, 'got ' + strandCards.length);

    await page.click('[data-strand="frac"]');
    await page.waitForTimeout(250);
    const ladder = await page.evaluate(() => ({
        screen: (document.querySelector('.screen.active') || {}).id,
        rungs: document.querySelectorAll('.lb-rung').length,
        unbuilt: document.querySelectorAll('.lb-rung-unbuilt').length,
        hash: location.hash,
    }));
    // Derived rather than hard-coded: the greyed-out count must always equal the
    // number of rungs with no generator, however many that happens to be.
    const expectedUnbuilt = await page.evaluate(() =>
        CUR.ladder('frac').filter((n) => !CUR.isBuilt(n.id)).length);
    check('fractions ladder shows every rung, greying only the unbuilt ones',
        ladder.rungs === 26 && ladder.unbuilt === expectedUnbuilt,
        JSON.stringify(Object.assign({ expectedUnbuilt }, ladder)));
    check('ladder deep-links by hash', ladder.hash === '#/frac', ladder.hash);

    // Nothing is gated: the top rung must be openable from a cold profile.
    await page.evaluate(() => { location.hash = '#/frac/frac.div.wholeByUnit'; });
    await page.waitForTimeout(250);
    const topRung = await page.evaluate(() => ({
        screen: (document.querySelector('.screen.active') || {}).id,
        checkEnabled: !!document.querySelector('[data-act="check"]:not([disabled])'),
    }));
    check('top rung openable with no prior progress (nothing gated)',
        topRung.screen === 'lb-node-screen' && topRung.checkEnabled, JSON.stringify(topRung));

    // Run an assessment and answer everything correctly by reading the item.
    await page.click('[data-act="check"]');
    await page.waitForFunction(() => document.querySelectorAll('#ir-response-host .ir-input').length > 0,
        { timeout: 10000 }).catch(() => {});
    check('runner started', await page.evaluate(() =>
        (document.querySelector('.screen.active') || {}).id === 'ir-run-screen'));

    let answered = 0;
    for (let i = 0; i < 10; i++) {
        const done = await page.evaluate(() => (document.querySelector('.screen.active') || {}).id === 'ir-results-screen');
        if (done) break;
        const ok = await page.evaluate(() => {
            const S = window.__IR;
            const item = S.items[S.idx];
            if (!item) return false;
            const input = document.querySelector('#ir-response-host .ir-input');
            if (!input) return false;
            input.value = String(item.answer);
            return true;
        });
        if (!ok) break;
        const before = await page.evaluate(() => window.__IR.idx);
        answered++;
        // Pause past the anti-mash floor. Answering instantly is not a thing a
        // human does, and progress.js deliberately discards responses that fast —
        // so a test that submits immediately would exercise the wrong path.
        await page.waitForTimeout(500);
        await page.click('#ir-submit');
        // A correct answer advances itself after a beat, so wait for the state to
        // move rather than racing the auto-advance by clicking Next.
        await page.waitForFunction((prev) =>
            window.__IR.idx !== prev
            || (document.querySelector('.screen.active') || {}).id === 'ir-results-screen',
        before, { timeout: 5000 }).catch(async () => {
            const nextBtn = await page.$('#ir-next:not(.hidden)');
            if (nextBtn) await nextBtn.click().catch(() => {});
        });
        await page.waitForTimeout(120);
    }
    check('answered a full run of items', answered >= 8, 'answered ' + answered);

    await page.waitForTimeout(500);
    const res = await page.evaluate(() => ({
        screen: (document.querySelector('.screen.active') || {}).id,
        score: (document.getElementById('ir-res-score') || {}).textContent,
        rec: window.__PR.raw().nodes['frac.div.wholeByUnit'] || null,
    }));
    check('results screen reached', res.screen === 'ir-results-screen', JSON.stringify(res));
    check('every answer graded correct', /^(\d+) \/ \1$/.test((res.score || '').trim()), res.score);
    check('progress recorded for the node', res.rec && res.rec.n >= 8, JSON.stringify(res.rec));
    check('latency captured', res.rec && res.rec.times && res.rec.times.length > 0);

    // The two-day rule: perfect accuracy on day one must NOT reach proficient.
    check('perfect run on one day stops at level 2, not proficient',
        res.rec && res.rec.lvl === 2, 'lvl=' + (res.rec && res.rec.lvl));

    const blocked = await page.evaluate(() => prBlockedBy('frac.div.wholeByUnit'));
    check('reason given is "come back another day"',
        blocked && blocked.reason === 'comeBack', JSON.stringify(blocked));

    // Same node, backdated a day: now it should promote.
    const promoted = await page.evaluate(() => {
        const r = window.__PR.raw().nodes['frac.div.wholeByUnit'];
        r.days = ['2020-01-01', '2020-01-02'];
        prRecord('frac.div.wholeByUnit', { correct: true, partial: 1, ms: 2000 });
        return window.__PR.raw().nodes['frac.div.wholeByUnit'].lvl;
    });
    check('promotes to proficient once two distinct days are seen', promoted === 3, 'lvl=' + promoted);

    // Mashing must not promote: 40 instant correct answers are evidence of
    // nothing, and the fastest route to "proficient" must never be to not read.
    const mashed = await page.evaluate(() => {
        for (let i = 0; i < 40; i++) prRecord('frac.scaling', { correct: true, partial: 1, ms: 60 });
        const r = window.__PR.raw().nodes['frac.scaling'];
        return { n: r.n, sn: r.sn, m: r.m, lvl: r.lvl };
    });
    check('40 instant correct answers do not reach proficient',
        mashed.lvl < 3 && mashed.sn === 0, JSON.stringify(mashed));

    // ---- an English node, end to end, on a multiple-choice type ---------
    await page.evaluate(() => { location.hash = '#/morph/morph.inferMeaning'; });
    await page.waitForTimeout(250);
    await page.click('[data-act="check"]');
    await page.waitForFunction(() => document.querySelectorAll('.ir-choice').length > 0, { timeout: 10000 })
        .catch(() => {});

    const mcRun = await page.evaluate(async () => {
        const S = window.__IR;
        const item = S.items[S.idx];
        const btns = [...document.querySelectorAll('.ir-choice')];
        return {
            choices: btns.length,
            hasStem: !!(item && item.stem),
            speakable: typeof idrSpeakable(item) === 'string' && idrSpeakable(item).length > 10,
        };
    });
    check('English multiple-choice item renders its options', mcRun.choices >= 2, JSON.stringify(mcRun));
    check('item is speakable for a learner who cannot read it', mcRun.speakable);

    // Choosing the wrong option must mark wrong and reveal the right one, since
    // seeing the correct answer beside your own is most of the teaching.
    const wrongFlow = await page.evaluate(async () => {
        const S = window.__IR;
        const item = S.items[S.idx];
        const wrongIdx = (Number(item.answer) + 1) % item.choices.length;
        document.querySelectorAll('.ir-choice')[wrongIdx].click();
        await new Promise((r) => setTimeout(r, 300));
        return {
            marked: !!document.querySelector('.ir-feedback.ir-fb-wrong'),
            revealed: !!document.querySelector('.ir-choice.is-correct'),
            waitsForNext: !document.getElementById('ir-next').classList.contains('hidden'),
        };
    });
    check('a wrong answer is marked, the right one revealed, and it waits',
        wrongFlow.marked && wrongFlow.revealed && wrongFlow.waitsForNext, JSON.stringify(wrongFlow));

    // ---- practice modes feed the same mastery record --------------------
    const practice = await page.evaluate(() => {
        const before = (window.__PR.raw().nodes['mult.facts'] || {}).n || 0;
        ttBumpMastery(6, 7);                       // as the Times Tables grid does
        const after = window.__PR.raw().nodes['mult.facts'];
        return {
            grew: after.n === before + 1,
            legacyKept: localStorage.getItem('ttFact_6x7') !== null,
            timed: (after.times || []).length,
        };
    });
    check('times-tables practice records against mult.facts', practice.grew, JSON.stringify(practice));
    check('legacy ttFact_ key still written', practice.legacyKept);
    // Practice carries no timing on purpose, so it cannot satisfy a latency gate.
    check('practice contributes no latency evidence', practice.timed === 0, 'times=' + practice.timed);

    const flashNode = await page.evaluate(() => [
        flashcardNode('7\n×\n8', 10),
        flashcardNode('9\n÷\n3', 10),
        flashcardNode('4\n+\n5', 10),
        flashcardNode('40\n+\n55', 100),
    ]);
    check('flash cards map to the right proficiency by operator and range',
        JSON.stringify(flashNode) === JSON.stringify(
            ['mult.facts', 'mult.div.facts', 'add.facts.within10', 'add.within100']),
        JSON.stringify(flashNode));

    // ---- backup round-trip ------------------------------------------------
    // With no server this file is the only copy of a learner's progress, so a
    // broken round-trip loses everything with no way to notice.
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForTimeout(200);
    const backup = await page.evaluate(() => {
        const before = JSON.stringify(window.__PR.raw().nodes);
        const dump = prExport();
        prReset();
        const wiped = Object.keys(window.__PR.raw().nodes).length;
        prImport(dump);
        return { wiped: wiped, restored: JSON.stringify(window.__PR.raw().nodes) === before };
    });
    check('reset clears progress', backup.wiped === 0, 'left ' + backup.wiped);
    check('export/import round-trips progress exactly', backup.restored);

    // A restore must survive the debounced writer. Recording leaves a blob
    // queued; if the pre-restore blob is later flushed it silently undoes the
    // restore, and nobody would know why their progress came back wrong.
    const restoreSticks = await page.evaluate(async () => {
        prReset();
        prRecord('frac.unit', { correct: true, partial: 1, ms: 1200 });
        const dump = prExport();                 // snapshot WITH frac.unit
        prRecord('frac.unit', { correct: false, partial: 0, ms: 1500 });  // queues newer state
        prImport(dump);                          // restore the snapshot
        // Wait past the debounce interval rather than calling a flush helper, so
        // this exercises the timer that actually caused the bug.
        await new Promise((r) => setTimeout(r, 900));
        const onDisk = JSON.parse(localStorage.getItem('nq.progress.v1.l1') || '{}');
        const rec = (onDisk.nodes || {})['frac.unit'] || {};
        return { n: rec.n, c: rec.c };
    });
    check('a restore is not overwritten by the queued pre-restore blob',
        restoreSticks.n === 1 && restoreSticks.c === 1, JSON.stringify(restoreSticks));

    const badImport = await page.evaluate(() => {
        try { prImport('{"not":"a backup"}'); return 'accepted'; }
        catch (e) { return 'rejected'; }
    });
    check('a file that is not a backup is rejected', badImport === 'rejected', badImport);

    // ---- storage helper -------------------------------------------------
    const stOk = await page.evaluate(() => {
        stSetJSON('smoke.test', { a: 1 });
        const back = stJSON('smoke.test');
        const namespaced = localStorage.getItem('nq.smoke.test') !== null;
        stRemove('smoke.test');
        return back && back.a === 1 && namespaced && stJSON('smoke.test') === null;
    });
    check('storage helper round-trips and namespaces', stOk);

    // ---- a mixed review run -----------------------------------------------
    // Several nodes at once, of different item types, interleaved. This is the
    // path the Review button takes and nothing else in the suite covers it.
    const mixed = await page.evaluate(async () => {
        const ids = ['frac.numberline', 'add.facts.within20', 'gram.comma',
            'count.subitize.grouped', 'morph.prefix.common'];
        await new Promise((resolve) => {
            irStart({ nodeIds: ids, count: 15, mode: 'review', onDone: resolve });
            // Answer everything correctly, as fast as the runner allows.
            const tick = setInterval(() => {
                const S = window.__IR;
                const active = (document.querySelector('.screen.active') || {}).id;
                if (active === 'ir-results-screen') { clearInterval(tick); resolve(); return; }
                const item = S.items[S.idx];
                if (!item || S.locked) return;
                const host = document.getElementById('ir-response-host');
                if (item.type === 'mc') {
                    const btn = host.querySelectorAll('.ir-choice')[Number(item.answer)];
                    if (btn) btn.click();
                } else if (item.type === 'multi') {
                    item.answer.forEach((i) => host.querySelectorAll('.ir-choice')[i].click());
                    document.getElementById('ir-submit').click();
                } else if (item.type === 'fraction') {
                    host.querySelector('.ir-frac-num').value = item.answer.num;
                    host.querySelector('.ir-frac-den').value = item.answer.den;
                    document.getElementById('ir-submit').click();
                } else {
                    const input = host.querySelector('.ir-input');
                    if (input) { input.value = String(item.answer); document.getElementById('ir-submit').click(); }
                    else if (item.type === 'numberline') {
                        // Drive the value directly; pointer geometry is covered elsewhere.
                        host.__nlValue = () => item.answer;
                        document.getElementById('ir-submit').click();
                    }
                }
            }, 120);
            setTimeout(() => { clearInterval(tick); resolve(); }, 25000);
        });
        const S = window.__IR;
        return {
            screen: (document.querySelector('.screen.active') || {}).id,
            items: S.items.length,
            distinctNodes: new Set(S.items.map((i) => i.node)).size,
            types: [...new Set(S.items.map((i) => i.type))].sort(),
            answered: S.results.length,
            correct: S.results.filter((r) => r.correct).length,
        };
    });
    check('mixed review draws from every node asked for',
        mixed.distinctNodes === 5, JSON.stringify(mixed));
    check('mixed review interleaves several item types',
        mixed.types.length >= 3, JSON.stringify(mixed));
    check('a full mixed run completes on the results screen',
        mixed.screen === 'ir-results-screen', JSON.stringify(mixed));
    check('every answer in the mixed run graded correct',
        mixed.answered > 0 && mixed.correct === mixed.answered, JSON.stringify(mixed));

    // ---- runner layout ----------------------------------------------------
    // Both of these were silent: the questions still worked, they were just in
    // the wrong place and half the size.
    await page.evaluate(() => irStart({ nodeIds: ['frac.numberline'], count: 1, mode: 'practice', seed: 7 }));
    await page.waitForFunction(() => !!document.querySelector('.ir-numberline svg'), { timeout: 8000 })
        .catch(() => {});
    await page.waitForTimeout(300);

    const layout = await page.evaluate(() => {
        const w = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
        const stage = document.querySelector('.ir-stage').getBoundingClientRect();
        return {
            stage: Math.round(stage.width),
            svg: w('.ir-numberline svg'),
            stageTop: Math.round(stage.top),
        };
    });
    check('stage stretches to its max width rather than shrink-wrapping',
        layout.stage >= 700, JSON.stringify(layout));
    check('number line gets its full drawing width', layout.svg >= 440, JSON.stringify(layout));
    // The progress bar absorbing the grid's free row is what pushed the question
    // down; the bar element itself stayed 4px, so the position is what to assert.
    check('content starts near the top, not pushed down the page',
        layout.stageTop < 200, JSON.stringify(layout));

    // ---- phone viewport ---------------------------------------------------
    // Two stacked nav rows and 21 activities is exactly the shape that overflows
    // a narrow screen, so this is checked rather than assumed.
    await page.setViewportSize({ width: 375, height: 700 });
    await page.waitForTimeout(250);

    const screensToCheck = [
        ['#/', 'Learn home'],
        ['#/frac', 'a ladder'],
        ['#/frac/frac.numberline', 'a node'],
    ];
    for (const [hash, label] of screensToCheck) {
        await page.evaluate((h) => { location.hash = h; }, hash);
        await page.waitForTimeout(200);
        const overflow = await page.evaluate(() => ({
            doc: document.documentElement.scrollWidth,
            win: window.innerWidth,
        }));
        check(`375px: ${label} does not scroll sideways`,
            overflow.doc <= overflow.win + 1, JSON.stringify(overflow));
    }

    // Both nav rows must wrap rather than push the page wide.
    await page.evaluate(() => lbApplySection('maths'));
    await page.waitForTimeout(150);
    const navFit = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
        sectionH: document.getElementById('section-bar').getBoundingClientRect().height,
    }));
    check('375px: both nav rows wrap without widening the page',
        navFit.doc <= navFit.win + 1 && navFit.sectionH > 0, JSON.stringify(navFit));

    await page.setViewportSize({ width: 1280, height: 900 });

    // ---- the shared recogniser ------------------------------------------
    // Headless Chromium defines SpeechRecognition but has no speech service
    // behind it, so nothing here can test *hearing*. What it can test is the
    // claim bookkeeping — one microphone, handed between callers — which is the
    // whole reason the recogniser moved out of app.js, and the part that used to
    // be untestable because there was no seam.
    const claims = await page.evaluate(() => {
        const log = [];
        const noop = () => {};
        const a = spListen({ onText: noop, onEnd: (why) => log.push('a:' + why) });
        const activeAfterA = spActive() === a;

        const b = spListen({ onText: noop, onEnd: (why) => log.push('b:' + why) });
        const activeAfterB = spActive() === b;

        spRelease(a);                       // stale token — must not disturb b
        const afterStale = { active: spActive() === b, log: log.slice() };

        spRelease(b);
        const idleAfterRelease = spActive() === null;

        return { activeAfterA, activeAfterB, afterStale, idleAfterRelease, log };
    });
    check('a claim makes its holder the active listener',
        claims.activeAfterA && claims.activeAfterB, JSON.stringify(claims));
    check('a second claim supersedes the first and says so',
        claims.log[0] === 'a:superseded', JSON.stringify(claims.log));
    check('releasing a stale token does not steal the microphone',
        claims.afterStale.active && claims.afterStale.log.length === 1,
        JSON.stringify(claims.afterStale));
    check('releasing the live claim frees the microphone',
        claims.idleAfterRelease && claims.log.includes('b:released'),
        JSON.stringify(claims.log));

    // The flash-card quiz must give the microphone back when the quiz ends,
    // otherwise the runner can never get it on the same page load.
    const quizMic = await page.evaluate(async () => {
        TAB_ENTRY.flashcards();
        state.operations = ['+']; state.maxNumber = 5; state.shuffle = false;
        startQuiz();
        const during = spActive() !== null && state.spToken !== null;
        endQuiz();
        return { during, after: spActive(), token: state.spToken };
    });
    check('flash cards hold the microphone for the length of a quiz',
        quizMic.during, JSON.stringify(quizMic));
    check('flash cards release the microphone when the quiz ends',
        quizMic.after === null && quizMic.token === null, JSON.stringify(quizMic));

    // ---- the self-advance timer ------------------------------------------
    // A correct answer advances itself after 700ms. Pressing Next yourself
    // before then used to leave that timer running, so answering the NEXT item
    // inside the same 700ms fired it against that one and skipped a question —
    // silently, and more often the quicker you are.
    await page.evaluate(() => irStart({
        nodeIds: ['add.facts.within20'], count: 6, mode: 'practice', seed: 5,
    }));
    await page.waitForFunction(() => document.querySelector('#ir-response-host .ir-input'),
        { timeout: 10000 }).catch(() => {});

    // Answer item 0 right, hurry past it, then get item 1 WRONG. A wrong answer
    // deliberately waits — the correct answer sitting next to your own is most
    // of the value — so if the stale timer from item 0 is still armed it fires
    // here and whips the explanation away after a fraction of a second.
    const answerItem = (offset) => page.evaluate((off) => {
        const S = window.__IR;
        document.querySelector('#ir-response-host .ir-input').value =
            String(Number(S.items[S.idx].answer) + off);
        document.getElementById('ir-submit').click();
    }, offset);

    await page.waitForTimeout(450);
    await answerItem(0);                                 // item 0 — correct, arms the timer
    await page.waitForTimeout(120);
    await page.evaluate(() => document.getElementById('ir-next').click());   // hurry on
    await page.waitForTimeout(420);
    const beforeRace = await page.evaluate(() => window.__IR.idx);
    await answerItem(1);                                 // item 1 — wrong, must sit still
    await page.waitForTimeout(150);
    const gradedWrong = await page.evaluate(() => /ir-fb-wrong/.test(
        document.getElementById('ir-feedback').className));
    await page.waitForTimeout(800);                      // past when the stale timer would fire
    const afterRace = await page.evaluate(() => ({
        idx: window.__IR.idx,
        fb: document.getElementById('ir-feedback').className,
    }));
    check('hurrying past a correct answer does not cut short the next explanation',
        gradedWrong && afterRace.idx === beforeRace && /ir-fb-wrong/.test(afterRace.fb),
        JSON.stringify({ beforeRace, gradedWrong, afterRace }));

    // ---- read aloud ------------------------------------------------------
    // Headless Chromium has SpeechRecognition but no speech service behind it,
    // so it hears nothing — which is exactly the path worth testing, because
    // "the microphone heard nothing" is the outcome the whole design turns on.
    // A silence must record nothing, lengthen the run to make up for the
    // question it failed to ask, and eventually give up on the microphone.
    // The flash-card results screen is showing, and hash routing deliberately
    // only drives navigation from inside Learn — so enter Learn the way a
    // learner would, then let it route.
    await page.evaluate(() => { location.hash = '#/phon/phon.cvc'; TAB_ENTRY.learn(); });
    await page.waitForSelector('[data-act="read"]', { timeout: 5000 }).catch(() => {});
    check('a decoding node offers to be read aloud',
        await page.evaluate(() => !!document.querySelector('[data-act="read"]')),
        await page.evaluate(() => JSON.stringify({
            screen: (document.querySelector('.screen.active') || {}).id,
            hash: location.hash,
            sp: typeof spSupported === 'function' && spSupported(),
        })));
    check('and says where the audio goes',
        await page.evaluate(() => /speech recognition/i.test(
            (document.querySelector('.lb-mic-note') || {}).textContent || '')));

    // Driven with a fixed seed rather than by clicking the button, because the
    // assertions below depend on how many read-aloud items the run contains and
    // an unseeded draw makes that a coin toss — a test that sometimes checks
    // three things and sometimes one is not checking anything reliably.
    await page.evaluate(() => irStart({
        nodeIds: ['phon.cvc'], count: 10, mode: 'assess', mic: true, seed: 20260729,
    }));
    await page.waitForFunction(() => window.__IR.items.length > 0, { timeout: 10000 }).catch(() => {});

    const micRun = await page.evaluate(() => ({
        speech: window.__IR.items.filter((i) => i.type === 'speech').length,
        reserve: window.__IR.reserve.length,
        mic: window.__IR.mic,
    }));
    check('a read-aloud run actually contains read-aloud items',
        micRun.speech > 0 && micRun.mic, JSON.stringify(micRun));
    check('and carries spare tap items for the ones it cannot hear',
        micRun.reserve > 0, JSON.stringify(micRun));
    check('the run holds the microphone', await page.evaluate(() => spActive() !== null));

    // What happens when something IS heard — the two outcomes a silence cannot
    // reach. There is no speech service here, so deliver the transcript through
    // the same callback a real result arrives on.
    const toSpeechItem = async () => {
        for (let i = 0; i < 12; i++) {
            const t = await page.evaluate(() =>
                (window.__IR.items[window.__IR.idx] || {}).type);
            if (t === 'speech') return true;
            await page.evaluate(() => { window.__IR.idx++; });
            await page.evaluate(() => { window.__IR.idx--; });
            await page.evaluate(() => { const S = window.__IR; S.locked = true; });
            await page.evaluate(() => { document.getElementById('ir-next').click(); });
            await page.waitForTimeout(120);
        }
        return false;
    };

    check('found a read-aloud item to drive', await toSpeechItem());

    const misread = await page.evaluate(() => {
        const before = JSON.stringify(prGet('phon.cvc'));
        window.__SP.feed('elephant');
        return { before: before, fb: document.getElementById('ir-feedback').textContent,
                 status: document.querySelector('.ir-speech-msg').textContent };
    });
    check('a different word does not end the item — it may yet be corrected',
        misread.fb === '' && /elephant/.test(misread.status), JSON.stringify(misread));

    await page.click('#ir-response-host [data-act="skip"]');
    await page.waitForTimeout(250);
    const misreadOut = await page.evaluate(() => ({
        fb: document.getElementById('ir-feedback').className,
        detail: document.getElementById('ir-feedback').textContent,
        stats: JSON.stringify(prGet('phon.cvc')),
    }));
    check('but a clear misread is scored, unlike a silence',
        /ir-fb-wrong/.test(misreadOut.fb) && misreadOut.stats !== misread.before,
        JSON.stringify(misreadOut));
    check('and it says what it heard',
        /elephant/.test(misreadOut.detail), misreadOut.detail);

    await page.evaluate(() => { document.getElementById('ir-next').click(); });
    await page.waitForTimeout(150);
    check('found a second read-aloud item', await toSpeechItem());

    const heardRight = await page.evaluate(() => {
        const want = String(window.__IR.items[window.__IR.idx].answer);
        const before = JSON.stringify(prGet('phon.cvc'));
        window.__SP.feed(want);
        return { want: want, before: before };
    });
    await page.waitForTimeout(250);
    const readOutcome = await page.evaluate(() => ({
        fb: document.getElementById('ir-feedback').className,
        stats: JSON.stringify(prGet('phon.cvc')),
    }));
    check('reading the word correctly is heard and marked right',
        /ir-fb-correct/.test(readOutcome.fb), JSON.stringify(readOutcome));
    check('and it is recorded, unlike a silence',
        readOutcome.stats !== heardRight.before,
        heardRight.before + ' -> ' + readOutcome.stats);

    // Back to a fresh run for the silence walk, so the record above does not
    // muddle the "records nothing" comparison.
    await page.evaluate(() => irStart({
        nodeIds: ['phon.cvc'], count: 10, mode: 'assess', mic: true, seed: 20260729,
    }));
    await page.waitForFunction(() => window.__IR.items.length > 0, { timeout: 10000 }).catch(() => {});

    // Walk the whole run, answering tap items and pressing "Move on" for every
    // read-aloud one, until the microphone has been given up on.
    let unheardSeen = 0;
    let recordedAcrossSilences = true;
    for (let i = 0; i < 24; i++) {
        const st = await page.evaluate(() => ({
            done: (document.querySelector('.screen.active') || {}).id === 'ir-results-screen',
            type: (window.__IR.items[window.__IR.idx] || {}).type,
            len: window.__IR.items.length,
            stats: JSON.stringify(prGet('phon.cvc')),
        }));
        if (st.done) break;

        if (st.type === 'speech') {
            await page.click('#ir-response-host [data-act="skip"]');
            await page.waitForTimeout(150);
            unheardSeen++;

            const after = await page.evaluate(() => ({
                len: window.__IR.items.length,
                fb: document.getElementById('ir-feedback').textContent,
                stats: JSON.stringify(prGet('phon.cvc')),
            }));
            check(`silence ${unheardSeen}: the run grows to keep asking as many questions`,
                after.len === st.len + 1, JSON.stringify({ was: st.len, now: after.len }));
            check(`silence ${unheardSeen}: says so rather than marking it wrong`,
                /didn't hear/i.test(after.fb), after.fb);
            if (after.stats !== st.stats) recordedAcrossSilences = false;
        } else {
            // Answer it correctly, pausing past the anti-mash floor.
            await page.evaluate(() => {
                const S = window.__IR;
                const item = S.items[S.idx];
                const input = document.querySelector('#ir-response-host .ir-input');
                if (input) { input.value = String(item.answer); return; }
                const choice = document.querySelector(
                    `#ir-response-host .ir-choice[data-choice="${item.answer}"]`);
                if (choice) choice.classList.add('selected');
            });
            await page.waitForTimeout(450);
            await page.click('#ir-submit').catch(() => {});
            await page.waitForTimeout(200);
        }

        const nextBtn = await page.$('#ir-next:not(.hidden)');
        if (nextBtn) await nextBtn.click().catch(() => {});
        await page.waitForTimeout(150);
        if (unheardSeen >= 3) break;
    }

    const afterMic = await page.evaluate(() => ({
        mic: window.__IR.mic,
        speechLeft: window.__IR.items.slice(window.__IR.idx).filter((i) => i.type === 'speech').length,
    }));
    check('the run reached three silences', unheardSeen === 3, 'saw ' + unheardSeen);
    check('a silence records nothing at all against the node', recordedAcrossSilences);
    check('three silences and it stops asking for the microphone',
        !afterMic.mic && afterMic.speechLeft === 0,
        JSON.stringify(Object.assign({ unheardSeen: unheardSeen }, afterMic)));

    await page.evaluate(() => { const b = document.getElementById('ir-quit'); if (b) b.click(); });
    await page.waitForTimeout(200);
    check('leaving the runner gives the microphone back',
        await page.evaluate(() => spActive() === null));

    // ---- making the sound ------------------------------------------------
    // This container has no /dev/snd at all, so getUserMedia fails outright —
    // which is the one thing worth testing here and cannot be tested anywhere a
    // microphone exists. A child on a device with no working microphone must
    // get a sentence, not a dead screen and a run that will not advance.
    const dspInBrowser = await page.evaluate(() => {
        // Synthesise /ah/ at a child's pitch and run it through the same code
        // that would see a microphone frame. audio.js uses Float64Array and a
        // hand-rolled FFT, so "it worked in Node" is not the same claim.
        const SR = 48000, n = 24000, out = new Float32Array(n);
        const period = SR / 300; let next = 0, seed = 12345;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        for (let i = 0; i < n; i++) if (i >= next) { out[i] = 1; next += period * (1 + 0.02 * (rnd() - 0.5)); }
        let prev = 0;
        for (let i = 0; i < n; i++) { prev = out[i] + 0.97 * prev; out[i] = prev * 0.02; }
        [[1058, 60], [1580, 90], [4200, 120], [5200, 150]].forEach(([F, bw]) => {
            const r = Math.exp(-Math.PI * bw / SR), th = 2 * Math.PI * F / SR;
            const a1 = 2 * r * Math.cos(th), a2 = -r * r, g = (1 - 2 * r * Math.cos(th) + r * r);
            let y1 = 0, y2 = 0;
            for (let i = 0; i < n; i++) { const y = g * out[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = y; out[i] = y; }
        });
        let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
        for (let i = 0; i < n; i++) out[i] /= pk * 1.2;
        const a = auAnalyse(out.subarray(11000, 13048), SR);
        return { f0: Math.round(a.f0), f1: Math.round(a.f1), f2: Math.round(a.f2), voiced: a.voiced };
    });
    check('the vowel analysis gives the same answers in a browser as in node',
        Math.abs(dspInBrowser.f0 - 300) < 12 && Math.abs(dspInBrowser.f1 - 1058) < 120
            && Math.abs(dspInBrowser.f2 - 1580) < 200 && dspInBrowser.voiced,
        JSON.stringify(dspInBrowser));

    const micGone = await page.evaluate(async () => {
        let err = null;
        try { await auStart(); } catch (e) { err = e.name; }
        return { err: err, running: auRunning(), frame: auFrame() };
    });
    check('with no microphone at all, opening it fails cleanly rather than throwing',
        micGone.err === 'NotFoundError' && !micGone.running && micGone.frame === null,
        JSON.stringify(micGone));

    await page.evaluate(() => { location.hash = '#/phon/phon.shortVowels'; TAB_ENTRY.learn(); });
    await page.waitForTimeout(300);
    check('a vowel-sound node offers to be spoken into',
        await page.evaluate(() => !!document.querySelector('[data-act="make"]')));
    check('and says the audio stays on the device',
        await page.evaluate(() => /never leaves this device/i.test(
            (document.querySelector('.lb-mic-note') || {}).textContent || '')));

    await page.evaluate(() => irStart({
        nodeIds: ['phon.shortVowels'], count: 6, mode: 'assess', sound: true, seed: 3,
    }));
    await page.waitForFunction(() => window.__IR.items.length > 0, { timeout: 10000 }).catch(() => {});
    const soundRun = await page.evaluate(() => ({
        sound: window.__IR.items.filter((i) => i.type === 'sound').length,
        reserve: window.__IR.reserve.length,
    }));
    check('a sound run contains sound items and spare tap ones',
        soundRun.sound > 0 && soundRun.reserve > 0, JSON.stringify(soundRun));

    await page.waitForFunction(() => document.querySelector('.ir-sound'), { timeout: 5000 })
        .catch(() => {});
    await page.waitForTimeout(400);
    const soundUi = await page.evaluate(() => ({
        canvas: !!document.querySelector('.ir-sound-space'),
        msg: (document.querySelector('.ir-sound .ir-speech-msg') || {}).textContent || '',
    }));
    check('the sound mirror explains itself instead of hanging when the microphone fails',
        soundUi.canvas && /did not open/i.test(soundUi.msg), JSON.stringify(soundUi));

    const beforeSound = await page.evaluate(() => JSON.stringify(prGet('phon.shortVowels')));
    await page.click('.ir-sound [data-act="skip"]');
    await page.waitForTimeout(250);
    check('and a run with no microphone records nothing against the node',
        await page.evaluate((b) => JSON.stringify(prGet('phon.shortVowels')) === b, beforeSound));

    await page.evaluate(() => { const b = document.getElementById('ir-quit'); if (b) b.click(); });
    await page.waitForTimeout(150);

    // ---- saying a number -------------------------------------------------
    // A different contract from reading aloud, and the difference is the point:
    // the keyboard is right there, so a misheard number must cost nothing. The
    // microphone may only ever produce a correct answer here.
    await page.evaluate(() => { location.hash = '#/add/add.facts.within20'; TAB_ENTRY.learn(); });
    await page.waitForTimeout(300);
    const sayBtn = await page.evaluate(() => {
        const b = document.querySelector('[data-act="read"]');
        return b ? b.textContent : null;
    });
    check('a typed-number node offers to be answered out loud',
        sayBtn === 'Say the answers', String(sayBtn));

    await page.evaluate(() => irStart({
        nodeIds: ['add.facts.within20'], count: 4, mode: 'practice', mic: true, seed: 11,
    }));
    await page.waitForFunction(() => document.querySelector('#ir-response-host .ir-input'),
        { timeout: 10000 }).catch(() => {});
    check('the number pad still listens alongside the keyboard',
        await page.evaluate(() => !!document.querySelector('.ir-numeric-mic') && spActive() !== null));

    // Deliver a wrong number, then the right one, through the same callback a
    // real recogniser result arrives on.
    const beforeSpoken = await page.evaluate(() => ({
        want: Number(window.__IR.items[window.__IR.idx].answer),
        idx: window.__IR.idx,
    }));
    const afterWrong = await page.evaluate((want) => {
        window.__SP.feed(String(want === 3 ? 4 : 3));
        return {
            idx: window.__IR.idx,
            locked: window.__IR.locked,
            input: document.querySelector('#ir-response-host .ir-input').value,
        };
    }, beforeSpoken.want);
    check('a misheard number does nothing at all — no mark, no text, no advance',
        afterWrong.idx === beforeSpoken.idx && !afterWrong.locked && afterWrong.input === '',
        JSON.stringify({ beforeSpoken, afterWrong }));

    await page.evaluate((want) => { window.__SP.feed(String(want)); }, beforeSpoken.want);
    await page.waitForTimeout(250);
    const afterRight = await page.evaluate(() => ({
        input: (document.querySelector('#ir-response-host .ir-input') || {}).value,
        fb: document.getElementById('ir-feedback').className,
    }));
    check('the right number spoken is taken as the answer',
        /ir-fb-correct/.test(afterRight.fb), JSON.stringify(afterRight));

    await page.evaluate(() => { const b = document.getElementById('ir-quit'); if (b) b.click(); });
    await page.waitForTimeout(200);
    check('the number pad gives the microphone back too',
        await page.evaluate(() => spActive() === null));

    await page.evaluate(() => { location.hash = '#/'; });
    await page.evaluate(() => showScreen('home'));

    // ---- console --------------------------------------------------------
    // The three CDN libraries are unreachable in a sandbox with no outbound
    // network. That takes THREE/CANNON/jsPDF down with it, which is a property of
    // the environment and not of this code — the same errors appear on an
    // unmodified checkout. Report the condition, don't fail on it.
    const cdnBlocked = requested.some((u) => u.includes('cdnjs.cloudflare.com'))
        && await page.evaluate(() => typeof THREE === 'undefined');
    if (cdnBlocked) console.log('  note  CDN unreachable here — THREE/CANNON/jsPDF errors expected and ignored');

    const ignorable = /favicon|ERR_CONNECTION|ERR_NAME|ERR_INTERNET|cdnjs\.cloudflare\.com/i;
    const cdnGlobals = /\b(THREE|CANNON|jspdf|jsPDF)\b.*(not defined|undefined)/i;
    const realErrors = consoleErrors.filter((e) =>
        !ignorable.test(e) && !(cdnBlocked && cdnGlobals.test(e)));
    check('no console errors', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

    await browser.close();

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
    if (failed.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
