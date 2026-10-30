# Patra Vivah

A reference-guided Paigaam wedding invitation with four complete 9:16 cards: tap-to-open banana-leaf cover → Save the Date → Wedding Itinerary → Family Welcome. Isolated member of the existing family engine. This feature remains on PR75, not merged or deployed.

## Revision scope and preservation

The 2026-10-30 second brief changes only the cover and appends Family Welcome. The approved Save the Date and Itinerary markup is byte-identical to the first delivered version, including original words, painted artwork, independent leaf sways, arch glow/travelling light, cloth/garland motion, sequential text, schedule editor and music behavior. The original scoped stylesheet remains an unchanged prefix; revision rules target only the new cover/family page. Automated preservation hashes guard both approved content cards.

## Reference-video cover

The user supplied a 720 × 1280, 24 fps video. To preserve its precise leaf design, bow-untying and opening motion, opening.mp4 uses the actual 0–4.5 second envelope section, encoded as a contained H.264/YUV420p fast-start MP4 without the source soundtrack. The matching first-frame poster prevents a poster/play jump. No new generated opening is substituted. The later kalash scene is not shown: a soft white overlay becomes fully opaque while the leaves open, before that scene appears, and the player pauses near 4.43 seconds. White then fades over the unchanged Save the Date. The sequence normally takes roughly 5.4 seconds including the crossfade; the video motion itself is not sped up.

The cover never autoplays before a tap. Its full-page button retains editable tap-to-open text. Native customer music starts synchronously in the first tap handler; the opening video is muted and inline so it cannot compete with the chosen song. Video currentTime, not a wall-clock transition, drives the white light. Buffering cannot silently skip the opening. Repeated taps/navigation are locked until settled. Media rejection/error or a 15-second stalled-media watchdog gives a soft message and white transition to the invitation rather than leaving a guest stuck. Reduced motion skips the video and decorative movement. Replay after returning to the cover resets to the same poster and first frame.

The cover retains the supplied video's appearance and background. It does not reintroduce the earlier illustration or unrelated photo props. Whole-card object-fit is contain, not cover.

## Artwork, layout and motion

Page two uses separately extracted painted banana leaves and red/golden-yellow knotted cloth. Page three retains the supplied feet, tied cloth, marigold garlands and lower-right leaves. Reference lettering, tabletop, envelope backdrop and watermark are excluded from those painted layers. Fonts and some borders are close recreations, not a claim of original editable source artwork.

Every card lives on a fixed 720 × 1280 canvas scaled uniformly to the available stage. Navigation and device safe areas stay outside it. Narrow, short, landscape and desktop screens show the entire design with surrounding space where needed. Live escaped text fits inside reserved zones after layout/fonts are ready. No text clipping conceals overflow.

Four leaf regions per side have independent breeze timing. The pointed red/gold arch glows and carries a travelling highlight. Cloth/garlands move slightly. The same seven tiny yellow margin petals continue on Save the Date, Itinerary and Family Welcome. Current page is announced, inactive cards are inert, and arrows/dots/swipe/keyboard now navigate four pages. Hidden-page/tab decorative animation pauses. A no-JavaScript visual and semantic text fallback remains.

## Existing itinerary customization

All original field IDs/defaults and nested editor behavior are retained. Schedule contract:

```json
{"days":[{"heading":"SATURDAY | August 22, 2026","events":[{"time":"4:00 PM","event":"Wedding Ceremony","venue":"Silver Meadow Inn"}]}]}
```

Add/remove/reorder both days and events. Maximum four days and ten total entries; heading 44, time 16, event 44, venue 80 characters. Publication requires a complete day/event. Seven entries is the comfortable reference-style default; maximum-density content necessarily shrinks on narrow phones. Unlimited large text is not possible inside a fixed four-card format.

## Family Welcome customization

Family Welcome is the fourth invitation page and its own creator step before Music. It reuses the exact cream background, red/gold pointed arch, fonts, glow/travelling light, sequential reveals and yellow petals—no unrelated decorations.

