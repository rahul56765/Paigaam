'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-creators-magazine-'));
process.env.DATA_DIR = dir;
const tracking = require('../lib/creators/tracking');
const creators = require('../lib/creators/store');
const store = require('../lib/magazines/store');
const generate = require('../lib/magazines/generate');
const templateConfig = require('../lib/magazines/templateConfig');
const validate = require('../lib/magazines/validate');
const { db } = require('../db');
after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

// Extract the ACTUAL integration function, avoiding magazineRoutes' boot-time
// resume/sweep/sample generation. Dependencies are real modules, not copied logic.
const routesPath = path.join(__dirname, '../lib/magazineRoutes.js');
const source = fs.readFileSync(routesPath, 'utf8');
const start = source.indexOf('function settleRazorpayOrder(');
const end = source.indexOf('/* ---------- reader API ---------- */', start);
assert.ok(start > 0 && end > start, 'actual settlement source boundaries exist');
const settle = new Function('require', 'store', 'generate', `${source.slice(start, end)}; return settleRazorpayOrder;`)(createRequire(routesPath), store, generate);
let sequence = 0;
function creator() {
  const username = `magpartner${++sequence}`;
  return creators.createCreator({ username, display_name: 'Magazine partner', password: 'magazine-test-password', commission_bps: 1250, coupon_code: username.toUpperCase(), discount_bps: 1000 }, 'test');
}
function publishedMapping() {
  const dataset = { Headline: { type: 'text' } };
  const mapping = templateConfig.fromDataset({ name: `Magazine Fixture ${++sequence}`, tagline: 'A local magazine fixture.', canvaTemplateId: `FIXTURE${sequence}`, pageCount: 1, dataset });
  assert.equal(templateConfig.validateMapping(mapping, dataset).ok, true);
  store.createTemplate(mapping);
  store.saveValidation(mapping.slug, validate.compareDataset(mapping, dataset));
  store.setTemplateStatus(mapping.slug, 'published');
  store.setTemplatePrice(mapping.slug, 100);
  return mapping;
}
function reserve(c, productType, productId, slug, amount = 10000) {
  return creators.reserveOrder({ gateway_order_id: `order_mag_${++sequence}`, product_type: productType, product_id: productId, template_slug: slug, ...creators.quote({ amount_paise: amount, currency: 'INR', coupon_code: c.coupon_code }) });
}
const fulfillment = id => db.prepare('SELECT * FROM partner_fulfillment WHERE gateway_order_id=?').get(id);
const commissions = id => db.prepare("SELECT COUNT(*) n FROM partner_ledger WHERE gateway_order_id=? AND kind='commission'").get(id).n;

test('unknown Razorpay order is not a magazine and has no settlement side effects', () => {
  assert.equal(settle('order_not_a_magazine', 'pay_unknown', 'signature'), '');
  assert.equal(fulfillment('order_not_a_magazine'), undefined);
  assert.equal(commissions('order_not_a_magazine'), 0);
});

test('real disconnected Canva handoff remains failed/pending; accepted retry and replays credit and queue only once', () => {
  const c = creator(), mapping = publishedMapping();
  const order = store.createOrder(mapping.slug, store.hashOwner('a'.repeat(64)), mapping);
  const fields = Object.fromEntries(mapping.fields.map(f => [f.key, 'A local birthday story']));
  store.patchOrder(order.id, { fields_json: JSON.stringify(fields) });
  assert.equal(validate.validateFields(mapping, fields).ok, true);
  assert.deepEqual(validate.missingImages(mapping, []), []);
  assert.equal(store.isConnected(), false);
  const snapshot = reserve(c, 'magazine', order.id, mapping.slug);
  const pay = store.createMagazinePayment(order.id, { amount: snapshot.amount_paise / 100, currency: 'INR', razorpay_order_id: snapshot.gateway_order_id });
  const paymentId = `pay_mag_${++sequence}`;
  const earned = snapshot.commission_paise;
  const originalStart = generate.start;
  let accepted = 0;
  try {
    // No stub here: the production generate.start returns canva_not_connected.
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal(settle(snapshot.gateway_order_id, paymentId, 'signed-fixture'), '');
      const failed = store.getOrder(order.id);
      assert.equal(failed.status, 'failed');
      assert.equal(failed.error_code, 'canva_not_connected');
      assert.equal(failed.error_stage, 'payment_handoff');
      assert.equal(failed.payment_status, 'paid');
      assert.equal(failed.attempts, 0);
      assert.equal(store.magazinePaymentById(pay.id).status, 'paid');
      assert.equal(store.magazinePaymentById(pay.id).razorpay_payment_id, paymentId);
      assert.equal(creators.getOrder(snapshot.gateway_order_id).status, 'paid');
      assert.equal(fulfillment(snapshot.gateway_order_id).status, 'pending');
      assert.equal(commissions(snapshot.gateway_order_id), 1);
      assert.equal(creators.dashboard(c.id).totals.earned_paise, earned);
    }
    // Stub only acceptance: emulate the real queue CAS without enqueuing any
    // Canva work. In-progress/ready replays still execute real generate.start.
    generate.start = id => {
      const current = store.getOrder(id);
      if (!['draft', 'failed'].includes(current.status)) return originalStart(id);
      assert.equal(id, order.id);
      assert.equal(fulfillment(snapshot.gateway_order_id).status, 'pending');
      assert.equal(store.casStatus(id, ['draft', 'failed'], 'queued', { attempts: current.attempts + 1, error_code: null, error_stage: null }), true);
      accepted++;
      return { started: true, order: store.getOrder(id) };
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(settle(snapshot.gateway_order_id, paymentId, 'signed-fixture'), `/magazines/m/${order.id}`);
      assert.equal(store.getOrder(order.id).status, 'queued');
      assert.equal(fulfillment(snapshot.gateway_order_id).status, 'complete');
    }
    store.patchOrder(order.id, { status: 'ready', ready_at: Date.now() });
    assert.equal(settle(snapshot.gateway_order_id, paymentId, 'signed-fixture'), `/magazines/m/${order.id}`);
    assert.equal(store.getOrder(order.id).status, 'ready');
    assert.equal(store.getOrder(order.id).attempts, 1);
    assert.equal(store.getOrder(order.id).error_code, null);
    assert.equal(store.getOrder(order.id).error_stage, null);
    assert.equal(accepted, 1);
    assert.equal(commissions(snapshot.gateway_order_id), 1);
    assert.equal(creators.dashboard(c.id).totals.earned_paise, earned);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM partner_fulfillment WHERE gateway_order_id=?').get(snapshot.gateway_order_id).n, 1);
    assert.equal(generate._state.queue.length, 0);
    assert.equal(generate._state.running.size, 0);
  } finally { generate.start = originalStart; }
});

