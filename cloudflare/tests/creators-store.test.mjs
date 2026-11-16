import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1} from './d1-shim.mjs';
import * as c from '../src/creators-store.mjs';
const H='a'.repeat(64);
function db(){const d=new D1();d.raw.exec(readFileSync(new URL('../migrations/0002_admin.sql',import.meta.url),'utf8'));d.raw.exec(readFileSync(new URL('../migrations/0003_creators.sql',import.meta.url),'utf8'));return d;}
async function setup(d){await c.createCreator(d,{id:'c1',username:'alice',display_name:'Alice',commission_bps:3333},'admin');await c.createCreator(d,{id:'c2',username:'bobby',display_name:'Bob',commission_bps:2500},'admin');await c.createOffer(d,{code:'ALICE',source:'creator',creator_id:'c1',discount_bps:1000},'admin');await c.createOffer(d,{code:'OFFER',source:'paigaam',discount_type:'flat',discount_flat_paise:201},'admin');await c.recordReferral(d,{token_hash:H,creator_id:'c2',expires_at:Date.now()+86400000});}
let n=0;
async function order(d,{gross=1000,coupon='ALICE',ref=H,key,creator=true}={}){
 const snap=await c.quote(d,{amount_paise:gross,coupon_code:coupon,referral_hash:ref}); const i=(++n).toString(16).padStart(18,'0'),id='order'+n;
 d.raw.prepare("INSERT OR IGNORE INTO templates(slug,name,price) VALUES ('demo','Demo',1000)").run();
 d.raw.prepare("INSERT INTO invites(id,template_slug,owner_hash,status) VALUES (?,'demo','owner','payment_pending')").run(i);
 d.raw.prepare("INSERT INTO orders(id,invite_id,amount,currency) VALUES (?,?,?,'INR')").run(id,i,snap.amount_paise);
 const request={order_id:id,idempotency_key:key||'key'+n,amount_paise:gross,coupon_code:coupon,referral_hash:ref};
 await c.reserveOrder(d,request);return {id,i,snap,request};
}
function pay(d,o){d.raw.prepare("UPDATE orders SET status='paid',gateway_order_id=?,gateway_payment_id=? WHERE id=?").run('gw'+o.id,'pay'+o.id,o.id);}
test('quote attribution, rounding, source uniqueness, snapshot immutable and idempotent',async()=>{
 const d=db();await setup(d);const q=await c.quote(d,{amount_paise:1001,coupon_code:'alice',referral_hash:H});assert.equal(q.creator_id,'c1');assert.equal(q.discount_paise,100);assert.equal(q.commission_paise,300);
 assert.equal((await c.quote(d,{amount_paise:1000,coupon_code:'OFFER',referral_hash:H})).creator_id,'c2');
 await assert.rejects(c.createOffer(d,{code:'alice',source:'paigaam'},'admin'));
 const o=await order(d);assert.deepEqual(await c.reserveOrder(d,o.request),o.snap);await assert.rejects(c.reserveOrder(d,{...o.request,amount_paise:1100}),{code:'idempotency_conflict'});
 assert.throws(()=>d.raw.prepare("UPDATE creator_checkout_snapshots SET snapshot_json='{}' WHERE order_id=?").run(o.id),/immutable/);
 assert.throws(()=>d.raw.prepare("UPDATE creator_offers SET discount_bps=2000 WHERE code='ALICE'").run(),/not implemented/);
 assert.throws(()=>d.raw.prepare("DELETE FROM creator_checkout_snapshots WHERE order_id=?").run(o.id),/immutable/);
});
test('duplicate and concurrent verified callbacks credit exactly once; wrong payment fails closed',async()=>{
 const d=db();await setup(d);const o=await order(d);await assert.rejects(c.recordSale(d,o.id,'x'),{code:'sale_not_ready_or_payment_conflict'});pay(d,o);
 await Promise.all(Array.from({length:20},()=>c.recordSale(d,o.id,'pay'+o.id)));assert.equal(await c.balance(d,'c1'),o.snap.commission_paise);await assert.rejects(c.recordSale(d,o.id,'wrong'),{code:'sale_not_ready_or_payment_conflict'});
 assert.equal(d.raw.prepare('SELECT COUNT(*) n FROM creator_ledger').get().n,1);
 assert.throws(()=>d.raw.prepare("INSERT INTO creator_ledger VALUES ('sale:'||?,'c1','commission',1,?,datetime('now'))").run(o.id,o.id),/UNIQUE/);
});
test('partial concurrent refunds round cumulatively, duplicate IDs are idempotent and overrefund rejected',async()=>{
 const d=db();await setup(d);const o=await order(d);pay(d,o);await c.recordSale(d,o.id,'pay'+o.id);
 await Promise.all([c.refundPayment(d,'pay'+o.id,'r1',101),c.refundPayment(d,'pay'+o.id,'r2',202),c.refundPayment(d,'pay'+o.id,'r1',101)]);
 assert.equal(await c.balance(d,'c1'),o.snap.commission_paise-Math.round(o.snap.commission_paise*303/o.snap.amount_paise));
 await assert.rejects(c.refundPayment(d,'pay'+o.id,'r1',102),{code:'idempotency_conflict'});
 await assert.rejects(c.refundPayment(d,'pay'+o.id,'over',o.snap.amount_paise),{code:'refund_exceeds_payment'});
 await c.refundPayment(d,'pay'+o.id,'final',o.snap.amount_paise-303);assert.equal(await c.balance(d,'c1'),0);
 assert.throws(()=>d.raw.prepare("DELETE FROM creator_refunds WHERE refund_id='r1'").run(),/immutable/);
 await assert.rejects(c.refundPayment(d,'unknown','early',1),{code:'sale_not_found'});
});
test('payout is atomic, audited, idempotent, and concurrent overdrafts are rejected',async()=>{
 const d=db();await setup(d);const o=await order(d);pay(d,o);await c.recordSale(d,o.id,'pay'+o.id);
 const amt=o.snap.commission_paise;const a={amount_paise:amt-1,reference:'bank-1',idempotency_key:'p1'};
 const results=await Promise.allSettled([c.recordPayout(d,'c1',a,'admin'),c.recordPayout(d,'c1',{...a,reference:'bank-2',idempotency_key:'p2'},'admin')]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const winner=results[0].status==='fulfilled'?a:{...a,reference:'bank-2',idempotency_key:'p2'};
 const p=await c.recordPayout(d,'c1',winner,'admin');assert.equal(p.amount_paise,amt-1);assert.equal(await c.balance(d,'c1'),1);
 await assert.rejects(c.recordPayout(d,'c1',{...winner,amount_paise:1},'admin'),{code:'idempotency_conflict'});
 assert.equal(d.raw.prepare("SELECT COUNT(*) n FROM creator_audit WHERE action='payout.record'").get().n,1);assert.equal(d.raw.prepare("SELECT COUNT(*) n FROM creator_ledger WHERE kind='payout'").get().n,1);
});
test('invalid amounts, terms, expiration, canonical mismatches and referral hashes reject',async()=>{
 const d=db();await setup(d);for(const x of [-1,0,99,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER])await assert.rejects(c.quote(d,{amount_paise:x}));
 await assert.rejects(c.quote(d,{amount_paise:1000,currency:'USD'}),{code:'unsupported_currency'});await assert.rejects(c.quote(d,{amount_paise:1000,coupon_code:'unknown'}),{code:'invalid_coupon'});
 await assert.rejects(c.recordReferral(d,{token_hash:'raw-token',creator_id:'c1',expires_at:1}));
 await assert.rejects(c.createOffer(d,{code:'FLAT',source:'paigaam',discount_type:'flat'},'admin'));
 await assert.rejects(c.createOffer(d,{code:'BAD',source:'paigaam',expires_at:'2025-02-30T00:00:00Z'},'admin'));
 const o=await order(d);await assert.rejects(c.reserveOrder(d,{...o.request,order_id:'missing',idempotency_key:'new'}));
 pay(d,o); await c.recordSale(d,o.id,'pay'+o.id);
 assert.throws(()=>d.raw.prepare("UPDATE creator_ledger SET amount_paise=12").run(),/immutable/);
 assert.throws(()=>d.raw.prepare("UPDATE orders SET amount=12 WHERE id=?").run(o.id),/immutable/);
});
test('payment and sale roll back together on failure in canonical D1 batch',async()=>{
 const d=db();await setup(d);const o=await order(d);
 await assert.rejects(d.batch([
  d.prepare("UPDATE orders SET status='paid',gateway_order_id=?,gateway_payment_id=? WHERE id=?").bind('gw'+o.id,'pay'+o.id,o.id),
  d.prepare("UPDATE invites SET status='published',public_slug=NULL WHERE id=?").bind(o.i),
 ]));
 assert.equal(d.raw.prepare('SELECT status FROM orders WHERE id=?').get(o.id).status,'creating');
 assert.equal(d.raw.prepare('SELECT count(*) n FROM creator_sales').get().n,0);assert.equal(await c.balance(d,'c1'),0);
 pay(d,o);assert.equal(d.raw.prepare('SELECT count(*) n FROM creator_sales').get().n,1);
});
test('exact paise math near cap and SQL rejects forged reversals',async()=>{
 const d=db();await setup(d);const o=await order(d,{gross:1_000_000_000_000,coupon:'',ref:H});pay(d,o);
 const amount=333_333_333_333;
 assert.throws(()=>d.raw.prepare('INSERT INTO creator_refunds(refund_id,payment_id,amount_paise,prior_paise,reversal_paise) VALUES (?,?,?,?,?)').run('bad','pay'+o.id,amount,0,1),/incorrect refund reversal/);
 const r=await c.refundPayment(d,'pay'+o.id,'big',amount);
 assert.equal(BigInt(r.reversal_paise),(BigInt(o.snap.commission_paise)*BigInt(amount)+BigInt(o.snap.amount_paise)/2n)/BigInt(o.snap.amount_paise));
 await c.refundPayment(d,'pay'+o.id,'remaining',o.snap.amount_paise-amount);assert.equal(await c.balance(d,'c2'),0);
});
test('concurrent checkout reservations and idempotency key reuse',async()=>{
 const d=db();await setup(d);const o=await order(d);const outcomes=await Promise.all(Array.from({length:10},()=>c.reserveOrder(d,o.request)));for(const s of outcomes)assert.deepEqual(s,o.snap);
 const other=await order(d,{coupon:'',ref:''});await assert.rejects(c.reserveOrder(d,{...other.request,idempotency_key:o.request.idempotency_key}),{code:'idempotency_conflict'});
});
test('creator checkout atomically snapshots, locks, and elects one durable gateway winner',async()=>{
 const d=db();await setup(d);d.raw.prepare("INSERT INTO templates(slug,name,price) VALUES ('demo','Demo',1000)").run();
 const invite='abcdef012345678901';d.raw.prepare("INSERT INTO invites(id,template_slug,owner_hash) VALUES (?,'demo','secret-owner')").run(invite);
 const input={invite_id:invite,owner_hash:'secret-owner',idempotency_key:'checkout-key',amount_paise:1000,coupon_code:'ALICE',referral_hash:H};
 const all=await Promise.all(Array.from({length:10},()=>c.beginCreatorCheckout(d,input)));
 assert.equal(all.filter(x=>x.created).length,1);assert.equal(new Set(all.map(x=>x.order_id)).size,1);assert.equal(d.raw.prepare('SELECT status FROM invites WHERE id=?').get(invite).status,'payment_pending');
 await assert.rejects(c.beginCreatorCheckout(d,{...input,owner_hash:'other'}),{code:'idempotency_conflict'});
 await assert.rejects(c.beginCreatorCheckout(d,{...input,amount_paise:1001}),{code:'idempotency_conflict'});
 const id=all[0].order_id;assert.equal(d.raw.prepare('SELECT amount FROM orders WHERE id=?').get(id).amount,all[0].snapshot.amount_paise);
 d.raw.prepare("UPDATE orders SET status='paid',gateway_order_id='g',gateway_payment_id='p' WHERE id=?").run(id);assert.equal(await c.balance(d,'c1'),all[0].snapshot.commission_paise);
});
test('checkout lock failure rolls back order and snapshot',async()=>{
 const d=db();await setup(d);d.raw.prepare("INSERT INTO templates(slug,name) VALUES ('demo','Demo')").run();
 d.raw.prepare("INSERT INTO invites(id,template_slug,owner_hash) VALUES ('abcdef012345678902','demo','owner')").run();
 d.raw.exec("CREATE TRIGGER skip_lock BEFORE UPDATE ON invites BEGIN SELECT RAISE(IGNORE); END;");
 await assert.rejects(c.beginCreatorCheckout(d,{invite_id:'abcdef012345678902',owner_hash:'owner',idempotency_key:'failure',amount_paise:1000,coupon_code:'ALICE'}),/lock failed/);
 assert.equal(d.raw.prepare('SELECT COUNT(*) n FROM orders').get().n,0);assert.equal(d.raw.prepare('SELECT COUNT(*) n FROM creator_checkout_snapshots').get().n,0);
});
test('a later refund after a payout can create a negative balance',async()=>{
 const d=db();await setup(d);const o=await order(d);pay(d,o);await c.recordPayout(d,'c1',{amount_paise:o.snap.commission_paise,reference:'manual',idempotency_key:'full-payout'},'admin');
 await c.refundPayment(d,'pay'+o.id,'refund-after-payout',o.snap.amount_paise);assert.equal(await c.balance(d,'c1'),-o.snap.commission_paise);
 await assert.rejects(c.recordPayout(d,'c1',{amount_paise:1,reference:'manual',idempotency_key:'new-payout'},'admin'),/insufficient balance/);
});
