# Mohar — Sealed With A Kiss

Boyfriend Day family, template 1. *Mohar* (मोहर / مہر) is a seal: a kraft envelope closed with wax pressed with the sender's initial. One tap breaks it, the letter rises out, and the handwritten letter is revealed line by line.

Built on the shared family engine (`lib/bfday/`, see `ENGINE.md`). This directory holds only the template: config, schema, renderer; its static assets are in `public/sealed-with-a-kiss/`.

## The experience (ported 1:1 from the original single-file design)

- **Screen 1 · the envelope.** A kraft envelope on a paper-grain ground (inline SVG turbulence, no assets), a wax seal with the sender's initial, "from *Rahul*" in small caps, and a pulsing "tap to open".
- **Tap.** The flap rotates open (700ms), the letter slides up out of the envelope (800ms, 300ms delay); at 1300ms the envelope fades and the letter screen shows.
- **Screen 2 · the letter.** The salutation, each paragraph and the sign-off fade up one after another (`250ms + i × 600ms`), then the ink flourish draws itself under the sign-off.
- **Read it again** folds everything back into the envelope and returns focus to it (750ms).
- **Reduced motion:** every transition collapses to an instant cut; the waits drop to 60ms; the hint stops pulsing.
- **No JavaScript:** the envelope is skipped and the letter is shown whole (`<noscript>` style).
- A busy flag ignores taps mid-animation; tapping an already-open envelope is a no-op.

## Editable fields

Only `senderName` is required. Everything else defaults to the original copy.

| Field | Type | Max | Default |
| --- | --- | --- | --- |
| `senderName` | text | 40 | — (required) |
| `sealInitial` | text | 2 | first letter of `senderName` (upper-cased) |
| `salutation` | text | 60 | "My dearest," |
| `paragraphs` | list of textarea, 1–8 | 600 each | the original four paragraphs |
| `closing` | text | 40 | "Forever yours," |
| `signature` | text | 60 | "— your favourite person" |
| `dateLine` | text | 40 | "October 3" |

Newlines inside a paragraph are kept (`<br>`). All sender text is HTML-escaped server-side; the seal initial is rendered through `data-initial` + CSS `attr()`, never as markup.

## Routes (mounted by the family engine)

- `/create/sealed-with-a-kiss` — the wizard (intro, 3 steps, review) with live preview
- `/sealed-with-a-kiss/demo` — `config.demo` (from Rahul)
- `/sealed-with-a-kiss/preview-frame` — stateless live preview (GET `?d=` / POST JSON)
- `/sealed-with-a-kiss/preview/:id` — owner-only draft preview
- `POST /api/sealed-with-a-kiss/{draft,publish}` — `/p/sealed-with-a-kiss-<18hex>`

## Differences from the source file

- The seal's hardcoded "R" is now the sender's initial.
- The hosting sandbox's injected scripts (Escape → `postMessage('close-fullscreen')`, the broken-image retry handler and its placeholder CSS) are not part of the design and were dropped.
- The shared family head adds OG/canonical/noindex meta and a "Preview" chip in previews.
