import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHmac, createHash } from 'node:crypto';
import worker from '../src/worker.mjs';
import { list, bySlug } from '../src/catalog.generated.mjs';
import * as store from '../src/store.mjs';
import { D1 } from './d1-shim.mjs';
import { TEST_IP, TEST_RATE_KEY } from './rate-fixtures.mjs';

// All D1/R2 state is in-memory. Any unexpected global fetch is trapped; the
// two explicit paid-flow tests use local mocked responses, never the network.
const origin = 'https://preview.example';
const FREE = 'sealed-with-a-kiss';
const PAID = 'little-love';
const key = byte => byte.repeat(48);
const slugFor = (slug, hex) => `${slug}-free-${hex}`;
const secrets = {
  CHECKOUT_ENABLED: 'true', RAZORPAY_KEY_ID: 'rzp_test_example',
  RAZORPAY_KEY_SECRET: 'mock-key-secret', RAZORPAY_WEBHOOK_SECRET: 'mock-webhook-secret',
};
function post(path, data, cookie, headers = {}) {
  return new Request(origin + path, { method: 'POST', headers: {
    Origin: origin, 'CF-Connecting-IP': TEST_IP, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers,
  }, body: JSON.stringify(data) });
}
function mediaRequest(slug, id, cookie, bytes, mime, action = 'upload') {
  return new Request(`${origin}/api/${slug}/${action}?id=${id}`, { method: 'POST', headers: {
    Origin: origin, Cookie: cookie, 'CF-Connecting-IP': TEST_IP, 'Content-Type': mime,
  }, body: bytes });
}
function memoryR2() {
  const objects = new Map(), heads = [];
  return {
    objects, heads,
    async put(k, bytes, options) { objects.set(k, { bytes: new Uint8Array(bytes), options }); },
    async head(k) { heads.push(k); const o = objects.get(k); return o ? { size: o.bytes.length } : null; },
    async get(k) { const o = objects.get(k); return o ? { body: o.bytes, size: o.bytes.length } : null; },
    async delete(k) { objects.delete(k); },
  };
}
async function fixture(t, fetchImpl) {
  const DB = new D1();
  t.after(() => DB.raw.close());
  await store.seedTemplates(DB, list.map(x => ({ slug: x.slug, name: x.config.name,
    price: Math.round((x.config.price || 0) * 100), config: x.config, currency: 'INR' })));
  const network = { calls: 0, expected: 0 };
  t.mock.method(globalThis, 'fetch', async (...args) => {
    network.calls++;
    if (fetchImpl) return fetchImpl(...args);
    throw new Error('Unexpected external network request');
  });
  t.after(() => assert.equal(network.calls, network.expected, 'no unmocked network calls'));
  return { DB, MEDIA: memoryR2(), DRAFTS_ENABLED: 'true', FREE_PUBLISH_ENABLED: 'true', RATE_LIMIT_HMAC_KEY: TEST_RATE_KEY, network };
}
async function draft(env, slug = FREE, data = bySlug(slug).config.demo, cookie) {
  const r = await worker.fetch(post(`/api/${slug}/draft`, { customer_data: data }, cookie), env);
  assert.equal(r.status, 200, await r.clone().text());
  return { ...await r.json(), cookie: cookie || r.headers.get('set-cookie').split(';')[0] };
}
async function save(env, slug, d, data) {
  return worker.fetch(post(`/api/${slug}/draft`, { id: d.id, customer_data: data }, d.cookie), env);
}
async function publish(env, slug, d, extra = {}, cookie = d.cookie) {
  return worker.fetch(post(`/api/${slug}/publish`, { id: d.id, expected_snapshot: createHash('sha256').update(JSON.stringify((await store.getInvite(env.DB, d.id))?.customer_data)).digest('hex'), ...extra }, cookie), env);
}
// Test-only wide limits for direct store fixtures; the Worker still uses its
// own server-owned admission policy.
function createTestInvite(db, slug, owner, data) {
  return store.createInvite(db, slug, owner, data, { maxPerOwnerTemplate24h: 1000, maxGlobal24h: 10000 });
}
function counts(env) {
  return {
    orders: env.DB.raw.prepare('SELECT count(*) n FROM orders').get().n,
    published: env.DB.raw.prepare("SELECT count(*) n FROM invites WHERE status='published'").get().n,
  };
}
const validPhoto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAIAAAC1nk4lAAAAXUlEQVR4nO3OQQ3AIAAAMcC/nL2Rg4552OPIklZB53n2+Jt1O/CFdEW6Il2RrkhXpCvSFemKdEW6Il2RrkhXpCvSFemKdEW6Il2RrkhXpCvSFemKdEW6Il2RrkhXXoq3AtD2uafhAAAAAElFTkSuQmCC', 'base64');
function wave() {
  const b = Buffer.alloc(46); b.write('RIFF', 0); b.writeUInt32LE(38, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(2, 40); return b;
}
async function upload(env, slug, d, bytes = validPhoto, mime = 'image/png', action = 'upload') {
  const r = await worker.fetch(mediaRequest(slug, d.id, d.cookie, bytes, mime, action), env);
  assert.equal(r.status, 200, await r.clone().text());
  return (await r.json()).url;
}
// Pause or perturb the actual single conditional UPDATE immediately before its
// SQLite execution. This simulates cross-isolate interleavings, not timing guesses.
function interceptFreeWrites(db, { before, after } = {}) {
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    const s = prepare(sql);
    if (!sql.includes("typeof(t.price)='integer'") || !sql.includes("UPDATE invites SET status='published'")) return s;
    const bind = s.bind.bind(s);
    s.bind = (...args) => {
      const bound = bind(...args), first = bound.first.bind(bound);
      bound.first = async () => {
        if (before) await before(args);
        const result = await first();
        if (after) await after(result, args);
        return result;
      };
      return bound;
    };
    return s;
  };
}

