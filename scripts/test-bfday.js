'use strict';
// Boyfriend Day family: disposable local server, isolated data, every
// tests/bfday-*.test.js suite, then a real process restart/persistence check
// for every family member. Run: node scripts/test-bfday.js
//
// The test-only fixture template (tests/fixtures/bfday-fixture — every field
// type, incl. photos) is switched on with BFDAY_TEST_FIXTURE=1 for this run only.
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
process.env.BFDAY_TEST_FIXTURE = '1';
const family = require('../lib/bfday/family');
const { png } = require('../tests/bfday-helpers');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-bfday-test-')), base = 'http://127.0.0.1:' + port;
  // The family server never contacts a real payment gateway; the paid checkout
  // suite starts its own isolated server and explicitly enables its fake gateway.
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, BFDAY_TEST_FIXTURE: '1', RAZORPAY_ENABLED: '0' };
  let server;

  async function start() {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', x => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 15000);
      server.stdout.on('data', chunk => { if (chunk.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('Test server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }
  const post = (p, cookie, body, type = 'application/json') => fetch(base + p, {
    method: 'POST', headers: { 'content-type': type, ...(cookie ? { cookie } : {}) },
    body: type === 'application/json' ? JSON.stringify(body) : body,
  });

  try {
    if (family.errors.length) throw new Error('family members failed to load: ' + JSON.stringify(family.errors));
    await start();
    const suites = fs.readdirSync(path.join(root, 'tests')).filter(f => /^bfday-.*\.test\.js$/.test(f)).sort().map(f => 'tests/' + f);
    const test = spawn(process.execPath, ['--test', ...suites, 'tests/qr-card.test.js'], {
      cwd: root, env: { ...env, BFDAY_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Boyfriend Day test suite failed');

    // Free published members must survive the process that made them — photos too.
    // Paid Divya and Little Love retain private owner drafts rather than publishing offline.
    const made = [];
    for (const t of family.list) {
      const data = { ...t.config.demo };
      const nameField = t.fields.find(f => f.type === 'text' && f.required) || t.fields.find(f => f.type === 'text');
      if (nameField) data[nameField.id] = 'पडताळणी'.slice(0, nameField.maxLength);
      let r = await post(`/api/${t.slug}/draft`, null, { customer_data: data });
      assert.equal(r.status, 200, t.slug + ' draft');
      const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();
      let photo = null;
      const image = t.fields.find(f => f.type === 'image');
      if (image) {
        r = await post(`/api/${t.slug}/upload?id=${id}`, cookie, png(), 'image/png');
        assert.equal(r.status, 200, t.slug + ' upload');
        photo = (await r.json()).url;
        r = await post(`/api/${t.slug}/draft`, cookie, { id, customer_data: { ...data, [image.id]: photo } });
        assert.equal(r.status, 200, t.slug + ' draft with photo');
      }
      if (['divya-vivah', 'little-love'].includes(t.slug)) {
        r = await post(`/api/${t.slug}/publish`, cookie, { id });
        assert.equal(r.status, 503, t.slug + ' paid publish offline');
        assert.equal((await r.json()).error, 'payments_offline');
        made.push({ t, cookie, photo, pending: { previewUrl: `/${t.slug}/preview/${id}` }, name: nameField ? data[nameField.id] : null });
        continue;
      }
      r = await post(`/api/${t.slug}/publish`, cookie, { id });
      assert.equal(r.status, 200, t.slug + ' publish');
      const pub = await r.json();
      assert.match(pub.slug, new RegExp(`^${t.slug}-[a-f0-9]{18}$`));
      // An unpublished draft whose owner must still be recognised after the restart.
      r = await post(`/api/${t.slug}/draft`, cookie, { customer_data: t.config.demo });
      const pending = await r.json();
      made.push({ t, pub, photo, cookie, pending, name: nameField ? data[nameField.id] : null });
    }

    await stop(); await start();

    for (const { t, pub, photo, cookie, pending, name } of made) {
      if (['divya-vivah', 'little-love'].includes(t.slug)) {
        const own = await fetch(base + pending.previewUrl, { headers: { cookie } });
        assert.equal(own.status, 200, `${t.slug}: draft ownership survives restart`);
        if (name) assert.ok((await own.text()).includes(name), `${t.slug}: draft text survives restart`);
        assert.equal((await fetch(base + pending.previewUrl)).status, 403, `${t.slug}: draft remains private after restart`);
        if (photo) {
          assert.equal((await fetch(base + photo, { headers: { cookie } })).status, 200, `${t.slug}: owner photo survives restart`);
          assert.equal((await fetch(base + photo)).status, 404, `${t.slug}: draft photo remains private after restart`);
        }
        console.log(`Restart persistence: ${t.slug} owner draft survives`);
        continue;
      }
      const alive = await fetch(base + '/p/' + pub.slug);
      assert.equal(alive.status, 200, `${t.slug}: published page survives restart`);
      const text = await alive.text();
      if (name) assert.ok(text.includes(name), `${t.slug}: sender text survives restart`);
      if (photo) {
        assert.ok(text.includes(photo), `${t.slug}: photo still referenced`);
        assert.equal((await fetch(base + photo)).status, 200, `${t.slug}: photo still served`);
        if (t.slug === 'patra-vivah') {
          // Patra's couple photo is in the invitation; its designed card is the share image.
          assert.ok(text.includes(`<meta property="og:image" content="${base + t.config.ogImage}">`), `${t.slug}: designed og:image survives restart`);
        } else if (['aangan-vivah', 'lotus-vivah'].includes(t.slug)) {
          // Its optional image is a monogram overlay, not a share-card portrait;
          // keep the designed share card as og:image while serving the logo in-page.
          assert.ok(text.includes(photo), `${t.slug}: uploaded logo remains in the monogram page`);
        } else {
          assert.ok(text.includes(base + photo), `${t.slug}: og:image is the photo`);
        }
      }
      const own = await fetch(base + pending.previewUrl, { headers: { cookie } });
      assert.equal(own.status, 200, `${t.slug}: draft ownership survives restart`);
      console.log(`Restart persistence: ${t.slug} is still live at /p/${pub.slug}`);
    }
    console.log('ALL BOYFRIEND DAY TESTS GREEN');
  } finally {
    await stop();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
