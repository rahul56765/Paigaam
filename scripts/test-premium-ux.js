'use strict';
/**
 * Premium UX layer tests (2026-09 redesign):
 * occasion registry, occasion landing pages, template grid search/filters,
 * SEO surface (canonical/OG/sitemap/robots), analytics endpoint, FREE labels,
 * sticky mobile CTA, dark shell.
 * Run: node scripts/test-premium-ux.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-ux-'));
process.env.BASE_URL = 'http://127.0.0.1:4321';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'test-admin-pw';

const { q } = require('../db');
const { OCCASIONS, occasionForCategory, bySlug } = require('../lib/occasions');
const { home, occasionCard } = require('../pages/home');
const { gallery } = require('../pages/gallery');
const { occasionPage, occasionsIndex } = require('../pages/occasionPage');
const { legalPage } = require('../pages/legal');
const { templateDetail } = require('../pages/templateDetail');
const { templateCard } = require('../pages/homeCards');
const { TEMPLATES } = require('../templates/registry');

test('occasions registry: slugs are unique and never collide with template slugs', () => {
  const slugs = OCCASIONS.map(o => o.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'occasion slugs must be unique');
  for (const t of TEMPLATES) {
    assert.ok(!bySlug[t.slug], `template slug ${t.slug} must not collide with an occasion slug`);
  }
});

test('occasions registry: every template category maps to an occasion', () => {
  for (const t of TEMPLATES) {
    assert.ok(occasionForCategory(t.category), `category "${t.category}" (${t.slug}) must map to an occasion`);
  }
});

test('occasions registry: SEO title + description present for every occasion', () => {
  for (const o of OCCASIONS) {
    assert.ok(o.title && o.title.length > 20 && o.title.includes('Paigaam'), `${o.slug}: title`);
    assert.ok(o.description && o.description.length > 50, `${o.slug}: description`);
    assert.ok(o.heroLine && o.intro, `${o.slug}: heroLine + intro`);
  }
});

const templates = TEMPLATES.map(t => ({ ...t, config: t.config || {} }));

test('homepage: dark hero, occasion grid, featured cards with direct Create, final CTA', () => {
  const html = home(templates);
  assert.ok(html.includes('hero--dark'), 'dark hero');
  assert.ok(html.includes('Make your moments'), 'hero headline');
  assert.ok(html.includes('worth remembering'), 'hero italic line');
  assert.ok(html.includes('occ-grid'), 'occasion grid');
  assert.ok(html.includes('data-track="occasion_clicked"'), 'occasion click tracking');
  assert.ok(html.includes('template_create_clicked'), 'direct create CTAs on cards');
  assert.ok(html.includes('final-cta'), 'final CTA section');
  assert.ok(html.includes("Some things are better when they're personal"), 'final CTA copy');
  assert.ok(html.includes('Three gentle steps'), 'how it works');
  assert.ok(!html.includes('Sign in'), 'no visible sign-in (admin stays hidden)');
});

test('homepage: occasion counts render', () => {
  const html = home(templates);
  assert.ok(html.includes('occ-card__count'), 'design counts on occasion cards');
});

test('occasionCard: links to /templates/<occasion>', () => {
  const html = occasionCard(OCCASIONS[1], 0, { birthday: 3 });
  assert.ok(html.includes('href="/templates/birthday"'));
  assert.ok(html.includes('3 designs'), 'count shown');
});

test('templateCard: FREE label, badges, create + preview actions', () => {
  const free = templateCard({ slug: 'x1', name: 'X', category: 'Birthday', description: 'd', price: 0, config: { theme: {} } });
  assert.ok(free.includes('>FREE<'), 'FREE label (not ₹0)');
  assert.ok(free.includes('pill--free'), 'free pill');
  assert.ok(free.includes('/create/x1'), 'create href');
  assert.ok(free.includes('data-search='), 'search haystack for client refinement');
  const paid = templateCard({ slug: 'x2', name: 'Y', category: 'Wedding', description: 'd', price: 499, config: { theme: {} }, isNew: true });
  assert.ok(paid.includes('₹499') || paid.includes('&#8377;499'), 'rupee price');
  assert.ok(paid.includes('pill--gold'), 'New pill');
  assert.ok(!paid.includes('pill--free'), 'no free pill on paid');
});

test('gallery: server-side filtering by occasion, price and search', () => {
  const occ = gallery(templates, { occasion: 'birthday' });
  const occGrid = occ.slice(occ.indexOf('id="tplGrid"'));
  assert.ok(occGrid.includes('data-occasion="birthday"'), 'only birthday cards rendered');
  assert.ok(!occGrid.includes('data-occasion="wedding"'), 'no wedding cards');
  const free = gallery(templates, { price: 'free' });
  const freeGrid = free.slice(free.indexOf('id="tplGrid"'));
  assert.ok(freeGrid.includes('>FREE<'), 'free filter shows only free');
  assert.ok(!freeGrid.includes('&#8377;499'), 'no paid cards');
  const search = gallery(templates, { q: 'ganpati' });
  assert.ok(search.includes('matching'), 'count line mentions the query');
  const empty = gallery(templates, { q: 'zzzqqqxxx' });
  assert.ok(empty.includes('grid-empty'), 'empty state present');
});

test('gallery: search box, occasion + price + sort filter chips', () => {
  const html = gallery(templates, {});
  assert.ok(html.includes('Search templates...'), 'search placeholder');
  assert.ok(html.includes('aria-pressed'), 'filter pressed state');
  assert.ok(html.includes('mobile-filters'), 'mobile filter selects');
});

test('occasion landing page: SEO head, breadcrumbs + ItemList JSON-LD, cards', () => {
  const occ = bySlug.birthday;
  const html = occasionPage(occ, templates);
  const esc = s => s.replace(/&/g, '&amp;');
  assert.ok(html.includes(`<title>${esc(occ.title)}</title>`), 'unique SEO title');
  assert.ok(html.includes('rel="canonical" href="http://127.0.0.1:4321/templates/birthday"'), 'canonical');
  assert.ok(html.includes('BreadcrumbList'), 'breadcrumb schema');
  assert.ok(html.includes('ItemList'), 'item list schema');
  assert.ok(!html.includes('noindex'), 'indexable');
});

test('occasions index page renders all occasions', () => {
  const html = occasionsIndex({ birthday: 3 });
  for (const o of OCCASIONS) assert.ok(html.includes(`/templates/${o.slug}`), o.slug);
});

test('legal pages: privacy, terms, refund', () => {
  for (const which of ['privacy', 'terms', 'refund']) {
    const html = legalPage(which);
    assert.ok(html && html.includes('<h1>'), `${which} renders`);
  }
  assert.equal(legalPage('nope'), null, 'unknown page is null');
});

test('template detail: sticky mobile CTA, FREE price, tracking, canonical', () => {
  const t = templates.find(x => x.slug === 'saalgirah');
  const html = templateDetail(t, { baseUrl: 'http://127.0.0.1:4321' });
  assert.ok(html.includes('sticky-cta'), 'sticky mobile create bar');
  assert.ok(html.includes('FREE'), 'free price label');
  assert.ok(html.includes('Create this Paigaam'), 'conversion CTA copy');
  assert.ok(html.includes('rel="canonical" href="http://127.0.0.1:4321/templates/saalgirah"'), 'canonical');
  assert.ok(html.includes('/saalgirah/demo'), 'live demo preview iframe');
});

test('template detail: ganapati-aagman uses its historic /ganapati/demo route', () => {
  const t = templates.find(x => x.slug === 'ganapati-aagman');
  const html = templateDetail(t, { baseUrl: 'http://127.0.0.1:4321' });
  assert.ok(html.includes('/ganapati/demo'), 'historic demo route');
  assert.ok(!html.includes('/ganapati-aagman/demo'), 'no broken slug route');
});

test('layout shell: dark nav without sign-in, dark footer with legal links, SEO defaults', () => {
  const { nav, footer, page } = require('../lib/layout');
  assert.ok(nav('/').includes('nav--dark'), 'dark nav');
  assert.ok(!nav('/').includes('Sign in'), 'no sign-in in nav');
  assert.ok(nav('/').includes('Create your Paigaam'), 'nav CTA');
  assert.ok(footer().includes('/privacy') && footer().includes('/terms') && footer().includes('/refund'), 'legal links');
  const html = page('T', '<main></main>', { current: '/' });
  assert.ok(html.includes('og:image'), 'OG image default');
  assert.ok(html.includes('twitter:card'), 'twitter card');
});

test('sitemap route source: includes occasions + templates, excludes admin', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(src.includes("p === '/sitemap.xml'"), 'sitemap route');
  assert.ok(src.includes("p === '/robots.txt'"), 'robots route');
  assert.ok(src.includes('Disallow: /admin'), 'robots blocks admin');
  assert.ok(src.includes("p === '/api/track'"), 'analytics endpoint');
  assert.ok(src.includes('occasionBySlug[m[1]]'), 'occasion landing route precedes template lookup');
});

test('analytics: eventInsert stores events; the /api/track route validates names', () => {
  q.eventInsert('homepage_view', { a: 1 }, '/', '');
  q.eventInsert('occasion_clicked', { occasion: 'wedding' }, '/', '');
  const events = q.eventsRecent(10).map(e => e.event);
  assert.ok(events.includes('homepage_view') && events.includes('occasion_clicked'), 'valid events stored');
  // Name validation lives in the route (server.js): only /^[a-z_]+$/ events pass.
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(src.includes('/^[a-z_]+$/'), 'route enforces event-name shape');
});

/* ============================================================
   Frictionless update (2026-09-27): trending, compact grid,
   quick preview, interactive builder.
   ============================================================ */

