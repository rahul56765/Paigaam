import { REQUEST_RATE } from './admission-policy.mjs';
import { fail } from './security.mjs';

// CF-Connecting-IP is the only client address consulted. Reject hostnames,
// ports, brackets, scope IDs, whitespace, lists and ambiguous IPv4 notation.
// Expand IPv6 to eight fixed-width groups so alternate spellings use one key;
// IPv4-mapped IPv6 literals share the equivalent IPv4 key.
function ipv4Bytes(value) {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const bytes = [];
  for (const part of parts) {
    if (!/^(?:0|[1-9][0-9]{0,2})$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}
export function canonicalIp(value) {
  if (typeof value !== 'string' || !value || value.length > 45 || /[^0-9a-fA-F:.]/.test(value)) return null;
  if (!value.includes(':')) {
    const bytes = ipv4Bytes(value);
    return bytes ? '4:' + bytes.join('.') : null;
  }
  const sides = value.split('::');
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
  // A lone leading or trailing colon is not a compressed zero run.
  if (sides.length === 1 && (value.startsWith(':') || value.endsWith(':'))) return null;
  const tokens = [...left, ...right];
  const groups = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.includes('.')) {
      if (i !== tokens.length - 1 || !value.endsWith(token)) return null;
      const bytes = ipv4Bytes(token);
      if (!bytes) return null;
      groups.push(bytes[0] * 256 + bytes[1], bytes[2] * 256 + bytes[3]);
    } else {
      if (!/^[0-9a-fA-F]{1,4}$/.test(token)) return null;
      groups.push(parseInt(token, 16));
    }
  }
  const missing = 8 - groups.length;
  if ((sides.length === 1 && missing !== 0) || (sides.length === 2 && missing < 1)) return null;
  // Count left groups separately because an embedded IPv4 tail takes two.
  const leftCount = left.reduce((n, token) => n + (token.includes('.') ? 2 : 1), 0);
  const expanded = [...groups.slice(0, leftCount), ...Array(missing).fill(0), ...groups.slice(leftCount)];
  if (expanded.length !== 8) return null;
  if (expanded.slice(0, 5).every(n => n === 0) && expanded[5] === 0xffff) {
    return '4:' + [expanded[6] >> 8, expanded[6] & 255, expanded[7] >> 8, expanded[7] & 255].join('.');
  }
  return '6:' + expanded.map(n => n.toString(16).padStart(4, '0')).join(':');
}

// A dedicated secret is required; operators must generate 32 random bytes and
// encode them as 64 hexadecimal characters. Format checks cannot prove entropy.
function keyBytes(env) {
  const value = env?.RATE_LIMIT_HMAC_KEY;
  if (typeof value !== 'string' || value.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(value)) return null;
  const bytes = Uint8Array.from(value.match(/../g), pair => parseInt(pair, 16));
  // Obvious placeholders are invalid; this check does not prove real entropy.
  return bytes.every(byte => byte === bytes[0]) ? null : bytes;
}
export function hasRateLimitKey(env) { return keyBytes(env) !== null; }
const unavailable = () => fail('rate_limit_unavailable', 503);

// Readiness only controls the staged builder UI. The actual operation always
// performs its own atomic admission, and fails closed on a missing table/key.
export async function rateLimiterReady(env) {
  if (!hasRateLimitKey(env) || !env?.DB) return false;
  try { await env.DB.prepare('SELECT 1 FROM request_rate_counters LIMIT 1').first(); return true; }
  catch { return false; }
}

const UPSERT = `INSERT INTO request_rate_counters (ip_digest, action, window_start, window_end, hits)
  VALUES (?, ?, ?, ?, 1)
  ON CONFLICT(ip_digest, action) DO UPDATE SET
    window_start = excluded.window_start,
    window_end = excluded.window_end,
    hits = CASE WHEN request_rate_counters.window_start < excluded.window_start
                THEN 1 ELSE request_rate_counters.hits + 1 END
  WHERE request_rate_counters.window_start < excluded.window_start
     OR (request_rate_counters.window_start = excluded.window_start AND request_rate_counters.hits < ?)
  RETURNING hits`;
// Opportunistic, bounded deletion after a full extra day, in the same batch.
// It is not guaranteed retention: idle deployments need an approved cleanup plan.
const PRUNE = `DELETE FROM request_rate_counters WHERE (ip_digest, action) IN (
  SELECT ip_digest, action FROM request_rate_counters WHERE window_end <= ? ORDER BY window_end LIMIT 20
)`;

// D1 executes batch statements sequentially, in one transaction. The single
// conditional UPSERT is the admission decision; there is no read-then-write
// race and no isolate-local counter. All downstream failure/denial still spends
// the token. A failed/uncertain batch never authorizes the business mutation.
export async function enforceRequestRate(request, env, action, nowMs = Date.now()) {
  const policy = Object.hasOwn(REQUEST_RATE, action) ? REQUEST_RATE[action] : null;
  const ip = canonicalIp(request.headers.get('cf-connecting-ip'));
  const key = keyBytes(env);
  if (!policy || !ip || !key || !env?.DB || typeof env.DB.batch !== 'function' ||
      !Number.isSafeInteger(nowMs) || nowMs < 0) throw unavailable();
  const now = Math.floor(nowMs / 1000);
  const start = Math.floor(now / policy.seconds) * policy.seconds;
  const end = start + policy.seconds;
  let batch;
  try {
    const hmac = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    // Action domain separation avoids linking separate action counters by their digest.
    const data = new TextEncoder().encode('paigaam:request-rate:v1\0' + action + '\0' + ip);
    const digest = [...new Uint8Array(await crypto.subtle.sign('HMAC', hmac, data))]
      .map(x => x.toString(16).padStart(2, '0')).join('');
    batch = await env.DB.batch([
      env.DB.prepare(UPSERT).bind(digest, action, start, end, policy.max),
      env.DB.prepare(PRUNE).bind(now - 24 * 60 * 60),
    ]);
  } catch {
    // Never echo a D1/crypto exception, which could contain SQL values.
    throw unavailable();
  }
  if (!Array.isArray(batch) || batch.length !== 2 || batch.some(r => r?.success !== true) ||
      !Array.isArray(batch[0].results) || batch[0].results.length > 1) throw unavailable();
  if (!batch[0].results.length) {
    const error = fail('rate_limited', 429);
    error.retryAfter = Math.max(1, end - now);
    throw error;
  }
  const hits = batch[0].results[0]?.hits;
  if (!Number.isSafeInteger(hits) || hits < 1 || hits > policy.max) throw unavailable();
}
