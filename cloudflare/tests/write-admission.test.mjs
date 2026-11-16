import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { D1 } from './d1-shim.mjs';
import * as store from '../src/store.mjs';

// These are deliberately test-only policy values. Routes must supply their own
// trusted, server-controlled values; the store has no fallback budgets.
const WIDE_DRAFT_LIMITS = Object.freeze({ maxPerOwnerTemplate24h: 100, maxGlobal24h: 100 });
const templates = [{ slug: 'rose', name: 'Rose' }, { slug: 'amber', name: 'Amber' }];
const schema = readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');

async function memoryFixture(t) {
  const db = new D1();
  t.after(() => db.raw.close());
  await store.seedTemplates(db, templates);
  return db;
}
async function fileFixture(t) {
  // Each race uses a fresh temporary SQLite database and independent
  // connections. No existing databases, services, or buckets are touched.
  const dir = mkdtempSync(join(tmpdir(), 'paigaam-quota-test-'));
  const dbPath = join(dir, 'isolated-test.sqlite');
  const db = Object.create(D1.prototype);
  db.raw = new DatabaseSync(dbPath);
  db.raw.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=15000;');
  db.raw.exec(schema);
  t.after(() => { db.raw.close(); rmSync(dir, { recursive: true, force: true }); });
  await store.seedTemplates(db, templates);
  return { db, dbPath };
}
async function create(db, slug = 'rose', owner = 'owner-a', limits = WIDE_DRAFT_LIMITS) {
  return store.createInvite(db, slug, owner, { name: 'test data' }, limits);
}
async function publish(db, invite, owner) {
  const order = await store.beginCheckout(db, invite.id, owner, 1, 'INR', invite.customer_data);
  assert.ok(order);
  const gateway = 'gw-' + invite.id;
  assert.ok(await store.setGatewayOrder(db, order.id, gateway));
  const settled = await store.settleOrder(db, gateway, 'payment-' + invite.id, 'public-' + invite.id);
  assert.equal(settled.invite.status, 'published');
}
function inviteCount(db) { return db.raw.prepare('SELECT count(*) AS n FROM invites').get().n; }
function uploadTotals(db) { return db.raw.prepare('SELECT count(*) AS n, COALESCE(SUM(size),0) AS bytes FROM uploads').get(); }

// Real simultaneous contenders: each worker opens its own SQLite connection,
// waits at a shared start barrier, then invokes the unmodified store function.
// SQLite serializes the statements, as D1 does on its primary. This does not
// prove network or Cloudflare operational behavior.
const workerSource = `
  import { parentPort, workerData } from 'node:worker_threads';
  import { DatabaseSync } from 'node:sqlite';
  const store = await import(workerData.storeUrl);
  const raw = new DatabaseSync(workerData.dbPath);
  raw.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=15000;');
  class Statement {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...args) { return new Statement(this.sql, args); }
    async first() { return raw.prepare(this.sql).get(...this.args) ?? null; }
  }
  const db = { prepare: sql => new Statement(sql) };
  const gate = new Int32Array(workerData.gate);
  parentPort.postMessage({ type: 'ready' });
  Atomics.wait(gate, 0, 0);
  try {
    const p = workerData.payload;
    const result = p.action === 'create'
      ? await store.createInvite(db, p.slug, p.owner, { test: true }, p.limits)
      : await store.addUpload(db, p.record, p.limits);
    parentPort.postMessage({ type: 'result', accepted: result !== null, id: result?.id ?? result?.key ?? null });
  } catch (error) {
    parentPort.postMessage({ type: 'failure', message: error.message, stack: error.stack });
  } finally { raw.close(); }
`;
const workerUrl = new URL('data:text/javascript,' + encodeURIComponent(workerSource));
const storeUrl = new URL('../src/store.mjs', import.meta.url).href;
async function contend(dbPath, payloads) {
  const gate = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const start = new Int32Array(gate);
  const workers = [];
  try {
    return await new Promise((resolve, reject) => {
      const results = Array(payloads.length);
      let ready = 0, exited = 0, finished = false;
      const timeout = setTimeout(() => fail(new Error('concurrency fixture timed out')), 30000);
      timeout.unref();
      function fail(error) {
        if (!finished) { finished = true; clearTimeout(timeout); reject(error); }
      }
      payloads.forEach((payload, i) => {
        const worker = new Worker(workerUrl, { workerData: { gate, dbPath, payload, storeUrl } });
        workers.push(worker);
        worker.on('message', message => {
          if (message.type === 'ready') {
            if (++ready === payloads.length) {
              Atomics.store(start, 0, 1);
              Atomics.notify(start, 0, payloads.length);
            }
          } else if (message.type === 'failure') {
            fail(new Error(`contender failed: ${message.message}\n${message.stack}`));
          } else if (message.type === 'result') results[i] = message;
        });
        worker.once('error', fail);
        worker.once('exit', code => {
          if (code !== 0 || !results[i]) return fail(new Error(`contender exited unexpectedly: ${code}`));
          if (++exited === payloads.length && !finished) { finished = true; clearTimeout(timeout); resolve(results); }
        });
      });
    });
  } finally {
    // Also release and stop waiters if a peer fails before the start barrier.
    Atomics.store(start, 0, 1);
    Atomics.notify(start, 0, payloads.length);
    await Promise.all(workers.map(worker => worker.terminate()));
  }
}