test('trending: picks the 2 most-engaged templates; falls back 7d → 30d → curated → newest', () => {
  const { pickTrending } = require('../lib/trending');
  const A = { slug: 'a', popularRank: 0 }, B = { slug: 'b', popularRank: 0 }, C = { slug: 'c', popularRank: 0 };
  // no data at all → newest 2 (never empty)
  assert.deepEqual(pickTrending([A, B, C]).map(t => t.slug), ['a', 'b'], 'newest fallback');
  // single template → capped, no crash
  assert.equal(pickTrending([A]).length, 1, 'single template');
  assert.equal(pickTrending([]).length, 0, 'empty registry');
  // 7-day signal wins, ordered by weighted score
  const r7 = [{ slug: 'a', event: 'template_opened', n: 3 }, { slug: 'b', event: 'template_viewed', n: 8 }];
  assert.deepEqual(pickTrending([A, B, C], r7, r7, r7).map(t => t.slug), ['b', 'a'], '7d ranking');
  // 30-day fallback when 7-day has < 2 templates
  const r7one = [{ slug: 'a', event: 'template_opened', n: 2 }];
  const r30 = [{ slug: 'a', event: 'template_opened', n: 4 }, { slug: 'c', event: 'template_opened', n: 9 }];
  assert.deepEqual(pickTrending([A, B, C], r7one, r30).map(t => t.slug), ['c', 'a'], '30d fallback');
  // time-decay: a recent burst beats a steady bigger count
  const steady = [{ slug: 'a', event: 'template_opened', n: 10 }];
  const bursty = [{ slug: 'c', event: 'template_opened', n: 6 }];
  const fresh = [{ slug: 'c', event: 'template_opened', n: 5 }];
  const picked = pickTrending([A, B, C], steady, steady, fresh);
  assert.equal(picked[0].slug, 'a', 'steady still leads (10 vs 9 weighted)');
  // unpublished templates never rank
  const ghost = [{ slug: 'ghost', event: 'template_opened', n: 99 }];
  assert.ok(!pickTrending([A, B, C], ghost, ghost, ghost).some(t => t.slug === 'ghost'), 'unknown slugs ignored');
});

