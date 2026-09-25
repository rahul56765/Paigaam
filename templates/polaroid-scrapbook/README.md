# Tasveer — Our Little Scrapbook

**Boyfriend Day family · slug `polaroid-scrapbook`**

## What it does

A scroll-through scrapbook of tilted polaroid photos. Features:

- **Scroll reveal** — each polaroid fades and slides into view via IntersectionObserver (threshold 0.15, rootMargin `0px 0px -40px 0px`) as the reader scrolls down.
- **Tilt pattern** — polaroids alternate between −4° and +3° (`--tilt` CSS custom property set per-element), creating the feel of photos arranged by hand.
- **Washi-tape corners** — each polaroid has top-left and top-right CSS tape pieces with three colour tints (`tint-a`, `tint-b`, `tint-c`) cycling across photos.
- **Heart doodle** — an SVG path between polaroids 2 and 3 that draws itself via `strokeDashoffset` as the reader scrolls past it (progress: 0 when polaroid 2's centre passes the viewport bottom → 1 when polaroid 3's centre reaches mid-viewport). rAF-throttled on scroll.
- **Lightbox** — tapping any polaroid opens it full-size in a fixed overlay. Close with the × button, backdrop tap or the Escape key. Focus returns to the last-focused element on close.
- **Note card** — a tilted (+3°) handwritten card closes the scrapbook with a short note and a date line.
- **Photo placeholders** — when the sender leaves a photo slot blank, the script generates an inline-SVG data URI (600×600, gradient background + a small doodle) so every photo slot looks intentional.

Ported 1:1 from `t2-polaroid.html`. Timings, thresholds and edge-cases are unchanged.

## Reduced-motion behaviour

`@media (prefers-reduced-motion: reduce)` in `polaroid.css`:
- All `.reveal` elements get `opacity: 1` and `transform: rotate(var(--tilt))` instantly; `transition: none`.
- Polaroid `:active` scale transition is suppressed.

In `polaroid.js`:
- If `matchMedia('prefers-reduced-motion: reduce').matches`, all `.reveal` elements receive the `shown` class immediately (no IntersectionObserver).
- The heart doodle is drawn immediately (`strokeDashoffset = 0`) — no scroll listener.

## No-JS behaviour

Without JavaScript: photos remain blank (the `photo-area` background `#f4ece4` shows). Captions and dates are server-rendered and visible. The lightbox is inert. Scroll reveal classes are never added so photos remain at opacity 0 — add a `<noscript>` rule if no-JS support is critical (not done here to keep the port minimal).

## Field table

| id | type | max | default |
| --- | --- | --- | --- |
| `senderName` | `text` | 40 | *(required)* |
| `scrapbookTitle` | `text` | 60 | `our little scrapbook` |
| `scrapbookSub` | `text` | 60 | `a keepsake, just for you` |
| `photos` | `list` (1–8 items) | — | 5 default polaroids |
| `photos[].photo` | `image` | — | *(blank → placeholder art)* |
| `photos[].caption` | `text` | 80 | *(required in each row)* |
| `photos[].date` | `text` | 40 | *(optional)* |
| `noteText` | `text` | 80 | `happy boyfriend day, from me` |
| `noteDate` | `text` | 60 | `always & then some` |

## Routes

| Method | Path | What |
| --- | --- | --- |
| GET | `/create/polaroid-scrapbook` | wizard |
| GET | `/polaroid-scrapbook/demo` | demo render |
| GET/POST | `/polaroid-scrapbook/preview-frame` | live preview iframe |
| POST | `/api/polaroid-scrapbook/draft` | save draft |
| POST | `/api/polaroid-scrapbook/upload?id=` | upload a photo |
| POST | `/api/polaroid-scrapbook/publish` | publish |
| GET | `/p/polaroid-scrapbook-<18hex>` | published page |

## Differences from the source file

- Hosting-sandbox injections stripped: the `.ha-img-placeholder` `<style>` block, the `__brokenImgHandler` script, and the `Escape → postMessage({ type: 'close-fullscreen' })` script.
- Footer copy "made with love · keep scrolling keepsakes" → `made with love · <a href="/">Paigaam</a>`.
- Photo data (src, caption, date) is read from `#psPayload` JSON instead of being hardcoded in the script; server-renders captions and dates into the HTML.
- Tilt and margin-top are expressed as inline styles (`--tilt` CSS var + `margin-top`) rather than `.p1`–`.p5` classes, so any number of polaroids renders correctly.
- Heart doodle falls back to "drawn immediately" when there are fewer than 3 polaroids (instead of staying invisible).
- Lightbox bails early if any of its five DOM elements are missing (guard for broken pages).
