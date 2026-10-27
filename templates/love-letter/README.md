# Love Letter

Separate, original eight-page Paigaam template inspired by the customer’s screen reference. Existing templates and published greetings are not rewritten.

## Routes and integration

- /love-letter/demo — read-only sample
- /templates/love-letter — collection detail (automatic registry)
- /create/love-letter — schema-driven editor with dedicated crop and upload support
- /love-letter/preview-frame — stateless embedded editor preview
- /api/love-letter/draft, /upload, /publish — standard family lifecycle
- /api/love-letter/audio?id=DRAFT — owned MP3/WAV upload, at most 12 MB
- /bfday/uploads/FILE — private until referenced by a published greeting

The family loader registers templates/bfday.js. Audio references participate in draft ownership verification, public-reference checks, replacement cleanup and the seven-day sweep. Uploads are serialized per draft; publication is blocked while an upload is pending. The shared editor remains unchanged: pages/bfdayCreate.js chooses public/love-letter/editor.js only for this slug. This is an intentional isolated fork of the family wizard; port shared fixes deliberately.

## Editable content

75 fields: all visible sender copy, names, button labels, three full letters, music title/source and twenty independent photo/caption pairs. 3 reminder, 9 memories (including central heart and 4 hanging polaroids), 4 scrapbook and 4 final-letter photographs. Editing controls appear in creator previews only; recipients see no upload controls. Every slot can be uploaded, replaced, recropped or removed. Crop preview has drag/pan, keyboard-accessible position/zoom sliders, aspect-preserving JPEG export, low-resolution warnings, 15 MB source-file limit, 2 MB exported-file limit. Crop commits only on Use photo. Server magic-byte and dimensions checks remain authoritative. Re-cropping a saved upload uses that saved crop; choose the original again to recover previously discarded edges. HEIC must first be exported to JPEG/PNG/WebP.

Text uses escaped HTML, newline-preserving text boxes and naturally growing pages. The heart has cream lobes and a tapered point around a growing body so long messages do not overflow a fixed shape. Final and scrapbook letters grow naturally; torn edges do not clip text. On narrow phones, the collage reflows for legibility while retaining the maroon/blush/cream palette and motifs.

## Music

Revision 2026-10-26: separate Spotify song field plus the existing songUrl upload/link as backup. Existing songUrl Spotify/YouTube values remain compatible. One controller lives outside hidden/inert scenes, keeps the same Spotify iframe across pages, attempts playback after the first opening tap, and provides a persistent on/off button. Spotify's SDK supplies actual playback/buffering state; the interface never reports a successful start solely because play() was called. A persistent host owns a replaceable SDK mount; the inserted iframe is explicitly eager-loaded because Spotify otherwise marks it lazy and an offscreen persistent player would not become ready. The native player is positioned inside the music slide without reparenting/reloading it. A master OFF remains authoritative over late events. Backup and Spotify can be switched explicitly when ready.

Spotify is not a guaranteed full-song source. Browser interaction, provider account/region availability and preview restrictions still apply. In actual sandbox QA the track/player loaded and the SDK was ready, but first-tap and native Play attempts did not confirm playback. A clear extra-tap/fallback message is shown; this is not reported as successful Spotify audio. For dependable full-length playback, use an uploaded or licensed direct audio file. Physical iPhone/Android verification remains a release smoke test.


Uploaded MP3/WAV, HTTPS direct audio (MP3/WAV/OGG/M4A/AAC), YouTube video or Spotify track. Music never autoplays; direct audio has play/pause/seek. YouTube/Spotify mount a consent-on-tap service embed with their own transport. External service availability, ads, autoplay policy and account restrictions still apply. Generic webpage links are not audio files and display a clear explanation. Upload only music the creator has permission to use. No commercial demo track is bundled.

## Accessibility and motion

One interactive scene at a time, hidden/inert inactive scenes, focus-managed headings, back/dot navigation, accessible buttons/ranges, optional audio, reduced-motion support. Lightweight original SVG botanical illustrations and CSS transform/opacity animations; rose art is a single reusable symbol rather than repeated geometry. No heavy animation library. Final reading pages intentionally scroll rather than shrink type or clip the message.

## Build / QA

- node --test tests/bfday-love-letter.test.js
- node scripts/test-bfday.js (all family routes + real process restart)
- node scripts/preview-love-letter.js /absolute/output.html

No new dependencies. npm ci currently returns registry 403 for pinned sharp; no dependency versions were substituted. The existing server and targeted suites can run without executing image-preparation builds.

Status: production deployment authorized by the owner on 26 October 2026 at 21:43 IST. Release prepared against main bb4a0af2bfaf09d01b5f01da4a4a4e2825474154. All 434 current family tests and restart persistence checks pass; final live deployment verification is tracked in the release conversation. No design changes were made for release.

## Changelog

2026-10-26 — Envelope/music revision only: opaque fully closed letter, reserved rise space, 0.95-second flap rotation, delayed 1.5-second letter rise, glow/hearts and Next fade ending about 2.7 seconds after opening; reduced-motion and BFCache restoration handled. Added separate Spotify field, persistent SDK/audio controls, explicit backup source, eager stable iframe mounting and playback state regression tests. Six unaffected scene sections verified byte-for-byte unchanged.

2026-10-26 — Initial eight-page build, original botanical SVG art, envelope reveal, unfolding heart paper, photo cropper, embedded-preview photo selection, debounced draft persistence, owned audio upload, responsive layouts and isolated editor.
