#!/usr/bin/env node
// Build-only source snapshot. This module is never imported by the Worker.
// Source order is the fresh server.js seed iteration order, NOT historical DB order
// or admin-edited metadata. Prices are source/default INR rupees, not D1 paise.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const legacySlugs = [
  'sawaal', 'sau-wajah', 'love-awaits', 'maafi', 'love-album', 'valentine-say-yes',
  'lavender-tic-tac-toe-bloom', 'ganpati-courtyard', 'saalgirah', 'shaadi-paigaam',
  'suvarna-vivah', 'birthday-paigaam', 'ganapati-aagman', 'noor', 'meher', 'aashi', 'apology',
];
const schemaKeys = new Set(['id','label','type','required','placeholder','group','options','maxLength','hint','default','itemLabel','addLabel','minItems','maxItems','item','rows','shape','alt','min','max','preserveTransparency','tapToPick','slider','unit','editor']);
const unsafeKey = /^(?:__proto__|prototype|constructor|assets?|customer[_-]?data|authorization|(?:[a-z0-9]+[_-]?)*(?:password|passwd|secret|api[_-]?key|token|private[_-]?key|credential|credentials))$/i;
const unsafeId = /^(?:__proto__|prototype|constructor|assets?|customer[_-]?data)$/i;
const badValue = /^(?:data:[^,]*;base64,|[a-z0-9+/]{256,}={0,2}$)/i;
const OMIT = Symbol('omit');

