/*
 * Shared localStorage helper.  Prefix: st
 *
 * Every mode in this app rolled its own accessor (bestTime_*, wordSortBest_*,
 * tapBest_*, ttFact_*, gpDone_*, mnCurrency), each with its own parsing and none
 * with any error handling. This is the helper that should have existed.
 *
 * Two things it does that the ad-hoc accessors did not:
 *
 *  - Namespaces under "nq." so new keys cannot collide with the legacy flat ones.
 *    LEGACY KEYS ARE NOT NAMESPACED AND MUST NOT BE. Reach them with stRawGet /
 *    stRawSet. The times-tables grid reads ttFact_* live, so renaming or deleting
 *    those would silently break it.
 *  - Survives a full quota. Safari in private browsing throws on every write, and
 *    a thrown QuotaExceededError inside an answer handler would lose the answer.
 *    Writes fall back to an in-memory map so the session keeps working; only
 *    persistence is lost, and stPersistent() reports whether that happened.
 */
(function () {
    'use strict';

    const NS = 'nq.';
    const mem = {};          // fallback store when localStorage is unavailable
    let persistent = true;

    function backing() {
        try {
            if (typeof localStorage === 'undefined') return null;
            return localStorage;
        } catch (e) {
            return null;      // access itself throws in some privacy modes
        }
    }

    function rawGet(key) {
        const ls = backing();
        if (ls) {
            try { const v = ls.getItem(key); if (v !== null) return v; } catch (e) { /* fall through */ }
        }
        return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
    }

    function rawSet(key, value) {
        const v = String(value);
        mem[key] = v;
        const ls = backing();
        if (!ls) { persistent = false; return false; }
        try {
            ls.setItem(key, v);
            return true;
        } catch (e) {
            persistent = false;
            return false;
        }
    }

    function rawRemove(key) {
        delete mem[key];
        const ls = backing();
        if (!ls) return;
        try { ls.removeItem(key); } catch (e) { /* nothing useful to do */ }
    }

    // ---- namespaced API (use this for anything new) ----------------------
    window.stGet = function (key, fallback) {
        const v = rawGet(NS + key);
        return v === null ? (fallback === undefined ? null : fallback) : v;
    };

    window.stSet = function (key, value) { return rawSet(NS + key, value); };

    window.stRemove = function (key) { rawRemove(NS + key); };

    window.stJSON = function (key, fallback) {
        const v = rawGet(NS + key);
        if (v === null) return fallback === undefined ? null : fallback;
        try {
            return JSON.parse(v);
        } catch (e) {
            // Corrupt blob — a half-written record should not brick the app.
            console.warn('storage: could not parse ' + key + ', using fallback');
            return fallback === undefined ? null : fallback;
        }
    };

    window.stSetJSON = function (key, obj) {
        try {
            return rawSet(NS + key, JSON.stringify(obj));
        } catch (e) {
            console.warn('storage: could not serialise ' + key);
            return false;
        }
    };

    window.stKeys = function (prefix) {
        const want = NS + (prefix || '');
        const out = new Set();
        const ls = backing();
        if (ls) {
            try {
                for (let i = 0; i < ls.length; i++) {
                    const k = ls.key(i);
                    if (k && k.indexOf(want) === 0) out.add(k.slice(NS.length));
                }
            } catch (e) { /* fall through to mem */ }
        }
        Object.keys(mem).forEach((k) => { if (k.indexOf(want) === 0) out.add(k.slice(NS.length)); });
        return [...out];
    };

    // ---- un-namespaced API (legacy keys only) ----------------------------
    window.stRawGet = function (key, fallback) {
        const v = rawGet(key);
        return v === null ? (fallback === undefined ? null : fallback) : v;
    };
    window.stRawSet = rawSet;
    window.stRawKeys = function (prefix) {
        const out = new Set();
        const ls = backing();
        if (ls) {
            try {
                for (let i = 0; i < ls.length; i++) {
                    const k = ls.key(i);
                    if (k && k.indexOf(prefix) === 0) out.add(k);
                }
            } catch (e) { /* fall through */ }
        }
        Object.keys(mem).forEach((k) => { if (k.indexOf(prefix) === 0) out.add(k); });
        return [...out];
    };

    /* True while writes are reaching disk. Goes false permanently after the
     * first failure, so the UI can warn once that progress will not be saved. */
    window.stPersistent = function () { return persistent; };

    /* Coalesces bursts of writes. Recording a result on every answered item
     * would otherwise stringify the whole progress blob per keystroke. Flushes
     * on a timer and, critically, when the page is hidden or unloaded — mobile
     * browsers often kill a backgrounded tab without ever firing unload. */
    window.stDebounced = function (key, delayMs) {
        let pending = null;
        let timer = null;
        const flush = function () {
            if (timer) { clearTimeout(timer); timer = null; }
            if (pending === null) return;
            const value = pending;
            pending = null;
            window.stSetJSON(key, value);
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'hidden') flush();
            });
        }
        if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush);
        return {
            set: function (value) {
                pending = value;
                if (timer) clearTimeout(timer);
                timer = setTimeout(flush, delayMs === undefined ? 500 : delayMs);
            },
            flush: flush,
        };
    };
})();
