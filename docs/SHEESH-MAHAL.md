# Sheesh Mahal — backend and editor

**Slug:** `sheesh-mahal` · **Editor:** `/create/sheesh-mahal` · **Demo:** `/sheesh-mahal/demo` · **Published:** `/<chosen-link>`

An additive wedding template with its own original renderer (`pages/sheeshMahal.js`) and scene assets. It does **not** render the Shaadi or Suvarna invitation underneath a new introduction. Existing wedding templates are unchanged.

## Architecture and schema

- `lib/sheeshMahalRoutes.js` adapts the established Shaadi route mechanics: creator ownership, sanitized autosaves, private preview, upload checks, draft resumption, pending live edits, publish, payment handoff, versions/restore, share cards, QR, passcodes and expiry.
- `public/sheesh-mahal/core.js` is an isolated snapshot of the Shaadi schema/palette/translation core. Its intentional differences are strict Sheesh-only uploaded media, upload-only music, no borrowed sample photos, and a mandatory creator organiser number. No existing template's validator is modified.
- `lib/sheeshMahalEditor.js` serves the maintained Shaadi editor source at `/sheesh-mahal/editor.js` with only local adapter changes: `sm-ed` device storage, mandatory organiser field even when the RSVP display is off, and a WhatsApp-only informational dashboard (no guest list/CSV). It asserts its source markers to fail clearly if the shared editor structure changes.
- `pages/sheeshMahalCreate.js` loads this core/adapter and the existing read-only editor CSS, icon art and i18n. No other editor's behavior or storage is changed.
- Renderer signature: `renderSheeshMahalPage(data, options={})`. Routes supply `preview`, `mode`, `id`, `slug`, `url`, `ogImage`, `noindex`, and `mapsKey`. The adapter strips the guest payload's passcode. Preview uses same-origin `sp:data` / `sp:ready` editor messages.

The schema supports couple first/family names and both parents, welcome/closing, wedding date/time/time zone, **20 functions including the main ceremony**, per-function dates/times/venue/address/dress/notes, main/reception venues and maps, travel/stay/gifts, a separately uploaded couple photo, eight gallery photos with framing/alt text, optional creator-uploaded music, language and palette settings, and access settings. The editor's established maps/place search and reverse geocoder are reused.

## Isolation and safeguards

- Database tables: **`sm_owners`, `sm_pending`, `sm_versions`, `sm_uploads`**. There is deliberately **no `sm_rsvps` table**.
- Cookie names: `sheesh_mahal_creator`, `sm_m_<id>` manage cookies, `sm_pass_<id>` guest-access cookies. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Cookie path is `/` because the same owner must reach `/create`, `/api` and root published links; names, signed values, owner rows and template checks enforce isolation.
- Files: `DATA_DIR/sheesh-mahal-uploads`, `DATA_DIR/sheesh-mahal-cards`, `DATA_DIR/.sheesh-mahal-secret`. Set `SM_SECRET` for an externally managed stable signing secret; `SM_UPLOAD_POOL_MB` optionally caps this template's upload pool (default 4096 MB).
- API writes enforce same-origin requests, body limits, rate limits and owner authorization. Uploads have random filenames, MIME/signature checks, quotas and ownership checks. Only `/sheesh-mahal/media/<48-hex>.<allowed-extension>` is valid creator media. Foreign upload references are stripped on autosave; publish validates ownership again.
- Draft/protected media is private. A protected published upload requires the **correct signed pass cookie**, not merely a cookie's presence. Passcode-protected share cards are owner/admin-only and are never publicly cached. Published unprotected media supports existing byte-range serving.
- Generic draft, render-preview, free-publish, WhatsApp-purchase and Razorpay-order endpoints cannot bypass this template's ownership/validation endpoints. The shared admin/payment publish function also invokes its publish guard.
- No migration rewrites existing invitations or other templates' data. Tables are created additively with `IF NOT EXISTS`; normal registry seeding adds the template without replacing admin-set prices.

## RSVP and music

Creator **organiser WhatsApp is required at publish**, including when the RSVP section is hidden. Local Indian mobile numbers normalize to `+91`; international numbers require their country code. Guest yes/no links open a prepared message to that creator number. `core.whatsappRsvpLink(data, attending, lang)` accepts booleans or `'yes'`/`'no'`. Nothing is sent until the guest taps WhatsApp Send.

There is no guest form, guest POST endpoint, guest email notification or guest-record storage. The owner dashboard explains WhatsApp delivery; the compatibility GET `/api/sheesh-mahal/rsvps?id=...` returns an authorized empty result with `whatsappOnly:true`.

Music defaults to `track:'none'`, empty URL. Only creator-uploaded audio with rights confirmation can be selected; the core exposes no built-in track library. The original scene creates audio only on the guest's explicit Play tap with `preload='none'`; there is no music preload or autoplay.

## Routes and integration

`/sheesh-mahal/{demo,frame,preview/:id,manage/:token,media/:file,card/:id.jpg,qr/:id.svg,qr/:id.png,unlock/:id}`

`/api/sheesh-mahal/{draft,upload,publish,me,slug,places,reverse,translate,versions,restore,rsvps}`