// The allowlisted template metadata and form definitions come only from the
// repository's built-in configs, never from a DB or request. Recursively drop
// executable values, encoded assets and dangerous data-bearing keys. No demo,
// create, arbitrary top-level config, or asset pack is copied into the snapshot.
export function clean(value, seen = new Set()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return OMIT;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : OMIT;
  if (typeof value === 'string') return badValue.test(value) ? OMIT : value;
  if (typeof value !== 'object' || seen.has(value)) return OMIT;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return OMIT;
  seen.add(value);
  let out;
  if (Array.isArray(value)) {
    out = [];
    for (const v of value) { const c = clean(v, seen); if (c !== OMIT) out.push(c); }
  } else {
    out = Object.create(null);
    for (const [key, v] of Object.entries(value)) {
      if (unsafeKey.test(key)) continue;
      const c = clean(v, seen);
      if (c !== OMIT) Object.defineProperty(out, key, { value: c, enumerable: true, writable: true, configurable: true });
    }
  }
  seen.delete(value);
  return out;
}
function fieldSchema(field, requireId = true) {
  if (!field || typeof field !== 'object' || Array.isArray(field) || (requireId && typeof field.id !== 'string') || (field.id !== undefined && (typeof field.id !== 'string' || unsafeId.test(field.id)))) return null;
  const out = Object.create(null);
  for (const [k, v] of Object.entries(field)) {
    // A password may be a legitimate *field definition*, but never snapshot
    // an actual default value for a sensitive-named field.
    if (!schemaKeys.has(k) || (k === 'default' && unsafeKey.test(field.id || ''))) continue;
    if (k === 'shape') { if (Array.isArray(v)) out[k] = v.map(fieldSchema).filter(Boolean); continue; }
    if (k === 'item') { const item = fieldSchema(v, false); if (item) out[k] = item; continue; }
    const c = clean(v); if (c !== OMIT) out[k] = c;
  }
  return out;
}
function localPath(value, field) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\?#\x00-\x1f]/.test(value) || value.split('/').some(p => p === '.' || p === '..')) throw new Error(`Unsafe ${field}: ${value}`);
  return value;
}
function checked(value, label) {
  const result = clean(value);
  if (result === OMIT) throw new Error(`Unsafe or missing ${label}`);
  return result;
}
export function makeMetadata(source, familySlugs) {
  if (!Array.isArray(source) || !Array.isArray(familySlugs)) throw new Error('Expected arrays');
  const slugs = source.map(t => t.slug);
  if (source.length !== 50 || new Set(slugs).size !== 50 || slugs.some(s => typeof s !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) throw new Error('Invalid source registry: expected 50 unique slugs');
  if (familySlugs.length !== 33 || new Set(familySlugs).size !== 33 || familySlugs.some(s => !slugs.includes(s))) throw new Error('Invalid 33-member shared family');
  const familySet = new Set(familySlugs);
  const legacy = slugs.filter(s => !familySet.has(s));
  if (JSON.stringify(legacy) !== JSON.stringify(legacySlugs) || JSON.stringify(slugs.filter(s => familySet.has(s))) !== JSON.stringify(familySlugs)) throw new Error('Unexpected legacy members or source family order');
  return source.map((t, sourceRank) => {
    for (const key of ['name', 'category', 'description', 'currency']) if (typeof t[key] !== 'string') throw new Error(`Missing ${key} for ${t.slug}`);
    for (const key of ['price', 'list_price']) if (t[key] != null && (!Number.isInteger(t[key]) || t[key] < 0)) throw new Error(`Invalid ${key} for ${t.slug}`);
    if (!Array.isArray(t.fields) || !Array.isArray(t.sections) || !t.theme || typeof t.theme !== 'object') throw new Error(`Missing config for ${t.slug}`);
    const config = {
      name: checked(t.name, 'name'),
      fields: t.fields.map(fieldSchema).filter(Boolean),
      sections: checked(t.sections, 'sections'),
      theme: checked(t.theme, 'theme'),
      custom: !!t.custom,
      editable: t.editable !== false,
    };
    if (t.appPath !== undefined) config.appPath = localPath(t.appPath, 'appPath');
    const thumbnail = t.thumbnail_url || '';
    if (thumbnail) localPath(thumbnail, 'thumbnail_url');
    return {
      slug: t.slug, name: checked(t.name, 'name'), category: checked(t.category, 'category'),
      description: checked(t.description, 'description'), price: t.price ?? 0,
      list_price: t.list_price ?? 0, currency: checked(t.currency, 'currency'),
      thumbnail_url: thumbnail, tags: t.tags === undefined ? [] : checked(t.tags, 'tags'),
      sourceRank, config,
    };
  });
}
export function generate() {
  const { TEMPLATES } = require(path.join(root, 'templates/registry.js'));
  const slugs = require(path.join(root, 'templates/bfday.js'));
  const family = require(path.join(root, 'lib/bfday/family.js'));
  if (family.errors.length || family.list.length !== slugs.length || family.list.some((t, i) => t.slug !== slugs[i])) throw new Error('Family contract errors: ' + JSON.stringify(family.errors));
  const metadata = makeMetadata(TEMPLATES, slugs);
  const code = `// GENERATED by cloudflare/scripts/full-catalog.mjs. Do not edit.\n// Fresh source seed order (zero-based rank), not historical live DB ordering.\n// Prices are INR rupees, before any DB/admin overrides. Build-time snapshot only.\nimport { bySlug as familyBySlug, list as liveFamily } from './catalog.generated.mjs';\n\nconst expectedFamily = ${JSON.stringify(slugs)};\nif (liveFamily.length !== expectedFamily.length || liveFamily.some((t, i) => t.slug !== expectedFamily[i])) throw new Error('Full catalog family registry is stale');\nexport const PORT_STATUS = Object.freeze({ SUPPORTED: Object.freeze({ supported: true }), NOT_MIGRATED: Object.freeze({ supported: false, reason: 'not_migrated' }) });\nexport const sourceMetadata = ${JSON.stringify(metadata, null, 2)};\nexport const fullCatalog = sourceMetadata.map(source => {\n  const live = familyBySlug(source.slug);\n  if (live && (typeof live.render !== 'function' || typeof live.validate !== 'function' || !live.schema)) throw new Error('Missing live family implementation: ' + source.slug);\n  const portStatus = live ? PORT_STATUS.SUPPORTED : PORT_STATUS.NOT_MIGRATED;\n  // Retain live schema, validation and renderer as actual callable references.\n  return live ? { ...live, ...source, config: live.config, sourceConfig: source.config, portStatus, ...portStatus }\n    : { ...source, sourceConfig: source.config, portStatus, ...portStatus };\n});\nconst index = new Map(fullCatalog.map(t => [t.slug, t]));\nexport const fullBySlug = slug => index.get(slug) || null;\n`;
  fs.writeFileSync(path.join(root, 'cloudflare/src/full-catalog.generated.mjs'), code);
  console.log(`Generated ${metadata.length} entries (33 supported, 17 not migrated).`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generate();
