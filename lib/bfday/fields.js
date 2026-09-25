'use strict';
/**
 * Boyfriend Day family — the field engine.
 *
 * Every template in the family declares its editable copy as `config.fields`
 * (see /agent ENGINE.md, "Field types"). This module turns that declaration
 * into three things, so no template hand-writes any of them:
 *
 *   normalizeFields(fields)  — boot-time spec check (fails loudly on a typo)
 *   makeSchema(config)       — the whitelisting validator (schema.js re-exports it)
 *   resolve(config, data)    — clean data with the designed defaults filled in,
 *                              which is what render.js actually paints
 *
 * Validation modes:
 *   'strict'  — publish. Every rule, required fields enforced, half-filled
 *               list items are an error.
 *   'draft'   — saving a draft. Same shape/length rules (still a 400 on bad
 *               input) but required fields may be blank and half-filled list
 *               items are dropped, so a sender can save (and upload a photo)
 *               before they have typed everything.
 *   'lenient' — the stateless live preview and every render. Never throws on
 *               content: wrong types become blank, overlong text is cut,
 *               control characters are stripped. A render can never 500.
 *
 * Stored data is always a clean, whitelisted object: unknown keys never persist.
 */

class InputError extends Error {
  constructor(code = 'validation', status = 400) { super(code); this.code = code; this.status = status; }
}

const TYPES = ['text', 'textarea', 'number', 'url', 'select', 'image', 'list'];
const SCALAR = TYPES.filter(t => t !== 'list');
const ID = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
const RESERVED = new Set(['templateVersion', 'id', 'slug', 'status', '__proto__', 'constructor', 'prototype']);
/** Control characters are rejected outright; \n survives only in textareas. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CONTROL_G = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** Photos are references to uploads made through /api/<slug>/upload — never data: URLs. */
const UPLOAD_URL = /^\/bfday\/uploads\/[a-f0-9]{48}\.(?:jpg|png|webp)$/;
const DEFAULT_MAX = { text: 120, textarea: 2000, url: 500 };