// Store tests exercise actual SQLite constraints and statements in memory.
test('publish binds the save response before its first read, including published replay', async t => {
  const env = await fixture(t), d = await draft(env);
  assert.match(d.snapshot, /^[a-f0-9]{64}$/);
  const changed = { ...bySlug(FREE).config.demo, senderName: 'Changed in another tab' };
  const saved = await save(env, FREE, d, changed);
  assert.equal(saved.status, 200);
  const latest = await saved.json();
  assert.notEqual(latest.snapshot, d.snapshot);
  for (const expected_snapshot of [undefined, null, '', 'x'.repeat(64), d.snapshot]) {
    const r = await publish(env, FREE, d, { expected_snapshot });
    assert.equal(r.status, 409); assert.equal((await r.json()).error, 'draft_changed');
    assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  }
  const r = await publish(env, FREE, d, { expected_snapshot: latest.snapshot });
  assert.equal(r.status, 200); const result = await r.json();
  assert.equal((await store.getInvite(env.DB, d.id)).customer_data.senderName, changed.senderName);
  const staleReplay = await publish(env, FREE, d, { expected_snapshot: d.snapshot });
  assert.equal(staleReplay.status, 409);
  const replay = await publish(env, FREE, d, { expected_snapshot: latest.snapshot });
  assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), result);
  assert.equal(await store.getOrderForInvite(env.DB, d.id), null);
});

test('unsupported paid currency is rejected before locking the draft or creating an order', async t => {
  const env = { ...await fixture(t), ...secrets };
  const d = await draft(env, PAID);
  env.DB.raw.prepare('UPDATE templates SET currency=? WHERE slug=?').run('USD', PAID);
  const before = await store.getInvite(env.DB, d.id);
  const response = await publish(env, PAID, d, { checkout_mode: 'paid',
    expected_amount_paise: 9900, expected_currency: 'USD' });
  assert.equal(response.status, 400, await response.clone().text());
  assert.equal((await response.json()).error, 'unsupported_currency');
  assert.deepEqual(await store.getInvite(env.DB, d.id), before);
  assert.equal(await store.getOrderForInvite(env.DB, d.id), null);
});

