-- Additive creator accounting; deliberately no legacy import or payment operations.
CREATE TABLE creator_accounts (
 id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 display_name TEXT NOT NULL, commission_bps INTEGER NOT NULL CHECK(typeof(commission_bps)='integer' AND commission_bps BETWEEN 0 AND 10000),
 active INTEGER NOT NULL CHECK(active IN (0,1)), actor TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE creator_offers (
 code TEXT PRIMARY KEY NOT NULL COLLATE NOCASE, source TEXT NOT NULL CHECK(source IN ('creator','paigaam')),
 creator_id TEXT REFERENCES creator_accounts(id), discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage','flat')),
 discount_bps INTEGER NOT NULL CHECK(typeof(discount_bps)='integer' AND discount_bps BETWEEN 0 AND 9000),
 discount_flat_paise INTEGER NOT NULL CHECK(typeof(discount_flat_paise)='integer' AND discount_flat_paise BETWEEN 0 AND 1000000000000),
 discount_min_paise INTEGER NOT NULL CHECK(typeof(discount_min_paise)='integer' AND discount_min_paise BETWEEN 0 AND 1000000000000),
 discount_max_paise INTEGER NOT NULL CHECK(typeof(discount_max_paise)='integer' AND discount_max_paise BETWEEN 0 AND 1000000000000),
 expires_at TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), description TEXT NOT NULL, actor TEXT NOT NULL,
 CHECK((source='creator' AND creator_id IS NOT NULL) OR (source='paigaam' AND creator_id IS NULL)),
 CHECK(discount_type!='flat' OR discount_flat_paise>0)
);
CREATE TABLE creator_referrals (
 token_hash TEXT PRIMARY KEY NOT NULL, creator_id TEXT NOT NULL REFERENCES creator_accounts(id), expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer' AND expires_at>0)
);
CREATE TABLE creator_checkout_snapshots (
 order_id TEXT PRIMARY KEY NOT NULL REFERENCES orders(id), idempotency_key TEXT NOT NULL UNIQUE,
 request_json TEXT NOT NULL CHECK(json_valid(request_json)), snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 creator_id TEXT REFERENCES creator_accounts(id), amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise BETWEEN 100 AND 1000000000000),
 commission_paise INTEGER NOT NULL CHECK(typeof(commission_paise)='integer' AND commission_paise BETWEEN 0 AND amount_paise),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER creator_snapshot_guard BEFORE INSERT ON creator_checkout_snapshots BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM orders WHERE id=NEW.order_id AND status='creating' AND amount=NEW.amount_paise AND currency='INR') THEN RAISE(ABORT,'canonical order mismatch') END;
END;
CREATE TABLE creator_sales (
 order_id TEXT PRIMARY KEY NOT NULL REFERENCES creator_checkout_snapshots(order_id), invite_id TEXT NOT NULL UNIQUE REFERENCES invites(id),
 payment_id TEXT NOT NULL UNIQUE, creator_id TEXT REFERENCES creator_accounts(id), amount_paise INTEGER NOT NULL,
 commission_paise INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER creator_sale_guard BEFORE INSERT ON creator_sales BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM orders o JOIN creator_checkout_snapshots s ON s.order_id=o.id
 WHERE o.id=NEW.order_id AND o.status='paid' AND o.gateway_payment_id=NEW.payment_id AND o.invite_id=NEW.invite_id
 AND o.amount=NEW.amount_paise AND o.currency='INR' AND s.amount_paise=NEW.amount_paise
 AND s.creator_id IS NEW.creator_id AND s.commission_paise=NEW.commission_paise)
 THEN RAISE(ABORT,'sale does not match canonical paid order') END;
END;
CREATE TABLE creator_refunds (
 refund_id TEXT PRIMARY KEY NOT NULL, payment_id TEXT NOT NULL REFERENCES creator_sales(payment_id),
 amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise BETWEEN 1 AND 1000000000000),
 prior_paise INTEGER NOT NULL CHECK(typeof(prior_paise)='integer' AND prior_paise>=0),
 reversal_paise INTEGER NOT NULL CHECK(typeof(reversal_paise)='integer' AND reversal_paise>=0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX creator_refunds_payment ON creator_refunds(payment_id);
CREATE TRIGGER creator_refund_guard BEFORE INSERT ON creator_refunds BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM creator_sales s WHERE s.payment_id=NEW.payment_id
 AND NEW.prior_paise=(SELECT COALESCE(SUM(amount_paise),0) FROM creator_refunds WHERE payment_id=NEW.payment_id)
 AND NEW.prior_paise+NEW.amount_paise<=s.amount_paise) THEN RAISE(ABORT,'refund conflict or exceeds payment') END;
