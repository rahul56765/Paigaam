# Love Letter — review QA (26 October 2026)

## Verified

- Full family runner: 417 tests passed, zero failed; all registered templates also survive a real server process restart with saved photos and working owner previews.
- New focused tests: eight-scene ordering; inactive scene isolation; 20 distinct photo fields/captions; all 75 fields placed once; safe escaped text and 10,000-character letters; music URL rejection; restricted upload paths; WAV and MP3 structure checks; private audio ownership and forbidden cross-draft references; public seeking with HTTP Range after publication; orphan replacement cleanup.
- Editor race regression tests execute the actual photoControl source in a small Node DOM harness: replacement locks Remove, cancel preserves old data, recrop saves once, preview pick is blocked during send/upload, send failure restores prior disabled states, song uploads lock the link field.
- Browser rendering: no console errors or failed requests in the portable preview health check.
- Real browser flow: opening → bunny → envelope opening → cream heart letter. Page dots expose all eight pages. Back/restart/finish logic reviewed and tested through browser DOM actions.
- Browser layout matrix: 14 viewport pairs × 8 scenes × default/maximum content = 224 checks; no document overflow or off-edge letter/title/photo/button boxes after fixes. Widths 280, 320, 360, 375, 390, 414, 430, 568, 667, 768, 820, 1024, 1280, 1440. Includes portrait, landscape and short panes.
- Actual browser crop exports: 8 cases using 100-pixel and 1200-pixel sources at 4× zoom across square, heart, landscape and portrait frames. All crops preserved aspect ratio, minimum dimensions and expected corner pixels; no white padding. Cancel returned null and cleaned up the dialog.

## Not yet verified / release gate

- Release authorized on 26 October 2026 at 21:43 IST. Latest main integration passes 434 family tests and process-restart persistence. Deployment and live verification follow the release commit; physical-device and Spotify-provider caveats below still apply.
- Physical iPhone/Android gallery permissions, HEIC conversion and device-specific playback need a final device smoke test. Browser emulation is not a claim of physical-device testing.
- YouTube/Spotify depend on third-party availability/account and autoplay policies. Direct audio and upload API behavior were tested; no commercial recording is bundled.
- npm ci --ignore-scripts returned 403 downloading pinned sharp@0.35.4. No versions were changed or substituted. The server and full family suite run successfully without that preparation dependency; the entire unrelated site-wide build/test pipeline was not claimed.

## Important behavior

- Full production editing belongs to /create/love-letter once released. The portable review includes a local-only photo-crop demonstration, not cloud draft/publish service. Its photos stay in that tab and are not uploaded.
- Long letters grow and scroll to preserve readable type. Mobile scrapbook/final letter arrangements reflow rather than cramming the desktop collage into a tiny fixed canvas.
- Re-cropping a saved photo edits its saved crop; to recover discarded edges, choose the original image again.
- Existing shared family editor is unchanged. Only the Love Letter wizard loads its isolated editor fork.

## Requested envelope and music revision

- Six unaffected scenes (opening, Valentine, heart letter, memories, scrapbook and final letter) are protected by byte-for-byte section hash tests against the approved version. Other layout/art remains unchanged; new CSS is scoped to envelope/music.
- Timed browser envelope check: 14 viewport pairs, 84 samples from opening through 2.75 seconds. Closed letter invisible; visibility starts after the flap turn; rising paper moves at least 85 pixels; no subtitle overlap or document overflow. Minimum observed paper/subtitle clearance 59px. Next hidden through 2.30 seconds, shown/fading by 2.75 seconds. Long heading layout cases also checked. These are browser viewport tests, not physical phones.
- Actual audio playback in a 390×844 phone-sized Chromium frame, using an original generated PCM WAV for QA only: first opening tap yielded playing=true and currentTime>0; switching to memories preserved the same audio and advanced time; OFF paused around73.3s; ON resumed around74.1s. No test audio is included as a default song in the template.
- Real Spotify SDK test: song metadata/player rendered, iframe loading=eager and SDK ready=true. First opening tap did not confirm playback; the correct blocked/extra-tap message appeared. A native Play attempt also did not produce confirmed playback in the sandbox. Spotify's displayed player offered Preview. Therefore full-song/automatic Spotify playback and physical-device success are expressly NOT claimed.
- Mock SDK regressions verify one persistent controller, delayed readiness after OFF, no false success while buffering, authoritative global OFF despite late events, one-tap resume after native pause, explicit switching between primary/backup, clear failure/invalid/empty states, and an eager iframe inside a stable wrapper.
- Live local API test verifies both Spotify and backup URLs survive publication into the recipient page data. Existing upload ownership/range/publish checks remain green.
- Current complete family runner: 417 passed, 0 failed, followed by successful real process restart persistence across every family template.
