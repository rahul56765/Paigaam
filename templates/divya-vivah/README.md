# Divya Vivah — Marathi tap-to-open invitation

Added 2026-10-25. New isolated, editable Wedding template (`divya-vivah`) with Marathi, Hindi and English using Paigaam's existing template-family engine. No changes to existing invitations or live production data. The only shared static-server change adds the standard font/ttf MIME type for locally hosted Devanagari fonts.


## Language-only revision — 2026-10-25

Guests now choose **मराठी / हिन्दी / English** in a keyboard-accessible native dialog before the existing tap-to-open screen. Initial selection cannot be dismissed to bypass the choice. A small language button allows later switching; it does not restart the film, reset the countdown, navigate/reload the page or change the venue pin. No saved language preference skips the initial question on a new visit.

All **35 original Marathi copy fields and defaults remain unchanged**. Seventy additive fields (`hiPrayer`, `enPrayer`, etc.) provide independently editable Hindi and English wording for every corresponding invitation, date/time label, name, family/contact detail, navigation label, countdown heading/message/unit and venue/address. The existing six editor steps now group the three language variants together. Machine-readable wedding date/time and canonical Maps pin remain shared.

Translations are curated defaults, not an automatic translation API. Creators should enter each language's personal spelling and address. Blank personalized translations inherit the actual Marathi details (never a different sample family). If Marathi remains the untouched sample, its translated sample defaults are used. Customers can freely override either translated copy without altering Marathi or the other language. Translation fields are optional for compatibility with earlier draft data; existing records are not migrated or overwritten.

Display numerals are normalized across card text, phones, postal codes, target date and countdown: Devanagari for Marathi/Hindi, ASCII for English. Stored Marathi source text is never rewritten. Computed Marathi/Hindi target times use localized 24-hour numerals to avoid English AM/PM tokens. The countdown instant remains explicit IST. Printed date/time copy is still independently editable in each language; align all three with the shared countdown settings.

Both Devanagari languages retain the approved Tiro Devanagari Marathi and Amita fonts. English uses locally hosted OFL Cormorant Garamond (body) and Great Vibes (names). Their licenses are included. Asset decoding now verifies 7 binary assets instead of 5. The Cormorant font is the upstream variable font, pinned to weight 400 in CSS.

The approved illustration, video, poster and original font bytes have identical SHA-256 hashes. Original card geometry, palette and video timing remain unchanged; the original 8,441-byte stylesheet prefix is regression-tested byte-for-byte. Additive styles cover only the language controls, English faces and safe long-copy wrapping/fitting. No image/video was regenerated for this revision.

The Maps query is canonical, not rebuilt from translated venue names. Its language hint changes so Google can localize its interface; geographic labels inside Google's third-party map remain Google's content. The editable address, heading and directions button are localized by Paigaam itself.

### Language validation

- 45 template-specific schema/render/runtime/language tests pass, including the approved Marathi snapshot, all 70 translation fields, hostile text, digit conversion, mandatory initial choice, state-preserving switching, maps and multi-timezone countdowns.
- Full family/API suite: 356 passing tests plus all-template restart persistence. The API suite covers representative localized fields; exhaustive invalid-type/control/newline/length checks for all 70 fields run directly against the exact shared schema so tests do not flood the real HTTP abuse limiter. Production rate limits are unchanged.
- Browser: selected English, played the original film, switched to Hindi and Marathi, inspected all three cards and the English countdown/location view. No horizontal overflow at 320/375/390/736-pixel card widths for each language; all four local fonts loaded. Final preview render check passed with no failed requests or console errors.
- Clean dependency installation and full root-suite limitations below remain unchanged. No deployment/merge performed by this revision.

## Experience

1. Full-screen hand poster, couple names and editable Marathi tap prompt. A real button covers the screen; keyboard Enter/Space work too. No autoplay.
2. The customer-supplied 10-second divine-hands video plays inline with its supplied audio after a tap. At 9.05 seconds, its golden flare is extended by a viewport-filling warm-white/gold overlay. The invitation becomes visible behind it and the overlay fades away over 1.7 seconds. Playback is paused and muted afterward.
3. A fixed 2:3 invitation composition preserves the supplied reference proportions, rather than cropping it into 9:16. All lettering is escaped, editable Unicode HTML above text-free reconstructed artwork.
4. The next link smoothly scrolls to a coordinated countdown and location panel: IST event date/time, Devanagari numerals, Google Maps iframe, address, directions link and back navigation. Maps loads only after opening and approaching the location section.

Reduced-motion visitors bypass the film and see a short non-flashing reveal. Video failures, blocked autoplay and slow connections expose a direct-open route. Escape also opens the invitation. No runtime AI, paid maps API, custom database tables, renderer service or new dependency.

## Integration / routes

Registered in `templates/bfday.js`. Shared family engine supplies:

