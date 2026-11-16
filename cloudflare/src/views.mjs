/**
 * Original Paigaam layouts, isolated from the legacy database/registry.
 * The rendering functions below are copied from pages/homeCards.js, home.js,
 * gallery.js, occasionPage.js and templateDetail.js because those modules
 * transitively import the Node-only templates/registry and db. Keep their
 * markup in sync with the originals; only the family preview adapter differs.
 */
import layout from '../../lib/layout.js';
import logo from '../../lib/logo.js';
import occasions from '../../lib/occasions.js';
import createPages from '../../pages/bfdayCreate.js';
import legalPages from '../../pages/legal.js';
import contactPages from '../../pages/contact.js';
const { esc } = layout;
const { doveSVG } = logo;
const { OCCASIONS, occasionForCategory } = occasions;
const { bfdayCreatePage } = createPages;
const PREVIEW_NOTICE = '<aside role="status" style="padding:8px 20px;background:#5b1725;color:#fff;text-align:center;font:12px/1.45 system-ui">Cloudflare preview · Orders and publishing are unavailable. Catalogue is in source order; previous database, custom ordering and invitations have not been imported.</aside>';
function cleanShell(html) {
  return html.replace(/<link[^>]+href="\/css\/creator-coupon\.css[^>]*>\s*/g, '')
    .replace(/<script[^>]+src="\/js\/(?:creator-coupon|welcome-back)\.js[^>]*><\/script>\s*/g, '')
    .replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>')
    .replace(/(<body\b[^>]*>)/i, '$1' + PREVIEW_NOTICE);
}
function page(title, body, opts) { return cleanShell(layout.page(title, body, opts)); }
// Same computation as templates/registry.js, without its Node/database imports.
function priceInfo(t) {
  const sale = Math.max(0, Number(t && t.price) || 0);
  const lp = Math.max(0, Number(t && t.list_price) || 0);
  const list = lp > sale ? lp : 0;
  const off = list ? Math.round(((list - sale) / list) * 100) : 0;
  return { free: sale === 0, sale, list, off };
}

// --- Original pages/homeCards.js ---
/**
 * Shared template card components.
 * Extracted from pages/home.js so every listing surface (home, /templates,
 * occasion pages) renders identical cards: live thumbnail, badges, price and
 * a direct Create action.
 */




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
  const available = t.supported !== false;
  const free = Number(t.price) === 0;
  const pinfo = priceInfo(t);
  // Search haystack: name, category, description, tags + occasion aliases.
  const occ = occasionForCategory(t.category);
  const haystack = [t.name, t.category, t.description, (t.tags || []).join(' '), occ ? occ.aliases.join(' ') : ''].join(' ');
  // Collection cards stay static: some embedded previews (notably Khaat)
  // resume Web Audio when their lazy iframe enters view, despite autoplay policy.
  // Saved imagery is used where present; otherwise the motif fallback is shown.
  const thumbnail = t.thumbnail_url ? `<img class="tcard__poster" src="${esc(t.thumbnail_url)}" alt="" aria-hidden="true" loading="lazy" style="position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '';
  // Quick-preview payload: rendered into the modal on tap (no navigation).
  const qp = JSON.stringify({
    slug: t.slug, name: t.name, desc: t.description || '', price: !available ? 'Restoring' : free ? 'FREE' : `\u20B9${t.price}`,
    thumbnail: t.thumbnail_url || '', bg: theme.bg || '#F4EADD', detail: previewHref, create: available ? createHref : previewHref, free: available && free, ...(available ? {} : { available: false }),
  }).replace(/</g, '\\u003c');
  return `<article class="tcard reveal" data-occasion="${esc(String(t.category).toLowerCase())}" data-price="${esc(Number(t.price))}" data-search="${esc(haystack)}" data-slug="${esc(t.slug)}">
  <a class="tcard__frame${custom ? ' tcard__frame--custom' : ''}" style="background:${esc(theme.bg || '#F4EADD')}" href="${previewHref}" aria-label="See the ${esc(t.name)} Paigaam">
    ${thumbnail}
    <span class="tcard__fallback" aria-hidden="true">${motifSVG(theme.motif || 'dove', accent)}</span>
    <span class="tcard__name" style="color:${esc(accent)}">${esc(t.name.toUpperCase())}</span>
    <span class="tcard__cat">${esc(t.category)}</span>
    <span class="tcard__badges">
      ${!available ? '<span class="pill pill--gold">Restoring</span>' : free ? '<span class="pill pill--free">Free</span>' : ''}
      ${available && t.isNew ? '<span class="pill pill--gold">New</span>' : ''}
    </span>
    <button type="button" class="tcard__quick" data-quick="${esc(t.slug)}" data-qp="${esc(qp)}" aria-label="Quick preview of the ${esc(t.name)} Paigaam" aria-haspopup="dialog">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>
    </button>
  </a>
  <div class="tcard__meta">
    <span class="tcard__title">${esc(t.name)}</span>
    ${!available ? '<span class="tcard__price">Restoring</span>' : free ? '<span class="tcard__price tcard__price--free">FREE</span>' : `<span class="tcard__price">${pinfo.list ? `<s>\u20B9${pinfo.list}</s>` : ''}\u20B9${pinfo.sale}</span>`}
  </div>
  <p class="tcard__desc">${esc(t.description || '')}</p>
  <span class="tcard__occ-label">${esc(t.category)}</span>
  <div class="tcard__actions">
    ${available ? `<a class="tcard__create" href="${createHref}" data-track="template_create_clicked" data-template="${esc(t.slug)}" data-occasion="${esc(String(t.category).toLowerCase())}">Create</a>` : '<span class="tcard__create" aria-disabled="true">Restoring</span>'}
    <a class="tcard__preview-link" href="${previewHref}" data-track="template_viewed" data-template="${esc(t.slug)}">Preview</a>
  </div>
</article>`;
}


// --- Original pages/home.js ---



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

/**
 * Trending card: whole card is one link to the template detail page.
 * Live miniature (same engine as collection cards), muted by construction —
 * template audio/video only ever plays after an explicit tap inside the
 * template page itself.
 */
function trendingCard(t) {
  const cfg = t.config || {};
  const theme = cfg.theme || {};
  const custom = cfg.custom || t.custom;
  const frameSrc = custom ? (cfg.appPath || t.appPath || '/') : `/${esc(t.slug)}/demo`;
  const free = Number(t.price) === 0;
  return `<a class="trend-card reveal" href="/templates/${esc(t.slug)}"
     data-track="trending_template_clicked" data-template="${esc(t.slug)}"
     aria-label="Open the ${esc(t.name)} Paigaam">
  <span class="trend-card__frame" style="background:${esc(theme.bg || '#F4EADD')}">
    <iframe class="tcard__live" src="${esc(frameSrc)}" title="Preview of the ${esc(t.name)} Paigaam" loading="lazy" scrolling="no" tabindex="-1" aria-hidden="true" sandbox="allow-same-origin allow-scripts"></iframe>
    <span class="tcard__fallback" aria-hidden="true">${motifSVG(theme.motif, theme.accent || '#8F1018')}</span>
    <span class="trend-card__flame" aria-hidden="true">&#128293;</span>
  </span>
  <span class="trend-card__meta">
    <span class="trend-card__row">
      <span class="trend-card__name">${esc(t.name)}</span>
      ${free ? '<span class="tcard__price tcard__price--free">FREE</span>' : `<span class="tcard__price">&#8377;${esc(t.price)}</span>`}
    </span>
    <span class="trend-card__desc">${esc(t.description || t.category)}</span>
    <span class="trend-card__occ">${esc(t.category)}</span>
  </span>
</a>`;
}

function home(templates, opts = {}) {
  const featured = templates.slice(0, 6);
  const trending = Array.isArray(opts.trending) ? opts.trending : [];
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
    <div class="wrap">
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
            <iframe title="Preview of a Paigaam experience" src="/${esc((templates.find(t => t.supported !== false) || { slug: 'sealed-with-a-kiss' }).slug)}/demo" style="width:100%;height:100%;border:0" loading="lazy" scrolling="no" tabindex="-1" sandbox="allow-same-origin allow-scripts"></iframe>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- TRENDING: what people are opening right now — exactly 2, side by side -->
  ${trending.length >= 2 ? `
  <section class="section section--dark" id="trending">
    <div class="wrap">
      <div class="section__head reveal">
        <span class="kicker">Trending now</span>
        <h2 class="section__title">The two everyone's opening</h2>
        <p class="section__sub">Live from what people are creating and sharing this week.</p>
      </div>
      <div class="trend-grid">
        ${trending.map(t => trendingCard(t)).join('')}
      </div>
    </div>
  </section>` : ''}

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


// --- Original pages/gallery.js ---



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
function gallery(templates, state = {}, opts = {}) {
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
    // Real engagement (30-day weighted events) when available; ties fall back
    // to registry order (curated). scores map is passed in by the server.
    const scores = opts.popularScores || {};
    list.sort((a, b) => (scores[b.slug] || 0) - (scores[a.slug] || 0) || (b.popularRank || 0) - (a.popularRank || 0));
  } else if (sort === 'price-asc') {
    list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (sort === 'price-desc') {
    list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }
  // 'newest' (default) keeps the caller's order: created_at DESC, rowid ASC —
  // newest templates first, straight from the database.

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
      ${sortFilter('newest', 'Latest')}
      ${sortFilter('popular', 'Popular')}
      ${sortFilter('price-asc', 'Price &darr;')}
      ${sortFilter('price-desc', 'Price &uarr;')}
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

    <!-- Quick preview modal: lightweight, muted, no navigation -->
    <div class="qpm" id="quickPreview" role="dialog" aria-modal="true" aria-label="Quick preview" hidden>
      <div class="qpm__backdrop" data-qpm-close></div>
      <div class="qpm__panel">
        <button type="button" class="qpm__close" data-qpm-close aria-label="Close preview">&times;</button>
        <div class="qpm__frame" id="qpmFrame"></div>
        <div class="qpm__meta">
          <div>
            <h3 id="qpmName"></h3>
            <p id="qpmDesc"></p>
          </div>
          <div class="qpm__side">
            <span class="qpm__price" id="qpmPrice"></span>
            <a class="btn btn--primary" id="qpmCreate" href="#" data-track="template_create_clicked">Create this Paigaam &rarr;</a>
            <a class="qpm__detail" id="qpmDetail" href="#">See full details</a>
          </div>
        </div>
      </div>
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

  /* ---- funnel: collection viewed (once per load) ---- */
  if (window.paTrack) window.paTrack('template_collection_viewed', { count: cards.length });

  /* ---- quick preview modal ---- */
  var qpm = document.getElementById('quickPreview');
  var qpmFrame = document.getElementById('qpmFrame');
  var qpmName = document.getElementById('qpmName');
  var qpmDesc = document.getElementById('qpmDesc');
  var qpmPrice = document.getElementById('qpmPrice');
  var qpmCreate = document.getElementById('qpmCreate');
  var qpmDetail = document.getElementById('qpmDetail');
  function closeQpm() {
    qpm.hidden = true;
    qpmFrame.replaceChildren(); // keep the collection preview static and release its image
    document.body.style.overflow = '';
  }
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-qp]') : null;
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      var d;
      try { d = JSON.parse(btn.getAttribute('data-qp')); } catch (err) { return; }
      qpmName.textContent = d.name || '';
      qpmDesc.textContent = d.desc || '';
      qpmPrice.textContent = d.price || '';
      qpmPrice.classList.toggle('qpm__price--free', !!d.free);
      qpmCreate.href = d.create || '#';
      qpmCreate.hidden = d.available === false;
      qpmCreate.setAttribute('data-template', d.slug || '');
      qpmDetail.href = d.detail || '#';
      // A static poster keeps even the quick-look modal silent; the full
      // interactive experience is only opened from its explicit detail link.
      qpmFrame.replaceChildren();
      if (d.thumbnail) {
        var poster = document.createElement('img');
        poster.className = 'qpm__poster'; poster.src = d.thumbnail; poster.alt = '';
        qpmFrame.appendChild(poster);
      } else {
        var placeholder = document.createElement('div');
        placeholder.className = 'qpm__poster qpm__poster--placeholder';
        placeholder.style.backgroundColor = d.bg || '#F4EADD';
        var title = document.createElement('span');
        title.className = 'qpm__poster-title'; title.textContent = d.name || '';
        var label = document.createElement('span');
        label.className = 'qpm__poster-label'; label.textContent = 'Paigaam design preview';
        placeholder.appendChild(title); placeholder.appendChild(label); qpmFrame.appendChild(placeholder);
      }
      qpm.hidden = false;
      document.body.style.overflow = 'hidden';
      window.paTrack && window.paTrack('template_previewed', { template: d.slug });
      return;
    }
    if (e.target && (e.target.hasAttribute && e.target.hasAttribute('data-qpm-close') || (e.target.closest && e.target.closest('[data-qpm-close]')))) closeQpm();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !qpm.hidden) closeQpm(); });
})();
</script>`, { current: '/templates' });
}


