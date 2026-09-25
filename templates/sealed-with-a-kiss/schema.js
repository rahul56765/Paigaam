'use strict';
/**
 * Validation for Mohar (Sealed With A Kiss).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. Only the sender's name is
 * required; every other field falls back to the designed copy in render.js
 * (via lib/bfday/fields.resolve). Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
