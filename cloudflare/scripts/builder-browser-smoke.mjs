import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Optional local-only browser test: supply a local Puppeteer module entry and a
// Chromium binary via environment. No dependencies are added to the app build.
const puppeteerEntry = process.env.PUPPETEER_CORE_MODULE;
const chromePath = process.env.CHROMIUM_EXECUTABLE;
if (!puppeteerEntry || !chromePath) throw new Error('Set PUPPETEER_CORE_MODULE and CHROMIUM_EXECUTABLE to installed local paths');
const { default: puppeteer } = await import(pathToFileURL(puppeteerEntry).href);

const base=(process.argv[2] || 'http://127.0.0.1:8790').replace(/\/$/, '');
const target=new URL(base);
if (target.protocol!=='http:' || !['127.0.0.1','localhost'].includes(target.hostname) || target.username || target.password || target.pathname!=='/' || target.search || target.hash) throw new Error('Refusing non-local browser tests');
const browser=await puppeteer.launch({ executablePath:chromePath, headless:true, args:[] });
const reports=[];
const timed = (promise,label) => new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(label+' timed out')),15000);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
try {
  for (const [slug, viewport] of [
    ['sealed-with-a-kiss',{width:1365,height:900}],
    ['sealed-with-a-kiss',{width:390,height:844,isMobile:true,hasTouch:true}],
    ['love-letter',{width:1365,height:900}],
    ['diwali-deep',{width:1365,height:900}],
  ]) {
    const context=await browser.createBrowserContext();
    const page=await context.newPage(); await page.setViewport(viewport);
    const errors=[], localFailures=[], payments=[], apiResponses=[], apiRequests=[];
    let heldUpload, heldPublish, uploadSeen, publishSeen;
    const uploadWait=new Promise(resolve=>{uploadSeen=resolve;}),publishWait=new Promise(resolve=>{publishSeen=resolve;});
    await page.setRequestInterception(true);
    page.on('request', req=>{
      const url=req.url();
      if(url.startsWith(base+'/')||url===base||url.startsWith('data:')||url.startsWith('blob:')||url==='about:blank') {
        const path=url.startsWith(base)?new URL(url).pathname:'';
        if(path.startsWith('/api/')) apiRequests.push({path,method:req.method()});
        if(slug==='diwali-deep' && path==='/api/diwali-deep/upload' && !heldUpload) { heldUpload=req; uploadSeen(); return; }
        if(slug==='diwali-deep' && path==='/api/diwali-deep/publish' && !heldPublish) { heldPublish=req; publishSeen(); return; }
        req.continue();
      } else { if(/razorpay/i.test(url)) payments.push(url); req.abort(); }
    });
    page.on('pageerror', e=>errors.push(e.message));
    page.on('response', res=>{
      if(res.url().startsWith(base+'/')) { const path=new URL(res.url()).pathname;
        if(path.startsWith('/api/')) apiResponses.push({path,status:res.status()});
        if(res.status()>=400) localFailures.push({url:path,status:res.status()}); }
    });
    await page.goto(`${base}/create/${slug}`,{waitUntil:'domcontentloaded',timeout:30000});
    // Opt into reduced-motion scrolling so heading focus cannot move an
    // automated click target while Puppeteer is dispatching the mouse event.
    await page.addStyleTag({content:'html, html:focus-within { scroll-behavior: auto !important; }'});
    await page.waitForSelector('#bfSpec'); await page.waitForSelector('#next');
    await page.waitForFunction(()=>typeof window.wizardAdoptDraft==='function',{timeout:10000});
    const spec=await page.$eval('#bfSpec',el=>JSON.parse(el.textContent));
    if(slug==='sealed-with-a-kiss') await page.type('#f-senderName','Browser Test Sender');
    const before=await page.$eval('#publish',el=>({disabled:el.disabled,hidden:el.closest('section')?.hidden}));
    assert.equal(before.disabled,false);
    for(let i=0;i<spec.lastStep;i++) {
      if(slug==='diwali-deep' && i===2) {
        await page.type('#f-familyName','Browser Test Family');
        const input=await page.$('[data-image="familyPhoto"] input[type="file"]'); assert.ok(input);
        await input.uploadFile(fileURLToPath(new URL('../public/brand/favicon-512.png',import.meta.url)));
        await timed(uploadWait,'photo upload request');
      }
      await page.$eval('#next',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.click('#next');
      try { await page.waitForFunction(expected=>{const s=document.querySelector(`[data-step="${expected}"]`);return s && !s.hidden;},{timeout:4000},i+1); }
      catch(e) { const state=await page.evaluate(()=>{const n=document.querySelector('#next'),b=n.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {current:[...document.querySelectorAll('.step')].find(x=>!x.hidden)?.getAttribute('data-step'),error:document.querySelector('#formError')?.textContent,errorHidden:document.querySelector('#formError')?.hidden,status:document.querySelector('#status')?.textContent,next:{disabled:n.disabled,hidden:n.hidden,outer:n.outerHTML,hit:hit?.outerHTML?.slice(0,240)},active:document.activeElement?.id};});throw new Error(`${slug} step ${i+1} did not advance: ${JSON.stringify(state)} api=${JSON.stringify(apiResponses)} errors=${JSON.stringify(errors)} ${e.message}`); }
    }
    await page.waitForSelector('#publish',{visible:true});
    await page.$eval('#publish',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(slug==='diwali-deep') {
      await page.click('#publish');
      await page.waitForFunction(()=>/wait for your uploads/i.test(document.querySelector('#formError')?.textContent||''),{timeout:5000});
      assert.equal(apiRequests.filter(x=>x.path==='/api/diwali-deep/publish').length,0);
      await heldUpload.continue();
      await page.waitForFunction(()=>document.querySelector('[data-image="familyPhoto"] .bf-photo__note')?.textContent==='Added.',{timeout:15000});
      await page.click('#publish'); await timed(publishWait,'publication request');
      assert.equal(await page.$eval('#f-familyName',el=>el.disabled),true,'edits lock while publishing');
      await heldPublish.continue();
    } else await page.click('#publish');
    try { await page.waitForSelector('#publishedResult:not([hidden])',{visible:true,timeout:20000}); }
    catch(e) { const err=await page.evaluate(()=>({error:{text:document.querySelector('#formError').textContent,hidden:document.querySelector('#formError').hidden},status:document.querySelector('#status')?.textContent,resultHidden:document.querySelector('#publishedResult').hidden,publishDisabled:document.querySelector('#publish').disabled,currentStep:[...document.querySelectorAll('.step')].find(x=>!x.hidden)?.getAttribute('data-step'),steps:[...document.querySelectorAll('.step')].map(x=>({s:x.getAttribute('data-step'),hidden:x.hidden})),sender:document.querySelector('#f-senderName')?.value,active:document.activeElement?.id})); throw new Error(`${slug} did not publish: ${JSON.stringify(err)}; api=${JSON.stringify(apiResponses)} failures=${JSON.stringify(localFailures)} errors=${JSON.stringify(errors)}; ${e.message}`); }
    const url=await page.$eval('#publishedUrl',el=>el.value);
    assert.match(url,new RegExp(`^${base}/p/${slug}-free-[a-f0-9]{48}$`));
    const delivered=await page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,text:await r.text()};},url);
    assert.equal(delivered.status,200); assert.ok(delivered.text.length>500);
    if(slug==='sealed-with-a-kiss') assert.ok(delivered.text.includes('Browser Test Sender'));
    if(slug==='diwali-deep') { assert.ok(delivered.text.includes('Browser Test Family')); assert.match(delivered.text,/\/bfday\/uploads\/[a-f0-9]{48}\.(?:jpg|png|webp)/); }
    // Exercise the real four-second autosave window; no post-publication 409s.
    await new Promise(resolve=>setTimeout(resolve,4500));
    assert.deepEqual(payments,[]); assert.deepEqual(localFailures,[]); assert.deepEqual(errors,[]);
    reports.push({slug,viewport:viewport.width,published:true,publicPageStatus:delivered.status,localErrors:localFailures.length,jsErrors:errors.length,paymentRequests:payments.length,
      ...(slug==='diwali-deep'?{inFlightUploadBlockedPublish:true,editingLockedDuringPublish:true,uploadedPhotoIncluded:true}:{})});
    await context.close();
  }
  console.log(JSON.stringify({localOnly:true,chromiumSandboxEnabled:true,cases:reports},null,2));
} finally { await browser.close(); }
