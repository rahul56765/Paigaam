'use strict';
// Run: node scripts/test-kadali-browser.js
// Chromium supplied by Playwright; owns a disposable port + DATA_DIR, never touches 3210.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { chromium } = require('playwright');
const C = require('../public/shaadi-paigaam/core');
const I = require('../public/shaadi-paigaam/i18n');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-output/kadali/browser');
fs.mkdirSync(out, { recursive: true });
const results = [], diagnostics = [], media = [];
let passed = 0, browser, server, serverLog = '', base;
const check = (condition, message) => { assert.ok(condition, message); passed++; console.log('  PASS', message); };
async function freePort() { const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening'); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function test(name, fn) {
  console.log('\nTEST', name); const before = passed;
  try { await fn(); results.push({ name, status: 'passed', assertions: passed - before }); }
  catch (e) { console.error('  FAIL', e.stack); results.push({ name, status: 'failed', assertions: passed - before, error: e.stack }); }
}
async function pageFor(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('console', m => { if (m.type() === 'error') diagnostics.push({ kind: 'console', page: page.url(), message: m.text() }); });
  page.on('pageerror', e => diagnostics.push({ kind: 'pageerror', page: page.url(), message: e.message }));
  page.on('requestfailed', r => diagnostics.push({ kind: 'requestfailed', url: r.url(), message: r.failure()?.errorText }));
  page.on('request', r => { if (r.resourceType() === 'media' || /\.(mp3|mp4|m4a|ogg|wav)(\?|$)/i.test(r.url())) media.push({ page: page.url(), url: r.url() }); });
  return page;
}
async function goto(page, suffix = '/kadali-vivah/demo') { const response = await page.goto(base + suffix, { waitUntil: 'domcontentloaded' }); check(response.status() === 200, suffix + ' HTTP 200'); await page.locator('#heroText .name').first().waitFor({ state: 'attached' }); }
async function removed(page) {
  await page.waitForFunction(() => !document.querySelector('#intro'));
  check(await page.evaluate(() => !document.body.classList.contains('locked') && !document.documentElement.classList.contains('intro-on') && !document.querySelector('#page[inert], .fab-wrap[inert]') && getComputedStyle(document.body).overflowY !== 'hidden'), 'intro removed, document scroll unlocked, page/FAB inert removed');
}
async function imagesReady(page) {
  // Scroll through actual reveal targets: do not force classes on the screenshot path.
  const targets = page.locator('.reveal');
  for (let n = 0; n < await targets.count(); n++) {
    const target = targets.nth(n); await target.scrollIntoViewIfNeeded();
    await target.evaluate(el => new Promise((resolve, reject) => {
      const until = performance.now() + 5000;
      const poll = () => { if (el.classList.contains('in')) resolve(); else if (performance.now() > until) reject(new Error('Reveal did not enter viewport: ' + el.id)); else requestAnimationFrame(poll); }; poll();
    }));
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Offscreen carousel slides are legitimately lazy. Request them before decoding for QA.
    [...document.images].forEach(img => { img.loading = 'eager'; });
    await Promise.all([...document.images].map(img => Promise.race([img.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 8000))])));
  });
  const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(x => !x.complete || !x.naturalWidth).map(x => x.src));
  check(!broken.length, 'all invitation images decoded: ' + JSON.stringify(broken));
  await page.waitForFunction(() => [...document.querySelectorAll('.reveal')].every(el => Number(getComputedStyle(el).opacity) > .99));
}
async function snapshot(page, name) { await removed(page); await imagesReady(page); await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 0); }); await page.waitForFunction(() => scrollY === 0); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); }
async function fits(page) {
  const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, names: [...document.querySelectorAll('#heroText .name')].map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, width: r.width, height: r.height, left: r.left, right: r.right, contentWidth: el.scrollWidth, client: el.clientWidth }; }), controls: [...document.querySelectorAll('.kv-nav a,.kv-nav button')].map(el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, height:r.height }; }) }));
  check(layout.scroll <= layout.width + 1, 'no document horizontal overflow at ' + layout.width);
  check(layout.names.length === 2 && layout.names.every(n => n.height > 0 && n.width > 0 && n.left >= -1 && n.right <= layout.width + 1 && n.contentWidth <= n.client + 2), 'both names visible and contained without clipping at ' + layout.width);
  check(layout.controls.every(c => c.left >= -1 && c.right <= layout.width + 1 && c.height > 0), 'navigation controls remain within viewport at ' + layout.width);
}
async function harness(page, guest, data) {
  await page.route('**/__kadali_qa_harness', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}iframe{border:0;width:100%;height:100vh;display:block}</style><script>window.readyCount=0;window.payload=${JSON.stringify(data).replace(/</g, '\\u003c')};addEventListener('message',e=>{if(e.origin===location.origin&&e.data.type==='sp:ready'){readyCount++;e.source.postMessage({type:'sp:data',data:payload},location.origin)}})</script><iframe id="qa" src="/kadali-vivah/frame${guest ? '?guest=1' : ''}"></iframe>` }));
  await page.goto(base + '/__kadali_qa_harness', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.readyCount === 1);
  const frame = page.frames().find(f => f.url().includes('/kadali-vivah/frame'));
  await frame.waitForFunction(name => document.querySelector('#heroText')?.textContent.includes(name), data.couple.groom.first);
  return frame;
}
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kadali-browser-'));
  const port = await freePort(); base = 'http://127.0.0.1:' + port;
  try {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dataDir, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('server startup timeout\n' + serverLog)), 30000);
      const poll = () => { if (serverLog.includes('admin →')) { clearTimeout(timeout); resolve(); } };
      server.stdout.on('data', poll); server.once('exit', code => { clearTimeout(timeout); reject(new Error('server exited ' + code + '\n' + serverLog)); }); poll();
    });
    console.log('Disposable server:', base, 'DATA_DIR:', dataDir);
    browser = await chromium.launch({ headless: true });
    for (const trigger of ['button', 'leaf']) await test('opening sequence via ' + trigger, async () => {
      const p = await pageFor(); try {
        await goto(p); check(await p.locator('#page').getAttribute('inert') !== null, 'invitation inert before opening');
        await p.evaluate(() => { window.stages = []; const el = document.querySelector('#intro'); new MutationObserver(records => { for (const r of records) for (const name of ['untie','unfold','blessing','petal-reveal']) if (el.classList.contains(name) && !window.stages.includes(name)) window.stages.push(name); }).observe(el, { attributes:true, attributeFilter:['class'] }); });
        const before = media.length; await p.locator(trigger === 'leaf' ? '#leafParcel' : '#openBtn').click();
        await removed(p); const stages = await p.evaluate(() => window.stages);
        check(JSON.stringify(stages) === JSON.stringify(['untie','unfold','blessing','petal-reveal']), 'observed chronological opening classes: ' + stages.join(' → '));
        check(media.length === before, 'opening does not request audio/video');
        await p.evaluate(() => { document.documentElement.style.scrollBehavior='auto'; scrollTo(0, 300); }); await p.waitForFunction(() => scrollY > 0); check(true, 'actual scrolling works after opening');
        if (trigger === 'button') await snapshot(p, 'opened-390');
      } finally { await p.context().close(); }
    });
    await test('keyboard focus trap, Enter, Escape, skip and replay', async () => {
      const p = await pageFor(); try {
        await goto(p); check(await p.locator('#openBtn').evaluate(el => el === document.activeElement), 'initial focus on accessible opening button');
        await p.keyboard.press('Shift+Tab'); check(await p.locator('#skipBtn').evaluate(el => el === document.activeElement), 'Shift+Tab stays in opening dialog');
        await p.keyboard.press('Tab'); check(await p.locator('#openBtn').evaluate(el => el === document.activeElement), 'Tab wraps to open button');
        await p.keyboard.press('Enter'); await p.waitForFunction(() => document.querySelector('#intro').classList.contains('untie')); await p.keyboard.press('Escape'); await removed(p);
        await p.locator('#replayBtn').click(); check(await p.locator('#page').getAttribute('inert') !== null, 'replay restores inert invitation');
        check(await p.locator('#openBtn').isEnabled(), 'replay resets disabled opening button');
        await p.locator('#skipBtn').focus(); await p.keyboard.press('Enter'); await removed(p);
        await p.locator('#replayBtn').click(); await p.locator('#openBtn').press('Space'); await p.waitForFunction(() => document.querySelector('#intro').classList.contains('untie')); await p.keyboard.press('Escape'); await removed(p);
      } finally { await p.context().close(); }
    });
    await test('reduced motion opens promptly without staged animation', async () => {
      const p = await pageFor({ reducedMotion:'reduce' }); try { await goto(p); const start=Date.now(); await p.locator('#openBtn').click(); await removed(p); check(Date.now()-start < 1500, 'reduced motion does not wait 4.8-second ceremony'); await snapshot(p, 'reduced-motion'); } finally { await p.context().close(); }
    });
    for (const width of [320,390,768,1440]) await test('responsive ' + width, async () => {
      const p = await pageFor({ viewport: { width, height: width < 768 ? 844 : 1000 } }); try {
        await goto(p); const opening = await p.locator('#openBtn').boundingBox(); check(opening.x >= 0 && opening.x+opening.width <= width && opening.height >= 40, 'opening button usable at ' + width);
        await p.locator('#skipBtn').click(); await removed(p); await fits(p); await snapshot(p, 'responsive-' + width);
      } finally { await p.context().close(); }
    });
    await test('same-origin guest frame ready handshake receives personalized names', async () => {
      const p = await pageFor(); try {
        const data=structuredClone(C.SAMPLE); data.couple.groom.first='Pranav'; data.couple.bride.first='Ishani'; const f=await harness(p,true,data);
        check(await p.evaluate(() => readyCount) === 1, 'guest iframe emits sp:ready once');
        check((await f.locator('#openingNames').textContent()).includes('Pranav') && (await f.locator('#openingNames').textContent()).includes('Ishani'), 'opening caption uses handshake personalization, not sample');
        await f.locator('#skipBtn').click(); await f.waitForFunction(() => !document.querySelector('#intro'));
        check((await f.locator('#heroText').textContent()).includes('Ishani'), 'guest hero receives personalized bride');
      } finally { await p.context().close(); }
    });
    await test('default live frame has no opening; long names and all enabled non-English languages', async () => {
      const p = await pageFor({viewport:{width:320,height:844}}); try {
        const data=structuredClone(C.SAMPLE); data.couple.groom.first='Chandrasekharavenkatasubramanian'; data.couple.bride.first='Lakshmipriyadarshinivenkataramani'; data.i18n={}; data.lang.enabled=Object.keys(I.LANGS);
        const f=await harness(p,false,data); check(await f.locator('#intro').count() === 0, 'live frame starts without opening');
        check(await f.locator('#page').getAttribute('inert') === null, 'live frame interactive immediately');
        for (const lang of data.lang.enabled) {
          await f.evaluate(lang => window.SPInvite.setLang(lang),lang);
          await f.waitForFunction(lang => document.documentElement.lang === lang,lang);
          await f.evaluate(() => document.fonts.ready);
          check(await f.locator('#heroText .name').count() === 2 && (await f.locator('#heroText').textContent()).includes(data.couple.groom.first) && (await f.locator('#heroText').textContent()).includes(data.couple.bride.first), lang + ' renders both long names (no sample-translation substitution)');
          check(await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1 && [...document.querySelectorAll('#heroText .name')].every(el => el.scrollWidth <= el.clientWidth+2)), lang + ' long names contained at 320px');
          check(await f.locator('html').getAttribute('dir') === I.LANGS[lang].dir, lang + ' has correct text direction');
          if (lang === 'hi' || lang === 'ur') await p.screenshot({ path:path.join(out,'long-names-'+lang+'-320.png'), fullPage:false });
        }
      } finally { await p.context().close(); }
    });
    await test('real shared editor first-step live update, server save, reload and guest preview', async () => {
      const p = await pageFor({viewport:{width:1440,height:1000}}); try {
        const r=await p.goto(base+'/create/kadali-vivah',{waitUntil:'domcontentloaded'}); check(r.status()===200,'shared editor loads');
        const g=p.locator('[data-path="couple.groom.first"]'), b=p.locator('[data-path="couple.bride.first"]'); await g.waitFor(); await g.fill('Devansh'); await b.fill('Meera');
        const f=p.frameLocator('#pv'); await f.locator('#heroText').filter({hasText:'Devansh'}).waitFor(); await f.locator('#heroText').filter({hasText:'Meera'}).waitFor(); check(true,'typing both first-step names updates actual live iframe');
        await p.waitForFunction(() => new URL(location.href).searchParams.has('id') && document.querySelector('#saveState')?.textContent.trim()==='Saved');
        const id=new URL(p.url()).searchParams.get('id'); const saved=await p.request.get(base+'/api/kadali-vivah/me?id='+id); const j=await saved.json(); check(j.data.couple.groom.first==='Devansh'&&j.data.couple.bride.first==='Meera','server stores edited names');
        await p.reload({waitUntil:'domcontentloaded'}); await g.waitFor(); check(await g.inputValue()==='Devansh'&&await b.inputValue()==='Meera','reload restores names');
        await p.locator('#guestBtn').click(); const guest=p.frameLocator('#gpFrame'); await guest.locator('#openingNames').filter({hasText:'Devansh'}).waitFor(); check((await guest.locator('#openingNames').textContent()).includes('Meera'),'real guest modal opening is personalized via ready handshake');
        await guest.locator('#skipBtn').click(); await guest.locator('#intro').waitFor({state:'detached'}); check((await guest.locator('#heroText').textContent()).includes('Meera'),'real guest modal hero shows saved names');
        await p.screenshot({path:path.join(out,'editor-guest-personalized.png'),fullPage:false});
      } finally { await p.context().close(); }
    });
    await test('lazy audio makes no media request until explicit music click', async () => {
      const p=await pageFor(); try { const before=media.length; await goto(p); await p.locator('#skipBtn').click(); await removed(p); await imagesReady(p); check(media.length===before,'zero audio/video requests during initial load, skip, images and scrolling');
        const request=p.waitForRequest(r=>r.resourceType()==='media'||/\.mp3/.test(r.url())); await p.locator('#musicBtn').click(); const r=await request; check(/shehnai-dawn\.mp3/.test(r.url()),'explicit music click requests selected audio');
      } finally { await p.context().close(); }
    });
    await test('no JavaScript or console errors', async () => {
      const errors=diagnostics.filter(d=>d.kind==='console'||d.kind==='pageerror'); check(!errors.length,'no browser console errors or uncaught exceptions: '+JSON.stringify(errors));
    });
  } catch(e) { results.push({name:'infrastructure',status:'failed',error:e.stack}); console.error(e.stack); }
  finally {
    if(browser) await browser.close();
    if(server && server.exitCode===null) { server.kill('SIGTERM'); await once(server,'exit'); }
    fs.writeFileSync(path.join(out,'server.log'),serverLog);
    const summary={base, dataDir, assertionsPassed:passed, testsPassed:results.filter(r=>r.status==='passed').length, testsFailed:results.filter(r=>r.status==='failed').length, results,diagnostics,media};
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(summary,null,2));
    fs.writeFileSync(path.join(out,'summary.log'),results.map(r=>`${r.status.toUpperCase()} ${r.name} (${r.assertions||0} assertions)${r.error?'\n'+r.error:''}`).join('\n')+`\n${passed} assertions passed\n`);
    fs.rmSync(dataDir,{recursive:true,force:true}); console.log('\nSUMMARY',summary.testsPassed,'tests passed;',summary.testsFailed,'failed;',passed,'assertions passed. Logs:',out); if(summary.testsFailed) process.exitCode=1;
  }
})();
