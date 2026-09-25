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
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, BFDAY_TEST_FIXTURE: '1' };
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

    // Every published member must survive the process that made it — photos too.
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
      const alive = await fetch(base + '/p/' + pub.slug);
      assert.equal(alive.status, 200, `${t.slug}: published page survives restart`);
      const text = await alive.text();
      if (name) assert.ok(text.includes(name), `${t.slug}: sender text survives restart`);
      if (photo) {
        assert.ok(text.includes(photo), `${t.slug}: photo still referenced`);
        assert.equal((await fetch(base + photo)).status, 200, `${t.slug}: photo still served`);
        assert.ok(text.includes(base + photo), `${t.slug}: og:image is the photo`);
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
