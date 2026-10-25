# Aasmaan — A Celestial Wedding

**Slug:** `aasmaan`. Additive template; no change to the existing Shaadi Paigaam or Suvarna Vivah experiences. This document is the integration source of truth. The separate wedding-video feature is not involved.

## Release and catalogue policy

- `templates/aasmaan/config.js` registers the design, including its catalogue name, theme, thumbnail and `status: 'draft'`.
- `server.js` respects the registry status **only when inserting a new template row**. Existing admin-set status and prices remain authoritative; restart does not publish or reprice Aasmaan.
- A fresh installation has an unpublished Aasmaan row. Customer creation/new drafts and publication require the row to be published. An authenticated admin can open the shared editor and create a review draft while the template is unpublished, but publication still requires published template status.
- `/aasmaan/demo` and `/aasmaan/frame` are preview surfaces available before catalogue launch. The draft row is not in public published-template collections.
- No migration, merge, production publication or deployment is part of this implementation.

## Files and ownership

| File | Responsibility |
| --- | --- |
| `templates/aasmaan.js` | Independent celestial invitation renderer, **not** Shaadi's visual renderer |
| `public/aasmaan/aasmaan.css`, `public/aasmaan/aasmaan.js`, artwork and vendor assets | Celestial guest presentation and live-frame client |
| `lib/aasmaanRoutes.js` | Template-specific backend adapter using existing wedding core, editor and backend patterns |
| `lib/aasmaanMedia.js` | Explicit startup hook; checksummed original artwork restore hook |
| `templates/aasmaan/config.js`, `templates/registry.js` | Template identity and initial unpublished status |
| `pages/shaadiPaigaamCreate.js`, `public/shaadi-paigaam/editor.js` | Existing seven-step editor with conditional Aasmaan title, validation and local-storage namespace |
| `public/shaadi-paigaam/core.js` | Existing wedding schema; opt-in `mediaNamespace: 'aasmaan'` accepts new upload URLs without broadening existing templates' validation |
| `server.js`, `lib/templateView.js`, `lib/renderPaigaam.js`, `pages/templateDetail.js` | Dispatch, payment/admin hooks, preview ownership checks and catalogue mappings |
| `scripts/test-aasmaan.js` | Isolated API/integration regression suite |

Aasmaan reuses only shared backend/core/editor utilities. Its invitation is rendered by `require('../templates/aasmaan').renderInvitation(data, opts)`. The generic access-gate/expired-page HTML and names helper are reused from the wedding utilities; the Shaadi invitation renderer is **not** used.

## Renderer and editor contract

CommonJS named export: `{ renderInvitation }`. Function signature: `renderInvitation(data, opts = {})`, returning a complete HTML string. Use the nested shared wedding schema from `public/shaadi-paigaam/core.js` (`SAMPLE` and `validate`):

- `couple.groom`, `couple.bride`, parents and display order;
- `wedding`, `events`, `venue`, `reception`, `welcome`, `dress`, travel/accommodation/gifts;
- `photos: [{url, alt, fx, fy}]`, `couplePhoto`, `sections`;
- `palette`, `font`, `lang`, `i18n`, `access`;
- `rsvp.whatsapp` is the **creator-provided organiser number**, normalized by `C.cleanPhone` (leading `+` retained);
- optional music is controlled by `sections.music` and `music: {track: 'upload'|'none', url, title, rightsOk, startMuted: true}`. No `music.enabled` property is required.

If revalidating inside the renderer or frame, use `C.validate(data, {mediaNamespace: 'aasmaan'})`; otherwise Aasmaan uploaded photos/music are deliberately rejected by default shared-core validation. Non-upload music must never become a library URL even if the generic core normalizes an absent track to its historic default.

Backend options include `mode: 'guest'|'demo'|'live'|'preview'|'thumb'`, `id`, `slug`, `url`, `ogImage`, `noindex`, `mapsKey`, `autoOpen`, and `openingVideo: false`. Aasmaan has no ceremonial video opener.

Shared preview messages:

1. Frame sends `{type: 'sp:ready'}` to its parent.
2. Editor sends `{type: 'sp:data', data, focus, lang}`.
3. Replay sends `{type: 'sp:replay'}`.

The frame must check `event.origin === location.origin` and `event.source === parent`. The editor uses `/aasmaan/frame`, `/api/aasmaan/*`, and local storage prefix **`aasmaan-ed`**, isolated from `sp-ed` and `sv-ed`. There are still exactly seven editor steps. Aasmaan omits the website-guest-history tab; share links and restorable versions remain.

## RSVP policy — WhatsApp only

