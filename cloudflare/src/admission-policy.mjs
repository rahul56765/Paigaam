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

// Fixed UTC-minute windows per canonical IP and action, shared across all
// templates and anonymous cookies. These are deliberately provisional, not
// traffic-derived production recommendations; shared NATs need review.
// Separate action namespaces ensure, for example, previews cannot exhaust the
// upload or publication allowance. All supported audio/image aliases share one
// upload allowance. Requests cannot supply or alter any of these values.
export const REQUEST_RATE = Object.freeze({
  draft_create: Object.freeze({ max: 40, seconds: 60 }),
  draft_update: Object.freeze({ max: 120, seconds: 60 }),
  upload: Object.freeze({ max: 30, seconds: 60 }),
  publish: Object.freeze({ max: 40, seconds: 60 }),
  preview_post: Object.freeze({ max: 120, seconds: 60 }),
});
