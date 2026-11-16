import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { D1 } from './d1-shim.mjs';
import * as s from '../src/magazines-store.mjs';
import { identity } from '../src/security.mjs';
const A='a'.repeat(64), B='b'.repeat(64);
const mapping={slug:'story',name:'Story',canvaTemplateId:'CANVA_123',pageCount:7,fields:[{key:'wish',canvaNames:['one','two'],type:'text',required:true,maxLength:90}],images:[{key:'photo_1',canvaName:'photo_1',required:true,frameAspect:1}],limits:{maxImageBytes:8388608}};
function db() { const d=new D1(); d.raw.exec(readFileSync(new URL('../migrations/0004_magazines.sql',import.meta.url),'utf8')); return d; }
async function setup(price=12345) {const d=db(); await s.installTemplateVersion(d,{id:'v1',mapping,amountPaise:price}); const draft=await s.createDraft(d,'v1',A); return {d,draft};}
async function inputs(d,id,who=A) { await s.saveFields(d,id,who,{wish:' Hello \n world '}); return s.putUpload(d,id,who,{slot:'photo_1',objectKey:`magazines/${id}/${'c'.repeat(32)}`,mime:'image/png',bytes:42,width:400,height:500}); }
test('parent session identity, owner isolation, full frozen source mapping and inputs',async()=>{
 const d=db(); const token='e'.repeat(64), req=new Request('https://example.test',{headers:{cookie:`paigaam_creator=${token}`}}); const person=await identity(req); assert.equal(person.token,token);
 await s.installTemplateVersion(d,{id:'v1',mapping,amountPaise:100}); const x=await s.createDraft(d,'v1',person.hash);
 assert.deepEqual(x.mapping,mapping); assert.equal(await s.getDraft(d,x.id,A),null); assert.equal(await s.saveFields(d,x.id,A,{wish:'bad'}),null);
 assert.equal(await s.putUpload(d,x.id,A,{slot:'photo_1',objectKey:`magazines/${x.id}/${'a'.repeat(32)}`,mime:'image/png',bytes:1,width:400,height:400}),null);
 assert.deepEqual(await s.listUploads(d,x.id,A),[]); assert.equal(await s.deleteUpload(d,x.id,A,'photo_1'),null);
 await inputs(d,x.id,person.hash); assert.equal((await s.getDraft(d,x.id,person.hash)).fields.wish,'Hello world');
 assert.equal((await s.latestDraft(d,'story',person.hash)).id,x.id);
 await s.installTemplateVersion(d,{id:'v2',mapping:{...mapping,name:'New'},amountPaise:1}); assert.equal((await s.getDraft(d,x.id,person.hash)).amount_paise,100);
 await assert.rejects(d.prepare("UPDATE magazine_template_versions SET amount_paise=1 WHERE id='v1'").run(),/immutable/);
});
test('atomic lock, immutable quote and gateway IDs; paid replay and job transition',async()=>{
 const {d,draft:x}=await setup(); assert.equal(await s.beginCheckout(d,x.id,A),null); await inputs(d,x.id);
 const [one,two]=await Promise.all([s.beginCheckout(d,x.id,A),s.beginCheckout(d,x.id,A)]); assert.equal([one,two].filter(Boolean).length,1);
 assert.equal((one||two).amount_paise,12345); assert.equal((await s.getDraft(d,x.id,A)).status,'payment_pending');
 assert.equal(await s.saveFields(d,x.id,A,{wish:'alter'}),null); assert.equal(await s.deleteUpload(d,x.id,A,'photo_1'),null);
 assert.equal(await s.putUpload(d,x.id,A,{slot:'photo_1',objectKey:`magazines/${x.id}/${'d'.repeat(32)}`,mime:'image/png',bytes:1,width:400,height:400}),null);
 assert.equal(await s.getCheckout(d,x.id,B),null); const pending=await s.attachGatewayOrder(d,x.id,'order_EXACT'); assert.equal(pending.gateway_order_id,'order_EXACT'); assert.equal(await s.attachGatewayOrder(d,x.id,'order_OTHER'),null);
 await assert.rejects(d.prepare('UPDATE magazine_checkouts SET amount_paise=1 WHERE draft_id=?').bind(x.id).run(),/immutable/);
 await assert.rejects(d.prepare("UPDATE magazine_checkouts SET gateway_order_id='changed' WHERE draft_id=?").bind(x.id).run(),/immutable/);
 assert.equal(await s.settlePaid(d,{gatewayOrderId:'order_EXACT',gatewayPaymentId:'pay_1',amountPaise:1,currency:'INR'}),null);
 const p={gatewayOrderId:'order_EXACT',gatewayPaymentId:'pay_1',amountPaise:12345,currency:'INR'};
 const paid=await Promise.all([s.settlePaid(d,p),s.settlePaid(d,p)]); assert.equal(paid[0].status,'paid'); assert.equal(paid[1].gateway_payment_id,'pay_1');
 assert.equal(await s.settlePaid(d,{...p,gatewayPaymentId:'pay_2'}),null); assert.equal(await s.getJob(d,x.id,B),null);
 const claims=await Promise.all([s.claimJob(d,x.id),s.claimJob(d,x.id)]); assert.equal(claims.filter(Boolean).length,1);
 assert.equal((await s.finishJob(d,x.id,'ready',{pdfKey:'private-pdf'})).status,'ready'); assert.equal((await s.finishJob(d,x.id,'ready',{pdfKey:'private-pdf'})).status,'ready'); assert.equal(await s.finishJob(d,x.id,'failed',{code:'x'}),null);
 assert.equal((await s.getDraft(d,x.id,A)).status,'ready'); await assert.rejects(d.prepare("UPDATE magazine_jobs SET result_json='{}' WHERE draft_id=?").bind(x.id).run(),/terminal/);
});
test('free path queues exactly one job, no gateway identifiers',async()=>{ const {d,draft:x}=await setup(0); await inputs(d,x.id); const c=await s.beginCheckout(d,x.id,A); assert.equal(c.status,'paid'); assert.equal(c.gateway_order_id,null); assert.equal((await s.getJob(d,x.id,A)).status,'queued'); assert.equal(await s.beginCheckout(d,x.id,A),null); });
test('batch failure rolls back settlement and job creation',async()=>{const {d,draft:x}=await setup(); await inputs(d,x.id); await s.beginCheckout(d,x.id,A); await s.attachGatewayOrder(d,x.id,'order_A'); d.raw.exec("CREATE TRIGGER fail_jobs BEFORE INSERT ON magazine_jobs BEGIN SELECT RAISE(ABORT,'job failure'); END;");
 await assert.rejects(s.settlePaid(d,{gatewayOrderId:'order_A',gatewayPaymentId:'pay_A',amountPaise:12345,currency:'INR'}),/job failure/);
 assert.equal((await s.getCheckout(d,x.id,A)).status,'pending'); assert.equal((await s.getDraft(d,x.id,A)).status,'payment_pending'); assert.equal(await s.getJob(d,x.id,A),null);
});
test('reject untrusted quotes, bad keys and exact duplicate payment IDs; do not store tokens',async()=>{
 const {d,draft:x}=await setup(); await inputs(d,x.id);
 await assert.rejects(d.prepare("INSERT INTO magazine_checkouts(draft_id,amount_paise,currency,status) VALUES(?,1,'INR','creating')").bind(x.id).run(),/quote/);
 await assert.rejects(s.putUpload(d,x.id,A,{slot:'unknown',objectKey:'bad',mime:'image/png',bytes:1,width:400,height:400}),/invalid upload/);
 assert.equal(await s.putUpload(d,x.id,A,{slot:'unknown',objectKey:`magazines/${x.id}/${'b'.repeat(32)}`,mime:'image/png',bytes:1,width:400,height:400}),null);
 const y=await s.createDraft(d,'v1',A); await inputs(d,y.id); await s.beginCheckout(d,x.id,A); await s.beginCheckout(d,y.id,A); await s.attachGatewayOrder(d,x.id,'order_1'); await s.attachGatewayOrder(d,y.id,'order_2');
 await s.settlePaid(d,{gatewayOrderId:'order_1',gatewayPaymentId:'pay_1',amountPaise:12345,currency:'INR'});
 await assert.rejects(s.settlePaid(d,{gatewayOrderId:'order_2',gatewayPaymentId:'pay_1',amountPaise:12345,currency:'INR'}),/UNIQUE/); assert.equal((await s.getCheckout(d,y.id,A)).status,'pending');
 assert.equal(d.raw.prepare("SELECT count(*) n FROM sqlite_master WHERE name LIKE '%canva%'").get().n,0);
 await assert.rejects(s.installTemplateVersion(d,{id:'vsecret',mapping:{...mapping,access_token:'not-a-real-token'},amountPaise:0}),/credential fields/);
 await s.claimJob(d,x.id); await assert.rejects(s.finishJob(d,x.id,'ready',{access_token:'not-a-real-token'}),/invalid job result/);
});
test('checkout insert failure rolls back draft lock; no partial free job',async()=>{
 const {d,draft:x}=await setup(0); await inputs(d,x.id); d.raw.exec("CREATE TRIGGER reject_job BEFORE INSERT ON magazine_jobs BEGIN SELECT RAISE(ABORT,'job unavailable'); END");
 await assert.rejects(s.beginCheckout(d,x.id,A),/job unavailable/);
 assert.equal((await s.getDraft(d,x.id,A)).status,'draft'); assert.equal(await s.getCheckout(d,x.id,A),null);
});
test('distinct concurrent payment callbacks cannot both settle, terminal failure cannot be retried',async()=>{
 const {d,draft:x}=await setup(); await inputs(d,x.id); await s.beginCheckout(d,x.id,A); await s.attachGatewayOrder(d,x.id,'order_race');
 const args={gatewayOrderId:'order_race',amountPaise:12345,currency:'INR'};
 const results=await Promise.all([s.settlePaid(d,{...args,gatewayPaymentId:'pay_one'}),s.settlePaid(d,{...args,gatewayPaymentId:'pay_two'})]);
 assert.equal(results.filter(Boolean).length,1); const stored=await s.getCheckout(d,x.id,A); assert.equal(stored.gateway_payment_id,results.find(Boolean).gateway_payment_id);
 await s.claimJob(d,x.id); assert.equal((await s.finishJob(d,x.id,'failed',{code:'export_failed'})).status,'failed');
 assert.equal(await s.claimJob(d,x.id),null); assert.equal(await s.finishJob(d,x.id,'ready',{pdfKey:'x'}),null);
 assert.equal((await s.getDraft(d,x.id,A)).status,'failed'); assert.equal(await s.beginCheckout(d,x.id,A),null);
});
test('migration is additive and compatible with every prior migration',()=>{
 const d=new D1(); for(const n of ['0002_admin.sql','0003_creators.sql','0004_magazines.sql']) d.raw.exec(readFileSync(new URL(`../migrations/${n}`,import.meta.url),'utf8'));
 assert.ok(d.raw.prepare("SELECT name FROM sqlite_master WHERE name='orders'").get()); assert.ok(d.raw.prepare("SELECT name FROM sqlite_master WHERE name='magazine_drafts'").get());
});