test('free store performs one owner/template/snapshot/price/order-guarded conditional update', async t => {
  const env = await fixture(t), data = { first: 'A', second: 'B' };
  const pg = await createTestInvite(env.DB, FREE, 'owner-a', data), candidate = slugFor(FREE, key('a'));
  for (const [id, owner, template, snapshot] of [
    [pg.id, 'owner-b', FREE, data], [pg.id, 'owner-a', PAID, data],
    ['missing', 'owner-a', FREE, data], [pg.id, 'owner-a', FREE, { first: 'changed', second: 'B' }],
    // Equal objects with different serialized order are not an exact snapshot.
    [pg.id, 'owner-a', FREE, { second: 'B', first: 'A' }],
  ]) assert.equal(await store.publishFree(env.DB, id, owner, template, snapshot, slugFor(template, key('a'))), null);
  for (const invalid of [undefined, null, [], 'not-an-object', 1]) {
    await assert.rejects(store.publishFree(env.DB, pg.id, 'owner-a', FREE, invalid, candidate), /object/);
  }
  await assert.rejects(store.publishFree(env.DB, pg.id, 'owner-a', FREE, data, ''), /publicSlug/);
  for (const badSlug of ['attacker-chosen', `${FREE}-free-abc`, `${PAID}-free-${key('a')}`, `${FREE}-free-${key('G')}`]) {
    await assert.rejects(store.publishFree(env.DB, pg.id, 'owner-a', FREE, data, badSlug), /namespace/);
  }
  env.DB.raw.prepare('UPDATE templates SET price=1 WHERE slug=?').run(FREE);
  assert.equal(await store.publishFree(env.DB, pg.id, 'owner-a', FREE, data, candidate), null, 'one paise is not free');
  env.DB.raw.prepare('UPDATE templates SET price=0 WHERE slug=?').run(FREE);
  assert.deepEqual(await store.getInvite(env.DB, pg.id), pg);
  let statements = 0;
  interceptFreeWrites(env.DB, { after() { statements++; } });
  const result = await store.publishFree(env.DB, pg.id, 'owner-a', FREE, data, candidate);
  assert.equal(statements, 1); assert.equal(result.status, 'published');
  assert.equal(result.public_slug, candidate); assert.deepEqual(result.customer_data, data);
  assert.equal((await store.getInviteByPublicSlug(env.DB, candidate)).id, pg.id);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('free store rejects each live order even on an otherwise matching draft; failed orders do not block', async t => {
  const env = await fixture(t), data = { name: 'Valid snapshot' };
  for (const [index, status] of ['creating', 'pending', 'paid', 'failed'].entries()) {
    const pg = await createTestInvite(env.DB, FREE, `owner-${status}`, data);
    const gateway = status === 'pending' || status === 'paid' ? `gateway-${status}` : null;
    const payment = status === 'paid' ? 'payment-paid' : null;
    env.DB.raw.prepare('INSERT INTO orders(id,invite_id,amount,currency,status,gateway_order_id,gateway_payment_id) VALUES(?,?,?,?,?,?,?)')
      .run(`order-${status}`, pg.id, 100, 'INR', status, gateway, payment);
    // Deliberately leave the invite in draft to test the order predicate itself,
    // not just the separate draft-status guard.
    const result = await store.publishFree(env.DB, pg.id, `owner-${status}`, FREE, data, slugFor(FREE, key((index + 10).toString(16))));
    if (status === 'failed') assert.equal(result.status, 'published');
    else { assert.equal(result, null, status); assert.equal((await store.getInvite(env.DB, pg.id)).status, 'draft'); }
    assert.equal((await store.getOrder(env.DB, `order-${status}`)).status, status);
  }
});

test('store replay binds owner, exact template and snapshot, excludes paid orders, survives a later price change', async t => {
  const env = await fixture(t), data = { first: 'A', second: 'B' }, candidate = slugFor(FREE, key('a'));
  const pg = await createTestInvite(env.DB, FREE, 'owner-a', data);
  assert.ok(await store.publishFree(env.DB, pg.id, 'owner-a', FREE, data, candidate));
  env.DB.raw.prepare('UPDATE templates SET price=9900 WHERE slug=?').run(FREE);
  assert.equal((await store.getFreePublishedInvite(env.DB, pg.id, 'owner-a', FREE, data)).public_slug, candidate);
  assert.equal(await store.getFreePublishedInvite(env.DB, pg.id, 'owner-b', FREE, data), null);
  assert.equal(await store.getFreePublishedInvite(env.DB, pg.id, 'owner-a', PAID, data), null);
  assert.equal(await store.getFreePublishedInvite(env.DB, pg.id, 'owner-a', FREE, { second: 'B', first: 'A' }), null);
  assert.equal(await store.publishFree(env.DB, pg.id, 'owner-a', FREE, data, slugFor(FREE, key('b'))), null);
  // A published paid order cannot be reclassified just because the template is free.
  const paid = await createTestInvite(env.DB, PAID, 'owner-b', data);
  const order = await store.beginCheckout(env.DB, paid.id, 'owner-b', 9900, 'INR', data);
  await store.setGatewayOrder(env.DB, order.id, 'gateway-paid');
  await store.settleOrder(env.DB, 'gateway-paid', 'payment-paid', `${PAID}-${key('c').slice(0, 18)}`);
  env.DB.raw.prepare('UPDATE templates SET price=0 WHERE slug=?').run(PAID);
  assert.equal(await store.getFreePublishedInvite(env.DB, paid.id, 'owner-b', PAID, data), null);
});

test('store exact serialized bytes fail closed for a noncanonical historical JSON row', async t => {
  const env = await fixture(t), data = { name: 'A' }, pg = await createTestInvite(env.DB, FREE, 'owner', data);
  env.DB.raw.prepare('UPDATE invites SET customer_data=? WHERE id=?').run('{ "name" : "A" }', pg.id);
  const loaded = await store.getInvite(env.DB, pg.id);
  assert.deepEqual(loaded.customer_data, data);
  assert.equal(await store.publishFree(env.DB, pg.id, 'owner', FREE, loaded.customer_data, slugFor(FREE, key('a'))), null);
  assert.equal((await store.getInvite(env.DB, pg.id)).status, 'draft');
});

test('store collision is a no-op, and fresh random candidate can then publish without touching the first invite', async t => {
  const env = await fixture(t), data = { name: 'A' }, first = await createTestInvite(env.DB, FREE, 'a', data);
  const second = await createTestInvite(env.DB, FREE, 'b', data), taken = slugFor(FREE, key('a'));
  assert.ok(await store.publishFree(env.DB, first.id, 'a', FREE, data, taken));
  assert.equal(await store.publishFree(env.DB, second.id, 'b', FREE, data, taken), null);
  assert.equal((await store.getInvite(env.DB, second.id)).status, 'draft');
  const unique = slugFor(FREE, key('b'));
  assert.equal((await store.publishFree(env.DB, second.id, 'b', FREE, data, unique)).public_slug, unique);
  assert.equal((await store.getInviteByPublicSlug(env.DB, taken)).id, first.id);
  assert.equal((await store.getInviteByPublicSlug(env.DB, unique)).id, second.id);
});

for (const winner of ['free', 'paid']) test(`free publication versus paid checkout: ${winner} wins exclusively`, async t => {
  const env = await fixture(t), data = { name: 'A' }, pg = await createTestInvite(env.DB, FREE, 'owner', data);
  const free = () => store.publishFree(env.DB, pg.id, 'owner', FREE, data, slugFor(FREE, key('a')));
  const paid = () => {
    // A paid intent can only be created after an authoritative price change.
    env.DB.raw.prepare('UPDATE templates SET price=9900 WHERE slug=?').run(FREE);
    return store.beginCheckout(env.DB, pg.id, 'owner', 9900, 'INR', data);
  };
  const [a, b] = await Promise.all(winner === 'free' ? [free(), paid()] : [paid(), free()]);
  assert.ok(a); assert.equal(b, null);
  const stored = await store.getInvite(env.DB, pg.id);
  if (winner === 'free') { assert.equal(stored.status, 'published'); assert.equal(counts(env).orders, 0); }
  else { assert.equal(stored.status, 'payment_pending'); assert.equal(counts(env).orders, 1); assert.equal(stored.public_slug, null); }
});

test('both exact flags are required; checkout credentials cannot bypass the free kill switch', async t => {
  const env = await fixture(t), d = await draft(env);
  for (const flag of [undefined, false, true, 1, 'false', 'TRUE', '1', ' true ']) {
    const off = { ...env, FREE_PUBLISH_ENABLED: flag };
    let r = await publish(off, FREE, d);
    assert.equal(r.status, 503, `FREE_PUBLISH_ENABLED=${String(flag)}`);
    assert.equal((await r.json()).error, 'payments_offline');
    r = await publish({ ...off, ...secrets }, FREE, d);
    assert.equal(r.status, 503); assert.equal((await r.json()).error, 'free_publish_not_enabled');
  }
  for (const flag of [undefined, false, true, 1, 'false', 'TRUE', '1', ' true ']) {
    const r = await publish({ ...env, DRAFTS_ENABLED: flag }, FREE, d);
    assert.equal(r.status, 503, `DRAFTS_ENABLED=${String(flag)}`);
    assert.equal((await r.json()).error, 'drafts_offline');
  }
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
});

test('free owner publishes without any gateway secrets or orders; replay is stable despite later price change', async t => {
  const env = await fixture(t), d = await draft(env), before = await store.getInvite(env.DB, d.id);
  let r = await publish(env, FREE, d, { price: 0, amount: 0, slug: 'attacker-chosen', customer_data: { senderName: 'Not saved' } });
  assert.equal(r.status, 200, await r.clone().text());
  const first = await r.json();
  assert.match(first.slug, /^sealed-with-a-kiss-free-[a-f0-9]{48}$/);
  assert.equal(first.url, `${origin}/p/${first.slug}`); assert.notEqual(first.slug, 'attacker-chosen');
  const published = await store.getInvite(env.DB, d.id);
  assert.equal(published.status, 'published'); assert.deepEqual(published.customer_data, before.customer_data);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
  r = await worker.fetch(new Request(first.url), env); assert.equal(r.status, 200);
  assert.match(await r.text(), /Rahul/);
  r = await publish(env, FREE, d); assert.equal(r.status, 200); assert.deepEqual(await r.json(), first);
  env.DB.raw.prepare('UPDATE templates SET price=9900 WHERE slug=?').run(FREE);
  r = await publish(env, FREE, d); assert.equal(r.status, 200); assert.deepEqual(await r.json(), first);
  r = await publish({ ...env, FREE_PUBLISH_ENABLED: undefined }, FREE, d);
  assert.equal(r.status, 503, 'disabled free gate also denies free replay');
  r = await publish({ ...env, ...secrets, FREE_PUBLISH_ENABLED: 'false' }, FREE, d);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'free_publish_not_enabled');
  r = await publish({ ...env, DRAFTS_ENABLED: 'false' }, FREE, d); assert.equal(r.status, 503);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('free publish stays independent of enabled paid credentials and generates distinct secret links', async t => {
  const env = { ...await fixture(t), ...secrets }, a = await draft(env), b = await draft(env, FREE, bySlug(FREE).config.demo, a.cookie);
  const results = [];
  for (const d of [a, b]) {
    const r = await publish(env, FREE, d); assert.equal(r.status, 200, await r.clone().text()); results.push(await r.json());
  }
  assert.notEqual(results[0].slug, results[1].slug);
  for (const result of results) assert.match(result.slug, /^sealed-with-a-kiss-free-[a-f0-9]{48}$/);
  assert.deepEqual(counts(env), { orders: 0, published: 2 });
});

test('owner, exact template and same-origin checks protect both publication and replay', async t => {
  const env = await fixture(t), d = await draft(env), other = `paigaam_creator=${'f'.repeat(64)}`;
  let r = await publish(env, FREE, d, {}, other); assert.equal(r.status, 403);
  r = await publish(env, FREE, d, {}, null); assert.equal(r.status, 403);
  r = await publish(env, 'polaroid-scrapbook', d); assert.equal(r.status, 404);
  r = await worker.fetch(post(`/api/${FREE}/publish`, { id: d.id }, d.cookie, { Origin: 'https://evil.example' }), env);
  assert.equal(r.status, 403);
  r = await worker.fetch(post(`/api/${FREE}/publish`, { id: d.id }, d.cookie, { 'Sec-Fetch-Site': 'cross-site' }), env);
  assert.equal(r.status, 403);
  assert.equal(counts(env).published, 0);
  r = await publish(env, FREE, d); assert.equal(r.status, 200); const original = await r.json();
  r = await publish(env, FREE, d, {}, other); assert.equal(r.status, 403);
  assert.equal(JSON.stringify(await r.json()).includes(original.slug), false);
  r = await publish(env, 'polaroid-scrapbook', d); assert.equal(r.status, 404);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('strict validation uses the saved draft rather than request body and requires canonical validated data', async t => {
  const env = await fixture(t), d = await draft(env, FREE, {});
  let r = await publish(env, FREE, d, { customer_data: bySlug(FREE).config.demo, price: 0 });
  assert.equal(r.status, 400); assert.equal((await r.json()).error, 'validation');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  r = await save(env, FREE, d, bySlug(FREE).config.demo); assert.equal(r.status, 200);
  // A manually corrupted DB row with an extra non-whitelisted field must not be
  // silently published just because the schema can sanitize it away.
  const pg = await store.getInvite(env.DB, d.id);
  env.DB.raw.prepare('UPDATE invites SET customer_data=? WHERE id=?')
    .run(JSON.stringify({ ...pg.customer_data, unvalidatedField: 'unexpected' }), d.id);
  r = await publish(env, FREE, d); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'validation');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
});

test('referenced image must have owned upload metadata and a live R2 object; only referenced bytes become public', async t => {
  const env = await fixture(t), slug = 'love-letter', d = await draft(env, slug), url = await upload(env, slug, d);
  const unreferenced = await upload(env, slug, d), data = { ...bySlug(slug).config.demo, reminder0: url };
  let r = await save(env, slug, d, data); assert.equal(r.status, 200);
  const k = url.split('/').at(-1), object = env.MEDIA.objects.get(k);
  env.MEDIA.objects.delete(k);
  r = await publish(env, slug, d); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  env.MEDIA.objects.set(k, object);
  const metadata = await store.getUpload(env.DB, k);
  env.DB.raw.prepare('DELETE FROM uploads WHERE key=?').run(k);
  r = await publish(env, slug, d); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload');
  env.DB.raw.prepare('INSERT INTO uploads(key,invite_id,mime,size) VALUES(?,?,?,?)').run(k, d.id, metadata.mime, metadata.size);
  r = await publish(env, slug, d); assert.equal(r.status, 200, await r.clone().text());
  assert.ok(env.MEDIA.heads.includes(k));
  r = await worker.fetch(new Request(origin + url), env); assert.equal(r.status, 200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), validPhoto);
  r = await worker.fetch(new Request(origin + unreferenced), env); assert.equal(r.status, 404);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('a different draft upload cannot be published even by the same owner', async t => {
  const env = await fixture(t), slug = 'love-letter', d = await draft(env, slug), other = await draft(env, slug, bySlug(slug).config.demo, d.cookie);
  const foreignUrl = await upload(env, slug, other);
  // Simulate a corrupted row that bypassed autosave's ownership check.
  const corrupt = bySlug(slug).schema.validate({ ...bySlug(slug).config.demo, reminder0: foreignUrl }, { mode: 'draft' });
  const pg = await store.getInvite(env.DB, d.id);
  await store.updateInvite(env.DB, d.id, pg.owner_hash, corrupt);
  const r = await publish(env, slug, d); assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft'); assert.equal(counts(env).orders, 0);
});

for (const slug of ['love-letter', 'anniversary-blue']) test(`${slug} local audio references are rechecked in R2 at free publication`, async t => {
  const env = await fixture(t), d = await draft(env, slug), url = await upload(env, slug, d, wave(), 'application/octet-stream', 'audio');
  const r = await save(env, slug, d, { ...bySlug(slug).config.demo, songUrl: url }); assert.equal(r.status, 200);
  env.MEDIA.objects.delete(url.split('/').at(-1));
  const publication = await publish(env, slug, d);
  assert.equal(publication.status, 400); assert.equal((await publication.json()).error, 'invalid_upload');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft'); assert.equal(counts(env).orders, 0);
});

test('R2 verification failure is sanitized and cannot publish or enter checkout', async t => {
  const env = await fixture(t), slug = 'love-letter', d = await draft(env, slug), url = await upload(env, slug, d);
  assert.equal((await save(env, slug, d, { ...bySlug(slug).config.demo, reminder0: url })).status, 200);
  env.MEDIA.head = async () => { throw new Error('private R2 detail'); };
  t.mock.method(console, 'error', () => {});
  const r = await publish(env, slug, d); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { error: 'server_error' });
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft'); assert.equal(counts(env).orders, 0);
});

test('autosave between validation and conditional publish fails closed with no order or network', async t => {
  const env = await fixture(t), d = await draft(env), owner = (await store.getInvite(env.DB, d.id)).owner_hash;
  const fresh = bySlug(FREE).schema.validate({ ...bySlug(FREE).config.demo, senderName: 'Fresh autosave' }, { mode: 'draft' });
  let interleaved = false;
  interceptFreeWrites(env.DB, { async before() { if (!interleaved) { interleaved = true; await store.updateInvite(env.DB, d.id, owner, fresh); } } });
  const r = await publish(env, FREE, d); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'free_publish_conflict');
  const pg = await store.getInvite(env.DB, d.id); assert.equal(interleaved, true); assert.equal(pg.status, 'draft');
  assert.deepEqual(pg.customer_data, fresh); assert.equal(pg.public_slug, null); assert.equal(counts(env).orders, 0);
  assert.ok(await store.updateInvite(env.DB, d.id, owner, fresh), 'draft stays editable');
});

test('authoritative price rising after the free quote is checked in the atomic update', async t => {
  const env = await fixture(t), d = await draft(env); let interleaved = false;
  interceptFreeWrites(env.DB, { before() {
    if (!interleaved) { interleaved = true; env.DB.raw.prepare('UPDATE templates SET price=1 WHERE slug=?').run(FREE); }
  } });
  const r = await publish(env, FREE, d, { price: 0 });
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'free_publish_conflict'); assert.equal(interleaved, true);
  assert.equal((await store.getTemplate(env.DB, FREE)).price, 1);
  const pg = await store.getInvite(env.DB, d.id); assert.equal(pg.status, 'draft'); assert.equal(pg.public_slug, null);
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
});

test('a new payment intent racing free publication prevents the free transition', async t => {
  const env = await fixture(t), d = await draft(env), pg = await store.getInvite(env.DB, d.id); let order;
  interceptFreeWrites(env.DB, { async before() {
    if (!order) {
      env.DB.raw.prepare('UPDATE templates SET price=9900 WHERE slug=?').run(FREE);
      order = await store.beginCheckout(env.DB, d.id, pg.owner_hash, 9900, 'INR', pg.customer_data);
    }
  } });
  const r = await publish(env, FREE, d); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'free_publish_conflict');
  assert.equal(order.status, 'creating'); assert.equal((await store.getInvite(env.DB, d.id)).status, 'payment_pending');
  assert.equal((await store.getOrder(env.DB, order.id)).status, 'creating'); assert.equal(counts(env).published, 0);
});

test('twenty concurrent free requests have one mutation winner and snapshot-bound idempotent replays', async t => {
  const env = await fixture(t), d = await draft(env), n = 20; let arrived = 0, winners = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  interceptFreeWrites(env.DB, {
    async before() { if (++arrived === n) release(); await barrier; },
    after(value) { if (value) winners++; },
  });
  const responses = await Promise.all(Array.from({ length: n }, () => publish(env, FREE, d)));
  assert.ok(responses.every(r => r.status === 200));
  const bodies = await Promise.all(responses.map(r => r.json()));
  assert.equal(arrived, n); assert.equal(winners, 1);
  assert.ok(bodies.every(x => x.slug === bodies[0].slug && x.url === bodies[0].url));
  assert.match(bodies[0].slug, /^sealed-with-a-kiss-free-[a-f0-9]{48}$/);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('a stale publisher cannot report success after a different snapshot wins', async t => {
  const env = await fixture(t), d = await draft(env), pg = await store.getInvite(env.DB, d.id);
  let unblock, firstReached, first = true;
  const paused = new Promise(resolve => { firstReached = resolve; }), gate = new Promise(resolve => { unblock = resolve; });
  interceptFreeWrites(env.DB, { async before() { if (first) { first = false; firstReached(); await gate; } } });
  const stale = publish(env, FREE, d); await paused;
  const fresh = bySlug(FREE).schema.validate({ ...bySlug(FREE).config.demo, senderName: 'New snapshot' }, { mode: 'draft' });
  assert.ok(await store.updateInvite(env.DB, d.id, pg.owner_hash, fresh));
  const winning = await publish(env, FREE, d); assert.equal(winning.status, 200);
  const winningBody = await winning.json(); unblock();
  const lost = await stale; assert.equal(lost.status, 409); assert.equal((await lost.json()).error, 'free_publish_conflict');
  const stored = await store.getInvite(env.DB, d.id); assert.equal(stored.public_slug, winningBody.slug);
  assert.deepEqual(stored.customer_data, fresh); assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('colliding random slug is retried, preserving the existing invitation', async t => {
  const env = await fixture(t), d = await draft(env), otherData = { sender: 'Other owner' };
  const other = await createTestInvite(env.DB, FREE, 'other-owner', otherData), taken = slugFor(FREE, key('a'));
  assert.ok(await store.publishFree(env.DB, other.id, 'other-owner', FREE, otherData, taken));
  const originalRandom = crypto.getRandomValues.bind(crypto); let generated = 0;
  t.mock.method(crypto, 'getRandomValues', bytes => {
    if (bytes.length !== 24) return originalRandom(bytes);
    bytes.fill(generated++ === 0 ? 0xaa : 0xbb); return bytes;
  });
  const r = await publish(env, FREE, d); assert.equal(r.status, 200, await r.clone().text());
  const body = await r.json(); assert.equal(generated, 2); assert.equal(body.slug, slugFor(FREE, key('b')));
  assert.equal((await store.getInviteByPublicSlug(env.DB, taken)).id, other.id);
  assert.equal((await store.getInviteByPublicSlug(env.DB, body.slug)).id, d.id);
  assert.deepEqual(counts(env), { orders: 0, published: 2 });
});

test('repeated slug collisions stop after five attempts without a write or order', async t => {
  const env = await fixture(t), d = await draft(env), data = { name: 'Other' };
  const other = await createTestInvite(env.DB, FREE, 'other-owner', data);
  assert.ok(await store.publishFree(env.DB, other.id, 'other-owner', FREE, data, slugFor(FREE, key('a'))));
  const originalRandom = crypto.getRandomValues.bind(crypto); let generated = 0;
  t.mock.method(crypto, 'getRandomValues', bytes => {
    if (bytes.length !== 24) return originalRandom(bytes);
    generated++; bytes.fill(0xaa); return bytes;
  });
  const r = await publish(env, FREE, d); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'slug_unavailable');
  assert.equal(generated, 5); assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('unexpected D1 errors are not treated as slug collisions or leaked', async t => {
  const env = await fixture(t), d = await draft(env); let attempts = 0;
  interceptFreeWrites(env.DB, { before() { attempts++; throw new Error('internal DB details'); } });
  t.mock.method(console, 'error', () => {});
  const r = await publish(env, FREE, d); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { error: 'server_error' });
  assert.equal(attempts, 1); assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
});

test('pre-existing non-free published slugs retain paid replay behavior and cannot be reclassified as free', async t => {
  const env = await fixture(t), d = await draft(env, PAID), existingSlug = `${PAID}-${'a'.repeat(18)}`;
  // Local fixture for an already-published old-format row without an order.
  env.DB.raw.prepare("UPDATE invites SET status='published', public_slug=? WHERE id=?").run(existingSlug, d.id);
  let r = await publish(env, PAID, d);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
  r = await publish({ ...env, ...secrets, FREE_PUBLISH_ENABLED: 'false' }, PAID, d);
  assert.equal(r.status, 200); assert.equal((await r.json()).slug, existingSlug);
  assert.deepEqual(counts(env), { orders: 0, published: 1 });
});

test('a formerly free builder cannot start paid checkout without explicit paid confirmation', async t => {
  const env = { ...await fixture(t), ...secrets }, d = await draft(env, FREE);
  env.DB.raw.prepare('UPDATE templates SET price=9900 WHERE slug=?').run(FREE);
  const bodies = [
    {}, { price: 0, amount: 0 }, { checkout_mode: 'paid' },
    { checkout_mode: 'paid', expected_amount_paise: 0, expected_currency: 'INR' },
    { checkout_mode: 'paid', expected_amount_paise: '9900', expected_currency: 'INR' },
    { checkout_mode: 'paid', expected_amount_paise: 9900, expected_currency: 'USD' },
  ];
  for (const body of bodies) {
    const r = await publish(env, FREE, d, body);
    assert.equal(r.status, 409); assert.equal((await r.json()).error, 'checkout_confirmation_required');
  }
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
});

test('a paid quote changed before D1 lock cannot create an order or call the gateway', async t => {
  const env = { ...await fixture(t), ...secrets }, d = await draft(env, PAID), batch = env.DB.batch.bind(env.DB);
  let interleaved = false;
  env.DB.batch = async statements => {
    if (!interleaved && statements[0].sql.includes('INSERT INTO orders')) {
      interleaved = true; env.DB.raw.prepare('UPDATE templates SET price=19800 WHERE slug=?').run(PAID);
    }
    return batch(statements);
  };
  const r = await publish(env, PAID, d, { checkout_mode: 'paid', expected_amount_paise: 9900, expected_currency: 'INR' });
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'checkout_in_progress');
  assert.equal(interleaved, true); assert.equal((await store.getInvite(env.DB, d.id)).status, 'draft');
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
});

test('paid templates reject client-asserted zero; enabled checkout retains server-side paise and paid lock', async t => {
  let requestedAmount;
  const env = await fixture(t, async (url, options) => {
    assert.equal(url, 'https://api.razorpay.com/v1/orders'); assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body); requestedAmount = body.amount;
    return Response.json({ id: 'order_example', amount: body.amount, currency: body.currency });
  });
  const d = await draft(env, PAID);
  let r = await publish(env, PAID, d, { price: 0, amount: 0, customer_data: bySlug(PAID).config.demo });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
  assert.deepEqual(counts(env), { orders: 0, published: 0 });
  env.network.expected = 1;
  r = await publish({ ...env, ...secrets }, PAID, d, { price: 0, amount: 0, checkout_mode: 'paid', expected_amount_paise: 9900, expected_currency: 'INR' });
  assert.equal(r.status, 200, await r.clone().text()); const response = await r.json();
  assert.equal(requestedAmount, 9900); assert.equal(response.amount, 9900); assert.equal(response.razorpay, true);
  const pg = await store.getInvite(env.DB, d.id); assert.equal(pg.status, 'payment_pending'); assert.equal(pg.public_slug, null);
  assert.deepEqual(counts(env), { orders: 1, published: 0 });
  // A price drop and the free flag cannot republish the locked paid intent.
  env.DB.raw.prepare('UPDATE templates SET price=0 WHERE slug=?').run(PAID);
  r = await publish(env, PAID, d); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
  assert.equal((await store.getOrderForInvite(env.DB, d.id)).status, 'pending');
});

test('paid pending retry binds explicit confirmation to its order even after the catalog price changes', async t => {
  const env = { ...await fixture(t, async (_url, options) => {
    const body = JSON.parse(options.body);
    return Response.json({ id: 'order_retry', amount: body.amount, currency: body.currency });
  }), ...secrets }, d = await draft(env, PAID);
  const consent = { checkout_mode: 'paid', expected_amount_paise: 9900, expected_currency: 'INR' };
  env.network.expected = 1;
  let r = await publish(env, PAID, d, consent); assert.equal(r.status, 200);
  const original = await r.json();
  env.DB.raw.prepare('UPDATE templates SET price=0 WHERE slug=?').run(PAID);
  r = await publish(env, PAID, d); assert.equal(r.status, 409); assert.equal((await r.json()).error, 'checkout_confirmation_required');
  r = await publish(env, PAID, d, { ...consent, expected_amount_paise: 0 }); assert.equal(r.status, 409);
  r = await publish(env, PAID, d, consent); assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), original);
  assert.equal((await store.getOrderForInvite(env.DB, d.id)).status, 'pending');
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'payment_pending');
});

