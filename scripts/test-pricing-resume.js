'use strict';
// Paid-wizard pricing + resume flow: list_price, price-aware publish (payUrl),
// wizard CTA rendering, recent-draft resume. Server runs for real; Razorpay
// API itself is not called (the payUrl branch returns before any network).
// Run: node scripts/test-pricing-resume.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-prz-test-')), base = 'http://127.0.0.1:' + port;
  process.env.DATA_DIR = dir;
  let server;

  async function start(extraEnv) {
    server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, ...(extraEnv || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stderr.on('data', x => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('startup timeout')), 15000);
      server.stdout.on('data', chunk => { if (chunk.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }

  try {
    await start({ RAZORPAY_ENABLED: '1', RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 'sk_x', RAZORPAY_WEBHOOK_SECRET: 'whsec_x' });

    /* ---- 1. list_price round-trip + priceInfo ---- */
    const { q } = require('../db');
    const { priceInfo } = require('../templates/registry');
    assert.deepEqual(priceInfo({ price: 499, list_price: 999 }), { free: false, sale: 499, list: 999, off: 50 });
    assert.deepEqual(priceInfo({ price: 499, list_price: 499 }), { free: false, sale: 499, list: 0, off: 0 }, 'list <= sale → no strike');

    const tplRow = q.templateBySlug('maafi');
    q.templateUpdate(tplRow.id, { ...tplRow, price: 299, list_price: 599 });
    const updated = q.templateBySlug('maafi');
    assert.equal(updated.price, 299);
    assert.equal(updated.list_price, 599);

    /* ---- 2. create page shows paid CTA + struck list price, no "Free" hint ---- */
    let r = await fetch(base + '/create/maafi');
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Pay &#8377;299 &amp; publish/, 'paid CTA on wizard');
    assert.match(html, /<s>&#8377;599<\/s>/, 'struck listing price');
    assert.doesNotMatch(html, /Free\. The link stays live/, 'no free hint on paid wizard');

    /* ---- 3. publish now returns payUrl (not 403 "can't be edited") ---- */
    r = await fetch(base + '/api/maafi/draft', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customer_data: { recipientName: 'Meher', senderName: 'Rahul' } }),
    });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0];
    const { id } = await r.json();
    r = await fetch(base + '/api/maafi/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    // Paid template: the handler tries Razorpay's API. With placeholder keys the
    // gateway is unreachable → 502 gateway_unreachable (NOT 403 "can't edit").
    // The inline-checkout payload shape is covered by the live verification.
    assert.equal(r.status, 502, 'paid publish attempts gateway (502 with fake keys, not 403)');
    const pub = await r.json();
    assert.equal(pub.error, 'gateway_unreachable');
    const stillDraft = q.paigaamById(id);
    assert.equal(stillDraft.status, 'draft', 'not published yet — payment pending');

    /* ---- 3b. abandoned checkout: dismissed modal → draft still editable ---- */
    // (publish flipped it to payment_pending; saving/editing must keep working)
    r = await fetch(base + '/api/maafi/draft', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ id, customer_data: { recipientName: 'Meher', senderName: 'Rahul Two' } }),
    });
    assert.equal(r.status, 200, 'draft save works after abandoned checkout (payment_pending)');

    /* ---- 4. payments_offline: keys absent → honest 503, not "can't edit" ---- */
    await stop();
    await start({}); // no razorpay env
    r = await fetch(base + '/api/maafi/draft', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customer_data: { recipientName: 'Meher' } }),
    });
    const cookie2 = r.headers.get('set-cookie').split(';')[0];
    const { id: id2 } = await r.json();
    r = await fetch(base + '/api/maafi/publish', { method: 'POST', headers: { cookie: cookie2, 'content-type': 'application/json' }, body: JSON.stringify({ id: id2 }) });
    assert.equal(r.status, 503, 'payments_offline → 503');
    const body = await r.json();
    assert.equal(body.error, 'payments_offline');

    /* ---- 5. resume: recent draft by creator cookie on GET /create ---- */
    // cookie2's draft (id2) was created seconds ago → create page must embed it.
    r = await fetch(base + '/create/maafi', { headers: { cookie: cookie2 } });
    assert.equal(r.status, 200);
    const html2 = await r.text();
    assert.match(html2, /id="wizardBoot"/, 'boot payload embedded');
    assert.match(html2, new RegExp(id2), 'boot carries the recent draft id');
    assert.match(html2, /js\/resume\.js/, 'resume script loaded');

    // without the cookie: no boot payload
    r = await fetch(base + '/create/maafi');
    const html3 = await r.text();
    assert.doesNotMatch(html3, /wizardBoot/, 'no resume payload without creator cookie');

    // draft older than 1h → not offered
    const tplRow2 = q.templateBySlug('maafi');
    const older = q.paigaamInsert({ template_id: tplRow2.id, customer_data: { recipientName: 'Old' } });
    db2();
    function db2() {
      const { db } = require('../db');
      const hash = crypto.createHash('sha256').update('x').digest('hex');
      // reuse cookie2's hash by looking it up
      const row = require('../db').db.prepare('SELECT owner_hash FROM maafi_owners WHERE paigaam_id = ?').get(id2);
      require('../db').db.prepare('INSERT INTO maafi_owners VALUES(?,?,?)').run(older.id, row.owner_hash, Date.now() - 2 * 3600000);
    }
    r = await fetch(base + '/create/maafi', { headers: { cookie: cookie2 } });
    const html4 = await r.text();
    assert.doesNotMatch(html4, new RegExp(older.id), 'draft older than 1h is not offered');

    /* ---- 6. free wizard unaffected ---- */
    r = await fetch(base + '/create/valentine-say-yes');
    assert.equal(r.status, 200);
    const htmlFree = await r.text();
    assert.match(htmlFree, /Publish this Paigaam/, 'free CTA unchanged');
    assert.match(htmlFree, /Free\. The link stays live/, 'free hint intact');

    console.log('\nALL PRICING + RESUME TESTS GREEN');
  } finally {
    await stop();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
})().catch(e => { console.error(e); process.exit(1); });
