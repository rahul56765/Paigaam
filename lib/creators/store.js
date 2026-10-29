'use strict';
const crypto = require('node:crypto');
const { db } = require('../../db');
require('./schema')(db);
const MAX_AMOUNT = 1_000_000_000_000;
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const one = (sql, ...args) => db.prepare(sql).get(...args) || null;
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
function fail(code, message) { const e = new Error(message); e.code = code; throw e; }
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (e) { db.exec('ROLLBACK'); if (String(e.code).startsWith('ERR_SQLITE') && /UNIQUE constraint/.test(e.message)) fail('conflict', 'A unique identifier is already in use.'); throw e; }
}
function text(v, field, max = 200, optional = false) {
  if (optional && (v === undefined || v === null)) return '';
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x1f\x7f]/.test(v)) fail('invalid_input', `Invalid ${field}.`);
  return v.trim();
}
function integer(v, field, min = 0, max = MAX_AMOUNT) {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail('invalid_input', `Invalid ${field}.`);
  return v;
}
function password(v) { if (typeof v !== 'string' || v.length < 12 || v.length > 256) fail('invalid_password', 'Password must contain 12–256 characters.'); return v; }
function username(v) { const n = text(v, 'username', 32).toLowerCase(); if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(n)) fail('invalid_username', 'Username must contain 3–32 lowercase letters, digits, underscores or hyphens.'); return n; }
function coupon(v) { const n = text(v, 'coupon', 32).toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(n)) fail('invalid_coupon', 'Invalid coupon code.'); return n; }
function active(v) { if (v !== true && v !== false && v !== 1 && v !== 0) fail('invalid_input','Active must be a boolean.'); return v ? 1 : 0; }
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const derive = (p, salt) => crypto.scryptSync(p, salt, 64).toString('hex');
const dummySalt = crypto.randomBytes(24).toString('hex');
const dummyHash = derive('dummy-password-never-authenticate', dummySalt);
function profileImage(v, id) {
  if (v === '') return '';
  const prefix = `/creator/photos/${id}/`;
  if (typeof v !== 'string' || !v.startsWith(prefix) || !/^[a-f0-9]{32,128}\.jpg$/.test(v.slice(prefix.length))) fail('invalid_input','Invalid profile image path.');
  return v;
}
function expiry(v) {
  if (v === '') return '';
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) || !Number.isFinite(Date.parse(v))) fail('invalid_input','Expiry must be an ISO8601 UTC timestamp.');
  const normalized = new Date(v).toISOString();
  if (normalized !== (v.includes('.') ? v : v.replace('Z','.000Z'))) fail('invalid_input','Invalid coupon expiry date.');
  return normalized;
}
function couponTerms(input, old = {}) {
  const value = (key, fallback) => input[key] === undefined ? (old[key] === undefined ? fallback : old[key]) : input[key];
  const type = value('discount_type','percentage');
  if (type !== 'percentage' && type !== 'flat') fail('invalid_input','Invalid discount type.');
  const terms = {
    discount_type:type,
    discount_bps:integer(value('discount_bps',0),'percentage discount',0,9000),
    discount_flat_paise:integer(value('discount_flat_paise',0),'flat discount'),
    discount_min_paise:integer(value('discount_min_paise',0),'minimum spend'),
    discount_max_paise:integer(value('discount_max_paise',0),'maximum discount'),
    coupon_expires_at:expiry(value('coupon_expires_at',''))
  };
  if (type === 'flat' && !terms.discount_flat_paise) fail('invalid_input','Flat discount must be positive.');
  return terms;
}
function describeCoupon(c) {
  if (!c) return null;
  return {code:c.coupon_code||c.code,discount_bps:c.discount_bps,...couponTerms({},c)};
}
function safe(c) {
  if (!c) return null;
  const {id,username,display_name,commission_bps,coupon_code,discount_bps,created_at} = c;
  return {id,username,display_name,commission_bps,coupon_code,discount_bps,active:!!c.active,created_at,
    profile_image:profileImage(c.profile_image || '',id),...couponTerms({},c),coupon_enabled:!!c.coupon_enabled};
}
function audit(actor, action, id, details = {}) { run('INSERT INTO partner_audit VALUES (?,?,?,?,?,?)',uid(), actor == null ? '' : text(String(actor),'actor',200),action,id,JSON.stringify(details),now()); }
function createCreator(input, actorId) {
  const n = username(input.username), d = text(input.display_name,'display name',100), p = password(input.password);
  const b = integer(input.commission_bps,'commission',0,10000), c = coupon(input.coupon_code), discount = integer(input.discount_bps,'discount',0,9000);
  const a = input.active === undefined ? 1 : active(input.active), salt = crypto.randomBytes(24).toString('hex'), ph = derive(p,salt);
  const id = uid(), terms = couponTerms(input), image = profileImage(input.profile_image === undefined ? '' : input.profile_image,id);
  const enabled = input.coupon_enabled === undefined ? 1 : active(input.coupon_enabled);
  return transaction(() => {
    if (one('SELECT 1 FROM partner_platform_coupons WHERE code=? COLLATE NOCASE',c)) fail('conflict','That code is already used by a Paigaam offer.');
    const fields = {id,username:n,display_name:d,password_hash:ph,password_salt:salt,commission_bps:b,coupon_code:c,discount_bps:discount,active:a,created_at:now(),profile_image:image,...terms,coupon_enabled:enabled};
    run(`INSERT INTO partner_creators (${Object.keys(fields).join(',')}) VALUES (${Object.keys(fields).map(()=>'?').join(',')})`,...Object.values(fields));
    audit(actorId,'creator.create',id,{commission_bps:b,discount_bps:discount,active:!!a,...terms,coupon_enabled:!!enabled,profile_image:image}); return getCreator(id);
  });
}
function updateCreator(id, input, actorId) {
  return transaction(() => {
    const old = one('SELECT * FROM partner_creators WHERE id=?',id); if (!old) fail('not_found','Creator not found.');
    if ('username' in input && input.username !== old.username) fail('invalid_input','Username cannot be changed.');
    const d = input.display_name === undefined ? old.display_name : text(input.display_name,'display name',100);
    const b = input.commission_bps === undefined ? old.commission_bps : integer(input.commission_bps,'commission',0,10000);
    const c = input.coupon_code === undefined ? old.coupon_code : coupon(input.coupon_code);
    if (one('SELECT 1 FROM partner_platform_coupons WHERE code=? COLLATE NOCASE',c)) fail('conflict','That code is already used by a Paigaam offer.');
    const discount = input.discount_bps === undefined ? old.discount_bps : integer(input.discount_bps,'discount',0,9000);
    const a = input.active === undefined ? old.active : active(input.active);
    const salt = input.password === undefined ? old.password_salt : crypto.randomBytes(24).toString('hex');
    const ph = input.password === undefined ? old.password_hash : derive(password(input.password),salt);
    const terms = couponTerms(input,old), enabled = input.coupon_enabled === undefined ? old.coupon_enabled : active(input.coupon_enabled);
    const image = input.profile_image === undefined ? old.profile_image : profileImage(input.profile_image,id);
    const fields = {display_name:d,commission_bps:b,coupon_code:c,discount_bps:discount,active:a,password_hash:ph,password_salt:salt,...terms,coupon_enabled:enabled,profile_image:image};
    run(`UPDATE partner_creators SET ${Object.keys(fields).map(k=>`${k}=?`).join(',')} WHERE id=?`,...Object.values(fields),id);
    if (!a || input.password !== undefined) run('DELETE FROM partner_sessions WHERE creator_id=?',id);
    audit(actorId,'creator.update',id,{display_name:d,commission_bps:b,coupon_code:c,discount_bps:discount,active:!!a,...terms,coupon_enabled:!!enabled,profile_image:image,password_changed:input.password!==undefined});
    return getCreator(id);
  });
}
const listCreators = () => all('SELECT * FROM partner_creators ORDER BY created_at,id').map(safe);
const getCreator = id => typeof id === 'string' ? safe(one('SELECT * FROM partner_creators WHERE id=?',id)) : null;
const creatorByUsername = n => typeof n === 'string' ? safe(one('SELECT * FROM partner_creators WHERE username=? COLLATE NOCASE AND active=1',n.trim())) : null;
function creatorByCoupon(code) {
  if (typeof code !== 'string') return null;
  const c = safe(one('SELECT * FROM partner_creators WHERE coupon_code=? COLLATE NOCASE AND active=1 AND coupon_enabled=1',code.trim()));
  return c && (!c.coupon_expires_at || Date.parse(c.coupon_expires_at) > Date.now()) ? c : null;
}
function platformCoupon(row) {
  if(!row)return null;
  return {code:row.code,description:row.description,discount_type:row.discount_type,discount_bps:row.discount_bps,discount_flat_paise:row.discount_flat_paise,discount_min_paise:row.discount_min_paise,discount_max_paise:row.discount_max_paise,coupon_expires_at:row.expires_at,enabled:!!row.enabled,created_at:row.created_at,updated_at:row.updated_at,created_by:row.created_by};
}
function listPlatformCoupons() {
  return all('SELECT * FROM partner_platform_coupons ORDER BY created_at DESC,code').map(row=>({...platformCoupon(row),paid_orders:one("SELECT COUNT(*) AS n FROM partner_orders WHERE coupon_source='paigaam' AND coupon_code=? AND payment_id IS NOT NULL",row.code).n,redemptions:one("SELECT COUNT(*) AS n FROM partner_orders WHERE coupon_source='paigaam' AND coupon_code=?",row.code).n}));
}
function platformCouponByCode(code) {
  if(typeof code!=='string')return null;
  const row=one('SELECT * FROM partner_platform_coupons WHERE code=? COLLATE NOCASE AND enabled=1',code.trim());
  if(!row || row.expires_at && Date.parse(row.expires_at)<=Date.now())return null;
  return platformCoupon(row);
}
function couponOffer(code) {
  if(typeof code!=='string' || !code)return null;
  const creator=creatorByCoupon(code);
  if(creator)return {...describeCoupon(creator),source:'creator',creator};
  const promo=platformCouponByCode(code);
  return promo ? {...promo,source:'paigaam',creator:null} : null;
}
function adminPlatformCoupons() { return listPlatformCoupons(); }

