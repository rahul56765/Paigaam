'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const config=require('../templates/vaidehi/config');
const schema=require('../templates/vaidehi/schema');
const {render,view,dateParts,displayTime}=require('../templates/vaidehi/render');
const family=require('../lib/bfday/family');
const {qrSVG}=require('../lib/qrcode');
const demo=()=>structuredClone(config.demo);
const page=(data=demo(),opts={})=>render({customer_data:data,slug:'vaidehi-test'},{baseUrl:'https://paigaam.cc',...opts});
const has=(s,x)=>assert.ok(s.includes(x),'missing '+x);
const not=(s,x)=>assert.ok(!s.includes(x),'unexpected '+x);
const upload='/bfday/uploads/'+'a'.repeat(48)+'.jpg';

test('Vaidehi registers once with strict-valid demo and all fields placed once',()=>{
 assert.ok(family.has('vaidehi'));assert.deepEqual(family.errors,[]);
 assert.equal(family.list.filter(t=>t.slug==='vaidehi').length,1);
 assert.doesNotThrow(()=>schema.validate(demo()));
 assert.deepEqual(config.steps.flatMap(s=>s.fields).sort(),schema.FIELDS.map(f=>f.id).sort());
 assert.ok(config.steps.length<=7);assert.equal(config.backgroundMusic,false);
});
test('seven scroll panels follow opening gate in the eight-section reference order',()=>{
 const s=page();
 assert.deepEqual([...s.matchAll(/<section id="vv-([a-z]+)"/g)].map(m=>m[1]),['cover','details','moments','welcome','blessings','schedule','countdown']);
 assert.ok(s.indexOf('id="vv-gate"')<s.indexOf('id="vv-cover"'));
 assert.equal((s.match(/aria-label="Enlarge photograph/g)||[]).length,4);
 has(s,'data-target="1802957400000"');has(s,'Thursday');has(s,'18 February 2027');
 for(const val of ['Rohan Malhotra','Kiara Shah','Aarohi Gardens','7:00 PM','10:00 AM','4:00 PM','8:30 PM'])has(s,val);
});
test('all identity and wedding fields propagate without old sample details',()=>{
 const d=demo();Object.assign(d,{groomName:'Aarav Rao',brideName:'Isha Bose',weddingDate:'2028-03-12',weddingTime:'18:45',venueName:'New Garden',venueAddress:'New address',groomFamily:'The Rao family',brideFamily:'The Bose family',invitationMessage:'A personal welcome',blessingMessage:'A special blessing'});
 const s=page(d),v=view(d);
 for(const x of ['Rohan','Kiara','Aarohi','Gulmohar','Thursday','18 February 2027'])not(s,x);
 for(const x of ['Aarav Rao','Isha Bose','New Garden','New address','The Rao family','The Bose family','A personal welcome','A special blessing','Sunday','6:45 PM'])has(s,x);
 assert.equal(v.events[2].date,d.weddingDate);assert.equal(v.events[2].time,d.weddingTime);assert.equal(v.events[3].date,d.weddingDate);
 assert.ok(v.events.every(e=>e.venueName===d.venueName&&e.venueAddress===d.venueAddress));
 assert.equal(v.qr,v.map);assert.ok(decodeURIComponent(v.qr).includes('New Garden, New address'));
 assert.equal(v.target,schema.timestamp(d.weddingDate,d.weddingTime,'+05:30'));
});
test('weekday wording supports explicit override and automatic derivation',()=>{
 assert.equal(dateParts('2027-02-18').weekday,'Thursday');assert.equal(view({...demo(),weddingDay:'A beautiful Thursday'}).day,'A beautiful Thursday');
 assert.equal(view({...demo(),weddingDate:'2027-02-19'}).day,'Friday');
 assert.equal(displayTime('00:00'),'12:00 AM');assert.equal(displayTime('12:00'),'12:00 PM');assert.equal(displayTime('23:59'),'11:59 PM');assert.equal(displayTime('25:00'),'');
});
test('per-event dates, times and venues override inheritance independently',()=>{
 const d=demo();d.events[2]={...d.events[2],date:'2028-04-10',time:'06:20',venueName:'Temple',venueAddress:'Temple road'};
 const v=view(d);assert.equal(v.events[2].date,'2028-04-10');assert.equal(v.events[2].time,'06:20');assert.equal(v.events[2].venueName,'Temple');
 assert.ok(decodeURIComponent(v.events[2].map).includes('Temple, Temple road'));
 d.mapsUrl='https://maps.google.com/?q=main';assert.equal(view(d).events[0].map,'https://maps.google.com/?q=main');
 assert.notEqual(view(d).events[2].map,d.mapsUrl);
 d.events[2].mapsUrl='https://maps.google.com/?q=temple';assert.equal(view(d).events[2].map,d.events[2].mapsUrl);
 d.events=d.events.slice().reverse();assert.ok(page(d).indexOf('<h3>Reception')<page(d).indexOf('<h3>Haldi'));
});
test('explicit empty events and gallery do not restore sample data',()=>{
 const d={...demo(),events:[],gallery:[],couplePhoto:''};const s=page(d);
 assert.equal(view(d).events.length,0);not(s,'<h3>Haldi');not(s,'data-vv-photo="');has(s,'Our story is just beginning');
});
test('no fictional names, photos or venue leak into a new customer invitation',()=>{
 const s=page({groomName:'Customer A',brideName:'Customer B'});
 for(const x of ['Rohan','Kiara','Aarohi','vaidehi-demo-'])not(s,x);
});
test('12 gallery photos and 20 arbitrary events render without count truncation',()=>{
 const d=demo();d.gallery=Array.from({length:12},(_,i)=>({photo:upload,caption:'Photo '+i}));d.couplePhoto='';
 d.events=Array.from({length:20},(_,i)=>({...d.events[0],kind:'other',name:'Celebration '+i}));
 assert.doesNotThrow(()=>schema.validate(d));const s=page(d);assert.equal((s.match(/data-vv-photo="/g)||[]).length,12);assert.equal((s.match(/<li class="vv-event /g)||[]).length,20);
 assert.throws(()=>schema.validate({...d,events:[...d.events,d.events[0]]}));assert.throws(()=>schema.validate({...d,gallery:[...d.gallery,d.gallery[0]]}));
});
test('couple and countdown uploads are used as live image references',()=>{
 const s=page({...demo(),couplePhoto:upload,countdownPhoto:upload,gallery:[]});
 has(s,'src="'+upload+'"');has(s,'vv-countdown-photo');assert.equal((s.match(/data-vv-photo="/g)||[]).length,1);
});
test('QR is local, dynamic and exactly encodes the configured destination',()=>{
 const d=demo();d.qrDestination='https://example.com/wedding?a=1&b=2';let s=page(d);
 has(s,qrSVG(d.qrDestination,{dark:'#424b3a',light:'#ffffff',module:3,margin:4}));
 const old=qrSVG(d.qrDestination);d.qrDestination='https://example.com/new';assert.notEqual(qrSVG(d.qrDestination),old);
 has(page(d),'href="https://example.com/new"');not(s,'api.qrserver');not(s,'chart.googleapis');
});
test('overlong QR URLs fail publishing, but malformed live previews never crash',()=>{
 const d={...demo(),venueName:'ऋ'.repeat(150),venueAddress:'ऋ'.repeat(500)};
 assert.throws(()=>schema.validate(d),e=>e.code==='qr_destination_too_long');
 assert.doesNotThrow(()=>schema.validate(d,{mode:'draft'}));
 has(page(d),'Use a shorter destination link');
});
test('countdown inheritance, independent overrides and legal UTC offsets are deterministic',()=>{
 assert.equal(schema.timestamp('2027-02-18','19:00','+05:30'),Date.parse('2027-02-18T13:30:00Z'));
 assert.equal(schema.timestamp('2027-02-18','19:00','-04:00'),Date.parse('2027-02-18T23:00:00Z'));
 const d={...demo(),countdownDate:'2027-02-17',countdownTime:'10:00'};
 assert.equal(view(d).target,schema.timestamp('2027-02-17','10:00'));has(page(d),'17 February 2027 · 10:00 AM');
 assert.equal(view({...demo(),countdownTime:'10:00'}).target,schema.timestamp('2027-02-18','10:00'));
 for(const x of ['+14:01','-15:00','05:30','+05:99'])assert.throws(()=>schema.validate({...demo(),utcOffset:x}));
 for(const x of ['+14:00','-14:00','+00:00'])assert.doesNotThrow(()=>schema.validate({...demo(),utcOffset:x}));
});
test('invalid dates, unsafe URLs, invalid times and forged upload references are refused',()=>{
 for(const patch of [{weddingDate:'2027-02-30'},{weddingTime:'25:00'},{countdownTime:'6 pm'},{mapsUrl:'javascript:alert(1)'},{qrDestination:'http://example.com'},{mapsUrl:'https://user:pass@example.com'},{couplePhoto:'https://example.com/photo.jpg'},{musicUpload:'/uploads/not-owned.mp3'}])assert.throws(()=>schema.validate({...demo(),...patch}));
 assert.throws(()=>schema.validate({...demo(),events:[{...demo().events[0],time:'12:90'}]}));
});
test('strict required personal information is enforced; draft allows partial content',()=>{
 for(const key of ['groomName','brideName','weddingDate','weddingTime','venueName','venueAddress'])assert.throws(()=>schema.validate({...demo(),[key]:''}));
 assert.doesNotThrow(()=>schema.validate({groomName:'Working draft'},{mode:'draft'}));
 assert.ok(!('evil' in schema.validate({...demo(),evil:'ignored'})));
});
test('hostile text is escaped, including names, captions, family messages and event labels',()=>{
 const evil='<script>alert(1)</script><img src=x onerror=alert(2)>';const d=demo();
 for(const k of ['groomName','brideName','groomFamily','invitationMessage','blessingMessage'])d[k]=evil;
 d.gallery[0].caption=evil;d.events[0].name=evil;const s=page(d);
 not(s,'<script>alert');not(s,'<img src=x');has(s,'&lt;script&gt;');
 for(const x of [null,1,[],{weddingDate:[],events:[null],qrDestination:'javascript:x',gallery:[1]}])assert.doesNotThrow(()=>page(x));
});
test('optional music is silent by default and uploaded audio has an accessible control',()=>{
 not(page(),'<audio');not(page(),'<iframe');
 const s=page({...demo(),musicUpload:'/bfday/uploads/'+'b'.repeat(48)+'.mp3'});has(s,'preload="none" loop');has(s,'aria-label="Play background music"');not(s,'autoplay');
});
test('local font licenses, no-JS content, reduced-motion and keyboard controls ship',()=>{
 const s=page();has(s,'<noscript>');has(s,'<details>');has(s,'rel="noopener noreferrer"');
 const css=fs.readFileSync(path.resolve(__dirname,'../public/vaidehi/invite.css'),'utf8');has(css,'prefers-reduced-motion');has(css,'position:sticky');
 const js=fs.readFileSync(path.resolve(__dirname,'../public/vaidehi/invite.js'),'utf8');has(js,'ArrowLeft');has(js,'touchend');has(js,'showModal');has(js,'setInterval(tick, 1000)');
 for(const file of ['cormorantgaramond-OFL.txt','greatvibes-OFL.txt'])assert.ok(fs.existsSync(path.resolve(__dirname,'../public/vaidehi/fonts',file)));
});
test('packed assets restore byte-for-byte, verify checksums and have unique sample paths',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vaidehi-assets-'));
 try {const prepare=require('../scripts/prepare-vaidehi').prepare;assert.equal(prepare({outputDir:dir,demoDir:path.join(dir,'demo')}),24);assert.equal(prepare({outputDir:dir,demoDir:path.join(dir,'demo'),verifyOnly:true}),24);
 const manifest=require('../assets/vaidehi/manifest.json');for(const a of manifest){const b=fs.readFileSync(path.join(dir,a.file));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);}
 fs.writeFileSync(path.join(dir,'hands.webp'),'broken');assert.throws(()=>prepare({outputDir:dir,demoDir:path.join(dir,'demo'),verifyOnly:true}));
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('all default event dates shift with wedding date and explicit overrides remain fixed',()=>{
 const d={...demo(),weddingDate:'2030-06-10'};const v=view(d);
 assert.deepEqual(v.events.map(e=>e.date),['2030-06-09','2030-06-09','2030-06-10','2030-06-10']);
 const fresh=view({weddingDate:'2030-06-10',weddingTime:'18:00'});
 assert.deepEqual(fresh.events.map(e=>e.date),v.events.map(e=>e.date));
 assert.ok(!page(d).includes('2027'));
 d.events[0].date='2030-06-08';assert.equal(view(d).events[0].date,'2030-06-08');
});
test('Unicode emoji truncation and lone surrogates cannot break any preview or draft',()=>{
 for(const venueName of ['\ud800','A'+'😀'.repeat(74)]){
  assert.doesNotThrow(()=>page({...demo(),venueName}));
  assert.doesNotThrow(()=>schema.validate({...demo(),venueName},{mode:'draft'}));
 }
 assert.doesNotThrow(()=>page({...demo(),venueName:'A'+'😀'.repeat(75)}));
 assert.throws(()=>schema.validate({...demo(),venueName:'A'+'😀'.repeat(75)},{mode:'draft'}),e=>e.code==='validation');
 const d=demo();d.events[0].venueAddress='\udfff';assert.doesNotThrow(()=>page(d));
 assert.equal(schema.validate({...demo(),venueName:'\ud800'},{mode:'draft'}).venueName,'�');
});

test('published share metadata uses the customer portrait, then gallery, then designed card',()=>{
 const d={...demo(),couplePhoto:upload};has(page(d),'<meta property="og:image" content="https://paigaam.cc'+upload+'">');
 d.couplePhoto='';has(page(d),'<meta property="og:image" content="https://paigaam.cc'+d.gallery[0].photo+'">');
 d.gallery=[];has(page(d),'<meta property="og:image" content="https://paigaam.cc/vaidehi/thumbnail.webp">');
});

test('uploaded cover uses separate attire, garlands, leaves, rose and paper assets with live editable text',()=>{
 const s=page();const cover=s.match(/<section id="vv-cover"[\s\S]*?<\/section>/)[0];
 for(const asset of ['cover-attire.webp','cover-garland-left.webp','cover-garland-right.webp','cover-leaves-left.webp','cover-leaves-right.webp','cover-rose-1.webp'])has(cover,asset);
 not(cover,'couple-art.webp');not(cover,'src="/vaidehi/leaves.webp"');
 has(cover,'Save the Date');has(cover,'Rohan Malhotra');has(cover,'Kiara Shah');has(cover,'<strong>18</strong>');
 const css=fs.readFileSync(path.resolve(__dirname,'../public/vaidehi/invite.css'),'utf8');has(css,"url('cover-paper.webp')");
 const changed=page({...demo(),groomName:'Dev Rao',brideName:'Mira Sen',weddingDate:'2028-05-06'}).match(/<section id="vv-cover"[\s\S]*?<\/section>/)[0];
 has(changed,'Dev Rao');has(changed,'Mira Sen');has(changed,'<strong>6</strong>');not(changed,'Rohan Malhotra');
});
test('gentle real CSS petals are bounded, decorative, text-safe and reduced-motion aware',()=>{
 const s=page();has(s,'class="vv-petal-layer" aria-hidden="true" inert');assert.equal((s.match(/class="vv-petal-fall"/g)||[]).length,10);
 const css=fs.readFileSync(path.resolve(__dirname,'../public/vaidehi/invite.css'),'utf8');
 for(const x of ['@keyframes vv-petal-descend','@keyframes vv-petal-flutter',"url('marigold-petal.webp')",'transparent 8% 92%','.vv-petal-layer{display:none}','animation-play-state:paused'])has(css,x);
 const layer=css.match(/\.vv-petal-layer\{[^}]+\}/)[0];has(layer,'pointer-events:none');has(layer,'position:fixed');
 const js=fs.readFileSync(path.resolve(__dirname,'../public/vaidehi/invite.js'),'utf8');has(js,"document.addEventListener('visibilitychange', pausePetals)");
});
test('every later invitation panel remains byte-identical to before the cover-only revision',()=>{
 const expected=require('./fixtures/vaidehi-preserved-sections.json');const s=render({customer_data:demo()});
 for(const [name,hash] of Object.entries(expected)){
  const html=s.match(new RegExp('<section id="vv-'+name+'"[\\s\\S]*?<\\/section>'))[0];
  assert.equal(crypto.createHash('sha256').update(html).digest('hex'),hash,name+' changed outside cover scope');
 }
});


test('release seeds the requested INR99 price and a wide catalogue thumbnail',()=>{
 assert.equal(config.price,99);assert.equal(config.currency,'INR');
 assert.equal(config.thumbnail_url,'/vaidehi/catalog-thumbnail.webp');
 const item=require('../assets/vaidehi/manifest.json').find(x=>x.file==='catalog-thumbnail.webp');assert.ok(item);
 const bytes=Buffer.from(fs.readFileSync(path.resolve(__dirname,'../assets/vaidehi',item.packed),'utf8').trim(),'base64');
 const meta=require('../lib/bfday/image').sniffImage(bytes);assert.equal(meta.width,1000);assert.equal(meta.height,688);
});
