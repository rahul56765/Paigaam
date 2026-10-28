'use strict';
const crypto = require('node:crypto');
const store = require('./store');
const { q } = require('../../db');
const views = require('../../pages/creators');
const photos = require('./photos');
const COOKIE = 'pg_partner_session';
const LOGIN_COOKIE = 'pg_partner_login_csrf';
const secret = crypto.randomBytes(32);
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
function cookies(req) {
  const result = Object.create(null);
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { result[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch {} }
  }
  return result;
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length > 1024 || b.length > 1024) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const sign = (value) => crypto.createHmac('sha256', secret).update(value).digest('hex');
function setCookie(res, name, value, secure, age) {
  const existing = res.getHeader('Set-Cookie');
  const values = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  res.setHeader('Set-Cookie', [...values, `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`]);
}
function headers(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // Keep same-origin form Origin intact; never send console referrers cross-origin.
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}
function send(res, status, html) { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return true; }
function redirect(res, url) { res.writeHead(303, { Location: url }); res.end(); return true; }
function error(res, status, message) { return send(res, status, views.errorPage(status, message)); }
function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], exceeded = false;
    if (Number(req.headers['content-length']) > 16384) { req.resume(); return reject(Object.assign(new Error('Form too large.'), { status: 413 })); }
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk);
      if (size > 16384) { exceeded = true; chunks = []; } else if (!exceeded) chunks.push(Buffer.from(chunk));
    });
    req.on('end', () => exceeded ? reject(Object.assign(new Error('Form too large.'), { status: 413 })) : resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('Request interrupted.')));
  });
}
function limited(key, max) {
  const now = Date.now();
  if (attempts.size >= 10000) {
    for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
    if (attempts.size >= 10000 && !attempts.has(key)) return true;
  }
  let value = attempts.get(key);
  if (!value || value.until <= now) { value = { count: 0, until: now + WINDOW }; attempts.set(key, value); }
  return ++value.count > max;
}
function clientIp(req) {
  // Only opt in when the deployment's reverse proxy overwrites X-Forwarded-For.
  if (process.env.CREATOR_TRUST_PROXY === '1') return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().slice(0, 128);
  return String(req.socket.remoteAddress || 'unknown').slice(0, 128);
}
function loginToken(res, secure) {
  const raw = `${Date.now()}.${crypto.randomBytes(24).toString('hex')}`;
  const token = `${raw}.${sign('login:' + raw)}`;
  setCookie(res, LOGIN_COOKIE, token, secure, 1800);
  return token;
}
function validLogin(token) {
  if (!token) return false;
  const bits = token.split('.');
  const time = Number(bits[0]);
  return bits.length === 3 && Number.isFinite(time) && time <= Date.now() && Date.now() - time < 1800000 && equal(bits[2], sign('login:' + bits.slice(0, 2).join('.')));
}
function integer(value, max, label) {
  if (!/^\d+$/.test(value || '') || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw Object.assign(new Error(`${label} is invalid.`), { code: 'validation' });
  return Number(value);
}
function paise(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(value || '')) throw Object.assign(new Error('Enter a valid amount with at most two decimal places.'), { code: 'validation' });
  const [whole, fraction = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw Object.assign(new Error('Enter a positive amount.'), { code: 'validation' });
  return amount;
}
function basisPoints(form, name, max) {
  const raw=form.get(name + '_percent');
  if (raw === null) return integer(form.get(name + '_bps'),max,name);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw)) throw Object.assign(new Error('Enter a valid percentage with up to two decimal places.'),{code:'validation'});
  const parts=raw.split('.'), bps=Number(parts[0])*100+Number((parts[1] || '').padEnd(2,'0'));
  if (bps>max) throw Object.assign(new Error('Percentage exceeds the allowed maximum.'),{code:'validation'});
  return bps;
}
function optionalAmount(value) {
  if (value === '0' || value === '0.0' || value === '0.00' || value === '') return 0;
  return paise(value);
}
function expiryIST(value) {
  if (!value) return '';
  // datetime-local is deliberately interpreted as IST, never the host timezone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Object.assign(new Error('Enter a valid expiry date and time in IST.'), { code: 'validation' });
  const parsed = new Date(value + ':00+05:30');
  if (!Number.isFinite(parsed.valueOf()) || new Date(parsed.valueOf() + 330 * 60000).toISOString().slice(0,16) !== value) throw Object.assign(new Error('Enter a valid expiry date and time in IST.'), { code: 'validation' });
  return parsed.toISOString();
}
function creatorFields(form, create) {
  const data = { display_name: form.get('display_name') || '', commission_bps: basisPoints(form, 'commission', 10000), coupon_code: (form.get('coupon_code') || '').trim().toUpperCase(), discount_bps: basisPoints(form, 'discount', 9000), active: form.get('active') === '1' };
  // Old integrations/forms omit these fields: preserve them on update, let store defaults apply on create.
  if (form.has('discount_type')) data.discount_type = form.get('discount_type');
  for (const [name, field] of [['discount_flat', 'discount_flat_paise'], ['discount_min', 'discount_min_paise'], ['discount_max', 'discount_max_paise']]) {
    if (form.has(name)) data[field] = optionalAmount(form.get(name));
  }
  if (form.has('coupon_expires_at')) data.coupon_expires_at = expiryIST(form.get('coupon_expires_at'));
  if (form.get('coupon_controls_present') === '1') data.coupon_enabled = form.get('coupon_enabled') === '1';
  if (create) { data.username = (form.get('username') || '').trim().toLowerCase(); data.password = form.get('password') || ''; }
  else if (form.get('password')) data.password = form.get('password');
  return data;
}
function readableError(err) {
  // Only validation/business messages from the contracted store are safe to show.
  return err.code && !String(err.code).startsWith('ERR_') && !String(err.code).startsWith('SQLITE') ? String(err.message).slice(0, 300) : 'The change could not be saved. Please check your entries and try again.';
}
async function handle(req, res, u, { baseUrl, admin } = {}) {
  const path = u.pathname;
  const isCreator = path === '/creator' || path === '/creator/login' || path === '/creator/logout' || path === '/creator/templates';
  const match = path.match(/^\/admin\/creators(?:\/([a-zA-Z0-9_-]+)(\/payout|\/photo|\/photo\/remove)?)?$/);
  const photo = path.match(/^\/creator\/photos\/([a-zA-Z0-9_-]{1,128})\/([a-f0-9]{64})\.jpg$/);
  if (!isCreator && !match && !photo) return false;
  headers(res);
  const origin = new URL(baseUrl || 'http://localhost').origin;
  const secure = origin.startsWith('https:') || !!req.socket.encrypted;
  const jar = cookies(req);
  const session = jar[COOKIE] ? store.getSession(jar[COOKIE]) : null;
  const partner = session && session.creator && session.creator.active ? session : null;
  const method = req.method;
  if (photo) {
    if (!['GET', 'HEAD'].includes(method)) { res.setHeader('Allow', 'GET, HEAD'); return error(res, 405, 'This photo is read-only.'); }
    if (!admin && (!partner || partner.creator.id !== photo[1])) return error(res, 404, 'Photo not found.');
    const owner = store.getCreator(photo[1]);
    if (!owner || owner.profile_image !== path) return error(res, 404, 'Photo not found.');
    const bytes = await photos.readPhoto(photo[1], path);
    if (!bytes) return error(res, 404, 'Photo not found.');
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': bytes.length });
    res.end(method === 'HEAD' ? undefined : bytes);
    return true;
  }
  const expected = path === '/creator/logout' || (match && match[2]) ? ['POST'] : ['GET', 'POST'];
  if ((path === '/creator' || path === '/creator/templates') ? method !== 'GET' : !expected.includes(method)) {
    res.setHeader('Allow', path === '/creator' || path === '/creator/templates' ? 'GET' : expected.join(', '));
    return error(res, 405, 'This action is not available with that request method.');
  }
  if (match && !admin) return redirect(res, '/admin/login');
  if (isCreator && path !== '/creator/login' && !partner) return redirect(res, '/creator/login');
  const adminToken = jar.paigaam_session || '';
  if (match && !adminToken) return error(res, 403, 'Please sign in to the admin console again.');
  const csrf = match ? sign(`admin:${admin.id}:${adminToken}`) : partner?.csrf;
  if (match && match[2] === '/photo') {
    // Binary uploads have their own CSRF header; ordinary forms NEVER accept it.
    if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return error(res, 403, 'This request did not come from your console.');
    if (!equal(req.headers['x-csrf-token'], csrf)) return error(res, 403, 'Your form expired. Reload the page and try again.');
    const owner = store.getCreator(match[1]);
    if (!owner) return error(res, 404, 'This partner could not be found.');
    if (limited(`photo:${admin.id}:${clientIp(req)}`, 20)) { res.setHeader('Retry-After', '900'); return error(res, 429, 'Too many photo uploads. Please try again in 15 minutes.'); }
    const mime = String(req.headers['content-type'] || '').toLowerCase().trim();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return error(res, 415, 'Choose a JPG, PNG or WebP image.');
    let url;
    try {
      url = await photos.savePhoto(owner.id, await photos.readBody(req), mime);
      store.updateProfileImage(owner.id, url, admin.id);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ profile_image: url }));
      return true;
    } catch (err) {
      if (url) await photos.removePhoto(owner.id, url).catch(() => {});
      return error(res, err.status || 500, err.code === 'invalid_photo' ? err.message : 'Photo could not be saved. Please try again.');
    }
  }
  let form;
  if (method === 'POST') {
    if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return error(res, 403, 'This request did not come from your console.');
    if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/x-www-form-urlencoded')) return error(res, 415, 'Please submit the console form.');
    try { form = await body(req); } catch (err) { return error(res, err.status || 400, err.status === 413 ? 'This form is too large.' : 'The form could not be read.'); }
    const supplied = form.get('csrf');
    const valid = path === '/creator/login' ? validLogin(jar[LOGIN_COOKIE]) && equal(supplied, jar[LOGIN_COOKIE]) : equal(supplied, csrf);
    if (!valid) return error(res, 403, 'Your form expired. Reload the page and try again.');
  }
  if (path === '/creator/login') {
    if (method === 'GET') return partner ? redirect(res, '/creator') : send(res, 200, views.loginPage({ csrf: loginToken(res, secure) }));
    const username = (form.get('username') || '').trim().toLowerCase().slice(0, 256);
    const ip = clientIp(req);
    const ipLimit = limited(`ip:${ip}`, 30);
    const pairLimit = !ipLimit && limited(`pair:${ip}:${username}`, 8);
    if (ipLimit || pairLimit) { res.setHeader('Retry-After', '900'); return send(res, 429, views.loginPage({ csrf: loginToken(res, secure), error: 'Too many sign-in attempts. Please try again in 15 minutes.' })); }
    const password = form.get('password') || '';
    const creator = password.length <= 256 ? store.authenticate(username, password) : null;
    if (!creator || !creator.active) return send(res, 401, views.loginPage({ csrf: loginToken(res, secure), error: 'Unable to sign in with those details.' }));
    if (jar[COOKIE]) store.deleteSession(jar[COOKIE]);
    setCookie(res, COOKIE, store.createSession(creator.id), secure, 7 * 86400);
    setCookie(res, LOGIN_COOKIE, '', secure, 0);
    return redirect(res, '/creator');
  }
  if (path === '/creator/logout') {
    store.deleteSession(jar[COOKIE]); setCookie(res, COOKIE, '', secure, 0);
    return redirect(res, '/creator/login');
  }
  if (path === '/creator' || path === '/creator/templates') {
    const days = [7, 30, 90].includes(Number(u.searchParams.get('days'))) ? Number(u.searchParams.get('days')) : 30;
    if (path === '/creator') return send(res, 200, views.dashboardPage({ data: store.dashboard(partner.creator.id, { days }), days, csrf }));
    const search = (u.searchParams.get('q') || '').trim().slice(0, 100);
    const magazines = require('../magazines/store').listMappings('published').map(m => ({slug:m.slug,name:m.name,description:m.tagline || '',category:'Magazine',price:m.price,currency:m.currency || 'INR',thumbnail_url:m.thumbnailUrl || '',product_type:'magazine'}));
    const templates = [...q.templatesPublished(),...magazines].filter(t => `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(search.toLowerCase()));
    return send(res, 200, views.templatesPage({ creator: partner.creator, csrf, templates, search, baseUrl: origin }));
  }
  const id = match[1];
  const creator = id ? store.getCreator(id) : null;
  if (id && !creator) return error(res, 404, 'This partner could not be found.');
  const adminPage = (message, status = 200) => send(res, status, id
    ? views.adminDetailPage({ data: store.dashboard(id, { days: 30 }), csrf, error: message, idempotencyKey: crypto.randomUUID(), saved: u.searchParams.get('saved') === '1', photoFailed: u.searchParams.get('photo') === 'failed' })
    : views.adminListPage({ creators: store.listCreators(), summary: {...store.adminSummary(),fulfillment_pending:require('../../db').db.prepare("SELECT * FROM partner_fulfillment WHERE status='pending' ORDER BY updated_at DESC").all()}, csrf, error: message }));
  if (method === 'GET') return adminPage();
  try {
    if (match[2] === '/photo/remove') {
      store.updateProfileImage(id, '', admin.id);
      // Old files are intentionally retained; GET only serves the currently assigned path.
    } else if (match[2] === '/payout') {
      store.recordPayout(id, { amount_paise: paise(form.get('amount')), reference: (form.get('reference') || '').trim(), note: form.get('note') || '', idempotency_key: form.get('idempotency_key') || '' }, admin.id);
    } else if (id) store.updateCreator(id, creatorFields(form, false), admin.id);
    else {
      const created = store.createCreator(creatorFields(form, true), admin.id);
      const url = `/admin/creators/${encodeURIComponent(created.id)}`;
      if (String(req.headers.accept || '').split(',').some(value => value.trim() === 'application/json')) {
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ url: `${url}?saved=1`, photo_upload_url: `${url}/photo`, id: created.id }));
        return true;
      }
      return redirect(res, `${url}?saved=1`);
    }
    return redirect(res, `/admin/creators/${encodeURIComponent(id)}?saved=1`);
  } catch (err) {
    if (!id && String(req.headers.accept || '').split(',').some(value => value.trim() === 'application/json')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: readableError(err) })); return true;
    }
    return adminPage(readableError(err), 400);
  }
}
module.exports = { handle };
