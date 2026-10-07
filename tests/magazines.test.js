'use strict';
// In-process tests with a mocked Canva API. No real credentials or network. Run: node --test tests/magazines.test.js
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const test = require('node:test'), assert = require('node:assert/strict');
const { createCanvaMock, pngBuffer, goodDataset } = require('./helpers/canvaMock');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-mag-unit-'));
let mock;
const waitFor = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { const v = fn(); if (v) return v; if (Date.now() > end) throw new Error('timeout waiting'); await new Promise(r => setTimeout(r, 15)); } };
let store, client, validate, generate, registry, storage, box, imageLib;

test.before(async () => {
  mock = await createCanvaMock({ dataset: {} });
  Object.assign(process.env, {
    DATA_DIR: DATA, CANVA_TEST_MODE: '1', CANVA_API_BASE: mock.apiBase, CANVA_AUTHORIZE_URL: mock.base + '/authorize',
    CANVA_POLL_MS: '10', CANVA_JOB_TIMEOUT_MS: '4000', CANVA_RETRY_AFTER_CAP_MS: '20',
    CANVA_CLIENT_ID: 'test-client', CANVA_CLIENT_SECRET: 'test-secret', CANVA_TOKEN_ENCRYPTION_KEY: 'x'.repeat(40) + 'unit-test-key',
  });
  store = require('../lib/magazines/store'); client = require('../lib/magazines/canvaClient'); validate = require('../lib/magazines/validate');
  generate = require('../lib/magazines/generate'); registry = require('../lib/magazines/registry'); storage = require('../lib/magazines/storage');
  box = require('../lib/magazines/secretbox'); imageLib = require('../lib/magazines/image');
  store.ensureTemplateRows(registry.MAGAZINES);
});
test.after(async () => { await mock.close(); fs.rmSync(DATA, { recursive: true, force: true }); setImmediate(() => process.exit(0)); });

const M = () => registry.bySlug('birthday-collage');

/* ---------------- mapping validation ---------------- */
test('mapping validation: matches, missing, type mismatch and unmapped fields', () => {
  const m = M();
  assert.equal(validate.compareDataset(m, goodDataset(m)).ok, true);
  const ds = goodDataset(m); delete ds.photo_9; ds.photo_2 = { type: 'text' }; ds.surprise = { type: 'image' };
  const r = validate.compareDataset(m, ds);
  assert.equal(r.ok, false);
  const codes = r.problems.map(p => `${p.code}:${p.field}`).sort();
  assert.deepEqual(codes, ['missing_in_canva:photo_9', 'type_mismatch:photo_2', 'unmapped_in_canva:surprise']);
  assert.equal(validate.compareDataset(m, null).ok, false);
});

test('Birthday Story maps exactly 24 live fields; 19 required photo slots and one logical wish to three Canva text targets', () => {
  const m = registry.bySlug('birthday-story');
  assert.ok(m); assert.equal(m.pageCount, 7); assert.equal(m.canvaTemplateId, 'EAHXVwHhiXs');
  assert.equal(m.images.length, 19); assert.deepEqual(validate.missingImages(m, []).length, 19);
  const ds = goodDataset(m);
  assert.equal(Object.keys(ds).length, 24);
  assert.equal(validate.compareDataset(m, ds).ok, true);
  delete ds.photo_19; ds.wish_line_2 = { type: 'image' }; ds.unmapped = { type: 'text' };
  const result = validate.compareDataset(m, ds);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems.map(p => `${p.code}:${p.field}`).sort(), [
    'missing_in_canva:photo_19', 'type_mismatch:wish_line_2', 'unmapped_in_canva:unmapped',
  ]);
});

test('one Birthday Story wish is split across all three text fields without losing words', () => {
  const m = registry.bySlug('birthday-story');
  const text = 'Happy birthday to my favorite person. I love you so much and wish you joy!';
  const valid = validate.validateFields(m, { wish: text, letter_page3: 'A'.repeat(450), letter_page7: 'B'.repeat(900) });
  assert.equal(valid.ok, true);
  const data = validate.canvaText(m, valid.values);
  const pieces = ['wish_line_1', 'wish_line_2', 'wish_line_3'].map(k => data[k]);
  assert.equal(pieces.join(' '), text);
  assert.ok(pieces.every(p => p.length <= 32));
  assert.deepEqual(validate.canvaText(m, { wish: '', letter_page3: 'A', letter_page7: 'B' }).wish_line_1,
    'I hope this year brings growth,');
  assert.equal(validate.validateFields(m, { wish: 'x'.repeat(91), letter_page3: 'a', letter_page7: 'b' }).errors.wish, 'too_long');
  assert.equal(validate.validateFields(m, { wish: '', letter_page3: '', letter_page7: '' }).errors.letter_page3, 'required');
  assert.equal(validate.validateFields(m, { wish: '', letter_page3: 'x'.repeat(451), letter_page7: 'b' }).errors.letter_page3, 'too_long');
  assert.equal(validate.validateFields(m, { wish: '', letter_page3: 'a', letter_page7: 'x'.repeat(901) }).errors.letter_page7, 'too_long');
});

