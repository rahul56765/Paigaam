# Birthday Paigaam

A secret birthday surprise behind a passcode — a soft, handmade "love-letter scrapbook" in seven screens:

1. **Unlock** — "unlock *for surprise*", a scalloped photo frame, a party-hat cat sticker and a wavy keypad. Wrong codes shake; the right one bursts into hearts.
2. **Wanna see it?** — a bunny peeks over the card. Every **NO** opens the "How dare you click NO!" screen (a huffy bear and a sobbing bunny), makes **YES** bigger and the next line funnier; after the last line NO turns into YES.
3. **The envelope** — the wax heart seal cracks, the flap opens in 3D, the letter slides out, unfolds and types itself, signed in handwriting. *Read again* replays it.
4. **Voice note** — a cassette whose reels spin while a live waveform follows the voice. Skipped when there is no recording.
5. **Our song** — a record player (spinning vinyl, tonearm, floating notes). Never autoplays. Without an upload, a public-domain *Happy Birthday* music box plays. The song ducks automatically while the voice note plays, and keeps playing (mini disc, bottom-right) while they look around.
6. **Scrapbook** — polaroids with washi tape, stickers and doodles: tap to flip (secret message on the back), hold & drag to rearrange, 🔍 to zoom and swipe through; sticky notes that pop in; a lined page of reasons.
7. **Grand finale** — typewriter *Happy Birthday, NAME!*, rising balloons, a confetti loop, a cake whose candles you tap out (then fireworks), an optional countdown, *Replay surprise* and *Send a thank-you* on WhatsApp.

Behind every screen: drifting pastel stripes, hearts that float up and pop into sparkles, twinkling stars and glitter, the odd balloon or ribbon, and a heart burst wherever you tap. A ✨ button turns motion off (and it starts off for anyone whose device asks for reduced motion); a 🔈 button mutes sound effects.

## Original by construction

Every character and object is inline SVG drawn for this template (`art.js`); every sound effect is synthesised with the Web Audio API (`public/birthday-paigaam/sfx.js`). Demo-only media (six illustrated polaroids, a portrait, the share card and a short demo voice note) were generated for Paigaam and ship as checksummed base64 in `assets/birthday-paigaam/`, restored at boot by `lib/birthdayPaigaamMedia.js`. Fonts are Google Fonts (OFL). Nothing is copied from the reference video.

## Files

| Path | Role |
| --- | --- |
| `templates/birthday-paigaam/config.js` | Manifest (registered in `templates/registry.js`) |
| `templates/birthday-paigaam/defaults.js` | The designed copy, palettes, fonts, screen list — **edit defaults here** |
| `templates/birthday-paigaam/schema.js` | Whitelist validation |
| `templates/birthday-paigaam/art.js` | The SVG art kit |
| `templates/birthday-paigaam/render.js` | The seven screens as HTML |
| `lib/birthdayPaigaamRoutes.js` | Draft, upload, media, preview, demo, publish |
| `pages/birthdayPaigaamCreate.js` + `public/birthday-paigaam/create.{js,css}` | The nine-step wizard |
| `public/birthday-paigaam/experience.{css,js}`, `sfx.js` | Look, behaviour, sound |

## Routes

| Route | Purpose |
| --- | --- |
| `GET /create/birthday-paigaam` | The wizard |
| `GET /birthday-paigaam/demo` | Public demo (code **1234**). `?skip=1` skips the lock, `?screen=letter` opens a screen |
| `GET /birthday-paigaam/preview/:id` | Owner-only preview — passcode skipped, jump bar to every screen (`?lock=1` keeps the lock) |
| `POST /birthday-paigaam/preview-frame` | Stateless live preview for the wizard pane |
| `GET /birthday-paigaam/media/:file` | An upload — public once published, otherwise owner/admin only |
| `POST /api/birthday-paigaam/draft` · `/upload?id=&kind=photo\|voice\|song` · `/publish` | Wizard API |
| `GET /p/birthday-paigaam-<18 hex>` | The published surprise |

## Personalisation (all optional except their name)

Names, age, birthday date, main photo · passcode (4 digits, default 1234) + hint · the question, YES/NO/try-again labels, the NO lines (≤10) · letter greeting, letter (≤3000 chars), sign-off · voice note (upload or record in the browser, ≤10 MB) + title · song (≤15 MB) + title/artist · up to 40 polaroids with caption + secret back message · sticky notes (≤16), reasons (≤20) and section titles · finale line, candles (1–9), WhatsApp number + thank-you text · palette (4 presets or 5 colour pickers), font set (Dreamy / Storybook / Vintage), screens on/off, the "Made with love by Paigaam" footer.

Placeholders anywhere in the copy: **`[NAME]`** (them), **`[SENDER]`** (you), **`[AGE]`**.

The passcode is a playful lock, not a vault: the page stores only a salted hash of it, but the letter is in the page source for screen readers and link previews.

## Storage

Uploads live in `DATA_DIR/birthday-paigaam-uploads/` (tables `bp_owners`, `bp_uploads`). Photos are re-encoded in the browser (≤1600px JPEG) and every file is checked by its bytes. Unused uploads are swept on save/publish; the total pool is capped by `BP_UPLOAD_POOL_MB` (default 2048). Publishing refuses on ephemeral storage unless `BIRTHDAY_PAIGAAM_ALLOW_EPHEMERAL_PUBLISH=1`.

## Tests

```
npm run test:birthday-paigaam
```

Disposable server + isolated `DATA_DIR`: rendering, escaping, `[NAME]` filling, validation, CSRF, ownership, byte-sniffed uploads, media privacy before/after publish, range requests, screen toggles, generic-endpoint refusals, idempotent publish, and a restart to prove published pages survive. Browser interaction checks (all screens on 390/820/1440 px, no horizontal overflow) were run with Playwright during development.
