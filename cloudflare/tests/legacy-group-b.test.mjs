import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildLegacyGroupB, legacyGroupBReport } from '../scripts/legacy-group-b.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const cases = [
  { slug: 'saalgirah', route: 'lib/saalgirahRoutes.js', renderer: '../../templates/saalgirah/render.js', fn: 'renderLetter', demoPath: '/saalgirah/demo', aliases: [] },
  { slug: 'lavender-tic-tac-toe-bloom', route: 'lib/lavenderRoutes.js', renderer: '../../templates/lavender-bloom/render.js', fn: 'renderBloom', demoPath: '/lavender-tic-tac-toe-bloom/demo', aliases: ['/lavender-bloom/demo'] },
  { slug: 'valentine-say-yes', route: 'lib/valentineRoutes.js', renderer: '../../templates/valentine-say-yes/render.js', fn: 'renderValentine', demoPath: '/valentine-say-yes/demo', aliases: [] },
];
const digest = b => createHash('sha256').update(b).digest('hex');

for (const c of cases) test(`${c.slug}: exact original renderer and fictional route sample with closed asset pack`, () => {
  // The route modules have DB side effects and must never be loaded. Evaluate
  // only the repository's fictional literal; normal require here is safe only
  // because the renderer module itself has been reviewed and has no imports.
  const route = fs.readFileSync(path.join(root, c.route), 'utf8');
  const literal = route.match(/const DEMO = (\{[\s\S]*?\n\});/)[1];
  const demo = vm.runInNewContext('(' + literal + ')');
  const expected = require(c.renderer)[c.fn]({ customer_data: demo }, { baseUrl: '', isPreview: true });
  const result = buildLegacyGroupB(c.slug);
  assert.equal(result.html, expected);
  assert.equal(result.demoPath, c.demoPath);
  assert.deepEqual(result.aliases, c.aliases);
  assert.match(result.html, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(result.html, /<form\b|\/api\/|checkout/i);
  const refs = [...result.html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map(x => x[1]);
  for (const ref of refs) {
    if (ref.startsWith('/')) {
      assert.ok(!ref.startsWith('//') && Object.hasOwn(result.assets, ref), ref);
    } else assert.match(ref, /^https:\/\/(?:fonts\.googleapis\.com(?:\/css2\?.*)?|fonts\.gstatic\.com)$/);
  }
  for (const [url, bytes] of Object.entries(result.assets)) {
    assert.match(url, /^\/(?:brand|saalgirah|lavender-bloom|valentine-say-yes)\/[a-zA-Z0-9./-]+$/);
    assert.ok(!url.includes('..'));
    if (url.startsWith('/valentine-say-yes/media/')) {
      const name = path.basename(url);
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/valentine/manifest.json')));
      assert.equal(digest(bytes), manifest[name]);
      assert.deepEqual(bytes, Buffer.from(fs.readFileSync(path.join(root, 'assets/valentine', name + '.b64'), 'utf8').trim(), 'base64'));
    } else assert.deepEqual(bytes, fs.readFileSync(path.join(root, 'public', url.slice(1))));
  }
  if (c.slug === 'valentine-say-yes') {
    const payload = JSON.parse(result.html.match(/<script type="application\/json" id="vyPayload">([^<]+)<\/script>/)[1]);
    assert.equal(payload.images.length, 7);
    for (const img of payload.images) assert.ok(Object.hasOwn(result.assets, img));
    assert.equal(Object.keys(result.assets).length, 10);
  }
});

test('unsupported, path-like and non-string inputs fail closed; options cannot inject data', () => {
  assert.deepEqual(legacyGroupBReport.supported, cases.map(c => c.slug));
  for (const bad of ['love-awaits', '/lavender-bloom/demo', 'lavender-bloom/demo', '../saalgirah', '/saalgirah', 'SAALGIRAH', 'saalgirah\0', '', '__proto__', null, {}, ['saalgirah']]) {
    assert.throws(() => buildLegacyGroupB(bad), /Unsupported legacy demo/);
  }
  const original = buildLegacyGroupB('saalgirah');
  const withOptions = buildLegacyGroupB('saalgirah', { output: '../../public', customer_data: { recipientName: 'Injected' } });
  assert.equal(withOptions.html, original.html);
  assert.doesNotMatch(withOptions.html, /Injected/);
});

test('build performs no filesystem mutations or network access', () => {
  const restores = [];
  const fail = name => () => { throw new Error('forbidden side effect: ' + name); };
  function trap(obj, name) { const prev = obj[name]; obj[name] = fail(name); restores.push(() => { obj[name] = prev; }); }
  // The builder is imported already: these traps cover synchronous operations
  // and common node network calls used during the actual build.
  try {
    for (const n of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'rmSync', 'unlinkSync', 'copyFileSync', 'createWriteStream']) trap(fs, n);
    const originalOpen = fs.openSync;
    fs.openSync = (file, flags, ...rest) => {
      assert.equal(typeof flags, 'number');
      assert.equal(flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND), 0);
      return originalOpen(file, flags, ...rest);
    };
    restores.push(() => { fs.openSync = originalOpen; });
    for (const n of ['request', 'get']) { trap(http, n); trap(https, n); }
    const prevFetch = globalThis.fetch; globalThis.fetch = fail('fetch'); restores.push(() => { globalThis.fetch = prevFetch; });
    for (const c of cases) assert.ok(buildLegacyGroupB(c.slug).html);
  } finally { for (const restore of restores.reverse()) restore(); }
  // Pinned browser scripts are static local assets, with no persistence or
  // network APIs; this is an audit guard rather than a browser execution test.
  for (const c of cases) {
    const result = buildLegacyGroupB(c.slug);
    for (const [name, value] of Object.entries(result.assets)) if (name.endsWith('.js')) {
      assert.doesNotMatch(value.toString(), /\b(?:localStorage|sessionStorage|fetch|XMLHttpRequest|WebSocket|sendBeacon)\b|document\.cookie|window\.open/i, name);
    }
  }
});

