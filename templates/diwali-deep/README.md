# Diwali Deep

Three reference-guided, original flat-vector 9:16 invitation cards for Paigaam. Registered in templates/bfday.js and discovered under the Festivals occasion via category Diwali. No changes to existing template renderers or wedding-video.

## Routes

The existing family engine supplies:
- /templates/diwali-deep — catalogue/detail page
- /create/diwali-deep — four-step customizer and live preview
- /diwali-deep/demo — interactive sample
- /diwali-deep/preview-frame — stateless editor preview
- /api/diwali-deep/draft, /upload, /upload-audio, /publish — existing authenticated creator lifecycle
- /p/diwali-deep-… — published guest invitation

No new credentials, environment variables, services, build steps or external animation dependencies. Committed JavaScript, CSS and SVG are served directly. Existing production deployment process applies. Price defaults to zero, consistent with the new-template defaults; the owner can manage price/availability through the existing admin editor.

## Design and interactions

The three cards share a fixed 360 × 640 illustration canvas. Available stage width and height determine a single uniform scale. The complete canvas remains visible; controls and device safe areas are reserved outside it. Letterboxing is intentional on screens whose ratio differs from 9:16. This preserves illustration proportions rather than stretching or cropping them. The reference's corner mandalas are designed as edge motifs, contained inside the canvas.

Cover: deep emerald paper, engraved maroon-and-gold Mughal aperture, live gold heading and an unlit red diya. There is no photographed table, flower, bowl, candle or maroon photographic backdrop. Start a pointer gesture on the lamp. Upward distance over 22 percent of the displayed card height maps to flame growth; updates are coalesced into animation frames. An incomplete gesture cools the flame over 1.25 seconds. A full gesture locks the interaction, fills the screen with golden light, and crossfades to page two. Tap, keyboard activation, next and dots offer alternate opening paths. Pointer cancellation and capture loss reset incomplete gestures without accidentally advancing. The stage suppresses browser panning, and pointer gestures elsewhere never steal a map-button activation.

Invitation: green background, crimson and gold curtains, six softly swaying hanging lamps, breathing gold title, line-by-line entrances, editable host line, three-column date/time block, address, bottom diya/rangoli and edge mandalas.

Welcome: matching artwork, gold-framed optional family portrait, warm-regards line, family name, message, thanks, shared address, and an optional map button. The map button is omitted entirely without a valid link.

Each text field has a reserved safe box. After fonts load, and on resize, a bounded binary search reduces its font only as needed. The art never shifts into live text. Field length limits bound the worst case; long copy can become smaller, so concise copy is preferable for readability. Explicitly cleared optional lines stay empty; absent fields receive sample defaults.

## Customization, uploads and ownership

All live wording is declared in config.js and escaped by the shared helpers. Day/date/month/year are separate text fields to match the reference; the sender chooses the correct combination.

Photo: familyPhoto uses the existing owned JPG/PNG/WebP upload slot, including Choose, Replace and Remove. photoZoom (100–240), photoX and photoY (0–100) provide live cropping and movement within an overflow-hidden frame. object-fit: cover and a matching object/transform origin keep the frame filled without stretching. A decorative placeholder appears when the photo is removed; no fake family photograph is generated.

Replace/remove is supported while editing a draft. Published invitations retain the existing family engine's immutable lifecycle: this template does not change the site's ownership or post-publication edit policy. Do not promise post-publication re-editing without implementing and testing a separately approved engine capability.

mapsLink accepts HTTPS Google Maps share/location URLs on known Maps domains. Blank, unsafe or malformed links are hidden in preview and refused on save/publish. No arbitrary schemes, credentials or Google-lookalike suffix domains are accepted. Supported Google country domains are enumerated in schema.js; extend that list when necessary.

musicUpload accepts the existing verified MP3/M4A/OGG/WAV uploads (15 MiB). Upload wins over musicLink. Direct HTTPS audio URLs and YouTube links are supported; Spotify/Apple share pages are not audio sources. Native audio play is attempted synchronously on the first cover touch/tap. A visible music control supports pause/retry and reports blocked/unavailable audio without blocking the invitation. YouTube is dependent on provider embed/autoplay availability and may require another tap. The frame source and message origin are restricted to youtube-nocookie.com. Guests without music configured load no media/player.

The published family renderer is shared with the production customizer; the self-contained Hyperagent preview is only a visual/interaction preview, not a second editor or a production deployment.

## Accessibility and performance

Previous/next, three page dots, keyboard arrows, horizontal/vertical swipe and the large cover button use the same bounded page state. Inactive pages are inert and aria-hidden; page status is announced. Focus moves from an outgoing page to the active page only when necessary. Background animation pause, tab visibility pause, reduced-motion preferences and a no-JavaScript reading fallback are provided. Reduced motion bypasses the flood and decorative loops.

Original procedural vector art is in art.js; paint-server IDs are unique across every SVG invocation. CSS transform/opacity animate the flame, pages and leaves. A few light leaves remain decorative and pointer-transparent. The native canvas is capped at a displayed 480 pixels wide to avoid giant desktop type. Long-form copy is intentionally limited rather than causing layout overflow.

## Testing

Run npm run test:diwali-deep or node --test tests/bfday-diwali-deep.test.js.

Coverage: loader contract, field placement, demo validity, three-page/inert navigation markup, copy and XSS escaping, optional blank lines, Maps domains and unsafe links, upload references, crop bounds, music precedence, unique SVG IDs, script syntax, customizer controls and an isolated temporary-database HTTP lifecycle including photo replacement/removal, audio upload, preview, media privacy and publish cleanup.

Regression checks: node --test tests/bfday-engine.test.js tests/bfday-lotus-vivah.test.js tests/bfday-audio.test.js.

Browser QA checks full-canvas geometry for narrow, normal, tall, tablet and landscape stage sizes; text bounding boxes; proportional partial swipe, cancelled/released swipe, full opening, tap fallback, page navigation and reduced motion. Browser layout checks are not a substitute for physical iOS/Android-device testing of OS-level autoplay and Maps-app routing.

## Changelog

### 2026-10-30
- Added the three-page Diwali Deep template, original engraved vector illustration and responsive contained 9:16 stage.
- Added proportional swipe lighting, tap/keyboard fallback, golden flood, page transitions, navigation, flame loops, leaves and reduced-motion support.
- Integrated editable copy, optional family photo crop controls, validated Google Maps links and uploaded/direct/YouTube music through the existing family engine.
- Added focused schema/render/customizer/HTTP lifecycle tests and browser geometry/gesture QA.
