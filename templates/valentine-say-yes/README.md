# Valentine "Say Yes"

The question that cannot be refused — a Paigaam port of
[CodeKageHQ/Ask-out-your-Valentine](https://github.com/CodeKageHQ/Ask-out-your-Valentine) (MIT).

One page, one question. Every **No** swaps the kitten GIF for a sadder one,
grows the **Yes** button by 35px, and escalates the plea — *Are you sure? →
Pookie please → Don't do this to me :( → You're breaking my heart → I'm gonna
cry…*. **Yes** earns the celebration GIF, the sender's message and a burst of
heart confetti. Five clicks of resistance, then the decision makes itself.

## Routes

| Route | What |
|---|---|
| `/create/valentine-say-yes` | six-step generator (draft → preview → publish) |
| `/valentine-say-yes/demo` | sample question (Meher → Rahul) |
| `/valentine-say-yes/preview/:id` | owner-only live preview |
| `/p/valentine-<18hex>` | the published question |
| `POST /api/valentine-say-yes/draft` | save draft (creator-cookie ownership) |
| `POST /api/valentine-say-yes/publish` | free instant publish |

## Editable fields

`recipientName` (required), `senderName`, `question`, `yesLabel`, `noLabel`
(the No button's first word — the plea ladder after it is fixed),
`celebration`. Everything defaults to the original copy, so an untouched form
still asks the designed question.

## Mechanics (ported 1:1)

- `GROWTH_PER_CLICK = 35`, `FONT_GROWTH_PER_CLICK = 25`, `MAX_NO_CLICKS = 5`
- the same seven GIFs in the same order, same alt texts, same plea ladder
- the same heart path (`M12 21.35l-1.45-1.32C5.4…`) drawn as confetti —
  re-implemented as a hand-rolled canvas simulation at scalar 2/3/4
  (the original used the canvas-confetti CDN)

Differences from the original, all deliberate: no Tailwind (server-rendered
CSS), no canvas-confetti dependency, the copy is personalisable, and the
recipient's name is woven into the topline.

## Media

The seven kitten GIFs live as checksummed base64 in `assets/valentine/`
(1.2MB raw each is too big to push through the GitHub MCP bridge, and binary
files get U+FFFD-corrupted through JSON pushes — see the project lessons).
`lib/valentineMedia.js` boot-heals them into
`public/valentine-say-yes/media/` and refuses to boot on a checksum mismatch.
Never `git add` files under `public/valentine-say-yes/media/` — they are
build artifacts, exactly like `public/ganapati/media/`.

## Tests

`npm run test:valentine` (wired into `npm test`) runs `tests/valentine-api.test.js`
(ownership, CSRF, generic-endpoint refusals, validation, escaping, idempotent
publish, restart persistence) and `tests/valentine-dom.test.js` (the full
no-click ladder and the yes celebration against a stub DOM on a virtual clock).
