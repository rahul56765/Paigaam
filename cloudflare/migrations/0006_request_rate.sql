-- Additive, un-applied staging migration. No existing data or table is changed.
-- HMAC digests are pseudonymous, not anonymous; never store raw client IPs.
CREATE TABLE request_rate_counters (
  ip_digest TEXT NOT NULL CHECK (length(ip_digest) = 64 AND ip_digest NOT GLOB '*[^0-9a-f]*'),
  action TEXT NOT NULL CHECK (action IN ('draft_create','draft_update','upload','publish','preview_post')),
  window_start INTEGER NOT NULL CHECK (window_start >= 0),
  window_end INTEGER NOT NULL CHECK (window_end > window_start),
  hits INTEGER NOT NULL CHECK (hits > 0),
  PRIMARY KEY (ip_digest, action)
) WITHOUT ROWID;

CREATE INDEX request_rate_expiry ON request_rate_counters(window_end);
