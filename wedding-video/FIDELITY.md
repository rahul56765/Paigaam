# What matches the reference, and what could not be matched exactly

Reference: a 720×1280 screen recording, 92.03s at 30fps, with the player's UI burned in.

## Matched
- **Total length and every cut point.** The sample timeline is 2,761 frames (92.03s), and every scene starts on the same frame as in the reference: 0, 11.2, 20.0, 28.5, 34.8, 41.8, 50.6, 61.0, 67.5, 74.0, 81.4 and 88.8s. A unit test locks this.
- **Transition grammar.** Each transition type and its order match the reference:
  - stamp zoom (opener to main card)
  - sun zoom (main card to Haldi)
  - prop zoom
  - slide swap
  - lift-away
  - banana-leaf wipe
  - shrink-and-rise
  - fabric match-cut
  - shrink-and-exit
  - stamp zoom to the closing card
  - fade to paper
- **Layout.**
  - Perforated stamp frames with the rose block-print band.
  - Date written inside each event stamp, with props overlapping the stamp's lower-right edge.
  - A centred text block below each stamp: tagline, letter-spaced title, timings, icon, venue.
  - Landmark at the foot of the main and closing cards.
  - Brand end card centred on cream paper.
- **Colour logic per event:** yellow Haldi, navy Sangeet, peach Mayra, maroon and gold Baraat. Stories sit on the following event's backdrop, as in the reference.

## Not exactly matched (and why)
1. **Illustrations are new.** All artwork is original Paigaam art painted in the same soft watercolour style: scroll, diyas, leaves, parrots, Ganesha, Taj Mahal, props, backdrops and borders. Compositions and details differ, for example the gramophone, the elephant's caparison and the cloud shapes. The Ivory Tales art was not copied.
2. **Fonts are the closest open licences.** Display is Italiana, date numerals are Bellefair and body is Josefin Sans. The reference display face has a slashed zero and a swash "g". Italiana has neither, so letterforms differ slightly.
3. **Story clips in the sample are internal placeholders.** They are cut from the reference recording, which is 720p with a UI overlay, and upscaled. So they look softer than the cards and must not ship. Customer clips come from the photo-to-Veo pipeline.
4. **Clip lengths in the sample are stretched.** The visible placeholder footage per story is 2.8–4.1s, so clips are slowed (never below 0.6×) and hold their last frame to fill the reference durations.
5. **Easing and sizes are estimated.** They come from a 720p recording sampled at 10fps, so curves are close but not frame-identical. The opener's rolling-page flip is a simplified roll.
6. **Small decorative motion differs.** The reference's scalloped yellow pelmet on the mother–daughter clip and the stamp-shaped mini card during the fast shrink are approximated with the theme's stamp edge colour.
7. **Brand end card uses the Paigaam logo** (`brand/logo.png`), at the same position and with the same fade. Replace the file to use a different mark, for example a separate "PYGAM" logo.
8. **No music ships.** The reference soundtrack is used only in the internal comparison render (`--ref-audio`). Licensed tracks must be added to the music library.
9. **The 16:9 export** is the identical 9:16 film centred on a cream paper backdrop. Nothing inside the film is re-laid out.
