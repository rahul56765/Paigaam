'use strict';
// Isolated real upload/crop/save regression. Synthetic color blocks, never people.
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kadali-photo-editor-'));
  let server, browser, log = '';
  try {
    const listener = net.createServer(); listener.listen(0, '127.0.0.1');
    await once(listener, 'listening'); const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', b => { log += b; }); server.stderr.on('data', b => { log += b; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Startup timeout: ' + log)), 30000);
      server.stdout.on('data', () => { if (log.includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(Error('Server exited: ' + code + '\n' + log)); });
    });
    browser = await chromium.launch({ args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    p.setDefaultTimeout(20000);
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    const image = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: '#9C4E2B' } }).png().toBuffer();
    const file = { name: 'synthetic-color-block.png', mimeType: 'image/png', buffer: image };
    const upload = async (selector) => {
      await p.locator(selector).setInputFiles(file);
      await p.locator('#cropOk').waitFor();
      await p.waitForFunction(() => document.querySelector('#cropImg')?.naturalWidth > 0 || document.querySelector('.crop-box img')?.naturalWidth > 0);
      const response = p.waitForResponse(r => r.url().includes('/upload?') && r.request().method() === 'POST');
      await p.locator('#cropOk').click();
      const r = await response; assert.equal(r.status(), 200); return (await r.json()).url;
    };
    const saved = () => p.waitForFunction(() => new URL(location.href).searchParams.has('id') && document.querySelector('#saveState')?.textContent.trim() === 'Saved');
    await p.goto(base + '/create/kadali-vivah', { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: 'Upload couple portrait', exact: true }).waitFor();
    assert.equal(await p.locator('#cpInput').count(), 1);
    assert.equal(await p.locator('#cpDel').count(), 0);
    // Keyboard access invokes the native picker (without depending on label semantics).
    const picker = p.waitForEvent('filechooser');
    await p.locator('[data-photo-input="cpInput"]').focus(); await p.keyboard.press('Enter');
    await (await picker).setFiles([]);
    const portrait = await upload('#cpInput');
    await p.getByRole('button', { name: 'Replace couple portrait', exact: true }).waitFor();
    assert.equal(await p.locator('img[alt="Your main couple portrait"]').getAttribute('src'), portrait);
    await saved(); await p.reload({ waitUntil: 'domcontentloaded' }); await p.locator('#cpInput').waitFor({ state: 'attached' });
    assert.equal(await p.locator('img[alt="Your main couple portrait"]').getAttribute('src'), portrait);
    const replacedPortrait = await upload('#cpInput');
    await p.waitForFunction(url => document.querySelector('img[alt="Your main couple portrait"]')?.getAttribute('src') === url, replacedPortrait);
    await p.locator('#kadaliGallery').click();
    await p.getByRole('heading', { name: '3D portraits & photo gallery', exact: true }).waitFor();
    assert.equal(await p.locator('#cpInput').count(), 1);
    const galleryPhoto = await upload('#phInput');
    await p.locator('[data-ph="0"] img').waitFor();
    assert.equal(await p.locator('[data-ph="0"] img').getAttribute('src'), galleryPhoto);
    // Replacement goes through the very same crop and secure upload path.
    const replacePicker = p.waitForEvent('filechooser');
    await p.getByRole('button', { name: 'Replace photo 1', exact: true }).click();
    await (await replacePicker).setFiles([]);
    const replacement = await upload('#phReplaceInput');
    await p.waitForFunction(url => document.querySelector('[data-ph="0"] img')?.getAttribute('src') === url, replacement);
    await saved(); await p.reload({ waitUntil: 'domcontentloaded' }); await p.locator('#cpInput').waitFor({ state: 'attached' });
    assert.equal(await p.locator('[data-ph="0"] img').getAttribute('src'), replacement);
    await p.getByRole('button', { name: 'Remove photo 1', exact: true }).click();
    assert.equal(await p.locator('[data-ph]').count(), 0);
    await p.locator('#cpDel').click();
    assert.equal(await p.locator('#cpDel').count(), 0);
    await saved(); await p.reload({ waitUntil: 'domcontentloaded' }); await p.locator('#cpInput').waitFor({ state: 'attached' });
    assert.equal(await p.locator('#cpDel').count(), 0);
    assert.equal(await p.locator('[data-ph]').count(), 0);
    for (const slug of ['shaadi-paigaam', 'suvarna-vivah']) {
      await p.goto(base + '/create/' + slug, { waitUntil: 'domcontentloaded' });
      await p.locator('[data-path="couple.groom.first"]').waitFor();
      assert.equal(await p.locator('#cpInput').count(), 0);
      assert.equal(await p.locator('#kadaliGallery').count(), 0);
      await p.locator('#stepNav button').nth(3).click();
      await p.getByRole('heading', { name: 'Couple photo', exact: true }).waitFor();
      assert.equal(await p.locator('#cpInput').count(), 1);
      assert.equal(await p.locator('[data-photo-input]').count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Kadali step-1 portrait keyboard access; real portrait/gallery upload, crop, replace, save, reload, remove; unique IDs; unchanged Shaadi/Suvarna UI; no browser exceptions.');
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
