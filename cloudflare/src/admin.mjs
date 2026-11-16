/**
 * Fresh D1 admin foundation. NOT ROUTED by this module. Integration contract:
 *   import { handleAdmin } from './admin.mjs';
 *   const response = await handleAdmin(request, env); if (response) return response;
 * Invoke before other routes/assets for /admin and /admin/*, and never cache.
 * Returns null for unrelated paths. Do not route production until migration,
 * security/integration tests and access policies have been reviewed.
 *
 * Required Cloudflare secrets/environment (no default values):
 * ADMIN_USERNAME: exact UTF-8 username (1-254 bytes).
 * ADMIN_PASSWORD_VERIFIER: pbkdf2-sha256$ITERATIONS$SALT_HEX$HASH_HEX, where
 *   iterations is 600000..2000000, salt is 16..64 random bytes, hash 32 bytes.
 *   Generate offline from a strong password with Web Crypto PBKDF2 SHA-256;
 *   store the verifier and username as secrets, never a plaintext password.
 * ADMIN_ORIGIN: exact canonical HTTPS origin, e.g. https://example.com, no slash,
 *   path, credentials, query or fragment. Edge must reject untrusted hosts.
 * DB: D1 binding with 0001_initial.sql and 0002_admin.sql applied.
 * Secrets changes invalidate all sessions. New D1 contains NO legacy records.
 * IMPORTANT: Workers production has historically capped Web Crypto PBKDF2 at
 * 100000 iterations (local workerd may not). If this deployment cannot perform
 * the configured >=600000 iterations, login fails closed with 503. Verify actual
 * runtime capability/CPU limits before any enablement; do not lower the work
 * factor as a workaround. https://github.com/cloudflare/workerd/issues/1346
 * A single global fixed-window login budget (5 attempts per 15 minutes) is
 * intentionally conservative and can be exhausted by an attacker (availability
 * tradeoff); add separate edge protections before enabling. It includes successful
 * attempts and is not reset on success. D1 errors always fail closed.
 *
 * Form routes: GET/POST /admin/login (email,password), GET /admin,
 * GET /admin/templates, POST /admin/templates/:slug/price (csrf,price integer
 * paise 0..100000000, INR templates only), POST /admin/logout (csrf).
 * Strict Origin required on POST.
 * No creator, orders detail, magazine, create/delete or legacy import support.
 */
