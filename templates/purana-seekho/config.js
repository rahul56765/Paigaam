'use strict';
/**
 * Purana Seekho — the lemon-gingham sticker-cat gift (Boyfriend Day family.)
 *
 * The password is the gift's key: enter the password to view, survive the
 * winking cat's "HOW DARE YOU!?" tease if you guess wrong, then click the
 * three cat gift boxes to unwrap a blushing-cat hero, a "YOU ARE MY
 * bestfriend" word cloud, an our-memories photo strip and a script closer —
 * with the sender's song playing right on the page.
 */

const CLOUD_DEFAULTS = [
  'my calm',
  'my bestfriend',
  'my home',
  'my favourite',
  'my sunshine',
  'my everything',
];

const PHOTO_DEFAULTS = [
  '/assets/purana-seekho-demo/demo-1.jpg',
  '/assets/purana-seekho-demo/demo-2.jpg',
  '/assets/purana-seekho-demo/demo-3.jpg',
  '/assets/purana-seekho-demo/demo-4.jpg',
  '/assets/purana-seekho-demo/demo-5.jpg',
  '/assets/purana-seekho-demo/demo-6.jpg',
];

module.exports = {
  slug: 'purana-seekho',
  family: 'bfday',
  name: 'Purana Seekho',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Enter the password to view — a lemon-gingham gift site with sticker cats: a winking tease, three gift boxes to click, a word cloud, a memories photo strip and a script closer.',
  thumbnail_url: '',
  ogImage: '/purana-seekho/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1 & 2: the people ── */
    {
      id: 'senderName', type: 'text', label: 'Your name', required: true,
      maxLength: 40, placeholder: 'Ananya',
      hint: 'Signs the word cloud and the closer.',
    },
    {
      id: 'recipientName', type: 'text', label: 'His name', required: true,
      maxLength: 40, placeholder: 'Kabir',
      hint: 'On the gift-pick screen.',
    },

    /* ── step 3: the gate ── */
    {
      id: 'password', type: 'text', label: 'The password', required: true,
      maxLength: 40, placeholder: 'our song name',
      hint: 'What he types to unlock the site. Keep it something he actually knows!',
    },
    {
      id: 'hint', type: 'text', label: 'The hint (after a wrong guess)',
      maxLength: 80, placeholder: 'hint: what we always sing in the car',
      hint: 'Shown after the first wrong guess. Leave it blank and the cat just teases him.',
    },

    /* ── step 4: the word cloud ── */
    {
      id: 'cloudLabels', type: 'list', label: 'The six labels around the kitten',
      itemLabel: 'Label', addLabel: 'Add a label',
      minItems: 6, maxItems: 6,
      item: { type: 'text', label: 'Label', maxLength: 24 },
      default: CLOUD_DEFAULTS,
      hint: 'The little labels floating around the kitten — "my calm", "my home"… six short ones read best.',
    },

    /* ── step 5: the memories ── */
    {
      id: 'photos', type: 'list', label: 'The memories strip',
      itemLabel: 'Photo', addLabel: 'Add a photo',
      minItems: 6, maxItems: 6,
      item: { type: 'image', label: 'Photo' },
      default: [],
      hint: 'Six photos for the photo-booth strip. Leave it empty and the sample photos show.',
    },

    /* ── step 6: the closer ── */
    {
      id: 'closerLine', type: 'text', label: 'The last line',
      maxLength: 50, default: 'You complete me',
      hint: 'In script inside the pink oval on the final screen.',
    },
    {
      id: 'closerNote', type: 'textarea', label: 'A short note under the couple',
      maxLength: 220, rows: 3,
      default: 'thank you for being the softest, silliest, warmest part of every day. happy boyfriend’s day, my love.',
    },
    {
      id: 'songUrl', type: 'url', label: 'The song link on the closer',
      hint: 'e.g. open.spotify.com/track/… or youtube.com/watch?v=… — YouTube links play right on the page, Spotify opens in a tap.',
    },
    {
      id: 'bgmSong', type: 'bgm', label: 'Background music',
      hint: 'A YouTube link or video id. Optional — leave it blank (or choose "no song") for a quiet page. Nothing plays until they tap the music button.',
    },
  ],

  steps: [
    {
      title: 'Your name', heading: 'First, you.',
      intro: 'Your name signs the word cloud and the closer.',
      fields: ['senderName'],
    },
    {
      title: 'His name', heading: 'And him.',
      intro: 'His name is on the gift-pick screen.',
      fields: ['recipientName'],
    },
    {
      title: 'The password', heading: 'The gate',
      intro: 'He unlocks the site with a password you set. Pick something he knows — the hint appears only after a wrong guess.',
      fields: ['password', 'hint'],
    },
    {
      title: 'The word cloud', heading: 'You are my bestfriend',
      intro: 'Six little labels float around the kitten. Ours are written — change any of them.',
      fields: ['cloudLabels'],
    },
    {
      title: 'The memories', heading: 'The photo-booth strip',
      intro: 'Six photos in the strip, red banner across the bottom. Leave them and the samples show.',
      fields: ['photos'],
    },
    {
      title: 'The closer', heading: 'The last screen',
      intro: 'The pink oval, the couple illustration, and your song — YouTube plays right on the page.',
      fields: ['closerLine', 'closerNote', 'songUrl', 'bgmSong'],
    },
  ],

  create: {
    eyebrow: 'Purana Seekho · Boyfriend’s Day',
    headline: 'A password, a tease, three gifts to click.',
    intro: 'A lemon-gingham gift site with sticker cats: he enters a password, the winking cat teases a wrong guess, and three cat gift boxes unwrap a hero card, a word cloud, a memories photo strip and a script closer — with your song playing on the page.',
    noun: 'gifts',
    designHeading: 'Lemon gingham and sticker cats',
    designIntro: 'Cute, sticker-book energy from the password to the closer.',
    scenes: [
      'the gate: "Enter the password to view" on cream gingham with a joke captcha',
      'a wrong guess and the winking cat teases — HOW DARE YOU!? — try again',
      'three cat gift boxes — click them all to open the site',
      'the blushing cat: happy Boyfriend’s Day',
      'the word cloud: YOU ARE MY bestfriend, labels around a kitten',
      'the memories strip, then "You complete me" in script with your song',
    ],
    previewCta: 'Type the password — the preview unlocks exactly like the real link.',
    previewHelp: 'Try a wrong guess once: the tease is part of the gift.',
    resultLine: 'Send him the link. Let him guess the password.',
  },

  demo: {
    bgmSong: 'https://www.youtube.com/watch?v=mt9xg0mmt28',
    senderName: 'Ananya',
    recipientName: 'Kabir',
    password: 'tum se hi',
    hint: 'hint: the song we always come back to',
    cloudLabels: CLOUD_DEFAULTS,
    photos: PHOTO_DEFAULTS,
    closerLine: 'You complete me',
    closerNote: 'thank you for being the softest, silliest, warmest part of every day. happy boyfriend’s day, my love.',
    songUrl: 'https://www.youtube.com/watch?v=mt9xg0mmt28',
  },

  sections: ['gate', 'pick', 'hero', 'cloud', 'memories', 'closer'],
  theme: {
    bg: '#FFF9EF', ink: '#4A3B3F', accent: '#8A4FFF', soft: '#FFF3D6',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
