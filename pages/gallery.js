'use strict';
const { page, esc } = require('../lib/layout');
const { templateCard } = require('./home');

const FILTERS = ['All', 'Wedding', 'Birthday', 'Anniversary', 'Baby', 'Festival', 'Personal'];

function gallery(templates, active = 'All') {
  const activeName = FILTERS.find(f => f.toLowerCase() === String(active).toLowerCase()) || 'All';
  const list = activeName === 'All' ? templates : templates.filter(t => t.category.toLowerCase() === activeName.toLowerCase());

  return page('Find your Paigaam', `
<main class="section">
  <div class="wrap">
    <div class="section__head reveal in">
      <span class="kicker">The collection</span>
      <h1 class="section__title">Find your Paigaam</h1>
      <p class="section__sub">Beautiful designs for life's beautiful moments.</p>
    </div>
    <div class="filters" role="group" aria-label="Filter by occasion">
      ${FILTERS.map(f => `<a class="filter" role="button" aria-pressed="${f === activeName}" href="/templates${f === 'All' ? '' : '?occasion=' + f.toLowerCase()}">${f}</a>`).join('')}
    </div>
    ${list.length ? `<div class="cards">${list.map(templateCard).join('')}</div>` : `
    <div class="empty">
      <h1>Nothing here yet.</h1>
      <p>Paigaams for this occasion are on their way.</p>
      <a class="btn" href="/templates">See all Paigaams</a>
    </div>`}
  </div>
</main>`, { current: '/templates' });
}

module.exports = { gallery };