test('empty database admits within limits, with one conditional INSERT/RETURNING per operation', async t => {
  const db = await memoryFixture(t);
  assert.equal(inviteCount(db), 0);
  assert.equal(uploadTotals(db).n, 0);
  const statements = [];
  const prepare = db.prepare.bind(db);
  db.prepare = sql => { statements.push(sql); return prepare(sql); };
  const invite = await create(db, 'rose', 'owner-a', { maxPerOwnerTemplate24h: 1, maxGlobal24h: 1 });
  assert.ok(invite);
  assert.deepEqual(invite.customer_data, { name: 'test data' });
  assert.match(invite.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /INSERT INTO invites[\s\S]*SELECT[\s\S]*RETURNING \*/i);
  assert.equal((statements[0].match(/count\(\*\)/gi) || []).length, 2);

  statements.length = 0;
  const upload = await store.addUpload(db, { key: 'first', invite_id: invite.id, mime: 'image/png', size: 9 },
    { kind: 'image', maxCount: 1, maxTotalBytes: 9 });
  assert.ok(upload);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /INSERT INTO uploads[\s\S]*COALESCE\(SUM\(size\),\s*0\)[\s\S]*RETURNING \*/i);
  assert.equal(uploadTotals(db).bytes, 9);
  assert.equal(await create(db, 'rose', 'owner-a', { maxPerOwnerTemplate24h: 1, maxGlobal24h: 1 }), null);
});

test('owner/template caps are independent and include draft, pending and published rows', async t => {
  const db = await memoryFixture(t);
  const limits = { maxPerOwnerTemplate24h: 1, maxGlobal24h: 20 };
  const aRose = await create(db, 'rose', 'owner-a', limits);
  await publish(db, aRose, 'owner-a');
  assert.equal(await create(db, 'rose', 'owner-a', limits), null);
  const aAmber = await create(db, 'amber', 'owner-a', limits);
  assert.ok(await store.beginCheckout(db, aAmber.id, 'owner-a', 1, 'INR', aAmber.customer_data));
  assert.equal((await store.getInvite(db, aAmber.id)).status, 'payment_pending');
  assert.equal(await create(db, 'amber', 'owner-a', limits), null);
  const bRose = await create(db, 'rose', 'owner-b', limits);
  assert.ok(bRose);
  assert.equal(await create(db, 'rose', 'owner-b', limits), null);
  assert.equal(inviteCount(db), 3);
});

