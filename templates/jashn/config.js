'use strict';
/**
 * Jashn — Blow the Candles. (Boyfriend Day family, Birthday Series 1 of 4.)
 *
 * "Jashn" (जश्न / جشن) — a celebration. The flagship birthday ceremony: a
 * soft-pastel clay world where the recipient taps open a surprise, a
 * three-tier clay cake rises with their name, and they blow out the candles —
 * for real, through the microphone, with a tap fallback that is always
 * visible — then a confetti burst, a photo reel and a letter finale.
 *
 * Design system (Director-locked): soft cream #F7F0E6 stage, pastel pink
 * #D8A7B1, sage #A8B5A2, gold #C9A227 strictly decorative, body ink #4A3F3A
 * (the pastels alone fail contrast for the letter). Fraunces 800 display,
 * Caveat handwritten accents, DM Sans body.
 *
 * Director's punch list, built in:
 * - ceremony capped at 5 beats + finale; the confetti lives inside the blow
 *   beat, a photo beat is never worth more than the candle-blow.
 * - mic attempt window is 8 seconds, then the tap fallback is offered
 *   visibly — the "or tap the flames" line is on screen from the start.
 * - age candles cap at numeral 9 with a "9+" lock (never infinity).
 * - phone-first at 390px; sound is opt-in on the finale beat only; every
 *   finale carries "Celebrate again".
 *
 * Media lives in public/assets/jashn/ and public/assets/bfday-demo/ (decoded
 * at boot from lib/bfday/assets.js — the git pipe cannot carry binaries).
 */

module.exports = {
  slug: 'jashn',
  family: 'bfday',
  name: 'Jashn',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'Blow the candles for real — a pastel clay cake rises with their name, they blow (or tap) the flames out, confetti falls, and your photos and letter close the party.',
  thumbnail_url: '',
  ogImage: '/assets/jashn/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1: the people ── */
    {
      id: 'recipientName', type: 'text', label: 'Their name', required: true,
      maxLength: 40, placeholder: 'Aarav',
      hint: 'In Fraunces over the cake, and again on the letter.',
    },
    {
      id: 'senderName', type: 'text', label: 'Your name',
      maxLength: 40, placeholder: 'Meera',
      hint: 'Optional. Signs the letter at the end.',
    },

    /* ── step 2: the candles ── */
    {
      id: 'age', type: 'number', label: 'The age they turn',
      min: 1, max: 120, placeholder: '5',
      hint: 'Lit as candles on the cake — tap or blow to put them out. Ages above 9 show a "9+" candle set. Leave it blank and the cake stands on its own.',
    },

    /* ── step 3: the memories ── */
    {
      id: 'photos', type: 'list', label: 'The photo reel',
      itemLabel: 'Photo', addLabel: 'Add a photo',
      minItems: 3, maxItems: 6,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', maxLength: 60, placeholder: 'the midnight cake' },
      ],
      default: [],
      hint: 'Three to six photos drifting through the reel with handwritten captions. Leave it empty and the sample photos show.',
    },

    /* ── step 4: the letter ── */
    {
      id: 'letterText', type: 'textarea', label: 'The letter', required: true,
      maxLength: 2000, rows: 8,
      default: 'Another year of you — and honestly, the best one yet.\n\nThank you for the laughter that arrives before the joke ends, for showing up on the ordinary days, for making everything feel lighter just by being in the room.\n\nMay this year hand you everything you have been quietly wishing for. Happy birthday. Make a wish — I already know it comes true.',
      hint: 'The last screen, handwritten-style on paper grain.',
    },
    {
      id: 'signoff', type: 'text', label: 'The sign-off line',
      maxLength: 60, default: 'always in your corner —',
      hint: 'The small line just above your name.',
    },
  ],

  steps: [
    {
      title: 'The people',
      heading: 'Who is the party for?',
      intro: 'Their name opens the cake. Yours signs the letter.',
      fields: ['recipientName', 'senderName'],
    },
    {
      title: 'The candles',
      heading: 'How many candles?',
      intro: 'Their age, lit on the cake. They will blow (or tap) every flame out.',
      fields: ['age'],
    },
    {
      title: 'The memories',
      heading: 'The photo reel',
      intro: 'Three to six photos in the reel after the confetti. Leave them and the samples show.',
      fields: ['photos'],
    },
    {
      title: 'The letter',
      heading: 'What the wish says',
      intro: 'The letter they read after the last flame goes out. Take your time — this is the part they keep.',
      fields: ['letterText', 'signoff'],
    },
    {
      title: 'The song',
      heading: 'The party song',
      intro: 'Optional — a play button appears on the final screen. Nothing plays until they tap it.',
      fields: ['bgmSong'],
    },
  ],

  create: {
    eyebrow: 'Jashn · Birthday Series',
    headline: 'They blow out the candles. For real.',
    intro: 'A pastel clay celebration: balloons drift in, a three-tier cake rises with their name and age lit as candles, and they blow the flames out — mic if they allow it, tap if they don’t. Then confetti, a photo reel, and your letter. Five short steps and a live preview you can test the whole way through.',
    noun: 'celebration',
    designHeading: 'Soft pastels, one big moment',
    designIntro: 'The candle-blow is the gift wrap. The letter is the gift.',
    scenes: [
      'balloons drift onto a soft-cream stage — "tap to open your surprise"',
      'the three-tier clay cake rises with a wobble, their name in Fraunces',
      'the candles: blow through the mic, or tap each flame — smoke rises',
      'confetti falls, then the photo reel drifts with handwritten captions',
      'your letter on paper grain, the party song, "Celebrate again"',
    ],
    previewCta: 'Blow or tap the flames — the preview plays the whole ceremony.',
    previewHelp: 'The mic asks for permission; the tap fallback is always visible.',
    resultLine: 'Send the link. Let them make the wish.',
  },

  /** /jashn/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Aarav',
    senderName: 'Meera',
    age: 5,
    photos: [
      { photo: '/assets/bfday-demo/jashn-demo-1.jpg', caption: 'the whole family, first thing' },
      { photo: '/assets/bfday-demo/jashn-demo-2.jpg', caption: 'chef for one day' },
      { photo: '/assets/bfday-demo/jashn-demo-3.jpg', caption: 'grandma’s blessings first' },
      { photo: '/assets/bfday-demo/jashn-demo-4.jpg', caption: 'the cake stood no chance' },
      { photo: '/assets/bfday-demo/jashn-demo-5.jpg', caption: 'make a wish' },
      { photo: '/assets/bfday-demo/jashn-demo-6.jpg', caption: 'midnight surprise crew' },
    ],
    letterText: 'Another year of you — and honestly, the best one yet.\n\nThank you for the laughter that arrives before the joke ends, for showing up on the ordinary days, for making everything feel lighter just by being in the room.\n\nMay this year hand you everything you have been quietly wishing for. Happy birthday, Aarav. Make a wish — I already know it comes true.',
    signoff: 'always in your corner —',
  },

  sections: ['intro', 'cake', 'blow', 'reel', 'letter'],
  theme: {
    bg: '#F7F0E6', ink: '#4A3F3A', accent: '#D8A7B1', soft: '#EFE6D6',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
