# Aakhri Sawaal — One Question. Your Answer.

Boyfriend Day family. *Aakhri sawaal* (आख़िरी सवाल / آخری سوال) — the last question. Candlelight on ink navy, a few cards, a heartbeat, one question in huge candle-gold Fraunces signed by the sender — and then he answers.

Built on the shared family engine (`lib/bfday/`). Static assets are in `public/aakhri-sawaal/` (`sawaal.css`, `sawaal.js`, `og.jpg`).

## Flow

1. One or two build-up cards (wizard list, max 2) and a heartbeat — **at most three taps** before the question. The heartbeat also advances by itself after 1.5s.
2. The question, signed "— {sender}", with an optional song link.
3. "Write your answer" → his reply: free text + quick answers, and an optional photo, **"your answer, framed"**.
4. Sent.

Every change is a 350ms transition, and every step is a `history` entry, so the browser back button / back swipe goes back one card.

## The reply — WhatsApp first

The primary action opens `https://wa.me/<number>?text=…` with the message prefilled ("Reply to {sender}’s question: “…”" + his answer). `<number>` is the creator's optional WhatsApp field reduced to digits (a bare 10-digit Indian mobile gets `91`; anything implausible is dropped). Without a number it falls back to the generic `https://wa.me/?text=…` share. The message is also copied to the clipboard.

The photo is downscaled on his device to 1600px on the long edge, then framed with his answer on a 1080×1350 canvas. It is **never uploaded**: he shares it with the Web Share API (files) where supported, otherwise saves it.

Nothing he writes is stored on Paigaam.

## Open item

A backend `POST reply → creator` endpoint is deferred. The family engine has no creator dashboard to deliver replies to (ownership is a creator cookie only), so it would need new storage and a new inbox surface rather than fitting the existing server.

## Reduced motion / no JavaScript

Reduced motion: no transitions or flicker; the heartbeat still advances. No JavaScript: the cards and the question are shown in order; the reply form is hidden.
