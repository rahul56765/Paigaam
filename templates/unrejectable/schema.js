'use strict';
/**
 * Validation for Lajja (The Unrejectable Card).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. Only the sender's name is
 * required; every other field falls back to the designed copy (via
 * lib/bfday/fields.resolve). Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
