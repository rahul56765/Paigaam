#!/usr/bin/env node
// LOCAL-ONLY acceptance smoke for safety PR #85. It creates synthetic test
// drafts and media in a fresh Miniflare D1/R2 state. It never contacts a remote
// Worker, production storage, Railway, or a payment gateway.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bySlug } from '../src/catalog.generated.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/$/, '');
const target = new URL(base);
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.username || target.password || target.pathname !== '/') {
  throw new Error('Refusing to write anywhere other than a local HTTP Worker');
}
const state = await (await fetch(`${base}/status`)).json();
assert.equal(state.checkout, 'disabled');
assert.equal(state.legacyDataImported, false);

const cookies = new Map();
async function draft(slug) {
  const response = await fetch(`${base}/api/${slug}/draft`, {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_data: bySlug(slug).config.demo }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const { id } = await response.json(), cookie = response.headers.get('set-cookie').split(';')[0];
  cookies.set(id, cookie);
  return { id, cookie, slug };
}
async function upload(d, bytes, action, type) {
  return fetch(`${base}/api/${d.slug}/${action}?id=${d.id}`, {
    method: 'POST', headers: { Origin: base, Cookie: d.cookie, 'Content-Type': type }, body: bytes,
  });
}
async function save(d, data) {
  return fetch(`${base}/api/${d.slug}/draft`, {
    method: 'POST', headers: { Origin: base, Cookie: d.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: d.id, customer_data: data }),
  });
}
function wave() {
  const b = Buffer.alloc(46);
  b.write('RIFF', 0); b.writeUInt32LE(38, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(2, 40);
  return b;
}
const audio = wave(), cases = {};
for (const slug of ['love-letter', 'anniversary-blue']) {
  const d = await draft(slug);
  let r = await upload(d, audio, 'audio', 'application/octet-stream');
  assert.equal(r.status, 200, await r.clone().text());
  const { url } = await r.json(); assert.match(url, /\.wav$/);
  r = await fetch(base + url); assert.equal(r.status, 404, 'draft music must stay private');
  r = await fetch(base + url, { headers: { Cookie: d.cookie } }); assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/wav');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), audio);
  r = await save(d, { ...bySlug(slug).config.demo, songUrl: url });
  assert.equal(r.status, 200, await r.clone().text());
  const other = await draft(slug);
  r = await save(other, { ...bySlug(slug).config.demo, songUrl: url });
  assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid_upload');
  cases[slug] = { octetStreamAudioAccepted: true, sameInviteOwnerVerified: true, privateMediaBlocked: true };

  if (slug === 'love-letter') {
    for (let i = 0; i < 3; i++) {
      const a = await upload(d, audio, 'audio', 'application/octet-stream');
      assert.equal(a.status, 200, await a.clone().text());
    }
    // Four already committed: at most one of six contenders may succeed.
    const attempts = await Promise.all(Array.from({ length: 6 }, () => upload(d, audio, 'audio', 'application/octet-stream')));
    const statuses = attempts.map(a => a.status);
    assert.equal(statuses.filter(s => s === 200).length, 1, JSON.stringify(statuses));
    assert.ok(statuses.every(s => [200, 409, 429].includes(s)), JSON.stringify(statuses));
    cases[slug].concurrentQuotaStatuses = statuses;
  }
}
const free = await draft('vaidehi');
const image = fs.readFileSync(new URL('../public/brand/favicon-512.png', import.meta.url));
for (let i = 0; i < 9; i++) {
  const r = await upload(free, image, 'upload', 'image/png');
  assert.equal(r.status, 200, await r.clone().text());
}
let r = await upload(free, audio, 'upload-audio', 'audio/wav');
assert.equal(r.status, 200, await r.clone().text());
r = await fetch(`${base}/api/vaidehi/publish`, {
  method: 'POST', headers: { Origin: base, Cookie: free.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: free.id }),
});
assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
console.log(JSON.stringify({
  localOnly: true, workerd: true, testDraftsCreated: 5,
  keepsakeAudio: cases, audioIndependentOfNinePhotos: true, realCheckoutDisabled: true,
}, null, 2));
