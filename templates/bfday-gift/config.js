'use strict';
/**
 * Tohfa — Whole Website Gift. (Boyfriend Day family, template 7.)
 *
 * "Tohfa" (तोहफ़ा / تحفہ) means "a gift" in Hindi/Urdu — this template is a
 * whole little website wrapped up as one.
 *
 * The experience (Candy Scrapbook design system): a striped candy cover with
 * a kawaii bunny who asks to be tapped; a "you're my…" word list that types
 * itself beside a polaroid; a swipeable polaroid gallery whose photos flip
 * to reveal hidden captions; an our-song card with an optional YouTube embed
 * and a fake player; three paper bouquets that each hide a note; and a blush
 * final letter with the cat-and-bunny pair, floating hearts and the end card.
 *
 * Design media lives in public/assets/bfday-gift/ (decoded at boot from
 * assets/bfday-gift/ by lib/bfdayGiftMedia.js). Photos the sender uploads go
 * through the shared /api/<slug>/upload mechanism, exactly like the other
 * family members. Fonts: Pacifico + Inter (Google Fonts).
 * Reduced motion: type-on, carousel, flips and floating hearts all collapse
 * to instant, still states.
 *
 * Editable: sender and recipient names, the occasion line, the word list,
 * up to six polaroids with hidden captions, the song (title, artist, optional
 * YouTube link), three bouquet notes, the final letter and the date.
 */

const WORDS = [
  'my love,',
  'my life,',
  'my best friend,',
  'my favourite hello,',
  'my hardest goodbye,',
  'my whole heart.',
];

const BOUQUETS = [
  {
    label: 'the pink roses',
    note: 'for every time you made an ordinary day feel like a festival. these are for you.',
  },
  {
    label: 'the tulips',
    note: 'one for every time you laughed at my worst jokes. that\u2019s a lot of tulips.',
  },
  {
    label: 'the daisies',
    note: 'because you deserve flowers on the days that aren\u2019t special too.',
  },
];

