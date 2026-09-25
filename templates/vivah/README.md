# Vivah — Shubh Vivah, a divine-sky wedding invitation

Boyfriend Day family (the shared engine in `lib/bfday/`). *Vivah* (विवाह) — the wedding. A single scrolling invitation: a golden divine sky with a henna hand ("Save the Date"), the families' blessings under a toran garland, the ask, the three ceremonies, a framed photograph, a live countdown to the Muhurtham, and the venue with RSVP — closed with शुभ विवाह.

First **Wedding**-category member of the family. Free, no price.

## Static assets

In `public/vivah/` — `vivah.css`, `vivah.js`, and six images written at boot by `lib/bfday/assets.js` (the git pipeline this repo deploys through is text-only): `hero.jpg` (the golden sky, 197KB), `toran.jpg` (the garland, 135KB), `petal-tl.jpg` / `petal-br.jpg` (rose-petal corners, ~30KB), `couple.jpg` (the demo photograph, 283KB), `og.jpg` (the share card).

The toran and petal artwork carry baked-in white mats — the Blessings and Invitation sections are deliberately pure white so the mats sit flush. The ivory canvas continues everywhere else.

## The seven beats

1. **Hero** — full-viewport sky, a bottom scrim (`rgba(94,58,28,.55)` fading out at 40% height) seats the ivory type; the sun-glow breathes on an 8s loop.
2. **Blessings** — the toran across the top edge, then two gold-bordered parents' cards.
3. **Invitation** — "Together with our families' blessings…" with rose-petal corners.
4. **Events** — up to three ceremony cards (Mehendi · Muhurtham · Reception), each with an inline-SVG motif (henna hand / havan flame / rings, keyed by name) and an Add-to-calendar link (a Google Calendar template URL — no API, no auth).
5. **Couple** — one framed photo at −1.5°; the watercolor couple holds the frame until the creator uploads their own.
6. **Countdown** — "Our New Beginning Starts In": days · hours · minutes · seconds, tabular numerals, ticking to `countdownDate` or the Muhurtham (or the first ceremony).
7. **Close** — venue, a Maps link, RSVP on WhatsApp, and शुभ विवाह.

## Music

The family's shared background-music chip (`bgmSong`, last wizard step): a YouTube link plays tap-to-start, nothing loads until a guest taps. The demo carries Ustad Bismillah Khan's *Shaadi Ki Shehnai*.

## Motion budget

Two continuous loops only: the hero glow and the drifting petals behind the ceremony stack. Everything else is a scroll-triggered fade-up (`IntersectionObserver`). `prefers-reduced-motion` stills both loops and shows every section immediately.

## Wizard

Five steps of its own (the engine allows seven; the shared music field lands in a final step): the couple, the blessings, the ceremonies (+ when the countdown ends), the photograph, venue & RSVP. The countdown target defaults to the Muhurtham so most creators never touch it.
