'use strict';
// Run: node --test tests/maafi-api.test.js
// API + as-served HTML checks for the Maafi template, against the disposable
// server that scripts/test-maafi.js boots (VALENTINE_BASE_URL-style env).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.MAAFI_BASE_URL || 'http://127.0.0.1:3999';

function baseData(overrides = {}) {
  return {
    recipientName: 'Meher',
    senderName: 'Rahul',
    headline: 'I’m really sorry ❤️',
    yesLabel: 'Okay baby, I forgive you 💖',
    noLabel: 'No, I’m still angry 😠',
    celebration: 'Yay! You forgave me! 😍💖🥳',
    ...overrides,
  };
}

async function request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html endpoints */ }
  return { status: response.status, json, text, headers: response.headers };
}

async function draft(overrides = {}) {
  const data = baseData(overrides);
  const r = await request('/api/maafi/draft', { method: 'POST', body: { customer_data: data } });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return { id: r.json.id, cookie, data, previewUrl: r.json.previewUrl };
}

test('routes: generator, demo and static assets exist', async () => {
  for (const path of ['/create/maafi', '/maafi/demo', '/maafi/maafi.css', '/maafi/maafi.js', '/maafi/create.css', '/maafi/create.js']) {
    const r = await request(path);
    assert.equal(r.status, 200, path);
  }
  const create = await request('/create/maafi');
  assert.match(create.text, /id="maafiForm"/);
  assert.match(create.text, /id="liveFrame"/);
  const demo = await request('/maafi/demo');
  assert.match(demo.text, /id="mmPayload"/);
});

test('API: draft → preview → publish → live page → QR, end to end', async () => {
  const a = await draft({ headline: 'Forgive me, Meher?' });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  assert.match(own.text, /data-preview="true"/);
  assert.match(own.text, /noindex/);

  const pub = await request('/api/maafi/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  assert.equal(pub.status, 200);
  assert.match(pub.json.slug, /^maafi-[a-f0-9]{18}$/);

  const live = await request('/p/' + pub.json.slug);
  assert.equal(live.status, 200);
  assert.match(live.text, /Forgive me, Meher\?/);
  assert.match(live.text, new RegExp(a.data.recipientName));
  assert.match(live.text, /— Rahul/);

  const qr = await request('/api/qr?url=' + encodeURIComponent(pub.json.url));
  assert.equal(qr.status, 200);
  assert.match(qr.text, /<svg/);

  // Idempotent publish: same URL again.
  const again = await request('/api/maafi/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  assert.equal(again.status, 200);
  assert.equal(again.json.slug, pub.json.slug);
});

test('API: strangers cannot preview, edit, publish or delete another creator\'s apology', async () => {
  const a = await draft();
  for (const cookie of [undefined, a.cookie + 'x']) {
    // A forged cookie is just a stranger.
    const stranger = cookie ? cookie : 'paigaam_creator=' + 'f'.repeat(64);
    for (const path of [a.previewUrl, '/preview/' + a.id]) {
      assert.equal((await request(path, { cookie: stranger })).status, 403, path);
    }
    for (const [path, body] of [['/api/maafi/draft', { id: a.id, customer_data: baseData() }], ['/api/maafi/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie: stranger, body })).status, 403, path);
    }
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await draft();
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/maafi/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Maafi apology', async () => {
  const a = await draft();
  for (const body of [
    { template: 'maafi', customer_data: a.data },
    { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } },
  ]) {
    assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
  }
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'maafi', customer_data: a.data } })).status, 403);
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
    ['control character', baseData({ headline: 'bad\u0007' })],
    ['newline in a one-line field', baseData({ headline: 'two\nlines' })],
    ['overlong headline', baseData({ headline: 'x'.repeat(121) })],
    ['overlong name', baseData({ recipientName: 'x'.repeat(61) })],
    ['overlong button label', baseData({ yesLabel: 'x'.repeat(41) })],
  ];
  for (const [label, customer_data] of invalid) {
    const r = await request('/api/maafi/draft', { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
    assert.equal(r.status, 400, label);
    assert.equal(r.json.error, 'validation', label);
  }
  // Unknown keys never persist.
  const a = await draft({ evilKey: '<script>alert(1)</script>' });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.doesNotMatch(own.text, /evilKey/);
  assert.doesNotMatch(own.text, /<script>alert/);
});

test('API: the stateless live-preview frame renders typed data, defaults on garbage, and is read-only', async () => {
  const data = { recipientName: 'अनोखा', headline: 'Sorry jaan' };
  const r = await request('/maafi/preview-frame?d=' + encodeURIComponent(JSON.stringify(data)));
  assert.equal(r.status, 200);
  assert.match(r.text, /अनोखा/);
  assert.match(r.text, /Sorry jaan/);

  // Garbage → designed defaults, never a 500.
  const bad = await request('/maafi/preview-frame?d=%7Bbroken');
  assert.equal(bad.status, 200);
  assert.match(bad.text, /I’m really sorry ❤️/);
  const hostile = await request('/maafi/preview-frame?d=' + encodeURIComponent('{"recipientName":"<svg onload=alert(1>"}'));
  assert.equal(hostile.status, 200);
  assert.doesNotMatch(hostile.text, /<svg onload/);

  // GET only.
  const post = await fetch(BASE + '/maafi/preview-frame', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(post.status, 404);
});

test('HTML: sender text is escaped everywhere it renders', async () => {
  const hostile = '<script>alert(1)</script>';
  const a = await draft({ recipientName: hostile, headline: hostile, celebration: hostile, senderName: hostile });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.doesNotMatch(own.text, /<script>alert\(1\)<\/script><\/h1>/);
  // The raw payload block may carry the escaped name — but no unescaped script tag may appear outside it.
  assert.doesNotMatch(own.text, /[^p]"<script>alert/, 'unescaped payload');
  // The published page must not execute injected markup.
  const pub = await request('/api/maafi/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  const live = await request('/p/' + pub.json.slug);
  assert.doesNotMatch(live.text, /<script>alert\(1\)<\/script>/);
});

test('API: the draft path works locally and hands out owner cookies', async () => {
  const a = await draft();
  assert.equal(typeof a.id, 'string');
  assert.match(a.cookie, /^paigaam_creator=/);
});
