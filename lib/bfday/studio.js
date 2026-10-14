'use strict';
/**
 * Template studio — the saved copy behind admin-edited Boyfriend Day templates.
 *
 * Every Boyfriend Day layout (templates/<slug>/) ships with its copy in
 * config.js: the occasion line, the word list, the hidden notes, the letter,
 * the wizard wording and a sample for the demo. The studio lets an admin:
 *
 *   • edit that copy for a built-in layout (the saved copy then wins over the
 *     shipped copy; "reset" puts the shipped copy back), or
 *   • clone a layout as a new occasion — its own slug, name, category, price
 *     and status — keeping the layout and changing only the words.
 *
 * What is stored is a full snapshot of the editable copy per member, in the
 * bfday_studio table. At boot, loadSaved() rebuilds every member from its
 * shipped layout + snapshot and registers it with lib/bfday/family.js. The
 * contract check (ENGINE.md) runs on every build, so a saved copy can never
 * put a broken page live. Built-ins keep their name, category and description
 * in code (server.js re-syncs those from the registry on boot); only clones
 * own their name, category and description in the studio.
 *
 * Not editable here (on purpose, for v1): colours and motifs, photos, numbers,
 * selects, dates, the background-music field, and any layout structure.
 */
const { db, q } = require('../../db');
const family = require('./family');
const { makeSchema } = require('./fields');

db.exec(`CREATE TABLE IF NOT EXISTS bfday_studio (
 slug TEXT PRIMARY KEY,
 base_slug TEXT NOT NULL,
 is_clone INTEGER NOT NULL DEFAULT 0,
 copy TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL);`);

const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const DEFAULT_MAX = { text: 120, textarea: 2000, url: 500 };
const TEXT_TYPES = ['text', 'textarea', 'url'];
const MAX_ROWS = 12;             // rows shown per shape-list in the form
const MAX_WIZARD = 600;
const MAX_PHRASE = 200;
const MAX_PRICE = 100000;
const WIZARD_TEXT = ['eyebrow', 'headline', 'intro', 'noun', 'designHeading', 'designIntro', 'previewCta', 'previewHelp', 'resultLine'];
const HIDDEN_SLUGS = new Set(['bfday-fixture']);   // the test-only fixture is never offered

const isText = f => !!f && TEXT_TYPES.includes(f.type);
const str = v => (typeof v === 'string' ? v : (v == null ? '' : String(v)));
const clone = v => JSON.parse(JSON.stringify(v));

/* ----------------------------------------------------------- field specs */

/**
 * The editable parts of a config, in form order. Each spec is one of:
 *   text   a single text / textarea / url field
 *   lines  a list of text lines (one per line in the form)
 *   rows   a list of shapes whose text sub-fields are edited row by row
 * Images, numbers, selects, dates and the background-music field are not
 * editable here and are left exactly as shipped.
 */
function specsOf(config) {
  const out = [];
  for (const f of config.fields || []) {
    if (isText(f)) {
      out.push({ id: f.id, kind: 'text', type: f.type, label: f.label, hint: f.hint || '', placeholder: f.placeholder || '',
        required: !!f.required, max: f.maxLength || DEFAULT_MAX[f.type] || 120, rows: f.rows || 3 });
    } else if (f.type === 'list' && f.item && isText(f.item) && f.item.type !== 'url') {
      out.push({ id: f.id, kind: 'lines', label: f.label, hint: f.hint || '', itemLabel: f.itemLabel || 'Line',
        minItems: f.minItems || 0, maxItems: f.maxItems || MAX_ROWS, max: f.item.maxLength || 120,
        placeholder: f.item.placeholder || '' });
    } else if (f.type === 'list' && Array.isArray(f.shape)) {
      const subs = f.shape.filter(isText);
      if (!subs.length) continue;
      const maxItems = f.maxItems || ((f.default || []).length + 3);
      out.push({ id: f.id, kind: 'rows', label: f.label, hint: f.hint || '', itemLabel: f.itemLabel || 'Item',
        minItems: f.minItems || 0, maxItems, rowCount: Math.min(maxItems, MAX_ROWS),
        subs: subs.map(s => ({ id: s.id, label: s.label, required: !!s.required, max: s.maxLength || DEFAULT_MAX[s.type] || 120,
          rows: s.rows || 2, placeholder: s.placeholder || '', type: s.type })),
        keep: f.shape.filter(s => !isText(s)) });
    }
  }
  return out;
}

