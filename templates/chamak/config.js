'use strict';
/**
 * Chamak — Disco Birthday. (Boyfriend Day family, Birthday Series 4 of 4.)
 *
 * "Chamak" (چمک / चमक) — the shine. The glam pick: a black-gold-neon disco
 * for 18th/21st/25th parties. A chrome mirror ball drops onto a pure-black
 * stage throwing drifting light dots, the name reveals in gold italic serif
 * with a per-letter stagger, a gift box pops open, photos show in tilted
 * gold frames with glitter stamps, and the VIP badge + wish card close the
 * night.
 *
 * Design system (Director-locked): stage black #111111, neon gold #F4EA00,
 * metallic gold #D4AF37, neon pink #FF4FA3. Fraunces italic 900 display,
 * Bricolage Grotesque 700 body.
 *
 * Director's punch list, built in:
 * - TWO animated CSS layers max: the ball spin + the light-dot drift. No
 *   third layer, no exceptions — a stuttering disco is worse than a static
 *   one.
 * - "STUNNA" replaced by the VIP badge sticker.
 * - marquee strip + foil confetti (rectangles, not dots) in pure CSS.
 * - hard alpha cutoff ≤12 applied to every cutout (dark-stage sheen rule).
 * - ceremony capped at 5 beats + finale; sound opt-in on the finale only;
 *   "Celebrate again" replay.
 *
 * Media lives in public/assets/chamak/ and public/assets/bfday-demo/
 * (decoded at boot from lib/bfday/assets.js — the git pipe cannot carry
 * binaries).
 */

module.exports = {
  slug: 'chamak',
  family: 'bfday',
  name: 'Chamak',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'A black-gold-neon disco birthday — a spinning mirror ball, your name in gold italic, a gift box that pops, photos in tilted gold frames, and the VIP badge to close the night.',
  thumbnail_url: '',
  ogImage: '/assets/chamak/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1: the people ── */
    {
      id: 'recipientName', type: 'text', label: 'Their name', required: true,
      maxLength: 40, placeholder: 'Zoya',
      hint: 'In gold italic over the disco. Make it shine.',
    },
    {
      id: 'senderName', type: 'text', label: 'Your name',
      maxLength: 40, placeholder: 'Kabir',
      hint: 'Signs the wish card at the end.',
    },

    /* ── step 2: the marquee ── */
    {
      id: 'marqueeText', type: 'text', label: 'The neon marquee line', maxLength: 40,
      default: "IT'S YOUR DAY",
      hint: 'The neon-pink strip that scrolls across the stage.',
    },

    /* ── step 3: the gift box line ── */
    {
      id: 'boxLine', type: 'text', label: 'The line on the gift box tap', maxLength: 40,
      default: 'OPEN IT',
      hint: 'The gold all-caps under the box — one tap and it pops.',
    },

    /* ── step 4: the photos ── */
    {
      id: 'photos', type: 'list', label: 'The gold-frame gallery',
      itemLabel: 'Photo', addLabel: 'Add a photo',
      minItems: 3, maxItems: 5,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', maxLength: 50, placeholder: 'under the ball' },
      ],
      default: [],
      hint: 'Three to five photos in tilted gold frames with glitter stamps. Leave it empty and the party samples show.',
    },

    /* ── step 5: the wish ── */
    {
      id: 'wishLine', type: 'textarea', label: 'The closing wish', required: true,
      maxLength: 200, rows: 2,
      default: 'May your year sparkle harder than the ball above you. Happy birthday, superstar.',
      hint: 'On the closing card under the VIP badge.',
    },
  ],

  steps: [
    {
      title: 'The people',
      heading: 'Whose night is it?',
      intro: 'Their name owns the disco. Yours signs the wish card.',
      fields: ['recipientName', 'senderName'],
    },
    {
      title: 'The marquee',
      heading: 'The neon strip',
      intro: 'One short line, all caps, scrolling pink neon across the stage.',
      fields: ['marqueeText'],
    },
    {
      title: 'The gift',
      heading: 'The box line',
      intro: 'The gold command under the box before they tap it open.',
      fields: ['boxLine'],
    },
    {
      title: 'The gallery',
      heading: 'The gold frames',
      intro: 'Three to five photos, tilted gold frames, glitter stamps. Leave them and the samples show.',
      fields: ['photos'],
    },
    {
      title: 'The wish',
      heading: 'The closing card',
      intro: 'Under the VIP badge. Optional song plays only when they tap.',
      fields: ['wishLine', 'bgmSong'],
    },
  ],

  create: {
    eyebrow: 'Chamak · Birthday Series',
    headline: 'Black stage. Gold everything. Their name in lights.',
    intro: 'A mirror ball spins over a pure-black stage, light dots drift, the name reveals letter by letter in gold italic, a gift box pops open to a gold-framed photo gallery, and the VIP badge closes the night. Five short steps and a live preview you can test the whole way through.',
    noun: 'disco',
    designHeading: 'The night-time register',
    designIntro: 'Black + gold + neon pink — the party the other templates let their hair down for.',
    scenes: [
      'the mirror ball drops in spinning, light dots drifting across black',
      'the name reveals letter by letter in gold italic — per-letter stagger',
      'the neon marquee scrolls, the gift box rattles and pops',
      'photos in tilted gold frames with glitter stamps',
      'the VIP badge and your wish close the night — "Celebrate again"',
    ],
    previewCta: 'Tap the box — the preview plays the whole night.',
    previewHelp: 'Watch the ball spin. Two animated layers, tuned for low-end phones.',
    resultLine: 'Send the link. Start the party.',
  },

  /** /chamak/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Zoya',
    senderName: 'Kabir',
    marqueeText: "IT'S YOUR DAY",
    boxLine: 'OPEN IT',
    photos: [
      { photo: '/assets/bfday-demo/chamak-demo-1.jpg', caption: 'under the ball' },
      { photo: '/assets/bfday-demo/chamak-demo-2.jpg', caption: 'bubbles up' },
      { photo: '/assets/bfday-demo/chamak-demo-3.jpg', caption: 'the glitter drop' },
      { photo: '/assets/bfday-demo/chamak-demo-4.jpg', caption: 'the neon crew' },
      { photo: '/assets/bfday-demo/chamak-demo-5.jpg', caption: 'gold-candle cake' },
    ],
    wishLine: 'May your year sparkle harder than the ball above you. Happy birthday, superstar.',
  },

  sections: ['ball', 'name', 'gift', 'gallery', 'wish'],
  theme: {
    bg: '#111111', ink: '#F4EA00', accent: '#FF4FA3', soft: '#1E1B14',
    accentOnDark: '#F4EA00',
    motif: 'star', ampersand: false, serifCase: 'upper', layout: 'cinematic',
  },
};
