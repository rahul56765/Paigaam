'use strict';
// Kadali Vivah end-to-end API test: disposable server + isolated DATA_DIR.
// Run: node scripts/test-kadali-vivah.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net'), zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const C = require('../public/shaadi-paigaam/core.js');

function png(w, h) {   // tiny valid PNG (solid colour) for the low-resolution check
  const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let x = 0xFFFFFFFF; for (const b of buf) x = crcT[(x ^ b) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 200); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function future(days) { const d = new Date(Date.now() + days * 864e5); return d.toISOString().slice(0, 10); }
function sample() {
  const d = JSON.parse(JSON.stringify(C.SAMPLE));
  const w = future(90);
  d.wedding.date = w; d.rsvp.deadline = future(80);
  const shift = { 'ev-mehendi': -2, 'ev-haldi': -1, 'ev-arrival': 0, 'ev-wedding': 0, 'ev-reception': 1 };
  for (const e of d.events) e.date = future(90 + shift[e.id]);
  return d;
}

(async () => {
  const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const port = s.address().port; await new Promise(r => s.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-kadali-test-')), base = 'http://127.0.0.1:' + port;
  let server;
  async function start() {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', x => process.stderr.write(x));
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('startup timeout')), 20000);
      server.stdout.on('data', c => { if (c.toString().includes('admin →')) { clearTimeout(t); resolve(); } });
      server.on('exit', code => { clearTimeout(t); reject(new Error('server exited ' + code)); });
    });
  }
  async function stop() { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }
  const J = (url, body, cookie, extra = {}) => fetch(base + url, { method: body ? 'POST' : 'GET', redirect: 'manual', headers: Object.assign({ 'content-type': 'application/json' }, cookie ? { cookie } : {}, extra), body: body ? JSON.stringify(body) : undefined });
  let passed = 0; const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓', msg); };
  try {
    await start();
    // This flow tests both paid/offline and free publishing. The live template now
    // seeds at ₹0, so make the isolated test row nominally paid for its first pass.
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); db.prepare("UPDATE templates SET price=1 WHERE slug='kadali-vivah'").run(); db.close(); }
    let r = await J('/kadali-vivah/demo'); let html = await r.text();
    ok(r.status === 200 && html.includes('Aarav') && html.includes('sp-boot'), 'demo renders the sample couple');
    const bootMatch = html.match(/<script id="sp-boot" type="application\/json">([\s\S]*?)<\/script>/);
    const demoBoot = bootMatch && JSON.parse(bootMatch[1]);
    ok(demoBoot && demoBoot.data.palette.id === 'terracotta-cream' && demoBoot.data.font === 'royal' && !demoBoot.autoOpen && !demoBoot.simpleWhatsAppRsvp && demoBoot.lazyMusic && !demoBoot.removeMusic, 'Kadali uses full RSVP and lazy music alongside Terracotta & Cream / Royal Calligraphy');
    const skipHtml = await (await J('/kadali-vivah/demo?skip=1')).text();
    ok(!skipHtml.includes('/kadali-vivah/opening.js') && skipHtml.includes('\"autoOpen\":true'), 'demo skip link bypasses the clip and opens the invitation');
    ok((await J('/templates/kadali-vivah')).status === 200, 'catalogue detail page exists');
    ok((await J('/template-view/kadali-vivah')).status === 200, 'gallery thumbnail uses the Kadali experience');
    const editorHtml = await (await J('/create/kadali-vivah')).text();
    ok(editorHtml.includes('/shaadi-paigaam/editor.js?v=6') && editorHtml.includes('\"slug\":\"kadali-vivah\"'), 'editor page loads the cache-busted route-aware editor');
    for (const asset of ['invite.js', 'invite.css', 'art/leaf.webp', 'art/kalash.webp', 'art/mandap.webp']) {
      const response = await J('/kadali-vivah/' + asset);
      ok(response.status === 200, 'Kadali runtime asset is served: ' + asset);
    }
    ok(html.includes('/kadali-vivah/invite.js?v=') && html.includes('/kadali-vivah/invite.css?v=') && !html.includes('/shaadi-paigaam/invite.js') && !html.includes('/shaadi-paigaam/invite.css'), 'demo uses its own Kadali runtime, not the shared invitation runtime');
    ok(!/opening\.(?:js|css|mp4)|<video\b/i.test(html), 'demo has no opening video or opener scripts');
    for (const asset of ['opening.js', 'opening.css', 'opening.mp4', 'opening-poster.jpg']) {
      ok((await J('/kadali-vivah/' + asset)).status === 404, 'Kadali does not serve an opening asset: ' + asset);
    }
    const frameResponse = await J('/kadali-vivah/frame');
    const frameHtml = await frameResponse.text();
    ok(frameResponse.status === 200 && frameResponse.headers.get('x-frame-options') === 'SAMEORIGIN' && frameHtml.includes('/kadali-vivah/invite.js') && frameHtml.includes('"lazyMusic":true'), 'editor frame uses the Kadali runtime and lazy music');
    ok((await J('/shaadi-paigaam/music/shehnai-dawn.mp3')).status === 200, 'music library is served');

    // --- draft
    let d = sample();
    d.couple.groom.first = 'aarav<script>alert(1)</script>';
    r = await J('/api/kadali-vivah/draft', { data: d });
    const cookie = r.headers.get('set-cookie').split(';')[0];
    let j = await r.json();
    const id = j.id, manageToken = j.manageToken;
    ok(id && /^[a-f0-9]{48}$/.test(manageToken), 'draft created with a private manage token');
    ok(j.errors.some(e => e.path === 'couple.groom.first'), 'symbols in a name are reported as an error');
    r = await J('/api/kadali-vivah/me?id=' + id, null, cookie); j = await r.json();
    ok(!/[<>]/.test(JSON.stringify(j.data)), 'angle brackets never reach storage (no raw HTML)');
    d.couple.groom.first = 'aarav'; r = await J('/api/kadali-vivah/draft', { id, data: d }, cookie); j = await r.json();
    ok(!j.errors.length, 'valid draft has no blocking errors');
    d.photos.push({ url: '/shaadi-paigaam/media/' + 'a'.repeat(48) + '.webp', alt: 'foreign', fx: 50, fy: 50 });
    await J('/api/kadali-vivah/draft', { id, data: d }, cookie);
    j = await (await J('/api/kadali-vivah/me?id=' + id, null, cookie)).json();
    ok(!j.data.photos.some(p => p.url.startsWith('/shaadi-paigaam/media/')), 'cross-template private uploads cannot be referenced');
    d = j.data;
    r = await J('/api/kadali-vivah/me?id=' + id, null, cookie); j = await r.json();
    ok(j.data.couple.groom.first === 'Aarav', 'names are auto-capitalised');
    ok((await J('/api/kadali-vivah/me?id=' + id)).status === 404, 'another visitor cannot read the draft');
    ok((await J('/api/kadali-vivah/draft', { id, data: d })).status === 403, 'another visitor cannot overwrite the draft');

    // --- slugs
    j = await (await J('/api/kadali-vivah/slug?s=create&id=' + id, null, cookie)).json();
    ok(!j.available && j.reason === 'reserved' && j.suggestions.length, 'reserved words are refused with suggestions');
    j = await (await J('/api/kadali-vivah/slug?s=aarav-ananya&id=' + id, null, cookie)).json();
    ok(j.available, 'aarav-ananya is available');
    j = await (await J('/api/kadali-vivah/slug?s=-bad--', null, cookie)).json();
    ok(!j.available && j.reason === 'format', 'badly formed links are refused');

    // --- uploads
    r = await fetch(base + '/api/kadali-vivah/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/png' }, body: png(120, 90) });
    ok(r.status === 400 && (await r.json()).error === 'low_resolution', 'low-resolution photos are blocked');
    r = await fetch(base + '/api/kadali-vivah/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/webp' }, body: fs.readFileSync(path.join(root, 'public/shaadi-paigaam/art/demo-1.webp')) });
    j = await r.json();
    ok(r.status === 200 && /^\/kadali-vivah\/media\/[a-f0-9]{48}\.webp$/.test(j.url), 'a real photo uploads');
    const photoUrl = j.url;
    ok((await J(photoUrl)).status === 404, 'draft uploads are private to the owner');
    ok((await J(photoUrl, null, cookie)).status === 200, 'the owner can see their upload');
    r = await fetch(base + '/api/kadali-vivah/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/png' }, body: Buffer.from('not an image at all, just text pretending') });
    ok(r.status === 400, 'non-images are rejected by their bytes');
    r = await fetch(base + '/api/kadali-vivah/upload?id=' + id + '&kind=music', { method: 'POST', headers: { cookie, 'content-type': 'audio/mpeg' }, body: fs.readFileSync(path.join(root, 'public/shaadi-paigaam/music/harp-garden.mp3')) });
    j = await r.json();
    const musicUrl = j.url;
    ok(r.status === 200 && /^\/kadali-vivah\/media\/[a-f0-9]{48}\.mp3$/.test(musicUrl), 'an MP3 song uploads into the Kadali namespace');
    d.photos.unshift({ url: photoUrl, alt: 'Us', fx: 50, fy: 50 });
    await J('/api/kadali-vivah/draft', { id, data: d }, cookie);

    // --- ownership boundaries and generic endpoint bypass regressions
    for (const route of ['/kadali-vivah/preview/' + id, '/kadali-vivah/rsvps/' + id + '.csv', '/api/kadali-vivah/versions?id=' + id]) {
      ok((await J(route)).status === (route.includes('/preview/') ? 403 : 404), 'owner-only route rejects anonymous access: ' + route);
    }
    ok((await J('/kadali-vivah/preview/' + id, null, cookie)).status === 200, 'owner preview renders');
    ok((await J('/api/kadali-vivah/restore', { id, version: 1 })).status === 404, 'anonymous restore is blocked');
    ok((await fetch(base + '/api/kadali-vivah/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { 'content-type': 'image/png' }, body: png(120, 90) })).status === 403, 'anonymous upload is blocked before image validation');
    for (const [endpoint, body] of [
      ['/api/drafts', { template: 'kadali-vivah', customer_data: d }],
      ['/api/drafts', { template: 'noor', id, customer_data: { message: 'BYPASS' } }],
      ['/api/render-preview', { template: 'kadali-vivah', customer_data: d }],
      ['/api/free-publish', { id }],
    ]) {
      const response = await J(endpoint, body, cookie);
      const result = await response.json();
      ok(response.status === 403 && result.error === 'use_template_endpoint', 'generic bypass is refused: ' + endpoint + ' / ' + (body.template || id));
    }
    j = await (await J('/api/kadali-vivah/me?id=' + id, null, cookie)).json();
    ok(j.data.couple.groom.first === 'Aarav' && j.data.photos.some(p => p.url === photoUrl), 'generic bypass attempts leave the draft intact');

    // Shared validation must preserve legitimate Kadali media URLs. Each existing
    // template must then strip references to media belonging to this Kadali draft.
    const mediaSample = sample();
    mediaSample.photos = [{ url: photoUrl, alt: 'Kadali upload', fx: 50, fy: 50 }];
    mediaSample.couplePhoto = { url: photoUrl, fx: 50, fy: 50 };
    mediaSample.music = { track: 'upload', url: musicUrl, title: 'Our song', rightsOk: true };
    const normalized = C.validate(mediaSample, { allowPast: true }).data;
    ok(normalized.photos[0].url === photoUrl && normalized.couplePhoto.url === photoUrl && normalized.music.url === musicUrl, 'shared validation preserves Kadali photo, couple-photo, and music URLs');
    for (const template of ['shaadi-paigaam', 'suvarna-vivah']) {
      const response = await J('/api/' + template + '/draft', { data: mediaSample }, cookie);
      const foreign = await response.json();
      ok(response.status === 200 && foreign.id, template + ' can create a regression-test draft');
      const saved = await (await J('/api/' + template + '/me?id=' + foreign.id, null, cookie)).json();
      ok(!saved.data.photos.some(p => p.url === photoUrl) && !saved.data.couplePhoto && saved.data.music.url !== musicUrl, template + ' strips foreign Kadali photo, couple-photo, and music references');
      ok((await J('/api/' + template + '/me?id=' + id, null, cookie)).status === 404 && (await J('/api/kadali-vivah/me?id=' + foreign.id, null, cookie)).status === 404, template + ' and Kadali reject each other’s draft IDs even with the same owner');
      const upload = await fetch(base + '/api/' + template + '/upload?id=' + foreign.id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/webp' }, body: fs.readFileSync(path.join(root, 'public/shaadi-paigaam/art/demo-1.webp')) });
      const uploaded = await upload.json();
      ok(upload.status === 200 && uploaded.url.startsWith('/' + template + '/media/'), template + ' creates a real foreign upload');
      const attack = JSON.parse(JSON.stringify(d));
      attack.photos.push({ url: uploaded.url, alt: 'foreign', fx: 50, fy: 50 });
      attack.couplePhoto = { url: uploaded.url, fx: 50, fy: 50 };
      await J('/api/kadali-vivah/draft', { id, data: attack }, cookie);
      const own = await (await J('/api/kadali-vivah/me?id=' + id, null, cookie)).json();
      ok(!own.data.photos.some(p => p.url === uploaded.url) && !own.data.couplePhoto && own.data.photos.some(p => p.url === photoUrl), 'Kadali strips ' + template + ' foreign media without dropping its own upload');
    }

    // --- publish: confirmation, payment, then free
    r = await J('/api/kadali-vivah/publish', { id, slug: 'aarav-ananya' }, cookie);
    ok(r.status === 422, 'publishing needs the "I have checked" confirmation');
    r = await J('/api/kadali-vivah/publish', { id, slug: 'aarav-ananya', confirmed: true }, cookie);
    j = await r.json();
    ok(r.status === 503 && j.error === 'payments_offline', 'a paid template asks for payment (offline here)');
    await stop();
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); db.prepare("UPDATE templates SET price=0 WHERE slug='kadali-vivah'").run(); db.prepare("UPDATE paigaams SET status='draft' WHERE id=?").run(id); db.close(); }
    await start();
    r = await J('/api/kadali-vivah/publish', { id, slug: 'aarav-ananya', confirmed: true }, cookie); j = await r.json();
    ok(r.status === 200 && j.url === base + '/aarav-ananya', 'free publish returns the short link');
    r = await J('/aarav-ananya'); html = await r.text();
    ok(r.status === 200 && html.includes('"mode":"guest"') && html.includes('og:image'), 'paigaam.cc/aarav-ananya serves the invitation with a share card');
    ok((await J(photoUrl)).status === 200, 'photos become public once published');
    r = await J('/p/aarav-ananya'); ok(r.status === 301 && r.headers.get('location') === '/aarav-ananya', '/p/<link> redirects to the short link');
    ok((await J('/no-such-couple')).status === 404, 'unknown short links fall through to the normal 404');
    ok((await J('/contact')).status === 200, 'existing routes are untouched');
    r = await J('/kadali-vivah/card/' + id + '.jpg');
    ok([200, 503].includes(r.status), 'share card endpoint answers (' + r.status + (r.status === 503 ? ': sharp not installed here' : '') + ')');

    // --- a second customer cannot take the link
    r = await J('/api/kadali-vivah/draft', { data: sample() }); const cookie2 = r.headers.get('set-cookie').split(';')[0]; const id2 = (await r.json()).id;
    j = await (await J('/api/kadali-vivah/slug?s=aarav-ananya&id=' + id2, null, cookie2)).json();
    ok(!j.available && j.reason === 'taken' && j.suggestions.length >= 2, 'a taken link offers alternatives: ' + j.suggestions.join(', '));
    r = await J('/api/kadali-vivah/publish', { id: id2, slug: 'aarav-ananya', confirmed: true }, cookie2);
    ok(r.status === 409, 'publishing onto a taken link is refused');

    // --- RSVP
    const rs = (b, c) => J('/api/kadali-vivah/rsvp/' + id, Object.assign({ t: 6000, lang: 'en' }, b), c);
    r = await rs({ name: 'Bot', email: 'bot@x.com', attending: 'yes', website: 'http://spam' }); ok(r.status === 200, 'honeypot gets a silent OK');
    r = await rs({ name: 'Fast', email: 'fast@x.com', attending: 'yes', t: 300 }); ok(r.status === 200, 'too-fast bot gets a silent OK');
    r = await rs({ name: 'Riya Shah', email: 'riya@example.com', attending: 'yes', guests: 3, meal: 'Jain', message: 'So happy!' }); ok(r.status === 200, 'a guest RSVPs');
    r = await rs({ name: 'Riya S', email: 'RIYA@example.com', attending: 'no' }); ok(r.status === 409, 'a duplicate email gets the "already replied" notice');
    r = await rs({ name: 'Riya S', email: 'riya@example.com', attending: 'yes', guests: 99, confirmUpdate: true }); ok(r.status === 200 && (await r.json()).updated, 'the guest can update their reply');
    r = await rs({ name: 'Kabir', phone: '98765 43210', attending: 'no' }); ok(r.status === 200, 'a phone-only RSVP works');
    r = await rs({ name: 'Kabir again', phone: '+919876543210', attending: 'yes' }); ok(r.status === 409, 'the same phone in another format is caught');
    r = await rs({ name: '', email: 'x@y.com', attending: 'yes' }); ok(r.status === 400, 'RSVP needs a name');
    j = await (await J('/api/kadali-vivah/rsvps?id=' + id, null, cookie)).json();
    ok(j.totals.responses === 2 && j.totals.guests === 4 && j.rows.find(x => x.email === 'riya@example.com').guests === 4, 'dashboard totals are right (guests capped at the maximum of 4)');
    ok((await J('/api/kadali-vivah/rsvps?id=' + id, null, cookie2)).status === 404, "another customer can't see the guest list");
    r = await J('/kadali-vivah/rsvps/' + id + '.csv', null, cookie); const csv = await r.text();
    ok(r.status === 200 && csv.includes('Riya S') && csv.includes('Kabir'), 'CSV export works');

    // --- manage link on another device
    r = await J('/kadali-vivah/manage/' + manageToken); const mc = r.headers.get('set-cookie').split(';')[0];
    ok(r.status === 303 && (await J('/api/kadali-vivah/me?id=' + id, null, mc)).status === 200, 'the manage link opens the invitation on any device');

    // --- edit after publishing: pending → update live
    const d2 = (await (await J('/api/kadali-vivah/me?id=' + id, null, cookie)).json()).data;
    d2.gifts = 'Only your blessings, please.';
    await J('/api/kadali-vivah/draft', { id, data: d2 }, cookie);
    ok(!(await (await J('/aarav-ananya')).text()).includes('Only your blessings'), 'live page is unchanged while editing');
    r = await J('/api/kadali-vivah/publish', { id, confirmed: true }, cookie); j = await r.json();
    ok(r.status === 200 && j.updated && j.url.endsWith('/aarav-ananya'), 'update goes live on the same link');
    ok((await (await J('/aarav-ananya')).text()).includes('Only your blessings'), 'the change is live');
    j = await (await J('/api/kadali-vivah/versions?id=' + id, null, cookie)).json();
    ok(j.versions.length === 2, 'version history keeps each publish');
    r = await J('/api/kadali-vivah/restore', { id, version: j.versions[1].id }, cookie);
    ok(r.status === 200 && !(await r.json()).data.gifts.includes('Only your'), 'an older version can be restored into the editor');

    // --- passcode gate
    d2.access.passcode = 'shaadi26';
    await J('/api/kadali-vivah/draft', { id, data: d2 }, cookie);
    await J('/api/kadali-vivah/publish', { id, confirmed: true }, cookie);
    html = await (await J('/aarav-ananya')).text();
    ok(html.includes('passcode') && !html.includes('Only your blessings'), 'a private invitation shows only the passcode gate');
    ok((await J('/kadali-vivah/card/' + id + '.jpg')).status === 404, 'guests cannot fetch a private invitation share card');
    const ownerCard = await J('/kadali-vivah/card/' + id + '.jpg', null, cookie);
    ok([200, 503].includes(ownerCard.status), 'the owner can still fetch the private invitation share card');
    r = await fetch(base + '/kadali-vivah/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=wrong' });
    ok(r.headers.get('location') === '/aarav-ananya?wrong=1', 'a wrong passcode is refused');
    r = await fetch(base + '/kadali-vivah/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=shaadi26' });
    const pc = r.headers.get('set-cookie').split(';')[0];
    ok((await (await J('/aarav-ananya', null, pc)).text()).includes('Only your blessings'), 'the right passcode opens it');
    ok((await J('/api/kadali-vivah/rsvp/' + id, { name: 'X', email: 'x@x.com', attending: 'yes', t: 5000 })).status === 403, 'RSVP to a private invitation needs the passcode');

    // --- expiry after the wedding
    await stop();
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); const row = db.prepare('SELECT customer_data FROM paigaams WHERE id=?').get(id); const cd = JSON.parse(row.customer_data); cd.wedding.date = '2024-01-10'; cd.access.expireDays = 7; cd.access.passcode = ''; db.prepare('UPDATE paigaams SET customer_data=? WHERE id=?').run(JSON.stringify(cd), id); db.close(); }
    await start();
    r = await J('/aarav-ananya'); html = await r.text();
    ok(r.status === 410 && html.includes('ended'), 'the invitation closes itself after the chosen days');

    console.log(`\nPASS: ${passed} Kadali Vivah checks.`);
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error('FAIL:', e.message); process.exitCode = 1; });
