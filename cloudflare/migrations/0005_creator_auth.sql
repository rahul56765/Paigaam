-- Additive only. No credential or legacy data is imported by this migration.
-- Apply after 0003; operational provisioning and deployment approval remain separate.
CREATE TABLE IF NOT EXISTS creator_credentials (
 creator_id TEXT PRIMARY KEY NOT NULL REFERENCES creator_accounts(id),
 algorithm TEXT NOT NULL CHECK(algorithm IN ('scrypt-v1','legacy-scrypt-v0')),
 salt TEXT NOT NULL, password_hash TEXT NOT NULL, version TEXT NOT NULL UNIQUE,
 updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND updated_at>0)
);
CREATE TABLE IF NOT EXISTS creator_auth_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash)=64),
 creator_id TEXT NOT NULL REFERENCES creator_accounts(id),
 credential_version TEXT NOT NULL, csrf TEXT NOT NULL,
 expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer' AND expires_at>0)
);
CREATE INDEX IF NOT EXISTS creator_auth_sessions_creator ON creator_auth_sessions(creator_id);
CREATE INDEX IF NOT EXISTS creator_auth_sessions_expiry ON creator_auth_sessions(expires_at);
-- Any credential change, including reset, atomically revokes every old session.
CREATE TRIGGER IF NOT EXISTS creator_credentials_revoke AFTER UPDATE ON creator_credentials
BEGIN DELETE FROM creator_auth_sessions WHERE creator_id=OLD.creator_id; END;
CREATE TRIGGER IF NOT EXISTS creator_credentials_revoke_delete AFTER DELETE ON creator_credentials
BEGIN DELETE FROM creator_auth_sessions WHERE creator_id=OLD.creator_id; END;
CREATE TRIGGER IF NOT EXISTS creator_credentials_id_guard BEFORE UPDATE ON creator_credentials
WHEN NEW.creator_id IS NOT OLD.creator_id
BEGIN SELECT RAISE(ABORT,'credential owner immutable'); END;
-- Fixed-window counters, shared by all isolates through D1; keys are keyed digests.
CREATE TABLE IF NOT EXISTS creator_auth_rate_limits (
 bucket TEXT PRIMARY KEY NOT NULL, window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL CHECK(typeof(attempts)='integer' AND attempts>0)
);
CREATE INDEX IF NOT EXISTS creator_auth_rate_expiry ON creator_auth_rate_limits(window_start);