function specError(where, message) {
  return new Error(`[bfday] ${where}: ${message}`);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/* ------------------------------------------------------------ spec check */

function normalizeScalar(f, where) {
  const out = {
    id: f.id, type: f.type, label: String(f.label || ''),
    hint: f.hint ? String(f.hint) : '',
    required: !!f.required,
  };
  if (!out.label) throw specError(where, 'every field needs a label');
  if (f.type === 'text' || f.type === 'textarea' || f.type === 'url') {
    out.maxLength = f.maxLength == null ? DEFAULT_MAX[f.type] : f.maxLength;
    if (!Number.isInteger(out.maxLength) || out.maxLength < 1 || out.maxLength > 20000) throw specError(where, 'maxLength must be an integer 1..20000');
    if (f.type === 'textarea') out.rows = Number.isInteger(f.rows) ? Math.min(Math.max(f.rows, 2), 16) : 4;
    if (f.default != null && typeof f.default !== 'string') throw specError(where, 'default must be a string');
    if (typeof f.default === 'string' && f.default.length > out.maxLength) throw specError(where, 'default is longer than maxLength');
    if (f.type === 'text' && typeof f.default === 'string' && f.default.includes('\n')) throw specError(where, 'a text default cannot contain newlines');
  }
  if (f.type === 'number') {
    out.min = f.min == null ? 0 : f.min;
    out.max = f.max == null ? 1e9 : f.max;
    if (!Number.isInteger(out.min) || !Number.isInteger(out.max) || out.min > out.max) throw specError(where, 'number min/max must be integers, min <= max');
    if (f.default != null && (!Number.isInteger(f.default) || f.default < out.min || f.default > out.max)) throw specError(where, 'number default out of range');
  }
  if (f.type === 'select') {
    if (!Array.isArray(f.options) || !f.options.length) throw specError(where, 'select needs options');
    out.options = f.options.map(o => {
      const value = typeof o === 'string' ? o : o && o.value;
      const label = typeof o === 'string' ? o : o && (o.label || o.value);
      if (typeof value !== 'string' || !value || value.length > 60) throw specError(where, 'select option values must be non-empty strings');
      return { value, label: String(label) };
    });
    if (new Set(out.options.map(o => o.value)).size !== out.options.length) throw specError(where, 'duplicate select option');
    if (f.default != null && !out.options.some(o => o.value === f.default)) throw specError(where, 'select default must be one of its options');
  }
  if (f.type === 'image') {
    if (f.default != null && f.default !== '') throw specError(where, 'image fields cannot have a default (the template draws its own placeholder)');
    out.alt = f.alt ? String(f.alt) : '';
  }
  if (f.default !== undefined) out.default = f.default;
  out.placeholder = f.placeholder != null ? String(f.placeholder)
    : (typeof f.default === 'string' ? f.default : (f.default != null ? String(f.default) : ''));
  return out;
}

function normalizeField(f, where, nested) {
  if (!isPlainObject(f)) throw specError(where, 'a field must be an object');
  if (typeof f.id !== 'string' || !ID.test(f.id) || RESERVED.has(f.id)) throw specError(where, `bad field id "${f.id}" (letters/digits, starts with a letter, not reserved)`);
  where = `${where}.${f.id}`;
  if (!TYPES.includes(f.type)) throw specError(where, `unknown type "${f.type}" (supported: ${TYPES.join(', ')})`);
  if (f.type !== 'list') return Object.freeze(normalizeScalar(f, where));
  if (nested) throw specError(where, 'lists cannot be nested');

  const out = {
    id: f.id, type: 'list', label: String(f.label || ''), hint: f.hint ? String(f.hint) : '',
    required: false,
    minItems: f.minItems == null ? 0 : f.minItems,
    maxItems: f.maxItems == null ? 10 : f.maxItems,
    itemLabel: f.itemLabel ? String(f.itemLabel) : 'Item',
    addLabel: f.addLabel ? String(f.addLabel) : 'Add another',
  };
  if (!out.label) throw specError(where, 'every field needs a label');
  if (f.required) throw specError(where, 'lists cannot be required (use minItems; an empty list renders the defaults)');
  if (!Number.isInteger(out.minItems) || !Number.isInteger(out.maxItems) || out.minItems < 0 || out.maxItems < 1 || out.maxItems > 50 || out.minItems > out.maxItems) {
    throw specError(where, 'minItems/maxItems must be integers, 0 <= minItems <= maxItems <= 50');
  }
  if ((f.item ? 1 : 0) + (f.shape ? 1 : 0) !== 1) throw specError(where, 'a list needs exactly one of `item` (list of scalars) or `shape` (list of objects)');
  if (f.item) {
    out.item = normalizeField({ ...f.item, id: 'value', label: f.item.label || out.itemLabel }, where, true);
    if (out.item.required) throw specError(where, 'a scalar list item cannot be required (blank items are simply dropped)');
  } else {
    if (!Array.isArray(f.shape) || !f.shape.length) throw specError(where, '`shape` must be a non-empty array of fields');
    out.shape = Object.freeze(f.shape.map(s => normalizeField(s, where, true)));
    if (new Set(out.shape.map(s => s.id)).size !== out.shape.length) throw specError(where, 'duplicate field id in shape');
  }
  if (f.default != null) {
    if (!Array.isArray(f.default) || f.default.length > out.maxItems) throw specError(where, 'list default must be an array no longer than maxItems');
    // Defaults must themselves be valid — a template may not ship copy its own validator rejects.
    const probe = { [out.id]: f.default };
    try { validateFields([out], probe, 'strict'); } catch { throw specError(where, 'list default does not pass its own validation'); }
    if (f.default.length && f.default.length < out.minItems) throw specError(where, 'list default is shorter than minItems');
    out.default = f.default;
  } else {
    out.default = [];
  }
  return Object.freeze(out);
}

/** Boot-time check of a template's fields. Throws with a precise message. */
function normalizeFields(fields, where = 'fields') {
  if (!Array.isArray(fields) || !fields.length) throw specError(where, 'config.fields must be a non-empty array');
  const out = fields.map(f => normalizeField(f, where, false));
  const ids = out.map(f => f.id);
  if (new Set(ids).size !== ids.length) throw specError(where, 'duplicate field id');
  return Object.freeze(out);
}

/* ------------------------------------------------------------ validation */

function scalarValue(f, raw, mode) {
  const lenient = mode === 'lenient';
  const fail = () => { if (lenient) return null; throw new InputError(); };

  if (f.type === 'number') {
    if (raw == null || raw === '') return null;
    let n = raw;
    if (typeof raw === 'string' && /^\s*-?\d{1,12}\s*$/.test(raw)) n = Number(raw);
    if (typeof n !== 'number' || !Number.isInteger(n)) return fail();
    if (n < f.min || n > f.max) return lenient ? Math.min(Math.max(n, f.min), f.max) : fail();
    return n;
  }

  if (raw != null && typeof raw !== 'string') { const r = fail(); return r === null ? '' : r; }
  let value = (raw || '').replace(/\r\n?/g, '\n');
  if (lenient) value = value.replace(CONTROL_G, '');
  value = value.trim();
  if (CONTROL.test(value)) return fail();
  if (f.type !== 'textarea' && value.includes('\n')) {
    if (!lenient) return fail();
    value = value.replace(/\s*\n\s*/g, ' ');
  }
  if (f.type === 'textarea') {
    value = value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    if (!value.replace(/\s/g, '')) value = '';
  }
  if (f.maxLength && value.length > f.maxLength) {
    if (!lenient) return fail();
    value = value.slice(0, f.maxLength).trim();
  }
  if (!value) return '';
  if (f.type === 'url') {
    let ok = /^https?:\/\/[^\s<>"'`]+$/i.test(value);
    if (ok) { try { const u = new URL(value); ok = ['http:', 'https:'].includes(u.protocol) && !!u.hostname; } catch { ok = false; } }
    if (!ok) { const r = fail(); return r === null ? '' : r; }
  }
  if (f.type === 'select' && !f.options.some(o => o.value === value)) { const r = fail(); return r === null ? '' : r; }
  if (f.type === 'image' && !UPLOAD_URL.test(value)) { const r = fail(); return r === null ? '' : r; }
  return value;
}

function isBlank(f, v) {
  return f.type === 'number' ? v == null : !v;
}

function listValue(f, raw, mode) {
  const lenient = mode === 'lenient';
  if (raw == null) return [];
  if (!Array.isArray(raw)) { if (lenient) return []; throw new InputError(); }
  if (raw.length > f.maxItems) { if (!lenient) throw new InputError(); raw = raw.slice(0, f.maxItems); }
  const out = [];
  for (const entry of raw) {
    if (f.item) {
      const v = scalarValue(f.item, entry, mode);
      if (!isBlank(f.item, v)) out.push(v);
      continue;
    }
    if (!isPlainObject(entry)) { if (lenient) continue; throw new InputError(); }
    const item = {};
    let filled = 0, missing = false;
    for (const s of f.shape) {
      const v = scalarValue(s, entry[s.id], mode);
      item[s.id] = v == null ? (s.type === 'number' ? null : '') : v;
      if (isBlank(s, item[s.id])) { if (s.required) missing = true; } else filled++;
    }
    if (!filled) continue;                         // an all-blank row is no row
    if (missing) { if (mode === 'strict') throw new InputError(); continue; }
    out.push(item);
  }
  if (mode === 'strict' && out.length && out.length < f.minItems) throw new InputError();
  return out;
}

function validateFields(fields, data, mode) {
  const clean = {};
  for (const f of fields) {
    if (f.type === 'list') { clean[f.id] = listValue(f, data[f.id], mode); continue; }
    let v = scalarValue(f, data[f.id], mode);
    if (v == null) v = f.type === 'number' ? null : '';
    if (f.required && isBlank(f, v) && mode === 'strict') throw new InputError();
    clean[f.id] = v;
  }
  return clean;
}

/**
 * The per-template validator. `schema.js` is just:
 *   module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
 * (optionally wrapping validate() with template-specific extra rules).
 */
function makeSchema(config) {
  const fields = normalizeFields(config.fields, config.slug || 'template');
  const version = Number.isInteger(config.version) ? config.version : 1;
  function validate(data, { mode = 'strict' } = {}) {
    if (!['strict', 'draft', 'lenient'].includes(mode)) throw new Error('bad mode');
    if (!isPlainObject(data)) { if (mode === 'lenient') data = {}; else throw new InputError(); }
    return { templateVersion: version, ...validateFields(fields, data, mode) };
  }
  return { validate, InputError, FIELDS: fields, REQUIRED: fields.filter(f => f.required).map(f => f.id) };
}

/* -------------------------------------------------------------- defaults */

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

/**
 * Clean data with the designed defaults filled in — what render.js paints.
 *   text/textarea/url/select: blank → field.default (or '')
 *   number: blank → field.default (or null)
 *   image: blank stays '' (the template draws its placeholder)
 *   list: fewer than max(1, minItems) valid items → the default list;
 *         object items: blank subfields → subfield.default (or '')
 * Always runs the lenient validator first, so it accepts anything.
 */
function resolve(config, data, schema) {
  const s = schema || makeSchema(config);
  const clean = s.validate(isPlainObject(data) ? data : {}, { mode: 'lenient' });
  const out = { templateVersion: clean.templateVersion };
  for (const f of s.FIELDS) {
    const v = clean[f.id];
    if (f.type === 'list') {
      const items = v.length >= Math.max(1, f.minItems) ? v : clone(f.default);
      out[f.id] = f.shape
        ? items.map(item => Object.fromEntries(f.shape.map(sub => {
          const x = item[sub.id];
          return [sub.id, isBlank(sub, x) || x === undefined ? (sub.default !== undefined ? sub.default : (sub.type === 'number' ? null : '')) : x];
        })))
        : items;
      continue;
    }
    out[f.id] = isBlank(f, v) ? (f.default !== undefined ? f.default : (f.type === 'number' ? null : '')) : v;
  }
  return out;
}

/** Every upload URL referenced by (clean) data, in field order. */
function imagesIn(fields, data) {
  const urls = [];
  const d = isPlainObject(data) ? data : {};
  for (const f of fields) {
    if (f.type === 'image' && typeof d[f.id] === 'string' && UPLOAD_URL.test(d[f.id])) urls.push(d[f.id]);
    if (f.type === 'list' && Array.isArray(d[f.id])) {
      for (const item of d[f.id]) {
        if (f.item && f.item.type === 'image' && typeof item === 'string' && UPLOAD_URL.test(item)) urls.push(item);
        if (f.shape && isPlainObject(item)) {
          for (const sub of f.shape) if (sub.type === 'image' && typeof item[sub.id] === 'string' && UPLOAD_URL.test(item[sub.id])) urls.push(item[sub.id]);
        }
      }
    }
  }
  return urls;
}

/** Upper bound on photos one Paigaam can reference (drives the upload cap). */
function maxImages(fields) {
  let n = 0;
  for (const f of fields) {
    if (f.type === 'image') n++;
    if (f.type === 'list') n += f.maxItems * (f.item ? (f.item.type === 'image' ? 1 : 0) : f.shape.filter(s => s.type === 'image').length);
  }
  return n;
}

module.exports = {
  InputError, TYPES, SCALAR, UPLOAD_URL, CONTROL,
  normalizeFields, makeSchema, resolve, imagesIn, maxImages,
};
