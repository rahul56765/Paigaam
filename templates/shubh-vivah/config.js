'use strict';
/**
 * Shubh Vivah — a Hindu wedding invitation. (Boyfriend Day family, template 11.)
 *
 * "Shubh vivah" (शुभ विवाह) — the auspicious wedding. A single scrollable
 * story-page that reads like a traditional card translated to the web: a live
 * countdown opener, the families' blessings, the muhurtham card in a full
 * gold corner frame, a photo-memory beat and a closing band.
 *
 * Design system (Director-locked): ivory #FBF6EC base, deep maroon #8E1F2F as
 * the only accent, gold #C9A24B strictly decorative (borders, rules,
 * ornaments — never text on ivory), body ink #4A3226. Cormorant Garamond 600
 * display + serif body; the couple's names may carry a script accent.
 *
 * Media lives in public/shubh-vivah/ (decoded at boot by lib/bfday/assets.js —
 * the git pipe cannot carry binaries): the four gold corner ornaments, the
 * namaste couple illustration, the ivory paper texture, the share card and
 * the demo photo. Uploaded photos go through the shared /api/<slug>/upload
 * mechanism like every family member.
 *
 * Reduced motion: the scroll reveals collapse to instant, still states; the
 * countdown keeps ticking (it is information, not decoration).
 */

const CLOSING = 'We can\'t wait to celebrate this beautiful day with you.';

module.exports = {
  slug: 'shubh-vivah',
  family: 'bfday',
  name: 'Shubh Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A traditional Hindu wedding invitation as a single story-page: a live countdown to the big day, the families\' blessings, the muhurtham card framed in gold, a framed photograph, and a closing blessing.',
  thumbnail_url: '',
  ogImage: '/shubh-vivah/og.jpg',
  version: 1,
  editable: true,
  displayField: 'brideName',

  fields: [
    /* ── step 1: the couple ── */
    {
      id: 'brideName', type: 'text', label: "Bride's name", required: true,
      maxLength: 40, placeholder: 'Sita',
      hint: 'The names open the page and close it — "With love, Ram & Sita".',
    },
    {
      id: 'groomName', type: 'text', label: "Groom's name", required: true,
      maxLength: 40, placeholder: 'Ram',
    },

    /* ── step 2: the families ── */
    {
      id: 'parentsLine1', type: 'text', label: 'First family', maxLength: 90,
      placeholder: 'Mr. Suresh Sharma & Mrs. Meena Suresh',
      hint: 'Optional. "With the blessings of…" — leave both blank and this card simply isn\'t there.',
    },
    {
      id: 'parentsLine2', type: 'text', label: 'Second family', maxLength: 90,
      placeholder: 'Mr. Ramesh Verma & Mrs. Kamala Verma',
    },

    /* ── step 3: the muhurtham ── */
    {
      id: 'eventName', type: 'text', label: 'The occasion line', maxLength: 60,
      default: 'Shubh Vivah',
      hint: 'The big serif headline on the invitation card.',
    },
    {
      id: 'eventDate', type: 'date', label: 'Wedding date', required: true,
      hint: 'This powers the live countdown on the opening screen.',
    },
    {
      id: 'eventTime', type: 'text', label: 'Time', maxLength: 40,
      placeholder: '6:45 AM onwards',
      hint: 'Optional — muhurtham, baraat, whatever the family calls it.',
    },
    {
      id: 'venue', type: 'text', label: 'Venue', required: true, maxLength: 120,
      placeholder: 'The Roseate, New Delhi',
    },

    /* ── step 4: the photograph ── */
    {
      id: 'photo', type: 'image', label: 'A photo of the couple',
      alt: 'A photograph of the couple',
      hint: 'Optional — leave it blank and the namaste illustration takes the frame.',
    },
    {
      id: 'photoCaption', type: 'text', label: 'A line under the photo', maxLength: 90,
      placeholder: 'Two families, one celebration',
    },

    /* ── step 5: the closing ── */
    {
      id: 'closingMessage', type: 'textarea', label: 'The closing message', maxLength: 240, rows: 3,
      default: CLOSING,
      hint: 'On the maroon band at the very end. "With love, {names}" is always added beneath it.',
    },
  ],

  steps: [
    {
      title: 'The couple',
      heading: 'Whose big day is it?',
      intro: 'Both names open the page over the countdown, and sign the closing band.',
      fields: ['brideName', 'groomName'],
    },
    {
      title: 'The families',
      heading: 'With the blessings of',
      intro: 'The parents\' card — quiet, generous, optional. Leave both blank and it simply isn\'t there.',
      fields: ['parentsLine1', 'parentsLine2'],
    },
    {
      title: 'The muhurtham',
      heading: 'The auspicious day',
      intro: 'Date, time and venue inside the full gold frame. The date drives the live countdown.',
      fields: ['eventName', 'eventDate', 'eventTime', 'venue'],
    },
    {
      title: 'The photograph',
      heading: 'One photograph',
      intro: 'Framed in the same gold corners. Blank gets the namaste illustration — never an empty frame.',
      fields: ['photo', 'photoCaption'],
    },
    {
      title: 'The closing',
      heading: 'The closing band',
      intro: 'One warm line on maroon, then "With love," and the couple\'s names.',
      fields: ['closingMessage'],
    },
  ],

  create: {
    eyebrow: 'Shubh Vivah · A Wedding Invitation',
    headline: 'The wedding card, translated to the web.',
    intro: 'One link the whole family can open: a live countdown to the big day, the families\' blessings, the muhurtham framed in gold, a photograph, and a closing blessing. Five short steps; a live preview follows every word.',
    noun: 'invitation',
    designHeading: 'Five beats, one celebration',
    designIntro: 'It opens on the countdown — the part everyone re-opens — and closes with your names on maroon.',
    scenes: [
      'the opening: "Our new beginning starts in" over a live countdown, ticking to the day',
      'the families\' card — "With the blessings of", small caps, generous ivory',
      'the muhurtham card in the full gold corner frame, the namaste couple at its foot',
      'one photograph in the same gold frame — or the illustration if you skip it',
      'the closing band on deep maroon: your message, then "With love, Ram & Sita"',
    ],
    previewCta: 'Open it exactly as the family will.',
    previewHelp: 'Scroll all the way down — the countdown is live.',
    resultLine: 'Send the link to the family group. The countdown does the rest.',
  },

  /** /shubh-vivah/demo, the gallery thumbnail and the detail page. */
  demo: {
    brideName: 'Sita',
    groomName: 'Ram',
    parentsLine1: 'Mr. Suresh Sharma & Mrs. Meena Suresh',
    parentsLine2: 'Mr. Ramesh Verma & Mrs. Kamala Verma',
    eventName: 'Shubh Vivah',
    eventDate: '2026-08-15',
    eventTime: '6:45 AM onwards',
    venue: 'The Roseate, New Delhi',
    photo: '',
    photoCaption: 'Two families, one celebration',
    closingMessage: CLOSING,
  },

  sections: ['countdown', 'blessings', 'muhurtham', 'photo', 'closing'],
  theme: {
    bg: '#FBF6EC', ink: '#4A3226', accent: '#8E1F2F', soft: '#F4EBDA',
    motif: 'dove', ampersand: true, serifCase: 'title', layout: 'centered',
  },
};
