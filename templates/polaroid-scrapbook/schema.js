'use strict';
/**
 * Validation schema for Tasveer (Our Little Scrapbook).
 *
 * Generated from config.fields by the family engine. The sender's name is the
 * only required top-level field; every other field falls back to the designed
 * copy in render.js (via lib/bfday/fields.resolve). Each polaroid requires a
 * caption (the row is meaningless without it); the photo is optional so blank
 * photos show the design's placeholder art. Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
