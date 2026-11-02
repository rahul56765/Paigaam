# Sita Kalyanam QA — 2026-11-03

## Automated checks performed

112/112 tests passed, zero skips/failures:

    node --test tests/bfday-engine.test.js tests/bfday-aangan-vivah.test.js tests/bfday-lotus-vivah.test.js tests/bfday-audio.test.js tests/bfday-sita-kalyanam.test.js tests/bfday-sita-kalyanam-api.test.js tests/bfday-sita-kalyanam-editor.test.js

The new template's focused tests cover nine-section order, strict/draft/lenient schema handling, every display-copy field, alternate customer identities and no sample leakage, date/time/weekday formatting, custom and overridden countdowns, UTC offsets, expired/invalid countdowns, 0/1/20 events, reorder/removal, galleries and family/venue image references, URL/XSS validation, Maps fallback, QR destinations, audio precedence, no-JavaScript rendering and checksummed asset reconstruction including corruption repair.

The editor tests execute the actual list-control implementation with a small DOM fixture: add/remove including the last row, reorder, 20-card limit, replacing/resuming lists without duplication, preserving the row array used by step validation, and unchanged legacy template minimum-row behaviour. These are unit tests, not a claim of a full editor browser walkthrough.

The API integration test runs the actual shared family router against a new temporary SQLite database and HTTP server, without mocks for ownership/storage/publication. It verifies the editor route and all field IDs, demo, alternate-customer draft, owner-only preview, actual WebP photo upload, actual WAV audio upload, private pre-publication media, saved photo/family/venue/music references, unauthorised updates, cross-origin publish rejection, free publication, referenced media becoming available, cross-customer upload rejection and persistently empty lists. The resulting database row is rendered through the real family entry. The harness does not start the entire production server or test paid Razorpay checkout.

Node syntax checks and git diff --check passed. Runtime dependencies and the package lock were not changed; package.json adds a dedicated test:sita-kalyanam command and invokes it from the existing test chain.

## Browser checks performed

The interactive review is built from the actual renderer, CSS, JS and shipped media, with assets inlined only for the review artifact. It is not a separate customer-facing application.

- Render health check: no console errors or failed requests.
- Open button clicked in Chromium: opening hides, main becomes non-inert and the cover receives focus.
- All nine sections are present in order; natural scrolling works.
- No failed loaded images in the rendered demo.
- First gallery portrait opens the modal; next shows photograph 2; close returns to the gallery.
- Carousel next displays photograph 2 and updates counter to 2 / 3.
- Countdown displays live days/hours/minutes/seconds; changing seconds observed between interactions.
- Red footer shows the current couple names.
- Maps anchor contains the URL-encoded fictional sample venue/address and opens externally with noopener/noreferrer. The fictional address is not a verified geocoded venue.
- Rendered content checked at constrained shell widths 320, 390, 430 and 480 CSS px: no measured overflow in headings, names, parents, messages, event venues or addresses.

The browser available here used a 1280×1280 viewport. Width checks above are container-width checks, not full mobile-device emulation. A nested responsive-frame test was blocked by the artifact browser's origin isolation and was not counted as passed. Real iOS/Android device testing, landscape mobile viewport emulation, end-to-end editor browser upload interaction and actual YouTube/provider playback remain release follow-ups. Media playback depends on the guest's browser policy and provider availability.

## Environment and release boundaries

The npm registry was blocked by the sandbox network filter; access was requested. Therefore npm ci, the full application build, full production-server startup and Playwright device suites were not performed in this run. No weaker replacement dependencies or production changes were made to bypass that restriction. Dependency-free engine, editor and real-router tests above did run successfully.

No production merge/deployment is included in this verification. Routes in README are implemented route definitions, not currently deployed production URLs. The new code is intended for review in its own branch/PR.

## Visual fidelity

Reference: Video-39617.mp4, 716×1274, 30 fps, 32.37 seconds; a phone-filmed invitation rather than original design files. Matching focuses on section flow, framing, ivory/peach paper, pink/green florals, banana leaves, divine figures, temple motif, restrained serif type, portrait gallery and countdown/red footer. Separate newly generated illustrations are a close recreation, not pixel-identical original source artwork. No footage frames or private people from the reference are shipped. Demo portrait subjects are generated fictional sample people.

## Opening seam correction — 2026-11-03

The original opening.webp is now one stationary CSS background; the former moving clipped halves and clouds replacement have been removed. A soft, slow, reduced-motion-aware SVG radial halo is aligned to the original image coordinates and does not alter the image. The opening copy, button, branding, image asset and cover positioning are unchanged. The existing cover fade remains.

113/113 tests passed in the combined family/new-template regression command above, including an added guard for a single unsliced image, absence of old hand-layer CSS and the glow/reduced-motion rules. Browser review v3: no render health errors or failed requests; visual inspection confirms the angular seam is gone; opening button still transitions to the cover. npm installation/full application build and real-mobile testing remain outstanding as documented above.

## ₹99 release preparation — 2026-11-03

The new-template seed price is ₹99 (9,900 paise); existing admin-set prices remain authoritative on later boots. The catalogue thumbnail is 1000 × 688 px, made from the existing opening and cover artwork. The packed asset manifest is updated. Sita Kalyanam joins the existing protected paid checkout path: strict validation and ownership before order creation, upload ownership verification, in-flight/pending edit protections, persistent-storage requirement, generic legacy checkout refusal, and payment settlement that does not mark an unpaid sibling order as paid.

158/158 tests passed after restoring Little Love's own packed test assets via its existing preparation script: family engine, Aangan/Lotus/Little Love, shared audio, existing paid checkout, and all Sita Kalyanam contract, editor, API and fake-gateway paid suites. The fake-gateway tests use a temporary SQLite database and issue no external requests or charges; they verify 9,900 paise, capture requirements, signatures/webhooks, incomplete-draft rejection, ownership, edit locks and sibling order accounting. No real transaction has been attempted. Local npm installation and full application build remain blocked by registry access; real-device testing has not been performed.
