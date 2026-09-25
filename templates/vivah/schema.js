'use strict';
/**
 * Validation for Vivah (Shubh Vivah — the divine-sky wedding invitation).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there, plus the family's shared
 * bgmSong field. Only the couple's names are required; everything else falls
 * back to the designed copy in render.js (via lib/bfday/fields.resolve).
 * Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
