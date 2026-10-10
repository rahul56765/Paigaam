'use strict';
const { IMAGE_LIMITS } = require('./registry');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY = /^[a-z][a-z0-9_]{0,23}$/;
const RESERVED = new Set(['new', 'm', 'sample', 'preview']);
const MAX_TEXT_LENGTH = 2000;
const MAX_FIELDS = 80;
const MAX_IMAGES = 100;

function validateMapping(input, dataset) {
  const errors = [];
  const m = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const slug = String(m.slug || '').trim();
  const name = String(m.name || '').trim();
  const tagline = String(m.tagline || '').trim();
  const canvaTemplateId = String(m.canvaTemplateId || '').trim();
  const pageCount = Number(m.pageCount);
  const fields = Array.isArray(m.fields) ? m.fields : [];
  const images = Array.isArray(m.images) ? m.images : [];

  if (!SLUG.test(slug) || RESERVED.has(slug) || slug.length > 60) errors.push({ code: 'invalid_slug', field: 'slug' });
  if (!name || name.length > 100) errors.push({ code: 'invalid_name', field: 'name' });
  if (!tagline || tagline.length > 240) errors.push({ code: 'invalid_tagline', field: 'tagline' });
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(canvaTemplateId)) errors.push({ code: 'invalid_canva_template_id', field: 'canvaTemplateId' });
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 200) errors.push({ code: 'invalid_page_count', field: 'pageCount' });
  if (fields.length > MAX_FIELDS) errors.push({ code: 'too_many_fields', field: 'fields' });
  if (images.length > MAX_IMAGES) errors.push({ code: 'too_many_images', field: 'images' });
  if (fields.length + images.length === 0) errors.push({ code: 'no_fields', field: 'fields' });

  const names = new Set();
  const keys = new Set();
  const normalizedFields = [];
  const normalizedImages = [];
  const normalize = (item, kind, index) => {
    const path = `${kind}[${index}]`;
    const key = String(item && item.key || '').trim();
    const targets = kind === 'text' && Array.isArray(item && item.canvaNames) ? item.canvaNames : [item && item.canvaName];
    const canvaNames = targets.map(x => String(x || '').trim()).filter(Boolean);
    const canvaName = canvaNames[0] || '';
    const label = String(item && item.label || '').trim();
    const required = item && item.required !== false;
    if (!KEY.test(key) || keys.has(key)) errors.push({ code: 'invalid_or_duplicate_key', field: `${path}.key` });
    if (key) keys.add(key);
    if (!canvaNames.length) errors.push({ code: 'missing_canva_name', field: `${path}.canvaName` });
    for (const target of canvaNames) {
      if (target.length > 100 || /[\u0000-\u001f\u007f]/.test(target) || names.has(target)) errors.push({ code: 'invalid_or_duplicate_canva_name', field: `${path}.canvaName` });
      if (target) names.add(target);
      if (dataset && dataset[target] && dataset[target].type !== kind) errors.push({ code: 'type_mismatch', field: target, expected: kind, actual: String(dataset[target].type) });
      else if (dataset && !Object.prototype.hasOwnProperty.call(dataset, target)) errors.push({ code: 'missing_in_canva', field: target, expected: kind });
    }
    if (!label || label.length > 100) errors.push({ code: 'invalid_label', field: `${path}.label` });
    if (kind === 'text') {
      const maxLength = Number(item.maxLength);
      if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > MAX_TEXT_LENGTH) errors.push({ code: 'invalid_max_length', field: `${path}.maxLength` });
      const defaultValue = String(item.defaultValue || '');
      if (defaultValue.length > (maxLength || MAX_TEXT_LENGTH)) errors.push({ code: 'default_too_long', field: `${path}.defaultValue` });
      return { key, ...(canvaNames.length > 1 ? { canvaNames } : { canvaName }), type: 'text', label, required: !!required, maxLength, multiline: !!item.multiline,
        placeholder: String(item.placeholder || '').slice(0, 160), help: String(item.help || '').slice(0, 240), defaultValue };
    }
    if (canvaNames.length !== 1) errors.push({ code: 'multiple_image_targets_unsupported', field: `${path}.canvaName` });
    const frameAspect = Number(item.frameAspect);
    if (!Number.isFinite(frameAspect) || frameAspect < 0.3 || frameAspect > 3) errors.push({ code: 'invalid_frame_aspect', field: `${path}.frameAspect` });
    return { key, canvaName, type: 'image', label, hint: String(item.hint || '').slice(0, 160), required: !!required,
      frameAspect: Number.isFinite(frameAspect) ? frameAspect : 1 };
  };
  for (const [i, f] of fields.entries()) normalizedFields.push(normalize(f, 'text', i));
  for (const [i, im] of images.entries()) normalizedImages.push(normalize(im, 'image', i));

  if (dataset) {
    const supported = new Set(['image', 'text']);
    for (const [canvaName, spec] of Object.entries(dataset)) {
      if (!spec || !supported.has(spec.type)) errors.push({ code: 'unsupported_canva_type', field: canvaName, actual: String(spec && spec.type || 'unknown') });
      else if (!names.has(canvaName)) errors.push({ code: 'unmapped_in_canva', field: canvaName, actual: spec.type });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    mapping: {
      slug, name, tagline, canvaTemplateId, pageCount,
      fields: normalizedFields, images: normalizedImages, limits: IMAGE_LIMITS, adminManaged: !!m.adminManaged,
    },
  };
}

function keyFromCanvaName(name, index) {
  let key = String(name || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!/^[a-z]/.test(key)) key = `field_${key}`;
  key = key.slice(0, 24).replace(/_+$/g, '');
  return key || `field_${index + 1}`;
}
function slugFromName(name) {
  const slug = String(name || '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60).replace(/-+$/g, '');
  return RESERVED.has(slug) ? `${slug}-magazine` : slug;
}
function defaultLabel(name, index) {
  const raw = String(name || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return raw ? raw.replace(/\b\w/g, c => c.toUpperCase()) : `Field ${index + 1}`;
}
function fromDataset({ slug, name, tagline, canvaTemplateId, pageCount, dataset }) {
  const seen = new Set();
  const fields = [], images = [];
  for (const [index, [canvaName, spec]] of Object.entries(dataset || {}).entries()) {
    const keyBase = keyFromCanvaName(canvaName, index);
    let key = keyBase, suffix = 2;
    while (seen.has(key)) { const tail = `_${suffix++}`; key = keyBase.slice(0, 24 - tail.length) + tail; }
    seen.add(key);
    const label = defaultLabel(canvaName, index);
    if (spec.type === 'text') fields.push({ key, canvaName, type: 'text', label, required: true, maxLength: 120, multiline: false,
      placeholder: '', help: '', defaultValue: '' });
    else if (spec.type === 'image') images.push({ key, canvaName, type: 'image', label, hint: `Photo ${images.length + 1}`, required: true, frameAspect: 1 });
  }
  return { slug: slug || slugFromName(name), name: name || '', tagline: tagline || '', canvaTemplateId: canvaTemplateId || '', pageCount: Number(pageCount) || 0,
    fields, images, limits: IMAGE_LIMITS, adminManaged: true };
}

module.exports = { validateMapping, keyFromCanvaName, slugFromName, defaultLabel, fromDataset, SLUG, KEY, MAX_TEXT_LENGTH, MAX_FIELDS, MAX_IMAGES };
