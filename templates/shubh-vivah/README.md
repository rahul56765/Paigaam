# Shubh Vivah — a Hindu wedding invitation

Boyfriend Day family, template 11. *Shubh vivah* (शुभ विवाह) — the auspicious wedding. A single scrollable story-page that reads like a traditional wedding card translated to the web.

Built on the shared family engine (`lib/bfday/`). This directory holds config, schema and renderer; static assets are in `public/shubh-vivah/` (`vivah.css`, `vivah.js`, the four gold corner ornaments, the namaste couple illustration, the ivory paper texture, `og.jpg` and `demo-couple.jpg`) — decoded at boot from `lib/bfday/assets.js`, because the git pipe cannot carry binaries.

## The beats

| # | Beat | Interaction | Wizard step |
| --- | --- | --- | --- |
| 1 | Countdown opener | "Our New Beginning Starts In" over four gold-ruled tiles (DD/HH/MM/SS), ticking every second to 6:00 AM IST on the date. Past the date → "The new beginning has begun ✨", never a zeroed clock | 1 · The couple, 3 · The muhurtham |
| 2 | The families | "WITH THE BLESSINGS OF" in small caps, parents' names in display serif, one corner set only — the quiet beat. Both lines blank → the beat is not rendered | 2 · The families |
| 3 | The muhurtham | The hero card: full four-corner gold frame, occasion name in large maroon serif, date/time/venue (venue wraps, never truncates), namaste couple at the foot | 3 · The muhurtham |
| 4 | The photograph | One photo in the same gold frame. No photo uploaded → the demo photograph in previews, the namaste illustration on published pages — never an empty frame | 4 · The photograph |
| 5 | The closing band | Deep maroon band: the closing message in italic, then "With love, {couple}" in script | 5 · The closing |

Every beat's children rise 14px / 550ms ease-out on scroll (IntersectionObserver); nothing animates on load.

## Design system (Director-locked)

- Ivory `#FBF6EC` base (paper texture at low opacity), maroon `#8E1F2F` the only accent, gold `#C9A24B` strictly decorative (borders, rules, ornaments — never text on ivory), body ink `#4A3226`.
- Cormorant Garamond 600/700 display, Great Vibes script for the couple's names only.
- Countdown tiles go 2×2 under 380px; single-column story flow throughout.

## Reduced motion / no JavaScript

Reduced motion: reveals render instantly (the countdown keeps ticking — it is information, not decoration). No JavaScript: every beat is fully visible and the tiles show the server-computed countdown at render time.

## Share preview

`og:image` / `twitter:image` = the uploaded photo if there is one, else `/shubh-vivah/og.jpg` (1200×630) — on the published page and the template detail page.
