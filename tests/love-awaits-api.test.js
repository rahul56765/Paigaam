'use strict';
// Run: LOVE_AWAITS_BASE_URL=http://127.0.0.1:3318 node --test tests/love-awaits-api.test.js
// Every mutation targets a new test-owned proposal. No admin or baseline mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.LOVE_AWAITS_BASE_URL || 'http://127.0.0.1:3318').replace(/\/$/, '');

const baseData = (patch = {}) => ({
  recipientName: 'Probe ' + Date.now(),
  senderName: 'Sender',
  introTitle: 'Love Awaits',
  question: 'Will You Be My Forever?',
  questionNote: 'In a universe of billions, my heart chose you.',
  yesLabel: 'Yes, Forever',
  noLabel: 'No',
  finaleTitle: 'Forever & Always',
  finaleLine: 'You are my today and all of my tomorrows.',
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
  const r = await request('/api/love-awaits/draft', { method: 'POST', body: { customer_data: data }, cookie });
  assert.equal(r.status, 200, r.text);
  return { ...r.json, cookie: cookie || r.headers.get('set-cookie').split(';')[0], data };
}

const save = (d, patch) => request('/api/love-awaits/draft', { method: 'POST', cookie: d.cookie, body: { id: d.id, customer_data: { ...d.data, ...patch } } });

async function publish(d) {
  const r = await request('/api/love-awaits/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
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
    for (const [path, body] of [['/api/love-awaits/draft', { id: a.id, customer_data: baseData() }], ['/api/love-awaits/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie, body })).status, 403, path);
    }
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await draft();
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/love-awaits/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Love Awaits proposal', async () => {
  const a = await draft();
  for (const body of [
    { template: 'love-awaits', customer_data: a.data },
    { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } },
  ]) {
    assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
  }
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'love-awaits', customer_data: a.data } })).status, 403);
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
    ['overlong question', baseData({ question: 'x'.repeat(61) })],
    ['overlong note', baseData({ questionNote: 'x'.repeat(241) })],
    ['overlong name', baseData({ recipientName: 'x'.repeat(61) })],
    ['overlong button label', baseData({ yesLabel: 'x'.repeat(25) })],
    ['overlong finale title', baseData({ finaleTitle: 'x'.repeat(41) })],
  ];
  for (const [label, customer_data] of invalid) {
    const r = await request('/api/love-awaits/draft', { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
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

test('API: the payload JSON is parseable exactly as the browser receives it', async () => {
  // The regression Valentine taught us: JSON inside <script> must NOT be
  // HTML-entity-escaped — only the </script> break-out neutralised.
  const a = await draft(baseData({
    question: 'Marry <b>me</b>, "okay"? & forever?',
    questionNote: 'Line with </script> inside — and <tags>, "quotes" & ampersands.',
    recipientName: 'Ann & Bob <3',
  }));
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  const m = own.text.match(/<script type="application\/json" id="lawPayload">(.*?)<\/script>/s);
  assert.ok(m, 'payload script block exists');
  const cfg = JSON.parse(m[1]);
  assert.equal(cfg.ladder[0].t, 'Marry <b>me</b>, "okay"? & forever?');
  assert.match(cfg.ladder[0].s, /<\/script> inside/);
  assert.equal(cfg.who, 'Ann & Bob <3');
  // …and the HTML-escaped document must render the question, not execute it.
  assert.match(own.text, /Marry &lt;b&gt;me&lt;\/b&gt;me|Marry &lt;b&gt;me&lt;\/b&gt;/);
  assert.doesNotMatch(own.text, /<b>me<\/b>/);
});

test('API: drafts update, publish is idempotent, slugs are namespaced', async () => {
  const d = await draft();
  const saved = await save(d, { question: 'Still asking?' });
  assert.equal(saved.status, 200);
  const pub = await publish(d);
  assert.match(pub.slug, /^love-[a-f0-9]{18}$/);
  const again = await request('/api/love-awaits/publish', { method: 'POST', cookie: d.cookie, body: { id: d.id } });
  assert.equal(again.status, 200);
  assert.equal(again.json.slug, pub.slug);
  const live = await request('/p/' + pub.slug);
  assert.equal(live.status, 200);
  assert.match(live.text, /Still asking\?/);
  assert.doesNotMatch(live.text, /data-preview="true"/);
});
