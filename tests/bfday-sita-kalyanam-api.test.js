'use strict';
// Integration smoke against the real family router and real temporary SQLite DB.
// Intentionally does not import the full application (which needs optional sharp).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-sita-api-'));
process.env.DATA_DIR = temp;
const { db,q } = require('../db');
const family = require('../lib/bfday/family');
const routes = require('../lib/bfdayRoutes');
const c = require('../templates/sita-kalyanam/config');
const schema = require('../templates/sita-kalyanam/schema');
function wav() {
  const b=Buffer.alloc(46);b.write('RIFF');b.writeUInt32LE(38,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(44100,24);b.writeUInt32LE(88200,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(2,40);return b;
}
test('Sita Kalyanam actual family routes: editor, draft, private uploads, update, publish and isolation', async t => {
  q.templateInsert({...c,config:c,status:'published',price:0});
  let base;
  const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,base);if(await routes.handle(req,res,u,{baseUrl:base}))return;res.writeHead(404);res.end();}catch(e){res.writeHead(500);res.end(e.message);}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(r=>server.close(r));db.close();fs.rmSync(temp,{recursive:true,force:true});});
  let cookie='';
  async function request(url,method='GET',body,auth=true,content='application/json',origin=base){const headers={Origin:origin};if(auth&&cookie)headers.Cookie=cookie;if(body!==undefined)headers['Content-Type']=content;const res=await fetch(base+url,{method,headers,body:body===undefined?undefined:content==='application/json'?JSON.stringify(body):body});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return res;}
  let r=await request('/sita-kalyanam/demo');assert.equal(r.status,200);assert.match(await r.text(),/data-sk-section="countdown"/);
  r=await request('/create/sita-kalyanam');assert.equal(r.status,200);const editor=await r.text();assert.match(editor,/sita-kalyanam-20261103/);for(const f of family.bySlug(c.slug).fields)assert.ok(editor.includes(f.id),f.id);
  const data={...structuredClone(c.demo),gallery:[],groomName:'Vikram Shah',brideName:'Ishita Rao',weddingDate:'2028-02-29',weddingTime:'08:15',venueName:'Customer Garden',venueAddress:'Customer Road'};
  r=await request('/api/sita-kalyanam/draft','POST',{customer_data:data});assert.equal(r.status,200);const draft=await r.json();assert.ok(draft.id);assert.ok(cookie);
  r=await request(draft.previewUrl,'GET',undefined,false);assert.equal(r.status,403);
  r=await request(draft.previewUrl);assert.equal(r.status,200);let preview=await r.text();assert.match(preview,/Vikram Shah/);assert.match(preview,/2028-02-29T08:15:00\+05:30/);assert.doesNotMatch(preview,/Aarav Mehta|Ananya Desai/);
  r=await request('/api/sita-kalyanam/upload?id='+draft.id,'POST',fs.readFileSync(path.join(__dirname,'../public/assets/bfday-demo/sita-kalyanam-couple-1.webp')),true,'image/webp');assert.equal(r.status,200);const photo=(await r.json()).url;
  r=await request(photo,'GET',undefined,false);assert.equal(r.status,404);
  r=await request('/api/sita-kalyanam/upload-audio?id='+draft.id,'POST',wav(),true,'audio/wav');assert.equal(r.status,200);const song=(await r.json()).url;
  r=await request(song,'GET',undefined,false);assert.equal(r.status,404);
  const finalData={...data,gallery:[{image:photo,caption:'Our own photograph'}],venuePhoto:photo,groomFamilyPhoto:photo,musicUpload:song,qrUrl:'https://example.com/our-wedding'};
  r=await request('/api/sita-kalyanam/draft','POST',{id:draft.id,customer_data:finalData});assert.equal(r.status,200);
  r=await request('/api/sita-kalyanam/draft','POST',{id:draft.id,customer_data:finalData},false);assert.equal(r.status,403);
  r=await request('/api/sita-kalyanam/publish','POST',{id:draft.id},true,'application/json','https://untrusted.example');assert.equal(r.status,403);
  r=await request('/api/sita-kalyanam/publish','POST',{id:draft.id});assert.equal(r.status,200);const published=await r.json();assert.match(published.slug,/^sita-kalyanam-[a-f0-9]{18}$/);
  const pg=q.paigaamBySlug(published.slug);assert.equal(pg.status,'published');assert.equal(pg.customer_data.musicUpload,song);assert.equal(pg.customer_data.gallery[0].image,photo);
  const html=family.bySlug(c.slug).render(pg,{baseUrl:base});assert.match(html,/Our own photograph/);assert.ok(html.includes(song));assert.ok(html.includes(photo));assert.match(html,/QR code/);assert.doesNotMatch(html,/Aarav Mehta|Ananya Desai/);
  const linked=schema.eventDetails(pg.customer_data.events[2],schema.resolve(pg.customer_data));assert.equal(linked.date,'2028-02-29');assert.equal(linked.time,'08:15');assert.equal(linked.venue,'Customer Garden');
  r=await request(photo,'GET',undefined,false);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/webp/);
  r=await request(song,'GET',undefined,false);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/audio\/wav/);
  // A completely separate creator cannot attach this customer's media.
  r=await request('/api/sita-kalyanam/draft','POST',{customer_data:{...data,gallery:[{image:photo,caption:''}]}},false);assert.equal(r.status,400);
  // Saved zero events/photos stay zero and do not revive demo rows.
  r=await request('/api/sita-kalyanam/draft','POST',{customer_data:{...data,events:[],gallery:[]}});assert.equal(r.status,200);const blank=await r.json();const saved=q.paigaamById(blank.id);assert.deepEqual(saved.customer_data.events,[]);assert.deepEqual(saved.customer_data.gallery,[]);
});
