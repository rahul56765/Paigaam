'use strict';
// Run: node --test tests/sawaal-api.test.js
// API + as-served HTML checks for the Sawaal template, against the disposable
// server that scripts/test-sawaal.js boots (SAWAAL_BASE_URL env).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.SAWAAL_BASE_URL || 'http://127.0.0.1:3999';

function baseData(overrides = {}) {
  return {
    recipientName: 'Meher',
    senderName: 'Rahul',
    inviteTitle: 'Let’s schedule a date!',
    inviteIntro: 'Be a good girl & answer all the questions.',
    likeTitle: 'Do you like Rahul?!?!',
    vibeTitle: 'How do you like it?',
    vibeOptions: 'Dinner & Chill, Coffee & Walking',
    availableDays: '2026-10-01, 2026-10-02, 2026-10-03',
    quizTitle: 'So you know us, huh?',
    quizIntro: 'Answer the following questions.',
    kissTitle: 'What if...?',
    kissIntro: 'What if Rahul kissed you on the first date...',
    yesOutcome: 'I USED TO PRAY FOR TIMES LIKE THIS',
    shyOutcome: 'Pfff fine. I had to try it anyway',
    shyOutcomeLine: 'But I will be holding your hands!',
    ...overrides,
  };
}

async function request(path, { method = 'GET', cookie, body, headers = {}, raw, rawType } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}),
      ...(raw && rawType ? { 'content-type': rawType } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html endpoints */ }
  return { status: response.status, json, text, headers: response.headers };
}

async function draft(overrides = {}) {
  const data = baseData(overrides);
  const r = await request('/api/sawaal/draft', { method: 'POST', body: { customer_data: data } });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return { id: r.json.id, cookie, data, previewUrl: r.json.previewUrl, responsesUrl: r.json.responsesUrl };
}

const MEDIA_FILES = ['invite.png', 'like.png', 'like-no.png', 'vibe.png', 'day.png', 'selfie.png', 'kiss.png', 'yes.png', 'no.png', 'final.png', 'pray.jpg'];

test('routes: generator, demo and static assets exist', async () => {
  for (const path of ['/create/sawaal', '/sawaal/demo', '/sawaal/sawaal.css', '/sawaal/sawaal.js', '/sawaal/sfx.js', '/sawaal/create.css', '/sawaal/create.js']) {
    const r = await request(path);
    assert.equal(r.status, 200, path);
  }
  const create = await request('/create/sawaal');
  assert.match(create.text, /id="sawaalForm"/);
  assert.match(create.text, /id="liveFrame"/);
  const demo = await request('/sawaal/demo');
  assert.match(demo.text, /id="swPayload"/);
  for (const name of MEDIA_FILES) {
    const r = await request('/sawaal/media/' + name);
    assert.equal(r.status, 200, name);
    assert.ok(r.text.length > 1000, name + ' has real bytes');
  }
});

test('media: healed files are byte-identical to the base64 sources', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const crypto = require('node:crypto');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'sawaal', 'manifest.json'), 'utf8'));
  for (const [name, expected] of Object.entries(manifest)) {
    const bytes = fs.readFileSync(path.join(__dirname, '..', 'public', 'sawaal', 'media', name));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
});