test('trending: exactly 2 cards on the homepage, side by side, direct to template page', () => {
  const { pickTrending } = require('../lib/trending');
  const tpls = TEMPLATES.map(t => ({ ...t, config: { name: t.name, fields: t.fields, theme: t.theme } }));
  const rows = [{ slug: tpls[0].slug, event: 'template_opened', n: 7 }, { slug: tpls[1].slug, event: 'template_viewed', n: 4 }];
  const trending = pickTrending(tpls, rows, rows, rows);
  const html = home(tpls, { trending });
  assert.equal((html.match(/trend-card__name/g) || []).length, 2, 'exactly 2 trending cards');
  assert.ok(html.includes('id="trending"'), 'trending section present');
  assert.ok(html.includes('data-track="trending_template_clicked"'), 'trending click tracked');
  assert.ok(html.includes(`href="/templates/${tpls[0].slug}"`), 'card links directly to template page');
  // no data → section falls back to newest (still renders 2)
  const html2 = home(tpls, { trending: pickTrending(tpls, [], [], []) });
  assert.equal((html2.match(/trend-card__name/g) || []).length, 2, 'fallback still renders 2 cards');
});

test('collection: 2-up grid markup, newest first, price + description on card, sort options', () => {
  const tpls = TEMPLATES.map(t => ({ ...t, config: { name: t.name, fields: t.fields, theme: t.theme } }));
  const html = gallery(tpls, {});
  assert.ok(html.includes('cards--grid'), 'compact grid class');
  assert.ok(html.includes('tcard__desc'), 'one-line description on card');
  assert.ok(html.includes('data-slug="' + tpls[0].slug + '"'), 'newest template first (created_at DESC)');
  // sort options present
  assert.ok(html.includes('sort=price-asc') && html.includes('sort=price-desc') && html.includes('sort=popular'), 'sort options');
  // quick preview modal + tracking
  assert.ok(html.includes('id="quickPreview"'), 'quick preview modal');
  assert.ok(html.includes('data-qp='), 'cards carry quick-preview payload');
  assert.ok(html.includes('template_collection_viewed'), 'collection viewed event');
  assert.ok(html.includes('Create this Paigaam'), 'modal primary CTA');
});

