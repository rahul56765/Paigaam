'use strict';
// Run: GANAPATI_BASE_URL=http://127.0.0.1:3211 node --test tests/ganapati-api.test.js
// Every mutation targets a new test-owned invitation. No admin or baseline mutations.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const BASE=(process.env.GANAPATI_BASE_URL||'http://127.0.0.1:3210').replace(/\/$/,'');
const baseData=(patch={})=>({language:'en',familyName:'Probe '+Date.now(),fatherName:'Father',motherName:'Mother',familyMembers:'Family',customMessage:'Welcome, all; with love.',eventDate:'2026-09-14',eventTime:'11:00',timezone:'Asia/Kolkata',venueName:'Home; Hall',address:'Pune, Maharashtra\nLane \\ Two',photos:[],...patch});
async function request(path,{cookie,method='GET',body,headers={}}={}){
 const r=await fetch(BASE+path,{method,headers:{...(cookie?{cookie}:{}),...(body&&!Buffer.isBuffer(body)?{'content-type':'application/json'}:{}),...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body),redirect:'manual'});
 const bytes=Buffer.from(await r.arrayBuffer());let json;try{json=JSON.parse(bytes.toString());}catch{}
 return {status:r.status,headers:r.headers,bytes,text:bytes.toString(),json};
}
async function draft(data=baseData(),cookie){const r=await request('/api/ganapati/draft',{method:'POST',body:{customer_data:data},cookie});assert.equal(r.status,200,r.text);return {...r.json,cookie:cookie||r.headers.get('set-cookie').split(';')[0],data};}
async function jpeg(){return sharp({create:{width:96,height:64,channels:3,background:'#e9a652'}}).jpeg().toBuffer();}
async function upload(d,bytes,contentType='image/jpeg'){const r=await request('/api/ganapati/upload?id='+d.id,{method:'POST',body:bytes||await jpeg(),cookie:d.cookie,headers:{'content-type':contentType}});return r;}
async function save(d,patch){const data={...d.data,...patch};return request('/api/ganapati/draft',{method:'POST',cookie:d.cookie,body:{id:d.id,customer_data:data}});}
async function publish(d){const r=await request('/api/ganapati/publish',{method:'POST',cookie:d.cookie,body:{id:d.id}});assert.equal(r.status,200,r.text);return r.json;}

test('API: independent identities, protected preview/edit/upload/publish, CSRF and generic bypasses',async t=>{
 const a=await draft(),b=await draft();assert.notEqual(a.cookie,b.cookie);assert.notEqual(a.id,b.id);
 const own=await request(a.previewUrl,{cookie:a.cookie});assert.equal(own.status,200);assert.match(own.text,/data-preview="true"/);
 for(const cookie of [undefined,b.cookie]){
  for(const path of [a.previewUrl,'/preview/'+a.id]){assert.equal((await request(path,{cookie})).status,403,path);}
  for(const [path,body]of [['/api/ganapati/draft',{id:a.id,customer_data:baseData()}],['/api/ganapati/publish',{id:a.id}]])assert.equal((await request(path,{method:'POST',cookie,body})).status,403,path);
  assert.equal((await request('/api/ganapati/upload?id='+a.id,{method:'POST',cookie,body:await jpeg(),headers:{'content-type':'image/jpeg'}})).status,403);
 }
 for(const headers of [{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}])assert.equal((await request('/api/ganapati/draft',{method:'POST',cookie:a.cookie,headers,body:{id:a.id,customer_data:a.data}})).status,403);
 for(const body of [{template:'ganapati-aagman',customer_data:a.data},{template:'noor',id:a.id,customer_data:{brideName:'OVERWRITE'}}])assert.equal((await request('/api/drafts',{method:'POST',body})).status,403);
 assert.equal((await request('/api/free-publish',{method:'POST',body:{id:a.id}})).status,403);
 assert.equal((await request('/api/render-preview',{method:'POST',body:{template:'ganapati-aagman',customer_data:a.data}})).status,403);
 const unchanged=await request(a.previewUrl,{cookie:a.cookie});assert.match(unchanged.text,new RegExp(a.data.familyName));assert.doesNotMatch(unchanged.text,/OVERWRITE/);
 assert.equal((await request('/api/ganapati/calendar/'+a.id)).status,404);
});

