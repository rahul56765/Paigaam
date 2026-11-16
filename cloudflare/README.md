# Paigaam: isolated Cloudflare pilot

This is an incremental port, **not feature parity with the Railway application**. The original `server.js`, original `public/`, root package/lockfile, Railway database and Railway deployment are not changed by this build. Do not point the production domain here or turn on live checkout until the port's storage, ownership, upload and payment tests have passed in staging. No deployment or data migration is performed by `build.mjs`.

## What is included

- The **33 built-in shared-family templates** listed in `templates/bfday.js`, in their original order. Their original config, schema/validation, render functions, artwork, fonts and browser experiences are reused.
- The exact `pages/bfdayCreate.js` wizard and immersive builder shell, including template-specific crop/edit tools. A very small view wrapper removes the unrelated legacy creator-coupon stylesheet/script and changes the default OG origin to the request origin. It does not replace the builder with a generic form.
- A collection and detail page limited to these family members. Published links, uploads, ownership, payment and administrative handlers depend on the separate Worker implementation and its tests; a successful static build alone does not establish end-to-end support.
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

Additional performed smoke checks imported the generated registry, strictly validated all 33 demo data objects, and rendered all 33 demos/builders/details successfully. Dependency installation/bundler verification was attempted but the sandbox npm registry returned **403** for `esbuild`; this is not a successful Wrangler bundle or deployment test. Retry installation and run Wrangler's dry run in an environment with registry access before considering deployment.

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

Verified locally: `node --test cloudflare/tests/*.test.mjs` passes 31 tests,
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

The connected MCP authenticates ordinary Cloudflare API calls, but does not expose
the per-request Authorization override required for static-asset upload JWTs.
No asset upload session was created and no partial/incomplete Worker was published.
Use Cloudflare Git builds for a supported deployment without sharing an API key:
import `rahul56765/Paigaam`, branch `feat/cloudflare-fresh-start`, Worker name
`paigaam` (the separate Worker created in the account), root directory `cloudflare`, build command `npm run build`,
deploy command `npx wrangler deploy`. This is a separate preview Worker, NOT a
production-domain change. Do not merge into main or attach paigaam.cc yet.
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
