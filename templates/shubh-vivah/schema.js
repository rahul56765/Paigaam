'use strict';
/**
 * Validation for Shubh Vivah (a Hindu wedding invitation).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. The couple's names, the
 * date and the venue are required; everything else falls back to the
 * designed copy in config.js (via lib/bfday/fields.resolve), and the
 * families' card is simply not rendered when both lines are blank.
 * Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
