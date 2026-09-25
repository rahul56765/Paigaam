'use strict';
/**
 * Validation for Khulta (One Door Opens Every Day).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. His name and the start
 * date (a real YYYY-MM-DD) are required; every door falls back to the
 * designed copy in render.js (via lib/bfday/fields.resolve). Unknown keys
 * never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
