'use strict';
/** Request-local checkout attribution. Never global mutable buyer state. */
const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');
const { db, q } = require('../../db');
const store = require('./store');
const context = new AsyncLocalStorage();
const WINDOW = 30 * 86400;
db.exec(`CREATE TABLE IF NOT EXISTS partner_referrals (token_hash TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES partner_creators(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS partner_referrals_expiry ON partner_referrals(expires_at);
CREATE TABLE IF NOT EXISTS partner_fulfillment (gateway_order_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL);`);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function cookies(req) {
  const out = Object.create(null);
  for (const pair of String(req.headers.cookie || '').split(';')) { const i = pair.indexOf('='); if (i > 0) { try { out[pair.slice(0,i).trim()] = decodeURIComponent(pair.slice(i+1).trim()); } catch {} } }
  return out;
}
function setCookie(res, name, value, baseUrl, age=WINDOW) {
  const old = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(old ? Array.isArray(old) ? old : [old] : []), `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${baseUrl.startsWith('https:') ? '; Secure' : ''}`]);
}
function runRequest(req, fn) { return context.run({req, jar:cookies(req)}, fn); }
function referral(jar) {
  const token = jar.pg_partner_ref;
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  const row = db.prepare('SELECT creator_id FROM partner_referrals WHERE token_hash=? AND expires_at>?').get(hash(token), Date.now());
  return row ? row.creator_id : null;
}
function checkoutQuote({amount,currency}) {
  const state = context.getStore();
  // Preserve legacy non-INR checkout, but never apply partner discounts or credit.
  if (currency !== 'INR') {
    if (state?.jar.pg_partner_coupon) throw Object.assign(new Error('Creator coupons are available for INR purchases only.'),{code:'unsupported_currency'});
    return null;
  }
  if (!state) return null;
  return store.quote({amount_paise:amount,currency,referral_creator_id:referral(state.jar),coupon_code:state.jar.pg_partner_coupon || ''});
}
function reserveGateway(order, options, quote) {
  if (!quote) return;
  const notes = options.notes || {};
  const product_id = notes.paigaam_id || notes.magazine_order_id;
  const template_slug = notes.template || notes.magazine;
  // Unknown future rails must explicitly opt in with product metadata.
  if (!product_id || !template_slug) throw new Error('Missing checkout product metadata');
  const state = context.getStore();
  const visitor = state?.jar.pg_partner_visitor;
  store.reserveOrder({...quote, gateway_order_id:order.id,product_id,product_type:notes.magazine_order_id ? 'magazine':'paigaam',template_slug,visitor_hash:/^[a-f0-9]{64}$/.test(visitor || '') ? hash(visitor) : ''});
}
function settle(gatewayId,paymentId) {
  if (store.getOrder(gatewayId)) {
    store.settleOrder(gatewayId,paymentId);
    db.prepare("INSERT OR IGNORE INTO partner_fulfillment VALUES (?,'pending',?)").run(gatewayId,new Date().toISOString());
  }
}
function fulfilled(gatewayId) { db.prepare("UPDATE partner_fulfillment SET status='complete',updated_at=? WHERE gateway_order_id=?").run(new Date().toISOString(),gatewayId); }
function fulfilledProduct(type,id) { for (const order of db.prepare("SELECT gateway_order_id FROM partner_orders WHERE product_type=? AND product_id=? AND payment_id IS NOT NULL").all(type,id)) fulfilled(order.gateway_order_id); }
function send(res,status,value) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); return true; }
function privateHeaders(res) { res.setHeader('Cache-Control','private, no-store'); res.setHeader('Vary','Cookie'); res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Robots-Tag','noindex, nofollow'); }
async function readJSON(req) {
  let body='', size=0;
  for await (const chunk of req) { size+=chunk.length; if (size>4096) throw new Error('Body too large'); body+=chunk; }
  return JSON.parse(body || '{}');
}
function landing(to) {
  if (to === '/' || to === '/templates' || to === '/magazines') return to;
  const m = /^\/templates\/([a-z0-9-]+)$/.exec(to || '');
  if (m && q.templateBySlug(m[1])?.status === 'published') return to;
  const mg = /^\/magazines\/([a-z0-9-]+)$/.exec(to || '');
  if (mg) { const row = require('../magazines/store').getTemplate(mg[1]); if (row?.status === 'published') return to; }
  return null;
}
async function handle(req,res,u,{baseUrl}) {
  const p = u.pathname.replace(/\/+$/,'') || '/';
  const m = /^\/r\/([a-z0-9][a-z0-9_-]{2,31})$/i.exec(p);
  if (m && ['GET','HEAD'].includes(req.method)) {
    privateHeaders(res); res.setHeader('Referrer-Policy','no-referrer');
    const c = store.creatorByUsername(m[1]); const to = landing(u.searchParams.get('to') || '/templates');
    if (!c) return send(res,404,{error:'creator_unavailable'});
    if (!to) return send(res,400,{error:'invalid_destination'});
    // HEAD and obvious link-preview crawlers should not inflate click counts.
    if (req.method==='GET' && !/prefetch|prerender/i.test(String(req.headers['sec-purpose'] || req.headers.purpose || '')) && !/bot|crawler|spider|facebookexternalhit|whatsapp|telegram|slack|preview/i.test(req.headers['user-agent'] || '')) {
      const jar=cookies(req), visitor=/^[a-f0-9]{64}$/.test(jar.pg_partner_visitor || '') ? jar.pg_partner_visitor : crypto.randomBytes(32).toString('hex');
      if (jar.pg_partner_visitor !== visitor) setCookie(res,'pg_partner_visitor',visitor,baseUrl);
      const token=crypto.randomBytes(32).toString('hex');
      db.prepare('DELETE FROM partner_referrals WHERE expires_at<=?').run(Date.now());
      db.prepare('INSERT INTO partner_referrals VALUES (?,?,?)').run(hash(token),c.id,Date.now()+WINDOW*1000);
      store.recordClick(c.id,{visitor_hash:hash(visitor),path:to});
      setCookie(res,'pg_partner_ref',token,baseUrl);
    }
    res.writeHead(302,{Location:to}); res.end(); return true;
  }
  if (p !== '/api/creator-coupon') return false;
  privateHeaders(res);
  const jar=cookies(req);
  if (req.method==='GET') {
    const csrf=/^[a-f0-9]{64}$/.test(jar.pg_partner_coupon_csrf || '') ? jar.pg_partner_coupon_csrf : crypto.randomBytes(32).toString('hex');
    if (jar.pg_partner_coupon_csrf !== csrf) setCookie(res,'pg_partner_coupon_csrf',csrf,baseUrl,3600);
    const code=jar.pg_partner_coupon || '', c=code ? store.creatorByCoupon(code) : null;
    return send(res,200,{csrf,code,valid:!code || !!c,discount_bps:c?.discount_bps || 0});
  }
  if (req.method!=='POST') { res.setHeader('Allow','GET, POST'); return send(res,405,{error:'method_not_allowed'}); }
  if ((req.headers.origin && req.headers.origin !== new URL(baseUrl).origin) || req.headers['sec-fetch-site']==='cross-site') return send(res,403,{error:'foreign_origin'});
  if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(res,415,{error:'json_required'});
  let body; try { body=await readJSON(req); } catch { return send(res,400,{error:'bad_request'}); }
  if (!jar.pg_partner_coupon_csrf || typeof body.csrf!=='string' || body.csrf!==jar.pg_partner_coupon_csrf) return send(res,403,{error:'csrf'});
  const code=typeof body.code==='string' ? body.code.trim().toUpperCase() : '';
  if (code.length>32 || (code && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code))) return send(res,400,{error:'invalid_coupon'});
  const c=code ? store.creatorByCoupon(code) : null;
  if (code && !c) return send(res,400,{error:'invalid_coupon'});
  setCookie(res,'pg_partner_coupon',code,baseUrl,code ? WINDOW : 0);
  return send(res,200,{code,valid:true,discount_bps:c?.discount_bps || 0});
}
module.exports={runRequest,checkoutQuote,reserveGateway,settle,fulfilled,fulfilledProduct,handle,cookies};
