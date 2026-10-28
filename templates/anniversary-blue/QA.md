# Anniversary Blue — verification record

Date: 2026-10-27. Repository base: rahul56765/Paigaam main e9eb77a877ffa543ab5319c511d7bffb26a07be8. This is a local implementation and review package; not a live deployment.

## Automated application checks

Command: node scripts/test-bfday.js

Result: 466 tests passed, zero failures, zero skips. Disposable local data and localhost server only. Includes all existing family suites, QR cards, anniversary schema/render/viewer tests, editor/crop lifecycle tests and real API ownership/publish tests. The runner restarts the server and verifies all family members' published instances, photos, share-card image references, and draft ownership persist. Anniversary Blue, Birthday Atelier and Love Letter all passed. No production records created.

Anniversary-specific coverage (22 test cases plus many assertions):
- Exactly ten scenes; one active, inactive scenes hidden/inert.
- All 41 fields placed once in six editor steps; variable photo/reason lists.
- Escaping, script injection, restricted standalone/nested photo references, safe audio URLs and strict Spotify host/path validation.
- Maximum 12000-character letter, 40 reasons, 9 tall photos, 15 sliding polaroids, 9 Forever photos, full captions; over-limit rejection and lenient safety.
- Correct editor/viewer affordances and separate assets; no mutation to old template sources.
- Actual local audio API: file sniffing, draft ownership, other-template refusal, CSRF, private media, stranger refusal, reference verification, upload cap, range seeking, publish, replacement cleanup and no post-publication editing.
- Viewer execution: one audio instance across screens, first-tap mode, reveal timing, carousel/restart, custom hint retention and ignoring foreign iframe messages.
- Spotify regression: delayed playback events cannot undo global music-off. Fallback embedded iframe is removed when music is disabled. Generation guards prevent callbacks from superseded Spotify controllers or native audio elements changing the current player state.
- Known webpage links from YouTube, Spotify, SoundCloud and Apple Music are rejected in the direct-audio field; Spotify belongs in its dedicated field. Signed file URLs remain supported. Arbitrary remote URLs cannot be guaranteed to serve audio without attempting playback; recipients receive a clear playback error instead of silent fake spinning.
- Editor execution: list defaults/reset/reorder/remove/add, nested photo identity after reorder, iframe origin/source checks, current source recrops, cancellation, disposed crop/upload races, blocking sends during pending media, owned draft/audio/publish paths.
- Crop execution: exact ratios .55/1/.85/1.3, 1600px long-edge ceiling, JPEG quality .93, no source upscaling even at high zoom, cancellation cleanup.

## Real browser checks

Portable review opened in Chromium through Hyperagent browser.

- Start -> Surprise, Bouquet -> Disc, Gift -> Folder, Cake -> Envelope.
- Disc buttons and folder icon routes, all Next and Back paths exercised.
- Envelope: actual flap rotation matrix reaches 180 degrees; letter translates upward; aria-expanded true; read button becomes visible after animation. Initial tester click hit a page dot; retry on the actual envelope succeeded.
- Actual generated WAV test tone (test fixture only, not bundled song) played through the native audio element. Record aria-pressed true, body playing class present and animation-play-state running; persistent toggle paused it.
- Actual cropper: 1400x1000 synthetic test image; tall ratio .55, zoom1.5, horizontal movement .5. Output366x666 JPEG, no stretching/upscaling. Live preview and Use photo completed. Synthetic fixture not shipped as personal content.
- Actual carousel selected centre frame3/5 and measured centre alignment error0px.
- Visual screenshots reviewed for opening desktop/mobile, Forever mobile, Reasons mobile, and gingham folder. Folder lid corrected to a scalloped wave; folder icons match the hand/envelope/folder reference motif.

### Responsive geometry

All ten scenes audited at effective viewport widths278,318,358,373,388,412,428,598,766,1022px. Zero horizontal document overflow and no off-edge buttons/headings/captions/letter-copy/reason rows. Decorative sticker bleed and intentional horizontal carousel track are excluded.

Stress audit at actual widths280,320,390,430,768px: 12000-character unbroken letter, forty500-character reasons, 120-character captions, maximum tall/Forever lists, 120-character headings and 40-character buttons. Zero measured horizontal document overflow or off-edge content across all ten scenes. Long letters/reasons disable decorative paper rotation; long captions disable photo tilt. Content remains scrollable vertically. Tests target no cropping, not a promise that unlimited text fits one phone viewport.

### Render health

Portable artifact versions1 and later checked with Hyperagent render-health service. Final status is recorded in the conversation tool results. No runtime dependency on a CDN animation library; only Google Fonts and the opt-in Spotify service are external.

## Limitations / release gates

- No physical iPhone/Safari or Android device check yet. Chromium viewport tests are not a substitute for all devices.
- Real Spotify account/sign-in/full-track playback not tested. Provider permissions and preview restrictions apply; its own Play tap may be needed. Native owned audio is the reliable full-file option.
- Portable artifact is a design sandbox: photo and music trials stay in the tab. Persistent full text/list changes, owner previews, autosave and publishing are in the integrated Paigaam editor, exercised locally through tests.
- JPEG/PNG/WebP photos and MP3/WAV uploads; not claiming support for every phone camera format. A low-resolution source cannot become sharp; cropper warns. Uncropped originals survive only within the current editing session; after reload, replace from the original file to restore cut-away edges.
- Full npm ci was blocked by registry403 on sharp0.35.4; no dependency substitutions made. The dependency-free local family/API suites completed successfully. No claim that the unrelated full production asset build was rerun.
- No GitHub push, merge or production deployment performed. Obtain approval, rebase against current main, rerun checks, then release and verify live routes.
