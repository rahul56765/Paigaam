'use strict';
/**
 * Inaam — Gift For You! (Boyfriend Day family.)
 *
 * "Inaam" (इनाम / انعام) is the reward. A gift-box landing: three illustrated
 * cats in gift boxes wiggle on a cream card, he taps any one, the lids pop
 * and the site unwraps — love coupons to stamp, a Best Boyfriend Award with a
 * gold rosette, a denim-pocket letter with photos tucked in, and a finale
 * polaroid with your song.
 *
 * A cheeky "no" link (or three idle gift clicks) flashes the crying-cat
 * interstitial — "WHY DID YOU CLICK NO!" with a TRY AGAIN! sticker — and
 * returns to the cover on its own. It never blocks progress.
 *
 * All illustration PNGs live in public/assets/inaam/ (written at boot from
 * lib/bfday/assets.js). Fonts: Shantell Sans, Great Vibes, DM Sans
 * (Google Fonts).
 */

const GIFT_LABELS = ['a little hug', 'a big smile', 'all my heart'];

const COUPONS = [
  { text: 'Unlimited Hugs', fine: 'valid forever · no expiry' },
  { text: 'Your Wish, My Command', fine: 'one (1) wish · redeem anytime' },
  { text: 'Date Night On Me', fine: 'I plan, you show up' },
  { text: 'Unlimited Kisses', fine: 'wherever, whenever' },
];

