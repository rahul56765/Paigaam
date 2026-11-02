# Little Love — five-page interactive scrapbook

A new member of PAIGAAM's existing bfday template family, not a standalone website or application. The design follows the supplied five-page love-card reference. See REFERENCE.md and FIDELITY.md before visual changes.

## Integration

- Registry: templates/bfday.js adds little-love; no shared engine, database, payment or routing logic changes.
- Collection/details: /templates and /templates/little-love.
- Demo: /little-love/demo.
- Personalisation: /create/little-love, using PAIGAAM's existing five-step field-driven editor and live preview.
- Existing /api/little-love/draft, preview, upload, audio-upload and publish routes are provided by the family engine; paid checkout strictly validates required fields and upload ownership before creating an order, with in-process order/edit locking. The generic order endpoint is blocked for Little Love.
- Published instances use the existing /p/:slug flow. Studio copy editing/cloning follows the existing family contract.
- Configured initial price: ₹99 for newly seeded listings; existing database prices and thumbnails remain owner-managed and are not overwritten at startup. Verify production listing after deployment.

## Editable content

Sender/recipient, cover title and CTA, letter title and body, framed photograph, memory heading/photo/caption/note, exactly four photo-strip images, memory audio upload, song title/cover/link/note, optional additional playlist songs, and closing copy. Decorative layout and art are fixed. No per-customer generation or API keys are needed.

The shared musicUpload field is deliberately used for the memory recording so PAIGAAM's existing audio upload validation and ownership checks apply without engine changes. The song and up to four additional songs accept HTTPS direct MP3/M4A/OGG/WAV URLs or YouTube video URLs. Unsupported providers, HTTP URLs, embedded credentials and unsafe schemes are refused. Browsers fetch media directly only after normal metadata loading or a playback gesture; the server does not fetch user song URLs. Prefer media URLs you control that support browser playback. No song download/extraction is performed.

## Behavior

- Cover and final boundary: 70% shrink, hold, perspective Y-flip, grow (1.4 s).
- Interior pages: 350 ms horizontal content slide inside fixed brown stage.
- Arrows, dots, keyboard Left/Right/Home/End, swipe, and replay. Rapid navigation is locked during the transition; reduced motion changes pages immediately.
- Separate waveform recording and compact song player. Native audio has real duration/progress, seek, exclusive playback, pause on page navigation/backgrounding and helpful failures. Waveform is replaced by the actual decoded audio envelope after first play when supported.
- Record button opens a dark green playlist popover. Selected songs play on-page. Previous/next choose playlist tracks, and are disabled when only one song exists. No hidden autoplay and no forced external app navigation.
- YouTube only mounts following a playback gesture. Its visible player and status text are retained for provider-required interaction/errors. Message handling checks both iframe identity and origin.
- Portrait mobile layout adapts the landscape composition for readable copy; desktop retains the reference. Maximum-length letters fit or scroll within the copy zone, never disappear.
- Scripts-disabled fallback displays all five pages. Styles and fonts are local.

## Files and assets