test('Birthday Story long letter fields render as textareas', () => {
  const views = require('../lib/magazines/views');
  const html = views.formPage(registry.bySlug('birthday-story'));
  assert.match(html, /<textarea data-field="letter_page3" maxlength="450"/);
  assert.match(html, /<textarea data-field="letter_page7" maxlength="900"/);
  assert.match(html, /<input type="text" data-field="wish" maxlength="90"/);
  assert.equal((html.match(/class="mag-slot" data-slot=/g) || []).length, 19);
});

test('required/optional text fields, limits, control characters, unknown keys', () => {
  const m = M();
  assert.equal(validate.validateFields(m, {}).ok, true); // headline is optional
  const long = validate.validateFields(m, { headline: 'x'.repeat(25) }); assert.equal(long.errors.headline, 'too_long');
  const clean = validate.validateFields(m, { headline: '  Happy\u0000   ​Birthday  ', evil: '<script>' });
  assert.equal(clean.values.headline, 'Happy Birthday'); assert.equal('evil' in clean.values, false);
  assert.equal(validate.canvaText(m, { headline: '' }).headline, 'HAPPY BIRTHDAY'); // blank falls back to design default
  const req = { ...m, fields: [{ ...m.fields[0], required: true }] };
  assert.equal(validate.validateFields(req, { headline: '' }).errors.headline, 'required');
  assert.deepEqual(validate.missingImages(m, [{ slot: 'photo_1' }]).length, 8);
});

test('preview helper: unknown/hostile slugs resolve to nothing', () => {
  const preview = require('../lib/magazines/preview');
  assert.equal(preview.find('birthday-collage'), null);
  assert.equal(preview.find('../etc/passwd'), null);
  assert.equal(typeof preview.refresh, 'function');
});

test('image sniffing trusts contents, not claimed type', () => {
  assert.equal(imageLib.sniffImage(pngBuffer(500, 400)).mime, 'image/png');
  assert.equal(imageLib.sniffImage(Buffer.from('this is plainly not an image at all, just text')), null);
  assert.equal(imageLib.sniffImage(Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.alloc(64)])), null);
});

test('page scripts are syntactically valid JavaScript and pages escape user-controlled text', () => {
  const vm = require('node:vm'); const views = require('../lib/magazines/views');
  const m = M();
  const order = { id: 'a'.repeat(32), status: 'generating', error_code: null };
  for (const html of [views.formPage(m), views.resultPage(order, m, { owner: true, ready: {} }),
    views.resultPage({ ...order, status: 'failed', error_code: 'canva_timeout' }, m, { owner: true, ready: {} }),
    views.resultPage({ ...order, status: 'ready' }, m, { owner: false, ready: { png: true } })]) {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
    assert.ok(scripts.length >= 1);
    for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code), 'inline script compiles');
  }
  const evil = { ...m, name: '<img src=x onerror=alert(1)>' };
  assert.ok(!views.formPage(evil).includes('<img src=x'));
  assert.ok(!views.resultPage(order, evil, { owner: true, ready: {} }).includes('<img src=x'));
});

/* ---------------- secrets ---------------- */
test('token sealing: round-trips, is authenticated, needs a long key', () => {
  const s = box.seal('refresh-token-value');
  assert.ok(s.startsWith('v1:') && !s.includes('refresh-token-value'));
  assert.equal(box.open(s), 'refresh-token-value');
  const parts = s.split(':'); parts[3] = Buffer.from('tampered').toString('base64');
  assert.throws(() => box.open(parts.join(':')));
  const old = process.env.CANVA_TOKEN_ENCRYPTION_KEY; process.env.CANVA_TOKEN_ENCRYPTION_KEY = 'short';
  assert.throws(() => box.seal('x')); process.env.CANVA_TOKEN_ENCRYPTION_KEY = old;
});

