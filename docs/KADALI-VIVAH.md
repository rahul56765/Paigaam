# Kadali Vivah — original-film / immersive 3D wedding website

## Status and scope

Third wedding website, slug `kadali-vivah`, on unmerged PR #54. No production deployment. The first review version (recreated leaf opening and conventional page) was explicitly rejected. This revision replaces it, rather than adding another template. Suvarna PR #50 and the wedding-video feature remain independent and untouched.

## Non-negotiable opening contract

The video at `public/kadali-vivah/opening.mp4` is the owner's uploaded `1000100702-cleaned.mp4` **byte for byte**. Do not transcode, shorten, replace, mute by default, change speed, crop, or recreate it.

- SHA-256: `bf1549420225f65fe2f4b0f411b2244f78442d61ec11da71af634e7952644c18`
- Size: 13,249,737 bytes
- Duration: 10.026667 seconds
- Frame: 720 × 1280
- Original audio retained; playback rate 1

A guest taps to play. The video is shown uncropped with `object-fit: contain` and `playsinline`. No video source is assigned and no film bytes are downloaded before the tap. Buffering, pause/resume, error/retry, skip, Escape and replay are available. The invitation is unlocked by the film's actual `ended` event, not a guessed timer. The custom film UI overlays no names or invitation copy onto the playing video. Reduced-motion does not rewrite/shorten the owner's video; guests can skip it explicitly.

Ten checksummed base64 parts transport the original clip through the repository integration. The media loader verifies and restores it at startup; the pack script refuses a different source hash. The existing static server provides HTTP byte ranges. The original is intentionally not compressed: preserving the exact uploaded file was the owner's explicit instruction, so initial playback transfer depends on the guest's network.

## Original visual design, not a Paigaam-template derivative

No Shaadi/Suvarna invitation renderer, visual markup, stylesheet or art/icon library is loaded. Only the shared editor, data schema, validators, localization utilities and secure backend mechanics are reused.

The reference's gold/ivory ending opens into a procedural Three.js world with actual meshes and perspective:

- Raised ivory-stone courtyard, jointed floor and geometric inlays.
- Lathed carved columns, fluted shafts, gilded bands, scalloped entrance arches and repeated colonnades.
- Curved, textured banana leaves, marigold torans, hanging brass bells and standing oil lamps.
- Copper kalash groups with coconut and leaves; a layered lotus pool.
- Stepped mandap, sculpted silk canopy, decorative crown, lattice screen and ceremonial altar.
- A continuous scroll-directed camera path progresses from entrance through courtyard/lotus to the mandap and closing scene. The path stays clear of roof beams so architecture does not block the scene.

Foreground invitation chapters are original layered gilt plaques with embossed relief edges, real CSS perspective, raised ritual tickets, orbital date layers and a 3D photo stack for customer uploads. The camera and surfaces respond throughout scrolling; this is not merely a single animated intro or a flat photo page.

### Inspiration reviewed

- Pinterest: https://www.pinterest.com/ideas/3d-invitation-design/943198661005/
- Pinterest temple/mandap decor collection: https://hu.pinterest.com/ideas/intricate-indian-wedding-design/893377510084/
- Instagram temple mandap reference by ltp_wedding_design: https://www.instagram.com/reel/DUVMBm3AbNx/

These informed spatial/architectural direction only. No Pinterest/Instagram imagery or third-party invitation artwork is shipped or copied into the design. The art fallback is original in-thread generated work. No sample photo assets from another Paigaam invitation are displayed by default.

## RSVP — one choice, then organiser WhatsApp

The guest sees only two choices: accepting or declining. Each is a direct `https://wa.me/<organiser>?text=...` link with a localized prefilled answer and couple names. No name, guest count, meal, email, phone, or message form is requested from guests. The organiser's WhatsApp number is configured in the existing editor's Events/RSVP step and is required when publishing an invitation with RSVP enabled. In a sample with no organiser number, both choices remain visible but disabled; never invent a recipient for a demo.

