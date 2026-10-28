'use strict';
const {test,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-discounts-'));
process.env.DATA_DIR = dir;
const store = require('../lib/creators/store');
const {db} = require('../db');
after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
let seq=0;
function creator(extra={}) {const n=`discount${++seq}`;return store.createCreator({username:n,display_name:'Discount creator',password:'a secure password 123',commission_bps:1234,coupon_code:n.toUpperCase(),discount_bps:1000,...extra},'admin');}
const quote=(c,amount=10000)=>store.quote({amount_paise:amount,currency:'INR',coupon_code:c.coupon_code});
const throws=(fn,code='invalid_input')=>assert.throws(fn,e=>e.code===code);
function reserve(q) {const n=++seq;return store.reserveOrder({gateway_order_id:`order${n}`,product_id:`product${n}`,product_type:'greeting',template_slug:'birthday',...q});}

test('default additive fields and public descriptor expose no credentials or personal fields',()=>{
  const c=creator();
  assert.equal(c.profile_image,'');assert.equal(c.discount_type,'percentage');assert.equal(c.discount_flat_paise,0);
  assert.equal(c.discount_min_paise,0);assert.equal(c.discount_max_paise,0);assert.equal(c.coupon_expires_at,'');assert.equal(c.coupon_enabled,true);
  assert.deepEqual(store.describeCoupon(c),{code:c.coupon_code,discount_bps:1000,discount_type:'percentage',discount_flat_paise:0,discount_min_paise:0,discount_max_paise:0,coupon_expires_at:''});
  assert.equal(store.describeCoupon(null),null);
});

test('percentage rounds half-up in integer paise before applying the optional cap',()=>{
  const c=creator({discount_bps:5000,discount_max_paise:501});
  assert.equal(quote(c,1001).discount_paise,501);
  assert.equal(quote(c,1003).discount_paise,501);
  store.updateCreator(c.id,{discount_max_paise:0},'admin');assert.equal(quote(c,1003).discount_paise,502);
  store.updateCreator(c.id,{discount_bps:0},'admin');assert.equal(quote(c).discount_paise,0);
});

test('flat discounts ignore retained percentage and percent-only cap; both types clamp to ₹1',()=>{
  const c=creator({discount_type:'flat',discount_flat_paise:20000,discount_bps:0,discount_max_paise:1});
  assert.equal(quote(c).discount_paise,9900);assert.equal(quote(c).amount_paise,100);
  assert.equal(quote(c,100).discount_paise,0);assert.equal(quote(c,101).discount_paise,1);
  const o=reserve(quote(c));assert.equal(o.discount_type,'flat');assert.equal(o.commission_paise,12);
  store.updateCreator(c.id,{discount_type:'percentage',discount_bps:9000,discount_max_paise:0},'admin');
  assert.equal(quote(c,100).amount_paise,100);assert.equal(quote(c,105).amount_paise,100);
  assert.equal(quote(c,1000).amount_paise,100);
});

test('minimum is checked against gross at the inclusive boundary for both coupon types only',()=>{
  for (const type of ['percentage','flat']) {
    const c=creator({discount_type:type,discount_flat_paise:101,discount_min_paise:10001});
    throws(()=>quote(c,10000),'coupon_minimum');assert.ok(quote(c,10001).discount_paise>0);
    const referral=store.quote({amount_paise:100,currency:'INR',referral_creator_id:c.id});
    assert.equal(referral.creator_id,c.id);assert.equal(referral.discount_paise,0);assert.equal(referral.discount_min_paise,0);
  }
});

test('expired and disabled coupon lookup is null but account/session/referral remain active',()=>{
  const c=creator({coupon_expires_at:'2000-01-01T00:00:00Z'}),token=store.createSession(c.id);
  assert.equal(store.getCreator(c.id).coupon_expires_at,'2000-01-01T00:00:00.000Z');
  assert.equal(store.creatorByCoupon(c.coupon_code),null);throws(()=>quote(c),'invalid_coupon');
  store.updateCreator(c.id,{coupon_expires_at:'2999-01-01T00:00:00Z'},'admin');assert.equal(store.creatorByCoupon(c.coupon_code).id,c.id);
  store.updateCreator(c.id,{coupon_enabled:false},'admin');assert.equal(store.getCreator(c.id).coupon_enabled,false);
  assert.equal(store.creatorByCoupon(c.coupon_code),null);throws(()=>quote(c),'invalid_coupon');
  assert.equal(store.getSession(token).creator.id,c.id);assert.equal(store.creatorByUsername(c.username).id,c.id);
  assert.equal(store.quote({amount_paise:100,currency:'INR',referral_creator_id:c.id}).creator_id,c.id);
  store.updateCreator(c.id,{coupon_enabled:true},'admin');assert.equal(quote(c).creator_id,c.id);
  store.updateCreator(c.id,{active:false},'admin');assert.equal(store.creatorByCoupon(c.coupon_code),null);
});

test('expiry boundary is exclusive, evaluated at lookup time rather than process start',()=>{
  const c=creator({coupon_expires_at:'2040-01-02T03:04:05.123Z'});
  const realNow=Date.now;
  try {Date.now=()=>Date.parse(c.coupon_expires_at)-1;assert.equal(store.creatorByCoupon(c.coupon_code).id,c.id);
    Date.now=()=>Date.parse(c.coupon_expires_at);assert.equal(store.creatorByCoupon(c.coupon_code),null);
  } finally {Date.now=realNow;}
});

test('strict monetary, type, boolean and real UTC date validation; failed updates are atomic',()=>{
  const c=creator();
  for(const field of ['discount_flat_paise','discount_min_paise','discount_max_paise']) {
    for(const value of [-1,0.1,'100',NaN,Infinity,null,1000000000001,Number.MAX_SAFE_INTEGER]) throws(()=>store.updateCreator(c.id,{[field]:value},'admin'));
    assert.equal(store.updateCreator(c.id,{[field]:1000000000000},'admin')[field],1000000000000);
  }
  for(const value of ['',null,'FLAT',0]) throws(()=>store.updateCreator(c.id,{discount_type:value},'admin'));
  for(const value of ['false',null,2]) throws(()=>store.updateCreator(c.id,{coupon_enabled:value},'admin'));
  for(const value of ['2026-02-30T00:00:00Z','2026-01-01','2026-01-01T00:00:00','2026-01-01T00:00:00+00:00','2026-01-01T24:00:00Z','not-a-date',null,0]) throws(()=>store.updateCreator(c.id,{coupon_expires_at:value},'admin'));
  throws(()=>creator({discount_type:'flat'}));throws(()=>creator({discount_type:'flat',discount_flat_paise:0}));
  const old=store.getCreator(c.id);throws(()=>store.updateCreator(c.id,{display_name:'Changed',discount_min_paise:-1},'admin'));assert.deepEqual(store.getCreator(c.id),old);
  const flat=creator({discount_type:'flat',discount_flat_paise:1});throws(()=>store.updateCreator(flat.id,{discount_flat_paise:0},'admin'));
  assert.equal(store.updateCreator(flat.id,{discount_type:'percentage',discount_flat_paise:0},'admin').discount_flat_paise,0);
});

test('partial legacy updates preserve all optional fields including toggle and image',()=>{
  const c=creator({discount_type:'flat',discount_flat_paise:1234,discount_min_paise:5000,discount_max_paise:100,coupon_expires_at:'2999-12-31T00:00:00Z',coupon_enabled:false});
  const image=`/creator/photos/${c.id}/${'a'.repeat(64)}.jpg`;store.updateProfileImage(c.id,image,'admin');
  const updated=store.updateCreator(c.id,{display_name:'New name',commission_bps:4321,discount_bps:500},'admin');
  for(const key of ['discount_type','discount_flat_paise','discount_min_paise','discount_max_paise','coupon_expires_at','coupon_enabled']) assert.equal(updated[key],c[key]);
  assert.equal(updated.profile_image,image);
});

test('profile helper accepts only same-creator generated local hex JPG; separate audited update preserves session and settings',()=>{
  const c=creator(),other=creator(),token=store.createSession(c.id),image=`/creator/photos/${c.id}/${'0123456789abcdef'.repeat(4)}.jpg`;
  for(const invalid of ['https://evil.test/a.jpg','//evil.test/a.jpg',`/creator/photos/${other.id}/${'a'.repeat(64)}.jpg`,`/creator/photos/${c.id}/../a.jpg`,`${image}?x=1`,image.replace('.jpg','.png'),image.replace(/a/g,'A'),null]) throws(()=>store.updateProfileImage(c.id,invalid,'admin'));
  const changed=store.updateProfileImage(c.id,image,'admin');assert.deepEqual(changed,{...c,profile_image:image});
  assert.equal(store.getSession(token).creator.profile_image,image);
  assert.equal(store.updateProfileImage(c.id,'','admin').profile_image,'');
  throws(()=>store.updateProfileImage('missing',image,'admin'),'not_found');
  throws(()=>store.updateCreator(c.id,{profile_image:'file:///etc/passwd'},'admin'));
  assert.ok(db.prepare("SELECT * FROM partner_audit WHERE entity_id=? AND action='creator.profile_image'").all(c.id).length===2);
});

test('flat immutable snapshots survive edits, expiry, disables, settlement and refunds',()=>{
  const c=creator({discount_type:'flat',discount_flat_paise:9999,discount_min_paise:500,discount_max_paise:1,coupon_expires_at:'2999-01-01T00:00:00Z'});
  const q=quote(c),o=reserve(q);
  store.updateCreator(c.id,{discount_type:'percentage',discount_bps:9000,discount_flat_paise:100,discount_min_paise:100000,discount_max_paise:300,coupon_expires_at:'2000-01-01T00:00:00Z',coupon_enabled:false,commission_bps:9000},'admin');
  const input={gateway_order_id:o.gateway_order_id,product_id:o.product_id,product_type:o.product_type,template_slug:o.template_slug,...q};
  assert.deepEqual(store.reserveOrder(input),o);
  throws(()=>store.reserveOrder({...input,discount_min_paise:501}),'idempotency_conflict');
  for(const [field,value] of Object.entries({discount_type:'percentage',discount_flat_paise:1,discount_min_paise:501,discount_max_paise:2,coupon_expires_at:''})) assert.throws(()=>db.prepare(`UPDATE partner_orders SET ${field}=? WHERE gateway_order_id=?`).run(value,o.gateway_order_id),/immutable/);
  const paid=store.settleOrder(o.gateway_order_id,`payment${++seq}`);assert.equal(paid.amount_paise,100);assert.equal(paid.discount_paise,9900);assert.equal(paid.commission_paise,12);
  assert.equal(paid.discount_flat_paise,9999);assert.equal(paid.coupon_expires_at,c.coupon_expires_at);
  store.refundPayment(paid.payment_id,`refund${++seq}`,99);store.refundPayment(paid.payment_id,`refund${++seq}`,1);assert.equal(store.dashboard(c.id).totals.balance_paise,0);
});

test('reservation retains legacy percentage guard, attribution checks and minimum payable for flat',()=>{
  const c=creator(),q=quote(c);
  throws(()=>reserve({...q,amount_paise:100,discount_paise:9900}),'invalid_quote');
  throws(()=>reserve({...q,discount_type:'flat',discount_flat_paise:100,amount_paise:100,discount_paise:9900}),'invalid_quote');
  throws(()=>reserve({...q,discount_type:'flat',discount_flat_paise:20000,amount_paise:99,discount_paise:9901}));
  throws(()=>reserve({...q,creator_id:null}),'invalid_quote');
  const {discount_type,discount_flat_paise,discount_min_paise,discount_max_paise,coupon_expires_at,...legacy}=q;
  const o=reserve(legacy);assert.equal(o.discount_type,'percentage');assert.equal(o.discount_flat_paise,0);
});

test('large flat and percentage coupons remain exact at maximum monetary bounds',()=>{
  const c=creator({discount_type:'flat',discount_flat_paise:1000000000000});
  const q=quote(c,1000000000000);assert.equal(q.discount_paise,999999999900);assert.equal(reserve(q).amount_paise,100);
  store.updateCreator(c.id,{discount_type:'percentage',discount_bps:3333,discount_max_paise:333299999999},'admin');
  assert.equal(quote(c,1000000000000).discount_paise,333299999999);
});

test('legacy database upgrade is additive/idempotent and preserves all old snapshot values and original trigger',()=>{
  const legacy=new DatabaseSync(':memory:');
  try {
    legacy.exec(`CREATE TABLE partner_creators (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,commission_bps INTEGER NOT NULL,
      coupon_code TEXT NOT NULL UNIQUE COLLATE NOCASE,discount_bps INTEGER NOT NULL,active INTEGER NOT NULL,created_at TEXT NOT NULL);
      INSERT INTO partner_creators VALUES ('legacy','legacy','Original','hash','salt',1234,'LEGACY',1234,1,'2020-01-01');
      CREATE TABLE partner_orders (
      gateway_order_id TEXT PRIMARY KEY, product_id TEXT NOT NULL,product_type TEXT NOT NULL,template_slug TEXT NOT NULL,
      visitor_hash TEXT NOT NULL DEFAULT '',creator_id TEXT,coupon_code TEXT NOT NULL,commission_bps INTEGER NOT NULL,
      discount_paise INTEGER NOT NULL,gross_paise INTEGER NOT NULL,amount_paise INTEGER NOT NULL,currency TEXT NOT NULL,
      commission_paise INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'reserved',created_at TEXT NOT NULL,
      paid_at TEXT,payment_id TEXT UNIQUE,credited INTEGER NOT NULL DEFAULT 0);
      INSERT INTO partner_orders VALUES ('old-order','old-product','greeting','birthday','','legacy','LEGACY',1234,1234,10001,8767,'INR',1082,'paid','2020-01-01','2020-01-01','old-payment',1);
      CREATE TRIGGER partner_order_snapshot BEFORE UPDATE ON partner_orders WHEN NEW.amount_paise IS NOT OLD.amount_paise BEGIN SELECT RAISE(ABORT,'legacy immutable snapshot'); END;`);
    const old=legacy.prepare('SELECT * FROM partner_orders').get();
    const originalTrigger=legacy.prepare("SELECT sql FROM sqlite_master WHERE name='partner_order_snapshot'").get().sql;
    const initialize=require('../lib/creators/schema');initialize(legacy);initialize(legacy);
    const migrated=legacy.prepare('SELECT * FROM partner_orders').get();
    for(const [key,value] of Object.entries(old)) assert.equal(migrated[key],value);
    assert.equal(legacy.prepare("SELECT sql FROM sqlite_master WHERE name='partner_order_snapshot'").get().sql,originalTrigger);
    assert.equal(migrated.discount_type,'percentage');assert.equal(migrated.discount_flat_paise,0);assert.equal(migrated.coupon_expires_at,'');
    const c=legacy.prepare('SELECT * FROM partner_creators').get();assert.equal(c.coupon_enabled,1);assert.equal(c.profile_image,'');assert.equal(c.discount_bps,1234);
    assert.throws(()=>legacy.exec("UPDATE partner_orders SET amount_paise=100 WHERE gateway_order_id='old-order'"),/legacy immutable/);
    assert.throws(()=>legacy.exec("UPDATE partner_orders SET discount_type='flat' WHERE gateway_order_id='old-order'"),/immutable order snapshot/);
    assert.equal(legacy.prepare('PRAGMA table_info(partner_creators)').all().filter(c=>c.name==='coupon_enabled').length,1);
  } finally {legacy.close();}
});
