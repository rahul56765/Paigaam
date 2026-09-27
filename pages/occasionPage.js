'use strict';
/**
 * SEO occasion landing pages: /templates/<occasion> and the /occasions index.
 * Each page gets unique copy, canonical URL and (on template pages) BreadcrumbList
 * + ItemList structured data.
 */
const { page, esc } = require('../lib/layout');
const { templateCard } = require('./homeCards');
const { OCCASIONS } = require('../lib/occasions');

const BASE = process.env.BASE_URL || 'https://paigaam.cc';

/** Landing page for a single occasion, e.g. /templates/birthday. */
function occasionPage(occ, templates) {
  const list = templates.filter(t => {
    const cat = String(t.category).toLowerCase();
    return occ.slugs.includes(cat);
  });
  const canonical = `${BASE}/templates/${occ.slug}`;
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${occ.name} Paigaams`,
    numberOfItems: list.length,
    itemListElement: list.map((t, i) => ({
      '@type': 'ListItem', position: i + 1,
      name: `${t.name} — ${t.category} Paigaam`,
      url: `${BASE}/templates/${t.slug}`,
    })),
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Templates', item: BASE + '/templates' },
      { '@type': 'ListItem', position: 3, name: occ.name, item: canonical },
    ],
  };
  return page(occ.title, `
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>
<main>
  <section class="occ-land">
    <div class="wrap">
      <span class="crumbs"><a href="/">Home</a> &nbsp;/&nbsp; <a href="/templates">Templates</a> &nbsp;/&nbsp; ${esc(occ.name)}</span>
      <span class="kicker">The occasion</span>
      <h1>${esc(occ.heroLine)}<em>.</em></h1>
      <p>${esc(occ.intro)}</p>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      ${list.length ? `<div class="cards cards--grid">${list.map(t => templateCard(t)).join('')}</div>` : `
      <div class="grid-empty" style="display:block">
        <h3>Designs for ${esc(occ.name.toLowerCase())} are on their way.</h3>
        <p>In the meantime, browse the whole collection.</p>
        <a class="btn btn--primary" href="/templates">See all Paigaams</a>
      </div>`}
    </div>
  </section>
</main>`, {
    current: '/templates',
    description: occ.description,
    canonical: `/templates/${occ.slug}`,
  });
}

/** /occasions — index of every occasion. */
function occasionsIndex(counts = {}) {
  const canonical = `${BASE}/occasions`;
  return page('Occasions — find the Paigaam for your moment | Paigaam', `
<main>
  <section class="occ-land">
    <div class="wrap">
      <span class="crumbs"><a href="/">Home</a> &nbsp;/&nbsp; Occasions</span>
      <span class="kicker">The occasion</span>
      <h1>Every moment has<br><em>its own feeling.</em></h1>
      <p>Begin there, and we'll show you the designs that fit it — invitations, letters, games and surprises for every kind of moment.</p>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <div class="occ-grid">
        ${OCCASIONS.map((o, i) => `
        <a class="occ-card reveal" style="transition-delay:${i * 60}ms;aspect-ratio:auto;padding:44px 36px;display:block" href="/templates/${o.slug}" data-track="occasion_clicked" data-occasion="${o.slug}">
          <div class="occ-card__label" style="padding:0">
            <h3>${esc(o.name)}</h3>
            <p>${esc(o.intro.split('.')[0])}.</p>
            ${counts[o.slug] ? `<span class="occ-card__count">${counts[o.slug]} design${counts[o.slug] === 1 ? '' : 's'}</span>` : ''}
          </div>
        </a>`).join('')}
      </div>
    </div>
  </section>
</main>`, {
    current: '/occasions',
    description: 'Browse Paigaams by occasion — weddings, birthdays, anniversaries, proposals, festivals and more. Choose a design, personalise it and share it instantly.',
    canonical: '/occasions',
  });
}

module.exports = { occasionPage, occasionsIndex };
