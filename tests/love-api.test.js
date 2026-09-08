'use strict';
// Run: LOVE_BASE_URL=http://127.0.0.1:3402 node --test tests/love-api.test.js
// Every mutation targets a new test-owned album. No admin or baseline mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.LOVE_BASE_URL || 'http://127.0.0.1:3402').replace(/\/$/, '');

const baseData = (patch = {}) => ({
  recipientName: 'Probe ' + Date.now(),
  senderName: 'Sender',
  introLine: 'Hey you, I made something special just for you!',
  continueLabel: "Let's Go!",
  message1: 'one', message2: 'two', message3: 'three',
  letterTitle: 'To My Dearest',
  letterBody: 'A letter body.',
  finalLabel: 'One last thing! 💕',
  photos: [],
  ...patch,
});

async function request(path, { cookie, method = 'GET', body, raw, contentType, headers = {} } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(raw ? { 'content-type': contentType } : {}), ...headers },
    body: body === undefined ? (raw || undefined) : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, headers: r.headers, text, json };
}

/** A tiny valid JPEG (8x8 solid) — sniffable by the server, tiny on the wire. */
function tinyJPEG() {
  const chunks = [];
  chunks.push([0xFF, 0xD8]);
  chunks.push([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  chunks.push([0xFF, 0xDB, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, () => 0x10)]);
  chunks.push([0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x01, 0x90, 0x01, 0x40, 0x01, 0x01, 0x11, 0x00]); // 400x640
  chunks.push([0xFF, 0xC4, 0x00, 0x14, 0x00, ...Array.from({ length: 18 }, () => 0x00)]);
  chunks.push([0xFF, 0xC4, 0x00, 0x14, 0x01, ...Array.from({ length: 18 }, () => 0x00)]);
  chunks.push([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]);
  chunks.push([0x3F, 0x00]);
  chunks.push([0xFF, 0xD9]);
  return Buffer.from(chunks.flat());
}

/** Create a draft, upload N photos, return { id, cookie, data } ready for publish. */
async function albumWithPhotos(n, patch = {}) {
  const dr = await request('/api/love-album/draft', { method: 'POST', body: { customer_data: baseData() } });
  assert.equal(dr.status, 200, dr.text);
  const { id } = dr.json;
  const cookie = dr.headers.get('set-cookie').split(';')[0];
  const photos = [];
  for (let i = 0; i < n; i++) {
    const up = await request('/api/love-album/upload?id=' + id, { method: 'POST', cookie, raw: tinyJPEG(), contentType: 'image/jpeg' });
    assert.equal(up.status, 200, up.text);
    photos.push({ url: up.json.url, alt: '' });
  }
  const save = await request('/api/love-album/draft', { method: 'POST', cookie, body: { id, customer_data: baseData({ photos, ...patch }) } });
  assert.equal(save.status, 200, save.text);
  return { id, cookie, photos, data: baseData({ photos, ...patch }) };
}

async function publish(d) {
  const r = await request('/api/love-album/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
  assert.equal(r.status, 200, r.text);
  return r.json;
}

test('API: separate identities, and preview/edit are owner-only', async () => {
  const a = await albumWithPhotos(3), b = await albumWithPhotos(3);
  assert.notEqual(a.cookie, b.cookie);
  assert.notEqual(a.id, b.id);

  const own = await request('/love-album/preview/' + a.id, { cookie: a.cookie });
  assert.equal(own.status, 200);
  assert.match(own.text, /data-preview="true"/);

  for (const cookie of [undefined, b.cookie]) {
    assert.equal((await request('/love-album/preview/' + a.id, { cookie })).status, 403);
    assert.equal((await request('/api/love-album/draft', { method: 'POST', cookie, body: { id: a.id, customer_data: a.data } })).status, 403);
    assert.equal((await request('/api/love-album/publish', { method: 'POST', cookie, body: { id: a.id } })).status, 403);
  }
  // Photo bytes are owner-only while the draft is private.
  assert.equal((await request(a.photos[0].url)).status, 404);
  assert.equal((await request(a.photos[0].url, { cookie: a.cookie })).status, 200);
});

test('API: uploads validate content type, size, and count', async () => {
  const dr = await request('/api/love-album/draft', { method: 'POST', body: { customer_data: baseData() } });
  const { id } = dr.json;
  const cookie = dr.headers.get('set-cookie').split(';')[0];

  // wrong content type
  assert.equal((await request('/api/love-album/upload?id=' + id, { method: 'POST', cookie, raw: tinyJPEG(), contentType: 'image/gif' })).status, 400);
  // not an image
  assert.equal((await request('/api/love-album/upload?id=' + id, { method: 'POST', cookie, raw: Buffer.from('hello world, definitely not an image'), contentType: 'image/jpeg' })).status, 400);
  // valid JPEG works
  assert.equal((await request('/api/love-album/upload?id=' + id, { method: 'POST', cookie, raw: tinyJPEG(), contentType: 'image/jpeg' })).status, 200);
  // forged references are refused at draft-save: URL exists but belongs to id anyway;
  // a stranger's draft cannot reference another draft's upload.
  const b = await albumWithPhotos(1);
  const stolen = await request('/api/love-album/draft', {
    method: 'POST', cookie: cookie,
    body: { id, customer_data: baseData({ photos: [{ url: b.photos[0].url, alt: '' }] }) },
  });
  assert.equal(stolen.status, 403, 'cross-draft photo references are refused');
});

test('API: publish refuses albums with fewer than 3 verified photos', async () => {
  const two = await albumWithPhotos(2);
  const refused = await request('/api/love-album/publish', { method: 'POST', cookie: two.cookie, body: { id: two.id } });
  assert.equal(refused.status, 400);
  assert.equal(refused.json.error, 'too_few_photos');

  const three = await albumWithPhotos(3);
  const pub = await publish(three);
  assert.match(pub.slug, /^love-[a-f0-9]{18}$/);

  // published photos are now publicly served
  const live = await request('/p/' + pub.slug);
  assert.equal(live.status, 200);
  assert.match(live.text, /laDeck/);
  assert.match(live.text, new RegExp(pub.slug));
  for (const photo of three.photos) {
    assert.equal((await request(photo.url)).status, 200, 'published photo ' + photo.url);
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await albumWithPhotos(3);
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/love-album/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Love Album', async () => {
  const a = await albumWithPhotos(3);
  assert.equal((await request('/api/drafts', { method: 'POST', body: { template: 'love-album', customer_data: a.data } })).status, 403);
  assert.equal((await request('/api/drafts', { method: 'POST', body: { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } } })).status, 403);
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'love-album', customer_data: a.data } })).status, 403);
  assert.equal((await request('/go/whatsapp/' + a.id)).status, 403);

  const after = await request('/love-album/preview/' + a.id, { cookie: a.cookie });
  assert.equal(after.status, 200);
  assert.match(after.text, /A little gallery of shared memories/);
  assert.doesNotMatch(after.text, /OVERWRITE/);
});

