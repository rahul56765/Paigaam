'use strict';
/**
 * Nishaan — Milestone. (Boyfriend Day family, Birthday Series 3 of 4.)
 *
 * "Nishaan" (نشاان / निशान) — a mark, the stamp you leave. The adult pick:
 * pure typographic luxury for 30th/40th/50th birthdays. A warm-white cotton
 * field; the age numeral fills the viewport in Fraunces 900 with the gold
 * foil texture masked inside the glyphs; a type-collage band in alternating
 * serif/script; a gold-ruled timeline; one portrait in a museum-mat frame;
 * and a champagne-toast finale.
 *
 * Design system (Director-locked): warm white #FFFDF8, ink #2C2A26, gold
 * #C9A227 strictly decorative, one deep-red accent #8C2F39 — never red/green
 * festival styling. Fraunces 900 display, DM Sans 300 air.
 *
 * Director's punch list, built in:
 * - the foil texture is baked at 2048px (2× retina) so the background-clip
 *   numerals don't shimmer.
 * - timeline: 3–5 entries.
 * - ceremony capped at 5 beats + finale; sound opt-in on the finale only;
 *   "Raise a toast again" replay.
 *
 * Media lives in public/assets/nishaan/ and public/assets/bfday-demo/
 * (decoded at boot from lib/bfday/assets.js — the git pipe cannot carry
 * binaries).
 */

const TIMELINE_DEFAULTS = [
  { year: '1986', line: 'the beginning' },
  { year: '2008', line: 'the city, the first job, the small room' },
  { year: '2014', line: 'the family begins' },
  { year: '2026', line: 'still going — legend' },
];

module.exports = {
  slug: 'nishaan',
  family: 'bfday',
  name: 'Nishaan',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'A milestone birthday as typographic luxury — the age as a giant gold-foil numeral, a type-collage of the year, a gold-ruled timeline, one dignified portrait, and a toast.',
  thumbnail_url: '',
  ogImage: '/assets/nishaan/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1: the person ── */
    {
      id: 'recipientName', type: 'text', label: 'Their name', required: true,
      maxLength: 40, placeholder: 'Vikram',
      hint: 'On the collage band and the toast.',
    },
    {
      id: 'senderName', type: 'text', label: 'Your name',
      maxLength: 40, placeholder: 'Nadia',
      hint: 'Signs the wish at the end.',
    },

    /* ── step 2: the number ── */
    {
      id: 'age', type: 'number', label: 'The milestone age', required: true,
      min: 18, max: 120, placeholder: '40',
      hint: 'Fills the first screen as a giant gold-foil numeral.',
    },
    {
      id: 'eventDate', type: 'date', label: 'The birthday',
      hint: 'Small-caps under the collage band.',
    },

    /* ── step 3: the collage ── */
    {
      id: 'collageWords', type: 'list', label: 'The type-collage band',
      itemLabel: 'Word', addLabel: 'Add a word',
      minItems: 3, maxItems: 6,
      item: { type: 'text', maxLength: 24, placeholder: 'YEARS' },
      default: ['THIRTY', 'years', 'of', 'being', 'LEGEND'],
      hint: 'Three to six words in alternating serif/script and sizes — the band under the numeral. Short and loud reads best.',
    },

    /* ── step 4: the timeline ── */
    {
      id: 'timeline', type: 'list', label: 'The timeline',
      itemLabel: 'Milestone', addLabel: 'Add a milestone',
      minItems: 3, maxItems: 5,
      shape: [
        { id: 'year', type: 'text', label: 'Year', maxLength: 12, placeholder: '1996' },
        { id: 'line', type: 'text', label: 'One line', maxLength: 70, placeholder: 'the beginning' },
      ],
      default: TIMELINE_DEFAULTS,
      hint: 'Three to five gold-ruled entries, oldest first. The years that made them.',
    },

    /* ── step 5: the portrait + wish ── */
    {
      id: 'portrait', type: 'image', label: 'A portrait',
      alt: 'A portrait of the celebrant',
      hint: 'Optional — in the museum-mat frame. Leave it blank and a dignified sample portrait shows.',
    },
    {
      id: 'wishLine', type: 'textarea', label: 'The toast wish', required: true,
      maxLength: 200, rows: 2,
      default: 'To the years behind you — and the ones only you could make look this good.',
      hint: 'One italic line under the clinking glasses.',
    },
  ],

  steps: [
    {
      title: 'The person',
      heading: 'Whose milestone?',
      intro: 'Their name carries the collage and the toast. Yours signs the wish.',
      fields: ['recipientName', 'senderName'],
    },
    {
      title: 'The number',
      heading: 'The big number',
      intro: 'The age becomes a viewport-filling gold numeral, and the date sits under the collage.',
      fields: ['age', 'eventDate'],
    },
    {
      title: 'The collage',
      heading: 'The type-collage band',
      intro: 'Three to six words, mixed serif and script, mixed sizes. Loud and short.',
      fields: ['collageWords'],
    },
    {
      title: 'The timeline',
      heading: 'The gold-ruled years',
      intro: 'Three to five entries — a year and a line each, oldest first.',
      fields: ['timeline'],
    },
    {
      title: 'The toast',
      heading: 'The portrait and the wish',
      intro: 'One portrait in the mat frame, then your one-line toast. Optional song plays only when they tap.',
      fields: ['portrait', 'wishLine', 'bgmSong'],
    },
  ],

  create: {
    eyebrow: 'Nishaan · Birthday Series',
    headline: 'The milestone, set in gold.',
    intro: 'A warm-white field, the age as a giant gold-foil numeral, a type-collage band, the gold-ruled years, one portrait in a museum mat, and a champagne toast. Five short steps and a live preview you can test the whole way through.',
    noun: 'milestone',
    designHeading: 'Typographic luxury, zero cutesy',
    designIntro: 'Ink, gold, one deep red. Nothing else gets in.',
    scenes: [
      'the numeral: their age fills the screen in gold foil',
      'the type-collage band — THIRTY years of being LEGEND, alternating serif and script',
      'the timeline: gold rules between the years that made them',
      'one portrait in a museum-mat frame, dignified',
      'the toast: clinking glasses, your one-line wish, "Raise a toast again"',
    ],
    previewCta: 'Scroll the whole milestone — the preview follows every word.',
    previewHelp: 'The foil numeral is the first thing everyone screenshots.',
    resultLine: 'Send the link. Let the number do the talking.',
  },

  /** /nishaan/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Vikram',
    senderName: 'Nadia',
    age: 40,
    eventDate: '2026-10-12',
    collageWords: ['FORTY', 'years', 'of', 'being', 'LEGEND'],
    timeline: [
      { year: '1986', line: 'the beginning' },
      { year: '2008', line: 'the city, the first job, the small room' },
      { year: '2014', line: 'the family begins' },
      { year: '2026', line: 'still going — legend' },
    ],
    portrait: '/assets/bfday-demo/nishaan-portrait-1.jpg',
    wishLine: 'To the years behind you — and the ones only you could make look this good.',
  },

  sections: ['numeral', 'collage', 'timeline', 'portrait', 'toast'],
  theme: {
    bg: '#FFFDF8', ink: '#2C2A26', accent: '#8C2F39', soft: '#F4F0E6',
    motif: 'ring', ampersand: false, serifCase: 'upper', layout: 'editorial',
  },
};
