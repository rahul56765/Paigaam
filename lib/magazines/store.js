'use strict';
/** Additive SQLite schema + data access for magazines. Never touches existing tables. */
const crypto = require('node:crypto');
const { db } = require('../../db');
const box = require('./secretbox');

db.exec(`
CREATE TABLE IF NOT EXISTS canva_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_enc TEXT, refresh_enc TEXT, expires_at INTEGER, scopes TEXT NOT NULL DEFAULT '',
  account_label TEXT NOT NULL DEFAULT '', connected_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS canva_oauth_state (
  state TEXT PRIMARY KEY, verifier_enc TEXT NOT NULL, admin_id TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS magazine_templates (
  slug TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'draft', canva_template_id TEXT NOT NULL DEFAULT '',
  validation_json TEXT NOT NULL DEFAULT '{}', validated_at INTEGER, published_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS magazine_orders (
  id TEXT PRIMARY KEY, template_slug TEXT NOT NULL, owner_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', fields_json TEXT NOT NULL DEFAULT '{}',
  design_id TEXT, autofill_job_id TEXT, pdf_job_id TEXT, png_job_id TEXT, pdf_file TEXT, png_file TEXT,
  error_code TEXT, error_stage TEXT, attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ready_at INTEGER);
CREATE INDEX IF NOT EXISTS magazine_orders_owner ON magazine_orders(owner_hash, created_at);
CREATE INDEX IF NOT EXISTS magazine_orders_status ON magazine_orders(status);
CREATE TABLE IF NOT EXISTS magazine_uploads (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES magazine_orders(id) ON DELETE CASCADE,
  slot TEXT NOT NULL, filename TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
  width INTEGER, height INTEGER, canva_asset_id TEXT, created_at INTEGER NOT NULL,
  UNIQUE (order_id, slot));
`);

const now = () => Date.now();
const IN_PROGRESS = ['queued', 'preparing', 'uploading', 'generating', 'exporting'];

/* ---- Canva connection (tokens encrypted at rest) ---- */
const getConnection = () => db.prepare('SELECT * FROM canva_connection WHERE id=1').get() || null;
function saveTokens({ access, refresh, expiresIn, scope, label }) {
  const t = now();
  const prev = getConnection();
  db.prepare(`INSERT INTO canva_connection (id,access_enc,refresh_enc,expires_at,scopes,account_label,connected_at,updated_at)
    VALUES (1,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET access_enc=excluded.access_enc, refresh_enc=excluded.refresh_enc,
      expires_at=excluded.expires_at, scopes=excluded.scopes,
      account_label=CASE WHEN excluded.account_label<>'' THEN excluded.account_label ELSE canva_connection.account_label END,
      updated_at=excluded.updated_at`)
    .run(box.seal(access), box.seal(refresh), t + Math.max(30, Number(expiresIn) || 3600) * 1000,
      String(scope || (prev && prev.scopes) || ''), label || '', (prev && prev.connected_at) || t, t);
}
const setAccountLabel = (label) => db.prepare('UPDATE canva_connection SET account_label=? WHERE id=1').run(String(label).slice(0, 80));
const clearTokens = () => db.prepare("UPDATE canva_connection SET access_enc=NULL, refresh_enc=NULL, expires_at=0, updated_at=? WHERE id=1").run(now());
const deleteConnection = () => db.prepare('DELETE FROM canva_connection WHERE id=1').run();
const isConnected = () => { const c = getConnection(); return !!(c && c.refresh_enc); };

/* ---- OAuth state (server-side PKCE verifier) ---- */
function newOAuthState(verifier, adminId) {
  db.prepare('DELETE FROM canva_oauth_state WHERE created_at < ?').run(now() - 3600000);
  const state = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO canva_oauth_state VALUES (?,?,?,?)').run(state, box.seal(verifier), String(adminId || ''), now());
  return state;
}
function takeOAuthState(state, ttl) {
  const row = db.prepare('SELECT * FROM canva_oauth_state WHERE state=?').get(String(state || ''));
  if (!row) return null;
  db.prepare('DELETE FROM canva_oauth_state WHERE state=?').run(row.state); // single use
  if (now() - row.created_at > ttl) return null;
  return { verifier: box.open(row.verifier_enc), adminId: row.admin_id };
}

/* ---- templates ---- */
function ensureTemplateRows(registry) {
  for (const m of registry) {
    db.prepare('INSERT OR IGNORE INTO magazine_templates (slug,canva_template_id,updated_at) VALUES (?,?,?)').run(m.slug, m.canvaTemplateId, now());
    db.prepare('UPDATE magazine_templates SET canva_template_id=? WHERE slug=? AND canva_template_id<>?').run(m.canvaTemplateId, m.slug, m.canvaTemplateId);
  }
}
const getTemplate = (slug) => {
  const r = db.prepare('SELECT * FROM magazine_templates WHERE slug=?').get(slug);
  if (!r) return null;
  let validation = {}; try { validation = JSON.parse(r.validation_json); } catch { /* keep {} */ }
  return { ...r, validation };
};
const saveValidation = (slug, result) => db.prepare('UPDATE magazine_templates SET validation_json=?, validated_at=?, updated_at=?, status=CASE WHEN ? THEN status ELSE \'draft\' END WHERE slug=?')
  .run(JSON.stringify(result), now(), now(), result.ok ? 1 : 0, slug);
