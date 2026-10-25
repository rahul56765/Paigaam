# Chandni Royale

## Status / source of truth

New additive wedding template built for owner review, 25 October 2026. Not merged, deployed or published. Production and all existing invitation designs remain unchanged. The opening film has intentionally NOT been fabricated: the owner will generate and upload it from the supplied keyframes and prompt. Current review opens the generated gate still, explicitly labels the missing film, and offers a static handoff to the complete invitation.

Reference: https://www.instagram.com/reel/DeZe4JVI_my/ by zareqia. Inspected the entire 19.23-second reel in chronological frame samples, including the invitation visible inside the phone, not the outdoor phone-filming presentation. Original vendor imagery/video/code is not shipped.

## Reference sequence and our implementation

- 0–2s: ornate gold filigree double gates, ivory ribbon bow and white floral crown; tap-to-open treatment. Newly generated gate artwork in our build.
- 2–6s: gates open toward a burgundy-draped balcony; moon and palace emerge. This is the fixed opening FILM slot, awaiting the owner's supplied MP4. Do not replace it with a CSS gate reconstruction or claim the film exists.
- 6–9s: moonlit balcony, gold script names stacked with family details and a scroll cue. Custom Chandni renderer with real editable HTML typography.
- 9–11s: invitation letter over dark-to-ivory transition.
- 11–14s: rose-gold heart scratch reveals wedding date/time. Real pointer-driven canvas erasure, auto-completes after ~42% removal; keyboard/button alternative.
- 14–16s: calendar download and illustrated/photo panel.
- 16–19.23s: countdown, program timeline, venue and map.
- Optional travel/stay/dress/gifts and minimal WhatsApp reply are Paigaam editing features beyond what the short reel demonstrates. We do not claim the reference showed unseen sections.

## Original artwork

Five original generated image assets, optimized WebP total 921,352 bytes (~900 KiB):

- gates-closed.webp — closed gold gates, white bow and ivory rose arch.
- balcony-moon.webp — matching moonlit palace balcony, burgundy drapes and candles, clear center for names.
- ivory-paper.webp — subtle ivory cotton paper with restrained gold confetti.
- romance-painting.webp — clearly illustrative palace romance scene, used when no customer photo is uploaded. Never presented as a real customer's photo.
- scratch-foil.webp — tactile rose-gold metallic foil used as the erasable heart coating.

Original generation refs are recorded in the Hyperagent project thread. No copied seller artwork or stock imagery. Assets are packed under assets/chandni-royale as SHA256-checked base64 chunks and restored to public/assets/chandni-royale at boot by lib/chandniRoyaleMedia.js. Run node scripts/pack-chandni-royale-media.js after intentional asset changes. Do not commit the restored public binaries through a text-only integration.

## Source map

- templates/chandni-royale/config.js: registry metadata, draft status, static thumbnail.
- templates/chandni-royale/renderer.js: its own head, bootstrap, private/passcode and closed screens.
- public/chandni-royale/invite.js / invite.css: entirely independent invitation visual system and interactive behavior. No Shaadi/Suvarna guest renderers or artwork.
- public/shaadi-paigaam/chandni-royale-core.js: route-scoped adapter over the existing validated schema/date/language helpers; isolated media namespace, twenty functions, upload-only music and WhatsApp-only RSVP.
- lib/chandniRoyaleRoutes.js: isolated native editor/API/publishing/version/media routes. Uses cr_owners, cr_pending, cr_versions, cr_uploads. No new guest RSVP table or guest data form.
- pages/shaadiPaigaamCreate.js / public/shaadi-paigaam/editor.js: reused seven-step editor with scoped Chandni labeling, data adapter and local draft key cr-ed. Existing templates keep their prior defaults/asset revisions.
- lib/chandniRoyaleMedia.js, scripts/pack-chandni-royale-media.js: deterministic original artwork restoration.
- tests/chandni-royale.test.js: scoped model, isolated API and real-server integration tests.
- tests/chandni-royale-renderer.test.js: safe bootstrap, visual isolation, private views, media hashes, no eager media/guest form.

## Editing / guest behavior

The normal seven-step Paigaam customizer edits names, family details and welcome letter; date/time/time zone; up to twenty named functions with individual date/start/end/venue/address/note/dress and preserved order; main and reception venue; couple portrait and up to eight gallery images with crop positions; optional uploaded music; font/language and paper UI accents; privacy/share details. The generated palace art remains the fixed visual theme, not a customer-controlled background.

Guests scratch or use the accessible Reveal button, save an ICS calendar file with the chosen time zone converted to UTC, browse uploaded photos in a keyboard-accessible lightbox, view a live countdown, read functions, and open map directions. An embedded OSM map is loaded only when explicitly requested. No fake location map or live map request on initial load.

