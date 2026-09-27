'use strict';
/**
 * The immersive Paigaam builder shell — every template's wizard lives in here.
 *
 * NOT a form on a page: a chromeless, full-viewport experience. One screen at
 * a time — the phone preview center-stage, exactly one question beneath it,
 * Next always reachable. Top bar: back-circle, logo mark, progress dots.
 * The final screen is the inline result: "Your Paigaam is ready." with
 * Share on WhatsApp / Copy link / Download QR.
 *
 * The shell owns LOOK only. Each wizard keeps its own engine (steps, drafts,
 * preview-frame calls, publish) — their IDs (#…Form, #back, #next, #liveFrame,
 * #publishedResult, #progress, .step[data-step]) are preserved, so their
 * tested JS binds unchanged. builder-shell.css restyles those shared IDs into
 * the immersive layout; shell.js adds the transitions and dots rendering.
 */
const { head, esc } = require('./layout');

/**
 * @param name    template display name (title)
 * @param inner   the wizard's existing <main>…</main> + dialogs HTML
 * @param opts    { accent, soft, backHref } — accent/soft tint the stage
 */
function builderShell(name, inner, opts = {}) {
  const accent = opts.accent || '#8F1018';
  const soft = opts.soft || '#F7F1E6';
  const backHref = opts.backHref || `/templates`;
  return head(`Make your ${name} Paigaam`, `<link rel="stylesheet" href="/css/builder-shell.css?v=5">
<script src="/js/shell.js?v=4" defer></script>
<style>:root { --shell-accent: ${esc(accent)}; --shell-soft: ${esc(soft)}; }</style>`, { robots: 'noindex, nofollow', themeColor: '#F7F1E6' }) + `
<body class="shell">
<div class="shell__top">
  <a class="shell__back" href="${esc(backHref)}" aria-label="Back to the collection">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
  </a>
  <span class="shell__brand" aria-hidden="true">Paigaam</span>
  <div class="shell__dots" id="shellDots" aria-hidden="true"></div>
</div>
${inner}
</body>
</html>`;
}

module.exports = { builderShell };
