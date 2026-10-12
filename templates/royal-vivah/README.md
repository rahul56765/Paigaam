# Royal Vivah — sealed wedding invitation

A fixed-art, scroll-based wedding invitation built as a new member of the shared `lib/bfday/` family. The live wizard, schema validation, drafts, preview routes, publication and owner checks come from the family engine; only this directory’s config, renderer and scene-specific CSS/JS are unique.

## Scenes

1. **Envelope opener.** Full-screen rose envelope photograph; the heart-seal hotspot opens the cover and takes guests to the Save the Date. Native touch/trackpad scrolling remains available.
2. **Save the Date.** The reference-inspired TV-card illustration keeps the “Save the Date” headline fixed; date and couple names are editable overlays.
3. **Families.** Reference-inspired floral frame/palace artwork with editable family lines, names, date and city.
4. **Wedding festivities.** Four reference-inspired illustration vignettes and border with editable headings, couple names, event titles, dates, times and venues.
5. **Final invitation.** Reference-inspired floral/feast artwork with editable copy and venue details. The editable maps URL makes the venue a tap-to-open directions link.

Gentle rose petals are a continuous, low-contrast fixed layer. Scroll reveals use IntersectionObserver; `prefers-reduced-motion` removes decorative movement while retaining the invitation content. Text is escaped and server-rendered so each scene is present if JavaScript does not run.

## Reference artwork and typography

The source references were flattened images with their sample copy baked in. After the owner authorized image regeneration, clean-text backgrounds were created using the references as visual guidance; all personalized copy renders as live HTML. The generated backgrounds retain the rose/ivory/gold palette, ornamental borders and floral/ceremonial scenes, but they are faithful recreations, not pixel-identical source layers. Display faces use Bodoni Moda, Cormorant Garamond and Great Vibes as visual matches; the source font files were not supplied, so the exact typeface identity cannot be guaranteed.

The envelope opener combines the fixed portrait photograph with a muted 4-second flap-opening clip triggered by the seal tap, then scrolls into the Save the Date. The Save the Date runs a separate muted four-second card hand-off clip when it enters view; its editable names appear after the hand-off settles. If video playback is blocked, the static scene/text fallback remains available; reduced-motion users skip both clips.

Static images and the opening clip are stored as checksummed base64 text in `assets/royal-vivah/` for the text-only Git publishing path. The runtime asset chunk is `lib/bfday/assets-royal-vivah.js`; regenerate the packed files with `node scripts/pack-royal-vivah-assets.js` after replacing public assets. Use `node scripts/qa-royal-vivah-browser.js` for mobile/browser smoke checks.

## Routes

Provided by the family engine: `/create/royal-vivah`, `/royal-vivah/demo`, `/royal-vivah/preview-frame`, `/royal-vivah/preview/:id`, `/api/royal-vivah/draft`, `/api/royal-vivah/publish`, and `/p/<published-slug>`.

## Changelog

- 2026-10-12 — Added Royal Vivah as an isolated family template with image-to-image recreated wedding artwork, editable copy, a seal-triggered envelope clip, scroll flow, petals and an editable maps directions link.
