'use strict';
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-checkout-quotes-'));process.env.DATA_DIR=dir;
const store=require('../lib/creators/store'),tracking=require('../lib/creators/tracking');const {q,db}=require('../db');let server,origin;
before(async()=>{server=http.createServer((req,res)=>tracking.runRequest(req,res,origin,()=>tracking.handle(req,res,new URL(req.url,origin),{baseUrl:origin}).then(handled=>{if(!handled){res.statusCode=404;res.end();}}).catch(e=>{res.statusCode=500;res.end(e.message);})));await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true});});
const get=path=>fetch(origin+path,{redirect:'manual'});async function post(path,body,cookie){return fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(body)});}function cookie(r,n){const c=r.headers.getSetCookie().find(x=>x.startsWith(n+'='));assert.ok(c);return c.split(';')[0];}
test('checkout quote returns gross, discount and total without creating any payment order',async()=>{
 store.createPlatformCoupon({code:'SITEFLAT',description:'',discount_type:'flat',discount_bps:0,discount_flat_paise:1200,discount_min_paise:1000,discount_max_paise:0,coupon_expires_at:'',enabled:true},'admin');
 const t=q.templateInsert({name:'Quote fixture',slug:'quote-fixture',category:'wedding',price:499,status:'published'});const pg=q.paigaamInsert({template_id:t.id,customer_name:'private name'});
 const csrfPage=await get('/api/creator-coupon'),state=await csrfPage.json();let jar=cookie(csrfPage,'pg_partner_coupon_csrf');
 const baseRes=await post('/api/creator-coupon/quote',{csrf:state.csrf,product_id:pg.id,product_type:'paigaam',code:''},jar);assert.equal(baseRes.status,200);const base=await baseRes.json();assert.deepEqual([base.gross_paise,base.discount_paise,base.amount_paise,base.coupon_source],[49900,0,49900,'none']);
 const applied=await post('/api/creator-coupon',{csrf:state.csrf,code:'siteflat'},jar);assert.equal(applied.status,200);jar+='; '+cookie(applied,'pg_partner_coupon');
 const quoteRes=await post('/api/creator-coupon/quote',{csrf:state.csrf,product_id:pg.id,product_type:'paigaam',code:'SITEFLAT'},jar);assert.equal(quoteRes.status,200);const result=await quoteRes.json();assert.deepEqual([result.gross_paise,result.discount_paise,result.amount_paise,result.coupon_source,result.coupon_label],[49900,1200,48700,'paigaam','Paigaam offer']);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM partner_orders').get().n,0,'a quote does not create a gateway order');assert.equal(JSON.stringify(result).includes('private name'),false,'quote response does not expose customer data');
});
test('coupon quote requires valid CSRF/origin/product and checks gross minimum without changing price',async()=>{
 store.createPlatformCoupon({code:'MINPAY',discount_type:'flat',discount_bps:0,discount_flat_paise:5000,discount_min_paise:10000,discount_max_paise:0,coupon_expires_at:'',enabled:true},'admin');
 const tpl=q.templateInsert({name:'Minimum fixture',slug:'minimum-fixture',category:'wedding',price:49,status:'published'});const pg=q.paigaamInsert({template_id:tpl.id});
 const landing=await get('/api/creator-coupon'),token=await landing.json(),jar=cookie(landing,'pg_partner_coupon_csrf');
 assert.equal((await post('/api/creator-coupon/quote',{csrf:'bad',product_id:pg.id,product_type:'paigaam',code:''},jar)).status,403);
 const saved=await post('/api/creator-coupon',{csrf:token.csrf,code:'MINPAY'},jar);assert.equal(saved.status,200);const couponJar=jar+'; '+cookie(saved,'pg_partner_coupon');
 const min=await post('/api/creator-coupon/quote',{csrf:token.csrf,product_id:pg.id,product_type:'paigaam',code:'MINPAY'},couponJar);assert.equal(min.status,400);assert.equal((await min.json()).error,'coupon_minimum');
 const noCoupon=await post('/api/creator-coupon/quote',{csrf:token.csrf,product_id:pg.id,product_type:'paigaam',code:'',ignore_saved_coupon:true},couponJar);assert.equal((await noCoupon.json()).amount_paise,4900);
 assert.equal((await post('/api/creator-coupon/quote',{csrf:token.csrf,product_id:'../../secret',product_type:'paigaam',code:''},jar)).status,404);
});
test('checkout reuses a pending gateway order only when immutable coupon and attribution snapshot still matches',async()=>{
 const creator=store.createCreator({username:'retrycreator',display_name:'Retry creator',password:'a secure checkout password',commission_bps:1250,coupon_code:'RETRY725',discount_bps:725},'test');
 store.createPlatformCoupon({code:'PAIGAAM725',description:'Equal total different owner',discount_type:'percentage',discount_bps:725,discount_flat_paise:0,discount_min_paise:0,discount_max_paise:0,coupon_expires_at:'',enabled:true},'admin');
 const template=q.templateInsert({name:'Snapshot check',slug:'snapshot-check',category:'wedding',price:499,status:'published'});const draft=q.paigaamInsert({template_id:template.id});
 const originalQuote=store.quote({amount_paise:49900,currency:'INR',coupon_code:creator.coupon_code});const order=store.reserveOrder({gateway_order_id:'old-gateway-order',product_id:draft.id,product_type:'paigaam',template_slug:'snapshot-check',...originalQuote});
 const csrfPage=await get('/api/creator-coupon'),auth=await csrfPage.json();let jar=cookie(csrfPage,'pg_partner_coupon_csrf');
 const creatorCode=await post('/api/creator-coupon',{csrf:auth.csrf,code:creator.coupon_code},jar);assert.equal(creatorCode.status,200);jar+='; '+cookie(creatorCode,'pg_partner_coupon');
 const same=await post('/api/creator-coupon/quote',{csrf:auth.csrf,gateway_order_id:order.gateway_order_id,code:creator.coupon_code},jar);assert.equal((await same.json()).reuse_existing_order,true);
 const changed=await post('/api/creator-coupon/quote',{csrf:auth.csrf,gateway_order_id:order.gateway_order_id,code:'PAIGAAM725'},jar);assert.equal(changed.status,409,'an unapplied code cannot be quoted');
 const applied=await post('/api/creator-coupon',{csrf:auth.csrf,code:'PAIGAAM725'},jar);assert.equal(applied.status,200);
 const jarWithPromo=jar+'; '+cookie(applied,'pg_partner_coupon');const changedQuote=await post('/api/creator-coupon/quote',{csrf:auth.csrf,gateway_order_id:order.gateway_order_id,code:'PAIGAAM725'},jarWithPromo);assert.equal(changedQuote.status,200);const quote=await changedQuote.json();
 assert.equal(quote.amount_paise,order.amount_paise,'same discounted total');assert.equal(quote.reuse_existing_order,false,'source/creator/coupon snapshot differs despite identical charge');
});
