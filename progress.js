/*
 * Mastery and review scheduling.  Prefix: pr
 *
 * Storage is two blobs rather than one key per node:
 *
 *   nq.profile.v1        {v, active, learners:{id:{...}}}
 *   nq.progress.v1.<id>  {v, updatedAt, nodes:{...}, sessions:[...], badges:{...}}
 *
 * ~15 KB per learner against a 5 MB quota, and one parse at boot instead of two
 * hundred getItem calls. Writes are debounced, because recording a result on
 * every answered item would otherwise stringify the whole blob per keystroke.
 *
 * What promotion requires, and why:
 *
 *   - m >= 0.8 and n >= 8 — enough evidence to mean something.
 *   - attempts on two distinct calendar days. This is the rule that stops a
 *     learner "mastering" a node in ninety seconds. Retention over a sleep is
 *     the thing worth claiming; one good run is not.
 *   - for automaticity nodes, median latency at or under the node's target. A
 *     learner who is accurate but slow has not finished, because slow retrieval
 *     eats the working memory that later multi-step work needs. This is the
 *     population the app exists for — far ahead conceptually, with fluency gaps
 *     hidden underneath — so accuracy alone must not be enough.
 *
 * Responses under 400ms are recorded but excluded from the mastery average.
 * They are button-mashing, not knowledge, and letting them count would make the
 * fastest way to "master" a node be to not read it.
 *
 * Scheduling is Leitner rather than SM-2. The unit here is a node whose items
 * are freshly generated every time, so SM-2's per-item ease factors have nothing
 * to attach to, and a box number is something a parent can actually be told.
 */
