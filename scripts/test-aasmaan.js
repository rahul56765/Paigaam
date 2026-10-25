'use strict';
// Isolated API regression: no production data, deployment, or template publishing.
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const assert = require('node:assert/strict');
const C = require('../public/shaadi-paigaam/core');
const zlib = require('node:zlib');
const root = path.join(__dirname, '..');
const future = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
function png(w, h) {   // tiny valid PNG (solid colour) for the low-resolution check
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let x = 0xFFFFFFFF; for (const b of buf) x = crcT[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 200); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function sample() {
  const d = structuredClone(C.SAMPLE); d.wedding.date = future(90); d.rsvp.deadline = future(80); d.rsvp.whatsapp = '+919876543210';
  const shift = { 'ev-mehendi': -2, 'ev-haldi': -1, 'ev-arrival': 0, 'ev-wedding': 0, 'ev-reception': 1 };
  for (const e of d.events) e.date = future(90 + (shift[e.id] || 0));
  return d;
}
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-aasmaan-test-'));
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r)); const base = 'http://127.0.0.1:' + port;
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stderr.on('data', x => { log += x; });
  let db, count = 0;
  const ok = (cond, msg) => { assert.ok(cond, msg); count++; console.log('  ✓', msg); };
  const J = (url, body, cookie, headers = {}) => fetch(base + url, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const upload = (id, cookie, bytes, type = 'audio/mpeg', kind = 'music') => fetch(base + `/api/aasmaan/upload?id=${id}&kind=${kind}`, { method: 'POST', headers: { cookie, 'content-type': type }, body: bytes });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server startup timeout: ' + log)), 20000);
      server.stdout.on('data', chunk => { if (String(chunk).includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(new Error('server exited ' + code + ': ' + log)); });
    });
    db = new DatabaseSync(path.join(dir, 'paigaam.db'));
    ok(db.prepare("SELECT status FROM templates WHERE slug='aasmaan'").get().status === 'draft', 'new Aasmaan registry row seeds unpublished');
    ok((await J('/create/aasmaan')).status === 404 && (await J('/api/aasmaan/draft', { data: sample() })).status === 404, 'draft registry row is not customer-creatable');
    // Only the disposable test database is made published for the API checks.
    db.prepare("UPDATE templates SET status='published' WHERE slug='aasmaan'").run();
    const editor = await (await J('/create/aasmaan')).text();
    ok(editor.includes('"slug":"aasmaan"') && editor.includes('/shaadi-paigaam/editor.js?v=6-aasmaan-1'), 'seven-step shared editor boots in Aasmaan namespace');
    let d = sample(); let r = await J('/api/aasmaan/draft', { data: d });
    const cookie = r.headers.get('set-cookie').split(';')[0], draft = await r.json(), id = draft.id;
    ok(r.status === 200 && id && /^[a-f0-9]{48}$/.test(draft.manageToken), 'private draft and cross-device manage token created');
    const me = async () => (await J('/api/aasmaan/me?id=' + id, null, cookie)).json();
    d = (await me()).data;
    ok(d.music.track === 'none' && !d.music.url && d.music.startMuted && !d.rsvp.email, 'library music removed and optional music defaults to silent');
    ok((await J('/api/aasmaan/me?id=' + id)).status === 404 && (await J('/api/aasmaan/draft', { id, data: d })).status === 403, 'draft cannot be read or changed by another visitor');
    ok((await J('/api/aasmaan/draft', { id, data: d }, cookie, { origin: 'https://evil.example' })).status === 403, 'cross-origin autosave is rejected');
    ok((await J('/api/free-publish', { id }, cookie)).status === 403 && (await J('/api/drafts', { template: 'noor', id, customer_data: {} }, cookie)).status === 403, 'generic endpoints cannot mutate or publish Aasmaan');
    ok((await J('/api/render-preview', { template: 'aasmaan', customer_data: d }, cookie)).status === 403, 'generic renderer cannot bypass template adapter');
    ok((await J('/api/razorpay/order', { id }, cookie)).status === 403, 'generic checkout cannot bypass Aasmaan publish validation');
    const sv = await (await J('/api/suvarna-vivah/draft', { data: sample() }, cookie)).json();
    for (const endpoint of ['me?id=', 'versions?id=']) {
      ok((await J('/api/aasmaan/' + endpoint + sv.id, null, cookie)).status === 404, 'Aasmaan ' + endpoint + ' rejects Suvarna IDs');
      ok((await J('/api/suvarna-vivah/' + endpoint + id, null, cookie)).status === 404, 'Suvarna ' + endpoint + ' rejects Aasmaan IDs');
    }
    ok((await J('/api/aasmaan/draft', { id: sv.id, data: d }, cookie)).status === 404 && (await upload(sv.id, cookie, Buffer.from('ID3' + 'x'.repeat(40)))).status === 404, 'cross-template draft/upload writes rejected');
    ok((await J('/api/aasmaan/restore', { id: sv.id, version: 1 }, cookie)).status === 404, 'version restore cannot cross templates');
    ok((await J('/api/aasmaan/rsvp/' + id, { name: 'Guest', phone: '+919999999999', attending: 'yes' })).status === 404 && (await J('/api/aasmaan/rsvps?id=' + id, null, cookie)).status === 404, 'website RSVP submission and dashboard APIs do not exist');
    ok(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='aa_rsvps'").get() && db.prepare('SELECT COUNT(*) n FROM sp_rsvps WHERE paigaam_id=?').get(id).n === 0, 'no Aasmaan RSVP table or guest records stored');
    ok((await upload(id, cookie, png(100, 100), 'image/png', 'photo')).status === 400, 'undersized photo rejected');
    ok((await upload(id, cookie, png(400, 400), 'image/jpeg', 'photo')).status === 400, 'photo MIME must match detected format');
    const photoResponse = await upload(id, cookie, png(400, 400), 'image/png', 'photo');
    const photo = await photoResponse.json();
    ok(photoResponse.status === 200 && /^\/aasmaan\/media\/[a-f0-9]{48}\.png$/.test(photo.url), 'valid photo uses Aasmaan upload namespace');
    ok((await J(photo.url)).status === 404 && (await J(photo.url, null, cookie)).status === 200, 'uploaded draft photo remains private');
    d.photos.push({ url: photo.url, alt: 'Our photograph', fx: 50, fy: 50 });
    const bytes = Buffer.from('ID3' + 'x'.repeat(61));
    ok((await upload(id, cookie, bytes, 'text/plain')).status === 400 && (await upload(id, cookie, Buffer.alloc(24))).status === 400, 'audio upload requires matching declared MIME and sniffed bytes');
    r = await upload(id, cookie, bytes); const music = await r.json();
    ok(r.status === 200 && /^\/aasmaan\/media\/[a-f0-9]{48}\.mp3$/.test(music.url), 'customer song upload uses isolated media namespace');
    ok((await J(music.url)).status === 404 && (await J(music.url, null, cookie)).status === 200, 'unpublished media is owner-only');
    d.music = { track: 'upload', url: music.url, rightsOk: false, startMuted: false };
    let saved = await (await J('/api/aasmaan/draft', { id, data: d }, cookie)).json();
    ok(saved.errors.some(e => e.path === 'music.rightsOk'), 'customer must confirm music rights');
    d.music.rightsOk = true;
    d.photos.push({ url: '/suvarna-vivah/media/' + 'a'.repeat(48) + '.webp', alt: 'foreign' });
    await J('/api/aasmaan/draft', { id, data: d }, cookie); d = (await me()).data;
    ok(!d.photos.some(p => p.url.startsWith('/suvarna-vivah/media/')) && d.photos.some(p => p.url === photo.url) && d.music.url === music.url && d.music.startMuted, 'foreign media stripped but own upload preserved');
    // Aasmaan namespace is opt-in; existing shared-core behavior is unchanged.
    const typed = structuredClone(d); typed.photos = [{ url: '/aasmaan/media/' + 'a'.repeat(48) + '.webp', alt: 'own' }];
    ok(C.validate(typed).data.photos.length === 0 && C.validate(typed, { mediaNamespace: 'aasmaan' }).data.photos.length === 1, 'shared validation namespace is additive, not globally broadened');
    const second = await (await J('/api/aasmaan/draft', { data: sample() }, cookie)).json();
    await J('/api/aasmaan/draft', { id: second.id, data: d }, cookie);
    const secondData = await (await J('/api/aasmaan/me?id=' + second.id, null, cookie)).json();
    ok(!secondData.data.music.url && !secondData.data.photos.some(p => p.url === photo.url), 'even same-owner drafts cannot borrow each other’s uploaded music or photos');
    const missing = structuredClone(d); missing.sections.rsvp = false; missing.rsvp.whatsapp = '';
    await J('/api/aasmaan/draft', { id, data: missing }, cookie);
    r = await J('/api/aasmaan/publish', { id, confirmed: true, slug: 'celestial-test' }, cookie); const incomplete = await r.json();
    ok(r.status === 422 && incomplete.errors.some(e => e.path === 'rsvp.whatsapp'), 'organiser number required at publish even if RSVP section is hidden');
    await J('/api/aasmaan/draft', { id, data: d }, cookie);
    ok((await J('/api/aasmaan/publish', { id, confirmed: true, slug: 'aasmaan' }, cookie)).status === 409, 'template slug is reserved');
    r = await J('/api/aasmaan/publish', { id, confirmed: true, slug: 'celestial-test' }, cookie); const pub = await r.json();
    ok(r.status === 200 && pub.slug === 'celestial-test', 'valid invitation publishes through its adapter');
    ok((await J(music.url)).status === 200 && (await J(photo.url)).status === 200, 'only referenced published uploads become public');
    const unattached = await (await upload(id, cookie, bytes)).json();
    ok((await J(unattached.url)).status === 404, 'new pending upload on a live invitation stays private');
    const versions = await (await J('/api/aasmaan/versions?id=' + id, null, cookie)).json();
    ok(versions.versions.length === 1, 'publish snapshots the first restorable version');
    d.access.passcode = 'stars123'; await J('/api/aasmaan/draft', { id, data: d }, cookie);
    ok((await me()).pending && db.prepare('SELECT customer_data FROM paigaams WHERE id=?').get(id).customer_data.includes('"passcode":""'), 'live edit stored separately from published content');
    await J('/api/aasmaan/publish', { id, confirmed: true }, cookie);
    ok((await J(music.url)).status === 404 && (await J(music.url, null, 'aa_pass_' + id + '=forged')).status === 404, 'protected media requires real signed unlock, not cookie presence');
    r = await fetch(base + '/aasmaan/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=stars123' });
    const passCookie = r.headers.get('set-cookie').split(';')[0];
    ok(r.status === 303 && (await J(music.url, null, passCookie)).status === 200, 'legitimate passcode unlock grants protected media');
    const managed = await J('/aasmaan/manage/' + draft.manageToken);
    const manageCookie = managed.headers.get('set-cookie').split(';')[0];
    ok(managed.status === 303 && (await J('/api/aasmaan/me?id=' + id, null, manageCookie)).status === 200, 'manage link grants cross-device access');
    ok((await J('/api/aasmaan/restore', { id, version: versions.versions[0].id }, cookie)).status === 200, 'owner can restore old version into pending data');
    if (fs.existsSync(path.join(root, 'templates/aasmaan.js'))) {
      const demo = await J('/aasmaan/demo');
      ok(demo.status === 200 && (await demo.text()).includes('Aarav'), 'independent renderer demo is wired');
      ok((await J('/template-view/aasmaan')).status === 200, 'catalogue miniature uses independent renderer');
      if (fs.existsSync(path.join(root, 'public/aasmaan/vendor/three.min.js'))) ok((await J('/aasmaan/vendor/three.min.js')).status === 200, 'vendored scene runtime falls through to safe static serving');
    } else console.log('  - renderer smoke checks deferred: main agent is preparing templates/aasmaan.js');
    console.log(`\nAasmaan: ${count} checks passed.`);
  } finally {
    if (db) db.close(); if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
