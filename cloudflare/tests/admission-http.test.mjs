import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import worker from '../src/worker.mjs';
import { list, bySlug } from '../src/catalog.generated.mjs';
import { DRAFT_ADMISSION, UPLOAD_MAX_TOTAL_BYTES } from '../src/admission-policy.mjs';
import * as store from '../src/store.mjs';
import { D1 } from './d1-shim.mjs';
import { TEST_IP, TEST_RATE_KEY } from './rate-fixtures.mjs';

const origin = 'https://preview.example';
const draftBody = { customer_data: bySlug('vaidehi').config.demo };
function post(path, body, cookie) {
  return new Request(origin + path, { method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': TEST_IP, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}
async function fixture(t) {
  const DB = new D1(); t.after(() => DB.raw.close());
  await store.seedTemplates(DB, list.map(x => ({ slug: x.slug, name: x.config.name, price: Math.round((x.config.price || 0) * 100), currency: 'INR', config: x.config })));
  const objects = new Map(), deleted = [];
  const MEDIA = { objects, deleted, async put(key, bytes) { objects.set(key, bytes); }, async delete(key) { deleted.push(key); objects.delete(key); }, async head(key) { return objects.has(key) ? {} : null; } };
  return { DB, MEDIA, DRAFTS_ENABLED: 'true', RATE_LIMIT_HMAC_KEY: TEST_RATE_KEY };
}
async function firstDraft(env) {
  const r = await worker.fetch(post('/api/vaidehi/draft', draftBody), env);
  assert.equal(r.status, 200, await r.clone().text());
  return { ...await r.json(), cookie: r.headers.get('set-cookie').split(';')[0] };
}
function sampleImage() {
  // The Worker checks this PNG header and dimensions; bytes remain local only.
  const b = Buffer.alloc(24); b.set([0x89, 0x50, 0x4e, 0x47]);
  b.write('IHDR', 12); b.writeUInt32BE(100, 16); b.writeUInt32BE(100, 20); return b;
}

test('draft HTTP limit is server-owned and enforced for concurrent requests', async t => {
  const env = await fixture(t), first = await firstDraft(env);
  const attempts = await Promise.all(Array.from({ length: DRAFT_ADMISSION.maxPerOwnerTemplate24h + 4 }, () =>
    worker.fetch(post('/api/vaidehi/draft', { ...draftBody, maxPerOwnerTemplate24h: 999999, maxGlobal24h: 999999 }, first.cookie), env)));
  assert.equal(attempts.filter(r => r.status === 200).length, DRAFT_ADMISSION.maxPerOwnerTemplate24h - 1);
  const denied = attempts.filter(r => r.status === 429);
  assert.equal(denied.length, 5);
  for (const r of denied) assert.deepEqual(await r.json(), { error: 'limit' });
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM invites').get().n, DRAFT_ADMISSION.maxPerOwnerTemplate24h);
});

test('shared daily draft ceiling denies a new cookie without inserting customer data', async t => {
  const env = await fixture(t);
  const insert = env.DB.raw.prepare('INSERT INTO invites(id,template_slug,owner_hash,customer_data) VALUES(?,?,?,?)');
  env.DB.raw.exec('BEGIN');
  for (let i = 0; i < DRAFT_ADMISSION.maxGlobal24h; i++) insert.run(i.toString(16).padStart(18, '0'), 'vaidehi', 'prior-owner-' + i, '{}');
  env.DB.raw.exec('COMMIT');
  const r = await worker.fetch(post('/api/vaidehi/draft', draftBody), env);
  assert.equal(r.status, 429); assert.deepEqual(await r.json(), { error: 'limit' });
  assert.equal(r.headers.get('set-cookie'), null);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM invites').get().n, DRAFT_ADMISSION.maxGlobal24h);
});

test('global committed-byte denial compensates the newly written R2 object', async t => {
  const env = await fixture(t), d = await firstDraft(env);
  env.DB.raw.prepare('INSERT INTO uploads(key,invite_id,mime,size) VALUES(?,?,?,?)').run('a'.repeat(48) + '.png', d.id, 'image/png', UPLOAD_MAX_TOTAL_BYTES);
  const r = await worker.fetch(new Request(origin + '/api/vaidehi/upload?id=' + d.id, { method: 'POST', headers: { Origin: origin, Cookie: d.cookie, 'CF-Connecting-IP': TEST_IP, 'Content-Type': 'image/png' }, body: sampleImage() }), env);
  assert.equal(r.status, 409); assert.deepEqual(await r.json(), { error: 'upload_not_accepted' });
  assert.equal(env.MEDIA.deleted.length, 1); assert.equal(env.MEDIA.objects.size, 0);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM uploads').get().n, 1);
});
