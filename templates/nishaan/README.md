# Nishaan — Milestone

Boyfriend Day family (the shared engine in `lib/bfday/`), Birthday Series
3 of 4. *Nishaan* (निशान) — a mark, the stamp you leave. The adult pick:
pure typographic luxury for 30th/40th/50th birthdays. A warm-white cotton
field, the age as a viewport-filling gold-foil numeral, a type-collage
band, a gold-ruled timeline, one portrait in a museum mat, and a
champagne-toast finale.

Free on the front-end (price lives in the DB, owner sets it in the admin
editor).

## The beats (5 + finale)

1. **Numeral** — the age in Fraunces 900, the 2048px foil texture masked
   via `background-clip: text` (2× retina per the Director's ruling — no
   shimmer). Real text underneath: selectable, screen-reader friendly.
2. **Collage band** — 3–6 sender words in alternating serif-900 /
   italic-serif, cycling three sizes, the date in terracotta small-caps,
   the flourish gold rule.
3. **Timeline** — 3–5 entries ("1986 — the beginning"), the year in gold
   Fraunces 900, a diamond-center gold rule per row.
4. **Portrait** — one photo under the emboss museum-mat cutout
   (transparent window, photo underneath), "with love, {sender}".
5. **Toast** — the clink illustration (tilts gently on tap), the wish in
   italic serif, the sign-off, the opt-in song chip, "Raise a toast
   again" (scrolls back to the numeral).

## Design tokens

Warm white `#FFFDF8` (paper texture at 512px), ink `#2C2A26`, gold
`#C9A227` strictly decorative, deep red `#8C2F39` the only accent (the
script words + the sign-off). Fraunces 900 display, DM Sans 300 air.
Motion: scroll reveals only, nothing loops — this register is stillness.
`prefers-reduced-motion` collapses them.

## Wizard

Five steps (lightest build in the series): the person, the number (age +
date), the collage (3–6 words), the timeline (3–5 entries), the toast
(portrait + wish + the shared `bgmSong` field).

## Engineering

Server-rendered whole page (`templates/nishaan/render.js`) — all sender
text HTML-escaped; `public/nishaan/nishaan.js` adds only the
IntersectionObserver reveals and the clink tilt. Art lives in
`public/assets/nishaan/` and the demo portraits in
`assets/bfday-demo/nishaan-portrait-*.jpg`, decoded at boot from the
`lib/bfday/assets-nishaan-*.js` carrier files.
