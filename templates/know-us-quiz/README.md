# Pehchaan — How Well Do You Know Us?

**Slug:** `know-us-quiz`  
**Family:** `bfday`  
**Category:** Love  
**Price:** 0

Ported 1:1 from `bf/t6-quiz.html`.

## The experience

An opening card shows the sender's name and a **Start** button. Tapping Start enters a question-by-question quiz:

- **Film-strip progress bar** along the top of the question card — one frame per question, filled gold as questions are answered, animating in .35s.
- **Four answer chips** (pill buttons) per question. Tapping one locks all chips immediately, colours the picked chip green (correct) or red (wrong), highlights the correct answer, and applies a **pop** animation on correct or **shake** on wrong — before transitioning to the reveal.
- **3D flip reveal** — after 750ms (correct) or 950ms (wrong), the question card transitions to a reveal card. The front face mirrors the question; the card flips (600ms cubic-bezier) to the back face showing: verdict, the correct answer, a reveal story, and a gradient photo placeholder with a caption.
- **Score ring** — after the last "Next / See my score", a radial SVG ring animates (1s ease) to show the score out of N. A band message (in the sender's words) appears below it alongside a screenshot call-to-action.
- **Play again / Replay** — resets all state in place (no page reload).

## Timings (ported verbatim)

| Event | Delay |
| --- | --- |
| Correct → reveal | 750ms |
| Wrong → reveal | 950ms |
| Flip animation | 600ms CSS |
| Ring animation | 1s CSS |
| Reduced motion | all CSS transitions set to none; flip applied immediately; pop/shake animations suppressed |

## Reduced motion

- `.reduced` class added to `<body>` on boot if `prefers-reduced-motion: reduce`.
- `.flip-inner` transition → none; flipped state applied directly.
- Pop and shake animations suppressed via `.reduced .pop`, `.reduced .shake`.
- Ring transition → none.

## No-JS

The intro card and score-card structure are server-rendered and visible without JS; however, the quiz interaction requires JS. There is no `<noscript>` fallback beyond the visible static text.

## Field table

| id | type | max | default |
| --- | --- | --- | --- |
| `senderName` | text | 40 | *(required)* |
| `introLine` | text | 80 | `no pressure — (some pressure)` |
| `questions` | list (object) | 8 items | 5 default questions |
| `questions[].q` | text | 180 | *(required)* |
| `questions[].a1` | text | 100 | *(required)* |
| `questions[].a2` | text | 100 | *(required)* |
| `questions[].a3` | text | 100 | *(required)* |
| `questions[].a4` | text | 100 | *(required)* |
| `questions[].correct` | select | — | `'1'` |
| `questions[].story` | textarea | 400 | placeholder |
| `questions[].caption` | text | 60 | placeholder |
| `bandZero` | text | 80 | `certified: here for the snacks` |
| `bandLow` | text | 80 | `certified: very good, occasionally lucky` |
| `bandHigh` | text | 80 | `certified: knows me better than i admit` |
| `bandPerfect` | text | 80 | `certified: knows me better than i know myself` |
| `screenshotCta` | text | 80 | `screenshot this & send it to me 📸` |

Score band logic (computed in JS from `score / total`):
- 0 correct → `bandZero`
- 1 to ≤ half → `bandLow`
- > half but < all → `bandHigh`
- all correct → `bandPerfect`

## Routes

| Method | Path |
| --- | --- |
| GET | `/create/know-us-quiz` |
| GET | `/know-us-quiz/demo` |
| GET\|POST | `/know-us-quiz/preview-frame` |
| GET | `/know-us-quiz/preview/:id` |
| POST | `/api/know-us-quiz/draft` |
| POST | `/api/know-us-quiz/publish` |
| GET | `/p/know-us-quiz-<18hex>` |

## Differences from the source file

- Hosting-sandbox injections removed: `.ha-img-placeholder` style block, `__brokenImgHandler` script, and the Escape→`postMessage({type:'close-fullscreen'})` script.
- `paigaam.cc` footer link replaced with `<a href="/">Paigaam</a>`.
- Hardcoded `5` question count replaced with dynamic `d.questions.length` in all display locations (filmstrip frames, "out of N" text, "N/N" replay button, frame counter, `aria-valuemax`).
- Score band logic generalised: instead of a fixed lookup table for scores 0–5, the band is derived from the ratio of correct answers to total questions.
- Photo placeholder key (`cafe`, `road`, etc.) replaced with question index cycling through 5 gradient palettes (no sender-editable field needed; the palette selection is purely cosmetic).
- `innerHTML` of sender text replaced with `textContent` throughout `pehchaan.js`.
- Reveal card caption built with `createElement` + `textContent` (was `innerHTML` + string concatenation in the source).
- Question count is server-rendered in the intro card; the `introLine` field covers the "no pressure" copy without needing to hardcode "5 questions".
