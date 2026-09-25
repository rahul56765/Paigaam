'use strict';
/**
 * Validation for Tohfa (Whole Website Gift).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. Only the two names are
 * required; every other field falls back to the designed copy in render.js
 * (via lib/bfday/fields.resolve). Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
