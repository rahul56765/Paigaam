'use strict';
/** Fictional, reusable preview copy. Existing and future multi-page mappings can use this without per-launch assistant setup. */
const { canvaText } = require('./validate');
const GENERIC_NOTE = 'Some of my favourite moments are the ordinary ones: your laugh across the room, the way you make every place feel like home, and the small kindnesses you never even notice. Thank you for being exactly who you are. I hope this little collection reminds you how deeply you are loved, today and always.';
const STORY_LETTER = 'I still find new reasons to be grateful for you. Thank you for making ordinary days feel special, for listening without rushing me, and for making home feel like a person. Here is to all the little adventures ahead. Happy birthday — you deserve every good thing.';
const clamp = (value, max) => [...String(value || '')].slice(0, Math.max(0, Number(max) || 0)).join('').trim();

function valueFor(field) {
  if (typeof field.sampleValue === 'string' && field.sampleValue.trim()) return clamp(field.sampleValue, field.maxLength);
  if (typeof field.defaultValue === 'string' && field.defaultValue.trim()) return clamp(field.defaultValue, field.maxLength);
  const key = `${field.key || ''} ${field.label || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (/whatsapp|phone|email|website|url/.test(key)) return '';
  if (/letter|message|wish|story|note|caption|quote|dedication|paragraph|body/.test(key)) {
    const text = /letter|paragraph/.test(key) ? STORY_LETTER : GENERIC_NOTE;
    return clamp(text, field.maxLength || text.length);
  }
  if (/partner one|partnerone|sender|from name|giver|author/.test(key)) return clamp('Aarav', field.maxLength || 24);
  if (/partner two|partnertwo|recipient|receiver|person name|their name|name/.test(key)) return clamp('Meera', field.maxLength || 24);
  if (/date/.test(key)) return clamp('12 December 2026', field.maxLength || 24);
  if (/time/.test(key)) return clamp('6:30 PM', field.maxLength || 16);
  if (/age|year|number|count|anniversary/.test(key)) return clamp('7', field.maxLength || 12);
  if (typeof field.placeholder === 'string' && field.placeholder.trim()) return clamp(field.placeholder, field.maxLength || field.placeholder.length);
  return clamp(field.label || 'A moment to remember', field.maxLength || String(field.label || '').length);
}

function sampleValues(mapping) {
  const result = {};
  for (const field of mapping.fields || []) result[field.key] = valueFor(field);
  return result;
}

function canvaSampleData(mapping, assets) {
  const data = {};
  for (const [name, text] of Object.entries(canvaText(mapping, sampleValues(mapping)))) data[name] = { type: 'text', text: String(text || '') };
  const targets = (slot) => Array.isArray(slot.canvaNames) ? slot.canvaNames : (slot.canvaName ? [slot.canvaName] : []);
  let index = 0;
  for (const slot of mapping.images || []) {
    const asset = assets[index++ % assets.length];
    if (!asset || !asset.assetId) throw new Error('sample image asset unavailable');
    for (const name of targets(slot)) data[name] = { type: 'image', asset_id: asset.assetId };
  }
  return data;
}

module.exports = { sampleValues, valueFor, canvaSampleData, GENERIC_NOTE, STORY_LETTER };
