# Purana Seekho 🎀

The lemon-gingham, sticker-cat boyfriend's-day gift site — replicated from the
@template_diary reel ("Purana Seekho").

**The ceremony (6 beats):**

1. **The gate** — "I made something for you… enter the password to view", a
   decorative joke captcha ("I'm not a robot (mostly)"), purple Continue.
   Light theme by design — cream on gingham, no Raaz dark tokens.
2. **The tease** — a wrong guess brings the winking cat, "HOW DARE YOU!?" in
   pink bubble letters with a white sticker outline, and a springy TRY AGAIN
   pill. Never an error state; the field keeps its content so the retry is
   one tap. A third wrong guess loops here forever — a gift site never locks
   anyone out.
3. **The pick** — the excited cat asks "ARE YOU REALLY EXCITED?"; three cat
   gift boxes. Each tap opens one (lid off, dimmed, inert). All three →
   900ms → auto-advance. Opened boxes are remembered in sessionStorage, so a
   reload lands back on the pick screen with progress intact.
4. **The reveals** — the blushing cat hero ("happy Boyfriend's Day"), the
   "YOU ARE MY bestfriend" word cloud around the kitten (collapses to a
   centered pill column under 380px), and the OUR MEMORIES photo-booth strip
   (2×3 ≥480px, vertical strip below, red banner overhanging the frame).
5. **The closer** — "You complete me" in script in a pink oval, the couple
   illustration, rainbow doodles, and the song playing right on the page.

**Design tokens:** cream `#FFF9EF`, gingham lines `rgba(244,200,66,.16)` at
28px pitch (fixed background — never repaints under scroll), hot pink
`#F0427E` headlines, pill pink `#E84A7F` CTAs, banner red `#D6453D`, plum ink
`#4A3B3F`, card radius 18px, Baloo 2 800 for bubble headlines, Caveat for
script. Motion is springy — `cubic-bezier(.34,1.56,.64,1)`, nothing over
400ms.

**Engineering:** same salted-SHA-256 gesture gate as Raaz (the page carries a
hash, never the answer). All text is server-rendered and HTML-escaped;
`purana-seekho.js` is motion only. Assets ship from `lib/bfday/assets.js` —
4 cat cutouts, the gift-box illustration, the couple illustration, 4 doodles,
6 demo photos and `og.jpg` under `assets/purana-seekho/` (art) and
`assets/bfday-demo/purana-seekho-demo-*.jpg` (demo photos — shared family demo dir).
