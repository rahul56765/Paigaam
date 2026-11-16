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
# For the LOCAL storage smoke only, restart local dev with:
# npx wrangler dev --local --var DRAFTS_ENABLED:true
# node scripts/storage-smoke.mjs
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
- `store.addUpload(db, record, {kind, maxCount})` requires explicit image/audio
  limits and matching MIME. The conditional INSERT enforces the per-kind count
  cap atomically. Photos no longer consume the audio allowance. If the draft
  locks or the quota is consumed while R2 I/O is in flight, the losing object is
  removed. These are committed-metadata limits, **not** a global admission or
  byte-budget/reservation system; cleanup failures still need orphan recovery.
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