test('global cap spans owners and templates and counts every invite status', async t => {
  const db = await memoryFixture(t);
  const limits = { maxPerOwnerTemplate24h: 10, maxGlobal24h: 3 };
  const published = await create(db, 'rose', 'owner-a', limits);
  await publish(db, published, 'owner-a');
  const pending = await create(db, 'amber', 'owner-b', limits);
  assert.ok(await store.beginCheckout(db, pending.id, 'owner-b', 1, 'INR', pending.customer_data));
  assert.ok(await create(db, 'rose', 'owner-c', limits));
  assert.equal(await create(db, 'amber', 'new-owner', limits), null);
  assert.equal(inviteCount(db), 3);
});

test('24-hour cutoff uses the stored ISO timestamp format across a year boundary', async t => {
  // SQLite datetime() would emit a space instead of T, mistakenly counting a
  // just-expired record on the same date. Pin the SQLite clock in prepared SQL
  // so exact +/- 1 ms boundary checks are deterministic (no wall-clock race).
  const now = '2026-01-01T09:30:30.500Z';
  const cutoff = Date.parse(now) - 24 * 60 * 60 * 1000;
  const before = new Date(cutoff - 1).toISOString();
  const comparison = new DatabaseSync(':memory:');
  try {
    const r = comparison.prepare(`SELECT ? < strftime('%Y-%m-%dT%H:%M:%fZ',?,'-24 hours') AS iso,
      ? < datetime(?,'-24 hours') AS space_separated`).get(before, now, before, now);
    assert.equal(r.iso, 1);
    assert.equal(r.space_separated, 0); // regression demonstration
  } finally { comparison.close(); }

  for (const scope of ['owner', 'global']) {
    for (const [name, delta, admitted] of [['older-same-day', -3600000, true], ['one-ms-old', -1, true],
      ['exact-cutoff', 0, false], ['one-ms-inside', 1, false]]) {
      await t.test(`${scope}: ${name}`, async t => {
        const db = await memoryFixture(t);
        const createdAt = new Date(cutoff + delta).toISOString();
        db.raw.prepare(`INSERT INTO invites(id,template_slug,owner_hash,customer_data,status,public_slug,created_at)
          VALUES(?,?,?,?,?,?,?)`).run('000000000000000001', 'rose', scope === 'owner' ? 'owner-a' : 'other', '{}',
          'published', 'old-public', createdAt);
        const prepare = db.prepare.bind(db);
        db.prepare = sql => prepare(sql.replaceAll("'now'", `'${now}'`));
        const limits = scope === 'owner'
          ? { maxPerOwnerTemplate24h: 1, maxGlobal24h: 10 }
          : { maxPerOwnerTemplate24h: 10, maxGlobal24h: 1 };
        const result = await create(db, 'rose', 'owner-a', limits);
        assert.equal(result !== null, admitted);
        assert.equal(inviteCount(db), admitted ? 2 : 1);
      });
    }
  }
});

test('limit arguments must be explicit positive safe integers and errors disclose no fixture data', async t => {
  const db = await memoryFixture(t);
  const invalid = [undefined, null, 0, -1, 1.5, NaN, Infinity, -Infinity, '1', true, {}, [], Number.MAX_SAFE_INTEGER + 1];
  const owner = 'private-owner-hash', customer = { name: 'private-customer-name' };
  const verifyError = field => error => {
    assert.ok(error instanceof TypeError);
    assert.match(error.message, new RegExp(field));
    assert.doesNotMatch(error.message, /private-owner-hash|private-customer-name/);
    return true;
  };
  await assert.rejects(store.createInvite(db, 'rose', owner, customer), verifyError('maxPerOwnerTemplate24h'));
  await assert.rejects(store.createInvite(db, 'rose', owner, customer, null), TypeError);
  for (const value of invalid) {
    await assert.rejects(store.createInvite(db, 'rose', owner, customer,
      { maxPerOwnerTemplate24h: value, maxGlobal24h: 1 }), verifyError('maxPerOwnerTemplate24h'));
    await assert.rejects(store.createInvite(db, 'rose', owner, customer,
      { maxPerOwnerTemplate24h: 1, maxGlobal24h: value }), verifyError('maxGlobal24h'));
  }
  assert.equal(inviteCount(db), 0);
  const invite = await store.createInvite(db, 'rose', owner, customer,
    { maxPerOwnerTemplate24h: Number.MAX_SAFE_INTEGER, maxGlobal24h: Number.MAX_SAFE_INTEGER });
  assert.ok(invite);
  const record = { key: 'test-object', invite_id: invite.id, mime: 'image/png', size: 1 };
  await assert.rejects(store.addUpload(db, record, { kind: 'image', maxCount: 2 }), verifyError('maxTotalBytes'));
  for (const value of invalid) {
    await assert.rejects(store.addUpload(db, record, { kind: 'image', maxCount: 2, maxTotalBytes: value }), verifyError('maxTotalBytes'));
  }
  assert.equal(uploadTotals(db).n, 0);
});

