'use strict';
// Additive only: independent creator tables in the application's existing database.
module.exports = function initialize(db) {
  require('./backup')(db);
  db.exec(`
CREATE TABLE IF NOT EXISTS partner_creators (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
 commission_bps INTEGER NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000),
 coupon_code TEXT NOT NULL UNIQUE COLLATE NOCASE, discount_bps INTEGER NOT NULL CHECK(discount_bps BETWEEN 0 AND 9000),
 active INTEGER NOT NULL CHECK(active IN (0,1)), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS partner_sessions (
 token_hash TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES partner_creators(id),
 csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS partner_clicks (
 id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES partner_creators(id),
 visitor_hash TEXT NOT NULL, path TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS partner_clicks_creator ON partner_clicks(creator_id,created_at);
CREATE TABLE IF NOT EXISTS partner_orders (
 gateway_order_id TEXT PRIMARY KEY, product_id TEXT NOT NULL, product_type TEXT NOT NULL,
 template_slug TEXT NOT NULL, visitor_hash TEXT NOT NULL DEFAULT '',
 creator_id TEXT REFERENCES partner_creators(id), coupon_code TEXT NOT NULL,
 commission_bps INTEGER NOT NULL CHECK(commission_bps BETWEEN 0 AND 10000),
 discount_paise INTEGER NOT NULL CHECK(discount_paise >= 0), gross_paise INTEGER NOT NULL,
 amount_paise INTEGER NOT NULL CHECK(amount_paise >= 100), currency TEXT NOT NULL CHECK(currency='INR'),
 commission_paise INTEGER NOT NULL CHECK(commission_paise >= 0),
 status TEXT NOT NULL DEFAULT 'reserved', created_at TEXT NOT NULL,
 paid_at TEXT, payment_id TEXT UNIQUE, credited INTEGER NOT NULL DEFAULT 0 CHECK(credited IN (0,1)),
 CHECK(gross_paise = amount_paise + discount_paise));
CREATE UNIQUE INDEX IF NOT EXISTS partner_orders_credit ON partner_orders(product_type,product_id) WHERE credited=1;
CREATE INDEX IF NOT EXISTS partner_orders_creator ON partner_orders(creator_id,created_at);
CREATE TABLE IF NOT EXISTS partner_refunds (
 refund_id TEXT PRIMARY KEY, payment_id TEXT NOT NULL, amount_paise INTEGER NOT NULL CHECK(amount_paise > 0),
 created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS partner_refunds_payment ON partner_refunds(payment_id);
CREATE TABLE IF NOT EXISTS partner_payouts (
 id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES partner_creators(id),
 amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), currency TEXT NOT NULL CHECK(currency='INR'),
 reference TEXT NOT NULL, note TEXT NOT NULL, paid_at TEXT NOT NULL, created_at TEXT NOT NULL,
 idempotency_key TEXT NOT NULL UNIQUE, actor_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS partner_ledger (
 id TEXT PRIMARY KEY, creator_id TEXT NOT NULL REFERENCES partner_creators(id),
 kind TEXT NOT NULL CHECK(kind IN ('commission','refund','payout')), amount_paise INTEGER NOT NULL,
 event_key TEXT NOT NULL UNIQUE, gateway_order_id TEXT, payout_id TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS partner_ledger_creator ON partner_ledger(creator_id);
CREATE TABLE IF NOT EXISTS partner_fulfillment (gateway_order_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS partner_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL,
 details TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS partner_order_snapshot BEFORE UPDATE ON partner_orders
 WHEN NEW.gateway_order_id IS NOT OLD.gateway_order_id OR NEW.product_id IS NOT OLD.product_id
 OR NEW.product_type IS NOT OLD.product_type OR NEW.template_slug IS NOT OLD.template_slug
 OR NEW.visitor_hash IS NOT OLD.visitor_hash OR NEW.creator_id IS NOT OLD.creator_id
 OR NEW.coupon_code IS NOT OLD.coupon_code OR NEW.commission_bps IS NOT OLD.commission_bps
 OR NEW.discount_paise IS NOT OLD.discount_paise OR NEW.gross_paise IS NOT OLD.gross_paise
 OR NEW.amount_paise IS NOT OLD.amount_paise OR NEW.currency IS NOT OLD.currency
 OR NEW.commission_paise IS NOT OLD.commission_paise OR NEW.created_at IS NOT OLD.created_at
 BEGIN SELECT RAISE(ABORT,'immutable order snapshot'); END;
CREATE TRIGGER IF NOT EXISTS partner_order_no_delete BEFORE DELETE ON partner_orders BEGIN SELECT RAISE(ABORT,'immutable order'); END;
`);
  // Explicit ADD COLUMN migrations also upgrade databases created by earlier releases.
  // Defaults are compatibility metadata only: never recalculate historical money.
  const couponColumns = {
    discount_type: "TEXT NOT NULL DEFAULT 'percentage' CHECK(discount_type IN ('percentage','flat'))",
    discount_flat_paise: 'INTEGER NOT NULL DEFAULT 0 CHECK(discount_flat_paise BETWEEN 0 AND 1000000000000)',
    discount_min_paise: 'INTEGER NOT NULL DEFAULT 0 CHECK(discount_min_paise BETWEEN 0 AND 1000000000000)',
    discount_max_paise: 'INTEGER NOT NULL DEFAULT 0 CHECK(discount_max_paise BETWEEN 0 AND 1000000000000)',
    coupon_expires_at: "TEXT NOT NULL DEFAULT ''"
  };
  const addColumns = (table, columns) => {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  };
  addColumns('partner_creators', {
    profile_image: "TEXT NOT NULL DEFAULT ''", ...couponColumns,
    coupon_enabled: 'INTEGER NOT NULL DEFAULT 1 CHECK(coupon_enabled IN (0,1))'
  });
  addColumns('partner_orders', couponColumns);
  // Keep the original financial trigger intact; this protects only the additive metadata.
  db.exec(`CREATE TRIGGER IF NOT EXISTS partner_order_coupon_snapshot BEFORE UPDATE ON partner_orders
    WHEN NEW.discount_type IS NOT OLD.discount_type
    OR NEW.discount_flat_paise IS NOT OLD.discount_flat_paise
    OR NEW.discount_min_paise IS NOT OLD.discount_min_paise
    OR NEW.discount_max_paise IS NOT OLD.discount_max_paise
    OR NEW.coupon_expires_at IS NOT OLD.coupon_expires_at
    BEGIN SELECT RAISE(ABORT,'immutable order snapshot'); END;`);
  for (const table of ['partner_ledger','partner_payouts','partner_refunds','partner_audit']) {
    for (const op of ['UPDATE','DELETE']) db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_${op.toLowerCase()} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT,'immutable financial event'); END;`);
  }
};
