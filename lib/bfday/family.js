'use strict';
/**
 * Boyfriend Day family — the loader.
 *
 * Reads the slug list from templates/bfday.js, requires each template's
 * config/schema/render from templates/<slug>/, and checks the contract
 * (ENGINE.md) before anything is mounted. A template that breaks the
 * contract is SKIPPED with a loud console error — never mounted half-working,
 * and never able to take the rest of the site down with it. The test suite
 * (tests/bfday-engine.test.js) asserts that `errors` is empty, so a broken
 * template cannot pass CI.
 *
 * Exports:
 *   list          [{ slug, config, schema, render, fields, dir }] in registration order
 *   bySlug(slug)  one entry or null
 *   has(slug)     is this slug a live family member?
 *   errors        [{ slug, message }] for skipped templates
 */
const path = require('node:path');
const fs = require('node:fs');
const { normalizeFields, InputError } = require('./fields');

const ROOT = path.join(__dirname, '..', '..');

/** Paths the family must never claim as a template slug. */
const RESERVED = new Set([
  'api', 'p', 'create', 'templates', 'template-view', 'admin', 'preview', 'go', 'brand', 'css', 'js',
  'experiences', 'bfday', 'health', 'healthz', 'contact', 'uploads', 'media', 'static', 'assets',
  // every pre-existing template slug and public/ directory
  'maafi', 'sawaal', 'sau-wajah', 'love-album', 'love-awaits', 'valentine-say-yes', 'lavender-bloom',
  'lavender-tic-tac-toe-bloom', 'ganapati', 'ganapati-aagman', 'ganpati-courtyard', 'saalgirah',
  'noor', 'meher', 'aashi', 'apology',
]);
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function loadOne(slug, dir) {
  const where = `templates/${slug}`;
  if (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > 40) throw new Error(`bad slug "${slug}" (lowercase words joined by single hyphens, ≤40 chars)`);
  if (RESERVED.has(slug)) throw new Error(`slug "${slug}" is reserved`);
  for (const file of ['config.js', 'schema.js', 'render.js']) {
    if (!fs.existsSync(path.join(dir, file))) throw new Error(`${where}/${file} is missing`);
  }
  const config = require(path.join(dir, 'config.js'));
  const schema = require(path.join(dir, 'schema.js'));
  const renderModule = require(path.join(dir, 'render.js'));

  if (!config || config.slug !== slug) throw new Error(`${where}/config.js: slug must be "${slug}"`);
  if (config.family !== 'bfday') throw new Error(`${where}/config.js: family must be 'bfday'`);
  if (config.price !== 0) throw new Error(`${where}/config.js: the family is free — price must be 0`);
  for (const key of ['name', 'category', 'description']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error(`${where}/config.js: ${key} is required`);
  }
  if (config.editable !== true) throw new Error(`${where}/config.js: editable must be true`);
  if (!config.theme || typeof config.theme !== 'object') throw new Error(`${where}/config.js: theme is required`);
  for (const key of ['bg', 'ink', 'accent', 'soft']) {
    if (!/^#[0-9a-fA-F]{6}$/.test(config.theme[key] || '')) throw new Error(`${where}/config.js: theme.${key} must be #RRGGBB`);
  }

  const fields = normalizeFields(config.fields, where);
  const ids = new Set(fields.map(f => f.id));

  // Wizard steps: every field lives in exactly one step.
  if (!Array.isArray(config.steps) || !config.steps.length) throw new Error(`${where}/config.js: steps must be a non-empty array`);
  const placed = new Map();
  config.steps.forEach((step, i) => {
    if (!step || typeof step.title !== 'string' || !step.title) throw new Error(`${where}/config.js: steps[${i}] needs a title`);
    if (!Array.isArray(step.fields) || !step.fields.length) throw new Error(`${where}/config.js: steps[${i}].fields must list field ids`);
    for (const id of step.fields) {
      if (!ids.has(id)) throw new Error(`${where}/config.js: steps[${i}] names unknown field "${id}"`);
      if (placed.has(id)) throw new Error(`${where}/config.js: field "${id}" is in two steps`);
      placed.set(id, i);
    }
  });
  for (const id of ids) if (!placed.has(id)) throw new Error(`${where}/config.js: field "${id}" is in no step`);
  if (config.steps.length > 6) throw new Error(`${where}/config.js: at most 6 steps`);

  const display = config.displayField;
  if (display !== undefined) {
    const f = fields.find(x => x.id === display);
    if (!f || f.type !== 'text') throw new Error(`${where}/config.js: displayField must name a top-level text field`);
  }

  const create = config.create || {};
  if (typeof create.headline !== 'string' || typeof create.intro !== 'string') throw new Error(`${where}/config.js: create.headline and create.intro are required`);
  if (create.scenes !== undefined && (!Array.isArray(create.scenes) || create.scenes.some(s => typeof s !== 'string'))) throw new Error(`${where}/config.js: create.scenes must be an array of strings`);

  if (!schema || typeof schema.validate !== 'function') throw new Error(`${where}/schema.js must export validate()`);
  if (!Array.isArray(schema.FIELDS)) throw new Error(`${where}/schema.js must export FIELDS (use makeSchema)`);
  const render = renderModule && renderModule.render;
  if (typeof render !== 'function') throw new Error(`${where}/render.js must export render(paigaam, opts)`);

  // The demo is what /<slug>/demo and the collection thumbnail play: it must
  // be publishable as-is, and it cannot reference uploads.
  if (!config.demo || typeof config.demo !== 'object') throw new Error(`${where}/config.js: demo sample data is required`);
  try { schema.validate(config.demo, { mode: 'strict' }); }
  catch (e) { throw new Error(`${where}/config.js: demo does not pass strict validation (${e.code || e.message})`); }
  if (JSON.stringify(config.demo).includes('/bfday/uploads/')) throw new Error(`${where}/config.js: demo cannot reference uploads`);

  return { slug, config, schema, render, fields, dir };
}

function slugsFromRegistry() {
  // eslint-disable-next-line global-require
  const listed = require(path.join(ROOT, 'templates', 'bfday.js'));
  if (!Array.isArray(listed)) throw new Error('templates/bfday.js must export an array of slugs');
  const out = listed.map(slug => ({ slug, dir: path.join(ROOT, 'templates', slug) }));
  // Test-only fixture exercising every field type end to end (images, lists,
  // selects, numbers, urls). Never loaded unless the test runner asks for it.
  if (process.env.BFDAY_TEST_FIXTURE === '1') out.push({ slug: 'bfday-fixture', dir: path.join(ROOT, 'tests', 'fixtures', 'bfday-fixture') });
  return out;
}

const list = [];
const errors = [];
for (const { slug, dir } of slugsFromRegistry()) {
  try {
    if (list.some(t => t.slug === slug)) throw new Error('registered twice');
    list.push(loadOne(slug, dir));
  } catch (e) {
    errors.push({ slug, message: e.message });
    console.error(`[bfday] SKIPPED template "${slug}": ${e.message}`);
  }
}

const index = new Map(list.map(t => [t.slug, t]));
const bySlug = slug => index.get(slug) || null;
const has = slug => index.has(slug);

/** Display name for customer_name / the admin list. */
function displayName(slug, data) {
  const t = bySlug(slug);
  const d = data && typeof data === 'object' ? data : {};
  if (!t) return 'You';
  const id = t.config.displayField || (t.fields.find(f => f.type === 'text' && f.required) || t.fields.find(f => f.type === 'text') || {}).id;
  const v = id && typeof d[id] === 'string' ? d[id].trim() : '';
  return v || 'You';
}

module.exports = { list, bySlug, has, errors, displayName, InputError, RESERVED };
