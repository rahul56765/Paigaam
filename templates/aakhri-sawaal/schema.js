'use strict';
/**
 * Validation for Aakhri Sawaal (One Question. Your Answer.).
 *
 * Generated from config.fields by the family engine: a whitelisting
 * validator with the max lengths declared there. Only the sender's name is
 * required; the question and the build-up cards fall back to the designed
 * copy in render.js (via lib/bfday/fields.resolve). The WhatsApp number is
 * free text here and normalised to digits in render.js — anything that is
 * not a plausible phone number is ignored and the generic share is used.
 * Unknown keys never persist.
 */
module.exports = require('../../lib/bfday/fields').makeSchema(require('./config'));
