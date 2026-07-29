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
    check('all 18 tabs present', tabs.length === 18, 'got ' + tabs.length + ': ' + tabs.join(','));
    check('no duplicate tab buttons', new Set(tabs).size === tabs.length);
    check('lazy tabs in place', LAZY_TABS.every((t) => tabs.includes(t)));

    // ---- section bar groups the tabs -----------------------------------
    const sections = await page.$$eval('.section-btn', (els) => els.map((e) => e.dataset.section));
    check('section bar has four sections',
        JSON.stringify(sections) === JSON.stringify(['learn', 'maths', 'english', 'tools']),
        JSON.stringify(sections));
    check('app opens on Learn',
        await page.evaluate(() => (document.querySelector('.screen.active') || {}).id === 'lb-strands-screen'));
    check('Learn hides the activity row entirely',
        await page.evaluate(() => document.getElementById('tab-bar').classList.contains('hidden')));

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
    check('every tab belongs to a section', covered === 18, JSON.stringify(coverage));

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
    check('lazy load did not duplicate the tab', gpState.gpTabs === 1 && gpState.tabCount === 18,
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
    check('language-arts did not duplicate tabs', laState.tabCount === 18, JSON.stringify(laState));

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
    // Two stacked nav rows and 19 activities is exactly the shape that overflows
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
