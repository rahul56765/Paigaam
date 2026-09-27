'use strict';
const { page, esc } = require('../lib/layout');
const { templateCard } = require('./homeCards');
const { OCCASIONS, occasionForCategory } = require('../lib/occasions');

/** Decorative line-art marks for the occasion cards (ivory ink on dark). */
function occArt(slug) {
  const stroke = 'stroke="#E9DCC3" stroke-width="1.4" fill="none" stroke-linecap="round"';
  const art = {
    wedding: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><path d="M42 30 C 42 20, 58 20, 58 30 C 58 20, 74 20, 74 30 C 74 40, 60 48, 58 56 C 56 48, 42 40, 42 30 Z"/><circle cx="38" cy="66" r="10"/><circle cx="82" cy="66" r="10"/><path d="M48 66 L 72 40" opacity="0.6"/></g></svg>`,
    birthday: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><path d="M34 88 L34 60 Q34 52 42 52 L78 52 Q86 52 86 60 L86 88"/><path d="M40 52 L40 40 M50 52 L50 36 M60 52 L60 42 M70 52 L70 36 M80 52 L80 40"/><path d="M40 32 q-3 -4 0 -7 q3 3 0 7 M50 28 q-3 -4 0 -7 q3 3 0 7 M60 34 q-3 -4 0 -7 q3 3 0 7 M70 28 q-3 -4 0 -7 q3 3 0 7 M80 32 q-3 -4 0 -7 q3 3 0 7"/></g></svg>`,
    anniversary: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><circle cx="48" cy="54" r="20"/><circle cx="72" cy="46" r="20"/><path d="M48 78 L48 86 M72 70 L72 78" opacity="0.5"/></g></svg>`,
    proposal: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><path d="M60 78 C 40 62, 30 52, 30 40 C 30 30, 38 24, 46 24 C 52 24, 57 28, 60 34 C 63 28, 68 24, 74 24 C 82 24, 90 30, 90 40 C 90 52, 80 62, 60 78 Z"/><path d="M46 42 L52 48 M74 42 L68 48" opacity="0.5"/></g></svg>`,
    festival: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><path d="M40 30 C 40 22, 80 22, 80 30 L 78 40 L 42 40 Z"/><path d="M44 40 C 44 52, 40 56, 44 64 M76 40 C 76 52, 80 56, 76 64" opacity="0.7"/><path d="M36 70 L84 70 L80 84 L40 84 Z"/><path d="M60 22 L60 14 M52 18 L60 14 L68 18" opacity="0.7"/></g></svg>`,
    baby: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><circle cx="60" cy="42" r="18"/><path d="M52 40 q0 3 3 3 M68 40 q0 3 -3 3 M54 50 q6 5 12 0"/><path d="M38 72 q22 -14 44 0" opacity="0.7"/><circle cx="30" cy="30" r="2.5" opacity="0.6"/><circle cx="92" cy="26" r="2.5" opacity="0.6"/></g></svg>`,
    personal: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><path d="M34 26 h52 a6 6 0 0 1 6 6 v36 a6 6 0 0 1 -6 6 h-30 l-12 10 v-10 h-10 a6 6 0 0 1 -6 -6 v-36 a6 6 0 0 1 6 -6 Z"/><path d="M44 42 h32 M44 52 h22" opacity="0.6"/></g></svg>`,
    gift: `<svg viewBox="0 0 120 100" aria-hidden="true"><g ${stroke}><rect x="32" y="44" width="56" height="40" rx="4"/><path d="M28 32 h64 v12 h-64 Z M60 32 v52"/><path d="M60 32 c-12 0 -16 -12 -8 -14 c6 -1.5 8 8 8 14 c0 -6 2 -15.5 8 -14 c8 2 4 14 -8 14"/></g></svg>`,
  };
  return art[slug] || art.personal;
}

/* Occasion → friendly subtitle. */
const OCC_LINES = {
  wedding: 'For two hearts becoming one.',
  birthday: 'Make their day unforgettable.',
  anniversary: 'For memories worth celebrating.',
  proposal: 'Ask the question, beautifully.',
  festival: 'Share the joy of the season.',
  baby: 'For a beautiful new beginning.',
  personal: 'No occasion needed — just feeling.',
  gift: 'A little something, wrapped as a link.',
};

/** Dark editorial occasion card. */
function occasionCard(o, i, countByOccasion) {
  const count = countByOccasion[o.slug];
  return `<a class="occ-card reveal" style="transition-delay:${Math.min(i, 5) * 70}ms"
     href="/templates/${o.slug}" data-track="occasion_clicked" data-occasion="${esc(o.slug)}">
  <div class="occ-card__art" aria-hidden="true">${occArt(o.slug)}</div>
  <div class="occ-card__label">
    <h3>${esc(o.name)}</h3>
    <p>${esc(OCC_LINES[o.slug] || o.intro)}</p>
    ${count ? `<span class="occ-card__count">${count} design${count === 1 ? '' : 's'}</span>` : ''}
  </div>
</a>`;
}

function home(templates) {
  const featured = templates.slice(0, 6);
  const counts = {};
  for (const t of templates) {
    const occ = occasionForCategory(t.category);
    if (occ) counts[occ.slug] = (counts[occ.slug] || 0) + 1;
  }
  const countByOccasion = {};
  for (const o of OCCASIONS) countByOccasion[o.slug] = counts[o.slug] || 0;

  return page('Make your moments worth remembering — Paigaam', `
<main>
  <!-- HERO: dark editorial, left copy / right device mockup -->
  <section class="hero--dark">
    <div class="wrap hero__grid-wrap" style="display:contents">
      <div class="hero__copy reveal in">
        <span class="hero__eyebrow">Paigaam &middot; Digital experiences, made personal</span>
        <h1>Make your moments<br><em>worth remembering.</em></h1>
        <p class="hero__lede">Beautiful digital invitations, surprises and little messages made for the people who matter. Choose a design, make it theirs, and share it as a link they'll keep.</p>
        <div class="hero__ctas">
          <a class="btn btn--primary" href="/templates" data-track="cta_click" data-label="hero_create">Create your Paigaam &rarr;</a>
          <a class="btn btn--outline" href="/templates" data-track="cta_click" data-label="hero_explore">Explore templates</a>
        </div>
        <div class="hero__micro" aria-hidden="true">
          <span><i>&#10022;</i> Instant link</span>
          <span><i>&#10022;</i> Personalised in minutes</span>
          <span><i>&#10022;</i> Made for WhatsApp</span>
        </div>
      </div>
      <div class="hero__device reveal in" style="transition-delay:150ms" aria-hidden="true">
        <div class="phone">
          <div class="phone__screen">
            <iframe title="Preview of a Paigaam experience" src="/template-view/${esc(featured[0] ? featured[0].slug : 'saalgirah')}" style="width:100%;height:100%;border:0" loading="lazy" scrolling="no" tabindex="-1" sandbox="allow-same-origin allow-scripts"></iframe>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- OCCASIONS: dark, immediate discovery -->
  <section class="section section--dark" id="occasions">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">The occasion</span>
        <h2 class="section__title">Made for every little moment</h2>
        <p class="section__sub">Begin with the moment — we'll show you what fits it.</p>
      </div>
      <div class="occ-grid">
        ${OCCASIONS.map((o, i) => occasionCard(o, i, countByOccasion)).join('')}
      </div>
      <div style="text-align:center;margin-top:46px" class="reveal">
        <a class="btn btn--outline" href="/occasions">All occasions</a>
      </div>
    </div>
  </section>

  <!-- EXPLANATION: ivory, emotional -->
  <section class="statement" id="why">
    <span class="kicker reveal">Not just an invitation</span>
    <blockquote class="reveal">Sometimes, a message deserves more than a text.</blockquote>
    <p class="reveal">A Paigaam is a small, personal page on the web — names, photographs, music and motion, woven around your words. You make it in minutes. They open it like a gift.</p>
  </section>

  <!-- FEATURED: ivory, direct create -->
  <section class="section section--tint" id="featured">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">The collection</span>
        <h2 class="section__title">Made to be remembered</h2>
        <p class="section__sub">Each design is a keepsake — waiting for your names, your date, your words.</p>
      </div>
      <div class="cards cards--6">
        ${featured.map(t => templateCard(t)).join('')}
      </div>
      <div style="text-align:center;margin-top:60px" class="reveal">
        <a class="btn btn--primary" href="/templates" data-track="cta_click" data-label="featured_all">See all Paigaams</a>
      </div>
    </div>
  </section>

  <!-- HOW IT WORKS: three steps -->
  <section class="section" id="how">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">How it works</span>
        <h2 class="section__title">Three gentle steps</h2>
        <p class="section__sub">From choosing to sharing — most people finish in under ten minutes.</p>
      </div>
      <div class="steps">
        <div class="step reveal"><span class="step__no">01</span><h3>Choose your experience</h3><p>Pick a design that feels like the moment — invitation, letter, game or surprise.</p></div>
        <div class="step reveal" style="transition-delay:120ms"><span class="step__no">02</span><h3>Personalise your message</h3><p>Add their name, your words, a photograph. Watch it come alive as you type.</p></div>
        <div class="step reveal" style="transition-delay:240ms"><span class="step__no">03</span><h3>Share your Paigaam</h3><p>Receive your own link and QR. Send it on WhatsApp, when it feels right.</p></div>
      </div>
    </div>
  </section>

  <!-- FINAL CTA: cream -->
  <section class="final-cta">
    <span class="kicker reveal">One more thing</span>
    <h2 class="reveal">Some things are better when they're personal.</h2>
    <p class="reveal">Create something they'll remember.</p>
    <div class="reveal">
      <a class="btn btn--primary" href="/templates" data-track="cta_click" data-label="final_create">Create your Paigaam &rarr;</a>
    </div>
  </section>
</main>`, { current: '/' });
}

module.exports = { home, occasionCard, occArt };
