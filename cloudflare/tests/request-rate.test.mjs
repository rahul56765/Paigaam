import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { D1 } from './d1-shim.mjs';
import { TEST_IP, TEST_RATE_KEY } from './rate-fixtures.mjs';
import { REQUEST_RATE } from '../src/admission-policy.mjs';
import { canonicalIp, enforceRequestRate, rateLimiterReady } from '../src/request-rate.mjs';
import worker from '../src/worker.mjs';
import { list, bySlug } from '../src/catalog.generated.mjs';
import { hash } from '../src/security.mjs';
import * as store from '../src/store.mjs';

// All storage, credentials, addresses and gateway responses in this file are
// fictional. The file-backed races use new temporary SQLite databases only.
const origin = 'https://preview.example';
const MIGRATION = readFileSync(new URL('../migrations/0006_request_rate.sql', import.meta.url), 'utf8');
const request = (ip = TEST_IP, headers = {}) => new Request(origin, { headers: {
  ...(ip === null ? {} : { 'CF-Connecting-IP': ip }), ...headers,
} });
const envFor = DB => ({ DB, RATE_LIMIT_HMAC_KEY: TEST_RATE_KEY });
async function fixture(t, rateSchema = true) {
  const DB = new D1({ rateSchema }); t.after(() => DB.raw.close());
  await store.seedTemplates(DB, list.map(x => ({ slug: x.slug, name: x.config.name,
    price: Math.round((x.config.price || 0) * 100), config: x.config, currency: 'INR' })));
  const objects = new Map(), MEDIA = {
    objects, puts: 0,
    async put(key, bytes) { this.puts++; objects.set(key, bytes); },
    async head(key) { return objects.has(key) ? {} : null; },
    async get(key) { const body = objects.get(key); return body ? { body, size: body.length } : null; },
    async delete(key) { objects.delete(key); },
  };
  return { DB, MEDIA, RATE_LIMIT_HMAC_KEY: TEST_RATE_KEY, DRAFTS_ENABLED: 'true', FREE_PUBLISH_ENABLED: 'true' };
}
function post(path, body, { ip = TEST_IP, cookie, headers = {}, method = 'POST' } = {}) {
  return new Request(origin + path, { method, headers: {
    Origin: origin, 'Content-Type': 'application/json', ...(ip === null ? {} : { 'CF-Connecting-IP': ip }),
    ...(cookie ? { Cookie: cookie } : {}), ...headers,
  }, body: JSON.stringify(body) });
}
async function makeDraft(env, options = {}) {
  const r = await worker.fetch(post('/api/vaidehi/draft', { customer_data: bySlug('vaidehi').config.demo }, options), env);
  assert.equal(r.status, 200, await r.clone().text());
  return { ...await r.json(), cookie: r.headers.get('set-cookie').split(';')[0] };
}
const code = (status, expected) => e => e.status === status && e.code === expected;
const counts = DB => ({
  invites: DB.raw.prepare('SELECT count(*) n FROM invites').get().n,
  uploads: DB.raw.prepare('SELECT count(*) n FROM uploads').get().n,
  orders: DB.raw.prepare('SELECT count(*) n FROM orders').get().n,
});

test('0006 is additive to all prior local schemas and leaves populated rows and prior definitions unchanged', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of ['0001_initial.sql', '0002_admin.sql', '0003_creators.sql', '0004_magazines.sql']) {
      db.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
    }
    db.prepare('INSERT INTO templates(slug,name) VALUES(?,?)').run('fixture', 'Synthetic');
    db.prepare('INSERT INTO invites(id,template_slug,owner_hash,customer_data) VALUES(?,?,?,?)')
      .run('000000000000000001', 'fixture', 'fictional-owner', '{"safe":true}');
    const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type,name").all();
    const before = db.prepare('SELECT * FROM invites').all();
    db.exec(MIGRATION);
    assert.deepEqual(db.prepare('SELECT * FROM invites').all(), before);
    for (const item of schema) assert.deepEqual(db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type=? AND name=?').get(item.type, item.name), item);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE type='table' AND name='request_rate_counters'").get().n, 1);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { db.close(); }
});

