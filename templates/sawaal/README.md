'use strict';
# Sawaal — the date questionnaire

A playable, multi-scene date invitation, ported 1:1 from
[ShamsAli-fathi/ask-me-on-a-date](https://github.com/ShamsAli-fathi/ask-me-on-a-date) (MIT).

## The flow (eight scenes)

1. **The invitation** — Yes / Yes, of course (both doors lead forward, naturally)
2. **Do you like me?!?!** — "Not really." gets the sad reframe (image swap + the music stops); "Sure!" moves on
3. **The vibe** — Dinner & Chill / Coffee & Walking, or type your own idea (240 chars)
4. **Pick a day** — a day picker built from the sender's real availability
5. **A quick detour** — a four-question quiz, scored server-side (0–4)
6. **The score** — three message tiers: "truly amazing" / "good job cutie" / "I'm gonna pretend I didn't see the score"
7. **Upload a selfie, RIGHT NOW!** — PNG/JPEG/WebP ≤ 5 MiB, magic-byte validated
8. **The final question** — three answers, two endings; the sweet one rains praying-hands images

## Where the answers go

The original wrote responses to `data/responses.txt`. Paigaam's version collects
them on a **private responses page**: `/sawaal/responses/:id`, gated by the same
creator cookie as the preview. Visitors POST to `/api/sawaal/claim` (binds a
visitor cookie to the published paigaam), `/api/sawaal/answer` (whitelisted per
scene, quiz re-scored server-side) and `/api/sawaal/upload` (magic-byte sniffed,
owner-gated serving). The generator's publish result links the responses page.

## Editing (the sender's fields)

Only **their name** is required. Everything else defaults to the original's copy,
re-personalised around the sender's name when present:

| Field | Default |
| --- | --- |
| `senderName` | — (used in the like question, the kiss question, the footer) |
| `inviteTitle` / `inviteIntro` | "Let's schedule a date!" / original line |
| `likeTitle` | "Do you like {sender}?!?!" |
| `vibeTitle` / `vibeOptions` | "How do you like it?" / "Dinner & Chill, Coffee & Walking" (max 4) |
| `availableDays` | — (up to 8 ISO dates; empty skips the picker's day list gracefully) |
| `quizTitle` / `quizIntro` | original copy — the four quiz questions themselves are fixed design copy |
| `kissTitle` / `kissIntro` | "What if...?" / original line, sender-personalised |
| `yesOutcome` / `shyOutcome` / `shyOutcomeLine` | the original's three ending lines |

## Least-friction creation + live preview

Same five-step wizard as Maafi (`/create/sawaal`) with a **sticky live preview
pane that follows every keystroke** — debounced 350ms — via the stateless
endpoint `GET /sawaal/preview-frame?d=<json>`: read-only, renders typed data,
falls back to the designed defaults on any error, no draft or cookie needed.
Save & Preview still gates the owner-only dialog preview and publishing.

## Media

The eleven scene illustrations (Flork-style PNG/JPG from the original repo,
~700KB total) ship as sha256-manifest base64 in `assets/sawaal/` and are
boot-healed into `public/sawaal/media/` by `lib/sawaalMedia.js` — the Valentine
pattern, because binary files cannot survive the GitHub MCP JSON bridge.
The original's three meme MP3s (7.9MB of personal music) are deliberately NOT
shipped; the sound design is a tiny Web Audio synth in `public/sawaal/sfx.js`
(music-box loop, sad slide on "not really", celebration arpeggio).

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /create/sawaal` | public | the five-step generator |
| `GET /sawaal/demo` | public | demo render (Meher ← Rahul) |
| `GET /sawaal/preview-frame?d=` | public, rate-limited | stateless live preview |
| `GET /sawaal/preview/:id` | creator or admin | private preview |
| `GET /sawaal/responses/:id` | creator or admin | the collected answers |
| `GET /sawaal/selfie/:id/:file` | public once published, else creator/admin | selfie bytes |
| `POST /api/sawaal/claim` | visitor | binds visitor cookie to the paigaam |
| `POST /api/sawaal/answer` | visitor cookie | one scene answer (whitelisted) |
| `POST /api/sawaal/upload` | visitor cookie | selfie upload |
| `POST /api/sawaal/draft` | creator cookie | save/update draft |
| `POST /api/sawaal/publish` | creator cookie | free instant publish (`sawaal-<18hex>`) |

The generic endpoints (`/api/drafts`, `/api/free-publish`, `/api/render-preview`,
`/go/whatsapp`) all refuse the slug — same as every interactive sibling.

## Environment

`SAWAAL_ALLOW_EPHEMERAL_PUBLISH=1` — same ephemeral-storage guard override as
the sibling templates. Publishing on Railway (persistent volume) never needs it.

## Tests

`node scripts/test-sawaal.js` — boots a disposable server and runs
`tests/sawaal-api.test.js` + `tests/sawaal-dom.test.js`: routes and static
assets, the full draft → publish → live-page → QR lifecycle, stranger-403s,
CSRF, generic-endpoint bypass, validation shapes, the stateless live frame
(typed / garbage / hostile / POST-404), served-payload parse, the full scene
machine on a stub DOM (the trap, the day picker, quiz scoring, upload flow,
both endings, the celebration) and full process-restart persistence.
