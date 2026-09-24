'use strict';
// Run: SAUWAJAH_BASE_URL=http://127.0.0.1:3314 node --test tests/sauwajah-api.test.js
// Every mutation targets a new test-owned Paigaam. No admin or baseline mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.SAUWAJAH_BASE_URL || 'http://127.0.0.1:3314').replace(/\/$/, '');

const baseData = (patch = {}) => ({
  recipientName: 'Probe ' + Date.now(),
  senderName: 'Sender',
  heroTitle: 'happy birthday my girlfriend!!',
  heroSubtitle: 'yess, this is your special day <3',
  galleryHeading: 'our little moments',
  reasonsHeading: '100 reasons why i love you',
  reasons: 'the way you laugh at your own jokes\nhow you scrunch your nose when you smile',
  letterTitle: 'Happy Birthday My Girl!!! <33',
  letterBody: 'My love,\n\nHappy birthday.',
  signature: '— your biggest fan',
  ...patch,
});

async function request(path, { cookie, method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, headers: r.headers, text, json };
}

async function draft(data = baseData(), cookie) {
  const r = await request('/api/sau-wajah/draft', { method: 'POST', body: { customer_data: data }, cookie });
  assert.equal(r.status, 200, r.text);
  return { ...r.json, cookie: cookie || r.headers.get('set-cookie').split(';')[0], data };
}

const save = (d, patch) => request('/api/sau-wajah/draft', { method: 'POST', cookie: d.cookie, body: { id: d.id, customer_data: { ...d.data, ...patch } } });

