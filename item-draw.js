/*
 * Item display blocks and the DRAW table.  Prefix: idr
 *
 * An item's `prompt` is a list of display blocks rather than an HTML string, so
 * the same authored item can be rendered on screen, spoken by TTS, and printed
 * through the existing jsPDF worksheet engine without a second authoring pass.
 *
 *   {t:'text',  s}                prose
 *   {t:'expr',  s}                a big maths expression
 *   {t:'tokens', items:[{text,kind}]}  a tappable run of words or letters
 *   {t:'svg',   draw, args}       a diagram, dispatched through DRAW
 *   {t:'blank', slot}             an inline cloze gap
 *   {t:'image', src, alt, credit}
 *
 * DRAW entries are deliberately thin adapters over renderers that already exist
 * in app.js. The fraction bar and pie a learner sees here are the same ones the
 * Fractions tab draws — reimplementing them would guarantee the two drift apart.
 */
(function () {
    'use strict';

    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---- DRAW -----------------------------------------------------------
    const DRAW = {
        // Adapters over app.js. Guarded so a missing dependency degrades to a
        // readable note rather than throwing inside the runner.
        'fraction-bar': function (a) {
            if (typeof frRenderBar !== 'function') return '';
            return frRenderBar(a.num, a.den);
        },
        'fraction-pie': function (a) {
            if (typeof frRenderPie !== 'function') return '';
            return frRenderPie(a.num, a.den);
        },

        /* A number line with labelled endpoints and optional interior ticks.
         * `mark` places a fixed dot; the interactive placement version is the
         * `numberline` item type, which builds on this. */
        'number-line': function (a) {
            const lo = a.lo === undefined ? 0 : a.lo;
            const hi = a.hi === undefined ? 1 : a.hi;
            const W = 460, H = 84, PAD = 30;
            const span = hi - lo || 1;
            const x = (v) => PAD + ((v - lo) / span) * (W - 2 * PAD);
            const y = 46;

            let ticks = '';
            const n = a.ticks || 0;
            for (let i = 0; i <= n; i++) {
                const v = lo + (i / n) * span;
                const tx = x(v);
                const major = (i === 0 || i === n);
                ticks += `<line x1="${tx.toFixed(1)}" y1="${y - (major ? 14 : 8)}" x2="${tx.toFixed(1)}" y2="${y + (major ? 14 : 8)}" stroke="#333" stroke-width="${major ? 3 : 2}"/>`;
                if (major || a.labelAll) {
                    const label = a.labels && a.labels[i] !== undefined ? a.labels[i] : String(v);
                    ticks += `<text x="${tx.toFixed(1)}" y="${y + 34}" text-anchor="middle" font-size="17" fill="#333">${esc(label)}</text>`;
                }
            }

            let mark = '';
            if (a.mark !== undefined && a.mark !== null) {
                mark = `<circle cx="${x(a.mark).toFixed(1)}" cy="${y}" r="9" fill="#c62828"/>`;
            }

            return `<svg viewBox="0 0 ${W} ${H}" class="idr-svg idr-numberline" xmlns="http://www.w3.org/2000/svg">`
                + `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#333" stroke-width="3"/>`
                + ticks + mark + '</svg>';
        },

        /* Loose dots at generator-supplied positions. Placement is decided by the
         * generator's seeded rng and passed in, so the same item always draws the
         * same picture — counting a *scattered* set is a harder and different
         * skill from counting a row, and it has to be reproducible to be fair. */
        'dots': function (a) {
            const pts = a.points || [];
            const r = a.r || 13;
            const fill = a.fill || '#1565c0';
            return '<svg viewBox="0 0 300 200" class="idr-svg" xmlns="http://www.w3.org/2000/svg">'
                + pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${fill}"/>`).join('')
                + '</svg>';
        },

        /* Two groups side by side, for more/fewer/same comparisons. */
        'two-sets': function (a) {
            const draw = (pts, dx, colour) => pts.map((p) =>
                `<circle cx="${p[0] + dx}" cy="${p[1]}" r="12" fill="${colour}"/>`).join('');
            return '<svg viewBox="0 0 320 170" class="idr-svg" xmlns="http://www.w3.org/2000/svg">'
                + '<rect x="2" y="2" width="152" height="166" fill="none" stroke="#ccc" stroke-width="2" rx="8"/>'
                + '<rect x="166" y="2" width="152" height="166" fill="none" stroke="#ccc" stroke-width="2" rx="8"/>'
                + draw(a.left || [], 0, '#1565c0')
                + draw(a.right || [], 164, '#ef6c00')
                + '</svg>';
        },

        /* A rows x cols dot array — the picture behind equal groups, and the one
         * that makes commutativity visible by turning the same array sideways. */
        'array': function (a) {
            const rows = a.rows || 1, cols = a.cols || 1;
            const S = 26, R = 8, PAD = 10;
            let dots = '';
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    dots += `<circle cx="${PAD + c * S + S / 2}" cy="${PAD + r * S + S / 2}" r="${R}" fill="#1565c0"/>`;
                }
            }
            return `<svg viewBox="0 0 ${cols * S + PAD * 2} ${rows * S + PAD * 2}" class="idr-svg" xmlns="http://www.w3.org/2000/svg">${dots}</svg>`;
        },
    };

    // ---- prompt rendering -----------------------------------------------
    function renderBlock(b) {
        switch (b.t) {
            case 'text':
                return `<p class="idr-text">${esc(b.s)}</p>`;

            case 'expr':
                return `<div class="idr-expr">${esc(b.s)}</div>`;

            case 'tokens':
                return '<p class="idr-tokens">' + (b.items || []).map((tok, i) =>
                    `<span class="idr-token" data-token="${i}" data-kind="${esc(tok.kind || '')}">${esc(tok.text)}</span>`
                ).join(' ') + '</p>';

            case 'svg': {
                const fn = DRAW[b.draw];
                if (!fn) {
                    console.warn('item-draw: no DRAW entry for "' + b.draw + '"');
                    return '';
                }
                return `<div class="idr-figure">${fn(b.args || {})}</div>`;
            }

            case 'blank':
                return `<span class="idr-blank" data-slot="${b.slot || 0}"></span>`;

            case 'image':
                return `<figure class="idr-image"><img src="${esc(b.src)}" alt="${esc(b.alt || '')}"${b.credit ? ` title="${esc(b.credit)}"` : ''}></figure>`;

            default:
                console.warn('item-draw: unknown block type "' + b.t + '"');
                return '';
        }
    }

    window.idrRenderPrompt = function (blocks) {
        return (blocks || []).map(renderBlock).join('');
    };

    /* Plain-text rendering of the same blocks, for TTS and for the printed
     * worksheet. An item's `stem` is authoritative when present — a generator
     * that says how to speak a question knows better than we can infer. */
    window.idrSpeakable = function (item) {
        if (item.stem) return item.stem;
        return (item.prompt || [])
            .filter((b) => b.t === 'text' || b.t === 'expr')
            .map((b) => b.s)
            .join('. ');
    };

    window.idrDraw = DRAW;
    window.idrEscape = esc;
})();
