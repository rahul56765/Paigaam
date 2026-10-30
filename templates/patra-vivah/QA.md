# Patra Vivah — clean-video and visible-editor QA (2026-10-30)

## Scope / preservation

Only the cover was replaced and Family Welcome appended. Automated hashes assert approved default Save the Date HTML (SHA256 f9475542f0865780ef8211a9255750648e0d13879032d1ae658d4b2fef63da7f), Itinerary HTML (2b299a3a7252ac163e9e31fed04a337fe7acdc6e2a6e47e2bab17c7beceb7ce4), and all 11,045 bytes of approved content-card CSS (2a0b0904f4ee7718ffcd3fe47a3e1a5d936f0673d1522756eb8206b5be145d09). Original page art, choreography, names/date/schedule editor and song controls remain.

## Automated tests

```sh
node --test tests/bfday-patra-vivah.test.js tests/bfday-patra-runtime.test.js tests/bfday-patra-family-editor.test.js tests/bfday-patra-family-render.test.js tests/bfday-patra-demo-editor.test.js tests/bfday-lotus-vivah.test.js tests/bfday-aangan-vivah.test.js tests/bfday-audio.test.js tests/bfday-engine.test.js tests/bfday-studio.test.js
```

Result: **136/136 passed, zero skips**. git diff --check passed.

Coverage:
- Four-page registry/render/navigation/inert/aria state, exactly one creator placement per field.
- Original nested itinerary add/remove/reorder/capacity/draft behavior and finite lengths.
- New family owned image field, 100–250% zoom and 0–100% X/Y limits; original URL retained while crop settings change.
- Actual standalone family-editor code in a minimal DOM harness: photo transforms, range events, restored drafts, soft Maps warning and clearing. Generic gallery choose/replace/remove code is reused; no guest upload control is exposed.
- Strict Maps host/path/protocol checks, malicious/lookalike hosts/credentials and unsafe schemes rejected as navigation; invalid text remains editable without preventing draft/save. No link fetching or resolution.
- Valid address + button hrefs, blank-button hiding, invalid-link soft guest message, editable Maps button label and escaped family copy/newlines.
- Actual interaction script VM tests: first-tap native audio invocation, video playback invocation, decoded-time glow, rapid-tap locks, four-page arrows/dots/keyboard/swipe, reduced-motion skip, media error/stall fallback, music pause/retry/error behavior.
- Eleven media/art checksums, scoped idempotent missing/corrupt asset restoration.
- Fast-start MP4 atom order; actual localhost video byte-range 206 and HEAD responses.
- Real isolated localhost HTTP draft/save/image+audio upload/private preview/publication lifecycle, including family-photo ownership rejection across drafts, persisted crop settings and rendered Maps links. No invitation was published to the live service.
- Existing Lotus/Aangan/audio/shared-engine/studio regressions stay green.

## Real Chromium invitation checks

The self-contained preview uses the same server renderer, stylesheet and runtime with media inlined; it is not a second invitation implementation. It does not call Paigaam's authenticated save/upload/publication APIs.

- Actual tap played the inline muted 720×1280 video, paused near currentTime 4.4466 of duration 4.5, and reached Save the Date with white opacity 0, no media error and counter 2/4.
- The source video contains only H.264 video after encoding; its AAC soundtrack is removed to preserve the user's chosen song.
- The fourth page dot was clicked; Family Welcome rendered with counter 4/4 and the final Next button disabled.
- The first-frame poster and entire video use contain on the unchanged 9:16 canvas.
- 32 Family Welcome layout cases passed: four variants (empty photo, extreme crop, maximum-length text/photo/valid map, long copy without photo) × eight available regions below. Zero full-card containment, ratio, text overflow or photo/text intersection failures. Minimum measured maximum-density family text fit was about 0.56.

Available regions:
280×653, 320×568, 360×640, 390×844, 430×932, 768×1024, 1366×768, 844×390.

The earlier approved content pages passed 32 analogous default/long-heading/max-schedule/media checks and alpha-painted-art clearance with 2px margin. Their HTML/CSS is now hash-guarded and unchanged. These are real browser layout-region checks, not a claim of physical-device testing on every phone.

