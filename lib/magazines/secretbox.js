'use strict';
/** AES-256-GCM sealing for Canva OAuth tokens at rest. Key never leaves the environment. */
const crypto = require('node:crypto');

function key() {
  const raw = process.env.CANVA_TOKEN_ENCRYPTION_KEY || '';
  if (raw.length < 32) throw new Error('CANVA_TOKEN_ENCRYPTION_KEY is missing or shorter than 32 characters');
  return crypto.createHash('sha256').update(raw).digest();
}
function seal(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}
function open(sealed) {
  const [v, iv, tag, ct] = String(sealed || '').split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unreadable sealed value');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}
module.exports = { seal, open };
