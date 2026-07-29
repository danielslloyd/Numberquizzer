/*
 * Script manifest and loader.
 *
 * Replaces the hand-maintained list of <script src="x.js?v=N"> tags in
 * index.html. Two reasons that list had to go:
 *
 *  1. Cache busting was per-file and manual, so every change meant remembering
 *     which version numbers to bump. There is now ONE number: ASSET_V.
 *  2. index.html was a merge-conflict hotspot — every branch that added a file
 *     touched the same few lines. Adding a script is now a one-line append to an
 *     array, and adding a generator pack touches nothing here at all.
 *
 * Load policy:
 *
 *   EAGER   small, needed on every visit, or defines globals others read at load.
 *   LAZY    a whole feature behind one tab. Fetched on first click.
 *
 * The lazy half matters more than it looks. Before this, every visitor parsed
 * ~570 KB of JavaScript up front, of which geometry-proofs.js alone was 268 KB —
 * downloaded and parsed in full even by someone who only ever opened flash cards.
 * The tab buttons are created here immediately so the bar looks and behaves
 * exactly as before; only the implementation is deferred.
 */
(function () {
    'use strict';

    // Bump on ANY change to a local .js or .css file. This is the only version
    // number in the project — CLAUDE.md's per-file ?v=N rule is retired.
    const ASSET_V = '59';
    window.ASSET_V = ASSET_V;

    // Order matters: storage and the curriculum registry come first so the node
    // files have somewhere to register, and app.js comes before anything that
    // reads TAB_ENTRY / SCREEN_TAB / showScreen at load time.
    const EAGER = [
        'storage.js',
        'curriculum.js',
        'curriculum/nodes-math.js',
        'curriculum/nodes-english.js',
        'gen/manifest.js',      // which nodes are buildable, without fetching the packs
        // Small (~12 KB) and shared by five packs, so eager beats five lazy
        // fetches. Larger banks — reading passages especially — stay lazy.
        'content/words-phonics.js',
        'content/words-language.js',
        'parser.js',
        'physics.js',
        'animator.js',
        // The page's single SpeechRecognition. Must precede app.js, which claims
        // it for the flash-card quiz, and item-runner.js, which claims it too.
        'speech.js',
        'audio.js',
        'app.js',
        // Learn. These come after app.js because they read TAB_ENTRY, SCREEN_TAB
        // and showScreen when they boot, and item-draw adapts app.js's renderers.
        'item-draw.js',
        'item-gen-helpers.js',
        'item-types.js',
        'progress.js',
        'item-runner.js',
        'library.js',
    ];

    // Each entry owns its tabs. `tabs` is [tabId, label] in display order; the
    // buttons are created up front and the file is fetched on first click.
    const LAZY = [
        {
            file: 'language-arts.js',
            tabs: [
                ['la-vocab', 'Vocabulary'],
                ['la-cap', 'Capitals'],
                ['la-punct', 'Punctuation'],
                ['la-subj', 'Subject/Verb'],
                ['la-diag', 'Diagramming'],
            ],
        },
        {
            file: 'geometry-proofs.js',
            tabs: [['geo-proofs', 'Proofs']],
        },
    ];

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = src + (src.indexOf('?') === -1 ? '?v=' + ASSET_V : '');
            s.async = false;            // preserve execution order
            s.onload = function () { resolve(src); };
            s.onerror = function () { reject(new Error('failed to load ' + src)); };
            document.head.appendChild(s);
        });
    }

    // Sequential rather than Promise.all: async=false already guarantees
    // execution order, but chaining also means a failure stops the run instead
    // of leaving half the app initialised against missing globals.
    function loadAll(list) {
        return list.reduce(function (chain, src) {
            return chain.then(function () { return loadScript(src); });
        }, Promise.resolve());
    }

    const moduleState = {};   // file -> Promise, so a double click loads once

    function loadModule(mod) {
        if (!moduleState[mod.file]) {
            moduleState[mod.file] = loadScript(mod.file).catch(function (err) {
                delete moduleState[mod.file];    // let a later click retry
                throw err;
            });
        }
        return moduleState[mod.file];
    }

    /* Create the tab buttons now and point them at a loader. When the real file
     * arrives its own register() overwrites TAB_ENTRY, and we re-dispatch into
     * whatever it installed. The plug-ins' injectTab/injectTabs skip buttons that
     * already exist, so these stay put rather than being duplicated at the end
     * of the bar. */
    function wireLazyTabs() {
        const bar = document.getElementById('tab-bar');
        if (!bar) return;

        LAZY.forEach(function (mod) {
            mod.tabs.forEach(function (pair) {
                const tab = pair[0];
                const label = pair[1];

                if (!bar.querySelector('.tab-btn[data-tab="' + tab + '"]')) {
                    const btn = document.createElement('button');
                    btn.className = 'tab-btn';
                    btn.dataset.tab = tab;
                    btn.textContent = label;
                    bar.appendChild(btn);
                }

                const stub = function () {
                    const btn = bar.querySelector('.tab-btn[data-tab="' + tab + '"]');
                    if (btn) btn.classList.add('tab-loading');
                    loadModule(mod).then(function () {
                        if (btn) btn.classList.remove('tab-loading');
                        const entry = TAB_ENTRY[tab];
                        if (entry && entry !== stub) entry();
                        else console.error('boot: ' + mod.file + ' did not register tab "' + tab + '"');
                    }).catch(function (err) {
                        if (btn) btn.classList.remove('tab-loading');
                        console.error(err);
                    });
                };

                TAB_ENTRY[tab] = stub;
            });
        });
    }

    loadAll(EAGER)
        .then(wireLazyTabs)
        .catch(function (err) {
            console.error('boot: ' + err.message);
            const el = document.getElementById('tab-bar');
            if (el) {
                const warn = document.createElement('div');
                warn.style.cssText = 'padding:1rem;color:#c00;font-family:system-ui';
                warn.textContent = 'Something failed to load. Try refreshing the page.';
                el.parentNode.insertBefore(warn, el);
            }
        });
})();
