'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {png}=require('./bfday-helpers');
const config=require('../templates/vaidehi/config');
const root=path.resolve(__dirname,'..');
let child,dir,base,cookie='',id;
const data=()=>structuredClone(config.demo);
async function request(url,{method='GET',body,raw,type,owner=true}={}){
 const res=await fetch(base+url,{method,headers:{...(owner&&cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...(type?{'content-type':type}:{})},body:raw|| (body?JSON.stringify(body):undefined),redirect:'manual'});
 const text=await res.text();let json;try{json=JSON.parse(text)}catch{}return{status:res.status,text,json,headers:res.headers};
}
function wav(){const b=Buffer.alloc(44+1600);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(1600,40);return b;}
test.before(async()=>{
 dir=fs.mkdtempSync(path.join(os.tmpdir(),'vaidehi-api-'));const port=32000+Math.floor(Math.random()*10000);base='http://127.0.0.1:'+port;
 child=spawn(process.execPath,['scripts/qa-vaidehi-server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:dir,VAIDEHI_QA_FREE_PUBLISH:'1'},stdio:'ignore'});
 const start=Date.now();while(Date.now()-start<15000){try{if((await fetch(base+'/vaidehi/demo')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Isolated family server did not start');
});
test.after(()=>{if(child)child.kill();if(dir)fs.rmSync(dir,{recursive:true,force:true});});
test('real family routes render demo, six-step editor and changed stateless preview',async()=>{
 let r=await request('/vaidehi/demo');assert.equal(r.status,200);assert.ok(r.text.includes('Rohan Malhotra'));
 r=await request('/create/vaidehi');assert.equal(r.status,200);for(const f of config.fields)assert.ok(r.text.includes(f.id),'editor missing '+f.id);
 const d=data();d.groomName='Changed Groom';d.venueName='Changed Venue';
 r=await request('/vaidehi/preview-frame',{method:'POST',body:{customer_data:d}});assert.equal(r.status,200);assert.ok(r.text.includes('Changed Groom'));assert.ok(r.text.includes('Changed Venue'));assert.ok(!r.text.includes('Rohan Malhotra'));
});
test('real draft is owner-protected and rejects malformed customisation',async()=>{
 let r=await request('/api/vaidehi/draft',{method:'POST',body:{customer_data:data()}});assert.equal(r.status,200);id=r.json.id;cookie=r.headers.get('set-cookie').split(';')[0];
 assert.ok(id);assert.equal((await request('/vaidehi/preview/'+id)).status,200);assert.equal((await request('/vaidehi/preview/'+id,{owner:false})).status,403);
 r=await request('/api/vaidehi/draft',{method:'POST',body:{id,customer_data:{...data(),weddingTime:'99:99'}}});assert.equal(r.status,400);
});
test('actual image and audio uploads remain private until referenced by publication',async()=>{
 let r=await request('/api/vaidehi/upload?id='+id,{method:'POST',raw:png(120,120),type:'image/png'});assert.equal(r.status,200);const photo=r.json.url;
 r=await request('/api/vaidehi/upload-audio?id='+id,{method:'POST',raw:wav(),type:'audio/wav'});assert.equal(r.status,200);const audio=r.json.url;
 assert.equal((await request(photo,{owner:false})).status,404);assert.equal((await request(audio,{owner:false})).status,404);
 assert.equal((await request(audio)).status,200);
 const d={...data(),couplePhoto:photo,countdownPhoto:photo,gallery:[{photo,caption:'Customer photograph'}],musicUpload:audio,groomName:'Published Groom'};
 r=await request('/api/vaidehi/draft',{method:'POST',body:{id,customer_data:d}});assert.equal(r.status,200);
 r=await request('/api/vaidehi/publish',{method:'POST',body:{id}});assert.equal(r.status,200);assert.ok(r.json.slug.startsWith('vaidehi-'));
 const pub=await request('/p/'+r.json.slug,{owner:false});assert.equal(pub.status,200);assert.ok(pub.text.includes('Published Groom'));assert.ok(pub.text.includes(photo));assert.ok(pub.text.includes(audio));assert.ok(!pub.text.includes('Rohan Malhotra'));
 assert.equal((await request(photo,{owner:false})).status,200);assert.equal((await request(audio,{owner:false})).status,200);
});