test('a paid captured webhook still reconciles with free flag on, checkout paused and price now zero', async t => {
  const env = await fixture(t, async (url, options) => {
    assert.equal(url, 'https://api.razorpay.com/v1/payments/pay_example'); assert.equal(options.method, 'GET');
    return Response.json({ id: 'pay_example', order_id: 'order_example', amount: 9900,
      currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 });
  });
  Object.assign(env, secrets, { CHECKOUT_ENABLED: 'false' });
  const d = await draft(env, PAID), pg = await store.getInvite(env.DB, d.id);
  const order = await store.beginCheckout(env.DB, d.id, pg.owner_hash, 9900, 'INR', pg.customer_data);
  await store.setGatewayOrder(env.DB, order.id, 'order_example');
  env.DB.raw.prepare('UPDATE templates SET price=0 WHERE slug=?').run(PAID);
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_example', order_id: 'order_example' } } } });
  const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  env.network.expected = 1;
  const r = await worker.fetch(new Request(origin + '/api/razorpay/webhook', { method: 'POST', headers: {
    'Content-Type': 'application/json', 'x-razorpay-signature': signature,
  }, body: raw }), env);
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await store.getOrder(env.DB, order.id)).status, 'paid'); assert.equal((await store.getInvite(env.DB, d.id)).status, 'published');
  let replay = await publish(env, PAID, d); assert.equal(replay.status, 503);
  assert.equal((await replay.json()).error, 'payments_offline', 'paid invite is not reclassified as free');
  replay = await publish({ ...env, CHECKOUT_ENABLED: 'true', FREE_PUBLISH_ENABLED: 'false' }, PAID, d);
  assert.equal(replay.status, 200, 'canonical paid replay still uses the paid gate');
  assert.equal((await replay.json()).slug, (await store.getInvite(env.DB, d.id)).public_slug);
  assert.deepEqual(counts(env), { orders: 1, published: 1 });
});