test('IP syntax is strict; equivalent IPv6, mapped IPv4, and case canonicalize to a single identity', () => {
  const good = [
    ['0.0.0.0', '4:0.0.0.0'], ['192.0.2.1', '4:192.0.2.1'], ['255.255.255.255', '4:255.255.255.255'],
    ['2001:DB8::1', '6:2001:0db8:0000:0000:0000:0000:0000:0001'],
    ['2001:0db8:0:0:0:0:0:0001', '6:2001:0db8:0000:0000:0000:0000:0000:0001'],
    ['::', '6:0000:0000:0000:0000:0000:0000:0000:0000'],
    ['::1', '6:0000:0000:0000:0000:0000:0000:0000:0001'],
    ['::ffff:192.0.2.1', '4:192.0.2.1'], ['0:0:0:0:0:FFFF:c000:0201', '4:192.0.2.1'],
    ['2001:db8::192.0.2.1', '6:2001:0db8:0000:0000:0000:0000:c000:0201'],
    ['1:2:3:4:5:6:7:8', '6:0001:0002:0003:0004:0005:0006:0007:0008'],
  ];
  for (const [ip, expected] of good) assert.equal(canonicalIp(ip), expected, ip);
  for (const ip of [undefined, null, '', ' 192.0.2.1', '192.0.2.1\n', '192.0.2.1 ', 'localhost',
    '192.0.2.1:443', '[::1]', 'fe80::1%eth0', '192.0.2.1,192.0.2.2', '1.1.1',
    '256.0.0.1', '01.2.3.4', '1.2.3.-1', '0x7f.0.0.1', '1..2.3', '1.2.3.4.5',
    ':1', '1:', '1:::2', '1::2::3', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7:8::', 'abcde::', 'gggg::', '192.0.2.1::', '::ffff:192.00.2.1', '::ffff:256.2.2.2']) {
    assert.equal(canonicalIp(ip), null, String(ip));
  }
});

test('only HMAC digest and coarse counter data enter D1; keys/actions/IPs are domain-separated', async t => {
  const db = new D1(); t.after(() => db.raw.close());
  const env = envFor(db), time = 660000;
  await enforceRequestRate(request('2001:DB8::1'), env, 'draft_create', time);
  await enforceRequestRate(request('2001:0db8:0:0:0:0:0:1'), env, 'draft_create', time);
  await enforceRequestRate(request('2001:db8::1'), env, 'draft_update', time);
  await enforceRequestRate(request('192.0.2.1'), env, 'draft_create', time);
  await enforceRequestRate(request('::ffff:c000:201'), env, 'draft_create', time);
  const rows = db.raw.prepare('SELECT * FROM request_rate_counters ORDER BY action, hits').all();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.hits).sort(), [1, 2, 2]);
  assert.equal(new Set(rows.map(r => r.ip_digest)).size, 3);
  const ipv6Digest = createHmac('sha256', Buffer.from(TEST_RATE_KEY, 'hex'))
    .update('paigaam:request-rate:v1\0draft_create\0' + '6:2001:0db8:0000:0000:0000:0000:0000:0001').digest('hex');
  assert.ok(rows.some(r => r.ip_digest === ipv6Digest && r.hits === 2));
  const exposed = JSON.stringify(rows);
  for (const sensitive of ['2001:DB8::1', '192.0.2.1', TEST_RATE_KEY, '203.0.113.9']) assert.ok(!exposed.includes(sensitive));
  const otherKey = { ...env, RATE_LIMIT_HMAC_KEY: 'fedcba9876543210'.repeat(4) };
  await enforceRequestRate(request('192.0.2.1'), otherKey, 'draft_create', time);
  assert.equal(db.raw.prepare('SELECT count(*) n FROM request_rate_counters').get().n, 4, 'key rotation starts a new bucket');
});

