# Chamak — Disco Birthday

Boyfriend Day family (the shared engine in `lib/bfday/`), Birthday Series
4 of 4. *Chamak* (चमक) — the shine. The glam pick: black-gold-neon disco
for 18th/21st/25th parties. A chrome mirror ball sways over a pure-black
stage with drifting light dots, the name reveals letter by letter in gold
italic, a gift box rattles and pops to a gold-framed photo gallery, and
the VIP badge + wish card close the night.

Free on the front-end (price lives in the DB, owner sets it in the admin
editor).

## The beats (5 + finale)

1. **Ball stage** — the mirror ball sways gently (animated layer 1), 14
   light dots drift down from it in gold and pink (animated layer 2 —
   **the only two continuous loops**, Director's hard cap). The name
   staggers in per-letter (0.06s apart, spring easing) in gold italic
   Fraunces 900 with the foil gradient clipped into the glyphs. The
   neon-pink marquee strip scrolls at the bottom edge.
2. **Gift** — tap: rattle (0.6s) → the open box (glow + foil star burst
   baked in) → 46 gold foil **rectangles** fall (not dots — Director's
   ruling) → auto-advance at 1.8s.
3. **Gallery** — 3–5 photos in tilted gold baroque frames (tilts ≤3°,
   alternating), glitter stamp stickers, scroll-snap strip. Tap anywhere
   walks to the wish.
4. **Wish** — the gold VIP badge (the Director's STUNNA replacement), the
   wish in italic Fraunces, the sign-off, the opt-in song chip, and
   "Celebrate again" (full reset: box closes, confetti clears, back to
   the ball).

## The motion budget

Exactly two animated CSS layers — ball sway + dot drift. The marquee is
transform-only and triggered by existing; the stagger, rattle, confetti
and pop are all one-shot. A stuttering disco is worse than a static one.
`prefers-reduced-motion` stills both loops, hides the dots and confetti,
and collapses the stagger.

## Design tokens

Stage black `#111111`, neon gold `#F4EA00`, metallic gold `#D4AF37`,
neon pink `#FF4FA3`. Fraunces italic 900 display, Bricolage Grotesque 700
body. Gold gradient clipped into the name glyphs; neon text-shadows on
the marquee and box line only.

## Wizard

Five steps: the people, the marquee line, the box line, the gallery
(3–5 photos), the wish (+ the shared `bgmSong` field).

## Engineering

Server-rendered whole night (`templates/chamak/render.js`) — all sender
text HTML-escaped; `public/chamak/chamak.js` is motion only; the noscript
fallback renders all stages as one still, readable page with the name
visible. Art lives in `public/assets/chamak/` and the demo photos in
`assets/bfday-demo/chamak-demo-*.jpg`, decoded at boot from the
`lib/bfday/assets-chamak-*.js` carrier files. Every cutout carries the
hard alpha cutoff (≤12 → 0) — the dark-stage sheen class is dead.