- config.js, schema.js, render.js: contract, validation and server-rendered safe content.
- public/little-love/invite.css and invite.js: namespaced layout and behavior.
- assets/little-love: base64-packed original media and SHA-256 manifest.
- scripts/prepare-little-love.js: restores and verifies only this template's generated assets during existing build/postinstall.
- scripts/pack-little-love-assets.js: developer-only media packing.
- scripts/make-little-love-demo.py: original instrumental source, Python standard library plus system ffmpeg, developer-only (not required at runtime).
- public/little-love/fonts/*LICENSE.txt: Pixelify Sans (OFL) and Homemade Apple (Apache 2.0) notices. Font binaries restore from the manifest.

Do not include source reference frames or video in shipped assets. Generated media are ignored in git; commit packed media, manifest, source code and font-license notices. To revise art: generate/export locally, run the pack script, then verify preparation and review visual comparisons.

## Verification

Commands:

    node scripts/prepare-little-love.js --verify
    node --test tests/bfday-little-love.test.js tests/bfday-little-love-api.test.js
    node --test tests/bfday-engine.test.js tests/bfday-aangan-vivah.test.js tests/bfday-lotus-vivah.test.js

Verified locally on 2026-11-02 with Node 24.22.1:

- 141/141 tests passed across Little Love, its actual family HTTP lifecycle, shared family contract, Aangan Vivah, Lotus Vivah, template studio, shared audio and Diwali Deep.
- All 10 packed assets restore and verify by SHA-256 in a clean directory; corrupt/missing generated media heal correctly.
- After registry access was approved, unchanged pinned dependencies installed successfully with npm ci, all post-install assets verified, and npm audit reported zero vulnerabilities. npm run build passed. No dependency versions or lockfile were changed.
- The complete npm test command passed every configured stage after the ₹99 change, including 639 family tests and Little Love's private owner draft and uploaded photo surviving a real server restart. Offline paid-template tests do not claim a public paid invitation.
- Thirteen Chromium 145 browser scenarios passed against the full server.js application with a new disposable SQLite DB and offline gateway. These include live preview, autosave, voice-note upload, private owner preview, ₹99 checkout and refusal to publish while payments are offline; native MP3 playback/seeking; playlist selection; both transitions; all pages at 390×844, 320×640, 768×1024 and 844×390; complete 900-character letters; keyboard/swipe/replay; reduced motion; and no-script fallback. No uncaught browser JS errors were seen. A separate explicitly free fixture checks the shared free-publication rendering, not the paid production path.
- Mocked gateway tests verify the ₹99 order (9,900 paise), ownership/strict validation, captured-payment settlement and publication, and the in-process race guard. No actual transaction was made.
- Run scoped browser checks with python3 scripts/qa-little-love.py, or full-application checks with LITTLE_LOVE_QA_FULL_APP=1 python3 scripts/qa-little-love.py (developer-only Python Playwright 1.58.0 and downloaded Chromium). Both modes use a fresh temporary local database and disable real payment integration. Screenshots/results are written to the ignored test-output/little-love directory. Additional external audio delivery and YouTube provider messages/network are controlled in-browser test data, not proof of third-party hosting/video availability.

Remaining limits: actual third-party YouTube/audio hosting availability, real payment and Railway production deployment are not verified. No merge or deployment has been performed. Local full-application checks are not production certification.

## Changelog

- 2026-11-02 (checkout audit): for Little Love only, do not mark unrelated pending orders paid when one captured order settles, and reject public paid checkout on a known-ephemeral disk before gateway creation. Mocked verification and signed webhook tests cover late captures, a second pending order and webhook replay; storage rejection uses an isolated child process. Order/edit locking remains in-process only; concurrent server processes do not share it. No real payment was made.

- 2026-11-02 (₹99 launch): set initial price to ₹99, replace cover thumbnail with a 1000×688 rendered screenshot, and scope strict validation, upload ownership, in-process race protection and generic order blocking to Little Love paid checkout. Mock gateway tests verify 9,900 paise and captured payment settlement; real payments are not claimed. Existing database values remain owner-managed.

- 2026-11-02 (full validation): registry access approved; npm ci, build, full npm test and 13 full-server browser scenarios passed. Added a full-server mode to the disposable browser harness and corrected only Little Love's constrained-media hostile-data fixture in the existing family API test. No production validation, dependency versions or lockfile changed.

- 2026-11-02 (audit follow-up): separated provider playback state from navigation cancellation, fixing one-click YouTube replay after completion or an embedded-player pause. Added exact provider-selection and replay regressions; direct MP3 paths containing YouTube-like text remain native. Provider network tests are controlled, not proof of live third-party availability.

- 2026-11-02: added the five-page reference-led scrapbook as an isolated reusable family member, original art/local fonts, voice-note/song playback, playlist popover, two transition types and responsive accessibility support. No existing templates or production data are changed.
