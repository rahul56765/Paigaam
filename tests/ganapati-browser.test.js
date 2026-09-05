'use strict';
// Real Chromium tests, driven by Node's repeatable test runner.
// GANAPATI_BASE_URL=http://127.0.0.1:3211 node --test tests/ganapati-browser.test.js
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
const sharp=require('sharp');
const BASE=(process.env.GANAPATI_BASE_URL||'http://127.0.0.1:3210').replace(/\/$/,'');
const OUT=process.env.GANAPATI_SCREENSHOT_DIR||'/agent/workspace';
let browser;
before(async()=>{browser=await chromium.launch({headless:true,args:['--no-sandbox']});});
after(async()=>{if(browser)await browser.close();});
async function overflow(page,label){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));assert.ok(size.scroll<=size.view+1,`${label}: horizontal overflow ${size.scroll}>${size.view}`);}
async function screenshot(page,name){await page.screenshot({path:`${OUT}/ganapati-${name}.png`});}
async function musicState(page){return page.evaluate(()=>{const a=document.querySelector('#invitation-music'),b=document.querySelector('#music-toggle');return {paused:a.paused,time:a.currentTime,ready:a.readyState,error:a.error&&a.error.code,pressed:b.getAttribute('aria-pressed'),failed:b.classList.contains('is-error'),status:document.querySelector('#music-status').textContent,label:b.getAttribute('aria-label')};});}
async function realAudioOutcome(page,t,label){
 try{await expect.poll(async()=>{const s=await musicState(page);return (s.pressed==='true'&&!s.paused&&s.time>0.05)||(s.failed&&s.status.length>0);},{timeout:15000,message:label+' must really play or visibly fail'}).toBe(true);}finally{t.diagnostic(label+': '+JSON.stringify(await musicState(page)));}
 return musicState(page);
}
async function published(context,language='en'){
 const data={language,familyName:'Probe visitor '+Date.now(),fatherName:'Vijay',motherName:'Mira',familyMembers:'The whole family',customMessage:'Join our joyful celebration.',eventDate:'2026-09-14',eventTime:'11:00',venueName:'Probe home',address:'Pune, Maharashtra',photos:[]};
 const d=await context.request.post(BASE+'/api/ganapati/draft',{data:{customer_data:data}});assert.equal(d.status(),200,await d.text());const {id}=await d.json();const p=await context.request.post(BASE+'/api/ganapati/publish',{data:{id}});assert.equal(p.status(),200);return {...await p.json(),id,data};
}
const cases=[{language:'en',viewport:{width:360,height:740},name:'mobile-en',family:'Probe Deshmukh family',heading:'Bring Bappa home.'},{language:'hi',viewport:{width:1440,height:1000},name:'desktop-hi',family:'प्रोब देशमुख परिवार',heading:'बप्पा का स्वागत करें।'},{language:'mr',viewport:{width:360,height:740},name:'mobile-mr',family:'प्रोब देशमुख कुटुंब',heading:'बाप्पांचे स्वागत करूया.'}];
for(const c of cases)test(`Browser wizard: ${c.name} complete form, real photo upload, loaded preview, audio and publication`,{timeout:90000},async t=>{
 const context=await browser.newContext({viewport:c.viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  await page.goto(BASE+'/create/ganapati-aagman');await page.selectOption('#language',c.language);await expect(page.locator('html')).toHaveAttribute('lang',c.language);await expect(page.locator('#wizard h1')).toHaveText(c.heading);await overflow(page,'wizard design '+c.language);
  if(c.name==='mobile-en')await screenshot(page,'mobile-wizard');
  await page.click('#next');await overflow(page,'language '+c.language);await page.click('[data-language="'+c.language+'"]');await page.click('#next');
  await page.click('#next');await expect(page.locator('#formError')).toBeVisible();await expect(page.locator('#familyName')).toHaveAttribute('aria-invalid','true');
  await page.fill('#familyName',c.family);await page.fill('#fatherName','Vijay');await page.fill('#motherName','Mira');await page.fill('#familyMembers','Aarav, Aditi');await page.fill('#customMessage','A warm welcome <b>not markup</b> & blessings.');await overflow(page,'family '+c.language);await page.click('#next');
  await expect(page.locator('#eventDate')).toHaveValue('2026-09-14');await expect(page.locator('#eventTime')).toHaveValue('11:00');await page.fill('#venueName','Probe Home');await page.fill('#address','Pune, Maharashtra');await overflow(page,'event '+c.language);await page.click('#next');
  const image=await sharp({create:{width:480,height:320,channels:3,background:'#b47a39'}}).jpeg().toBuffer();
  await page.setInputFiles('#photoFiles',{name:'probe-family.jpg',mimeType:'image/jpeg',buffer:image});await expect(page.locator('.photo-card')).toHaveCount(1);await page.locator('.photo-card input').fill('Family test photo '+c.language);await expect(page.locator('#next')).toBeEnabled();await overflow(page,'photos '+c.language);await page.click('#next');
  await expect(page.locator('#publish')).toBeDisabled();await overflow(page,'review '+c.language);
  const uploadResponse=page.waitForResponse(r=>r.url().includes('/api/ganapati/upload?')&&r.request().method()==='POST');await page.click('#savePreview');const uploaded=await uploadResponse;assert.equal(uploaded.status(),200,await uploaded.text());const photoUrl=(await uploaded.json()).url;
  await expect(page.locator('#previewDialog')).toBeVisible();const f=page.frameLocator('#frameHost iframe');await expect(f.locator('body')).toHaveAttribute('data-preview','true');await expect(f.locator('html')).toHaveAttribute('lang',c.language);await expect(f.locator('.family-name')).toHaveText(c.family);await expect(f.locator('.personal-message')).toHaveText('A warm welcome <b>not markup</b> & blessings.');await expect(f.locator('.personal-message b')).toHaveCount(0);await expect(f.locator(`img[src="${photoUrl}"]`)).toHaveCount(1);
  const frame=page.frames().find(x=>x.url().includes('/ganapati/preview/'));assert.ok(frame);await overflow(frame,'preview '+c.language);
  await f.locator('#enter').click();await realAudioOutcome(frame,t,'Preview Enter '+c.name);
  await page.click('#closePreview');await expect(page.locator('#frameHost iframe')).toHaveCount(0);await expect(page.locator('#previewDialog')).not.toBeVisible();assert.ok(frame.isDetached(),'Closing preview destroys audio browsing context');await expect(page.locator('#publish')).toBeEnabled();
  await page.click('#publish');await expect(page.locator('#publishedResult')).toBeVisible();const url=await page.inputValue('#publishedUrl');assert.ok(url.startsWith(BASE+'/p/ganapati-'));const creatorShare=new URL(await page.getAttribute('#whatsapp','href'));assert.equal(creatorShare.hostname,'wa.me');assert.ok(creatorShare.searchParams.get('text').includes(url));
  const guest=await browser.newContext({viewport:c.viewport});try{const visit=await guest.newPage();await visit.goto(url);await expect(visit.locator('body')).toHaveAttribute('data-preview','false');await expect(visit.locator('html')).toHaveAttribute('lang',c.language);await expect(visit.locator('.family-name')).toHaveText(c.family);assert.equal((await guest.request.get(BASE+photoUrl)).status(),200);await overflow(visit,'public '+c.language);if(c.name==='desktop-hi')await screenshot(visit,'desktop-hi-intro');await visit.locator('#invitation').scrollIntoViewIfNeeded();await overflow(visit,'public details '+c.language);if(c.language==='en')await screenshot(visit,'mobile-details');}finally{await guest.close();}
  assert.deepEqual(errors,[],'No uncaught wizard JavaScript errors');
 }finally{await context.close();}
});

async function sampleScene(page,name,progress,t){
 const selector='[data-scene="'+name+'"]';
 await page.evaluate(({selector,progress})=>{const s=document.querySelector(selector),travel=s.offsetHeight-s.querySelector('.film-sticky').offsetHeight;window.scrollTo({top:s.getBoundingClientRect().top+scrollY+travel*(.09+.74*progress),behavior:'instant'});},{selector,progress});
 const video=page.locator(selector+' video');await expect.poll(()=>video.evaluate(v=>v.readyState),{timeout:20000,message:name+' metadata'}).toBeGreaterThanOrEqual(2);
 await expect.poll(()=>video.evaluate((v,p)=>Math.abs(v.currentTime-Math.min(v.duration-.055,Math.round(p*(v.duration-.055)*24)/24)),progress),{timeout:15000,message:name+' actual scroll seek'}).toBeLessThan(.12);
 const sample=await page.evaluate(selector=>{const s=document.querySelector(selector),v=s.querySelector('video');return {time:v.currentTime,duration:v.duration,muted:v.muted,defaultMuted:v.defaultMuted,volume:v.volume,paused:v.paused,cues:[...s.querySelectorAll('.cue')].map(c=>({text:c.textContent,start:+c.dataset.start,end:+c.dataset.end,opacity:+getComputedStyle(c).opacity}))};},selector);
 assert.equal(sample.muted,true);assert.equal(sample.defaultMuted,true);assert.equal(sample.volume,0);assert.equal(sample.paused,true);
 for(const c of sample.cues){const fade=Math.min(.055,(c.end-c.start)/3),clamp=x=>Math.max(0,Math.min(1,x));const expected=Math.min(c.start===0?1:clamp((progress-c.start)/fade),c.end===1?1:clamp((c.end-progress)/fade));assert.ok(Math.abs(c.opacity-expected)<.08,`${name} caption ${c.text}: ${c.opacity} expected ${expected}`);}
 t.diagnostic(JSON.stringify({scene:name,progress,...sample}));await overflow(page,name+' '+progress);return sample;
}

test('Browser visitor: real film seeking/caption beats, letter unlock, muted videos, soundtrack toggle, WhatsApp', {timeout:120000},async t=>{
 const context=await browser.newContext({viewport:{width:360,height:740}});const pub=await published(context);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pub.url);await screenshot(page,'mobile-intro');await overflow(page,'intro');await expect(page.locator('#arrival')).toHaveAttribute('data-locked','true');assert.equal(await page.locator('#arrival video').getAttribute('src'),null,'Journey not loaded while locked');
  assert.equal((await musicState(page)).paused,true);await page.click('#enter');const audio=await realAudioOutcome(page,t,'Public Enter');assert.equal(audio.failed,false,'Local bundled audio should decode and play successfully');
  await page.click('#music-toggle');await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed','false');assert.equal((await musicState(page)).paused,true);await page.click('#music-toggle');const toggled=await realAudioOutcome(page,t,'Public music toggle');assert.equal(toggled.failed,false);
  // Wait until the actual smooth Enter scroll has settled before imposing sample positions.
  await page.waitForTimeout(700);
  for(const p of [.12,.5,.88,.25]){await sampleScene(page,'formation',p,t);if(p===.5)await screenshot(page,'mobile-midfilm');}
  assert.equal(await page.locator('#arrival video').getAttribute('src'),null);
  await page.locator('#open-invitation').click();await expect(page.locator('#open-invitation')).toHaveAttribute('aria-expanded','true');await expect(page.locator('#arrival')).toHaveAttribute('data-locked','false');assert.equal(await page.evaluate(()=>document.activeElement.id),'arrival');
  for(const p of [.12,.5,.88,.2])await sampleScene(page,'journey',p,t);
  await page.locator('video').evaluateAll(videos=>videos.forEach(v=>{v.muted=false;v.volume=1;}));await expect.poll(()=>page.locator('video').evaluateAll(v=>v.every(x=>x.muted&&x.defaultMuted&&x.volume===0&&x.paused))).toBe(true);
  await page.locator('#invitation').scrollIntoViewIfNeeded();await overflow(page,'details');await screenshot(page,'mobile-details');const href=await page.getAttribute('#whatsapp-share','href'),wa=new URL(href);assert.equal(wa.hostname,'wa.me');assert.ok(wa.searchParams.get('text').includes(pub.url));assert.equal(await page.getAttribute('#whatsapp-share','target'),'_blank');
  const direction=new URL(await page.locator('#venue a').getAttribute('href'));assert.equal(direction.searchParams.get('query'),pub.data.address);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('Browser: actual audio network failure is announced, without stubbing play()', {timeout:35000},async t=>{
 const context=await browser.newContext({viewport:{width:360,height:740}});try{await context.route('**/ganapati/media/music.mp3',r=>r.abort('failed'));const page=await context.newPage();await page.goto(BASE+'/ganapati/demo');await page.evaluate(()=>{window.audioEvents=[];const a=document.querySelector('audio'),b=document.querySelector('#music-toggle');for(const type of ['error','pause'])a.addEventListener(type,()=>window.audioEvents.push({type,error:a.error&&a.error.code,label:b.getAttribute('aria-label'),status:document.querySelector('#music-status').textContent}));});await page.click('#enter');try{const state=await realAudioOutcome(page,t,'Network-failed Enter');assert.equal(state.failed,true);assert.equal(state.pressed,'false');assert.ok(state.status);assert.ok(state.paused);}finally{t.diagnostic('Audio event order: '+JSON.stringify(await page.evaluate(()=>window.audioEvents)));await screenshot(page,'mobile-audio-failure');}}finally{await context.close();}
});

test('Browser: reduced motion in all three languages keeps films static and letter/details accessible', {timeout:60000},async t=>{
 for(const language of ['en','hi','mr'])await t.test(language,async()=>{
  const context=await browser.newContext({viewport:{width:360,height:740},reducedMotion:'reduce'});try{const page=await context.newPage();await page.goto(BASE+'/ganapati/demo?lang='+language);await expect(page.locator('html')).toHaveAttribute('lang',language);await overflow(page,'reduced intro '+language);await page.click('#enter');await expect.poll(()=>page.locator('[data-scene="formation"] .film-still').getAttribute('src')).toContain('formation-end.jpg');assert.equal(await page.locator('[data-scene="formation"] video').getAttribute('src'),null);await page.locator('#open-invitation').click();await expect(page.locator('#arrival')).toHaveAttribute('data-locked','false');await expect.poll(()=>page.locator('#arrival .film-still').getAttribute('src')).toContain('journey-end.jpg');assert.equal(await page.locator('#arrival video').getAttribute('src'),null);assert.ok(await page.locator('video').evaluateAll(vs=>vs.every(v=>v.paused&&v.muted)));await page.locator('#invitation').scrollIntoViewIfNeeded();await overflow(page,'reduced details '+language);await expect(page.locator('.family-name')).not.toBeEmpty();if(language==='mr')await screenshot(page,'mobile-mr-reduced-details');}finally{await context.close();}
 });
});
