'use strict';
/**
 * Bare, sample-data render of a template, used by /template-view/:slug to power
 * the live auto-scrolling thumbnails on collection pages.
 * Same-origin only; iframe embeds it at miniature scale and drifts it slowly.
 */
const { renderPaigaamPage } = require('./renderPaigaam');
const ganapati = require('./ganapatiRoutes');
const saalgirah = require('./saalgirahRoutes');
const courtyard = require('./courtyardRoutes');

const YEAR = new Date().getFullYear();

/** Believable sample personalization per template (kept evergreen, dates in the future). */
const SAMPLES = {
  noor: {
    brideName: 'Ayesha', groomName: 'Imran',
    eventDate: `${YEAR + 1}-02-14`, eventTime: '19:00',
    venue: 'The Roseate, New Delhi',
    message: 'Two hearts, one journey — join us as we begin forever.',
  },
  meher: {
    personName: 'Meher', age: 30,
    eventDate: `${YEAR + 1}-03-08`, eventTime: '19:30',
    venue: 'A terrace full of candles',
    message: 'Come raise a toast to another lovely year of her.',
  },
  aashi: {
    partnerOne: 'Aashi', partnerTwo: 'Raghav', years: 10,
    eventDate: `${YEAR + 1}-12-24`,
    message: 'Ten years, and still my favourite hello.',
  },
};

const GANAPATI_SAMPLE = {
  language: 'en',
  familyName: 'The Deshmukh family',
  eventDate: `${YEAR + 1}-09-14`, eventTime: '11:00',
  venueName: 'Our home', address: 'Pune, Maharashtra',
};

/**
 * Full HTML document for a template miniature.
 * Custom webapp templates render their own app (the card iframes appPath directly),
 * so this only needs native + ganapati renders.
 */
function templateSampleView(tpl, baseUrl) {
  if (tpl.slug === saalgirah.SLUG) {
    return renderPaigaamPage(
      { slug: tpl.slug, category: tpl.category, config: tpl.config },
      { customer_data: saalgirah.DEMO, slug: null },
      { baseUrl, isPreview: true });
  }
  if (tpl.slug === courtyard.SLUG) {
    return renderPaigaamPage(
      { slug: tpl.slug, category: tpl.category, config: tpl.config },
      { customer_data: courtyard.DEMO, slug: null },
      { baseUrl, isPreview: true });
  }
  if (tpl.slug === ganapati.SLUG) {
    return renderPaigaamPage(
      { slug: tpl.slug, category: tpl.category, config: tpl.config },
      { customer_data: GANAPATI_SAMPLE, slug: null },
      { baseUrl, isPreview: true });
  }
  return renderPaigaamPage(
    { slug: tpl.slug, category: tpl.category, config: tpl.config },
    { customer_data: SAMPLES[tpl.slug] || {}, slug: null },
    { baseUrl, isPreview: true });
}

module.exports = { templateSampleView };
