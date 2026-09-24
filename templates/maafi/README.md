# Maafi — the apology that refuses to be refused

A port of [ThisWasAryan/interactive-apology-page](https://github.com/ThisWasAryan/interactive-apology-page) (MIT) as a native, editable Paigaam template.

## The mechanic (ported 1:1)

- The **No** button runs away: it teleports to a random spot inside the button tray on every approach (hover on desktop, tap/click everywhere), with anti-overlap against the Yes button (30px padding, 50 placement attempts).
- It **shrinks** with every attempt: `scale = max(0.3, 1 − attempts × 0.1)`.
- The **Yes** button **grows** once the resistance passes three attempts: `scale = 1.1 + attempts × 0.05`, re-checked every 100ms — exactly the original's interval.
- A **pity ladder** of 15 pleas advances on every dodge ("I promise I'll never do it again 😢💕" → "I'll never let you down again, I promise 💍❤️"), cycling if they somehow outlast it.
- An **attempt counter** climbs three tiers (≤5, ≤10, 10+).
- **Yes** celebrates: the sender's celebration message, heart rain (30 hearts at 150ms intervals), bouncing emoji, and the background gradient flips to pure pink.

Everything visual is CSS/JS — animated gradient, floating background hearts, sparkles, heart rain. Zero media assets, zero library dependencies.

## Editable fields

Only the recipient's name is required. Every field defaults to the original copy:

| Field | Default |
| --- | --- |
| `recipientName` | — (required) |
| `senderName` | — (signature) |
| `headline` | "I'm really sorry ❤️" |
| `yesLabel` | "Okay baby, I forgive you 💖" |
| `noLabel` | "No, I'm still angry 😠" |
| `celebration` | "Yay! You forgave me! 😍💖🥳" |

The sender's `headline` is always set with `textContent` (never markup). The pity ladder lines are the template's own fixed copy — part of the design, not editable, exactly like Valentine's plea ladder.

## Routes

- `/create/maafi` — the six-field generator (five steps) with a **live preview pane** that updates as the sender types (debounced 350ms, rendered by the stateless endpoint below — no saving needed to see it).
- `/maafi/demo` — sample apology (Meher ← Rahul).
- `/maafi/preview-frame?d=<json>` — **stateless** live-preview renderer: read-only GET, renders whatever is in `d` (validated best-effort, defaults on any error), nothing persisted. Rate-limited like the POSTs.
- `/maafi/preview/:id` — owner-only draft preview.
- `/p/maafi-<18hex>` — the published apology.
- `POST /api/maafi/draft`, `POST /api/maafi/publish` — same creator-cookie ownership model as Valentine/Lavender/Love (`maafi_owners` table). Publish is free and instant; the ephemeral-storage guard (`MAAFI_ALLOW_EPHEMERAL_PUBLISH`) matches the other free templates.

## Wiring

`templates/registry.js` (first in collection), `lib/renderPaigaam.js` dispatch, `lib/templateView.js` demo sample, `pages/templateDetail.js` iframe + demo button, `server.js` handle-mount + `/preview/:id` redirect + generic endpoint refusals (`/api/drafts`, `/api/free-publish`, `/api/render-preview`, `/go/whatsapp`).

## Tests

`node scripts/test-maafi.js` boots an isolated server and runs `tests/maafi-api.test.js` + `tests/maafi-dom.test.js`:

- API: ownership, CSRF, generic-endpoint bypass attempts, validation shapes/lengths/control-chars, idempotent publish, escape audit (no unescaped sender text), live-preview endpoint (renders typed data, defaults on garbage, rate-limited), full process-restart persistence.
- DOM (stub DOM on a virtual clock): the dodge loop — 25 attempts, No never escapes the tray, scale floors at 0.3, Yes grows after 3, ladder cycles 15 pleas, counter tiers, celebration fires once and mutes further No presses.
