# Lotus Vivah verification — 2026-10-26

## Automated checks

- node scripts/test-bfday.js: 477 tests passed, zero failed/skipped, followed by successful real-process restart/persistence checks for every family member, including Lotus Vivah and the newly merged Love Letter template.
- npm run test:lotus-vivah: 33 focused template/audio checks passed. Covers page order, omitted/hidden/reordered events, explicitly empty events, duplicate types, dates, copy escaping, malformed colours/links, crop controls, client navigation, native music gesture, checksummed asset restoration and an isolated draft/image/audio/private-preview/publish lifecycle.
- JavaScript syntax checks and git diff --check passed.
- Main was refreshed to 8960f221 before integration. Love Letter's editor scripts, audio route, media reference contract, upload race guards and registration were retained. Its tests passed in the full family runner.

## Real browser

Chromium at 280×653, 320×568, 360×640, 390×844, 430×932, 768×1024, 1366×768 and 844×390. Default and long-form content on all eight cards: 128 card/viewport/content combinations passed whole-card containment, 9:16 ratio, copy-zone overflow, loaded-art, single-current-page and inactive-page checks. Long variant includes multi-part names, long headings/host lines, venue paragraphs, long time and a near-limit closing message. Fitting needed at most a 0.500 typography scale for that fixture. Extremely dense copy at tiny screen sizes is necessarily smaller; no claim of unlimited copy at a fixed readable size.

Normal-motion interaction checks: real cover tap starts the approximately two-second opening, then Save the Date; rapid next taps advance only once; keyboard arrows and horizontal touch swipe advance in order. Uploaded four-second PCM WAV played after the first cover tap, stayed playing across pages and paused from the music control. No music was downloaded from a provider. YouTube acceptance/rendering/state handling is tested but actual provider playback is subject to embedding and browser restrictions, not asserted universal.

The self-contained interactive visual preview passed its hosted render check without failed requests or console errors; its seal opening and next-page navigation were also clicked through in the hosted browser.

## Remaining environment/release checks

The full npm run build verified existing Ganapati and wedding-video asset packs but could not finish the unrelated magazine face-runtime preparation: @mediapipe/tasks-vision is not installed in this sandbox. npm ci was blocked by HTTP 403 fetching dependencies. No dependency pins or lockfile were changed as a workaround. The production build/install must therefore be verified in normal CI/deployment before merging.

Device-orientation permissions on physical iOS/Android phones and playback of a customer's actual licensed song remain release/device checks. Automatic paper/flower float and touch/pointer tilt work without motion permissions; device orientation is consumed only when already permitted by the browser. Reduced motion removes movement while retaining static lit edges. No production deployment or existing template artwork was changed by this PR.


## Targeted visual revision

- Two full cupped lotus paintings form the cover. Actual foreground petal regions are masked out of each complete painting and released in four delayed layers; there are no loose leaf-shaped cover images. The cover seal stays plain even when a logo or explicit monogram text is supplied. Existing optional logo/photo/crop settings remain, with logo/monogram on Save the Date.
- Save the Date gains upper and lower botanical clusters. Existing panel shapes, default colours, eight-card order, field IDs, event hide/reorder controls, music and falling-petal timing/count remain unchanged.
- All five event text groups are centred on their actual panel bounds. Real Chromium measured centre error below 0.03 CSS pixels in the 390×844 sample. Larger default heading/detail type and line spacing retain bounded long-copy fitting. The 128 viewport/content combinations were rerun without overflow or containment failures.
- Soft moving light follows alpha-derived botanical outlines and original panel paths. Inactive pages do not animate their edge paths; reduced motion removes shimmer/parallax and opening delays. Measured foreground translation was 6.25 times the panel translation. Normal-motion opening, rapid-tap lock, keyboard, swipe, uploaded-WAV playback across pages and pause were rerun successfully. An additional alpha-based clearance check found zero flower/text intersections (including a 3 px margin) in all seven text cards with default and long content at 390×844.
- This revision does not resolve the previously documented sandbox-wide dependency-download/build restriction. Production remains unmerged and undeployed.


## Final reference polish and long-running effects

- Closed-cover section hash is unchanged from the approved version: d75946be97d2849938f290c4f21e081468c221434d18e7bc85cd03d914d6f7f6. Cover art, seal, hint, customer text values and field IDs are unchanged. Opening transitions are faster; a real tap reached Save the Date at 1.300 s and its visible crossfade completed at 2.154 s in the test browser. Native audio still starts in the same cover gesture. Rapid taps, arrows, swipe and pause passed again.
- Sangeet and Reception retain the reference-style white card on the right, with a full-height narrow lotus spray decorating the pink side and flowers overlapping the upper/lower card corners. Mehndi retains green, now with equal paper margins and a second floral edge. Text groups remain centred on their actual panels.
- The ribbon element and its CSS are deleted, not hidden. Thank You uses an 80/20 pink/white split, with all lower lotuses unobscured.
- Continuous normal-motion checks sampled the same page at 0, 3, 6, 9, 12 and 15 seconds. Halo opacity stayed between 0.621 and 0.858; flower/border stroke phases, card shine and automatic card/flower transforms all changed repeatedly. No Enable tilt control exists. Base light remains visible between highlights. Reduced motion keeps static light and disables movement; hidden pages/tabs pause decorative work.
- All 128 layout/content combinations were rerun successfully. An additional 128 checks combined eight viewports, four ambient float phases and four maximum touch-tilt corners: no card was cropped by the viewport. Seven text cards with default/long content also passed alpha-based flower clearance with a 3 px margin. Field/flow/media lifecycle and all family restart checks remain green.
- Source and test changes stay confined to Lotus Vivah and its asset packer. No production merge/deployment was performed. The existing full-build/dependency caveat remains unchanged.
