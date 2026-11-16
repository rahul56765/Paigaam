import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import worker from '../src/worker.mjs';
import { list, bySlug } from '../src/catalog.generated.mjs';
import * as store from '../src/store.mjs';
import { D1 } from './d1-shim.mjs';
import { TEST_IP, TEST_RATE_KEY } from './rate-fixtures.mjs';

// Local SQLite and in-memory bytes only. These tests never call a gateway,
// write Cloudflare resources, or read/import any Railway database.
const origin = 'https://preview.example';
function jsonRequest(path, data, cookie) {
  return new Request(origin + path, {
    method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': TEST_IP, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(data),
  });
}
function uploadRequest(slug, id, cookie, bytes, mime = 'application/octet-stream', action = 'audio', extra = {}) {
  return new Request(`${origin}/api/${slug}/${action}?id=${id}`, {
    method: 'POST', headers: { Origin: origin, Cookie: cookie, 'CF-Connecting-IP': TEST_IP, 'Content-Type': mime, ...extra }, body: bytes,
  });
}
function wave() {
  const b = Buffer.alloc(46);
  b.write('RIFF', 0); b.writeUInt32LE(38, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(2, 40);
  return b;
}
function memoryR2() {
  const objects = new Map(), deleted = [];
  return {
    objects, deleted,
    async put(key, bytes, options) { objects.set(key, { bytes: new Uint8Array(bytes), options }); },
    async head(key) { return objects.has(key) ? { size: objects.get(key).bytes.length } : null; },
    async get(key) { const o = objects.get(key); return o ? { body: new Uint8Array(o.bytes), size: o.bytes.length } : null; },
    async delete(key) { deleted.push(key); objects.delete(key); },
  };
}
async function fixture(t) {
  const DB = new D1(); t.after(() => DB.raw.close());
  await store.seedTemplates(DB, list.map(x => ({ slug: x.slug, name: x.config.name, price: Math.round((x.config.price || 0) * 100), config: x.config, currency: 'INR' })));
  return { DB, MEDIA: memoryR2(), DRAFTS_ENABLED: 'true', RATE_LIMIT_HMAC_KEY: TEST_RATE_KEY };
}
async function draft(env, slug, cookie) {
  const response = await worker.fetch(jsonRequest(`/api/${slug}/draft`, { customer_data: bySlug(slug).config.demo }, cookie), env);
  assert.equal(response.status, 200, await response.clone().text());
  return { ...await response.json(), cookie: cookie || response.headers.get('set-cookie').split(';')[0] };
}
async function save(env, slug, d, data) {
  return worker.fetch(jsonRequest(`/api/${slug}/draft`, { id: d.id, customer_data: data }, d.cookie), env);
}

for (const slug of ['love-letter', 'anniversary-blue']) {
  test(`${slug}: original octet-stream WAV contract, private ownership, and referenced public delivery`, async t => {
    const env = await fixture(t), d = await draft(env, slug), bytes = wave();
    let r = await worker.fetch(uploadRequest(slug, d.id, d.cookie, bytes), env);
    assert.equal(r.status, 200, await r.clone().text());
    const { url } = await r.json();
    assert.match(url, /^\/bfday\/uploads\/[a-f0-9]{48}\.wav$/);
    const key = url.split('/').at(-1), metadata = await store.getUpload(env.DB, key);
    assert.equal(metadata.mime, 'audio/wav');
    assert.equal(env.MEDIA.objects.get(key).options.httpMetadata.contentType, 'audio/wav');
    r = await worker.fetch(new Request(origin + url), env); assert.equal(r.status, 404, 'draft media is not public');
    r = await worker.fetch(new Request(origin + url, { headers: { Cookie: d.cookie } }), env);
    assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
    const other = await draft(env, slug, d.cookie);
    r = await save(env, slug, other, { ...bySlug(slug).config.demo, songUrl: url });
    assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload', 'same owner cannot attach a different draft upload');
    r = await save(env, slug, d, { ...bySlug(slug).config.demo, songUrl: url }); assert.equal(r.status, 200);
    // A second, unreferenced upload must stay private after publication.
    r = await worker.fetch(uploadRequest(slug, d.id, d.cookie, bytes), env); assert.equal(r.status, 200);
    const unreferenced = (await r.json()).url;
    // Local test fixture transition, NOT the application publication route.
    env.DB.raw.prepare("UPDATE invites SET status='published', public_slug=? WHERE id=?").run('test-' + d.id, d.id);
    r = await worker.fetch(new Request(origin + url), env); assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/wav'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
    r = await worker.fetch(new Request(origin + unreferenced), env); assert.equal(r.status, 404);
  });

  test(`${slug}: original octet-stream MP3 contract stores a canonical audio MIME`, async t => {
    const env = await fixture(t), d = await draft(env, slug);
    // One complete MPEG-1 Layer III frame for the existing header validator.
    const bytes = Buffer.alloc(417); bytes.set([0xff, 0xfb, 0x90, 0x64]);
    const r = await worker.fetch(uploadRequest(slug, d.id, d.cookie, bytes), env);
    assert.equal(r.status, 200, await r.clone().text());
    const { url } = await r.json(); assert.match(url, /\.mp3$/);
    const key = url.split('/').at(-1);
    assert.equal((await store.getUpload(env.DB, key)).mime, 'audio/mpeg');
    assert.equal(env.MEDIA.objects.get(key).options.httpMetadata.contentType, 'audio/mpeg');
  });

  test(`${slug}: forged local song references cannot enter a new or existing draft`, async t => {
    const env = await fixture(t), data = { ...bySlug(slug).config.demo, songUrl: '/bfday/uploads/' + 'a'.repeat(48) + '.mp3' };
    let r = await worker.fetch(jsonRequest(`/api/${slug}/draft`, { customer_data: data }), env);
    assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload');
    const d = await draft(env, slug);
    r = await save(env, slug, d, data); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload');
  });

  test(`${slug}: octet-stream is not a MIME bypass and byte limits fail closed`, async t => {
    const env = await fixture(t), d = await draft(env, slug);
    for (const [bytes, mime] of [[Buffer.from('<script>not audio</script>'), 'application/octet-stream'], [wave(), 'audio/mpeg'], [wave(), 'text/plain']]) {
      const r = await worker.fetch(uploadRequest(slug, d.id, d.cookie, bytes, mime), env);
      assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_audio');
    }
    const r = await worker.fetch(uploadRequest(slug, d.id, d.cookie, wave(), 'application/octet-stream', 'audio', { 'Content-Length': String(12 * 1024 * 1024 + 1) }), env);
    assert.equal(r.status, 413); assert.equal(env.MEDIA.objects.size, 0);
  });
}

test('generic audio budget is independent of committed photo uploads', async t => {
  const env = await fixture(t), d = await draft(env, 'vaidehi');
  for (let i = 0; i < 9; i++) await env.DB.prepare('INSERT INTO uploads(key,invite_id,mime,size) VALUES(?,?,?,?)')
    .bind(i.toString(16).padStart(48, '0') + '.png', d.id, 'image/png', 1).run();
  const r = await worker.fetch(uploadRequest('vaidehi', d.id, d.cookie, wave(), 'audio/wav', 'upload-audio'), env);
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await store.listUploads(env.DB, d.id)).length, 10);
});

