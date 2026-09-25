# Meri Duniya — A Whole Website, Made For You

Boyfriend Day family, the flagship. *Meri duniya* (मेरी दुनिया / میری دنیا) — my whole world. One private link that opens on a dark screen, a single heartbeat and his name, then a guided journey through a website that is entirely about him.

Built on the shared family engine (`lib/bfday/`). This directory holds config, schema and renderer; static assets are in `public/meri-duniya/` (`duniya.css`, `duniya.js`, `wax-seal.webp`, `og.jpg`).

## The journey

| # | Section | Interaction | Wizard step |
| --- | --- | --- | --- |
| 0 | Opening | Plum screen, one heartbeat (≤1.2s), "Hey {nickname or name}, I made something for you." at 1.2s, "Tap to enter" by ~2.8s | 1 · The opening |
| 1 | The Letter | Envelope sealed with the wax heart; tap → 600ms clip-path tear (ease-out), once. Letter types at 28ms/char; tap or "Tap to skip" finishes it | 2 · The letter |
| 2 | Our Story | Vertical timeline (alternating sides ≥760px), date chips, tap a card to expand its caption | 3 · Our story |
| 3 | Reasons I Love You | Sticky notes, tap to flip; "{n} reasons and counting" | 4 · The reasons |
| 4 | Us, In Numbers | Live "days together" (Asia/Kolkata) + up to 4 custom numbers; count-up over 1.4s, cubic-bezier(0.22,1,0.36,1), on scroll into view | 5 · In numbers |
| 5 | The Gallery | Full-bleed scroll-snap slideshow with arrows + counter; optional song card (plays only on tap) | 6 · The gallery |
| 6 | The Question | Question → button → the promise; wax seal closer and "Made with love on Paigaam" | 7 · The question |

A thin rose progress bar and a heart in the corner fill as he scrolls.

## Optional sections and renumbering

- Letter and reasons have designed defaults and an "Include / Leave it out" switch.
- Story, numbers and gallery have **no invented defaults** — left empty, they are not rendered.
- Sections are numbered 01, 02… in order of appearance, so the journey never shows a gap.
- Milestones and gallery items without a photo get a gradient placeholder.

## Persistence

On published pages the torn envelope is remembered in `localStorage` (`paigaam:meri-duniya:<slug>:opened`); a reload lands on the letter, already typed. Previews never persist.

## Reduced motion / no JavaScript

Reduced motion: no heartbeat, no tear, no typing, counters show final values instantly, reveals are static. No JavaScript: the opening and envelope are skipped and everything is shown.

## Share preview

`og:image` / `twitter:image` = `/meri-duniya/og.jpg` (1200×630) on the published page and the template detail page.
