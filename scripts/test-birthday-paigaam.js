'use strict';
// Disposable local server with isolated data, the API suite, then a restart to
// prove a published surprise (and its uploads) survive the process.
// Run: node scripts/test-birthday-paigaam.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-bp-test-')), base = 'http://127.0.0.1:' + port;
  let server;
  async function start() {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', x => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 15000);
      server.stdout.on('data', c => { if (c.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('Test server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }
  try {
    await start();
    const t = spawn(process.execPath, ['--test', 'tests/birthday-paigaam-api.test.js'], { cwd: root, env: { ...process.env, BP_BASE_URL: base }, stdio: 'inherit' });
    const [code] = await once(t, 'exit');
    if (code !== 0) throw new Error('Birthday Paigaam test suite failed');

    let r = await fetch(base + '/api/birthday-paigaam/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_data: { recipientName: 'पडताळणी', senderName: 'Rahul' } }) });
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();
    r = await fetch(base + '/api/birthday-paigaam/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const pub = await r.json();
    await stop(); await start();
    const html = await (await fetch(pub.url)).text();
    assert.ok(html.includes('पडताळणी') && html.includes('Rahul'));
    console.log('PASS: published surprise survives a full server restart.');
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
