/**
 * Isolated Cloudflare D1 metadata store; R2 holds object bytes at uploads.key.
 * Every export is async and accepts a D1Database as its first argument.
 * Rows use snake_case SQL names; config/customer_data are parsed JSON objects.
 * Missing rows / denied conditional mutations return null (not exceptions).
 * Invalid arguments and DB constraint failures throw. Keep owner_hash internal.
 * Money is an integer in gateway minor units. HTTP handlers own auth, schema,
 * MIME/content verification, payment signature/captured/amount verification and
 * R2 upload/delete compensation; this module never calls a payment provider.
 * D1 batch() MUST be transactional (Cloudflare's contract), including on error.
 */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
// invites.created_at uses this same UTC ISO-8601 format, including milliseconds.
// Using SQLite's datetime() here would introduce a space instead of 'T' and
// make a lexical comparison against created_at incorrect on the boundary date.
const DAY_AGO = "strftime('%Y-%m-%dT%H:%M:%fZ','now','-24 hours')";
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
const decode = row => row ? Object.fromEntries(Object.entries(row).map(([k, v]) =>
  [k, (k === 'config' || k === 'customer_data') && typeof v === 'string' ? JSON.parse(v) : v])) : null;
const hex18 = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(16).padStart(2, '0')).join('');
function nonempty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a nonempty string`);
  return value;
}
function money(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('amount must be nonnegative integer minor units');
  return value;
}
function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`);
  return value;
}
function json(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('data/config must be an object');
  return JSON.stringify(value);
}

/** seedTemplates(db, templates) -> number inserted. Existing catalog rows are never overwritten. */
export async function seedTemplates(db, templates) {
  const statements = templates.map(t => stmt(db,
    'INSERT INTO templates(slug,name,price,currency,config) VALUES(?,?,?,?,?) ON CONFLICT(slug) DO NOTHING',
    nonempty(t.slug, 'slug'), nonempty(t.name, 'name'), money(t.price ?? 0), nonempty(t.currency ?? 'INR', 'currency'), json(t.config ?? {})));
  if (!statements.length) return 0;
  const results = await db.batch(statements);
  return results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
}
/** getTemplate(db, slug) -> template|null. price is integer minor units. */
export async function getTemplate(db, slug) {
  return decode(await stmt(db, 'SELECT * FROM templates WHERE slug=?', slug).first());
}
/** listTemplates(db) -> template[], stable slug ordering. */
export async function listTemplates(db) {
  return (await stmt(db, 'SELECT * FROM templates ORDER BY slug').all()).results.map(decode);
}
/** getInvite(db, id) -> invite|null. Includes owner_hash: never send raw row publicly. */
export async function getInvite(db, id) {
  return decode(await stmt(db, 'SELECT * FROM invites WHERE id=?', id).first());
}
/** getInviteByPublicSlug(db, publicSlug) -> published invite|null. Internal row. */
export async function getInviteByPublicSlug(db, publicSlug) {
  return decode(await stmt(db, "SELECT * FROM invites WHERE public_slug=? AND status='published'", publicSlug).first());
}
/** createInvite(db, slug, ownerHash, data, {maxPerOwnerTemplate24h,maxGlobal24h}) -> invite|null.
 * Both limits are REQUIRED positive safe integers chosen by server policy, never
 * by a request. Counts include every status and the cutoff instant itself. A
 * single conditional INSERT makes both rolling 24-hour checks atomic. A null
 * result means admission was denied without revealing which quota was hit.
 * IDs are 18 random hex characters; returned rows are internal (owner_hash).
 */
