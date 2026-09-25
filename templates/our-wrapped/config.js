'use strict';
/**
 * Naghma — Our Wrapped. (Boyfriend Day family, template 5.)
 *
 * "Naghma" (نغمہ / नग्मा) is melody — fitting for a cinematic year-in-review
 * that ends on your song. Scroll-snap screens, night-mode palette, tabular-nums
 * count-up animations. The sender personalises who it is for, the year, the
 * days-together count, up to eight stat moments (count + unit + caption), a
 * song card (YouTube links embed and play on the page; Spotify and other
 * links get a branded play button), and a closing note.
 *
 * No media assets: all illustrations are inline SVG. Fonts: Inter + Fraunces +
 * Caveat (Google Fonts). Reduced motion: scroll-behaviour collapses to auto,
 * count-up jumps to the final value instantly.
 */

const DEFAULT_MOMENTS = [
  { count: 412, unit: 'photos together', caption: 'proof that we were here.' },
  { count: 38,  unit: 'late-night calls', caption: 'when the world slept, we talked.' },
  { count: 1090, unit: 'cups of chai shared', caption: 'three a day, always yours first.' },
  { count: 19364, unit: 'texts sent', caption: 'half of them just saying "good morning."' },
  { count: 156, unit: 'evening walks', caption: 'same road, never the same conversation.' },
];

module.exports = {
  slug: 'our-wrapped',
  family: 'bfday',
  name: 'Naghma',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Our Wrapped — a cinematic night-mode year-in-review: scroll through your days together, your numbers, your song and a closing note, one full-screen at a time.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  displayField: 'senderName',

  fields: [
    /* ── step 1: who it's for ── */
    {
      id: 'senderName', type: 'text', label: 'Your name', required: true,
      maxLength: 40, placeholder: 'Aarav',
      hint: "Appears on the closing card alongside the recipient's name.",
    },
    {
      id: 'recipientName', type: 'text', label: 'Their name', required: true,
      maxLength: 40, placeholder: 'Meera',
      hint: 'Appears on the closing card alongside your name.',
    },

    /* ── step 2: the recap ── */
    {
      id: 'year', type: 'text', label: 'The year', maxLength: 10, default: '2026',
      hint: 'Shows in the title as "Our Wrapped 2026". Change it to match your year.',
    },
    {
      id: 'daysTogether', type: 'number', label: 'Days together', min: 0, max: 99999,
      default: 1247,
      hint: 'The big number on the opening screen and the closing card.',
    },
    {
      id: 'titleCaption', type: 'text', label: 'Caption under the days count',
      maxLength: 80, default: 'every single one, yours.',
    },

    /* ── step 3: the moments ── */
    {
      id: 'moments', type: 'list', label: 'Your moments',
      itemLabel: 'Moment', addLabel: 'Add a moment',
      minItems: 1, maxItems: 8,
      shape: [
        { id: 'count', type: 'number', label: 'The number', required: true, min: 0, max: 9999999 },
        { id: 'unit',  type: 'text',   label: 'The unit',   required: true, maxLength: 60,
          hint: 'e.g. "photos together", "late-night calls"' },
        { id: 'caption', type: 'text', label: 'The caption', maxLength: 120,
          hint: 'One short line below the number.' },
      ],
      default: DEFAULT_MOMENTS,
      hint: 'Each moment gets its own full screen. Edit our defaults or add your own — up to eight.',
    },

    /* ── step 4: the song ── */
    {
      id: 'songTitle', type: 'text', label: 'Song title', maxLength: 80,
      default: 'Tum Se Hi',
    },
    {
      id: 'songArtist', type: 'text', label: 'Artist or line', maxLength: 80,
      default: 'our forever soundtrack',
      hint: 'Can be the artist name, or a short phrase about the song.',
    },
    {
      id: 'songUrl', type: 'url', label: 'Paste a Spotify or YouTube link',
      hint: 'e.g. open.spotify.com/track/… or youtube.com/watch?v=… — YouTube links play right on the page, Spotify opens in a tap.',
    },
    {
      id: 'songCaption', type: 'text', label: 'Caption under the song card', maxLength: 120,
      default: 'the song that knows exactly where we are.',
    },

    /* ── step 5: the closing ── */
    {
      id: 'closingNote', type: 'textarea', label: 'Closing note', maxLength: 300, rows: 3,
      default: 'thank you for being my favorite chapter, again and again.',
      hint: 'Appears in the handwritten Caveat font on the last screen.',
    },
    {
      id: 'startDate', type: 'text', label: 'Together since', maxLength: 50,
      default: '14 Feb 2023',
      hint: 'Shown on the closing card as "since 14 Feb 2023".',
    },
  ],

  steps: [
    {
      title: "Who it's for",
      heading: 'Who is this for?',
      intro: 'Your names go on the closing card — the last screen they land on.',
      fields: ['senderName', 'recipientName'],
    },
    {
      title: 'The recap',
      heading: 'The opening screen',
      intro: 'The year, your days together and the caption that opens the whole thing.',
      fields: ['year', 'daysTogether', 'titleCaption'],
    },
    {
      title: 'Your moments',
      heading: 'Your moments',
      intro: 'Each moment becomes a full-screen number with a caption. Edit our defaults or write your own.',
      fields: ['moments'],
    },
    {
      title: 'Your song',
      heading: 'Your song',
      intro: 'A song card mid-way through the scroll — add a link to make it playable.',
      fields: ['songTitle', 'songArtist', 'songUrl', 'songCaption'],
    },
    {
      title: 'The closing',
      heading: 'The closing note',
      intro: 'The handwritten note and the date you started — the last thing they read.',
      fields: ['closingNote', 'startDate'],
    },
  ],

  create: {
    eyebrow: 'Naghma · Our Wrapped',
    headline: 'A year of us, in one scroll.',
    intro: 'A cinematic night-mode recap of your year together. Each screen reveals a number — days, calls, messages — with a count-up animation, your song, and a handwritten closing note. Five short steps, two required fields, and a preview that follows every keystroke.',
    noun: 'wrapped',
    designHeading: 'One scroll, the whole year',
    designIntro: 'It opens on your days together, then scrolls through your moments, your song and a closing note — one full screen at a time.',
    scenes: [
      'your days together, counting up from zero — the opening title screen',
      'up to eight stat screens: a big number, a unit and a caption per screen',
      'your song card — title, artist, an optional play link',
      'a handwritten closing note and a mini recap card with both your names',
    ],
    previewCta: 'Scroll it exactly as they will.',
    previewHelp: 'Use the dots on the right or scroll down to move between screens.',
    resultLine: 'Send them the link. Their year-in-review is waiting.',
  },

  demo: {
    bgmSong: 'BSJa1UytM8w',
    senderName: 'Aarav',
    recipientName: 'Meera',
    year: '2026',
    daysTogether: 1247,
    titleCaption: 'every single one, yours.',
    moments: DEFAULT_MOMENTS,
    songTitle: 'Tum Se Hi',
    songArtist: 'our forever soundtrack',
    songUrl: 'https://www.youtube.com/watch?v=mt9xg0mmt28',
    songCaption: 'the song that knows exactly where we are.',
    closingNote: 'thank you for being my favorite chapter, again and again.',
    startDate: '14 Feb 2023',
  },

  sections: ['title', 'moments', 'song', 'closing'],
  theme: {
    bg: '#1D1B2E', ink: '#FFFDF8', accent: '#5A4E8C', soft: '#2E2B48',
    accentOnDark: '#B4A9E0',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
