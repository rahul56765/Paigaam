'use strict';
/**
 * Yaadon — Memory Scrapbook. (Boyfriend Day family, Birthday Series 2 of 4.)
 *
 * "Yaadon" (यादों) — of memories. A hand-made scrapbook the recipient
 * flips through: a kraft-paper cover with a washi corner and a burgundy wax
 * seal ("For you — open slowly."), which lifts on tap and opens the book.
 * Inside: polaroid pages with handwritten captions, pressed flowers, ink
 * doodles and taped stickers, then a peel-reveal "reasons" spread, then the
 * final letter on lined paper.
 *
 * Design system (Director-locked): kraft #F5EEE3 / #E8D8C8 fields, brass
 * #B08D57, terracotta #9A5B4D, sage #6B7A5E. Caveat 700 marginalia,
 * Fraunces small-caps headers, DM Sans captions.
 *
 * Director's punch list, built in:
 * - the page-flip degrades to a horizontal swipe/scroll of spreads on
 *   low-end Android (no 3D transforms when the device reports limited
 *   memory or no 3D-transform support; verified on a slow-device profile).
 * - polaroid rotations ≤3°, alternating direction per page — imperfect,
 *   never messy.
 * - the "reasons" spread reuses the Kashf scratch mechanic (canvas foil →
 *   here a paper-peel, same destination-out pattern).
 * - ceremony capped at 5 beats + finale; sound opt-in on the finale only;
 *   "Read it again" on the finale.
 *
 * Media lives in public/assets/yaadon/ and public/assets/bfday-demo/
 * (decoded at boot from lib/bfday/assets.js — the git pipe cannot carry
 * binaries).
 */

const REASONS_DEFAULTS = [
  'the way you laugh at your own jokes first',
  'you remember the small things I mention once',
  'every playlist you make is half my favourite songs',
  'you show up — ordinary days, no occasion needed',
];

