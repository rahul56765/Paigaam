import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { D1 } from './d1-shim.mjs';
import * as store from '../src/store.mjs';
import { handleSaalgirah, DEMO } from '../src/saalgirah.mjs';
import originalBuilder from '../../pages/saalgirahCreate.js';
import originalRenderer from '../../templates/saalgirah/render.js';
import originalSchema from '../../templates/saalgirah/schema.js';

const base = 'https://preview.example';
const get = (path, cookie) => new Request(base + path, { headers: cookie ? { Cookie: cookie } : {} });
const post = (path, body, cookie, extras = {}) => new Request(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...extras }, body: JSON.stringify(body),
});
async function fixture(t) {
  const DB = new D1(); t.after(() => DB.raw.close());
  await store.seedTemplates(DB, [{ slug: 'saalgirah', name: 'Saalgirah', price: 9900 }, { slug: 'other', name: 'Other', price: 0 }]);
  return { DB, DRAFTS_ENABLED: 'true' };
}
async function draft(env, data = { recipientName: 'Meher' }) {
  const r = await handleSaalgirah(post('/api/saalgirah/draft', { customer_data: data }), env);
  assert.equal(r.status, 200); return { ...await r.json(), cookie: r.headers.get('set-cookie').split(';')[0] };
}

test('wizard preserves original complete markup, with only preview safety modifications', async () => {
  const r = await handleSaalgirah(get('/create/saalgirah'));
  assert.equal(r.status, 200);
  let actual = await r.text();
  assert.match(actual, /Publishing and payment are unavailable/);
  assert.doesNotMatch(actual, /(?:paigaam-pay|creator-coupon)\.js/);
  assert.match(actual, /id="publish" class="button publish" disabled aria-disabled="true"/);
  // Remove precisely the preview-only wrapper changes and compare byte-for-byte.
  actual = actual.replace(/<aside role="status" style="padding:8px 20px;background:#5b1725;color:white;text-align:center;font:12px\/1\.45 system-ui">Cloudflare preview · Publishing and payments are unavailable\. Draft saving is disabled by default\.<\/aside>/, '')
    .replace('<button type="button" id="publish" class="button publish" disabled aria-disabled="true">Publishing unavailable</button>', '<button type="button" id="publish" class="button publish">Publish this Paigaam</button>')
    .replace('<p class="hint">Publishing and payment are unavailable in this preview.</p>', '<p class="hint">Free. The link stays live; only you can edit it before publishing.</p>')
    .replace('\n\n<link rel="stylesheet" href="/css/builder-shell.css?v=12">', '\n<script src="/js/creator-coupon.js?v=6" defer></script>\n<link rel="stylesheet" href="/css/builder-shell.css?v=12">')
    .replace('<script src="/saalgirah/create.js?v=3&release=creator-20261028" defer></script>\n\n', '<script src="/saalgirah/create.js?v=3&release=creator-20261028" defer></script>\n<script src="/js/paigaam-pay.js?v=2&release=checkout-coupon-20261029" defer></script>\n')
    .replace(/<script>\(function\(\)\{function lock\(\)[\s\S]*?\}\)\(\);<\/script>/, '');
  assert.equal(actual, originalBuilder.saalgirahCreatePage({ price: 0, listPrice: 0 }));
  for (const [name, max] of Object.entries(originalSchema.FIELDS)) assert.match(actual, new RegExp(`id="${name}" name="${name}" maxlength="${max}"`));
  assert.equal((actual.match(/data-step="[0-4]" class="step"/g) || []).length, 5);
  assert.match(actual, /\/saalgirah\/create\.js\?v=3/);
  const frontend = readFileSync(new URL('../../public/saalgirah/create.js', import.meta.url), 'utf8');
  for (const field of Object.keys(originalSchema.FIELDS)) assert.ok(frontend.includes(`'${field}'`));
  assert.match(frontend, /\/saalgirah\/preview-frame\?t=/);
});

test('demo and valid or invalid live previews are byte-for-byte original renderer output', async () => {
  const opts = { baseUrl: base, isPreview: true };
  let r = await handleSaalgirah(get('/saalgirah/demo'));
  assert.equal(await r.text(), originalRenderer.renderLetter({ customer_data: DEMO }, opts));
  const input = { recipientName: ' Zoë ', senderName: 'Ray', line1: 'Hello', line2: 'again', line3: '!', attentionLine: 'Look', wishLine: 'Yay', closingLine: 'Love', note: 'One\r\nTwo', ignored: 'ignored' };
  r = await handleSaalgirah(get('/saalgirah/preview-frame?d=' + encodeURIComponent(JSON.stringify(input))));
  assert.equal(await r.text(), originalRenderer.renderLetter({ customer_data: originalSchema.validate(input) }, opts));
  for (const invalid of ['{', '{}', JSON.stringify({ recipientName: 'M', line1: 123 })]) {
    r = await handleSaalgirah(get('/saalgirah/preview-frame?d=' + encodeURIComponent(invalid)));
    assert.equal(await r.text(), originalRenderer.renderLetter({ customer_data: originalSchema.validate(DEMO) }, opts));
  }
  r = await handleSaalgirah(get('/saalgirah/preview-frame?d=' + 'x'.repeat(16385)));
  assert.equal(r.status, 413);
});

