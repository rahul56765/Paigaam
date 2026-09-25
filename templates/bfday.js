'use strict';
/**
 * The Boyfriend Day family — one line per template.
 *
 * Each slug here must have templates/<slug>/{config,schema,render}.js (and
 * usually public/<slug>/ for its css/js). The shared engine in lib/bfday/
 * mounts everything else: /create/<slug>, /<slug>/demo, the live preview,
 * owner previews, draft/upload/publish APIs, the gallery card, the detail
 * page and /p/<slug>-<hex>. See ENGINE.md.
 *
 * Order here is the order the templates appear in the collection.
 */
module.exports = [
  'sealed-with-a-kiss',
  'polaroid-scrapbook',
  'scratch-reasons',
  'unrejectable',
  'our-wrapped',
  'know-us-quiz',
  'meri-duniya',
  'khulta',
  'aakhri-sawaal',
  'bfday-gift',
  'raaz',
  'shubh-vivah',
];