module.exports = {
  slug: 'bfday-gift',
  family: 'bfday',
  name: 'Tohfa',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Whole Website Gift — a candy-striped keepsake site: a bunny cover, a typed word-list, a flip-open polaroid gallery, an our-song player, three paper bouquets with hidden notes, and a final letter under floating hearts.',
  thumbnail_url: '',
  ogImage: '/assets/bfday-gift/og-card.png',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1: who it’s for ── */
    {
      id: 'recipientName', type: 'text', label: 'Their name', required: true,
      maxLength: 40, placeholder: 'Aarav',
      hint: 'Front and centre on the cover, and in the final letter.',
    },
    {
      id: 'senderName', type: 'text', label: 'Your name', required: true,
      maxLength: 40, placeholder: 'Meera',
      hint: 'Signed at the end of the final letter.',
    },
    {
      id: 'occasionLine', type: 'text', label: 'The occasion line', maxLength: 60,
      default: 'happy Boyfriend\u2019s Day',
      hint: 'The big script headline on the cover — the name appears under it.',
    },

    /* ── step 2: the word list ── */
    {
      id: 'wordsHeading', type: 'text', label: 'Heading above the list', maxLength: 60,
      default: 'you\u2019re my\u2026',
    },
    {
      id: 'words', type: 'list', label: 'The words', itemLabel: 'Line', addLabel: 'Add a line',
      minItems: 1, maxItems: 8,
      item: { type: 'text', maxLength: 60, placeholder: 'my favourite hello,' },
      default: WORDS,
      hint: 'Each line types itself, one at a time, beside the photo.',
    },
    {
      id: 'wordsPhoto', type: 'image', label: 'A photo beside the words',
      alt: 'A photo of the two of you beside the word list',
      hint: 'Optional — leave it blank and the design frames the bunny instead.',
    },

    /* ── step 3: the gallery ── */
    {
      id: 'galleryHeading', type: 'text', label: 'Heading above the gallery', maxLength: 60,
      default: 'a few of my favourites',
    },
    {
      id: 'photos', type: 'list', label: 'The polaroids',
      itemLabel: 'Polaroid', addLabel: 'Add a polaroid',
      minItems: 1, maxItems: 6,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption on the front', required: true, maxLength: 80 },
        { id: 'hidden', type: 'text', label: 'Hidden caption on the back', maxLength: 120,
          hint: 'They see this when they tap the polaroid and it flips over.' },
      ],
      default: [
        { caption: 'the first photo i ever saved of you', hidden: 'i still have it. obviously.' },
        { caption: 'that trip we never planned', hidden: 'best wrong turn ever.' },
        { caption: 'you, mid-laugh', hidden: 'my favourite sound, caught on camera.' },
      ],
      hint: 'Swipe through them; tap one to flip it over. Blank photos get the design\u2019s own placeholder.',
    },

    /* ── step 4: the song ── */
    {
      id: 'songTitle', type: 'text', label: 'Song title', maxLength: 80,
      default: 'Tum Hi Ho',
    },
    {
      id: 'songArtist', type: 'text', label: 'Artist', maxLength: 80,
      default: 'the one that always reminds me of you',
      hint: 'Can be the artist name, or a short line about the song.',
    },
    {
      id: 'songUrl', type: 'url', label: 'YouTube link (optional)', maxLength: 300,
      hint: 'Paste a YouTube link to embed the real song above the player card. Leave blank for just the card.',
    },

    /* ── step 5: the bouquets ── */
    {
      id: 'bouquetHeading', type: 'text', label: 'Heading above the bouquets', maxLength: 80,
      default: 'click on any bouquet to open',
    },
    {
      id: 'bouquetNotes', type: 'list', label: 'The three hidden notes',
      itemLabel: 'Note', addLabel: 'Add a note',
      minItems: 3, maxItems: 3,
      shape: [
        { id: 'label', type: 'text', label: 'Bouquet name', required: true, maxLength: 40,
          placeholder: 'the pink roses' },
        { id: 'note', type: 'textarea', label: 'The hidden note', required: true, maxLength: 240, rows: 3,
          placeholder: 'A little note that pops up when they tap this bouquet\u2026' },
      ],
      default: BOUQUETS,
      hint: 'Exactly three — one tucked inside each bouquet.',
    },

    /* ── step 6: the letter ── */
    {
      id: 'letterText', type: 'textarea', label: 'The final letter', maxLength: 600, rows: 5,
      default: 'i could have sent you a text. but you are not a text kind of person to me — you are a whole website kind of person. thank you for being my calm, my chaos, and my favourite notification. happy boyfriend\u2019s day, my love.',
      hint: 'Handwritten-style, on the blush card at the very end.',
    },
    {
      id: 'letterDate', type: 'text', label: 'The date line', maxLength: 40,
      default: 'october 3, always',
    },
  ],

  steps: [
    {
      title: 'Who it\u2019s for',
      heading: 'Who is this gift for?',
      intro: 'Their name goes on the cover in big script; yours signs the letter at the end.',
      fields: ['recipientName', 'senderName', 'occasionLine'],
    },
    {
      title: 'The words',
      heading: 'The word list',
      intro: '\u201cYou\u2019re my love, my life\u2026\u201d — each line types itself beside a photo of the two of you.',
      fields: ['wordsHeading', 'words', 'wordsPhoto'],
    },
    {
      title: 'The gallery',
      heading: 'The polaroid gallery',
      intro: 'Swipeable polaroids — tap one and it flips to show the hidden caption on the back.',
      fields: ['galleryHeading', 'photos'],
    },
    {
      title: 'The song',
      heading: 'Your song',
      intro: 'A little music card. Add a YouTube link to embed the real song above it.',
      fields: ['songTitle', 'songArtist', 'songUrl'],
    },
    {
      title: 'The bouquets',
      heading: 'Three bouquets, three notes',
      intro: 'Each paper bouquet hides a note. Tapping one pops it open.',
      fields: ['bouquetHeading', 'bouquetNotes'],
    },
    {
      title: 'The letter',
      heading: 'The final letter',
      intro: 'The handwritten note on the blush card, under the floating hearts.',
      fields: ['letterText', 'letterDate'],
    },
  ],

  create: {
    eyebrow: 'Tohfa · Whole Website Gift',
    headline: 'Not a card. A whole website.',
    intro: 'A candy-striped keepsake site for Boyfriend\u2019s Day: a bunny who opens the door, a typed list of everything they are to you, polaroids that flip to hidden captions, your song, three bouquets with notes tucked inside, and a final letter under floating hearts. Six short steps, a live preview that follows every word.',
    noun: 'website',
    designHeading: 'Six little scenes, one gift',
    designIntro: 'It opens on a striped cover with a bunny asking to be tapped. Everything after that is your words, your photos, your song.',
    scenes: [
      'the cover: candy stripes, big script, and a bunny with a \u201cclick me\u201d tag',
      'the word list types itself, one line at a time, beside your photo',
      'a swipeable polaroid gallery — tap a photo to flip it and read the back',
      'your song: an optional YouTube embed and a little player card',
      'three paper bouquets — each one pops open with a hidden note',
      'the final letter on blush, with floating hearts and the two of you as cat & bunny',
    ],
    previewCta: 'Open it exactly as they will.',
    previewHelp: 'Tap the bunny to open the gift, then scroll — tap polaroids and bouquets along the way.',
    resultLine: 'Send them the link. The bunny is waiting.',
  },

  /** /bfday-gift/demo, the gallery thumbnail and the detail page. */
  demo: {
    bgmSong: 'GxldQ9eX2wo',
    recipientName: 'Aarav',
    senderName: 'Meera',
    occasionLine: 'happy Boyfriend\u2019s Day',
    wordsHeading: 'you\u2019re my\u2026',
    words: WORDS,
    wordsPhoto: '/assets/bfday-demo/couple-4.jpg',
    galleryHeading: 'a few of my favourites',
    photos: [
      { photo: '/assets/bfday-demo/couple-3.jpg', caption: 'the first photo i ever saved of you', hidden: 'i still have it. obviously.' },
      { photo: '/assets/bfday-demo/couple-2.jpg', caption: 'that trip we never planned', hidden: 'best wrong turn ever.' },
      { photo: '/assets/bfday-demo/couple-8.jpg', caption: 'you, mid-laugh', hidden: 'my favourite sound, caught on camera.' },
    ],
    songTitle: 'Tum Hi Ho',
    songArtist: 'Arijit Singh · the one that always reminds me of you',
    songUrl: 'https://www.youtube.com/watch?v=WWZxDA81JFk',
    bouquetHeading: 'click on any bouquet to open',
    bouquetNotes: BOUQUETS,
    letterText: 'i could have sent you a text. but you are not a text kind of person to me — you are a whole website kind of person. thank you for being my calm, my chaos, and my favourite notification. happy boyfriend\u2019s day, my love.',
    letterDate: 'october 3, always',
  },

  sections: ['cover', 'words', 'gallery', 'song', 'bouquets', 'letter'],
  theme: {
    bg: '#CFE6F6', ink: '#5A6B7A', accent: '#D63D6C', soft: '#F9DFE4',
    motif: 'heart', ampersand: false, serifCase: 'lower', layout: 'scroll',
  },
};
