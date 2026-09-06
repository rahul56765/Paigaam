'use strict';
// Run: LAVENDER_BASE_URL=http://127.0.0.1:3312 node --test tests/lavender-api.test.js
// Every mutation targets a new test-owned surprise. No admin or baseline mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.LAVENDER_BASE_URL || 'http://127.0.0.1:3312').replace(/\/$/, '');

const baseData = (patch = {}) => ({
  recipientName: 'Probe ' + Date.now(),
  senderName: 'Sender',
  title: 'For You!',
  message: 'Because you make every day as bright as a blooming flower.',
  flowerColor: 'lavender',
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
  const r = await request('/api/lavender-bloom/draft', { method: 'POST', body: { customer_data: data }, cookie });
  assert.equal(r.status, 200, r.text);
  return { ...r.json, cookie: cookie || r.headers.get('set-cookie').split(';')[0], data };
}

const save = (d, patch) => request('/api/lavender-bloom/draft', { method: 'POST', cookie: d.cookie, body: { id: d.id, customer_data: { ...d.data, ...patch } } });

async function publish(d) {
  const r = await request('/api/lavender-bloom/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
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
    for (const [path, body] of [['/api/lavender-bloom/draft', { id: a.id, customer_data: baseData() }], ['/api/lavender-bloom/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie, body })).status, 403, path);
    }
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await draft();
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/lavender-bloom/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Lavender Bloom surprise', async () => {
  const a = await draft();
  for (const body of [
    { template: 'lavender-tic-tac-toe-bloom', customer_data: a.data },
    { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } },
  ]) {
    assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
  }
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'lavender-tic-tac-toe-bloom', customer_data: a.data } })).status, 403);

  const after = await request(a.previewUrl, { cookie: a.cookie });
  assert.match(after.text, new RegExp(a.data.recipientName));
  assert.doesNotMatch(after.text, /OVERWRITE/);
});

test('API: validation rejects bad shapes, lengths, newlines and control characters', async () => {
  const invalid = [
    ['missing data', undefined],
    ['null data', null],
    ['array data', []],
    ['missing name', baseData({ recipientName: '' })],
    ['blank name', baseData({ recipientName: '   ' })],
    ['wrong field type', baseData({ senderName: 123 })],
    ['control character', baseData({ title: 'bad' })],
    ['newline in a one-line field', baseData({ title: 'two\nlines' })],
    ['overlong message', baseData({ message: 'x'.repeat(401) })],
    ['overlong name', baseData({ recipientName: 'x'.repeat(61) })],
  ];
  for (const [label, customer_data] of invalid) {
    const r = await request('/api/lavender-bloom/draft', { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
    assert.equal(r.status, 400, label);
    assert.equal(r.json.error, 'validation', label);
  }
});

test('API: unknown fields are dropped and an unknown flower colour falls back to lavender', async () => {
  const a = await draft(baseData({ flowerColor: 'neon-green', hackerField: '<script>alert(1)</script>' }));
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  assert.doesNotMatch(own.text, /hackerField/);
  assert.doesNotMatch(own.text, /neon-green/);
  assert.match(own.text, /data-color="lavender"/);
});

test('API: publish is idempotent and slugs are lavender-*', async () => {
  const a = await draft();
  const first = await publish(a);
  assert.match(first.slug, /^lavender-[a-f0-9]{18}$/);
  assert.equal(first.url, BASE + '/p/' + first.slug);

  const second = await publish(a);
  assert.deepEqual(second, first);

  // Once published, the draft can no longer be edited.
  assert.equal((await save(a, { title: 'CHANGED' })).status, 403);

  const live = await request('/p/' + first.slug);
  assert.equal(live.status, 200);
  assert.match(live.text, new RegExp(a.data.recipientName));
  assert.match(live.text, /Open when you miss me/);
  assert.match(live.text, /Win for a surprise!/);
  assert.match(live.text, /TAP TO OPEN!/);
});

test('API: stranger cannot publish, missing ids 404', async () => {
  const a = await draft(), b = await draft();
  assert.equal((await request('/api/lavender-bloom/publish', { method: 'POST', cookie: b.cookie, body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/lavender-bloom/publish', { method: 'POST', cookie: a.cookie, body: { id: 'nope123' } })).status, 404);
  assert.equal((await request('/lavender-bloom/preview/nope123', { cookie: a.cookie })).status, 404);
});

test('Pages: demo, generator, template-view and detail all render', async () => {
  const demo = await request('/lavender-bloom/demo');
  assert.equal(demo.status, 200);
  assert.match(demo.text, /data-stage="envelope"/);
  assert.match(demo.text, /data-stage="game"/);
  assert.match(demo.text, /data-stage="gift"/);
  assert.match(demo.text, /data-stage="bloom"/);
  assert.match(demo.text, /Open when you miss me/);

  const create = await request('/create/lavender-tic-tac-toe-bloom');
  assert.equal(create.status, 200);
  assert.match(create.text, /lavenderForm/);

  const view = await request('/template-view/lavender-tic-tac-toe-bloom');
  assert.equal(view.status, 200);
  assert.match(view.text, /lb-stage/);

  const detail = await request('/templates/lavender-tic-tac-toe-bloom');
  assert.equal(detail.status, 200);
  assert.match(detail.text, /lavender-bloom\/demo/);
});

test('Assets: the four public files are served with the right types', async () => {
  for (const [path, type] of [
    ['/lavender-bloom/bloom.css', /text\/css/],
    ['/lavender-bloom/bloom.js', /javascript/],
    ['/lavender-bloom/create.css', /text\/css/],
    ['/lavender-bloom/create.js', /javascript/],
  ]) {
    const r = await request(path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get('content-type'), type, path);
  }
});

test('Render: personalisation lands in the document, escaped', async () => {
  const data = baseData({
    recipientName: 'Asha <b>bold</b>',
    title: 'To the moon 🌙',
    message: 'Line one\nLine two <script>alert(1)</script>',
    flowerColor: 'rose',
  });
  const a = await draft(data);
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  // Name is escaped everywhere it appears.
  assert.doesNotMatch(own.text, /<b>bold<\/b>/);
  assert.match(own.text, /Asha &lt;b&gt;bold&lt;\/b&gt;/);
  // The script in the message is neutralised, the newline kept.
  assert.doesNotMatch(own.text, /<script>alert\(1\)<\/script>/);
  assert.match(own.text, /Line one\nLine two/);
  // Rose palette applied to the title ink.
  assert.match(own.text, /#D14D6E/);
  assert.match(own.text, /data-color="rose"/);
});

test('Render: the untouched form produces the designed surprise', async () => {
  const r = await request('/api/lavender-bloom/draft', { method: 'POST', body: { customer_data: { recipientName: 'Only Name' } } });
  assert.equal(r.status, 200);
  const { previewUrl } = r.json;
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const own = await request(previewUrl, { cookie });
  assert.match(own.text, /For You!/);
  assert.match(own.text, /Because you make every day as bright as a blooming flower\. I miss you more than words can say!/);
  assert.match(own.text, /data-color="lavender"/);
});
