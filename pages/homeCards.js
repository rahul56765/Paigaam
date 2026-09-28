'use strict';
/**
 * Shared template card components.
 * Extracted from pages/home.js so every listing surface (home, /templates,
 * occasion pages) renders identical cards: live thumbnail, badges, price and
 * a direct Create action.
 */
const { esc } = require('../lib/layout');
const { doveSVG } = require('../lib/logo');
const { occasionForCategory } = require('../lib/occasions');
const { priceInfo } = require('../templates/registry');

function motifSVG(motif, color) {
  if (motif === 'dove') return doveSVG(color, 'width="100%"');
  if (motif === 'flame') return `<svg viewBox="0 0 60 80" fill="none" style="width:100%"><path d="M30 8 C 38 24, 48 32, 48 50 A 18 18 0 0 1 12 50 C 12 32, 22 24, 30 8 Z" stroke="${color}" stroke-width="1.6" fill="none"/><path d="M30 34 C 34 42, 38 45, 38 54 A 8 8 0 0 1 22 54 C 22 45, 26 42, 30 34 Z" fill="${color}" opacity="0.35"/></svg>`;
  if (motif === 'ring') return `<svg viewBox="0 0 80 80" fill="none" style="width:100%"><circle cx="34" cy="44" r="20" stroke="${color}" stroke-width="1.6" fill="none"/><circle cx="48" cy="36" r="20" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.45"/></svg>`;
  return '';
}

/**
 * The one true template card.
 * t: template row (slug, name, category, price, config…)
 * opts: { createHref (default /create/<slug>), previewHref (default /templates/<slug>) }
 */
function templateCard(t, opts = {}) {
  const cfg = t.config || {};
  const theme = cfg.theme || {};
  const accent = theme.accent || '#8F1018';
  const custom = cfg.custom || t.custom;
  const createHref = opts.createHref || `/create/${esc(t.slug)}`;
  const previewHref = opts.previewHref || `/templates/${esc(t.slug)}`;
  const free = Number(t.price) === 0;
  const pinfo = priceInfo(t);
  // Search haystack: name, category, description, tags + occasion aliases.
  const occ = occasionForCategory(t.category);
  const haystack = [t.name, t.category, t.description, (t.tags || []).join(' '), occ ? occ.aliases.join(' ') : ''].join(' ');
  // Live thumbnail: the template itself, in miniature. Falls back to static art if JS is off.
  const frameSrc = custom ? (cfg.appPath || t.appPath || '/') : `/template-view/${esc(t.slug)}`;
  // Quick-preview payload: rendered into the modal on tap (no navigation).
  const qp = JSON.stringify({
    slug: t.slug, name: t.name, desc: t.description || '', price: free ? 'FREE' : `\u20B9${t.price}`,
    frame: frameSrc, detail: previewHref, create: createHref, free,
  }).replace(/</g, '\\u003c');
  return `<article class="tcard reveal" data-occasion="${esc(String(t.category).toLowerCase())}" data-price="${esc(Number(t.price))}" data-search="${esc(haystack)}" data-slug="${esc(t.slug)}">
  <a class="tcard__frame${custom ? ' tcard__frame--custom' : ''}" style="background:${esc(theme.bg || '#F4EADD')}" href="${previewHref}" aria-label="See the ${esc(t.name)} Paigaam">
    <iframe class="tcard__live" src="${esc(frameSrc)}" title="Preview of the ${esc(t.name)} Paigaam" loading="lazy" scrolling="no" tabindex="-1" aria-hidden="true" sandbox="allow-same-origin allow-scripts"></iframe>
    <span class="tcard__fallback"${custom ? ' style="display:none"' : ''} aria-hidden="true">${motifSVG(theme.motif, accent)}</span>
    <span class="tcard__name" style="color:${esc(accent)}">${esc(t.name.toUpperCase())}</span>
    <span class="tcard__cat">${esc(t.category)}</span>
    <span class="tcard__badges">
      ${free ? '<span class="pill pill--free">Free</span>' : ''}
      ${t.isNew ? '<span class="pill pill--gold">New</span>' : ''}
    </span>
    <button type="button" class="tcard__quick" data-quick="${esc(t.slug)}" data-qp="${esc(qp)}" aria-label="Quick preview of the ${esc(t.name)} Paigaam" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>
    </button>
  </a>
  <div class="tcard__meta">
    <span class="tcard__title">${esc(t.name)}</span>
    ${free ? '<span class="tcard__price tcard__price--free">FREE</span>' : `<span class="tcard__price">${pinfo.list ? `<s>\u20B9${pinfo.list}</s>` : ''}\u20B9${pinfo.sale}</span>`}
  </div>
  <p class="tcard__desc">${esc(t.description || '')}</p>
  <span class="tcard__occ-label">${esc(t.category)}</span>
  <div class="tcard__actions">
    <a class="tcard__create" href="${createHref}" data-track="template_create_clicked" data-template="${esc(t.slug)}" data-occasion="${esc(String(t.category).toLowerCase())}">Create</a>
    <a class="tcard__preview-link" href="${previewHref}" data-track="template_viewed" data-template="${esc(t.slug)}">Preview</a>
  </div>
</article>`;
}

module.exports = { templateCard, motifSVG };
