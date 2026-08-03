/* ============================================================================
 * sounds.js — the Sounds tab: a sandbox for the vowel analyser in audio.js.
 *
 * Self-contained plug-in, same shape as language-arts.js / polygons.js: one
 * IIFE that injects its own stylesheet, screen and tab, registers into the
 * global TAB_ENTRY / SCREEN_TAB, and touches no other file. Prefix `vs`.
 *
 * audio.js can already hear a vowel; what it could not do was SHOW you. Every
 * reading it produces is a point in a two-dimensional space, and a learner (or
 * anyone debugging a misfiring assessment) needs to see that space: where each
 * vowel sits, where the voice actually landed, and how far apart those are.
 *
 * Three things this exists to expose:
 *
 *   Calibration. The anchors are the whole ballgame — a child's formants sit
 *   half again as high as any textbook's, so an uncalibrated space misplaces
 *   every reading. Recalibrating from here writes the same `voice.v1` record
 *   the Learn runner reads, so fixing it here fixes it everywhere.
 *
 *   Smoothing. A raw formant estimate is jittery: a single frame can land a
 *   long way from where the voice is, and an unsmoothed dot is unreadable.
 *   The slider is a plain exponential moving average, exposed because the
 *   right amount is a matter of taste and of how noisy the room is.
 *
 *   The gap between "nearest vowel" and "where the dot is". The classifier
 *   always names something; the plot shows whether it was close.
 * ==========================================================================*/