test('competing uploads cannot exceed committed count cap; losing R2 write is removed', async t => {
  const env = await fixture(t), d = await draft(env, 'vaidehi');
  for (let i = 0; i < 8; i++) await env.DB.prepare('INSERT INTO uploads(key,invite_id,mime,size) VALUES(?,?,?,?)')
    .bind(i.toString(16).padStart(48, '0') + '.wav', d.id, 'audio/wav', 46).run();
  let release, arrivals = 0; const both = new Promise(resolve => { release = resolve; });
  const put = env.MEDIA.put.bind(env.MEDIA);
  env.MEDIA.put = async (...args) => { await put(...args); if (++arrivals === 2) release(); await both; };
  const responses = await Promise.all([1, 2].map(() => worker.fetch(uploadRequest('vaidehi', d.id, d.cookie, wave(), 'audio/wav', 'upload-audio'), env)));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await store.listUploads(env.DB, d.id)).length, 9);
  assert.equal(env.MEDIA.deleted.length, 1); assert.equal(env.MEDIA.objects.size, 1);
});

test('upload metadata failure removes its R2 bytes and does not expose database errors', async t => {
  const env = await fixture(t), d = await draft(env, 'vaidehi'), prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = sql => {
    const statement = prepare(sql);
    if (sql.includes('INSERT INTO uploads')) {
      const bind = statement.bind.bind(statement);
      statement.bind = (...args) => { const bound = bind(...args); bound.first = async () => { throw new Error('internal database details'); }; return bound; };
    }
    return statement;
  };
  t.mock.method(console, 'error', () => {});
  const r = await worker.fetch(uploadRequest('vaidehi', d.id, d.cookie, wave(), 'audio/wav', 'upload-audio'), env);
  assert.equal(r.status, 500); assert.deepEqual(await r.json(), { error: 'server_error' });
  assert.equal((await store.listUploads(env.DB, d.id)).length, 0);
  assert.equal(env.MEDIA.objects.size, 0); assert.equal(env.MEDIA.deleted.length, 1);
});

