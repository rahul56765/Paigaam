'use strict';
// Disposable local test server, isolated data, and a real restart/persistence check.
// Run: node scripts/test-maafi.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-maafi-test-')), base = 'http://127.0.0.1:' + port;
  let server;

  async function start() {
    server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stderr.on('data', x => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 15000);
      server.stdout.on('data', chunk => { if (chunk.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('Test server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }

  try {
    await start();
    const test = spawn(process.execPath, ['--test', 'tests/maafi-api.test.js', 'tests/maafi-dom.test.js'], {
      cwd: root, env: { ...process.env, MAAFI_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Maafi test suite failed');

    // A published apology must survive the process that made it.
    const data = { recipientName: 'पडताळणी', senderName: 'Rahul', headline: 'माफ कर दो', yesLabel: 'Yes', noLabel: 'No', celebration: 'Forever friends!' };
    let r = await fetch(base + '/api/maafi/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_data: data }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();

    r = await fetch(base + '/api/maafi/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const pub = await r.json();
    assert.match(pub.slug, /^maafi-[a-f0-9]{18}$/);

    await stop(); await start();

    const alive = await fetch(base + '/p/' + pub.slug);
    assert.equal(alive.status, 200, 'published apology survives restart');
    const text = await alive.text();
    assert.match(text, /माफ कर दो/);
    assert.match(text, new RegExp(data.recipientName));
    console.log('\nRestart persistence: the apology is still live at', pub.url || ('/p/' + pub.slug));
    console.log('ALL MAAFI TESTS GREEN');
  } finally {
    await stop();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
