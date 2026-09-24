'use strict';
// Disposable local test server, isolated data, and a real restart/persistence check.
// Run: node scripts/test-love-awaits.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-loveawaits-test-')), base = 'http://127.0.0.1:' + port;
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
    const test = spawn(process.execPath, ['--test', 'tests/love-awaits-api.test.js', 'tests/love-awaits-dom.test.js'], {
      cwd: root, env: { ...process.env, LOVE_AWAITS_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Love Awaits test suite failed');

    // A published proposal must survive the process that made it.
    const data = {
      recipientName: 'पडताळणी', senderName: 'Rahul', introTitle: 'प्रेम प्रतीक्षेत',
      question: 'सदासाठी माझी?', questionNote: 'हे असंच राहू दे.', yesLabel: 'हो, सदासाठी', noLabel: 'नाही',
      finaleTitle: 'सदासाठी', finaleLine: 'तू माझा आज आणि सर्व उद्या.',
    };
    let r = await fetch(base + '/api/love-awaits/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_data: data }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();

    r = await fetch(base + '/api/love-awaits/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const pub = await r.json();
    assert.match(pub.slug, /^love-[a-f0-9]{18}$/);

    await stop(); await start();

    r = await fetch(pub.url);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes(data.recipientName), 'the recipient survived the restart');
    assert.ok(html.includes(data.question), 'the question survived the restart');
    assert.ok(html.includes(data.finaleLine), 'the finale line survived the restart');
    assert.ok(html.includes('loveawaits-1.gif'), 'the media path survived the restart');
    console.log('PASS: published URL and personalised proposal survive a full server restart.');
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
