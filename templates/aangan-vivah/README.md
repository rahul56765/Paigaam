# Aangan Vivah — eight-page illustrated wedding invitation

A mobile-first, editable eight-page wedding invitation built as an isolated member of Paigaam's shared `lib/bfday/` family. The shared engine supplies the customizer, live preview, drafts, publication and ownership checks. This template owns only its field configuration, validated event model, renderer, CSS, JavaScript and reference-guided page art.

## Page order

1. Closed carved golden double doors surrounded by the pink flowers and greenery from the supplied reference. Tap or press the open button to swing the two door leaves outward in a slow 3D motion; a warm glow appears behind them, then the invitation advances.
2. Couple initials inside the floral circle, two peacocks, wedding date, venue and the painted courtyard.
3. The Ganesh mark, invitation line, couple names, parents, date, venue and courtyard.
4. Haldi Ceremony — wisteria and marigold garlands above the sunflower sofa.
5. Sangeet Night — deep teal, chandeliers, disco balls and checkerboard floor.
6. Wedding Ceremony — floral arch and pink-draped mandap, with separately editable Baraat and Phera timings.
7. Wedding Reception — pink curtains, champagne tower and table.
8. Thank-you line and host family name over the two white peacocks, fence, lawn and flowers.

The event pages are one ordered list in the editor. Its up/down controls change their order; removing Haldi or Sangeet hides that page. Strict publish validation requires unique event types and keeps the Wedding Ceremony and Wedding Reception pages present.

## Editable copy and layout

The couple's names, parents, invitation line and message, wedding date, monogram venue, event page headings, theme lines, event dates, times, Baraat/Phera times, venues, dress codes, closing line and family name are editable. On the monogram page, upload an optional logo (transparent PNG is preserved), then adjust zoom and horizontal/vertical position against the live preview; removing it restores the editable initials. Event copy is escaped and wrapped inside responsive text areas; it is not baked into the illustration. Blank initials derive from the first letter of each name. Long copy wraps and the active page automatically scales colliding text blocks down within readable limits rather than clipping them.

Display headings use Great Vibes-style script; detail copy uses Cormorant Garamond. The provided reference is a flattened contact sheet rather than source artwork/layers or a font specification, so the illustrations are careful clean-text recreations from its eight individual panels and the typefaces are close visual matches, not claims of pixel-identical art or exact font identity. The background scenes contain only the motifs requested from the corresponding reference panel; personalized text remains live HTML.

## Interaction, accessibility and performance

- Portrait 9:16 page cards with keyboard arrows, visible previous/next controls, page dots and horizontal touch-swipe navigation.
- The page number and current page are announced to assistive technology; inactive pages are inert and hidden from the accessibility tree.
- Names and event details are server-rendered and HTML-escaped. There is a no-JavaScript scrollable fallback.
- Art drifts very gently, the chandelier lights softly twinkle, and page text reveals in short lines. The door sequence uses slow 3D leaves, a growing warm glow, brief rays/sparkles and a gold crossfade. `prefers-reduced-motion` removes decorative motion and uses direct page changes.
- Illustrations are optimized WebP files in `assets/aangan-vivah/*.b64`; `scripts/pack-aangan-vivah-assets.js` updates their checksummed manifest. `lib/bfday/assets-aangan-vivah.js`, called by `lib/bfdayRoutes.js`, restores missing or corrupted public files at startup.

## Routes

Provided by the shared family engine: `/create/aangan-vivah`, `/aangan-vivah/demo`, `/aangan-vivah/preview-frame`, `/aangan-vivah/preview/:id`, `/api/aangan-vivah/draft`, `/api/aangan-vivah/publish`, and `/p/<published-slug>`.

## Changelog

- 2026-10-26 — Added Aangan Vivah as an eight-page, reference-guided invitation with editable content, reorderable/optional event pages, 3D door opening, keyboard/touch navigation, reduced-motion behavior and startup-restored page artwork.
- 2026-10-26 — Targeted refinement only: moved the Ganesh mark higher and narrowed/reduced slide 3 copy for safe margins; added optional transparent monogram upload with live zoom/position controls; slowed the door swing and staged the golden light crossfade. Other backgrounds, palette and page layouts remain unchanged.