test('pinned bytes, packed media, and path symlinks fail closed in an isolated copy', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-group-b-'));
  const repo = path.join(tmp, 'repo');
  try {
    const copy = rel => { const dst = path.join(repo, rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(path.join(root, rel), dst); };
    for (const rel of ['cloudflare/scripts/legacy-group-b.mjs', 'lib/valentineRoutes.js', 'templates/valentine-say-yes/render.js', 'public/brand/favicon-512.png', 'public/valentine-say-yes/ask.css', 'public/valentine-say-yes/ask.js', 'assets/valentine/manifest.json', ...Array.from({ length: 7 }, (_, i) => `assets/valentine/valentine-${i + 1}.gif.b64`)]) copy(rel);
    const isolated = await import(pathToFileURL(path.join(repo, 'cloudflare/scripts/legacy-group-b.mjs')).href);
    assert.ok(isolated.buildLegacyGroupB('valentine-say-yes').html);
    for (const rel of ['assets/valentine/valentine-1.gif.b64', 'assets/valentine/manifest.json', 'public/valentine-say-yes/ask.js', 'lib/valentineRoutes.js']) {
      const file = path.join(repo, rel);
      fs.appendFileSync(file, 'tampered');
      assert.throws(() => isolated.buildLegacyGroupB('valentine-say-yes'), /re-audit required/);
      copy(rel);
    }
    const dir = path.join(repo, 'templates/valentine-say-yes');
    const moved = path.join(tmp, 'moved');
    fs.renameSync(dir, moved);
    fs.symlinkSync(moved, dir, 'dir');
    assert.throws(() => isolated.buildLegacyGroupB('valentine-say-yes'), /Symlink rejected/);
    assert.ok(fs.existsSync(path.join(moved, 'render.js')));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
