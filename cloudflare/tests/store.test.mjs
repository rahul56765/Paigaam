import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import * as store from '../src/store.mjs';

// D1-like async boundary; batch is one SQLite transaction, as on actual D1.
// No network, filesystem database, payment calls, R2 bucket or legacy db import.
class Statement {
  constructor(db, sql, args = []) { Object.assign(this, { db, sql, args }); }
  bind(...args) { return new Statement(this.db, this.sql, args); }
  async first() { return this.db.raw.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.db.raw.prepare(this.sql).all(...this.args) }; }
  async run() {
    const r = this.db.raw.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }
}
class D1 {
  constructor() {
    this.raw = new DatabaseSync(':memory:');
    this.raw.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    this.raw.exec('BEGIN');
    try {
      const results = statements.map(s => {
        const q = this.raw.prepare(s.sql);
        if (q.columns().length) return { success: true, results: q.all(...s.args), meta: { changes: 0 } };
        const r = q.run(...s.args);
        return { success: true, results: [], meta: { changes: Number(r.changes) } };
      });
      this.raw.exec('COMMIT');
      return results;
    } catch (error) { this.raw.exec('ROLLBACK'); throw error; }
  }
}
async function fixture(t) {
  const db = new D1();
  t.after(() => db.raw.close());
  await store.seedTemplates(db, [{ slug: 'rose', name: 'Rose', price: 19900, currency: 'INR', config: { demo: { name: 'A' } } }]);
  return db;
}
async function draft(db, owner = 'hash-a') { return store.createInvite(db, 'rose', owner, { name: 'A' }); }
async function pending(db, gateway, owner = 'hash-a') {
  const invite = await draft(db, owner);
  const order = await store.beginCheckout(db, invite.id, owner, 19900, 'INR');
  await store.setGatewayOrder(db, order.id, gateway);
  return { invite, order };
}

test('catalog seed only inserts missing rows; JSON round-trip and stable list', async t => {
  const db = await fixture(t);
  assert.equal(await store.seedTemplates(db, [{ slug: 'rose', name: 'Changed', price: 1 }, { slug: 'amber', name: 'Amber' }]), 1);
  assert.equal(await store.seedTemplates(db, []), 0);
  const rose = await store.getTemplate(db, 'rose');
  assert.equal(rose.name, 'Rose'); assert.equal(rose.price, 19900);
  assert.deepEqual(rose.config, { demo: { name: 'A' } });
  assert.deepEqual((await store.listTemplates(db)).map(t => t.slug), ['amber', 'rose']);
  assert.equal(await store.getTemplate(db, 'missing'), null);
});

test('invite IDs, foreign keys, draft owner guard, replace JSON, durable checkout freeze', async t => {
  const db = await fixture(t), invite = await draft(db);
  assert.match(invite.id, /^[0-9a-f]{18}$/);
  assert.equal(invite.status, 'draft'); assert.equal(invite.public_slug, null);
  assert.deepEqual(invite.customer_data, { name: 'A' });
  assert.equal(await store.getInvite(db, 'absent'), null);
  await assert.rejects(store.createInvite(db, 'absent', 'hash', {}), /FOREIGN KEY/);
  assert.equal(await store.updateInvite(db, invite.id, 'wrong', { name: 'bad' }), null);
  assert.equal(await store.beginCheckout(db, invite.id, 'wrong', 19900, 'INR'), null);
  const updated = await store.updateInvite(db, invite.id, 'hash-a', { other: 1 });
  assert.deepEqual(updated.customer_data, { other: 1 });
  assert.ok(updated.created_at); assert.ok(updated.updated_at);
  const order = await store.beginCheckout(db, invite.id, 'hash-a', 19900, 'INR');
  assert.equal(order.status, 'creating'); assert.equal(order.amount, 19900);
  assert.equal((await store.getInvite(db, invite.id)).status, 'payment_pending');
  assert.equal(await store.updateInvite(db, invite.id, 'hash-a', {}), null);
  assert.equal(await store.beginCheckout(db, invite.id, 'hash-a', 19900, 'INR'), null);
  assert.equal((await store.getOrderForInvite(db, invite.id)).id, order.id);
  assert.equal((await store.getOrder(db, order.id)).invite_id, invite.id);
});

