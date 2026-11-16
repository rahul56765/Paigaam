/** D1 creator accounting foundation, no auth, routes, provider calls, or imports.
 * Every mutating call requires transactional D1 statements / batch. All money is INR
 * paise. Caller must verify gateway signatures, captured/refunded amounts, and admin
 * authority before invoking financial operations. Canonical orders are in 0001.
 */
const MAX=1_000_000_000_000;
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const one=(db,sql,...args)=>q(db,sql,...args).first();
const uuid=()=>crypto.randomUUID();
function fail(code){const e=new Error(code);e.code=code;throw e;}
function str(v,name,max=200){if(typeof v!=='string'||!v.trim()||v.length>max||/[\x00-\x1f\x7f]/.test(v))fail('invalid_'+name);return v.trim();}
function num(v,name,min=0,max=MAX){if(!Number.isSafeInteger(v)||v<min||v>max)fail('invalid_'+name);return v;}
function bool(v,name){if(v!==true&&v!==false&&v!==0&&v!==1)fail('invalid_'+name);return v?1:0;}
function code(v){const c=str(v,'coupon',32).toUpperCase();if(!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(c))fail('invalid_coupon');return c;}
function iso(v){if(v==='')return '';if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v)||!Number.isFinite(Date.parse(v)))fail('invalid_expiry');const n=new Date(v).toISOString();if(n!==(v.includes('.')?v:v.replace('Z','.000Z')))fail('invalid_expiry');return n;}
function round(a,b,d=10000){return Number((BigInt(a)*BigInt(b)+BigInt(d)/2n)/BigInt(d));}
function hash(v){if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))fail('invalid_token_hash');return v;}
function terms(x){const t={discount_type:x.discount_type??'percentage',discount_bps:num(x.discount_bps??0,'discount_bps',0,9000),discount_flat_paise:num(x.discount_flat_paise??0,'flat'),discount_min_paise:num(x.discount_min_paise??0,'minimum'),discount_max_paise:num(x.discount_max_paise??0,'maximum'),expires_at:iso(x.expires_at??'')};if(!['percentage','flat'].includes(t.discount_type)||(t.discount_type==='flat'&&!t.discount_flat_paise))fail('invalid_discount');return t;}
/** Create creator and immutable admin audit in one statement. No auth credentials. */
export async function createCreator(db,input,actor){const id=str(input.id,'id'),username=str(input.username,'username',32).toLowerCase();if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username))fail('invalid_username');await q(db,'INSERT INTO creator_accounts(id,username,display_name,commission_bps,active,actor) VALUES(?,?,?,?,?,?)',id,username,str(input.display_name,'display_name',100),num(input.commission_bps,'commission',0,10000),bool(input.active??true,'active'),str(actor,'actor')).run();return getCreator(db,id);}
export const getCreator=(db,id)=>one(db,'SELECT * FROM creator_accounts WHERE id=?',str(id,'id'));
/** One namespace enforces creator/platform coupon uniqueness (case-insensitive). */
export async function createOffer(db,input,actor){const c=code(input.code),source=input.source,creator=input.creator_id??null,t=terms(input);if(!['creator','paigaam'].includes(source)||(source==='creator'?!creator:creator!==null))fail('invalid_source');if(creator)str(creator,'creator_id');await q(db,`INSERT INTO creator_offers(code,source,creator_id,discount_type,discount_bps,discount_flat_paise,discount_min_paise,discount_max_paise,expires_at,enabled,description,actor) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,c,source,creator,t.discount_type,t.discount_bps,t.discount_flat_paise,t.discount_min_paise,t.discount_max_paise,t.expires_at,bool(input.enabled??true,'enabled'),input.description?str(input.description,'description',160):'',str(actor,'actor')).run();return one(db,'SELECT * FROM creator_offers WHERE code=?',c);}
/** Store only a SHA-256 token hash, never a raw referral token. */
export async function recordReferral(db,{token_hash,creator_id,expires_at}){hash(token_hash);str(creator_id,'creator_id');num(expires_at,'expires_at',1,Number.MAX_SAFE_INTEGER);const r=await q(db,'INSERT INTO creator_referrals(token_hash,creator_id,expires_at) SELECT ?,id,? FROM creator_accounts WHERE id=? AND active=1',token_hash,expires_at,creator_id).run();if(!r.meta.changes)fail('invalid_creator');}
/** Quote chooses creator coupon over referral; platform coupon retains referral. */
export async function quote(db,{amount_paise,currency='INR',coupon_code='',referral_hash=''}){
 const gross=num(amount_paise,'amount',100);if(currency!=='INR')fail('unsupported_currency');const c=coupon_code?code(coupon_code):'';
 let offer=c?await one(db,`SELECT o.*, a.active AS creator_active FROM creator_offers o LEFT JOIN creator_accounts a ON a.id=o.creator_id WHERE o.code=? COLLATE NOCASE AND o.enabled=1`,c):null;
 if(c&&(!offer||(offer.expires_at&&Date.parse(offer.expires_at)<=Date.now())||(offer.source==='creator'&&!offer.creator_active)))fail('invalid_coupon');
 let creator=null;if(offer?.source==='creator')creator=await getCreator(db,offer.creator_id);
 else if(referral_hash){hash(referral_hash);creator=await one(db,`SELECT a.* FROM creator_referrals r JOIN creator_accounts a ON a.id=r.creator_id WHERE r.token_hash=? AND r.expires_at>? AND a.active=1`,referral_hash,Date.now());}
 const t=offer?terms(offer):terms({});if(c&&gross<t.discount_min_paise)fail('coupon_minimum');
 let discount=c?(t.discount_type==='flat'?t.discount_flat_paise:round(gross,t.discount_bps)):0;if(t.discount_type==='percentage'&&t.discount_max_paise)discount=Math.min(discount,t.discount_max_paise);discount=Math.min(discount,gross-100);
 const bps=creator?.commission_bps??0, amount=gross-discount;
 return {creator_id:creator?.id??null,coupon_code:c,coupon_source:offer?.source??'none',commission_bps:bps,discount_paise:discount,gross_paise:gross,amount_paise:amount,currency:'INR',...t,commission_paise:round(amount,bps),coupon_description:offer?.description??''};
}
/** Reserve once against an existing creating canonical order, before gateway call.
 * Replays require identical request and return the ORIGINAL quote, not current terms. */
export async function reserveOrder(db,input){
 const order_id=str(input.order_id,'order_id'), key=str(input.idempotency_key,'idempotency_key');
 const req={amount_paise:num(input.amount_paise,'amount',100),currency:input.currency??'INR',coupon_code:input.coupon_code?code(input.coupon_code):'',referral_hash:input.referral_hash?hash(input.referral_hash):''};
 const request=JSON.stringify(req);const old=await one(db,'SELECT * FROM creator_checkout_snapshots WHERE order_id=? OR idempotency_key=?',order_id,key);
 if(old){if(old.order_id!==order_id||old.idempotency_key!==key||old.request_json!==request)fail('idempotency_conflict');return JSON.parse(old.snapshot_json);}
 const snapshot=await quote(db,req);
 // Existence and amount of the canonical checkout are checked by the trigger.
 // Creator/offer mutation APIs are intentionally absent; no stale quote can be
 // produced by this module's own concurrent writes to terms.
 try{await q(db,'INSERT INTO creator_checkout_snapshots(order_id,idempotency_key,request_json,snapshot_json,creator_id,amount_paise,commission_paise) VALUES(?,?,?,?,?,?,?)',order_id,key,request,JSON.stringify(snapshot),snapshot.creator_id,snapshot.amount_paise,snapshot.commission_paise).run();}
 catch(e){const prior=await one(db,'SELECT * FROM creator_checkout_snapshots WHERE order_id=? OR idempotency_key=?',order_id,key);if(prior){if(prior.order_id!==order_id||prior.idempotency_key!==key||prior.request_json!==request)fail('idempotency_conflict');return JSON.parse(prior.snapshot_json);}throw e;}
 return snapshot;
}
export async function getSnapshot(db,orderId){const row=await one(db,'SELECT * FROM creator_checkout_snapshots WHERE order_id=?',str(orderId,'order_id'));return row?{...row,request:JSON.parse(row.request_json),snapshot:JSON.parse(row.snapshot_json)}:null;}
/** The SQL trigger atomically records a sale with the canonical paid transition.
 * This method confirms / reconciles an already-paid canonical order. The caller
 * owns payment verification and publication. */
export async function recordSale(db,orderId,paymentId){str(orderId,'order_id');str(paymentId,'payment_id');
 await q(db,`INSERT INTO creator_sales(order_id,invite_id,payment_id,creator_id,amount_paise,commission_paise)
 SELECT o.id,o.invite_id,o.gateway_payment_id,s.creator_id,o.amount,s.commission_paise FROM orders o JOIN creator_checkout_snapshots s ON s.order_id=o.id
 WHERE o.id=? AND o.status='paid' AND o.gateway_payment_id=? AND NOT EXISTS(SELECT 1 FROM creator_sales WHERE order_id=o.id)`,orderId,paymentId).run();
 const row=await one(db,'SELECT * FROM creator_sales WHERE order_id=?',orderId);if(!row||row.payment_id!==paymentId)fail('sale_not_ready_or_payment_conflict');return row;
}
/** Refunds require an already-recorded sale; unknown/early refunds fail closed.
 * Cumulative proportional rounding matches the original and uses BigInt. */
export async function refundPayment(db,paymentId,refundId,amount){str(paymentId,'payment_id');str(refundId,'refund_id');num(amount,'amount',1);
 for(let attempt=0;attempt<8;attempt++){
  const old=await one(db,'SELECT * FROM creator_refunds WHERE refund_id=?',refundId);if(old){if(old.payment_id!==paymentId||old.amount_paise!==amount)fail('idempotency_conflict');return old;}
  const sale=await one(db,'SELECT * FROM creator_sales WHERE payment_id=?',paymentId);if(!sale)fail('sale_not_found');
  const prior=(await one(db,'SELECT COALESCE(SUM(amount_paise),0) n FROM creator_refunds WHERE payment_id=?',paymentId)).n;if(prior+amount>sale.amount_paise){const concurrent=await one(db,'SELECT * FROM creator_refunds WHERE refund_id=?',refundId);if(concurrent){if(concurrent.payment_id!==paymentId||concurrent.amount_paise!==amount)fail('idempotency_conflict');return concurrent;}fail('refund_exceeds_payment');}
  const reversal=round(sale.commission_paise,prior+amount,sale.amount_paise)-round(sale.commission_paise,prior,sale.amount_paise);
  const r=await q(db,`INSERT INTO creator_refunds(refund_id,payment_id,amount_paise,prior_paise,reversal_paise)
   SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM creator_refunds WHERE refund_id=?)
   AND ?=(SELECT COALESCE(SUM(amount_paise),0) FROM creator_refunds WHERE payment_id=?)`,refundId,paymentId,amount,prior,reversal,refundId,prior,paymentId).run();
  if(r.meta.changes)return one(db,'SELECT * FROM creator_refunds WHERE refund_id=?',refundId);
 }
 fail('concurrent_refund_retry');
}
export async function balance(db,creatorId){str(creatorId,'creator_id');const n=(await one(db,'SELECT COALESCE(SUM(amount_paise),0) n FROM creator_ledger WHERE creator_id=?',creatorId)).n;if(!Number.isSafeInteger(n))fail('balance_out_of_range');return n;}
/** Manual accounting only: caller confirms an actual external payout beforehand. */
export async function recordPayout(db,creatorId,input,actor){
 str(creatorId,'creator_id');const amount=num(input.amount_paise,'amount',1),key=str(input.idempotency_key,'idempotency_key'),reference=str(input.reference,'reference'),note=input.note?str(input.note,'note',1000):'',who=str(actor,'actor');
 const paid=input.paid_at===undefined?null:iso(input.paid_at);if(input.paid_at!==undefined&&!paid)fail('invalid_paid_at');
 const matches=r=>r.creator_id===creatorId&&r.amount_paise===amount&&r.reference===reference&&r.note===note&&r.actor===who&&(!paid||r.paid_at===paid);
 let old=await one(db,'SELECT * FROM creator_payouts WHERE idempotency_key=?',key);if(old){if(!matches(old))fail('idempotency_conflict');return old;}
 const id=uuid();await q(db,`INSERT INTO creator_payouts(id,idempotency_key,creator_id,amount_paise,reference,note,paid_at,actor)
 SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM creator_payouts WHERE idempotency_key=?)`,id,key,creatorId,amount,reference,note,paid??new Date().toISOString(),who,key).run();
 old=await one(db,'SELECT * FROM creator_payouts WHERE idempotency_key=?',key);if(!old||!matches(old))fail('idempotency_conflict');return old;
}
/** Atomically claim a draft invite and persist its immutable creator quote before
 * any gateway call. `created` is true ONLY for the single gateway-call winner;
 * retries return created:false and MUST NOT start another gateway order. A
 * creating order after a timeout requires provider reconciliation, not unlock.
 * Null means the invite is not an owned draft. Never expose owner_hash. */
export async function beginCreatorCheckout(db,input){
 const invite=str(input.invite_id,'invite_id'),owner=str(input.owner_hash,'owner_hash'),key=str(input.idempotency_key,'idempotency_key');
 const req={invite_id:invite,amount_paise:num(input.amount_paise,'amount',100),currency:input.currency??'INR',coupon_code:input.coupon_code?code(input.coupon_code):'',referral_hash:input.referral_hash?hash(input.referral_hash):''};
 const request=JSON.stringify(req);
 async function prior(){const row=await one(db,`SELECT s.*,i.owner_hash FROM creator_checkout_snapshots s JOIN orders o ON o.id=s.order_id JOIN invites i ON i.id=o.invite_id WHERE s.idempotency_key=?`,key);if(!row)return null;if(row.owner_hash!==owner||row.request_json!==request)fail('idempotency_conflict');return {created:false,order_id:row.order_id,snapshot:JSON.parse(row.snapshot_json)};}
 const old=await prior();if(old)return old;
 const snapshot=await quote(db,req);const orderId=Array.from(crypto.getRandomValues(new Uint8Array(9)),b=>b.toString(16).padStart(2,'0')).join('');
 try{
  const results=await db.batch([
   q(db,`INSERT INTO orders(id,invite_id,amount,currency) SELECT ?,id,?,'INR' FROM invites WHERE id=? AND owner_hash=? AND status='draft'`,orderId,snapshot.amount_paise,invite,owner),
   q(db,`INSERT INTO creator_checkout_snapshots(order_id,idempotency_key,request_json,snapshot_json,creator_id,amount_paise,commission_paise)
    SELECT id,?,?,?,?,?,? FROM orders WHERE id=? AND invite_id=? AND status='creating'`,key,request,JSON.stringify(snapshot),snapshot.creator_id,snapshot.amount_paise,snapshot.commission_paise,orderId,invite),
   q(db,'SELECT order_id FROM creator_checkout_snapshots WHERE order_id=?',orderId),
  ]);
  if(!results[2].results.length)return await prior();
  return {created:true,order_id:orderId,snapshot};
 }catch(error){const existing=await prior();if(existing)return existing;throw error;}
}
