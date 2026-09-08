'use strict';
// Disposable local test server, isolated data, and a real restart/persistence check.
// Run: node scripts/test-love.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-love-test-')), base = 'http://127.0.0.1:' + port;
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
    const test = spawn(process.execPath, ['--test', 'tests/love-api.test.js', 'tests/love-dom.test.js'], {
      cwd: root, env: { ...process.env, LOVE_BASE_URL: base }, stdio: 'inherit',
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error('Love Album test suite failed');

    // A published album must survive the process that made it — photos included.
    function tinyJPEG() {
      const c = [[0xFF, 0xD8], [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00],
        [0xFF, 0xDB, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, () => 0x10)],
        [0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x01, 0x90, 0x01, 0x40, 0x01, 0x01, 0x11, 0x00],
        [0xFF, 0xC4, 0x00, 0x14, 0x00, ...Array.from({ length: 18 }, () => 0x00)],
        [0xFF, 0xC4, 0x00, 0x14, 0x01, ...Array.from({ length: 18 }, () => 0x00)],
        [0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00], [0x3F, 0x00], [0xFF, 0xD9]];
      return Buffer.from(c.flat());
    }
    const data = { recipientName: 'पडताळणी', senderName: 'Rahul', introLine: 'Hi.', continueLabel: 'Go', message1: 'm1', message2: 'm2', message3: 'm3', letterTitle: 'For you', letterBody: 'Body.', finalLabel: 'Last thing', photos: [] };
    let r = await fetch(base + '/api/love-album/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer_data: data }) });
    assert.equal(r.status, 200);
    const cookie = r.headers.get('set-cookie').split(';')[0], { id } = await r.json();

    const up = await fetch(base + '/api/love-album/upload?id=' + id, { method: 'POST', headers: { cookie, 'content-type': 'image/jpeg' }, body: tinyJPEG() });
    assert.equal(up.status, 200);
    const { url: photoUrl } = await up.json();
    data.photos = [{ url: photoUrl, alt: '' }];
    r = await fetch(base + '/api/love-album/draft', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id, customer_data: data }) });
    assert.equal(r.status, 200);

    r = await fetch(base + '/api/love-album/publish', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    assert.equal(r.status, 200);
    const pub = await r.json();
    assert.match(pub.slug, /^love-[a-f0-9]{18}$/);

    await stop(); await start();

    r = await fetch(pub.url);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes(data.recipientName), 'the recipient survived the restart');
    assert.ok(html.includes('— Rahul') || html.includes('Rahul'), 'the signature survived the restart');
    assert.ok(html.includes(photoUrl), 'the photo reference survived the restart');
    const photo = await fetch(base + photoUrl);
    assert.equal(photo.status, 200, 'the photo bytes survived the restart');
    const bytes = Buffer.from(await photo.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString('ascii'), '\xFF\xD8', 'photo bytes intact');
    console.log('PASS: published URL, personalised album and uploaded photo survive a full server restart.');
  } finally {
    await stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
