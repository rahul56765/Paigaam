'use strict';
/** Additive SQLite schema + data access for wedding videos. Never touches existing tables. */
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { db, DATA_DIR } = require('../../db');

const ROOT = path.join(DATA_DIR, 'wedding-video');
const MEDIA_DIR = path.join(ROOT, 'media');
const RENDER_DIR = path.join(ROOT, 'renders');
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(RENDER_DIR, { recursive: true });

db.exec(`
CREATE TABLE IF NOT EXISTS wv_invites (
  id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, data_json TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS wv_invites_owner ON wv_invites(owner_hash, created_at);
CREATE TABLE IF NOT EXISTS wv_media (
  id TEXT PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES wv_invites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, filename TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS wv_media_invite ON wv_media(invite_id);
CREATE TABLE IF NOT EXISTS wv_jobs (
  id TEXT PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES wv_invites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, params_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT '', progress REAL NOT NULL DEFAULT 0, result_json TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS wv_jobs_invite ON wv_jobs(invite_id, created_at);
CREATE INDEX IF NOT EXISTS wv_jobs_status ON wv_jobs(status);
CREATE TABLE IF NOT EXISTS wv_rsvps (
  id TEXT PRIMARY KEY, invite_id TEXT NOT NULL REFERENCES wv_invites(id) ON DELETE CASCADE,
  name TEXT NOT NULL, attending TEXT NOT NULL, guests INTEGER NOT NULL DEFAULT 1, message TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS wv_rsvps_invite ON wv_rsvps(invite_id, created_at);
`);

const now = () => Date.now();
const newId = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

/* invites */
function createInvite(ownerHash, data) {
  const id = newId(12);
  const t = now();
  db.prepare('INSERT INTO wv_invites (id, owner_hash, data_json, created_at, updated_at) VALUES (?,?,?,?,?)').run(id, ownerHash, JSON.stringify(data), t, t);
  return id;
}
const getInvite = (id) => {
  if (!/^[a-f0-9]{24}$/.test(String(id || ''))) return null;
  const r = db.prepare('SELECT * FROM wv_invites WHERE id=?').get(id);
  return r ? { ...r, data: parse(r.data_json, {}) } : null;
};
const updateInvite = (id, data) => db.prepare('UPDATE wv_invites SET data_json=?, updated_at=? WHERE id=?').run(JSON.stringify(data), now(), id);
const invitesToday = (ownerHash) => db.prepare('SELECT COUNT(*) n FROM wv_invites WHERE owner_hash=? AND created_at>?').get(ownerHash, now() - 86400000).n;

/* media */
function addMedia(inviteId, kind, ext, mime, buf) {
  const id = newId(16);
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(MEDIA_DIR, filename), buf);
  db.prepare('INSERT INTO wv_media (id, invite_id, kind, filename, mime, bytes, created_at) VALUES (?,?,?,?,?,?,?)').run(id, inviteId, kind, filename, mime, buf.length, now());
  return { id, filename, url: `/wedding-video/media/${filename}` };
}
const mediaByFile = (filename) => (/^[a-f0-9]{32}\.(mp3|m4a)$/.test(filename) ? db.prepare('SELECT * FROM wv_media WHERE filename=?').get(filename) : null);
const mediaCount = (inviteId, kind) => db.prepare('SELECT COUNT(*) n FROM wv_media WHERE invite_id=? AND kind=?').get(inviteId, kind).n;
const mediaPath = (filename) => path.join(MEDIA_DIR, filename);

/* jobs */
function createJob(inviteId, kind, params) {
  const id = newId(12);
  const t = now();
  db.prepare('INSERT INTO wv_jobs (id, invite_id, kind, params_json, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(id, inviteId, kind, JSON.stringify(params || {}), t, t);
  return id;
}
const getJob = (id) => {
  const r = /^[a-f0-9]{24}$/.test(String(id || '')) ? db.prepare('SELECT * FROM wv_jobs WHERE id=?').get(id) : null;
  return r ? { ...r, params: parse(r.params_json, {}), result: parse(r.result_json, {}) } : null;
};
const updateJob = (id, fields) => {
  const keys = Object.keys(fields);
  const vals = keys.map((k) => (k === 'result' ? JSON.stringify(fields[k]) : fields[k]));
  const cols = keys.map((k) => `${k === 'result' ? 'result_json' : k}=?`).join(', ');
  db.prepare(`UPDATE wv_jobs SET ${cols}, updated_at=? WHERE id=?`).run(...vals, now(), id);
};
const nextQueued = (kind) => db.prepare("SELECT id FROM wv_jobs WHERE kind=? AND status='queued' ORDER BY created_at LIMIT 1").get(kind);
const activeJobs = (inviteId, kind) => db.prepare("SELECT COUNT(*) n FROM wv_jobs WHERE invite_id=? AND kind=? AND status IN ('queued','running')").get(inviteId, kind).n;
const jobsForInvite = (inviteId) => db.prepare('SELECT * FROM wv_jobs WHERE invite_id=? ORDER BY created_at DESC LIMIT 40').all(inviteId)
  .map((r) => ({ id: r.id, kind: r.kind, status: r.status, stage: r.stage, progress: r.progress, result: parse(r.result_json, {}), error: r.error, params: parse(r.params_json, {}), created_at: r.created_at }));
const latestRender = (inviteId, format) => {
  const rows = db.prepare("SELECT * FROM wv_jobs WHERE invite_id=? AND kind='render' AND status='done' ORDER BY updated_at DESC").all(inviteId);
  return rows.map((r) => ({ ...r, params: parse(r.params_json, {}), result: parse(r.result_json, {}) })).find((r) => r.params.format === format) || null;
};
/** On restart, running renders were interrupted: requeue them. */
function recoverInterrupted() {
  db.prepare("UPDATE wv_jobs SET status='queued', stage='', progress=0 WHERE status='running' AND kind='render'").run();
}

/* rsvps */
function addRsvp(inviteId, r, ip) {
  db.prepare('INSERT INTO wv_rsvps (id, invite_id, name, attending, guests, message, ip_hash, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(newId(10), inviteId, r.name, r.attending, r.guests, r.message, hash(ip || ''), now());
}
const rsvpsFor = (inviteId) => db.prepare('SELECT name, attending, guests, message, created_at FROM wv_rsvps WHERE invite_id=? ORDER BY created_at DESC LIMIT 500').all(inviteId);
const wishesFor = (inviteId) => db.prepare("SELECT name, message, created_at FROM wv_rsvps WHERE invite_id=? AND message<>'' ORDER BY created_at DESC LIMIT 100").all(inviteId);
const rsvpsFromIpToday = (inviteId, ip) => db.prepare('SELECT COUNT(*) n FROM wv_rsvps WHERE invite_id=? AND ip_hash=? AND created_at>?').get(inviteId, hash(ip || ''), now() - 86400000).n;

module.exports = {
  ROOT, MEDIA_DIR, RENDER_DIR, hash, newId,
  createInvite, getInvite, updateInvite, invitesToday,
  addMedia, mediaByFile, mediaCount, mediaPath,
  createJob, getJob, updateJob, nextQueued, activeJobs, jobsForInvite, latestRender, recoverInterrupted,
  addRsvp, rsvpsFor, wishesFor, rsvpsFromIpToday,
};
