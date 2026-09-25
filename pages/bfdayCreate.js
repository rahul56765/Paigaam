'use strict';
/**
 * The Boyfriend Day family generator — one wizard for every member, built
 * from the template's config (fields + steps + create copy).
 *
 * Same shape and UX as the Maafi generator: an intro step, the template's own
 * steps, a review step, then publish → link + QR (+ the downloadable QR card,
 * which /js/qr-card.js wires by itself). A live preview pane follows every
 * keystroke (debounced; rendered statelessly by POST /<slug>/preview-frame).
 *
 * Scalar fields are rendered here (labels escaped); list rows and photo
 * pickers are built by /bfday/create.js from the same spec, which is embedded
 * as JSON. Behaviour lives in /bfday/create.js, styling in /bfday/create.css.
 */
const { logoFull } = require('../lib/brand');
const { escape, jsonPayload } = require('../lib/bfday/page');

/** Relative luminance of a #rrggbb hex colour (0 = black, 1 = white). */
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/**
 * Dark-theme wizard override. The shared create.css assumes a light page with
 * dark ink: body text is --ink, muted text is color-mix(--ink 62%) and the
 * paper card is --paper cream. A dark theme (Naghma: ink #FFFDF8 on bg
 * #1D1B2E) therefore paints cream text on the cream card and --ink-tinted
 * surfaces (photo wells, list rows, error boxes) in dark ink.
 *
 * Fix: keep the page's dark shell, but re-scope --ink to a dark value on the
 * paper card and the preview dialog so every derived text/surface colour
 * inside them resolves correctly, and brighten --accent-ondark for the labels
 * that sit directly on the dark page background.
 */
function darkThemeOverride(theme) {
  if (luminance(theme.ink) <= 0.5) return '';
  const paperInk = theme.paperInk     || '#2B2118';
  const onDark   = theme.accentOnDark || theme.ink;
  const esc = escape;
  return `
.paper, dialog#previewDialog {
  --ink: ${esc(paperInk)};
  --muted: color-mix(in srgb, ${esc(paperInk)} 62%, transparent);
  --line: color-mix(in srgb, ${esc(paperInk)} 13%, transparent);
  color: ${esc(paperInk)};
}
:root { --accent-ondark: ${esc(onDark)}; }
.intro .eyebrow, .journey .eyebrow, .journey li.is-current, .journey li .step-number, .livepane .eyebrow, footer { color: var(--accent-ondark); }
/* secondary buttons mix --soft (a dark surface here) into their fill — force it light */
.paper .button.secondary, dialog#previewDialog .button.secondary { background: #fff; }`;
}

function reqMark(f) {
  return f.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">optional</span>';
}

