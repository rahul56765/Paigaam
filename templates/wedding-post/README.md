# The Wedding Post

A five-page, mobile-first newspaper-style wedding invitation in the shared Paigaam template family. It keeps the reference order: invitation front page, Save the Date, The Love Story, Our Wedding Post (thank-you), and Wedding Day Timeline & games.

## Editable fields

The shared template wizard handles names, parents, ceremony date/time and place, invite and thank-you copy, five statistics, fun facts, captioned photos, the timeline, word-search list, remembrance note and reception map link. Timeline events can be added/removed (up to 10). The word-search list remains editable; the current bride and groom names are added automatically, and changes update the generated puzzle. The QR code is an SVG made from the pasted URL using `lib/qrcode.js`.

## Routes and shared engine

Registered in `templates/bfday.js`, rendered by the family engine:

- `/templates/wedding-post` — collection detail and live preview
- `/create/wedding-post` — editable wizard and live preview
- `/wedding-post/demo` — sample pages and playable games
- `/wedding-post/preview-frame` — live preview
- `/wedding-post/preview/:id` and `/api/wedding-post/*` — owner preview and draft/publish APIs

The public styles and interactions live in `public/wedding-post/`. The sample photos use shared demo-couple assets and are displayed as black-and-white placeholders.

## Visual direction and interaction

Portrait pages use a 5:7 ratio, shared cream newsprint with fine grain and darkened edges, monochrome photographs and free Google Fonts close to blackletter, newspaper serif and script forms. Page navigation turns the sheet with a reversible 3D curl and soft edge shadow; previous/next buttons, page dots, keyboard arrows and horizontal touch swipes all use the same transition. On Wedding Day, hearts anchor the center rule while event copy and matching line icons alternate above/below it; extra events can be reached with a horizontal timeline swipe. The games have dedicated drag and arrow controls. Reduced-motion preferences switch page navigation to instant changes and suppress decorative motion.
