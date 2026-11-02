'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {render} = require('../templates/shubh-sangam/render');
const config = require('../templates/shubh-sangam/config');
const root = path.join(__dirname, '..');
const html = render({customer_data:config.demo});

test('seal is a named, keyboard-native button and has only a small TAP label', () => {
  const cover = html.match(/<section class="ss-cover"[\s\S]*?<\/section>/)[0];
  assert.match(cover, /<button type="button" class="ss-seal" data-open aria-label="Open invitation" aria-controls="invitation" aria-expanded="false">/);
  assert.match(cover, /class="ss-seal__label" aria-hidden="true">TAP<\/span>/);
  assert.doesNotMatch(cover, /Tap the seal to open/i);
  assert.match(cover, /href="#invitation"/);
  assert.match(html, /id="invitation" tabindex="-1"/);
});

// Real Chrome exercises touch hit testing, native keyboard activation and the
// independent scroll containers in a mobile iframe. Set CHROME_PATH if needed.
const chrome = [process.env.CHROME_PATH, '/home/vercel-sandbox/.cache/puppeteer/chrome/linux-156.0.8078.80/chrome-linux64/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && fs.existsSync(p));
test('mobile seal touch, embedded scrolling, keyboard and reduced motion', {skip:!chrome, timeout:45000}, async () => {
  const server = http.createServer((req,res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/host') {
      res.setHeader('Content-Type','text/html');
      return res.end('<!doctype html><style>body{margin:0} iframe{display:block;width:350px;height:550px;border:0;margin-top:1100px} .after{height:1600px}</style><iframe src="/invitation" title="preview"></iframe><div class="after"></div>');
    }
    if (url.pathname === '/invitation') { res.setHeader('Content-Type','text/html'); return res.end(html); }
    if (url.pathname.startsWith('/shubh-sangam/')) {
      const file = path.join(root, 'public', url.pathname);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.setHeader('Content-Type', file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'image/webp');
        return fs.createReadStream(file).pipe(res);
      }
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'ss-chrome-'));
  const browser = spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--remote-debugging-port=0',`--user-data-dir=${dir}`,'about:blank'],{stdio:'ignore'});
  let ws;
  try {
    let port;
    for (let i=0;i<100;i++) {
      try { port=fs.readFileSync(path.join(dir,'DevToolsActivePort'),'utf8').split('\n')[0]; break; } catch { await new Promise(r=>setTimeout(r,50)); }
    }
    assert.ok(port,'Chrome DevTools started');
    const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    let id=0; const pending=new Map();
    ws.onmessage=event=>{const msg=JSON.parse(event.data);if(!msg.id)return;const p=pending.get(msg.id);if(!p)return;pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
    const evaljs=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    const navigate=async url=>{await send('Page.navigate',{url}); for(let i=0;i<100;i++){await wait(40);if(await evaljs(`document.readyState === 'complete' && ${url.endsWith('/host')?"!!document.querySelector('iframe')?.contentDocument?.querySelector('[data-open]')":"!!document.querySelector('[data-open]')"}`))return;}throw Error('page not loaded');};
    const point=embedded=>evaljs(`(()=>{const f=${embedded?"document.querySelector('iframe')":"null"};const d=f?f.contentDocument:document;const b=d.querySelector('[data-open]'),r=b.getBoundingClientRect(),fr=f?f.getBoundingClientRect():{left:0,top:0};return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2,hit:d.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===b};})()`);
    const tap=async p=>{await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
    const state=embedded=>evaljs(`(()=>{const w=${embedded?"document.querySelector('iframe').contentWindow":"window"},d=w.document,t=d.querySelector('#invitation');return {opened:d.querySelector('[data-envelope]').classList.contains('is-open'), expanded:d.querySelector('[data-open]').getAttribute('aria-expanded'), focused:d.activeElement===t, top:t.getBoundingClientRect().top,scroll:w.scrollY,outer:window.scrollY};})()`);
    for (const embedded of [false,true]) {
      await navigate(base+(embedded?'/host':'/invitation'));
      if(embedded) await evaljs('window.scrollTo(0,1000)');
      const before=await state(embedded), p=await point(embedded);
      assert.equal(p.hit,true,`seal hit target in ${embedded?'iframe':'page'}`);
      await tap(p); await wait(1800);
      const after=await state(embedded);
      assert.equal(after.opened,true); assert.equal(after.expanded,'true'); assert.equal(after.focused,true);
      assert.ok(after.scroll>0 && Math.abs(after.top)<4,JSON.stringify(after));
      if(embedded) assert.equal(after.outer,before.outer,'opening must not scroll host page');
    }
    await navigate(base+'/host');
    await evaljs('window.scrollTo(0,1000)');
    const hostBefore=await state(true);
    const skipPoint=await evaljs(`(()=>{const f=document.querySelector('iframe'),r=f.contentDocument.querySelector('.ss-cover__skip').getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2};})()`);
    await tap(skipPoint); await wait(1800);
    const skipped=await state(true);
    assert.equal(skipped.focused,true); assert.ok(skipped.scroll>0 && Math.abs(skipped.top)<4);
    assert.equal(skipped.outer,hostBefore.outer,'skip must not scroll host page');
    for (const key of ['Enter',' ']) {
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await navigate(base+'/invitation');
      assert.equal(await evaljs("getComputedStyle(document.documentElement).scrollBehavior"),'auto');
      assert.equal(await evaljs("getComputedStyle(document.querySelector('.ss-envelope__flap')).transitionDuration"),'0s');
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
      assert.equal(await evaljs("document.activeElement === document.querySelector('[data-open]')"),true,'seal is reachable with Tab');
      const code=key===' '?'Space':'Enter', keyCode=key===' '?32:13;
      await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,text:key==='Enter'?'\r':' ',unmodifiedText:key==='Enter'?'\r':' ',windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
      await wait(100);
      const after=await state(false);
      assert.equal(after.opened,true,`${code} activates`);assert.equal(after.focused,true);
      assert.equal(await evaljs("document.querySelector('[data-open]').tabIndex"),-1,'hidden seal is removed from tab order');
      assert.ok(after.scroll>0 && Math.abs(after.top)<4,`reduced motion scrolls immediately: ${JSON.stringify(after)}`);
    }
    // Without JavaScript the real anchor is still available as an escape hatch.
    await send('Emulation.setScriptExecutionDisabled',{value:true});
    await navigate(base+'/invitation');
    assert.equal(await evaljs("getComputedStyle(document.querySelector('[data-open]')).display"),'none');
    assert.equal(await evaljs("getComputedStyle(document.querySelector('.ss-cover__skip')).display !== 'none'"),true);
  } finally {
    if(ws) ws.close();
    browser.kill('SIGKILL');
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