module.exports = {
  slug: 'inaam',
  family: 'bfday',
  name: 'Inaam',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Gift For You! — three cat gifts on a cream card; he taps one to unwrap love coupons to stamp, a Best Boyfriend Award, a denim-pocket letter and a finale polaroid with your song.',
  thumbnail_url: '',
  ogImage: '/inaam/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1 & 2: the names ── */
    {
      id: 'senderName', type: 'text', label: 'Your name', required: true,
      maxLength: 40, placeholder: 'Ananya',
      hint: 'Signs the letter and the last screen.',
    },
    {
      id: 'recipientName', type: 'text', label: 'His name', required: true,
      maxLength: 40, placeholder: 'Kabir',
      hint: 'On the award certificate and the finale.',
    },
    {
      id: 'dateLine', type: 'text', label: 'The little date on the cover',
      maxLength: 40, default: 'Boyfriend Day · 3 Oct',
      hint: 'The small chip under the gifts. Any words work.',
    },

    /* ── step 3: the three gifts ── */
    {
      id: 'giftLabels', type: 'list', label: 'The three gifts',
      itemLabel: 'Gift', addLabel: 'Add a gift',
      minItems: 3, maxItems: 3,
      item: { type: 'text', label: 'Caption', maxLength: 24 },
      default: GIFT_LABELS,
      hint: 'A tiny hand-printed caption under each gift box. Keep them short — two or three words.',
    },

    /* ── step 4: the coupons ── */
    {
      id: 'coupons', type: 'list', label: 'The four love coupons',
      itemLabel: 'Coupon', addLabel: 'Add a coupon',
      minItems: 4, maxItems: 4,
      shape: [
        { id: 'text', type: 'text', label: 'The coupon', required: true, maxLength: 48,
          placeholder: 'Unlimited Hugs', hint: 'One line — the ticket shrinks long text to fit.' },
        { id: 'fine', type: 'text', label: 'The fine print', maxLength: 60,
          placeholder: 'valid forever · no expiry' },
      ],
      default: COUPONS,
      hint: 'He taps a coupon to stamp it REDEEMED (double-tap to undo). Ours are written — change any of them.',
    },

    /* ── step 5: the award ── */
    {
      id: 'awardName', type: 'text', label: 'The award', required: true,
      maxLength: 40, default: 'Best Boyfriend Award',
      hint: 'In script across the certificate, gold rosette above.',
    },
    {
      id: 'awardCitation', type: 'text', label: 'One-line citation',
      maxLength: 90, default: 'for being the softest, funniest, most wonderful human I know',
      hint: 'Keep it to one line — the certificate shows three at most.',
    },

    /* ── step 6: the letter ── */
    {
      id: 'letterText', type: 'textarea', label: 'The letter', required: true,
      maxLength: 900, rows: 6,
      default: 'Dear love,\n\nSome people get gifts wrapped in paper. You get this — a whole little website, because one box could never hold it.\n\nThank you for every ordinary day you make extraordinary. I would pick you, again and again, in every version of this life.',
      hint: 'Sits on star-paper beside the denim pocket. Two short paragraphs read best on a phone.',
    },
    {
      id: 'photos', type: 'list', label: 'Photos in the pocket',
      itemLabel: 'Photo', addLabel: 'Add a photo',
      minItems: 0, maxItems: 2,
      item: { type: 'image', label: 'Photo' },
      default: [],
      hint: 'Up to two photos tucked into the denim pocket — he taps one to pull it out.',
    },

    /* ── step 7: the finale ── */
    {
      id: 'finaleTitle', type: 'text', label: 'The last line',
      maxLength: 50, default: 'to my favourite boy <3',
    },
    {
      id: 'finaleNote', type: 'textarea', label: 'A short handwritten note',
      maxLength: 220, rows: 3,
      default: 'of all the gifts in the world, you are my favourite one to come home to.',
    },
    {
      id: 'finalePhoto', type: 'image', label: 'A photo of you two',
      hint: 'The polaroid on the last screen. Leave it blank and we use a sample one.',
    },
    {
      id: 'songUrl', type: 'url', label: 'Paste a Spotify or YouTube link',
      hint: 'e.g. open.spotify.com/track/… or youtube.com/watch?v=… — YouTube links play right on the page, Spotify opens in a tap.',
    },
  ],

  steps: [
    {
      title: 'Your name', heading: 'First, you.',
      intro: 'The letter and the last screen are signed by you.',
      fields: ['senderName'],
    },
    {
      title: 'His name', heading: 'And him.',
      intro: 'His name goes on the award certificate and under the finale polaroid.',
      fields: ['recipientName', 'dateLine'],
    },
    {
      title: 'The gifts', heading: 'Three little gifts',
      intro: 'He opens the site by tapping any gift. These are the tiny captions under each box.',
      fields: ['giftLabels'],
    },
    {
      title: 'The coupons', heading: 'Four love coupons',
      intro: 'Vintage ticket stubs he can tap to stamp REDEEMED. Edit ours or write your own.',
      fields: ['coupons'],
    },
    {
      title: 'The award', heading: 'The certificate',
      intro: 'A gold rosette, his name in script, and one line about why.',
      fields: ['awardName', 'awardCitation'],
    },
    {
      title: 'The letter', heading: 'Dear love…',
      intro: 'A letter on star-paper, with photos tucked into a denim pocket beside it.',
      fields: ['letterText', 'photos'],
    },
    {
      title: 'The finale', heading: 'The last screen',
      intro: 'A polaroid, a short note, and your song — YouTube plays right on the page.',
      fields: ['finaleTitle', 'finaleNote', 'finalePhoto', 'songUrl'],
    },
  ],

  create: {
    eyebrow: 'Inaam · Gift For You!',
    headline: 'Three gifts. He picks one. It all unwraps.',
    intro: 'A toy-like gift-box landing: three illustrated cat gifts on a cream card. Whichever he taps, the lids pop and the whole site unwraps — love coupons he can stamp, a Best Boyfriend Award, a denim-pocket letter and a finale polaroid with your song.',
    noun: 'gifts',
    designHeading: 'A gift box that keeps opening',
    designIntro: 'One tap unwraps the whole thing, beat by beat.',
    scenes: [
      'the cover: GIFT FOR YOU! and three wiggling cat gifts — tap any one',
      'if he says no, a crying cat begs him to TRY AGAIN',
      'four love coupons — tap to stamp REDEEMED',
      'the Best Boyfriend Award, rosette swaying above his name in script',
      'a denim pocket with photos tucked in, beside your letter on star-paper',
      'the finale: a polaroid of you two and your song',
    ],
    previewCta: 'Tap a gift — the preview unwraps exactly like the real link.',
    previewHelp: 'Try the coupons: tap to stamp, double-tap to un-stamp.',
    resultLine: 'Send him the link. Let him pick a gift.',
  },

  demo: {
    bgmSong: '',
    senderName: 'Ananya',
    recipientName: 'Kabir',
    dateLine: 'Boyfriend Day · 3 Oct',
    giftLabels: GIFT_LABELS,
    coupons: COUPONS,
    awardName: 'Best Boyfriend Award',
    awardCitation: 'for being the softest, funniest, most wonderful human I know',
    letterText: 'Dear love,\n\nSome people get gifts wrapped in paper. You get this — a whole little website, because one box could never hold it.\n\nThank you for every ordinary day you make extraordinary. I would pick you, again and again, in every version of this life.',
    photos: [],
    finaleTitle: 'to my favourite boy <3',
    finaleNote: 'of all the gifts in the world, you are my favourite one to come home to.',
    finalePhoto: '',
    songUrl: 'https://www.youtube.com/watch?v=mt9xg0mmt28',
  },

  sections: ['cover', 'coupons', 'award', 'letter', 'finale'],
  theme: {
    bg: '#F7F0E4', ink: '#26211B', accent: '#2E4B70', soft: '#FDF8EE',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
