# Ivory Jasmine

Status: review implementation only; do not merge or deploy without owner approval.

## Brief and visual source

Owner reference: https://pin.it/6LGfT3b5v (Pinterest pin 810155420513895444), titled White Wedding Invitation Website Template, Save the Date, Floral Wedding Invite, Wedding Video. Inspected its 25.90-second scrolling demo. This implementation is a close Indian-wedding adaptation, not a pixel-identical copy or use of the seller's licensed template/art. All shipped decorative imagery is newly generated. No reference video, seller image, source code, or branding is shipped.

The reference's key language: white canvas, deckled ivory stationery, white ranunculus/jasmine and cascading green botanicals, envelope/photo layering, record-player music detail, classical serif plus handwritten script, countdown, long timeline, paper venue/dress/gift cards, and an envelope farewell. Replaces its extensive guest form with a minimal two-choice WhatsApp handoff. No other Paigaam template's invitation renderer, stylesheet, or art is used. Shared editor/data/backend mechanics are intentionally reused.

## Routes and implementation

- /templates/ivory-jasmine: template detail
- /create/ivory-jasmine: existing seven-step Paigaam wedding editor
- /ivory-jasmine/demo: public sample
- /ivory-jasmine/frame: same-origin live editor preview
- /ivory-jasmine/preview/:id: owner preview
- /ivory-jasmine/manage/:token: private management
- /ivory-jasmine/media/:file: ownership-protected upload storage
- /api/ivory-jasmine: scoped draft/upload/slug/places/translation/publish/version API
- Root short links use the same publishing flow. Generic APIs cannot bypass validation.

Node renderer: templates/ivory-jasmine/render.js. Runtime and styles: public/ivory-jasmine/invite.js and invite.css. Local media/schema adapter: public/ivory-jasmine/core.js (IJCore browser global). Backend: lib/ivoryJasmineRoutes.js. Boot restores image assets through lib/ivoryJasmineMedia.js.

Independent ij_* ownership, version and upload tables; independent cookie, secret, manage/passcode cookie names, upload/card directories and local-storage namespace. The shared Shaadi core is not modified. The adapter maps only URL-bearing fields through the established validation, preserving all authored text, then restores Ivory paths; foreign uploads are rejected. Keep loading i18n, shared core, then Ivory adapter, then runtime/editor.

## Customer content and sections

Supports couple names, parents, welcome text, wedding date/time/timezone, up to twenty functions including custom names, editable dates/start/end/place/address/note/dress, manual ordering, primary/reception venues, main portrait and up to eight gallery images with crop positions, dress, travel, stay/booking code, gifts, closing, palettes, fonts, languages/translations, optional passcode/expiry. The shared editor has add/remove/reorder function controls. Events render in saved order; disabling pre-wedding hides earlier dates. Optional sections disappear, rather than leaving empty cards.

Long default flow: invitation/envelope; save date/calendar; countdown and optional uploaded-song record player; family invitation; celebrations; venue and optional separate reception venue; photo wall/lightbox; dress; travel; accommodation; gifts; RSVP; farewell envelope. Text is HTML, never baked into generated art. Reduced motion, keyboard focus, image alt text and lightbox focus return are supported.

Music: uploaded song only, requiring existing rights consent; no library tracks. Audio object and URL assignment are deferred until a guest explicitly taps Play. Re-render pauses/clears existing audio. Never autoplay/preload audio.

RSVP: creator supplies organiser WhatsApp number (required at publish when RSVP enabled). Guests see only accept/decline. Links use wa.me with localized response and couple names. The guest must tap Send in WhatsApp. No guest name/email/phone form, no website response storage, no automatic message sending. Public POST /api/ivory-jasmine/rsvp/:id returns 410 whatsapp_only without reading or storing guest payloads. Empty legacy owner read/export APIs remain for dashboard compatibility. Sample number is empty, so preview shows disabled choices. No real message is sent by tests.

## Generated asset provenance

Six coordinated Nano Banana 2.1 generations in thread cmvo32ycp118b07addpp5f608:
- envelope.webp: open cotton-paper envelope, ivory card, jasmine/ranunculus, wax seal.
- paper.webp: deckled blank paper, botanical upper corner; stretched as background with live text.
- ceremony.webp: jasmine garlands, bangles, brass diya still life.
- mandap.webp: fictional white floral Indian garden mandap, illustrative only, not the customer's actual venue.
- botanicals.webp: four separate floral arrangements, cropped into botanical-1 through botanical-4.
- record.webp: photographic vinyl record and brass tonearm, used only when music uploaded.

Generated images are optimized WebP; demo-1 through demo-5 and hero-florals are derived aliases, not additional generations. Demo gallery captions identify illustrative artwork; there are no fake customer portraits. Sixteen checked files total approximately 1.5 MB. assets/ivory-jasmine contains base64 sources plus SHA256 manifest; generated public files are ignored in Git. Pack with node scripts/pack-ivory-jasmine-media.js. Boot verifies existing targets and restores missing/corrupt files atomically; decoded source must match manifest.

## Verification

Commands:
- node scripts/test-ivory-jasmine.js
- node --test tests/ivory-jasmine-adapter.test.js tests/ivory-jasmine-render.test.js
- node scripts/test-shaadi-paigaam.js
- node scripts/test-suvarna-vivah.js
- node scripts/build-ivory-jasmine-review.js (writes a self-contained review outside repo)

API checks cover independent drafts/ownership, free and offline-paid flows, updates/versions, publish validation, uploads/isolation, up to 20 events add/remove/reorder persistence, passcode/expiry, WhatsApp-only rejection and zero stored guest responses. Share-card sharp rasterization cannot run when sharp is absent; API test allows the documented 503 fallback. No real payment, real organiser message, merge or deployment is performed.

Visual review artifact uses the exact production renderer/runtime and inlined generated assets, with sample data, no backend writes, no upload. Browser checks should confirm 320/390/430 widths, long names/events, no horizontal overflow, same-origin editing bridge, language changes, lightbox, calendar and WhatsApp link construction. The reference was a scrolling video rather than source HTML; pixel-identical layout or animation parity is not claimed.

### Review verification, 25 October 2026

- 86 Ivory API checks; 8 adapter tests; 11 renderer/media/security tests; 61 Shaadi + 64 Suvarna regression checks; 10 admin/collection tests: 240 passed.
- Artifact v2 render health: no console errors or failed requests.
- Browser at 320 px: default 5 events; no horizontal overflow/clipped headings/buttons; no guest form/audio requests.
- Browser at 390 px: long names + 20 custom events normalized including main wedding; exactly 20 cards; no horizontal overflow/clipped headings/buttons; two wa.me links with correct responses and names.
- Browser at 430 px: Hindi language switch with 20-event stress data; no horizontal overflow/clipped headings/buttons; localized WhatsApp drafts.
- Ordinary navigation click reached celebrations. Ordinary photo click opened lightbox; focus moved to Close, and the close button worked. Loaded decorative/gallery imagery had zero broken images.
- These are browser tests in a self-contained artifact, not a full authenticated live editor walkthrough. API tests independently cover save/reload/media/update/publish mechanics. No real payment, WhatsApp send, merge or production deployment was performed. Full repo npm test was not claimed; sharp-dependent image-card rasterization remains unavailable locally.