const fieldOf = (config, id) => (config.fields || []).find(f => f.id === id);

/** The copy a config shows today: the field default where it has one, otherwise the demo sample. */
function effective(config) {
  const demo = config.demo || {};
  const fields = {};
  for (const spec of specsOf(config)) {
    const f = fieldOf(config, spec.id);
    const source = f.default !== undefined ? f.default : demo[spec.id];
    if (spec.kind === 'text') fields[spec.id] = str(source);
    else if (spec.kind === 'lines') fields[spec.id] = Array.isArray(source) ? source.map(str) : [];
    else fields[spec.id] = (Array.isArray(source) ? source : []).map(item => Object.fromEntries(
      spec.subs.map(s => [s.id, str(item && item[s.id])])));
  }
  const create = config.create || {};
  const wizard = {};
  for (const key of WIZARD_TEXT) if (typeof create[key] === 'string') wizard[key] = create[key];
  if (Array.isArray(create.scenes)) wizard.scenes = create.scenes.map(str);
  const phrases = config.phrases ? { ...config.phrases } : undefined;
  return { fields, wizard, ...(phrases ? { phrases } : {}) };
}

/* -------------------------------------------------------- form -> copy */

/** Reads the studio form. Returns the copy to store, the values as typed (for re-rendering) and the errors. */
function readCopy(shipped, form) {
  const errors = [];
  const fields = {};
  const values = { fields: {}, wizard: {}, meta: {} };
  for (const spec of specsOf(shipped)) {
    if (spec.kind === 'text') {
      const v = str(form[`f_${spec.id}`]).replace(/\r/g, '').trim();
      values.fields[spec.id] = v;
      if (!v) { if (spec.required) errors.push(`${spec.label} is required.`); fields[spec.id] = ''; continue; }
      if (CONTROL.test(v)) errors.push(`${spec.label} has a hidden control character.`);
      else if (v.length > spec.max) errors.push(`${spec.label} is ${v.length} characters; the limit is ${spec.max}.`);
      fields[spec.id] = v;
    } else if (spec.kind === 'lines') {
      const raw = str(form[`l_${spec.id}`]);
      values.fields[spec.id] = raw;
      const items = raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      items.forEach((item, i) => {
        if (CONTROL.test(item)) errors.push(`${spec.label}, line ${i + 1}: hidden control character.`);
        else if (item.length > spec.max) errors.push(`${spec.label}, line ${i + 1}: ${item.length} characters; the limit is ${spec.max}.`);
      });
      if (items.length < spec.minItems) errors.push(`${spec.label} needs at least ${spec.minItems} line${spec.minItems === 1 ? '' : 's'}.`);
      if (items.length > spec.maxItems) errors.push(`${spec.label} takes at most ${spec.maxItems} lines.`);
      fields[spec.id] = items;
    } else {
      const rows = [];
      values.fields[spec.id] = [];
      for (let i = 0; i < spec.rowCount; i++) {
        const item = {};
        for (const sub of spec.subs) item[sub.id] = str(form[`s_${spec.id}_${i}_${sub.id}`]).replace(/\r/g, '').trim();
        values.fields[spec.id].push(item);
        if (!spec.subs.some(sub => item[sub.id])) continue;            // empty row: dropped
        for (const sub of spec.subs) {
          const v = item[sub.id];
          if (!v && sub.required) errors.push(`${spec.label}, row ${i + 1}: ${sub.label} is required.`);
          else if (v && CONTROL.test(v)) errors.push(`${spec.label}, row ${i + 1}: hidden control character.`);
          else if (v.length > sub.max) errors.push(`${spec.label}, row ${i + 1}: ${sub.label} is ${v.length} characters; the limit is ${sub.max}.`);
        }
        rows.push(Object.fromEntries(spec.subs.map(s => [s.id, item[s.id]])));
      }
      if (rows.length < spec.minItems) errors.push(`${spec.label} needs at least ${spec.minItems} filled in.`);
      if (rows.length > spec.maxItems) errors.push(`${spec.label} takes at most ${spec.maxItems}.`);
      fields[spec.id] = rows;
    }
  }

  const wizard = {};
  for (const key of WIZARD_TEXT) {
    const v = str(form[`w_${key}`]).replace(/\r/g, '').trim();
    values.wizard[key] = v;
    if (!v) continue;                                                   // blank: keep the shipped wording
    if (CONTROL.test(v)) errors.push(`Wizard copy "${key}" has a hidden control character.`);
    else if (v.length > MAX_WIZARD) errors.push(`Wizard copy "${key}" is ${v.length} characters; the limit is ${MAX_WIZARD}.`);
    wizard[key] = v;
  }
  if (shipped.create && Array.isArray(shipped.create.scenes)) {
    const raw = str(form.w_scenes);
    values.wizard.scenes = raw;
    const lines = raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (lines.length) wizard.scenes = lines.map(l => (l.length > MAX_WIZARD ? l.slice(0, MAX_WIZARD) : l));
  }
  // Fixed wording of the layout (Wording section). Blank keeps the shipped phrase.
  const phrases = {};
  if (shipped.phrases) {
    values.phrases = {};
    for (const key of Object.keys(shipped.phrases)) {
      const v = str(form[`ph_${key}`]).replace(/\r/g, '').trim();
      values.phrases[key] = v;
      if (!v) continue;
      if (CONTROL.test(v)) errors.push(`Wording "${key}" has a hidden control character.`);
      else if (v.length > MAX_PHRASE) errors.push(`Wording "${key}" is ${v.length} characters; the limit is ${MAX_PHRASE}.`);
      phrases[key] = v;
    }
  }
  const copy = { fields, wizard };
  if (Object.keys(phrases).length) copy.phrases = phrases;
  return { copy, values, errors };
}

