'use strict';
/**
 * Boyfriend Day family — render helpers.
 *
 * Every render.js in the family builds its page with these, so escaping, the
 * share-preview (OG) block, canonical/noindex handling and the preview badge
 * behave identically across the family:
 *
 *   escape(value)            HTML-escape for text AND attribute context
 *   multiline(value)         escape + keep sender newlines as <br>
 *   jsonPayload(id, value)   <script type="application/json" id=…> with `<` neutralised
 *   origin(opts)             'https://paigaam.cc' from opts.baseUrl, or '' (relative is fine)
 *   absolute(opts, path)     origin + site-relative path (for og:image)
 *   head({...})              the shared <head> meta block (title, description, OG, canonical/noindex, icon)
 *   previewBadge(opts)       the little "Preview" chip, only when opts.isPreview
 *
 * Nothing in here knows about a specific template.
 */

const escape = value => String(value == null ? '' : value)
  .replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const multiline = value => escape(value).replace(/\n/g, '<br>');

/**
 * JSON for a <script type="application/json"> block. Only the tag break-out
 * needs neutralising (`<` → <, which JSON.parse turns back into `<`);
 * HTML-escaping the string would corrupt it, because the browser does not
 * decode entities inside script elements. U+2028/2029 are escaped too.
 */
function jsonPayload(id, value) {
  const json = JSON.stringify(value == null ? {} : value)
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<script type="application/json" id="${escape(id)}">${json}</script>`;
}

function origin(opts = {}) {
  try {
    const url = new URL(opts.baseUrl);
    if (['http:', 'https:'].includes(url.protocol)) return url.origin;
  } catch { /* relative is fine */ }
  return '';
}

function absolute(opts, path) {
  const o = origin(opts);
  return o && typeof path === 'string' && path.startsWith('/') ? o + path : '';
}

/**
 * The shared <head> meta block. Place it right after <meta charset> and
 * <meta viewport> in your own <head>; add your own fonts/css/js after it.
 *
 * @param p.paigaam      the paigaam row (only .slug is read)
 * @param p.opts         { baseUrl, isPreview } — as passed to render()
 * @param p.title        page + share title (plain text)
 * @param p.description  share description (plain text)
 * @param p.themeColor   '#RRGGBB'
 * @param p.image        site-relative path of a published photo for og:image, or ''
 */
function head({ paigaam = {}, opts = {}, title, description, themeColor = '#FBF3E4', image = '' }) {
  const preview = !!opts.isPreview;
  const o = origin(opts);
  const canonical = !preview && paigaam && paigaam.slug ? `${o}/p/${encodeURIComponent(paigaam.slug)}` : '';
  const ogImage = image ? absolute(opts, image) : (o ? `${o}/brand/favicon-512.png` : '');
  const color = /^#[0-9a-fA-F]{3,8}$/.test(themeColor) ? themeColor : '#FBF3E4';
  return [
    `<meta name="theme-color" content="${color}">`,
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    preview ? '<meta name="robots" content="noindex, nofollow, noarchive">' : (canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ''),
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Paigaam">',
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(description)}">`,
    canonical ? `<meta property="og:url" content="${escape(canonical)}">` : '',
    ogImage ? `<meta property="og:image" content="${escape(ogImage)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    image && ogImage ? `<meta name="twitter:image" content="${escape(ogImage)}">` : '',
    '<link rel="icon" href="/brand/favicon-512.png" type="image/png">',
  ].filter(Boolean).join('\n');
}

/** Self-styled so no template stylesheet has to know about it. */
function previewBadge(opts = {}) {
  if (!opts.isPreview) return '';
  return '<div class="bf-previewbadge" aria-hidden="true" style="position:fixed;top:12px;right:12px;z-index:9999;'
    + 'padding:5px 12px;border-radius:999px;background:rgba(43,33,24,.72);color:#FFFDF8;'
    + 'font:600 11px/1.4 system-ui,-apple-system,sans-serif;letter-spacing:.14em;text-transform:uppercase;pointer-events:none">Preview</div>';
}

module.exports = { escape, multiline, jsonPayload, origin, absolute, head, previewBadge };
