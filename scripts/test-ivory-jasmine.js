'use strict';
// Ivory Jasmine end-to-end API test: disposable server + isolated DATA_DIR.
// Run: node scripts/test-ivory-jasmine.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net'), zlib = require('node:zlib');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const C = require('../public/ivory-jasmine/core.js');

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
  d.rsvp.whatsapp = '+919999999999';
  const shift = { 'ev-mehendi': -2, 'ev-haldi': -1, 'ev-arrival': 0, 'ev-wedding': 0, 'ev-reception': 1 };
  for (const e of d.events) e.date = future(90 + shift[e.id]);
  return d;
}

(async () => {
  const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const port = s.address().port; await new Promise(r => s.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-ij-test-')), base = 'http://127.0.0.1:' + port;
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
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); db.prepare("UPDATE templates SET price=1 WHERE slug='ivory-jasmine'").run(); db.close(); }
    let r = await J('/ivory-jasmine/demo'); let html = await r.text();
    ok(r.status === 200 && html.includes('Aarav'), 'demo renders the sample couple');
    for (const url of ['/templates/ivory-jasmine', '/template-view/ivory-jasmine', '/templates/wedding']) {
      ok((await J(url)).status === 200, 'registered discovery route: ' + url);
    }
    const editorResponse = await J('/create/ivory-jasmine'), editorHtml = await editorResponse.text();
    const editorRuntime = fs.readFileSync(path.join(root, 'public/shaadi-paigaam/editor.js'), 'utf8');
    ok(editorResponse.status === 200 && editorHtml.includes('"slug":"ivory-jasmine"') && editorHtml.includes('/ivory-jasmine/core.js') && editorHtml.includes('Ivory Jasmine'), 'existing editor funnel boots with scoped core and branding');
    ok(editorRuntime.includes("'ij-ed'") && editorRuntime.includes("Organiser's WhatsApp number") && editorRuntime.includes("const tracks = lazyMusic ? ''"), 'separate local storage, simple WhatsApp and upload-only music');
    ok((await J('/ivory-jasmine/core.js')).status === 200, 'template-local media core is served');
    const demoLinks = C.whatsappRsvpLink(sample(), true, 'en');
    ok(demoLinks.startsWith('https://wa.me/919999999999?text=') && decodeURIComponent(demoLinks).includes('Aarav & Ananya'), 'yes RSVP opens organiser WhatsApp with couple context');
    ok(decodeURIComponent(C.whatsappRsvpLink(sample(), false, 'en')).includes('Aarav & Ananya'), 'no RSVP keeps the couple context');

    // --- draft
    const d = sample();
    d.couple.groom.first = 'aarav<script>alert(1)</script>';
    r = await J('/api/ivory-jasmine/draft', { data: d });
    const cookie = r.headers.get('set-cookie').split(';')[0];
    let j = await r.json();
    const id = j.id, manageToken = j.manageToken;
    ok(id && /^[a-f0-9]{48}$/.test(manageToken), 'draft created with a private manage token');
    ok(j.errors.some(e => e.path === 'couple.groom.first'), 'symbols in a name are reported as an error');
    r = await J('/api/ivory-jasmine/me?id=' + id, null, cookie); j = await r.json();
    ok(!/[<>]/.test(JSON.stringify(j.data)), 'angle brackets never reach storage (no raw HTML)');
    d.couple.groom.first = 'aarav'; r = await J('/api/ivory-jasmine/draft', { id, data: d }, cookie); j = await r.json();
    ok(!j.errors.length, 'valid draft has no blocking errors');
    r = await J('/api/ivory-jasmine/me?id=' + id, null, cookie); j = await r.json();
    ok(j.data.couple.groom.first === 'Aarav', 'names are auto-capitalised');
    ok((await J('/api/ivory-jasmine/me?id=' + id)).status === 404, 'another visitor cannot read the draft');
    ok((await J('/api/ivory-jasmine/draft', { id, data: d })).status === 403, 'another visitor cannot overwrite the draft');

    // --- reuse the existing dynamic event schema: add, reorder, remove, save and reload
    const firstEvents = d.events.map(e => e.id);
    d.events.push({ id: 'ev-garba-night', type: 'custom', name: 'Garba Night', date: future(88), start: '20:00', end: '23:00', venue: 'Courtyard', address: 'Pune', note: 'Dance with us', dress: 'Festive', main: false });
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json();
    ok(j.data.events.some(e => e.id === 'ev-garba-night' && e.venue === 'Courtyard'), 'custom event is added and reloaded');
    d.events = [d.events.pop(), ...d.events];
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json();
    ok(j.data.events[0].id === 'ev-garba-night' && j.data.events.slice(1).map(e => e.id).join(',') === firstEvents.join(','), 'manual event order survives save and reload');
    d.events = d.events.filter(e => e.id !== 'ev-garba-night');
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json();
    ok(j.data.events.map(e => e.id).join(',') === firstEvents.join(','), 'removing an event persists without changing the main ceremony');
    const many = sample();
    while (many.events.length < 20) many.events.push({ id: 'ev-extra-' + many.events.length, type: 'custom', name: 'Celebration ' + many.events.length, date: future(89), start: '12:00', venue: 'Courtyard', main: false });
    await J('/api/ivory-jasmine/draft', { id, data: many }, cookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json();
    ok(j.data.events.length === 20, 'twenty editable wedding events survive autosave');
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);
    ok((await J('/preview/' + id)).status === 403, 'generic preview enforces Ivory owner access');
    r = await J('/preview/' + id, null, cookie);
    ok(r.status === 303 && r.headers.get('location') === '/ivory-jasmine/preview/' + id, 'generic preview redirects owners into the custom renderer');
    ok((await J('/ivory-jasmine/preview/' + id, null, cookie)).status === 200, 'owner-only template preview works');
    for (const [url, body] of [
      ['/api/free-publish', { id }], ['/api/drafts', { template: 'ivory-jasmine', customer_data: d }],
      ['/api/drafts', { template: 'noor', id, customer_data: d }], ['/api/render-preview', { template: 'ivory-jasmine' }],
      ['/api/razorpay/order', { id }],
    ]) ok((await J(url, body, cookie)).status === 403, 'generic endpoint cannot bypass template validation: ' + url);
    ok((await J('/go/whatsapp/' + id, null, cookie)).status === 403, 'generic WhatsApp purchase handoff is guarded');
    ok((await J('/api/ivory-jasmine/draft', { id, data: d }, cookie, { origin: 'https://attacker.invalid' })).status === 403, 'cross-origin writes are rejected');

    // --- slugs
    j = await (await J('/api/ivory-jasmine/slug?s=create&id=' + id, null, cookie)).json();
    ok(!j.available && j.reason === 'reserved' && j.suggestions.length, 'reserved words are refused with suggestions');
    j = await (await J('/api/ivory-jasmine/slug?s=aarav-ananya&id=' + id, null, cookie)).json();
    ok(j.available, 'aarav-ananya is available');
    j = await (await J('/api/ivory-jasmine/slug?s=-bad--', null, cookie)).json();
    ok(!j.available && j.reason === 'format', 'badly formed links are refused');

    // --- uploads
    r = await fetch(base + '/api/ivory-jasmine/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/png' }, body: png(120, 90) });
    ok(r.status === 400 && (await r.json()).error === 'low_resolution', 'low-resolution photos are blocked');
    r = await fetch(base + '/api/ivory-jasmine/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/webp' }, body: fs.readFileSync(path.join(root, 'public/shaadi-paigaam/art/demo-1.webp')) });
    j = await r.json();
    ok(r.status === 200 && /^\/ivory-jasmine\/media\/[a-f0-9]{48}\.webp$/.test(j.url), 'a real photo uploads');
    const photoUrl = j.url;
    ok((await J(photoUrl)).status === 404, 'draft uploads are private to the owner');
    ok((await J(photoUrl, null, cookie)).status === 200, 'the owner can see their upload');
    r = await fetch(base + '/api/ivory-jasmine/upload?id=' + id + '&kind=photo', { method: 'POST', headers: { cookie, 'content-type': 'image/png' }, body: Buffer.from('not an image at all, just text pretending') });
    ok(r.status === 400, 'non-images are rejected by their bytes');
    r = await fetch(base + '/api/ivory-jasmine/upload?id=' + id + '&kind=music', { method: 'POST', headers: { cookie, 'content-type': 'audio/mpeg' }, body: fs.readFileSync(path.join(root, 'public/shaadi-paigaam/music/harp-garden.mp3')) });
    ok(r.status === 200, 'an MP3 song uploads');
    d.photos.unshift({ url: photoUrl, alt: 'Us', fx: 50, fy: 50 });
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);

    // --- independent cookies, media namespace and upload ownership
    ok(cookie.startsWith('ivory_jasmine_creator='), 'owner cookie has an independent template namespace');
    j = await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json();
    ok(j.data.photos.some(p => p.url === photoUrl), 'scoped uploaded photo survives shared-schema validation');
    const another = await J('/api/ivory-jasmine/draft', { data: sample() });
    const otherCookie = another.headers.get('set-cookie').split(';')[0], otherId = (await another.json()).id;
    const foreign = sample(); foreign.photos = [{ url: photoUrl, alt: 'Not mine' }]; foreign.couplePhoto = { url: photoUrl };
    await J('/api/ivory-jasmine/draft', { id: otherId, data: foreign }, otherCookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + otherId, null, otherCookie)).json();
    ok(!j.data.photos.length && !j.data.couplePhoto, 'another invitation cannot reuse private uploaded photos');
    ok((await J(photoUrl, null, otherCookie)).status === 404, 'another invitation cannot fetch private uploaded photos');
    const sharedDraft = await J('/api/shaadi-paigaam/draft', { data: sample() });
    const sharedCookie = sharedDraft.headers.get('set-cookie').split(';')[0], sharedId = (await sharedDraft.json()).id;
    ok((await J('/api/ivory-jasmine/me?id=' + sharedId, null, sharedCookie)).status === 404, 'Shaadi IDs and cookies do not grant Ivory access');
    ok((await J('/api/shaadi-paigaam/me?id=' + id, null, cookie)).status === 404, 'Ivory IDs do not grant Shaadi access');
    ok((await J(photoUrl.replace('/ivory-jasmine/', '/shaadi-paigaam/'), null, cookie)).status === 404, 'uploaded files cannot be fetched through the shared template media route');
    r = await fetch(base + '/api/shaadi-paigaam/upload?id=' + sharedId + '&kind=photo', { method: 'POST', headers: { cookie: sharedCookie, 'content-type': 'image/png' }, body: png(400, 400) });
    const sharedUrl = (await r.json()).url;
    ok(r.status === 200 && sharedUrl.startsWith('/shaadi-paigaam/media/'), 'existing Shaadi upload flow remains available');
    const invalidMedia = sample(); invalidMedia.photos = [{ url: sharedUrl }];
    await J('/api/ivory-jasmine/draft', { id: otherId, data: invalidMedia }, otherCookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + otherId, null, otherCookie)).json();
    ok(!j.data.photos.length, 'foreign template uploads are stripped even with their valid URL');
    r = await fetch(base + '/api/ivory-jasmine/upload?id=' + id + '&kind=music', { method: 'POST', headers: { cookie, 'content-type': 'audio/aac' }, body: Buffer.concat([Buffer.from([0xff, 0xf1]), Buffer.alloc(30)]) });
    const musicUrl = (await r.json()).url;
    ok(r.status === 200 && musicUrl.endsWith('.aac'), 'AAC upload uses the template-local namespace');
    d.music = { track: 'upload', url: musicUrl, title: 'Our song', rightsOk: true, startMuted: true };
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json();
    ok(j.data.music.url === musicUrl && j.data.music.track === 'upload', 'uploaded song survives save and reload');
    foreign.music = d.music;
    await J('/api/ivory-jasmine/draft', { id: otherId, data: foreign }, otherCookie);
    j = await (await J('/api/ivory-jasmine/me?id=' + otherId, null, otherCookie)).json();
    ok(!j.data.music.url, 'uploaded music cannot be claimed by another draft');
    ok(fs.existsSync(path.join(dir, 'ivory-jasmine-uploads', path.basename(photoUrl))) && !fs.existsSync(path.join(dir, 'shaadi-paigaam-uploads', path.basename(photoUrl))), 'disk upload directories are isolated');

    // --- publish: the organiser's WhatsApp destination is required when RSVP is on
    const organiserWa = d.rsvp.whatsapp;
    d.rsvp.whatsapp = '';
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);
    r = await J('/api/ivory-jasmine/publish', { id, slug: 'aarav-ananya', confirmed: true }, cookie); j = await r.json();
    ok(r.status === 422 && j.errors.some(e => e.path === 'rsvp.whatsapp'), 'server blocks publishing without the organiser WhatsApp number');
    d.rsvp.whatsapp = organiserWa;
    await J('/api/ivory-jasmine/draft', { id, data: d }, cookie);

    // --- publish: confirmation, payment, then free
    r = await J('/api/ivory-jasmine/publish', { id, slug: 'aarav-ananya' }, cookie);
    ok(r.status === 422, 'publishing needs the "I have checked" confirmation');
    r = await J('/api/ivory-jasmine/publish', { id, slug: 'aarav-ananya', confirmed: true }, cookie);
    j = await r.json();
    ok(r.status === 503 && j.error === 'payments_offline', 'a paid template asks for payment (offline here)');
    await stop();
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); db.prepare("UPDATE templates SET price=0 WHERE slug='ivory-jasmine'").run(); db.prepare("UPDATE paigaams SET status='draft' WHERE id=?").run(id); db.close(); }
    await start();
    r = await J('/api/ivory-jasmine/publish', { id, slug: 'aarav-ananya', confirmed: true }, cookie); j = await r.json();
    ok(r.status === 200 && j.url === base + '/aarav-ananya', 'free publish returns the short link');
    r = await J('/aarav-ananya'); html = await r.text();
    ok(r.status === 200 && html.includes('Aarav') && html.includes('og:image'), 'short link serves the wedding invitation');
    ok((await J(photoUrl)).status === 200, 'photos become public once published');
    r = await J('/p/aarav-ananya'); ok(r.status === 301 && r.headers.get('location') === '/aarav-ananya', '/p/<link> redirects to the short link');
    ok((await J('/no-such-couple')).status === 404, 'unknown short links fall through to the normal 404');
    ok((await J('/contact')).status === 200, 'existing routes are untouched');
    r = await J('/ivory-jasmine/card/' + id + '.jpg');
    ok([200, 503].includes(r.status), 'share card endpoint answers (' + r.status + (r.status === 503 ? ': sharp not installed here' : '') + ')');

    // --- a second customer cannot take the link
    r = await J('/api/ivory-jasmine/draft', { data: sample() }); const cookie2 = r.headers.get('set-cookie').split(';')[0]; const id2 = (await r.json()).id;
    j = await (await J('/api/ivory-jasmine/slug?s=aarav-ananya&id=' + id2, null, cookie2)).json();
    ok(!j.available && j.reason === 'taken' && j.suggestions.length >= 2, 'a taken link offers alternatives: ' + j.suggestions.join(', '));
    r = await J('/api/ivory-jasmine/publish', { id: id2, slug: 'aarav-ananya', confirmed: true }, cookie2);
    ok(r.status === 409, 'publishing onto a taken link is refused');

    // --- retired web RSVP: every legacy payload is rejected without guest storage
    const rs = (b, c) => J('/api/ivory-jasmine/rsvp/' + id, Object.assign({ t: 6000, lang: 'en' }, b), c);
    const rejected = async (response, message) => {
      assert.deepEqual(await response.json(), { error: 'whatsapp_only' });
      ok(response.status === 410 && response.headers.get('cache-control') === 'no-store', message);
    };
    await rejected(await rs({ name: 'Bot', email: 'bot@x.com', attending: 'yes', website: 'http://spam' }), 'honeypot cannot trigger a stored web RSVP');
    await rejected(await rs({ name: 'Fast', email: 'fast@x.com', attending: 'yes', t: 300 }), 'fast submissions return WhatsApp-only, not a silent success');
    await rejected(await rs({ name: 'Riya Shah', email: 'riya@example.com', attending: 'yes', guests: 3, meal: 'Jain', message: 'So happy!' }), 'valid guest information is rejected with whatsapp_only');
    await rejected(await rs({ name: 'Riya S', email: 'RIYA@example.com', attending: 'no' }), 'repeat emails cannot create web responses');
    await rejected(await rs({ name: 'Riya S', email: 'riya@example.com', attending: 'yes', guests: 99, confirmUpdate: true }), 'confirmUpdate cannot restore legacy storage');
    await rejected(await rs({ name: 'Kabir', phone: '98765 43210', attending: 'no' }), 'phone-only replies are WhatsApp-only');
    await rejected(await rs({ name: 'Owner', phone: '+919876543210', attending: 'yes' }, cookie), 'owner cookies cannot enable web RSVP storage');
    await rejected(await fetch(base + '/api/ivory-jasmine/rsvp/' + id, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid' }), 'retired endpoint does not parse guest payloads');
    // Draft/nonexistent/cross-origin callers get the same retirement response.
    for (const target of [id2, 'missing-invitation']) {
      r = await J('/api/ivory-jasmine/rsvp/' + target, { name: 'Not stored' }, null, { origin: 'https://attacker.invalid' });
      assert.equal(r.status, 410);
      assert.deepEqual(await r.json(), { error: 'whatsapp_only' });
    }
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); assert.equal(db.prepare('SELECT COUNT(*) n FROM ij_rsvps').get().n, 0, 'no web response exists for any invitation'); db.close(); }
    j = await (await J('/api/ivory-jasmine/rsvps?id=' + id, null, cookie)).json();
    ok(j.rows.length === 0 && j.totals.responses === 0 && j.totals.guests === 0, 'owner dashboard retains backward-compatible zero-response totals');
    ok((await J('/api/ivory-jasmine/rsvps?id=' + id, null, cookie2)).status === 404, "another customer cannot access even the empty guest list");
    r = await J('/ivory-jasmine/rsvps/' + id + '.csv', null, cookie); const csv = await r.text();
    ok(r.status === 200 && csv.includes('"Name","Attending"') && csv.trim().split('\r\n').length === 1, 'legacy CSV contains only its header, never guest info');

    // --- manage link on another device
    r = await J('/ivory-jasmine/manage/' + manageToken); const mc = r.headers.get('set-cookie').split(';')[0];
    ok(r.status === 303 && (await J('/api/ivory-jasmine/me?id=' + id, null, mc)).status === 200, 'the manage link opens the invitation on any device');

    // --- edit after publishing: pending → update live
    const d2 = (await (await J('/api/ivory-jasmine/me?id=' + id, null, cookie)).json()).data;
    d2.gifts = 'Only your blessings, please.';
    await J('/api/ivory-jasmine/draft', { id, data: d2 }, cookie);
    ok(!(await (await J('/aarav-ananya')).text()).includes('Only your blessings'), 'live page is unchanged while editing');
    r = await J('/api/ivory-jasmine/publish', { id, confirmed: true }, cookie); j = await r.json();
    ok(r.status === 200 && j.updated && j.url.endsWith('/aarav-ananya'), 'update goes live on the same link');
    ok((await (await J('/aarav-ananya')).text()).includes('Only your blessings'), 'the change is live');
    j = await (await J('/api/ivory-jasmine/versions?id=' + id, null, cookie)).json();
    ok(j.versions.length === 2, 'version history keeps each publish');
    r = await J('/api/ivory-jasmine/restore', { id, version: j.versions[1].id }, cookie);
    ok(r.status === 200 && !(await r.json()).data.gifts.includes('Only your'), 'an older version can be restored into the editor');

    // --- passcode gate
    d2.access.passcode = 'shaadi26';
    await J('/api/ivory-jasmine/draft', { id, data: d2 }, cookie);
    await J('/api/ivory-jasmine/publish', { id, confirmed: true }, cookie);
    html = await (await J('/aarav-ananya')).text();
    ok(html.includes('passcode') && !html.includes('Only your blessings'), 'a private invitation shows only the passcode gate');
    r = await fetch(base + '/ivory-jasmine/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=wrong' });
    ok(r.headers.get('location') === '/aarav-ananya?wrong=1', 'a wrong passcode is refused');
    r = await fetch(base + '/ivory-jasmine/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=shaadi26' });
    const pc = r.headers.get('set-cookie').split(';')[0];
    ok((await (await J('/aarav-ananya', null, pc)).text()).includes('Only your blessings'), 'the right passcode opens it');
    await rejected(await rs({ name: 'X', email: 'x@x.com', attending: 'yes' }), 'private invitations also reject web RSVP without collecting guest information');

    // --- expiry after the wedding
    await stop();
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); const row = db.prepare('SELECT customer_data FROM paigaams WHERE id=?').get(id); const cd = JSON.parse(row.customer_data); cd.wedding.date = '2024-01-10'; cd.access.expireDays = 7; cd.access.passcode = ''; db.prepare('UPDATE paigaams SET customer_data=? WHERE id=?').run(JSON.stringify(cd), id); db.close(); }
    await start();
    r = await J('/aarav-ananya'); html = await r.text();
    ok(r.status === 410, 'the invitation closes itself after the chosen days');
    r = await rs({ name: 'Expired', email: 'expired@example.com', attending: 'yes' });
    assert.equal(r.status, 410); assert.deepEqual(await r.json(), { error: 'whatsapp_only' });
    { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db')); assert.equal(db.prepare('SELECT COUNT(*) n FROM ij_rsvps').get().n, 0, 'still zero guest responses after private and expired attempts'); db.close(); }


    console.log(`\nPASS: ${passed} Ivory Jasmine checks.`);
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error('FAIL:', e.message); process.exitCode = 1; });
