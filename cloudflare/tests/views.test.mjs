import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { list } from '../src/catalog.generated.mjs';
import { adaptTemplate, catalogPage, detailPage, builderPage, originalHomePage, originalGalleryPage, originalDetailPage, originalOccasionPage, originalOccasionsIndex, originalLegalPage, originalContactPage } from '../src/views.mjs';
import originalHome from '../../pages/home.js';
import originalGallery from '../../pages/gallery.js';
import originalDetail from '../../pages/templateDetail.js';
import originalBuilder from '../../pages/bfdayCreate.js';

const entries = list.map(t => adaptTemplate(t));
const main = html => html.match(/<main\b[\s\S]*?<\/main>/)?.[0];
const scriptSources = html => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m => m[1]);
const jsonBlock = (html, id) => JSON.parse(html.match(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`))[1]);
const template = slug => list.find(t => t.slug === slug);

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
    assert.match(page, /Orders and publishing are unavailable/, t.slug);
    assert.doesNotMatch(page, /pc-inline-checkout|Secure payment via Razorpay|Checking your total/, t.slug);
    assert.match(page, /input\[type=file\]/, t.slug);
  }
});

test('default builders remain byte-for-byte the previous preview for the whole catalogue', () => {
  // Recorded at safety commit 36541f3, with a fixed shell BASE_URL.
  const previous = process.env.BASE_URL;
  try {
    process.env.BASE_URL = 'https://paigaam.cc';
    const hash = createHash('sha256');
    for (const t of list) {
      const html = builderPage(t);
      hash.update(`${t.slug}\0${Buffer.byteLength(html)}\0`).update(html);
    }
    assert.equal(hash.digest('hex'), '6bc6f02065aa57b17edbd5d131bbc0ac05bf3835b7ef1eb2e84c5985354e7800');
  } finally {
    if (previous === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = previous;
  }
});

test('an enabled free builder retains every free source wizard, accessible hints and same-origin scripts', () => {
  const free = list.filter(t => t.config.price === 0);
  assert.equal(free.length, 29);
  for (const t of free) {
    const originalConfig = JSON.stringify(t.config);
    const options = { baseUrl: 'http://localhost:8787/a/path', enableFreeBuilder: true, price: 0 };
    const page = builderPage(t, options);
    const original = originalBuilder.bfdayCreatePage({ ...t, config: { ...t.config } }, options)
      .replace(/https:\/\/paigaam\.cc(?=[\/"<])/g, 'http://localhost:8787');
    const expectedMain = main(original)
      .replace('<button type="button" id="publish" class="button publish" >', '<button type="button" id="publish" class="button publish" aria-describedby="free-publish-hint">')
      .replace('<p class="hint">Free. The link stays live; only you can edit it before publishing.</p>', '<p class="hint" id="free-publish-hint">Free. The link stays live; only you can edit it before publishing.</p>');
    assert.equal(main(page), expectedMain, `${t.slug}: the original template-specific wizard is retained`);
    assert.equal(JSON.stringify(t.config), originalConfig, `${t.slug}: source config is not mutated`);
    const spec = jsonBlock(page, 'bfSpec');
    assert.equal(spec.slug, t.slug);
    assert.equal(spec.price, 0);
    assert.deepEqual(spec.fields, jsonBlock(original, 'bfSpec').fields, `${t.slug}: original field spec with local origin`);
    assert.match(page, /<h2 tabindex="-1">Ready to send<\/h2>/, t.slug);
    const publish = page.match(/<button\b[^>]*\bid="publish"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(publish, t.slug);
    assert.match(publish, /aria-describedby="free-publish-hint"[^>]*>Publish this Paigaam<\/button>/, t.slug);
    assert.doesNotMatch(publish, /\sdisabled(?:\s|=|>)|aria-disabled/, t.slug);
    assert.match(page, /<p class="hint" id="free-publish-hint">Free\./, t.slug);
    assert.match(page, /<span class="opt">optional<\/span>/, t.slug);
    assert.match(page, /id="progress" aria-label="Progress"/, t.slug);
    assert.match(page, /aria-label="Live preview"/, t.slug);
    assert.match(page, /id="formError" class="error" role="alert"/, t.slug);
    assert.match(page, /id="status" class="status" role="status" aria-live="polite"/, t.slug);
    assert.match(page, /id="publishedResult"[^>]*hidden aria-labelledby="resultTitle"/, t.slug);
    for (const f of t.fields.filter(f => f.required && ['text', 'bgm', 'url', 'date', 'number', 'textarea', 'select'].includes(f.type))) {
      assert.ok(page.includes(`id="f-${f.id}" name="${f.id}" data-field="${f.id}" required aria-required="true"`), `${t.slug}: required indicator for ${f.id}`);
    }
    for (const f of t.fields.filter(f => f.hint && ['text', 'bgm', 'url', 'date', 'number', 'textarea', 'select'].includes(f.type))) {
      assert.ok(page.includes(`aria-describedby="f-${f.id}-hint"`), `${t.slug}: hint association for ${f.id}`);
      assert.ok(page.includes(`id="f-${f.id}-hint"`), `${t.slug}: visible hint for ${f.id}`);
    }
    assert.doesNotMatch(page, /Cloudflare preview · Orders|Publishing unavailable|Drafts, media uploads and checkout are disabled|Uploads are unavailable in this preview|function lock\(\)/, t.slug);
    assert.doesNotMatch(page, /pc-inline-checkout|Secure payment via Razorpay|Checking your total/, t.slug);
    assert.doesNotMatch(page, /creator-coupon\.css/, t.slug);
    const scripts = scriptSources(page);
    const expectedScripts = scriptSources(original).filter(src => !/^\/js\/(?:creator-coupon|welcome-back|paigaam-pay)\.js(?:\?|$)/.test(src));
    assert.deepEqual(scripts, expectedScripts, `${t.slug}: preserve original editor and QR scripts, remove payment/coupon scripts`);
    assert.ok(scripts.every(src => src.startsWith('/')), `${t.slug}: client scripts remain same-origin`);
    assert.ok(scripts.some(src => src.startsWith('/js/qr-card.js')), t.slug);
    assert.ok(scripts.some(src => /^\/(?:bfday\/create\.js|(?:love-letter|anniversary-blue)\/editor\.js)/.test(src)), t.slug);
    assert.match(page, /<meta property="og:url" content="http:\/\/localhost:8787">/, t.slug);
    assert.match(page, /<meta name="robots" content="noindex,?\s*nofollow">/, t.slug);
  }
});

test('the server-only free opt-in requires an own literal true and an own numeric zero', () => {
  const t = template('sealed-with-a-kiss'); // config itself is free: it must not be a fallback for the gate
  const baseUrl = 'http://localhost:8787';
  const cases = [
    ['missing price', { enableFreeBuilder: true }],
    ['undefined', { enableFreeBuilder: true, price: undefined }],
    ['null', { enableFreeBuilder: true, price: null }],
    ['empty string', { enableFreeBuilder: true, price: '' }],
    ['string zero', { enableFreeBuilder: true, price: '0' }],
    ['false', { enableFreeBuilder: true, price: false }],
    ['NaN', { enableFreeBuilder: true, price: NaN }],
    ['paid', { enableFreeBuilder: true, price: 199 }],
    ['negative', { enableFreeBuilder: true, price: -1 }],
    ['missing flag', { price: 0 }],
    ['false flag', { enableFreeBuilder: false, price: 0 }],
    ['string flag', { enableFreeBuilder: 'true', price: 0 }],
    ['numeric flag', { enableFreeBuilder: 1, price: 0 }],
    ['query parameters', Object.fromEntries(new URLSearchParams('enableFreeBuilder=true&price=0'))],
  ];
  for (const [name, options] of cases) {
    const page = builderPage(t, baseUrl, options);
    assert.match(page, /id="publish" class="button publish" disabled aria-disabled="true"/, name);
    assert.match(page, /Cloudflare preview · Orders and publishing are unavailable/, name);
    assert.match(page, /function lock\(\)/, name);
    const { enableFreeBuilder, ...withoutFlag } = options;
    assert.equal(page, builderPage(t, baseUrl, withoutFlag), `${name}: exact legacy preview output`);
  }
  const inheritedPrice = Object.assign(Object.create({ price: 0 }), { enableFreeBuilder: true });
  const inheritedFlag = Object.assign(Object.create({ enableFreeBuilder: true }), { price: 0 });
  const bothInherited = Object.create({ enableFreeBuilder: true, price: 0 });
  for (const options of [inheritedPrice, inheritedFlag, bothInherited]) {
    assert.match(builderPage(t, baseUrl, options), /id="publish" class="button publish" disabled aria-disabled="true"/);
  }
  const explicit = Object.assign(Object.create(null), { enableFreeBuilder: true, price: 0 });
  assert.match(builderPage(t, baseUrl, explicit), /id="publish" class="button publish" aria-describedby="free-publish-hint"/);
  assert.equal(builderPage(t, baseUrl, explicit), builderPage(t, { ...explicit, baseUrl }));
  assert.match(builderPage(t, baseUrl + '/create?enableFreeBuilder=true&price=0'), /id="publish" class="button publish" disabled aria-disabled="true"/);
  let reads = 0;
  const changingPrice = { enableFreeBuilder: true, get price() { return ++reads === 1 ? 0 : 199; } };
  const pinned = builderPage(t, baseUrl, changingPrice);
  assert.equal(jsonBlock(pinned, 'bfSpec').price, 0, 'rendered price is pinned after the exact-zero check');
  assert.doesNotMatch(pinned, /pc-inline-checkout|paigaam-pay\.js|creator-coupon\.js/);
  for (const paid of list.filter(item => item.config.price > 0)) {
    const page = builderPage(paid, { baseUrl, enableFreeBuilder: true, price: paid.config.price });
    assert.match(page, /id="publish" class="button publish" disabled aria-disabled="true"/, paid.slug);
    assert.doesNotMatch(page, /pc-inline-checkout|paigaam-pay\.js|creator-coupon\.js/, paid.slug);
  }
  // The supplied server price is authoritative, not a possibly stale source config.
  const changedPrice = template('little-love');
  assert.ok(changedPrice.config.price > 0);
  assert.match(builderPage(changedPrice, { baseUrl, enableFreeBuilder: true, price: 0, listPrice: 99 }), /id="publish" class="button publish" aria-describedby="free-publish-hint"/);
});

test('free builder uses the local serving origin even with a different shell BASE_URL', () => {
  const previous = process.env.BASE_URL;
  try {
    process.env.BASE_URL = 'https://other.example';
    const page = builderPage(template('diwali-deep'), { enableFreeBuilder: true, price: 0, baseUrl: 'http://localuser:localpass@localhost:8787/ignored?x=1' });
    assert.match(page, /<meta property="og:url" content="http:\/\/localhost:8787">/);
    assert.match(page, /<meta property="og:image" content="http:\/\/localhost:8787\/brand\/og-default\.png">/);
    assert.match(page, /<meta name="twitter:image" content="http:\/\/localhost:8787\/brand\/og-default\.png">/);
    assert.doesNotMatch(page, /localuser|localpass|other\.example/);
  } finally {
    if (previous === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = previous;
  }
});

test('untrusted resume data and field labels stay escaped in the enabled wizard', () => {
  const t = template('sealed-with-a-kiss');
  const payload = '</script><script>globalThis.attacked=1</script><img src=x onerror=alert(1)>';
  const edited = { ...t, fields: t.fields.map((f, i) => i === 0 ? { ...f, label: payload, hint: payload } : f) };
  const originalLink = 'https://paigaam.cc/p/original-user-link';
  const page = builderPage(edited, {
    enableFreeBuilder: true, price: 0, baseUrl: 'http://localhost:8787',
    resumeDraft: { id: payload, customer_data: { senderName: payload, note: originalLink }, updated_at: '2026-01-01 12:00:00' },
  });
  assert.doesNotMatch(page, /<script>globalThis\.attacked=1<\/script>|<img src=x onerror=alert\(1\)>/);
  assert.match(page, /&lt;\/script&gt;&lt;script&gt;globalThis\.attacked=1/);
  const spec = jsonBlock(page, 'bfSpec');
  assert.equal(spec.fields[0].label, payload);
  const boot = jsonBlock(page, 'wizardBoot');
  assert.equal(boot.draftId, payload);
  assert.equal(boot.data.senderName, payload);
  assert.equal(boot.data.note, originalLink, 'local-origin adaptation must not rewrite a sender’s saved data');
  assert.ok(scriptSources(page).some(src => src.startsWith('/js/resume.js')));
  const badOrigin = builderPage(t, { enableFreeBuilder: true, price: 0, baseUrl: 'https://localhost"><script>globalThis.attacked=1</script>' });
  assert.doesNotMatch(badOrigin, /<script>globalThis\.attacked=1<\/script>/);
});

test('views runtime graph bundles for a Worker without Node, legacy registry or database', async () => {
  const result = await build({ entryPoints: [new URL('../src/views.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
  for (const file of Object.keys(result.metafile.inputs)) assert.doesNotMatch(file, /(?:^|\/)(?:db\.js|registry\.js)$/);
  for (const entry of Object.values(result.metafile.inputs)) for (const dependency of entry.imports) assert.doesNotMatch(dependency.path, /^(?:node:|fs$)/);
});