test('budget-looking fields in customer data and upload records cannot override trusted options', async t => {
  const db = await memoryFixture(t);
  const customer = { name: 'fixture', maxPerOwnerTemplate24h: 9999, maxGlobal24h: 9999 };
  await assert.rejects(store.createInvite(db, 'rose', 'owner-a', customer), /maxPerOwnerTemplate24h/);
  const limits = { maxPerOwnerTemplate24h: 1, maxGlobal24h: 1 };
  const invite = await store.createInvite(db, 'rose', 'owner-a', customer, limits);
  assert.ok(invite);
  assert.equal(await store.createInvite(db, 'amber', 'owner-b', customer, limits), null);
  const record = { key: 'first', invite_id: invite.id, mime: 'image/png', size: 2, maxTotalBytes: 9999 };
  await assert.rejects(store.addUpload(db, record, { kind: 'image', maxCount: 4 }), /maxTotalBytes/);
  const mediaLimits = { kind: 'image', maxCount: 4, maxTotalBytes: 3 };
  assert.ok(await store.addUpload(db, record, mediaLimits));
  assert.equal(await store.addUpload(db, { ...record, key: 'over' }, mediaLimits), null);
  assert.equal(uploadTotals(db).bytes, 2);
});

test('media byte ceiling spans owners, templates, media kinds and frozen invites', async t => {
  const db = await memoryFixture(t);
  const a = await create(db, 'rose', 'owner-a'), b = await create(db, 'amber', 'owner-b');
  const imageLimits = { kind: 'image', maxCount: 2, maxTotalBytes: 10 };
  const audioLimits = { kind: 'audio', maxCount: 2, maxTotalBytes: 10 };
  assert.ok(await store.addUpload(db, { key: 'a-image', invite_id: a.id, mime: 'image/png', size: 4 }, imageLimits));
  const pending = await store.beginCheckout(db, a.id, 'owner-a', 1, 'INR', a.customer_data);
  assert.ok(pending);
  assert.equal(await store.addUpload(db, { key: 'pending', invite_id: a.id, mime: 'audio/mpeg', size: 1 }, audioLimits), null);
  assert.ok(await store.setGatewayOrder(db, pending.id, 'gw-a'));
  assert.ok(await store.settleOrder(db, 'gw-a', 'paid-a', 'public-a'));
  assert.equal(await store.addUpload(db, { key: 'published', invite_id: a.id, mime: 'image/png', size: 1 }, imageLimits), null);
  assert.ok(await store.addUpload(db, { key: 'b-audio', invite_id: b.id, mime: 'application/ogg', size: 6 }, audioLimits));
  assert.equal(uploadTotals(db).bytes, 10);
  assert.equal(await store.addUpload(db, { key: 'over', invite_id: b.id, mime: 'image/png', size: 1 }, imageLimits), null);
  assert.equal(await store.addUpload(db, { key: 'missing', invite_id: 'missing', mime: 'image/png', size: 0 }, imageLimits), null);
  assert.equal(await store.getUpload(db, 'pending'), null);
  assert.equal(await store.getUpload(db, 'published'), null);
  assert.equal(await store.getUpload(db, 'over'), null);
  assert.equal(uploadTotals(db).n, 2);
  // Zero bytes can fit exactly at the ceiling; the separate per-kind count still applies.
  assert.ok(await store.addUpload(db, { key: 'zero', invite_id: b.id, mime: 'image/png', size: 0 }, imageLimits));
  assert.equal(uploadTotals(db).bytes, 10);
  assert.equal((await store.getInvite(db, b.id)).status, 'draft');
});

