# Patra Vivah

A new, isolated Paigaam wedding invitation with exactly three 9:16 cards: banana-leaf envelope → Save the Date → Wedding Itinerary. Built against main 09268e9ad04325a1961e211bcc444eb782cae510. No existing invitation is replaced.

## Design and artwork

The three supplied flattened JPG references guide the composition. Page two's banana leaves and red/golden-yellow knotted cloth, and page three's feet, tied cloth, marigold garlands and lower-right banana leaves are extracted as separate transparent painted layers. Reference lettering, tabletop, envelope backdrop and watermark are not included. The cover is a newly generated straight-on flat painted illustration matching the reference envelope, not a photograph. Its card, left/right leaf flaps and editable SVG gold cord/bow/tassel are independent layers. Fine artwork edges and fonts are close reference-guided recreations; this is not a claim of pixel-identical original editable source art.

Only the supplied decorative motifs are used. Optional uploaded photo/logo areas are absent unless selected. The default demo uses reference-style names and a seven-entry, three-day schedule, with internally consistent August 2026 dates.

## Layout and motion

The complete 720 × 1280 design canvas is scaled uniformly to fit the stage. Navigation and device safe-area space are reserved outside it. No object-fit cover is used on the page canvas. Narrow, tall, short and landscape screens show all borders and art, with surrounding space where necessary. This is contain/letterbox behavior, never a forced full-bleed crop.

Text is live escaped HTML in separate reserved zones. A bounded binary fit runs at layout and font readiness. Long names, custom headings and dense schedules shrink within their own areas rather than being truncated, clipped or painted over the illustrations. Input lengths and itinerary size are finite: up to four days and ten events total. The usual three-day/seven-event layout remains most legible. Very dense maximum-length content necessarily has smaller text; arbitrary content cannot remain large on every phone within a fixed three-page format.

The first cover tap synchronously attempts song playback, gently loosens the bow, swings independently clipped banana-leaf flaps on their outer hinges with perspective, then grows a white light over the opening and crossfades to page two. The normal sequence is 1,950 ms before the destination becomes current plus 700 ms to finish the light/fade, totaling 2.65 seconds. Rapid repeated input is locked. Previous/next arrows, page dots, keyboard arrows and horizontal swipe navigate a soft fade/slide.

Four leaf regions on each side sway at independent timings. The red/gold pointed arch has a perpetual subtle glow and a short travelling edge light. Cloth and garlands move very slightly. Seven tiny, low-opacity yellow petals fall slowly along the page margins on both content pages, avoiding the text column. Text and schedule rows reveal sequentially. Hidden-page and hidden-tab decorative animations pause. Reduced motion removes decorative movement and opening delays. Current page is announced; inactive pages are inert. A no-JavaScript visual fallback exposes scrollable cards, with a separate semantic no-script text copy for assistive technology.

## Editing contract

Editable top-level fields: brideName, groomName, coupleJoiner, coverHint, saveHeading, saveDate, itineraryHeading, couplePhoto, monogramLogo, musicUpload, musicLink, days.

The optional images use contain, preserving the entire uploaded logo/photo, with transparent PNG/WebP support. No image is added by default.

Nested schedule format:

```json
{
  "days": [{
    "heading": "SATURDAY | August 22, 2026",
    "events": [{
      "time": "4:00 PM",
      "event": "Wedding Ceremony",
      "venue": "Silver Meadow Inn"
    }]
  }]
}
```

The opt-in nested-itinerary editor provides add/remove/reorder at both levels and reports aggregate capacity. Limits: 4 days, 10 total events, heading 44 characters, time 16, event name 44, venue 80. Strict publication requires at least one complete day/event. Draft modes retain valid partial input without inventing rows; invalid inputs are rejected or sanitized according to the existing family-mode contract. Generic list handling changes only for explicitly declared nested-itinerary fields; other templates continue rejecting nested declarations.

## Music and uploads

The existing family engine supplies creator ownership, origin checks, MIME/header verification, persistent file storage, private draft serving and publication. Music uploads accept MP3, M4A, OGG or WAV up to 15 MiB. Uploaded music takes priority over a URL. HTTPS direct audio URLs and supported HTTPS YouTube URLs are accepted; Spotify/Apple Music share pages are not audio files and are rejected. Invalid/lookalike hosts and embedded credentials are rejected. Unusual valid YouTube links are canonicalized before use by the legacy parser.

Native audio starts from the first cover gesture. YouTube is a lazy embed: actual playback depends on provider embedding/autoplay policy and may need a further tap. A play/pause/retry control and status message are available. No provider song is downloaded. Use music you have the right to share.

## Files and routes

- templates/patra-vivah/config.js, schema.js, render.js
- public/patra-vivah/patra.css and patra.js
- public/bfday/itinerary-editor.js (loaded only for the opt-in editor)
- assets/patra-vivah/manifest.json and nine checksummed base64 art files
- lib/bfday/assets-patra-vivah.js restores missing/corrupt art on family startup
- scripts/pack-patra-vivah-assets.js regenerates the text pack after artwork edits
- tests/bfday-patra-vivah.test.js and tests/bfday-patra-runtime.test.js

After deployment, the existing family engine will expose the template detail, demo and creator routes for slug patra-vivah. No new environment variables, dependencies, deployment settings or storage volume are required. At initial delivery this feature is a reviewable branch/PR and interactive demo artifact, not a production deployment.

## Verification and release gate

See QA.md. The container's npm install is blocked with HTTP 403 fetching pinned sharp 0.35.5. Built-in-only unit/integration tests run, but the full application build and full live-server family runner cannot be certified here. Run the normal dependency install/build and release smoke tests in CI or the approved deployment environment before merging. Do not weaken or replace the pinned dependency to make this environment pass.

## Changelog

### 2026-10-30
- Added the isolated three-card reference-guided template and layered art pack.
- Added nested day/event editing, finite capacity validation, optional contained photo/logo and first-tap music.
- Added 2.65-second perspective envelope opening, continuous gentle decorative motion, reduced-motion and accessible fallback behavior.
- Added focused render/schema/editor/runtime/artwork/HTTP lifecycle regression coverage and browser containment checks.