// --- Original pages/occasionPage.js ---
/**
 * SEO occasion landing pages: /templates/<occasion> and the /occasions index.
 * Each page gets unique copy, canonical URL and (on template pages) BreadcrumbList
 * + ItemList structured data.
 */



const BASE = 'https://paigaam.cc';

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


// --- Original pages/templateDetail.js ---




/** Sample data so the preview always looks alive. */
function sampleData(tpl) {
  const d = {};
  for (const f of tpl.config.fields || []) {
    if (f.type === 'image') continue;
    if (f.id === 'brideName') d[f.id] = 'Ayesha';
    else if (f.id === 'groomName') d[f.id] = 'Imran';
    else if (f.id === 'personName') d[f.id] = 'Meher';
    else if (f.id === 'partnerOne') d[f.id] = 'Aashi';
    else if (f.id === 'partnerTwo') d[f.id] = 'Raghav';
    else if (f.type === 'date') d[f.id] = '2026-12-12';
    else if (f.type === 'time') d[f.id] = '19:00';
    else if (f.type === 'number') d[f.id] = f.id === 'years' ? '10' : '30';
    else if (f.id === 'venue') d[f.id] = 'The Roseate, New Delhi';
    else if (f.id === 'address') d[f.id] = 'NH-8, Samalka, New Delhi';
    else if (f.type === 'textarea') d[f.id] = 'Some moments arrive quietly and change everything. Ours did. We would be honoured to have you there when we say the words that make it forever.';
    else d[f.id] = f.placeholder || '';
  }
  return d;
}

