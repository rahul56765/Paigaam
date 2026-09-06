# Saalgirah

A birthday Paigaam for someone you love: a 1:1 cinematic letter in four scenes.

1. **The envelope** — wax-sealed, addressed to them, sitting beside a small white bear. It does not open by itself.
2. **The reveal** — three lines, one at a time, in the sender's voice.
3. **The cake** — candles you have to blow out yourself; hearts scatter when you do.
4. **The last words** — the bear holds a heart, the declaration lands, and a signature fades in.

## What makes it unusual

- **No media files.** Every visual is hand-written inline SVG; every sound is synthesised in the browser with the Web Audio API (`public/saalgirah/audio.js`). The template ships no images, audio, video or font binaries — which also means nothing here can be corrupted by a text-only transfer.
- **Server-rendered copy.** All personalised text is in the HTML. If the script fails, the `<noscript>` path unstacks the scenes into a plain readable letter; screen readers and share previews get the real words.
- **Editable, with the original as the default.** Only the recipient's name is required. Every other field falls back to the copy the template was built with, so an untouched form still sends the original letter.

## Files

| Path | Role |
| --- | --- |
| `templates/saalgirah/config.js` | Template manifest (registered in `templates/registry.js`) |
| `templates/saalgirah/schema.js` | Whitelist validation for personalisation |
| `templates/saalgirah/render.js` | The four scenes as HTML |
| `lib/saalgirahRoutes.js` | Draft, preview and publish endpoints |
| `pages/saalgirahCreate.js` | The six-step generator |
| `public/saalgirah/letter.css` | The choreography, in CSS |
| `public/saalgirah/letter.js` | Scene state machine, timing, interactions |
| `public/saalgirah/audio.js` | Synthesised score and sound effects |
| `public/saalgirah/create.{css,js}` | The generator's styling and behaviour |

## Routes

| Route | Purpose |
| --- | --- |
| `GET /create/saalgirah` | The generator |
| `GET /saalgirah/demo` | Public demo (sample letter, preview mode) |
| `GET /saalgirah/preview/:id` | Owner-only draft preview |
| `GET /template-view/saalgirah` | Miniature used by the collection thumbnails |
| `GET /p/:slug` | The published letter |
| `POST /api/saalgirah/draft` | Create or update a draft (creator cookie) |
| `POST /api/saalgirah/publish` | Free instant publish |

The generic `/api/drafts`, `/api/free-publish` and `/api/render-preview` endpoints deliberately refuse Saalgirah letters — they must go through the template's own endpoints, which validate against the schema.

## Fields

`recipientName` (required, 60) · `senderName` (60) · `line1` `line2` `line3` (160 each) · `attentionLine` (160) · `wishLine` (90, defaults to `HAPPY BIRTHDAY, <NAME>.`) · `closingLine` (90, defaults to `I LOVE YOU.`) · `note` (400, the only field that may contain newlines)

## Ownership and publishing

A `paigaam_creator` cookie is hashed into `saalgirah_owners`; only that browser can preview, edit or publish its drafts, capped at 20 new letters per day. Publishing is free and instant, assigns `saalgirah-<18 hex>` and marks the paigaam published — and is refused when storage is not persistent (override with `SAALGIRAH_ALLOW_EPHEMERAL_PUBLISH=1`), so links never outlive the disk they live on.

## Choreography

The scene machine only toggles classes; CSS owns all motion. Every timing below is carried over from the original React/framer-motion source.

| Beat | ms |
| --- | --- |
| Envelope: flap opens, then hands over | 1300 (flap) / 1700 |
| Reveal: line 1 / 2 / 3 / hand-over | 1200 / 4200 / 7800 / 13200 |
| Birthday: cake / sparkle / attention / wish / make-a-wish | 800 / 1100 / 2200 / 5600 / 8800 |
| Candles blown → closing scene | 3400 |
| Closing: signature | 5000 |
| Scene exits (envelope / reveal / birthday / love) | 1000 / 1200 / 1300 / 1600 |

Music is unlocked inside the open-envelope click itself — browsers only allow audio to start during a real gesture, so it cannot wait for the flap animation. `prefers-reduced-motion` keeps every beat but removes all travel, and inside an iframe the letter plays itself silently, which is what the collection thumbnails show.

## Tests

```
npm run test:saalgirah
```

Boots a disposable server with an isolated `DATA_DIR`, runs 39 checks — ownership, CSRF, generic-endpoint bypasses, field validation, escaping, defaults, idempotent publishing, asset serving, and the whole scene machine driven against a stub DOM on a virtual clock — then restarts the process and asserts the published letter is still there.

Two checks the sandbox cannot run: real iOS/Android browsers, and audio actually sounding on a physical device. Worth doing once on a phone before this is promoted.
