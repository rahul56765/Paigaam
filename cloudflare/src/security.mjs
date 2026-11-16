// Stateless request helpers. Never use an in-memory map as a checkout lock.
export function fail(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
export function randomHex(bytes = 24) { return [...crypto.getRandomValues(new Uint8Array(bytes))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function hash(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function cookieToken(request) {
  const item = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('paigaam_creator='));
  const value = item?.slice('paigaam_creator='.length) || '';
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function identity(request, create = false) {
  const token = cookieToken(request) || (create ? randomHex(32) : null);
  return { token, hash: token ? await hash(token) : null, cookie: token && !cookieToken(request) ? `paigaam_creator=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` : null };
}
export function assertOrigin(request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) throw fail('forbidden', 403);
}
export async function readBytes(request, limit) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw fail('too_large', 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw fail('too_large', 413); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size); let at = 0; for (const chunk of chunks) { data.set(chunk, at); at += chunk.length; } return data;
}
export async function readJSON(request, limit = 65536) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw fail('invalid_content_type', 415);
  let body; try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBytes(request, limit))); } catch (e) { if (e?.status) throw e; throw fail('validation'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw fail('validation'); return body;
}
export function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } }); }
export function html(value, status = 200, headers = {}) { return new Response(value, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Robots-Tag': 'noindex, nofollow', ...headers } }); }