/* ---------------- OAuth (PKCE) + refresh rotation ---------------- */
test('OAuth: PKCE S256 + state, least-privilege scopes, single-use state, sealed storage', async () => {
  const url = new URL(client.beginAuthorization({ baseUrl: 'https://paigaam.example', adminId: 'admin-1' }));
  assert.equal(url.origin + url.pathname, mock.base + '/authorize');
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://paigaam.example/admin/canva/callback');
  assert.deepEqual(url.searchParams.get('scope').split(' ').sort(), ['asset:read', 'asset:write', 'brandtemplate:content:read', 'brandtemplate:meta:read', 'design:content:read', 'design:content:write', 'design:meta:read', 'profile:read']);
  const state = url.searchParams.get('state');
  mock.st.challenge = url.searchParams.get('code_challenge');

  await assert.rejects(client.completeAuthorization({ code: 'good-code', state: 'forged', baseUrl: 'https://paigaam.example', adminId: 'admin-1' }), /oauth_state_invalid/);
  await assert.rejects(client.completeAuthorization({ code: 'good-code', state, baseUrl: 'https://paigaam.example', adminId: 'someone-else' }), /oauth_state_invalid/); // state is admin-bound (and now consumed)
  const url2 = new URL(client.beginAuthorization({ baseUrl: 'https://paigaam.example', adminId: 'admin-1' }));
  mock.st.challenge = url2.searchParams.get('code_challenge'); mock.st.shortLived = true;
  await client.completeAuthorization({ code: 'good-code', state: url2.searchParams.get('state'), baseUrl: 'https://paigaam.example', adminId: 'admin-1' });
  await assert.rejects(client.completeAuthorization({ code: 'good-code', state: url2.searchParams.get('state'), baseUrl: 'https://paigaam.example', adminId: 'admin-1' }), /oauth_state_invalid/); // replay

  const row = store.getConnection();
  assert.equal(row.account_label, 'Paigaam Studio');
  for (const col of [row.access_enc, row.refresh_enc]) assert.ok(col.startsWith('v1:') && !/AT-|RT-/.test(col));
  assert.equal(store.isConnected(), true);
});

test('refresh tokens rotate, are replaced atomically, and concurrent callers share one refresh', async () => {
  // Force "about to expire" so the next calls must refresh.
  require('../db').db.prepare('UPDATE canva_connection SET expires_at=? WHERE id=1').run(Date.now() + 5000);
  const oldRefresh = mock.st.tokens.refresh;
  const before = mock.st.refreshCalls;
  const results = await Promise.all([client.getDataset('T1'), client.getDataset('T1'), client.getDataset('T1')]);
  assert.equal(results.length, 3);
  assert.equal(mock.st.refreshCalls - before, 1); // mutex: one refresh for three concurrent calls
  const row = store.getConnection();
  assert.equal(box.open(row.refresh_enc), mock.st.tokens.refresh); // rotated refresh token persisted
  assert.ok(mock.st.tokens.refresh !== oldRefresh);
  assert.ok(!mock.st.validRefresh.has(oldRefresh)); // the old refresh token is dead; only the rotated one works
  mock.st.shortLived = false;
});

test('429 responses honour Retry-After then succeed; failures map to safe codes', async () => {
  mock.st.rateLimitNext = 2;
  await client.getDataset('T1');
  mock.st.rateLimitNext = 0;
  await assert.rejects(client.getAutofill('does-not-exist'), (e) => e.code === 'canva_not_found' && e.retryable === false && !/does-not-exist/.test(e.message));
  assert.match(client.safeMessage('anything_unknown'), /try again/i);
});

/* ---------------- generation pipeline ---------------- */
function seedOrder(slug = 'birthday-collage', fields = { headline: '' }) {
  const m = registry.bySlug(slug);
  const order = store.createOrder(slug, store.hashOwner(crypto.randomBytes(32).toString('hex')));
  store.patchOrder(order.id, { fields_json: JSON.stringify(fields) });
  const dir = storage.uploadsDir(order.id);
  for (const s of m.images) {
    const filename = crypto.randomBytes(8).toString('hex') + '.png';
    fs.writeFileSync(path.join(dir, filename), pngBuffer(420, 420));
    store.putUpload(order.id, s.key, { filename, mime: 'image/png', bytes: 100, width: 420, height: 420 });
  }
  return order.id;
}
const publish = (slug) => { const m = registry.bySlug(slug); mock.st.dataset = goodDataset(m); store.saveValidation(slug, validate.compareDataset(m, mock.st.dataset)); store.setTemplateStatus(slug, 'published'); };

