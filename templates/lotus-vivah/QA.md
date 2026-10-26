# Lotus Vivah verification — 2026-10-26

## Automated checks

- node scripts/test-bfday.js: 471 tests passed, zero failed/skipped, followed by successful real-process restart/persistence checks for every family member, including Lotus Vivah and the newly merged Love Letter template.
- npm run test:lotus-vivah: 27 focused template/audio checks passed. Covers page order, omitted/hidden/reordered events, explicitly empty events, duplicate types, dates, copy escaping, malformed colours/links, crop controls, client navigation, native music gesture, checksummed asset restoration and an isolated draft/image/audio/private-preview/publish lifecycle.
- JavaScript syntax checks and git diff --check passed.
- Main was refreshed to 8960f221 before integration. Love Letter's editor scripts, audio route, media reference contract, upload race guards and registration were retained. Its tests passed in the full family runner.

## Real browser

Chromium at 280×653, 320×568, 360×640, 390×844, 430×932, 768×1024, 1366×768 and 844×390. Default and long-form content on all eight cards: 128 card/viewport/content combinations passed whole-card containment, 9:16 ratio, copy-zone overflow, loaded-art, single-current-page and inactive-page checks. Long variant includes multi-part names, long headings/host lines, venue paragraphs, long time and a near-limit closing message. Fitting needed at most a 0.625 typography scale for that fixture. Extremely dense copy at tiny screen sizes is necessarily smaller; no claim of unlimited copy at a fixed readable size.

Normal-motion interaction checks: real cover tap starts the 2.8-second opening, then Save the Date; rapid next taps advance only once; keyboard arrows and horizontal touch swipe advance in order. Uploaded four-second PCM WAV played after the first cover tap, stayed playing across pages and paused from the music control. No music was downloaded from a provider. YouTube acceptance/rendering/state handling is tested but actual provider playback is subject to embedding and browser restrictions, not asserted universal.

The self-contained interactive visual preview passed its hosted render check without failed requests or console errors; its seal opening and next-page navigation were also clicked through in the hosted browser.

## Remaining environment/release checks

The full npm run build verified existing Ganapati and wedding-video asset packs but could not finish the unrelated magazine face-runtime preparation: @mediapipe/tasks-vision is not installed in this sandbox. npm ci was blocked by HTTP 403 fetching dependencies. No dependency pins or lockfile were changed as a workaround. The production build/install must therefore be verified in normal CI/deployment before merging.

Device-orientation permissions on physical iOS/Android phones and playback of a customer's actual licensed song remain release/device checks. Touch/pointer tilt and permission fallback are implemented; reduced motion removes these effects. No production deployment or existing template artwork was changed by this PR.