(function () {
    'use strict';

    const STORE_KEY = 'voice.v1';        // shared with the Learn runner

    const vs = {
        on: false,               // microphone open
        mode: 'idle',            // 'idle' | 'live' | 'calibrating'
        anchors: null,
        smoothing: 65,           // slider, 0..100
        pt: null,                // smoothed position, {x, y}
        trail: [],
        last: null,              // last analysis
        raf: null,
        cal: null,               // {step, hold, anchors}
    };

    const TRAIL_MAX = 45;

    /* Slider to EMA coefficient. Squared rather than linear because the useful
     * range is all at the smooth end — the difference between 0.9 and 1.0 is
     * invisible, the difference between 0.03 and 0.13 is everything. */
    function vsAlpha() {
        return Math.max(0.03, Math.pow(1 - vs.smoothing / 100, 2));
    }

    /* One frame of the analyser, folded into the smoothed position.
     *
     * A frame that is silent or unvoiced does NOT move the dot. The formant
     * estimate for a frame with nothing in it is not a quiet reading, it is a
     * meaningless one, and letting it in makes the dot bolt for a corner every
     * time the speaker takes a breath.
     */
    function vsPush(a) {
        vs.last = a;
        if (!a || !a.voiced || a.rms < 0.008 || !(a.f1 > 0) || !(a.f2 > 0)) return null;
        const here = auNormalise(a.f1, a.f2, vs.anchors);
        const k = vsAlpha();
        vs.pt = vs.pt ? { x: vs.pt.x + (here.x - vs.pt.x) * k, y: vs.pt.y + (here.y - vs.pt.y) * k }
                      : { x: here.x, y: here.y };
        vs.trail.push({ x: vs.pt.x, y: vs.pt.y });
        if (vs.trail.length > TRAIL_MAX) vs.trail.shift();
        return vs.pt;
    }

    /* ---- the plot ---------------------------------------------------------*/

    function vsCanvas() { return document.getElementById('vs-plot'); }

    // Normalised (0..1 within the vowel triangle) to canvas pixels. One scale
    // for both axes, so the distances the classifier works in are the distances
    // you see; stretching them separately would make a near miss look like a hit.
    function vsProject(cv) {
        const PAD = 46;
        const span = Math.min(cv.width - 2 * PAD, cv.height - 2 * PAD);
        const ox = (cv.width - span) / 2, oy = (cv.height - span) / 2;
        return { span, x: (p) => ox + p.x * span, y: (p) => oy + p.y * span };
    }

    function vsFitCanvas() {
        const cv = vsCanvas();
        if (!cv) return;
        const dpr = window.devicePixelRatio || 1;
        const r = cv.getBoundingClientRect();
        const w = Math.max(240, Math.round(r.width * dpr));
        const h = Math.max(240, Math.round(r.height * dpr));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }

    function vsDraw() {
        const cv = vsCanvas();
        if (!cv) return;
        const g = cv.getContext('2d');
        const P = vsProject(cv);
        const S = cv.width / 520;              // scale text/strokes with the canvas
        g.clearRect(0, 0, cv.width, cv.height);

        // Axis captions: this space has a meaning and it should say so.
        g.fillStyle = '#999';
        g.font = `600 ${13 * S}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText('front', P.x({ x: 1 }), 20 * S);
        g.fillText('back', P.x({ x: 0 }), 20 * S);
        g.save();
        g.translate(14 * S, P.y({ y: 0.5 }));
        g.rotate(-Math.PI / 2);
        g.fillText('close  →  open', 0, 0);
        g.restore();

        // Every vowel, at its position for this speaker's space. The three that
        // are also calibration corners are ringed, because those are the ones
        // that define where everything else lands.
        const corners = { 'long-e': 1, 'short-o': 1, 'long-oo': 1 };
        (window.auVowels || []).forEach((v) => {
            const t = auTarget(v.id);
            if (!t) return;
            const x = P.x(t), y = P.y(t);
            const isCorner = !!corners[v.id];
            g.beginPath();
            g.arc(x, y, (isCorner ? 26 : 22) * S, 0, Math.PI * 2);
            g.fillStyle = isCorner ? '#eef4ff' : '#f4f4f4';
            g.fill();
            g.strokeStyle = isCorner ? '#1565c0' : '#d5d5d5';
            g.lineWidth = (isCorner ? 2.5 : 2) * S;
            g.stroke();
            g.fillStyle = isCorner ? '#1565c0' : '#777';
            g.font = `700 ${17 * S}px system-ui, sans-serif`;
            g.textAlign = 'center';
            g.fillText(v.say, x, y + 6 * S);
            g.fillStyle = '#aaa';
            g.font = `600 ${11 * S}px system-ui, sans-serif`;
            g.fillText(v.as, x, y + 38 * S);
        });

        // Where the voice has just been, fading out.
        if (vs.trail.length > 1) {
            for (let i = 1; i < vs.trail.length; i++) {
                const a = vs.trail[i - 1], b = vs.trail[i];
                g.strokeStyle = `rgba(198,40,40,${(i / vs.trail.length) * 0.5})`;
                g.lineWidth = 3 * S;
                g.beginPath();
                g.moveTo(P.x(a), P.y(a));
                g.lineTo(P.x(b), P.y(b));
                g.stroke();
            }
        }

        // Where it is now. Dimmed when the current frame carried no vowel, so
        // "the dot has stopped" and "the dot is here" are distinguishable.
        if (vs.pt) {
            const live = vs.last && vs.last.voiced && vs.last.rms >= 0.008;
            g.beginPath();
            g.arc(P.x(vs.pt), P.y(vs.pt), 11 * S, 0, Math.PI * 2);
            g.fillStyle = live ? '#c62828' : 'rgba(198,40,40,0.28)';
            g.fill();
            g.strokeStyle = '#fff';
            g.lineWidth = 2.5 * S;
            g.stroke();
        }
    }

    /* ---- readouts ---------------------------------------------------------*/

    function vsSetReadouts() {
        const a = vs.last;
        const hz = (v) => (v > 0 ? Math.round(v) + ' Hz' : '—');
        const put = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        put('vs-f1', a ? hz(a.f1) : '—');
        put('vs-f2', a ? hz(a.f2) : '—');
        put('vs-f0', a && a.voiced ? hz(a.f0) : '—');
        put('vs-level', a ? Math.round(Math.min(1, a.rms / 0.08) * 100) + '%' : '—');

        let nearest = '—';
        if (a && a.voiced && a.f1 > 0 && a.f2 > 0) {
            const v = auClassifyVowel(a.f1, a.f2, vs.anchors);
            if (v.vowel) {
                const def = (window.auVowels || []).find((x) => x.id === v.vowel);
                nearest = (def ? def.say : v.vowel) + '  ' + Math.round(v.confidence * 100) + '%';
            }
        }
        put('vs-near', nearest);
    }

    function vsStatus(text, kind) {
        const el = document.getElementById('vs-status');
        if (!el) return;
        el.textContent = text || '';
        el.className = 'vs-status' + (kind ? ' vs-' + kind : '');
    }

    function vsOverlay(opts) {
        const el = document.getElementById('vs-overlay');
        if (!el) return;
        if (!opts) { el.classList.add('hidden'); return; }
        el.classList.remove('hidden');
        document.getElementById('vs-overlay-say').textContent = opts.say || '';
        document.getElementById('vs-overlay-as').textContent = opts.as || '';
        document.getElementById('vs-overlay-note').textContent = opts.note || '';
        const bar = document.getElementById('vs-hold');
        bar.classList.toggle('hidden', !opts.hold);
        if (opts.hold) document.getElementById('vs-hold-fill').style.width = opts.hold + '%';
    }

    /* ---- calibration ------------------------------------------------------*/

    function vsCalibrateStart() {
        if (!vs.on) { vsStatus('Turn the microphone on first.', 'warn'); return; }
        vs.mode = 'calibrating';
        vs.cal = { step: 0, anchors: {}, hold: auHold({ frames: 10 }) };
        vsCalibrateShow();
        vsStatus('');
    }

    function vsCalibrateShow() {
        const step = auCalibrationSteps[vs.cal.step];
        vsOverlay({ say: step.say, as: step.as, hold: 0,
            note: 'Hold it steady — ' + (vs.cal.step + 1) + ' of ' + auCalibrationSteps.length });
    }

    function vsCalibrateFrame(a) {
        const c = vs.cal;
        const s = c.hold.push(a);
        const step = auCalibrationSteps[c.step];
        vsOverlay({ say: step.say, as: step.as, hold: Math.round((s.held / s.needed) * 100),
            note: 'Hold it steady — ' + (c.step + 1) + ' of ' + auCalibrationSteps.length });
        if (!s.done) return;

        const r = c.hold.result();
        if (r) c.anchors[step.key] = { f1: r.f1, f2: r.f2 };
        c.step++;
        c.hold = auHold({ frames: 10 });

        if (c.step < auCalibrationSteps.length) { vsCalibrateShow(); return; }

        // Three noises that are not three different noises leave a degenerate
        // space in which every later reading is meaningless, so a failed
        // calibration is discarded rather than saved.
        if (auAnchorsValid(c.anchors)) {
            vs.anchors = c.anchors;
            window.irVoiceAnchors = c.anchors;
            if (typeof stSetJSON === 'function') stSetJSON(STORE_KEY, c.anchors);
            vsStatus('Calibrated to this voice.', 'good');
        } else {
            vsStatus('That did not give three different sounds — still using the default space.', 'warn');
        }
        vs.cal = null;
        vs.mode = 'live';
        vs.pt = null;
        vs.trail.length = 0;
        vsOverlay(null);
        vsCalButton();
    }

    function vsCalButton() {
        const btn = document.getElementById('vs-calibrate');
        if (btn) btn.textContent = vs.anchors ? 'Recalibrate' : 'Calibrate';
    }

    /* ---- the loop ---------------------------------------------------------*/

    function vsLoop() {
        vs.raf = null;
        if (!vs.on) return;
        // Leaving the tab has to stop the microphone, and the plug-in has no
        // hook into onTabLeave — so the loop checks whether its own screen is
        // still the one on show.
        const screen = document.getElementById('sounds-screen');
        if (!screen || !screen.classList.contains('active')) { vsMicOff(); return; }

        const a = typeof auFrame === 'function' ? auFrame() : null;
        if (vs.mode === 'calibrating' && vs.cal) {
            vs.last = a;
            vsCalibrateFrame(a);
        } else {
            vsPush(a);
        }
        vsFitCanvas();
        vsDraw();
        vsSetReadouts();
        vs.raf = requestAnimationFrame(vsLoop);
    }

    function vsMicOn() {
        if (typeof auAvailable !== 'function' || !auAvailable()) {
            vsStatus('This browser has no microphone access.', 'warn');
            return;
        }
        vsStatus('Asking for the microphone…');
        auStart().then(function () {
            vs.on = true;
            vs.mode = 'live';
            vs.pt = null;
            vs.trail.length = 0;
            vsOverlay(null);
            vsStatus(vs.anchors ? 'Listening — calibrated to this voice.' : 'Listening — using the default space.');
            vsMicButton();
            if (!vs.raf) vs.raf = requestAnimationFrame(vsLoop);
        }).catch(function (err) {
            vsStatus('No microphone: ' + (err && err.name ? err.name : 'blocked'), 'warn');
        });
    }

    function vsMicOff() {
        vs.on = false;
        vs.mode = 'idle';
        vs.cal = null;
        if (vs.raf) cancelAnimationFrame(vs.raf);
        vs.raf = null;
        if (typeof auStop === 'function') auStop();
        vsMicButton();
        vsOverlay({ say: '🎤', as: '', note: 'Turn the microphone on and make a vowel sound.' });
        vsStatus('');
    }

    function vsMicButton() {
        const btn = document.getElementById('vs-mic');
        if (!btn) return;
        btn.textContent = vs.on ? '■ Stop listening' : '● Start listening';
        btn.classList.toggle('vs-live', vs.on);
    }

    function vsEnter() {
        showScreen('sounds');
        if (!vs.anchors && typeof stJSON === 'function') {
            const saved = window.irVoiceAnchors || stJSON(STORE_KEY, null);
            if (saved && auAnchorsValid(saved)) vs.anchors = saved;
        }
        vsCalButton();
        vsFitCanvas();
        vsDraw();
        if (!vs.on) vsOverlay({ say: '🎤', as: '', note: 'Turn the microphone on and make a vowel sound.' });
    }

    /* ---- markup -----------------------------------------------------------*/

    const SCREEN_HTML = `
        <div class="container vs-container">
            <div class="vs-controls">
                <button id="vs-mic" class="btn btn-secondary vs-btn">● Start listening</button>
                <button id="vs-calibrate" class="btn btn-secondary vs-btn">Calibrate</button>
            </div>
            <div class="vs-controls">
                <div class="vs-slider-group">
                    <label class="vs-slider-label" for="vs-smooth">Smoothing</label>
                    <input type="range" id="vs-smooth" class="vs-slider" min="0" max="100" step="1" value="65"
                           aria-label="Smoothing strength">
                    <span id="vs-smooth-val" class="vs-slider-val">65</span>
                </div>
            </div>
            <div class="vs-plot-wrap">
                <canvas id="vs-plot" class="vs-plot" width="520" height="520"></canvas>
                <div id="vs-overlay" class="vs-overlay">
                    <div id="vs-overlay-say" class="vs-overlay-say">🎤</div>
                    <div id="vs-overlay-as" class="vs-overlay-as"></div>
                    <div id="vs-hold" class="vs-hold hidden"><div id="vs-hold-fill" class="vs-hold-fill"></div></div>
                    <div id="vs-overlay-note" class="vs-overlay-note">Turn the microphone on and make a vowel sound.</div>
                </div>
            </div>
            <div id="vs-status" class="vs-status"></div>
            <div class="vs-readouts">
                <div class="vs-read"><span class="vs-read-k">Nearest</span><span id="vs-near" class="vs-read-v">—</span></div>
                <div class="vs-read"><span class="vs-read-k">F1</span><span id="vs-f1" class="vs-read-v">—</span></div>
                <div class="vs-read"><span class="vs-read-k">F2</span><span id="vs-f2" class="vs-read-v">—</span></div>
                <div class="vs-read"><span class="vs-read-k">Pitch</span><span id="vs-f0" class="vs-read-v">—</span></div>
                <div class="vs-read"><span class="vs-read-k">Level</span><span id="vs-level" class="vs-read-v">—</span></div>
            </div>
        </div>`;

    /* ---- boot -------------------------------------------------------------*/

    function injectStylesheet() {
        if (document.querySelector('link[data-vs-css]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'sounds.css?v=' + (window.ASSET_V || '1');
        link.dataset.vsCss = '1';
        document.head.appendChild(link);
    }

    function injectScreen() {
        if (document.getElementById('sounds-screen')) return;
        const div = document.createElement('div');
        div.id = 'sounds-screen';
        div.className = 'screen';
        div.innerHTML = SCREEN_HTML;
        const anchor = document.getElementById('sprite-layer');   // screens are body-level
        if (anchor) document.body.insertBefore(div, anchor);
        else document.body.appendChild(div);
    }

    function injectTab() {
        const bar = document.getElementById('tab-bar');
        // boot.js pre-creates this so the tab keeps its place while the file is
        // still being fetched. Don't add a second one.
        if (!bar || bar.querySelector('.tab-btn[data-tab="sounds"]')) return;
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.dataset.tab = 'sounds';
        btn.textContent = 'Sounds';
        bar.appendChild(btn);
    }

    function wire() {
        document.getElementById('vs-mic').addEventListener('click', () => {
            if (vs.on) vsMicOff(); else vsMicOn();
        });
        document.getElementById('vs-calibrate').addEventListener('click', vsCalibrateStart);
        document.getElementById('vs-smooth').addEventListener('input', (e) => {
            vs.smoothing = parseInt(e.target.value, 10);
            document.getElementById('vs-smooth-val').textContent = vs.smoothing;
        });
        window.addEventListener('resize', () => { vsFitCanvas(); vsDraw(); });
    }

    function boot() {
        if (typeof TAB_ENTRY === 'undefined' || typeof SCREEN_TAB === 'undefined') return;
        injectStylesheet();
        injectScreen();
        injectTab();
        SCREEN_TAB.sounds = 'sounds';
        TAB_ENTRY.sounds = vsEnter;
        wire();
    }

    // Debug handle for the smoke test, same convention as __GP / __PY.
    window.__VS = { state: vs, vsPush, vsAlpha, vsProject, vsDraw, vsCalibrateFrame,
        vsCalibrateStart, vsMicOn, vsMicOff, vsLoop };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