test('upload metadata maps R2 key to invite; rejects frozen draft and missing FK', async t => {
  const db = await fixture(t), invite = await draft(db);
  const record = { key: 'uploads/photo.webp', invite_id: invite.id, mime: 'image/webp', size: 12 };
  const uploaded = await store.addUpload(db, record);
  assert.equal(uploaded.key, record.key); assert.equal(uploaded.size, 12);
  assert.equal((await store.getUpload(db, record.key)).invite_id, invite.id);
  assert.equal((await store.listUploads(db, invite.id)).length, 1);
  await assert.rejects(store.addUpload(db, record), /UNIQUE/);
  assert.equal(await store.addUpload(db, { ...record, key: 'missing', invite_id: 'missing' }), null);
  await store.beginCheckout(db, invite.id, 'hash-a', 0, 'INR');
  assert.equal(await store.addUpload(db, { ...record, key: 'late' }), null);
  assert.equal(await store.getUpload(db, 'late'), null);
});

test('concurrent beginCheckout has one SQL winner, not one per process', async t => {
  const db = await fixture(t), invite = await draft(db);
  const attempts = await Promise.all(Array.from({ length: 20 }, () => store.beginCheckout(db, invite.id, 'hash-a', 19900, 'INR')));
  assert.equal(attempts.filter(Boolean).length, 1);
  assert.equal(db.raw.prepare('SELECT count(*) n FROM orders').get().n, 1);
  assert.equal((await store.getInvite(db, invite.id)).status, 'payment_pending');
});

test('checkout batch rolls back insert if invite lock update fails', async t => {
  const db = await fixture(t), invite = await draft(db);
  db.raw.exec("CREATE TRIGGER fail_lock BEFORE UPDATE OF status ON invites WHEN new.status='payment_pending' BEGIN SELECT RAISE(ABORT,'injected failure'); END");
  await assert.rejects(store.beginCheckout(db, invite.id, 'hash-a', 1, 'INR'), /injected failure/);
  assert.equal((await store.getInvite(db, invite.id)).status, 'draft');
  assert.equal(db.raw.prepare('SELECT count(*) n FROM orders').get().n, 0);
});

test('gateway mapping is unique, idempotent, and cannot be changed', async t => {
  const db = await fixture(t), first = await pending(db, 'gw-a'), second = await draft(db);
  assert.equal((await store.setGatewayOrder(db, first.order.id, 'gw-a')).status, 'pending');
  assert.equal(await store.setGatewayOrder(db, first.order.id, 'gw-other'), null);
  const order2 = await store.beginCheckout(db, second.id, 'hash-a', 1, 'INR');
  await assert.rejects(store.setGatewayOrder(db, order2.id, 'gw-a'), /UNIQUE/);
  assert.equal((await store.getOrder(db, order2.id)).status, 'creating');
  assert.equal((await store.getOrderByGateway(db, 'gw-a')).id, first.order.id);
  assert.equal(await store.getOrderByGateway(db, 'absent'), null);
});

test('settlement pays exact order and publishes exact invite; replay returns persisted slug', async t => {
  const db = await fixture(t), a = await pending(db, 'gw-a'), b = await pending(db, 'gw-b');
  const settled = await store.settleOrder(db, 'gw-a', 'pay-a', 'rose-public');
  assert.equal(settled.order.id, a.order.id); assert.equal(settled.order.status, 'paid');
  assert.equal(settled.invite.id, a.invite.id); assert.equal(settled.invite.status, 'published');
  assert.equal((await store.getInviteByPublicSlug(db, 'rose-public')).id, a.invite.id);
  assert.equal((await store.getOrder(db, b.order.id)).status, 'pending');
  assert.equal((await store.getInvite(db, b.invite.id)).status, 'payment_pending');
  const replay = await store.settleOrder(db, 'gw-a', 'pay-a', 'ignored-new-slug');
  assert.equal(replay.invite.public_slug, 'rose-public');
  assert.equal(await store.settleOrder(db, 'gw-a', 'different-payment', 'other'), null);
  assert.equal(await store.settleOrder(db, 'unknown', 'pay-unknown', 'other'), null);
  assert.equal(await store.getInviteByPublicSlug(db, 'ignored-new-slug'), null);
  assert.equal(await store.beginCheckout(db, a.invite.id, 'hash-a', 1, 'INR'), null);
});

