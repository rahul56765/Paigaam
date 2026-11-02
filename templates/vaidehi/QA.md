# Verification — 3 November 2026

## Passed

103 focused Node checks across:

- tests/bfday-vaidehi.test.js
- tests/bfday-vaidehi-api.test.js
- tests/bfday-engine.test.js
- tests/bfday-lotus-vivah.test.js
- tests/bfday-audio.test.js

138 real Chromium browser assertions through scripts/qa-vaidehi-browser.py:

- Layout checks at 320, 390, 430, 768 and 1366px. All seven scroll panels visited; no horizontal overflow or clipped headings.
- All eight required stages: opening plus cover, details, moments, welcome, blessings/venue/QR, schedule, countdown.
- Gate/inert state; section links and previous/next navigation; gallery scrolling, buttons, swipe; enlarged photo next/previous and Escape/focus restoration.
- Names/date/time/venue/messages changed through the real stateless preview; maximum-length names/messages, explicit empty gallery, 20 events and 12 photos.
- Real uploaded WAV through the shared API; paused before opening; plays after user gesture; play/pause controls verified against actual audio state.
- Countdown target, live numbers, zero clamp and celebration state. Timer copy is geometrically below the joined-hands illustration, not over it.
- All four no-JS photos remain visible and accessible in the accessibility tree; no-JS opening never blocks content; reduced-motion navigation and decoration verified.
- Actual screenshot QR decoding with zxing-cpp at DPR 1: default destination, and a 1420-character destination on both 320 and 390px phones. Decoded payload exactly matches configured URL.
- No uncaught page errors; no broken loaded images.

The local API tests use PAIGAAM's unmodified real bfdayRoutes with a temporary SQLite database: editor route and fields, changed preview, draft save, invalid input response, owner-only preview, actual image/audio uploads, private media access control, local publish, rendered published invitation, and public access only to referenced media.

The initial isolated QA adapter did not exercise unrelated creator-photo routes, the full admin/gallery shell, paid checkout or external production hosting. Subsequent full-server and root-suite verification is recorded below. Production /p rendering uses the existing family dispatch; the QA adapter checks the same renderer and the real publication operation, not an independently implemented publish flow.

node scripts/prepare-vaidehi.js --verify: 23 checksum-verified assets restored. git diff --check: clean.

## Independent review fixes

- Replaced fixed sample Haldi/Mehendi dates with editable wedding-relative day offsets; main-date edits update all inherited celebrations.
- QR size adapts to matrix density; actual phone-scale decode checks added.
- Lone UTF-16 surrogates repaired after shared-validator truncation, avoiding URI encoding exceptions.
- Removed server-emitted aria-hidden from inactive photographs so no-JS CSS does not visually expose inaccessible images. JavaScript manages active-photo accessibility only when it runs.
- Visual inspection found a timer/section CSS class collision; timer styles are now scoped to vv-timer, with an explicit geometry regression assertion.

## Initial environment limits — resolved after npm access approval

The initial npm install received HTTP 403. After the user approved registry.npmjs.org access, npm ci completed successfully (0 vulnerabilities) and npm run build passed every existing preparation step plus Vaidehi. Dependency versions were not changed. The pinned Node Playwright Chromium was also installed for the root regression suite.

The full npm test command now passes, including the shared family APIs, escaping, publication and restart-persistence tests. Its generic hostile-data fixture was extended specifically for Vaidehi to retain valid machine-readable times/UTC offsets while injecting hostile text into event names and venue fields. Production validators were not weakened. The restart test exposed and verified a fix to share metadata: the couple portrait is preferred for og:image, then the first gallery photo, then the designed thumbnail. A focused metadata regression test was added.

The actual root server.js now starts successfully with a separate temporary local database. All 127 browser assertions were rerun against that server, not just the isolated adapter, and passed. /templates/vaidehi, /create/vaidehi and /vaidehi/demo each returned HTTP 200. The full-platform build blocker reported in the initial review is resolved.

No merge, production deployment, real payment, WhatsApp send or email send was performed. Paid checkout and external hosting are still outside this verification.

## Remaining visual differences

New artwork and generated fictional sample photos; close-substitute fonts; source top illustration/opening not fully visible; extra accessible controls; larger dense QR for reliable scanning; long full names wrap more than the short names in the recording. The sample countdown uses the illustrated joined hands seen in the clip; a customer can upload a wedding photograph instead. Review the actual interactive preview before approving a merge.

## Cover-only revision verification

Full npm run build and npm test passed after the cover/petal changes. All 138 browser checks passed against the actual root server using its isolated local database. Additional checks verify real continuous CSS movement, varied durations, no pointer interception, an accessibility-hidden decoration layer, central text masking, background-tab pause/resume and reduced-motion removal. The names/date still change correctly through customer_data.

Six later panel HTML snapshots (details, moments, welcome, blessings/venue, schedule and countdown) are SHA-256 identical before/after this cover revision. A separate in-thread before/after browser comparison also found identical computed styles and relative element geometry in those panels with the intended petal overlay hidden. Raster screenshot pixels are not claimed identical, because the new cover height changes subpixel document placement. No data model, editor fields, gallery, navigation, QR, countdown, venue or music logic was redesigned.

The cover asset is now directly derived from the supplied still rather than a generated approximation. Text remains live HTML; the blank paper patch is the only repeating cover background. The review thumbnail was refreshed.

## INR99 release checks

The requested release seeds INR99 and uses a new 1000×688 catalogue thumbnail. Five isolated fake-gateway tests verify owner-only checkout at9900 paise/INR, strict required data, legacy bypass rejection, in-flight/pending edit guards, captured-versus-authorized payment, idempotent signed webhooks, wrong-signature/amount rejection and unpaid sibling-order accounting. Existing admin prices survive reseeding. No real gateway requests or charges are made by these tests.

Integrated the current main branch’s Sita Kalyanam changes without removing its registration, assets, editor or checkout protection. The generic family test fixture now identifies paid templates from their config, preserves constrained hostile-copy test times for both wedding templates, and renders the same cleaned data that was saved in the draft. No production validation was weakened. Full build and npm test pass; 110 focused checks pass. Asset manifest24 including catalogue image. External deployment verification will be recorded after success.
