# Raaz — The Password Letter

Boyfriend Day family. *Raaz* (राज़ / راز) — a secret. The link opens on a locked
near-black screen with one underlined password field: "Only he knows the
password." The right answer plays a small ceremony — a self-ticking "I'm not a
robot" captcha, a notification chip sliding down, the botanical wax seal
cracking off the ivory envelope, the retro gift box rattling and popping open
to "GIFT FOR YOU!" — and then the letter on paper grain, with the sign-off
and an optional song.

Built on the shared family engine (`lib/bfday/`). Static front-end files are
in `public/raaz/` (`raaz.css`, `raaz.js`); the raster art (seal, box in 3
states, envelope, confetti ring, paper-grain tile, og.jpg) lives in
`public/assets/raaz/`, decoded at boot from `lib/bfday/assets.js`.

## The gate

- Client-side only. The page carries a **salted SHA-256** of the password —
  the salt is the published link's slug (`raaz:<slug>`, or `raaz:demo` for the
  demo and previews) — never the answer itself.
- Comparison is case-insensitive and trims whitespace.
- Wrong guess → the field shakes 400ms and the hint line crossfades to the
  next reply, cycling through all hints before repeating.
- Hints ship base64-wrapped in the JSON payload and are decoded **only after
  the first wrong guess**, so they aren't sitting in the DOM before then.
- It is a gesture gate, not security: a determined person reading the source
  can defeat it. Accepted by design.

## The beats

1. **Lock** — near-black `#0F0D0C`, nothing but the line and the underlined
   ivory field. First paint shows nothing else.
2. **Unlock** — on the right answer the captcha card ticks itself (~500ms
   stroke draw), holds ~700ms, then the chip slides down from the top edge
   (300ms `cubic-bezier(0.22, 1, 0.36, 1)`). Timed, not skippable (~2.5s).
3. **Envelope** — the seal cracks/rotates off (200ms), the flap opens, the
   envelope slides down-fade as the box scales in from 0.6 (back easing,
   500ms).
4. **Gift** — tap: closed → shake (3 quick toggles, ~600ms) → open burst +
   confetti ring composited *over* the box + "GIFT FOR YOU!" in Fraunces 900,
   letters staggering up 40ms apart in crimson `#B3402F`.
5. **Letter** — ivory paper-grain tile (`background-repeat`), Caveat body,
   sign-off, and the song card (YouTube embeds inline; Spotify/Apple get a
   branded "Play in <service>" pill — same behaviour as Naghma).

## Previews

The wizard, demo and owner previews show the correct password under the lock
so the sender can test the whole ceremony. Every field edit reflects
instantly, gate included.

## Palette

near-black ink `#0F0D0C` · ivory paper `#F3EDE2` · plum-black `#231B1F` ·
crimson accent `#B3402F` (errors, gift, headline only). Strictly no gold.

## Reduced motion

The shake, tick draw, chip slide, seal crack, box scale-in, confetti and
letter stagger all collapse to instant state changes.
