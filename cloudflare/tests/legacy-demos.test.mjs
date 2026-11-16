import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildLegacyDemo, legacyDemoReport } from '../scripts/legacy-demos.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

test('offline output is the original renderer and original fictional route sample', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/maafiRoutes.js'), 'utf8');
  const literal = source.match(/const DEMO = (\{[\s\S]*?\n\});/)[1];
  // Independent evaluation in this test; no route module / database imported.
  const demo = require('node:vm').runInNewContext('(' + literal + ')');
  const { renderMaafi } = require('../../templates/maafi/render.js');
  const result = buildLegacyDemo('maafi');
  assert.equal(result.html, renderMaafi({ customer_data: demo }, { baseUrl: '', isPreview: true }));
  assert.equal(result.demoPath, '/maafi/demo');
  assert.deepEqual(result.aliases, []);
  assert.deepEqual(Object.keys(result.assets).sort(), ['/brand/favicon-512.png', '/maafi/maafi.css', '/maafi/maafi.js']);
  for (const [name, bytes] of Object.entries(result.assets)) assert.deepEqual(bytes, fs.readFileSync(path.join(ROOT, 'public', name.slice(1))));
  for (const [, ref] of result.html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (ref.startsWith('/')) assert.ok(Object.hasOwn(result.assets, ref), ref);
    else assert.ok(ref.startsWith('#'), `unexpected external reference: ${ref}`);
  }
  assert.doesNotMatch(result.html, /<form\b|\/api\/|checkout|https?:\/\//i);
});

test('unsupported slugs, aliases, paths and traversal are fail-closed', () => {
  assert.deepEqual(legacyDemoReport.supported.map(x => x.slug), ['maafi']);
  for (const slug of [...Object.keys(legacyDemoReport.unsupported), '', '../maafi', '/maafi', 'maafi/demo', 'MAAFI', '__proto__', null, {}, 'maafi\0']) {
    assert.throws(() => buildLegacyDemo(slug), /Unsupported legacy demo/);
  }
});

test('build is read-only and cannot accept an output path or arbitrary data', () => {
  const script = fs.readFileSync(new URL('../scripts/legacy-demos.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /(?:writeFile|mkdir|rmSync|copyFile|rename|spawn|exec|fetch)\s*\(/);
  const before = fs.statSync(path.join(ROOT, 'public/maafi/maafi.js'));
  const first = buildLegacyDemo('maafi');
  const second = buildLegacyDemo('maafi', { output: '../../public', customer_data: { recipientName: 'Injected' } });
  assert.equal(first.html, second.html);
  assert.doesNotMatch(second.html, /Injected/);
  const after = fs.statSync(path.join(ROOT, 'public/maafi/maafi.js'));
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.size, before.size);
});

test('source symlinks and modified asset bytes fail closed, even inside an isolated fixture', async () => {
  const os = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-legacy-test-'));
  try {
    const repo = path.join(temporary, 'repo');
    const files = [
      'cloudflare/scripts/legacy-demos.mjs', 'lib/maafiRoutes.js', 'templates/maafi/render.js',
      'public/maafi/maafi.css', 'public/maafi/maafi.js', 'public/brand/favicon-512.png',
    ];
    for (const relative of files) {
      const target = path.join(repo, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(ROOT, relative), target);
    }
    const isolated = await import(pathToFileURL(path.join(repo, files[0])).href);
    assert.ok(isolated.buildLegacyDemo('maafi').html);
    const asset = path.join(repo, 'public/maafi/maafi.js');
    fs.appendFileSync(asset, '\n// changed');
    assert.throws(() => isolated.buildLegacyDemo('maafi'), /re-audit required/);
    fs.copyFileSync(path.join(ROOT, 'public/maafi/maafi.js'), asset);
    const outside = path.join(temporary, 'outside');
    fs.renameSync(path.join(repo, 'templates/maafi'), outside);
    fs.symlinkSync(outside, path.join(repo, 'templates/maafi'), 'dir');
    assert.throws(() => isolated.buildLegacyDemo('maafi'), /Symlink rejected/);
    assert.ok(fs.existsSync(path.join(outside, 'render.js')));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
