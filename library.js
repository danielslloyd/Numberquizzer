/*
 * The Learn browser.  Prefix: lb
 *
 * Three screens: subjects and their strands, one strand's ladder, and a node.
 *
 * There are no grade levels anywhere in here, and that is the point. A learner
 * who is years ahead in fractions and behind in decoding has two positions, not
 * one, and bucketing by grade would force a single wrong answer to "where are
 * you". Position is per-strand: a strand plus a rung.
 *
 * Nothing is gated. Every rung is openable from a cold profile, including the
 * top one. The ladder shows what has been done and suggests what is next; it
 * never locks anything, because a learner who is ready for rung 9 should not
 * have to grind rungs 1 through 8 to prove it.
 *
 * Routing is by hash — #/frac, #/frac/frac.numberline — so back and forward
 * work and a rung can be linked to directly. No other mode needs to know.
 */
(function () {
    'use strict';

    const SCREENS = ['lb-strands', 'lb-ladder', 'lb-node'];
    let currentStrand = null;

    function $(id) { return document.getElementById(id); }
    const esc = (s) => window.idrEscape(s);

    // ---- level presentation ---------------------------------------------
    const LEVEL_LABEL = ['Not started', 'Tried', 'Practising', 'Proficient', 'Mastered'];

    function levelDot(lvl, built) {
        if (!built) return '<span class="lb-dot lb-dot-unbuilt" title="Not built yet"></span>';
        return `<span class="lb-dot lb-dot-${lvl}" title="${LEVEL_LABEL[lvl]}"></span>`;
    }

    // ---- screens ---------------------------------------------------------
    function lbRenderStrands() {
        const groups = { math: [], english: [] };
        CUR.strands().forEach((s) => { (groups[s.subject] || groups.math).push(s); });

        const due = prDue().filter((id) => CUR.isBuilt(id));
        const next = prNextUp(4);

        let html = '';

        if (due.length) {
            html += `<div class="lb-banner"><strong>${due.length}</strong> ready for review`
                + ` <button class="btn btn-primary lb-small" data-review="1">Review now</button></div>`;
        }

        if (next.length) {
            html += '<div class="lb-next"><div class="lb-next-title">Maybe next</div><div class="lb-next-row">'
                + next.map((n) => {
                    const node = CUR.get(n.id);
                    // Name the strand: "Hundreds, tens and ones" does not tell a
                    // parent it is place value, and the chips come from all over.
                    const where = node.strandLabel || node.strand;
                    return `<button class="lb-chip" data-node="${esc(n.id)}" title="${esc(where)}">`
                        + `${esc(node.label)}<span class="lb-chip-where">${esc(where)}</span>`
                        + (n.why === 'review' ? '<span class="lb-chip-due" title="Due for review">&#9679;</span>' : '')
                        + '</button>';
                }).join('') + '</div></div>';
        }

        [['math', 'Maths'], ['english', 'English']].forEach(([key, label]) => {
            if (!groups[key].length) return;
            html += `<h2 class="lb-subject">${label}</h2><div class="lb-grid">`;
            html += groups[key].map((s) => {
                const p = prStrandProgress(s.strand);
                const pct = p.built ? Math.round((p.proficient / p.built) * 100) : 0;
                // Say both numbers. "0 of 3 ready" alone reads as though the
                // strand only contains three things, when it may hold fifteen
                // with the rest still on the backlog.
                const more = s.count - p.built;
                const sub = p.built
                    ? `${p.proficient} of ${p.built} ready`
                        + (more > 0 ? ` &middot; ${more} more to come` : '')
                    : `${s.count} steps &middot; not built yet`;
                return `<button class="lb-card${p.built ? '' : ' lb-card-empty'}" data-strand="${esc(s.strand)}">`
                    + `<span class="lb-card-title">${esc(s.label)}</span>`
                    + `<span class="lb-card-sub">${sub}</span>`
                    + `<span class="lb-bar"><span class="lb-bar-fill" style="width:${pct}%"></span></span>`
                    + '</button>';
            }).join('');
            html += '</div>';
        });

        $('lb-strands-body').innerHTML = html;
    }

    function lbRenderLadder(strand) {
        currentStrand = strand;
        const rungs = CUR.ladder(strand);
        if (!rungs.length) return lbGo('');

        $('lb-ladder-title').textContent = rungs[0].strandLabel || strand;

        const built = rungs.filter((n) => CUR.isBuilt(n.id));
        $('lb-ladder-sub').textContent = built.length
            ? `${built.filter((n) => prLevel(n.id) >= 3).length} of ${built.length} ready`
            : 'Nothing built here yet';

        $('lb-ladder-body').innerHTML = rungs.map((n) => {
            const isBuilt = CUR.isBuilt(n.id);
            const lvl = prLevel(n.id);
            const rec = prGet(n.id);
            const isDue = isBuilt && rec.n > 0 && rec.due && rec.due <= Date.now() && lvl < 4;
            return `<button class="lb-rung${isBuilt ? '' : ' lb-rung-unbuilt'}" data-node="${esc(n.id)}">`
                + `<span class="lb-rung-n">${n.rung}</span>`
                + levelDot(lvl, isBuilt)
                + `<span class="lb-rung-label">${esc(n.label)}</span>`
                + (isDue ? '<span class="lb-due" title="Due for review">&#9679;</span>' : '')
                + (n.automaticity ? '<span class="lb-speed" title="Timed">&#9201;</span>' : '')
                + (isBuilt ? '' : '<span class="lb-soon">not built yet</span>')
                + '</button>';
        }).join('');
    }

    function lbRenderNode(nodeId) {
        const n = CUR.get(nodeId);
        if (!n) return lbGo('');
        currentStrand = n.strand;

        const isBuilt = CUR.isBuilt(nodeId);
        const rec = prGet(nodeId);
        const lvl = rec.lvl;
        const blocked = prBlockedBy(nodeId);

        $('lb-node-title').textContent = n.label;
        $('lb-node-strand').textContent = (n.strandLabel || n.strand) + ' · step ' + n.rung;

        let html = '';

        html += `<div class="lb-node-status">${levelDot(lvl, isBuilt)}<span>${isBuilt ? LEVEL_LABEL[lvl] : 'Not built yet'}</span>`;
        if (rec.n) html += `<span class="lb-node-tally">${rec.c} right out of ${rec.n}</span>`;
        html += '</div>';

        if (blocked && blocked.reason === 'speed') {
            html += `<p class="lb-note">Accurate — now for speed. Typical answer ${(blocked.p50 / 1000).toFixed(1)}s, aiming for ${(blocked.target / 1000).toFixed(1)}s.</p>`;
        } else if (blocked && blocked.reason === 'comeBack') {
            html += '<p class="lb-note">Going well. Come back on another day and it will count as proficient.</p>';
        }

        if (n.prereq && n.prereq.length) {
            html += '<div class="lb-prereq"><span class="lb-prereq-label">Builds on</span>'
                + n.prereq.map((p) => {
                    const pn = CUR.get(p);
                    if (!pn) return '';
                    return `<button class="lb-chip" data-node="${esc(p)}">${levelDot(prLevel(p), CUR.isBuilt(p))}${esc(pn.label)}</button>`;
                }).join('') + '</div>';
        }

        const gated = CUR.gates(nodeId);
        if (gated.length) {
            html += '<div class="lb-prereq"><span class="lb-prereq-label">Leads to</span>'
                + gated.map((g) => {
                    const gn = CUR.get(g);
                    return gn ? `<button class="lb-chip" data-node="${esc(g)}">${esc(gn.label)}</button>` : '';
                }).join('') + '</div>';
        }

        // Naming the usual wrong answer is worth showing: it tells a parent what
        // to listen for, and it is why several of these nodes exist at all.
        if (n.misconceptions && n.misconceptions.length) {
            html += '<div class="lb-misc"><span class="lb-prereq-label">Easy to get wrong</span><ul>'
                + n.misconceptions.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul></div>';
        }

        const practice = (n.practice || []).filter((t) => typeof TAB_ENTRY !== 'undefined' && TAB_ENTRY[t]);
        // Two quite different uses of the microphone. Reading a word aloud is the
        // assessment itself; saying a number is a shortcut past the keyboard, and
        // exactly what the flash cards have always done.
        const hasMic = typeof spSupported === 'function' && spSupported();
        const hasAudio = typeof auAvailable === 'function' && auAvailable();
        const canMake = isBuilt && hasAudio && (n.types || []).indexOf('sound') >= 0;
        const canRead = isBuilt && hasMic && (n.types || []).indexOf('speech') >= 0;
        const canSay = isBuilt && hasMic && !canRead && !canMake
            && (n.types || []).indexOf('numeric') >= 0;
        const anyMic = canMake || canRead || canSay;

        html += '<div class="lb-actions">';
        if (isBuilt) {
            // The microphone leads wherever it is the better question. Picking a
            // word out of four can be done by elimination without decoding
            // anything, and no written item about a vowel sound is the vowel
            // sound — saying it is the skill itself.
            if (canMake) html += '<button class="btn btn-primary" data-act="make">Make the sounds</button>';
            else if (canRead) html += '<button class="btn btn-primary" data-act="read">Read aloud</button>';
            else if (canSay) html += '<button class="btn btn-primary" data-act="read">Say the answers</button>';
            html += `<button class="btn btn-${anyMic ? 'secondary' : 'primary'}" data-act="check">Check</button>`;
        } else {
            html += '<button class="btn btn-primary" disabled>Not built yet</button>';
        }
        practice.forEach((t) => {
            const btn = document.querySelector(`.tab-btn[data-tab="${t}"]`);
            const label = btn ? btn.textContent : t;
            html += `<button class="btn btn-secondary" data-practice="${esc(t)}">Practise in ${esc(label)}</button>`;
        });
        html += '</div>';

        // Said plainly rather than buried: on most browsers speech recognition
        // is a network service, so the audio leaves the device. A parent should
        // be able to know that before handing over a microphone.
        // The difference between the two microphone routes is worth stating,
        // because one of them sends a child's voice to a server and the other
        // genuinely cannot.
        if (canMake) {
            html += '<p class="lb-mic-note">This listens to the shape of the sound rather '
                + 'than trying to recognise a word, so the audio never leaves this device. '
                + 'There is a short warm-up the first time, to learn your voice.</p>';
        } else if (canRead || canSay) {
            html += '<p class="lb-mic-note">'
                + (canSay ? 'Saying an answer only ever counts in your favour — if it is '
                    + 'misheard, nothing happens and you can type instead. It uses your '
                    : 'This uses your ')
                + 'browser\'s speech recognition, which on most browsers sends the audio '
                + 'away to be recognised. Everything else in the app stays on this device.</p>';
        }

        $('lb-node-body').innerHTML = html;
    }

    // ---- progress panel ---------------------------------------------------
    function lbProgressSummary() {
        const all = CUR.all().filter((n) => CUR.isBuilt(n.id));
        const started = all.filter((n) => prLevel(n.id) >= 1).length;
        const proficient = all.filter((n) => prLevel(n.id) >= 3).length;
        const due = prDue().filter((id) => CUR.isBuilt(id)).length;
        return `<span><strong>${proficient}</strong> ready</span>`
            + `<span><strong>${started}</strong> started</span>`
            + `<span><strong>${all.length}</strong> available</span>`
            + `<span><strong>${due}</strong> due</span>`;
    }

    function lbMsg(text, bad) {
        const el = $('lb-progress-msg');
        if (!el) return;
        el.textContent = text;
        el.className = 'lb-panel-msg' + (bad ? ' lb-panel-bad' : '');
    }

    /* With no server this file is the only backup there is, and it doubles as the
     * way to move a learner to another device. */
    function lbExport() {
        prFlush();
        const blob = new Blob([prExport()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const day = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = 'numberquizzer-progress-' + day + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        lbMsg('Backup saved to your downloads.');
    }

    function lbImport(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                prImport(String(reader.result));
                lbMsg('Restored. Reloading the ladders…');
                lbRenderStrands();
                $('lb-progress-summary').innerHTML = lbProgressSummary();
            } catch (e) {
                lbMsg('That file could not be read as a backup.', true);
            }
        };
        reader.onerror = () => lbMsg('That file could not be read.', true);
        reader.readAsText(file);
    }

    // ---- routing ---------------------------------------------------------
    function lbGo(path) { location.hash = '#/' + path; }

    function lbBack() {
        if (currentStrand) lbGo(currentStrand);
        else lbGo('');
    }

    function lbRoute() {
        const raw = (location.hash || '').replace(/^#\/?/, '');
        const parts = raw.split('/').filter(Boolean);

        if (!parts.length) { showScreen('lb-strands'); lbRenderStrands(); return; }
        if (parts.length === 1) { showScreen('lb-ladder'); lbRenderLadder(parts[0]); return; }
        showScreen('lb-node');
        lbRenderNode(parts[1]);
    }

    // ---- markup ----------------------------------------------------------
    const STRANDS_HTML =
        '<div class="lb-container">'
        + '  <div class="lb-head">'
        + '    <h1 class="lb-title">Learn</h1>'
        + '    <button id="lb-progress-btn" class="lb-back" data-panel="progress">Progress &amp; backup</button>'
        + '  </div>'
        + '  <div id="lb-progress-panel" class="lb-panel hidden">'
        + '    <div id="lb-progress-summary" class="lb-summary"></div>'
        + '    <p class="lb-panel-note">Progress is stored in this browser only. There is no account and '
        + '       no server, so clearing site data would lose it — the backup file is the only copy.</p>'
        + '    <div class="lb-actions">'
        + '      <button class="btn btn-primary lb-small" data-prog="export">Save a backup</button>'
        + '      <button class="btn btn-secondary lb-small" data-prog="import">Restore from a backup</button>'
        + '      <button class="btn btn-secondary lb-small" data-prog="reset">Start over</button>'
        + '    </div>'
        + '    <input type="file" id="lb-import-file" accept="application/json,.json" class="hidden">'
        + '    <div id="lb-progress-msg" class="lb-panel-msg"></div>'
        + '  </div>'
        + '  <div id="lb-strands-body"></div>'
        + '</div>';

    const LADDER_HTML =
        '<div class="lb-container">'
        + '  <button class="lb-back" data-back="strands">&larr; All topics</button>'
        + '  <h1 id="lb-ladder-title" class="lb-title"></h1>'
        + '  <p id="lb-ladder-sub" class="lb-sub"></p>'
        + '  <div id="lb-ladder-body" class="lb-ladder"></div>'
        + '</div>';

    const NODE_HTML =
        '<div class="lb-container">'
        + '  <button class="lb-back" data-back="ladder">&larr; Back</button>'
        + '  <h1 id="lb-node-title" class="lb-title"></h1>'
        + '  <p id="lb-node-strand" class="lb-sub"></p>'
        + '  <div id="lb-node-body"></div>'
        + '</div>';

    function injectScreens() {
        const anchor = document.getElementById('sprite-layer');
        [['lb-strands', STRANDS_HTML], ['lb-ladder', LADDER_HTML], ['lb-node', NODE_HTML]]
            .forEach(([name, html]) => {
                if (document.getElementById(name + '-screen')) return;
                const div = document.createElement('div');
                div.id = name + '-screen';
                div.className = 'screen';
                div.innerHTML = html;
                if (anchor) document.body.insertBefore(div, anchor);
                else document.body.appendChild(div);
            });
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        if (!bar || bar.querySelector('.tab-btn[data-tab="learn"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'learn';
        btn.textContent = 'Learn';
        bar.insertBefore(btn, bar.firstChild);   // the point of the app goes first
    }

    /* ====================================================================
     * SECTION BAR
     *
     * Twenty-one activities do not fit on one row, least of all on a phone. A
     * second level above the tab bar groups them, and the tab bar itself is
     * filtered rather than rebuilt — so the contract the two plug-ins rely on
     * (append a .tab-btn to #tab-bar and it works) is completely untouched.
     *
     * Anything not listed falls into Tools, which means a future plug-in that
     * injects a tab still appears somewhere sensible without having to know this
     * file exists.
     * ==================================================================== */
    const SECTIONS = [
        ['learn', 'Learn'],
        ['maths', 'Maths'],
        ['english', 'English'],
        ['tools', 'Tools'],
    ];

    const ACTIVITY_SECTION = {
        learn: 'learn',
        flashcards: 'maths', 'make-ten': 'maths', 'ten-frame': 'maths', 'times-grid': 'maths',
        fractions: 'maths', money: 'maths', visualizer: 'maths', 'place-value': 'maths',
        worksheets: 'maths',
        'geo-proofs': 'maths', polygons: 'maths',
        sorting: 'english', 'la-vocab': 'english', 'la-cap': 'english', 'la-punct': 'english',
        'la-subj': 'english', 'la-diag': 'english',
        ciphers: 'tools', sudoku: 'tools',
    };

    function sectionOf(tab) { return ACTIVITY_SECTION[tab] || 'tools'; }

    let activeSection = 'maths';

    function injectSectionBar() {
        const tabBar = document.getElementById('tab-bar');
        if (!tabBar || document.getElementById('section-bar')) return;
        const nav = document.createElement('nav');
        nav.className = 'section-bar';
        nav.id = 'section-bar';
        nav.innerHTML = SECTIONS.map(([id, label]) =>
            `<button class="section-btn" data-section="${id}">${label}</button>`).join('');
        tabBar.parentNode.insertBefore(nav, tabBar);
    }

    function lbApplySection(name, opts) {
        activeSection = name;
        const tabBar = document.getElementById('tab-bar');
        if (!tabBar) return;

        document.querySelectorAll('.section-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.section === name);
        });

        // Learn has its own screens and no activity tabs, so the row goes away
        // entirely rather than showing a single lonely button.
        tabBar.classList.toggle('hidden', name === 'learn');

        let first = null;
        [...tabBar.querySelectorAll('.tab-btn')].forEach((btn) => {
            const mine = sectionOf(btn.dataset.tab) === name;
            btn.classList.toggle('hidden', !mine);
            if (mine && !first) first = btn;
        });

        if (opts && opts.enter) {
            if (name === 'learn') { if (TAB_ENTRY.learn) TAB_ENTRY.learn(); }
            else if (first && TAB_ENTRY[first.dataset.tab]) TAB_ENTRY[first.dataset.tab]();
        }
    }

    /* Keep the section row in step when something else changes screens — a
     * practice link from a node jumps straight to an activity tab, and the
     * section above it has to follow rather than lying about where you are. */
    function lbSyncSection() {
        const active = document.querySelector('.tab-btn.active');
        if (!active) return;
        const want = sectionOf(active.dataset.tab);
        if (want !== activeSection) lbApplySection(want);
    }

    function wire() {
        const sectionBar = document.getElementById('section-bar');
        if (sectionBar) {
            sectionBar.addEventListener('click', (e) => {
                const btn = e.target.closest('.section-btn');
                if (btn) lbApplySection(btn.dataset.section, { enter: true });
            });
        }

        // The tab bar's own clicks are handled by app.js; this only keeps the
        // section row honest about where the learner ended up.
        const tabBar = document.getElementById('tab-bar');
        if (tabBar) tabBar.addEventListener('click', () => setTimeout(lbSyncSection, 0));

        document.addEventListener('click', (e) => {
            const strandBtn = e.target.closest('[data-strand]');
            if (strandBtn) { lbGo(strandBtn.dataset.strand); return; }

            const nodeBtn = e.target.closest('[data-node]');
            if (nodeBtn) {
                const n = CUR.get(nodeBtn.dataset.node);
                lbGo((n ? n.strand : '') + '/' + nodeBtn.dataset.node);
                return;
            }

            const back = e.target.closest('[data-back]');
            if (back) { back.dataset.back === 'strands' ? lbGo('') : lbBack(); return; }

            const review = e.target.closest('[data-review]');
            if (review) {
                const due = prDue().filter((id) => CUR.isBuilt(id)).slice(0, 4);
                if (due.length) irStart({ nodeIds: due, count: 10, mode: 'review' });
                return;
            }

            const act = e.target.closest('[data-act]');
            if (act && /^(check|read|make)$/.test(act.dataset.act)) {
                const id = (location.hash.split('/')[2] || '').trim();
                // The microphone is asked for here, on a deliberate tap, and
                // never on arriving at the screen. A permission dialog nobody
                // expected gets dismissed once and stays dismissed.
                if (id) irStart({ nodeIds: [id], count: 10, mode: 'assess',
                                  mic: act.dataset.act === 'read',
                                  sound: act.dataset.act === 'make' });
                return;
            }

            const panel = e.target.closest('[data-panel]');
            if (panel) {
                const el = $('lb-progress-panel');
                el.classList.toggle('hidden');
                if (!el.classList.contains('hidden')) {
                    $('lb-progress-summary').innerHTML = lbProgressSummary();
                    lbMsg('');
                }
                return;
            }

            const prog = e.target.closest('[data-prog]');
            if (prog) {
                const what = prog.dataset.prog;
                if (what === 'export') lbExport();
                else if (what === 'import') $('lb-import-file').click();
                else if (what === 'reset') {
                    // Irreversible and unbacked — make them say so, and offer the
                    // backup first rather than after.
                    if (window.confirm('This erases all progress in this browser. '
                        + 'Save a backup first if you might want it back. Erase now?')) {
                        prReset();
                        lbRenderStrands();
                        $('lb-progress-summary').innerHTML = lbProgressSummary();
                        lbMsg('Progress erased.');
                    }
                }
                return;
            }

            const prac = e.target.closest('[data-practice]');
            if (prac && typeof TAB_ENTRY !== 'undefined' && TAB_ENTRY[prac.dataset.practice]) {
                TAB_ENTRY[prac.dataset.practice]();
            }
        });

        const file = $('lb-import-file');
        if (file) {
            file.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) lbImport(e.target.files[0]);
                e.target.value = '';
            });
        }

        window.addEventListener('hashchange', () => {
            // Only drive navigation while the learner is actually in Learn.
            const active = document.querySelector('.screen.active');
            if (!active || !/^(lb-|ir-)/.test(active.id)) return;
            lbRoute();
        });
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectScreens();
        injectTab();
        injectSectionBar();
        SCREENS.forEach((n) => { SCREEN_TAB[n] = 'learn'; });
        TAB_ENTRY.learn = () => { lbRoute(); };
        wire();
        // Open on Maths — the activity everyone arrives for. Learn is one tap
        // away in the section row above.
        lbApplySection('maths', { enter: true });
    }

    window.lbApplySection = lbApplySection;
    window.lbSyncSection = lbSyncSection;
    // boot.js calls this once the lazy tab buttons exist — they are appended
    // after this file has already filtered the row, so without a second pass
    // they show up in whichever section happens to be open.
    window.lbRefilterTabs = () => lbApplySection(activeSection);
    window.ACTIVITY_SECTION = ACTIVITY_SECTION;
    window.lbBack = lbBack;
    window.lbGo = lbGo;
    window.lbRoute = lbRoute;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
