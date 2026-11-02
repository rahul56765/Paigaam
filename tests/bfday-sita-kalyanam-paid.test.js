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
  ['../lib/bfday/assets-sita-kalyanam', 'ensureSitaKalyanamAssets'],
]) {
  const id = require.resolve(module);
  require.cache[id] = { id, filename: id, loaded: true, exports: { [fn]: () => [] } };
}
const { db, q } = require('../db');
const bfday = require('../lib/bfdayRoutes');
const config = require('../templates/sita-kalyanam/config');
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
  // Exercise the actual server seed loop against this temporary DB. Model a
  // prospective config edit in memory; never touch production configuration.
  const loop = slice('  for (const t of TEMPLATES) {', '  // one demo published Paigaam');
  const runSeed = new Function('q', 'TEMPLATES', loop);
  assert.equal(config.price, 99, 'release config seeds ₹99');
  const prospective = config;
  runSeed(q, [prospective]);
  assert.equal(q.templateBySlug(config.slug).price, 99);
  const tpl = q.templateBySlug(config.slug);
  q.templateUpdate(tpl.id, { ...tpl, price: 42 });
  runSeed(q, [prospective]);
  assert.equal(q.templateBySlug(config.slug).price, 42, 'existing admin price survives reseed');
  const existing = q.templateBySlug(config.slug);
  q.templateUpdate(existing.id, { ...existing, price: 99 });
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
async function draft(data, slug = 'sita-kalyanam') {
  const r = await post(`/api/${slug}/draft`, { customer_data: data });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { id: r.body.id, cookie: r.cookie };
}
const signature = (order, payment) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${order}|${payment}`).digest('hex');

test('prospective ₹99: valid owner checkout and captured verification', async () => {
  const d = await draft(config.demo);
  assert.equal((await post('/api/sita-kalyanam/publish', {id:d.id})).status, 403);
  assert.equal((await post('/api/free-publish', {id:d.id}, d.cookie)).status, 403);
  const checkout = await post('/api/sita-kalyanam/publish', {id:d.id}, d.cookie);
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body));
  assert.equal(checkout.body.amount, 9900); assert.equal(checkout.body.currency, 'INR');
  assert.equal(calls.at(-1).body.amount, 9900);
  const oid = checkout.body.orderId, pid = 'pay_sita_valid';
  const proof = {razorpay_order_id:oid, razorpay_payment_id:pid, razorpay_signature:signature(oid,pid)};
  payments.set(pid, {id:pid, order_id:oid, status:'authorized', amount:9900, currency:'INR'});
  assert.equal((await post('/api/razorpay/verify', proof)).status, 409);
  assert.equal(q.paigaamById(d.id).status, 'payment_pending');
  payments.get(pid).status = 'captured';
  const paid = await post('/api/razorpay/verify', proof);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(q.paigaamById(d.id).status, 'published');
  assert.equal(q.orderByRazorpayOrderId(oid).status, 'paid');
  assert.ok(q.paigaamById(d.id).recovery_token);
});

test('incomplete drafts and unauthenticated legacy checkout are rejected', async () => {
  const d = await draft({...config.demo, groomName:''});
  const strict = require('../templates/sita-kalyanam/schema');
  assert.throws(() => strict.validate(q.paigaamById(d.id).customer_data, {mode:'strict'}));
  assert.equal((await post('/api/sita-kalyanam/publish', {id:d.id}, d.cookie)).status, 400);
  assert.equal((await post('/api/razorpay/order', {id:d.id})).status, 403);
  assert.equal(q.paigaamById(d.id).status, 'draft');
});

test('in-flight and pending paid checkout cannot be edited into an incomplete invitation', async () => {
  const d=await draft(config.demo);
  let started; const waitStarted=new Promise(resolve=>{started=resolve}); heldStarted=started; held=true;
  const pending=post('/api/sita-kalyanam/publish',{id:d.id},d.cookie);
  await waitStarted;
  try {
    const edit=await post('/api/sita-kalyanam/draft',{id:d.id,customer_data:{...config.demo,receptionDate:''}},d.cookie);
    assert.equal(edit.status,429,JSON.stringify(edit.body));
  } finally { held=false; deliverHeld(); }
  const checkout=await pending; assert.equal(checkout.status,200,JSON.stringify(checkout.body));
  const partial=await post('/api/sita-kalyanam/draft',{id:d.id,customer_data:{...config.demo,receptionDate:''}},d.cookie);
  assert.equal(partial.status,400,JSON.stringify(partial.body));
  assert.equal(q.paigaamById(d.id).customer_data.receptionDate,config.demo.receptionDate);
});

test('capturing one of two orders does not mark the unpaid sibling paid', async () => {
  const d=await draft(config.demo);
  const a=await post('/api/sita-kalyanam/publish',{id:d.id},d.cookie);
  const b=await post('/api/sita-kalyanam/publish',{id:d.id},d.cookie);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.body.orderId,b.body.orderId);
  const oid=a.body.orderId,pid='pay_sita_one_order';
  payments.set(pid,{id:pid,order_id:oid,status:'captured',amount:9900,currency:'INR'});
  const paid=await post('/api/razorpay/verify',{razorpay_order_id:oid,razorpay_payment_id:pid,razorpay_signature:signature(oid,pid)});
  assert.equal(paid.status,200,JSON.stringify(paid.body));
  assert.equal(q.orderByRazorpayOrderId(oid).status,'paid');
  assert.equal(q.orderByRazorpayOrderId(b.body.orderId).status,'pending');
});

test('signed captured webhook publishes; rejects wrong signature and amount', async () => {
  const d = await draft(config.demo);
  const checkout = await post('/api/sita-kalyanam/publish', {id:d.id}, d.cookie);
  const oid = checkout.body.orderId;
  const event = {event:'payment.captured',payload:{payment:{entity:{id:'pay_sita_webhook',order_id:oid,status:'captured',amount:9800,currency:'INR'}}}};
  async function webhook(payload, signatureOverride) {
    const raw=JSON.stringify(payload);
    const sig=signatureOverride || crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    const r=await fetch(origin+'/api/razorpay/webhook',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':sig},body:raw});
    return r.status;
  }
  assert.equal(await webhook(event,'bad'),400);
  assert.equal(await webhook(event),409);
  assert.equal(q.paigaamById(d.id).status,'payment_pending');
  event.payload.payment.entity.amount=9900;
  assert.equal(await webhook(event),200);
  assert.equal(await webhook(event),200);
  assert.equal(q.paigaamById(d.id).status,'published');
  assert.equal(q.orderByRazorpayOrderId(oid).status,'paid');
});
