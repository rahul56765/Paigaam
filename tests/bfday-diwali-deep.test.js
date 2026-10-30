'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=require('../templates/diwali-deep/config'),schema=require('../templates/diwali-deep/schema'),{render}=require('../templates/diwali-deep/render'),family=require('../lib/bfday/family');
const htmlFor=(data=config.demo)=>render({customer_data:data},{isPreview:true,baseUrl:'https://paigaam.cc'});
const asset=name=>fs.readFileSync(path.join(__dirname,'../public/diwali-deep',name),'utf8');
const upload='/bfday/uploads/'+'a'.repeat(48);
const has=(h,s)=>assert.ok(h.includes(s),'missing: '+s);
const lacks=(h,s)=>assert.ok(!h.includes(s),'unexpected: '+s);
test('Diwali: family contract, valid demo, every field placed once, optional music',()=>{
  assert.ok(family.has(config.slug));assert.deepEqual(family.errors,[]);assert.doesNotThrow(()=>schema.validate(config.demo));
  const placed=config.steps.flatMap(s=>s.fields);assert.equal(new Set(placed).size,placed.length);assert.deepEqual([...placed].sort(),schema.FIELDS.map(f=>f.id).sort());assert.equal(config.backgroundMusic,false);
});
test('Diwali: exactly three cards with hidden inactive pages and accessible navigation',()=>{
  const h=htmlFor();assert.deepEqual([...h.matchAll(/data-dd-page data-kind="([^"]+)"/g)].map(m=>m[1]),['cover','invitation','welcome']);
  assert.equal((h.match(/aria-hidden="true" tabindex="-1" inert/g)||[]).length,2);assert.equal((h.match(/data-dd-go="/g)||[]).length,3);
  has(h,'data-dd-light');has(h,'data-dd-prev aria-label="Previous page" disabled');has(h,'aria-live="polite"');has(h,'swipe up to light the diya');lacks(h,'<audio');lacks(h,'class="dd-maps');
});
test('Diwali: all editable words rendered and markup escaped',()=>{
  const data={...config.demo};for(const f of config.fields.filter(f=>['text','textarea'].includes(f.type)))data[f.id]='Unique '+f.id;
  const h=htmlFor(data);for(const f of config.fields.filter(f=>['text','textarea'].includes(f.type)))has(h,'Unique '+f.id);
  const evil=htmlFor({...config.demo,familyName:'<img src=x onerror=alert(1)>',tagline:'<script>alert(1)</script>'});has(evil,'&lt;img');has(evil,'&lt;script&gt;');lacks(evil,'<script>alert');
});
test('Diwali: explicit blank optional copy stays blank instead of restoring example',()=>{
  const h=htmlFor({...config.demo,hostLine:'',regards:''});lacks(h,'Hosted by the Deshpande Family');lacks(h,'With warm regards');
});
test('Diwali: maps accepts Google share/location URLs only and hides missing links',()=>{
  for(const url of ['https://maps.app.goo.gl/Abcd','https://www.google.com/maps?q=Jaipur','https://goo.gl/maps/Abcd','https://maps.google.com/?q=Pune','https://www.google.co.in/maps/place/Mumbai']){
    assert.ok(schema.mapsLink(url));const h=htmlFor({...config.demo,mapsLink:url});has(h,'Open in Google Maps');has(h,'target="_blank" rel="noopener noreferrer"');
  }
  for(const url of ['javascript:alert(1)','http://google.com/maps','https://evil.test/maps','https://www.google.com.evil.test/maps','https://www.google.evil.com/maps','https://google.com@evil.test/maps']){
    assert.throws(()=>schema.validate({...config.demo,mapsLink:url}));assert.equal(schema.validate({...config.demo,mapsLink:url},{mode:'lenient'}).mapsLink,'');lacks(htmlFor({...config.demo,mapsLink:url}),'class="dd-maps');
  }
});
test('Diwali: photo upload, cover crop coordinates and safe placeholder',()=>{
  has(htmlFor(),'Your family portrait');const h=htmlFor({...config.demo,familyPhoto:upload+'.jpg',photoZoom:175,photoX:10,photoY:90});has(h,'--zoom:1.75;--x:10%;--y:90%');has(h,upload+'.jpg');lacks(h,'Your family portrait');
  for(const bad of ['https://evil.test/a.jpg','data:image/png;base64,abc'])assert.throws(()=>schema.validate({...config.demo,familyPhoto:bad}));
  for(const zoom of [99,241])assert.throws(()=>schema.validate({...config.demo,photoZoom:zoom}));
});
test('Diwali: direct or YouTube music supported and upload has priority',()=>{
  has(htmlFor({...config.demo,musicLink:'https://example.com/song.mp3'}),'<audio id="ddAudio"');has(htmlFor({...config.demo,musicLink:'https://youtu.be/dQw4w9WgXcQ'}),'data-youtube="dQw4w9WgXcQ"');
  const h=htmlFor({...config.demo,musicLink:'https://youtu.be/dQw4w9WgXcQ',musicUpload:upload+'.mp3'});has(h,upload+'.mp3');lacks(h,'data-youtube=');
  for(const url of ['https://open.spotify.com/track/a','https://example.com/a.html','http://example.com/a.mp3'])assert.throws(()=>schema.validate({...config.demo,musicLink:url}));
});
test('Diwali: original decorative SVG IDs are unique in every rendered page',()=>{
  const h=htmlFor(),ids=[...h.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  has(h,'dd-flame');has(h,'dd-hanging');has(h,'dd-rangoli');has(h,'dd-flame-shape');
});
test('Diwali: scripts parse and cover gesture includes proportional progress and cancellation',()=>{
  const js=asset('diwali.js');assert.doesNotThrow(()=>new Function(js));for(const s of ['setPointerCapture','pointercancel','lostpointercapture','queueProgress','is-cooling','requestAnimationFrame','prefers-reduced-motion','document.createElement(\'iframe\')','dd-hidden','contentWindow'])has(js,s);
  const css=asset('diwali.css');for(const s of ['width:360px;height:640px','transform:scale(var(--scale,1))','touch-action:none','dd-golden-flood','dd-flicker','dd-sway','dd-gold','dd-fall','object-position:var(--x','prefers-reduced-motion'])has(css,s);
});

test('Diwali: customizer renders all controls and crop sliders',()=>{
  const {bfdayCreatePage}=require('../pages/bfdayCreate');const h=bfdayCreatePage(family.bySlug(config.slug));
  for(const s of ['data-image="familyPhoto"','data-audio="musicUpload"','id="f-photoZoom"','id="f-photoX"','id="f-photoY"','id="f-mapsLink"'])has(h,s);
});

test('Diwali: isolated draft, photo replacement/removal, audio, preview and publish lifecycle',async t=>{
  const os=require('node:os'),http=require('node:http');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paigaam-diwali-'));
  const previous=process.env.DATA_DIR;process.env.DATA_DIR=dir;
  const {q,db}=require('../db'),routes=require('../lib/bfdayRoutes');q.templateInsert({name:config.name,slug:config.slug,category:'Diwali',status:'published',config});
  let base;const server=http.createServer(async(req,res)=>{try{if(!await routes.handle(req,res,new URL(req.url,base),{baseUrl:base,isAdmin:false})){res.writeHead(404);res.end();}}catch(e){res.writeHead(500);res.end(e.code||e.message);}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true});if(previous===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=previous;});
  const post=(p,cookie,data,type='application/json')=>fetch(base+p,{method:'POST',headers:{'content-type':type,...(cookie?{cookie}:{})},body:type==='application/json'?JSON.stringify(data):data});
  const prefix='/api/'+config.slug;
  let r=await fetch(base+'/create/'+config.slug);assert.equal(r.status,200);has(await r.text(),'data-image="familyPhoto"');
  r=await post(prefix+'/draft',null,{customer_data:config.demo});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],draft=await r.json();
  const png=require('./bfday-helpers').png();r=await post(prefix+'/upload?id='+draft.id,null,png,'image/png');assert.equal(r.status,403);
  const images=[];for(let i=0;i<2;i++){r=await post(prefix+'/upload?id='+draft.id,cookie,png,'image/png');assert.equal(r.status,200);images.push((await r.json()).url);}
  let data={...config.demo,familyPhoto:images[0],photoZoom:155,photoX:15,photoY:85,mapsLink:'https://maps.app.goo.gl/Diwali'};
  for(const image of [images[0],images[1],'',images[1]]){data.familyPhoto=image;r=await post(prefix+'/draft',cookie,{id:draft.id,customer_data:data});assert.equal(r.status,200);assert.equal(q.paigaamById(draft.id).customer_data.familyPhoto,image);}
  r=await fetch(base+draft.previewUrl,{headers:{cookie}});assert.equal(r.status,200);const preview=await r.text();has(preview,images[1]);has(preview,'--zoom:1.55;--x:15%;--y:85%');has(preview,'Open in Google Maps');
  assert.equal((await fetch(base+images[1])).status,404,'draft photo is private');
  const audio=Buffer.alloc(417);Buffer.from([0xff,0xfb,0x90,0]).copy(audio);r=await post(prefix+'/upload-audio?id='+draft.id,cookie,audio,'audio/mpeg');assert.equal(r.status,200);data.musicUpload=(await r.json()).url;
  r=await post(prefix+'/draft',cookie,{id:draft.id,customer_data:data});assert.equal(r.status,200);
  r=await post(prefix+'/publish',cookie,{id:draft.id});assert.equal(r.status,200);const pub=await r.json();assert.ok(pub.slug);
  const published=q.paigaamById(draft.id);assert.equal(published.status,'published');has(render(published),data.musicUpload);
  assert.equal((await fetch(base+images[1])).status,200);assert.equal((await fetch(base+images[0])).status,404,'replaced image is cleaned on publish');assert.equal((await fetch(base+data.musicUpload)).status,200);
});