function scalarField(f) {
  const id = 'f-' + f.id;
  const common = `id="${id}" name="${escape(f.id)}" data-field="${escape(f.id)}"${f.required ? ' required aria-required="true"' : ''}${f.hint ? ` aria-describedby="${id}-hint"` : ''}`;
  const ph = f.placeholder ? ` placeholder="${escape(f.placeholder)}"` : '';
  let control;
  if (f.type === 'text' || f.type === 'bgm') control = `<input type="text" ${common} maxlength="${f.maxLength}"${ph} autocomplete="off">`;
  else if (f.type === 'url') control = `<input type="url" ${common} maxlength="${f.maxLength}"${ph} inputmode="url" autocomplete="off">`;
  else if (f.type === 'date') control = `<input type="date" ${common} min="1900-01-01" max="2200-12-31">`;
  else if (f.type === 'number') control = `<input type="number" ${common} min="${f.min}" max="${f.max}" step="1" inputmode="numeric"${ph}>`;
  else if (f.type === 'textarea') control = `<textarea ${common} maxlength="${f.maxLength}" rows="${f.rows}"${ph}></textarea>`;
  else if (f.type === 'select') {
    control = `<select ${common}>${f.default === undefined ? '<option value="">Choose…</option>' : ''}${f.options.map(o => `<option value="${escape(o.value)}"${o.value === f.default ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>`;
  } else {
    return '';
  }
  return `<div class="field" data-type="${f.type}">
  <label for="${id}">${escape(f.label)}${reqMark(f)}</label>
  ${control}
  ${f.maxLength && f.type !== 'number' ? `<p class="count" data-count-for="${id}" aria-hidden="true"></p>` : ''}
  ${f.hint ? `<p class="hint" id="${id}-hint">${escape(f.hint)}</p>` : ''}
</div>`;
}

/** The shared background-song field: "no song" toggle + the link/id input. */
function bgmFieldHTML(f) {
  const base = scalarField(f);
  return `<div class="field field--bgm" data-type="bgm">
  <label class="bgm-none"><input type="checkbox" id="f-bgmSong-none" data-bgm-none> <span>no song — keep it quiet</span></label>
</div>
${base}`;
}

function fieldHTML(f) {
  if (f.type === 'image') {
    return `<div class="field field--image" data-type="image">
  <span class="label">${escape(f.label)}${reqMark(f)}</span>
  <div class="bf-photo" data-image="${escape(f.id)}"></div>
  ${f.hint ? `<p class="hint">${escape(f.hint)}</p>` : ''}
</div>`;
  }
  if (f.type === 'list') {
    return `<div class="field field--list" data-type="list">
  <span class="label">${escape(f.label)} <span class="opt">${f.minItems > 1 ? `${f.minItems}–${f.maxItems}` : `up to ${f.maxItems}`}</span></span>
  ${f.hint ? `<p class="hint">${escape(f.hint)}</p>` : ''}
  <div class="bf-list" data-list="${escape(f.id)}"></div>
  <button type="button" class="button secondary bf-add" data-add="${escape(f.id)}">${escape(f.addLabel)}</button>
</div>`;
  }
  return f.id === 'bgmSong' ? bgmFieldHTML(f) : scalarField(f);
}

/** @param t a family entry: { slug, config, fields } */
function bfdayCreatePage(t) {
  const c = t.config, create = c.create || {};
  const byId = new Map(t.fields.map(f => [f.id, f]));
  const steps = [
    { title: create.designTitle || 'The design' },
    ...c.steps.map(s => ({ title: s.title })),
    { title: 'Look it over' },
    { title: 'Send it' },
  ];
  const lastFormStep = steps.length - 2; // review
  const theme = c.theme;
  const spec = {
    slug: t.slug,
    name: c.name,
    fields: t.fields,
    lastStep: lastFormStep,
    stepFields: [[], ...c.steps.map(s => s.fields), []],
    noun: create.noun || 'Paigaam',
  };
  const S = escape(t.slug);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${escape(theme.bg)}">
<title>${escape(c.name)} · Make a Paigaam</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/bfday/create.css">
<style>:root { --bg: ${escape(theme.bg)}; --ink: ${escape(theme.ink)}; --accent: ${escape(theme.accent)}; --soft: ${escape(theme.soft)}; }${darkThemeOverride(theme)}</style>
<script src="/bfday/create.js" defer></script>
<script src="/js/qr-card.js" defer></script>
</head>
<body data-slug="${S}">
${jsonPayload('bfSpec', spec)}
<header class="masthead"><a href="/" aria-label="Paigaam">${logoFull(128)}</a><a class="text-link" href="/templates">All templates</a></header>

<main id="wizard">
  <section class="intro">
    <p class="eyebrow">${escape(create.eyebrow || c.name)}</p>
    <h1>${escape(create.headline)}</h1>
    <p class="intro-copy">${escape(create.intro)}</p>
  </section>

  <div class="workspace">
    <aside class="journey">
      <p class="eyebrow">Your ${escape(spec.noun)}</p>
      <ol id="progress" aria-label="Progress">
        ${steps.map((s, i) => `<li data-progress="${i}"><span class="step-number">0${i + 1}</span><span>${escape(s.title)}</span></li>`).join('')}
      </ol>
      <p class="aside-note">Nothing is public until you press send. The preview follows your typing — no saving needed.</p>
    </aside>

    <div class="paper">
      <p id="stepCounter" class="eyebrow"></p>
      <form id="bfForm" novalidate>

        <section data-step="0" class="step">
          <h2 tabindex="-1">${escape(create.designHeading || 'How it plays')}</h2>
          ${create.designIntro ? `<p>${escape(create.designIntro)}</p>` : ''}
          ${Array.isArray(create.scenes) && create.scenes.length ? `<ul class="scene-list">
            ${create.scenes.map((s, i) => `<li><b>${['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][i] || i + 1} ·</b> ${escape(s)}</li>`).join('\n            ')}
          </ul>` : ''}
          <p class="hint">Every line is already written — change as much or as little as you like.</p>
          <a class="button secondary" href="/${S}/demo" target="_blank" rel="noopener">Try the demo <span aria-hidden="true">↗</span></a>
        </section>

        ${c.steps.map((s, i) => `<section data-step="${i + 1}" class="step" hidden>
          <h2 tabindex="-1">${escape(s.heading || s.title)}</h2>
          ${s.intro ? `<p>${escape(s.intro)}</p>` : ''}
          ${s.fields.map(id => fieldHTML(byId.get(id))).join('\n          ')}
        </section>`).join('\n\n        ')}

        <section data-step="${lastFormStep}" class="step" hidden>
          <h2 tabindex="-1">Ready to send</h2>
          <p>Have one last look, then publish. You will get a link and a QR card you can send anywhere.</p>
          <div id="review" class="review"></div>
          <div class="preview-callout">
            <span aria-hidden="true">✦</span>
            <p>${escape(create.previewCta || 'See it exactly as they will.')}</p>
            <button type="button" id="savePreview" class="button primary">Save &amp; preview</button>
          </div>
          <p id="previewState" class="hint" aria-live="polite"></p>
          <button type="button" id="publish" class="button publish" disabled>Publish this Paigaam</button>
          <p class="hint">Free. The link stays live; only you can edit it before publishing.</p>
        </section>

        <div id="formError" class="error" role="alert" hidden></div>
        <p id="status" class="status" role="status" aria-live="polite"></p>
        <nav class="step-nav">
          <button type="button" id="back" class="button text-button">Back</button>
          <button type="submit" id="next" class="button primary">Continue</button>
        </nav>
      </form>
    </div>

    <aside class="livepane" aria-label="Live preview">
      <p class="eyebrow">Live preview</p>
      <div class="livepane__frame"><iframe id="liveFrame" title="${escape(c.name)} live preview"></iframe></div>
      <p class="aside-note">Updates as you type — exactly as they will see it.</p>
    </aside>
  </div>
</main>

<section id="publishedResult" class="result paper" hidden aria-labelledby="resultTitle">
  <p class="eyebrow">It’s live</p>
  <h1 id="resultTitle" tabindex="-1">Your Paigaam is ready.</h1>
  <p>${escape(create.resultLine || 'Send them the link. It opens exactly as you previewed it.')}</p>
  <label for="publishedUrl">Your link</label>
  <input id="publishedUrl" readonly>
  <div class="result-actions">
    <a id="openPublished" class="button primary" target="_blank" rel="noopener">Open it</a>
    <button type="button" id="copyLink" class="button secondary">Copy link</button>
    <a id="whatsapp" class="button secondary" target="_blank" rel="noopener">Send on WhatsApp</a>
  </div>
  <figure class="qr"><img id="qrImage" alt="QR code for your Paigaam" width="220" height="220"><figcaption>Or let them scan it.</figcaption></figure>
  <p id="shareStatus" role="status" aria-live="polite"></p>
</section>

<footer><span>Paigaam · because some things deserve more</span></footer>

<dialog id="previewDialog" aria-labelledby="previewDialogTitle">
  <div class="preview-toolbar">
    <h2 id="previewDialogTitle">Your ${escape(spec.noun)}</h2>
    <div>
      <button type="button" id="fullscreen" class="button secondary">Open in a tab</button>
      <button type="button" id="closePreview" class="button primary">Close</button>
    </div>
  </div>
  <p class="preview-help">${escape(create.previewHelp || 'Play it through once — exactly as they will.')}</p>
  <div id="frameHost"></div>
</dialog>

<noscript><p class="error">Please enable JavaScript to build your Paigaam.</p></noscript>
</body>
</html>`;
}

module.exports = { bfdayCreatePage };
