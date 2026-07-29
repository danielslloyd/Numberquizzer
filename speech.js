/*
 * speech.js — the page's one and only SpeechRecognition. (prefix sp)
 *
 * Why this exists: a second `new SpeechRecognition()` does not get a second
 * microphone. Two instances fight over one input stream, and the loser fails in
 * a way that looks like the recogniser being flaky rather than like a bug. The
 * flash-card quiz had the only instance welded into `state.recognition`, with an
 * `onresult` that read `state.questions[state.currentIndex].answer` directly, so
 * nothing else could ever listen. This module owns the instance; everything else
 * borrows it.
 *
 * Borrowing is a *claim*, not a subscription. One listener at a time, because
 * that is the truth about the hardware. Claiming while somebody else holds it
 * takes it from them and tells them so via their `onEnd`.
 *
 *     const tok = spListen({
 *         onText: (transcript, {final, alternatives}) => {…},
 *         lang: 'en-GB', alternatives: 5,
 *         indicator: 'mic-btn', indicatorClass: 'listening',
 *     });
 *     …
 *     spRelease(tok);
 *
 * `onText` fires on every interim *and* final result. It is given the best
 * transcript plus every alternative the recogniser offered — when you are
 * matching against one known target, more alternatives is strictly better, so
 * ask for several and check them all.
 *
 * The recogniser stops on its own constantly: after a pause, after a final
 * result, when the tab blurs, when the OS takes the mic. That is normal, not an
 * error, and this module restarts it for as long as a claim is live. Callers
 * should never see it happen.
 */
(function () {
    'use strict';

    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SGL = window.SpeechGrammarList || window.webkitSpeechGrammarList;

    let rec       = null;   // the single instance, built on first claim
    let claim     = null;   // whoever currently holds the microphone
    let running   = false;  // between onstart and onend
    let restartAt = null;   // pending restart timer
    let nextToken = 1;

    function spSupported() { return !!SR; }

    /** The live claim's token, or null. */
    function spActive() { return claim ? claim.token : null; }

    function indicator(on) {
        if (!claim || !claim.indicator) return;
        const el = document.getElementById(claim.indicator);
        if (el) el.classList.toggle(claim.indicatorClass || 'listening', on);
    }

    function build() {
        rec = new SR();

        rec.onstart = () => {
            running = true;
            indicator(true);
            if (claim && claim.onStart) claim.onStart();
        };

        rec.onresult = (event) => {
            if (!claim) return;
            const latest = event.results[event.results.length - 1];
            const alts = [];
            for (let i = 0; i < latest.length; i++) {
                alts.push((latest[i].transcript || '').trim());
            }
            claim.onText(alts[0] || '', { final: !!latest.isFinal, alternatives: alts });
        };

        // 'aborted' is what we get from our own stop(); everything else is worth
        // one retry, because the common causes (a blurred tab, a moment of OS
        // audio contention) clear on their own.
        rec.onerror = (event) => {
            running = false;
            indicator(false);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                const c = claim;
                claim = null;
                if (c && c.onEnd) c.onEnd('denied');
                return;
            }
            if (event.error !== 'aborted' && claim) schedule(200);
        };

        rec.onend = () => {
            running = false;
            if (claim) { schedule(100); return; }
            indicator(false);
        };
    }

    function schedule(ms) {
        clearTimeout(restartAt);
        restartAt = setTimeout(start, ms);
    }

    function start() {
        if (!claim || running) return;
        rec.continuous      = true;
        rec.interimResults  = true;
        rec.lang            = claim.lang || 'en-US';
        rec.maxAlternatives = claim.alternatives || 3;

        // Deprecated and a no-op in current Chrome, but it costs nothing to keep
        // handing it over where it still exists.
        if (SGL && claim.grammar) {
            try {
                const list = new SGL();
                list.addFromString(claim.grammar, 1);
                rec.grammars = list;
            } catch (e) { /* not fatal — the grammar is only ever a hint */ }
        }

        try { rec.start(); } catch (e) { /* already starting; onstart will land */ }
    }

    /**
     * Take the microphone. Returns a token, or null if this browser has no
     * recogniser — callers must handle null rather than assume a mic exists.
     */
    function spListen(opts) {
        if (!SR || !opts || typeof opts.onText !== 'function') return null;
        if (!rec) build();

        const previous = claim;
        indicator(false);               // clear the old holder's indicator first

        claim = {
            token: nextToken++,
            onText: opts.onText,
            onStart: opts.onStart || null,
            onEnd: opts.onEnd || null,
            lang: opts.lang,
            alternatives: opts.alternatives,
            grammar: opts.grammar,
            indicator: opts.indicator,
            indicatorClass: opts.indicatorClass,
        };
        if (previous && previous.onEnd) previous.onEnd('superseded');

        // If it is mid-run under the old claim's settings, stop and let onend
        // restart it under the new ones. start() would throw here otherwise.
        if (running) { try { rec.stop(); } catch (e) { /* ignore */ } }
        else schedule(0);

        return claim.token;
    }

    /** Give the microphone back. A stale token is ignored, so releasing twice is safe. */
    function spRelease(token) {
        if (!claim || claim.token !== token) return;
        clearTimeout(restartAt);
        indicator(false);               // while `claim` still names whose indicator it is
        const c = claim;
        claim = null;
        if (rec && running) { try { rec.stop(); } catch (e) { /* ignore */ } }
        if (c.onEnd) c.onEnd('released');
    }

    window.spSupported = spSupported;
    window.spActive    = spActive;
    window.spListen    = spListen;
    window.spRelease   = spRelease;
})();
