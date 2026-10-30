# Patra Vivah — QA (2026-10-30)

## Automated checks

Command:

```sh
node --test tests/bfday-patra-vivah.test.js tests/bfday-patra-runtime.test.js tests/bfday-lotus-vivah.test.js tests/bfday-aangan-vivah.test.js tests/bfday-audio.test.js tests/bfday-engine.test.js tests/bfday-studio.test.js
```

Result: 117/117 tests passed, zero skips. git diff --check passed.

Includes:
- Registry discovery; all declared fields placed once; exactly three cards irrespective of itinerary length.
- Nested day/event ordering, add/remove/reorder at both levels, draft restoration, aggregate 4-day/10-event limits, required copy and finite text lengths.
- Real standalone editor script executed in a minimal DOM harness (not a browser layout emulator).
- Escaped names/headings/day/time/event/venue/attributes; unsafe image/audio paths rejected.
- Native upload priority, strict HTTPS audio/YouTube host parsing and unusual valid YouTube canonicalization.
- Actual interaction script in a VM DOM: first-tap playback invocation, rapid-click lock, 1950+700 ms opener, dots/arrows/swipe, reduced-motion zero delays, pause/retry/error state.
- Nine artwork manifest checksums and isolated missing/corrupt asset restoration, idempotent and scoped to Patra only.
- Real isolated localhost HTTP draft/save, image and audio upload, ownership/origin/private preview restrictions, publication, public media and post-publish immutability. No test invitation was published to the live Paigaam service.
- Existing Lotus, Aangan, shared audio, engine contracts and studio tests remain green.

## Real Chromium checks

A self-contained demo is generated from the same server renderer, CSS and runtime with the artwork inlined. It is not a second UI implementation; Paigaam's actual authenticated creator stays in the application code. The artifact preview does not save/upload/publish invitations.

The hosted artifact render health passed with no console errors or failed requests. The cover and next-page arrows were clicked in the browser. Final source also carries correct preview mode markup and a semantic no-JavaScript text fallback.

32 containment/layout checks: four content variants × eight available screen/container sizes:
- 280 × 653
- 320 × 568
- 360 × 640
- 390 × 844
- 430 × 932
- 768 × 1024
- 1366 × 768
- 844 × 390

Variants: reference-style default, 40-character couple names plus 4 days/10 maximum-length events, long custom headings, optional contained media. Zero complete-card containment, 9:16 ratio or text-overflow failures. These checks resize the app's available layout region in real Chromium; they are not a claim to physical-device testing on every phone/browser.

Alpha-based painted-art clearance checks inspected live text-line rectangles against transparent artwork at native design resolution, including a 2-pixel safety margin. Default and maximum-content Save-the-Date and Itinerary pages had zero text/art intersections after reserving a narrower final-day event column beside the bottom-right leaves. No text zone uses overflow:hidden to conceal failing content.

Maximum-density schedule font fitting reached about 0.54 of base size. Content remains contained but is much smaller on a narrow phone. The normal seven-event reference layout is recommended for comfortable reading; a fixed three-page design cannot support unlimited large text.

## Remaining release gates

- npm ci --ignore-scripts failed HTTP 403 fetching the repository-pinned sharp 0.35.5. A separate attempted browser-test tooling install also returned HTTP 403. No pins, package files or firewall controls were changed.
- Consequently the full application build and scripts/test-bfday.js live-server runner are NOT certified in this container. The latter stopped at the missing Sharp dependency. Run normal CI install/build and full release smoke tests before merging.
- Actual YouTube audio depends on each song's embed/autoplay availability. It may need another tap. Spotify and Apple Music share pages are intentionally unsupported.
- No production merge or deployment has been performed for Patra Vivah.

## Manual release smoke checklist

1. Complete the normal install/build in the approved environment.
2. Open the new detail/demo/creator routes and verify artwork loads after a clean startup.
3. Create a draft; edit names/headings/date, add/remove/reorder both days and entries, resume the draft.
4. Upload a transparent logo and a portrait, remove each, check the preview's contained layout.
5. Upload an owned WAV/MP3; test real first-tap play, pause/retry, replacement and a direct audio URL on iOS Safari and Android Chrome.
6. Publish a test invitation only with permission and verify persistent artwork/media after restart.
