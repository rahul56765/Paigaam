import assert from 'node:assert/strict';
import { letters } from '../src/legacy-letters.mjs';
const base=process.argv[2]||'http://127.0.0.1:8899';
const target=new URL(base);
if(target.protocol!=='http:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!=='/'||target.username||target.password)throw Error('Local HTTP only');
async function post(path,body,cookie){return fetch(base+path,{method:'POST',headers:{Origin:base,'CF-Connecting-IP':'198.51.100.222','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});}
for(const t of letters){
 let r=await fetch(base+'/create/'+t.slug);assert.equal(r.status,200,t.slug);
 const page=await r.text();assert.match(page,/cloudflare-letter-bridge/);
 r=await post('/api/'+t.route+'/draft',{customer_data:{recipientName:'Ananya',senderName:'Rahul'}});
 assert.equal(r.status,200,await r.clone().text());
 const d=await r.json(),cookie=r.headers.get('set-cookie').split(';')[0];
 r=await fetch(base+d.previewUrl,{headers:{Cookie:cookie}});assert.equal(r.status,200);
 const publish=()=>post('/api/'+t.route+'/publish',{id:d.id,expected_snapshot:d.snapshot},cookie);
 const all=await Promise.all([publish(),publish(),publish()]);
 for(const r of all)assert.equal(r.status,200,await r.clone().text());
 const results=await Promise.all(all.map(r=>r.json()));
 assert.ok(results.every(r=>r.url===results[0].url));
 r=await fetch(results[0].url);assert.equal(r.status,200);assert.ok((await r.text()).includes('Ananya'));
 r=await post('/api/'+t.route+'/draft',{id:d.id,customer_data:{recipientName:'Ananya',senderName:'Rahul'}},cookie);
 assert.equal(r.status,200,'unchanged retry can recover a lost publish response');
 r=await post('/api/'+t.route+'/publish',{id:d.id,expected_snapshot:d.snapshot});
 assert.equal(r.status,403);
}
console.log(JSON.stringify({localOnly:true,originalLegacyEditors:letters.length,publicationAndReplay:true,ownerChecks:true}));
