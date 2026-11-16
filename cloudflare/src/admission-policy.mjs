/**
 * Server-owned provisional limits for the isolated Cloudflare preview.
 * They are never read from a request. Drafts stay disabled by default, and
 * these database limits are not a substitute for edge rate limits, verified
 * retention/deletion, orphan cleanup, or operational capacity review.
 *
 * The per-owner/template cap and 500 MiB pool mirror the original app's
 * published limits; the shared 5,000/day ceiling is a conservative staging
 * guard that must be reviewed against actual traffic before any live launch.
 */
export const DRAFT_ADMISSION = Object.freeze({
  maxPerOwnerTemplate24h: 20,
  maxGlobal24h: 5000,
});
export const UPLOAD_MAX_TOTAL_BYTES = 500 * 1024 * 1024;
