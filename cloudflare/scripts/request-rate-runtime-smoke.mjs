#!/usr/bin/env node
// LOCAL ONLY: requires a fresh isolated Miniflare D1/R2, migration 0006,
// synthetic key and drafts/free enabled. Never target an actual deployment.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUEST_RATE } from '../src/admission-policy.mjs';
import { bySlug } from '../src/catalog.generated.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const target = new URL(base);
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('Refusing non-loopback runtime tests');
}
const remaining = 60 - Math.floor(Date.now() / 1000) % 60;
if (remaining < 8) throw new Error('Run just after the minute boundary to avoid an inconclusive fixed-window race');
const state = await (await fetch(base + '/status')).json();
assert.equal(state.checkout, 'disabled'); assert.equal(state.legacyDataImported, false);
const ip = '203.0.113.61', otherIp = '198.51.100.61';
function post(path, body, { client = ip, cookie, headers = {} } = {}) {
  return fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json',
    'CF-Connecting-IP': client, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(body) });
}
const draft = n => post('/api/vaidehi/draft', { customer_data: {}, max: 999999 },
  { headers: { 'X-Forwarded-For': `192.0.2.${n % 250 + 1}` } });
const initial = await Promise.all(Array.from({ length: REQUEST_RATE.draft_create.max - 1 }, (_, i) => draft(i)));
assert.ok(initial.every(r => r.status === 200), initial.map(r => r.status).join(','));
const first = { ...await initial[0].json(), cookie: initial[0].headers.get('set-cookie').split(';')[0] };
const race = await Promise.all(Array.from({ length: 8 }, (_, i) => draft(i + 100)));
assert.equal(race.filter(r => r.status === 200).length, 1, race.map(r => r.status).join(','));
assert.equal(race.filter(r => r.status === 429).length, 7);
assert.ok(race.filter(r => r.status === 429).every(r => Number(r.headers.get('retry-after')) >= 1));
let r = await post('/api/vaidehi/draft', { id: first.id, customer_data: {} }, { cookie: first.cookie });
assert.equal(r.status, 200, await r.clone().text());
r = await post('/vaidehi/preview-frame', { customer_data: {} }); assert.equal(r.status, 200);
r = await post('/api/vaidehi/draft', { customer_data: {} }, { headers: { Origin: 'https://evil.example' } });
assert.equal(r.status, 403);

// Every image/audio route shares one per-IP upload budget. These invalid IDs
// spend tokens without writing any objects; the actual upload uses another IP.
for (let i = 0; i < REQUEST_RATE.upload.max; i++) {
  const action = ['upload', 'upload-audio', 'audio'][i % 3];
  r = await post(`/api/vaidehi/${action}?id=${'0'.repeat(18)}`, {}, { cookie: first.cookie });
  assert.equal(r.status, 404);
}
r = await post(`/api/vaidehi/upload?id=${first.id}`, {}, { cookie: first.cookie });
assert.equal(r.status, 429);
const image = readFileSync(new URL('../public/brand/favicon-512.png', import.meta.url));
r = await fetch(`${base}/api/vaidehi/upload?id=${first.id}`, { method: 'POST', headers: {
  Origin: base, Cookie: first.cookie, 'CF-Connecting-IP': otherIp, 'Content-Type': 'image/png',
}, body: image });
assert.equal(r.status, 200, await r.clone().text());
const media = (await r.json()).url;
r = await fetch(base + media); assert.equal(r.status, 404);
r = await fetch(base + media, { headers: { Cookie: first.cookie } });
assert.equal(r.status, 200); assert.deepEqual(Buffer.from(await r.arrayBuffer()), image);

r = await post('/api/sealed-with-a-kiss/draft', { customer_data: bySlug('sealed-with-a-kiss').config.demo }, { client: otherIp });
assert.equal(r.status, 200, await r.clone().text());
const free = await r.json(), cookie = r.headers.get('set-cookie').split(';')[0];
r = await post('/api/sealed-with-a-kiss/publish', { id: free.id, expected_snapshot: free.snapshot }, { client: otherIp, cookie });
assert.equal(r.status, 200, await r.clone().text());
assert.equal((await fetch((await r.json()).url)).status, 200);
console.log(JSON.stringify({ localOnly: true, checkoutDisabled: true,
  createQuota: REQUEST_RATE.draft_create.max, concurrentFinalSlotWinners: 1, concurrentDenied: 7,
  cookieAndForwardedForRotationBlocked: true, updateAndPreviewIsolated: true, crossOriginRejected: true,
  uploadAliasesShareQuota: true, alternateIpLocalR2Readback: true, stagedFreePublication: true }, null, 2));
