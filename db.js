'use strict';
/**
 * Paigaam data layer — Node built-in SQLite (node:sqlite).
 * Zero external dependencies; the database is a single file at ./data/paigaam.db
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// DATA_DIR env lets a host mount a persistent volume (e.g. Render disk, Railway
// volume) so the SQLite file survives redeploys. If the configured dir can't be
// created/used (permissions, disk not attached), fall back to ./data so the app
// still boots — non-persistent, but alive — and log a loud warning.
function resolveDataDir() {
  const preferred = process.env.DATA_DIR || path.join(__dirname, 'data');
  const fallback = path.join(__dirname, 'data');
  for (const dir of [preferred, fallback]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      if (dir === fallback && preferred !== fallback) {
        console.warn(`[db] WARNING: could not use DATA_DIR "${preferred}" — falling back to "${fallback}" (NOT persistent). Attach a disk at "${preferred}" to keep data across deploys.`);
      }
      return dir;
    } catch (e) {
      if (dir === fallback) throw e; // even fallback failed — real problem
    }
  }
}
const DATA_DIR = resolveDataDir();

// True when we're on the preferred (DATA_DIR) location, not the fallback.
const PERSISTENT = DATA_DIR === (process.env.DATA_DIR || path.join(__dirname, 'data')) && !!process.env.DATA_DIR;

const db = new DatabaseSync(path.join(DATA_DIR, 'paigaam.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'INR',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  config        TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_slug ON templates(slug);
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);

CREATE TABLE IF NOT EXISTS paigaams (
  id             TEXT PRIMARY KEY,
  template_id    TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  slug           TEXT UNIQUE,
  customer_data  TEXT NOT NULL DEFAULT '{}',
  customer_name  TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'draft',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  published_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_paigaams_slug ON paigaams(slug);
CREATE INDEX IF NOT EXISTS idx_paigaams_status ON paigaams(status);
CREATE INDEX IF NOT EXISTS idx_paigaams_payment ON paigaams(payment_status);

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  paigaam_id    TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  whatsapp      TEXT NOT NULL DEFAULT '',
  amount        INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'INR',
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_paigaam ON orders(paigaam_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  whatsapp_number TEXT NOT NULL DEFAULT '',
  business_name   TEXT NOT NULL DEFAULT 'Paigaam',
  currency        TEXT NOT NULL DEFAULT 'INR',
  contact_message TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event      TEXT NOT NULL,
  props      TEXT NOT NULL DEFAULT '{}',
  path       TEXT NOT NULL DEFAULT '',
  ref        TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event);
`);

/* ---------- additive migrations (idempotent) ---------- */
// Razorpay columns on orders + a recovery token on paigaams. ALTERs run once;
// pragma_table_info keeps re-boots cheap and safe.
function addColumnIfMissing(table, column, ddl) {
  const has = db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = ?`).get(column);
  if (!has) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumnIfMissing('orders', 'razorpay_order_id', "razorpay_order_id TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('orders', 'razorpay_payment_id', "razorpay_payment_id TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('orders', 'razorpay_signature', "razorpay_signature TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('paigaams', 'recovery_token', "recovery_token TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('templates', 'list_price', "list_price INTEGER NOT NULL DEFAULT 0");
db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_rzp ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_paigaams_recovery ON paigaams(recovery_token);`);

const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function parse(row, fields = ['config', 'customer_data']) {
  if (!row) return row;
  const out = { ...row };
  for (const f of fields) {
    if (typeof out[f] === 'string') { try { out[f] = JSON.parse(out[f]); } catch { /* keep raw */ } }
  }
  // paigaam rows joined with templates carry template_config — always parse it.
  if (typeof out.template_config === 'string') { try { out.template_config = JSON.parse(out.template_config); } catch { /* keep raw */ } }
  return out;
}

