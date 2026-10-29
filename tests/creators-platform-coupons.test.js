'use strict';
const {test,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-platform-coupons-'));process.env.DATA_DIR=dir;
const store=require('../lib/creators/store'),{db}=require('../db');after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});let seq=0;
function creator(extra={}){let n=`site${++seq}`;return store.createCreator({username:n,display_name:n,password:'a secure creator password',commission_bps:1500,coupon_code:n.toUpperCase(),discount_bps:1000,...extra},'test');}
function fail(code,fn){assert.throws(fn,e=>e.code===code);}
test('Paigaam coupons can be created and quoted independent of creators',()=>{
 const p=store.createPlatformCoupon({code:'PAIGAAM10',description:'Welcome offer',discount_type:'percentage',discount_bps:1000,discount_flat_paise:0,discount_min_paise:0,discount_max_paise:2500,coupon_expires_at:'2090-01-01T00:00:00.000Z',enabled:true},'admin');
 assert.equal(p.code,'PAIGAAM10');assert.equal(p.description,'Welcome offer');assert.equal(p.enabled,true);assert.equal(store.couponOffer('paigaam10').source,'paigaam');
 const q=store.quote({amount_paise:9999,currency:'INR',coupon_code:'paigaam10'});assert.equal(q.coupon_source,'paigaam');assert.equal(q.creator_id,null);assert.equal(q.discount_paise,1000);assert.equal(q.amount_paise,8999);
 const o=store.reserveOrder({gateway_order_id:'sitewide-order',product_id:'product-sitewide',product_type:'paigaam',template_slug:'noor',...q});assert.equal(o.coupon_source,'paigaam');assert.equal(o.creator_id,null);
});
test('site-wide code preserves active referral commission attribution without stacking creator discounts',()=>{
 const c=creator();store.createPlatformCoupon({code:'OURS20',discount_type:'flat',discount_bps:0,discount_flat_paise:2000,discount_min_paise:5000,discount_max_paise:0,coupon_expires_at:'',enabled:true},'admin');
 const q=store.quote({amount_paise:10000,currency:'INR',referral_creator_id:c.id,coupon_code:'OURS20'});
 assert.equal(q.coupon_source,'paigaam');assert.equal(q.creator_id,c.id);assert.equal(q.coupon_code,'OURS20');assert.equal(q.discount_paise,2000);assert.equal(q.amount_paise,8000);assert.equal(q.commission_bps,1500);
 assert.equal(store.quote({amount_paise:10000,currency:'INR',coupon_code:c.coupon_code}).creator_id,c.id);
});
test('site coupon validation, expiry/disable, cross-namespace uniqueness and historical order snapshots',()=>{
 const c=creator();fail('conflict',()=>store.createPlatformCoupon({code:c.coupon_code,discount_type:'percentage',discount_bps:1000},'admin'));
 store.createPlatformCoupon({code:'OURS1',discount_type:'percentage',discount_bps:1000,expires_at:'',enabled:true},'admin');
 fail('conflict',()=>store.createCreator({username:'collision',display_name:'Collision',password:'a secure creator password',commission_bps:1000,coupon_code:'OURS1',discount_bps:1000},'admin'));
 const q=store.quote({amount_paise:10000,currency:'INR',coupon_code:'OURS1'}),o=store.reserveOrder({gateway_order_id:'snap-site',product_id:'snap-product',product_type:'paigaam',template_slug:'noor',...q});
 store.updatePlatformCoupon('OURS1',{discount_type:'flat',discount_bps:0,discount_flat_paise:5000,discount_min_paise:0,discount_max_paise:0,coupon_expires_at:'2000-01-01T00:00:00.000Z',enabled:false},'admin');
 assert.equal(store.getOrder(o.gateway_order_id).coupon_source,'paigaam');assert.equal(store.getOrder(o.gateway_order_id).discount_paise,1000);assert.equal(store.couponOffer('OURS1'),null);
 fail('invalid_coupon',()=>store.quote({amount_paise:10000,currency:'INR',coupon_code:'OURS1'}));
 fail('invalid_input',()=>store.createPlatformCoupon({code:'BAD0',discount_type:'flat',discount_bps:0,discount_flat_paise:0},'admin'));
 fail('invalid_input',()=>store.createPlatformCoupon({code:'BAD1',discount_type:'percentage',discount_bps:9001},'admin'));
});