test('checkout lock racing an in-flight upload removes uncommitted R2 bytes', async t => {
  const env = await fixture(t), d = await draft(env, 'vaidehi'), put = env.MEDIA.put.bind(env.MEDIA);
  env.MEDIA.put = async (...args) => {
    await put(...args);
    // Local fixture simulates the lock committing while R2 I/O is in flight.
    env.DB.raw.prepare("UPDATE invites SET status='payment_pending' WHERE id=?").run(d.id);
  };
  const r = await worker.fetch(uploadRequest('vaidehi', d.id, d.cookie, wave(), 'audio/wav', 'upload-audio'), env);
  assert.equal(r.status, 409); assert.equal((await store.listUploads(env.DB, d.id)).length, 0);
  assert.equal(env.MEDIA.objects.size, 0); assert.equal(env.MEDIA.deleted.length, 1);
});

test('autosave between validation and checkout lock creates no gateway order or frozen draft', async t => {
  const env = { ...await fixture(t), CHECKOUT_ENABLED: 'true', RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'mock-key-secret', RAZORPAY_WEBHOOK_SECRET: 'mock-webhook-secret' };
  const d = await draft(env, 'vaidehi'), batch = env.DB.batch.bind(env.DB);
  let interleaved = false, gatewayCalls = 0;
  env.DB.batch = async statements => {
    if (!interleaved && statements[0].sql.includes('INSERT INTO orders')) {
      interleaved = true;
      const changed = bySlug('vaidehi').schema.validate({}, { mode: 'draft' });
      env.DB.raw.prepare('UPDATE invites SET customer_data=? WHERE id=?').run(JSON.stringify(changed), d.id);
    }
    return batch(statements);
  };
  t.mock.method(globalThis, 'fetch', async () => { gatewayCalls++; throw new Error('unexpected gateway call'); });
  const r = await worker.fetch(jsonRequest('/api/vaidehi/publish', { id: d.id, checkout_mode: 'paid', expected_amount_paise: 9900, expected_currency: 'INR' }, d.cookie), env);
  assert.equal(r.status, 409, await r.clone().text()); assert.equal(interleaved, true); assert.equal(gatewayCalls, 0);
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM orders').get().n, 0);
});

test('gateway credentials without webhook verification cannot activate checkout', async t => {
  const env = { ...await fixture(t), CHECKOUT_ENABLED: 'true', RAZORPAY_KEY_ID: 'rzp_test_example', RAZORPAY_KEY_SECRET: 'mock-key-secret' };
  const d = await draft(env, 'vaidehi');
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected gateway call'); });
  const r = await worker.fetch(jsonRequest('/api/vaidehi/publish', { id: d.id }, d.cookie), env);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
});