/** A family member's own share card (config.ogImage, site-relative) as og:image / twitter:image. */
function shareImage(tpl, baseUrl) {
  const member = tpl;
  const image = member && member.config.ogImage;
  if (typeof image !== 'string' || !image.startsWith('/')) return '';
  let origin = '';
  try { origin = new URL(baseUrl).origin; } catch { return ''; }
  const url = esc(origin + image);
  return `<meta property="og:image" content="${url}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${url}">`;
}

function templateDetail(tpl, { baseUrl = '' } = {}) {
  const isCustom = !!(tpl.config && tpl.config.custom) || !!tpl.custom;
  const appPath = (tpl.config && tpl.config.appPath) || tpl.appPath || '';
  // Every template with a /<slug>/demo route gets the live iframe preview.
  // (Per-template modules mount /<slug>/demo; custom webapps iframe their app.)
  const demoPath = tpl.slug;
  const hasDemo = true;
  let previewInner;
  if (hasDemo) {
    previewInner = `<iframe title="${esc(tpl.name)} live preview" src="/${esc(demoPath)}/demo" style="width:100%;height:100%;border:0" loading="lazy" allow="autoplay"></iframe>`;

  }

  const cta = isCustom
    ? `<a class="btn btn--primary" href="/create/${esc(tpl.slug)}">Get this Paigaam</a>`
    : `<a class="btn btn--primary" href="/create/${esc(tpl.slug)}" data-track="template_create_clicked" data-template="${esc(tpl.slug)}">Create this Paigaam &rarr;</a>`;
  const note = isCustom
    ? `A fixed, ready-made experience — exactly as designed. Get yours and share the link.`
    : `See your Paigaam come alive as you fill it in. Publishing and sharing are unavailable in this preview.`;
  const free = Number(tpl.price) === 0;
  const pinfo = priceInfo(tpl);
  const priceHTML = true ? '' : (free
    ? `<div class="detail__price"><small>One Paigaam</small><span style="font-size:26px;letter-spacing:0.18em;color:#3E6B40">FREE</span></div>`
    : `<div class="detail__price"><small>One Paigaam</small>${pinfo.list ? `<s style="font-size:17px;color:var(--taupe);margin-right:8px">&#8377;${pinfo.list}</s>` : ''}<span style="font-size:26px;letter-spacing:0.18em">&#8377;${pinfo.sale}</span>${pinfo.off ? `<span style="font-size:13px;color:#3E6B40;margin-left:10px;font-weight:600">${pinfo.off}% off</span>` : ''}</div>`);

  return page(tpl.name, `
<main data-topened="${esc(tpl.slug)}">
  <div class="wrap">
    <div class="detail">
      <div class="reveal in">
        <div class="phone" role="img" aria-label="Live preview of the ${esc(tpl.name)} Paigaam on a phone">
          <div class="phone__screen">
            ${previewInner}
          </div>
        </div>
      </div>
      <div class="reveal in">
        <span class="kicker">${esc(tpl.category)}</span>
        <h1 class="section__title" style="letter-spacing:0.14em">${esc(tpl.name.toUpperCase())}</h1>
        <p style="font-family:var(--serif);font-style:italic;font-size:20px;color:var(--ink-soft);margin-top:16px;line-height:1.5">${esc(tpl.description)}</p>
        ${priceHTML}
        <div class="detail__actions">
          ${cta}
          ${hasDemo ? `<a class="btn btn--ghost" href="/${esc(demoPath)}/demo" target="_blank" rel="noopener">Experience full preview</a>` : ''}
          <a class="btn btn--ghost" href="/templates">Back to templates</a>
        </div>
        <p class="detail__note">${note}</p>
      </div>
    </div>
  </div>
</main>
<!-- sticky mobile create bar -->
<div class="sticky-cta" id="stickyCta" aria-hidden="false">
  <div class="sticky-cta__inner">
    <div class="sticky-cta__info">
      <strong>${esc(tpl.name)}</strong>
      <span>${free ? 'FREE' : (pinfo.list ? '<s style="color:var(--taupe)">&#8377;' + pinfo.list + '</s> ' : '') + '&#8377;' + pinfo.sale + ' &middot; one-time'}</span>
    </div>
    <a class="btn btn--primary" href="/create/${esc(tpl.slug)}" data-track="template_create_clicked" data-template="${esc(tpl.slug)}" data-label="sticky_bar">Create &rarr;</a>
  </div>
</div>
<script>
/* Mobile sticky create bar: appears when the main CTA scrolls out of view. */
(function () {
  var bar = document.getElementById('stickyCta');
  if (!bar) return;
  if (window.matchMedia && window.matchMedia('(min-width: 721px)').matches) return;
  var anchor = document.querySelector('.detail__actions');
  if (!anchor || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { bar.classList.toggle('show', !e.isIntersecting); });
  }, { threshold: 0 }).observe(anchor);
})();
</script>`, { current: '/templates', canonical: `/templates/${tpl.slug}`, description: `${tpl.name} — a ${String(tpl.category).toLowerCase()} Paigaam. ${tpl.description}`, headExtra: shareImage(tpl, baseUrl) });
}


/** Adapt a generated family entry (or a row with config) to the original DB-row shape.
 * Optional D1 row prices are paise; configuration prices are rupees. D1 wins.
 */
export function adaptTemplate(template, dbRow = null) {
  const c = template.config || {};
  const price = dbRow && dbRow.price != null ? Number(dbRow.price) / 100 : Number(template.price ?? c.price ?? 0);
  const listPrice = dbRow && dbRow.list_price != null ? Number(dbRow.list_price) / 100 : Number(template.list_price ?? c.list_price ?? c.listPrice ?? 0);
  return { ...template, slug: template.slug || c.slug, name: dbRow?.name ?? template.name ?? c.name,
    category: template.category ?? c.category, description: template.description ?? c.description ?? '',
    thumbnail_url: template.thumbnail_url ?? c.thumbnail_url ?? '', price, list_price: listPrice,
    tags: template.tags ?? c.tags ?? [], config: { ...c }, custom: !!(template.custom ?? c.custom) };
}
function adapted(templates, rows) {
  const lookup = rows instanceof Map ? rows : new Map((rows || []).map(row => [row.slug, row]));
  return templates.map(t => adaptTemplate(t, lookup.get(t.slug)));
}
export function originalHomePage(templates, opts = {}) {
  const list = adapted(templates, opts.rows);
  const trending = opts.trending?.map(t => adaptTemplate(t));
  return home(list, { ...opts, ...(trending ? { trending } : {}) });
}
export function originalGalleryPage(templates, state = {}, opts = {}) { return gallery(adapted(templates, opts.rows), state, opts); }
export function originalDetailPage(template, opts = {}) {
  const t = adaptTemplate(template, opts.row);
  if (t.supported !== false) return templateDetail(t, opts);
  const previewPath = t.slug === 'maafi' ? '/maafi/demo' : ['noor','meher','aashi'].includes(t.slug) ? '/template-view/' + t.slug : '';
  const preview = previewPath ? `<iframe title="${esc(t.name)} original demo" src="${esc(previewPath)}" style="width:100%;height:100%;border:0" loading="lazy"></iframe>` : '<div style="padding:30px;text-align:center">This design’s preview is still being restored.</div>';
  return page(t.name, `<main><div class="wrap"><div class="detail"><div class="reveal in"><div class="phone"><div class="phone__screen">${preview}</div></div></div><div class="reveal in"><span class="kicker">${esc(t.category)}</span><h1 class="section__title" style="letter-spacing:0.14em">${esc(t.name.toUpperCase())}</h1><p>${esc(t.description)}</p><p role="status">This design’s customizer and ordering are not yet available in this Cloudflare preview.</p><div class="detail__actions"><a class="btn btn--ghost" href="/templates">Back to templates</a></div></div></div></div></main>`, {current:'/templates',description:t.description});
}
export function originalOccasionPage(occasion, templates, opts = {}) {
  const occ = typeof occasion === 'string' ? OCCASIONS.find(o => o.slug === occasion) : occasion;
  return occ ? occasionPage(occ, adapted(templates, opts.rows)) : null;
}
export function originalOccasionsIndex(templates) {
  const counts = {};
  for (const t of adapted(templates)) { const occ = occasionForCategory(t.category); if (occ) counts[occ.slug] = (counts[occ.slug] || 0) + 1; }
  return occasionsIndex(counts);
}
export function originalLegalPage(which) { const html = legalPages.legalPage(which); return html == null ? null : cleanShell(html); }
export function originalContactPage(settings = {}) {
  let html = contactPages.contactPage(settings);
  // The preview does not inherit Railway settings. Do not link to an unknown number.
  if (!String(settings.whatsapp_number || '').replace(/\D/g, '')) {
    html = html.replace(/<a class="btn btn--whatsapp"[^>]*>Message us on WhatsApp<\/a>/, '<span class="btn btn--whatsapp" aria-disabled="true">Contact unavailable in this preview</span>');
  }
  return cleanShell(html);
}
export function catalogPage(templates) { return originalGalleryPage(templates); }
export function detailPage(template) { return originalDetailPage(template); }
export function builderPage(template, baseUrl = '', options = {}) {
  if (baseUrl && typeof baseUrl === 'object') { options = baseUrl; baseUrl = options.baseUrl || ''; }
  const t = { ...template, config: { ...template.config } };
  let html = bfdayCreatePage(t, options);
  // Do not render a nonfunctional payment form or promise successful publication.
  html = html.replace(/<section class="pc-inline-checkout[\s\S]*?<\/section>/, '')
    .replace(/<script[^>]+src="\/js\/paigaam-pay\.js[^>]*><\/script>\s*/g, '')
    .replace('<h2 tabindex="-1">Ready to send</h2>', '<h2 tabindex="-1">Preview only</h2>')
    .replace('<p>Publish and share — it takes one tap.</p>', '<p>Publishing is unavailable in this preview.</p>')
    .replace(/<button type="button" id="publish"[\s\S]*?<\/button>/, '<button type="button" id="publish" class="button publish" disabled aria-disabled="true">Publishing unavailable</button>')
    .replace(/<p class="hint">(?:Secure payment via Razorpay\.[\s\S]*?|Free\. The link stays live;[\s\S]*?)<\/p>/, '<p class="hint">Drafts, media uploads and checkout are disabled in this preview.</p>');
  let origin = '';
  try { origin = new URL(baseUrl).origin; } catch { /* relative preview is fine */ }
  if (origin) html = html.replace(/https:\/\/paigaam\.cc(?=[\/"<])/g, () => esc(origin));
  // The wizard might enable its publish button when navigating; prevent this even
  // if a stale or browser-restored draft happens to be present.
  const guard = `<script>(function(){function lock(){var b=document.getElementById('publish');if(b){if(!b.disabled)b.disabled=true;b.setAttribute('aria-disabled','true');if(b.textContent!=='Publishing unavailable')b.textContent='Publishing unavailable';}document.querySelectorAll('input[type=file]').forEach(function(f){if(!f.disabled)f.disabled=true;f.title='Uploads are unavailable in this preview';});}document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#publish')){e.preventDefault();e.stopImmediatePropagation();}},true);document.addEventListener('DOMContentLoaded',function(){lock();new MutationObserver(lock).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});});})();</script>`;
  return cleanShell(html).replace('</body>', guard + '</body>');
}