import layout from '../../lib/layout.js';
import brand from '../../lib/brand.js';
import { readBytes } from './security.mjs';
const { esc } = layout;
const encoder = new TextEncoder();
const COOKIE = '__Host-paigaam_admin';
const TTL = 8 * 60 * 60;
const WINDOW = 15 * 60;
const BUDGET = 5;
const MAX_PRICE = 100000000;
const now = () => Math.floor(Date.now() / 1000);
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const unhex = s => new Uint8Array(s.match(/../g).map(x => parseInt(x, 16)));
const sha = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
// Compare fixed-size SHA-256 digests without an early exit.
function equalHex(a, b) {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  let diff = 0; for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function settings(env) {
  const username = env?.ADMIN_USERNAME, verifier = env?.ADMIN_PASSWORD_VERIFIER, origin = env?.ADMIN_ORIGIN;
  if (typeof username !== 'string' || !username || encoder.encode(username).length > 254 || typeof verifier !== 'string' || typeof origin !== 'string' || !env.DB?.prepare) return null;
  const m = /^pbkdf2-sha256\$(\d{6,7})\$([0-9a-f]{32,128})\$([0-9a-f]{64})$/.exec(verifier);
  if (!m || m[2].length % 2 || +m[1] < 600000 || +m[1] > 2000000) return null;
  let u; try { u = new URL(origin); } catch { return null; }
  if (u.protocol !== 'https:' || u.origin !== origin || u.username || u.password) return null;
  return { username, verifier, origin, iterations: +m[1], salt: unhex(m[2]), expected: m[3] };
}
const headers = {
  'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
function response(text, status = 200, extra = {}) {
  return new Response(text, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', ...extra } });
}
function redirect(location, cookie) { return response('', 303, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) }); }
const expireCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
const createCookie = token => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;
function getToken(request) {
  const values = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(COOKIE + '='));
  if (values.length !== 1) return null;
  const t = values[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(t) ? t : null;
}
function checkOrigin(req, cfg) {
  return req.headers.get('origin') === cfg.origin && req.headers.get('sec-fetch-site') !== 'cross-site';
}
async function form(req) {
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) throw new Error('bad form');
  const bytes = await readBytes(req, 4096);
  const p = new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  for (const key of new Set(p.keys())) if (p.getAll(key).length !== 1) throw new Error('duplicate');
  return p;
}
async function session(req, db, configHash) {
  const token = getToken(req); if (!token) return null;
  const tokenHash = await sha(token);
  const row = await db.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND config_hash = ? AND expires_at > ?').bind(tokenHash, configHash, now()).first();
  return row ? { tokenHash, csrf: await sha('paigaam-admin-csrf:' + token) } : null;
}
function checkCsrf(formData, s) { return equalHex(formData.get('csrf') || '', s.csrf); }
function head(title) {
  // Use original Paigaam head and CSS, but not legacy creator scripts.
  return layout.head(title, '', { robots: 'noindex,nofollow' })
    .replace(/<link[^>]+href="\/css\/creator-coupon\.css[^>]*>\s*/g, '')
    .replace(/<script[^>]*><\/script>\s*/g, '');
}
function login(error = '') {
  return head('Paigaam Studio — Admin sign in') + `<body class="admin-login"><main class="admin-login__layout"><section class="admin-login__story" aria-label="Paigaam Studio"><a href="/" class="admin-login__brand" aria-label="Paigaam home">${brand.logoFull(138, 'Paigaam')}</a><p class="admin__eyebrow">PRIVATE STUDIO · EST. IN CARE</p><div class="admin-login__story-copy"><span class="admin-login__seal" aria-hidden="true">P</span><h1>Meaningful things,<br>beautifully made.</h1><p>A quieter place to tend every note, keepsake and celebration.</p></div><div class="admin-login__story-foot"><span>PAIGAAM · STUDIO ADMIN</span><span aria-hidden="true">✳</span></div></section><section class="admin-login__form" aria-labelledby="adminLoginTitle"><div class="admin-login__form-inner"><p class="admin__eyebrow">YOUR WORKSPACE</p><h2 id="adminLoginTitle">Welcome back.</h2><p class="admin-login__lede">Sign in to manage the studio.</p>${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ''}<form method="POST" action="/admin/login" class="admin-login__fields"><div class="field"><label for="email">Email</label><input class="input" type="text" id="email" name="email" required autocomplete="username"></div><div class="field"><label for="password">Password</label><input class="input" type="password" id="password" name="password" required autocomplete="current-password"></div><button class="btn btn--primary" type="submit">Enter the studio <span aria-hidden="true">→</span></button></form><a class="admin-login__back" href="/">← Back to Paigaam</a></div></section></main></body></html>`;
}
function shell(current, title, content, csrf) {
  const link = (href, label) => `<li><a href="${href}" ${current === href ? 'aria-current="page"' : ''}><span>${label}</span></a></li>`;
  return head(title) + `<body><div class="admin"><aside class="admin__side"><div class="admin__brand-row"><a href="/" class="nav__brand" aria-label="Paigaam home">${brand.logoFull(120, 'Paigaam')}</a><span class="admin__brand-note">STUDIO CONSOLE</span></div><nav class="admin__navigation" aria-label="Admin navigation"><div class="admin__nav-caption">Workspace</div><ul class="admin__nav">${link('/admin','Overview')}${link('/admin/templates','Templates')}</ul></nav><div class="admin__side-bottom"><div class="admin__side-foot"><span class="admin__status-dot"></span><span><b>Paigaam</b><small>STUDIO ADMIN</small></span></div><form method="POST" action="/admin/logout"><input type="hidden" name="csrf" value="${csrf}"><button class="admin__signout" type="submit">Sign out</button></form></div></aside><nav class="admin__mobile-nav" aria-label="Quick admin navigation"><a href="/admin">Home</a><a href="/admin/templates">Templates</a><form method="POST" action="/admin/logout"><input type="hidden" name="csrf" value="${csrf}"><button type="submit">Sign out</button></form></nav><main class="admin__main">${content}</main></div></body></html>`;
}
function overview(stats, csrf) {
  const date = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const metric = (label,n,note) => `<div class="admin__metric"><span class="admin__metric-label">${label}</span><strong>${n}</strong><span class="admin__metric-note">${note}</span></div>`;
  return shell('/admin', 'Dashboard', `<section class="admin__welcome" aria-labelledby="adminWelcome"><div class="admin__welcome-copy"><p class="admin__eyebrow">OVERVIEW · ${esc(date)}</p><h1 id="adminWelcome">Your Paigaam, in good order.</h1><p>One calm place to tend every greeting, keepsake and invitation.</p></div><span class="admin__welcome-mark" aria-hidden="true">P<span>✳</span></span></section><section class="admin__metrics" aria-label="Paigaam activity">${metric('Templates',stats.templates,'Ready to personalize')}${metric('Paigaams',stats.paigaams,'Created with care')}${metric('Orders',stats.orders,'Across your studio')}${metric('Published',stats.published,'Out in the world')}</section><p>Fresh Cloudflare data only; legacy records have not been imported.</p>`, csrf);
}
function templates(rows, csrf) {
  return shell('/admin/templates', 'Templates', `<div class="admin__head"><h1>Templates</h1></div><p>Prices are in paise (100 paise = ₹1). Changes affect new quotes only.</p><div class="admin__table-wrap"><table class="table"><thead><tr><th>Name</th><th>Price</th><th>Update price (paise)</th></tr></thead><tbody>${rows.map(t => `<tr><td data-label="Template" class="serif">${esc(t.name)}</td><td data-label="Price">${esc(t.currency)} ${esc((t.price / 100).toFixed(2))}</td><td data-label="Update price">${t.currency === 'INR' ? `<form method="POST" action="/admin/templates/${encodeURIComponent(t.slug)}/price"><input type="hidden" name="csrf" value="${csrf}"><label>Paise <input class="input" type="number" name="price" min="0" max="${MAX_PRICE}" step="1" value="${esc(t.price)}" required></label> <button class="btn btn--small" type="submit">Save price</button></form>` : 'Not supported for this currency'}</td></tr>`).join('')}</tbody></table></div>`, csrf);
}
async function verifyPassword(password, cfg) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const value = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:cfg.salt, iterations:cfg.iterations }, key, 256);
  return equalHex(hex(new Uint8Array(value)), cfg.expected);
}
export async function handleAdmin(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path !== '/admin' && !path.startsWith('/admin/')) return null;
  const cfg = settings(env);
  if (!cfg || url.origin !== cfg.origin) return response('Admin unavailable', 503);
  try {
    // Verify both durable tables exist even on public sign-in, rather than
    // accidentally allowing an unprotected mode if migration is missing.
    await env.DB.prepare('SELECT (SELECT count(*) FROM admin_sessions) + (SELECT count(*) FROM admin_login_limits) AS n').first();
    const configHash = await sha(JSON.stringify([cfg.username, cfg.verifier]));
    if (request.method === 'POST' && !checkOrigin(request, cfg)) return response('Forbidden', 403);
    if (request.method === 'GET' && path === '/admin/login') {
      return (await session(request, env.DB, configHash)) ? redirect('/admin') : response(login());
    }
    if (request.method === 'POST' && path === '/admin/login') {
      // Atomic global fixed window; DB failure or malformed result is closed.
      const time = now();
      const limit = await env.DB.prepare(`INSERT INTO admin_login_limits (bucket, attempts, window_until) VALUES ('global', 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = CASE WHEN window_until <= ? THEN 1 ELSE attempts + 1 END, window_until = CASE WHEN window_until <= ? THEN excluded.window_until ELSE window_until END RETURNING attempts`).bind(time + WINDOW, time, time).first();
      if (!Number.isSafeInteger(limit?.attempts) || limit.attempts < 1) throw new Error('rate limit unavailable');
      if (limit.attempts > BUDGET) return response('Too many sign-in attempts. Try again later.', 429, { 'Retry-After': String(WINDOW) });
      let p; try { p = await form(request); } catch { return response(login('Those details don\'t match our records.'), 401); }
      const username = p.get('email') || '', password = p.get('password') || '';
      // Bound CPU/memory input while still performing a KDF for wrong usernames.
      const bounded = encoder.encode(password).length <= 1024 && encoder.encode(username).length <= 254;
      const passOK = await verifyPassword(bounded ? password : '', cfg);
      const userOK = equalHex(await sha(username.slice(0, 254)), await sha(cfg.username));
      if (!bounded || !passOK || !userOK) return response(login('Those details don\'t match our records.'), 401);
      const token = random();
      const inserted = await env.DB.prepare('INSERT INTO admin_sessions (token_hash, config_hash, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(await sha(token), configHash, time + TTL, time).run();
      if (!inserted.success || inserted.meta?.changes !== 1) throw new Error('session unavailable');
      return redirect('/admin', createCookie(token));
    }
    const s = await session(request, env.DB, configHash);
    if (!s) return redirect('/admin/login', expireCookie());
    if (request.method === 'POST' && path === '/admin/logout') {
      let p; try { p = await form(request); } catch { return response('Forbidden', 403); }
      if (!checkCsrf(p,s)) return response('Forbidden', 403);
      const deleted = await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(s.tokenHash).run();
      if (!deleted.success || deleted.meta?.changes !== 1) throw new Error('logout unavailable');
      return redirect('/admin/login', expireCookie());
    }
    if (request.method === 'GET' && path === '/admin') {
      const stats = await env.DB.prepare("SELECT (SELECT count(*) FROM templates) AS templates, (SELECT count(*) FROM invites) AS paigaams, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM invites WHERE status = 'published') AS published").first();
      return response(overview(stats,s.csrf));
    }
    if (request.method === 'GET' && path === '/admin/templates') {
      const rows = await env.DB.prepare('SELECT slug, name, price, currency FROM templates ORDER BY name, slug').all();
      return response(templates(rows.results, s.csrf));
    }
    const m = /^\/admin\/templates\/([a-z0-9-]{1,100})\/price$/.exec(path);
    if (request.method === 'POST' && m) {
      let p; try { p = await form(request); } catch { return response('Forbidden', 403); }
      if (!checkCsrf(p,s)) return response('Forbidden', 403);
      const price = p.get('price');
      if (price === null || !/^(0|[1-9][0-9]{0,8})$/.test(price) || Number(price) > MAX_PRICE) return response('Invalid price',400);
      // One statement: authenticated, unexpired session and price update are
      // checked atomically, including if logout races the request.
      const r = await env.DB.prepare("UPDATE templates SET price = ? WHERE slug = ? AND currency = 'INR' AND EXISTS (SELECT 1 FROM admin_sessions WHERE token_hash = ? AND config_hash = ? AND expires_at > ?)").bind(Number(price), m[1], s.tokenHash, configHash, now()).run();
      if (!r.success) throw new Error('update failed');
      if (r.meta.changes !== 1) return response('Not found or session expired', 404);
      return redirect('/admin/templates');
    }
    return response('Not found', 404);
  } catch {
    // Never disclose credentials, SQL, internal errors or request bodies.
    return response('Admin unavailable', 503);
  }
}
