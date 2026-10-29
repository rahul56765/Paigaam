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
function runRequest(req, resOrFn, baseUrlOrFn, maybeFn) {
  const res=typeof resOrFn==='function'?null:resOrFn;
  const baseUrl=typeof resOrFn==='function'?'https://paigaam.cc':typeof baseUrlOrFn==='string'?baseUrlOrFn:'https://paigaam.cc';
  const fn=typeof resOrFn==='function'?resOrFn:maybeFn;
  return context.run({req,res,jar:cookies(req),baseUrl},fn);
}
function referral(jar) {
  const token = jar.pg_partner_ref;
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  const row = db.prepare('SELECT creator_id FROM partner_referrals WHERE token_hash=? AND expires_at>?').get(hash(token), Date.now());
  return row ? row.creator_id : null;
}
function checkoutQuote({amount,currency}) {
  const state=context.getStore();
  if(currency!=='INR') {
    if(state?.jar.pg_partner_coupon) return clearInvalidSavedCode(state,'unsupported_currency',amount,currency);
    return null;
  }
  if(!state)return null;
  const code=state.jar.pg_partner_coupon||'';
  try{return store.quote({amount_paise:amount,currency,referral_creator_id:referral(state.jar),coupon_code:code});}
  catch(error){if(code&&['invalid_coupon','coupon_minimum','unsupported_currency'].includes(error.code))return clearInvalidSavedCode(state,error.code,amount,currency);throw error;}
}
function clearInvalidSavedCode(state,errorCode,amount,currency) {
  state.jar.pg_partner_coupon='';state.jar.pg_partner_coupon_notice=errorCode;
  if(state.res){setCookie(state.res,'pg_partner_coupon','',state.baseUrl,0);setCookie(state.res,'pg_partner_coupon_notice',errorCode,state.baseUrl,300);}
  if(currency!=='INR')return null;
  return store.quote({amount_paise:amount,currency,referral_creator_id:referral(state.jar),coupon_code:''});
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
  const productType=notes.magazine_order_id ? 'magazine':'paigaam';
  store.reserveOrder({...quote,gateway_order_id:order.id,product_id,product_type:productType,template_slug,visitor_hash:/^[a-f0-9]{64}$/.test(visitor || '') ? hash(visitor) : ''});
  // A superseded order never reached the hosted checkout: retire its local pending row.
  if(productType==='paigaam') {
    const {q}=require('../../db');
    for(const old of q.ordersAll().filter(row=>row.paigaam_id===product_id&&row.status==='pending'&&row.razorpay_order_id!==order.id))q.orderUpdate(old.id,'cancelled');
  }
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
function publicOffer(offer) {
  if(!offer)return {coupon_source:'none',coupon_type:'',coupon_label:'',discount_type:'percentage',discount_bps:0,discount_flat_paise:0,discount_min_paise:0,discount_max_paise:0,coupon_expires_at:'',coupon_description:''};
  return {coupon_source:offer.source,coupon_type:offer.source,coupon_label:offer.source==='paigaam'?'Paigaam offer':'Creator code',discount_type:offer.discount_type,discount_bps:offer.discount_bps||0,discount_flat_paise:offer.discount_flat_paise||0,discount_min_paise:offer.discount_min_paise||0,discount_max_paise:offer.discount_max_paise||0,coupon_expires_at:offer.coupon_expires_at||'',coupon_description:offer.description||''};
}
function resolveCheckoutProduct(input) {
  if(input.gateway_order_id) {
    const order=store.getOrder(String(input.gateway_order_id));
    if(order) {
      if(order.payment_id)return {alreadyPaid:true,product_id:order.product_id,product_type:order.product_type,currency:order.currency,gateway_order_id:order.gateway_order_id};
      return {product_id:order.product_id,product_type:order.product_type,currency:order.currency,amount_paise:order.gross_paise,gateway_order_id:order.gateway_order_id,gateway_order_status:order.status,snapshot:order};
    }
    const legacy=require('../../db').q.orderByRazorpayOrderId(String(input.gateway_order_id));
    if(legacy){const pg=require('../../db').q.paigaamById(legacy.paigaam_id);if(pg){if(pg.payment_status==='paid')return {alreadyPaid:true,product_id:pg.id,product_type:'paigaam',currency:pg.template_currency};return {product_id:pg.id,product_type:'paigaam',currency:legacy.currency,amount_paise:Math.round(Number(pg.template_price)*100),gateway_order_id:String(input.gateway_order_id),gateway_order_status:'legacy'};}}
  }
  if(typeof input.product_id!=='string' || input.product_id.length>128)return null;
  if(input.product_type==='magazine') {
    const magazine=require('../magazines/store'),order=magazine.getOrder(input.product_id);if(!order)return null;
    const template=magazine.getTemplate(order.template_slug);if(!template)return null;
    if(order.payment_status==='paid')return {alreadyPaid:true,product_id:order.id,product_type:'magazine',currency:template.currency||'INR'};
    return {product_id:order.id,product_type:'magazine',currency:template.currency||'INR',amount_paise:Math.round((Number(template.price)||0)*100)};
  }
  const pg=require('../../db').q.paigaamById(input.product_id);if(!pg)return null;
  if(pg.payment_status==='paid')return {alreadyPaid:true,product_id:pg.id,product_type:'paigaam',currency:pg.template_currency||'INR',url:pg.slug?`${process.env.BASE_URL||'https://paigaam.cc'}/p/${pg.slug}`:''};
  return {product_id:pg.id,product_type:'paigaam',currency:pg.template_currency||'INR',amount_paise:Math.round((Number(pg.template_price)||0)*100)};
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
  if (p !== '/api/creator-coupon' && p !== '/api/creator-coupon/quote') return false;
  privateHeaders(res);
  const jar=cookies(req);
  if (req.method==='GET' && p==='/api/creator-coupon') {
    const csrf=/^[a-f0-9]{64}$/.test(jar.pg_partner_coupon_csrf || '') ? jar.pg_partner_coupon_csrf : crypto.randomBytes(32).toString('hex');
    if (jar.pg_partner_coupon_csrf !== csrf) setCookie(res,'pg_partner_coupon_csrf',csrf,baseUrl,3600);
    let code=jar.pg_partner_coupon || '', offer=code ? store.couponOffer(code) : null;
    let notice=['invalid_coupon','coupon_minimum','unsupported_currency'].includes(jar.pg_partner_coupon_notice)?jar.pg_partner_coupon_notice:'';
    if(code&&!offer){setCookie(res,'pg_partner_coupon','',baseUrl,0);code='';notice='invalid_coupon';}
    if(notice)setCookie(res,'pg_partner_coupon_notice','',baseUrl,0);
    return send(res,200,{csrf,code,valid:true,notice,...publicOffer(offer)});
  }
  if (req.method!=='POST') { res.setHeader('Allow','GET, POST'); return send(res,405,{error:'method_not_allowed'}); }
  if ((req.headers.origin && req.headers.origin !== new URL(baseUrl).origin) || req.headers['sec-fetch-site']==='cross-site') return send(res,403,{error:'foreign_origin'});
  if (!(req.headers['content-type'] || '').startsWith('application/json')) return send(res,415,{error:'json_required'});
  let body; try { body=await readJSON(req); } catch { return send(res,400,{error:'bad_request'}); }
  if (!jar.pg_partner_coupon_csrf || typeof body.csrf!=='string' || body.csrf!==jar.pg_partner_coupon_csrf) return send(res,403,{error:'csrf'});
  if (p==='/api/creator-coupon/quote') {
    const product=resolveCheckoutProduct(body);
    if (!product) return send(res,404,{error:'not_found'});
    if (product.alreadyPaid) return send(res,200,{alreadyPaid:true,url:product.url || '',currency:product.currency});
    let quote;
    try {
      const ignoreSavedCoupon=body.ignore_saved_coupon===true;
      const code=ignoreSavedCoupon?'':(typeof body.code==='string' ? body.code.trim().toUpperCase() : '');
      if (!ignoreSavedCoupon && code !== String(jar.pg_partner_coupon || '').toUpperCase()) return send(res,409,{error:'coupon_not_applied'});
      if (code.length>32 || (code && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code))) return send(res,400,{error:'invalid_coupon'});
      if (product.currency!=='INR') {
        if (code) throw Object.assign(new Error('Creator coupons apply to INR purchases only.'),{code:'unsupported_currency'});
        quote={creator_id:null,coupon_code:'',coupon_source:'none',discount_paise:0,gross_paise:product.amount_paise,amount_paise:product.amount_paise,currency:product.currency,discount_type:'percentage',discount_bps:0,discount_flat_paise:0,discount_min_paise:0,discount_max_paise:0,coupon_expires_at:'',coupon_description:''};
      } else quote=store.quote({amount_paise:product.amount_paise,currency:product.currency,referral_creator_id:referral(jar),coupon_code:code});
      const offer=quote.coupon_code?store.couponOffer(quote.coupon_code):null;
      const snapshot=product.snapshot;
      const reuse_existing_order=!!snapshot&&snapshot.status==='reserved'&&snapshot.creator_id===(quote.creator_id||null)&&snapshot.coupon_code===quote.coupon_code&&snapshot.coupon_source===quote.coupon_source&&snapshot.commission_bps===quote.commission_bps&&snapshot.discount_bps===quote.discount_bps&&snapshot.discount_type===quote.discount_type&&snapshot.discount_flat_paise===quote.discount_flat_paise&&snapshot.discount_min_paise===quote.discount_min_paise&&snapshot.discount_max_paise===quote.discount_max_paise&&snapshot.coupon_expires_at===quote.coupon_expires_at&&snapshot.gross_paise===quote.gross_paise&&snapshot.discount_paise===quote.discount_paise&&snapshot.amount_paise===quote.amount_paise&&snapshot.currency===quote.currency;
      return send(res,200,{gateway_order_id:product.gateway_order_id || '',gateway_order_status:product.gateway_order_status || '',reuse_existing_order,product_id:product.product_id,product_type:product.product_type,currency:quote.currency,gross_paise:quote.gross_paise,discount_paise:quote.discount_paise,amount_paise:quote.amount_paise,coupon_code:quote.coupon_code,creator_attributed:!!quote.creator_id,...publicOffer(offer)});
    } catch (error) { return send(res,400,{error:error.code || 'invalid_coupon'}); }
  }
  const code=typeof body.code==='string' ? body.code.trim().toUpperCase() : '';
  if (code.length>32 || (code && !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code))) return send(res,400,{error:'invalid_coupon'});
  const offer=code ? store.couponOffer(code) : null;
  if (code && !offer) return send(res,400,{error:'invalid_coupon'});
  setCookie(res,'pg_partner_coupon',code,baseUrl,code ? WINDOW : 0);
  setCookie(res,'pg_partner_coupon_notice','',baseUrl,0);
  return send(res,200,{code,valid:true,...publicOffer(offer)});
}
module.exports={runRequest,checkoutQuote,reserveGateway,settle,fulfilled,fulfilledProduct,handle,cookies};
