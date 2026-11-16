-- Fresh, isolated Cloudflare D1 database. No legacy/Railway data is imported.
PRAGMA foreign_keys = ON;

CREATE TABLE templates (
  slug TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  config TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 18 AND id NOT GLOB '*[^0-9a-f]*'),
  template_slug TEXT NOT NULL REFERENCES templates(slug),
  public_slug TEXT UNIQUE,
  owner_hash TEXT NOT NULL CHECK (length(owner_hash) > 0),
  customer_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(customer_data)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','payment_pending','published')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK ((status = 'published' AND public_slug IS NOT NULL AND length(public_slug) > 0)
      OR (status != 'published' AND public_slug IS NULL))
);
CREATE INDEX invites_owner ON invites(owner_hash, created_at);

CREATE TABLE uploads (
  key TEXT PRIMARY KEY NOT NULL,
  invite_id TEXT NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX uploads_invite ON uploads(invite_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  invite_id TEXT NOT NULL REFERENCES invites(id),
  gateway_order_id TEXT UNIQUE CHECK (gateway_order_id IS NULL OR length(gateway_order_id) > 0),
  gateway_payment_id TEXT UNIQUE CHECK (gateway_payment_id IS NULL OR length(gateway_payment_id) > 0),
  -- Integer minor units, matching the gateway (paise for INR), NEVER rupees/floats.
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','pending','paid','failed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (status NOT IN ('pending','paid') OR gateway_order_id IS NOT NULL),
  CHECK ((status = 'paid' AND gateway_payment_id IS NOT NULL) OR (status != 'paid' AND gateway_payment_id IS NULL))
);
-- SQL, not isolate-local memory, owns checkout exclusion. A paid intent also
-- excludes a second successful intent for the same invite forever.
CREATE UNIQUE INDEX orders_live_invite ON orders(invite_id) WHERE status IN ('creating','pending','paid');
CREATE INDEX orders_invite ON orders(invite_id);
