# Suvarna Vivah — an original ceremony-led wedding invitation

Suvarna Vivah uses the supplied video as its click-to-play ceremonial opening, then reveals a bespoke wedding invitation layout. It shares Paigaam's wedding schema, seven-step customizer, validation, storage, RSVP, guest dashboard and publishing mechanics—but it does **not** reuse Shaadi Paigaam's invitation composition.

## Guest experience
- Catalogue/detail and sample: `/templates/suvarna-vivah` and `/suvarna-vivah/demo`.
- The video opens on tap/click, retains the supplied soundtrack, and offers Skip/Escape. It ends in warm gold light and drifting petals; the next page begins in that same luminous palette and motion, then continues onto ivory ceremonial paper.
- The new visual system is an editorial ceremony journal: deep-green opening, live couple typography, a custom still-life of kalash/coconut/banana leaves/marigolds, an invitation letter, a gold-leaf scratch-to-reveal wedding date and live countdown, family acknowledgements, a ceremony itinerary, venue, uploaded memories, guest details, RSVP and a distinct closing. It deliberately avoids Shaadi Paigaam's doors, curtains, scratch heart and courtyard.
- The default is sunlit ivory, antique gold and marigold with Royal Calligraphy. Existing eight palettes, four type styles, eight languages, responsive preview, autosave and publishing flow remain editable.

## Editor and routes
- Customizer: `/create/suvarna-vivah`, implemented with Paigaam's proven seven-step editor shell and live preview. Its local draft namespace and API routes are isolated from Shaadi Paigaam.
- Guest links, version history, private invitations, media uploads, QR/share cards, RSVP and manage links use the new route namespace. Passcode-protected share cards are owner/admin-only.
- The editor preview uses the new Suvarna renderer and the video opener; the editor can replay it from the existing preview control.

## Assets
The video is a ~1.5 MB, 720×1280 H.264/AAC encode with its audio retained. The generated ending-continuity background (golden bokeh, petals and silk) is a compact WebP. Media are transported as checksummed, chunked base64 text under `assets/suvarna-vivah/`; `scripts/pack-suvarna-vivah-media.js` creates the chunks, and `lib/suvarnaVivahMedia.js` restores/verifies them on boot.

## Tests
`node scripts/test-suvarna-vivah.js` exercises the bespoke renderer, editor, byte-range video, media privacy, draft/publish, private cards, RSVP and version flows. `node scripts/test-shaadi-paigaam.js` guards the existing Shaadi Paigaam experience.

## Release discipline
The currently live version was the rejected, reused design. The original-design replacement is being prepared on a separate review branch; do not merge/deploy it until the owner approves the distinct visual preview.
