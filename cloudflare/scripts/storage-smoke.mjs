#!/usr/bin/env node
// LOCAL ONLY: this intentionally creates one test draft/upload in Miniflare.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:8787';const url=new URL(base);
if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Refusing writes to a remote deployment');
const r=await fetch(base+'/api/vaidehi/draft',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{"customer_data":{}}'});
assert.equal(r.status,200,await r.clone().text());const {id}=await r.json(),cookie=r.headers.get('set-cookie').split(';')[0];
let x=await fetch(base+'/vaidehi/preview/'+id);assert.equal(x.status,403);
x=await fetch(base+'/vaidehi/preview/'+id,{headers:{Cookie:cookie}});assert.equal(x.status,200);
const bytes=fs.readFileSync(new URL('../public/brand/favicon-512.png',import.meta.url));
x=await fetch(base+'/api/vaidehi/upload?id='+id,{method:'POST',headers:{'Content-Type':'image/png',Origin:base,Cookie:cookie},body:bytes});assert.equal(x.status,200,await x.clone().text());const media=(await x.json()).url;
x=await fetch(base+media);assert.equal(x.status,404);
x=await fetch(base+media,{headers:{Cookie:cookie}});assert.equal(x.status,200);assert.equal(Buffer.compare(Buffer.from(await x.arrayBuffer()),bytes),0);
x=await fetch(base+'/api/vaidehi/publish',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify({id})});assert.equal(x.status,503);assert.equal((await x.json()).error,'payments_offline');
console.log(JSON.stringify({localOnly:true,draftCreated:true,ownerPreview:true,foreignPreviewBlocked:true,r2UploadBytes:bytes.length,privateUploadBlocked:true,r2ReadMatches:true,checkoutBlocked:true},null,2));