(function () {
    'use strict';

    const PROFILE_KEY = 'profile.v1';
    const ALPHA = 0.25;              // EWMA weight on the newest result
    const MASH_MS = 400;             // below this, the answer was not read
    const BOX_DAYS = [0, 1, 3, 7, 16, 35];
    const DAY = 86400000;
    const PROFICIENT_N = 8;
    const PROFICIENT_M = 0.8;
    const MASTERED_AFTER_DAYS = 14;
    const TIMES_KEPT = 12;           // rolling window for the latency median
    const SESSIONS_KEPT = 200;

    let profile = null;
    let progress = null;
    let writer = null;

    // ---- profile ---------------------------------------------------------
    function loadProfile() {
        profile = stJSON(PROFILE_KEY, null);
        if (!profile || !profile.learners || !profile.active) {
            profile = {
                v: 1,
                active: 'l1',
                learners: { l1: { id: 'l1', name: 'Me', avatar: '', createdAt: Date.now() } },
            };
            stSetJSON(PROFILE_KEY, profile);
        }
        return profile;
    }

    function progressKey(id) { return 'progress.v1.' + id; }

    function loadProgress(id) {
        const blank = { v: 1, updatedAt: 0, nodes: {}, sessions: [], badges: {} };
        const got = stJSON(progressKey(id), null);
        progress = got && got.nodes ? got : blank;
        writer = stDebounced(progressKey(id), 500);
        return progress;
    }

    function ensure() {
        if (!profile) loadProfile();
        if (!progress) loadProgress(profile.active);
        return progress;
    }

    function save() {
        progress.updatedAt = Date.now();
        writer.set(progress);
    }

    function blankNode() {
        return { n: 0, sn: 0, c: 0, m: 0, lvl: 0, box: 0, due: 0, last: 0, days: [], times: [], since3: 0 };
    }

    function median(arr) {
        if (!arr.length) return null;
        const a = arr.slice().sort((x, y) => x - y);
        const mid = a.length >> 1;
        return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
    }

    function dayStamp(t) { return new Date(t).toISOString().slice(0, 10); }

    // ---- recording -------------------------------------------------------
    /*
     * res: {correct, partial, ms, src}
     *
     * Safe to call from anywhere, including the older bespoke modes, which do it
     * behind a `typeof prRecord === 'function'` guard so load order cannot matter.
     */
    function prRecord(nodeId, res) {
        ensure();
        if (!nodeId || !res) return null;

        const rec = progress.nodes[nodeId] || (progress.nodes[nodeId] = blankNode());
        const now = Date.now();
        const score = res.partial === undefined ? (res.correct ? 1 : 0) : Math.max(0, Math.min(1, res.partial));
        const mashed = typeof res.ms === 'number' && res.ms < MASH_MS;

        rec.n += 1;
        if (res.correct) rec.c += 1;
        rec.last = now;

        if (!mashed) {
            // Seed the average from the first *scored* response, not the first
            // response. Using rec.n here would let a discarded mash-speed answer
            // seed the EWMA at zero and drag the average down permanently, which
            // is the opposite of what excluding it was for.
            rec.sn = (rec.sn || 0) + 1;
            rec.m = rec.sn === 1 ? score : (1 - ALPHA) * rec.m + ALPHA * score;
            if (typeof res.ms === 'number' && res.ms > 0) {
                rec.times.push(Math.round(res.ms));
                if (rec.times.length > TIMES_KEPT) rec.times.shift();
            }
        }

        const today = dayStamp(now);
        if (rec.days.indexOf(today) === -1) {
            rec.days.push(today);
            if (rec.days.length > 8) rec.days.shift();
        }

        // Leitner. Wrong drops two boxes rather than one, because a miss on a
        // well-spaced item means the spacing was wrong, not slightly wrong.
        if (res.correct) rec.box = Math.min(BOX_DAYS.length - 1, rec.box + 1);
        else rec.box = Math.max(0, rec.box - 2);
        rec.due = now + BOX_DAYS[rec.box] * DAY;

        relevel(nodeId, rec, now);
        save();
        return rec;
    }

    function relevel(nodeId, rec, now) {
        const node = (window.CUR && CUR.get(nodeId)) || null;
        const target = node && node.automaticity ? node.automaticity.targetMs : null;
        const p50 = median(rec.times);
        const fastEnough = !target || (p50 !== null && p50 <= target);

        // Counted against scored responses: an attempt too fast to have been
        // read is evidence of nothing, and must not move a learner up.
        const sn = rec.sn || 0;
        let lvl = rec.n === 0 ? 0 : 1;
        if (sn >= 3 && rec.m >= 0.5) lvl = 2;

        const proficient = rec.m >= PROFICIENT_M && sn >= PROFICIENT_N
            && rec.days.length >= 2 && fastEnough;
        if (proficient) {
            lvl = 3;
            if (!rec.since3) rec.since3 = now;
            if (rec.since3 && now - rec.since3 >= MASTERED_AFTER_DAYS * DAY && rec.m >= PROFICIENT_M) {
                lvl = 4;
            }
        } else if (rec.lvl >= 3) {
            // Fell back below the bar — drop to 2 and restart the clock rather
            // than keeping a badge the current evidence no longer supports.
            lvl = 2;
            rec.since3 = 0;
        }

        rec.lvl = lvl;
    }

    // ---- queries ---------------------------------------------------------
    function prGet(nodeId) {
        ensure();
        return progress.nodes[nodeId] || blankNode();
    }

    function prLevel(nodeId) { return prGet(nodeId).lvl; }

    /* Why a node is not yet proficient, in the learner's terms. The speed case
     * is the one worth surfacing — otherwise "all correct but still not done"
     * reads as the app being broken. */
    function prBlockedBy(nodeId) {
        ensure();
        const rec = progress.nodes[nodeId];
        if (!rec || rec.lvl >= 3) return null;
        const node = window.CUR && CUR.get(nodeId);
        const target = node && node.automaticity ? node.automaticity.targetMs : null;
        const p50 = median(rec.times);
        const sn = rec.sn || 0;
        if (rec.m >= PROFICIENT_M && sn >= PROFICIENT_N && target && p50 !== null && p50 > target) {
            return { reason: 'speed', p50: p50, target: target };
        }
        if (rec.m >= PROFICIENT_M && sn >= PROFICIENT_N && rec.days.length < 2) {
            return { reason: 'comeBack' };
        }
        if (sn < PROFICIENT_N) return { reason: 'moreItems', have: sn, need: PROFICIENT_N };
        return { reason: 'accuracy', m: rec.m };
    }

    function prDue(now) {
        ensure();
        const t = now || Date.now();
        return Object.keys(progress.nodes)
            .filter((id) => {
                const r = progress.nodes[id];
                return r.n > 0 && r.lvl < 4 && r.due && r.due <= t;
            })
            .sort((a, b) => progress.nodes[a].due - progress.nodes[b].due);
    }

    /*
     * Suggestions, never gates. Every rung stays open — this only answers "what
     * would be a sensible next thing", which is a different question from "what
     * are you allowed to do".
     */
    function prNextUp(limit) {
        ensure();
        if (!window.CUR) return [];
        const out = [];
        const seen = new Set();

        prDue().forEach((id) => {
            if (out.length >= (limit || 6)) return;
            if (CUR.isBuilt(id)) { out.push({ id: id, why: 'review' }); seen.add(id); }
        });

        CUR.strands().forEach((s) => {
            const rung = CUR.ladder(s.strand).find((n) => {
                if (seen.has(n.id) || n.tier !== 1 || !CUR.isBuilt(n.id)) return false;
                if (prLevel(n.id) >= 3) return false;
                return (n.prereq || []).every((p) => prLevel(p) >= 2 || !CUR.isBuilt(p));
            });
            if (rung) { out.push({ id: rung.id, why: 'next' }); seen.add(rung.id); }
        });

        return out.slice(0, limit || 6);
    }

    function prStrandProgress(strand) {
        ensure();
        const rungs = window.CUR ? CUR.ladder(strand) : [];
        const built = rungs.filter((n) => CUR.isBuilt(n.id));
        return {
            total: rungs.length,
            built: built.length,
            started: built.filter((n) => prLevel(n.id) >= 1).length,
            proficient: built.filter((n) => prLevel(n.id) >= 3).length,
        };
    }

    function prSession(entry) {
        ensure();
        progress.sessions.push(Object.assign({ t: Date.now() }, entry));
        while (progress.sessions.length > SESSIONS_KEPT) progress.sessions.shift();
        save();
    }

    // ---- legacy migration -------------------------------------------------
    /*
     * Copies, never moves. The times-tables grid reads ttFact_* live, so the old
     * keys stay exactly where they are.
     *
     * Imported mastery is capped at level 2. Practice history is evidence that a
     * learner has done the work, not that they were assessed on it — letting a
     * long ttFact_ tally grant instant "mastered" would poison the model on the
     * first boot and there would be no way to tell it had happened.
     */
    function prMigrateLegacy() {
        ensure();
        if (stGet('migrated.v1')) return false;

        let facts = 0;
        (typeof stRawKeys === 'function' ? stRawKeys('ttFact_') : []).forEach((k) => {
            const v = parseInt(stRawGet(k, '0'), 10);
            if (v > 0) facts += v;
        });

        if (facts > 0) {
            const id = 'mult.facts';
            const rec = progress.nodes[id] || (progress.nodes[id] = blankNode());
            rec.n = Math.max(rec.n, facts);
            rec.sn = Math.max(rec.sn || 0, facts);
            rec.c = Math.max(rec.c, facts);
            rec.m = Math.min(rec.m || 0.6, 0.6);
            rec.lvl = Math.max(rec.lvl, 2);
            rec.box = Math.max(rec.box, 1);
            rec.due = Date.now();
            rec.days = rec.days.length ? rec.days : [dayStamp(Date.now())];
        }

        // Euclid's Book I does not map onto an elementary geometry ladder, so
        // these are recorded as badges rather than forced onto a node.
        (typeof stRawKeys === 'function' ? stRawKeys('gpDone_') : []).forEach((k) => {
            progress.badges[k.replace('gpDone_', 'proved.')] = Date.now();
        });
        (typeof stRawKeys === 'function' ? stRawKeys('gpBuilt_') : []).forEach((k) => {
            progress.badges[k.replace('gpBuilt_', 'built.')] = Date.now();
        });

        stSet('migrated.v1', '1');
        save();
        return true;
    }

    // ---- backup ----------------------------------------------------------
    // With no server this is the only backup there is, and it doubles as the
    // way to move a learner to another device.
    function prExport() {
        ensure();
        return JSON.stringify({ v: 1, exportedAt: Date.now(), profile: profile, progress: progress }, null, 2);
    }

    function prImport(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (!data || !data.progress || !data.progress.nodes) throw new Error('not a Numberquizzer backup');
        // Drop anything the old writer still had queued: it describes the
        // progress we are about to replace, and flushing it later would undo
        // the restore.
        if (writer && writer.discard) writer.discard();
        progress = data.progress;
        if (data.profile) { profile = data.profile; stSetJSON(PROFILE_KEY, profile); }
        writer = stDebounced(progressKey(profile.active), 500);
        save();
        writer.flush();
        return true;
    }

    function prReset() {
        ensure();
        if (writer && writer.discard) writer.discard();
        progress = { v: 1, updatedAt: Date.now(), nodes: {}, sessions: [], badges: {} };
        save();
        writer.flush();
    }

    // ---- expose ----------------------------------------------------------
    window.prRecord = prRecord;
    window.prGet = prGet;
    window.prLevel = prLevel;
    window.prBlockedBy = prBlockedBy;
    window.prDue = prDue;
    window.prNextUp = prNextUp;
    window.prStrandProgress = prStrandProgress;
    window.prSession = prSession;
    window.prMigrateLegacy = prMigrateLegacy;
    window.prExport = prExport;
    window.prImport = prImport;
    window.prReset = prReset;
    window.prProfile = function () { ensure(); return profile; };
    window.prFlush = function () { if (writer) writer.flush(); };

    window.__PR = {
        raw: function () { ensure(); return progress; },
        median: median,
        constants: { ALPHA, MASH_MS, BOX_DAYS, PROFICIENT_N, PROFICIENT_M, MASTERED_AFTER_DAYS },
    };

    ensure();
    prMigrateLegacy();
})();
