# Tohfa — Whole Website Gift

Boyfriend Day family, template 7. *Tohfa* (तोहफ़ा / تحفہ) means "a gift" — this one is a whole little website: a candy-striped cover with a bunny who asks to be tapped, a typed word-list, a flip-open polaroid gallery, an our-song card, three paper bouquets with hidden notes, and a final letter under floating hearts.

Built on the shared family engine (`lib/bfday/`, see `ENGINE.md`). This directory holds only the template: config, schema, renderer; its static assets are in `public/bfday-gift/`, and the design media (bunny, cat-and-bunny pair, stars, washi tape, three bouquets, the stripe tile, the OG card) is in `public/assets/bfday-gift/` — decoded at boot from the checksummed base64 sources in `assets/bfday-gift/` by `lib/bfdayGiftMedia.js` (same pattern as `lib/sawaalMedia.js`).

## The experience

- **Scene 1 · the cover.** Vertical candy stripes (pale blue `#cfe6f6` / white), the occasion line in raspberry Pacifico ("happy Boyfriend's Day"), "for *Aarav*" underneath, and the kawaii bunny with a pulsing "click me" tag. Dusty-pink stars frame the corners.
- **Tap.** The cover lifts away (750ms) and the gift scrolls in from the top.
- **Scene 2 · the word list.** "you're my…" — each line types itself, one at a time (260ms + i × 1150ms stagger), beside a polaroid-framed photo (or the bunny if no photo is uploaded).
- **Scene 3 · the gallery.** A swipeable carousel of polaroids (scroll-snap, dots); tapping one flips it in 3D to reveal the hidden caption on the blush back.
- **Scene 4 · our song.** An optional YouTube embed (any watch/share/shorts URL is reduced to a nocookie embed) above a fake player card: spinning disc, animated progress bar looping 3:33, and a heart button that fills and bursts.
- **Scene 5 · the bouquets.** "CLICK ON ANY BOUQUET TO OPEN" — three paper bouquets; tapping one pops its hidden note open (one at a time), dashed-border card with a close button.
- **Scene 6 · the final letter.** A blush section with the cat-and-bunny pair, the handwritten letter on a taped card, hearts floating up, and the end card: "made with paigaam.cc".
- **Reduced motion:** the cover swaps instantly, every line is shown already typed, the progress bar sits full, hearts are parked, flips and pops are instant cuts.
- **No JavaScript:** the cover is skipped and the whole page renders fully (`<noscript>` style); flips degrade to fronts.
- A busy flag ignores taps mid-cover-transition; tapping an opened cover is a no-op.
- The OG image is the first uploaded photo (words photo, else first gallery photo); with no uploads it is the designed 1200×630 card.

## Editable fields

Only `recipientName` and `senderName` are required. Everything else defaults to the original copy.

| Field | Type | Max | Default |
| --- | --- | --- | --- |
| `recipientName` | text | 40 | — (required) |
| `senderName` | text | 40 | — (required) |
| `occasionLine` | text | 60 | "happy Boyfriend’s Day" |
| `wordsHeading` | text | 60 | "you’re my…" |
| `words` | list of text, 1–8 | 60 each | the original six lines |
| `wordsPhoto` | image | — | blank → the bunny sits in the frame |
| `galleryHeading` | text | 60 | "a few of my favourites" |
| `photos` | list of shape, 1–6 | caption 80, hidden 120 | three designed polaroids |
| `songTitle` | text | 80 | "Tum Hi Ho" |
| `songArtist` | text | 80 | "the one that always reminds me of you" |
| `songUrl` | url | 300 | blank → no embed, just the player card |
| `bouquetHeading` | text | 80 | "click on any bouquet to open" |
| `bouquetNotes` | list of shape, exactly 3 | label 40, note 240 | the three designed notes |
| `letterText` | textarea | 600 | the original letter |
| `letterDate` | text | 40 | "october 3, always" |
| `bgmSong` | bgm (shared) | 300 | "Until I Found You" — Stephen Sanchez (`GxldQ9eX2wo`) |

`bgmSong` is the family-wide background-music field (lib/bfday/fields.BGM_FIELD): a YouTube link or a bare 11-char video id, or blank / "no song" for a quiet page. The engine normalises it to the bare id before render; the chip (bottom-right) loads nothing until the recipient taps — the tap swaps in a 1×1 youtube-nocookie iframe with autoplay=1, and the next tap pauses. No audio is ever hosted or bundled.

Newlines in the letter and the bouquet notes are kept (`<br>`). All sender text is HTML-escaped server-side; the YouTube URL is validated as a URL by the field engine and then reduced to a bare video id before it is ever embedded.

## Routes (mounted by the family engine)

- `/create/bfday-gift` — the wizard (intro, 6 steps, review) with live preview
- `/bfday-gift/demo` — `config.demo` (from Rahul)
- `/bfday-gift/preview-frame` — stateless live preview (GET `?d=` / POST JSON)
- `/bfday-gift/preview/:id` — owner-only draft preview
- `POST /api/bfday-gift/{draft,publish}` — `/p/bfday-gift-<18hex>`
- Photo uploads: `POST /api/bfday-gift/upload?id=<draft>` — same shared mechanism as the rest of the family

## Asset provenance

The design media was generated for this template (the room-posted originals were not readable at build time) in the Candy Scrapbook palette: kawaii bunny, cat-and-bunny pair, dusty-pink star scatter, pink polka-dot washi strip (drawn procedurally), three kawaii bouquets split from one illustration, the pale-blue stripe tile (drawn procedurally), and a 1200×630 OG card composed from all of them. Swap any of them by replacing the entry (and its sha256) in `lib/bfday/assets.js`.
