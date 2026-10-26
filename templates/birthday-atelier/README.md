# Birthday Atelier

Original pink scrapbook birthday surprise for Paigaam. This is a NEW template, not a replacement for birthday-paigaam. No existing customer data, prices or routes are migrated.

## Integration

Registered in templates/bfday.js. The existing schema-driven engine supplies the gallery card, detail page, six-step editing wizard, owned photo uploads, live preview, draft save, publication, QR sharing and persistence. No new server route or database table is needed.

After an approved deployment:
- /birthday-atelier/demo
- /create/birthday-atelier
- /p/birthday-atelier-<18 hex characters>

These are intended routes, not claims of an existing live deployment.

## Experience

Eleven scenes: opening collage; three questions; open/reveal; cupcake; envelope menu; personal letter; memory coupons; playlist; final listening scene. The menu is revisitable from all keepsakes and Escape returns from a keepsake to the menu. Both answers reveal a reply and a user-operated Continue button; replies never disappear on a timer. Neither button evades touch or coerces the recipient.

Original vector art in art.js: ribbon bow, strawberry-icing cupcake, flower and dreamy landscape photo placeholders. All artwork is original SVG/CSS, not traced or copied from the supplied reference. No fake photos are presented as real memories. The photo slots fill with customer uploads. Headings use Pixelify Sans; letters use Caveat; body copy uses Nunito Sans. System fallbacks are included.

## Editing

32 top-level fields, including three fixed question rows with editable answer labels and after-answer replies; twelve photo slots/captions; a 6000-character letter; eight coupons; twelve songs with title, artist and optional direct audio URL; Spotify playlist link; birthday date; names; key scene headings and action labels; and optional background music (shared YouTube field).

Photo uploads use the existing ownership-checked family upload pipeline. Blank photos show original illustrated landscapes. Customer content is whitelist validated by makeSchema and escaped in all HTML/attributes. HTTPS audio URLs only; Spotify links must be on open.spotify.com. Invalid/scripting URLs never become playable links. Publication rejects non-HTTPS or credential-bearing audio links and non-Spotify playlist links; the shared editor shows specific, actionable errors. Spotify links include a real QR generated with Paigaam's existing QR implementation.

## Sound

No autoplay. Each song can use an HTTPS URL pointing at an audio file the sender has permission to distribute. Arbitrary URLs may fail due to host restrictions, expiry, MIME types or browser codec support. Errors are shown without pretending playback succeeded. Without an audio URL, an ORIGINAL 24-second Paigaam music-box melody is generated in the browser; the player explicitly labels it as the demo melody, not the named commercial song. Vinyl motion follows actual HTMLAudio state. Seek, previous/next, pause and duration operate on the same shared audio element across playlist/listening screens.

Spotify is an external link/QR, not an embedded streaming player and not a Spotify-shaped fake waveform. Background music uses Paigaam's existing optional YouTube music control and is paused when record playback starts; starting background music pauses the record. Device autoplay restrictions still apply.

## Candle and privacy

Tap always works. Optional microphone is requested ONLY by its dedicated user gesture. The microphone is used locally for loudness detection; it does not record, store or send audio. Blow detection is best effort and may also respond to a loud nearby sound. Tracks and AudioContext are stopped on navigation, success, failure, 12-second timeout, page hide or tab backgrounding. A pending permission resolution is discarded and its tracks stopped if the visitor has already navigated away. Permission denial/unsupported browsers show a tap fallback. Actual iOS and Android hardware checks remain recommended.

## Animation and access

Fade/slide scene changes; floating envelopes; hinged flap and sliding letter; opening curtains; candle glow; floating hearts; button press movement; playing-state vinyl. All are CSS transforms/opacity where practical. prefers-reduced-motion removes decorative animation and shortens transitions. Inactive scenes are hidden and inert. Scene headings receive focus on navigation; status messages announce replies and errors. Buttons have 44px minimum targets. Small displays scroll naturally instead of shrinking text to fit or clipping letters.

## Tests

node --test tests/bfday-birthday-atelier.test.js tests/bfday-engine.test.js
node scripts/test-bfday.js

The second command starts an isolated disposable server and exercises the shared create/upload/publish/persistence pipeline. Run it in an environment where repository dependencies can be installed. No secrets are required for the first command.

## Changelog

2026-10-26: Independent source audit addressed: reply reading time, long-text layout, strict music-link validation, restart reset and BGM coordination. Initial original artwork, editable eleven-scene flow and integration with the existing family engine. Owner approved production deployment on 26 October 2026. Release through main to the existing Railway Paigaam service; verify runtime status in Railway and at the demo/editor routes above.