- Guest RSVP consists exclusively of **two yes/no prefilled WhatsApp links**, generated from the creator's organiser number, e.g. with `C.whatsappRsvpLink(data, attending, lang)`.
- No guest name/phone/email form. No automatic sending: guests choose a link, then send from WhatsApp.
- No Aasmaan website RSVP submission, guest-list API, CSV, notification email, or `aa_rsvps` table.
- `/api/aasmaan/rsvp/:id`, `/api/aasmaan/rsvps`, and `/aasmaan/rsvps/:id.csv` intentionally return 404.
- A valid organiser number is required at publication **even if the RSVP section is hidden**. Backend rechecks independently from the editor, including payment settlement/admin publication. Drafts may be saved incomplete.
- Generic RSVP-related legacy fields in the shared schema are not a request to collect guest data; Aasmaan clears host-notification email and meal collection.

## Music policy — optional customer uploads only

- No library tracks, library selectors, bundled sample music or implicit fallback music.
- Backend discards non-Aasmaan/non-upload audio URLs, forces `startMuted: true`, and uses `track: 'none'` when there is no valid upload URL.
- A supplied upload requires explicit rights confirmation. Guests must tap the music control; no autoplay, preload or speculative audio network fetch. The optional music UI must not instantiate/load an audio source before that gesture.
- The shared editor exposes upload/replace/preview only for Aasmaan and explains the opt-in behavior. Existing Suvarna library behavior and existing Shaadi behavior are unchanged.

## Routes

| Route | Access / behavior |
| --- | --- |
| `GET /create/aasmaan[?id=...]` | Shared editor; template launch gate; owner/admin opening existing drafts |
| `GET /aasmaan/demo`, `/aasmaan/frame` | Sample and same-origin editor frame |
| `GET /aasmaan/preview/:id` | Owner/admin-only draft/pending preview |
| `GET /aasmaan/manage/:token` | Hashed secret token grants cross-device manage cookie |
| `GET/HEAD /aasmaan/media/:filename` | Authorized uploaded media, including byte ranges |
| `GET /aasmaan/card/:id.jpg?kind=og|story` | Existing share-card backend; `sharp` required |
| `GET /aasmaan/qr/:id.svg|png` | Owner/admin; PNG requires `sharp` |
| `POST /aasmaan/unlock/:id` | Passcode validation and signed access cookie |
| `GET /:short-link` | Aasmaan's published invitation only; existing handlers retain priority |
| `GET /p/:short-link` | Redirect to canonical short link |
| `/api/aasmaan/draft`, `/upload`, `/publish`, `/slug`, `/places`, `/reverse`, `/translate`, `/versions`, `/restore`, `/me` | Existing wedding API patterns in isolated namespace |

Safe fixed design assets (top-level image/CSS/JS, art/assets/fonts and vendor JS) fall through to the static server. `/aasmaan/media/*` never bypasses the protected-media handler. The generic `/api/drafts`, `/api/free-publish`, `/api/render-preview`, `/api/razorpay/order`, and WhatsApp purchase handoff reject Aasmaan IDs in favor of its own endpoint.

## Persistence, uploads and isolation

- Independent `aa_owners`, `aa_pending`, `aa_versions`, `aa_uploads` tables, with foreign keys to shared invitation rows.
- Shared `paigaam_creator` device identity cookie, but Aasmaan-specific owner rows, `aa_m_<id>` manage cookies, and `aa_pass_<id>` access cookies. Ownership additionally checks the invitation's template slug.
- Files live under `DATA_DIR/aasmaan-uploads` and cards under `DATA_DIR/aasmaan-cards`; the signed-access secret uses `AASMAAN_SECRET` or a persistent `.aasmaan-secret` file.
- Photos: JPEG/PNG/WebP; MIME/magic and dimensions checked; minimum 360px short edge; effective maximum 2 MiB. Music: MP3/M4A/OGG/WAV/AAC; MIME must match recognized bytes; maximum 10 MiB. Random 48-hex filenames, exclusive writes, non-executable MIME and `nosniff` responses.
- Autosave drops another invitation's uploads, including same-owner drafts; publication checks ownership again. Existing Shaadi/Suvarna uploads cannot be referenced from Aasmaan. Existing templates do not opt into accepting Aasmaan media in shared validation.
- Draft media is owner/admin-only. Only files actually referenced in the **published** data become public. Newly uploaded files for a pending edit stay private. Passcode-protected media requires the exact signed access cookie, not merely any cookie of the expected name.
- Published edits use `aa_pending`; publish/update snapshots versions. Restore loads a pending copy and does not silently update the public page. Version history preserves referenced uploads during sweeping.
- POSTs have same-origin/CSRF checks, request limits and rate limits. Reserved names include all template slugs, including `aasmaan`.
- Publishing requires persistent storage, except localhost or explicit `AASMAAN_ALLOW_EPHEMERAL_PUBLISH=1`. `AASMAAN_UPLOAD_POOL_MB` controls the upload pool (default 4096 MiB).

## Checks and known environment limitations

```sh
node scripts/test-aasmaan.js
node scripts/test-shaadi-paigaam.js
node scripts/test-suvarna-vivah.js
node scripts/test-premium-ux.js
node scripts/test-pricing-resume.js
node scripts/test-razorpay.js
```