const q = {
  // analytics: anonymous funnel events (no PII — event name, stringified props, path)
  eventInsert: (event, props = {}, path = '', ref = '') => {
    try {
      db.prepare('INSERT INTO events (event, props, path, ref, created_at) VALUES (?,?,?,?,?)')
        .run(String(event).slice(0, 64), JSON.stringify(props || {}).slice(0, 2000), String(path || '').slice(0, 300), String(ref || '').slice(0, 300), now());
    } catch (e) { /* never fail a request for analytics */ }
  },
  eventsRecent: (limit = 200) => db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit).map(r => ({ ...r, props: (() => { try { return JSON.parse(r.props); } catch { return {}; } })() })),
  eventsCountToday: () => db.prepare("SELECT COUNT(*) AS n FROM events WHERE created_at >= date('now')").get().n,
  // Trending: engagement counts per tracked template over a window
  // (created_at is ISO 'YYYY-MM-DD HH:MM:SS'; props JSON holds the template slug).
  eventsTemplateCounts: (days) => db.prepare(`
      SELECT props->>'$.template' AS slug, event, COUNT(*) AS n
      FROM events
      WHERE created_at >= datetime('now', '-' || ? || ' days')
        AND event IN ('template_opened', 'template_viewed', 'template_previewed', 'template_create_clicked')
        AND props IS NOT NULL
      GROUP BY slug, event
      HAVING slug IS NOT NULL AND slug != ''
    `).all(Number(days)),
  // templates
  templatesAll:      () => db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all().map(r => parse(r, ['config'])),
  // Newest first: seeded templates share one created_at, so rowid (insert =
  // registry order, newest first) breaks ties deterministically.
  templatesPublished:() => db.prepare("SELECT * FROM templates WHERE status = 'published' ORDER BY created_at DESC, rowid ASC").all().map(r => parse(r, ['config'])),
  templateBySlug:    (slug) => parse(db.prepare('SELECT * FROM templates WHERE slug = ?').get(slug), ['config']),
  templateById:      (id) => parse(db.prepare('SELECT * FROM templates WHERE id = ?').get(id), ['config']),
  templateInsert:    (t) => {
    const id = uid();
    db.prepare(`INSERT INTO templates (id,name,slug,category,description,price,list_price,currency,thumbnail_url,config,status,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, t.name, t.slug, t.category, t.description || '', t.price | 0, t.list_price | 0, t.currency || 'INR',
           t.thumbnail_url || '', JSON.stringify(t.config || {}), t.status || 'draft', now(), now());
    return q.templateById(id);
  },
  templateUpdate: (id, t) => {
    db.prepare(`UPDATE templates SET name=?,slug=?,category=?,description=?,price=?,list_price=?,currency=?,thumbnail_url=?,config=?,status=?,updated_at=? WHERE id=?`)
      .run(t.name, t.slug, t.category, t.description || '', t.price | 0, t.list_price | 0, t.currency || 'INR',
           t.thumbnail_url || '', JSON.stringify(t.config || {}), t.status || 'draft', now(), id);
    return q.templateById(id);
  },
  templateDelete: (id) => db.prepare('DELETE FROM templates WHERE id = ?').run(id),

  // paigaams
  paigaamsAll:  () => db.prepare(`SELECT p.*, t.name AS template_name, t.slug AS template_slug, t.price AS template_price, t.list_price AS template_list_price
                                  FROM paigaams p JOIN templates t ON t.id = p.template_id
                                  ORDER BY p.created_at DESC`).all().map(r => parse(r)),
  paigaamById:  (id) => parse(db.prepare(`SELECT p.*, t.name AS template_name, t.slug AS template_slug, t.price AS template_price, t.list_price AS template_list_price, t.currency AS template_currency, t.config AS template_config, t.category AS template_category
                                          FROM paigaams p JOIN templates t ON t.id = p.template_id WHERE p.id = ?`).get(id), ['customer_data', 'template_config']),
  paigaamBySlug:(slug) => parse(db.prepare(`SELECT p.*, t.name AS template_name, t.slug AS template_slug, t.config AS template_config, t.category AS template_category
                                            FROM paigaams p JOIN templates t ON t.id = p.template_id WHERE p.slug = ?`).get(slug), ['customer_data', 'template_config']),
  paigaamInsert: (p) => {
    const id = uid();
    db.prepare(`INSERT INTO paigaams (id,template_id,slug,customer_data,customer_name,status,payment_status,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, p.template_id, p.slug || null, JSON.stringify(p.customer_data || {}),
           p.customer_name || '', p.status || 'draft', p.payment_status || 'pending', now(), now());
    return q.paigaamById(id);
  },
  paigaamUpdate: (id, patch) => {
    const cur = q.paigaamById(id);
    if (!cur) return null;
    const m = { ...cur, ...patch };
    if (patch.customer_data && typeof patch.customer_data === 'object') m.customer_data = patch.customer_data;
    db.prepare(`UPDATE paigaams SET slug=?, customer_data=?, customer_name=?, status=?, payment_status=?, published_at=?, updated_at=? WHERE id=?`)
      .run(m.slug ?? null, JSON.stringify(m.customer_data || {}), m.customer_name || '',
           m.status, m.payment_status, m.published_at ?? null, now(), id);
    return q.paigaamById(id);
  },
  paigaamSlugTaken: (slug) => !!db.prepare('SELECT 1 FROM paigaams WHERE slug = ?').get(slug),
  paigaamDelete: (id) => db.prepare('DELETE FROM paigaams WHERE id = ?').run(id),
  paigaamByRecoveryToken: (token) => parse(db.prepare(`SELECT p.*, t.name AS template_name, t.slug AS template_slug, t.price AS template_price, t.list_price AS template_list_price, t.currency AS template_currency, t.config AS template_config, t.category AS template_category
                                            FROM paigaams p JOIN templates t ON t.id = p.template_id WHERE p.recovery_token = ?`).get(token), ['customer_data', 'template_config']),
  paigaamSetRecoveryToken: (id, token) => db.prepare('UPDATE paigaams SET recovery_token = ?, updated_at = ? WHERE id = ?').run(token || '', now(), id),

  // orders
  orderByRazorpayOrderId: (rzpId) => db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ? ORDER BY created_at DESC LIMIT 1').get(rzpId),
  orderMarkPaid: (id, { razorpay_payment_id = '', razorpay_signature = '' } = {}) => {
    db.prepare(`UPDATE orders SET status='paid', razorpay_payment_id=?, razorpay_signature=?, updated_at=? WHERE id=?`)
      .run(razorpay_payment_id, razorpay_signature, now(), id);
    return q.orderById(id);
  },
  ordersAll: () => db.prepare(`SELECT o.*, p.slug AS paigaam_slug, t.name AS template_name
                               FROM orders o
                               LEFT JOIN paigaams p ON p.id = o.paigaam_id
                               LEFT JOIN templates t ON t.id = p.template_id
                               ORDER BY o.created_at DESC`).all(),
  orderById: (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id),
  orderInsert: (o) => {
    const id = uid();
    db.prepare(`INSERT INTO orders (id,paigaam_id,customer_name,whatsapp,amount,currency,status,razorpay_order_id,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, o.paigaam_id, o.customer_name || '', o.whatsapp || '', o.amount | 0, o.currency || 'INR', o.status || 'pending', o.razorpay_order_id || '', now(), now());
    return q.orderById(id);
  },
  orderUpdate: (id, status) => {
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id);
    return q.orderById(id);
  },

  // "Begin where you left off": the sender's most recent draft of a template
  // (owners tables all share the shape paigaam_id/owner_hash/created_at-ms).
  recentDraftForOwner: (ownersTable, ownerHash, templateId, withinMs) => {
    if (!ownerHash) return null;
    const row = db.prepare(`SELECT o.paigaam_id FROM ${ownersTable} o
                            JOIN paigaams p ON p.id = o.paigaam_id
                            WHERE o.owner_hash = ? AND o.created_at > ? AND p.template_id = ? AND p.status IN ('draft', 'payment_pending')
                            ORDER BY o.created_at DESC LIMIT 1`)
      .get(ownerHash, Date.now() - (withinMs || 3600000), templateId);
    return row ? q.paigaamById(row.paigaam_id) : null;
  },

  // "Welcome back" popup: the sender's recent paigaams across EVERY template
  // family (paid ones matter most — a payment landed and the tab got closed).
  recentPaigaamsForOwner: (ownerHash, withinMs, limit = 3) => {
    if (!ownerHash) return [];
    const tables = ['maafi_owners', 'sawaal_owners', 'valentine_owners', 'love_owners', 'saalgirah_owners',
                    'lavender_owners', 'love_awaits_owners', 'sau_wajah_owners', 'bfday_owners',
                    'ganapati_owners', 'ganpati_courtyard_owners'];
    const rows = [];
    for (const t of tables) {
      try {
        rows.push(...db.prepare(`SELECT o.paigaam_id AS id, o.created_at AS at FROM ${t} o
                                 WHERE o.owner_hash = ? AND o.created_at > ?`).all(ownerHash, Date.now() - (withinMs || 3600000)));
      } catch (e) { /* table missing — skip */ }
    }
    rows.sort((a, b) => b.at - a.at);
    return rows.slice(0, limit).map(r => q.paigaamById(r.id)).filter(Boolean);
  },

  // settings
  settings: () => {
    let s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    if (!s) {
      db.prepare(`INSERT INTO settings (id, whatsapp_number, business_name, currency, contact_message) VALUES (1, ?, ?, ?, ?)`)
        .run(process.env.PAIGAAM_WHATSAPP || '919999999999', 'Paigaam', 'INR',
             "Hi Paigaam! I'd like to purchase a Paigaam.");
      s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    }
    return s;
  },
  settingsUpdate: (s) => {
    db.prepare(`UPDATE settings SET whatsapp_number=?, business_name=?, currency=?, contact_message=?, updated_at=? WHERE id=1`)
      .run(s.whatsapp_number || '', s.business_name || 'Paigaam', s.currency || 'INR', s.contact_message || '', now());
    return q.settings();
  },

  // admins & sessions
  adminByEmail: (email) => db.prepare('SELECT * FROM admins WHERE email = ?').get(email),
  adminById: (id) => db.prepare('SELECT id, email, created_at FROM admins WHERE id = ?').get(id),
  adminCreate: (email, password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const id = uid();
    db.prepare('INSERT INTO admins (id, email, password_hash, salt, created_at) VALUES (?,?,?,?,?)')
      .run(id, email.toLowerCase().trim(), hash, salt, now());
    return id;
  },
  adminUpdatePassword: (email, password) => {
    const a = q.adminByEmail(email);
    if (!a) return null;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    db.prepare('UPDATE admins SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, a.id);
    return a.id;
  },
  adminVerify: (email, password) => {
    const a = q.adminByEmail((email || '').toLowerCase().trim());
    if (!a) return null;
    const hash = crypto.scryptSync(password, a.salt, 64);
    const ok = crypto.timingSafeEqual(Buffer.from(a.password_hash, 'hex'), hash);
    return ok ? { id: a.id, email: a.email } : null;
  },
  sessionCreate: (adminId) => {
    const token = crypto.randomBytes(24).toString('base64url');
    const expires = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    db.prepare('INSERT INTO sessions (token, admin_id, expires_at, created_at) VALUES (?,?,?,?)')
      .run(token, adminId, expires, now());
    return token;
  },
  sessionGet: (token) => {
    if (!token) return null;
    const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (!s || s.expires_at < Date.now()) return null;
    return s;
  },
  sessionDelete: (token) => db.prepare('DELETE FROM sessions WHERE token = ?').run(token),
  sessionsPrune: () => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()),
};

module.exports = { db, q, uid, DATA_DIR, PERSISTENT };
