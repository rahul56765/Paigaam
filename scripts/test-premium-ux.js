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
