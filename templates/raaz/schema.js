'use strict';
/**
 * Validation for Raaz (The Password Letter).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. His name, the password and
 * the letter are required; everything else falls back to the designed copy
 * in render.js (via lib/bfday/fields.resolve). Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
