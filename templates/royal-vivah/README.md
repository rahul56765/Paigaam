# Royal Vivah — sealed wedding invitation

A fixed-art, scroll-based wedding invitation built as a new member of the shared `lib/bfday/` family. The live wizard, schema validation, drafts, preview routes, publication and owner checks come from the family engine; only this directory’s config, renderer and scene-specific CSS/JS are unique.

## Scenes

1. **Envelope opener.** A still red envelope and small “Tap to open” prompt; the heart-seal hotspot plays the customer-supplied 10-second H.264/AAC video with its audio, then fades from its glowing end frame into Save the Date. Native touch/trackpad scrolling remains available.
2. **Save the Date.** The reference-inspired TV-card illustration keeps the “Save the Date” headline fixed; date and couple names are editable overlays.
3. **Families.** Reference-inspired floral frame/palace artwork with editable family lines, names, date and city.
4. **Wedding festivities.** Four reference-inspired illustration vignettes and border with editable headings, couple names, event titles, dates, times and venues.
5. **Final invitation.** Reference-inspired floral/feast artwork with editable copy and venue details. The editable maps URL makes the venue a tap-to-open directions link.

The Save-the-Date card hand-off remains a separate muted clip; its editable names/date appear after it settles. All five scenes keep their complete 9:16 artwork on a centered portrait canvas, one viewport at a time with mandatory smooth scroll snap. Gentle rose petals fall across the entire story. `prefers-reduced-motion` skips both clips and petals while retaining every invitation scene. Text is escaped and server-rendered so each scene remains readable if JavaScript does not run.

## Reference artwork and typography

The source references were flattened images with their sample copy baked in. After the owner authorized image regeneration, clean-text backgrounds were created using the references as visual guidance; all personalized copy renders as live HTML. The generated backgrounds retain the rose/ivory/gold palette, ornamental borders and floral/ceremonial scenes, but they are faithful recreations, not pixel-identical source layers. Display faces use Bodoni Moda, Cormorant Garamond and Great Vibes as visual matches; the source font files were not supplied, so the exact typeface identity cannot be guaranteed.

The envelope pre-tap state is static. A tap starts the user's original 10-second video with its audio; the clip handles the flap and golden glow. After its bright end frame, the envelope fades smoothly into Save the Date. The previous envelope hand-motion clip is no longer used. The separate muted Save-the-Date hand-off clip plays when that scene arrives; editable names/date are shown after it ends. If playback is blocked, a static open-envelope poster is used; reduced-motion users skip both video clips and transition directly.

Static images and the opening clip are stored as checksummed base64 text in `assets/royal-vivah/` for the text-only Git publishing path. The runtime asset chunk is `lib/bfday/assets-royal-vivah.js`; regenerate the packed files with `node scripts/pack-royal-vivah-assets.js` after replacing public assets. Use `node scripts/qa-royal-vivah-browser.js` for mobile/browser smoke checks.

## Routes

Provided by the family engine: `/create/royal-vivah`, `/royal-vivah/demo`, `/royal-vivah/preview-frame`, `/royal-vivah/preview/:id`, `/api/royal-vivah/draft`, `/api/royal-vivah/publish`, and `/p/<published-slug>`.

## Changelog

- 2026-10-12 — Added Royal Vivah as an isolated family template with reference-guided recreated artwork, editable copy, a seal-triggered envelope clip, scroll flow, petals and an editable maps directions link.
- 2026-10-13 — Replace envelope-only motion with the user's 10-second flap/glow video and audio; fade into Save the Date; preserve the card hand-off; retune all slide copy and display full 9:16 art in one viewport.
