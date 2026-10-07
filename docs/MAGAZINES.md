# Paigaam Magazines (Canva Autofill)

Readers pick a design, fill in the fields, upload photos, and Paigaam builds a personalised magazine through
**Canva Connect REST (Autofill + Exports)**. They preview it on Paigaam and download a PDF (PNG too, for single-page designs).
Readers never need a Canva account. One Paigaam-owned Canva Pro account owns the master Brand Templates and all generated designs.
This feature is isolated from greeting templates, Razorpay and publishing, and is **free** (no pricing/payment is attached).

## How it works
```
reader form ─▶ private draft + photos (DATA_DIR/magazines/uploads/<id>)
            ─▶ preparing   live-dataset check vs. the mapping (blocks on drift)
            ─▶ uploading   each photo -> Canva asset (asset ids, never URLs)
            ─▶ generating  POST /autofills (create_from_brand_template) -> NEW design per reader
            ─▶ exporting   PDF (+ PNG only when the design is 1 page) -> copied to DATA_DIR/magazines/output/<id>
            ─▶ ready       preview + downloads are served from Paigaam's stored files, never Canva's expiring URLs
```
Every Canva id is saved the moment it is known, so **retry resumes** and never creates a second design.
`update_design` is never called. Source photos are deleted when the magazine is ready.

## Environment variables (names only — set values in Railway, never in git or chat)
| Name | Purpose |
|---|---|
| `CANVA_CLIENT_ID` | Canva Developer Portal integration client ID |
| `CANVA_CLIENT_SECRET` | Integration client secret |
| `CANVA_TOKEN_ENCRYPTION_KEY` | ≥32 random chars; AES-256-GCM key for stored OAuth tokens. Losing it only means reconnecting Canva |
| `CANVA_REDIRECT_URI` | Optional. Default `BASE_URL + /admin/canva/callback` |
| `DATA_DIR` | Existing. Must be a persistent volume (Railway: `/var/data`) |

Test-only (honoured only when `CANVA_TEST_MODE=1`): `CANVA_API_BASE`, `CANVA_AUTHORIZE_URL`, `CANVA_POLL_MS`, `CANVA_JOB_TIMEOUT_MS`, `CANVA_RETRY_AFTER_CAP_MS`. Never set these in production.

## Canva setup (one time)
1. Canva account: Pro (Autofill/Brand Templates on Pro were announced 23 Sep 2026 — see *Limitations*). MFA on.
2. Developer Portal → Create an integration (**Public** type; Private needs Enterprise). Note Client ID, generate a secret.
3. Scopes (only these): `asset:read asset:write brandtemplate:meta:read brandtemplate:content:read design:meta:read design:content:read design:content:write profile:read`. Leave webhooks and *Return navigation* off.
4. Authentication → Authorized redirects: `https://paigaam.cc/admin/canva/callback` (local testing: `http://127.0.0.1:<port>/admin/canva/callback`).
5. Railway → service variables: set the three `CANVA_*` names above, then deploy.
6. Admin → **Magazines** (`/admin/magazines`) → **Connect Canva account** → approve in Canva.

## Preparing a Canva Brand Template
1. Work on a **copy** of the design (never the master you rely on).
2. Desktop editor → Apps → **Data autofill** → *Custom* → tick "I've connected Canva…" → Continue.
3. Select each changeable element → **Data field** → name it. Names must match `canvaName` in `lib/magazines/registry.js` exactly: lowercase, underscores, unique.
4. Continue → **Publish as Brand Template**. Note the template ID from its URL (`/brand/brand-templates/<ID>`).
5. Add/adjust the entry in `lib/magazines/registry.js` (slug, name, `canvaTemplateId`, `pageCount`, fields, photo slots, limits).
6. Admin → **Validate vs Canva**. Any missing/extra/mistyped field **blocks publishing** (and un-publishes a live design if it drifts later).

Sample design: `birthday-collage` → Brand Template `EAHXVxrdrCk` (1 page): text `headline` (optional, default “HAPPY BIRTHDAY”) and photos `photo_1`…`photo_9` (all required).
**Provisional values to confirm per design** (product decisions, not Canva limits): headline max 24 characters; photo max 8 MB, min 400 px short side, JPG/PNG/WebP.

## Storage
Magazines use `DATA_DIR/magazines/{uploads,output}`. Production (Railway `paigaam-web`) mounts a 5 GB volume at `/var/data` and `/healthz` reports `storage: persistent`. This is safe **only with a single replica**; before scaling horizontally, move output files to object storage. Abandoned drafts are deleted after 24 h, failed orders after 14 days, orphan files hourly; ready magazines are kept.

## Privacy model
Drafts and their photos are readable only by the browser that created them (HttpOnly cookie `paigaam_mag`). A finished magazine is available to anyone holding its unguessable 128-bit link (`/magazines/m/<id>`), marked `noindex`. Disconnecting Canva hides creation but keeps finished downloads.

## Manual smoke test (authorized Canva account)
1. Deploy to a **staging** service (or locally with `BASE_URL=http://127.0.0.1:<port>` and the loopback redirect URL registered).
2. Admin → Connect Canva; confirm the account name shows.
3. **Validate vs Canva** → expect “fields match”. Confirm Autofill actually works for your plan (first call to `/autofills`).
4. Publish → open `/magazines/birthday-collage` in a private window → add 9 photos → Create.
5. Watch the steps; on *ready* confirm the PDF preview, PDF download and PNG download open correctly and the layout is right.
6. In Canva confirm a **new** design was created and the Brand Template is unchanged.
7. Retry check: generate once more; confirm a second, separate design appears.
8. Admin → Disconnect; confirm creation is hidden and the earlier download still works.

## Tests
`npm run test:magazines` → `tests/magazines.test.js` (in-process, mocked Canva: mapping, fields, OAuth/PKCE, refresh rotation, 429, state machine, retry/resume, PNG gating, cleanup) and `scripts/test-magazines.js` (HTTP e2e: gating, admin, uploads/ownership, downloads, restart, regression of existing pages). No real Canva credentials are needed. The mock lives in `tests/helpers/canvaMock.js`.

## Rollback
- Fast, no deploy: Admin → **Unpublish** the design (or Disconnect Canva). Public pages return 404 and nothing is generated.
- Code: revert the merge commit; tables are additive and unused by other features, so no migration reversal is needed. (`DROP TABLE canva_connection, canva_oauth_state, magazine_templates, magazine_orders, magazine_uploads;` and delete `DATA_DIR/magazines` only if you want the data gone.)
- Security: rotate the Canva client secret in the Developer Portal, update Railway, and click Connect again.

## Limitations
- Canva's docs still contain an “Enterprise-only” note on the Autofill reference page; the 23 Sep 2026 announcement says Pro and above. The smoke test (step 3) is the real confirmation. Usage limits may be introduced later.
- A **Public** Connect integration normally needs Canva's review before other Canva users can authorise it. Paigaam only authorises its own account; confirm with Canva that this is acceptable unreviewed for production.
- Autofill fills predesigned fields only; it does not compose layouts or fit unlimited text. Field lengths must be tuned in the design.
- Canva rate limits (e.g. 30 asset uploads/min) are respected with `Retry-After` backoff and a 2-job concurrency cap, but a burst of readers will queue.
- If a request to create an Autofill/Export job times out *after* Canva accepted it, a retry may create one extra design (the job id could not be saved). Rare; harmless but visible in Canva.
- Readers get no Canva edit link (not supported for this ownership model).
