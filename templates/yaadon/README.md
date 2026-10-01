# Yaadon — Memory Scrapbook

Boyfriend Day family (the shared engine in `lib/bfday/`), Birthday Series
2 of 4. *Yaadon* (यादों) — of memories. A hand-made scrapbook the
recipient flips through: a kraft-paper cover with a washi corner and a
burgundy wax seal ("For you — open slowly."), which lifts on tap and opens
the book. Inside: a small-caps title spread, polaroid pages with
handwritten captions and pressed flowers, a peel-reveal "reasons" spread,
and the final letter on lined paper.

Free on the front-end (price lives in the DB, owner sets it in the admin
editor).

## The beats (5 + finale)

1. **Cover** — kraft texture, scattered ink doodles, the wax seal, the
   cover line and "for {name}". Tap lifts the seal (0.9s), the cover
   fades away, the title spread flips in.
2. **Title spread** — eyebrow, name in Fraunces small-caps, the date in
   terracotta small-caps, washi tape, pressed flowers.
3. **Pages** — the polaroids as a horizontal scroll-snap strip (3–6):
   photo under the polaroid-frame cutout (transparent window), washi tape
   on top rotating opposite the tilt, Caveat caption under each. Dots
   track position. Flowers + ticket sticker scattered.
4. **Reasons** — 3–6 paper peel-strips on kraft: tap, Enter, or an 18px
   drag peels (the strip slides up at −2°, the Caveat line fades in
   beneath). "Peel them all" appears after 2, sequential at 300ms. All
   peeled → the letter flips in after 1.1s.
5. **Letter** — lined paper, Caveat body in ink #4A3F3A, sign-off, the
   opt-in song chip, and "Read it again" (full reset: strips re-paint,
   cover returns, seal unlifts).

## The degrade (Director's ruling)

`.yd--degrade` on `<body>` when `navigator.deviceMemory ≤ 2`, `saveData`
is set, or `preserve-3d` is unsupported: the spread flip becomes a
slide-fade (no perspective transforms), and the polaroid shadow lightens.
Content and structure are identical — only the transform budget changes.
The pages strip was always scroll-snap; nothing else to degrade.

## Design tokens

Kraft `#F5EEE3` (texture tile at 512px), fields `#E8D8C8`, brass `#B08D57`,
terracotta `#9A5B4D`, sage `#6B7A5E`, ink `#4A3F3A`. Fraunces 600
small-caps headers, Caveat 700 marginalia, DM Sans captions. Tilts ≤3°,
alternating. Motion: the flip-in, the seal lift, the peels — all
triggered; nothing loops. `prefers-reduced-motion` cuts everything.

## Wizard

Six steps per the spec comparison: the people, the cover (line + date
field), the pages (3–6 polaroids), the reasons (3–6), the letter, the
song (the shared `bgmSong` field).

## Engineering

Server-rendered whole book (`templates/yaadon/render.js`) — every spread,
all sender text HTML-escaped; `public/yaadon/yaadon.js` is motion only;
the noscript fallback renders the full book as one still, readable page
with all reason text visible. Art lives in `public/assets/yaadon/` and
the demo photos in `assets/bfday-demo/yaadon-demo-*.jpg`, decoded at boot
from the `lib/bfday/assets-yaadon-*.js` carrier files.
