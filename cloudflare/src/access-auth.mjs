/**
 * Standalone, UNROUTED Cloudflare Access JWT verifier. No authentication is
 * provided until a caller explicitly invokes verifyAccessRequest on EVERY
 * protected request and denies null. This is not a replacement for CSRF,
 * authorization at Access, origin/host checks, or admin route integration.
 *
 * Trusted config (all required): TEAM_DOMAIN = canonical
 * https://<team>.cloudflareaccess.com, POLICY_AUD = exact Access application
 * audience, ACCESS_ALLOWED_EMAILS = comma-separated explicit email addresses.
 * The only identity returned is the signature-verified, allowlisted email.
 * No fallback to cookies, workers.dev bypass, or unverified JWT claims.
 *
 * https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */
const MAX_TOKEN = 16384, MAX_JWKS = 65536, MAX_KEYS = 16;
const TTL_MS = 60_000, UNKNOWN_KID_COOLDOWN_MS = 5000, MAX_DOMAINS = 32;
const cache = new Map();
const inflight = new Map();
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

function config(env) {
  const team = env?.TEAM_DOMAIN, audience = env?.POLICY_AUD, raw = env?.ACCESS_ALLOWED_EMAILS;
  // Require the configured URL itself to be the exact issuer and fixed origin.
  // This also excludes custom hostnames, userinfo, ports, paths and redirects.
  if (typeof team !== 'string' || !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(team)) return null;
  if (typeof audience !== 'string' || !audience || audience.length > 256 || audience.trim() !== audience) return null;
  if (typeof raw !== 'string' || !raw || raw.length > 8192) return null;
  const emails = raw.split(',').map(e => e.trim().toLowerCase());
  if (emails.length > 100 || emails.some(e => !validEmail(e))) return null;
  return { team, audience, emails: new Set(emails) };
}
function validEmail(email) {
  // Deliberately limited to ordinary ASCII addresses; configure exact identities.
  return typeof email === 'string' && email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(email) && !email.includes('..');
}
function decodePart(s) {
  if (!s || !/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 === 1) throw new Error('bad encoding');
  const binary = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  // Reject non-canonical base64url, including nonzero padding bits.
  if (btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') !== s) throw new Error('bad encoding');
  return bytes;
}
function parsePart(s) {
  const obj = JSON.parse(decoder.decode(decodePart(s)));
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad JSON');
  return obj;
}
async function boundedBody(response) {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_JWKS)) throw new Error('large response');
  if (!response.body) throw new Error('empty response');
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JWKS) { await reader.cancel(); throw new Error('large response'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return JSON.parse(decoder.decode(bytes));
}
function usableKey(jwk) {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk) || jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig' || typeof jwk.kid !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(jwk.kid)) return false;
  if (jwk.d || jwk.p || jwk.q || jwk.dp || jwk.dq || jwk.qi || jwk.oth) return false;
  if (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || jwk.key_ops.length !== 1 || jwk.key_ops[0] !== 'verify')) return false;
  try {
    const n = decodePart(jwk.n), e = decodePart(jwk.e);
    return n.length >= 256 && n.length <= 1024 && n[0] >= 128 && e.length >= 1 && e.length <= 4;
  } catch { return false; }
}
async function refresh(team) {
  if (inflight.has(team)) return inflight.get(team);
  const work = (async () => {
    // Never follow an endpoint redirect, even to another HTTPS origin.
    const response = await fetch(team + '/cdn-cgi/access/certs', {
      method: 'GET', redirect: 'manual', headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(5000),
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok || response.status !== 200 || response.redirected) throw new Error('certs unavailable');
    const data = await boundedBody(response);
    if (!data || !Array.isArray(data.keys) || !data.keys.length || data.keys.length > MAX_KEYS) throw new Error('bad keys');
    const keys = new Map();
    for (const key of data.keys) {
      if (!usableKey(key) || keys.has(key.kid)) throw new Error('bad key');
      keys.set(key.kid, key);
    }
    const prior = cache.get(team);
    const entry = { keys, until: Date.now() + TTL_MS, lastUnknownRefresh: prior?.lastUnknownRefresh || 0 };
    if (!cache.has(team) && cache.size >= MAX_DOMAINS) cache.delete(cache.keys().next().value);
    cache.set(team, entry);
    return entry;
  })();
  inflight.set(team, work);
  try { return await work; } finally { if (inflight.get(team) === work) inflight.delete(team); }
}
async function keyFor(team, kid) {
  let entry = cache.get(team);
  if (!entry || Date.now() >= entry.until) entry = await refresh(team);
  if (entry.keys.has(kid)) return entry.keys.get(kid);
  // A previously unknown kid may indicate rotation. Refresh once immediately,
  // with a short per-team cooldown against arbitrary-kid fetch amplification.
  if (Date.now() - entry.lastUnknownRefresh < UNKNOWN_KID_COOLDOWN_MS) return null;
  entry.lastUnknownRefresh = Date.now();
  entry = await refresh(team);
  return entry.keys.get(kid) || null;
}

/** Return { email } only on success; null for every failure, including network. */
export async function verifyAccessRequest(request, env) {
  try {
    const cfg = config(env);
    if (!cfg) return null;
    const token = request?.headers?.get('cf-access-jwt-assertion');
    if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = parsePart(parts[0]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(header.kid) || header.crit !== undefined || header.b64 !== undefined || header.jku !== undefined || header.jwk !== undefined || header.x5u !== undefined || header.x5c !== undefined) return null;
    const signature = decodePart(parts[2]);
    const jwk = await keyFor(cfg.team, header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, encoder.encode(parts[0] + '.' + parts[1]))) return null;
    // Payload is not even interpreted until its signature has been checked.
    const payload = parsePart(parts[1]), now = Date.now() / 1000;
    if (payload.iss !== cfg.team || !Number.isSafeInteger(payload.exp) || payload.exp <= now) return null;
    if (payload.nbf !== undefined && (!Number.isSafeInteger(payload.nbf) || payload.nbf > now)) return null;
    const aud = payload.aud;
    if (!(typeof aud === 'string' ? aud === cfg.audience : Array.isArray(aud) && aud.length > 0 && aud.every(a => typeof a === 'string') && aud.includes(cfg.audience))) return null;
    if (typeof payload.email !== 'string' || payload.email.length > 254) return null;
    const email = payload.email.toLowerCase();
    if (!validEmail(email) || !cfg.emails.has(email)) return null;
    return { email };
  } catch { return null; }
}
