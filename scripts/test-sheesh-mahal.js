'use strict';
// Disposable integration server/data; never reads or modifies a real creator's data.
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const C = require('../public/sheesh-mahal/core');
const root = path.join(__dirname, '..');
const clone = d => JSON.parse(JSON.stringify(d));
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
function sample() {
  const d = clone(C.SAMPLE);
  d.wedding.date = day(90); d.rsvp.deadline = day(80); d.lang = { base: 'en', default: 'en', enabled: ['en'] }; d.i18n = {};
  d.events = Array.from({ length: 20 }, (_, i) => ({ id: 'event-' + i, type: i ? 'custom' : 'wedding', name: i ? 'Function ' + i : 'Wedding', date: day(90 + i), start: '18:00', end: '', venue: 'Palace ' + i, address: 'Jaipur', note: 'Welcome', dress: 'Jewel tones', main: i === 0 }));
  return d;
}
(async () => {
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const base = 'http://127.0.0.1:' + port, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-sheesh-test-'));
  let server, passed = 0;
  const ok = (v, m) => { assert.ok(v, m); passed++; console.log('  ✓ ' + m); };
  const request = (url, data, cookie = '', extra = {}) => fetch(base + url, { redirect: 'manual', method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
  const api = (p, data, cookie, extra) => request('/api/sheesh-mahal/' + p, data, cookie, extra);
  async function save(data, cookie, id) {
    const r = await api('draft', { data, ...(id ? { id } : {}) }, cookie);
    assert.equal(r.status, 200); return { response: r, ...(await r.json()) };
  }
  try {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, DATA_DIR: dir, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; server.stderr.on('data', b => { output += b.toString(); });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Startup timeout: ' + output)), 30000);
      server.stdout.on('data', b => { output += b; if (output.includes('admin →')) { clearTimeout(t); resolve(); } });
      server.on('exit', code => { clearTimeout(t); reject(new Error('Server exited ' + code + ': ' + output)); });
    });
    ok((await request('/create/sheesh-mahal')).status === 200, 'isolated editor is registered');
    const editor = await (await request('/sheesh-mahal/editor.js')).text();
    ok(editor.includes("const STORE = 'sm-ed'") && !editor.includes('Download CSV'), 'editor device data is isolated and no guest-storage dashboard remains');
    ok((await request('/sheesh-mahal/demo')).status === 200 && (await request('/template-view/sheesh-mahal')).status === 200 && (await request('/templates/sheesh-mahal')).status === 200, 'demo, detail and gallery routes render');
    for (const asset of ['sunset.webp', 'night.webp', 'three.min.js', 'sheesh.css', 'core.js']) ok((await request('/sheesh-mahal/' + asset)).status === 200, 'static asset served: ' + asset);
    ok(C.LIMITS.events === 20 && C.validate(sample()).data.events.length === 20, 'twenty functions are retained');
    const invalid = sample(); invalid.photos = [{ url: '/shaadi-paigaam/media/' + 'a'.repeat(48) + '.jpg' }]; invalid.music = { track: 'shehnai-dawn', url: '/suvarna-vivah/music/shehnai-dawn.mp3' };
    const cleaned = C.validate(invalid).data;
    ok(!cleaned.photos.length && cleaned.music.track === 'none' && !cleaned.music.url && C.MUSIC.length === 0, 'foreign media and built-in music are rejected');
    let d = sample(), a = await save(d);
    const id = a.id, cookie = a.response.headers.get('set-cookie').split(';')[0];
    ok(cookie.startsWith('sheesh_mahal_creator='), 'owner cookie has its own namespace');
    ok((await api('me?id=' + id)).status === 404 && (await api('draft', { id, data: d })).status === 403, 'draft cannot be read or edited by a stranger');
    ok((await request('/sheesh-mahal/preview/' + id)).status === 403 && (await request('/preview/' + id)).status === 403, 'both owner-preview paths deny strangers');
    ok((await api('draft', { data: d }, '', { origin: 'https://evil.invalid' })).status === 403, 'cross-origin writes are denied');
    for (const [p, body] of [['/api/free-publish', { id }], ['/api/drafts', { id, template: 'sheesh-mahal', customer_data: d }], ['/api/render-preview', { template: 'sheesh-mahal' }], ['/api/razorpay/order', { id }]]) ok((await request(p, body, cookie)).status === 403, 'generic endpoint cannot bypass template: ' + p);
    ok((await api('publish', { id, slug: 'our-sheesh-wedding', confirmed: true }, cookie)).status === 422, 'publish requires creator WhatsApp');
    d.sections.rsvp = false; await save(d, cookie, id);
    ok((await api('publish', { id, slug: 'our-sheesh-wedding', confirmed: true }, cookie)).status === 422, 'creator WhatsApp is required even when RSVP is hidden');
    d.sections.rsvp = true; d.rsvp.whatsapp = '9876543210'; await save(d, cookie, id);
    const yes = C.whatsappRsvpLink(d, 'yes', 'en'), no = C.whatsappRsvpLink(d, 'no', 'en');
    ok(yes.startsWith('https://wa.me/919876543210?text=') && no !== yes, 'yes/no RSVP links target the creator number');
    // Upload-only music with a sniffable MP3 header.
    const audio = Buffer.alloc(64); audio.write('ID3');
    const upload = async (owner, target = id) => fetch(base + '/api/sheesh-mahal/upload?id=' + target + '&kind=music', { method: 'POST', headers: { 'content-type': 'audio/mpeg', cookie: owner }, body: audio });
    let r = await upload(cookie), media = (await r.json()).url;
    ok(r.status === 200 && media.startsWith('/sheesh-mahal/media/'), 'upload is scoped to Sheesh Mahal');
    ok((await request(media)).status === 404 && (await request(media, undefined, cookie)).status === 200, 'draft media is owner-only');
    const b = await save(sample()); const cookieB = b.response.headers.get('set-cookie').split(';')[0];
    ok((await upload(cookieB)).status === 403, 'another creator cannot upload to this invitation');
    const foreign = sample(); foreign.music = { track: 'upload', url: media, rightsOk: true };
    await save(foreign, cookieB, b.id);
    const other = await (await api('me?id=' + b.id, undefined, cookieB)).json();
    ok(other.data.music.track === 'none' && !other.data.music.url, 'foreign owned upload is stripped from another draft');
    d.music = { track: 'upload', url: media, title: 'Our song', rightsOk: true }; await save(d, cookie, id);
    r = await api('publish', { id, slug: 'our-sheesh-wedding', confirmed: false }, cookie);
    ok(r.status === 422, 'explicit details confirmation is required');
    r = await api('publish', { id, slug: 'our-sheesh-wedding', confirmed: true }, cookie);
    ok(r.status === 200 && (await r.json()).slug === 'our-sheesh-wedding', 'free publish returns chosen short link');
    ok((await request('/our-sheesh-wedding')).status === 200 && (await request('/p/our-sheesh-wedding')).status === 301, 'published short link and legacy redirect work');
    ok((await request(media)).status === 200, 'unprotected published upload becomes public');
    ok((await api('rsvp/' + id, { name: 'Guest', attending: 'yes' })).status === 404, 'guest-response POST is absent');
    const replies = await (await api('rsvps?id=' + id, undefined, cookie)).json();
    ok(replies.whatsappOnly && replies.rows.length === 0, 'no guest records are exposed or stored');
    d.couple.groom.first = 'Vihaan'; await save(d, cookie, id);
    ok(!(await (await request('/our-sheesh-wedding')).text()).includes('Vihaan'), 'live edits stay pending until publish');
    r = await api('publish', { id, confirmed: true }, cookie);
    ok(r.status === 200 && (await (await request('/our-sheesh-wedding')).text()).includes('Vihaan'), 'live update preserves URL');
    const versions = await (await api('versions?id=' + id, undefined, cookie)).json();
    ok(versions.versions.length >= 2 && (await api('restore', { id, version: versions.versions.at(-1).id }, cookie)).status === 200, 'version history and restore work');
    await save(d, cookie, id); d.access.passcode = 'palace2026'; await save(d, cookie, id); await api('publish', { id, confirmed: true }, cookie);
    ok(!(await (await request('/our-sheesh-wedding')).text()).includes('sm-data'), 'passcode gate withholds guest payload');
    ok((await request(media, undefined, 'sm_pass_' + id + '=forged')).status === 404, 'forged pass cookie cannot disclose uploaded media');
    ok((await request('/sheesh-mahal/card/' + id + '.jpg')).status === 404, 'passcode-protected share card is private');
    r = await fetch(base + '/sheesh-mahal/unlock/' + id, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passcode=palace2026' });
    const passCookie = r.headers.get('set-cookie').split(';')[0];
    ok(r.status === 303 && (await request(media, undefined, passCookie)).status === 200, 'correct passcode unlocks media');
    const guestHtml = await (await request('/our-sheesh-wedding', undefined, passCookie)).text();
    ok(guestHtml.includes('sm-data') && !guestHtml.includes('palace2026'), 'unlocked guest HTML does not expose passcode');
    r = await request(new URL(a.manageUrl).pathname); const manageCookie = r.headers.get('set-cookie').split(';')[0];
    ok(r.status === 303 && manageCookie.startsWith('sm_m_') && (await api('me?id=' + id, undefined, manageCookie)).status === 200, 'manage link grants isolated owner access');
    const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(path.join(dir, 'paigaam.db'));
    ok(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sm_rsvps'").get(), 'there is no Sheesh Mahal guest RSVP table');
    db.prepare("UPDATE templates SET price=100 WHERE slug='sheesh-mahal'").run(); db.close();
    const paid = sample(); paid.rsvp.whatsapp = '+919876543210'; const pa = await save(paid, cookie);
    ok((await api('publish', { id: pa.id, slug: 'paid-sheesh-test', confirmed: true }, cookie)).status === 503, 'paid publish fails safely when payment gateway is offline');
    console.log('\nPASS: ' + passed + ' Sheesh Mahal checks.');
  } finally {
    if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