test('builder: one field per step from schema, friendly prompts, no legacy form', () => {
  const { createPage } = require('../pages/create');
  const tpl = { ...TEMPLATES.find(t => t.slug === 'noor'), config: { name: 'Noor', fields: TEMPLATES.find(t => t.slug === 'noor').fields, theme: TEMPLATES.find(t => t.slug === 'noor').theme } };
  const html = createPage(tpl, null, null);
  const fields = tpl.config.fields;
  assert.equal((html.match(/bstep__q/g) || []).length, fields.length, 'one step per field');
  assert.ok(html.includes('STEP 01 OF 0' + fields.length), 'step counter');
  assert.ok(/Who is this Paigaam for\?/.test(html) || /What&#39;s the bride&#39;s name\?/.test(html), 'friendly prompt');
  assert.ok(html.includes('Preview my Paigaam') || html.includes('builder.js'), 'final CTA copy (set client-side)');
  assert.ok(!html.includes('stepbar'), 'legacy group stepbar gone');
  assert.ok(html.includes('/js/builder.js'), 'builder engine loaded');
  assert.ok(html.includes('localStorage') === false, 'no server-side localStorage assumptions');
  // boot payload carries the schema for the client
  assert.ok(html.includes('PAIGAAM_BOOT'), 'boot payload');
  // required marker only where required
  assert.ok(html.includes('(optional)'), 'optional fields marked');
});

test('builder: autosave keys + draft restore round-trip', () => {
  const { createPage } = require('../pages/create');
  const tpl = { ...TEMPLATES.find(t => t.slug === 'meher'), config: { name: 'Meher', fields: TEMPLATES.find(t => t.slug === 'meher').fields, theme: {} } };
  const draft = { recipientName: 'Meher' };
  const html = createPage(tpl, draft, 'draft123');
  assert.ok(html.includes('draft123'), 'draft id threaded');
  assert.ok(html.includes('"recipientName":"Meher"') || html.includes('Meher'), 'draft values prefilled');
});

test('builder: db has the trending aggregate query; events feed it', () => {
  q.eventInsert('template_opened', { template: 'noor' }, '/', '');
  const rows = q.eventsTemplateCounts(7);
  assert.ok(rows.some(r => r.slug === 'noor'), 'aggregate sees new events');
});

test('audio: bgm chip is hidden in preview contexts (no background sound on /templates)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'bfday', 'bgm.css'), 'utf8');
  assert.ok(css.includes('body[data-preview="true"] .bgm'), 'chip hidden when body[data-preview=true]');
  // every family render that emits the chip also emits data-preview
  const renders = fs.readdirSync(path.join(__dirname, '..', 'templates')).filter(d => fs.existsSync(path.join(__dirname, '..', 'templates', d, 'render.js')));
  for (const d of renders) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'templates', d, 'render.js'), 'utf8');
    if (src.includes('bgmMarkup')) assert.ok(src.includes('data-preview'), `${d} render must emit data-preview`);
  }
});

test('wizards: every bespoke create page has an always-visible live preview pane', () => {
  const pages = ['valentineCreate', 'lavenderCreate', 'loveCreate', 'saalgirahCreate', 'loveAwaitsCreate', 'sauwajahCreate', 'maafiCreate', 'sawaalCreate', 'bfdayCreate'];
  for (const p of pages) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'pages', p + '.js'), 'utf8');
    assert.ok(src.includes('liveFrame'), `${p} must render a live preview pane`);
  }
  // the 6 new endpoints exist and are guarded
  for (const routes of ['valentineRoutes', 'lavenderRoutes', 'saalgirahRoutes', 'loveRoutes', 'loveAwaitsRoutes', 'sauwajahRoutes']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', routes + '.js'), 'utf8');
    assert.ok(src.includes('preview-frame'), `${routes} must serve preview-frame`);
  }
});

test('mobile: hero mockup hidden on phones; collection grid switches to static art ≤560px', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'paigaam.css'), 'utf8');
  assert.ok(css.includes('.hero__device { display: none; }'), 'hero mockup hidden on mobile');
  assert.ok(css.includes(".cards--grid .tcard__frame:not(.tcard__frame--custom) .tcard__live { display: none; }"), 'live iframes off on small phones');
  assert.ok(css.includes('tcard__frame--custom'), 'custom webapp cards keep their live iframe');
});