test('alternate IPv6 and IPv4-mapped forms cannot evade an exhausted bucket', async t => {
  const db = new D1(); t.after(() => db.raw.close());
  const env = envFor(db), action = 'draft_create', now = 600000;
  for (let i = 0; i < REQUEST_RATE[action].max; i++) {
    await enforceRequestRate(request(i % 2 ? '2001:DB8::1' : '2001:0db8:0:0:0:0:0:1'), env, action, now);
  }
  await assert.rejects(enforceRequestRate(request('2001:db8:0000:0000:0000:0000:0000:0001'), env, action, now), code(429, 'rate_limited'));
  for (let i = 0; i < REQUEST_RATE[action].max; i++) {
    await enforceRequestRate(request(i % 2 ? '192.0.2.1' : '::ffff:192.0.2.1'), env, action, now);
  }
  await assert.rejects(enforceRequestRate(request('0:0:0:0:0:ffff:c000:201'), env, action, now), code(429, 'rate_limited'));
});

test('fixed window denies exactly at quota, admits on rollover, and never resets backward', async t => {
  const db = new D1(); t.after(() => db.raw.close());
  const env = envFor(db), action = 'draft_create', max = REQUEST_RATE[action].max;
  for (let i = 0; i < max; i++) await enforceRequestRate(request(), env, action, 600000);
  await assert.rejects(enforceRequestRate(request(), env, action, 659999), e => code(429, 'rate_limited')(e) && e.retryAfter === 1);
  await enforceRequestRate(request(), env, action, 660000);
  assert.deepEqual({ ...db.raw.prepare('SELECT window_start,window_end,hits FROM request_rate_counters').get() },
    { window_start: 660, window_end: 720, hits: 1 });
  await assert.rejects(enforceRequestRate(request(), env, action, 650000), code(429, 'rate_limited'));
  assert.equal(db.raw.prepare('SELECT hits FROM request_rate_counters').get().hits, 1);
});

test('bounded opportunistic expiry removes at most 20 records per batch and keeps active counters', async t => {
  const db = new D1(); t.after(() => db.raw.close());
  const put = db.raw.prepare('INSERT INTO request_rate_counters VALUES(?,?,?,?,?)');
  for (let i = 0; i < 25; i++) put.run(i.toString(16).padStart(64, '0'), 'upload', 0, 60, 1);
  await enforceRequestRate(request(), envFor(db), 'draft_update', (60 + 24 * 60 * 60) * 1000);
  assert.equal(db.raw.prepare("SELECT count(*) n FROM request_rate_counters WHERE action='upload'").get().n, 5);
  await enforceRequestRate(request(), envFor(db), 'draft_update', (60 + 24 * 60 * 60) * 1000);
  assert.equal(db.raw.prepare("SELECT count(*) n FROM request_rate_counters WHERE action='upload'").get().n, 0);
  assert.equal(db.raw.prepare("SELECT hits FROM request_rate_counters WHERE action='draft_update'").get().hits, 2);
});

async function race(dbPath, { count, action, nowMs }) {
  const gate = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT), start = new Int32Array(gate), workers = [];
  try {
    return await new Promise((resolve, reject) => {
      let ready = 0, exited = 0, finished = false;
      const results = Array(count), timer = setTimeout(() => fail(new Error('race timeout')), 30000);
      timer.unref();
      function fail(error) { if (!finished) { finished = true; clearTimeout(timer); reject(error); } }
      for (let i = 0; i < count; i++) {
        const contender = new Worker(new URL('./rate-race-worker.mjs', import.meta.url), {
          workerData: { gate, dbPath, ip: TEST_IP, key: TEST_RATE_KEY, action, nowMs },
        });
        workers.push(contender);
        contender.on('message', message => {
          if (message.type === 'ready' && ++ready === count) { Atomics.store(start, 0, 1); Atomics.notify(start, 0, count); }
          else if (message.type === 'failure') fail(new Error(message.message));
          else if (message.type === 'result') results[i] = message;
        });
        contender.once('error', fail);
        contender.once('exit', status => {
          if (status !== 0 || !results[i]) return fail(new Error(`contender exited: ${status}`));
          if (++exited === count && !finished) { finished = true; clearTimeout(timer); resolve(results); }
        });
      }
    });
  } finally {
    Atomics.store(start, 0, 1); Atomics.notify(start, 0, count);
    await Promise.all(workers.map(w => w.terminate()));
  }
}