function createPlatformCoupon(input,actorId) {
  const code=coupon(input.code), description=input.description===undefined||input.description===''?'':text(input.description,'description',160,true);
  const terms=couponTerms(input), enabled=input.enabled===undefined?1:active(input.enabled);
  return transaction(()=>{
    if(one('SELECT 1 FROM partner_creators WHERE coupon_code=? COLLATE NOCASE',code))fail('conflict','That code is already reserved by a creator.');
    const time=now();run(`INSERT INTO partner_platform_coupons (code,description,discount_type,discount_bps,discount_flat_paise,discount_min_paise,discount_max_paise,expires_at,enabled,created_at,updated_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,code,description,terms.discount_type,terms.discount_bps||0,terms.discount_flat_paise,terms.discount_min_paise,terms.discount_max_paise,terms.coupon_expires_at,enabled,time,time,String(actorId||''));
    audit(actorId,'platform_coupon.create',code,{description,...terms,enabled:!!enabled});return platformCoupon(one('SELECT * FROM partner_platform_coupons WHERE code=?',code));
  });
}
function updatePlatformCoupon(code,input,actorId) {
  const key=coupon(code),description=input.description===undefined?undefined:(input.description===''?'':text(input.description,'description',160,true));
  return transaction(()=>{
    const old=one('SELECT * FROM partner_platform_coupons WHERE code=? COLLATE NOCASE',key);if(!old)fail('not_found','Paigaam offer not found.');
    const oldPublic=platformCoupon(old),terms=couponTerms(input,oldPublic),enabled=input.enabled===undefined?old.enabled:active(input.enabled);
    if(one('SELECT 1 FROM partner_creators WHERE coupon_code=? COLLATE NOCASE',key))fail('conflict','That code is already reserved by a creator.');
    const label=description===undefined?old.description:description;
    run('UPDATE partner_platform_coupons SET description=?,discount_type=?,discount_bps=?,discount_flat_paise=?,discount_min_paise=?,discount_max_paise=?,expires_at=?,enabled=?,updated_at=? WHERE code=?',label,terms.discount_type,terms.discount_bps||0,terms.discount_flat_paise,terms.discount_min_paise,terms.discount_max_paise,terms.coupon_expires_at,enabled,now(),key);
    audit(actorId,'platform_coupon.update',key,{description:label,...terms,enabled:!!enabled});return platformCoupon(one('SELECT * FROM partner_platform_coupons WHERE code=?',key));
  });
}
function updateProfileImage(id, imagePath, actorId) {
  return transaction(() => {
    if (!getCreator(id)) fail('not_found','Creator not found.');
    const image = profileImage(imagePath,id);
    run('UPDATE partner_creators SET profile_image=? WHERE id=?',image,id);
    audit(actorId,'creator.profile_image',id,{profile_image:image});
    return getCreator(id);
  });
}
function classifyDevice(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.slice(0,512).toLowerCase() : '';
  let device_type = 'desktop';
  if (/ipad|tablet|kindle|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) device_type = 'tablet';
  else if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(ua)) device_type = 'phone';
  else if (!ua) device_type = 'unknown';
  let browser = 'Other';
  if (/edg(e|a|ios)?\//.test(ua)) browser = 'Edge';
  else if (/opr\//.test(ua) || /opera/.test(ua)) browser = 'Opera';
  else if (/samsungbrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/firefox\//.test(ua) || /fxios\//.test(ua)) browser = 'Firefox';
  else if (/crios\//.test(ua) || /chrome\//.test(ua) || /chromium\//.test(ua)) browser = 'Chrome';
  else if (/safari\//.test(ua)) browser = 'Safari';
  let os = 'Other';
  if (/cros /.test(ua)) os = 'ChromeOS';
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS';
  else if (/android/.test(ua)) os = 'Android';
  else if (/windows nt/.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/.test(ua)) os = 'macOS';
  else if (/linux/.test(ua)) os = 'Linux';
  else if (!ua) os = 'Unknown';
  return {device_type,browser,os};
}
function recordCreatorLogin(id,userAgent,at=new Date().toISOString()) {
  const c=getCreator(id); if (!c || !c.active) fail('not_found','Creator not found.');
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))) fail('invalid_input','Invalid login timestamp.');
  const observed=new Date(at).toISOString(), device=classifyDevice(userAgent);
  return transaction(()=>{
    run(`UPDATE partner_creators SET last_login_at=?,last_activity_at=?,login_count=login_count+1,last_device_type=?,last_browser=?,last_os=? WHERE id=?`,observed,observed,device.device_type,device.browser,device.os,id);
    audit('creator:'+id,'creator.login',id,{at:observed,...device});
    return creatorAnalytics(id);
  });
}
function recordCreatorActivity(id,at=new Date().toISOString()) {
  const c=getCreator(id); if (!c || !c.active) return false;
  const time=Date.parse(at); if (!Number.isFinite(time)) return false;
  const iso=new Date(time).toISOString();
  // At most one write per minute, despite the portal loading several assets.
  return run(`UPDATE partner_creators SET last_activity_at=? WHERE id=? AND (last_activity_at='' OR last_activity_at<?)`,iso,id,new Date(time-60_000).toISOString()).changes===1;
}
function creatorAnalytics(id) {
  const row=one(`SELECT last_login_at,last_activity_at,login_count,last_device_type,last_browser,last_os FROM partner_creators WHERE id=?`,id);
  if (!row) return null;
  return {...row,active_sessions:one('SELECT COUNT(*) AS n FROM partner_sessions WHERE creator_id=? AND expires_at>?',id,Date.now()).n};
}
const creatorsAnalytics = () => all('SELECT id,last_login_at,last_activity_at,login_count,last_device_type,last_browser,last_os FROM partner_creators').map(row=>({...row,active_sessions:one('SELECT COUNT(*) AS n FROM partner_sessions WHERE creator_id=? AND expires_at>?',row.id,Date.now()).n}));
function authenticate(n,p) {
  const c = typeof n === 'string' && n.length <= 32 ? one('SELECT * FROM partner_creators WHERE username=? COLLATE NOCASE',n.trim()) : null;
  const valid = typeof p === 'string' && p.length >= 12 && p.length <= 256;
  const candidate = derive(valid ? p : 'invalid-password',c ? c.password_salt : dummySalt);
  const match = crypto.timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(c ? c.password_hash : dummyHash,'hex'));
  return c && c.active && valid && match ? safe(c) : null;
}
function createSession(id) {
  const c = getCreator(id); if (!c || !c.active) fail('unauthorized','Creator is not active.');
  const token = crypto.randomBytes(32).toString('base64url');
  transaction(() => { run('DELETE FROM partner_sessions WHERE expires_at<=?',Date.now()); run('INSERT INTO partner_sessions VALUES (?,?,?,?)',hash(token),id,crypto.randomBytes(32).toString('base64url'),Date.now()+7*86400000); });
  return token;
}
function getSession(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const s = one('SELECT * FROM partner_sessions WHERE token_hash=? AND expires_at>?',hash(token),Date.now());
  if (!s) return null; const c = getCreator(s.creator_id); return c && c.active ? {creator:c,csrf:s.csrf} : null;
}
function deleteSession(token) { if (typeof token === 'string' && token.length <= 256) run('DELETE FROM partner_sessions WHERE token_hash=?',hash(token)); }
function recordClick(id,{visitor_hash,path,source}) {
  const c = getCreator(id); if (!c || !c.active) fail('invalid_creator','Creator is not active.');
  const visitor = text(visitor_hash,'visitor hash',128);
  if (!/^[a-f0-9]{32,128}$/i.test(visitor)) fail('invalid_input','Visitor hash must be a hexadecimal digest, never an IP address.');
  // Store only local pathnames, never query parameters (which may contain PII).
  const rawPath = text(path,'path',500); if (!rawPath.startsWith('/') || rawPath.startsWith('//')) fail('invalid_input','A local path is required.');
  const cleanPath = rawPath.split(/[?#]/)[0];
  const src = source === undefined || source === null || source === '' ? '' : text(source,'source',80,true);
  if (src && !/^[a-zA-Z0-9 _.-]+$/.test(src)) fail('invalid_input','Use a non-personal source label.');
  const idClick = uid(); run('INSERT INTO partner_clicks VALUES (?,?,?,?,?,?)',idClick,id,visitor,cleanPath,src,now()); return idClick;
}
function roundRatio(value,numerator,denominator=10000) { return Number((BigInt(value)*BigInt(numerator)+BigInt(denominator)/2n)/BigInt(denominator)); }
function quote({amount_paise,currency,referral_creator_id,coupon_code}) {
  const gross = integer(amount_paise,'amount',100); if (currency !== 'INR') fail('unsupported_currency','Only INR is supported.');
  const code = coupon_code === undefined || coupon_code === null || coupon_code === '' ? '' : coupon(coupon_code);
  const offer = code ? couponOffer(code) : null;
  if(code && !offer) fail('invalid_coupon','Coupon is invalid, disabled or expired.');
  let creator = offer && offer.source==='creator' ? offer.creator : null;
  if(!creator && referral_creator_id) {const candidate=getCreator(referral_creator_id);if(candidate&&candidate.active)creator=candidate;}
  const terms=offer ? couponTerms(offer) : couponTerms({});
  if(code && gross<terms.discount_min_paise) fail('coupon_minimum','Order does not meet the coupon minimum spend.');
  let discount=code ? (terms.discount_type==='flat'?terms.discount_flat_paise:roundRatio(gross,offer.discount_bps||0)) : 0;
  if(terms.discount_type==='percentage'&&terms.discount_max_paise)discount=Math.min(discount,terms.discount_max_paise);
  discount=Math.min(discount,gross-100);
  return {creator_id:creator?creator.id:null,coupon_code:code,coupon_source:code?offer.source:'none',commission_bps:creator?creator.commission_bps:0,discount_paise:discount,gross_paise:gross,amount_paise:gross-discount,currency,...terms,discount_bps:offer?offer.discount_bps||0:0,coupon_description:offer?offer.description||'':''};
}

function reserveOrder(input) {
  const gateway = text(input.gateway_order_id,'gateway order id'), product = text(input.product_id,'product id'), type = text(input.product_type,'product type',40), slug = text(input.template_slug,'template slug',100);
  const gross = integer(input.gross_paise,'gross amount',100), amount = integer(input.amount_paise,'amount',100), discount = integer(input.discount_paise,'discount');
  const bps = integer(input.commission_bps,'commission',0,10000);
  if (gross !== amount+discount || discount > gross-100 || input.currency !== 'INR') fail('invalid_quote','Invalid order quote.');
  const creator = input.creator_id == null ? null : getCreator(input.creator_id);
  if (input.creator_id != null && !creator) fail('invalid_creator','Creator not found.');
  const code = input.coupon_code ? coupon(input.coupon_code) : '';
  const couponSource=input.coupon_source|| (code?'creator':'none');
  if(!['legacy','none','creator','paigaam'].includes(couponSource)||(!code&&couponSource!=='none'&&couponSource!=='legacy')||(code&&!['creator','paigaam'].includes(couponSource)))fail('invalid_quote','Invalid coupon source.');
  if ((!creator && bps) || (couponSource==='creator'&&!creator) || (!code && discount)) fail('invalid_quote','Attribution is required for discounts and commissions.');
  let visitor = input.visitor_hash == null || input.visitor_hash === '' ? '' : text(input.visitor_hash,'visitor hash',128);
  if (visitor && !/^[a-f0-9]{32,128}$/i.test(visitor)) fail('invalid_input','Invalid visitor hash.');
  const terms = couponTerms(input);
  if (code && gross < terms.discount_min_paise) fail('invalid_quote','Order is below the snapshotted minimum spend.');
  const percentCap=terms.discount_max_paise ? Math.min(roundRatio(gross,terms.discount_bps),terms.discount_max_paise) : roundRatio(gross,terms.discount_bps);
  if ((terms.discount_type === 'percentage' && discount > percentCap) ||
      (terms.discount_type === 'flat' && discount > terms.discount_flat_paise)) fail('invalid_quote','Discount exceeds the quoted discount terms.');
  const snapshot = {...terms,coupon_source:couponSource,gateway_order_id:gateway,product_id:product,product_type:type,template_slug:slug,visitor_hash:visitor,creator_id:creator ? creator.id : null,coupon_code:code,commission_bps:bps,discount_paise:discount,gross_paise:gross,amount_paise:amount,currency:'INR',commission_paise:roundRatio(amount,bps)};
  return transaction(() => {
    const old = getOrder(gateway); if (old) { if (Object.entries(snapshot).some(([k,v]) => old[k] !== v)) fail('idempotency_conflict','Order retry does not match its immutable snapshot.'); return old; }
    run("UPDATE partner_orders SET status='superseded' WHERE product_type=? AND product_id=? AND payment_id IS NULL AND status='reserved'",type,product);
    run(`INSERT INTO partner_orders (${Object.keys(snapshot).join(',')},created_at) VALUES (${Object.keys(snapshot).map(()=>'?').join(',')},?)`,...Object.values(snapshot),now());
    return getOrder(gateway);
  });
}
const getOrder = id => typeof id === 'string' ? one('SELECT * FROM partner_orders WHERE gateway_order_id=?',id) : null;
function ledger(creator,kind,amount,key,order=null,payout=null) { run('INSERT INTO partner_ledger VALUES (?,?,?,?,?,?,?,?)',uid(),creator,kind,amount,key,order,payout,now()); }
function applyRefunds(order) {
  const refunded = one('SELECT COALESCE(SUM(amount_paise),0) AS n FROM partner_refunds WHERE payment_id=?',order.payment_id).n;
  if (refunded > order.amount_paise) fail('refund_exceeds_payment','Refunds exceed the original payment; event retained for reconciliation.');
  if (order.credited && order.creator_id) {
    const target = roundRatio(order.commission_paise,refunded,order.amount_paise);
    const reversed = -one("SELECT COALESCE(SUM(amount_paise),0) AS n FROM partner_ledger WHERE gateway_order_id=? AND kind='refund'",order.gateway_order_id).n;
    if (target > reversed) ledger(order.creator_id,'refund',-(target-reversed),`refund:${order.payment_id}:${refunded}`,order.gateway_order_id);
  }
  run('UPDATE partner_orders SET status=? WHERE gateway_order_id=?',refunded === order.amount_paise ? 'refunded' : refunded ? 'partially_refunded' : 'paid',order.gateway_order_id);
}
function settleOrder(gatewayOrderId,paymentId) {
  const payment = text(paymentId,'payment id');
  return transaction(() => {
    const o = getOrder(gatewayOrderId); if (!o) return null;
    if (o.payment_id) { if (o.payment_id !== payment) fail('payment_conflict','Order already has a different payment.'); return o; }
    const other = one('SELECT gateway_order_id FROM partner_orders WHERE payment_id=?',payment); if (other) fail('payment_conflict','Payment is already assigned to another order.');
    const duplicate = one('SELECT gateway_order_id FROM partner_orders WHERE product_type=? AND product_id=? AND credited=1',o.product_type,o.product_id);
    const credit = duplicate ? 0 : 1;
    run('UPDATE partner_orders SET payment_id=?,paid_at=?,credited=?,status=\'paid\' WHERE gateway_order_id=?',payment,now(),credit,gatewayOrderId);
    if (credit && o.creator_id) ledger(o.creator_id,'commission',o.commission_paise,`commission:${gatewayOrderId}`,gatewayOrderId);
    applyRefunds(getOrder(gatewayOrderId)); return getOrder(gatewayOrderId);
  });
}
function refundPayment(paymentId,refundId,amountPaise) {
  const payment = text(paymentId,'payment id'), refund = text(refundId,'refund id'), amount = integer(amountPaise,'refund amount',1);
  return transaction(() => {
    const old = one('SELECT * FROM partner_refunds WHERE refund_id=?',refund);
    if (old) { if (old.payment_id !== payment || old.amount_paise !== amount) fail('idempotency_conflict','Refund retry differs from the recorded event.'); return old; }
    const order = one('SELECT * FROM partner_orders WHERE payment_id=?',payment);
    if (order) { const prior = one('SELECT COALESCE(SUM(amount_paise),0) AS n FROM partner_refunds WHERE payment_id=?',payment).n; if (prior+amount > order.amount_paise) fail('refund_exceeds_payment','Refunds cannot exceed the original payment.'); }
    run('INSERT INTO partner_refunds VALUES (?,?,?,?)',refund,payment,amount,now());
    if (order) applyRefunds(order);
    return one('SELECT * FROM partner_refunds WHERE refund_id=?',refund);
  });
}
function balance(id) { return one('SELECT COALESCE(SUM(amount_paise),0) AS n FROM partner_ledger WHERE creator_id=?',id).n; }
function recordPayout(creatorId,input,actorId) {
  const amount = integer(input.amount_paise,'payout amount',1), reference = text(input.reference,'reference',200), note = input.note === undefined || input.note === '' ? '' : text(input.note,'note',1000);
  const key = text(input.idempotency_key,'idempotency key',200);
  let paid = null;
  if (input.paid_at !== undefined) { if (typeof input.paid_at !== 'string' || !Number.isFinite(Date.parse(input.paid_at))) fail('invalid_input','Invalid payout date.'); paid = new Date(input.paid_at).toISOString(); }
  const actor = actorId == null ? '' : text(String(actorId),'actor',200);
  return transaction(() => {
    const old = one('SELECT * FROM partner_payouts WHERE idempotency_key=?',key);
    if (old) { if (old.creator_id !== creatorId || old.amount_paise !== amount || old.reference !== reference || old.note !== note || (paid !== null && old.paid_at !== paid) || old.actor_id !== actor) fail('idempotency_conflict','Payout retry differs from the recorded transfer.'); return old; }
    if (!getCreator(creatorId)) fail('not_found','Creator not found.');
    if (balance(creatorId) < amount) fail('insufficient_balance','Payout exceeds the outstanding earned balance.');
    const id = uid(), time = now(); run('INSERT INTO partner_payouts VALUES (?,?,?,?,?,?,?,?,?,?)',id,creatorId,amount,'INR',reference,note,paid || time,time,key,actor);
    ledger(creatorId,'payout',-amount,`payout:${key}`,null,id); audit(actorId,'payout.record',id,{creator_id:creatorId,amount_paise:amount,reference});
    return one('SELECT * FROM partner_payouts WHERE id=?',id);
  });
}
function dashboard(id,{days=30}={}) {
  const creator = getCreator(id); if (!creator) fail('not_found','Creator not found.'); integer(days,'days',1,366);
  const clicks = one('SELECT COUNT(*) AS clicks,COUNT(DISTINCT visitor_hash) AS unique_visitors FROM partner_clicks WHERE creator_id=?',id);
  const orders = one('SELECT COUNT(*) AS paid_customers,COALESCE(SUM(amount_paise),0) AS revenue_paise FROM partner_orders WHERE creator_id=? AND credited=1 AND payment_id IS NOT NULL',id);
  const sums = one("SELECT COALESCE(SUM(CASE WHEN kind='commission' THEN amount_paise ELSE 0 END),0) AS earned_paise, -COALESCE(SUM(CASE WHEN kind='payout' THEN amount_paise ELSE 0 END),0) AS received_paise, COALESCE(SUM(amount_paise),0) AS balance_paise FROM partner_ledger WHERE creator_id=?",id);
  const refunds = one('SELECT COALESCE(SUM(r.amount_paise),0) AS refund_paise FROM partner_refunds r JOIN partner_orders o ON o.payment_id=r.payment_id WHERE o.creator_id=? AND o.credited=1',id);
  const reversed_paise = -one("SELECT COALESCE(SUM(amount_paise),0) AS n FROM partner_ledger WHERE creator_id=? AND kind='refund'",id).n;
  const totals = {...clicks,...orders,...sums,...refunds,reversed_paise,net_earned_paise:sums.earned_paise-reversed_paise,net_revenue_paise:orders.revenue_paise-refunds.refund_paise,conversion_rate: clicks.unique_visitors ? orders.paid_customers/clicks.unique_visitors*100 : 0};
  const recent_orders = all(`SELECT gateway_order_id,product_id,template_slug,gross_paise,discount_paise,amount_paise,CASE WHEN credited=1 THEN commission_paise ELSE 0 END AS commission_paise,commission_bps,coupon_code,status,created_at,paid_at FROM partner_orders WHERE creator_id=? AND payment_id IS NOT NULL ORDER BY paid_at DESC,gateway_order_id LIMIT 50`,id);
  const payouts = all('SELECT id,amount_paise,currency,reference,note,paid_at,created_at FROM partner_payouts WHERE creator_id=? ORDER BY paid_at DESC,id LIMIT 100',id);
  const daily = [];
  for (let back=days-1;back>=0;back--) {
    const date = new Date(Date.now()-back*86400000).toISOString().slice(0,10);
    const c = one('SELECT COUNT(*) AS clicks,COUNT(DISTINCT visitor_hash) AS unique_visitors FROM partner_clicks WHERE creator_id=? AND substr(created_at,1,10)=?',id,date);
    const o = one('SELECT COUNT(*) AS paid_customers,COALESCE(SUM(amount_paise),0) AS revenue_paise FROM partner_orders WHERE creator_id=? AND credited=1 AND substr(paid_at,1,10)=?',id,date);
    const l = one("SELECT COALESCE(SUM(CASE WHEN kind='commission' THEN amount_paise ELSE 0 END),0) AS earned_paise, -COALESCE(SUM(CASE WHEN kind='refund' THEN amount_paise ELSE 0 END),0) AS reversed_paise FROM partner_ledger WHERE creator_id=? AND substr(created_at,1,10)=?",id,date);
    daily.push({date,...c,...o,...l});
  }
  const templates = all('SELECT product_type,template_slug,COUNT(*) AS paid_customers,COALESCE(SUM(amount_paise),0) AS revenue_paise,SUM(commission_paise) AS earned_paise FROM partner_orders WHERE creator_id=? AND credited=1 AND payment_id IS NOT NULL GROUP BY product_type,template_slug ORDER BY revenue_paise DESC',id).map(t => ({...t,clicks:one('SELECT COUNT(*) AS n FROM partner_clicks WHERE creator_id=? AND path=?',id,`${t.product_type === 'magazine' ? '/magazines/' : '/templates/'}${t.template_slug}`).n}));
  return {creator,totals,recent_orders,payouts,daily,templates};
}
function adminSummary() {
  const creators = listCreators().map(c => ({creator:c,totals:dashboard(c.id,{days:1}).totals,activity:creatorAnalytics(c.id)}));
  const fields = ['clicks','unique_visitors','paid_customers','revenue_paise','earned_paise','received_paise','balance_paise','refund_paise','reversed_paise','net_earned_paise','net_revenue_paise'];
  const totals = Object.fromEntries(fields.map(k=>[k,creators.reduce((s,c)=>s+c.totals[k],0)]));
  totals.unique_visitors = one('SELECT COUNT(DISTINCT visitor_hash) AS n FROM partner_clicks').n;
  totals.conversion_rate = totals.unique_visitors ? totals.paid_customers/totals.unique_visitors*100 : 0;
  return {totals,creators,audit_log:all('SELECT * FROM partner_audit ORDER BY created_at DESC,id LIMIT 100'),pending_refunds:all('SELECT r.refund_id,r.payment_id,r.amount_paise,r.created_at FROM partner_refunds r LEFT JOIN partner_orders o ON o.payment_id=r.payment_id WHERE o.gateway_order_id IS NULL ORDER BY r.created_at')};
}
module.exports = {createPlatformCoupon,updatePlatformCoupon,listPlatformCoupons,adminPlatformCoupons,platformCouponByCode,couponOffer,classifyDevice,recordCreatorLogin,recordCreatorActivity,creatorAnalytics,creatorsAnalytics,createCreator,updateCreator,updateProfileImage,describeCoupon,listCreators,getCreator,creatorByUsername,creatorByCoupon,authenticate,createSession,getSession,deleteSession,recordClick,quote,reserveOrder,getOrder,settleOrder,refundPayment,recordPayout,dashboard,adminSummary};