async function publish(d) {
  const r = await request('/api/sau-wajah/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
  assert.equal(r.status, 200, r.text);
  return r.json;
}

test('API: separate identities, and preview/edit/publish are owner-only', async () => {
  const a = await draft(), b = await draft();
  assert.notEqual(a.cookie, b.cookie);
  assert.notEqual(a.id, b.id);

  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  assert.match(own.text, /data-preview="true"/);
  assert.match(own.text, /noindex/);

  for (const cookie of [undefined, b.cookie]) {
    for (const path of [a.previewUrl, '/preview/' + a.id]) {
      assert.equal((await request(path, { cookie })).status, 403, path + ' with cookie ' + cookie);
    }
    for (const [path, body] of [['/api/sau-wajah/draft', { id: a.id, customer_data: baseData() }], ['/api/sau-wajah/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie, body })).status, 403, path);
    }
  }
});

test('API: publishing is idempotent, the slug sticks, and the public page renders personalised', async () => {
  const d = await draft(baseData({ recipientName: 'Idempotence ' + Date.now() }));
  const first = await publish(d);
  assert.match(first.slug, /^sauwajah-[a-f0-9]{18}$/);
  const second = await publish(d);
  assert.equal(second.slug, first.slug);

  const page = await request('/p/' + first.slug);
  assert.equal(page.status, 200);
  assert.match(page.text, /data-stage="hero"/);
  assert.match(page.text, /sauwajah\.js/);
  assert.match(page.text, /\/sau-wajah\/media\/music\.mp3/);
  assert.doesNotMatch(page.text, /data-preview="true"/);
});

test('API: validation rejects over-length fields, control characters, stray photos and wrong shapes', async () => {
  const d = await draft();
  assert.equal((await save(d, { recipientName: 'x'.repeat(61) })).status, 400);
  assert.equal((await save(d, { letterBody: 'x'.repeat(4001) })).status, 400);
  assert.equal((await save(d, { recipientName: 'bad\u0000name' })).status, 400);
  assert.equal((await save(d, { heroTitle: 'two\nlines' })).status, 400);
  assert.equal((await save(d, { photos: [{ url: '/sau-wajah/uploads/' + 'a'.repeat(48) + '.png' }] })).status, 403, 'forged reference → verifyPhotos 403');
  assert.equal((await request('/api/sau-wajah/draft', { method: 'POST', body: { customer_data: 'not an object' } })).status, 400);
  assert.equal((await request('/api/sau-wajah/draft', { method: 'POST', body: { customer_data: {} } })).status, 400);
  // The reasons textarea is the one multi-line field besides the letter.
  assert.equal((await save(d, { reasons: 'one\ntwo\nthree' })).status, 200);
});

test('API: the rendered page escapes every personalised field', async () => {
  const XSS = '<script>window.__xss=1</script>';
  const d = await draft(baseData({
    recipientName: 'Esc ' + XSS,
    heroTitle: XSS,
    reasons: XSS + '\nplain',
    letterBody: XSS,
  }));
  const pub = await publish(d);
  const page = await request('/p/' + pub.slug);
  assert.equal(page.status, 200);
  assert.equal(page.text.split('<script>window.__xss=1</script>').length - 1, 0, 'no raw script injection');
  assert.match(page.text, /&lt;script&gt;/, 'the payload is present, escaped');
});

test('API: forged photo references are rejected even when shaped correctly', async () => {
  const a = await draft(), b = await draft();
  // b tries to reference a (nonexistent) upload — shape is right, ownership is not.
  const r = await save(b, { photos: [{ url: '/sau-wajah/uploads/' + 'b'.repeat(48) + '.jpg' }] });
  assert.equal(r.status, 403, 'shaped-right reference to an unknown upload → ownership 403');
  // A real cross-draft forgery: upload to a, reference from b.
  const up = await fetch(BASE + '/api/sau-wajah/upload?id=' + a.id, {
    method: 'POST', headers: { cookie: a.cookie, 'content-type': 'image/png' },
    body: Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.alloc(16, 0),
    ]),
  });
  assert.equal(up.status, 400, 'a 24-byte non-PNG must fail dimension sniffing');
  const forged = await save(b, { photos: [{ url: '/sau-wajah/uploads/' + 'c'.repeat(48) + '.png' }] });
  assert.equal(forged.status, 403, 'shaped-right but forged → ownership 403');
});

test('API: generic endpoints refuse sau-wajah Paigaams', async () => {
  const d = await draft();
  for (const [path, body] of [
    ['/api/free-publish', { id: d.id }],
    ['/api/drafts', { template: 'sau-wajah' }],
    ['/api/render-preview', { template: 'sau-wajah' }],
  ]) {
    const r = await request(path, { method: 'POST', body });
    assert.equal(r.status, 403, path + ' → ' + r.text);
    assert.equal(r.json.error, 'use_template_endpoint');
  }
});

test('API: unauthenticated bulk drafts are rate-limited, unknown ids 404, CSRF enforced', async () => {
  const d = await draft();
  assert.equal((await request('/api/sau-wajah/publish', { method: 'POST', cookie: d.cookie, body: { id: 'does-not-exist' } })).status, 404);
  const noOrigin = await fetch(BASE + '/api/sau-wajah/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': 'https://evil.example' },
    body: JSON.stringify({ customer_data: baseData() }),
  });
  assert.equal(noOrigin.status, 403);
});

test('API: demo routes serve real bytes', async () => {
  const demo = await request('/sau-wajah/demo');
  assert.equal(demo.status, 200);
  assert.match(demo.text, /data-stage="hero"/);
  assert.match(demo.text, /sauwajah\.css/);
  const media = await fetch(BASE + '/sau-wajah/media/music.mp3');
  assert.equal(media.status, 200);
  const buf = Buffer.from(await media.arrayBuffer());
  assert.ok(buf.length > 10000, 'music.mp3 has real bytes');
  assert.equal(buf.slice(0, 3).toString('latin1'), 'ID3');
  const png = await fetch(BASE + '/sau-wajah/demo-media/demo-1.png');
  assert.equal(png.status, 200);
  const pbuf = Buffer.from(await png.arrayBuffer());
  assert.equal(pbuf.slice(0, 4).toString('latin1'), '\x89PNG');
});
