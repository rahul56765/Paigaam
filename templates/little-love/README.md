# Little Love — five-page interactive scrapbook

A new member of PAIGAAM's existing bfday template family, not a standalone website or application. The design follows the supplied five-page love-card reference. See REFERENCE.md and FIDELITY.md before visual changes.

## Integration

- Registry: templates/bfday.js adds little-love; no shared engine, database, payment or routing logic changes.
- Collection/details: /templates and /templates/little-love.
- Demo: /little-love/demo.
- Personalisation: /create/little-love, using PAIGAAM's existing five-step field-driven editor and live preview.
- Existing /api/little-love/draft, preview, upload, audio-upload and publish routes are provided by the family engine; owner checks and upload ownership remain unchanged.
- Published instances use the existing /p/:slug flow. Studio copy editing/cloning follows the existing family contract.
- Configured initial price: ₹0 for new listings; existing DB prices remain owner-managed. No live price is changed by this branch.

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
- Thirteen Chromium 145 browser scenarios passed using the real family routes, renderer, shared editor and a disposable SQLite DB. These include live preview, autosave, voice-note upload, free publish and published rendering; native MP3 playback and seeking; playlist selection; both transition types; all pages at 390×844, 320×640, 768×1024 and 844×390; full 900-character letters; keyboard/swipe/replay; reduced motion; and no-script fallback. No uncaught browser JS errors were seen.
- Run the browser checks with python3 scripts/qa-little-love.py (developer-only Python Playwright 1.58.0 and downloaded Chromium). This launches only tests/fixtures/little-love-browser.cjs on localhost with a new temporary database, not a new production app. Test screenshots and results are written to the ignored test-output/little-love directory. Additional playlist audio delivery is controlled in-browser test data, not proof of third-party hosting availability.

Limits: npm ci and a full server boot could not complete because the sandbox returned E403 for registry.npmjs.org; network approval was requested. No dependency versions or lockfile were changed. The full application dependency install, complete npm test suite, actual third-party YouTube availability, real payment and Railway production deployment are not verified. Do not interpret scoped family/browser tests as production deployment.

## Changelog

- 2026-11-02 (audit follow-up): separated provider playback state from navigation cancellation, fixing one-click YouTube replay after completion or an embedded-player pause. Added exact provider-selection and replay regressions; direct MP3 paths containing YouTube-like text remain native. Provider network tests are controlled, not proof of live third-party availability.

- 2026-11-02: added the five-page reference-led scrapbook as an isolated reusable family member, original art/local fonts, voice-note/song playback, playlist popover, two transition types and responsive accessibility support. No existing templates or production data are changed.