test('same-slug greeting and magazine stats stay separate and referral magazine paths count correctly', async () => {
  const c = creator(), mapping = publishedMapping(), slug = mapping.slug;
  const greeting = reserve(c, 'paigaam', `greeting-${++sequence}`, slug, 20000);
  const magazine = reserve(c, 'magazine', `magazine-${++sequence}`, slug, 10000);
  tracking.settle(greeting.gateway_order_id, `pay_stats_${++sequence}`);
  tracking.settle(magazine.gateway_order_id, `pay_stats_${++sequence}`);
  creators.recordClick(c.id, { visitor_hash: 'a'.repeat(64), path: `/templates/${slug}` });
  for (let i = 0; i < 2; i++) {
    const headers = {};
    const res = { setHeader(k, v) { headers[k] = v; }, getHeader(k) { return headers[k]; }, writeHead(status, values) { this.statusCode = status; Object.assign(headers, values); }, end() {} };
    const req = { method: 'GET', headers: { cookie: `pg_partner_visitor=${'b'.repeat(64)}`, 'user-agent': 'Human browser' } };
    const u = new URL(`/r/${c.username}?to=${encodeURIComponent(`/magazines/${slug}`)}`, 'https://local.example.test');
    assert.equal(await tracking.runRequest(req, () => tracking.handle(req, res, u, { baseUrl: u.origin })), true);
    assert.equal(res.statusCode, 302);
    assert.equal(headers.Location, `/magazines/${slug}`);
  }
  const stats = creators.dashboard(c.id);
  assert.equal(stats.templates.length, 2);
  for (const [type, expected, clicks] of [['paigaam', greeting, 1], ['magazine', magazine, 2]]) {
    const row = stats.templates.find(t => t.product_type === type);
    assert.equal(row.template_slug, slug);
    assert.equal(row.paid_customers, 1);
    assert.equal(row.revenue_paise, expected.amount_paise);
    assert.equal(row.earned_paise, expected.commission_paise);
    assert.equal(row.clicks, clicks);
  }
  assert.equal(stats.totals.clicks, 3);
  assert.equal(stats.totals.unique_visitors, 2);
});

test('coupon checkout controller is passive on all pages until PaigaamPay.open invokes payment', () => {
  const script = fs.readFileSync(path.join(__dirname, '../public/js/creator-coupon.js'), 'utf8');
  for (const pathname of ['/templates','/templates/noor','/create/noor','/preview/draft','/magazines/birthday-story','/magazines/m/result','/p/a-customer-paigaam']) {
    const appends=[],fetches=[];
    const context={window:{},location:{pathname},document:{body:{appendChild(node){appends.push(node);}}},fetch:function(...args){fetches.push(args);return Promise.resolve({});}};
    vm.runInNewContext(script,context);
    assert.equal(typeof context.window.PaigaamCouponFlow.open,'function');
    assert.equal(appends.length,0,pathname+' must not show coupon entry while browsing');
    assert.equal(fetches.length,0,pathname+' must not fetch coupon state before checkout');
  }
});
