'use strict';
/**
 * Sawaal test runner — disposable local test server, isolated data, and a real
 * restart/persistence check. Run: node scripts/test-sawaal.js
 */
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-sawaal-test-')), base = 'http://127.0.0.1:' + port;
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
    const test = spawn(process.execPath, ['--test', 'tests/sawaal-api.test.js', 'tests/sawaal-dom.test.js'], {
      cwd: root, env: { ...process.env, SAWAAL_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Sawaal test suite failed');

    // A published questionnaire must survive the process that made it —
    // together with the visitor answers it collected.
    const data = { recipientName: 'पडताळणी', senderName: 'Rahul', inviteTitle: 'डेट करूया?' };
    let r = await fetch(base + '/api/sawaal/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_data: data }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();

    r = await fetch(base + '/api/sawaal/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const pub = await r.json();
    assert.match(pub.slug, /^sawaal-[a-f0-9]{18}$/);

    // A visitor plays a scene before the restart, too.
    r = await fetch(base + '/api/sawaal/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const vcookie = r.headers.get('set-cookie').split(';')[0];
    r = await fetch(base + '/api/sawaal/answer', { method: 'POST', headers: { cookie: vcookie, 'content-type': 'application/json' }, body: JSON.stringify({ id, scene: 'invite', answer: { choice: 'yes' } }) });
    assert.equal(r.status, 200);

    await stop(); await start();

    const alive = await fetch(base + '/p/' + pub.slug);
    assert.equal(alive.status, 200, 'published questionnaire survives restart');
    const text = await alive.text();
    assert.match(text, /डेट करूया?/);
    assert.match(text, new RegExp(data.recipientName));
    // The visitor's answer must survive too — visible on the responses page.
    const responses = await fetch(base + '/sawaal/responses/' + id, { headers: { cookie } });
    assert.equal(responses.status, 200);
    assert.match(await responses.text(), /The invitation/);
    console.log('\nRestart persistence: the questionnaire is still live at', pub.url || ('/p/' + pub.slug));
    console.log('ALL SAWAAL TESTS GREEN');
  } finally {
    await stop();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