const setTemplateStatus = (slug, status) => db.prepare('UPDATE magazine_templates SET status=?, published_at=CASE WHEN ?=\'published\' THEN ? ELSE published_at END, updated_at=? WHERE slug=?')
  .run(status, status, now(), now(), slug);
const isPublished = (slug) => { const t = getTemplate(slug); return !!t && t.status === 'published'; };

/* ---- orders ---- */
const hashOwner = (token) => crypto.createHash('sha256').update(token).digest('hex');
function createOrder(slug, ownerHash) {
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO magazine_orders (id,template_slug,owner_hash,created_at,updated_at) VALUES (?,?,?,?,?)').run(id, slug, ownerHash, now(), now());
  return getOrder(id);
}
const getOrder = (id) => (/^[a-f0-9]{32}$/.test(String(id)) ? db.prepare('SELECT * FROM magazine_orders WHERE id=?').get(id) : null) || null;
const ordersTodayFor = (ownerHash) => db.prepare('SELECT COUNT(*) n FROM magazine_orders WHERE owner_hash=? AND created_at>?').get(ownerHash, now() - 86400000).n;
const latestOrderFor = (ownerHash, slug) => db.prepare('SELECT * FROM magazine_orders WHERE owner_hash=? AND template_slug=? ORDER BY created_at DESC LIMIT 1').get(ownerHash, slug) || null;
function patchOrder(id, patch) {
  const keys = Object.keys(patch);
  db.prepare(`UPDATE magazine_orders SET ${keys.map(k => k + '=?').join(',')}, updated_at=? WHERE id=?`).run(...keys.map(k => patch[k]), now(), id);
}
/** Compare-and-swap status change; returns true only if THIS caller made the transition. */
function casStatus(id, fromList, to, extra = {}) {
  const keys = Object.keys(extra);
  const r = db.prepare(`UPDATE magazine_orders SET status=?${keys.map(k => ',' + k + '=?').join('')}, updated_at=? WHERE id=? AND status IN (${fromList.map(() => '?').join(',')})`)
    .run(to, ...keys.map(k => extra[k]), now(), id, ...fromList);
  return r.changes === 1;
}
const orderFields = (o) => { try { return JSON.parse(o.fields_json) || {}; } catch { return {}; } };
const listOrders = (limit = 30) => db.prepare('SELECT * FROM magazine_orders ORDER BY created_at DESC LIMIT ?').all(limit);
const inProgressOrders = () => db.prepare(`SELECT * FROM magazine_orders WHERE status IN (${IN_PROGRESS.map(() => '?').join(',')})`).all(...IN_PROGRESS);

/* ---- uploads ---- */
const listUploads = (orderId) => db.prepare('SELECT * FROM magazine_uploads WHERE order_id=? ORDER BY slot').all(orderId);
const getUpload = (orderId, slot) => db.prepare('SELECT * FROM magazine_uploads WHERE order_id=? AND slot=?').get(orderId, slot) || null;
function putUpload(orderId, slot, row) {
  const id = crypto.randomBytes(12).toString('hex');
  db.prepare(`INSERT INTO magazine_uploads (id,order_id,slot,filename,mime,bytes,width,height,created_at) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(order_id,slot) DO UPDATE SET filename=excluded.filename, mime=excluded.mime, bytes=excluded.bytes,
      width=excluded.width, height=excluded.height, canva_asset_id=NULL, created_at=excluded.created_at`)
    .run(id, orderId, slot, row.filename, row.mime, row.bytes, row.width, row.height, now());
}
const removeUpload = (orderId, slot) => db.prepare('DELETE FROM magazine_uploads WHERE order_id=? AND slot=?').run(orderId, slot);
const setAssetId = (orderId, slot, assetId) => db.prepare('UPDATE magazine_uploads SET canva_asset_id=? WHERE order_id=? AND slot=?').run(assetId, orderId, slot);
const deleteOrder = (id) => db.prepare('DELETE FROM magazine_orders WHERE id=?').run(id);
const allUploadFilenames = () => new Set(db.prepare('SELECT filename FROM magazine_uploads').all().map(r => r.filename));
const staleOrders = (cutoffDraft, cutoffFailed) => db.prepare(
  "SELECT id FROM magazine_orders WHERE (status='draft' AND updated_at<?) OR (status='failed' AND updated_at<?)").all(cutoffDraft, cutoffFailed);

module.exports = {
  IN_PROGRESS, now, getConnection, saveTokens, setAccountLabel, clearTokens, deleteConnection, isConnected,
  newOAuthState, takeOAuthState, ensureTemplateRows, getTemplate, saveValidation, setTemplateStatus, isPublished,
  hashOwner, createOrder, getOrder, ordersTodayFor, latestOrderFor, patchOrder, casStatus, orderFields, listOrders,
  inProgressOrders, listUploads, getUpload, putUpload, removeUpload, setAssetId, deleteOrder, allUploadFilenames, staleOrders,
};
