'use strict';
/**
 * Validation for Naghma (Our Wrapped).
 *
 * Generated from config.fields by the family engine: a whitelisting validator
 * with the max lengths, min/max counts and shape rules declared there. Only
 * senderName and recipientName are required; every other field falls back to
 * the designed copy. The moments list falls back to the full default list when
 * fewer than one valid row is supplied.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
