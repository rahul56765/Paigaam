# Lavender Bloom Surprise

A "Love / Miss You" Paigaam: a sealed envelope, a rigged game of tic-tac-toe the
visitor always wins, a gift that bursts into confetti, and a lavender sprout that
grows and blooms into a personal message.

- Slug: `lavender-tic-tac-toe-bloom`
- Price: free (₹0) — instant self-publish + branded QR, like Saalgirah
- Zero binary assets: every visual is inline SVG/CSS; confetti is a hand-rolled
  canvas simulation. Nothing enters `public/` except text files.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /create/lavender-tic-tac-toe-bloom` | The five-step generator |
| `GET /lavender-bloom/demo` | The designed default, `isPreview` |
| `GET /lavender-bloom/preview/:id` | Owner-cookie gated preview |
| `POST /api/lavender-bloom/draft` | Create/update a draft |
| `POST /api/lavender-bloom/publish` | Publish (`/p/lavender-<18hex>`) |

The generic `/api/drafts`, `/api/free-publish` and `/api/render-preview` refuse
this slug (`403 use_template_endpoint`); `/preview/:id` redirects to the
scoped preview.

## Editable fields

| Field | Required | Default |
| --- | --- | --- |
| `recipientName` | yes | — |
| `senderName` | no | unsigned |
| `title` | no | `For You!` |
| `message` | no | `Because you make every day as bright as a blooming flower…` |
| `flowerColor` | no | `lavender` (one of `lavender`, `rose`, `sunbeam`) |

## The rig

The game is scripted so the visitor always wins through the first column
(cells 0-3-6): the bot plays random open cells but never plays cells 0, 3 or 6
itself, and never completes its own line. If the visitor somehow wanders off the
column, the game guides them back (and, as an absolute guarantee, force-wins
after their fourth move). A win draws a blue line down column one and, 800ms
later, the gift arrives.

## Release checklist

1. `npm run test:lavender`
2. Real iOS/Android phone pass (this environment cannot do it)
3. Merge the draft PR; Railway auto-deploys on push to `main`

No ffmpeg, no media restore, no build step — merging is safe as-is.
