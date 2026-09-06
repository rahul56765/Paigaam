'use strict';
// Run: SAALGIRAH_BASE_URL=http://127.0.0.1:3311 node --test tests/saalgirah-api.test.js
// Every mutation targets a new test-owned letter. No admin or baseline mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.SAALGIRAH_BASE_URL || 'http://127.0.0.1:3311').replace(/\/$/, '');

const baseData = (patch = {}) => ({
  recipientName: 'Probe ' + Date.now(),
  senderName: 'Sender',
  line1: 'I was going to write something normal…',
  line2: 'but you’re not exactly a normal person to me.',
  line3: 'So… I made you this.',
  attentionLine: 'Okay… now that I have your attention.',
  wishLine: '',
  closingLine: 'I LOVE YOU.',
  note: 'Thank you for every ordinary day.',
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
  const r = await request('/api/saalgirah/draft', { method: 'POST', body: { customer_data: data }, cookie });
  assert.equal(r.status, 200, r.text);
  return { ...r.json, cookie: cookie || r.headers.get('set-cookie').split(';')[0], data };
}

const save = (d, patch) => request('/api/saalgirah/draft', { method: 'POST', cookie: d.cookie, body: { id: d.id, customer_data: { ...d.data, ...patch } } });

async function publish(d) {
  const r = await request('/api/saalgirah/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
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
    for (const [path, body] of [['/api/saalgirah/draft', { id: a.id, customer_data: baseData() }], ['/api/saalgirah/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie, body })).status, 403, path);
    }
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await draft();
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/saalgirah/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Saalgirah letter', async () => {
  const a = await draft();
  for (const body of [
    { template: 'saalgirah', customer_data: a.data },
    { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } },
  ]) {
    assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
  }
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'saalgirah', customer_data: a.data } })).status, 403);

  const after = await request(a.previewUrl, { cookie: a.cookie });
  assert.match(after.text, new RegExp(a.data.recipientName));
  assert.doesNotMatch(after.text, /OVERWRITE/);
});

test('API: validation rejects bad shapes, lengths, newlines and control characters', async (t) => {
  const invalid = [
    ['missing data', undefined],
    ['null data', null],
    ['array data', []],
    ['missing name', baseData({ recipientName: '' })],
    ['blank name', baseData({ recipientName: '   ' })],
    ['wrong field type', baseData({ senderName: 123 })],
    ['control character', baseData({ closingLine: 'bad\u0001' })],
    ['newline in a single-line field', baseData({ line1: 'one\ntwo' })],
    ['newline in the name', baseData({ recipientName: 'Me\nher' })],
  ];
  for (const [key, max] of Object.entries({ recipientName: 60, senderName: 60, line1: 160, line2: 160, line3: 160, attentionLine: 160, wishLine: 90, closingLine: 90, note: 400 })) {
    invalid.push([key + ' too long', baseData({ [key]: 'x'.repeat(max + 1) })]);
  }
  for (const [name, customer_data] of invalid) {
    await t.test(name, async () => {
      const r = await request('/api/saalgirah/draft', { method: 'POST', body: { customer_data } });
      assert.equal(r.status, 400, r.text);
    });
  }
  // A newline is allowed in the note, and a note of only whitespace is dropped.
  const ok = await draft(baseData({ note: 'one\ntwo' }));
  assert.match((await request(ok.previewUrl, { cookie: ok.cookie })).text, /one\ntwo|one<|two/);
});

test('API: an untouched form still sends the original letter', async () => {
  const d = await draft({ recipientName: 'Meher' });
  const html = (await request(d.previewUrl, { cookie: d.cookie })).text;
  assert.match(html, /I was going to write something normal/);
  assert.match(html, /not exactly a normal person to me/);
  assert.match(html, /So… I made you this/);
  assert.match(html, /Okay… now that I have your attention/);
  assert.match(html, /HAPPY BIRTHDAY, MEHER\./);
  assert.match(html, /I LOVE YOU\./);
  // No signature and no note were given, so neither is rendered.
  assert.doesNotMatch(html, /sg-signature__from/);
  assert.doesNotMatch(html, /class="sg-note"/);
});

test('API: personalisation is escaped, never interpolated as markup', async () => {
  const nasty = '<script>alert(1)</script>"\'&';
  const d = await draft(baseData({ recipientName: nasty, closingLine: '</h2><img src=x onerror=alert(2)>' }));
  const html = (await request(d.previewUrl, { cookie: d.cookie })).text;
  // The escaped text still *contains* those characters — what matters is that
  // no live tag or attribute was ever created.
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<img\b/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
});

test('API: publishing is idempotent and produces a public page', async () => {
  const d = await draft(baseData({ recipientName: 'Meher', senderName: 'Rahul' }));
  const first = await publish(d);
  const second = await publish(d);
  assert.equal(first.slug, second.slug);
  assert.match(first.slug, /^saalgirah-[a-f0-9]{18}$/);

  const page = await request('/p/' + first.slug);
  assert.equal(page.status, 200);
  assert.match(page.text, /HAPPY BIRTHDAY, MEHER\./);
  assert.match(page.text, /— Rahul/);
  assert.match(page.text, /data-preview="false"/);
  assert.match(page.text, /rel="canonical"/);
  assert.doesNotMatch(page.text, /noindex/);

  // A published letter can no longer be edited.
  assert.equal((await save(d, { recipientName: 'Someone else' })).status, 403);
});

test('API: a published letter is not editable by a stranger, and unknown ids 404', async () => {
  const a = await draft();
  const b = await draft();
  assert.equal((await request('/api/saalgirah/publish', { method: 'POST', cookie: b.cookie, body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/saalgirah/publish', { method: 'POST', cookie: a.cookie, body: { id: 'nope123' } })).status, 404);
  assert.equal((await request('/saalgirah/preview/nope123', { cookie: a.cookie })).status, 404);
});

test('Pages: demo, generator, collection card and assets all serve', async () => {
  const demo = await request('/saalgirah/demo');
  assert.equal(demo.status, 200);
  assert.match(demo.text, /HAPPY BIRTHDAY, MEHER\./);
  assert.match(demo.text, /data-preview="true"/);

  const create = await request('/create/saalgirah');
  assert.equal(create.status, 200);
  assert.match(create.text, /saalgirahForm/);
  assert.match(create.text, /Step|Continue/);

  const view = await request('/template-view/saalgirah');
  assert.equal(view.status, 200);
  assert.match(view.text, /sg-scene--envelope/);

  const detail = await request('/templates/saalgirah');
  assert.equal(detail.status, 200);
  assert.match(detail.text, /saalgirah\/demo/);

  const collection = await request('/templates');
  assert.equal(collection.status, 200);
  assert.match(collection.text, /Saalgirah/);

  for (const [path, type] of [
    ['/saalgirah/letter.css', /text\/css/],
    ['/saalgirah/letter.js', /javascript/],
    ['/saalgirah/audio.js', /javascript/],
    ['/saalgirah/create.css', /text\/css/],
    ['/saalgirah/create.js', /javascript/],
  ]) {
    const r = await request(path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get('content-type'), type, path);
  }
});

test('Render: the experience ships no media files at all', async () => {
  const html = (await request('/saalgirah/demo')).text;
  // Everything visual is inline SVG; everything audible is synthesised.
  assert.doesNotMatch(html, /<(img|video|audio|source|object|embed)\b/i);
  assert.doesNotMatch(html, /\.(mp3|mp4|wav|ogg|webm|woff2?)\b/i);
  assert.match(html, /fonts\.googleapis\.com/);
  assert.match(html, /\/saalgirah\/audio\.js/);
  assert.match(html, /<svg/);
});
