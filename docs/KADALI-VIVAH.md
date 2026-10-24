# Kadali Vivah — the third ceremonial wedding website

## Status

Implemented as a separate template, slug `kadali-vivah`. This is a wedding **website**, not a rendered wedding-video template and not a redesign of Shaadi Paigaam or Suvarna Vivah. Review the branch/PR before merging and deploying. Existing Suvarna PR #50 is independent; this implementation is based on main and does not include that PR.

## Reference and visual sequence

The owner's approximately ten-second portrait reference starts with a gold-cord-tied banana-leaf parcel. The cord loosens, leaves unfold, warm light reveals a kalash, then petals pass the camera. Kadali recreates that sequence as interactive CSS perspective layers, not video playback:

1. Tap the banana-leaf parcel or the Tap to Open button.
2. Gold cord releases; top/bottom folds and then side folds open.
3. A warm-light transition reveals a copper kalash and marigolds.
4. Petals pass over the scene; the invitation appears in the same ivory/gold atmosphere.
5. The long-form invitation continues with names and parents, welcome, a folded gold-leaf date card, photos, countdown, mandap, schedule, venue/maps, optional guest information, RSVP and closing.

The intro is approximately 4.8 seconds, with a 0.75-second exit fade. It never waits for video, audio, WebGL or another network response. Skip and Escape exit immediately. Reduced-motion users tap through directly. Background content is inert while the opening is active; focus returns to the invitation when it finishes. The opening can be replayed. Live editing bypasses it, but the editor's guest preview includes it and updates its names from customer data.

This is a **CSS 3D / 2.5D** experience using original rendered art, not a full WebGL world. The leaf folds are true perspective transforms; environmental depth is artwork and layered motion. It has no heavyweight 3D library dependency.

## Assets and source

Original generated artwork: fresh banana leaf texture, copper kalash/marigold still life and a marigold mandap. No customer names or dates are baked into artwork. No video/audio from the supplied reference is shipped. Sample couple photos, icon library, fonts and optional music use the existing Paigaam wedding library.

- Editable runtime: `public/kadali-vivah/invite.js` and `invite.css`
- Server renderer: `templates/kadali-vivah/render.js`
- Template metadata: `templates/kadali-vivah/config.js`
- Art source pack: `assets/kadali-vivah/`
- Art materialization: `lib/kadaliVivahMedia.js` checks SHA-256 and restores `public/kadali-vivah/art/*.webp` at startup.
- Repack after replacing artwork: `node scripts/pack-kadali-media.js`

Only three WebP plates ship (roughly 770 KiB total). Generated images are ignored in Git; their base64 sources and hashes are committed. No third-party image hosting is required in production.

## Existing editing and publishing funnel

Kadali deliberately reuses `pages/shaadiPaigaamCreate.js`, the shared editor, core validation and translation library. The seven steps remain Couple, Events, Venue, Photos, Style, Languages and Publish. Editing controls affect the same renderer used by the published page. Preset/custom palettes and four font styles remain editable; the starting style is Terracotta & Cream with Royal Calligraphy. The opening's natural green leaves and ceremonial photographic art are fixed; editable colors apply to page backgrounds, text, borders and controls, not recoloring photographic assets.

Local drafts use `kv-ed`, distinct from Shaadi's `sp-ed` and Suvarna's `sv-ed`. The shared editor has a cache-busted v6 URL. Guest-frame readiness is emitted in embedded demo mode as well as live mode, so personalized data arrives before the opening is played.

Website RSVP is used, not mandatory WhatsApp RSVP. Optional background music is only requested after an explicit music-control tap; the opening does not start audio. Shared validators accept Kadali upload paths, and all three wedding route modules check upload ownership across template prefixes.

### Routes

- `/templates/kadali-vivah` — catalogue detail and demo
- `/template-view/kadali-vivah` — catalogue thumbnail render
- `/create/kadali-vivah` — established seven-step editor
- `/kadali-vivah/demo` — public sample; `?skip=1` bypasses the opening
- `/kadali-vivah/frame` — live editing frame; `?guest=1` includes the opening
- `/kadali-vivah/preview/:id` — owner/admin preview
- `/kadali-vivah/manage/:token` — secret cross-device management link
- `/api/kadali-vivah/...` — draft, upload, publish, slug, places, reverse, translate, versions, restore, RSVPs, response and owner operations
- `/kadali-vivah/media/:file`, `/card/:id.jpg`, `/qr/:id.svg`, `/qr/:id.png`, `/rsvps/:id.csv`, `/unlock/:id`
- Published root short link; `/p/:slug` redirects to it.

The server integration includes payment-settlement snapshots, generic endpoint bypass guards, ownership-checked previews, privacy/passcode handling, expiry, upload quotas and existing persistent-storage requirements. No DB migration is required. New template seeds at the existing wedding-template convention of price 0; existing admin prices are not overwritten on subsequent boots. No new credentials or environment variables are required. Optional geocoding and maps, translation, payment and persistent-storage settings remain the existing ones.

## Tests

```sh
npm run test:kadali-vivah
npm run test:kadali-browser
npm run test:shaadi-paigaam
npm run test:suvarna-vivah
node scripts/test-pricing-resume.js
node scripts/test-razorpay.js
node scripts/test-premium-ux.js
node --test tests/admin-ui.test.js tests/paigaam-admin-collection.test.js
```

Verified in this implementation: 93 Kadali API checks; 13 browser scenarios with 101 assertions (including 320/390/768/1440 widths, all eight languages, real editor save/reload and personalized guest preview); 61 Shaadi checks; 64 Suvarna checks; 10 admin/collection checks; 26 premium UX checks; pricing/resume and Razorpay suites green.

Browser suite requires Playwright Chromium (`npx playwright install chromium`). Tests use disposable data directories; no production invitations or templates are modified.

## Changelog

### 2026-10-25

- Added isolated third wedding website template with reference-ordered interactive banana-leaf opening and original kalash/mandap art.
- Added bespoke responsive invitation composition, fold-to-reveal date, optional media, guest information and RSVP.
- Reused the seven-step Paigaam editor and secure draft/publish/manage/version/upload pipeline, with separate template state.
- Added reproducible artwork packaging, API tests, browser interaction/responsive tests and existing-template regression checks.