test('happy path: preparing→uploading→generating→exporting→ready; asset ids (not URLs); new design; durable files', async () => {
  publish('birthday-collage');
  const id = seedOrder();
  const seen = new Set();
  const poll = setInterval(() => seen.add(store.getOrder(id).status), 3);
  const r = generate.start(id); assert.equal(r.started, true);
  await waitFor(() => store.getOrder(id).status === 'ready'); clearInterval(poll);
  const o = store.getOrder(id);
  assert.equal(mock.st.uploads.length, 9);
  assert.ok(mock.st.uploads.every(u => u.magic === '89504e47')); // real image bytes were sent
  assert.equal(mock.st.autofills.length, 1);
  const body = mock.st.autofills[0];
  assert.equal(body.brand_template_id, 'EAHXVxrdrCk');
  assert.equal(body.data.headline.text, 'HAPPY BIRTHDAY');
  for (let i = 1; i <= 9; i++) { const f = body.data['photo_' + i]; assert.equal(f.type, 'image'); assert.match(f.asset_id, /^ASSET\d+$/); assert.equal(JSON.stringify(f).includes('http'), false); }
  assert.deepEqual(mock.st.exports.map(e => e.format.type).sort(), ['pdf', 'png']); // single page => PNG offered
  assert.equal(o.design_id, 'DESIGN1');
  const pdf = fs.readFileSync(path.join(DATA, 'magazines', 'output', id, o.pdf_file));
  assert.equal(pdf.slice(0, 5).toString(), '%PDF-');
  assert.equal(fs.readFileSync(path.join(DATA, 'magazines', 'output', id, o.png_file)).readUInt32BE(0), 0x89504E47);
  assert.equal(fs.existsSync(path.join(DATA, 'magazines', 'uploads', id)), false); // reader photos deleted once ready
  for (const s of ['preparing', 'uploading', 'generating']) assert.ok(seen.has(s) || s === 'preparing', 'saw state ' + s);
  assert.ok(!mock.st.calls.some(c => /PATCH|PUT|DELETE/.test(c))); // never modifies existing designs
});

test('duplicate submissions start exactly one generation', async () => {
  const id = seedOrder();
  const before = mock.st.autofills.length;
  const results = [generate.start(id), generate.start(id), generate.start(id)];
  assert.equal(results.filter(r => r.started).length, 1);
  await waitFor(() => store.getOrder(id).status === 'ready');
  assert.equal(mock.st.autofills.length - before, 1);
  assert.equal(generate.start(id).started, false); // ready: no-op
});

test('failed export: order fails recoverably, retry resumes WITHOUT a second design or re-upload', async () => {
  const id = seedOrder();
  mock.st.failNext.download = 1;
  const a0 = mock.st.autofills.length, u0 = mock.st.uploads.length;
  generate.start(id);
  await waitFor(() => store.getOrder(id).status === 'failed');
  let o = store.getOrder(id);
  assert.equal(o.error_code, 'download_failed'); assert.equal(o.error_stage, 'exporting');
  assert.ok(o.design_id, 'design id was saved before the failure');
  assert.equal(fs.existsSync(path.join(DATA, 'magazines', 'uploads', id)), true); // inputs preserved for retry
  assert.equal(store.orderFields(o).headline, ''); // form data preserved
  assert.equal(generate.start(id).started, true);
  await waitFor(() => store.getOrder(id).status === 'ready');
  assert.equal(mock.st.autofills.length - a0, 1); assert.equal(mock.st.uploads.length - u0, 9);
  assert.equal(store.getOrder(id).attempts, 2);
});

test('failed Canva autofill job: safe error, retry creates a fresh job; asset uploads are reused', async () => {
  const id = seedOrder();
  mock.st.failNext.autofillJob = 1;
  const u0 = mock.st.uploads.length, a0 = mock.st.autofills.length;
  generate.start(id);
  await waitFor(() => store.getOrder(id).status === 'failed');
  const o = store.getOrder(id);
  assert.equal(o.error_code, 'canva_job_failed'); assert.equal(o.error_stage, 'generating');
  assert.equal(JSON.stringify(o).includes('autofill_error'), false); // provider payload never stored
  assert.equal(generate.start(id).started, true);
  await waitFor(() => store.getOrder(id).status === 'ready');
  assert.equal(mock.st.uploads.length - u0, 9); // uploaded once
  assert.equal(mock.st.autofills.length - a0, 2); // failed job + one new one
});