test('at and over the byte ceiling fail closed, including large safe integer arithmetic', async t => {
  const db = await memoryFixture(t), invite = await create(db);
  const limits = { kind: 'image', maxCount: 3, maxTotalBytes: Number.MAX_SAFE_INTEGER };
  assert.ok(await store.addUpload(db, { key: 'max', invite_id: invite.id, mime: 'image/png', size: Number.MAX_SAFE_INTEGER }, limits));
  assert.equal(await store.addUpload(db, { key: 'exceeds', invite_id: invite.id, mime: 'image/png', size: 1 }, limits), null);
  assert.equal(await store.addUpload(db, { key: 'lower-budget', invite_id: invite.id, mime: 'image/png', size: 0 },
    { ...limits, maxTotalBytes: 1 }), null);
  assert.equal(uploadTotals(db).bytes, Number.MAX_SAFE_INTEGER);
});

test('independent concurrent writers admit one remaining owner/template slot', async t => {
  const { db, dbPath } = await fileFixture(t);
  const limits = { maxPerOwnerTemplate24h: 3, maxGlobal24h: 100 };
  const first = await create(db, 'rose', 'same-owner', limits);
  await publish(db, first, 'same-owner');
  assert.ok(await create(db, 'rose', 'same-owner', limits));
  const results = await contend(dbPath, Array.from({ length: 8 }, () => ({
    action: 'create', slug: 'rose', owner: 'same-owner', limits,
  })));
  assert.equal(results.filter(result => result.accepted).length, 1);
  assert.equal(results.filter(result => !result.accepted && result.id === null).length, 7);
  assert.equal(inviteCount(db), 3);
});

test('independent concurrent writers admit one remaining global slot across owners/templates', async t => {
  const { db, dbPath } = await fileFixture(t);
  const limits = { maxPerOwnerTemplate24h: 100, maxGlobal24h: 3 };
  const first = await create(db, 'rose', 'existing-a', limits);
  await publish(db, first, 'existing-a');
  const second = await create(db, 'amber', 'existing-b', limits);
  assert.ok(await store.beginCheckout(db, second.id, 'existing-b', 1, 'INR', second.customer_data));
  const results = await contend(dbPath, Array.from({ length: 8 }, (_, i) => ({
    action: 'create', slug: i % 2 ? 'rose' : 'amber', owner: `new-owner-${i}`, limits,
  })));
  assert.equal(results.filter(result => result.accepted).length, 1);
  assert.equal(inviteCount(db), 3);
});

test('independent concurrent media writers cannot overshoot the shared byte ceiling', async t => {
  const { db, dbPath } = await fileFixture(t);
  const a = await create(db, 'rose', 'owner-a'), b = await create(db, 'amber', 'owner-b');
  const c = await create(db, 'rose', 'owner-c');
  assert.ok(await store.addUpload(db, { key: 'baseline', invite_id: a.id, mime: 'image/png', size: 90 },
    { kind: 'image', maxCount: 20, maxTotalBytes: 100 }));
  await publish(db, a, 'owner-a');
  const results = await contend(dbPath, Array.from({ length: 8 }, (_, i) => ({
    action: 'upload',
    record: { key: `race-${i}`, invite_id: i % 2 ? b.id : c.id, mime: i % 2 ? 'image/png' : 'audio/mpeg', size: 7 },
    limits: { kind: i % 2 ? 'image' : 'audio', maxCount: 20, maxTotalBytes: 100 },
  })));
  assert.equal(results.filter(result => result.accepted).length, 1);
  assert.equal(results.filter(result => !result.accepted && result.id === null).length, 7);
  assert.equal(uploadTotals(db).n, 2);
  assert.equal(uploadTotals(db).bytes, 97);
  for (const result of results) if (result.accepted) assert.ok(await store.getUpload(db, result.id));
});
