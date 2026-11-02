'use strict';
// Isolated HTTP/SQLite checkout harness. Gateway traffic is exclusively fake;
// server.js checkout blocks are executed from source, without boot-time assets.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const http = require('node:http'), https = require('node:https'), crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfday-paid-'));
process.env.DATA_DIR = dir;
process.env.RAZORPAY_ENABLED = '1';
process.env.RAZORPAY_KEY_ID = 'local_test_key';
process.env.RAZORPAY_KEY_SECRET = 'local_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'local_webhook_secret';
for (const [module, fn] of [
  ['../lib/bfday/assets', 'ensureFamilyAssets'],
  ['../lib/bfday/assets-royal-vivah', 'ensureRoyalVivahAssets'],
  ['../lib/bfday/assets-aangan-vivah', 'ensureAanganVivahAssets'],
  ['../lib/bfday/assets-lotus-vivah', 'ensureLotusVivahAssets'],
  ['../lib/bfday/assets-patra-vivah', 'ensurePatraVivahAssets'],
]) {
  const id = require.resolve(module);
  require.cache[id] = { id, filename: id, loaded: true, exports: { [fn]: () => [] } };
}
const { db, q } = require('../db');
const bfday = require('../lib/bfdayRoutes');
const config = require('../templates/divya-vivah/config');
const family = require('../lib/bfday/family');
const tracking = require('../lib/creators/tracking');
const razorpay = require('../lib/razorpay');
const { displayNames } = require('../templates/registry');
const realRequest = https.request;
const calls = [], payments = new Map();
let server, origin, held = false, deliverHeld, heldStarted, seq = 0;
https.request = (options, callback) => {
  assert.equal(options.hostname, 'api.razorpay.com', 'no external network');
  assert.ok(options.method === 'POST' && options.path === '/v1/orders' || options.method === 'GET' && options.path.startsWith('/v1/payments/'));
  const req = new EventEmitter(); let payload = '';
  req.write = data => { payload += data.toString(); };
  req.destroy = err => { if (err) req.emit('error', err); };
  req.end = () => {
    const body = payload ? JSON.parse(payload) : null;
    calls.push({ method: options.method, path: options.path, body });
    const deliver = () => {
      const res = new EventEmitter(); res.statusCode = 200;
      const entity = options.method === 'POST' ? { ...body, id: `order_local_${++seq}` } : payments.get(decodeURIComponent(options.path.slice('/v1/payments/'.length)));
      assert.ok(entity, 'missing local payment fixture');
      callback(res); res.emit('data', Buffer.from(JSON.stringify(entity))); res.emit('end');
    };
    if (held && options.method === 'POST') { deliverHeld = deliver; heldStarted(); } else queueMicrotask(deliver);
  };
  return req;
};
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
function slice(start, end) {
  const i = source.indexOf(start), j = source.indexOf(end, i);
  assert.ok(i >= 0 && j > i, `missing server checkout block ${start}`);
  return source.slice(i, j);
}
const readBody = async req => { let raw = ''; for await (const c of req) raw += c; return raw; };
const json = (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
const reqServer = require('node:module').createRequire(path.join(__dirname, '../server.js'));
let handleServer;
before(async () => {
  assert.equal(config.price, 99); assert.equal(config.currency, 'INR');
  // Same registry config passed to seed on a fresh DB, not a claimed existing deployment price.
  q.templateInsert({ ...config, status: 'published' });
  const other = family.bySlug('royal-vivah').config;
  q.templateInsert({ ...other, price: 149, status: 'published' });
  const publishSource = slice('function slugifyNames(', '/* ---------------- seed');
  const genericOrder = slice("    if (method === 'POST' && p === '/api/razorpay/order')", "    m = p.match(/^\\/recover");
  const settlement = slice("    if (method === 'POST' && p === '/api/razorpay/verify')", '    /* ---------- Legal pages');
  const free = slice("    if (method === 'POST' && p === '/api/free-publish')", "    if (method === 'POST' && p === '/api/drafts')");
  const factory = new Function('require', 'q', 'displayNames', 'bfday', 'razorpay', 'creatorTracking', 'magazines', 'readBody', 'json', 'BASE_URL',
    `const suvarnaVivah={SLUG:'suvarna-vivah'}; const birthdayPaigaam={SLUG:'birthday-paigaam'};
     const ganapati={SLUG:'ganapati'},saalgirah={SLUG:'saalgirah'},courtyard={SLUG:'courtyard'},lavender={SLUG:'lavender'},valentine={SLUG:'valentine'},love={SLUG:'love'},maafi={SLUG:'maafi'},sauwajah={SLUG:'sauwajah'},loveAwaits={SLUG:'love-awaits'},sawaal={SLUG:'sawaal'};
     ${publishSource} return async (req,res) => { const method=req.method, p=new URL(req.url,BASE_URL).pathname; ${genericOrder} ${settlement} ${free} res.writeHead(404); res.end(); };`);
  server = http.createServer((req, res) => tracking.runRequest(req, res, origin, async () => {
    try {
      const u = new URL(req.url, origin);
      if (await bfday.handle(req, res, u, { baseUrl: origin })) return;
      return await handleServer(req, res);
    } catch (err) { console.error(err); json(res, 500, { error: err.message }); }
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  handleServer = factory(reqServer, q, displayNames, bfday, razorpay, tracking, { settleRazorpayOrder: () => '' }, readBody, json, origin);
});
after(async () => { https.request = realRequest; if (server) await new Promise(resolve => server.close(resolve)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
async function post(route, body, cookie, headers = {}) {
  const r = await fetch(origin + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
async function draft(data, slug = 'divya-vivah') {
  const r = await post(`/api/${slug}/draft`, { customer_data: data });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { id: r.body.id, cookie: r.cookie };
}
const signature = (order, payment) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${order}|${payment}`).digest('hex');

test('Divya paid draft: validation, owner, CSRF, free and generic bypasses before gateway', async () => {
  const beforeCalls = calls.length;
  for (const [field, value] of [['weddingDate', '2027-02-29'], ['weddingTime', '24:00']]) {
    const r = await post('/api/divya-vivah/draft', { customer_data: { ...config.demo, [field]: value } });
    assert.equal(r.status, 400, field);
  }
  for (const field of ['groomName', 'brideName', 'weddingDate', 'weddingTime']) {
    const d = await draft({ ...config.demo, [field]: '' });
    const r = await post('/api/divya-vivah/publish', { id: d.id }, d.cookie);
    assert.equal(r.status, 400, field); assert.equal(r.body.error, 'validation');
    assert.equal(q.paigaamById(d.id).status, 'draft');
  }
  // Legacy/corrupted stored data must also be validated, not only new drafts.
  for (const [field, value] of [['weddingDate', '2027-02-29'], ['weddingTime', '24:00']]) {
    const d = await draft(config.demo);
    q.paigaamUpdate(d.id, { customer_data: { ...config.demo, [field]: value } });
    assert.equal((await post('/api/divya-vivah/publish', { id: d.id }, d.cookie)).status, 400);
  }
  const d = await draft(config.demo);
  assert.equal((await post('/api/divya-vivah/publish', { id: d.id })).status, 403);
  assert.equal((await post('/api/divya-vivah/publish', { id: d.id }, d.cookie, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/razorpay/order', { id: d.id })).status, 403);
  assert.equal((await post('/api/razorpay/order', { id: d.id }, d.cookie)).status, 403);
  assert.equal((await post('/api/free-publish', { id: d.id }, d.cookie)).status, 403);
  assert.equal(q.paigaamById(d.id).status, 'draft');
  assert.equal(calls.length, beforeCalls, 'no gateway request');
});

test('₹99 order, race-safe edits, captured-payment verification and publication', async () => {
  const d = await draft(config.demo);
  let started; const waitStarted = new Promise(resolve => { started = resolve; }); heldStarted = started; held = true;
  const pending = post('/api/divya-vivah/publish', { id: d.id }, d.cookie);
  await waitStarted;
  assert.equal((await post('/api/divya-vivah/publish', { id: d.id }, d.cookie)).status, 429);
  const r = await post('/api/divya-vivah/draft', { id: d.id, customer_data: { ...config.demo, groomName: '' } }, d.cookie);
  assert.equal(r.status, 429);
  assert.equal(q.paigaamById(d.id).customer_data.groomName, config.demo.groomName);
  held = false; deliverHeld();
  const checkout = await pending;
  assert.equal(checkout.status, 200); assert.equal(checkout.body.razorpay, true);
  assert.equal(checkout.body.amount, 9900); assert.equal(checkout.body.currency, 'INR');
  assert.equal(calls.at(-1).body.amount, 9900);
  assert.equal(q.paigaamById(d.id).status, 'payment_pending');
  assert.equal(q.paigaamById(d.id).payment_status, 'pending');
  assert.equal((await post('/api/divya-vivah/draft', { id: d.id, customer_data: { ...config.demo, weddingTime: '' } }, d.cookie)).status, 400);
  assert.equal((await post('/api/divya-vivah/draft', { id: d.id, customer_data: { ...config.demo, groomName: 'अमोल' } }, d.cookie)).status, 200);
  const orderId = checkout.body.orderId, paymentId = 'pay_local_1';
  payments.set(paymentId, { id: paymentId, order_id: orderId, status: 'authorized', amount: 9900, currency: 'INR' });
  const verification = { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature(orderId, paymentId) };
  assert.equal((await post('/api/razorpay/verify', { ...verification, razorpay_signature: 'bad' })).status, 400);
  assert.equal((await post('/api/razorpay/verify', verification)).status, 409);
  assert.equal(q.paigaamById(d.id).status, 'payment_pending');
  payments.get(paymentId).status = 'captured';
  const verified = await post('/api/razorpay/verify', verification);
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  const pg = q.paigaamById(d.id);
  assert.equal(pg.status, 'published'); assert.equal(pg.payment_status, 'paid');
  assert.equal(pg.customer_data.groomName, 'अमोल'); assert.ok(pg.slug);
  assert.equal(q.orderByRazorpayOrderId(orderId).status, 'paid');
  assert.equal((await post('/api/divya-vivah/draft', { id: d.id, customer_data: config.demo }, d.cookie)).status, 403);
});

test('another paid bfday template retains legacy order and draft behavior', async () => {
  const t = family.bySlug('royal-vivah');
  // This pre-existing paid flow permits a draft with missing required fields.
  const partial = { ...t.config.demo, brideName: '' };
  const d = await draft(partial, t.slug);
  let started; const waitStarted = new Promise(resolve => { started = resolve; }); heldStarted = started; held = true;
  const pending = post(`/api/${t.slug}/publish`, { id: d.id }, d.cookie);
  await waitStarted;
  // An order in flight does not lock legacy edits.
  const edit = await post(`/api/${t.slug}/draft`, { id: d.id, customer_data: { ...partial, groomName: 'Test Groom' } }, d.cookie);
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  held = false; deliverHeld();
  const r = await pending;
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.razorpay, true);
  assert.equal(r.body.amount, 14900);
  assert.equal(q.paigaamById(d.id).status, 'payment_pending');
  const afterEdit = await post(`/api/${t.slug}/draft`, { id: d.id, customer_data: partial }, d.cookie);
  assert.equal(afterEdit.status, 200, JSON.stringify(afterEdit.body));
  assert.equal(q.paigaamById(d.id).customer_data.brideName, '');
  // The legacy generic endpoint remains available for the other template.
  const generic = await post('/api/razorpay/order', { id: d.id });
  assert.equal(generic.status, 200, JSON.stringify(generic.body));
  assert.equal(generic.body.amount, 14900);
});