test('all zero-price supported family demos publish; legacy routes stay locked and free builder requires readiness', async t => {
  const env = await fixture(t), free = list.filter(tpl => (tpl.config.price || 0) === 0); let cookie;
  for (const tpl of free) {
    const d = await draft(env, tpl.slug, tpl.config.demo, cookie); cookie = d.cookie;
    const r = await publish(env, tpl.slug, d);
    assert.equal(r.status, 200, `${tpl.slug}: ${await r.clone().text()}`);
    const body = await r.json(); assert.match(body.slug, new RegExp(`^${tpl.slug}-free-[a-f0-9]{48}$`));
  }
  assert.deepEqual(counts(env), { orders: 0, published: free.length });
  const unsupported = await worker.fetch(post('/api/maafi/publish', { id: 'a'.repeat(18) }, cookie), env);
  assert.equal(unsupported.status, 404);
  let page = await worker.fetch(new Request(origin + '/create/' + FREE), env); assert.equal(page.status, 200);
  assert.match(await page.text(), /id="publish" class="button publish" aria-describedby="free-publish-hint"/);
  page = await worker.fetch(new Request(origin + '/create/' + FREE), { ...env, FREE_PUBLISH_ENABLED: 'false' });
  assert.match(await page.text(), /id="publish" class="button publish" disabled/);
});
