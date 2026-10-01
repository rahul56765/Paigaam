'use strict';
/**
 * Daa'wat — the red velvet door reveal. (Boyfriend Day family, template 20.)
 *
 * "Daa'wat" (दावत) — the invitation, the feast. A replica of the cinematic
 * "tap to open" genre Naqsh Digital sells at ₹1,999 with 2–3 day delivery:
 * red velvet curtains part on a tap to reveal a maroon wedding card, at ₹19
 * and instant. Built from the Director's spec + 7 punch-list rulings.
 *
 * The six beats, tap-through (one beat per full screen):
 *   1. Closed hero — the velvet scene with the live "Tap to open" plaque
 *      (reusable component, Cormorant Garamond italic, 2.4s soft pulse).
 *      Ambient loop is drape-sway + candle-flicker ONLY (ruling #2).
 *   2. The reveal — curtain halves slide apart (1.4s, cubic-bezier(0.65,0,0.35,1),
 *      heavy fabric, no overshoot), a one-shot petal burst (8–12 petals,
 *      ~2s, settles) and the light bloom through the gap.
 *   3. The card — maroon textured card, double gold border in CSS (ruling #5),
 *      names in Great Vibes cream #f8ead0 ≥44px, 60ms per-letter stagger,
 *      no glow (ruling #4), the gold divider, then date, venue, message.
 *   4. The countdown — live DD/HH/MM/SS tiles to the big day (standing pattern).
 *   5. The gallery — gold-frame photo corners, event cards beneath (standing
 *      pattern; corners reuse the check against Shubh Vivah's tone).
 *   6. The closing — the seal, the sign-off, "Made with love on Paigaam",
 *      and the seal-tap close that re-veils the curtains (beat 1 again).
 *
 * The seam guarantee (ruling #1): Beat 1's closed hero is the two curtain
 * halves composited in CSS — left half + right half of the ONE wide hero
 * scene the Director generated and slice-verified. Beat 1 → Beat 2 is the
 * same fabric, guaranteed. hero-closed.jpg ships as the no-JS / og fallback.
 *
 * Media lives in public/assets/daawat/ and public/assets/bfday-demo/
 * (decoded at boot from lib/bfday/assets.js — the git pipe cannot carry
 * binaries): hero-closed.jpg, curtain-left/right.jpg, card-bg.jpg,
 * divider-gold.png, seal.png, petal.png, og.jpg, demo-1..5.jpg.
 */

