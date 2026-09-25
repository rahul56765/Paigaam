# Khulta — One Door Opens Every Day

Boyfriend Day family. *Khulta* (खुलता / کھلتا) — it opens. Seven little doors on a warm plaster wall; one more unlocks each day, with a surprise behind it. Day seven is the big reveal.

Built on the shared family engine (`lib/bfday/`). Static assets are in `public/khulta/` (`khulta.css`, `khulta.js`, `og.jpg`). The doors are pure CSS — nothing rasterised.

## Unlocking

- Client-side, from the creator's `startDate` (engine `date` field) in the chosen `timezone` (default **Asia/Kolkata**). Door *n* opens on start + (n − 1) days, at local midnight.
- The server renders the state as of the request; `khulta.js` recomputes it on the device and re-checks every minute.
- Locked doors say **"opens {weekday}"** (or "opens 3 Oct" when more than six days away) — never a midnight countdown. Tapping one shakes it: "Door 5 opens Sunday. No peeking!"
- Only today's door glows.

## Opening a door

A 120ms doorframe shadow lift, then a 700ms `rotateY` on the left hinge (`transform-origin: left`), then the surprise slides up in a sheet (Esc / × / backdrop closes it). Opened doors stay open, can be revisited, and fill the little heart on their lintel.

Opened doors are stored in `localStorage` per link: `paigaam:khulta:<slug>:opened`.

When all seven are open, the big heart fills and the reveal button appears — linking `revealUrl` (e.g. his Meri Duniya) if set, otherwise opening door seven.

## Door kinds

photo · mini letter · voice-note card (styled bubble + transcript) · "open when you miss me" · today's song (link) · one-line promise · the big reveal. A photo uploaded on a non-photo door still shows above its words.

## Previews

The wizard, demo and owner previews unlock every door, remember nothing, and show a "Preview as: All open · Day 1…7" strip.

## Reduced motion

No lift, no swing, no glow pulse — doors are simply open.
