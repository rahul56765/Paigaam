# Lajja — The Unrejectable Card

**Slug:** `unrejectable` · **Family:** `bfday` · **Category:** Love · **Price:** 0

"Lajja" (लज्जा) means shyness or modesty — the perfect name for a No button that shies away from every tap.

## The experience (ported 1:1 from t4-unrejectable.html)

The card opens on a blush-and-cream arch (your photo, or the inline SVG heart illustration) with a big romantic question, a coral Yes button, and a No button in a thin border.

Every **pointerdown / touchstart** on No triggers a dodge: the button teleports to a random position at least 18 px from every viewport edge and at least 14 px clear of the Yes button and the question text. If 200 random candidates all collide the button parks at the bottom-centre of the viewport.

After each dodge No shrinks slightly (capped at 0.8×) and Yes grows slightly (capped at 1.4×). The caption below No cycles through `'are you sure?' → 'really?' → 'the button is shy' → "it's decided"`.

After **5 attempts** (`MAX_DODGES = 5`) No gives up: opacity drops to 0.4 and the caption becomes the sender's give-up line ("fine, i'll just be here" by default). Tapping the tired button then hides the buttons and shows the soft no-message.

A **keyboard** Enter/Space (click event with `detail === 0`) skips the dodge and goes straight to give-up.

Tapping **Yes** fires an iOS-safe `navigator.vibrate([40, 60, 40])`, launches a 2-second confetti burst (70 particles — rect and circle shapes, the palette's five colours, gravity + air-drag physics), and after 1 000 ms swaps to the celebration screen. The celebration screen shows the celebration headline with an animated ❤️, the sender's celebration message, and the share hint.

## Reduced motion

`@media (prefers-reduced-motion: reduce)` collapses all CSS transitions to `none`. In JS: confetti is skipped entirely and the yes-delay collapses from 1 000 ms to 60 ms. The No button teleports instantly (no CSS transition on left/top).

## No-JS behaviour

Both screens are fully server-rendered. Without JS the card shows the question screen with both buttons visible but non-functional. The celebration screen is hidden via the `hidden` attribute and will not appear.

## Fields

| id | type | max | default |
|----|------|-----|---------|
| `senderName` | text | 40 | — (required) |
| `photo` | image | — | blank → SVG placeholder |
| `question` | text | 100 | Will you be my boyfriend, always? |
| `yesLabel` | text | 30 | Yes 💛 |
| `noLabel` | text | 20 | No |
| `giveUpCaption` | text | 60 | fine, i'll just be here |
| `noMessage` | text | 120 | that's okay. i'll ask again tomorrow 🌼 |
| `celebHeadline` | text | 60 | he said yes |
| `celebMessage` | textarea | 400 | you just made my whole year.… |
| `shareHint` | text | 80 | screenshot this & send it back to me 📸 |

## Routes

| Method | Path |
|--------|------|
| `GET` | `/create/unrejectable` |
| `GET` | `/unrejectable/demo` |
| `GET\|POST` | `/unrejectable/preview-frame` |
| `GET` | `/unrejectable/preview/:id` |
| `POST` | `/api/unrejectable/draft` |
| `POST` | `/api/unrejectable/upload?id=` |
| `POST` | `/api/unrejectable/publish` |
| `GET` | `/p/unrejectable-<18hex>` |

## Differences from the source file

- **Sandbox injections removed:** the `.ha-img-placeholder` style block, the `<!-- broken-img-handler -->` script (`__brokenImgHandler`), and the Escape → `postMessage({ type: 'close-fullscreen' })` script are stripped.
- **Class names namespaced** with `uc-` to avoid collisions with the shared engine stylesheet; element ids use `uc` prefix.
- **Photo field added:** the arch shows an uploaded photo when provided; the original SVG illustration shows when blank (including "your photo here" placeholder text).
- **Sender text via fields:** question, button labels, captions, celebration message and share hint are all sender-editable fields defaulting to the original design copy.
- **`giveUpCaption` from payload:** the JS reads the give-up caption from the `#ucPayload` JSON element so it reflects the sender's customisation.
- **No hardcoded `paigaam.cc`:** any branding uses site-relative links.
- **SVG gradient IDs** namespaced to `ucBgGrad` / `ucHeartGrad` to avoid SVG ID collisions with other templates on the same page.
