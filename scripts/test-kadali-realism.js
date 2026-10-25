'use strict';
// Assets + actual in-scene photo life cycle. Synthetic color images, never people.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process'),{once}=require('node:events'),{chromium}=require('playwright'),sharp=require('sharp'),C=require('../public/shaadi-paigaam/core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-output/kadali/realism');fs.mkdirSync(out,{recursive:true});
let n=0,browser,server,base,log='';const errors=[];const ok=(v,s)=>{assert.ok(v,s);n++;console.log('PASS',s);};
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kadali-realism-'));try{
 for(const name of ['kalash-real','portrait-frame','canopy-real','portal-real','portrait-aperture']){const file=path.join(root,'public/kadali-vivah/art',name+'.webp');const im=sharp(file);const meta=await im.metadata(),stats=await im.stats();ok(meta.hasAlpha&&stats.channels[3].min===0&&stats.channels[3].max===255,'real transparent alpha, not a blue/white background: '+name);}
 const p=await port();base='http://127.0.0.1:'+p;server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,DATA_DIR:dir,PORT:String(p),HOST:'127.0.0.1',BASE_URL:base},stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Startup: '+log)),30000);server.stdout.on('data',()=>{if(log.includes('admin →')){clearTimeout(t);resolve();}});});
 browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 const d=structuredClone(C.SAMPLE);d.photos=[];d.couplePhoto=null;d.rsvp.whatsapp='+919876543210';
 let r=await ctx.request.post(base+'/api/kadali-vivah/draft',{data:{data:d}}),j=await r.json();const id=j.id;ok(!!id,'test draft owns the photos');
 const image1=await sharp({create:{width:1200,height:1500,channels:3,background:'#8d304f'}}).jpeg().toBuffer();
 const image2=await sharp({create:{width:1500,height:1200,channels:3,background:'#337b76'}}).jpeg().toBuffer();
 async function upload(bytes){const r=await ctx.request.post(base+'/api/kadali-vivah/upload?id='+id+'&kind=photo',{headers:{'content-type':'image/jpeg'},data:bytes});assert.equal(r.status(),200);return(await r.json()).url;}
 const u1=await upload(image1),u2=await upload(image2);d.couplePhoto={url:u1,fx:50,fy:50};d.photos=[{url:u2,alt:'Synthetic test image only',fx:50,fy:50}];
 await ctx.request.post(base+'/api/kadali-vivah/draft',{data:{id,data:d}});await page.goto(base+'/kadali-vivah/preview/'+id,{waitUntil:'domcontentloaded'});await page.locator('#skipBtn').click();await page.locator('#intro').waitFor({state:'detached'});
 await page.waitForFunction(()=>SPInvite.stage()?.assetLayersLoaded===5&&SPInvite.stage()?.photoCount===2&&SPInvite.stage()?.pendingPhotos===0);
 let stats=await page.evaluate(()=>SPInvite.stage());ok(stats.photographic&&stats.photoErrors===0&&stats.assetLayersFailed===0,'realistic scene and both customer picture textures loaded');ok(stats.drawCalls<60&&stats.triangles<2000&&stats.textures<24,'photographic layering stays inside mobile GPU budget');
 await page.screenshot({path:path.join(out,'customer-photos-desktop.png'),timeout:60000});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'customer-photos-mobile.png'),timeout:60000});
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'in-scene portrait does not break mobile layout');
 const before=stats.progress;await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight-innerHeight,behavior:'instant'}));await page.waitForFunction(()=>SPInvite.stage().progress>.9);ok((await page.evaluate(()=>SPInvite.stage())).progress>before,'camera still travels in depth when photographic assets are used');
 // Live editor bridge must replace/remove GPU textures rather than retain private old photos.
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/create/kadali-vivah?id='+id,{waitUntil:'domcontentloaded'});const frame=page.frameLocator('#pv');await frame.locator('#hero').waitFor();const f=page.frames().find(f=>f.url().includes('/kadali-vivah/frame'));
 await f.waitForFunction(()=>SPInvite.stage()?.photoCount===2);ok(true,'saved portrait/gallery reach real live editor scene');
 d.couplePhoto={url:u2,fx:20,fy:60};d.photos=[];await page.evaluate(d=>document.querySelector('#pv').contentWindow.postMessage({type:'sp:data',data:d},location.origin),d);await f.waitForFunction(()=>SPInvite.stage()?.photoCount===1&&SPInvite.stage()?.pendingPhotos===0);ok(true,'replacing photos rebuilds scene textures');
 d.couplePhoto=null;d.photos=[];await page.evaluate(d=>document.querySelector('#pv').contentWindow.postMessage({type:'sp:data',data:d},location.origin),d);await f.waitForFunction(()=>SPInvite.stage()?.photoCount===0&&SPInvite.stage()?.pendingPhotos===0);stats=await f.evaluate(()=>SPInvite.stage());ok(stats.photoErrors===0&&stats.textures<20,'removing photos drops old GPU textures and leaves no errors');ok(errors.length===0,'zero uncaught scene/photo browser exceptions');
 console.log('RESULT:',n,'realism/photo assertions passed.');fs.writeFileSync(path.join(out,'realism-result.json'),JSON.stringify({passed:n,errors},null,2));
 }finally{if(browser)await browser.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
