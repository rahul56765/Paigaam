#!/usr/bin/env node
// Run against Wrangler locally or a staging URL. GETs and one rejected mutation only.
// This script never enables drafts or checkout, creates a payment, or imports data.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {list} from '../src/catalog.generated.mjs';
const base=(process.argv[2]||'http://127.0.0.1:8787').replace(/\/$/,'');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const urls=['/','/status',...list.flatMap(t=>['/templates/'+t.slug,'/create/'+t.slug,'/'+t.slug+'/demo'])];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())walk(f);else urls.push('/'+path.relative(root,f).split(path.sep).join('/'));}}walk(root);
const errors=[];let checked=0,bytes=0;const queue=[...urls];
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const url=queue.shift();try{const r=await fetch(base+url,{signal:AbortSignal.timeout(15000)});const b=await r.arrayBuffer();checked++;bytes+=b.byteLength;if(r.status!==200)errors.push({url,status:r.status});if(r.headers.get('x-powered-by')==='Express')errors.push({url,error:'unexpected server'});}catch(e){errors.push({url,error:e.message});}}}));
const state=await (await fetch(base+'/status')).json();if(state.checkout!=='disabled'||state.video!==false||state.legacyDataImported!==false)errors.push({error:'Unsafe preview state',state});
const blocked=await fetch(base+'/api/vaidehi/draft',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{"customer_data":{}}'});if(blocked.status!==503)errors.push({error:'Expected drafts blocked',status:blocked.status});
console.log(JSON.stringify({base,checked,bytes,templates:list.length,customerWritesBlocked:blocked.status===503,errors},null,2));if(errors.length)process.exitCode=1;
