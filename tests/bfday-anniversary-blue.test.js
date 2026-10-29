'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const config=require('../templates/anniversary-blue/config'),schema=require('../templates/anniversary-blue/schema'),{render}=require('../templates/anniversary-blue/render'),art=require('../templates/anniversary-blue/art');
const family=require('../lib/bfday/family'),{resolve,maxImages}=require('../lib/bfday/fields'),{escape}=require('../lib/bfday/page');
const {bfdayCreatePage}=require('../pages/bfdayCreate');
const {request,draft,png,HOSTILE}=require('./bfday-helpers');
const asset=name=>fs.readFileSync(path.join(__dirname,'../public/anniversary-blue',name),'utf8');
const photo='/bfday/uploads/'+'a'.repeat(48)+'.jpg',song='/bfday/uploads/'+'b'.repeat(48)+'.wav';
const spotify='https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl';
test('anniversary-blue is an additive family member with ten distinct accessible scenes',()=>{
 assert.deepEqual(family.errors,[]);for(const slug of ['anniversary-blue','love-letter','birthday-atelier'])assert.ok(family.has(slug));
 const h=render();assert.deepEqual([...h.matchAll(/data-scene="([^"]+)"/g)].map(x=>x[1]),config.sections);assert.equal(config.sections.length,10);assert.equal((h.match(/hidden inert/g)||[]).length,9);
 for(const id of config.sections)assert.match(h,new RegExp('id="title-'+id+'"'));assert.equal((h.match(/data-page=/g)||[]).length,10);
 assert.equal(config.backgroundMusic,false);assert.ok(!schema.FIELDS.some(f=>f.id==='bgmSong'));
});
test('paid review keeps coupon entry on the send step and makes the regular/sale price relationship prominent',()=>{
 const html=bfdayCreatePage(family.bySlug('anniversary-blue'),{price:99,listPrice:199});
 const sendStep=html.slice(html.indexOf('data-step="6"'),html.indexOf('data-step="6"')+5000);
 assert.match(sendStep,/id="pc-inline-checkout"/);assert.match(sendStep,/id="pc-inline-input"/);assert.match(sendStep,/&#8377;99/);assert.match(sendStep,/&#8377;199/);assert.match(sendStep,/Save &#8377;100 · 50% off/);assert.match(sendStep,/id="publish"[^>]*disabled/);assert.doesNotMatch(html,/id="pc-inline-checkout".*data-step="0"/s);
 const free=bfdayCreatePage(family.bySlug('anniversary-blue'),{price:0,listPrice:0});assert.doesNotMatch(free,/id="pc-inline-checkout"/);
});
test('defaults, malformed preview data and whitelist resolve without sharing mutable defaults',()=>{
 const d=resolve(config,{},schema);assert.equal(d.startMusic,'disc');assert.equal(d.recipientName,'My Love');assert.deepEqual([d.tallPhotos.length,d.polaroids.length,d.foreverPhotos.length,d.reasons.length],[3,5,3,10]);
 d.tallPhotos[0].caption='changed';assert.notEqual(resolve(config,{},schema).tallPhotos[0].caption,'changed');
 assert.doesNotThrow(()=>render({customer_data:{letterText:[],tallPhotos:'oops',reasons:[null,5],songUrl:'javascript:alert(1)'}}));
 const clean=schema.validate({extra:'no',__proto__:null},{mode:'strict'});assert.ok(!Object.hasOwn(clean,'extra'));assert.equal(clean.templateVersion,1);
});
test('all copy has exactly one wizard placement, including editable captions and bounded lists',()=>{
 const ids=config.steps.flatMap(s=>s.fields);assert.equal(config.steps.length,6);assert.deepEqual([...ids].sort(),config.fields.map(f=>f.id).sort());assert.equal(new Set(ids).size,ids.length);
 assert.equal(maxImages(schema.FIELDS),35);
 for(const id of ['tallPhotos','polaroids','foreverPhotos']){const f=schema.FIELDS.find(f=>f.id===id);assert.equal(f.minItems,1);assert.deepEqual(f.shape.map(s=>[s.id,s.type]),[['photo','image'],['caption','text']]);}
 assert.ok(config.fields.find(f=>f.id==='reasonPhotoCaption'));assert.ok(config.fields.find(f=>f.id==='songTitle'));
});
test('all editable text and nested captions/reasons are HTML escaped',()=>{
 const raw={};for(const f of schema.FIELDS){if(['text','textarea'].includes(f.type)&&!['songUrl','spotifyUrl'].includes(f.id))raw[f.id]=HOSTILE.slice(0,f.maxLength);if(f.type==='list')raw[f.id]=[{...(f.id==='reasons'?{reason:HOSTILE}:{photo,caption:HOSTILE})}];}
 const h=render({customer_data:raw});assert.ok(!h.includes('<script>alert(1)</script>'));assert.ok(!h.includes('<img src=x'));for(const f of schema.FIELDS.filter(f=>['text','textarea'].includes(f.type)&&!['songUrl','spotifyUrl'].includes(f.id)))assert.ok(h.includes(escape(raw[f.id])),f.id);
 assert.ok(h.includes('data-photo="tallPhotos:0:photo"'));assert.ok(h.includes('alt="'+escape(HOSTILE)+'"'));assert.ok(h.includes('<figcaption>'+escape(HOSTILE)+'</figcaption>'));
});
test('maximum letter, reason lists, photo lists and captions retain all supported content',()=>{
 const raw={letterText:'L'.repeat(12000)};for(const f of schema.FIELDS.filter(f=>f.type==='list'))raw[f.id]=Array.from({length:f.maxItems},(_,i)=>f.id==='reasons'?{reason:String(i)+':'+ 'R'.repeat(490)}:{photo,caption:String(i)+':'+ 'C'.repeat(110)});
 const h=render({customer_data:schema.validate(raw)});assert.ok(h.includes('L'.repeat(12000)));assert.equal((h.match(/<li>/g)||[]).length,40);assert.equal((h.match(/data-photo=/g)||[]).length,35);
 for(const f of schema.FIELDS.filter(f=>f.type==='list')){assert.throws(()=>schema.validate({[f.id]:[...raw[f.id],raw[f.id][0]]}));assert.equal(schema.validate({[f.id]:[...raw[f.id],raw[f.id][0]]},{mode:'lenient'})[f.id].length,f.maxItems);}
 assert.throws(()=>schema.validate({letterText:'L'.repeat(12001)}));assert.equal(schema.validate({letterText:'L'.repeat(12001)},{mode:'lenient'}).letterText.length,12000);assert.ok(render({customer_data:{letterText:'one\n\ntwo'}}).includes('one<br><br>two'));
});
test('viewer photo buttons disabled; editor exposes every default nested slot',()=>{
 const viewer=render(),editor=render({}, {isEditor:true,isPreview:true});assert.match(viewer,/data-editor="false"/);assert.match(editor,/data-editor="true"/);
 assert.equal((viewer.match(/data-photo="[^"]+" disabled/g)||[]).length,13);assert.equal((editor.match(/data-photo="[^"]+" disabled/g)||[]).length,0);
 for(const [id,n] of [['tallPhotos',3],['polaroids',5],['foreverPhotos',3]])for(let i=0;i<n;i++)assert.ok(editor.includes('data-photo="'+id+':'+i+':photo"'));
});
test('photos are restricted for standalone and nested references',()=>{
 for(const value of ['https://evil.example/a.jpg','javascript:alert(1)','data:image/png;base64,AAAA','/bfday/uploads/../x.jpg',song,photo+'?x=1'])for(const data of [{songPhoto:value},{tallPhotos:[{photo:value,caption:'hi'}]}]){assert.throws(()=>schema.validate(data));assert.doesNotThrow(()=>schema.validate(data,{mode:'lenient'}));}
 assert.equal(schema.validate({songPhoto:photo}).songPhoto,photo);assert.equal(schema.validate({tallPhotos:[{photo,caption:'hi'}]}).tallPhotos[0].photo,photo);
});
test('audio links reject unsafe schemes/credentials and local nonaudio paths',()=>{
 for(const songUrl of ['javascript:alert(1)','data:audio/wav,x','http://example.com/song.mp3','https://u:p@example.com/a.mp3',photo,'/etc/passwd','//example.com/a.mp3']){assert.throws(()=>schema.validate({songUrl}),{code:'anniversary_audio_url'});assert.equal(schema.validate({songUrl},{mode:'lenient'}).songUrl,'');}
 for(const songUrl of [song,'https://example.com/song.mp3?token=abc'])assert.equal(schema.validate({songUrl}).songUrl,songUrl);
});
test('Spotify accepts only normalized HTTPS tracks/albums/playlists, never arbitrary iframe hosts',()=>{
 for(const kind of ['track','album','playlist'])for(const prefix of ['','intl-de/','embed/']){const u='https://open.spotify.com/'+prefix+kind+'/11dFghVXANMlKmJXsNCbNl?si=abc';const parsed=schema.spotify(u);assert.equal(parsed.url,spotify.replace('/track/','/'+kind+'/'));assert.equal(parsed.embed,parsed.url.replace('.com/','.com/embed/'));assert.doesNotThrow(()=>schema.validate({spotifyUrl:u}));}
 for(const spotifyUrl of ['http://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl','https://open.spotify.com.evil.test/track/11dFghVXANMlKmJXsNCbNl','https://user@open.spotify.com/track/11dFghVXANMlKmJXsNCbNl','https://open.spotify.com/artist/11dFghVXANMlKmJXsNCbNl','https://open.spotify.com/track/no','javascript:alert(1)']){assert.equal(schema.spotify(spotifyUrl),null);assert.throws(()=>schema.validate({spotifyUrl}),{code:'anniversary_spotify_url'});assert.equal(schema.validate({spotifyUrl},{mode:'lenient'}).spotifyUrl,'');}
});
test('art is inline SVG with no remote resources or executable markup',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../templates/anniversary-blue/art.js'),'utf8');assert.doesNotMatch(source,/<script|<foreignObject|\bonload=|https?:\/\/(?!www\.w3\.org)/i);assert.match(art.couple,/<svg/);assert.match(art.sticker('camera'),/<svg/);
});
test('dedicated assets compile; editor rejects untrusted frame messages and blocks uploads during sending',()=>{
 for(const file of ['experience.js','editor.js','crop.js'])assert.doesNotThrow(()=>new vm.Script(asset(file)),file);
 const editor=asset('editor.js'),viewer=asset('experience.js'),crop=asset('crop.js');assert.ok(editor.includes('event.source !== liveFrame.contentWindow'));assert.ok(editor.includes('event.origin !== location.origin'));assert.ok(viewer.includes('event.source!==parent||event.origin!==window.origin'));
 assert.ok(editor.includes('mediaBusy() || !validateAll()'));assert.ok(editor.includes('savingVersion === editVersion'));assert.ok(editor.includes('lockForSend(true)'));assert.ok(editor.includes('window.anniversaryCrop(source, identifier())'));assert.ok(crop.includes('URL.revokeObjectURL(url)'));assert.ok(crop.includes('canvas.toBlob')||crop.includes('out.toBlob'));
 assert.doesNotMatch(editor+crop,/\/love-letter\/|window\.loveCrop/);
});
test('CSS supports text flow, responsive photo crops, carousel and reduced motion without fixed scene heights',()=>{
 const css=asset('experience.css');for(const token of ['overflow-wrap:anywhere','object-fit:cover','prefers-reduced-motion:reduce','scroll-snap-type:x mandatory','@media(max-width:350px)','@media(max-width:600px)','minmax(0,1fr)'])assert.ok(css.includes(token),token);
 assert.doesNotMatch(css,/\.scene\s*\{[^}]*[^-]height:\s*\d+px/);assert.ok(css.includes('.tall-frame .photo-slot{aspect-ratio:.55'));assert.ok(css.includes('.forever-photos .photo-slot{aspect-ratio:.85'));
});

// Real local API coverage is opt-in, as in the other bfday suites. Refuse nonlocal
// hosts even when accidentally configured: these tests create/publish disposable data.
const api={skip:!process.env.BFDAY_BASE_URL};
function localOnly(){assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(process.env.BFDAY_BASE_URL).hostname),'API suite requires a disposable local server');}
function wav(){const b=Buffer.alloc(1644);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(1600,40);return b;}
const save=(d,data)=>request('/api/anniversary-blue/draft',{method:'POST',cookie:d.cookie,body:{id:d.id,customer_data:data}});
test('local API: create/demo/frame isolated assets, preview sanitization, owner access and CSRF',api,async()=>{
 localOnly();const oldUrl=await request('/create/anniversary');assert.equal(oldUrl.status,302);assert.equal(oldUrl.headers.get('location'),'/create/anniversary-blue');const create=await request('/create/anniversary-blue');assert.equal(create.status,200);for(const script of ['crop','editor'])assert.ok(create.text.includes('/anniversary-blue/'+script+'.js'));assert.ok(create.text.includes('creator-coupon.css?v=4'));assert.ok(create.text.includes('creator-coupon.js?v=6'));assert.doesNotMatch(create.text,/<script src="\/(?:love-letter|bfday)\/(?:editor|crop|create)\.js/);
 for(const file of ['editor.js','crop.js','experience.js','experience.css'])assert.equal((await request('/anniversary-blue/'+file)).status,200);
 const demo=await request('/anniversary-blue/demo');assert.equal(demo.status,200);assert.ok(demo.text.includes('data-editor="false"'));
 const frame=await request('/anniversary-blue/preview-frame',{method:'POST',body:{customer_data:{recipientName:HOSTILE,songUrl:'javascript:alert(1)',tallPhotos:[{photo:'https://evil.test/x',caption:HOSTILE}]}}});assert.equal(frame.status,200);assert.ok(frame.text.includes('data-editor="true"'));assert.ok(!frame.text.includes('javascript:alert(1)'));assert.ok(!frame.text.includes('<img src=x'));
 const d=await draft(config.slug,config.demo);assert.equal((await request(d.previewUrl)).status,403);assert.equal((await request(d.previewUrl,{cookie:d.cookie})).status,200);
 assert.equal((await request('/api/anniversary-blue/draft',{method:'POST',cookie:d.cookie,headers:{origin:'https://evil.test'},body:{id:d.id,customer_data:config.demo}})).status,403);
});
test('local API: audio ownership, sniffing, range seeking, nested photo verification and publish cleanup',api,async()=>{
 localOnly();const a=await draft(config.slug,config.demo),b=await draft(config.slug,config.demo),other=await draft('love-letter',{});
 const upload=(cookie=a.cookie,raw=wav(),id=a.id)=>request('/api/anniversary-blue/audio?id='+id,{method:'POST',cookie,raw,type:'application/octet-stream'});
 assert.equal((await upload(b.cookie)).status,403);assert.equal((await upload(undefined,Buffer.from('<script>x</script>'.repeat(10)))).status,400);assert.equal((await upload(other.cookie,wav(),other.id)).status,404);
 const first=await upload(),second=await upload();assert.equal(first.status,200);assert.equal(second.status,200);const url=second.json.url;assert.match(url,/^\/bfday\/uploads\/[a-f0-9]{48}\.wav$/);
 assert.equal((await request(url)).status,404);assert.equal((await request(url,{cookie:b.cookie})).status,404);assert.equal((await request(url,{cookie:a.cookie})).status,200);
 assert.equal((await save(b,{songUrl:url})).status,403);assert.equal((await save(a,{songUrl:'/bfday/uploads/'+'f'.repeat(48)+'.wav'})).status,403);
 const image=await request('/api/anniversary-blue/upload?id='+a.id,{method:'POST',cookie:a.cookie,raw:png(),type:'image/png'});assert.equal(image.status,200);assert.equal((await save(b,{tallPhotos:[{photo:image.json.url,caption:'borrowed'}]})).status,403);
 assert.equal((await save(a,{...config.demo,songUrl:url,tallPhotos:[{photo:image.json.url,caption:'ours'}]})).status,200);
 assert.equal((await request('/api/anniversary-blue/publish',{method:'POST',cookie:b.cookie,body:{id:a.id}})).status,403);
 const published=await request('/api/anniversary-blue/publish',{method:'POST',cookie:a.cookie,body:{id:a.id}});assert.equal(published.status,200);assert.match(published.json.slug,/^anniversary-blue-[a-f0-9]{18}$/);
 const range=await request(url,{headers:{range:'bytes=0-43'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-type'),'audio/wav');assert.match(range.headers.get('content-range'),/^bytes 0-43\/1644$/);assert.equal(range.headers.get('content-length'),'44');
 assert.equal((await request(first.json.url,{cookie:a.cookie})).status,404);assert.equal((await request(image.json.url)).status,200);assert.equal((await upload()).status,403);assert.equal((await save(a,{})).status,403);
 const live=await request('/p/'+published.json.slug);assert.equal(live.status,200);assert.ok(live.text.includes(url));assert.ok(live.text.includes(image.json.url));assert.ok(live.text.includes('data-editor="false"'));
});
test('local API: audio replacement cap prevents hoarding',api,async()=>{
 localOnly();const d=await draft(config.slug,{});for(let i=0;i<5;i++)assert.equal((await request('/api/anniversary-blue/audio?id='+d.id,{method:'POST',cookie:d.cookie,raw:wav(),type:'application/octet-stream'})).status,200);assert.equal((await request('/api/anniversary-blue/audio?id='+d.id,{method:'POST',cookie:d.cookie,raw:wav(),type:'application/octet-stream'})).status,429);
});

// Exercise the shipped viewer without browser packages or external provider calls.
function bootViewer(settings={}){
 class El extends EventTarget{
  constructor(){super();this.attrs={};this.dataset={};this.children=[];this.hidden=false;this.disabled=false;this.textContent='';this.offsetLeft=0;this.offsetWidth=184;this.clientWidth=360;this.scrollLeft=0;const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)};}
  setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}querySelector(s){if(s==='iframe')return this.children.find(x=>x.tag==='iframe')||null;return this.label||(this.label=new El());}querySelectorAll(){return this.children;}replaceChildren(...c){this.children=c;}append(c){this.children.push(c);}focus(){}scrollTo(v){this.scrollLeft=v.left||0;}click(){this.dispatchEvent(new Event('click'));}
 }
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id);};
 const scenes=config.sections.map((id,i)=>{const s=new El();s.dataset.scene=id;s.hidden=i!==0;s.inert=i!==0;return s;}),dots=config.sections.map(id=>{const e=new El();e.dataset.page=id;return e;});
 get('anniversary-data').textContent=render({customer_data:settings},{isEditor:true,isPreview:true}).match(/<script[^>]*id="anniversary-data"[^>]*>([\s\S]*?)<\/script>/)[1];
 get('envelope-hint').textContent=settings.envelopeHint||'tap to open';get('read-letter').hidden=true;get('carousel').children=Array.from({length:5},(_,i)=>{const e=new El();e.offsetLeft=i*202;return e;});
 const audios=[];class FakeAudio extends El{constructor(src){super();this.src=src;this.paused=true;this.currentTime=0;this.calls=0;audios.push(this);}play(){this.calls++;this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}load(){}}
 const body=new El();body.dataset.preview='true';const win=new El();win.origin='http://localhost';win.scrollTo=()=>{};const parent={postMessage(){}};const timers=new Map();let serial=0;
 const document={body,head:new El(),getElementById:get,createElement:tag=>{const e=new El();e.tag=tag;return e;},querySelectorAll:s=>s==='[data-scene]'?scenes:s==='[data-page]'?dots:[]};
 vm.runInNewContext(asset('experience.js'),{window:win,parent,document,Audio:FakeAudio,matchMedia:()=>({matches:true}),requestAnimationFrame:f=>{f();return 1;},setTimeout:f=>{timers.set(++serial,f);return serial;},clearTimeout:id=>timers.delete(id),console});
 return {get,win,dots,scenes,audios,parent,flush(){for(const [id,f] of timers){timers.delete(id);f();}}};
}
test('viewer runtime: scene switching keeps exactly one scene active, reveal, carousel and direct audio share one instance',()=>{
 const h=bootViewer({songUrl:song,startMusic:'opening'});assert.equal(h.audios.length,1);assert.equal(h.audios[0].calls,0);h.dots[1].click();assert.equal(h.audios[0].calls,1);assert.equal(h.get('music-toggle').attrs['aria-pressed'],'true');h.audios[0].currentTime=42;
 for(const dot of h.dots){dot.click();assert.equal(h.scenes.filter(s=>!s.hidden&&!s.inert).length,1);}assert.equal(h.audios.length,1);assert.equal(h.audios[0].currentTime,42);assert.equal(h.audios[0].calls,1);
 h.get('open-envelope').click();assert.equal(h.get('open-envelope').attrs['aria-expanded'],'true');h.flush();assert.equal(h.get('read-letter').hidden,false);
 h.get('next-photo').click();assert.equal(h.get('photo-count').textContent,'4 / 5');h.get('restart').click();assert.equal(h.audios[0].paused,true);assert.equal(h.audios[0].currentTime,0);assert.equal(h.get('read-letter').hidden,true);assert.equal(h.scenes[0].hidden,false);
});
test('viewer runtime: messages from foreign origins or sibling frames cannot navigate',()=>{
 const h=bootViewer();const dispatch=(origin,source)=>{const e=new Event('message');Object.assign(e,{origin,source,data:{type:'anniversary-restore',page:'forever'}});h.win.dispatchEvent(e);};
 dispatch('https://evil.test',h.parent);dispatch(h.win.origin,{});assert.equal(h.scenes[0].hidden,false);dispatch(h.win.origin,h.parent);assert.equal(h.scenes[9].hidden,false);
});
test('viewer regression: restart must retain the sender-customized envelope hint',()=>{
 const h=bootViewer({envelopeHint:'Open our special letter'});h.get('open-envelope').click();h.flush();h.get('restart').click();assert.equal(h.get('envelope-hint').textContent,'Open our special letter');
});
test('viewer regression: global OFF wins over delayed Spotify playback events',()=>{
 const h=bootViewer({spotifyUrl:spotify});h.get('record').click();let pauses=0;const controller={callbacks:{},addListener(k,f){this.callbacks[k]=f;},play(){},pause(){pauses++;},destroy(){}};
 h.win.onSpotifyIframeApiReady({createController(host,opts,cb){cb(controller);}});controller.callbacks.ready();h.get('music-toggle').click();assert.equal(h.get('music-toggle').attrs['aria-pressed'],'false');
 controller.callbacks.playback_update({data:{isPaused:false,isBuffering:false}});assert.equal(h.get('music-toggle').attrs['aria-pressed'],'false');assert.ok(pauses>0);
});
test('viewer regression: superseded Spotify and audio callbacks cannot change the current player',()=>{
 const h=bootViewer({spotifyUrl:spotify});h.get('record').click();let pauses=0;const controller={callbacks:{},addListener(k,f){this.callbacks[k]=f;},play(){},pause(){pauses++;},destroy(){}};
 h.win.onSpotifyIframeApiReady({createController(host,opts,cb){cb(controller);}});controller.callbacks.ready();h.win.configureAnniversaryPreview({songUrl:song,spotify:null});h.get('record').click();assert.equal(h.get('music-toggle').attrs['aria-pressed'],'true');controller.callbacks.playback_update({data:{isPaused:true,isBuffering:false}});assert.equal(h.get('music-toggle').attrs['aria-pressed'],'true');controller.callbacks.playback_update({data:{isPaused:false,isBuffering:false}});assert.equal(h.get('music-toggle').attrs['aria-pressed'],'true');assert.ok(pauses>0);
 const old=h.audios[0];h.win.configureAnniversaryPreview({songUrl:song,spotify:null});h.get('record').click();old.dispatchEvent(new Event('error'));old.dispatchEvent(new Event('pause'));assert.equal(h.get('music-toggle').attrs['aria-pressed'],'true');
});
test('audio link field rejects known music and video webpages while allowing signed file URLs',()=>{
 for(const songUrl of ['https://youtu.be/abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk',spotify,'https://soundcloud.com/person/song','https://music.apple.com/us/song/example/123']){assert.throws(()=>schema.validate({songUrl}),{code:'anniversary_audio_url'});assert.equal(schema.validate({songUrl},{mode:'lenient'}).songUrl,'');}
 assert.equal(schema.music('https://storage.example/download?token=abc'),'https://storage.example/download?token=abc');
});
