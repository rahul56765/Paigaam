# Suvarna Vivah — cinematic botanical wedding invitation

## Release state
PR #50, feature/suvarna-vivah-original-design, is a review build. The owner rejected the earlier gold editorial layout as visually weak and not mobile friendly. This 27 October rebuild replaces the entire guest visual system. Do not merge or deploy without owner approval. The existing first version remains live.

## Creative direction
The uploaded banana-leaf opening film ends in warm gold light and drifting petals. That final frame, not its dark-green opening, is the continuity anchor. On film completion, the frozen gold frame dissolves through an exact extracted final-frame bridge into a sunlit carved arch. Original generated banana-leaf foreground cutouts occupy separate moving layers. This is a layered 2.5D/CSS cinematic experience, not an all-mesh WebGL scene.

Scroll sequence:
1. User-initiated banana opening film, original soundtrack retained, with Skip and Escape.
2. Live calligraphic couple names inside a generated golden sanctum with banana leaves, brass lamps, marigolds and restrained falling petals.
3. Arched family invitation beneath a jasmine/marigold toran.
4. Circular engraved-gold scratch date medallion, accessible reveal button, calendar download and countdown.
5. Full-bleed dusk mandap chapter with a scroll-directed camera crop.
6. Responsive ceremony timeline, real venue/map destinations and optional separate reception venue.
7. Customer photographs in arched frames, preserving uploaded aspect ratio, with keyboard-capable lightbox.
8. Expandable travel/stay/dress/gift information, existing RSVP form/backend and personal closing.

Generated scenery is decorative concept artwork, not a photograph of the customer's real venue; the venue artwork carries that disclosure. No fabricated couple photographs are included.

## Mobile and accessibility
Phone-first layout with explicit 320–430px handling, readable controls and 44–48px minimum tap areas. Long names are fitted after fonts load. Non-Latin languages use their script-specific font rather than Latin calligraphy. Pages grow with content instead of forcing text into a fixed-height canvas. Motion respects prefers-reduced-motion. Parallax updates are rAF-coalesced and restricted to visible scenes. No GPU/WebGL requirement.

Opening modal traps keyboard focus and makes the invitation inert until dismissed. Dismissal restores scrolling and heading focus. Editor open commands use the same dismissal path. Replay reopens the film in place using current edited data and language, without a reload. The final-frame animation runs once, not on subsequent editor updates. Preview readiness is posted once per document and incoming messages require the same origin and parent source.

The scratch underlay is initially inert and hidden from assistive technology; reveal exposes it and makes calendar download accessible. Canvas resolution is capped at DPR 2 and updated on resize. Pointer scratching and a keyboard/tap reveal button are supported. Optional music gets no src until Play; nothing autoplays after the film.

## Data and routes
Shares only Paigaam's established schema, seven-step editor, validation, storage, autosave, upload privacy, publishing, access gates, RSVP backend and versioning. It does not load Shaadi Paigaam's invitation runtime or visual stylesheet. Customer RSVP behavior was not changed in this visual redesign. Main's Shaadi upload-only music changes are preserved.

- /create/suvarna-vivah — native editor
- /suvarna-vivah/demo — sample; ?skip=1 bypasses opening
- /suvarna-vivah/frame — live editor preview; ?guest=1 includes opening
- /suvarna-vivah/preview/:id — owner preview
- Published short links, private manage links and passcode gates remain unchanged.
- Private/passcode share cards remain owner/admin only.

## Assets and continuity
The supplied film uses the existing ~1.5MB 720×1280 H.264/AAC encode with its audio and timing retained; no replacement animation was generated. Exact original upload remains the source reference. New generated sanctum, banana-leaf and toran alpha cutouts, dusk mandap, and extracted final frame total under 950KB as WebP. The cutouts have actual alpha, not a magenta backdrop. Art stays curated while font and button accent follow customer controls.

Media live under public/suvarna-vivah after restoration. Checksummed base64 source parts and manifest are under assets/suvarna-vivah. node scripts/pack-suvarna-vivah-media.js packs all eight manifest entries, including the previous continuity image retained for compatibility. lib/suvarnaVivahMedia.js verifies/restores them at boot. Public runtime files use v7 cache keys.

## Validation and review
- node --test tests/suvarna-cinema.test.js — 10 new renderer, JSON safety, asset checksum/budget, replay/modal contract, handshake, scratch accessibility, reduced-motion, music/RSVP and gallery/map checks.
- node scripts/test-suvarna-vivah.js — 73 focused API/guest/editor asset/privacy/publish/RSVP/version checks.
- node scripts/test-shaadi-paigaam.js — 61 existing-template regression checks.
- node --test tests/admin-ui.test.js tests/paigaam-admin-collection.test.js — 10 checks.
- node scripts/build-suvarna-review.js — builds the actual guest renderer into self-contained review-preview.html. Review-only; replies do not save.

Browser QA is performed on the generated review with actual playback and 320/390/430px browsing contexts. This is not a physical iPhone/Android performance benchmark or a real payment/RSVP submission. A full authenticated native editor walkthrough remains a separate release gate. Full repository suite is not claimed from these focused checks.

## Changelog
- 27 Oct 2026: Full cinematic botanical rebuild after rejection of the prior design. New original art, alpha leaves/toran, exact ending-frame bridge, calligraphic mobile hero, circular scratch medallion, dusk mandap, responsive event cards, reception venue, crop-preserving lightbox, expandable details, accessible modal/scratch, in-place replay, one-shot editor ready and lazy music. Production untouched; PR #50 awaits review.
