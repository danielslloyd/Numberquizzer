/*
 * Curriculum registry.  Prefix: cur / global: CUR
 *
 * Holds the proficiency graph and hands out generated items. Two layers, split
 * on load cost:
 *
 *   metadata   curriculum/nodes-*.js — ~60 KB, EAGER. Needed at boot to draw the
 *              ladders and roll up mastery, so there is no point deferring it.
 *   generators gen/<pack>.js + content banks — 300 KB+, LAZY. Only fetched when a
 *              learner actually opens a node.
 *
 * CUR.ensurePack() is this repo's substitute for bundler code-splitting. There is
 * no build step and there is not going to be one: injecting a classic <script>
 * and resolving on its onload gives the same deferral with no tooling, no module
 * graph, and identical behaviour on Netlify and from file://.
 *
 * Determinism is a hard rule. Generators receive a seeded RNG and MUST NOT call
 * Math.random(). That buys reproducible worksheets with matching answer keys,
 * "show me that question again", and regression tests that can assert on exact
 * items. Existing modes predate this and keep Math.random(); new code does not.
 */
(function () {
    'use strict';

    const NODES = new Map();      // id -> node
    const GENS = new Map();       // nodeId -> generator fn
    const PACKS = new Map();      // packName -> {state, promise}
    const gatesIdx = new Map();   // id -> [ids that depend on it]
    let ladders = null;           // strand -> [node], built lazily, invalidated on register

    // ---- seeded RNG ------------------------------------------------------
    // xorshift32. Not cryptographic and does not need to be — it needs to be
    // fast, tiny, and identical across browsers, which Math.random() is not.
    function makeRng(seed) {
        let s = (seed | 0) || 0x9e3779b9;
        const rng = function () {
            s ^= s << 13; s |= 0;
            s ^= s >>> 17;
            s ^= s << 5; s |= 0;
            return ((s >>> 0) / 4294967296);
        };
        rng.int = function (lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); };
        rng.pick = function (arr) { return arr[Math.floor(rng() * arr.length)]; };
        rng.bool = function (p) { return rng() < (p === undefined ? 0.5 : p); };
        rng.shuffle = function (arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                const t = a[i]; a[i] = a[j]; a[j] = t;
            }
            return a;
        };
        // n distinct members, or the whole array if it is shorter than n.
        rng.sample = function (arr, n) { return rng.shuffle(arr).slice(0, n); };
        return rng;
    }

    function hash32(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return h >>> 0;
    }

    // ---- registration ----------------------------------------------------
    function registerNodes(defs) {
        (defs || []).forEach((n) => {
            if (NODES.has(n.id)) {
                console.warn('curriculum: duplicate node id ' + n.id + ' — keeping the first');
                return;
            }
            NODES.set(n.id, n);
        });
        ladders = null;
        rebuildGates();
    }

    // The reverse edge index. Deriving it rather than storing it on each node is
    // what makes it impossible for `prereq` and "what this gates" to disagree.
    function rebuildGates() {
        gatesIdx.clear();
        NODES.forEach((n) => { gatesIdx.set(n.id, []); });
        NODES.forEach((n) => {
            (n.prereq || []).forEach((p) => {
                if (gatesIdx.has(p)) gatesIdx.get(p).push(n.id);
            });
        });
    }

    function registerGens(pack, map) {
        Object.keys(map || {}).forEach((nodeId) => {
            if (!NODES.has(nodeId)) {
                console.warn('curriculum: pack "' + pack + '" supplies a generator for unknown node ' + nodeId);
            }
            GENS.set(nodeId, map[nodeId]);
        });
        const rec = PACKS.get(pack);
        if (rec) rec.state = 'ready';
    }

    // ---- queries ---------------------------------------------------------
    function get(id) { return NODES.get(id) || null; }
    function all() { return [...NODES.values()]; }
    function gates(id) { return (gatesIdx.get(id) || []).slice(); }

    function buildLadders() {
        ladders = new Map();
        NODES.forEach((n) => {
            if (!ladders.has(n.strand)) ladders.set(n.strand, []);
            ladders.get(n.strand).push(n);
        });
        ladders.forEach((arr) => arr.sort((a, b) => a.rung - b.rung));
    }

    function ladder(strand) {
        if (!ladders) buildLadders();
        return (ladders.get(strand) || []).slice();
    }

    function strands() {
        if (!ladders) buildLadders();
        return [...ladders.keys()].map((k) => ({
            strand: k,
            label: ladders.get(k)[0].strandLabel || k,
            count: ladders.get(k).length,
            built: ladders.get(k).filter((n) => n.tier === 1).length,
        }));
    }

    /* True once a node can actually be practised. Tier alone is not enough —
     * tier 1 states intent, a registered generator states capability, and the
     * ladder UI needs to distinguish "not built yet" from "ready". */
    function isBuilt(id) { return GENS.has(id); }

    // ---- lazy pack loading -----------------------------------------------
    function ensurePack(pack) {
        if (!pack) return Promise.reject(new Error('ensurePack: no pack named'));
        const existing = PACKS.get(pack);
        if (existing) return existing.promise;

        const promise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            const v = (typeof window !== 'undefined' && window.ASSET_V) || '1';
            s.src = 'gen/' + pack + '.js?v=' + v;
            s.async = false;
            s.onload = function () { resolve(pack); };
            s.onerror = function () {
                PACKS.delete(pack);   // allow a retry rather than caching the failure
                reject(new Error('could not load pack ' + pack));
            };
            document.head.appendChild(s);
        });

        PACKS.set(pack, { state: 'loading', promise: promise });
        return promise;
    }

    // ---- generation ------------------------------------------------------
    /*
     * Draw n items for a node. Same (nodeId, seed) always yields the same items.
     *
     * Rejects rather than returning junk when a node has no generator: showing a
     * child a broken or wrong question is the worst failure this app has, so the
     * caller is made to handle the gap explicitly.
     */
    function generate(nodeId, n, seed) {
        const node = get(nodeId);
        if (!node) return Promise.reject(new Error('unknown node ' + nodeId));

        return ensurePack(node.pack).then(function () {
            const gen = GENS.get(nodeId);
            if (!gen) throw new Error('node ' + nodeId + ' has no generator in pack ' + node.pack);

            const count = n || 1;
            const baseSeed = (seed === undefined || seed === null)
                ? (hash32(nodeId) ^ ((Date.now() & 0xffff) * 2654435761)) >>> 0
                : seed;

            const items = [];
            const seen = new Set();
            let draws = 0;
            const maxDraws = count * 12;   // generous; some nodes have small item spaces

            while (items.length < count && draws < maxDraws) {
                const itemSeed = (baseSeed + draws * 0x9e3779b9) >>> 0;
                const rng = makeRng(itemSeed);
                draws++;

                let raw;
                try {
                    raw = gen(rng, node.params || {});
                } catch (e) {
                    console.error('curriculum: generator for ' + nodeId + ' threw', e);
                    continue;
                }
                if (!raw) continue;

                // Signature dedupe so a small item space does not repeat inside
                // one run. Falls back to accepting duplicates once the space is
                // plainly exhausted, which is correct for e.g. make-ten.
                const sig = raw.sig || (raw.stem + '|' + JSON.stringify(raw.answer));
                if (seen.has(sig) && draws < maxDraws - count) continue;
                seen.add(sig);

                items.push(Object.assign({
                    id: nodeId + '#' + hash32(String(itemSeed)).toString(36),
                    node: nodeId,
                    grade: 'exact',
                }, raw, {
                    meta: Object.assign({ seed: itemSeed }, raw.meta || {}),
                }));
            }

            if (!items.length) throw new Error('generator for ' + nodeId + ' produced nothing');
            return items;
        });
    }

    // ---- expose ----------------------------------------------------------
    const CUR = {
        registerNodes: registerNodes,
        registerGens: registerGens,
        get: get,
        all: all,
        gates: gates,
        ladder: ladder,
        strands: strands,
        isBuilt: isBuilt,
        ensurePack: ensurePack,
        generate: generate,
        rng: makeRng,
        hash: hash32,
    };

    window.CUR = CUR;

    // Node files may have loaded before this one (script order should prevent it,
    // but a stray <script> or a cached partial load should not lose the data).
    if (window.__CUR_PENDING && window.__CUR_PENDING.length) {
        registerNodes(window.__CUR_PENDING);
        window.__CUR_PENDING.length = 0;
    }

    // Debug handle, following the window.__GP / window.__laBuildForce precedent.
    window.__CUR = CUR;
})();
