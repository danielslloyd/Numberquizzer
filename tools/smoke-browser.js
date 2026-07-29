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
    'ten-frame', 'times-grid', 'fractions', 'money', 'visualizer', 'sudoku'];
const LAZY_TABS = ['la-vocab', 'la-cap', 'la-punct', 'la-subj', 'la-diag', 'geo-proofs'];

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
    check('all 17 tabs present', tabs.length === 17, 'got ' + tabs.length + ': ' + tabs.join(','));
    check('no duplicate tab buttons', new Set(tabs).size === tabs.length);
    check('lazy tabs in place', LAZY_TABS.every((t) => tabs.includes(t)));

    // ---- every eager tab opens and highlights --------------------------
    for (const tab of EAGER_TABS) {
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
    check('lazy load did not duplicate the tab', gpState.gpTabs === 1 && gpState.tabCount === 17,
        JSON.stringify(gpState));

    await page.click('#tab-bar .tab-btn[data-tab="la-vocab"]');
    await page.waitForTimeout(800);
    const laState = await page.evaluate(() => ({
        screen: (document.querySelector('.screen.active') || {}).id,
        tabCount: document.querySelectorAll('#tab-bar .tab-btn').length,
    }));
    check('language-arts lazy load works', laState.screen === 'la-vocab-screen', JSON.stringify(laState));
    check('language-arts did not duplicate tabs', laState.tabCount === 17, JSON.stringify(laState));

    // ---- storage helper -------------------------------------------------
    const stOk = await page.evaluate(() => {
        stSetJSON('smoke.test', { a: 1 });
        const back = stJSON('smoke.test');
        const namespaced = localStorage.getItem('nq.smoke.test') !== null;
        stRemove('smoke.test');
        return back && back.a === 1 && namespaced && stJSON('smoke.test') === null;
    });
    check('storage helper round-trips and namespaces', stOk);

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