test('API: draft → preview → publish → live page → QR, end to end', async () => {
  const a = await draft({ inviteTitle: 'Coffee, this Friday?' });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.equal(own.status, 200);
  assert.match(own.text, /data-preview="true"/);
  assert.match(own.text, /noindex/);

  const pub = await request('/api/sawaal/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  assert.equal(pub.status, 200);
  assert.match(pub.json.slug, /^sawaal-[a-f0-9]{18}$/);

  const live = await request('/p/' + pub.json.slug);
  assert.equal(live.status, 200);
  assert.match(live.text, /Coffee, this Friday\?/);
  assert.match(live.text, new RegExp(a.data.recipientName));
  assert.match(live.text, /—/);
  // The published page carries its own id so answers can collect.
  assert.match(live.text, /"paigaamId":"sawaal-[a-f0-9]{18}"/);
  // The demo/preview must NOT — its payload carries null.
  assert.doesNotMatch(own.text, /"paigaamId":"sawaal-/);

  const qr = await request('/api/qr?url=' + encodeURIComponent(pub.json.url));
  assert.equal(qr.status, 200);
  assert.match(qr.text, /<svg/);

  // Idempotent publish: same URL again.
  const again = await request('/api/sawaal/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  assert.equal(again.status, 200);
  assert.equal(again.json.slug, pub.json.slug);
});

test('API: the responses page is creator-gated and shows collected answers', async () => {
  const a = await draft();
  // Publish, then a visitor claims and answers.
  const pub = await request('/api/sawaal/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  assert.equal(pub.status, 200);
  const claim = await request('/api/sawaal/claim', { method: 'POST', body: { id: a.id } });
  assert.equal(claim.status, 200);
  const vcookie = claim.headers.get('set-cookie').split(';')[0];

  const answer = await request('/api/sawaal/answer', { method: 'POST', cookie: vcookie, body: { id: a.id, scene: 'invite', answer: { choice: 'yes_of_course' } } });
  assert.equal(answer.status, 200);

  const quiz = await request('/api/sawaal/answer', { method: 'POST', cookie: vcookie, body: { id: a.id, scene: 'quiz', answer: { answers: { q1: 'C', q2: 'C', q3: 'C', q4: 'B' } } } });
  assert.equal(quiz.status, 200);

  const mine = await request(a.responsesUrl, { cookie: a.cookie });
  assert.equal(mine.status, 200);
  assert.match(mine.text, /yes_of_course/);
  assert.match(mine.text, /score/i);

  // A stranger (or the visitor) may not read the responses page.
  assert.equal((await request(a.responsesUrl, { cookie: vcookie })).status, 403);
  assert.equal((await request(a.responsesUrl)).status, 403);

  // Unbound visitors cannot post answers at all.
  const ghost = await request('/api/sawaal/answer', { method: 'POST', cookie: 'paigaam_visitor=' + 'f'.repeat(48), body: { id: a.id, scene: 'like', answer: { choice: 'sure' } } });
  assert.equal(ghost.status, 403);
  const anonymous = await request('/api/sawaal/answer', { method: 'POST', body: { id: a.id, scene: 'like', answer: { choice: 'sure' } } });
  assert.equal(anonymous.status, 403);

  // Malformed answers are refused.
  for (const body of [
    { id: a.id, scene: 'invite', answer: { choice: 42 } },
    { id: a.id, scene: 'invite', answer: {} },
    { id: a.id, scene: 'hacker', answer: { choice: 'yes' } },
    { id: a.id, scene: 'quiz', answer: { answers: { q1: 'C', q2: 'C', q3: 'C', q4: 'Z' } } },
  ]) {
    assert.equal((await request('/api/sawaal/answer', { method: 'POST', cookie: vcookie, body })).status, 400, JSON.stringify(body));
  }
});

test('API: selfie upload validates magic bytes and gates serving on publish', async () => {
  const a = await draft();
  // The visitor session binds to a PUBLISHED questionnaire — publish first.
  const pub = await request('/api/sawaal/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  assert.equal(pub.status, 200);
  const claim = await request('/api/sawaal/claim', { method: 'POST', body: { id: a.id } });
  const vcookie = claim.headers.get('set-cookie').split(';')[0];

  // A real 60x60 PNG (solid colour, built with zlib — same as the Love Album demo).
  const png = makePng(60, 60, [200, 80, 160]);
  const upload = await request('/api/sawaal/upload?id=' + a.id, { method: 'POST', cookie: vcookie, body: png, raw: true, rawType: 'image/png' });
  assert.equal(upload.status, 200);
  assert.match(upload.json.url, /^\/sawaal\/selfie\/[A-Za-z0-9_-]+\/[a-f0-9]{48}\.png$/);

  // Bad magic bytes refused.
  const fake = await request('/api/sawaal/upload?id=' + a.id, { method: 'POST', cookie: vcookie, body: Buffer.from('GIF89a-not-really' + '0'.repeat(2000)), raw: true, rawType: 'image/png' });
  assert.equal(fake.status, 400);

  // Unknown visitor refused.
  const strangerUpload = await request('/api/sawaal/upload?id=' + a.id, { method: 'POST', cookie: 'paigaam_visitor=' + 'e'.repeat(48), body: png, raw: true, rawType: 'image/png' });
  assert.equal(strangerUpload.status, 403);

  // Claiming a draft (or an unknown id) is refused.
  const b = await draft();
  assert.equal((await request('/api/sawaal/claim', { method: 'POST', body: { id: b.id } })).status, 404);

  // The published selfie is publicly visible as part of the live experience…
  assert.equal((await request(upload.json.url)).status, 200);
  assert.equal((await request(upload.json.url, { cookie: vcookie })).status, 200);
  // …but a selfie bound to a DIFFERENT paigaam id is not.
  assert.equal((await request('/sawaal/selfie/' + b.id + '/' + upload.json.url.split('/').pop())).status, 404);
});

function makePng(width, height, [r, g, b]) {
  const zlib = require('node:zlib');
  const crcTable = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = buf => { let c = 0xFFFFFFFF; for (const byte of buf) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => {
    const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let row = 0; row < height; row++) {
    const start = row * (1 + width * 3);
    raw[start] = 0;
    for (let x = 0; x < width; x++) { const o = start + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('API: strangers cannot preview, edit, publish or read another creator\'s questionnaire', async () => {
  const a = await draft();
  for (const cookie of [undefined, a.cookie + 'x']) {
    const stranger = cookie ? cookie : 'paigaam_creator=' + 'f'.repeat(64);
    for (const path of [a.previewUrl, '/preview/' + a.id, a.responsesUrl]) {
      assert.equal((await request(path, { cookie: stranger })).status, 403, path);
    }
    for (const [path, body] of [['/api/sawaal/draft', { id: a.id, customer_data: baseData() }], ['/api/sawaal/publish', { id: a.id }]]) {
      assert.equal((await request(path, { method: 'POST', cookie: stranger, body })).status, 403, path);
    }
  }
});

test('API: cross-site requests are refused', async () => {
  const a = await draft();
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await request('/api/sawaal/draft', { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: a.data } });
    assert.equal(r.status, 403);
  }
});

test('API: the generic template endpoints cannot touch a Sawaal questionnaire', async () => {
  const a = await draft();
  for (const body of [
    { template: 'sawaal', customer_data: a.data },
    { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } },
  ]) {
    assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
  }
  assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
  assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: 'sawaal', customer_data: a.data } })).status, 403);
  assert.equal((await request('/go/whatsapp/' + a.id)).status, 403);

  const after = await request(a.previewUrl, { cookie: a.cookie });
  assert.match(after.text, new RegExp(a.data.recipientName));
  assert.doesNotMatch(after.text, /OVERWRITE/);
});

test('API: validation rejects bad shapes, lengths, newlines, control chars and bad day lists', async () => {
  const invalid = [
    ['missing data', undefined],
    ['null data', null],
    ['array data', []],
    ['missing name', baseData({ recipientName: '' })],
    ['blank name', baseData({ recipientName: '   ' })],
    ['wrong field type', baseData({ senderName: 123 })],
    ['control character', baseData({ inviteTitle: 'bad\u0007' })],
    ['newline in a one-line field', baseData({ inviteTitle: 'two\nlines' })],
    ['overlong title', baseData({ inviteTitle: 'x'.repeat(91) })],
    ['overlong name', baseData({ recipientName: 'x'.repeat(61) })],
    ['overlong days', baseData({ availableDays: 'x'.repeat(201) })],
  ];
  for (const [label, customer_data] of invalid) {
    const r = await request('/api/sawaal/draft', { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
    assert.equal(r.status, 400, label);
    assert.equal(r.json.error, 'validation', label);
  }
  // Unknown keys never persist.
  const a = await draft({ evilKey: '<script>alert(1)</script>' });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.doesNotMatch(own.text, /evilKey/);
  assert.doesNotMatch(own.text, /<script>alert/);
  // A malformed day list is dropped, never fatal; vibe options de-dupe.
  const relaxed = await draft({ availableDays: 'nonsense, 2026-13-99, 2026-10-01, 2026-10-01', vibeOptions: 'Tea, tea, TEA, , Cinema' });
  const view = await request(relaxed.previewUrl, { cookie: relaxed.cookie });
  assert.match(view.text, /2026-10-01/);
  assert.doesNotMatch(view.text, /nonsense/);
  assert.match(view.text, /&quot;vibeOptions&quot;:\[&quot;Tea&quot;,&quot;Cinema&quot;\]|"vibeOptions":\["Tea","Cinema"\]/);
});

test('API: the stateless live-preview frame renders typed data, defaults on garbage, and is read-only', async () => {
  const data = { recipientName: 'अनोखा', inviteTitle: 'चला डेटला' };
  const r = await request('/sawaal/preview-frame?d=' + encodeURIComponent(JSON.stringify(data)));
  assert.equal(r.status, 200);
  assert.match(r.text, /अनोखा/);
  assert.match(r.text, /चला डेटला/);

  // Garbage → designed defaults, never a 500.
  const bad = await request('/sawaal/preview-frame?d=%7Bbroken');
  assert.equal(bad.status, 200);
  assert.match(bad.text, /Let’s schedule a date!/);
  const hostile = await request('/sawaal/preview-frame?d=' + encodeURIComponent('{"recipientName":"<svg onload=alert(1>"}'));
  assert.equal(hostile.status, 200);
  assert.doesNotMatch(hostile.text, /<svg onload/);

  // GET only.
  const post = await fetch(BASE + '/sawaal/preview-frame', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(post.status, 404);
});

test('HTML: the served payload parses — no entity-escaping regression (Valentine lesson)', async () => {
  const a = await draft({ inviteIntro: 'Quotes " and <b>markup</b> and emoji 😘' });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  const match = /<script type="application\/json" id="swPayload">([\s\S]*?)<\/script>/.exec(own.text);
  assert.ok(match, 'payload block present');
  let payload;
  assert.doesNotThrow(() => { payload = JSON.parse(match[1]); }, 'payload must parse as served');
  assert.equal(payload.inviteIntro, 'Quotes " and <b>markup</b> and emoji 😘');
  assert.equal(payload.recipientName, a.data.recipientName);
});

test('HTML: sender text is escaped everywhere it renders', async () => {
  const hostile = '<script>alert(1)</script>';
  const a = await draft({ recipientName: hostile, inviteTitle: hostile, senderName: hostile });
  const own = await request(a.previewUrl, { cookie: a.cookie });
  assert.doesNotMatch(own.text, /<script>alert\(1\)<\/script><\/h1>/);
  assert.doesNotMatch(own.text, /[^p]"<script>alert/, 'unescaped payload');
  const pub = await request('/api/sawaal/publish', { method: 'POST', cookie: a.cookie, body: { id: a.id } });
  const live = await request('/p/' + pub.json.slug);
  assert.doesNotMatch(live.text, /<script>alert\(1\)<\/script>/);
});

test('API: the draft path works locally and hands out owner cookies', async () => {
  const a = await draft();
  assert.equal(typeof a.id, 'string');
  assert.match(a.cookie, /^paigaam_creator=/);
});