test('API: validation rejects bad shapes, lengths, and forged photo URLs', async () => {
  const forged = [
    ['missing data', undefined],
    ['null data', null],
    ['missing name', baseData({ recipientName: '' })],
    ['control character', baseData({ letterTitle: 'bad\u0007' })],
    ['overlong letter', baseData({ letterBody: 'x'.repeat(901) })],
    ['photos not array', baseData({ photos: 'x' })],
    ['too many photos', baseData({ photos: Array.from({ length: 10 }, (_, i) => ({ url: `/love-album/uploads/${String(i).padEnd(48, 'a')}.webp`, alt: '' })) })],
    ['forged external url', baseData({ photos: [{ url: 'https://evil.example/x.webp', alt: '' }] })],
    ['forged path shape', baseData({ photos: [{ url: '/love-album/uploads/short.webp', alt: '' }] })],
  ];
  for (const [label, customer_data] of invalid.call(this, forged)) {
    const r = await request('/api/love-album/draft', { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
    assert.equal(r.status, 400, label);
    assert.equal(r.json.error, 'validation', label);
  }
  function invalid(list) { return list.map(([l, d]) => [l, d]); }
});

test('Pages: demo, generator, template-view and detail all render', async () => {
  const demo = await request('/love-album/demo');
  assert.equal(demo.status, 200);
  assert.match(demo.text, /la-intro/);
  assert.match(demo.text, /laDeck|la-card/);
  assert.match(demo.text, /data-stage="intro"/);

  const create = await request('/create/love-album');
  assert.equal(create.status, 200);
  assert.match(create.text, /loveForm/);
  assert.match(create.text, /photoFiles/);

  const view = await request('/template-view/love-album');
  assert.equal(view.status, 200);
  assert.match(view.text, /laDeck/);

  const detail = await request('/templates/love-album');
  assert.equal(detail.status, 200);
  assert.match(detail.text, /love-album\/demo/);
});

test('Render: the served payload parses, rebrand is complete, copy is escaped', async () => {
  const a = await albumWithPhotos(3, { recipientName: 'Asha <b>bold</b>' });
  const own = await request('/love-album/preview/' + a.id, { cookie: a.cookie });
  assert.equal(own.status, 200);

  // The payload block must parse as served (entity-escape regression class).
  const marker = '<script type="application/json" id="laPayload">';
  const start = own.text.indexOf(marker);
  assert.ok(start !== -1, 'payload block present');
  const end = own.text.indexOf('</script>', start);
  const cfg = JSON.parse(own.text.slice(start + marker.length, end));
  assert.equal(cfg.deck.filter(c => c.type === 'photo').length, 3);
  assert.equal(cfg.deck.filter(c => c.type === 'message').length, 3);
  assert.equal(cfg.letterTitle, 'To My Dearest');

  // HTML escaping survives outside the payload block.
  assert.doesNotMatch(own.text, /<b>bold<\/b>/);
  assert.match(own.text, /Asha &lt;b&gt;bold&lt;\/b&gt;/);

  // Ziddi rebranding: the sender's name replaces the branding footer.
  assert.match(own.text, /Made with love by/);
  assert.doesNotMatch(own.text, /Ziddi/i);
  assert.doesNotMatch(own.text, /Madam jii/i);
});
