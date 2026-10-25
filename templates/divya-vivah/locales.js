'use strict';
const translations = require('./translations');
const config = require('./config');
const keyFor = (lang, id) => lang + id[0].toUpperCase() + id.slice(1);
const DEVANAGARI = '०१२३४५६७८९';
function digits(value, lang) {
 return String(value == null ? '' : value).replace(/[0-9०-९]/g, char => {
  const n = /[0-9]/.test(char) ? Number(char) : DEVANAGARI.indexOf(char);
  return lang === 'en' ? String(n) : DEVANAGARI[n];
 });
}
function copies(data) {
 const out = { mr: {}, hi: {}, en: {} };
 for (const id of config.localeCopyFields) {
  out.mr[id] = digits(data[id], 'mr');
  for (const lang of ['hi', 'en']) {
   // Empty personalized translations inherit the actual Marathi details,
   // never a different family's default name, venue or telephone number.
   const originalDefault = config.fields.find(field => field.id === id).default;
   const inherited = data[id] === originalDefault ? translations[lang][id] : data[id];
   out[lang][id] = digits(data[keyFor(lang, id)] || inherited, lang);
  }
 }
 return out;
}
module.exports = { keyFor, digits, copies, ui: translations.ui };