function readMeta(form) {
  const meta = {
    name: str(form.meta_name).trim(),
    category: str(form.meta_category).trim(),
    description: str(form.meta_description).replace(/\r/g, '').trim(),
  };
  const errors = [];
  if (!meta.name) errors.push('The template name is required.');
  else if (meta.name.length > 60) errors.push('The template name is at most 60 characters.');
  if (!meta.category) errors.push('The category is required.');
  else if (meta.category.length > 40) errors.push('The category is at most 40 characters.');
  if (!meta.description) errors.push('The description is required.');
  else if (meta.description.length > 300) errors.push('The description is at most 300 characters.');
  for (const [k, v] of Object.entries(meta)) if (v && CONTROL.test(v)) errors.push(`${k}: hidden control character.`);
  return { meta, errors };
}

function readListing(form) {
  const errors = [];
  const raw = str(form.price).trim();
  const price = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) errors.push(`Price must be a whole number from 0 to ${MAX_PRICE}.`);
  const status = str(form.status) === 'published' ? 'published' : 'draft';
  return { price: Number.isInteger(price) ? price : 0, status, errors };
}

/* --------------------------------------------------- copy -> config */

/** The shipped config with the saved copy applied. Never mutates `shipped`. */
function applyCopy(shipped, copy) {
  const cfg = clone(shipped);
  cfg.demo = cfg.demo || {};
  const shippedDemo = shipped.demo || {};
  const fields = copy.fields || {};
  for (const spec of specsOf(shipped)) {
    if (!(spec.id in fields)) continue;                                  // newer code field: shipped copy
    const value = fields[spec.id];
    const f = fieldOf(cfg, spec.id);
    // A default is only ever written where the shipped layout pre-fills the field. Fields it
    // leaves blank (names, the song link) take their value into the sample alone, so saving
    // a sample never pre-fills every buyer's wizard.
    const prefilled = f.default !== undefined;
    if (spec.kind === 'text') {
      if (prefilled) { if (value) f.default = value; else delete f.default; }
      if (value) cfg.demo[spec.id] = value; else delete cfg.demo[spec.id];
    } else if (spec.kind === 'lines') {
      if (prefilled) f.default = value.slice();
      cfg.demo[spec.id] = value.slice();
    } else {
      const keepFrom = (src, i) => Object.fromEntries(spec.keep
        .filter(s => Array.isArray(src) && src[i] && src[i][s.id] !== undefined)
        .map(s => [s.id, src[i][s.id]]));
      if (prefilled) f.default = value.map((item, i) => ({ ...keepFrom(f.default, i), ...item }));
      cfg.demo[spec.id] = value.map((item, i) => ({ ...keepFrom(shippedDemo[spec.id], i), ...item }));
    }
  }
  if (shipped.phrases) {
    cfg.phrases = { ...shipped.phrases };
    for (const [k, v] of Object.entries(copy.phrases || {})) {
      if (k in shipped.phrases && typeof v === 'string' && v) cfg.phrases[k] = v;
    }
  }
  cfg.create = { ...(cfg.create || {}) };
  for (const [k, v] of Object.entries(copy.wizard || {})) {
    if (WIZARD_TEXT.includes(k) && typeof v === 'string') cfg.create[k] = v;
    if (k === 'scenes' && Array.isArray(v)) cfg.create.scenes = v.slice();
  }
  return cfg;
}