END;
CREATE TABLE creator_payouts (
 id TEXT PRIMARY KEY NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, creator_id TEXT NOT NULL REFERENCES creator_accounts(id),
 amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise BETWEEN 1 AND 1000000000000),
 reference TEXT NOT NULL, note TEXT NOT NULL, paid_at TEXT NOT NULL, actor TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE creator_ledger (
 source_key TEXT PRIMARY KEY NOT NULL, creator_id TEXT NOT NULL REFERENCES creator_accounts(id),
 kind TEXT NOT NULL CHECK(kind IN ('commission','refund','payout')), amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer'),
 order_id TEXT REFERENCES creator_checkout_snapshots(order_id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX creator_ledger_account ON creator_ledger(creator_id);
CREATE TABLE creator_audit (
 id TEXT PRIMARY KEY NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, details TEXT NOT NULL CHECK(json_valid(details)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER creator_account_audit AFTER INSERT ON creator_accounts BEGIN
 INSERT INTO creator_audit(id,actor,action,entity_id,details) VALUES ('creator:'||NEW.id,NEW.actor,'creator.create',NEW.id,json_object('username',NEW.username,'display_name',NEW.display_name,'commission_bps',NEW.commission_bps,'active',NEW.active));
END;
CREATE TRIGGER creator_offer_audit AFTER INSERT ON creator_offers BEGIN
 INSERT INTO creator_audit(id,actor,action,entity_id,details) VALUES ('offer:'||NEW.code,NEW.actor,'offer.create',NEW.code,json_object('source',NEW.source,'creator_id',NEW.creator_id,'discount_type',NEW.discount_type,'discount_bps',NEW.discount_bps,'discount_flat_paise',NEW.discount_flat_paise,'discount_min_paise',NEW.discount_min_paise,'discount_max_paise',NEW.discount_max_paise,'expires_at',NEW.expires_at,'enabled',NEW.enabled,'description',NEW.description));
END;
CREATE TRIGGER creator_sale_ledger AFTER INSERT ON creator_sales WHEN NEW.creator_id IS NOT NULL BEGIN
 INSERT INTO creator_ledger(source_key,creator_id,kind,amount_paise,order_id) VALUES ('sale:'||NEW.order_id,NEW.creator_id,'commission',NEW.commission_paise,NEW.order_id);
END;
CREATE TRIGGER creator_refund_ledger AFTER INSERT ON creator_refunds WHEN NEW.reversal_paise>0 BEGIN
 INSERT INTO creator_ledger(source_key,creator_id,kind,amount_paise,order_id)
 SELECT 'refund:'||NEW.refund_id,creator_id,'refund',-NEW.reversal_paise,order_id FROM creator_sales WHERE payment_id=NEW.payment_id AND creator_id IS NOT NULL;
END;
CREATE TRIGGER creator_payout_guard BEFORE INSERT ON creator_payouts BEGIN
 SELECT CASE WHEN (SELECT COALESCE(SUM(amount_paise),0) FROM creator_ledger WHERE creator_id=NEW.creator_id)<NEW.amount_paise THEN RAISE(ABORT,'insufficient balance') END;
END;
CREATE TRIGGER creator_payout_events AFTER INSERT ON creator_payouts BEGIN
 INSERT INTO creator_ledger(source_key,creator_id,kind,amount_paise) VALUES ('payout:'||NEW.idempotency_key,NEW.creator_id,'payout',-NEW.amount_paise);
 INSERT INTO creator_audit(id,actor,action,entity_id,details) VALUES ('payout:'||NEW.id,NEW.actor,'payout.record',NEW.id,json_object('creator_id',NEW.creator_id,'amount_paise',NEW.amount_paise,'reference',NEW.reference));
END;
CREATE TRIGGER creator_checkout_snapshots_no_UPDATE BEFORE UPDATE ON creator_checkout_snapshots BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_checkout_snapshots_no_DELETE BEFORE DELETE ON creator_checkout_snapshots BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_sales_no_UPDATE BEFORE UPDATE ON creator_sales BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_sales_no_DELETE BEFORE DELETE ON creator_sales BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_refunds_no_UPDATE BEFORE UPDATE ON creator_refunds BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_refunds_no_DELETE BEFORE DELETE ON creator_refunds BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_payouts_no_UPDATE BEFORE UPDATE ON creator_payouts BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_payouts_no_DELETE BEFORE DELETE ON creator_payouts BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_ledger_no_UPDATE BEFORE UPDATE ON creator_ledger BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_ledger_no_DELETE BEFORE DELETE ON creator_ledger BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_audit_no_UPDATE BEFORE UPDATE ON creator_audit BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
CREATE TRIGGER creator_audit_no_DELETE BEFORE DELETE ON creator_audit BEGIN SELECT RAISE(ABORT,'immutable creator record'); END;
-- Until a versioned, audited update workflow exists, disallow edits to quote inputs.
CREATE TRIGGER creator_accounts_no_update BEFORE UPDATE ON creator_accounts BEGIN SELECT RAISE(ABORT,'creator edits not implemented'); END;
CREATE TRIGGER creator_accounts_no_delete BEFORE DELETE ON creator_accounts BEGIN SELECT RAISE(ABORT,'creator deletion not implemented'); END;
CREATE TRIGGER creator_offers_no_update BEFORE UPDATE ON creator_offers BEGIN SELECT RAISE(ABORT,'offer edits not implemented'); END;
CREATE TRIGGER creator_offers_no_delete BEFORE DELETE ON creator_offers BEGIN SELECT RAISE(ABORT,'offer deletion not implemented'); END;
CREATE TRIGGER creator_referrals_no_update BEFORE UPDATE ON creator_referrals BEGIN SELECT RAISE(ABORT,'immutable referral'); END;
CREATE TRIGGER creator_snapshot_fresh BEFORE INSERT ON creator_checkout_snapshots BEGIN
 SELECT CASE WHEN json_extract(NEW.snapshot_json,'$.coupon_code')!='' AND NOT EXISTS (
   SELECT 1 FROM creator_offers o LEFT JOIN creator_accounts a ON a.id=o.creator_id
   WHERE o.code=json_extract(NEW.snapshot_json,'$.coupon_code') COLLATE NOCASE AND o.enabled=1
   AND (o.expires_at='' OR julianday(o.expires_at)>julianday('now'))
   AND (o.source!='creator' OR a.active=1)
 ) THEN RAISE(ABORT,'coupon no longer valid') END;
 SELECT CASE WHEN NEW.creator_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM creator_accounts a WHERE a.id=NEW.creator_id AND a.active=1
   AND a.commission_bps=json_extract(NEW.snapshot_json,'$.commission_bps')
   AND (json_extract(NEW.snapshot_json,'$.coupon_source')='creator' OR EXISTS (
    SELECT 1 FROM creator_referrals r WHERE r.token_hash=json_extract(NEW.request_json,'$.referral_hash') AND r.creator_id=a.id
    AND r.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)))
 ) THEN RAISE(ABORT,'attribution no longer valid') END;
END;
-- Protect canonical facts after a checkout has been snapshotted.
CREATE TRIGGER creator_canonical_order_guard BEFORE UPDATE ON orders
WHEN EXISTS(SELECT 1 FROM creator_checkout_snapshots WHERE order_id=OLD.id)
 AND (NEW.id IS NOT OLD.id OR NEW.invite_id IS NOT OLD.invite_id OR NEW.amount IS NOT OLD.amount OR NEW.currency IS NOT OLD.currency
 OR (OLD.gateway_order_id IS NOT NULL AND NEW.gateway_order_id IS NOT OLD.gateway_order_id)
 OR (OLD.status='paid' AND (NEW.status!='paid' OR NEW.gateway_payment_id IS NOT OLD.gateway_payment_id)))
BEGIN SELECT RAISE(ABORT,'immutable canonical financial facts'); END;
CREATE TRIGGER creator_sale_from_canonical AFTER UPDATE OF status ON orders
WHEN NEW.status='paid' AND OLD.status!='paid' AND EXISTS(SELECT 1 FROM creator_checkout_snapshots WHERE order_id=NEW.id)
BEGIN
 INSERT INTO creator_sales(order_id,invite_id,payment_id,creator_id,amount_paise,commission_paise)
 SELECT NEW.id,NEW.invite_id,NEW.gateway_payment_id,creator_id,NEW.amount,commission_paise FROM creator_checkout_snapshots WHERE order_id=NEW.id;
END;
-- Verify cumulative half-up reversal with exact 64-bit arithmetic. Split into
-- base 10^6 limbs: all intermediates stay below 2*10^18 for the 10^12 cap.
CREATE TRIGGER creator_refund_exact BEFORE INSERT ON creator_refunds BEGIN
 SELECT CASE WHEN NEW.reversal_paise != (
   WITH inputs(n,sign) AS (VALUES(NEW.prior_paise+NEW.amount_paise,1),(NEW.prior_paise,-1)),
   pieces AS (SELECT n,sign,s.amount_paise AS d,s.commission_paise AS c,
      (s.commission_paise/1000000)*n AS hi FROM inputs JOIN creator_sales s ON s.payment_id=NEW.payment_id),
   limbs AS (SELECT *, (hi%d)*1000000+(c%1000000)*n AS lo FROM pieces)
   SELECT SUM(sign*((hi/d)*1000000+lo/d+CASE WHEN lo%d >= (d+1)/2 THEN 1 ELSE 0 END)) FROM limbs
 ) THEN RAISE(ABORT,'incorrect refund reversal') END;
END;
-- The dedicated creator checkout path locks the invite in the same statement
-- that creates its snapshot; trigger errors roll the entire D1 batch back.
CREATE TRIGGER creator_checkout_lock AFTER INSERT ON creator_checkout_snapshots
WHEN json_extract(NEW.request_json,'$.invite_id') IS NOT NULL
BEGIN
 UPDATE invites SET status='payment_pending',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE id=json_extract(NEW.request_json,'$.invite_id') AND status='draft'
 AND id=(SELECT invite_id FROM orders WHERE id=NEW.order_id);
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'creator checkout lock failed') END;
END;