module.exports = {
  slug: 'daawat',
  family: 'bfday',
  name: "Daa'wat",
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: "The cinematic tap-to-open wedding invite — red velvet curtains part on a tap, petals burst, and a maroon-and-gold card bears your names, a live countdown and your gallery. The ceremony Naqsh sells at ₹1,999, instant and at ₹19.",
  thumbnail_url: '',
  ogImage: '/assets/daawat/og.jpg',
  version: 1,
  editable: true,
  displayField: 'brideName',

  fields: [
    /* ── step 1: the couple ── */
    {
      id: 'brideName', type: 'text', label: "Bride's name", required: true,
      maxLength: 30, placeholder: 'Ayesha',
      hint: 'In Great Vibes script, cream on maroon, revealed letter by letter.',
    },
    {
      id: 'groomName', type: 'text', label: "Groom's name", required: true,
      maxLength: 30, placeholder: 'Imran',
      hint: 'Appears beside the bride\'s — "Imran weds Ayesha" ordering is handled for you.',
    },

    /* ── step 2: the occasion ── */
    {
      id: 'eventName', type: 'text', label: 'The occasion line', maxLength: 40,
      default: 'Wedding Ceremony',
      hint: 'The small-caps line above the names on the card.',
    },
    {
      id: 'eventDate', type: 'date', label: 'The big day', required: true,
      hint: 'This powers the live countdown behind the card.',
    },
    {
      id: 'eventTime', type: 'text', label: 'Time', maxLength: 40,
      placeholder: '7:00 PM onwards',
      hint: 'Optional — whatever the family calls it.',
    },
    {
      id: 'venue', type: 'text', label: 'Venue', required: true, maxLength: 120,
      placeholder: 'The Grand Hotel, Mumbai',
    },

    /* ── step 3: the message ── */
    {
      id: 'inviteLine', type: 'textarea', label: 'The invitation line', maxLength: 160, rows: 2,
      default: 'Together with our families, we joyfully invite you to celebrate our wedding.',
      hint: 'Under the gold divider on the card.',
    },

    /* ── step 4: the gallery ── */
    {
      id: 'photos', type: 'list', label: 'The gold-frame gallery',
      itemLabel: 'Photo', addLabel: 'Add a photo',
      minItems: 0, maxItems: 5,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', maxLength: 50, placeholder: 'a memory' },
      ],
      default: [],
      hint: 'Up to five photos in gold corners with event cards beneath. Leave it empty and the couple samples show.',
    },

    /* ── step 5: the closing ── */
    {
      id: 'closingMessage', type: 'textarea', label: 'The closing message', maxLength: 160, rows: 2,
      default: 'Your presence will make our celebration complete.',
      hint: 'Above the seal on the final beat.',
    },
  ],

  steps: [
    {
      title: 'The couple',
      heading: 'Whose names on the card?',
      intro: 'Both names open the reveal — script, cream on maroon, letter by letter.',
      fields: ['brideName', 'groomName'],
    },
    {
      title: 'The occasion',
      heading: 'The auspicious day',
      intro: 'Date, time and venue — the date drives the live countdown.',
      fields: ['eventName', 'eventDate', 'eventTime', 'venue'],
    },
    {
      title: 'The invitation line',
      heading: 'Your invitation line',
      intro: 'One warm line under the gold divider on the maroon card.',
      fields: ['inviteLine'],
    },
    {
      title: 'The gallery',
      heading: 'The gold frames',
      intro: 'Up to five photos in gold corners with event cards beneath. Leave them and the samples show.',
      fields: ['photos'],
    },
    {
      title: 'The closing',
      heading: 'The closing message',
      intro: 'Above the seal. Then the seal closes the ceremony — the curtains re-veil.',
      fields: ['closingMessage', 'bgmSong'],
    },
  ],

  create: {
    eyebrow: "Daa'wat · A Wedding Invitation",
    headline: 'Tap. The curtains part. Your wedding begins.',
    intro: "A red velvet door reveal: the \"tap to open\" plaque pulses over candlelit velvet, the curtains part on heavy fabric to a one-shot petal burst and the light bloom, and a maroon-and-gold card bears your names in script. A live countdown, a gold-frame gallery and the seal close it. Five short steps; a live preview follows every word.",
    noun: 'invitation',
    designHeading: 'Six beats, one ceremony',
    designIntro: 'It opens on the closed velvet door and closes when the seal re-veils it — the whole ceremony in one link.',
    scenes: [
      'the closed hero: candlelit velvet, the "tap to open" plaque pulsing softly',
      'the reveal: the curtains part on heavy fabric, petals burst once, light blooms through the gap',
      'the maroon card: your names in script, the gold divider, the invitation line',
      'the live countdown ticking to the big day',
      'photos in gold corners with event cards beneath',
      'the closing message and the gold seal — tap it and the curtains re-veil',
    ],
    previewCta: 'Tap the plaque — the preview plays the whole ceremony.',
    previewHelp: 'Watch the seam: the closed hero and the parting curtains are the same fabric, guaranteed.',
    resultLine: 'Send the link. The curtains do the rest.',
  },

  /** /daawat/demo, the collection thumbnail and the detail page. */
  demo: {
    brideName: 'Ayesha',
    groomName: 'Imran',
    eventName: 'Wedding Ceremony',
    eventDate: '2026-12-05',
    eventTime: '7:00 PM onwards',
    venue: 'The Grand Hotel, Mumbai',
    inviteLine: 'Together with our families, we joyfully invite you to celebrate our wedding.',
    photos: [
      { photo: '/assets/bfday-demo/daawat-demo-1.jpg', caption: 'the palace courtyard' },
      { photo: '/assets/bfday-demo/daawat-demo-2.jpg', caption: 'mehndi by lamplight' },
      { photo: '/assets/bfday-demo/daawat-demo-3.jpg', caption: 'phoolon ki chadar' },
      { photo: '/assets/bfday-demo/daawat-demo-4.jpg', caption: 'the sangeet' },
      { photo: '/assets/bfday-demo/daawat-demo-5.jpg', caption: 'the varmala' },
    ],
    closingMessage: 'Your presence will make our celebration complete.',
  },

  sections: ['hero', 'reveal', 'card', 'countdown', 'gallery', 'closing'],
  theme: {
    bg: '#1A0505', ink: '#F8EAD0', accent: '#C9A24B', soft: '#4A0F10',
    paperInk: '#2B1010',
    accentOnDark: '#D4B96A',
    motif: 'seal', ampersand: true, serifCase: 'title', layout: 'cinematic',
  },
};
