# Daa'wat — the red velvet door reveal

Boyfriend Day family, template 20. *Daa'wat* (दावत) — the invitation, the feast. A replica of the cinematic "tap to open" genre: red velvet curtains part on a tap to reveal a maroon wedding card. First paid template in the family — ₹19, instant, vs the ₹1,999 / 2–3 day originals it replicates.

Built on the shared family engine (`lib/bfday/`). This directory holds config, schema and renderer; static assets are in `public/assets/daawat/` (`hero-closed.jpg`, `curtain-left/right.jpg`, `card-bg.jpg`, `divider-gold.png`, `seal.png`, `petal.png`, `og.jpg`) and `public/assets/bfday-demo/daawat-demo-1..5.jpg` — decoded at boot from `lib/bfday/assets.js`, because the git pipe cannot carry binaries.

## The beats

| # | Beat | Interaction | Wizard step |
| --- | --- | --- | --- |
| 1 | The closed hero | Candlelit velvet, the live "tap to open" plaque pulsing (2.4s). Ambient loop: drape sway + candle flicker ONLY. Countdown ticks behind the curtains | 1 · The couple, 2 · The occasion |
| 2 | The reveal | One tap: the curtain halves slide apart (1.4s, heavy-fabric cubic-bezier), a one-shot petal burst (8–12 petals, ~2s) plays, the light bloom rises through the gap | — (the transition) |
| 3 | The maroon card | Names in Great Vibes cream ≥44px with a 60ms per-letter stagger (no glow), the gold divider, the invitation line, date/time/venue | 3 · The invitation line |
| 4 | The countdown | The standing DD/HH/MM/SS pattern on velvet | 2 · The occasion |
| 5 | The gallery | Up to five photos in gold-corner frames with event captions | 4 · The gallery |
| 6 | The closing | The closing message, the gold seal, "With love, {couple}" — tap the seal and the curtains re-veil (the ceremony replays) | 5 · The closing |

## The seam guarantee (Director's ruling #1)

Beat 1's closed hero is NOT a third image — it is the two curtain halves composited in CSS (`flex`, each `width: 50%`). The halves are slices of the ONE wide hero scene the Director generated and verified (composite vs original: max pixel diff 0). Beat 1 → Beat 2 is the same fabric, guaranteed. `hero-closed.jpg` ships only as the no-JS/og fallback.

## The 7 rulings, as built

1. One wide hero → sliced halves; closed hero composited in CSS.
2. Ambient loop = drape sway + candle flicker only; petals are a one-shot burst at the reveal.
3. Curtain easing `cubic-bezier(0.65, 0, 0.35, 1)` 1.4s, no overshoot; bloom opacity 0→1 across the same 1.4s starting ~0.2s in.
4. Names: Great Vibes, `#F8EAD0` on maroon, `clamp(44px, 10vw, 72px)`, 60ms per-letter stagger with rise+fade, no text glow.
5. Card border: CSS double gold (`border` + `outline` offset), never baked into the texture.
6. The "tap to open" plaque is a live HTML component (Cormorant Garamond italic, 2.4s soft pulse) — reusable for the future Naqsh-collection variants.
7. Gallery corners are CSS (double-line gold, matching the card's gold `#C9A24B` — the Shubh Vivah ornaments are a different ivory-scene tone and would clash on velvet); countdown and inline-song beats use the standing patterns verbatim.

## Reduced motion / no JavaScript

Reduced motion: curtains part instantly (still transition for meaning), no petals, no flicker, no plaque pulse, names render whole, the countdown keeps ticking (it is information, not decoration). No JavaScript: every beat is fully visible, the plaque and petals are hidden, the tiles show the server-computed countdown at render time.

## Share preview

`og:image` / `twitter:image` = `/assets/daawat/og.jpg` (1200×630) — closed curtains + candelabra, clean left field for the title overlay. On the published page, the template detail page and the collection card.
