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

The reference's gold/ivory ending now opens into a hybrid photographic 3D art set, replacing the visibly synthetic procedural ornaments from the previous review. Five original generated assets supply the realism: a temple/mandap environment, carved portal, hanging marigold/jasmine canopy, copper kalash arrangement and floral portrait frame. The portal, canopy, kalash and frame have actual RGBA transparency; a separate lossless aperture mask clips customer photographs exactly inside the floral frame. The blue compositing backgrounds were removed and edge spill cleaned before WebP packaging.

The assets are placed on separate WebGL surfaces at different world-space depths. Camera travel, perspective, occlusion and frame movement remain spatial; the decorative architecture is photographic art rather than a fully modelled temple. This is deliberately a hybrid 2.5D/3D approach, not a claim that a single flat image is a complete 3D model. Small gilt hardware and hanging cords add physical frame edges. The layered set is dramatically lighter than the previous procedural scene while improving material realism.

Customer photos are now first-class scene content:

- The Couple step opens with a prominent main-portrait upload/replace/remove card, plus a direct link to the gallery step.
- Step 4 explicitly presents “3D portraits & photo gallery”, secure upload/crop and per-photo replacement/removal/reordering.
- The main portrait appears in a realistic floral frame in the actual WebGL environment, as well as the welcome section. Up to four gallery photos are also placed in depth-separated scene frames; the normal gallery retains all supported photos.
- Photos are composited into the generated frame's exact alpha aperture, not pasted over a solid rectangular backdrop. The saved picture is fitted without a second face-cropping step; soft image-colored bands fill any aspect-ratio gap.
- Replacement/removal rebuilds and disposes old GPU textures. The existing owner checks and media validation remain unchanged.
- No generated or borrowed customer faces are supplied by default. Empty photo frames are labelled as placeholders. A standalone review-only “Try your photos” panel accepts local files without uploading/saving them; use the real editor for persistent invitations.

### Inspiration reviewed

- Pinterest: https://www.pinterest.com/ideas/3d-invitation-design/943198661005/
- Pinterest temple/mandap decor collection: https://hu.pinterest.com/ideas/intricate-indian-wedding-design/893377510084/
- Instagram temple mandap reference by ltp_wedding_design: https://www.instagram.com/reel/DUVMBm3AbNx/

These informed spatial/architectural direction only. No Pinterest/Instagram imagery or third-party invitation artwork is shipped or copied into the design. The art fallback is original in-thread generated work. No sample photo assets from another Paigaam invitation are displayed by default.

## RSVP — one choice, then organiser WhatsApp

The guest sees only two choices: accepting or declining. Each is a direct `https://wa.me/<organiser>?text=...` link with a localized prefilled answer and couple names. No name, guest count, meal, email, phone, or message form is requested from guests. The organiser's WhatsApp number is configured in the existing editor's Events/RSVP step and is required when publishing an invitation with RSVP enabled. In a sample with no organiser number, both choices remain visible but disabled; never invent a recipient for a demo.

Tapping a choice opens WhatsApp to the organiser. **The guest still taps Send in WhatsApp**; the website cannot silently send a message. New replies go to WhatsApp rather than a native website form. The legacy backend RSVP/history routes remain for compatibility but are not used in the guest interface.

## Editing and technical architecture

The seven-step editor remains Couple, Events, Venue, Photos, Style, Languages and Publish. Edits feed the same renderer used by guest/demo pages. Local draft prefix is `kv-ed`; shared editor is cache-busted to v8. The live iframe omits the film; guest preview includes it and receives personalized data via same-origin `sp:ready` / `sp:data` handshake.

- Template: `templates/kadali-vivah/config.js`
- HTML/SEO/privacy gate: `templates/kadali-vivah/render.js`
- Original guest runtime: `public/kadali-vivah/invite.js`
- Original composition: `public/kadali-vivah/invite.css`
- Procedural geometry/camera: `public/kadali-vivah/stage.js`
- Vendored MIT Three.js r160: `public/kadali-vivah/vendor/` (license included)
- Secure route module: `lib/kadaliVivahRoutes.js`
- Original film/art pack: `assets/kadali-vivah/`
- Restore/repack: `lib/kadaliVivahMedia.js`, `scripts/pack-kadali-media.js`

The photographic scene uses roughly 26 draw calls, two reusable geometries and fewer than 100 base triangles in tested empty-photo views. Texture count is bounded, portraits are downscaled to 768-pixel-wide composites and secondary frames to 512 pixels, and scene gallery frames are capped at four. DPR remains capped at 1.5. Rendering is event-driven on scroll, asset readiness, resize and photo changes rather than an endless idle loop. Generated backdrop/art total roughly 1.3 MB WebP before source packaging. Devices without WebGL retain the full readable invitation over the photographic environment fallback. Original film hash, audio, framing and lazy playback are unchanged.

Latest main's Shaadi upload-only music release (PR #55) is preserved. Its shared editor and renderer behavior were retained when reconciling this branch. Kadali retains its existing optional library/upload controls with explicit tap-to-play; Suvarna is unchanged.

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

- Updated API/asset/integrity/guest-DOM/WebGL suite: 165/165 checks.
- Main browser suite: 55 assertions, zero failures (including original film playback, camera progress, layouts, languages and WhatsApp RSVP).
- New realism/photo scene suite: 14 assertions passed (actual alpha channels, both photo textures in WebGL, save/load bridge, replacement/removal, texture cleanup and mobile layout).
- New photo editor suite passed real synthetic-color image upload/crop/replace/save/reload/remove and keyboard access; no customer faces or production invitations were used.
- Existing Shaadi: 61 checks; existing Suvarna: 64 checks.
- Standalone local-only preview upload tested for primary/gallery addition, real scene rendering and removal.
- Full repo aggregate suite was not run.

```sh
npm run test:kadali-vivah
npm run test:kadali-browser
npm run test:kadali-realism
npm run test:kadali-photo-editor
npm run test:shaadi-paigaam
npm run test:suvarna-vivah
```

Chromium is required for browser checks (`npx playwright install chromium`). All tests use disposable data directories.

## Changelog

### 2026-10-25 — owner correction

- Replaced the recreated banana-leaf animation with the exact uploaded film, checked by hash and real playback.
- Rebuilt the entire guest experience from scratch as a procedural WebGL wedding world and original 3D scroll composition, without Paigaam invitation visuals.
- Replaced the guest RSVP form with two direct organiser-WhatsApp choices and required organiser configuration at publish time.
- Preserved only the established editor/backend mechanics; updated original film packaging, license, documentation and regression tests.

### 2026-10-25 — photographic realism and customer portraits

- Generated coordinated realistic temple, portal, floral canopy, kalash and portrait-frame assets; prepared real transparent WebP layers and a precise portrait aperture mask.
- Replaced simplified procedural foreground ornaments with a depth-separated photographic WebGL set, retaining scroll-directed camera travel.
- Added in-environment primary and gallery photo frames, bounded texture loading and cleanup, and clearer first-step/fourth-step photo editing.
- Added local-only photo testing to the standalone review preview; original video and minimal WhatsApp RSVP unchanged.
- Reconciled latest main's PR #55 Shaadi music changes without reverting them; v8 shared editor and v3 Kadali guest assets.
