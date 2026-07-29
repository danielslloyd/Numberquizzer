/*
 * Generic assessment runner.  Prefix: ir
 *
 * One screen that can present any item type, grade it, explain it, and record
 * the result — so adding a proficiency needs a generator and nothing else. No
 * per-node UI, no per-node grading code.
 *
 * This is the *assessment* half of the app. The eighteen bespoke activity modes
 * are the *practice* half and are not replaced by it: they are richer than a
 * generic runner will ever be, and they are the reason a child stays engaged.
 * A node links to both.
 *
 * Two things here are requirements rather than niceties:
 *
 *   Latency capture. Nodes with an automaticity target are graded on speed as
 *   well as accuracy, so every item is timed from the moment it is shown.
 *
 *   Text-to-speech. The early word-recognition nodes ask a learner to work with
 *   sounds; their prompts are meaningless as text, and a learner who cannot yet
 *   read cannot use the app at all without this. It is wired in from the start
 *   rather than added later.
 */
(function () {
    'use strict';

    const SCREENS = ['ir-run', 'ir-results'];

    const S = {
        items: [], idx: 0, results: [],
        mode: 'practice', nodeIds: [], onDone: null,
        shownAt: 0, startedAt: 0, locked: false, type: null,
        mic: false, reserve: [], unheard: 0, advanceAt: null,
    };

    // Three items in a row that the microphone could not hear is not a learner
    // problem — it is a broken microphone, a noisy room, or a browser that says
    // it has speech recognition and does not. Stop asking and finish the run on
    // tap, rather than making a child fight the hardware.
    const UNHEARD_LIMIT = 3;

    function $(id) { return document.getElementById(id); }

    // ---- speech ----------------------------------------------------------
    // Mirrors the en-GB voice preference pvSpeak already uses, so the app has
    // one voice rather than two.
    function irSpeak(text) {
        if (!text || typeof speechSynthesis === 'undefined') return;
        try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            const voices = speechSynthesis.getVoices();
            const gb = voices.find((v) => v.lang === 'en-GB') || voices.find((v) => /^en/.test(v.lang));
            if (gb) u.voice = gb;
            u.rate = 0.95;
            speechSynthesis.speak(u);
        } catch (e) { /* speech is an enhancement; never let it break a run */ }
    }

    // ---- lifecycle -------------------------------------------------------
    /*
     * opts: {nodeIds, count, mode, seed, mic, onDone}
     *   mode 'practice' — explanations shown, no session record
     *   mode 'assess'   — explanations shown, session recorded
     *   mode 'review'   — drawn from the due queue
     *   mic            — ask generators for read-aloud items where they have them
     */
    function irStart(opts) {
        const o = opts || {};
        S.nodeIds = (o.nodeIds || []).slice();
        S.mode = o.mode || 'practice';
        S.onDone = o.onDone || null;
        S.items = [];
        S.idx = 0;
        S.results = [];
        S.locked = false;
        S.type = null;
        S.unheard = 0;
        clearTimeout(S.advanceAt);
        S.advanceAt = null;
        S.reserve = [];
        S.startedAt = Date.now();
        S.mic = !!o.mic && typeof spSupported === 'function' && spSupported();

        if (!S.nodeIds.length) { console.error('irStart: no nodes'); return; }

        showScreen('ir-run');
        $('ir-body').innerHTML = '<p class="ir-loading">Getting your questions ready…</p>';
        $('ir-response-host').innerHTML = '';
        $('ir-feedback').textContent = '';
        $('ir-feedback').className = 'ir-feedback';

        const perNode = Math.max(1, Math.ceil((o.count || 10) / S.nodeIds.length));
        const draw = (extra, seed) => S.nodeIds.map((id) => CUR.generate(id, perNode, seed, extra)
            .catch((err) => { console.error(err); return []; }));

        const draws = draw(S.mic ? { mic: true } : undefined, o.seed);

        // A parallel set of tap items, drawn up front so they are there the
        // instant they are needed. An item the microphone could not hear yields
        // no evidence, so the run has to be one item longer to have asked the
        // same number of real questions — and if the microphone turns out to be
        // useless, the rest of the run switches to these rather than stalling.
        const spares = S.mic
            ? Promise.all(draw({ mic: false }, o.seed === undefined ? undefined : o.seed + 7919))
            : Promise.resolve([]);

        Promise.all([Promise.all(draws), spares]).then(([batches, spareBatches]) => {
            let all = [];
            batches.forEach((b) => { all = all.concat(b); });
            spareBatches.forEach((b) => {
                S.reserve = S.reserve.concat(b.filter((i) => i.type !== 'speech'));
            });

            if (!all.length) {
                $('ir-body').innerHTML =
                    '<p class="ir-loading">This one isn\'t built yet. Try another rung.</p>';
                return;
            }

            // Interleave rather than block by node when several are in play, so a
            // mixed review actually mixes.
            if (S.nodeIds.length > 1) {
                const rng = CUR.rng((o.seed || Date.now()) & 0x7fffffff);
                all = rng.shuffle(all);
            }
            S.items = all.slice(0, o.count || all.length);
            irRender();
        });
    }

    function current() { return S.items[S.idx]; }

    /* A type that holds a resource — the microphone, a timer, an audio graph —
     * gives it back here. Called before every render and on the way out, so a
     * type can never leak past its own item. */
    function teardown() {
        if (S.type && S.type.teardown) {
            try { S.type.teardown($('ir-response-host')); } catch (e) { console.error(e); }
        }
    }

    function irRender() {
        teardown();
        const item = current();
        if (!item) return irEnd();

        const node = CUR.get(item.node);
        S.type = ITEM_TYPES[item.type];
        if (!S.type) {
            console.error('item-runner: unknown item type "' + item.type + '"');
            return irNext();
        }

        $('ir-node-label').textContent = node ? node.label : '';
        $('ir-count').textContent = (S.idx + 1) + ' / ' + S.items.length;
        $('ir-progress-fill').style.width = ((S.idx / S.items.length) * 100).toFixed(1) + '%';

        $('ir-body').innerHTML = idrRenderPrompt(item.prompt);

        const host = $('ir-response-host');
        host.dataset.locked = '0';
        S.type.render(host, item, { submit: irSubmit, mic: S.mic });
        if (S.type.focus) S.type.focus(host);

        $('ir-feedback').textContent = '';
        $('ir-feedback').className = 'ir-feedback';
        $('ir-submit').classList.toggle('hidden', !!S.type.autoSubmit);
        $('ir-next').classList.add('hidden');
        $('ir-hint').classList.toggle('hidden', !item.hint);
        // Speaking the prompt of a read-aloud item would say the word, turning
        // decoding into repetition. Hidden while the question is live, offered
        // again once it has been graded — which is exactly when hearing it helps.
        $('ir-speak').classList.toggle('hidden', item.type === 'speech');

        S.locked = false;
        S.shownAt = Date.now();

        // Nodes about sounds must be spoken; everything else is speakable on
        // demand via the button.
        if (node && node.params && node.params.audio) irSpeak(idrSpeakable(item));
    }

    function irSubmit() {
        if (S.locked) return;
        const item = current();
        const host = $('ir-response-host');
        const response = S.type.collect(host);

        if (response === null || response === undefined
            || (Array.isArray(response) && !response.length)) {
            $('ir-feedback').textContent = 'Have a go first.';
            $('ir-feedback').className = 'ir-feedback ir-fb-nudge';
            return;
        }

        const ms = Date.now() - S.shownAt;
        const verdict = irGrade(response, item);

        S.locked = true;
        host.dataset.locked = '1';
        if (S.type.reveal) S.type.reveal(host, item);

        // A grader may decline to produce evidence — today only `spoken`, when
        // the microphone heard nothing at all. Nothing is recorded, because a
        // silence says something about the room and nothing about the reader.
        if (verdict.evidence === false) return unheard(item);

        prRecord(item.node, {
            correct: verdict.correct,
            partial: verdict.partial,
            ms: ms,
            src: item.type === 'speech' ? 'runner-mic' : 'runner',
        });
        S.results.push({ node: item.node, correct: verdict.correct, partial: verdict.partial, ms: ms });

        $('ir-speak').classList.remove('hidden');

        const fb = $('ir-feedback');
        if (verdict.correct) {
            fb.textContent = pickPraise();
            fb.className = 'ir-feedback ir-fb-correct';
        } else {
            fb.innerHTML = '<strong>Not quite.</strong> ' + idrEscape(answerText(item))
                + (item.explain ? '<br><span class="ir-explain">' + idrEscape(item.explain) + '</span>' : '')
                + (verdict.detail ? '<br><span class="ir-explain">' + idrEscape(verdict.detail) + '</span>' : '');
            fb.className = 'ir-feedback ir-fb-wrong';
        }

        $('ir-submit').classList.add('hidden');
        $('ir-next').classList.remove('hidden');
        $('ir-next').focus();

        // A correct answer moves on by itself; a wrong one waits, because the
        // correct answer sitting next to your own is most of the value.
        //
        // The handle matters. Pressing Next yourself before the beat is up used
        // to leave this timer running, and if you then answered the NEXT item
        // inside the same 700 ms it fired against that one and skipped it — a
        // question silently lost, and more likely the faster you are.
        if (verdict.correct) S.advanceAt = setTimeout(() => { if (S.locked) irNext(); }, 700);
    }

    /* The microphone heard nothing. Record nothing, add an item back so the run
     * still asks as many real questions as it promised, and give up on the
     * microphone entirely once it has failed enough times to be the problem. */
    function unheard(item) {
        S.unheard++;
        if (S.reserve.length) S.items.push(S.reserve.shift());

        const giveUp = S.mic && S.unheard >= UNHEARD_LIMIT;
        if (giveUp) {
            S.mic = false;
            // Swap every read-aloud item still ahead of us for a tap one.
            for (let i = S.idx + 1; i < S.items.length; i++) {
                if (S.items[i].type === 'speech' && S.reserve.length) S.items[i] = S.reserve.shift();
            }
            S.items = S.items.filter((it, i) => i <= S.idx || it.type !== 'speech');
        }

        $('ir-speak').classList.remove('hidden');
        const fb = $('ir-feedback');
        // The word itself is already shown by the type's own reveal, so this
        // says only the part the learner cannot see: that it did not count.
        fb.innerHTML = '<strong>I didn\'t hear that.</strong> '
            + idrEscape(giveUp
                ? 'Let\'s carry on by tapping instead.'
                : 'It hasn\'t been counted against you.');
        fb.className = 'ir-feedback ir-fb-nudge';

        $('ir-submit').classList.add('hidden');
        $('ir-next').classList.remove('hidden');
        $('ir-next').focus();
    }

    function answerText(item) {
        const a = item.answer;
        if (a && typeof a === 'object' && a.num !== undefined) return 'The answer is ' + a.num + '/' + a.den + '.';
        if (item.type === 'mc' && item.choices) {
            const c = item.choices[Number(a)];
            const label = typeof c === 'string' ? c : (c && c.text);
            return label ? 'The answer is ' + label + '.' : '';
        }
        if (item.type === 'numberline') return 'It goes here.';
        return 'The answer is ' + a + '.';
    }

    const PRAISE = ['Yes!', 'Correct.', 'Got it.', 'That\'s right.', 'Nice.'];
    let praiseAt = 0;
    function pickPraise() { return PRAISE[praiseAt++ % PRAISE.length]; }

    function irNext() {
        clearTimeout(S.advanceAt);
        S.advanceAt = null;
        S.locked = false;
        S.idx++;
        irRender();
    }

    function irEnd() {
        teardown();
        const total = S.results.length;
        const right = S.results.filter((r) => r.correct).length;
        const secs = Math.round((Date.now() - S.startedAt) / 1000);

        if (S.mode !== 'practice' && total) {
            prSession({ mode: S.mode, nodes: S.nodeIds.slice(), n: total, c: right, secs: secs });
        }
        prFlush();

        showScreen('ir-results');
        $('ir-res-score').textContent = right + ' / ' + total;
        $('ir-res-time').textContent = secs + 's';

        // Per-node outcome, including why a node that was answered perfectly may
        // still not count as proficient yet.
        const byNode = {};
        S.results.forEach((r) => {
            const b = byNode[r.node] || (byNode[r.node] = { n: 0, c: 0, ms: [] });
            b.n++; if (r.correct) b.c++; b.ms.push(r.ms);
        });

        $('ir-res-nodes').innerHTML = Object.keys(byNode).map((id) => {
            const node = CUR.get(id);
            const b = byNode[id];
            const lvl = prLevel(id);
            const blocked = prBlockedBy(id);
            let note = '';
            if (blocked && blocked.reason === 'speed') {
                note = `<span class="ir-res-note">All correct — now for speed. Typical ${(blocked.p50 / 1000).toFixed(1)}s, aiming for ${(blocked.target / 1000).toFixed(1)}s.</span>`;
            } else if (blocked && blocked.reason === 'comeBack') {
                note = '<span class="ir-res-note">Looking good. Come back another day to lock it in.</span>';
            } else if (lvl >= 3) {
                note = '<span class="ir-res-note ir-res-good">Proficient.</span>';
            }
            return `<div class="ir-res-node"><span class="ir-res-name">${idrEscape(node ? node.label : id)}</span>`
                + `<span class="ir-res-tally">${b.c}/${b.n}</span>${note}</div>`;
        }).join('');

        if (S.onDone) S.onDone({ total: total, correct: right, secs: secs });
    }

    // ---- screens ---------------------------------------------------------
    const RUN_HTML =
        '<div class="ir-topbar">'
        + '  <button id="ir-quit" class="ir-icon-btn" aria-label="Back">&larr;</button>'
        + '  <span id="ir-node-label" class="ir-node-label"></span>'
        + '  <span id="ir-count" class="ir-count"></span>'
        + '</div>'
        + '<div class="ir-progress"><div id="ir-progress-fill" class="ir-progress-fill"></div></div>'
        + '<div class="ir-stage">'
        + '  <div id="ir-body" class="ir-body"></div>'
        + '  <div id="ir-response-host"></div>'
        + '  <div id="ir-feedback" class="ir-feedback"></div>'
        + '  <div class="ir-actions">'
        + '    <button id="ir-speak" class="btn btn-secondary ir-small" aria-label="Read the question aloud">Hear it</button>'
        + '    <button id="ir-hint" class="btn btn-secondary ir-small hidden">Hint</button>'
        + '    <button id="ir-submit" class="btn btn-primary">Check</button>'
        + '    <button id="ir-next" class="btn btn-primary hidden">Next</button>'
        + '  </div>'
        + '</div>';

    const RESULTS_HTML =
        '<div class="container">'
        + '  <h1 class="results-title">Done</h1>'
        + '  <div class="results-stats">'
        + '    <div class="stat"><div class="stat-label">Score</div><div id="ir-res-score" class="stat-value">0 / 0</div></div>'
        + '    <div class="stat"><div class="stat-label">Time</div><div id="ir-res-time" class="stat-value">0s</div></div>'
        + '  </div>'
        + '  <div id="ir-res-nodes" class="ir-res-nodes"></div>'
        + '  <button id="ir-res-again" class="btn btn-primary">Again</button>'
        + '  <button id="ir-res-back" class="btn btn-secondary">Back to the ladder</button>'
        + '</div>';

    function injectStylesheet() {
        if (document.querySelector('link[data-learn-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'learn.css?v=' + (window.ASSET_V || '1');
        link.dataset.learnCss = '1';
        document.head.appendChild(link);
    }

    function injectScreens() {
        const anchor = document.getElementById('sprite-layer');
        [['ir-run', RUN_HTML], ['ir-results', RESULTS_HTML]].forEach(([name, html]) => {
            if (document.getElementById(name + '-screen')) return;
            const div = document.createElement('div');
            div.id = name + '-screen';
            div.className = 'screen';
            div.innerHTML = html;
            if (anchor) document.body.insertBefore(div, anchor);
            else document.body.appendChild(div);
        });
    }

    function wire() {
        $('ir-submit').addEventListener('click', irSubmit);
        $('ir-next').addEventListener('click', irNext);
        $('ir-speak').addEventListener('click', () => { const i = current(); if (i) irSpeak(idrSpeakable(i)); });
        $('ir-hint').addEventListener('click', () => {
            const i = current();
            if (!i || !i.hint) return;
            const fb = $('ir-feedback');
            fb.textContent = i.hint;
            fb.className = 'ir-feedback ir-fb-nudge';
        });
        $('ir-quit').addEventListener('click', () => {
            teardown();
            prFlush();
            if (window.lbBack) lbBack(); else showScreen('home');
        });
        $('ir-res-again').addEventListener('click', () => {
            irStart({ nodeIds: S.nodeIds, count: S.items.length, mode: S.mode });
        });
        $('ir-res-back').addEventListener('click', () => {
            if (window.lbBack) lbBack(); else showScreen('home');
        });
    }

    function boot() {
        if (typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreens();
        // Both screens belong to the Learn tab, the same "several screens, one
        // tab" arrangement as home/quiz/results under flashcards.
        SCREENS.forEach((n) => { SCREEN_TAB[n] = 'learn'; });
        wire();
    }

    window.irStart = irStart;
    window.irSpeak = irSpeak;
    window.__IR = S;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
