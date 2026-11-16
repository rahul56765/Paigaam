import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {letters} from '../src/legacy-letters.mjs';
const base=process.argv[2]||'http://127.0.0.1:8899',url=new URL(base);
if(url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/'||url.username||url.password)throw Error('Local HTTP only');
const browser=await chromium.launch({headless:true});
let checked=0;
try{
 for(const t of letters){
  const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'CF-Connecting-IP':'198.51.100.223'}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/create/'+t.slug);
  const name=page.locator('#recipientName'),sender=page.locator('#senderName'),publish=page.locator('#publish');
  for(let n=0;n<12;n++){
    if(await name.isVisible())await name.fill('Ananya');
    if(await sender.count()&&await sender.isVisible())await sender.fill('Rahul');
    if(await publish.isVisible())break;
    await page.locator('#next').click();await page.waitForTimeout(50);
  }
  assert.ok(await publish.isVisible(),t.slug+': send step reachable');
  let prematurePublishes=0;
  const track=req=>{if(new URL(req.url()).pathname==='/api/'+t.route+'/publish')prematurePublishes++;};
  page.on('request',track);
  await page.route('**/api/'+t.route+'/draft',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"temporary_unavailable"}'}));
  await publish.click();
  await page.waitForFunction(()=>!document.getElementById('publish').disabled);
  assert.equal(prematurePublishes,0,t.slug+': never publish after a failed save');
  assert.equal(await name.isDisabled(),false,t.slug+': save failure releases controls');
  page.off('request',track);await page.unroute('**/api/'+t.route+'/draft');
  let entered,release;
  const seen=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/'+t.route+'/publish',async route=>{entered();await gate;await route.continue();});
  await publish.click();
  await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error(t.slug+': publish not reached')),5000))]);
  assert.ok(await name.isDisabled(),t.slug+': controls frozen during send');
  release();
  await page.waitForSelector('#publishedResult:not([hidden])',{timeout:10000});
  const result=await page.locator('#publishedUrl').inputValue();
  assert.ok(result.startsWith(base+'/p/'),t.slug+': public link shown');
  const reader=await context.newPage();await reader.goto(result);
  assert.ok((await reader.content()).includes('Ananya'));
  assert.deepEqual(errors,[],t.slug+': no editor JavaScript errors');
  await context.close();checked++;
 }
 console.log(JSON.stringify({localOnly:true,mobileOriginalEditorsPublished:checked,inputFreezeVerified:true,externalBrowserRequestsBlocked:true}));
}finally{await browser.close();}
