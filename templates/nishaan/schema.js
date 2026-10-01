'use strict';
/**
 * Validation for Nishaan.
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. The name, age and wish are
 * required; everything else falls back to the designed copy in render.js
 * (via lib/bfday/fields.resolve). Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