/** Full config for a member: the shipped layout, the saved copy, and the clone's name/category/description. */
function buildConfig(shipped, copy, slug, meta) {
  const cfg = applyCopy(shipped, copy);
  cfg.slug = slug;
  if (meta) { cfg.name = meta.name; cfg.category = meta.category; cfg.description = meta.description; }
  return cfg;
}

/** Defaults must also pass the family's own rules in draft mode, not only the demo in strict mode. */
function checkDefaults(cfg) {
  const data = {};
  for (const f of cfg.fields || []) if (f.default !== undefined) data[f.id] = f.default;
  try { makeSchema(cfg).validate(data, { mode: 'draft' }); }
  catch (e) { throw new Error(`The copy breaks the layout's own rules (${e.code || e.message}).`); }
}

/** Builds and checks the entry for a copy; returns it, or throws a readable Error. */
function prepare(slug, rootSlug, copy, meta) {
  const shipped = family.shippedConfig(rootSlug);
  if (!shipped) throw new Error(`"${rootSlug}" is not a shipped Boyfriend Day layout.`);
  const cfg = buildConfig(shipped, copy, slug, meta);
  checkDefaults(cfg);
  try { return family.build(slug, rootSlug, cfg); }
  catch (e) { throw new Error(String(e.message).replace(/^templates\/[^:]+\/config\.js: /, '')); }
}

/* ---------------------------------------------------------- storage */

const storedRow = slug => db.prepare('SELECT * FROM bfday_studio WHERE slug=?').get(slug) || null;
function parseCopy(row) { try { return JSON.parse(row.copy) || {}; } catch { return {}; } }
const paigaamCount = templateId => db.prepare('SELECT COUNT(*) n FROM paigaams WHERE template_id=?').get(templateId).n;

function saveRow(slug, rootSlug, isClone, copy) {
  const now = Date.now();
  db.prepare(`INSERT INTO bfday_studio (slug, base_slug, is_clone, copy, created_at, updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET base_slug=excluded.base_slug, is_clone=excluded.is_clone, copy=excluded.copy, updated_at=excluded.updated_at`)
    .run(slug, rootSlug, isClone ? 1 : 0, JSON.stringify(copy), now, now);
}

/* ---------------------------------------------------------- public API */

/** Every member for the list page (built-ins first, in registration order, then clones). */
function members() {
  return family.list.filter(t => !HIDDEN_SLUGS.has(t.slug)).map(t => {
    const row = storedRow(t.slug);
    const tpl = q.templateBySlug(t.slug);
    return {
      slug: t.slug,
      name: t.config.name,
      category: t.config.category,
      clone: !!(row && row.is_clone),
      builtIn: family.isBuiltIn(t.slug),
      customised: !!row,
      base: row ? row.base_slug : t.slug,
      status: tpl ? tpl.status : 'missing',
      price: tpl ? tpl.price : 0,
      paigaams: tpl ? paigaamCount(tpl.id) : 0,
    };
  });
}

