/*
 * Response types and graders.  Globals: ITEM_TYPES, GRADERS
 *
 * A response type owns three things: how it draws its input, how it reads a
 * response back out, and whether answering submits immediately (tapping a
 * multiple-choice option) or waits for a button (typing a number).
 *
 * A grader is referenced BY STRING, never as a function. That keeps items
 * serialisable, which is what lets them be cached, exported, printed with a
 * matching answer key, and diffed in a regression test. A generator that needs
 * bespoke logic should express it as answer data plus an existing grader rather
 * than reaching for a closure.
 *
 * Every grader returns {correct, partial, detail}. Partial credit is first-class
 * because binary scoring is close to useless for multi-select and ordering, and
 * the mastery model weights by `partial` rather than by `correct`.
 */
(function () {
    'use strict';

    const esc = window.idrEscape;

    // =====================================================================
    // GRADERS
    // =====================================================================
    function ok(correct, partial, detail) {
        return { correct: !!correct, partial: partial === undefined ? (correct ? 1 : 0) : partial, detail: detail || '' };
    }

    // ---- spoken answers --------------------------------------------------
    // Shared by the `spoken` grader and the `speech` response type, which both
    // need to decide "was that it?" — the type to know when to stop listening,
    // the grader to score. Two copies of this rule would drift.
    function spNorm(s) {
        return String(s === null || s === undefined ? '' : s)
            .toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function matchSpoken(heard, item) {
        const got = spNorm(heard);
        if (!got) return false;
        const targets = [item.answer]
            .concat((item.gradeOpts && item.gradeOpts.accept) || [])
            .map(spNorm).filter(Boolean);

        return targets.some((t) => {
            if (got === t) return true;
            // Recognisers pad a single word with articles, and a child who says
            // "sheep… ship" has corrected themselves and is right. So a target
            // appearing as a whole word in the utterance counts — but only if it
            // is long enough for that to mean something. "a" and "I" are heart
            // words, and token-containment would accept any sentence at all.
            if (t.length < 3 || t.indexOf(' ') >= 0) return false;
            return got.split(' ').indexOf(t) >= 0;
        });
    }

    /*
     * Say the answer, for a typed-number item.
     *
     * Deliberately narrower than the read-aloud type: the microphone can only
     * ever produce a CORRECT answer here, and anything else it hears is ignored.
     * That is not timidity, it is that the keyboard is sitting right there — a
     * child who is misheard simply types it, so there is nothing to gain by
     * guessing at a near-miss and a wrong mark to lose. It is also exactly what
     * the flash-card quiz has always done, which is a long-tested behaviour.
     */
    function listenForNumber(host, item, api) {
        if (typeof spListen !== 'function' || typeof findNumberInSpeech !== 'function') return;
        if (typeof spSupported !== 'function' || !spSupported()) return;

        const chip = document.createElement('p');
        chip.className = 'ir-speech-state ir-numeric-mic';
        chip.setAttribute('aria-live', 'polite');
        chip.innerHTML = '<span class="ir-speech-dot"></span>'
            + '<span class="ir-speech-msg">Say it, or type it.</span>';
        host.querySelector('.ir-response').after(chip);

        const target = Number(item.answer);
        host.__numMic = spListen({
            lang: 'en-US',              // the number vocabulary is tuned for en-US
            alternatives: 3,
            onStart: () => { chip.classList.add('is-live'); },
            onEnd: () => { chip.classList.remove('is-live'); },
            onText: (transcript, info) => {
                if (host.dataset.locked === '1') return;
                for (const alt of info.alternatives) {
                    const heard = findNumberInSpeech(alt);
                    if (heard !== null && heard === target) {
                        const input = host.querySelector('.ir-input');
                        if (input) input.value = String(heard);
                        api.submit();
                        return;
                    }
                }
            },
        });
    }

    function releaseNumberMic(host) {
        if (host && host.__numMic && typeof spRelease === 'function') spRelease(host.__numMic);
        if (host) host.__numMic = null;
    }

    const GRADERS = {
        // Strict-ish equality, with numbers and numeric strings treated alike.
        exact: function (resp, item) {
            if (resp === null || resp === undefined) return ok(false);
            const a = item.answer;
            if (typeof a === 'number' || typeof resp === 'number') {
                return ok(Number(resp) === Number(a));
            }
            return ok(String(resp) === String(a));
        },

        numeric: function (resp, item) {
            const got = typeof resp === 'number' ? resp : parseFloat(String(resp).replace(/[, ]/g, ''));
            if (!isFinite(got)) return ok(false, 0, 'not a number');
            const tol = (item.gradeOpts && item.gradeOpts.tol) || 0;
            return ok(Math.abs(got - Number(item.answer)) <= tol + 1e-9);
        },

        /* Accepts any equivalent fraction by cross-multiplication, so 2/4 counts
         * for 1/2 — the same rule the Fractions tab already applies. Set
         * gradeOpts.lowest to additionally require simplest form. */
        fraction: function (resp, item) {
            if (!resp || resp.num === '' || resp.den === '' || resp.num === null || resp.den === null) return ok(false);
            const n = Number(resp.num), d = Number(resp.den);
            if (!isFinite(n) || !isFinite(d)) return ok(false, 0, 'not a fraction');
            if (d === 0) return ok(false, 0, 'denominator cannot be zero');

            const A = item.answer || {};
            const equivalent = n * Number(A.den) === d * Number(A.num);
            if (!equivalent) return ok(false);

            if (item.gradeOpts && item.gradeOpts.lowest) {
                const g = (function gcd(x, y) { x = Math.abs(x); y = Math.abs(y); while (y) { const t = y; y = x % y; x = t; } return x || 1; })(n, d);
                if (g !== 1) return ok(false, 0.5, 'right value, but not in simplest form');
            }
            return ok(true);
        },

        text: function (resp, item) {
            const norm = (s) => String(s === null || s === undefined ? '' : s)
                .trim().toLowerCase().replace(/\s+/g, ' ');
            const got = norm(resp);
            if (!got) return ok(false);
            const accepted = [item.answer].concat((item.gradeOpts && item.gradeOpts.accept) || []);
            return ok(accepted.some((a) => norm(a) === got));
        },

        /*
         * Read aloud, heard through a microphone. Three outcomes, not two.
         *
         * A recogniser mishearing a child who read the word correctly is a
         * certainty, not a risk — so the interesting question is never "did it
         * match" but "do we know anything". Silence tells us nothing about the
         * reader and is reported as `evidence:false`, which the runner honours by
         * recording nothing at all. A clear transcript of a *different* word is
         * genuine evidence of a misread and is scored.
         *
         * The alternative — treating every non-match as wrong — makes the
         * recogniser's accuracy on a young voice part of the mastery model, and
         * marks a child wrong for a word they read perfectly. That is the most
         * demoralising failure this app can produce.
         */
        spoken: function (resp, item) {
            // The response *is* what was heard, so a bare string is a valid one.
            // That keeps `grader(item.answer, item)` meaningful for this type
            // too, which is the single assertion the generator smoke test leans
            // on hardest: every item's own answer must grade correct.
            const heard = (resp && typeof resp === 'object') ? resp.heard : resp;
            if (!heard || !spNorm(heard)) {
                const v = ok(false, 0, 'I didn\'t catch that, so I haven\'t counted it.');
                v.evidence = false;
                return v;
            }
            if (matchSpoken(heard, item)) return ok(true);
            // `names` lets a node answer in codes and report in something a
            // child recognises — the vowel classifier deals in 'short-a', which
            // is no use at all as feedback.
            const names = (item.gradeOpts && item.gradeOpts.names) || null;
            return ok(false, 0, 'I heard “' + ((names && names[heard]) || heard) + '”.');
        },

        // Unordered selection. Partial = Jaccard, so near-misses score honestly.
        set: function (resp, item) {
            const got = new Set(resp || []);
            const want = new Set(item.answer || []);
            if (!want.size) return ok(got.size === 0);
            let hit = 0;
            want.forEach((v) => { if (got.has(v)) hit++; });
            const union = new Set([...got, ...want]).size;
            const partial = union ? hit / union : 0;
            return ok(hit === want.size && got.size === want.size, partial);
        },

        // Ordered. Partial = fraction of positions correct.
        sequence: function (resp, item) {
            const got = resp || [];
            const want = item.answer || [];
            if (got.length !== want.length) return ok(false, 0, 'wrong number of items');
            let hit = 0;
            for (let i = 0; i < want.length; i++) if (String(got[i]) === String(want[i])) hit++;
            return ok(hit === want.length, want.length ? hit / want.length : 0);
        },

        // [[left, right], ...] in any order.
        pairs: function (resp, item) {
            const key = (p) => String(p[0]) + ' ' + String(p[1]);
            const got = new Set((resp || []).map(key));
            const want = (item.answer || []).map(key);
            if (!want.length) return ok(got.size === 0);
            const hit = want.filter((k) => got.has(k)).length;
            return ok(hit === want.length && got.size === want.length, hit / want.length);
        },

        // {binId: [items]} — partial = share of items in the right bin.
        partition: function (resp, item) {
            const want = item.answer || {};
            const got = resp || {};
            let total = 0, hit = 0;
            Object.keys(want).forEach((bin) => {
                const wantSet = new Set(want[bin] || []);
                total += wantSet.size;
                (got[bin] || []).forEach((v) => { if (wantSet.has(v)) hit++; });
            });
            return ok(total > 0 && hit === total, total ? hit / total : 0);
        },
    };

    // =====================================================================
    // ITEM_TYPES
    // =====================================================================
    function el(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return d.firstElementChild;
    }

    const ITEM_TYPES = {

        // ---- typed number ------------------------------------------------
        numeric: {
            autoSubmit: false,
            render: function (host, item, api) {
                host.innerHTML =
                    '<div class="ir-response ir-numeric">'
                    + '<input type="text" inputmode="decimal" class="ir-input" autocomplete="off" '
                    + 'aria-label="Your answer" placeholder="?">'
                    + '</div>';
                const input = host.querySelector('.ir-input');
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); api.submit(); }
                });
                if (api && api.mic) listenForNumber(host, item, api);
            },
            focus: function (host) { const i = host.querySelector('.ir-input'); if (i) i.focus(); },
            collect: function (host) {
                const v = host.querySelector('.ir-input').value.trim();
                return v === '' ? null : v;
            },
            clear: function (host) { host.querySelector('.ir-input').value = ''; },
            teardown: releaseNumberMic,
        },

        // ---- stacked numerator / denominator -----------------------------
        // Laid out vertically over a bar so it reads as a fraction rather than
        // as two unrelated fields — the same choice the Fractions tab makes.
        fraction: {
            autoSubmit: false,
            render: function (host, item, api) {
                host.innerHTML =
                    '<div class="ir-response ir-fraction">'
                    + '<input type="text" inputmode="numeric" class="ir-frac-num" aria-label="Numerator" placeholder="?">'
                    + '<div class="ir-frac-bar"></div>'
                    + '<input type="text" inputmode="numeric" class="ir-frac-den" aria-label="Denominator" placeholder="?">'
                    + '</div>';
                host.querySelectorAll('input').forEach((i) => {
                    i.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); api.submit(); }
                    });
                });
            },
            focus: function (host) { const i = host.querySelector('.ir-frac-num'); if (i) i.focus(); },
            collect: function (host) {
                const n = host.querySelector('.ir-frac-num').value.trim();
                const d = host.querySelector('.ir-frac-den').value.trim();
                if (n === '' || d === '') return null;
                return { num: n, den: d };
            },
            clear: function (host) { host.querySelectorAll('input').forEach((i) => { i.value = ''; }); },
        },

        // ---- multiple choice ---------------------------------------------
        // A choice may be a string, {text}, or {draw,args} — which is how this
        // one type also covers "pick the right diagram".
        mc: {
            autoSubmit: true,
            render: function (host, item, api) {
                const choices = item.choices || [];
                const body = choices.map((c, i) => {
                    let inner;
                    if (typeof c === 'string') inner = esc(c);
                    else if (c.draw) inner = (window.idrDraw[c.draw] || (() => ''))(c.args || {});
                    else inner = esc(c.text);
                    return `<button type="button" class="ir-choice" data-choice="${i}">${inner}</button>`;
                }).join('');
                host.innerHTML = `<div class="ir-response ir-mc">${body}</div>`;
                host.querySelectorAll('.ir-choice').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        if (host.dataset.locked === '1') return;
                        host.querySelectorAll('.ir-choice').forEach((b) => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        api.submit();
                    });
                });
            },
            collect: function (host) {
                const sel = host.querySelector('.ir-choice.selected');
                return sel ? Number(sel.dataset.choice) : null;
            },
            clear: function (host) {
                host.querySelectorAll('.ir-choice').forEach((b) => b.classList.remove('selected'));
            },
            /* Show which was right after grading — for a misconception-bearing
             * node, seeing the correct option next to your own is most of the
             * instructional value. */
            reveal: function (host, item) {
                host.querySelectorAll('.ir-choice').forEach((b) => {
                    const i = Number(b.dataset.choice);
                    if (i === Number(item.answer)) b.classList.add('is-correct');
                    else if (b.classList.contains('selected')) b.classList.add('is-wrong');
                });
            },
        },

        // ---- multi-select ------------------------------------------------
        multi: {
            autoSubmit: false,
            render: function (host, item) {
                const body = (item.choices || []).map((c, i) =>
                    `<button type="button" class="ir-choice" data-choice="${i}">${typeof c === 'string' ? esc(c) : esc(c.text)}</button>`
                ).join('');
                host.innerHTML = '<p class="ir-multi-note">Pick as many as you need, then press Check.</p>'
                    + `<div class="ir-response ir-mc ir-multi">${body}</div>`;
                host.querySelectorAll('.ir-choice').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        if (host.dataset.locked === '1') return;
                        btn.classList.toggle('selected');
                    });
                });
            },
            collect: function (host) {
                return [...host.querySelectorAll('.ir-choice.selected')].map((b) => Number(b.dataset.choice));
            },
            clear: function (host) {
                host.querySelectorAll('.ir-choice').forEach((b) => b.classList.remove('selected'));
            },
        },

        // ---- typed text --------------------------------------------------
        text: {
            autoSubmit: false,
            render: function (host, item, api) {
                host.innerHTML =
                    '<div class="ir-response ir-text">'
                    + '<input type="text" class="ir-input" autocomplete="off" autocapitalize="off" '
                    + 'spellcheck="false" aria-label="Your answer">'
                    + '</div>';
                host.querySelector('.ir-input').addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); api.submit(); }
                });
            },
            focus: function (host) { const i = host.querySelector('.ir-input'); if (i) i.focus(); },
            collect: function (host) {
                const v = host.querySelector('.ir-input').value.trim();
                return v === '' ? null : v;
            },
            clear: function (host) { host.querySelector('.ir-input').value = ''; },
        },

        // ---- read it out loud ---------------------------------------------
        // Claims the shared microphone (speech.js) for the life of the item and
        // gives it back in teardown. The runner only ever renders this type when
        // it has already established that a microphone exists, so the no-mic path
        // here is a backstop rather than the plan.
        speech: {
            autoSubmit: true,
            render: function (host, item, api) {
                host.innerHTML =
                    '<div class="ir-response ir-speech">'
                    + '  <p class="ir-speech-state" aria-live="polite">'
                    + '    <span class="ir-speech-dot"></span>'
                    + '    <span class="ir-speech-msg">Getting the microphone…</span>'
                    + '  </p>'
                    + '  <div class="ir-speech-actions">'
                    + '    <button type="button" class="btn btn-secondary ir-small" data-act="again">Try again</button>'
                    + '    <button type="button" class="btn btn-secondary ir-small" data-act="skip">Move on</button>'
                    + '  </div>'
                    + '</div>';

                const wrap = host.querySelector('.ir-speech');
                const msg = host.querySelector('.ir-speech-msg');
                const st = { heard: null, token: null, timer: null, done: false };
                host.__speech = st;

                function say(text, cls) {
                    msg.textContent = text;
                    wrap.className = 'ir-response ir-speech' + (cls ? ' is-' + cls : '');
                }

                function finish() {
                    if (st.done) return;
                    st.done = true;
                    clearTimeout(st.timer);
                    stop();
                    api.submit();
                }

                function stop() {
                    if (st.token && typeof spRelease === 'function') spRelease(st.token);
                    st.token = null;
                }

                // Six seconds of nothing is the signal to stop waiting. It is
                // long enough not to rush a child sounding a word out, and short
                // enough that a broken microphone does not strand the run.
                function armTimer() {
                    clearTimeout(st.timer);
                    st.timer = setTimeout(finish, 6000);
                }

                function listen() {
                    if (typeof spListen !== 'function' || !spSupported()) {
                        say('No microphone here — press Move on.', 'off');
                        return;
                    }
                    st.token = spListen({
                        lang: 'en-GB',
                        alternatives: 5,          // matching one known target: more is strictly better
                        indicator: null,
                        onStart: () => { say('Listening…', 'live'); armTimer(); },
                        onEnd: (why) => {
                            if (why === 'denied' && !st.done) say('The microphone is blocked — press Move on.', 'off');
                        },
                        onText: (transcript, info) => {
                            if (st.done) return;
                            const hit = info.alternatives.find((a) => matchSpoken(a, item));
                            if (hit) { st.heard = hit; finish(); return; }
                            // Not a match — hold it as a candidate but keep
                            // listening, because a child often corrects
                            // themselves and the later attempt is the real one.
                            if (info.final && spNorm(transcript)) {
                                st.heard = transcript;
                                say('I heard “' + transcript + '”…', 'live');
                            }
                        },
                    });
                    if (st.token === null) say('No microphone here — press Move on.', 'off');
                }

                host.querySelector('[data-act="again"]').addEventListener('click', () => {
                    if (host.dataset.locked === '1' || st.done) return;
                    st.heard = null;
                    say('Listening…', 'live');
                    armTimer();
                });
                host.querySelector('[data-act="skip"]').addEventListener('click', () => {
                    if (host.dataset.locked === '1') return;
                    finish();
                });

                listen();
            },
            collect: function (host) {
                // Always an object, never null — "I heard nothing" is a real
                // response here, and the grader turns it into "no evidence"
                // rather than into a wrong answer.
                return { heard: (host.__speech && host.__speech.heard) || null };
            },
            teardown: function (host) {
                const st = host.__speech;
                if (!st) return;
                st.done = true;
                clearTimeout(st.timer);
                if (st.token && typeof spRelease === 'function') spRelease(st.token);
                st.token = null;
            },
            reveal: function (host, item) {
                const msg = host.querySelector('.ir-speech-msg');
                if (msg) msg.textContent = 'The word was “' + item.answer + '”.';
                // Nothing left to say into the microphone once it has been
                // graded, and leaving live-looking buttons there invites a tap
                // that does nothing.
                const acts = host.querySelector('.ir-speech-actions');
                if (acts) acts.remove();
            },
        },

        // ---- make the sound ------------------------------------------------
        /*
         * A vowel, heard as a shape rather than as a word. audio.js explains why
         * this needs its own instrument; what matters here is the interaction.
         *
         * It is a MIRROR, not a verdict. The child's voice is a dot moving in
         * vowel space with a ring to steer into, and getting the dot into the
         * ring IS the item. That framing is doing real work: a formant estimate
         * from a five-year-old in a kitchen is an uncertain measurement, and an
         * uncertain measurement rendered as a live position degrades into "keep
         * trying" where the same measurement rendered as a verdict degrades into
         * telling a child they said their own name wrong.
         *
         * It is also simply a better toy than a tap target, which is the other
         * half of why it exists.
         */
        sound: {
            autoSubmit: true,
            render: function (host, item, api) {
                host.innerHTML =
                    '<div class="ir-response ir-sound">'
                    + '  <canvas class="ir-sound-space" width="440" height="380"'
                    + '          aria-label="Your voice, as a dot to steer"></canvas>'
                    + '  <p class="ir-speech-state ir-sound-state" aria-live="polite">'
                    + '    <span class="ir-speech-dot"></span>'
                    + '    <span class="ir-speech-msg">Getting the microphone…</span></p>'
                    + '  <div class="ir-speech-actions">'
                    + '    <button type="button" class="btn btn-secondary ir-small" data-act="again">Try again</button>'
                    + '    <button type="button" class="btn btn-secondary ir-small" data-act="skip">Move on</button>'
                    + '  </div>'
                    + '</div>';

                const wrap = host.querySelector('.ir-sound');
                const msg = host.querySelector('.ir-speech-msg');
                const state = host.querySelector('.ir-sound-state');
                const cv = host.querySelector('.ir-sound-space');
                const g = cv.getContext('2d');

                const st = { heard: null, best: null, done: false, raf: null,
                             hold: null, calStep: -1, anchors: null };
                host.__sound = st;

                function say(text, live) {
                    msg.textContent = text;
                    state.classList.toggle('is-live', !!live);
                }

                function finish() {
                    if (st.done) return;
                    st.done = true;
                    cancelAnimationFrame(st.raf);
                    api.submit();
                }

                host.querySelector('[data-act="again"]').addEventListener('click', () => {
                    if (st.done || !st.hold) return;
                    st.hold.reset(); st.heard = null; st.best = null;
                });
                host.querySelector('[data-act="skip"]').addEventListener('click', () => {
                    if (host.dataset.locked !== '1') finish();
                });

                if (typeof auStart !== 'function') { say('This needs a microphone.'); return; }

                st.anchors = window.irVoiceAnchors || null;
                st.calStep = auAnchorsValid(st.anchors) ? -1 : 0;

                auStart().then(() => {
                    st.hold = auHold({ frames: 10 });
                    tick();
                }).catch(() => { say('The microphone did not open — press Move on.'); });

                function tick() {
                    st.raf = requestAnimationFrame(tick);
                    const a = auFrame();
                    if (!a) return;
                    if (st.calStep >= 0) return calibrate(a);
                    listen(a);
                    draw(a);
                }

                // A three-sound warm-up, run once per learner, that anchors the
                // vowel space to this actual voice. Not a refinement: a child's
                // formants sit half again above the adult figures every table
                // quotes, so uncalibrated thresholds misclassify every child.
                function calibrate(a) {
                    const step = auCalibrationSteps[st.calStep];
                    const s = st.hold.push(a);
                    say('Warming up — say “' + step.say + '”, like ' + step.as
                        + ' (' + s.held + '/' + s.needed + ')', s.held > 0);
                    if (!s.done) return;
                    const r = st.hold.result();
                    st.anchors = st.anchors || {};
                    st.anchors[step.key] = { f1: r.f1, f2: r.f2 };
                    st.calStep++;
                    st.hold = auHold({ frames: 10 });
                    if (st.calStep < auCalibrationSteps.length) return;
                    st.calStep = -1;
                    if (auAnchorsValid(st.anchors)) {
                        window.irVoiceAnchors = st.anchors;
                        if (typeof stSetJSON === 'function') stSetJSON('voice.v1', st.anchors);
                    } else {
                        st.anchors = null;      // degenerate; carry on uncalibrated
                    }
                }

                /*
                 * How close counts as in the ring, in normalised units.
                 *
                 * Nearest-target-wins is the wrong rule for a mirror: it would
                 * mark a child right while their dot sat visibly outside the
                 * circle, which makes the picture a lie and teaches them the
                 * picture is not worth watching. So acceptance is a radius, the
                 * ring is DRAWN at that radius, and the two cannot drift.
                 *
                 * Never more than a bit under halfway to the nearest other
                 * target, so two rings can never overlap and no position is
                 * inside both.
                 */
                const radius = (function () {
                    let gap = 2;
                    (item.among || []).forEach((id) => {
                        if (id === item.answer) return;
                        const t = auTarget(id), me = auTarget(item.answer);
                        if (t && me) gap = Math.min(gap, Math.hypot(t.x - me.x, t.y - me.y));
                    });
                    return Math.min(0.22, gap * 0.45);
                }());

                function listen(a) {
                    if (!a.voiced || a.rms < 0.012) { say('Make the sound…', false); return; }
                    const v = auClassifyVowel(a.f1, a.f2, st.anchors, item.among);
                    if (!v.vowel) return;
                    const me = auTarget(item.answer);
                    const here = auNormalise(a.f1, a.f2, st.anchors);
                    const inRing = me && Math.hypot(here.x - me.x, here.y - me.y) <= radius;
                    if (v.vowel === item.answer && !inRing) {
                        say('Nearly — a bit more like that…', true);
                        return;
                    }
                    if (v.vowel === item.answer) {
                        const s = st.hold.push(a);
                        say('Hold it… ' + s.held + '/' + s.needed, true);
                        if (s.done) { st.heard = v.vowel; finish(); }
                    } else {
                        // Somebody else's vowel, held steadily, is evidence — but
                        // only the LAST thing held, so a wander through the space
                        // on the way to the right answer is not held against them.
                        st.best = { vowel: v.vowel, confidence: v.confidence };
                        st.heard = v.vowel;
                        say('I hear “' + labelOf(v.vowel) + '”…', true);
                    }
                }

                function labelOf(id) {
                    const v = (window.auVowels || []).find((x) => x.id === id);
                    return v ? v.say : id;
                }

                function draw(a) {
                    const W = cv.width, H = cv.height, PAD = 46;
                    g.clearRect(0, 0, W, H);
                    // One scale for both axes. Stretching x and y separately
                    // would draw the acceptance radius as an ellipse while the
                    // rule stayed a circle, so the picture would disagree with
                    // the grading in exactly the corners a child aims for.
                    const span = Math.min(W - 2 * PAD, H - 2 * PAD);
                    const ox = (W - span) / 2, oy = (H - span) / 2;
                    const px = (p) => ox + p.x * span;
                    const py = (p) => oy + p.y * span;

                    // The ring is drawn at exactly the radius that counts, so
                    // "get the dot inside" is literally the rule being applied.
                    const rPx = radius * span;
                    (item.among || []).forEach((id) => {
                        const t = auTarget(id);
                        if (!t) return;
                        const isTarget = id === item.answer;
                        g.strokeStyle = isTarget ? '#1565c0' : '#e2e2e2';
                        g.lineWidth = isTarget ? 3 : 2;
                        g.beginPath(); g.arc(px(t), py(t), rPx, 0, Math.PI * 2); g.stroke();
                        g.fillStyle = isTarget ? '#1565c0' : '#bbb';
                        g.textAlign = 'center'; g.font = '600 17px system-ui, sans-serif';
                        g.fillText(t.say, px(t), py(t) + 6);
                    });

                    if (a.voiced && a.f1 && a.f2) {
                        const here = auNormalise(a.f1, a.f2, st.anchors);
                        g.fillStyle = '#c62828';
                        g.beginPath(); g.arc(px(here), py(here), 10, 0, Math.PI * 2); g.fill();
                    }
                }
            },
            collect: function (host) {
                return { heard: (host.__sound && host.__sound.heard) || null };
            },
            teardown: function (host) {
                const st = host.__sound;
                if (!st) return;
                st.done = true;
                cancelAnimationFrame(st.raf);
                if (typeof auStop === 'function') auStop();
            },
            reveal: function (host, item) {
                const msg = host.querySelector('.ir-speech-msg');
                if (msg) {
                    const v = (window.auVowels || []).find((x) => x.id === item.answer);
                    msg.textContent = v ? 'That one is “' + v.say + '”, as in ' + v.as + '.' : '';
                }
                const acts = host.querySelector('.ir-speech-actions');
                if (acts) acts.remove();
            },
        },

        // ---- place a value on a number line -------------------------------
        // Graded with a tolerance, because the skill being measured is magnitude
        // estimation rather than pixel accuracy.
        numberline: {
            autoSubmit: false,
            render: function (host, item, api) {
                const a = item.line || {};
                const lo = a.lo === undefined ? 0 : a.lo;
                const hi = a.hi === undefined ? 1 : a.hi;
                const W = 460, H = 84, PAD = 30;
                const span = hi - lo || 1;

                host.innerHTML =
                    '<div class="ir-response ir-numberline">'
                    + window.idrDraw['number-line'](Object.assign({}, a, { mark: null }))
                    + '<div class="ir-nl-readout" aria-live="polite"></div>'
                    + '</div>';

                const svg = host.querySelector('svg');
                const readout = host.querySelector('.ir-nl-readout');
                const ns = 'http://www.w3.org/2000/svg';
                const dot = document.createElementNS(ns, 'circle');
                dot.setAttribute('r', '10');
                dot.setAttribute('cy', '46');
                dot.setAttribute('fill', '#c62828');
                dot.setAttribute('class', 'ir-nl-dot');
                dot.style.display = 'none';
                svg.appendChild(dot);

                let value = null;

                function place(clientX) {
                    if (host.dataset.locked === '1') return;
                    const box = svg.getBoundingClientRect();
                    const px = ((clientX - box.left) / box.width) * W;       // viewBox units
                    const clamped = Math.max(PAD, Math.min(W - PAD, px));
                    value = lo + ((clamped - PAD) / (W - 2 * PAD)) * span;
                    dot.setAttribute('cx', clamped.toFixed(1));
                    dot.style.display = '';
                    readout.textContent = a.readout === false ? '' : value.toFixed(2);
                }

                svg.addEventListener('pointerdown', (e) => {
                    svg.setPointerCapture(e.pointerId);
                    place(e.clientX);
                });
                svg.addEventListener('pointermove', (e) => {
                    if (e.buttons) place(e.clientX);
                });
                svg.addEventListener('keydown', (e) => {
                    // Keyboard access: nudge by a hundredth of the span.
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                    e.preventDefault();
                    if (value === null) value = lo + span / 2;
                    value += (e.key === 'ArrowRight' ? 1 : -1) * span / 100;
                    value = Math.max(lo, Math.min(hi, value));
                    dot.setAttribute('cx', (PAD + ((value - lo) / span) * (W - 2 * PAD)).toFixed(1));
                    dot.style.display = '';
                    readout.textContent = a.readout === false ? '' : value.toFixed(2);
                });
                svg.setAttribute('tabindex', '0');

                host.__nlValue = () => value;
            },
            collect: function (host) { return host.__nlValue ? host.__nlValue() : null; },
            clear: function (host) {
                const d = host.querySelector('.ir-nl-dot');
                if (d) d.style.display = 'none';
                const r = host.querySelector('.ir-nl-readout');
                if (r) r.textContent = '';
                host.__nlValue = () => null;
            },
        },
    };

    window.ITEM_TYPES = ITEM_TYPES;
    window.GRADERS = GRADERS;

    window.irGrade = function (response, item) {
        const g = GRADERS[item.grade];
        if (!g) {
            console.error('item-types: no grader named "' + item.grade + '" for ' + item.id);
            return { correct: false, partial: 0, detail: 'ungradable' };
        }
        return g(response, item);
    };
})();