export async function createInvite(db, slug, ownerHash, data, { maxPerOwnerTemplate24h, maxGlobal24h } = {}) {
  positiveSafeInteger(maxPerOwnerTemplate24h, 'maxPerOwnerTemplate24h');
  positiveSafeInteger(maxGlobal24h, 'maxGlobal24h');
  const templateSlug = nonempty(slug, 'slug'), owner = nonempty(ownerHash, 'ownerHash');
  return decode(await stmt(db, `INSERT INTO invites(id,template_slug,owner_hash,customer_data)
    SELECT ?,?,?,?
    WHERE (SELECT count(*) FROM invites WHERE owner_hash=? AND template_slug=?
      AND created_at>=${DAY_AGO}) < ?
      AND (SELECT count(*) FROM invites WHERE created_at>=${DAY_AGO}) < ?
    RETURNING *`, hex18(), templateSlug, owner, json(data), owner, templateSlug,
  maxPerOwnerTemplate24h, maxGlobal24h).first());
}
/** updateInvite(db, id, ownerHash, data) -> updated invite|null; replaces JSON only while owned draft. */
export async function updateInvite(db, id, ownerHash, data) {
  return decode(await stmt(db, `UPDATE invites SET customer_data=?,updated_at=${NOW}
    WHERE id=? AND owner_hash=? AND status='draft' RETURNING *`, json(data), id, ownerHash).first());
}
/** listUploads(db, id) -> upload[]; authorization is the caller's responsibility. */
export async function listUploads(db, id) {
  return (await stmt(db, 'SELECT * FROM uploads WHERE invite_id=? ORDER BY created_at,key', id).all()).results;
}
/** addUpload(db, {key,invite_id,mime,size}, {kind,maxCount,maxTotalBytes}) -> upload|null.
 * Required server-owned limits: kind is image/audio; maxCount and maxTotalBytes
 * are positive safe integers, never request-supplied. One conditional INSERT
 * enforces the draft, per-invite/per-kind, and account-wide committed-byte caps.
 * Caller must authorize the invite before writing R2; delete R2 object on null/error.
 */
export async function addUpload(db, record, { kind, maxCount, maxTotalBytes } = {}) {
  const { key, invite_id, mime, size } = record;
  if (kind !== 'image' && kind !== 'audio') throw new TypeError('kind must be image or audio');
  positiveSafeInteger(maxCount, 'maxCount');
  positiveSafeInteger(maxTotalBytes, 'maxTotalBytes');
  nonempty(mime, 'mime');
  const matchesKind = kind === 'image' ? /^image\/[^\s;/]+$/.test(mime)
    : /^audio\/[^\s;/]+$/.test(mime) || mime === 'application/ogg';
  if (!matchesKind) throw new TypeError('mime must match upload kind');
  const mimeFilter = kind === 'image' ? "mime LIKE 'image/%'" : "(mime LIKE 'audio/%' OR mime='application/ogg')";
  const bytes = money(size);
  return await stmt(db, `INSERT INTO uploads(key,invite_id,mime,size)
    SELECT ?,id,?,? FROM invites WHERE id=? AND status='draft'
      AND (SELECT count(*) FROM uploads WHERE invite_id=invites.id AND ${mimeFilter}) < ?
      AND (SELECT COALESCE(SUM(size),0) FROM uploads) + ? <= ? RETURNING *`,
  nonempty(key, 'key'), mime, bytes, invite_id, maxCount, bytes, maxTotalBytes).first();
}
/** getUpload(db, key) -> upload|null. Does not imply public-read permission. */
export async function getUpload(db, key) {
  return await stmt(db, 'SELECT * FROM uploads WHERE key=?', key).first();
}
/** beginCheckout(db, id, ownerHash, amount, currency, expectedData) -> new creating order|null.
 * expectedData is REQUIRED: the caller-validated customer_data object snapshot.
 * Its json() serialization must exactly equal the persisted JSON; changed data
 * returns null without an order or lock. A single transactional batch inserts
 * only from that owned draft, then locks it. Concurrent/repeated calls return
 * null; they do NOT grant permission to call the gateway again. Recover pending
 * UI via getOrderForInvite. Do not automatically unlock a creating intent on
 * network timeout: a gateway order may exist. Reconcile using the local order.id
 * as gateway receipt/key.
 */
