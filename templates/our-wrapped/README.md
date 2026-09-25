# Naghma — Our Wrapped

Boyfriend Day family · slug `our-wrapped`

A cinematic night-mode year-in-review, delivered as a vertical scroll-snap experience. Each screen fades in on its own and counts up its number live.

## The experience

| Screen | Content |
|--------|---------|
| 1 · Title | Eyebrow "a year of us" · "Our Wrapped [year]" · days-together count-up · caption |
| 2…N+1 · Moments | One screen per moment: inline-SVG illustration · big count-up number · unit label · caption |
| N+2 · Song | Vinyl album-art placeholder · song title · artist · optional play link · caption |
| N+3 · Closing | Handwritten closing note · mini recap card (names, days, start date) · Paigaam credit |

Dots on the right edge are clickable; a "skip to the end →" button on the title screen jumps straight to the closing.

## Animations

- **Count-up**: easeOutCubic over 1600ms, triggered once per `.stat-num` element on first intersection (≥60% visible).
- **Photo reveal**: CSS `opacity` + `scale(0.82 → 1)` over 0.7s on `.screen.active`.
- **Text rise**: CSS `translateY(18px → 0)` + opacity, 0.7s, staggered with `.d1/.d2/.d3` delays.
- **Scroll snap**: `scroll-snap-type: y mandatory`, `scroll-snap-stop: always`.

## Reduced motion

- `html { scroll-behavior: auto }` and `.deck { scroll-behavior: auto }`.
- Count-up jumps to the final value instantly.
- All CSS transitions (`rise`, `photo`) are only active under `(prefers-reduced-motion: no-preference)`.

## No-JS fallback

All visible text is server-rendered. Without JS: screens render at their final opacity/position, dots are not shown, count-up shows the final number (from `data-count`).

## Fields

| id | type | max | default |
|----|------|-----|---------|
| senderName | text | 40 | — (required) |
| recipientName | text | 40 | — (required) |
| year | text | 10 | "2026" |
| daysTogether | number | 99999 | 1247 |
| titleCaption | text | 80 | "every single one, yours." |
| moments | list | 8 items | 5 default moments (count/unit/caption) |
| songTitle | text | 80 | "Tum Se Hi" |
| songArtist | text | 80 | "our forever soundtrack" |
| songUrl | url | 500 | "" (hidden when blank) |
| songCaption | text | 120 | "the song that knows exactly where we are." |
| closingNote | textarea | 300 | "thank you for being…" |
| startDate | text | 50 | "14 Feb 2023" |

## Routes

```
GET  /create/our-wrapped              wizard
GET  /our-wrapped/demo                demo page
POST /api/our-wrapped/draft           save draft
POST /api/our-wrapped/publish         publish → /p/our-wrapped-<18hex>
```

## Differences from the source file

- `t5-wrapped.html` hardcoded six stat screens; this template uses a sender-editable list of 1–8 moments. The five SVG illustrations cycle for any count.
- The year "2026" in the title is now a field defaulting to "2026".
- The names "Aarav" and "Meera" on the closing card come from `senderName`/`recipientName` fields.
- The `data-count` numbers and their labels/captions are all sender-editable (list fields).
- `href="#song-link"` placeholder removed; the play button only renders when `songUrl` is a valid URL.
- "paigaam.cc" in the footer replaced with a site-relative link to `/`.
- Hosting-sandbox injections stripped: `.ha-img-placeholder` style block, `__brokenImgHandler` script, and `close-fullscreen` postMessage listener.