test('API: rejects invalid date/time/language, field lengths/types, photo counts and refs',async t=>{
 const invalid=[['missing data',undefined],['bad language',baseData({language:'ta'})],['empty language',baseData({language:''})],['invalid leap day',baseData({eventDate:'2026-02-29'})],['invalid day',baseData({eventDate:'2026-09-31'})],['date format',baseData({eventDate:'14-09-2026'})],['year low',baseData({eventDate:'2025-09-14'})],['year high',baseData({eventDate:'2101-09-14'})],['time',baseData({eventTime:'24:00'})],['time minutes',baseData({eventTime:'11:60'})],['timezone',baseData({timezone:'UTC'})],['blank required',baseData({familyName:' '})],['wrong field type',baseData({fatherName:123})],['control characters',baseData({venueName:'bad\u0001'})],['photo over-count',baseData({photos:Array.from({length:11},()=>({url:'/ganapati/uploads/'+'a'.repeat(48)+'.webp',alt:''}))})],['photo object',baseData({photos:{}})],['remote photo',baseData({photos:[{url:'https://evil.example/a.jpg',alt:''}]})],['photo alt length',baseData({photos:[{url:'/ganapati/uploads/'+'a'.repeat(48)+'.webp',alt:'a'.repeat(201)}]})]];
 for(const [key,max]of Object.entries({familyName:120,fatherName:120,motherName:120,familyMembers:600,customMessage:2000,venueName:160,address:500}))invalid.push([key+' too long',baseData({[key]:'x'.repeat(max+1)})]);
 for(const [name,customer_data]of invalid)await t.test(name,async()=>{const r=await request('/api/ganapati/draft',{method:'POST',body:{customer_data}});assert.equal(r.status,400,r.text);});
 const d=await draft();
 const fake={url:'/ganapati/uploads/'+'a'.repeat(48)+'.webp',alt:''};
 assert.equal((await save(d,{photos:[fake]})).status,403);
 assert.equal((await save(d,{photos:[fake,fake]})).status,400);
});

test('API: validates uploaded bytes, MIME and size; reencodes JPEG; photo ownership and publication visibility',async()=>{
 const a=await draft(),b=await draft();const bytes=await jpeg();
 for(const [contentType,body,status] of [['image/svg+xml',Buffer.from('<svg/>'),400],['image/jpeg',Buffer.from('<script>alert(1)</script>'),400],['image/png',bytes,400],['image/jpeg',Buffer.alloc(2*1024*1024+1),413]]){const r=await upload(a,body,contentType);assert.equal(r.status,status,r.text);}
 const good=await upload(a,bytes);assert.equal(good.status,200,good.text);assert.match(good.json.url,/\/ganapati\/uploads\/[a-f0-9]{48}\.webp$/);
 const hidden=await upload(a,bytes);assert.equal(hidden.status,200);
 const url=good.json.url;assert.equal((await request(url)).status,404);assert.equal((await request(url,{cookie:b.cookie})).status,404);
 const image=await request(url,{cookie:a.cookie});assert.equal(image.status,200);assert.equal((await sharp(image.bytes).metadata()).format,'webp');
 assert.equal((await save(b,{photos:[{url,alt:'stolen'}]})).status,403);
 assert.equal((await save(a,{photos:[{url,alt:'Family & flowers'}]})).status,200);
 const pub=await publish(a);assert.equal((await request(url)).status,200);assert.equal((await request(hidden.json.url)).status,404,'Unreferenced upload stays private after publication');
 const page=await request('/p/'+pub.slug);assert.equal(page.status,200);assert.match(page.text,/Family &amp; flowers/);assert.ok(page.text.includes(url));assert.match(page.text,/data-preview="false"/);
 assert.deepEqual(await publish(a),pub,'Duplicate publish returns same URL');
 assert.equal((await save(a,{familyName:'edit published'})).status,403);assert.equal((await upload(a)).status,403);
});

