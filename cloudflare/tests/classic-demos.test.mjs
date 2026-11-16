import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildClassicDemo, classicSampleYear } from '../scripts/classic-demos.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const source = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const slugs = ['noor', 'meher', 'aashi'];
// Independently evaluate original modules with only their unrelated imports
// stubbed. Importing the real registry would load the entire family tree.
function original(sourceText, requireFn) {
  const c = vm.createContext({ module: { exports: {} }, require: requireFn });
  new vm.Script(sourceText).runInContext(c, { timeout: 1000 });
  return c.module.exports;
}
function originalFixtures() {
  const family = { list: [], has: () => false, bySlug: () => null };
  const registry = original(source('templates/registry.js'), n => {
    if (n === '../lib/bfday/family') return family;
    if (/^\.\/[a-z0-9-]+\/config$/.test(n)) return {};
    throw Error(n);
  });
  const logo = original(source('lib/logo.js'), () => { throw Error('unexpected import'); });
  const brand = original(source('lib/brand.js'), () => { throw Error('unexpected import'); });
  const render = original(source('lib/renderPaigaam.js'), n => {
    if (n === '../templates/registry') return registry;
    if (n === './logo') return logo;
    if (n === './brand') return brand;
    if (n === './bfday/family') return family;
    throw Error(n);
  });
  const literal = source('lib/templateView.js').match(/const SAMPLES = (\{[\s\S]*?\n\});/)[1];
  const samples = vm.runInNewContext('(' + literal + ')', { YEAR: 2026 });
  return { registry, render, samples };
}

test('all three use original template-view samples and byte-identical renderer HTML', () => {
  assert.equal(classicSampleYear, 2026);
  const { registry, render, samples } = originalFixtures();
  assert.equal(samples.noor.eventDate, '2027-02-14');
  assert.equal(samples.meher.eventDate, '2027-03-08');
  assert.equal(samples.aashi.eventDate, '2027-12-24');
  for (const slug of slugs) {
    const tpl = registry.getTemplateConfig(slug);
    const expected = render.renderPaigaamPage(
      { slug, category: tpl.category, config: tpl },
      { customer_data: samples[slug], slug: null }, { baseUrl: '', isPreview: true });
    const demo = buildClassicDemo(slug);
    assert.equal(demo.html, expected);
    assert.equal(demo.demoPath, '/template-view/' + slug);
    assert.match(demo.html, new RegExp(`class="pg pg--${slug}"`));
    assert.doesNotMatch(demo.html, /class="pg-veil"/);
  }
});

test('static local references are complete; font dependencies remain explicit', () => {
  const literal = source('lib/brand-assets.js').match(/const BRAND = (\{[\s\S]*?\n\});/)[1];
  const packed = vm.runInNewContext('(' + literal + ')');
  const paths = ['/brand/admin-marble.svg', '/brand/dove.png', '/brand/dove@2x.png', '/brand/favicon-512.png', '/css/paigaam-pages.css', '/css/paigaam.css'].sort();
  for (const slug of slugs) {
    const { html, assets } = buildClassicDemo(slug);
    assert.deepEqual(Object.keys(assets).sort(), paths);
    for (const name of ['dove.png', 'dove@2x.png', 'favicon-512.png']) assert.deepEqual(assets['/brand/' + name], Buffer.from(packed[name], 'base64'));
    for (const name of ['/brand/admin-marble.svg', '/css/paigaam-pages.css', '/css/paigaam.css']) assert.deepEqual(assets[name], fs.readFileSync(path.join(ROOT, 'public', name)));
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);
    refs.push(...[...html.matchAll(/\bsrcset="([^" ]+)/g)].map(m => m[1]));
    const external = [];
    for (const ref of refs) {
      if (ref.startsWith('/')) assert.ok(Object.hasOwn(assets, ref), ref);
      else external.push(ref);
    }
    assert.deepEqual(external, ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600;700&display=swap']);
    for (const css of ['/css/paigaam.css', '/css/paigaam-pages.css']) {
      for (const [, ref] of assets[css].toString().matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) assert.ok(Object.hasOwn(assets, ref), `${css}: ${ref}`);
    }
  }
});

test('fixed samples only, no payment, forms, writes, or active network code', () => {
  const script = source('cloudflare/scripts/classic-demos.mjs');
  assert.doesNotMatch(script, /(?:writeFile|mkdir|rmSync|copyFile|rename|spawn|exec|fetch)\s*\(/);
  for (const slug of slugs) {
    const { html } = buildClassicDemo(slug);
    assert.doesNotMatch(html, /<form\b|<iframe\b|<a\b|\/api\/|checkout|razorpay|payment|localStorage|sessionStorage|sendBeacon|\bfetch\s*\(|XMLHttpRequest|WebSocket|window\.open|document\.cookie/i);
    assert.throws(() => buildClassicDemo(slug, { customer_data: { message: 'Injected' }, output: '../../public' }), /Unsupported/);
  }
  for (const s of ['', '../noor', '/noor', 'noor/demo', 'NOOR', '__proto__', 'maafi', null, {}, 'aashi\0']) assert.throws(() => buildClassicDemo(s), /Unsupported/);
});

test('changed sources and symlinked source components fail closed in a temporary fixture', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'classic-demos-test-'));
  try {
    const files = ['cloudflare/scripts/classic-demos.mjs', 'templates/registry.js', 'lib/renderPaigaam.js', 'lib/templateView.js', 'lib/logo.js', 'lib/brand.js', 'lib/brand-assets.js', 'public/css/paigaam.css', 'public/css/paigaam-pages.css', 'public/brand/admin-marble.svg'];
    for (const name of files) { const dst = path.join(tmp, name); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(ROOT, name), dst); }
    const isolated = await import(pathToFileURL(path.join(tmp, files[0])).href);
    assert.ok(isolated.buildClassicDemo('noor').html);
    const target = path.join(tmp, 'public/css/paigaam-pages.css');
    fs.appendFileSync(target, '\n/* changed */');
    assert.throws(() => isolated.buildClassicDemo('noor'), /re-audit required/);
    fs.copyFileSync(path.join(ROOT, 'public/css/paigaam-pages.css'), target);
    const originalLib = path.join(tmp, 'lib');
    fs.renameSync(originalLib, path.join(tmp, 'outside-lib'));
    fs.symlinkSync(path.join(tmp, 'outside-lib'), originalLib, 'dir');
    assert.throws(() => isolated.buildClassicDemo('noor'), /Symlink rejected/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
