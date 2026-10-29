# Anniversary Blue

Separate ten-screen anniversary keepsake, slug anniversary-blue. Built on the existing bfday family; no existing template is replaced. Production release and catalogue-thumbnail setup explicitly authorized by the owner on 2026-10-28. Release in progress; live verification is required before calling it deployed.

## Routes after release

- /anniversary-blue/demo
- /create/anniversary-blue
- /templates/anniversary-blue
- Published instances use the existing /p/anniversary-blue-… route.

## Experience and flow

1. Navy retro computer window, pixel heading, original couple and bouquet; Start opens Surprise.
2. Bouquet opens Disc; candle cake opens Envelope; gift opens Folder. Each label is editable.
3. Actual spinning vinyl with headphones and camera; controls open Folder, Envelope or memories Folder.
4. Envelope: seal splits, flap opens, letter slides out. A user-controlled read button appears when the animation completes.
5. Full handwritten letter on torn paper beside an opened navy envelope. No reading timer or content truncation.
6. Blue gingham folder: tall memories, sliding polaroids and love reasons.
7. Tall photographs, three per row; Next opens Polaroids.
8. Swipe/keyboard/button carousel; central polaroid enlarged; Next opens Reasons.
9. Editable list of reasons, blue hearts and taped photograph; Next opens Forever.
10. Retro Forever window, polaroids, bouquet, editable final note, Next returns to surprises. Restart resets the envelope and music.

All scenes are present but only one is interactive; inactive sections are hidden and inert. Soft CSS entry animation, floating hearts and sticker motion respect reduced-motion preferences. No animation or canvas rendering loop is needed during idle display.

## Editing

41 top-level fields in six steps cover names, titles, hints, labels, letter/sign-off, reasons, audio, and photographs. Photo lists: tallPhotos 1–9, polaroids 1–15, foreverPhotos 1–9. Reasons 1–40. Standalone reasonPhoto and songPhoto slots are independently replaceable. Captions are editable per slot. Existing family list controls add, remove and reorder rows.

Template-scoped editor.js and crop.js reuse the proven Paigaam wizard with list-aware iframe pickers. Crop aspect ratios match the rendered image area: tall .55, square polaroid 1, Forever/reason .85, song 1.3. Drag and sliders control placement and zoom, with a live crop preview. Cancel preserves the prior photo. JPEG export preserves source proportions, avoids upscaling and caps the long edge at 1600px, quality .93; small-source warning appears. Original chosen files remain available in the current session for non-destructive recrops; after a reload the saved crop is the only available source, so replace with the original to recover cut-away edges. Only restricted family upload URLs persist. No photos are stretched. Very small input images cannot be made genuinely sharp.

## Music

- Native audio: owned MP3/WAV upload (12 MB max) through /api/anniversary-blue/audio, or HTTPS direct audio-file URL. Existing magic-byte checking and private owner-scoped storage are retained.
- Default start mode: disc. Optional opening mode starts audio only within the Start tap. Browser autoplay restrictions still apply; no attempt is made to bypass them.
- Persistent music toggle; spin tracks actual playing/paused state rather than a cosmetic click timer. Native audio is looped.
- Spotify: strictly validated open.spotify.com track/album/playlist links; lazily loaded official iframe API player. Spotify playback events drive the vinyl; errors have a plain embedded-player fallback. Spotify controls its own sign-in, preview length and playback permissions. A separate Spotify Play tap may be necessary. Full-song Spotify playback is not promised.
- Direct audio is preferred when both sources are supplied; a separate Spotify-player button makes the embed available too. Known YouTube/Spotify/SoundCloud/Apple Music webpages are rejected in the direct-audio field. Other remote links may still fail if they do not serve playable audio; use the editor preview to confirm. No unsolicited demo melody or commercial song is bundled.
- Player configuration generations invalidate old provider/native callbacks, so stale events cannot undo music-off or alter a newly selected song.

## Responsive behavior

On mobile the scene has a 9:16 minimum canvas with natural vertical growth for long letters, captions and larger photo/reason lists. This intentionally scrolls rather than shrinking text, cropping content or fixing a letter into an unreadable frame. Desktop uses the reference's wider scrapbook composition. The polaroid carousel alone intentionally clips its sideways track.

## Integration changes

Additive registration in templates/bfday.js; scoped editor asset selection in pages/bfdayCreate.js; explicit anniversary-blue opt-in to editor previews and existing owner-scoped audio upload/reference handling in lib/bfdayRoutes.js. Existing Love Letter and all other family templates retain their source files.

## Local review

node scripts/preview-anniversary-blue.js
node scripts/test-bfday.js

The generated portable HTML is a design preview: photo crop and song experiments stay only in that tab. Persistent text/list editing and publication belong to Paigaam's integrated wizard. No production Paigaams are created by the preview.

## Checkout presentation

For paid pricing, coupon entry is shown inline on the final “Send it” step only. The current price and larger crossed-out regular price are grouped as one offer, coupon savings and final payable amount update in place, and the send button reflects the quoted amount before Razorpay opens. Earlier customization steps stay coupon-free. The legacy `/create/anniversary` editor path redirects to the canonical `/create/anniversary-blue` route for returning browser tabs.

## Release status

Release authorized on 2026-10-28. The release adds this template without replacing existing templates, then sets its own catalogue thumbnail through the normal admin workflow. Railway deployment success and live demo/editor/thumbnail checks are required before reporting it live. Physical iOS Safari/Android device validation and a real Spotify account playback check remain separate from automated browser tests. See QA.md for actual test results.

## Changelog

- 2026-10-30: Paid Anniversary Blue checkout now keeps coupon entry and a live payable-total review on the final Send step; pairs ₹99 sale pricing with the ₹199 regular price; preserves the old `/create/anniversary` route as a redirect to the current editor.
- 2026-10-28: Owner-authorized production release and catalogue thumbnail setup; release suite rerun against current main e9eb77a877ffa543ab5319c511d7bffb26a07be8, preserving all existing templates.
- 2026-10-27: Original ten-screen navy-and-white anniversary implementation, complete field schema, list-aware photo editor, music upload/Spotify support, portable review and integration tests.
