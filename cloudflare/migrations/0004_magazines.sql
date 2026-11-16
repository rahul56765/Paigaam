-- Additive isolated state only. No OAuth credentials, token storage or legacy import.
CREATE TABLE magazine_template_versions (
 id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL, mapping_json TEXT NOT NULL CHECK(json_valid(mapping_json) AND json_type(mapping_json)='object'),
 amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise BETWEEN 0 AND 1000000000000),
 currency TEXT NOT NULL CHECK(currency='INR'), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE magazine_drafts (
 id TEXT PRIMARY KEY NOT NULL, owner_hash TEXT NOT NULL CHECK(length(owner_hash)=64 AND owner_hash NOT GLOB '*[^0-9a-f]*'),
 template_version_id TEXT NOT NULL REFERENCES magazine_template_versions(id), fields_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields_json) AND json_type(fields_json)='object'),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','payment_pending','queued','running','ready','failed')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX magazine_drafts_owner ON magazine_drafts(owner_hash,created_at);
CREATE TABLE magazine_uploads_v2 (
 draft_id TEXT NOT NULL REFERENCES magazine_drafts(id), slot TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')), bytes INTEGER NOT NULL CHECK(typeof(bytes)='integer' AND bytes>0),
 width INTEGER NOT NULL CHECK(typeof(width)='integer' AND width>0), height INTEGER NOT NULL CHECK(typeof(height)='integer' AND height>0),
 PRIMARY KEY(draft_id,slot)
);
CREATE TABLE magazine_checkouts (
 draft_id TEXT PRIMARY KEY NOT NULL REFERENCES magazine_drafts(id), amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise BETWEEN 0 AND 1000000000000),
 currency TEXT NOT NULL CHECK(currency='INR'), status TEXT NOT NULL CHECK(status IN ('creating','pending','paid')),
 gateway_order_id TEXT UNIQUE, gateway_payment_id TEXT UNIQUE,
 CHECK((amount_paise=0 AND status='paid' AND gateway_order_id IS NULL AND gateway_payment_id IS NULL) OR
 (amount_paise>0 AND ((status='creating' AND gateway_order_id IS NULL AND gateway_payment_id IS NULL) OR
 (status='pending' AND gateway_order_id IS NOT NULL AND length(gateway_order_id)>0 AND gateway_payment_id IS NULL) OR
 (status='paid' AND gateway_order_id IS NOT NULL AND length(gateway_order_id)>0 AND gateway_payment_id IS NOT NULL AND length(gateway_payment_id)>0))))
);
CREATE TABLE magazine_jobs (
 draft_id TEXT PRIMARY KEY NOT NULL REFERENCES magazine_checkouts(draft_id), status TEXT NOT NULL CHECK(status IN ('queued','running','ready','failed')),
 result_json TEXT CHECK(result_json IS NULL OR (json_valid(result_json) AND json_type(result_json)='object')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK((status IN ('ready','failed') AND result_json IS NOT NULL) OR (status IN ('queued','running') AND result_json IS NULL))
);
CREATE TRIGGER magazine_template_no_update BEFORE UPDATE ON magazine_template_versions BEGIN SELECT RAISE(ABORT,'immutable template version'); END;
CREATE TRIGGER magazine_template_no_delete BEFORE DELETE ON magazine_template_versions BEGIN SELECT RAISE(ABORT,'immutable template version'); END;
CREATE TRIGGER magazine_draft_guard BEFORE UPDATE ON magazine_drafts WHEN NEW.id IS NOT OLD.id OR NEW.owner_hash IS NOT OLD.owner_hash OR NEW.template_version_id IS NOT OLD.template_version_id OR (OLD.status!='draft' AND NEW.fields_json IS NOT OLD.fields_json) BEGIN SELECT RAISE(ABORT,'immutable draft facts'); END;
CREATE TRIGGER magazine_draft_no_delete BEFORE DELETE ON magazine_drafts BEGIN SELECT RAISE(ABORT,'draft deletion not implemented'); END;
CREATE TRIGGER magazine_upload_insert_guard BEFORE INSERT ON magazine_uploads_v2 WHEN NOT EXISTS(SELECT 1 FROM magazine_drafts d JOIN magazine_template_versions t ON t.id=d.template_version_id, json_each(t.mapping_json,'$.images') i WHERE d.id=NEW.draft_id AND d.status='draft' AND json_extract(i.value,'$.key')=NEW.slot) BEGIN SELECT RAISE(ABORT,'upload locked or unknown slot'); END;
CREATE TRIGGER magazine_upload_update_guard BEFORE UPDATE ON magazine_uploads_v2 WHEN NEW.draft_id IS NOT OLD.draft_id OR NEW.slot IS NOT OLD.slot OR NOT EXISTS(SELECT 1 FROM magazine_drafts WHERE id=OLD.draft_id AND status='draft') BEGIN SELECT RAISE(ABORT,'upload locked'); END;
CREATE TRIGGER magazine_upload_delete_guard BEFORE DELETE ON magazine_uploads_v2 WHEN NOT EXISTS(SELECT 1 FROM magazine_drafts WHERE id=OLD.draft_id AND status='draft') BEGIN SELECT RAISE(ABORT,'upload locked'); END;
CREATE TRIGGER magazine_checkout_guard BEFORE INSERT ON magazine_checkouts BEGIN
 SELECT CASE WHEN NOT ((NEW.amount_paise=0 AND NEW.status='paid') OR (NEW.amount_paise>0 AND NEW.status='creating')) OR NOT EXISTS(SELECT 1 FROM magazine_drafts d JOIN magazine_template_versions t ON t.id=d.template_version_id WHERE d.id=NEW.draft_id AND d.status='draft' AND t.amount_paise=NEW.amount_paise AND t.currency=NEW.currency) THEN RAISE(ABORT,'quote or draft mismatch') END;
END;
CREATE TRIGGER magazine_checkout_lock AFTER INSERT ON magazine_checkouts BEGIN
 UPDATE magazine_drafts SET status=CASE WHEN NEW.status='paid' THEN 'queued' ELSE 'payment_pending' END,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.draft_id AND status='draft';
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'lock failed') END;
 INSERT INTO magazine_jobs(draft_id,status) SELECT NEW.draft_id,'queued' WHERE NEW.status='paid';