Tapping a choice opens WhatsApp to the organiser. **The guest still taps Send in WhatsApp**; the website cannot silently send a message. New replies go to WhatsApp rather than a native website form. The legacy backend RSVP/history routes remain for compatibility but are not used in the guest interface.

## Editing and technical architecture

The seven-step editor remains Couple, Events, Venue, Photos, Style, Languages and Publish. Edits feed the same renderer used by guest/demo pages. Local draft prefix is `kv-ed`; shared editor is cache-busted to v7. The live iframe omits the film; guest preview includes it and receives personalized data via same-origin `sp:ready` / `sp:data` handshake.

- Template: `templates/kadali-vivah/config.js`
- HTML/SEO/privacy gate: `templates/kadali-vivah/render.js`
- Original guest runtime: `public/kadali-vivah/invite.js`
- Original composition: `public/kadali-vivah/invite.css`
- Procedural geometry/camera: `public/kadali-vivah/stage.js`
- Vendored MIT Three.js r160: `public/kadali-vivah/vendor/` (license included)
- Secure route module: `lib/kadaliVivahRoutes.js`
- Original film/art pack: `assets/kadali-vivah/`
- Restore/repack: `lib/kadaliVivahMedia.js`, `scripts/pack-kadali-media.js`

Runtime reuses geometry/materials and instancing (roughly 36–41 draw calls and 182k–188k visible triangles in tested views). DPR is capped at 1.5; shadow maps are 512 on phones / 1024 on larger screens and computed once for the static scene. Rendering is requested by scroll, resize or palette changes rather than an endless idle loop. Scene buffers, textures, listeners and WebGL contexts are disposed on teardown. Reduced-motion disables surface motion and autonomous motion. Devices without WebGL retain the complete readable invitation over an original rendered-art fallback; the video never traps a guest waiting for WebGL.

Optional music remains available, including user upload, but is only requested/played after an explicit music-control tap. The original video's audio is separate and unchanged. No new credentials, DB migrations or environment variables are required. Existing ownership, cross-template upload isolation, privacy/passcode, expiry, versions, payments, short links and persistent-storage requirements remain.

## Routes

- `/templates/kadali-vivah`, `/template-view/kadali-vivah`
- `/create/kadali-vivah[?id=]`
- `/kadali-vivah/demo` (`?skip=1` explicitly bypasses film)
- `/kadali-vivah/frame` (`?guest=1` includes film)
- `/kadali-vivah/preview/:id`, `/manage/:token`, `/media/:file`, `/card/:id.jpg`, `/qr/:id.svg|png`, `/rsvps/:id.csv`, `/unlock/:id`
- `/api/kadali-vivah/...` for shared backend functions
- Published root short links; `/p/:slug` redirects to root.

## Verification

- Revised Kadali API/asset/guest-DOM/WebGL suite: 141/141 checks.
- Revised browser suite: 55 assertions, zero failures, covering actual full original film playback, original dimensions/speed/audio, no pre-tap media transfer, real 3D geometry and scroll progress, 320/390/768/1440 layouts, eight languages and long names, two-choice WhatsApp handoff, personalized guest iframe, actual editor save/reload and WebGL-unavailable fallback.
- Existing Shaadi regression: 61 checks. Existing Suvarna: 64 checks.
- Earlier focused admin/collection and premium-UX suites passed; no production invitations were modified by any test.
- Full repo-wide aggregate suite was not run for this revision.

```sh
npm run test:kadali-vivah
npm run test:kadali-browser
npm run test:shaadi-paigaam
npm run test:suvarna-vivah
```

Chromium is required for the browser and integrated guest-DOM checks: `npx playwright install chromium`.

## Changelog

### 2026-10-25 — owner correction

- Replaced the recreated banana-leaf animation with the exact uploaded film, checked by hash and real playback.
- Rebuilt the entire guest experience from scratch as a procedural WebGL wedding world and original 3D scroll composition, without Paigaam invitation visuals.
- Replaced the guest RSVP form with two direct organiser-WhatsApp choices and required organiser configuration at publish time.
- Preserved only the established editor/backend mechanics; updated original film packaging, license, documentation and regression tests.