module.exports = {
  slug: 'yaadon',
  family: 'bfday',
  name: 'Yaadon',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'A hand-made scrapbook they flip through — polaroids with handwritten captions, pressed flowers, reasons hidden under paper peel-strips, and your letter on lined paper.',
  thumbnail_url: '',
  ogImage: '/assets/yaadon/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1: the people ── */
    {
      id: 'recipientName', type: 'text', label: 'Their name', required: true,
      maxLength: 40, placeholder: 'Aarav',
      hint: 'On the cover and through the book.',
    },
    {
      id: 'senderName', type: 'text', label: 'Your name',
      maxLength: 40, placeholder: 'Meera',
      hint: 'Signs the letter at the end.',
    },

    /* ── step 2: the cover ── */
    {
      id: 'coverLine', type: 'text', label: 'The cover line', maxLength: 60,
      default: 'For you — open slowly.',
      hint: 'Under the wax seal on the kraft cover.',
    },
    {
      id: 'scrapbookDate', type: 'date', label: 'The date for the title spread',
      hint: 'Small-caps on the inside title page — the day you are giving them this.',
    },

    /* ── step 3: the pages ── */
    {
      id: 'photos', type: 'list', label: 'The scrapbook pages',
      itemLabel: 'Polaroid', addLabel: 'Add a page',
      minItems: 3, maxItems: 6,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', maxLength: 60, placeholder: 'chai at the tea stall, first day' },
      ],
      default: [],
      hint: 'Three to six polaroid pages. Leave it empty and the sample pages show.',
    },

    /* ── step 4: the reasons ── */
    {
      id: 'reasons', type: 'list', label: 'Reasons under the peel-strips',
      itemLabel: 'Reason', addLabel: 'Add a reason',
      minItems: 3, maxItems: 6,
      item: { type: 'text', maxLength: 90, placeholder: 'the way you laugh at your own jokes first' },
      default: REASONS_DEFAULTS,
      hint: 'Hidden under paper peel-strips — they scratch or tap to lift each one.',
    },

    /* ── step 5: the letter ── */
    {
      id: 'letterText', type: 'textarea', label: 'The letter', required: true,
      maxLength: 2000, rows: 8,
      default: 'Some people get cards. You get a whole scrapbook — because one card could never hold this many years of us.\n\nThank you for every memory in these pages, and for the ones that didn’t fit. The best ones haven’t happened yet.\n\nHappy birthday. Here’s to filling the next book too.',
      hint: 'The final spread, on lined paper.',
    },
    {
      id: 'signoff', type: 'text', label: 'The sign-off line',
      maxLength: 60, default: 'yours, in every page —',
      hint: 'The small line just above your name.',
    },
  ],

  steps: [
    {
      title: 'The people',
      heading: 'Whose memories are these?',
      intro: 'Their name is on the cover. Yours signs the letter.',
      fields: ['recipientName', 'senderName'],
    },
    {
      title: 'The cover',
      heading: 'First impressions',
      intro: 'The line under the wax seal, and the date on the title spread.',
      fields: ['coverLine', 'scrapbookDate'],
    },
    {
      title: 'The pages',
      heading: 'The polaroids',
      intro: 'Three to six pages, captions handwritten under each. Leave them and the samples show.',
      fields: ['photos'],
    },
    {
      title: 'The reasons',
      heading: 'Hidden under the peel-strips',
      intro: 'Three to six reasons they uncover one by one. Nudge, don’t tell.',
      fields: ['reasons'],
    },
    {
      title: 'The letter',
      heading: 'The last spread',
      intro: 'On lined paper, handwritten-style. This is the part they keep.',
      fields: ['letterText', 'signoff'],
    },
    {
      title: 'The song',
      heading: 'The background song',
      intro: 'Optional — a play button appears on the final spread. Nothing plays until they tap it.',
      fields: ['bgmSong'],
    },
  ],

  create: {
    eyebrow: 'Yaadon · Birthday Series',
    headline: 'A scrapbook they flip through, page by page.',
    intro: 'A kraft-paper cover, a wax seal that lifts on tap, polaroid pages with handwritten captions, pressed flowers, reasons hidden under peel-strips, and your letter on lined paper. Six short steps and a live preview you can test the whole way through.',
    noun: 'scrapbook',
    designHeading: 'Imperfect on purpose',
    designIntro: 'Slightly tilted, slightly taped, completely yours.',
    scenes: [
      'the kraft cover: a wax seal, a washi corner, "open slowly"',
      'the seal lifts and the book flips open to the title spread',
      'polaroid pages — photos, handwritten captions, pressed flowers, tape',
      'the reasons spread: peel each strip to uncover a line',
      'the letter on lined paper, your song, "Read it again"',
    ],
    previewCta: 'Lift the seal — the preview opens the whole book.',
    previewHelp: 'Peel the reason strips one by one; they reveal like the real thing.',
    resultLine: 'Send the link. Tell them to open slowly.',
  },

  /** /yaadon/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Aarav',
    senderName: 'Meera',
    coverLine: 'For you — open slowly.',
    scrapbookDate: '2026-10-03',
    photos: [
      { photo: '/assets/bfday-demo/yaadon-demo-1.jpg', caption: 'chai at the tea stall, first day' },
      { photo: '/assets/bfday-demo/yaadon-demo-2.jpg', caption: 'the usual bench, the usual chaos' },
      { photo: '/assets/bfday-demo/yaadon-demo-3.jpg', caption: 'diyas on the balcony that diwali' },
      { photo: '/assets/bfday-demo/yaadon-demo-4.jpg', caption: 'window seat, nowhere important' },
      { photo: '/assets/bfday-demo/yaadon-demo-5.jpg', caption: 'we stayed till the sun gave up' },
      { photo: '/assets/bfday-demo/yaadon-demo-6.jpg', caption: 'last birthday. this one’s better.' },
    ],
    reasons: REASONS_DEFAULTS,
    letterText: 'Some people get cards. You get a whole scrapbook — because one card could never hold this many years of us.\n\nThank you for every memory in these pages, and for the ones that didn’t fit. The best ones haven’t happened yet.\n\nHappy birthday, Aarav. Here’s to filling the next book too.',
    signoff: 'yours, in every page —',
  },

  sections: ['cover', 'title', 'pages', 'reasons', 'letter'],
  theme: {
    bg: '#F5EEE3', ink: '#4A3F3A', accent: '#9A5B4D', soft: '#E8D8C8',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'centered',
  },
};