END;
CREATE TRIGGER magazine_checkout_update_guard BEFORE UPDATE ON magazine_checkouts WHEN
 NEW.draft_id IS NOT OLD.draft_id OR NEW.amount_paise IS NOT OLD.amount_paise OR NEW.currency IS NOT OLD.currency OR
 NOT ((OLD.status='creating' AND NEW.status='pending' AND OLD.gateway_order_id IS NULL AND NEW.gateway_order_id IS NOT NULL AND NEW.gateway_payment_id IS NULL) OR
 (OLD.status='pending' AND NEW.status='paid' AND NEW.gateway_order_id IS OLD.gateway_order_id AND NEW.gateway_payment_id IS NOT NULL))
 BEGIN SELECT RAISE(ABORT,'immutable checkout or invalid transition'); END;
CREATE TRIGGER magazine_checkout_no_delete BEFORE DELETE ON magazine_checkouts BEGIN SELECT RAISE(ABORT,'checkout deletion not implemented'); END;
CREATE TRIGGER magazine_checkout_paid AFTER UPDATE ON magazine_checkouts WHEN NEW.status='paid' BEGIN
 UPDATE magazine_drafts SET status='queued',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.draft_id AND status='payment_pending';
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'payment lock missing') END;
 INSERT INTO magazine_jobs(draft_id,status) VALUES(NEW.draft_id,'queued');
END;
CREATE TRIGGER magazine_job_guard BEFORE UPDATE ON magazine_jobs WHEN NEW.draft_id IS NOT OLD.draft_id OR NOT ((OLD.status='queued' AND NEW.status='running' AND NEW.result_json IS NULL) OR (OLD.status='running' AND NEW.status IN ('ready','failed') AND NEW.result_json IS NOT NULL)) BEGIN SELECT RAISE(ABORT,'terminal or invalid job transition'); END;
CREATE TRIGGER magazine_job_no_delete BEFORE DELETE ON magazine_jobs BEGIN SELECT RAISE(ABORT,'job deletion not implemented'); END;
CREATE TRIGGER magazine_job_sync AFTER UPDATE ON magazine_jobs BEGIN
 UPDATE magazine_drafts SET status=NEW.status,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=NEW.draft_id AND status=OLD.status;
 SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'job state mismatch') END;
END;