export async function beginCheckout(db, id, ownerHash, amount, currency, expectedData) {
  const expectedJson = json(expectedData);
  const orderId = hex18();
  const results = await db.batch([
    stmt(db, `INSERT INTO orders(id,invite_id,amount,currency)
      SELECT ?,id,?,? FROM invites WHERE id=? AND owner_hash=? AND status='draft' AND customer_data=?`,
    orderId, money(amount), nonempty(currency, 'currency'), id, ownerHash, expectedJson),
    stmt(db, `UPDATE invites SET status='payment_pending',updated_at=${NOW}
      WHERE id=? AND owner_hash=? AND status='draft' AND customer_data=?
      AND EXISTS(SELECT 1 FROM orders WHERE id=? AND invite_id=invites.id)`, id, ownerHash, expectedJson, orderId),
    stmt(db, 'SELECT * FROM orders WHERE id=?', orderId),
  ]);
  return results[2].results[0] ?? null;
}
/** setGatewayOrder(db, orderId, gatewayId) -> pending/paid order|null.
 * Idempotent for the SAME gateway ID only; cannot overwrite an existing ID.
 */
export async function setGatewayOrder(db, orderId, gatewayId) {
  nonempty(gatewayId, 'gatewayId');
  const results = await db.batch([
    stmt(db, `UPDATE orders SET gateway_order_id=?,status='pending',updated_at=${NOW}
      WHERE id=? AND status='creating' AND gateway_order_id IS NULL
      AND EXISTS(SELECT 1 FROM invites WHERE id=orders.invite_id AND status='payment_pending')`, gatewayId, orderId),
    stmt(db, "SELECT * FROM orders WHERE id=? AND gateway_order_id=? AND status IN ('pending','paid')", orderId, gatewayId),
  ]);
  return results[1].results[0] ?? null;
}
/** getOrderByGateway(db, id) -> order|null, where id is the provider's order ID. */
export async function getOrderByGateway(db, id) {
  return await stmt(db, 'SELECT * FROM orders WHERE gateway_order_id=?', id).first();
}
/** getOrder(db, id) -> order|null, local intent ID. */
export async function getOrder(db, id) {
  return await stmt(db, 'SELECT * FROM orders WHERE id=?', id).first();
}
/** getOrderForInvite(db, id) -> active/paid order|null; caller must authenticate owner. */
export async function getOrderForInvite(db, id) {
  return await stmt(db, "SELECT * FROM orders WHERE invite_id=? AND status IN ('creating','pending','paid')", id).first();
}
/** settleOrder(db, gatewayId, paymentId, publicSlug) -> {order,invite}|null.
 * Call ONLY after verifying provider signature AND captured status AND matching
 * amount/currency against this exact order. One batch marks the exact order and
 * publishes only its invite. Payment IDs are globally unique. Constraint errors
 * (including slug collisions) roll back BOTH writes; caller may retry with a new
 * slug. Same-payment replay returns the existing persisted slug, ignoring a new
 * suggested slug. A different payment on an already-paid order returns null.
 * Settlement itself is the durable dedup inbox; raw webhook bodies aren't stored.
 */
export async function settleOrder(db, gatewayId, paymentId, publicSlug) {
  nonempty(gatewayId, 'gatewayId'); nonempty(paymentId, 'paymentId'); nonempty(publicSlug, 'publicSlug');
  const results = await db.batch([
    stmt(db, `UPDATE orders SET status='paid',gateway_payment_id=?,updated_at=${NOW}
      WHERE gateway_order_id=? AND status='pending' AND gateway_payment_id IS NULL
      AND EXISTS(SELECT 1 FROM invites WHERE id=orders.invite_id AND status='payment_pending')`, paymentId, gatewayId),
    stmt(db, `UPDATE invites SET status='published',public_slug=?,updated_at=${NOW}
      WHERE status='payment_pending' AND id=(SELECT invite_id FROM orders
        WHERE gateway_order_id=? AND gateway_payment_id=? AND status='paid')`, publicSlug, gatewayId, paymentId),
    stmt(db, `SELECT o.* FROM orders o JOIN invites i ON i.id=o.invite_id
      WHERE o.gateway_order_id=? AND o.gateway_payment_id=? AND o.status='paid'
      AND i.status='published' AND i.public_slug IS NOT NULL`, gatewayId, paymentId),
    stmt(db, `SELECT i.* FROM invites i JOIN orders o ON o.invite_id=i.id
      WHERE o.gateway_order_id=? AND o.gateway_payment_id=? AND o.status='paid'
      AND i.status='published' AND i.public_slug IS NOT NULL`, gatewayId, paymentId),
  ]);
  const order = results[2].results[0];
  return order ? { order, invite: decode(results[3].results[0]) } : null;
}
