# Verification — 3 November 2026

## Passed

99 Node checks across:

- tests/bfday-vaidehi.test.js
- tests/bfday-vaidehi-api.test.js
- tests/bfday-engine.test.js
- tests/bfday-lotus-vivah.test.js
- tests/bfday-audio.test.js

127 real Chromium browser assertions through scripts/qa-vaidehi-browser.py:

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

The isolated QA adapter does not exercise unrelated creator-photo routes, the full admin/gallery shell, paid checkout or external production hosting. Production /p rendering uses the existing family dispatch; the QA adapter checks the same renderer and the real publication operation, not an independently implemented publish flow.

node scripts/prepare-vaidehi.js --verify: 13 checksum-verified assets restored. git diff --check: clean.

## Independent review fixes

- Replaced fixed sample Haldi/Mehendi dates with editable wedding-relative day offsets; main-date edits update all inherited celebrations.
- QR size adapts to matrix density; actual phone-scale decode checks added.
- Lone UTF-16 surrogates repaired after shared-validator truncation, avoiding URI encoding exceptions.
- Removed server-emitted aria-hidden from inactive photographs so no-JS CSS does not visually expose inaccessible images. JavaScript manages active-photo accessibility only when it runs.
- Visual inspection found a timer/section CSS class collision; timer styles are now scoped to vv-timer, with an explicit geometry regression assertion.

## Environment limits — not passed

npm ci failed with HTTP 403 downloading existing npm dependencies. Network access was requested. npm run build was attempted; Ganapati/wedding-video preparation ran, then the existing magazine-face preparation stopped because @mediapipe/tasks-vision was unavailable. Starting the full root server stopped on missing sharp, an existing creator-photo dependency. No dependency versions or unrelated modules were changed to work around this.

Python Playwright/Chromium was available after installation and supported the browser checks above. These checks do not imply a green full-platform npm build. No merge, production deployment, real payment, WhatsApp send or email send was performed.

## Remaining visual differences

New artwork and generated fictional sample photos; close-substitute fonts; source top illustration/opening not fully visible; extra accessible controls; larger dense QR for reliable scanning; long full names wrap more than the short names in the recording. The sample countdown uses the illustrated joined hands seen in the clip; a customer can upload a wedding photograph instead. Review the actual interactive preview before approving a merge.
