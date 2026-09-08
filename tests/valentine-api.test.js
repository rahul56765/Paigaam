'use strict';
// Run: VALENTINE_BASE_URL=http://127.0.0.1:3313 node --test tests/valentine-api.test.js
// Every mutation targets a new test-owned question. No admin or baseline mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.VALENTINE_BASE_URL || 'http://127.0.0.1:3313').replace(/\/$/, '');

const baseData = (patch = {}) => ({
  recipientName: 'Probe ' + Date.now(),
  senderName: 'Sender',
  question: 'Will you be my Valentine?',
  yesLabel: 'Yes',
  noLabel: 'No',
  celebration: 'Yayyy!! :3',
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
  const r = await request('/api/valentine-say-yes/draft', { method: 'POST', body: { customer_data: data }, cookie });
  assert.equal(r.status, 200, r.text);
  return { ...r.json, cookie: cookie || r.headers.get('set-cookie').split(';')[0], data };
}

const save = (d, patch) => request('/api/valentine-say-yes/draft', { method: 'POST', cookie: d.cookie, body: { id: d.id, customer_data: { ...d.data, ...patch } } });

async function publish(d) {
  const r = await request('/api/valentine-say-yes/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
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
    for (const [path, body] of [['/api/valentine-say-yes/draft', { id: a.id, customer_data: baseData() }], ['/api/valentine-say-yes/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie, body })).status, 403, path);
    }
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await draft();
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/valentine-say-yes/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Valentine question', async () => {
  const a = await draft();
  for (const body of [
    { template: 'valentine-say-yes', customer_data: a.data },
    { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } },
  ]) {
    assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
  }
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'valentine-say-yes', customer_data: a.data } })).status, 403);
  // The WhatsApp handoff is refused for this template: it publishes free, so
  // there is nothing to purchase.
  assert.equal((await request('/go/whatsapp/' + a.id)).status, 403);

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
    ['control character', baseData({ question: 'bad\u0007' })],
    ['newline in a one-line field', baseData({ question: 'two\nlines' })],
    ['overlong question', baseData({ question: 'x'.repeat(121) })],
    ['overlong name', baseData({ recipientName: 'x'.repeat(61) })],
    ['overlong button label', baseData({ yesLabel: 'x'.repeat(25) })],
  ];
  for (const [label, customer_data] of invalid) {
    const r = await request('/api/valentine-say-yes/draft', { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
    assert.equal(r.status, 400, label);
    assert.equal(r.json.error, 'validation', label);
  }
});

test('API: unknown fields are dropped, never stored', async () => {
  const a = await draft(baseData({ hackerField: '<script>alert(1)</script>' }));
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  assert.doesNotMatch(own.text, /hackerField/);
  assert.doesNotMatch(own.text, /alert\(1\)/);
});

test('API: publish is idempotent and slugs are valentine-*', async () => {
  const a = await draft();
  const first = await publish(a);
  assert.match(first.slug, /^valentine-[a-f0-9]{18}$/);
  assert.equal(first.url, BASE + '/p/' + first.slug);

  const second = await publish(a);
  assert.deepEqual(second, first);

  // Once published, the draft can no longer be edited.
  assert.equal((await save(a, { question: 'CHANGED' })).status, 403);

  const live = await request('/p/' + first.slug);
  assert.equal(live.status, 200);
  assert.match(live.text, new RegExp(a.data.recipientName));
  assert.match(live.text, /vyPayload/);
});

test('API: stranger cannot publish, missing ids 404', async () => {
  const a = await draft(), b = await draft();
  assert.equal((await request('/api/valentine-say-yes/publish', { method: 'POST', cookie: b.cookie, body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/valentine-say-yes/publish', { method: 'POST', cookie: a.cookie, body: { id: 'nope123' } })).status, 404);
  assert.equal((await request('/valentine-say-yes/preview/nope123', { cookie: a.cookie })).status, 404);
});

test('Pages: demo, generator, template-view and detail all render', async () => {
  const demo = await request('/valentine-say-yes/demo');
  assert.equal(demo.status, 200);
  assert.match(demo.text, /Will you be my Valentine\?/);
  assert.match(demo.text, /valentine-1\.gif/);
  assert.match(demo.text, /vyYes/);
  assert.match(demo.text, /vyNo/);

  const create = await request('/create/valentine-say-yes');
  assert.equal(create.status, 200);
  assert.match(create.text, /valentineForm/);

  const view = await request('/template-view/valentine-say-yes');
  assert.equal(view.status, 200);
  assert.match(view.text, /vy-card/);

  const detail = await request('/templates/valentine-say-yes');
  assert.equal(detail.status, 200);
  assert.match(detail.text, /valentine-say-yes\/demo/);
});

test('Assets: the four public files are served with the right types', async () => {
  for (const [path, type] of [
    ['/valentine-say-yes/ask.css', /text\/css/],
    ['/valentine-say-yes/ask.js', /javascript/],
    ['/valentine-say-yes/create.css', /text\/css/],
    ['/valentine-say-yes/create.js', /javascript/],
  ]) {
    const r = await request(path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get('content-type'), type, path);
  }
});

test('Media: all seven kitten GIFs are served byte-perfect', async () => {
  const sizes = [713166, 96377, 96634, 948087, 290139, 642512, 110452];
  for (let i = 1; i <= 7; i++) {
    const r = await fetch(BASE + `/valentine-say-yes/media/valentine-${i}.gif`);
    assert.equal(r.status, 200, `valentine-${i}.gif`);
    const bytes = Buffer.from(await r.arrayBuffer());
    // The GIF87a/89a magic must survive any transfer intact.
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'GIF8', `valentine-${i}.gif is not a GIF`);
    assert.equal(bytes.length, sizes[i - 1], `valentine-${i}.gif byte length`);
  }
});

test('Render: personalisation lands in the document, escaped', async () => {
  const data = baseData({
    recipientName: 'Asha <b>bold</b>',
    question: 'Be mine? 💘',
    celebration: 'She said yes!! 🎉',
    noLabel: 'Nope',
  });
  const a = await draft(data);
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  // Name is escaped everywhere it appears.
  assert.doesNotMatch(own.text, /<b>bold<\/b>/);
  assert.match(own.text, /Asha &lt;b&gt;bold&lt;\/b&gt;/);
  // The payload is JSON-in-HTML with < neutralised, so </script> can never break out.
  assert.doesNotMatch(own.text, /<\/script>alert/);
  assert.match(own.text, /Be mine\? 💘/);
  assert.match(own.text, /She said yes!!/);
  assert.match(own.text, /Nope/);
});

test('Render: the untouched form produces the designed question', async () => {
  const r = await request('/api/valentine-say-yes/draft', { method: 'POST', body: { customer_data: { recipientName: 'Only Name' } } });
  assert.equal(r.status, 200);
  const { previewUrl } = r.json;
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const own = await request(previewUrl, { cookie });
  assert.match(own.text, /Will you be my Valentine\?/);
  assert.match(own.text, /Yayyy!! :3/);
});
