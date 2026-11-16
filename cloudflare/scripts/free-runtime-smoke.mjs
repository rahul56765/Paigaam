#!/usr/bin/env node
// LOCAL-ONLY synthetic acceptance for gated free publishing. Start a fresh
// Miniflare state with migration 0006, a synthetic RATE_LIMIT_HMAC_KEY,
// DRAFTS_ENABLED=true, FREE_PUBLISH_ENABLED=true, and checkout disabled.
// Documentation-range IPs distribute this full-catalog test across budgets;
// they are local fixtures, not a production bypass or recommended policy.
import assert from 'node:assert/strict';
import { list, bySlug } from '../src/catalog.generated.mjs';
const base = (process.argv[2] || 'http://127.0.0.1:8789').replace(/\/$/, '');
const target = new URL(base);
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.username || target.password || target.pathname !== '/') {
  throw new Error('Refusing to write anywhere other than a local HTTP Worker');
}
const status = await (await fetch(`${base}/status`)).json();
assert.equal(status.checkout, 'disabled'); assert.equal(status.legacyDataImported, false);
async function post(path, body, cookie, client) {
  return fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'CF-Connecting-IP': client, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
}
async function create(slug, cookie, client) {
  const r = await post(`/api/${slug}/draft`, { customer_data: bySlug(slug).config.demo }, cookie, client);
  assert.equal(r.status, 200, `${slug}: ${await r.clone().text()}`);
  return { ...await r.json(), slug, client, cookie: cookie || r.headers.get('set-cookie').split(';')[0] };
}
async function publish(d, cookie = d.cookie) { return post(`/api/${d.slug}/publish`, { id: d.id, price: 0, amount: 0 }, cookie, d.client); }
function wave() {
  const b = Buffer.alloc(46); b.write('RIFF', 0); b.writeUInt32LE(38, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(2, 40); return b;
}
let cookie, published = 0;
const free = list.filter(t => (t.config.price || 0) === 0);
for (const [index, t] of free.entries()) {
  const d = await create(t.slug, cookie, `203.0.113.${index + 1}`); cookie = d.cookie;
  let r = await publish(d); assert.equal(r.status, 200, `${t.slug}: ${await r.clone().text()}`);
  const first = await r.json(); assert.match(first.slug, new RegExp(`^${t.slug}-free-[a-f0-9]{48}$`));
  assert.equal(first.url, `${base}/p/${first.slug}`);
  r = await fetch(first.url); assert.equal(r.status, 200, t.slug); assert.match(r.headers.get('content-type'), /text\/html/);
  r = await publish(d); assert.equal(r.status, 200); assert.deepEqual(await r.json(), first);
  published++;
}
const race = await create('sealed-with-a-kiss', cookie, '203.0.113.200');
const results = await Promise.all(Array.from({ length: 12 }, () => publish(race)));
assert.ok(results.every(r => r.status === 200), results.map(r => r.status).join(','));
const bodies = await Promise.all(results.map(r => r.json()));
assert.ok(bodies.every(x => x.url === bodies[0].url && x.slug === bodies[0].slug));
let r = await publish(race, `paigaam_creator=${'f'.repeat(64)}`); assert.equal(r.status, 403);
const paid = await create('little-love', cookie, '203.0.113.201'); r = await publish(paid);
assert.equal(r.status, 503); assert.equal((await r.json()).error, 'payments_offline');
const audioDraft = await create('love-letter', cookie, '203.0.113.202');
const music = wave();
r = await fetch(`${base}/api/love-letter/audio?id=${audioDraft.id}`, {
  method: 'POST', headers: { Origin: base, Cookie: cookie, 'CF-Connecting-IP': audioDraft.client, 'Content-Type': 'application/octet-stream' }, body: music,
});
assert.equal(r.status, 200, await r.clone().text()); const media = (await r.json()).url;
r = await fetch(base + media); assert.equal(r.status, 404);
r = await post('/api/love-letter/draft', { id: audioDraft.id, customer_data: { ...bySlug('love-letter').config.demo, songUrl: media } }, cookie, audioDraft.client);
assert.equal(r.status, 200, await r.clone().text());
r = await publish(audioDraft); assert.equal(r.status, 200, await r.clone().text());
r = await fetch(base + media); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'audio/wav');
assert.deepEqual(Buffer.from(await r.arrayBuffer()), music);
// The free builder is unlocked only under the explicit local staging flags.
r = await fetch(base + '/create/sealed-with-a-kiss'); assert.equal(r.status, 200);
const builder = await r.text();
assert.match(builder, /id="publish" class="button publish" aria-describedby="free-publish-hint"/);
assert.doesNotMatch(builder, /paigaam-pay\.js|pc-inline-checkout/);
console.log(JSON.stringify({ localOnly: true, checkoutDisabled: true, freeTemplatesPublishedAndRead: published,
  ownerReplayStable: true, concurrentPublishRequests: results.length, concurrentSlugWinners: 1,
  foreignOwnerRejected: true, paidPublishBlocked: true, publishedAudioVerified: true, builderUnlockedUnderLocalFlags: true }, null, 2));