/** Everything the edit page needs for one member, or null. */
function memberView(slug) {
  const entry = family.bySlug(slug);
  if (!entry || HIDDEN_SLUGS.has(slug)) return null;
  const row = storedRow(slug);
  const root = row ? row.base_slug : slug;
  const shipped = family.shippedConfig(root);
  const tpl = q.templateBySlug(slug);
  return {
    member: members().find(m => m.slug === slug),
    specs: specsOf(shipped),
    values: { ...effective(entry.config), meta: { name: entry.config.name, category: entry.config.category, description: entry.config.description } },
    root,
    rootName: shipped.name,
    tpl,
    paigaams: tpl ? paigaamCount(tpl.id) : 0,
    shipped,
  };
}

/**
 * Save the copy, listing and status of a member (built-in or clone).
 * Returns { ok, errors, values }. Nothing is stored unless every check passes.
 */
function save(slug, form) {
  const entry = family.bySlug(slug);
  if (!entry || HIDDEN_SLUGS.has(slug)) return { ok: false, errors: ['That template does not exist.'] };
  const row = storedRow(slug);
  const isClone = !!(row && row.is_clone);
  const root = row ? row.base_slug : slug;
  const shipped = family.shippedConfig(root);
  if (!shipped) return { ok: false, errors: ['The layout for this template is no longer shipped.'] };

  const copyRead = readCopy(shipped, form);
  const listing = readListing(form);
  const metaRead = isClone ? readMeta(form) : { meta: null, errors: [] };
  const errors = [...copyRead.errors, ...listing.errors, ...metaRead.errors];
  const values = { ...copyRead.values, meta: metaRead.meta || {}, price: listing.price, status: listing.status };
  if (errors.length) return { ok: false, errors, values };

  let entryNext;
  try { entryNext = prepare(slug, root, copyRead.copy, metaRead.meta); }
  catch (e) { return { ok: false, errors: [e.message], values }; }

  const tpl = q.templateBySlug(slug);
  if (!tpl) return { ok: false, errors: ['The template record is missing — reload the studio.'], values };
  saveRow(slug, root, isClone, isClone ? { ...copyRead.copy, meta: metaRead.meta } : copyRead.copy);
  family.install(entryNext);
  q.templateUpdate(tpl.id, {
    ...tpl,
    name: isClone ? metaRead.meta.name : tpl.name,
    category: isClone ? metaRead.meta.category : tpl.category,
    description: isClone ? metaRead.meta.description : tpl.description,
    price: listing.price,
    status: listing.status,
    config: { ...(tpl.config || {}), name: isClone ? metaRead.meta.name : tpl.name, fields: entryNext.config.fields, sections: entryNext.config.sections, theme: entryNext.config.theme },
  });
  return { ok: true, errors: [], values };
}

/** Checks a proposed slug for a new clone. Returns an error string or ''. */
function slugProblem(slug) {
  if (typeof slug !== 'string' || !slug) return 'Give the new template a slug.';
  if (!SLUG.test(slug) || slug.length > 40) return 'The slug is lowercase words joined by single hyphens, at most 40 characters (for example “anniversary-tohfa”).';
  if (family.RESERVED.has(slug)) return `“${slug}” is reserved — choose another slug.`;
  if (family.has(slug) || q.templateBySlug(slug)) return `A template called “${slug}” already exists.`;
  return '';
}

