'use strict';
// Isolated backend tests: no renderer fixture, opener film or sharp dependency required.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { once } = require('node:events');
const zlib = require('node:zlib');
const C = require('../public/shaadi-paigaam/chandni-royale-core.js');
const originalCore = require('../public/shaadi-paigaam/core.js');

function sample() {
  const d = structuredClone(C.SAMPLE);
  const date = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  d.wedding.date = date(90);
  d.events.forEach((e, i) => { e.date = date(i < 2 ? 88 + i : i === 4 ? 91 : 90); });
  d.rsvp.whatsapp = '+919876543210';
  return d;
}
function png(w = 640, h = 640) {
  function crc(buf) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, data) { const t = Buffer.concat([Buffer.from(type), data]), n = Buffer.alloc(4), c = Buffer.alloc(4); n.writeUInt32BE(data.length); c.writeUInt32BE(crc(t)); return Buffer.concat([n, t, c]); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 170); for (let i = 0; i < h; i++) raw[i * (w * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('Chandni model preserves shared defaults, scopes media, requires WhatsApp and caps functions', () => {
  const d = sample();
  assert.equal(C.validate(d).errors.length, 0);
  assert.equal(C.validate(d).data.music.track, '');
  assert.equal(originalCore.validate(originalCore.SAMPLE).data.music.track, 'shehnai-dawn');
  assert.ok(originalCore.validate(originalCore.SAMPLE).data.photos.length);
  d.sections.rsvp = false; d.rsvp.whatsapp = '';
  assert.ok(C.validate(d, { publish: true }).errors.some(e => e.path === 'rsvp.whatsapp'));
  d.photos = [
    { url: '/chandni-royale/media/' + 'a'.repeat(48) + '.png', alt: '<script>bad</script>' },
    { url: '/shaadi-paigaam/media/' + 'b'.repeat(48) + '.png' },
    { url: 'https://evil.example/photo.png' },
  ];
  assert.equal(C.validate(d).data.photos.length, 1);
  assert.equal(originalCore.validate(d).data.photos.length, 1); // only the old Shaadi namespace, never Chandni
  assert.equal(originalCore.validate(d).data.photos[0].url, d.photos[1].url);
  d.music = { url: '/chandni-royale/media/' + 'a'.repeat(48) + '.mp3', track: 'shehnai-dawn', rightsOk: false };
  assert.ok(C.validate(d).errors.some(e => e.path === 'music.rightsOk'));
  assert.equal(C.validate(d).data.music.startMuted, true);
  d.events = Array.from({ length: 25 }, (_, i) => ({ ...sample().events[0], id: 'ev-' + i, name: 'Function ' + i }));
  let result = C.validate(d);
  assert.equal(result.data.events.length, 20);
  assert.equal(result.data.events.filter(e => e.main).length, 1);
  d.events = [{ ...sample().events[3], id: 'ev-main' }, ...d.events];
  result = C.validate(d);
  assert.equal(result.data.events.length, 20);
  assert.equal(result.data.events[0].id, 'ev-main');
  d.events = [d.events[2], d.events[0], d.events[1]];
  assert.deepEqual(C.validate(d).data.events.map(e => e.id), d.events.map(e => e.id));
  d.openerVideo = '/chandni-royale/media/video.mp4';
  assert.equal(C.validate(d).data.openerVideo, undefined);
  assert.equal(C.validate(d).data.rsvp.email, '');
});

test('isolated draft, editor, publish, upload, removal, restore and access routes', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-chandni-test-'));
  process.env.DATA_DIR = dir;
  const { q, db } = require('../db');
  const routes = require('../lib/chandniRoyaleRoutes');
  const config = require('../templates/chandni-royale/config');
  const tpl = q.templateInsert({ ...config, config });
  const oldTpl = q.templateInsert({ slug: 'shaadi-paigaam', name: 'Shaadi', category: 'Wedding', status: 'published', config: {} });
  const oldPg = q.paigaamInsert({ template_id: oldTpl.id, customer_data: sample() });
  let base;
  const server = http.createServer(async (req, res) => {
    try { if (await routes.handle(req, res, new URL(req.url, base), { baseUrl: base, isAdmin: req.headers['x-test-admin'] === '1' })) return; res.writeHead(404); res.end(); }
    catch (err) { res.writeHead(500); res.end(err.stack); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port;
  const J = (url, data, cookie, headers = {}) => fetch(base + url, { method: data === undefined ? 'GET' : 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
  const upload = (id, cookie, kind, bytes, type) => fetch(base + '/api/chandni-royale/upload?id=' + id + '&kind=' + kind, { method: 'POST', headers: { cookie, 'content-type': type }, body: bytes });
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  assert.equal(q.templateBySlug(config.slug).status, 'draft');
  assert.equal((await J('/create/chandni-royale')).status, 404);
  const adminEditor = await J('/create/chandni-royale', undefined, undefined, { 'x-test-admin': '1' });
  assert.equal(adminEditor.status, 200);
  const shell = await adminEditor.text();
  assert.match(shell, /Create your Chandni Royale/);
  assert.match(shell, /chandni-royale-core\.js/);
  assert.match(shell, /"slug":"chandni-royale"/);
  assert.equal((await J('/api/chandni-royale/draft', { data: sample() })).status, 404);
  q.templateUpdate(tpl.id, { ...q.templateBySlug(config.slug), status: 'published' });
  let r = await J('/api/chandni-royale/draft', { data: sample() });
  const cookie = r.headers.get('set-cookie').split(';')[0];
  let j = await r.json();
  assert.equal(r.status, 200); assert.ok(j.id); assert.equal(j.errors.length, 0);
  const id = j.id, token = j.manageToken;
  assert.equal((await J('/api/chandni-royale/me?id=' + id)).status, 404);
  assert.equal((await J('/api/chandni-royale/draft', { id, data: sample() })).status, 403);
  assert.equal((await J('/api/chandni-royale/me?id=' + oldPg.id, undefined, cookie)).status, 404);
  assert.equal((await J('/api/chandni-royale/draft', { id: oldPg.id, data: sample() }, cookie)).status, 404);
  assert.equal((await J('/api/chandni-royale/draft', { id, data: sample() }, cookie, { origin: 'https://evil.example' })).status, 403);
  r = await J('/chandni-royale/manage/' + token);
  assert.equal(r.status, 303); assert.match(r.headers.get('set-cookie'), /^cr_m_/);
  const manageCookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await J('/api/chandni-royale/me?id=' + id, undefined, manageCookie)).status, 200);
  assert.equal((await J('/api/chandni-royale/slug?s=chandni-royale&id=' + id, undefined, cookie)).status, 200);
  j = await (await J('/api/chandni-royale/slug?s=chandni-royale', undefined, cookie)).json();
  assert.equal(j.reason, 'reserved');

  assert.equal((await upload(id, cookie, 'video', Buffer.from('bad'), 'video/mp4')).status, 400);
  assert.equal((await upload(id, '', 'photo', png(), 'image/png')).status, 403);
  assert.equal((await upload(oldPg.id, cookie, 'photo', png(), 'image/png')).status, 404);
  assert.equal((await upload(id, cookie, 'photo', png(64, 64), 'image/png')).status, 400);
  assert.equal((await upload(id, cookie, 'photo', png(), 'image/jpeg')).status, 400);
  r = await upload(id, cookie, 'photo', png(), 'image/png');
  assert.equal(r.status, 200); const photo = (await r.json()).url;
  r = await upload(id, cookie, 'music', Buffer.concat([Buffer.from('ID3'), Buffer.alloc(100)]), 'audio/mpeg');
  assert.equal(r.status, 200); const song = (await r.json()).url;
  assert.equal((await J(photo)).status, 404);
  assert.equal((await J(photo, undefined, cookie)).status, 200);
  assert.equal((await J(song, undefined, cookie)).status, 200);
  const d = sample();
  d.photos = [{ url: photo, alt: 'Our photo' }];
  d.couplePhoto = { url: photo };
  d.music = { url: song, track: 'upload', title: 'Our song', rightsOk: true };
  await J('/api/chandni-royale/draft', { id, data: d }, cookie);
  j = await (await J('/api/chandni-royale/me?id=' + id, undefined, cookie)).json();
  assert.equal(j.data.photos[0].url, photo); assert.equal(j.data.music.url, song);
  assert.equal(j.data.couplePhoto.url, photo);

  r = await J('/api/chandni-royale/draft', { data: sample() }, cookie); const otherId = (await r.json()).id;
  await J('/api/chandni-royale/draft', { id: otherId, data: d }, cookie);
  j = await (await J('/api/chandni-royale/me?id=' + otherId, undefined, cookie)).json();
  assert.equal(j.data.photos.length, 0); assert.equal(j.data.couplePhoto, null); assert.equal(j.data.music.url, '');
  assert.equal((await J('/api/chandni-royale/remove-media', { id: otherId, url: photo }, cookie)).status, 404);
  assert.equal((await J('/api/chandni-royale/remove-media', { id, url: photo })).status, 403);
  assert.equal((await J('/api/chandni-royale/publish', { id, confirmed: false, slug: 'our-chandni' }, cookie)).status, 422);
  const noNumber = { ...d, rsvp: { whatsapp: '' }, sections: { ...d.sections, rsvp: false } };
  await J('/api/chandni-royale/draft', { id, data: noNumber }, cookie);
  r = await J('/api/chandni-royale/publish', { id, confirmed: true, slug: 'our-chandni' }, cookie);
  assert.equal(r.status, 422); assert.ok((await r.json()).errors.some(e => e.path === 'rsvp.whatsapp'));
  await J('/api/chandni-royale/draft', { id, data: d }, cookie);
  r = await J('/api/chandni-royale/publish', { id, confirmed: true, slug: 'our-chandni' }, cookie);
  assert.equal(r.status, 200); assert.equal((await r.json()).url, base + '/our-chandni');
  assert.equal((await J(photo)).status, 200);
  assert.equal((await fetch(base + song, { headers: { range: 'bytes=0-15' } })).status, 206);
  assert.equal((await J('/api/chandni-royale/rsvp/' + id, { name: 'No store', attending: 'yes' })).status, 404);
  assert.equal((await J('/api/chandni-royale/rsvps?id=' + id, undefined, cookie)).status, 404);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cr_rsvps'").get(), undefined);
  j = await (await J('/api/chandni-royale/versions?id=' + id, undefined, cookie)).json();
  assert.equal(j.versions.length, 1); const version = j.versions[0].id;
  r = await J('/api/chandni-royale/remove-media', { id, url: song }, cookie);
  assert.equal(r.status, 200); assert.equal((await r.json()).data.music.url, '');
  assert.equal(q.paigaamById(id).customer_data.music.url, song); // live invitation unchanged
  assert.equal((await J('/api/chandni-royale/publish', { id, confirmed: true }, cookie)).status, 200);
  assert.equal(q.paigaamById(id).customer_data.music.url, '');
  assert.equal((await J(song)).status, 404); // unpublished historical file is owner-only
  r = await J('/api/chandni-royale/restore', { id, version }, cookie);
  assert.equal(r.status, 200); assert.equal((await r.json()).data.music.url, song);
  assert.equal((await J('/api/chandni-royale/restore', { id: otherId, version }, cookie)).status, 404);

  // A bogus pass cookie must never expose private media.
  const locked = sample(); locked.photos = [{ url: photo }]; locked.access.passcode = 'family';
  await J('/api/chandni-royale/draft', { id, data: locked }, cookie);
  await J('/api/chandni-royale/publish', { id, confirmed: true }, cookie);
  assert.equal((await J(photo, undefined, 'cr_pass_' + id + '=bogus')).status, 404);
  r = await fetch(base + '/chandni-royale/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=family' });
  assert.equal(r.status, 303);
  assert.equal((await J(photo, undefined, r.headers.get('set-cookie').split(';')[0])).status, 200);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM cr_owners').get().n >= 2);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'sp_%'").get().n, 0);
});

test('real server seeds hidden draft, mounts native editor/demo and blocks generic endpoint bypass', async t => {
  const { spawn } = require('node:child_process');
  const net = require('node:net');
  const { DatabaseSync } = require('node:sqlite');
  const root = path.join(__dirname, '..');
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-chandni-server-'));
  const base = 'http://127.0.0.1:' + port;
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, ADMIN_EMAIL: 'test@example.com', ADMIN_PASSWORD: 'test-password', RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; server.stderr.on('data', b => { logs += b; });
  t.after(async () => { if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } fs.rmSync(dir, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Server startup timeout: ' + logs)), 20000); server.stdout.on('data', b => { if (b.toString().includes('admin →')) { clearTimeout(timer); resolve(); } }); server.once('exit', code => { clearTimeout(timer); reject(new Error('Server exited ' + code + ': ' + logs)); }); });
  const sql = new DatabaseSync(path.join(dir, 'paigaam.db'));
  const row = sql.prepare("SELECT * FROM templates WHERE slug='chandni-royale'").get();
  assert.equal(row.status, 'draft'); assert.equal(row.thumbnail_url, '/assets/chandni-royale/gates-closed.webp');
  const J = (url, data, cookie) => fetch(base + url, { method: data === undefined ? 'GET' : 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  assert.equal((await J('/create/chandni-royale')).status, 404);
  assert.equal((await J('/templates/chandni-royale')).status, 404);
  assert.equal((await J('/api/drafts', { template: 'chandni-royale', customer_data: sample() })).status, 403);
  assert.equal((await J('/api/render-preview', { template: 'chandni-royale', customer_data: sample() })).status, 403);
  let r = await J('/chandni-royale/demo'); assert.equal(r.status, 200);
  let html = await r.text(); assert.match(html, /cr-boot/); assert.match(html, /Chandni|Aarav/);
  const boot = JSON.parse(html.match(/<script id="cr-boot" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(boot.openingVideo, false); // future opener is intentionally absent
  assert.equal((await J('/assets/chandni-royale/opener.mp4')).status, 404);
  r = await fetch(base + '/admin/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'email=test%40example.com&password=test-password' });
  const adminCookie = r.headers.get('set-cookie').split(';')[0];
  r = await J('/create/chandni-royale', undefined, adminCookie); assert.equal(r.status, 200);
  assert.match(await r.text(), /chandni-royale-core/);
  r = await J('/api/chandni-royale/draft', { data: sample() }, adminCookie); assert.equal(r.status, 200);
  const id = (await r.json()).id;
  const cookie = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await J('/api/free-publish', { id })).status, 403);
  assert.equal((await J('/go/whatsapp/' + id)).status, 403);
  assert.equal((await J('/preview/' + id)).status, 403);
  r = await J('/preview/' + id, undefined, cookie); assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/chandni-royale/preview/' + id);
  assert.equal((await J('/api/suvarna-vivah/me?id=' + id, undefined, cookie)).status, 404);
  assert.equal((await J('/api/shaadi-paigaam/me?id=' + id, undefined, cookie)).status, 404);
  sql.close();
});
