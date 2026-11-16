import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { list } from '../src/catalog.generated.mjs';
import { adaptTemplate, catalogPage, detailPage, builderPage, originalHomePage, originalGalleryPage, originalDetailPage, originalOccasionPage, originalOccasionsIndex, originalLegalPage, originalContactPage } from '../src/views.mjs';
import originalHome from '../../pages/home.js';
import originalGallery from '../../pages/gallery.js';
import originalDetail from '../../pages/templateDetail.js';

const entries = list.map(t => adaptTemplate(t));
const main = html => html.match(/<main\b[\s\S]*?<\/main>/)?.[0];

test('home and gallery retain the originals, original nav, CSS and 33 cards', () => {
  assert.equal(list.length, 33);
  const home = originalHomePage(list);
  const original = main(originalHome.home(entries));
  assert.equal(main(home), original.replace(`/template-view/${list[0].slug}`, `/${list[0].slug}/demo`));
  assert.match(home, /class="nav nav--dark"/);
  assert.match(home, /class="hero--dark"/);
  assert.match(home, /class="occ-card reveal"/);
  assert.match(home, /\/css\/paigaam\.css/);
  assert.match(home, /Cloudflare preview/);
  const gallery = catalogPage(list);
  assert.equal(main(gallery), main(originalGallery.gallery(entries)));
  assert.match(gallery, /class="gallery-head reveal in"/);
  assert.match(gallery, /class="filterbar"/);
  assert.match(gallery, /class="cards cards--grid"/);
  assert.equal((gallery.match(/<article class="tcard reveal"/g) || []).length, 33);
  assert.doesNotMatch(gallery, /class="collection"|class="card-art"|Personal by design/);
});

test('gallery server filters and metadata adapter use one rupee scale across surfaces', () => {
  const t = list[0];
  const row = { slug: t.slug, name: 'DB & name', price: 12900, list_price: 19900 };
  const item = adaptTemplate(t, row);
  assert.equal(item.price, 129);
  assert.equal(item.list_price, 199);
  assert.equal(item.name, 'DB & name');
  const page = originalGalleryPage([t], { q: 'DB & name', price: 'under' }, { rows: [row] });
  assert.match(page, /DB &amp; name/);
  assert.match(page, /data-price="129"/);
  assert.match(page, /₹129/);
  assert.match(originalDetailPage(t, {row}), /DB &amp; name/);
  assert.match(originalDetailPage(t, {row}), /&#8377;129/);
  assert.equal(adaptTemplate(t).category, t.config.category);
});

test('all family details preserve the original phone, detail, sticky CTA and real slug demo', () => {
  for (const t of list) {
    const html = detailPage(t);
    const expected = main(originalDetail.templateDetail(adaptTemplate(t)));
    assert.equal(main(html), expected.replace("You'll see your Paigaam come alive as you fill it in — and receive your own link to share.", 'See your Paigaam come alive as you fill it in. Publishing and sharing are unavailable in this preview.'), t.slug);
    assert.match(html, /class="phone__screen"/, t.slug);
    assert.match(html, /class="detail__actions"/, t.slug);
    assert.match(html, /class="sticky-cta"/, t.slug);
    assert.ok(html.includes(`src="/${t.slug}/demo"`), t.slug);
    assert.ok(html.includes(`href="/create/${t.slug}"`), t.slug);
    assert.doesNotMatch(html, /class="split"|class="demo"/, t.slug);
  }
});

test('original occasion and legal layouts share shell and accurate counts', () => {
  const page = originalOccasionPage('wedding', list);
  assert.match(page, /class="occ-land"/);
  assert.match(page, /class="cards cards--grid"/);
  for (const t of list.filter(x => x.config.category.toLowerCase() === 'wedding')) assert.ok(page.includes(`data-slug="${t.slug}"`), t.slug);
  assert.equal(originalOccasionPage('missing', list), null);
  assert.match(originalOccasionsIndex(list), /class="occ-grid"/);
  assert.match(originalLegalPage('privacy'), /class="legal"/);
  assert.equal(originalLegalPage('missing'), null);
  assert.match(originalContactPage(), /Contact unavailable in this preview/);
  assert.match(originalContactPage({whatsapp_number: '+91 12345'}), /https:\/\/wa\.me\/9112345/);
});

test('all builder pages retain original wizard but disable checkout and unsafe actions', () => {
  for (const t of list) {
    const page = builderPage(t, { baseUrl: 'https://preview.example', price: 199 });
    assert.match(page, /id="bfForm"/, t.slug);
    assert.match(page, /id="liveFrame"/, t.slug);
    assert.match(page, /id="publish" class="button publish" disabled/, t.slug);
    assert.match(page, /Drafts, media uploads, publishing and payments are unavailable/, t.slug);
    assert.doesNotMatch(page, /pc-inline-checkout|Secure payment via Razorpay|Checking your total/, t.slug);
    assert.match(page, /input\[type=file\]/, t.slug);
  }
});

test('views runtime graph bundles for a Worker without Node, legacy registry or database', async () => {
  const result = await build({ entryPoints: [new URL('../src/views.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
  for (const file of Object.keys(result.metafile.inputs)) assert.doesNotMatch(file, /(?:^|\/)(?:db\.js|registry\.js)$/);
  for (const entry of Object.values(result.metafile.inputs)) for (const dependency of entry.imports) assert.doesNotMatch(dependency.path, /^(?:node:|fs$)/);
});