test('failed asset upload job is reported and retryable', async () => {
  const id = seedOrder(); mock.st.failNext.assetJob = 1;
  generate.start(id);
  await waitFor(() => store.getOrder(id).status === 'failed');
  assert.equal(store.getOrder(id).error_stage, 'uploading');
  assert.equal(generate.start(id).started, true);
  await waitFor(() => store.getOrder(id).status === 'ready');
});

test('start() guards: missing photos, invalid text, unpublished template, disconnected Canva', async () => {
  const m = M();
  const id = seedOrder();
  store.removeUpload(id, 'photo_4');
  let r = generate.start(id); assert.equal(r.error, 'missing_photos'); assert.deepEqual(r.details, ['photo_4']);
  const id2 = seedOrder(); store.patchOrder(id2, { fields_json: JSON.stringify({ headline: 'x'.repeat(40) }) });
  assert.equal(generate.start(id2).error, 'invalid_fields');
  store.setTemplateStatus(m.slug, 'draft');
  assert.equal(generate.start(seedOrder()).error, 'template_unavailable');
  store.setTemplateStatus(m.slug, 'published');
  const saved = store.getConnection(); const keep = { ...saved };
  store.deleteConnection();
  assert.equal(generate.start(seedOrder()).error, 'canva_not_connected');
  require('node:sqlite'); // restore connection row for later tests
  const { db } = require('../db');
  db.prepare('INSERT INTO canva_connection (id,access_enc,refresh_enc,expires_at,scopes,account_label,connected_at,updated_at) VALUES (1,?,?,?,?,?,?,?)')
    .run(keep.access_enc, keep.refresh_enc, keep.expires_at, keep.scopes, keep.account_label, keep.connected_at, keep.updated_at);
});

test('live dataset drift blocks generation and un-publishes the design', async () => {
  const m = M(); const id = seedOrder();
  mock.st.dataset = { ...goodDataset(m), photo_10: { type: 'image' } };
  generate.start(id);
  await waitFor(() => store.getOrder(id).status === 'failed');
  assert.equal(store.getOrder(id).error_code, 'template_mismatch');
  assert.equal(store.getTemplate(m.slug).status, 'draft');
  assert.equal(store.getTemplate(m.slug).validation.ok, false);
  publish(m.slug); // restore for later tests
});

test('PNG is produced only for single-page designs (multi-page: PDF only)', async () => {
  const two = { ...M(), slug: 'two-page-test', name: 'Two page', pageCount: 2, canvaTemplateId: 'TWOPAGE' };
  registry.MAGAZINES.push(two); store.ensureTemplateRows([two]); publish('two-page-test');
  mock.st.pages = 2;
  const id = seedOrder('two-page-test');
  const e0 = mock.st.exports.length;
  generate.start(id);
  await waitFor(() => store.getOrder(id).status === 'ready');
  const o = store.getOrder(id);
  assert.ok(o.pdf_file); assert.equal(o.png_file, null);
  assert.deepEqual(mock.st.exports.slice(e0).map(e => e.format.type), ['pdf']);
  mock.st.pages = 1; registry.MAGAZINES.pop();
  publish('birthday-collage');
});

test('cleanup removes abandoned drafts but never ready magazines', () => {
  const draft = seedOrder(); store.patchOrder(draft, { updated_at: 0 });
  const { db } = require('../db'); db.prepare('UPDATE magazine_orders SET updated_at=0 WHERE id=?').run(draft);
  const readyId = seedOrder(); db.prepare("UPDATE magazine_orders SET status='ready', updated_at=0 WHERE id=?").run(readyId);
  assert.ok(generate.sweep() >= 1);
  assert.equal(store.getOrder(draft), null); assert.equal(fs.existsSync(path.join(DATA, 'magazines', 'uploads', draft)), false);
  assert.ok(store.getOrder(readyId));
});

test('disconnect revokes at Canva and deletes stored tokens', async () => {
  await client.revokeConnection();
  assert.equal(store.getConnection(), null); assert.equal(mock.st.revoked, true);
});