The focused script starts a disposable server/database and temporarily publishes **only that isolated test row**. It covers unpublished seeding, creation gates, editor namespace, draft/ownership/CSRF protection, cross-template reads/writes/restores, upload isolation, MIME policy, no website RSVP storage, organiser-number validation, publish, pending edits, signed-media access, versions and manage links. It also smoke-tests renderer/demo/thumbnail when the renderer exists.

Integration run results: Aasmaan **43 checks passed**; Shaadi **61 checks passed**; Suvarna **64 checks passed**; premium UX **26 tests passed**; admin/collection **10 tests passed**; pricing/resume and Razorpay suites all green. `git diff --check` and JavaScript syntax checks passed. The Aasmaan run included the independent renderer demo, thumbnail, and vendored scene-runtime route. Full visual interaction, accessibility and asset review remain the renderer owner's responsibility.

`sharp` is optional at runtime; share-card and PNG-QR endpoints return 503 without it. In this task's environment `npm ci --ignore-scripts` was blocked by a registry 403 for `sharp@0.35.4`; this is not an application failure. Run installation and visual/browser checks in a permitted environment before launch. Ordinary SVG QR, backend/editor APIs and renderer HTML do not depend on `sharp`.

## Original art and cinematic renderer (25 October 2026)

Reference inspected: https://www.instagram.com/reel/DZQBuADPBD5/ by missingpieceinvites, 15.07 seconds. The reference demonstrates a cobalt/gold celestial layered-art invitation with ornate arches, floating palace/cloud/balloon/ring motifs and illustrated ceremony cards. This implementation interprets that visual direction with original artwork; it does not reuse the seller's artwork or website source.

Ten original coordinated image generations produced fourteen optimized WebP assets (including four ornament cutouts and a derived hero thumbnail). Magenta source backgrounds and the portal aperture were removed into actual RGBA transparency and visually checked over cobalt. Images are not customer portraits or photographs of real venues; tiny people within the ceremony scenes are fictional illustrations. No shared invitation artwork or library music is used.

`assets/aasmaan/manifest.json` and chunk files are the portable source. `ensureAasmaanMedia` now restores and verifies every public WebP at startup (replacing the initial no-op hook). The runtime is vendored Three.js r160 with its MIT notice retained in the distributed file. No extra package installation is required for the guest scene.

The WebGL renderer combines actual modeled geometry (a tiered ivory palace, miniature domes/columns/windows/balustrades/stairway, gold stars, enamel balloon, engagement ring and faceted gemstone, extruded ceremony frames) with generated ornamental planes and scene illustrations at separate world depths. It is a hybrid 3D/artwork theatre, not a claim that every illustrated palace or figure is a fully modeled 3D asset. A perspective camera tracks scroll, dollies through the opening and rotates the world stages subtly; pointer movement and autonomous drift add depth. Geometry/materials are disposed on rebuild, static textures are cached, only nearby stages are rendered, device pixel ratio is capped at 1.6, and hidden tabs stop rendering. Pause Motion freezes decorative movement and camera dolly; reduced-motion preference starts paused. WebGL failure/context loss shows readable HTML with illustrated fallback images instead.

The scene's cobalt/ivory/gold palette is intentionally curated; the Aasmaan-only Style editor explains this instead of promising irrelevant door/scratch-heart/flower recolouring. Font styles and guest language switching are supported; invitation content uses the shared translation schema. Customer portraits/photos, events, schedule, venue, directions, travel/stay/dress/gifts, section toggles and WhatsApp organiser details remain editable. Review mode includes local-only photo testing with an 8MB cap; it makes no upload or network request for a selected file.

The standalone design-review HTML in the originating Hyperagent thread is fully self-contained for art/scripts and uses sample names/venue. It is not a production deployment. Public demo RSVP remains disabled without an organiser number; no placeholder number should receive real replies.

Final renderer validation: 10 renderer/security/media tests, 43 API checks, 61 Shaadi checks, 64 Suvarna checks and 10 admin/collection checks pass (188 combined). Browser review at 390x844 confirms chapter navigation, real WebGL geometry, no initial audio element/request even with an uploaded song configured, English/Hindi switching, local-only photo replacement and the two correct WhatsApp draft links without sending. 320px long-name/20-event stress inspection surfaced an overlong closing signature; wrapping and adaptive hero name sizing were added. No full authenticated browser-editor walkthrough or real checkout/payment/WhatsApp send has been performed. The optional sharp-dependent raster card/PNG QR endpoints remain environment-limited as noted above.

Changelog — 25 Oct 2026: additive Aasmaan template and draft registry; isolated ownership/media/publish adapters; original generated celestial art and checksummed restore; modeled palace/balloon/ring/stars and dimensional frames; batched palace geometry to three material draws; bounded pixel ratio/visibility-aware rendering; phone layout and long-name safety; truthful curated-art Style controls, typography/languages, local photo preview, upload-only manual music and two-choice WhatsApp RSVP. Existing live templates are unchanged.
