'use strict';
/**
 * Nishaan renderer.
 *
 * Emits the whole milestone server-rendered — the foil numeral, the collage
 * band, the timeline, the portrait and the toast — so it survives a failed
 * script, a screen reader or a share-preview crawler. nishaan.js only adds
 * the motion: the numeral foil draw, scroll reveals and the toast clink.
 *
 * The foil numeral is real text (the age) in Fraunces 900 with the 2048px
 * foil texture masked via background-clip — selectable, screen-reader
 * friendly, retina-clean (Director's ruling).
 *
 * Every piece of sender text is HTML-escaped here; there is no client-side
 * text templating.
 */
const config = require('./config');
const schema = require('./schema');
const { resolve } = require('../../lib/bfday/fields');
const { bgmMarkup, bgmScript } = require('../../lib/bfday/bgm');
const { escape, multiline, head, previewBadge } = require('../../lib/bfday/page');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** YYYY-MM-DD → "12 October 2026", or ''. */
function humanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

/** Collage words: alternating serif-caps (even) / script (odd), sizes cycling. */
function collageBand(words) {
  const sizes = ['clamp(44px,11vw,76px)', 'clamp(30px,7.4vw,52px)', 'clamp(52px,13vw,90px)'];
  return words.map((w, i) =>
    `<span class="ns-word ns-word--${i % 2 === 0 ? 'serif' : 'script'}" style="font-size:${sizes[i % sizes.length]}">${escape(w)}</span>`).join('\n      ');
}

function timelineEntries(entries) {
  return entries.map(e => `
      <li class="ns-tl__row ns-reveal">
        <span class="ns-tl__year">${escape(e.year)}</span>
        <span class="ns-tl__rule" aria-hidden="true"><img src="/assets/nishaan/gold-rule-diamond.png" alt="" draggable="false"></span>
        <span class="ns-tl__line">${escape(e.line)}</span>
      </li>`).join('\n');
}

/**
 * @param paigaam  the paigaam row ({ customer_data, slug, id, … })
 * @param opts     { baseUrl, isPreview }
 */
function render(paigaam = {}, opts = {}) {
  const d = resolve(config, paigaam && paigaam.customer_data, schema);
  const preview = !!opts.isPreview;
  const name = d.recipientName || 'you';
  const date = humanDate(d.eventDate);

  const title = `${d.recipientName ? `${name} turns ${d.age}` : 'Nishaan — the milestone'} · Paigaam`;
  const description = `${d.age ? `${d.age} years` : 'A milestone'} of being a legend — a gold-foil numeral, the years that made them, and a toast. ${d.senderName ? `From ${d.senderName}.` : ''}`;

  // Previews and the demo show the sample portrait; a published page without
  // a portrait falls back to the demo portrait too — never an empty mat.
  const portrait = d.portrait || '/assets/bfday-demo/nishaan-portrait-1.jpg';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
${head({ paigaam, opts, title, description, themeColor: '#FFFDF8', image: d.portrait || config.ogImage })}
<link rel="stylesheet" href="/bfday/bgm.css">
<style>:root { --bgm-accent: #8C2F39; }</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,400;1,9..144,600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/nishaan/nishaan.css?v=1">
<script src="/nishaan/nishaan.js?v=1" defer></script>
<noscript><style>
  .ns-reveal { opacity: 1 !important; transform: none !important; }
</style></noscript>
</head>
<body data-preview="${preview}">
${previewBadge(opts)}

<main class="ns" id="ns">

  <!-- ① the foil numeral -->
  <section class="ns-beat ns-beat--numeral" id="numeral" aria-labelledby="nsNumH">
    <h1 class="ns-numeral ns-reveal" id="nsNumH" aria-label="${escape(String(d.age))} years">${escape(String(d.age))}</h1>
    <p class="ns-numeral__sub ns-reveal">years of ${escape(name)}</p>
    <p class="ns-cue ns-reveal" aria-hidden="true">scroll</p>
  </section>

  <!-- ② the type-collage band -->
  <section class="ns-beat ns-beat--collage" id="collage" aria-labelledby="nsCollageH">
    <h2 class="ns-visuallyhidden" id="nsCollageH">The collage</h2>
    <div class="ns-collage ns-reveal">
${collageBand(d.collageWords)}
    </div>
    ${date ? `<p class="ns-collage__date ns-reveal">${escape(date)}</p>` : ''}
    <img class="ns-rule ns-rule--flourish ns-reveal" src="/assets/nishaan/gold-rule-flourish.png" alt="" aria-hidden="true" draggable="false">
  </section>

  <!-- ③ the timeline -->
  <section class="ns-beat ns-beat--timeline" id="timeline" aria-labelledby="nsTlH">
    <h2 class="ns-tl__h ns-reveal" id="nsTlH">The years that made ${escape(name)}</h2>
    <ol class="ns-tl">
${timelineEntries(d.timeline)}
    </ol>
    <img class="ns-rule ns-rule--diamond ns-rule--wide ns-reveal" src="/assets/nishaan/gold-rule-diamond.png" alt="" aria-hidden="true" draggable="false">
  </section>

  <!-- ④ the portrait in the museum mat -->
  <section class="ns-beat ns-beat--portrait" id="portrait" aria-labelledby="nsPortH">
    <h2 class="ns-visuallyhidden" id="nsPortH">A portrait</h2>
    <figure class="ns-mat ns-reveal">
      <img class="ns-mat__frame" src="/assets/nishaan/emboss-frame.png" alt="" aria-hidden="true" draggable="false">
      <img class="ns-mat__photo" src="${escape(portrait)}" alt="A portrait of ${escape(name)}" loading="lazy" decoding="async">
    </figure>
    ${d.senderName ? `<p class="ns-portrait__credit ns-reveal">with love, ${escape(d.senderName)}</p>` : ''}
  </section>

  <!-- ⑤ the toast -->
  <section class="ns-beat ns-beat--toast" id="toast" aria-labelledby="nsToastH">
    <img class="ns-clink ns-reveal" src="/assets/nishaan/clink.png" alt="Two champagne glasses clinking, illustrated" width="975" height="1390" loading="lazy" decoding="async" draggable="false">
    <h2 class="ns-toast__wish ns-reveal" id="nsToastH">${multiline(d.wishLine)}</h2>
    <p class="ns-toast__sign ns-reveal">— ${escape(d.senderName || 'your favourite person')}</p>
    <p class="ns-foot ns-reveal">Made with love on <a href="/">Paigaam</a></p>
    <button class="ns-replay ns-reveal" id="nsReplayBtn" type="button">Raise a toast again</button>
  </section>

</main>
${bgmMarkup(d.bgmSong || '', 'the toast song')}
${bgmScript(d.bgmSong || '')}
</body>
</html>`;
}

module.exports = { render, humanDate };
