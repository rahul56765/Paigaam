#!/usr/bin/env node
/** Build-only binary restoration; this file is NEVER imported by the Worker. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { generate as generateFullCatalog } from './full-catalog.mjs';
import { buildLegacyDemo } from './legacy-demos.mjs';
import { buildClassicDemo } from './classic-demos.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = path.join(ROOT, 'cloudflare/public');
const require = createRequire(import.meta.url);
const source = p => path.join(ROOT, p);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const MAX_FILE = 25 * 1024 * 1024;
const MAX_FILES = 20000;
const slugs = require(source('templates/bfday.js'));
if (!Array.isArray(slugs) || new Set(slugs).size !== slugs.length) throw new Error('Invalid family registry');
const family = require(source('lib/bfday/family.js'));
if (family.errors.length || family.list.length !== slugs.length) throw new Error('Family contract errors: ' + JSON.stringify(family.errors));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const restored = new Map();
function safeFile(relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.startsWith('/') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe asset path: ' + relative);
  return path.join(OUT, relative);
}
function write(relative, bytes, expected, expectedBytes) {
  const file = safeFile(relative);
  if (bytes.length > MAX_FILE) throw new Error(`Asset exceeds Cloudflare 25 MiB limit (not omitted): ${relative} (${bytes.length} bytes)`);
  const digest = hash(bytes);
  if (expected && digest !== expected) throw new Error('Asset checksum mismatch: ' + relative);
  if (expectedBytes != null && bytes.length !== expectedBytes) throw new Error('Asset byte count mismatch: ' + relative);
  if (restored.has(relative) && restored.get(relative) !== digest) throw new Error('Conflicting packed asset: ' + relative);
  restored.set(relative, digest);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
function copyTree(relative) {
  const dir = source('public/' + relative);
  if (!fs.existsSync(dir)) return;
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink()) throw new Error('Static symlink rejected: ' + relative);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(dir).sort()) copyTree(relative + '/' + name);
  } else if (stat.isFile()) {
    if (/\.(?:map|b64|log|sql|sqlite|db)$/.test(relative) || /(?:^|\/)(?:\.|admin|collab)/.test(relative)) throw new Error('Private/build-only file in asset allowlist: ' + relative);
    let bytes = fs.readFileSync(dir);
    // The public base stylesheet also has dormant legacy admin selectors.
    // Its login marble is not used by any family view; do not ship admin art.
    if (relative === 'css/paigaam.css') bytes = Buffer.from(bytes.toString('utf8').replaceAll("url('/brand/admin-marble.svg')", 'none'));
    if (bytes.length > MAX_FILE) throw new Error(`Asset exceeds Cloudflare 25 MiB limit (not omitted): ${relative} (${bytes.length} bytes)`);
    const target = safeFile(relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
}
// Deliberate allowlist: no collab/admin, uploads, data, creator studio, classic
// family, magazines, or Remotion bundles/media are part of this pilot.
for (const slug of slugs) copyTree(slug);
copyTree('bfday');
for (const name of ['paigaam.css', 'builder-shell.css']) copyTree('css/' + name);
for (const name of ['shell.js', 'qr-card.js', 'paigaam-pay.js', 'resume.js']) copyTree('js/' + name);
for (const name of ['logo-full.png', 'logo-full@2x.png', 'dove.png', 'dove@2x.png', 'favicon-512.png']) copyTree('brand/' + name);
copyTree('assets/bfday-demo');

// Enumerate EVERY sibling pack, not just assets.js's current hard-coded list.
// This includes submodule-style assets-<family>-a/b/... data carriers.
const packs = fs.readdirSync(source('lib/bfday')).filter(n => /^assets(?:-.*)?\.js$/.test(n)).sort();
for (const name of packs) {
  const pack = require(source('lib/bfday/' + name));
  const entries = Array.isArray(pack) ? pack : (pack.ASSETS || pack.assets);
  if (!Array.isArray(entries)) throw new Error('Unrecognised family asset pack: ' + name);
  for (const item of entries) {
    if (!item.sha256 || !item.data) throw new Error('Incomplete asset entry in ' + name);
    write(item.path, Buffer.from(item.data, 'base64'), item.sha256);
  }
  for (const retired of pack.retiredCover || []) fs.rmSync(safeFile(retired), { force: true });
}

// The three newer packs use their own checksummed manifest formats.
for (const slug of ['little-love', 'vaidehi', 'divya-vivah']) {
  const packed = source('assets/' + slug);
  const manifest = JSON.parse(fs.readFileSync(path.join(packed, 'manifest.json'), 'utf8'));
  for (const item of Array.isArray(manifest) ? manifest : manifest.files) {
    const rel = item.file || item.path;
    const parts = item.parts || [item.packed];
    const encoded = parts.map(name => {
      if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('Unsafe packed filename');
      return fs.readFileSync(path.join(packed, name), 'utf8').trim();
    }).join('');
    const bytes = Buffer.from(encoded, 'base64');
    write(slug + '/' + rel, bytes, item.sha256, item.size ?? item.bytes);
    if (slug === 'vaidehi' && /^demo-[1-4]\.webp$/.test(rel)) write('assets/bfday-demo/vaidehi-' + rel, bytes, item.sha256);
  }
}

// Reuse the original pure-Node brand decoder/derivations, redirecting all its
// public/ reads and writes into OUT. Never mutate the Railway public tree.
const brandFile = source('lib/brand-assets.js');
const publicRoot = source('public') + path.sep;
const redirect = p => {
  const abs = path.resolve(String(p));
  if (!abs.startsWith(publicRoot)) throw new Error('Brand decoder escaped public/: ' + p);
  return path.join(OUT, path.relative(source('public'), abs));
};
const brandFS = Object.fromEntries(['existsSync', 'readFileSync', 'writeFileSync', 'mkdirSync', 'statSync'].map(method => [method, (p, ...args) => fs[method](redirect(p), ...args)]));
vm.runInNewContext(fs.readFileSync(brandFile, 'utf8'), {
  require: name => name === 'node:fs' ? brandFS : require(name),
  __dirname: path.dirname(brandFile), module: { exports: {} }, Buffer, console,
}, { filename: brandFile });
for (const name of ['logo-full.png', 'favicon-512.png', 'og-default.png']) if (!fs.existsSync(safeFile('brand/' + name))) throw new Error('Brand restoration failed: ' + name);

// Generate a minimal, statically importable ESM registry. Wrangler/esbuild
// bundles these original CommonJS modules. Do NOT import the fs-based loader,
// routes, database, studio or any encoded asset carrier in the Worker graph.
let generated = `// GENERATED by cloudflare/scripts/build.mjs. Do not edit.\nimport fieldEngine from '../../lib/bfday/fields.js';\nconst { normalizeFields, BGM_FIELD } = fieldEngine;\nexport const { InputError, resolve, makeSchema, bgmClean, isRealDate } = fieldEngine;\n`;
for (const [i, slug] of slugs.entries()) {
  generated += `import config${i} from '../../templates/${slug}/config.js';\nimport schema${i} from '../../templates/${slug}/schema.js';\nimport renderer${i} from '../../templates/${slug}/render.js';\n`;
}
generated += `\nfunction member(slug, original, schema, renderer) {\n  const config = { ...original, steps: original.steps.map(step => ({ ...step, fields: [...step.fields] })) };\n  const music = config.backgroundMusic !== false;\n  const fields = normalizeFields(music ? [...config.fields, BGM_FIELD] : config.fields, 'templates/' + slug);\n  if (music && !config.steps.some(step => step.fields.includes(BGM_FIELD.id))) config.steps[config.steps.length - 1].fields.push(BGM_FIELD.id);\n  return { slug, config, fields, schema, validate: schema.validate, render: renderer.render };\n}\nexport const templates = [\n`;
for (const [i, slug] of slugs.entries()) generated += `  member(${JSON.stringify(slug)}, config${i}, schema${i}, renderer${i}),\n`;
generated += `];\nexport const list = templates;\nconst index = new Map(templates.map(t => [t.slug, t]));\nexport const bySlug = slug => index.get(slug) || null;\nexport const getTemplate = bySlug;\nexport const has = slug => index.has(slug);\nexport const errors = [];\nexport function displayName(slug, data = {}) {\n  const t = bySlug(slug);\n  if (!t) return 'You';\n  const id = t.config.displayField || (t.fields.find(f => f.type === 'text' && f.required) || t.fields.find(f => f.type === 'text') || {}).id;\n  return id && typeof data?.[id] === 'string' && data[id].trim() || 'You';\n}\nexport default templates;\n`;
fs.writeFileSync(source('cloudflare/src/catalog.generated.mjs'), generated);
generateFullCatalog();
// Read-only, pinned legacy demo: no routes, customer data or payments are run.
const maafi = buildLegacyDemo('maafi');
for (const [url, bytes] of Object.entries(maafi.assets)) {
  // The original favicon path conflicts with the isolated preview's restored
  // brand favicon. Keep both without replacing either; only the demo points to
  // its own original bytes.
  const relative = url === '/brand/favicon-512.png' ? 'maafi/demo-favicon.png' : url.slice(1);
  const target = safeFile(relative);
  if (fs.existsSync(target)) {
    if (hash(fs.readFileSync(target)) !== hash(bytes)) throw new Error('Legacy demo asset collision: ' + relative);
  } else write(relative, bytes);
}
// A non-.html extension avoids Workers Assets' automatic extension redirects;
// the Worker explicitly supplies the correct HTML Content-Type for /maafi/demo.
write('maafi/demo.data', Buffer.from(maafi.html.replaceAll('/brand/favicon-512.png','/maafi/demo-favicon.png')));
// Classic previews use original static renderer samples; no legacy runtime DB.
for (const slug of ['noor','meher','aashi']) {
  const classic = buildClassicDemo(slug);
  for (const [url, bytes] of Object.entries(classic.assets)) {
    if (url === '/brand/admin-marble.svg') continue; // not used after dormant admin CSS removal
    const relative = url.slice(1), target = safeFile(relative);
    const expected = url === '/css/paigaam.css' ? Buffer.from(bytes.toString('utf8').replaceAll("url('/brand/admin-marble.svg')", 'none')) : bytes;
    if (fs.existsSync(target)) {
      if (hash(fs.readFileSync(target)) !== hash(expected)) throw new Error('Classic demo asset collision: ' + relative);
    } else write(relative, expected);
  }
  write('classic/' + slug + '.data', Buffer.from(classic.html));
}

// Validate all referenced local files in actual demo HTML, builder HTML and
// shipped CSS (including artwork and fonts), rather than silently shipping 404s.
const { builderPage, originalHomePage, originalGalleryPage, originalDetailPage, originalOccasionPage, originalOccasionsIndex } = await import('../src/views.mjs');
const missing = new Set();
function inspectReferences(text, from) {
  const patterns = [/\b(?:src|href|poster)=["']([^"']+)["']/g, /url\(\s*["']?([^\s)"']+)["']?\s*\)/g];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
    let ref = match[1];
    if (/^(?:https?:|data:|blob:|#|javascript:|mailto:|tel:|\/\/)/i.test(ref)) continue;
    ref = ref.split(/[?#]/)[0];
    if (!/\.(?:js|mjs|css|jpg|jpeg|png|webp|svg|gif|ico|woff2?|ttf|otf|mp3|mp4|ogg|wav|m4a)$/i.test(ref)) continue;
    const relative = ref.startsWith('/') ? ref.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));
    if (!fs.existsSync(safeFile(relative))) missing.add(`${relative} (from ${from})`);
  }
}
inspectReferences(originalHomePage(family.list), 'index');
inspectReferences(originalGalleryPage(family.list), 'templates/index');
inspectReferences(originalOccasionsIndex(family.list), 'occasions');
inspectReferences(originalOccasionPage('wedding', family.list), 'templates/wedding');
for (const t of family.list) {
  inspectReferences(t.render({ slug: t.slug + '-demo', customer_data: t.config.demo }, { isPreview: true, baseUrl: 'https://example.invalid' }), t.slug + '/demo');
  inspectReferences(builderPage(t, 'https://example.invalid'), 'create/' + t.slug);
  inspectReferences(originalDetailPage(t, { baseUrl: 'https://example.invalid' }), 'templates/' + t.slug);
  const thumbnail = t.config.thumbnail_url;
  if (thumbnail?.startsWith('/') && !fs.existsSync(safeFile(thumbnail.slice(1)))) missing.add(thumbnail + ' (catalog thumbnail)');
}
function allFiles(dir, prefix = '') {
  return fs.readdirSync(dir).sort().flatMap(name => {
    const rel = prefix + name, file = path.join(dir, name);
    return fs.statSync(file).isDirectory() ? allFiles(file, rel + '/') : [{ path: rel, bytes: fs.statSync(file).size }];
  });
}
let files = allFiles(OUT);
for (const file of files) if (file.path.endsWith('.css')) inspectReferences(fs.readFileSync(path.join(OUT, file.path), 'utf8'), file.path);
if (missing.size) throw new Error('Required static assets missing:\n' + [...missing].sort().join('\n'));
if (files.length > MAX_FILES) throw new Error(`Cloudflare free asset count exceeded: ${files.length} > ${MAX_FILES}`);
const oversized = files.filter(f => f.bytes > MAX_FILE);
if (oversized.length) throw new Error('Cloudflare per-file limit exceeded: ' + JSON.stringify(oversized));
files.sort((a, b) => b.bytes - a.bytes);
const report = { templates: slugs.length, files: files.length, totalBytes: files.reduce((n, f) => n + f.bytes, 0), maxFile: files[0], decodedAssets: restored.size, familyPacks: packs.length, fixedOpeningVideos: files.filter(f => f.path.endsWith('.mp4')), unsupported: ['classic template families', 'magazines', 'creator studio and collaboration', 'Remotion wedding video generation', 'existing Railway records and uploads (not migrated)'] };
console.log(JSON.stringify(report, null, 2));