/** Clone an existing member as a new occasion. Returns { ok, errors, slug }. */
function createClone(from, form) {
  const src = family.bySlug(from);
  if (!src || HIDDEN_SLUGS.has(from)) return { ok: false, errors: ['Pick a template to clone.'] };
  const slug = str(form.new_slug).trim();
  const problem = slugProblem(slug);
  if (problem) return { ok: false, errors: [problem] };

  const srcRow = storedRow(from);
  const root = srcRow ? srcRow.base_slug : from;
  const sourceCopy = srcRow ? parseCopy(srcRow) : {};
  const copy = { fields: sourceCopy.fields || {}, wizard: sourceCopy.wizard || {} };
  if (sourceCopy.phrases) copy.phrases = { ...sourceCopy.phrases };
  const listing = readListing({ price: str(form.new_price) || String(q.templateBySlug(from)?.price ?? 0), status: 'draft' });
  const metaRead = readMeta({
    meta_name: str(form.new_name) || `${src.config.name} (copy)`,
    meta_category: str(form.new_category) || src.config.category,
    meta_description: str(form.new_description) || src.config.description,
  });
  const errors = [...listing.errors, ...metaRead.errors];
  if (errors.length) return { ok: false, errors };

  let entry;
  try { entry = prepare(slug, root, copy, metaRead.meta); }
  catch (e) { return { ok: false, errors: [e.message] }; }

  const cfg = entry.config;
  q.templateInsert({
    name: metaRead.meta.name, slug, category: metaRead.meta.category, description: metaRead.meta.description,
    price: listing.price, currency: 'INR', thumbnail_url: '', status: 'draft',
    config: { name: metaRead.meta.name, fields: cfg.fields, sections: cfg.sections, theme: cfg.theme, editable: true, family: 'bfday', studioBase: root, studioCopy: true },
  });
  saveRow(slug, root, true, { ...copy, meta: metaRead.meta });
  family.install(entry);
  return { ok: true, errors: [], slug };
}

/** Put a built-in back to its shipped copy. Clones are deleted, not reset. */
function resetBuiltIn(slug) {
  const row = storedRow(slug);
  if (!family.isBuiltIn(slug)) return { ok: false, errors: ['Only built-in templates have a shipped copy to reset to.'] };
  if (row && row.is_clone) return { ok: false, errors: ['That is a clone — delete it instead.'] };
  if (row) db.prepare('DELETE FROM bfday_studio WHERE slug=?').run(slug);
  family.remove(slug);            // the listing (price, status) is kept: only the words go back
  return { ok: true, errors: [] };
}

/** Delete a clone. Refused once it has paigaams; keep it as a draft instead. */
function deleteClone(slug) {
  const row = storedRow(slug);
  if (!row || !row.is_clone) return { ok: false, errors: ['Only studio clones can be deleted.'] };
  const tpl = q.templateBySlug(slug);
  if (tpl && paigaamCount(tpl.id) > 0) return { ok: false, errors: ['This template already has paigaams made from it. Keep it as a draft instead.'] };
  db.prepare('DELETE FROM bfday_studio WHERE slug=?').run(slug);
  family.remove(slug);
  if (tpl) q.templateDelete(tpl.id);
  return { ok: true, errors: [] };
}

/**
 * At boot: rebuild every saved member from its shipped layout and register it.
 * A member whose saved copy no longer passes is left at its shipped copy (for a
 * built-in) or left out (for a clone) and logged, so boot never fails on it.
 */
function loadSaved() {
  const loaded = [], failed = [];
  for (const row of db.prepare('SELECT * FROM bfday_studio ORDER BY created_at').all()) {
    try {
      const copy = parseCopy(row);
      const meta = row.is_clone ? (copy.meta || null) : null;
      const shipped = family.shippedConfig(row.base_slug);
      if (!shipped) throw new Error(`layout "${row.base_slug}" is no longer shipped`);
      family.install(family.build(row.slug, row.base_slug, buildConfig(shipped, copy, row.slug, meta)));
      loaded.push(row.slug);
    } catch (e) {
      failed.push({ slug: row.slug, message: e.message });
      console.error(`[studio] NOT LOADED "${row.slug}": ${e.message}`);
    }
  }
  return { loaded, failed };
}

module.exports = {
  specsOf, effective, readCopy, applyCopy, buildConfig, prepare, slugProblem,
  members, memberView, save, createClone, resetBuiltIn, deleteClone, loadSaved, SLUG, MAX_ROWS,
};