test('concurrent webhook replay and distinct payment race preserve a single payment', async t => {
  const db = await fixture(t), a = await pending(db, 'gw-a');
  const replays = await Promise.all(Array.from({ length: 20 }, (_, i) => store.settleOrder(db, 'gw-a', 'pay-a', `public-${i}`)));
  assert.equal(replays.length, 20);
  assert.ok(replays.every(r => r.order.gateway_payment_id === 'pay-a' && r.invite.public_slug === 'public-0'));
  const b = await pending(db, 'gw-b');
  const race = await Promise.all(['pay-b1', 'pay-b2'].map(p => store.settleOrder(db, 'gw-b', p, 'public-b')));
  assert.equal(race.filter(Boolean).length, 1);
  assert.equal((await store.getOrder(db, b.order.id)).gateway_payment_id, 'pay-b1');
  assert.equal((await store.getOrder(db, a.order.id)).gateway_payment_id, 'pay-a');
});

test('duplicate payment across orders and slug collisions roll back BOTH writes', async t => {
  const db = await fixture(t), a = await pending(db, 'gw-a'), b = await pending(db, 'gw-b');
  await store.settleOrder(db, 'gw-a', 'pay-a', 'public-a');
  await assert.rejects(store.settleOrder(db, 'gw-b', 'pay-a', 'public-b'), /UNIQUE/);
  assert.equal((await store.getOrder(db, b.order.id)).status, 'pending');
  assert.equal((await store.getInvite(db, b.invite.id)).status, 'payment_pending');
  await assert.rejects(store.settleOrder(db, 'gw-b', 'pay-b', 'public-a'), /UNIQUE/);
  assert.equal((await store.getOrder(db, b.order.id)).gateway_payment_id, null);
  assert.equal((await store.getInvite(db, b.invite.id)).public_slug, null);
  assert.equal((await store.settleOrder(db, 'gw-b', 'pay-b', 'public-b')).invite.public_slug, 'public-b');
  assert.equal((await store.getOrder(db, a.order.id)).gateway_payment_id, 'pay-a');
});

test('failed/nonpending orders and unexpected invite states cannot settle', async t => {
  const db = await fixture(t), a = await pending(db, 'gw-a');
  db.raw.prepare("UPDATE orders SET status='failed' WHERE id=?").run(a.order.id);
  assert.equal(await store.settleOrder(db, 'gw-a', 'pay-a', 'public-a'), null);
  const b = await pending(db, 'gw-b');
  db.raw.prepare("UPDATE invites SET status='draft' WHERE id=?").run(b.invite.id);
  assert.equal(await store.settleOrder(db, 'gw-b', 'pay-b', 'public-b'), null);
  assert.equal((await store.getOrder(db, b.order.id)).status, 'pending');
});

test('constraints and argument validation reject invalid money, JSON and status', async t => {
  const db = await fixture(t), invite = await draft(db);
  for (const amount of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(store.beginCheckout(db, invite.id, 'hash-a', amount, 'INR'), /minor units/);
  }
  await assert.rejects(store.createInvite(db, 'rose', '', {}), /ownerHash/);
  await assert.rejects(store.updateInvite(db, invite.id, 'hash-a', []), /object/);
  assert.throws(() => db.raw.prepare("UPDATE invites SET customer_data='invalid' WHERE id=?").run(invite.id), /CHECK/);
  assert.throws(() => db.raw.prepare("UPDATE invites SET status='invalid' WHERE id=?").run(invite.id), /CHECK/);
  assert.throws(() => db.raw.prepare("UPDATE invites SET status='published' WHERE id=?").run(invite.id), /CHECK/);
});
