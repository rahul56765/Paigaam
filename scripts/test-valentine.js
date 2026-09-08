'use strict';
// Disposable local test server, isolated data, and a real restart/persistence check.
// Run: node scripts/test-valentine.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-valentine-test-')), base = 'http://127.0.0.1:' + port;
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
    const test = spawn(process.execPath, ['--test', 'tests/valentine-api.test.js', 'tests/valentine-dom.test.js'], {
      cwd: root, env: { ...process.env, VALENTINE_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Valentine test suite failed');

    // A published question must survive the process that made it.
    const data = { recipientName: 'पडताळणी', senderName: 'Rahul', question: 'Be mine, forever?', yesLabel: 'Yes', noLabel: 'No', celebration: 'Forever it is!' };
    let r = await fetch(base + '/api/valentine-say-yes/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_data: data }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();

    r = await fetch(base + '/api/valentine-say-yes/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const pub = await r.json();
    assert.match(pub.slug, /^valentine-[a-f0-9]{18}$/);

    await stop(); await start();

    r = await fetch(pub.url);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes(data.recipientName), 'the recipient survived the restart');
    assert.ok(html.includes('— ' + data.senderName), 'the signature survived the restart');
    assert.ok(html.includes('Be mine, forever?'), 'the question survived the restart');
    assert.ok(html.includes('Forever it is!'), 'the celebration survived the restart');
    assert.ok(html.includes('valentine-1.gif'), 'the media path survived the restart');
    console.log('PASS: published URL and personalised question survive a full server restart.');
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
