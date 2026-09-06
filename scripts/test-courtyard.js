'use strict';
// Disposable local test server, isolated data, and the restart/persistence check.
// Run: node scripts/test-courtyard.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise((r) => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-courtyard-test-')), base = 'http://127.0.0.1:' + port;
  let server;

  async function start() {
    server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stderr.on('data', (x) => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 15000);
      server.stdout.on('data', (chunk) => { if (chunk.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', (code) => { clearTimeout(timer); reject(new Error('Test server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }

  try {
    await start();
    const test = spawn(process.execPath, ['--test', 'tests/courtyard-api.test.js'], {
      cwd: root, env: { ...process.env, COURTYARD_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Courtyard test suite failed');

    // A published invitation must survive the process that made it — the
    // personalised MP4 included (it lives on the data volume, not in git).
    let r = await fetch(base + '/api/ganpati-courtyard/draft', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ customer_data: { familyName: 'पडताळणी', city: 'नाशिक' } }),
    });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();

    r = await fetch(base + '/api/ganpati-courtyard/publish', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }),
    });
    assert.equal(r.status, 200);
    const pub = await r.json();

    r = await fetch(base + '/api/ganpati-courtyard/export', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }),
    });
    assert.equal(r.status, 200);

    await stop(); await start();

    r = await fetch(pub.url);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes('पडताळणी'), 'the family name survived the restart');
    r = await fetch(base + `/ganpati-courtyard/video/${id}.mp4`);
    assert.equal(r.status, 200, 'the rendered MP4 survived the restart and is re-downloadable');
    const size = Number((await r.arrayBuffer()).byteLength);
    assert.ok(size > 100000, 'the video bytes are real');

    console.log('PASS: published URL, personalised page and rendered MP4 survive a full server restart.');
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
