'use strict';
// Real local Chromium QA. Owns a temporary server/database; never contacts production.
const {chromium}=require('playwright');
const {expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const config=require('../templates/diwali-deep/config');
const report={checks:[],consoleErrors:[]};
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'diwali-browser-'));let server,browser;
  try{
    const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));const base='http://127.0.0.1:'+port;
    let logs='';server=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',BASE_URL:base,DATA_DIR:dir},stdio:['ignore','pipe','pipe']});server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
    const deadline=Date.now()+20000;while(true){if(server.exitCode!==null)throw new Error('Server exited: '+logs);try{if((await fetch(base)).ok)break;}catch{}if(Date.now()>deadline)throw new Error('Server readiness timed out');await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    for(const [width,height]of [[320,568],[360,640],[390,844],[430,932],[844,390],[768,1024]]){
      const ctx=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500});const p=await ctx.newPage();p.on('pageerror',e=>report.consoleErrors.push(e.message));
      await p.goto(base+'/diwali-deep/demo');await p.evaluate(()=>document.fonts.ready);await expect(p.locator('.dd-cover-title')).toBeVisible();
      const geometry=await p.evaluate(()=>{const r=document.querySelector('.dd-card').getBoundingClientRect();return {viewport:[innerWidth,innerHeight],card:[r.x,r.y,r.width,r.height],inside:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,ratio:r.width/r.height,overflow:[...document.querySelectorAll('[data-dd-fit]')].filter(b=>b.firstElementChild.scrollHeight>b.clientHeight+1||b.firstElementChild.scrollWidth>b.clientWidth+1).map(b=>b.className),scrollWidth:document.documentElement.scrollWidth};});
      assert.ok(geometry.inside,JSON.stringify(geometry));assert.ok(Math.abs(geometry.ratio-9/16)<.0001);assert.deepEqual(geometry.overflow,[]);assert.ok(geometry.scrollWidth<=width+1);report.checks.push({test:'contained mobile/landscape canvas',...geometry});
      await ctx.close();
    }
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();p.on('pageerror',e=>report.consoleErrors.push(e.message));
    await p.goto(base+'/diwali-deep/demo');await p.evaluate(()=>document.fonts.ready);
    const lamp=p.locator('[data-dd-light]'),flame=lamp.locator('.dd-flame-shape');await expect(flame).toHaveCSS('opacity','0');
    const r=await lamp.boundingBox(),c=await p.locator('.dd-card').boundingBox(),x=r.x+r.width/2,y=r.y+r.height*.8;
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x,y-c.height*.11,{steps:12});await expect.poll(async()=>Number(await lamp.getAttribute('data-progress'))).toBeGreaterThan(.45);await expect.poll(async()=>Number(await flame.evaluate(e=>getComputedStyle(e).opacity))).toBeGreaterThan(.3);await expect(p.locator('.dd-page--cover')).toHaveClass(/is-current/);
    await p.mouse.up();await expect(lamp).toHaveClass(/is-cooling/);await expect(flame).toHaveCSS('opacity','0');await expect(p.locator('.dd-page--cover')).toHaveClass(/is-current/);report.checks.push({test:'trusted partial pointer swipe grows visible flame then cools without advancing',pass:true});
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x,y-c.height*.25,{steps:20});await p.mouse.up();await expect(p.locator('.dd-page--invitation')).toHaveClass(/is-current/);await expect(p.locator('#ddApp')).not.toHaveClass(/dd-opening/);assert.equal(await p.evaluate(()=>scrollY),0);assert.equal(await p.locator('.dd-page--invitation .dd-flame').count(),7);report.checks.push({test:'full trusted pointer swipe opens invitation without scroll',pass:true});
    await p.locator('[data-dd-next]').click();await expect(p.locator('.dd-page--welcome')).toHaveClass(/is-current/);await expect(p.locator('.dd-maps')).toHaveCount(0);await expect(p.locator('[data-dd-next]')).toBeDisabled();await expect.poll(async()=>{await p.keyboard.press('ArrowLeft');return p.locator('.dd-page--invitation').evaluate(e=>e.classList.contains('is-current'));}).toBe(true);report.checks.push({test:'next, keyboard, last-page boundary, absent map link',pass:true});
    await p.goto(base+'/diwali-deep/demo');await p.locator('[data-dd-light]').tap();await expect(p.locator('.dd-page--invitation')).toHaveClass(/is-current/);report.checks.push({test:'real touchscreen tap fallback',pass:true});
    // Exercise the actual upload APIs and render the owned preview using the same context cookie.
    let response=await ctx.request.post(base+'/api/diwali-deep/draft',{data:{customer_data:config.demo}});assert.equal(response.status(),200);const draft=await response.json();
    const png=require('../tests/bfday-helpers').png(100,200,[120,80,40]);response=await ctx.request.post(base+'/api/diwali-deep/upload?id='+draft.id,{headers:{'content-type':'image/png'},data:png});assert.equal(response.status(),200);const photo=(await response.json()).url;
    const data={...config.demo,familyPhoto:photo,photoZoom:180,photoX:10,photoY:90,mapsLink:'https://www.google.com/maps?q=Jaipur'};response=await ctx.request.post(base+'/api/diwali-deep/draft',{data:{id:draft.id,customer_data:data}});assert.equal(response.status(),200);
    await p.emulateMedia({reducedMotion:'reduce'});await p.goto(base+draft.previewUrl);await p.locator('[data-dd-light]').tap();await expect(p.locator('.dd-page--invitation')).toHaveClass(/is-current/);await p.locator('[data-dd-next]').click();await expect(p.locator('.dd-page--welcome')).toHaveClass(/is-current/);
    const image=p.locator('.dd-photo-window img');await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);await expect(image).toHaveCSS('object-position','10% 90%');await expect(image).toHaveCSS('transform','matrix(1.8, 0, 0, 1.8, 0, 0)');await expect(p.locator('.dd-maps')).toHaveAttribute('href',data.mapsLink);await expect(p.locator('.dd-maps')).toHaveAttribute('target','_blank');await expect(p.locator('.dd-golden-flood')).toHaveCSS('display','none');report.checks.push({test:'uploaded portrait crop, safe Maps button and reduced-motion opening',pass:true});
    // The actual wizard receives its image/audio inputs and live crop fields from the family engine.
    await p.goto(base+'/create/diwali-deep');assert.equal(await p.locator('[data-image="familyPhoto"] input[type=file]').count(),1);assert.equal(await p.locator('[data-audio="musicUpload"] input[type=file]').count(),1);for(const id of ['photoZoom','photoX','photoY','mapsLink'])assert.equal(await p.locator('#f-'+id).count(),1);report.checks.push({test:'real customizer image/audio upload slots and all crop/map inputs',pass:true});
    await ctx.close();assert.deepEqual(report.consoleErrors,[]);report.ok=true;console.log(JSON.stringify(report,null,2));
  }finally{
    if(browser)await browser.close();if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