RSVP is two choices only. Invitation creator supplies the organiser's WhatsApp number, required before publish. Each option opens wa.me with the choice and couple context in a prefilled draft. The guest must tap Send in WhatsApp. Paigaam neither sends the message nor stores guest names, phone numbers or replies. In a demo without an organiser number, both choices remain visible and disabled with an explanation. Legacy guest response endpoints return 410 whatsapp_only.

Music is optional, customer-upload only. No built-in library or arbitrary remote URL; no audio object, audio src or request before tapping Play. Main opener is also instantiated and assigned its URL only after deliberate tap. Skip works during loading/playback. Video errors preserve access to the invitation. Replaying or leaving stops and releases film/audio.

The live editor accepts only same-origin parent-window sp:data messages and revalidates them with the scoped adapter. Photos/audio use the invitation's own /chandni-royale/media namespace and ownership rules; no cross-template upload reuse.

## Opening film handoff

See docs/CHANDNI-ROYALE-VIDEO-PROMPT.md for prompt and negative prompt. Use original generated gate image as first frame and balcony image as last frame. 9:16, preferably 1080×1920, 8–10s, H.264 MP4, yuv420p, fast-start. No names, dates, watermarks, logos or phone mockup baked into the film. Hold final balcony composition ≥1s. No music required.

When the actual MP4 arrives:

1. Inspect its duration, dimensions, speed, audio and first/last frame; verify continuity against the invitation hero.
2. Place it at public/assets/chandni-royale/opener.mp4, then run the packer. The route's openingVideo flag is filesystem-derived, not assumed true.
3. Keep the original received film separately if optimizing. Do not overwrite, retime or silently change its audio; confirm any material edits with the owner.
4. Test tap-to-play, loading/error/skip/replay, mobile frame fit and end-to-live-HTML handoff before enabling the catalogue item.
5. Update this doc and changelog in the same PR as film integration.

## Validation

Focused checks passed: 8 new model/API/server/renderer/media tests, 61 Shaadi checks, 64 Suvarna checks, 10 admin/collection tests, 5 builder tests and 26 premium UX tests. After registry approval and local MediaPipe asset preparation, full npm test completes successfully (exit code0); the earlier dependency-blocked result is superseded. Automated backend/model/integration tests and regression results are recorded in the PR. The static review's render health and interactive browser tests are separate from authenticated server-editor testing. Browser checks cover 320/390/430px embedded viewports, long names, twenty functions, Hindi layout, actual canvas erasure, disabled/active WhatsApp choices and zero initial audio/video loads. No WhatsApp message or payment was sent.

Known validation limits: the final opening film is not supplied, and no real payment, WhatsApp send or final-film playback is claimed. Native authenticated local-editor browser QA now passes17 assertions in addition to the artifact checks, as detailed below. Sharp/Playwright are installed in this checkout; the supported503 fallback remains available in environments without Sharp.

## Changelog

- 2026-10-25: Built original Chandni Royale artwork and independent guest renderer/runtime from inspected reel; native draft-only template/editor/API integration; scratch/calendar/photos/countdown/timeline/venue/WhatsApp features; fixed film slot awaiting owner asset. No production changes.

- 2026-10-25 audit corrections: editor guest-preview frames now signal readiness in demo/guest mode as well as live mode, allowing the editor to send the creator's data. Draft/passcode share cards are private/no-store with Vary: Cookie; public live cards retain public caching. Customer main photos preserve their approved portrait/landscape aspect ratio instead of being recropped to the decorative illustration's 3:2 frame. Chandni style controls are restricted to the supported button accent and typography; fixed artwork remains fixed. Added regression coverage for each issue.

## Dependency approval and native browser validation — 25 October 2026

Registry access was approved. Installed the locked dependencies with npm ci --ignore-scripts (no dependency/version changes) and Chromium for Playwright, then generated MediaPipe's expected public assets with node scripts/prepare-magazine-face.js. The earlier environment limitation is superseded: the entire npm test command now completes successfully, including Ganapati and all fourteen magazine HTTP E2E groups.

Added scripts/qa-chandni-royale-browser.js, run with npm run test:chandni-royale:browser. It creates a disposable local server and DATA_DIR and signs in only to its generated local test-admin account; it never connects to production. Seventeen browser assertions passed: native editor updates, actual guest-ready handshake, edited data after replay, real mouse scratching, downloaded ICS content, native portrait upload/crop/save/reload/remove, preserved4:5 framing, correct style controls, native guest viewports320/390/430, no initial A/V requests and no uncaught browser errors. Test screenshots/results are written under ignored test-output/chandni-royale.

This native test found one additional server-only bug the self-contained artifact could not expose: the template handler intercepted its own invite.js and invite.css as missing invitation routes. Fixed only those exact GET/HEAD runtime paths to defer to the existing static handler; protected upload/media routes still stay in their ownership-checked handler. Added real-server HTTP status/MIME/body/HEAD regression assertions.

The owner opening film is still absent; no final film playback, real WhatsApp send, payment or production deployment is claimed. The unchanged v4 visual review remains accurate.
