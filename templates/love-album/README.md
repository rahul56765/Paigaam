# Love Album

A draggable 3D memory gallery — a Paigaam port of
[ziddi-shop/love-you](https://github.com/ziddi-shop/love-you) (MIT).

The Paigaam opens on a playful intro ("Hey Pookie, I made something special
just for you!") with one button. Behind it: a scattered deck of draggable
photo cards on an animated gradient. Drag a card and it tilts in 3D; slide
it past 90° and it flips to its back. Photo cards show the shared memory;
message cards hide little notes. Touch enough cards and a final button
appears, opening a love letter over a dimmed screen.

## Routes

| Route | What |
|---|---|
| `/create/love-album` | generator (details → photos → publish) |
| `/love-album/demo` | sample with generated placeholder photos |
| `/love-album/preview/:id` | owner-only live preview |
| `/p/love-<18hex>` | the published album |
| `POST /api/love-album/draft` | save draft (creator-cookie ownership) |
| `POST /api/love-album/upload?id=` | upload one photo (jpeg/png/webp → webp) |
| `POST /api/love-album/publish` | free instant publish (3–9 photos required) |

## Photos are the point

Unlike every other Paigaam template, the sender **must** upload between
3 and 9 photos — the gallery *is* the photos. Uploads follow the Ganapati
Aagman pipeline: client-side canvas re-encode to JPEG (max 1600px), server
re-validates magic bytes + dimensions, stores webp at `DATA_DIR/love-uploads/`,
serves via `/love-album/uploads/<48hex>.webp` with ownership checks, and a
7-day janitor sweeps unreferenced uploads. Publishing fails closed if any
photo reference isn't a verified upload owned by that draft.

## Rebranding (ziddi → Paigaam)

- Footer "Made with Love by **Ziddi**" → "Made with love by **{senderName}**"
- "Madam jii" in the final button → editable field with a neutral default
- "Pookie" kept as the **default placeholder** for `recipientName` (it's a
  nickname, not branding) but fully editable
- The dead `/api/placeholder` gif cards became real message cards
- No Ziddi MP3s or demo photos ship — personal media never ships with a
  Paigaam template; the demo generates simple placeholder JPEGs at boot

## Mechanics (ported 1:1)

- Same card size (300×400), random scatter, random initial 3D tilt
- Drag: card follows pointer, tilts by drag distance, flips past 90°
- Double-tap/double-click also flips; first touch spawns sparkle particles
- 70% of cards touched → final button fades in (same threshold)
- Letter modal over a dimmed overlay, same gradient card + close button
- Falling hearts on the intro, rising bubbles + sparkles on the gallery

Dropped deliberately: GSAP/Tailwind (vanilla CSS/JS), the custom cursor
trail (fought touch screens), autoplay audio (Paigaam adds no music until
uploadable; the original's MP3s are the author's personal tracks).
