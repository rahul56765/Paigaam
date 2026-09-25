'use strict';
/**
 * Validation for Kashf (Reasons I Love You — Scratch Edition).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. Only the sender's name is
 * required; reasons and finaleText fall back to their designed defaults in
 * render.js (via lib/bfday/fields.resolve). Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