- familyPhoto: optional creator-owned upload, tap-to-pick gallery frame with replace/remove.
- familyPhotoZoom: 100–250%; familyPhotoX and familyPhotoY: 0–100%. Sliders control a non-destructive 5:4 image window. The stored uploaded image is not overwritten by crop changes. The creator and guest use the same object-fit, object-position and transform-origin rules. Image cropping is intentional inside the photo frame only; the complete invitation is never cropped.
- regardsHeading: default “With warm regards”, editable, script font.
- familyName: default “Deshpande Family”, editable.
- familyWelcome: default “Welcome”, editable.
- familyVenue and familyAddress: editable venue and multiline address.
- familyMapsLink: optional editable plain text with advisory format validation, not an arbitrary navigation URL.
- familyMapsLabel: editable button text, default “Open in Google Maps”.

With a photo, text fits in a safe zone below the frame. Removing it removes the frame and expands/recenters the welcome area—guests do not see an unfinished upload prompt. Only the creator sees the tap-to-upload control. The demo uses a sample venue/address consistent with its sample itinerary; no family photo is fabricated.

A valid supported HTTPS Google Maps URL makes both venue/address and button clickable, opening the app/browser according to device behavior. New-tab links use noopener/noreferrer. Blank links produce no button. Malformed, unsupported, credentialed, script or lookalike-host links stay editable but never become hrefs; the editor and guest page show a gentle warning. Validation checks URL structure/approved hosts only; it never fetches links and cannot verify a real-world venue's correctness. Supported hosts are bounded Google Maps hosts including google.com, google.co.in, maps.google.com, maps.app.goo.gl and goo.gl/maps.

## Media and security

Existing couple photo/logo and song controls remain unchanged. Shared engine ownership, origin, MIME/header verification, private drafts, persistent storage and publication checks apply to the family image. Music uploads accept MP3/M4A/OGG/WAV up to 15 MiB; upload overrides a direct HTTPS song URL/YouTube link. YouTube is provider-dependent and can require another tap. Spotify/Apple share pages are not playable audio URLs. Use music/media you have rights to share.

## Files and asset restoration

- templates/patra-vivah: config.js, schema.js, render.js, README.md, QA.md.
- public/patra-vivah: scoped patra.css/patra.js and contained opening media/art.
- public/bfday/itinerary-editor.js: existing opt-in nested editor.
- public/bfday/family-editor.js and family-editor.css: Patra-only crop preview and soft Maps status.
- public/bfday/family-maps.js: shared server/browser parsing-only URL validator.
- assets/patra-vivah: eleven checksummed base64 media/art assets. Original unused flat envelope is retained for reversibility; opening poster/video and refreshed thumbnail are packed too.
- lib/bfday/assets-patra-vivah.js restores missing/corrupt files on family startup.
- scripts/pack-patra-vivah-assets.js regenerates the manifest/text pack after media edits.

No new dependencies, lockfile, environment variables, deployment configuration or storage volume. Existing streamFile supports MP4 byte ranges/HEAD and fast-start playback. New scoped CSS/runtime use v2; shared creator cache is bumped for the Family Welcome hook. No changes to the separate wedding-video feature.

## Verification and release gate

See QA.md. The prior sandbox dependency install returned HTTP 403 for pinned sharp 0.35.5. Built-in Node unit/integration tests and the hosted real-browser invitation run without replacing dependencies; the full app build/full server runner remain a release gate. Run normal CI install/build and release smoke tests before merging. Do not change pins to mask this environment limitation.

## Changelog

### 2026-10-30 — requested revision
- Replaced only the cover with the supplied video opening, matching poster, decoded-time white transition, first-tap music, buffering/error fallback and reduced motion.
- Appended Family Welcome with matching arch/type/petals, non-destructive gallery photo crop controls, editable closing/venue/address and safe Google Maps behavior.
- Updated navigation to four cards and added preservation, maps, crop, media, layout and lifecycle regressions.

### 2026-10-30 — initial delivery
- Added the original three-card reference-guided template, transparent artwork pack, nested itinerary editor, optional couple/logo images and music. Delivered as draft PR75 and an interactive preview, not a production deployment.
