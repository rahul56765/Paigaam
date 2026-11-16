import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { verifyAccessRequest } from '../src/access-auth.mjs';

const enc = new TextEncoder();
const generated = await Promise.all([1, 2, 3].map(() => webcrypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']
)));
const jwks = await Promise.all(generated.map(async (pair, i) => ({ ...await webcrypto.subtle.exportKey('jwk', pair.publicKey), kid: `key-${i}`, alg: 'RS256', use: 'sig' })));
const b64 = bytes => Buffer.from(bytes).toString('base64url');
const json = obj => b64(JSON.stringify(obj));
let number = 0;
function env() {
  return { TEAM_DOMAIN: `https://unit${++number}.cloudflareaccess.com`, POLICY_AUD: 'app-audience', ACCESS_ALLOWED_EMAILS: 'Admin@Example.com, staff@example.com' };
}
function claims(cfg, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  return { iss: cfg.TEAM_DOMAIN, aud: [cfg.POLICY_AUD], exp: now + 300, nbf: now - 1, email: 'ADMIN@example.com', ...extra };
}
async function token(payload, { header = {}, key = 0 } = {}) {
  const data = json({ alg: 'RS256', kid: `key-${key}`, typ: 'JWT', ...header }) + '.' + json(payload);
  return data + '.' + b64(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', generated[key].privateKey, enc.encode(data)));
}
function request(t, host = 'https://production.workers.dev/admin') {
  return new Request(host, { headers: t ? { 'Cf-Access-Jwt-Assertion': t } : {} });
}
function mock(t, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  t.after(() => { globalThis.fetch = original; });
}
const response = (keys = [jwks[0]]) => new Response(JSON.stringify({ keys }), { headers: { 'content-type': 'application/json' } });

test('valid signed identity, strict fixed endpoint, explicit case-insensitive allowlist', async t => {
  const cfg = env(); let calls = 0;
  mock(t, async (url, options) => {
    calls++;
    assert.equal(url, `${cfg.TEAM_DOMAIN}/cdn-cgi/access/certs`);
    assert.equal(options.redirect, 'manual');
    return response();
  });
  const signed = await token(claims(cfg));
  assert.deepEqual(await verifyAccessRequest(request(signed), cfg), { email: 'admin@example.com' });
  assert.deepEqual(await verifyAccessRequest(request(signed, 'https://example.com/admin'), cfg), { email: 'admin@example.com' });
  assert.equal(calls, 1);
  assert.equal(await verifyAccessRequest(request(await token(claims(cfg, { email: 'intruder@example.com' }))), cfg), null);
  assert.equal(await verifyAccessRequest(request(await token(claims(cfg, { email: ' admin@example.com' }))), cfg), null);
  assert.equal(await verifyAccessRequest(request(await token(claims(cfg, { email: null }))), cfg), null);
});

test('missing or unsafe configuration and missing assertion fail closed, including on workers.dev', async t => {
  const cfg = env(); let calls = 0;
  mock(t, async () => { calls++; return response(); });
  const signed = await token(claims(cfg));
  for (const changed of [
    { TEAM_DOMAIN: '' }, { TEAM_DOMAIN: 'http://evil.cloudflareaccess.com' },
    { TEAM_DOMAIN: 'https://evil.com' }, { TEAM_DOMAIN: 'https://unit.cloudflareaccess.com.evil.com' },
    { TEAM_DOMAIN: 'https://unit.cloudflareaccess.com/path' }, { TEAM_DOMAIN: 'https://unit.cloudflareaccess.com:443' },
    { TEAM_DOMAIN: 'https://user@unit.cloudflareaccess.com' }, { POLICY_AUD: '' },
    { ACCESS_ALLOWED_EMAILS: '' }, { ACCESS_ALLOWED_EMAILS: 'admin@example.com, ' },
    { ACCESS_ALLOWED_EMAILS: '*' }
  ]) assert.equal(await verifyAccessRequest(request(signed), { ...cfg, ...changed }), null);
  assert.equal(await verifyAccessRequest(request(null), cfg), null);
  assert.equal(calls, 0);
});

test('forgery, temporal claims, issuer, audience and algorithm attacks', async t => {
  const cfg = env(); mock(t, async () => response());
  const base = claims(cfg), now = Math.floor(Date.now() / 1000);
  const valid = await token(base);
  const segments = valid.split('.');
  const forged = [segments[0], json({ ...base, email: 'staff@example.com' }), segments[2]].join('.');
  const wrongPrivate = await token(base, { header: { kid: 'key-0' }, key: 1 });
  const variants = [
    forged, wrongPrivate,
    await token({ ...base, exp: now - 1 }), await token({ ...base, exp: now }),
    await token({ ...base, exp: '9999999999' }), await token({ ...base, exp: null }),
    await token({ ...base, nbf: now + 120 }), await token({ ...base, nbf: '0' }),
    await token({ ...base, iss: 'https://other.cloudflareaccess.com' }),
    await token({ ...base, aud: ['different'] }), await token({ ...base, aud: [cfg.POLICY_AUD, 1] }),
    await token(base, { header: { alg: 'none' } }), await token(base, { header: { alg: 'HS256' } }),
    await token(base, { header: { kid: 'unknown' } }),
    await token(base, { header: { crit: ['b64'], b64: false } }),
    await token(base, { header: { jku: 'https://evil.test/jwks' } }),
    valid + '.', 'x'.repeat(16385), 'x.y.z'
  ];
  for (const candidate of variants) assert.equal(await verifyAccessRequest(request(candidate), cfg), null);
  assert.deepEqual(await verifyAccessRequest(request(await token({ ...base, aud: cfg.POLICY_AUD })), cfg), { email: 'admin@example.com' });
});

test('rotation refreshes unknown kid, while caching and cooldown limit fetches', async t => {
  const cfg = env(); let keys = [jwks[0]], calls = 0;
  mock(t, async () => { calls++; return response(keys); });
  assert.ok(await verifyAccessRequest(request(await token(claims(cfg))), cfg));
  keys = [jwks[0], jwks[1]];
  assert.ok(await verifyAccessRequest(request(await token(claims(cfg), { key: 1 })), cfg));
  assert.equal(calls, 2);
  assert.equal(await verifyAccessRequest(request(await token(claims(cfg), { key: 2 })), cfg), null);
  assert.equal(calls, 2);
});

test('expired cached keys are not trusted if refresh fails or removes the key', async t => {
  const cfg = env(); let now = Date.now(), calls = 0, mode = 'ok';
  const originalNow = Date.now; Date.now = () => now;
  t.after(() => { Date.now = originalNow; });
  mock(t, async () => { calls++; if (mode === 'error') throw Error('offline'); return response(mode === 'removed' ? [jwks[1]] : [jwks[0]]); });
  const signed = await token(claims(cfg, { exp: Math.floor(now / 1000) + 600 }));
  assert.ok(await verifyAccessRequest(request(signed), cfg));
  now += 60_001; mode = 'error';
  assert.equal(await verifyAccessRequest(request(signed), cfg), null);
  mode = 'removed';
  assert.equal(await verifyAccessRequest(request(signed), cfg), null);
  assert.ok(calls >= 3);
});

test('different trusted team domains never share cache keys', async t => {
  const a = env(), b = env(); let calls = 0;
  mock(t, async url => { calls++; return response(url.startsWith(a.TEAM_DOMAIN) ? [jwks[0]] : [jwks[1]]); });
  assert.ok(await verifyAccessRequest(request(await token(claims(a))), a));
  assert.equal(await verifyAccessRequest(request(await token(claims(b))), b), null);
  assert.ok(await verifyAccessRequest(request(await token(claims(b), { key: 1 })), b));
  assert.equal(calls, 3); // unknown kid triggers one refresh
});

test('network, redirects, malformed and oversized JWKS fail closed', async t => {
  const cases = [
    () => { throw Error('offline'); },
    () => new Response('', { status: 302, headers: { location: 'https://evil.test' } }),
    () => new Response('oops', { status: 200 }),
    () => new Response(JSON.stringify({ keys: [jwks[0], jwks[0]] })),
    () => new Response(JSON.stringify({ keys: [{ ...jwks[0], alg: 'HS256' }] })),
    () => new Response(JSON.stringify({ keys: [{ ...jwks[0], use: 'enc' }] })),
    () => new Response(JSON.stringify({ keys: [{ ...jwks[0], n: b64(new Uint8Array(8)) }] })),
    () => new Response('x'.repeat(65537)),
    () => new Response('{}', { headers: { 'content-length': '65537' } }),
  ];
  let which;
  mock(t, async () => cases[which]());
  for (which = 0; which < cases.length; which++) {
    const cfg = env();
    assert.equal(await verifyAccessRequest(request(await token(claims(cfg))), cfg), null, `case ${which}`);
  }
});

test('fetch target and trust are never derived from unverified JWT claims', async t => {
  const cfg = env(), urls = [];
  mock(t, async url => { urls.push(url); return response(); });
  const bad = await token(claims(cfg, { iss: 'https://attacker.example' }), { header: { jku: 'https://attacker.example/certs' } });
  assert.equal(await verifyAccessRequest(request(bad), cfg), null);
  assert.deepEqual(urls, []);
  const forged = await token(claims(cfg, { iss: 'https://attacker.example' }));
  assert.equal(await verifyAccessRequest(request(forged), cfg), null);
  assert.deepEqual(urls, [cfg.TEAM_DOMAIN + '/cdn-cgi/access/certs']);
});