test('separate concurrent connections racing the final token admit exactly one', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'paigaam-rate-race-')), dbPath = join(dir, 'synthetic.sqlite');
  const db = Object.create(D1.prototype); db.raw = new DatabaseSync(dbPath);
  db.raw.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=15000;'); db.raw.exec(MIGRATION);
  t.after(() => { db.raw.close(); rmSync(dir, { recursive: true, force: true }); });
  const action = 'draft_create', nowMs = 600000;
  for (let i = 0; i < REQUEST_RATE[action].max - 1; i++) await enforceRequestRate(request(), envFor(db), action, nowMs);
  const results = await race(dbPath, { count: 12, action, nowMs });
  assert.equal(results.filter(r => r.accepted).length, 1);
  assert.equal(results.filter(r => !r.accepted).length, 11);
  assert.equal(db.raw.prepare('SELECT hits FROM request_rate_counters').get().hits, REQUEST_RATE[action].max);
});

test('cookie rotation and X-Forwarded-For do not bypass create quota; actions and distinct IPs are isolated', async t => {
  const instant = Date.now(); t.mock.method(Date, 'now', () => instant);
  const env = await fixture(t); let first;
  for (let i = 0; i < REQUEST_RATE.draft_create.max; i++) {
    const d = await makeDraft(env, { headers: { 'X-Forwarded-For': `198.51.100.${i + 1}` } });
    first ||= d;
  }
  assert.equal(counts(env.DB).invites, REQUEST_RATE.draft_create.max);
  const blocked = await worker.fetch(post('/api/vaidehi/draft', { customer_data: {} },
    { headers: { 'X-Forwarded-For': '192.0.2.99' } }), env);
  assert.equal(blocked.status, 429); assert.deepEqual(await blocked.json(), { error: 'rate_limited' });
  assert.ok(Number(blocked.headers.get('Retry-After')) >= 1);
  assert.equal(blocked.headers.get('set-cookie'), null);
  const otherTemplate = await worker.fetch(post('/api/sealed-with-a-kiss/draft', { customer_data: {} }), env);
  assert.equal(otherTemplate.status, 429, 'a different template cannot evade the shared create bucket');
  const update = await worker.fetch(post('/api/vaidehi/draft', { id: first.id, customer_data: {} }, { cookie: first.cookie }), env);
  assert.equal(update.status, 200, 'separate update budget remains available');
  const other = await makeDraft(env, { ip: '198.51.100.5' });
  assert.ok(other.id); assert.equal(counts(env.DB).invites, REQUEST_RATE.draft_create.max + 1);
});

test('updates have an independent quota; denial leaves the last saved snapshot untouched', async t => {
  const instant = Date.now(); t.mock.method(Date, 'now', () => instant);
  const env = await fixture(t), d = await makeDraft(env);
  for (let i = 0; i < REQUEST_RATE.draft_update.max; i++) {
    const r = await worker.fetch(post('/api/vaidehi/draft', { id: d.id, customer_data: {} }, { cookie: d.cookie }), env);
    assert.equal(r.status, 200, await r.clone().text());
  }
  const before = await store.getInvite(env.DB, d.id);
  const r = await worker.fetch(post('/api/vaidehi/draft', { id: d.id, customer_data: bySlug('vaidehi').config.demo }, { cookie: d.cookie }), env);
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'rate_limited');
  assert.deepEqual(await store.getInvite(env.DB, d.id), before);
  const another = await makeDraft(env); assert.ok(another.id, 'create bucket is separate');
});

test('all upload aliases share one allowance and exhaustion precedes body/media writes; publish stays separate', async t => {
  const instant = Date.now(); t.mock.method(Date, 'now', () => instant);
  const env = await fixture(t), d = await makeDraft(env);
  const badId = '0'.repeat(18);
  for (let i = 0; i < REQUEST_RATE.upload.max; i++) {
    const action = ['upload', 'upload-audio', 'audio'][i % 3];
    const r = await worker.fetch(post(`/api/vaidehi/${action}?id=${badId}`, {}, { cookie: d.cookie }), env);
    assert.equal(r.status, 404);
  }
  for (const action of ['upload', 'upload-audio', 'audio']) {
    const r = await worker.fetch(post(`/api/vaidehi/${action}?id=${d.id}`, {}, { cookie: d.cookie }), env);
    assert.equal(r.status, 429); assert.equal((await r.json()).error, 'rate_limited');
  }
  assert.equal(env.MEDIA.puts, 0); assert.equal(counts(env.DB).uploads, 0);
  const publish = await worker.fetch(post('/api/vaidehi/publish', { id: d.id }, { cookie: d.cookie }), env);
  assert.notEqual(publish.status, 429, 'publish has its own quota');
});

