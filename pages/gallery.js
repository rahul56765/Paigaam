'use strict';
const { page, esc } = require('../lib/layout');
const { templateCard } = require('./homeCards');
const { OCCASIONS } = require('../lib/occasions');

const PRICE_FILTERS = [
  ['all', 'All prices'],
  ['free', 'Free'],
  ['under', 'Under \u20B9299'],
  ['over', '\u20B9300+'],
];

function searchIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
}

/**
 * The template collection grid.
 * state: { q, occasion, price, sort } — all URL-driven (shareable, no-JS safe).
 * The server honours the params on load; a small client script refines instantly.
 */
function gallery(templates, state = {}) {
  const q = String(state.q || '').trim();
  const occasion = String(state.occasion || 'all').toLowerCase();
  const price = String(state.price || 'all').toLowerCase();
  const sort = String(state.sort || 'newest').toLowerCase();

  // ---- server-side filtering (same logic the client script mirrors) ----
  let list = templates.slice();
  if (occasion !== 'all') {
    const occ = OCCASIONS.find(o => o.slug === occasion);
    const match = new Set((occ ? occ.slugs : [occasion]).map(s => s.toLowerCase()));
    list = list.filter(t => match.has(String(t.category).toLowerCase()));
  }
  if (price === 'free') list = list.filter(t => Number(t.price) === 0);
  else if (price === 'under') list = list.filter(t => Number(t.price) > 0 && Number(t.price) < 300);
  else if (price === 'over') list = list.filter(t => Number(t.price) >= 300);
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter(t => {
      const occ = OCCASIONS.find(o => o.slugs.includes(String(t.category).toLowerCase()));
      const hay = [t.name, t.category, t.description, (t.tags || []).join(' '), occ ? occ.aliases.join(' ') : ''].join(' ').toLowerCase();
      return terms.every(term => hay.includes(term));
    });
  }
  if (sort === 'popular') {
    // No usage analytics yet — popular falls back to registry order (curated).
    list.sort((a, b) => (b.popularRank || 0) - (a.popularRank || 0));
  }

  const occLabel = occasion === 'all' ? '' : ` for ${(OCCASIONS.find(o => o.slug === occasion) || { name: occasion }).name.toLowerCase()}`;
  const countLine = list.length
    ? `${list.length} design${list.length === 1 ? '' : 's'}${occLabel}${q ? ` matching \u201C${esc(q)}\u201D` : ''}`
    : '';

  const occFilter = (slug, label) =>
    `<a class="filter" role="button" aria-pressed="${occasion === slug}" href="/templates?occasion=${slug}${price !== 'all' ? '&price=' + price : ''}${q ? '&q=' + encodeURIComponent(q) : ''}" data-track="template_filter_used" data-occasion="${slug}">${esc(label)}</a>`;

  const priceFilter = (slug, label) =>
    `<a class="filter" role="button" aria-pressed="${price === slug}" href="/templates?price=${slug}${occasion !== 'all' ? '&occasion=' + occasion : ''}${q ? '&q=' + encodeURIComponent(q) : ''}" data-track="template_filter_used" data-price="${slug}">${esc(label)}</a>`;

  const sortFilter = (slug, label) =>
    `<a class="filter" role="button" aria-pressed="${sort === slug}" href="/templates?sort=${slug}${occasion !== 'all' ? '&occasion=' + occasion : ''}${price !== 'all' ? '&price=' + price : ''}${q ? '&q=' + encodeURIComponent(q) : ''}">${esc(label)}</a>`;

  const suggestions = ['birthday letter', 'wedding', 'proposal', 'ganpati', 'anniversary'];

  return page(occasion !== 'all' ? `${(OCCASIONS.find(o => o.slug === occasion) || { name: 'All' }).name} Paigaams — every design` : 'Find your Paigaam — every design', `
<main class="section">
  <div class="wrap">
    <div class="gallery-head reveal in">
      <span class="kicker">The collection</span>
      <h1 class="section__title">Find your Paigaam</h1>
      <p class="section__sub">Beautiful designs for life's beautiful moments.</p>
      <form class="searchbar" action="/templates" method="get" role="search">
        ${searchIcon()}
        <input type="search" name="q" id="tplSearch" placeholder="Search templates..." value="${esc(q)}" aria-label="Search templates" autocomplete="off">
      </form>
    </div>

    <div class="filterbar" role="group" aria-label="Filter the collection">
      ${occFilter('all', 'All')}
      ${OCCASIONS.map(o => occFilter(o.slug, o.name)).join('')}
      <span class="fsep" aria-hidden="true"></span>
      ${PRICE_FILTERS.map(([slug, label]) => priceFilter(slug, label)).join('')}
      <span class="fsep" aria-hidden="true"></span>
      ${sortFilter('newest', 'Newest')}
      ${sortFilter('popular', 'Popular')}
    </div>

    <!-- Mobile: clean select-based filters (one tap, no drawer) -->
    <div class="mobile-filters">
      <select id="mOcc" aria-label="Filter by occasion">
        <option value="all"${occasion === 'all' ? ' selected' : ''}>All occasions</option>
        ${OCCASIONS.map(o => `<option value="${o.slug}"${occasion === o.slug ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>
      <select id="mPrice" aria-label="Filter by price">
        ${PRICE_FILTERS.map(([slug, label]) => `<option value="${slug}"${price === slug ? ' selected' : ''}>${esc(label)}</option>`).join('')}
      </select>
    </div>

    <p class="grid-count" id="gridCount">${countLine}</p>

    <div class="cards cards--grid" id="tplGrid">
      ${list.map(t => templateCard(t)).join('')}
    </div>

    <div class="grid-empty" id="gridEmpty" hidden>
      <h3>Nothing here yet.</h3>
      <p>Try a different word, or start from an occasion:</p>
      <div class="suggestions">
        ${suggestions.map(s => `<a href="/templates?q=${encodeURIComponent(s)}">${s}</a>`).join('')}
        <a href="/templates">Show everything</a>
      </div>
    </div>
  </div>
</main>
<script>
/* Instant client-side refinement of the grid (server already filtered on load). */
(function () {
  var grid = document.getElementById('tplGrid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.tcard'));
  var input = document.getElementById('tplSearch');
  var countEl = document.getElementById('gridCount');
  var emptyEl = document.getElementById('gridEmpty');
  var state = { q: '', occasion: ${JSON.stringify(occasion)}, price: ${JSON.stringify(price)} };
  var occasionMap = ${JSON.stringify(Object.fromEntries(OCCASIONS.map(o => [o.slug, o.slugs])))};

  function apply() {
    var terms = state.q.toLowerCase().split(/\\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (card) {
      var d = card.dataset;
      var ok = true;
      if (state.occasion !== 'all') {
        var match = (occasionMap[state.occasion] || [state.occasion]).map(function (s) { return s.toLowerCase(); });
        ok = match.indexOf((d.occasion || '').toLowerCase()) !== -1;
      }
      if (ok && state.price !== 'all') {
        var p = Number(d.price);
        ok = state.price === 'free' ? p === 0 : state.price === 'under' ? (p > 0 && p < 300) : p >= 300;
      }
      if (ok && terms.length) {
        var hay = (d.search || '').toLowerCase();
        ok = terms.every(function (t) { return hay.indexOf(t) !== -1; });
      }
      card.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown + ' design' + (shown === 1 ? '' : 's') + (state.q ? ' matching \\u201C' + state.q + '\\u201D' : '');
    if (emptyEl) emptyEl.hidden = shown !== 0;
    grid.hidden = shown === 0;
    if (terms.length) window.paTrack && window.paTrack('template_search', { query: state.q });
  }

  if (input) {
    var deb;
    input.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(function () { state.q = input.value.trim(); apply(); }, 180);
    });
    input.addEventListener('change', function () { state.q = input.value.trim(); apply(); });
  }
  var mOcc = document.getElementById('mOcc'), mPrice = document.getElementById('mPrice');
  function syncSelects() {
    if (mOcc) {
      state.occasion = mOcc.value;
      window.paTrack && window.paTrack('template_filter_used', { occasion: mOcc.value });
    }
    if (mPrice) {
      state.price = mPrice.value;
      window.paTrack && window.paTrack('template_filter_used', { price: mPrice.value });
    }
    apply();
  }
  if (mOcc) mOcc.addEventListener('change', syncSelects);
  if (mPrice) mPrice.addEventListener('change', syncSelects);
})();
</script>`, { current: '/templates' });
}

module.exports = { gallery };
