'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const config=require('../templates/patra-vivah/config'),schema=require('../templates/patra-vivah/schema');
const {render}=require('../templates/patra-vivah/render');
const upload='/bfday/uploads/'+'b'.repeat(48)+'.jpg';
const html=data=>render({customer_data:{...structuredClone(config.demo),...data}},{isPreview:true});
const family=data=>html(data).split('<section class="pv-page pv-family')[1].split('<div class="pv-petals"')[0];
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
test('Patra revision preserves approved Save the Date and Itinerary HTML exactly',()=>{
 const h=html({});let a=h.indexOf('<section class="pv-page pv-save'),b=h.indexOf('<section class="pv-page pv-itinerary');
 assert.equal(sha(h.slice(a,b)),'f9475542f0865780ef8211a9255750648e0d13879032d1ae658d4b2fef63da7f');
 a=b;b=h.indexOf('</section><',h.indexOf('pv-itinerary-leaves',a))+10;
 assert.equal(sha(h.slice(a,b)),'2b299a3a7252ac163e9e31fed04a337fe7acdc6e2a6e47e2bab17c7beceb7ce4');
});
test('Patra revision retains every approved content-card CSS rule as an unchanged prefix',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../public/patra-vivah/patra.css'));
 assert.equal(sha(css.subarray(0,11045)),'2a0b0904f4ee7718ffcd3fe47a3e1a5d936f0673d1522756eb8206b5be145d09');
});
test('Patra cover uses contained, muted inline source video, matching poster, no autoplay and four navigation dots',()=>{
 const h=html({});assert.ok(h.includes('id="pvOpeningVideo"'));assert.ok(h.includes('muted playsinline webkit-playsinline'));
 assert.ok(h.includes('src="/patra-vivah/opening-clean.mp4" type="video/mp4"'));assert.ok(!h.includes('<video autoplay'));
 assert.equal((h.match(/data-pv-go="/g)||[]).length,4);assert.ok(h.includes('data-pv-current>1</span> / 4'));
 assert.ok(h.includes('src="/patra-vivah/opening-clean-poster.webp"'));assert.ok(!h.includes('pv-flap-left'));
});
test('Patra family photo crop is owned, bounded, independently adjustable and fully removable',()=>{
 const data={...config.demo,familyPhoto:upload,familyPhotoZoom:220,familyPhotoX:17,familyPhotoY:83};
 assert.doesNotThrow(()=>schema.validate(data));let h=family(data);assert.ok(h.includes('pv-family-has-photo'));
 assert.ok(h.includes('--family-zoom:2.2;--family-x:17%;--family-y:83%'));assert.ok(h.includes('alt="Family photograph"'));
 assert.ok(!family({familyPhoto:''}).includes('pv-family-photo'));
 for(const [key,value]of[['familyPhotoZoom',99],['familyPhotoZoom',251],['familyPhotoX',-1],['familyPhotoY',101]])assert.throws(()=>schema.validate({...data,[key]:value}));
 assert.throws(()=>schema.validate({...data,familyPhoto:'https://example.com/photo.jpg'}));
});
test('Patra maps: absent is hidden, valid address/button links are safe, malformed link gives soft text without unsafe href',()=>{
 let h=family({familyMapsLink:'',familyVenue:'Venue',familyAddress:'Address'});assert.ok(!h.includes('pv-maps-button'));assert.ok(!h.includes('pv-map-note'));assert.ok(!h.includes('pv-family-location'));
 h=family({familyMapsLink:'https://www.google.com/maps/search/?api=1&query=Jaipur',familyVenue:'Venue',familyAddress:'Address',familyMapsLabel:'Find our venue'});
 assert.equal((h.match(/href="https:\/\/www.google.com\/maps/g)||[]).length,2);assert.ok(h.includes('Find our venue'));assert.ok(h.includes('target="_blank" rel="noopener noreferrer"'));
 for(const familyMapsLink of['javascript:alert(1)','https://google.com.evil/maps','not a maps link']){
  assert.doesNotThrow(()=>schema.validate({...config.demo,familyMapsLink}));h=family({familyMapsLink});assert.ok(h.includes('pv-map-note'));assert.ok(!h.includes('pv-maps-button'));assert.ok(!h.includes('href="'+familyMapsLink));
 }
});
test('Patra family copy is escaped, line breaks retained, all headings and button label customizable',()=>{
 const h=family({regardsHeading:'Regards <script>',familyName:'A & B',familyWelcome:'A warm welcome',familyVenue:'The Hall',familyAddress:'Line one\nLine two',familyMapsLink:'https://maps.google.com/',familyMapsLabel:'Directions'});
 assert.ok(h.includes('Regards &lt;script&gt;'));assert.ok(h.includes('A &amp; B'));assert.ok(h.includes('Line one<br>Line two'));assert.ok(h.includes('>Directions</a>'));
});
test('Patra opening media is fast-start H.264 MP4 with real HTTP byte-range and HEAD support',async t=>{
 const http=require('node:http'),{streamFile}=require('../lib/streamFile');
 const file=path.join(__dirname,'../public/patra-vivah/opening-clean.mp4');const bytes=fs.readFileSync(file);
 assert.ok(bytes.subarray(0,64).includes(Buffer.from('ftyp')));assert.ok(bytes.indexOf(Buffer.from('moov'))<bytes.indexOf(Buffer.from('mdat')));
 const server=http.createServer((req,res)=>streamFile(req,res,file,'video/mp4'));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const url='http://127.0.0.1:'+server.address().port;let r=await fetch(url,{headers:{range:'bytes=0-63'}});
 assert.equal(r.status,206);assert.equal(r.headers.get('content-type'),'video/mp4');assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes.subarray(0,64));
 r=await fetch(url,{method:'HEAD'});assert.equal(r.status,200);assert.equal(+r.headers.get('content-length'),bytes.length);
});
