'use strict';
const { page, esc } = require('../lib/layout');
const { doveSVG } = require('../lib/logo');
const { logoFull } = require('../lib/brand');
const { qrSVG } = require('../lib/qrcode');

const OCCASIONS = [
  ['Wedding', 'For two hearts becoming one.'],
  ['Birthday', 'Make their day a little more unforgettable.'],
  ['Anniversary', 'For memories worth celebrating.'],
  ['Baby', 'For a beautiful new beginning.'],
  ['Festival', 'Share the joy.'],
  ['Personal', 'Because some Paigaams need no occasion.'],
];

function motifSVG(motif, color) {
  if (motif === 'dove') return doveSVG(color, 'width="100%"');
  if (motif === 'flame') return `<svg viewBox="0 0 60 80" fill="none" style="width:100%"><path d="M30 8 C 38 24, 48 32, 48 50 A 18 18 0 0 1 12 50 C 12 32, 22 24, 30 8 Z" stroke="${color}" stroke-width="1.6" fill="none"/><path d="M30 34 C 34 42, 38 45, 38 54 A 8 8 0 0 1 22 54 C 22 45, 26 42, 30 34 Z" fill="${color}" opacity="0.35"/></svg>`;
  if (motif === 'ring') return `<svg viewBox="0 0 80 80" fill="none" style="width:100%"><circle cx="34" cy="44" r="20" stroke="${color}" stroke-width="1.6" fill="none"/><circle cx="48" cy="36" r="20" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.45"/></svg>`;
  return '';
}

function templateCard(t) {
  const cfg = t.config || {};
  const theme = cfg.theme || {};
  const accent = theme.accent || '#8F1018';
  return `<a class="tcard reveal" href="/templates/${esc(t.slug)}" aria-label="View the ${esc(t.name)} Paigaam">
  <div class="tcard__frame" style="background:${esc(theme.bg || '#F4EADD')}">
    <div class="tcard__art">
      <span class="tcard__motif">${motifSVG(theme.motif, accent)}</span>
      <span class="tcard__name" style="color:${esc(accent)}">${esc(t.name.toUpperCase())}</span>
      <span class="tcard__cat">${esc(t.category)}</span>
    </div>
  </div>
  <div class="tcard__meta">
    <span class="tcard__title">${esc(t.name)}</span>
    <span class="tcard__price">₹${esc(t.price)}</span>
  </div>
  <div style="padding:6px 4px 0"><span class="tcard__view">View Paigaam</span></div>
</a>`;
}

function home(templates) {
  const featured = templates.slice(0, 3);
  return page('Beautiful greetings, made personal', `
<main>
  <section class="hero">
    <div class="hero__logo reveal in">${logoFull(340, 'Paigaam')}</div>
    <p class="hero__tag">Beautiful greetings,<br>made personal.</p>
    <p class="hero__sub">Create a beautiful digital Paigaam for the people and moments that matter.</p>
    <div class="hero__ctas">
      <a class="btn btn--primary" href="/templates">Explore Paigaams</a>
      <a class="btn" href="#how">How it works</a>
    </div>
    <div class="hero__rule" aria-hidden="true"></div>
  </section>

  <section class="section section--tint" id="occasions">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">The occasion</span>
        <h2 class="section__title">Choose your occasion</h2>
        <p class="section__sub">Every moment carries its own feeling. Begin there.</p>
      </div>
      <div class="occasions">
        ${OCCASIONS.map(([name, line], i) => `
        <a class="occasion reveal" style="transition-delay:${i * 70}ms" href="/templates?occasion=${encodeURIComponent(name.toLowerCase())}">
          <span class="occasion__num">${String(i + 1).padStart(2, '0')}</span>
          <h3>${name}</h3>
          <p>${line}</p>
        </a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">The collection</span>
        <h2 class="section__title">Featured Paigaams</h2>
        <p class="section__sub">Each design is a keepsake — waiting for your names, your date, your words.</p>
      </div>
      <div class="cards">
        ${featured.map(templateCard).join('')}
      </div>
      <div style="text-align:center;margin-top:64px" class="reveal">
        <a class="btn" href="/templates">See all Paigaams</a>
      </div>
    </div>
  </section>

  <section class="section section--tint" id="how">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">How it works</span>
        <h2 class="section__title">Three gentle steps</h2>
      </div>
      <div class="steps">
        <div class="step reveal"><span class="step__no">01</span><h3>Choose</h3><p>Choose a design that feels like you.</p></div>
        <div class="step reveal" style="transition-delay:120ms"><span class="step__no">02</span><h3>Personalize</h3><p>Add your names, dates, message and details.</p></div>
        <div class="step reveal" style="transition-delay:240ms"><span class="step__no">03</span><h3>Share</h3><p>Receive your Paigaam and share it with the people who matter.</p></div>
      </div>
    </div>
  </section>

  <section class="statement">
    <span class="kicker reveal">Our belief</span>
    <blockquote class="reveal">Some moments deserve more than a message.</blockquote>
    <p class="reveal">A Paigaam is not a template, and it is not a card. It is a small piece of the web, made only for you and the people you love — a place your moment can live, long after the day has passed.</p>
  </section>
</main>`, { current: '/' });
}

module.exports = { home, templateCard, motifSVG };