## Media details

Current source upload: VID_20261030_170835_744.mp4, 720×1280 at24fps, 10.0267s. Delivered opening is only0–4.5s, muted, YUV420p H.264, fast-start, 1,267,667bytes. Video currentTime drives the overlay from3.85s to full white at4.35s; playback pauses around4.43s before transitioning to the approved content. A160ms white hold plus850ms settle window completes the sequence in roughly5.4s at normal playback. Original motion is not sped up. The later kalash scene is not presented.

## Current fix: visible editor and clean cover

The previous artifact had no editing panel because it intentionally rendered only the guest view. The opt-in public demo/artifact now visibly exposes “Edit Family Welcome”. Authenticated creator controls are still present and unchanged; guests and normal creator iframes have no demo controls.

New source is the supplied watermark-free replacement, not the earlier file. Eighteen samples of the formerly marked lower-right corner from the delivered opening were visually inspected; no logo/watermark was visible. The poster is regenerated from its exact first frame. New opening-clean.mp4 and opening-clean-poster.webp URLs prevent old-cache reuse. The current manifest excludes the old video/poster; their base64 files are deleted and startup removes the two old generated public files. Historical Git commits/thread attachments are not rewritten.

Real browser interaction tested:
- Clicked “Edit Family Welcome”; the editor and gallery picker were visible.
- Used the real browser file input to select a synthetic 1600×1200 PNG crop target (no fabricated family/person photo). Live card and editor showed the image with object-fit:cover, no stretching.
- Filled the Maps URL field through the real UI; both address and button received the correct HTTPS URL.
- A real 390×844 nested browser viewport played the clean muted inline video from a ready matching poster at time0, finished near4.4409s of4.5s without decoder error, and reached Save the Date.
- The mobile viewport used the actual file-input change/FileReader/decode path; zoom185%, X20%, Y80% rendered matrix1.85 and object-position20%80%. Remove and replace succeeded. A valid link created the href, a lookalike host showed editor+guest warnings with no href, and blank input hid the button.
- Actual iframe window sizes320×568,360×640,390×844,430×932,844×390 and768×1024 all passed complete-card9:16 containment, text fit, photo clearance and editing-panel bounds. Unlike earlier region-only checks, iframe tests exercise real CSS viewport breakpoints. These are Chromium responsive checks, not physical iOS/Android device certification.
- Hosted artifactv6 render health passed with no console errors or failed requests.

Demo state is browser-local and explicitly labelled, not a server upload/save. No API call, provider fetch, localStorage write or production publish is performed by the local demo editor.

## Release gates / limitations

- The previously attempted pinned dependency install was blocked by HTTP403 fetching sharp0.35.5. No dependency/lockfile/environment/deployment settings have been changed. Full application install/build and the complete live-server family runner remain unverified here; run normal CI/approved release environment before merge.
- No production merge or deployment has been performed. Work updates the existing draft PR75 and the existing preview artifact.
- YouTube autoplay/embed availability remains provider-dependent and may need another tap. Uploaded/native songs retain first-gesture playback and retry controls.
- Maps validation confirms supported URL structure, not the correctness of a real-world venue. The link opens the app or browser according to the guest's device.
- Maximum-length text fits but is necessarily smaller on narrow screens. A large readable type size cannot be promised for unlimited copy inside a fixed9:16 page.
- A missing photo removes the guest frame and expands the welcome copy area; only the creator sees an upload prompt. No family photo is fabricated for the demo.

## Release smoke checks

1. Run normal pinned install/build and the full app suite.
2. Open detail/demo/creator, tap/replay the opening on Android Chrome and iOS Safari, including a slow connection and reduced motion.
3. Resume an existing draft; confirm original names/date/itinerary/song unchanged and new fields default safely.
4. Pick a family image from gallery; adjust zoom/X/Y, replace and remove; compare the crop to guest preview.
5. Test empty, valid and malformed Maps text; tap both address and button with a valid link.
6. Test a real uploaded/native song on the first cover tap, pause/retry and replacement.
7. Publish/restart-check a test invitation only with permission; confirm owned image/song and packed video remain available.
