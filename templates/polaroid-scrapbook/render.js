'use strict';
/**
 * Tasveer (Our Little Scrapbook) renderer.
 *
 * Emits the complete page server-rendered: titles, all polaroid captions and
 * dates, the note card — so it survives a failed script, a screen reader and
 * share-preview crawlers. polaroid.js only fills the photo areas (with
 * uploaded images or inline-SVG placeholders), drives the scroll reveals,
 * animates the heart doodle and runs the lightbox.
 *
 * Markup and class names are the original design's, unchanged. Every piece of
 * sender text is HTML-escaped here; there is no client-side text templating.
 *
 * Tilt pattern alternates: -4° / 3° / -4° / 3° …
 * Washi-tape tints cycle: (tl/tr) a/b → c/a → b/c → repeat
 * Margin-top: 56 / 96 / 110 / 120 / 130 px, then 130 px for extras.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve, DEMO_ASSET_URL } = require('../../lib/bfday/fields');
const { escape, jsonPayload, head, previewBadge } = require('../../lib/bfday/page');

const TILTS   = [-4, 3, -4, 3, -4, 3, -4, 3];
const MARGINS = [56, 96, 110, 120, 130, 130, 130, 130];
const TL      = ['tint-a', 'tint-c', 'tint-b'];
const TR      = ['tint-b', 'tint-a', 'tint-c'];

function renderPolaroid(photo, idx) {
  const tilt   = TILTS[idx]   !== undefined ? TILTS[idx]   : TILTS[(idx % TILTS.length)];
  const margin = MARGINS[idx] !== undefined ? MARGINS[idx] : 130;
  const tl = TL[idx % 3];
  const tr = TR[idx % 3];
  // Server-render the caption as aria-label text; the photo-area is filled by JS
  // for uploads (it draws the placeholder art). Shipped demo photos paint here.
  const labelText = photo.caption ? `Open photo: ${photo.caption}` : `Open photo ${idx + 1}`;
  const imgMarkup = photo.photo && DEMO_ASSET_URL.test(photo.photo)
    ? `<img src="${escape(photo.photo)}" alt="${escape(photo.caption || '')}" loading="lazy">`
    : '';
  const dateMarkup = photo.date
    ? `<span class="date">${escape(photo.date)}</span>`
    : '<span class="date"></span>';
  return `
    <div class="polaroid reveal" style="--tilt:${tilt}deg; margin-top:${margin}px" data-photo="${idx}" tabindex="0" role="button" aria-label="${escape(labelText)}">
      <span class="tape tl ${tl}" aria-hidden="true"></span>
      <span class="tape tr ${tr}" aria-hidden="true"></span>
      <div class="photo-area">${imgMarkup}</div>
      <p class="caption">${escape(photo.caption || '')}</p>
      ${dateMarkup}
    </div>`;
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;

  const title = 'Our Little Scrapbook · Paigaam';
  const description = d.senderName
    ? `${d.senderName} made you a scrapbook — scroll through it.`
    : 'A scrapbook, made just for you.';

  // OG image: first polaroid that has an uploaded photo.
  const ogPhoto = (d.photos.find(p => p.photo) || {}).photo || '';

  // Payload for the client script: photo src (upload or '') + caption + date.
  const photosPayload = d.photos.map(p => ({
    src:     DEMO_ASSET_URL.test(p.photo || '') ? '' : (p.photo || ''),
    caption: p.caption || '',
    date:    p.date || '',
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FFFDF8', image: ogPhoto })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/polaroid-scrapbook/polaroid.css">
<script src="/polaroid-scrapbook/polaroid.js" defer></script>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}
${jsonPayload('psPayload', { photos: photosPayload })}

  <div class="col">

    <header>
      <h1>${escape(d.scrapbookTitle)}</h1>
      <p class="sub">${escape(d.scrapbookSub)}</p>
      <div class="washi-divider" aria-hidden="true"></div>
    </header>

    <!-- Doodle heart: draws itself with scroll between polaroids 2 and 3 -->
    <div class="doodle-wrap" aria-hidden="true">
      <svg id="doodleHeart" width="72" height="66" viewBox="0 0 72 66">
        <path id="doodleHeartPath" class="doodle-path"
          d="M36 58 C 20 46, 6 34, 6 21 C 6 11, 14 5, 22 5 C 29 5, 34 10, 36 15 C 38 10, 43 5, 50 5 C 58 5, 66 11, 66 21 C 66 34, 52 46, 36 58 Z" />
      </svg>
    </div>

    <!-- Polaroids -->
${d.photos.map((photo, idx) => renderPolaroid(photo, idx)).join('\n')}

    <!-- Footer note card -->
    <div class="note-card reveal" style="--tilt:3deg">
      <span class="tape tl tint-b" aria-hidden="true"></span>
      <span class="tape tr tint-c" aria-hidden="true"></span>
      <p class="note-text">${escape(d.noteText)}</p>
      <svg class="heart-doodle" viewBox="0 0 30 27" aria-hidden="true">
        <path d="M15 25 C 8 19, 2 14, 2 8.5 C 2 4.5, 5 2, 8.5 2 C 11.5 2, 14 4, 15 6.5 C 16 4, 18.5 2, 21.5 2 C 25 2, 28 4.5, 28 8.5 C 28 14, 22 19, 15 25 Z"
          fill="none" stroke="#D98A80" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="date">${escape(d.noteDate)}</span>
    </div>

    <footer>made with love · <a href="/">Paigaam</a></footer>
  </div>

  <!-- Lightbox -->
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Photo enlarged">
    <div class="lightbox-frame">
      <button class="lightbox-close" id="lightboxClose" aria-label="Close photo">&#x2715;</button>
      <div class="photo-area" id="lightboxPhoto"></div>
      <p class="caption" id="lightboxCaption"></p>
      <span class="date" id="lightboxDate"></span>
    </div>
  </div>

</body>
</html>`;
}

module.exports = { render };
