# Suvarna Vivah — wedding invitation with a ceremonial opener

Suvarna Vivah is an additive wedding template built on the Shaadi Paigaam invitation model. The existing `shaadi-paigaam` template and its editor are unchanged.

## Customer experience
- Catalogue detail and sample: `/templates/suvarna-vivah` and `/suvarna-vivah/demo`.
- Customizer: `/create/suvarna-vivah` — the existing seven-step live-preview editor, with a separate local-draft namespace and Emerald & Gold / Royal Calligraphy starting style.
- Guest link: a published short link opens a full-screen, click-to-play 10-second ceremonial film. The supplied kalash-and-marigold movie plays with its original audio; on completion (or Skip/Escape), the invitation doors open and the wedding site is revealed.
- Customers can still edit all standard invitation details, events, venue, photos, music, palette, language, RSVP, and publishing settings.

## Assets
The compressed 720×1280 H.264/AAC opening video and poster are transported through `assets/suvarna-vivah/` as checksummed, chunked base64 text. `scripts/pack-suvarna-vivah-media.js` regenerates the manifest and parts from `public/suvarna-vivah/`; `lib/suvarnaVivahMedia.js` verifies and restores them on server startup. The clip is ~10 seconds and ~1.5 MB.

## Checks
Run `node scripts/test-suvarna-vivah.js` for the isolated end-to-end flow (editor, video asset byte ranges, draft privacy, uploads, publish, short link, RSVP, version restore, and manage access). Also run `node scripts/test-shaadi-paigaam.js` to verify no regression to the existing template.

## Status
Feature branch only; do not merge, deploy, or publish the template until owner review.
