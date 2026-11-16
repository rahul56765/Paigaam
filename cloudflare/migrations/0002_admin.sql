-- Fresh Cloudflare admin only; no legacy credentials or sessions are imported.
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash) = 64),
  config_hash TEXT NOT NULL CHECK(length(config_hash) = 64),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX admin_sessions_expiry ON admin_sessions(expires_at);
-- One shared, durable global login budget, deliberately independent of user/IP.
CREATE TABLE admin_login_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts > 0),
  window_until INTEGER NOT NULL
);
