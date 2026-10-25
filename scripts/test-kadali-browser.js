'use strict';
// Real guest/editor browser checks for the exact-film + original WebGL revision.
const {spawn}=require('node:child_process'),{once}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),C=require('../public/shaadi-paigaam/core'),I=require('../public/shaadi-paigaam/i18n');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-output/kadali/browser-v2');fs.mkdirSync(out,{recursive:true});
let passed=0,browser,server,base,serverLog='';const failures=[],errors=[];
const ok=(condition,label)=>{assert.ok(condition,label);passed++;console.log('PASS',label);};
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function test(label,fn){console.log('\nTEST',label);try{await fn();}catch(e){failures.push(label+': '+e.stack);console.error('FAIL',label,e.stack);}}
async function page(options={}){const context=await browser.newContext({viewport:{width:390,height:844},...options});const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));return p;}
async function ready(p,suffix='/kadali-vivah/demo'){await p.goto(base+suffix,{waitUntil:'domcontentloaded'});await p.locator('#hero .name').first().waitFor({state:'attached'});}
async function skip(p){await p.locator('#skipBtn').click();await p.locator('#intro').waitFor({state:'detached'});ok(await p.evaluate(()=>!document.body.classList.contains('film-locked')&&!document.querySelector('#page[inert]')),'skip unlocks scroll and content');}
async function gl(p){await p.waitForFunction(()=>SPInvite.stage()?.ready);return p.evaluate(()=>SPInvite.stage());}
async function jump(p,y){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function frameHarness(p,guest,data){await p.route('**/__kadali_test',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}iframe{width:100%;height:100vh;border:0}</style><script>window.count=0;addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='sp:ready'){count++;e.source.postMessage({type:'sp:data',data:${JSON.stringify(data).replace(/</g,'\\u003c')}},location.origin)}})</script><iframe src="/kadali-vivah/frame${guest?'?guest=1':''}"></iframe>`}));await p.goto(base+'/__kadali_test',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.count===1);const f=p.frames().find(x=>x.url().includes('/kadali-vivah/frame'));await f.waitForFunction(name=>document.querySelector('#hero')?.textContent.includes(name),data.couple.groom.first);return f;}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kadali-browser-v2-'));
 try{
  const n=await port();base='http://127.0.0.1:'+n;
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(n),HOST:'127.0.0.1',BASE_URL:base,DATA_DIR:dir,RAZORPAY_KEY_ID:'',RAZORPAY_KEY_SECRET:''},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout '+serverLog)),30000);server.stdout.on('data',()=>{if(serverLog.includes('admin →')){clearTimeout(timer);resolve();}});server.once('exit',code=>reject(Error('Server exit '+code)));});
  browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await test('exact original film playback, no reconstructed opening',async()=>{
   const p=await page();try{
    const media=[];p.on('request',r=>{if(r.resourceType()==='media')media.push(r.url());});await ready(p);
    ok(await p.locator('#leafParcel').count()===0,'there is no recreated leaf parcel');
    ok(await p.locator('#openingFilm').getAttribute('src')===null&&media.length===0,'original film not downloaded before guest taps');
    await p.locator('#openBtn').click();await p.waitForFunction(()=>document.querySelector('video').currentTime>.1);
    const film=await p.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,rate:v.playbackRate,muted:v.muted,src:v.currentSrc}));
    ok(Math.abs(film.duration-10.026667)<.1&&film.width===720&&film.height===1280,'original duration and 720 by 1280 dimensions retained');
    ok(film.rate===1&&!film.muted&&film.src.endsWith('/kadali-vivah/opening.mp4'),'original speed and audio retained');
    ok(await p.locator('video').evaluate(v=>getComputedStyle(v).objectFit==='contain'),'full video frame uncropped');
    await p.locator('#intro').waitFor({state:'detached',timeout:30000});ok(true,'actual ended event reveals invitation after full original film');
    await p.waitForFunction(()=>SPInvite.stage()?.assetLayersLoaded===5);const state=await gl(p);ok(state.webgl&&state.drawCalls>0&&state.photographic&&state.assetLayersFailed===0,'depth-separated photographic 3D scene follows video');
    await p.screenshot({timeout:60000,path:path.join(out,'after-original-film.png')});
   }finally{await p.context().close();}
  });
  await test('keyboard skip and replay',async()=>{const p=await page();try{await ready(p);ok(await p.locator('#openBtn').evaluate(e=>e===document.activeElement),'accessible play button has initial focus');await p.keyboard.press('Shift+Tab');ok(await p.locator('#skipBtn').evaluate(e=>e===document.activeElement),'focus stays in opening dialog');await p.keyboard.press('Escape');await p.locator('#intro').waitFor({state:'detached'});await p.locator('#replayBtn').click();ok(await p.locator('#openingFilm').count()===1&&await p.locator('#openingFilm').getAttribute('src')===null,'replay restores original film, not replacement animation');await skip(p);}finally{await p.context().close();}});
  for(const width of [320,390,768,1440])await test('responsive 3D journey '+width,async()=>{const p=await page({viewport:{width,height:width<768?844:1000},reducedMotion:'reduce'});try{
   await ready(p);await skip(p);const state=await gl(p);ok(state.webgl&&state.ready&&state.pixelRatio<=1.5,'WebGL ready with bounded DPR at '+width);
   const before=state.progress;await jump(p,await p.evaluate(()=>document.documentElement.scrollHeight-innerHeight));await p.waitForFunction(()=>SPInvite.stage().progress>.9);ok((await gl(p)).progress>before,'scroll moves through the 3D camera path at '+width);
   const shape=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,names:[...document.querySelectorAll('.name')].every(e=>e.scrollWidth<=e.clientWidth+2),canvas:document.querySelector('#stage canvas').getBoundingClientRect().width}));
   ok(!shape.overflow&&shape.names&&Math.abs(shape.canvas-width)<2,'canvas and readable names fit viewport at '+width);
   await p.screenshot({timeout:60000,path:path.join(out,'rsvp-'+width+'.png')});await jump(p,0);await p.screenshot({timeout:60000,path:path.join(out,'entrance-'+width+'.png')});
  }finally{await p.context().close();}});
  await test('personalized iframe and all eight languages',async()=>{const p=await page({viewport:{width:320,height:844},reducedMotion:'reduce'});try{
   const d=structuredClone(C.SAMPLE);d.couple.groom.first='Chandrasekharavenkatasubramanian';d.couple.bride.first='Lakshmipriyadarshinivenkataramani';d.lang.enabled=Object.keys(I.LANGS);d.rsvp.whatsapp='+919876543210';d.photos=[];
   const f=await frameHarness(p,false,d);ok(await f.locator('#intro').count()===0,'live editor frame never obstructed by opening');
   for(const l of d.lang.enabled){await f.evaluate(l=>SPInvite.setLang(l),l);ok(await f.locator('html').getAttribute('lang')===l,'language updates '+l);ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2&&[...document.querySelectorAll('.name')].every(e=>e.scrollWidth<=e.clientWidth+2)),'long names fit '+l);}
   ok(await f.locator('a[data-rsvp]').count()===2&&await f.locator('form').count()===0,'RSVP is exactly two WhatsApp choices, not a form');
   const href=await f.locator('a[data-rsvp="yes"]').getAttribute('href');ok(href.startsWith('https://wa.me/919876543210?text=')&&new URL(href).searchParams.get('text').length>0,'RSVP opens configured organiser with prefilled answer');
   const guestPage=await page({viewport:{width:320,height:844},reducedMotion:'reduce'});try{const guest=await frameHarness(guestPage,true,d);ok(await guest.locator('#openingFilm').count()===1&&(await guest.locator('#hero').textContent()).includes(d.couple.bride.first),'guest preview keeps original film and personalized content');}finally{await guestPage.context().close();}
  }finally{await p.context().close();}});
  await test('seven-step editor saves, reloads and previews customer data',async()=>{const p=await page({viewport:{width:1440,height:1000},reducedMotion:'reduce'});try{
   await p.goto(base+'/create/kadali-vivah');const g=p.locator('[data-path="couple.groom.first"]'),b=p.locator('[data-path="couple.bride.first"]');await g.fill('Devansh');await b.fill('Meera');
   await p.frameLocator('#pv').locator('#hero').filter({hasText:'Devansh'}).waitFor();ok(true,'first-step edits reach original 3D preview');
   await p.waitForFunction(()=>new URL(location.href).searchParams.has('id')&&document.querySelector('#saveState')?.textContent.trim()==='Saved');
   await p.reload();ok(await g.inputValue()==='Devansh'&&await b.inputValue()==='Meera','saved customer names restored');
   await p.locator('#guestBtn').click();const guest=p.frameLocator('#gpFrame');await guest.locator('#hero').filter({hasText:'Meera'}).waitFor({state:'attached'});ok(await guest.locator('#openingFilm').count()===1,'real editor guest modal uses original film');
   await guest.locator('#skipBtn').click();await guest.locator('#intro').waitFor({state:'detached'});ok((await guest.locator('#hero').textContent()).includes('Devansh'),'guest preview is personalized');
  }finally{await p.context().close();}});
  await test('WebGL unavailable still leaves usable invitation',async()=>{const p=await page({reducedMotion:'reduce'});try{
   await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...a){return /webgl/.test(type)?null:original.call(this,type,...a);};});await ready(p);await skip(p);ok(await p.locator('.chapter').count()>=6&&await p.locator('.rsvp-choices button').count()===2,'fallback keeps invitation and RSVP choices');ok(await p.evaluate(()=>!document.querySelector('#page[inert]')),'fallback never traps guest in video');
  }finally{await p.context().close();}});
  ok(errors.length===0,'no uncaught browser exceptions: '+errors.join('; '));
 }catch(e){failures.push(e.stack);console.error(e.stack);}finally{
  if(browser)await browser.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,failures,errors},null,2));fs.writeFileSync(path.join(out,'server.log'),serverLog);fs.rmSync(dir,{recursive:true,force:true});console.log('\nRESULT',passed,'assertions;',failures.length,'failures');if(failures.length)process.exitCode=1;
 }
})();