- `/templates/divya-vivah` listing/detail; `/divya-vivah/demo` guest demo.
- `/create/divya-vivah` six-step customizer with live preview, autosave and sharing.
- `/divya-vivah/preview-frame` GET/POST stateless preview.
- `/api/divya-vivah/draft` and `/api/divya-vivah/publish`.
- `/divya-vivah/preview/:id` owner preview; published `/p/divya-vivah-…` URLs.
- Existing creator-cookie ownership, same-origin checks, payment/free-publish flow, private drafts, QR generation and persistence.

The template is initially free, following adjacent wedding templates. The website owner can price it in the existing admin interface. This change does not alter existing prices.

## Editing and Marathi fidelity

Every invitation line, name, date/time label, family/contact detail, tap prompt, navigation label, countdown message and unit label is editable. Names are capped at 26 JavaScript string units. Text is not transliterated, regenerated by AI or manually split into glyphs. Locally hosted OFL fonts: **Tiro Devanagari Marathi** (body) and **Amita Regular** (calligraphic names). Font licenses are in `public/divya-vivah/fonts/`.

The source was a flattened JPG, not a layered design. Background reconstruction and replacement fonts are close matches, not pixel-identical reproductions. See `FIDELITY.md`. Short text best preserves the composition; longer names/messages are reduced using actual browser-shaped DOM measurements. Very long copy necessarily becomes smaller, so customers should check the mobile preview before sharing.

## Countdown date versus printed copy

Both machine-readable countdown defaults and the printed year use **24 May 2026, 18:00 IST**. This date is in the past at development time, so the unedited sample correctly shows zeros and the after-wedding message. The original sample's printed weekday, `गुरुवार`, is preserved as supplied even though it does not match that calendar date. Do not silently alter the user's Marathi source copy.

The printed strings (`weekday`, `dayText`, `monthYearText`, `timePeriod`, `timeText`, `timeSuffix`) are separately editable for exact wording and typography. **Customers must update those AND `weddingDate`/`weddingTime` together**. Form hints explicitly explain this. These are not automatically synchronized. Schema validates real dates and 24-hour ASCII HH:mm; blank drafts are allowed, but publishing requires both names and valid countdown settings.

The runtime parses an explicit `+05:30` instant and formats dates in `Asia/Kolkata`, independent of guest timezone. Negative countdowns clamp to zero. On the wedding date in IST, the wedding-day message replaces the waiting state after the target time; on subsequent days, the thank-you message appears.

## Maps

`mapQuery` accepts an optional place name or latitude,longitude pair, not a URL. If blank, Maps searches the venue name plus address. Query text is URL-encoded; it never becomes an executable href. The iframe uses the public Google Maps query embed; the always-present external Maps link/directions button provides a fallback when an embed is blocked. Opening Google Maps is an explicit guest action. Verify the real pin before sharing: the sample address is supplied reference text, not a geocoded/verified venue.

## Binary assets and builds

`assets/divya-vivah/manifest.json` pins byte sizes and SHA-256 hashes. Text-safe base64 parts contain the original supplied video re-encoded to H.264/AAC (720×1280), poster, reconstructed WebP and fonts. `scripts/prepare-divya-vivah.js` runs from the existing build/postinstall scripts, reconstructs the ignored binary files and rejects checksum mismatches. No new package dependencies or lockfile changes.

To reproduce assets: `node scripts/prepare-divya-vivah.js`.

## Validation (2026-10-25)

- `node --test tests/divya-vivah.test.js tests/divya-vivah-runtime.test.js`: 25 tests passing.
- `node scripts/test-bfday.js`: all 356 existing/new family tests passing, plus restart/publish persistence for every template including Divya Vivah.
- Browser: tap → full film → gold reveal → invitation, next navigation, countdown, Maps area and directions link inspected. Locally hosted fonts confirmed loaded. Card/content layout checked at 320, 375, 390 and 736-pixel container widths; no horizontal overflow.
- Runtime tests cover rejected play promises, duplicate taps, reduced motion, keyboard skip, lazy Maps, IST countdown across multiple visitor timezones and expired/wedding-day states.
- Asset decoder SHA-256 round trip verified.
- Root `npm test` was also attempted. Its earlier suites ran, but it stopped in the pre-existing Ganapati suite because `playwright`/other installation-dependent modules were unavailable after the blocked install. The full root suite is therefore NOT reported as passing.
- `npm ci --ignore-scripts` was attempted twice but the package registry returned 403 for the repository's pre-existing sharp 0.35.4 tarball. No dependency was substituted. The dependency-free template and actual server family/API suites above still ran successfully. A clean full dependency install remains to be verified in a network environment that can fetch the pinned tarball.

## Release

Ship via feature branch and review PR only. Production auto-deploys main; merging/deployment requires owner approval. Do not replace existing templates or customer records. After deployment verify `/create/divya-vivah`, the sample video and a newly created real invitation on iOS Safari and Android Chrome (not physically tested here).
