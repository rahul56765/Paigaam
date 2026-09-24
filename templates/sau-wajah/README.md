# Sau Wajah — "a hundred reasons"

A birthday Paigaam ported from
[felisaans/cute-birthday-website](https://github.com/felisaans/cute-birthday-website) (MIT).

One document, four scenes: a greeting with floating hearts and a hand-drawn
cake, a polaroid photo slideshow, a clothesline of little photos above a
slowly auto-scrolling "100 reasons why I love you" list, and a typewriter
letter that ends in a confetti burst. A song follows the recipient through
every scene, and a little note button lets them write back — their words
stay in their browser.

## Routes

| Route | What |
|---|---|
| `/create/sau-wajah` | six-step generator (draft → preview → publish) |
| `/sau-wajah/demo` | sample experience (Meher → Rahul, pastel demo photos) |
| `/sau-wajah/preview/:id` | owner-only live preview |
| `/p/sauwajah-<18hex>` | the published experience |
| `POST /api/sau-wajah/draft` | save draft (creator-cookie ownership) |
| `POST /api/sau-wajah/upload?id=` | photo upload (0–9, optional) |
| `POST /api/sau-wajah/publish` | free instant publish |

## Editable fields

`recipientName` (required), `senderName`, `heroTitle`, `heroSubtitle`,
`galleryHeading`, `reasonsHeading`, `reasons` (one per line),
`letterTitle`, `letterBody`, `signature`. Everything defaults to the
original copy, so an untouched form still sends the designed experience.

## Photos are optional

Unlike Love Album there is no minimum-photos gate: with 0 uploads the
gallery and clothesline play with pastel placeholder polaroids. Uploads
follow the Love Album pipeline — the client re-encodes via canvas
(long edge ≤1600px, JPEG q0.82) and the server validates magic bytes and
dimensions natively (no sharp), storing under `DATA_DIR/sau-wajah-uploads/`
with the same ownership, janitor and publish-verification rules.

## Differences from the original, all deliberate

- The four static HTML pages became one document with a scene switcher —
  so the persistent song and the recipient's note survive by construction
  instead of via `sessionStorage`/`localStorage` bridges across reloads.
- The original's placeholder GIFs and photos (pastel "REPLACE ME" boxes,
  Indonesian *ganti aku*) are NOT ported — every visual is inline SVG or
  drawn in the browser (cake, bear, sparkles, hearts), same precedent as
  Saalgirah's synthesised everything.
- The song (`assets/sau-wajah/music.mp3.b64`, 4.5s mono MP3 from the
  upstream repo, checksum in `manifest.json`) IS ported — it is generic
  instrumental placeholder audio shipped by the template author, and the
  sender can point the renderer at their own track later. It boot-heals
  into `public/sau-wajah/media/` via `lib/sauwajahMedia.js`.
- The original asked browsers to autoplay the song across page loads;
  here the song starts on the recipient's first tap (a browser gesture
  requirement) and then never stops.
- The "100 reasons" list is one editable textarea; the original made you
  edit 100 `<li>` lines in HTML. The demo falls back to ten starter
  reasons.

## Media

`assets/sau-wajah/` carries base64 text only (the binary-through-JSON git
corruption lesson). Never `git add` files under `public/sau-wajah/media/` —
they are boot-healed build artifacts, exactly like every other template's
media directory.

## Tests

`npm run test:sauwajah` (wired into `npm test`) runs
`tests/sauwajah-api.test.js` (ownership, CSRF, generic-endpoint refusals,
validation, escaping, idempotent publish, upload sniffing, restart
persistence) and `tests/sauwajah-dom.test.js` (the scene engine, the
slideshow, the typewriter, the music/note widgets against a stub DOM on a
virtual clock).