test('API: escaped content, three languages, correct calendar timezone, location escaping and UTF-8 folding',async t=>{
 for(const language of ['en','hi','mr'])await t.test(language,async()=>{
  const attack='<img src=x onerror=alert(987)> & "family"';
  const d=await draft(baseData({language,familyName:attack,customMessage:'श्री गणेशाय नमः '.repeat(30)+'\ncomma, semicolon; backslash\\',venueName:'सभागृह; आनंद',address:'पुणे, महाराष्ट्र\nमार्ग \\ दोन'}));
  const p=await publish(d);const page=await request('/p/'+p.slug);assert.equal(page.status,200);assert.match(page.text,new RegExp('<html lang="'+language+'"'));assert.ok(!page.text.includes('<img src=x onerror'));assert.match(page.text,/&lt;img src=x onerror=alert\(987\)&gt;/);
  const cal=await request('/api/ganapati/calendar/'+d.id);assert.equal(cal.status,200);assert.match(cal.headers.get('content-type'),/text\/calendar/);const unfolded=cal.text.replace(/\r\n /g,'');assert.match(unfolded,/DTSTART:20260914T053000Z/);assert.match(unfolded,/DTEND:20260914T073000Z/);assert.ok(unfolded.includes('LOCATION:सभागृह\\; आनंद\\, पुणे\\, महाराष्ट्र\\nमार्ग \\\\ दोन'));assert.ok(unfolded.includes('DESCRIPTION:'+d.data.customMessage.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')));
  assert.ok(cal.text.includes('\r\n '),'UTF-8 long content folds');for(const line of cal.text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,Buffer.byteLength(line)+' octets');assert.ok(!cal.text.includes('\uFFFD'));
 });
});

test('API: MP4/MP3/JPEG HEAD, range, suffix range, 416 and conditional GET',async t=>{
 for(const file of ['formation.mp4','journey.mp4','music.mp3','formation-end.jpg'])await t.test(file,async()=>{
  const path='/ganapati/media/'+file;const head=await request(path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.bytes.length,0);const total=Number(head.headers.get('content-length'));assert.ok(total>100);assert.equal(head.headers.get('accept-ranges'),'bytes');
  const range=await request(path,{headers:{range:'bytes=0-99'}});assert.equal(range.status,206);assert.equal(range.bytes.length,100);assert.equal(range.headers.get('content-range'),`bytes 0-99/${total}`);
  const rh=await request(path,{method:'HEAD',headers:{range:'bytes=0-99'}});assert.equal(rh.status,206);assert.equal(rh.bytes.length,0);assert.equal(rh.headers.get('content-length'),'100');
  const suffix=await request(path,{headers:{range:'bytes=-10'}});assert.equal(suffix.status,206);assert.equal(suffix.bytes.length,10);
  for(const range of [`bytes=${total}-`,'bytes=90-1','bytes=-0','bytes=0-1,3-4']){const bad=await request(path,{headers:{range}});assert.equal(bad.status,416,range);assert.equal(bad.headers.get('content-range'),`bytes */${total}`);}
  assert.equal((await request(path,{headers:{'if-none-match':head.headers.get('etag')}})).status,304);
 });
});

test('API: existing noor/meher/aashi/apology customer routes and render endpoints remain usable',async t=>{
 for(const template of ['noor','meher','aashi','apology'])await t.test(template,async()=>{
  const detail=await request('/templates/'+template);assert.equal(detail.status,200,template+' detail');
  const create=await request('/create/'+template);assert.ok([200,303].includes(create.status),template+' create '+create.status);
  const customer_data={brideName:'Probe bride',groomName:'Probe groom',personName:'Probe person',partnerOne:'Probe one',partnerTwo:'Probe two',recipientName:'Probe friend',senderName:'Probe sender',eventDate:'2026-09-14',venue:'Probe home',message:'Probe message'};
  const r=await request('/api/drafts',{method:'POST',body:{template,customer_data}});assert.equal(r.status,200,r.text);
  assert.equal((await request('/preview/'+r.json.id)).status,200);
  assert.equal((await request('/api/render-preview',{method:'POST',body:{template,customer_data}})).status,200);
 });
});