test('all user fields are escaped in renderer, including HTML, metadata and multiline note', async () => {
  const payload = `</script><img src=x onerror="alert('x')">&`;
  const input = Object.fromEntries(Object.keys(originalSchema.FIELDS).map(k => [k, payload]));
  const r = await handleSaalgirah(get('/saalgirah/preview-frame?d=' + encodeURIComponent(JSON.stringify(input))));
  const text = await r.text();
  assert.ok(text.includes('&lt;/script&gt;&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'));
  assert.ok(!text.includes(payload));
  assert.match(r.headers.get('cache-control'), /no-store/);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.match(text, /data-scene="envelope"/);
  assert.match(text, /data-scene="reveal"/);
  assert.match(text, /data-scene="birthday"/);
  assert.match(text, /data-scene="love"/);
});

test('draft opt-in uses isolated cookie owner and exact original validation, without sharing metadata', async t => {
  const env = await fixture(t), d = await draft(env, { recipientName: ' Meher ', unknown: 'no' });
  assert.match(d.id, /^[a-f0-9]{18}$/);
  const stored = await store.getInvite(env.DB, d.id);
  assert.deepEqual(stored.customer_data, originalSchema.validate({ recipientName: ' Meher ', unknown: 'no' }));
  assert.notEqual(stored.owner_hash, d.cookie.split('=')[1]);
  assert.equal((await handleSaalgirah(get(d.previewUrl), env)).status, 403);
  const other = await draft(env, { recipientName: 'Someone' });
  assert.equal((await handleSaalgirah(get(d.previewUrl, other.cookie), env)).status, 403);
  let r = await handleSaalgirah(get(d.previewUrl, d.cookie), env);
  assert.equal(await r.text(), originalRenderer.renderLetter({ customer_data: stored.customer_data }, { baseUrl: base, isPreview: true }));
  r = await handleSaalgirah(post('/api/saalgirah/draft', { id: d.id, customer_data: { recipientName: 'New' } }, other.cookie), env);
  assert.equal(r.status, 403);
  r = await handleSaalgirah(post('/api/saalgirah/draft', { id: d.id, customer_data: { recipientName: 'New', extra: 'strip' } }, d.cookie), env);
  assert.equal(r.status, 200);
  assert.deepEqual((await store.getInvite(env.DB, d.id)).customer_data, originalSchema.validate({ recipientName: 'New' }));
  for (const customer_data of [{}, { recipientName: 'X'.repeat(61) }, { recipientName: 'X\nY' }, { recipientName: 'X', note: '\u0001' }, { recipientName: 7 }]) {
    r = await handleSaalgirah(post('/api/saalgirah/draft', { customer_data }, d.cookie), env); assert.equal(r.status, 400);
  }
  const foreign = await store.createInvite(env.DB, 'other', stored.owner_hash, { recipientName: 'X' }, { maxPerOwnerTemplate24h: 1000, maxGlobal24h: 1000 });
  assert.equal((await handleSaalgirah(get('/saalgirah/preview/' + foreign.id, d.cookie), env)).status, 404);
  env.DB.raw.prepare("UPDATE invites SET status='payment_pending' WHERE id=?").run(d.id);
  assert.equal((await handleSaalgirah(post('/api/saalgirah/draft', { id: d.id, customer_data: { recipientName: 'New' } }, d.cookie), env)).status, 409);
});

test('draft default disabled, CSRF and bounded JSON, no publication or server network under any flags', async t => {
  const env = await fixture(t), d = await draft(env);
  const realFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('network called'); };
  try {
    let r = await handleSaalgirah(post('/api/saalgirah/draft', { customer_data: { recipientName: 'A' } }), { DB: env.DB });
    assert.equal(r.status, 503); assert.equal((await r.json()).error, 'drafts_offline');
    r = await handleSaalgirah(post('/api/saalgirah/draft', { id: d.id, customer_data: { recipientName: 'A' } }, d.cookie, { Origin: 'https://evil.example' }), env);
    assert.equal(r.status, 403);
    r = await handleSaalgirah(post('/api/saalgirah/draft', { customer_data: { recipientName: 'A' }, padding: 'x'.repeat(17000) }), env);
    assert.equal(r.status, 413);
    r = await handleSaalgirah(post('/api/saalgirah/publish', { id: d.id }, d.cookie), { ...env, CHECKOUT_ENABLED: 'true', ALLOW_LIVE_PAYMENTS: 'true' });
    assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
    assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
    assert.equal(await store.getOrderForInvite(env.DB, d.id), null);
    assert.equal((await handleSaalgirah(post('/api/saalgirah/publish', { id: d.id }, d.cookie, { 'Sec-Fetch-Site': 'cross-site' }), env)).status, 403);
    assert.equal((await handleSaalgirah(post('/api/saalgirah/publish', { id: d.id, padding: 'x'.repeat(17000) }, d.cookie), env)).status, 413);
  } finally { globalThis.fetch = realFetch; }
});

test('namespace unknowns and wrong methods fail closed, unrelated routes return null', async () => {
  for (const path of ['/saalgirah', '/saalgirah/nothing', '/saalgirah/preview/nope/extra', '/create/saalgirah/extra', '/api/saalgirah', '/api/saalgirah/upload']) {
    assert.equal((await handleSaalgirah(get(path))).status, 404, path);
  }
  assert.equal((await handleSaalgirah(post('/saalgirah/demo', {}))).status, 404);
  assert.equal(await handleSaalgirah(get('/p/some-slug')), null);
  assert.equal(await handleSaalgirah(get('/unrelated')), null);
});
