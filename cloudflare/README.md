# Paigaam: isolated Cloudflare pilot

This is an incremental port, **not feature parity with the Railway application**. The original `server.js`, original `public/`, root package/lockfile, Railway database and Railway deployment are not changed by this build. Do not point the production domain here or turn on live checkout until the port's storage, ownership, upload and payment tests have passed in staging. No deployment or data migration is performed by `build.mjs`.

## What is included

- The **50 built-in source-catalogue entries**, in fresh-source seed order (not the old Railway database's ordering). The 33 shared-family entries reuse original config, schema/validation, render functions, artwork, fonts and browser experiences. The remaining 17 are visibly marked 'Restoring'; they cannot take orders or be customized yet. Maafi, Noor, Meher, Aashi, Saalgirah, Lavender and Valentine Say Yes have read-only demos, built from pinned source and fictional demo data.
- The original home, dark navigation, gallery/filter and template-detail layouts, adapted from the original Paigaam page components. A compact notice identifies this as a preview, and the original theme and markup remain. DB-driven trending and previously saved Railway thumbnails are not available in this fresh data set.
- The original `pages/bfdayCreate.js` wizard and immersive builder shell, including template-specific crop/edit tools. Preview-only guard disables photo upload and publication, removes creator-coupon/checkout scripts and uses the preview origin. It does not replace the builder with a generic form.
- Original collection and detail layouts show all 50 built-in source entries. The 17 unported legacy entries show their metadata, not a claim of functioning customizers. The previous database may also contain studio clones, different prices, custom thumbnails and a different published order. Published links, uploads, ownership, payment and administrative handlers depend on the separate Worker implementation and its tests; a successful static build alone does not establish end-to-end support.
- Existing **fixed opening clips** for Royal Vivah, Patra Vivah and Divya Vivah. These are ordinary shipped assets, not video generation.

**Unavailable:** classic/non-shared template families (including Maafi, Sawaal, Ganapati, Shaadi Paigaam and Suvarna Vivah), magazines/Canva, creator studio, collaboration, creator referral/coupon campaigns, and Remotion/wedding-video generation. Existing Railway records, sessions and uploads are **not migrated**. Do not advertise these as working features. The build never copies `public/collab`, admin artwork/pages, a data directory, uploaded user content, magazine assets, Remotion dependencies or the large video-generation asset tree.

## Build and validation

From the repository root:

```sh
node cloudflare/scripts/build.mjs
```

The build is Node-only and needs no additional packages. Use Node 22.5–24, consistent with the original application's engine range. It clears and regenerates **only** `cloudflare/public/` and `cloudflare/src/catalog.generated.mjs`; never edit generated files by hand.

The builder:

1. Runs the original family contract checks and fails rather than silently skipping a registered family member.
2. Copies an explicit family/shared-UI allowlist from the original public tree. The unused admin marble URL is removed from the copied base stylesheet; the original stylesheet is untouched.
3. Enumerates **all** `lib/bfday/assets*.js` packs, including their split/submodule carrier files, instead of assuming the first pack contains everything. Every decoded asset is SHA-256 verified; conflicting packed copies fail the build.
4. Decodes the newer Little Love, Vaidehi and Divya Vivah manifests, verifying checksums and byte counts. Vaidehi fictional demo-photo aliases are reproduced. Patra's retired opening cover is removed in favour of the clean clip.
5. Runs the original brand decoder/derivations in a build-only filesystem adapter redirected into the new output. Nothing writes into the original public tree.
6. Generates an ESM registry with static imports, keeping the filesystem loader, binary packs, database, studio and server routes out of the Worker import graph.
7. Checks local asset references in actual family demo/builder HTML and copied CSS (including artwork/fonts). This checks declarative references, not every JS-constructed URL; staging browser tests remain necessary.
8. **Fails** if any needed asset exceeds **25 MiB** or total files exceed the free-plan **20,000-file** limit. It never silently omits an oversized required file. The successful build prints counts, bytes, the largest file and included MP4 files.

Initial verified build: **348 static files**, **72,481,390 bytes** total; maximum file `assets/jashn/cake.png`, **3,033,919 bytes**. **239** distinct decoded assets from **31** family pack modules plus the manifest formats. Fixed clips: Divya **2,198,758 bytes**, Royal **1,709,166 bytes**, Patra clean **1,267,667 bytes**. These counts may change when the source templates change.

Additional smoke checks import the generated registry, strictly validate all 33 demo objects, and render all 33 demos/builders/details. Wrangler bundling and deployment were subsequently verified; see current status below.

## Worker integration contracts

`src/catalog.generated.mjs` exports:

```js
import templates, {
  list, bySlug, getTemplate, has, displayName,
  InputError, resolve, makeSchema, bgmClean, isRealDate,
} from './catalog.generated.mjs';
```

- `templates` / `list`: ordered array of `{ slug, config, fields, schema, validate, render }`.
- `bySlug(slug)` / `getTemplate(slug)`: entry or `null`; `has(slug)`: boolean.
- `entry.validate(data, {mode: 'strict'|'draft'|'lenient'})`: original template schema. Original custom validators are preserved, not replaced by a generic schema.
- `entry.render({slug, customer_data, ...row}, {baseUrl, isPreview, ...opts})`: original complete HTML renderer.
- `displayName(slug, data)`: original family name-field fallback semantics.
- Shared field-engine exports are available for route integration. `errors` is an empty array, because build-time errors are fatal.

`src/views.mjs` exports `catalogPage(templates)`, `detailPage(template)`, and `builderPage(template, baseUrl, options = {})`, all returning complete HTML strings. For compatibility, `builderPage(template, {baseUrl, ...options})` is also supported. The optional `options` is passed to the original builder: supply **server-owned** `price`, `listPrice`, and optionally `resumeDraft`; never accept a client-provided price. If no price is supplied, the original config price is used. The wrapper clones config so the original page's price mutation cannot leak across requests. Do not treat config prices as evidence live payments are enabled.

The original browser builder expects these route shapes (the Worker must supply them):

- `GET /templates`, `GET /templates/:slug`, `GET /create/:slug`
- `GET /:slug/demo`, `POST /:slug/preview-frame`
- `POST /api/:slug/draft`, `POST /api/:slug/publish`
- `POST /api/:slug/upload?id=...`, `POST /api/:slug/upload-audio?id=...`
- `GET /api/qr?url=...`, `GET /p/:publicSlug`, plus authenticated draft preview/resume routes used by the Worker

Preserve the original `/bfday/uploads/<48 lowercase hex>.<ext>` URL shape for uploaded media so the original field validators accept it. Browser scripts send same-origin credentials; enforce owner cookies/tokens and Origin/CSRF rules server-side. Do not infer security from the original wizard UI. Password-gated designs are client-side presentation gates, not server-side access-control encryption.

An import-cache check also confirmed that the runtime leaf graph contains no asset carriers, filesystem family loader, database, studio or server route modules. The registry deliberately imports the original CommonJS leaf modules. **Bundle it** with Wrangler/esbuild rather than uploading those files as unbundled ESM. `nodejs_compat` is required: Raaz/Purana use Node `crypto.createHash` and `Buffer`; the original builder shell reads `process.env.BASE_URL` with a fallback. There are no runtime filesystem asset packs. Check a deployment dry run's module graph for `node:fs`, database/server imports and base64 carrier packs; none should be needed.

## Fresh staging setup — do not modify Railway

Keep the Cloudflare package separate. Suggested build/development dependencies are `wrangler` and `esbuild` in `cloudflare/package.json`; no root package or lockfile change is needed. If a package/config is being assembled in parallel, finish and review that Worker/config first. A static build is not itself a runnable backend.

1. Install the isolated Cloudflare tooling (`npm --prefix cloudflare install`, in an environment with npm access).
2. Review `cloudflare/wrangler.toml` (or the port's chosen Wrangler config): set a new staging Worker name, a current supported compatibility date, `nodejs_compat`, the actual Worker entrypoint, and assets directory `./public` relative to that config. Assets must not use SPA fallback for missing API/HTML routes. Ensure dynamic routes go through the Worker rather than leaking to static fallback.
3. Create a **new** staging D1 database and **new** R2 upload bucket, and put their returned IDs/bindings in that config. Use the binding names the Worker implementation expects (`DB` and `MEDIA` in the current Worker). Never reuse a production Railway database or copy user data implicitly.
4. Apply the port's SQL migrations locally first, then to the new staging D1 only. From `cloudflare/`, with the reviewed config in place:

   ```sh
   npx wrangler d1 migrations apply DB --local
   node scripts/build.mjs
   npm test
   npx wrangler deploy --dry-run --outdir /tmp/paigaam-worker-dry-run
   npx wrangler dev
   ```

5. Test collection/detail/demo routes, all custom builder variants, blank and invalid previews, owner isolation, draft resumption, image/audio upload MIME and size rejection, R2 delivery, QR generation, publish and published URLs. Validate HTML injection and cross-origin rejection. Check all artwork, custom fonts and fixed clips in a real browser. Repeat on a disposable `workers.dev` staging URL **only after** deciding to deploy it yourself; no deployment has been performed by this build task.
6. Keep generated-video features disabled. The original Remotion worker is not part of this port and must not be scheduled or advertised.
7. Checkout is fail-closed in the payment module: leave `CHECKOUT_ENABLED` and `ALLOW_LIVE_PAYMENTS` false/unset initially. Configure only **test** Razorpay credentials through Wrangler secrets for staging testing; never put secrets in source or the generated asset directory. Test server-owned amounts, order verification, signature failures, captured-payment reconciliation and webhook idempotency before enabling checkout. **Do not enable live keys or live payments until explicit production acceptance.**
8. Document operational ownership, backup/restore, rate limits, upload quotas/retention and monitoring before production domain cutover. The Railway application remains the production system until that separate decision.

This README records the incremental scope and reproducible static build. It is not a claim that a production migration, a complete feature audit, a successful browser end-to-end checkout, or a live deployment has happened.

## Current integration status (2026-11-16)

The Fetch API Worker router now connects the 33-template catalog, original
builders, stateless previews, owner-isolated drafts, R2 upload authorization,
QR generation, checkout intents and idempotent payment settlement.

Verified locally: `node --test cloudflare/tests/*.test.mjs` passes 70 tests, including comparisons of the restored homepage, gallery and template details against the existing page markup, 50-entry source catalog, original read-only demos, paused-checkout reconciliation and a fail-closed local admin foundation. The admin foundation is not routed or deployed and cannot be enabled until runtime authentication and full security review; 70 test total includes the unrouted admin tests,
including rendering all 33 demos/builders/details and a mocked paid order →
capture → publication → duplicate verification flow. The D1 tests use an
in-memory SQLite adapter and R2/gateway calls are mocked. This is NOT an actual
Cloudflare-runtime, R2-persistence, browser, payment-gateway or restore test.

Safe defaults in `wrangler.toml`: customer writes AND checkout are disabled.
An isolated D1 `paigaam-fresh-preview` and private R2 bucket
`paigaam-fresh-preview-media` have been created in the connected account. The new
D1 contains the schema and 33 insert-only catalog entries; zero customer invites,
upload records or orders. No gateway secrets have been provisioned.
`/status` reports non-secret preview state. No domain or Railway cutover is made.
No admin is ported yet; `/admin` explicitly returns unavailable. Free-template
publication intentionally fails closed pending a reviewed atomic publish route.
No refunds/creator ledger/payouts or historical webhook reconciliation is ported.
An uncertain gateway-create outcome keeps the checkout intent locked for manual
reconciliation; never auto-retry with a new order. Server-side draft quotas,
rate limits, upload budgets/retention, privacy/legal pages, backups/restore,
production admin, non-family features, UI availability notices, CPU benchmarks
and real Workers integration testing are remaining launch gates. Do not enable
`DRAFTS_ENABLED`, live payments or production DNS before these are addressed.

Network access was approved and dependency installation succeeded. Wrangler
4.162.0 bundles successfully: approximately 896 KiB raw / 229 KiB gzip. Its
local Workers runtime served 449 page/asset requests with zero errors. A separate
LOCAL-ONLY test verified real Miniflare D1 draft persistence and R2 upload/read,
owner isolation, byte equality and disabled checkout. It found and fixed a full-
file versus partial-range response bug, with regression coverage. Real gateway,
browser/mobile, remote R2 durability and backup restoration are still unverified.

The connected MCP cannot directly supply the asset-upload-session JWT header,
so the owner connected GitHub using Cloudflare's supported build flow. The isolated
Worker `paigaam` was deployed on 2026-11-16 at
`https://paigaam.rahul56765us.workers.dev` from branch `feat/cloudflare-fresh-start`,
root `cloudflare`, using `npm run build` and `npx wrangler deploy`. Cloudflare build
ID `988b991d-4ba7-41cd-bcf5-7c6eb5480f72`, version
`e3d3d1f9-56a6-426c-b72c-dbaa62c56d27`, completed successfully. Remote checks:
home, Vaidehi demo/builder, logo and builder JS returned 200; status reported 33
family templates, checkout disabled, video disabled, and no legacy data imported.
Posting a draft returned 503 drafts_offline; `/admin` returned 503. Existing image
URLs in the collection returned 200. Later work adds the complete 50-entry source
catalogue and Maafi read-only demo, still with legacy customizers unavailable.
This is a public preview only, NOT a
production-domain change; do not merge into main or attach paigaam.cc yet.
See https://developers.cloudflare.com/workers/ci-cd/builds/ .

Local reproducible checks:
```sh
npm ci
npm run build
node scripts/seed.mjs
npx wrangler d1 execute DB --local --file migrations/0001_initial.sql
npx wrangler d1 execute DB --local --file seed.generated.sql
npm test
npx wrangler deploy --dry-run --outdir dist
# Terminal 1: default read-only preview
npx wrangler dev --local
# Terminal 2:
node scripts/runtime-smoke.mjs
# For the LOCAL storage smoke, first prepare a new isolated --persist-to state
# with migrations 0001 + 0006 and a fictional seed; provide the synthetic-only
# rate key shown in the staged request-rate section below. Never use real keys.
# Then start local dev with DRAFTS_ENABLED:true, the synthetic rate key, and
# CHECKOUT_ENABLED:false; run node scripts/storage-smoke.mjs.
```
Only apply the initial schema once per database; do not reapply the raw schema
file or reset a database that already has data. The remote preview schema/catalog
have already been initialized; do not reapply them during Git deployment.

## Pre-launch safety patch (2026-11-16, separate review branch)

This patch is **not** production activation or full application parity. It does
not change Wrangler flags, domains, bindings, SQL migrations, deployed storage,
Railway resources or Editzy. Keep the read-only preview defaults in place.

- `store.beginCheckout(db, id, ownerHash, amount, currency, expectedData)` now
  requires the caller-validated persisted `customer_data` snapshot. The D1
  batch compares the exact JSON when inserting the intent and locking the
  invite. A competing autosave rejects checkout without creating a gateway
  order or freezing different/unvalidated content. Reload/revalidate on a 409;
  do not unlock or retry an ambiguous existing gateway intent automatically.
- In the later admission branch, `store.addUpload(db, record, {kind, maxCount,
  maxTotalBytes})` requires explicit server-owned per-kind and shared committed-
  byte limits plus matching MIME. The conditional INSERT rechecks them atomically;
  photos do not consume the audio allowance. The R2 write happens before D1
  admission. Cleanup may fail, and an ambiguous D1 result can make blind deletion
  unsafe: durable reservation/reconciliation and retries are still launch gates.
  The committed-byte ceiling is not a reservation or a lifetime storage limit.
- The original Love Letter and Anniversary Blue `/api/:slug/audio` editors can
  send MP3/WAV as `application/octet-stream`: the Worker sniffs the container,
  rejects unsupported/mismatched bytes, stores canonical audio MIME, and retains
  their 12 MiB/five-audio limits. Their local `songUrl` references now require
  same-invite ownership and are anonymously readable only when referenced by a
  published invite. External HTTPS song links retain their original semantics.
- New checkout readiness also requires `RAZORPAY_WEBHOOK_SECRET`, in addition to
  recognized credentials and the existing exact enable/live flags. Presence
  alone does not establish that a webhook is configured or that acceptance tests
  have passed. Read-only captured-payment reconciliation still works while new
  checkout is paused.

Validation after the sandbox's npm-registry access was approved: static build
succeeds (33 runtime templates, 50 source entries), **128/128 complete tests**
pass, and Wrangler 4.162.0 dry-run bundling succeeds. In a newly created,
local-only Miniflare D1/R2 state, the actual Worker returned 474 page/asset
responses without error, blocked drafts when disabled, persisted a synthetic
owner-isolated draft and image, and left checkout blocked. A second local-only
safety smoke verified both keepsake audio contracts, cross-draft denial, private
media, an actual six-request concurrent audio quota race (one winner), and an
audio upload after nine photos. The local D1 contained 17 upload records and
local R2 contained exactly 17 objects after the race; there were no test
orphan objects. Run `node scripts/safety-runtime-smoke.mjs` only against a fresh
local Worker started with `DRAFTS_ENABLED=true` and checkout disabled.

These are local fixtures, not remote R2 durability, browser/mobile, payment
gateway or restore acceptance. No real charges or remote customer writes were
made. The existing successful preview deployment is not evidence that these
unmerged changes have been deployed.

Remaining full-launch gates include all 17 legacy customizers and associated
flows, atomic free publishing and production UI/resume integration, admin and
creator/referral/refund operations, magazines/Canva, generated wedding video,
durable rate/admission/byte quotas and retention/recovery, coordinated D1/R2
restore tests, secure test-only payment configuration and browser/gateway
acceptance. Only after feature acceptance should production routing be changed.
An active Cloudflare zone is required for a Worker Custom Domain; the observed
`paigaam.cc` zone is still pending, so any delegation change also requires the
owner's explicit approval and a complete DNS inventory preserving Editzy/mail.

## Draft write admission — separate staging branch

The Cloudflare store now requires caller-supplied **server-owned** admission
limits when creating an invite or committing upload metadata. The provisionally
selected preview policy is 20 invites per owner/template per rolling 24 hours,
5,000 invites globally per rolling 24 hours, and 500 MiB of committed invite
upload metadata. The per-owner and byte-pool values match the original app's
published limits; the shared 5,000/day figure is a staging guard, not a
traffic-based production recommendation. Review policy, costs and D1 query
performance against real usage before enabling customer writes.

Both draft counts include all invite statuses. Their UTC cutoff uses the same
ISO timestamp format as stored `created_at`. One conditional INSERT applies
owner/template and shared admission atomically; denial returns a generic 429.
The existing conditional upload INSERT also checks the shared committed-byte
budget atomically, alongside draft state and per-kind caps; the R2 object is
removed if the metadata write is denied. Request bodies cannot set policy
values. Unrouted Maafi/Saalgirah adapters use the same guard if later enabled.

This is **not** a complete abuse or retention system. A rolling daily ceiling
is not a lifetime cap, cookies can be rotated, and R2 bytes are temporarily
written before D1 admission. Edge/IP throttling, total storage inventory,
orphan recovery, retention/deletion, backups/restore and any additional
magazine/creator upload systems still need separate implementation and
acceptance. No existing tables, data, migrations, bindings or feature flags are
changed by this branch.

Tests use fresh local SQLite/Miniflare databases only. Store tests race separate
SQLite connections for draft and byte caps. Worker-level tests verify generic
429 responses, server-owned policy and R2 compensation. A local Workerd test
raced 24 requests from one owner: 19 new drafts succeeded and five returned
429 after an initial draft, for exactly 20 total. No remote data or real
payments were involved.

## Free family publication — separate staging branch

For the 33 supported family templates, a new backend path can publish a
zero-price invitation without a Razorpay order. It is **fail-closed** unless
both `DRAFTS_ENABLED` and `FREE_PUBLISH_ENABLED` are exactly `"true"`; the
second flag is unset in the deployed configuration. The initial backend PR
left the browser builder locked; a subsequent staged change adds the guarded
free-builder view described below. No Worker configuration, production flags
or SQL migrations are changed.

The handler authenticates the owner and template, strictly validates the saved
snapshot and checks its R2 media. One conditional D1 update rechecks the exact
snapshot, current zero price and absence of any creating/pending/paid order,
then publishes an unpredictable 192-bit slug. Collision retries are bounded.
Concurrent same-snapshot requests return the same owner-authorized URL; stale
content, a price change or a competing paid intent fails closed. The free path
neither creates a gateway order nor needs gateway secrets. R2 validation and D1
publication cannot be one cross-service transaction; durability/retention and
orphan handling are still required before launch.

The combined safety, admission and free-publication branch passes **179/179**
local tests and a Wrangler bundle dry run. Against fresh **local-only** Workerd,
D1 and R2, `scripts/free-runtime-smoke.mjs` created, published and retrieved
all 29 supported zero-price demo templates; twelve concurrent requests for one
draft returned one stable URL. A foreign owner was denied, a paid template
remained blocked with checkout off, and referenced uploaded audio was privately
held until publication then read successfully. Local state afterward contained
31 published synthetic invitations, one paid draft, one upload and **zero
orders**. These results are not browser, remote-durability, payment-gateway,
restore, full-feature-parity or production-domain acceptance.

## Guarded free builder — separate staging branch

The original free family wizard is now selectable only when the Worker has D1
and R2 bindings, `DRAFTS_ENABLED` and `FREE_PUBLISH_ENABLED` are both exactly
`"true"`, and the current server-owned D1 price is integer zero. Query strings,
source-config defaults, missing rows, missing bindings and nonzero prices cannot
unlock it. The existing deployment sets neither flag to enable this feature;
paid builders and checkout remain locked. No live routing or database migration
is part of this branch.

The shared original family editor now waits for in-flight photo/audio uploads,
freezes edits during publishing and cancels pending autosaves after publication;
a failed request releases the controls. This avoids publishing a draft before
its selected media has arrived. A successful free response still comes from the
server-validated, snapshot-bound D1 transition described above.

To prevent a free view from silently initiating a paid order if its catalog
price changes while open, new paid-order creation/reopening now requires an
explicit `checkout_mode: "paid"`, integer `expected_amount_paise` and matching
`expected_currency`. The D1 checkout lock atomically rechecks the current
server quote. A pending order is replayed against its own locked amount, not a
later catalog price. **The paid browser UI does not yet implement this
confirmation contract**; do not enable paid checkout until it does and payment
acceptance/reconciliation are complete. Signed captured-payment reconciliation
remains independent of new-checkout flags.

Validation: **196/196 Cloudflare tests** and **26/26 original-editor tests**
pass; static build and Wrangler dry-run pass. Actual sandboxed Chromium against
fresh local Workerd/D1/R2 verified a free builder at desktop and 390-pixel mobile
widths, Love Letter at desktop, and Diwali Deep with a deliberately delayed
photo upload. The latter refused publication until upload completion, disabled
editing during the publication request and included the photo in the published
page. All four browser cases had zero local HTTP/JavaScript errors and zero
payment requests; external browser requests were blocked. The four-second
autosave window produced no post-publication error. These are synthetic local
fixtures—not real-customer, remote-durability, payment, backup/restore, or
comprehensive 29-template browser acceptance.

Optional local browser smoke: supply a locally installed Puppeteer-core module
entry path through `PUPPETEER_CORE_MODULE`, a sandbox-capable Chromium binary
through `CHROMIUM_EXECUTABLE`, and run `node scripts/builder-browser-smoke.mjs`
against the local Worker with the two free-stage flags enabled, migration 0006,
and a synthetic local rate key. The script refuses non-loopback HTTP targets
and blocks external requests; it does not add browser dependencies to the app
or deploy pipeline.

## Staged request-rate and fairness guard — local review only

This branch adds the **un-applied-to-existing-resources** additive migration
`migrations/0006_request_rate.sql`; it does not alter existing tables or
change Wrangler flags, domains, bindings, secrets, or deployed data. It was
applied only to new disposable local test databases. Keep drafts and checkout
disabled in the existing preview. Never connect or import the old Railway DB,
wipe/restructure existing storage, modify Editzy/DNS, provision a secret,
apply a remote migration or deploy without separate authorization.

The Worker now admits requests through D1 before draft creation **and updates**,
image/audio upload aliases, and publish (including replay/order creation). With
`DRAFTS_ENABLED` exactly `"true"`, it meters preview **GET and POST** through
one shared bucket before parsing/rendering. With drafts off, normal stateless
previews do not require the rate table or key; oversized GET preview data is
now rejected at 16 KiB in both modes. Demos, other reads, the
signed Razorpay webhook and signed owner verification/captured-payment
reconciliation are not subject to the anonymous limiter; the webhook retains
its separate signature verification and the verification route retains its
existing origin/owner/signature checks.

The provisional **server-owned**, per-canonical-IP limits below are shared
across templates and cookie rotations. These are staging assumptions, not
traffic-derived production recommendations. Every window is an epoch-aligned
fixed 60 seconds, so up to twice the listed allowance can be spent around a
boundary. Tune only after observing real workloads, autosave cadence and
shared-NAT impact, and reviewing cost and error handling with the owner.

| Action bucket | Maximum / 60 s | Routes |
| --- | ---: | --- |
| `draft_create` | 40 | new `POST /api/:slug/draft` |
| `draft_update` | 120 | `POST /api/:slug/draft` with a truthy id |
| `upload` | 30 | `upload`, `upload-audio` and `audio` combined |
| `publish` | 40 | free, paid intent and replay combined |
| `preview_post` | 120 | GET and POST `/:slug/preview-frame` when drafts enabled (bucket name retained for compatibility) |

Counters are independent between actions, but not between templates or owner
cookies. The original 20/owner/template/day, 5,000/day shared draft cap, and
500 MiB committed-upload pool remain separate. Same-origin checks precede
limiting. Draft JSON is first parsed under the existing 64 KiB bound to choose
create versus update; malformed/unparseable draft bodies therefore do **not**
spend a token. Other guarded operations are metered before body or storage work.
Invalid downstream requests and replays still spend a token; failures do not
refund it. A saturated bucket returns generic `429 rate_limited` with
`Retry-After`; absent/invalid IP or secret, missing table, or any D1/crypto
failure returns generic `503 rate_limit_unavailable` and does not authorize the
customer mutation. Missing storage still has its original 503 behavior. The
free-builder UI also remains locked if the rate key/table is unavailable; every
actual operation rechecks admission.

Only Cloudflare's `CF-Connecting-IP` is used, never `X-Forwarded-For` or the
anonymous owner cookie. IPv4 syntax is strict; IPv6 is expanded consistently,
and IPv4-mapped IPv6 is folded into its IPv4 equivalent. Ports, brackets,
zone IDs, lists and malformed addresses are rejected. An HMAC-SHA256 under a
**dedicated** `RATE_LIMIT_HMAC_KEY` produces an action-domain-separated digest;
only that digest, action, window timestamps and count enter the new table. The
application never logs or stores the raw IP or rate secret. HMAC digests are
still **pseudonymous**, not anonymous, and upstream/platform access logs may
have separate practices. Rotating the key intentionally starts new buckets.

The required rate secret must be independently generated as 32 cryptographically
random bytes encoded as exactly 64 hex characters. Missing, malformed and
single-repeated-byte placeholder values are rejected; these checks cannot prove
entropy. Do not reuse payment, webhook or cookie secrets, and never put a real
secret in source, command-line arguments, logs or static assets. Actual secret
provisioning is an explicitly separate, permission-gated operational task.
The D1 [batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
performs a single conditional UPSERT plus bounded cleanup in one transaction;
no read-then-write or isolate-local counter can admit excess contenders. If
D1 fails or the result is uncertain, no customer write is authorized. Each
request costs D1 work, so capacity and cost need real-load review.

Expired counter rows are **opportunistically** removed at most 20 per protected
request after their window has been over for 24 hours. This is not a guaranteed
retention/deletion schedule: stale rows can persist indefinitely while idle or
under high cardinality. An approved cleanup, privacy/retention, failure and
monitoring plan is still required before launch. No other storage cleanup is
performed by this change.

**Limitations:** this is not complete abuse protection or verified fair access.
[Cloudflare documents](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)
that same-zone Worker subrequests can alter the effective `CF-Connecting-IP` via
`x-real-ip`; IPv6 addresses and proxy addresses can rotate; many genuine users
can share a NAT/IP and therefore a quota. Conversely, fixed windows permit burst
edges and cannot contain distributed attacks, volume from unmetered read routes,
malformed draft-body parsing, drafts-off preview traffic, or compromised/trusted-subrequest abuse. Review
trusted Worker/subrequest architecture and deploy suitable Cloudflare edge/WAF
controls separately; do not treat this guard as a substitute for them. Durable
R2 reservations/reconciliation, total/lifetime storage, retention, restoration
and comprehensive production/browser/payment acceptance remain separate gates.

For **synthetic local-only testing**, use an isolated checkout with no real
`.dev.vars`, credentials or production bindings, and a newly created
`--persist-to` directory. Example, from `cloudflare/`:

```sh
STATE="$(mktemp -d)"  # fresh local D1/R2 only; never point at an existing state
npx wrangler d1 execute DB --local --persist-to "$STATE" --file migrations/0001_initial.sql
npx wrangler d1 execute DB --local --persist-to "$STATE" --file migrations/0006_request_rate.sql
node scripts/seed.mjs  # generates insert-only fictional source-catalog SQL
npx wrangler d1 execute DB --local --persist-to "$STATE" --file seed.generated.sql
# This fixed value is PUBLIC TEST DATA, never use it in a real deployment.
npx wrangler dev --local --persist-to "$STATE" --ip 127.0.0.1 --port 8899 \
  --var DRAFTS_ENABLED:true --var FREE_PUBLISH_ENABLED:true \
  --var CHECKOUT_ENABLED:false --var ALLOW_LIVE_PAYMENTS:false \
  --var RATE_LIMIT_HMAC_KEY:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# In a second terminal:
node scripts/request-rate-runtime-smoke.mjs http://127.0.0.1:8899
```

The local-only full-catalog, storage, safety and browser smoke scripts also use
synthetic documentation-range IPs. The full-catalog script distributes its
large test workload across fictional IPs; that is a test fixture, not an
endorsement of bypassing the policy in production. Local SQLite tests race
independent connections and include rollover, cookie rotation, action isolation,
update limits, invalid/missing configuration, rollback, privacy and signed
payment reconciliation. Workerd/D1/R2 local tests are not evidence of actual
Cloudflare operational behavior or remote durability.

Follow-up validation for this staged branch: **213/213** local tests pass and
Wrangler dry-run bundling succeeds. In a freshly created local-only Workerd/D1/R2
state, 40 allowed creates exhausted the per-IP bucket; eight contenders for the
last slot produced one success and seven 429 responses despite cookie/forwarded-
header changes. Preview GET and POST share their bucket: 120 local GETs were
accepted, the next GET and a following POST returned 429. Four sandboxed local
Chromium builder cases also passed with zero payment requests. The 0006 table and
synthetic test key were used only locally; no real key or migration was applied.

## Staged builder render and snapshot contract (2026-11-16)

Draft-save responses now include `snapshot`, a SHA-256 digest of the exact
server-persisted customer JSON. All family publish requests must include
`expected_snapshot` from that save. Missing or stale values return 409
`draft_changed` before publication, replay or gateway creation. This closes the
same-owner cross-tab gap before the first publish read; the existing conditional
SQL guards still handle updates after that read. The digest is a concurrency
token, not authentication. Ownership and strict media/schema validation remain
required. All three source editors send the token; opted-in free builders use a
new editor asset URL. Paid UI remains disabled and still needs explicit quote
integration. Lost-response recovery and owner draft restoration are not solved.

Published renderers now receive D1's `public_slug` as their original `slug`,
restoring canonical URLs and per-link Khulta/Meri Duniya state. Only stateless
Love Letter/Anniversary Blue editor frames receive `isEditor`; demos and public
readers do not. Unsupported paid currencies fail before any checkout lock.

This branch remains staged on the request-fairness branch. No flags, remote
migrations, secrets, DNS, Railway resources or Editzy configuration are changed.
Storage reservations/reconciliation, retention/restore, full feature parity,
paid UI/test gateway acceptance and domain cutover remain launch blockers.
