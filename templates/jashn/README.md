# Jashn — Blow the Candles

Boyfriend Day family (the shared engine in `lib/bfday/`), Birthday Series
1 of 4. *Jashn* (जश्न / جشن) — a celebration. The flagship birthday
ceremony: pastel clay balloons drift onto a soft-cream stage, a three-tier
clay cake rises with the recipient's name and their age lit as candles, and
they blow the flames out — through the microphone, or by tapping, with the
tap fallback visible the whole way. Then confetti, a photo reel, and the
letter finale with the opt-in party song and "Celebrate again".

Free on the front-end (price lives in the DB, owner sets it in the admin
editor).

## The beats (5 + finale, Director's cap)

1. **Intro** — balloons drift, sprinkles scattered, "Tap to open your
   surprise" pulses.
2. **Cake** — the cake rises with a spring wobble; name in Fraunces 800;
   the candle count mirrors the age field.
3. **Blow** — tap each flame, or "Blow with your voice": getUserMedia +
   an RMS volume gate (one flame per burst, 450ms cooldown). The mic
   attempt window is **8 seconds** (Director's ruling) — on expiry, denial
   or any error, the status line hands over to the visible tap fallback.
   The fallback line ("or tap the flames one by one") is on screen from
   the start; the mic is never a dead end.
4. **Reel** — all flames out → pure-CSS confetti falls (60 pieces, no
   sprite sheet) → the photo reel, a scroll-snap carousel with Caveat
   captions and dots.
5. **Letter** — Caveat on paper grain, sign-off, the opt-in song chip
   (shared `bgm` pattern — nothing loads until a tap), and the
   "Celebrate again" replay (relights every candle, full reset).

## The candles

- Age 1–9: that many individual flames (positioned over the top tier).
- Age 10+: a fixed 9-flame set carrying a "9+" label — never infinity
  (Director's ruling).
- Blank/invalid age: one hero candle, so the blow beat always works.

## Design tokens

Soft cream `#F7F0E6` stage, pastel pink `#D8A7B1`, sage `#A8B5A2`, gold
`#C9A227` strictly decorative, body ink `#4A3F3A` (the pastels fail
contrast for the letter — Director's ruling). Fraunces 800 display,
Caveat handwritten, DM Sans body. Motion budget: the balloon drift and the
flame flicker are the only continuous loops, transform/opacity only;
`prefers-reduced-motion` stills them and skips the confetti.

## Engineering

Server-rendered whole page (`templates/jashn/render.js`) — every beat, all
sender text HTML-escaped; `public/jashn/jashn.js` is motion only, and the
noscript fallback renders the ceremony as one still, readable page (flames
lit, all beats stacked). Art lives in `public/assets/jashn/` and the demo
photos in `assets/bfday-demo/jashn-demo-*.jpg`, decoded at boot from
`lib/bfday/assets-jashn.js` (the git pipe cannot carry binaries).

## Wizard

Five steps (the engine allows seven; the shared `bgmSong` field lands in
the last step): the people, the candles (age), the photo reel (3–6), the
letter, the song.
