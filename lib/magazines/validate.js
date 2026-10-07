'use strict';
/** Mapping-vs-live-dataset validation and reader submission validation. */
function targets(field) { return Array.isArray(field.canvaNames) ? field.canvaNames : (field.canvaName ? [field.canvaName] : []); }

/** Compare a registry mapping to the live Canva dataset ({ name: {type} }). */
function compareDataset(mapping, dataset) {
  const problems = [];
  const live = dataset && typeof dataset === 'object' ? dataset : {};
  const expected = [...mapping.fields, ...mapping.images].flatMap(f => targets(f).map(canvaName => ({ ...f, canvaName })));
  for (const f of expected) {
    const got = live[f.canvaName];
    if (!got) problems.push({ code: 'missing_in_canva', field: f.canvaName, expected: f.type });
    else if (got.type !== f.type) problems.push({ code: 'type_mismatch', field: f.canvaName, expected: f.type, actual: String(got.type) });
  }
  const known = new Set(expected.map(f => f.canvaName));
  for (const name of Object.keys(live)) {
    if (!known.has(name)) problems.push({ code: 'unmapped_in_canva', field: name, actual: String(live[name] && live[name].type) });
  }
  return { ok: problems.length === 0, problems, checkedFields: Object.keys(live).length };
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
/** Returns { values, errors } for text fields; unknown keys are ignored (never forwarded to Canva). */
function validateFields(mapping, input) {
  const values = {}, errors = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const f of mapping.fields) {
    let v = src[f.key];
    v = typeof v === 'string' ? v.replace(CONTROL, '').replace(/\s+/g, ' ').trim() : '';
    if (!v && f.required) errors[f.key] = 'required';
    else if ([...v].length > f.maxLength) errors[f.key] = 'too_long';
    values[f.key] = v;
  }
  return { values, errors, ok: Object.keys(errors).length === 0 };
}

/** Split one optional reader wish into target text fields without dropping words. */
function splitAcross(text, count, segmentMaxLength = 32) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const out = []; let index = 0;
  for (let slot = 0; slot < count; slot++) {
    const slotsLeft = count - slot;
    if (slot === count - 1) { out.push(words.slice(index).join(' ')); break; }
    const remainingLength = words.slice(index).join(' ').length;
    const targetLength = Math.ceil(remainingLength / slotsLeft);
    let line = '';
    while (index < words.length) {
      const candidate = line ? line + ' ' + words[index] : words[index];
      if (line && candidate.length > segmentMaxLength) break;
      if (line && line.length >= targetLength) break;
      line = candidate; index++;
      if (line.length >= targetLength) break;
    }
    out.push(line);
  }
  while (out.length < count) out.push('');
  return out;
}

/** Convert logical Paigaam text values into Canva dataset values, including one-to-many fields. */
function canvaText(mapping, values) {
  const out = {};
  for (const f of mapping.fields) {
    const value = values[f.key] || f.defaultValue || '';
    const names = targets(f);
    if (Array.isArray(f.canvaNames)) {
      const parts = splitAcross(value, names.length, f.segmentMaxLength || 32);
      names.forEach((name, index) => { out[name] = parts[index]; });
    } else if (names.length) out[names[0]] = value;
  }
  return out;
}
const missingImages = (mapping, uploads) => mapping.images.filter(s => s.required && !uploads.some(u => u.slot === s.key)).map(s => s.key);

module.exports = { compareDataset, validateFields, canvaText, splitAcross, missingImages };
