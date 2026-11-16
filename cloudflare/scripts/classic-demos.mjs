/** Build-only, read-only snapshot of the original classic sample renderer.
 * Never import this module in a Worker. VM is not a sandbox for arbitrary code:
 * every evaluated source is digest-pinned and requires re-audit on change.
 * Returned HTML still links Google Fonts; deployment MUST block external requests
 * if an isolated preview is required (see integration notes from this task).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const FILES = Object.freeze({
  'templates/registry.js': '3872757ee6f171b5abceb955140b60395bc1b749b186cbc686853fe1a1d41342',
  'lib/renderPaigaam.js': '900a9afa44b39d193197c587618d9cce68af6c34a426a92038dc0d9afb9fa72d',
  'lib/templateView.js': '5cf9bce9762ea99e631cf8ad127e3f95b5fd76436376295072a84f8f9cc74073',
  'lib/logo.js': '712c38b0a26e99951f060b37c78d22e446faa66094e35781c087000faee26321',
  'lib/brand.js': '46100d742ec0cc754ad05217826c0277c141684d02c3987b6da2fd61c0e9d87f',
  'lib/brand-assets.js': '6a79d71d9f86b2df62bebf805c23e1bfd7eb9548d4af86e5484979b6ce5c5bed',
  'public/css/paigaam.css': 'ea10654b54e5beb113a1ed428243d69905268d9b249e20c9b2f8027bcc74795d',
  'public/css/paigaam-pages.css': '488ee3ba3253b785d572b484b1ae2bf68795dce795676c5d77dda3a90dddabe0',
  'public/brand/admin-marble.svg': '3dc08a464f886607558196fce10325e7105940d653f07c2f1289312e51088a15',
});
const SLUGS = Object.freeze(['noor', 'meher', 'aashi']);
// YEAR is deliberately frozen, so the repo's YEAR+1 sample is deterministic.
export const classicSampleYear = 2026;

function readPinned(relative) {
  if (!Object.hasOwn(FILES, relative)) throw new Error('Unapproved source');
  let current = ROOT;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink rejected: ' + relative);
  }
  const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Not a regular file: ' + relative);
    const bytes = fs.readFileSync(fd);
    if (createHash('sha256').update(bytes).digest('hex') !== FILES[relative]) throw new Error('Source changed; re-audit required: ' + relative);
    return bytes;
  } finally { fs.closeSync(fd); }
}
function runModule(source, requireFn) {
  const context = vm.createContext({ module: { exports: {} }, require: requireFn }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(source).runInContext(context, { timeout: 1000 });
  return context.module.exports;
}
const unsupported = () => { throw new Error('Unapproved module import'); };

/** Only a slug is accepted; no paths, data, origin, or output options.
 * Returns {html, assets, demoPath}; assets are root-relative URL -> Buffer.
 * /template-view/:slug is the original sample route, not /:slug/demo.
 */
export function buildClassicDemo(slug) {
  if (typeof slug !== 'string' || !SLUGS.includes(slug) || arguments.length !== 1) throw new Error('Unsupported classic demo or arguments');
  const family = Object.freeze({ list: [], has: () => false, bySlug: () => null });
  const registry = runModule(readPinned('templates/registry.js').toString('utf8'), name => {
    if (name === '../lib/bfday/family') return family;
    // These other configs are unused for a classic slug; do not load them.
    if (/^\.\/([a-z0-9-]+)\/config$/.test(name)) return {};
    throw new Error('Unapproved registry import: ' + name);
  });
  const logo = runModule(readPinned('lib/logo.js').toString('utf8'), unsupported);
  const brand = runModule(readPinned('lib/brand.js').toString('utf8'), unsupported);
  const renderer = runModule(readPinned('lib/renderPaigaam.js').toString('utf8'), name => {
    if (name === '../templates/registry') return registry;
    if (name === './logo') return logo;
    if (name === './brand') return brand;
    if (name === './bfday/family') return family;
    throw new Error('Unapproved renderer import: ' + name);
  });
  const templateView = readPinned('lib/templateView.js').toString('utf8');
  const literal = templateView.match(/const SAMPLES = (\{[\s\S]*?\n\});/);
  if (!literal) throw new Error('Pinned sample not found');
  const context = vm.createContext({ YEAR: classicSampleYear }, { codeGeneration: { strings: false, wasm: false } });
  const samples = new vm.Script('(' + literal[1] + ')').runInContext(context, { timeout: 1000 });
  const tpl = registry.getTemplateConfig(slug);
  if (!tpl || tpl.slug !== slug || !samples[slug]) throw new Error('Classic template unavailable');
  const html = renderer.renderPaigaamPage(
    { slug: tpl.slug, category: tpl.category, config: tpl },
    { customer_data: samples[slug], slug: null }, { baseUrl: '', isPreview: true },
  );
  if (typeof html !== 'string' || !html.startsWith('<!DOCTYPE html>')) throw new Error('Renderer failed');
  // Extract the official packed brand bytes, never execute brand-assets.js:
  // its top-level boot code writes into the Railway source tree.
  const packedSource = readPinned('lib/brand-assets.js').toString('utf8');
  const packedLiteral = packedSource.match(/const BRAND = (\{[\s\S]*?\n\});/);
  if (!packedLiteral) throw new Error('Pinned brand pack not found');
  const pack = new vm.Script('(' + packedLiteral[1] + ')').runInNewContext(Object.create(null), { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const assets = Object.create(null);
  for (const name of ['dove.png', 'dove@2x.png', 'favicon-512.png']) {
    if (typeof pack[name] !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(pack[name])) throw new Error('Invalid packed brand asset');
    assets['/brand/' + name] = Buffer.from(pack[name], 'base64');
  }
  for (const name of ['css/paigaam.css', 'css/paigaam-pages.css', 'brand/admin-marble.svg']) assets['/' + name] = readPinned('public/' + name);
  return { html, assets, demoPath: '/template-view/' + slug };
}