test('exhausted publish quota stops free publication before mutation and leaves another IP independent', async t => {
  const instant = Date.now(); t.mock.method(Date, 'now', () => instant);
  const env = await fixture(t), slug = 'sealed-with-a-kiss';
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected gateway call'); });
  const create = await worker.fetch(post(`/api/${slug}/draft`, { customer_data: bySlug(slug).config.demo }), env);
  assert.equal(create.status, 200); const d = await create.json(), cookie = create.headers.get('set-cookie').split(';')[0];
  for (let i = 0; i < REQUEST_RATE.publish.max; i++) await enforceRequestRate(request(), env, 'publish');
  const before = await store.getInvite(env.DB, d.id);
  let r = await worker.fetch(post(`/api/${slug}/publish`, { id: d.id }, { cookie }), env);
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'rate_limited');
  assert.deepEqual(await store.getInvite(env.DB, d.id), before);
  r = await worker.fetch(post(`/api/${slug}/publish`, { id: d.id }, { cookie, ip: '198.51.100.9' }), env);
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await store.getInvite(env.DB, d.id)).status, 'published');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('missing/invalid IP, key, table or transactional failure denies every protected operation without business mutations or leaks', async t => {
  const env = await fixture(t), missingTable = await fixture(t, false), d = await makeDraft(env);
  const initial = counts(env.DB), rowsBefore = env.DB.raw.prepare('SELECT count(*) n FROM request_rate_counters').get().n;
  const logs = []; t.mock.method(console, 'error', (...a) => logs.push(a.join(' ')));
  const operations = [
    () => post('/api/vaidehi/draft', { customer_data: {} }, { ip: null, headers: { 'X-Forwarded-For': TEST_IP } }),
    () => post('/api/vaidehi/draft', { id: d.id, customer_data: {} }, { ip: null, cookie: d.cookie, headers: { 'X-Forwarded-For': TEST_IP } }),
    () => post(`/api/vaidehi/upload?id=${d.id}`, {}, { ip: null, cookie: d.cookie, headers: { 'X-Forwarded-For': TEST_IP } }),
    () => post('/api/vaidehi/publish', { id: d.id }, { ip: null, cookie: d.cookie, headers: { 'X-Forwarded-For': TEST_IP } }),
    () => post('/vaidehi/preview-frame', { customer_data: {} }, { ip: null, headers: { 'X-Forwarded-For': TEST_IP } }),
  ];
  for (const make of operations) {
    const r = await worker.fetch(make(), env);
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'rate_limit_unavailable' });
  }
  const operationsWithIp = [
    () => post('/api/vaidehi/draft', { customer_data: {} }),
    () => post('/api/vaidehi/draft', { id: d.id, customer_data: {} }, { cookie: d.cookie }),
    () => post(`/api/vaidehi/upload?id=${d.id}`, {}, { cookie: d.cookie }),
    () => post('/api/vaidehi/publish', { id: d.id }, { cookie: d.cookie }),
    () => post('/vaidehi/preview-frame', { customer_data: {} }),
  ];
  for (const badKey of [undefined, '', 'a'.repeat(63), 'g'.repeat(64), '00'.repeat(32), 'ff'.repeat(32), TEST_RATE_KEY + '\n', 32]) {
    for (const make of operationsWithIp) {
      const r = await worker.fetch(make(), { ...env, RATE_LIMIT_HMAC_KEY: badKey });
      assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'rate_limit_unavailable' });
    }
  }
  for (const make of operationsWithIp) {
    const r = await worker.fetch(make(), missingTable);
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'rate_limit_unavailable' });
  }
  for (const ip of ['203.0.113.01', '203.0.113.4,198.51.100.1', 'localhost', '[::1]', '::1%eth0']) {
    const r = await worker.fetch(post('/api/vaidehi/draft', { customer_data: {} }, { ip }), env);
    assert.equal(r.status, 503); assert.equal((await r.json()).error, 'rate_limit_unavailable');
  }
  const originalBatch = env.DB.batch.bind(env.DB);
  // Failure after the UPSERT exercises D1-style rollback, not merely a preflight exception.
  env.DB.batch = async statements => originalBatch([statements[0], env.DB.prepare('DELETE FROM missing_counter_table')]);
  const r = await worker.fetch(operationsWithIp[0](), env);
  assert.equal(r.status, 503); const text = await r.text();
  assert.equal(text, '{"error":"rate_limit_unavailable"}');
  assert.ok(!text.includes(TEST_RATE_KEY) && !text.includes(TEST_IP));
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM request_rate_counters').get().n, rowsBefore, 'batch rollback');
  assert.deepEqual(counts(env.DB), initial); assert.deepEqual(counts(missingTable.DB), { invites: 0, uploads: 0, orders: 0 });
  assert.equal(env.MEDIA.puts, 0); assert.equal(missingTable.MEDIA.puts, 0);
  assert.deepEqual(logs, []);
});

