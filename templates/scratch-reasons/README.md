# Kashf — Reasons I Love You (Scratch Edition)

**Slug:** `scratch-reasons` · **Family:** `bfday` · **Category:** Love · **Price:** 0

## What the experience does

Seven gold-foil scratch cards, one per reason, stacked in a scrollable feed. The recipient drags a finger or mouse across the gold-foil layer to reveal the reason beneath.

**Mechanics (ported 1:1 from `t3-scratch.html`):**

- Each card's canvas is painted with a brushed-gold gradient (diagonal streaks + noise dots) once per render, and again on replay.
- Scratch erases foil with `destination-out` compositing. Transparency is sampled every 10th `pointermove` and on every `pointerup`.
- **55 % clear threshold** — when 55 % of pixels are transparent the canvas fades out with `opacity: 0` + `pointer-events: none` (0.45s transition).
- A **card pop** animation and 6–8 gold sparkle particles burst from the card on each user-initiated reveal.
- The **counter** in the sticky header ticks up with a spring bounce on each reveal.
- A **"reveal all"** button fades in after the 2nd card is revealed; it sequentially clears remaining cards at 300 ms stagger (no pop, no sparkles).
- Once all cards are cleared the **finale section** scrolls into view (smooth scroll) and `display: flex` with a fade-up animation.
- **"Scratch them again"** resets all state in place (repaints foil, shows ghosts, resets counter) without reloading.
- `touch-action: none` is applied **only** to the canvas element so page scroll works everywhere else.

## Reduced-motion behaviour

All `@media (prefers-reduced-motion: reduce)` rules are preserved verbatim from the source:

- `.card.pop`, `.counter.bounce`, `.finale.show` — animations removed.
- `.spark` — `display: none !important` (sparkle particles never created in REDUCED mode either).
- `canvas.foil` — `transition: none` (instant fade instead of 0.45s).
- `.reveal-all-btn` — `transition: none`.
- Scroll calls use `behavior: 'auto'` instead of `'smooth'`.

## No-JS behaviour

A `<noscript>` rule hides `.ghost` elements and `reveal-all-row`, and restores pointer-events on `.card-inner`. All reason text is server-rendered in the HTML and readable without JS.

## Field table

| id           | type     | max / range | default |
|--------------|----------|-------------|---------|
| `senderName` | text     | 40 chars    | (required, no default) |
| `reasons`    | list     | 3–12 items, each 140 chars | 7 original reasons from the source design |
| `finaleText` | textarea | 300 chars   | `"and about a million more reasons…\nhappy boyfriend day ❤️"` |

`senderName` signs the finale letter (`— Priya`). `reasons` drives the card count — the header, counter total, and "REASON N OF M" labels all update dynamically. A list with fewer than 3 valid rows renders the full 7-reason default.

## Routes

| Route | Description |
|-------|-------------|
| `GET /create/scratch-reasons` | Wizard (3 steps) |
| `GET /scratch-reasons/demo` | Live demo with default data |
| `GET|POST /scratch-reasons/preview-frame` | Wizard live-preview iframe |
| `POST /api/scratch-reasons/draft` | Save draft |
| `POST /api/scratch-reasons/publish` | Publish to `/p/scratch-reasons-<18hex>` |

## Differences from the source file (`t3-scratch.html`)

1. **Server-rendered cards.** The source builds cards entirely in JS (`buildCards()` + `innerHTML`). The ported version server-renders card content in `render.js`; `scratch.js` only appends the `<canvas>` overlay and attaches pointer events. Reason text uses `escape()` in the renderer and is never written via `innerHTML` in JS.
2. **Dynamic count.** "7 reasons." and "REASON i OF 7" are replaced by `${d.reasons.length}` and `${i + 1} OF ${count}` — the template adapts to 3–12 reasons.
3. **Counter uses DOM manipulation** (not `innerHTML`) to update the `<b>` count.
4. **No `escapeHTML()` in JS.** Not needed: all sender text is server-rendered.
5. **`buildCards()` removed.** Replaced by `initCards()` which queries `.card` elements already in the DOM.
6. **Sandbox injections stripped:** the `.ha-img-placeholder` `<style>`, the `__brokenImgHandler` script, and the Escape → `postMessage({ type: 'close-fullscreen' })` listener.
7. **Finale sign-off.** The source has a static `"happy boyfriend day ❤️"` string. The ported version uses a `finaleText` textarea field (default = that copy) plus a `finale-from` paragraph showing `— ${senderName}`.
8. **No hardcoded `paigaam.cc`.**