Root short links and `/p/:slug` redirects are registered. Registry/detail/gallery rendering and owner preview redirects recognize the template. The server calls the parent's `ensureSheeshMahalAssets()` boot restorer. Admin can set template price/status through the existing UI; paid publish uses the established inline Razorpay checkout, and paid settlement takes a first version snapshot.

Map/translation environment variables are the same as Shaadi (`GOOGLE_MAPS_API_KEY`, optional `GOOGLE_MAPS_EMBED_KEY`, `GOOGLE_TRANSLATE_API_KEY`, `MYMEMORY_EMAIL`). Persistent storage is required in production; `SHEESH_MAHAL_ALLOW_EPHEMERAL_PUBLISH=1` is an explicit testing-only override.

## Tests

```sh
node scripts/test-sheesh-mahal.js
node scripts/test-shaadi-paigaam.js
node scripts/test-suvarna-vivah.js
# or npm run test:sheesh-mahal
```

The new integration script uses a disposable server and temporary `DATA_DIR`; it does not touch creator data. **42 checks** cover registration/static media, editor isolation, twenty functions, strict media/music schema, ownership/cross-origin protection, generic-endpoint bypasses, mandatory WhatsApp (including RSVP off), distinct yes/no links, upload isolation, free/paid-offline publish, short links, no guest persistence, pending/live edits, versions, passcode gate/signed media access/private cards, passcode stripping and manage links.

Verified alongside **61 Shaadi Paigaam checks** and **64 Suvarna Vivah checks**. The new script does not exercise actual Razorpay settlement, external geocoder/translation provider calls, or browser/WebGL visual behavior. Those require configured services and the parent's visual/browser checks. JPEG/PNG share-card generation depends on optional `sharp`; without it those endpoints safely return 503 (SVG QR remains available).

## Original visual system and review state — 25 October 2026

Reference inspected: https://www.instagram.com/reel/DZU1iJGNmGO/ by missingpieceinvites. It is a 34.5034-second filmed editing tutorial. Observed anchors: sunset Rajasthan palace / teal Ambassador rear view / emerald invitation / pre-wedding photos / map link / night-palace countdown. The reel does not establish a fully 3D runtime; this implementation interprets that art direction with original generated art and a new WebGL scene, not extracted seller artwork.

The scene is deliberately hybrid: actual Three.js extruded scalloped portals, lathed columns, tube mouldings, rosettes, pavilions, balustrades, lanterns, a subdivided reflecting-pool mesh and photographic frames coexist with generated background images and transparent car/floral layers. The car, flowers and distant palaces are image layers, not fully modelled meshes. Do not advertise the whole scene as an all-mesh 3D model. Camera travel is eased from scroll position; pointer movement adds gentle perspective, and ambient motion is capped near 24fps with DPR capped at 1.65. Hidden tabs and Still mode stop ambient rendering. Reduced-motion preference defaults to Still mode. WebGL failure leaves invitation content and generated backgrounds readable.

Seven original images were generated for this template: sunset palace, matching moonlit palace, Ambassador, floral arch, jasmine/rose cascade, emerald marble material and carved sandstone material. All optimize to 1,526,832 bytes total. Car/arch/florals are real alpha WebP derived by removing the explicitly generated magenta backdrop, not magenta rectangles shown in the scene. Base64 originals and checksums live in assets/sheesh-mahal; boot restoration verifies every byte. Three.js 0.160.1 is vendored with its MIT license. No user photographs are invented: production samples use an initials placeholder until the customer uploads photographs.

The standalone review has local-only portrait/gallery controls, jump navigation and reset; it never uploads those review photos. Production creator media uses the isolated upload endpoint. Main portrait appears in the framed photo chapter and customer photographs also appear on world-space brass frames. The gallery opens a keyboard-dismissable, focus-managed dialog. Replacement/removal disposes old GPU textures without disposing shared architectural materials.

Editor previews use same-origin, parent-only sp:data messages, preserving their focus jumps. Opaque sandbox review frames do not attempt to send an invalid null targetOrigin. Uploaded music is instantiated only inside the guest Play click handler; no initial audio URL request. Header language selection renders creator translations, while the bespoke narrative headings remain authored in English. Palette/font choices affect the content panels and typography, not the colours of the immutable palace artwork.

Browser QA: real Chromium iframe viewports 320x844, 390x844 and 430x844; sample and long Hindi names with 20 functions: no document overflow or out-of-bounds headings, WebGL ready. Verified distinct localized accept/decline WhatsApp drafts using test data without opening/sending WhatsApp; zero initial audio elements. Portrait/gallery local uploads, lightbox open/close and reset verified. Initial code assertions: 42 integration + 8 renderer/media/security + 61 Shaadi + 64 Suvarna + 10 admin/gallery = 185 passed. The eight tests are in tests/sheesh-mahal-renderer.test.js. Full authenticated production editor walkthrough, actual payment settlement and real handset GPU/network benchmarking have not been performed. Local Playwright package installation was blocked by the npm registry policy; browser QA used the available Chromium session instead.

Review only: keep changes unmerged and production untouched pending the owner's visual approval.