test('malformed D1 responses and sensitive exceptions fail closed and never enter responses or logs', async t => {
  const env = await fixture(t), original = env.DB.batch.bind(env.DB), logs = [];
  t.mock.method(console, 'error', (...values) => logs.push(values.join(' ')));
  for (const result of [undefined, [], [null, null], [{ success: false, results: [] }, { success: true }],
    [{ success: true, results: [{ hits: 999999 }] }, { success: true }]]) {
    env.DB.batch = async () => result;
    const r = await worker.fetch(post('/api/vaidehi/draft', { customer_data: {} }), env);
    assert.equal(r.status, 503); assert.equal((await r.json()).error, 'rate_limit_unavailable');
  }
  env.DB.batch = async () => { throw new Error('private database details ' + TEST_IP + ' ' + TEST_RATE_KEY); };
  const r = await worker.fetch(post('/api/vaidehi/draft', { customer_data: {} }), env);
  assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'rate_limit_unavailable' });
  assert.deepEqual(logs, []); assert.deepEqual(counts(env.DB), { invites: 0, uploads: 0, orders: 0 });
  env.DB.batch = original;
});

test('cross-origin rejection precedes quota; drafts-off stateless preview remains unchanged', async t => {
  const instant = Date.now(); t.mock.method(Date, 'now', () => instant);
  const env = await fixture(t);
  for (const headers of [{ Origin: 'https://evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const r = await worker.fetch(post('/api/vaidehi/draft', { customer_data: {} }, { headers }), env);
    assert.equal(r.status, 403); assert.equal((await r.json()).error, 'forbidden');
  }
  const crossPreview = await worker.fetch(post('/vaidehi/preview-frame', { customer_data: {} }, { headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(crossPreview.status, 403);
  assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM request_rate_counters').get().n, 0);
  const p = () => post('/vaidehi/preview-frame', { customer_data: bySlug('vaidehi').config.demo }, { ip: null });
  const baseline = await worker.fetch(p(), {}), explicitOff = await worker.fetch(p(), { DRAFTS_ENABLED: 'false' });
  assert.equal(baseline.status, 200); assert.equal(explicitOff.status, 200);
  assert.equal(await explicitOff.text(), await baseline.text());
  const offWrite = await worker.fetch(post('/api/vaidehi/draft', { customer_data: {} }, { ip: null }), { ...env, DRAFTS_ENABLED: 'false', RATE_LIMIT_HMAC_KEY: undefined });
  assert.equal(offWrite.status, 503); assert.equal((await offWrite.json()).error, 'drafts_offline');
  await enforceRequestRate(request(), env, 'preview_post');
  for (let i = 1; i < REQUEST_RATE.preview_post.max; i++) await enforceRequestRate(request(), env, 'preview_post');
  const limited = await worker.fetch(post('/vaidehi/preview-frame', { customer_data: {} }), env);
  assert.equal(limited.status, 429); assert.equal((await limited.json()).error, 'rate_limited');
  assert.equal((await worker.fetch(new Request(origin + '/vaidehi/demo'), env)).status, 200);
});

test('preview GET and POST share one rate bucket, and oversized GET data is bounded', async t => {
  const instant = Date.now(); t.mock.method(Date, 'now', () => instant);
  const env = await fixture(t);
  const get = data => new Request(origin + '/vaidehi/preview-frame?d=' + encodeURIComponent(data), { headers: { 'CF-Connecting-IP': TEST_IP } });
  let r = await worker.fetch(get('{}'), env); assert.equal(r.status, 200);
  for (let i = 1; i < REQUEST_RATE.preview_post.max; i++) await enforceRequestRate(request(), env, 'preview_post');
  r = await worker.fetch(get('{}'), env); assert.equal(r.status, 429); assert.equal((await r.json()).error, 'rate_limited');
  r = await worker.fetch(post('/vaidehi/preview-frame', { customer_data: {} }), env); assert.equal(r.status, 429);
  const other = await fixture(t);
  r = await worker.fetch(get('x'.repeat(16385)), other); assert.equal(r.status, 413); assert.equal((await r.json()).error, 'too_large');
});

test('builder stays locked without a valid limiter; actual write admission rechecks table', async t => {
  const env = await fixture(t), missingTable = await fixture(t, false);
  assert.equal(await rateLimiterReady(env), true); assert.equal(await rateLimiterReady(missingTable), false);
  const page = async e => (await worker.fetch(new Request(origin + '/create/sealed-with-a-kiss'), e)).text();
  assert.match(await page(env), /id="publish" class="button publish" aria-describedby=/);
  assert.match(await page({ ...env, RATE_LIMIT_HMAC_KEY: undefined }), /id="publish" class="button publish" disabled/);
  assert.match(await page(missingTable), /id="publish" class="button publish" disabled/);
});

test('signed webhook and owner verification remain available with no limiter key/table/IP and checkout paused', async t => {
  const env = await fixture(t, false), slug = 'vaidehi', token = 'e'.repeat(64), owner = await hash(token);
  delete env.RATE_LIMIT_HMAC_KEY;
  Object.assign(env, { DRAFTS_ENABLED: 'false', CHECKOUT_ENABLED: 'false', RAZORPAY_KEY_ID: 'rzp_test_example',
    RAZORPAY_KEY_SECRET: 'fictional-gateway-secret', RAZORPAY_WEBHOOK_SECRET: 'fictional-webhook-secret' });
  const data = bySlug(slug).schema.validate(bySlug(slug).config.demo, { mode: 'draft' });
  const pg = await store.createInvite(env.DB, slug, owner, data, { maxPerOwnerTemplate24h: 2, maxGlobal24h: 2 });
  const order = await store.beginCheckout(env.DB, pg.id, owner, 9900, 'INR', data);
  await store.setGatewayOrder(env.DB, order.id, 'order_example');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, method: options.method });
    return Response.json({ id: 'pay_example', order_id: 'order_example', amount: 9900,
      currency: 'INR', status: 'captured', captured: true, amount_refunded: 0 });
  });
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_example', order_id: 'order_example' } } } });
  const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const webhook = new Request(origin + '/api/razorpay/webhook', { method: 'POST', headers: {
    Origin: 'https://razorpay.example', 'X-Razorpay-Signature': signature, 'Content-Type': 'application/json',
  }, body: raw });
  const a = await worker.fetch(webhook, env);
  assert.equal(a.status, 200, await a.clone().text()); assert.deepEqual(await a.json(), { received: true, handled: true });
  assert.equal((await store.getInvite(env.DB, pg.id)).status, 'published');
  const checkoutSig = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update('order_example|pay_example').digest('hex');
  const b = await worker.fetch(post('/api/razorpay/verify', { razorpay_order_id: 'order_example',
    razorpay_payment_id: 'pay_example', razorpay_signature: checkoutSig }, { ip: null, cookie: 'paigaam_creator=' + token }), env);
  assert.equal(b.status, 200, await b.clone().text());
  assert.ok(calls.every(c => c.method === 'GET')); assert.equal(calls.length, 2);
});
