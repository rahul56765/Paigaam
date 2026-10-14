'use strict';
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');

async function freePort() {
  const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening');
  const port = s.address().port; await new Promise(r => s.close(r)); return port;
}
async function main() {
  const port = await freePort(), base = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'royal-vivah-qa-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', b => { logs += b.toString(); });
  server.stderr.on('data', b => { logs += b.toString(); });
  const browser = await chromium.launch({ headless: true });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('server startup timed out: ' + logs)), 20000);
      const check = () => { if (logs.includes('admin →')) { clearTimeout(timeout); resolve(); } };
      server.stdout.on('data', check);
      server.on('exit', code => { clearTimeout(timeout); reject(new Error('server exited ' + code + ': ' + logs)); });
      check();
    });
    const editor = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const editorErrors = [];
    editor.on('pageerror', e => editorErrors.push(e.message));
    const editorResponse = await editor.goto(base + '/create/royal-vivah', { waitUntil: 'networkidle' });
    assert.equal(editorResponse.status(), 200);
    await editor.waitForSelector('[data-field="brideName"]');
    assert.equal(await editor.locator('[data-field="bgmSong"]').count(), 0, 'no customer music field on this invitation');
    await editor.locator('[data-field="brideName"]').fill('Ananya');
    await editor.locator('[data-field="groomName"]').fill('Kabir');
    await editor.waitForTimeout(1600);
    await editor.screenshot({ path: '/tmp/royal-vivah-editor-mobile.png', fullPage: false });
    assert.deepEqual(editorErrors, []);

    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(base + '/royal-vivah/demo', { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.waitForSelector('.rv-envelope__seal');
    assert.equal(await page.locator('.rv-scene').count(), 5);
    const imageErrors = await page.locator('.rv-art, .rv-envelope__photo, .rv-envelope__open-still').evaluateAll(els => els.filter(e => !e.complete || !e.naturalWidth).map(e => e.src));
    assert.deepEqual(imageErrors, []);
    const openVideoHead = await fetch(base + '/royal-vivah/envelope-open.mp4', { method: 'HEAD' });
    assert.equal(openVideoHead.status, 200); assert.match(openVideoHead.headers.get('content-type'), /video\/mp4/);
    assert.equal(await page.locator('.rv-save__handoff-video').count(), 0, 'Save the Date must remain static without the hand-to-hand clip');
    const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(overflow.sw <= overflow.cw + 1, `horizontal overflow ${JSON.stringify(overflow)}`);
    const canvas = await page.locator('#save-date .rv-canvas').boundingBox();
    assert.ok(canvas && Math.abs(canvas.width - 390) < 2 && Math.abs(canvas.height - 844) < 2, 'on phones the art canvas should fill the viewport edge to edge (no letterbox bands)');
    const mobileFit = await page.locator('#save-date .rv-art').evaluate(img => getComputedStyle(img).objectFit);
    assert.equal(mobileFit, 'cover', 'phone artwork should cover the viewport without distortion');
    await page.screenshot({ path: '/tmp/royal-vivah-mobile-envelope.png', fullPage: false });
    const closedState = await page.locator('.rv-envelope__open-video').evaluate(v => ({ paused: v.paused, currentTime: v.currentTime, preload: v.preload, instruction: document.querySelector('.rv-envelope__instruction')?.textContent.trim() }));
    assert.equal(closedState.paused, true, 'envelope video must not play before a seal tap');
    assert.equal(closedState.preload, 'auto', 'envelope clip should be ready before the tap');
    assert.equal(closedState.instruction, 'Tap to open');
    const tapStartedAt = Date.now();
    await page.locator('.rv-envelope__seal').click();
    await page.waitForFunction(() => { const v = document.querySelector('.rv-envelope__open-video'); return v && !v.paused && v.currentTime > 0; }, null, { timeout: 2500 });
    const startupMs = Date.now() - tapStartedAt;
    assert.ok(startupMs < 1500, `preloaded envelope video should begin promptly after tap (got ${startupMs} ms)`);
    await page.waitForFunction(() => document.querySelector('.rv-envelope__seal')?.getAttribute('aria-expanded') === 'true');
    const openingState = await page.locator('.rv-envelope__open-video').evaluate(v => ({ duration: v.duration, currentTime: v.currentTime, muted: v.muted, ended: v.ended, playbackRate: v.playbackRate }));
    assert.ok(openingState.duration > 9.9 && openingState.ended, 'the supplied 10-second envelope video should reach its luminous ending');
    assert.equal(openingState.muted, false, 'the supplied video audio should be preserved after the tap');
    assert.ok(openingState.playbackRate >= 1.5, 'the flap opening should play faster after the tap');
    await page.waitForFunction(() => document.querySelector('#save-date')?.classList.contains('is-seen'));
    await page.waitForTimeout(500);
    assert.ok(await page.evaluate(() => scrollY > 300), 'seal should reveal and scroll into the first card');
    const staticCardState = await page.evaluate(() => ({ namesOpacity: getComputedStyle(document.querySelector('.rv-save__names')).opacity, names: document.querySelector('.rv-save__names').textContent.replace(/\\s+/g,' ').trim(), date: document.querySelector('.rv-save__date').textContent.trim(), sparkle: !!document.querySelector('.rv-save__sparkle') }));
    assert.equal(staticCardState.namesOpacity, '1', 'editable couple names should show immediately on the static Save the Date');
    assert.match(staticCardState.names, /Vatsala.*weds.*Siddhant/i);
    assert.equal(staticCardState.date, '4TH DEC 2025');
    assert.equal(staticCardState.sparkle, true, 'retain one subtle animated gold sparkle');
    await page.screenshot({ path: '/tmp/royal-vivah-mobile-save-date.png', fullPage: false });
    for (const id of ['families', 'events']) {
      await page.locator('#' + id).scrollIntoViewIfNeeded();
      await page.waitForFunction(sel => document.querySelector(sel)?.classList.contains('is-seen'), '#' + id);
      await page.waitForTimeout(650);
      await page.screenshot({ path: '/tmp/royal-vivah-mobile-' + id + '.png', fullPage: false });
    }
    await page.locator('#invitation').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#invitation')?.classList.contains('is-seen'));
    await page.waitForTimeout(650);
    const map = await page.locator('.rv-final__venue').getAttribute('href');
    assert.match(map, /^https:\/\/www\.google\.com\/maps/);
    await page.screenshot({ path: '/tmp/royal-vivah-mobile-final.png', fullPage: false });
    assert.deepEqual(errors, []);
    console.log('Royal Vivah browser QA passed: mobile 390×844, 5 scenes, preloaded opener starts promptly at 1.5×, Save the Date stays static, art and Maps link load, no horizontal overflow or page errors.');

    const reducedPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await reducedPage.goto(base + '/royal-vivah/demo', { waitUntil: 'networkidle' });
    await reducedPage.locator('.rv-envelope__seal').click();
    await reducedPage.waitForFunction(() => document.querySelector('.rv-envelope__seal')?.getAttribute('aria-expanded') === 'true');
    await reducedPage.waitForFunction(() => document.querySelector('#save-date')?.classList.contains('is-seen'));
    const reducedEnvelopeState = await reducedPage.locator('.rv-envelope__open-video').evaluate(v => v.paused);
    assert.equal(reducedEnvelopeState, true, 'reduced-motion users should not play the envelope video');
    assert.equal(await reducedPage.locator('.rv-save__handoff-video').count(), 0, 'no Save-the-Date handoff video exists');
    assert.deepEqual(await reducedPage.locator('.rv-save__names').evaluate(e => getComputedStyle(e).opacity), '1');
    console.log('Reduced-motion QA passed: envelope skips its video; the static card and editable copy remain visible.');

    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await desktop.goto(base + '/royal-vivah/demo', { waitUntil: 'networkidle' });
    await desktop.screenshot({ path: '/tmp/royal-vivah-desktop-envelope.png', fullPage: false });
    console.log('Screenshots: /tmp/royal-vivah-mobile-envelope.png, /tmp/royal-vivah-mobile-final.png, /tmp/royal-vivah-desktop-envelope.png');
  } finally {
    await browser.close();
    server.kill('SIGTERM');
    await once(server, 'exit').catch(() => {});
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
