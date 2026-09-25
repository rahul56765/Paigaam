'use strict';
/**
 * Raaz — The Password Letter. (Boyfriend Day family.)
 *
 * "Raaz" (राज़ / راز) means "a secret" — and this one stays locked until he
 * proves he knows it. The link opens on a near-black screen with a single
 * underlined password field: "Only he knows the password." Wrong guesses
 * shake the field and cycle playful hint replies. The right answer runs the
 * small ceremony: a fake "I'm not a robot" checkbox ticks itself, a
 * notification chip slides down, the ivory envelope's botanical wax seal
 * cracks off, a retro gift box rattles and pops — "GIFT FOR YOU!" — and
 * then the letter, on paper grain, with the sign-off and your song.
 *
 * The gate is pure client-side JS: the published page carries only a salted
 * SHA-256 of the password, and the hint lines are base64-wrapped and decoded
 * only after the first wrong guess. It is a gesture gate, not security.
 *
 * Design media lives in public/assets/raaz/ (decoded at boot from
 * lib/bfday/assets.js). Fonts: Fraunces 900 (display), DM Sans (UI),
 * Caveat (the letter). Reduced motion: every animation collapses to its
 * final state — nothing moves unless he triggers it, and even then, barely.
 */

const DEFAULT_HINTS = [
  'Hmm. Not quite. Think of where we first met.',
  'Nope. It’s the word only you would know.',
  'One more try — it’s your favourite place with me.',
];

module.exports = {
  slug: 'raaz',
  family: 'bfday',
  name: 'Raaz',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'The Password Letter — a locked dark screen only he can open. He guesses the secret word, a tiny ceremony plays, and a gift box pops open to your letter. For the one who knows you best.',
  thumbnail_url: '',
  ogImage: '/raaz/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* ── step 1: who it’s for ── */
    {
      id: 'recipientName', type: 'text', label: 'His name', required: true,
      maxLength: 40, placeholder: 'Aarav',
      hint: 'On the envelope, the gift and the letter.',
    },
    {
      id: 'senderName', type: 'text', label: 'Your name',
      maxLength: 40, placeholder: 'Meera',
      hint: 'Optional. Signs the letter at the end.',
    },

    /* ── step 2: the password ── */
    {
      id: 'password', type: 'text', label: 'The password', required: true,
      maxLength: 60, placeholder: 'cafe mocha',
      hint: 'Something only he would know — where you first met, his nickname, the date. He types it to open the site. Not case-sensitive.',
    },
    {
      id: 'hints', type: 'list', label: 'Wrong-answer replies',
      itemLabel: 'Reply', addLabel: 'Add a reply',
      minItems: 1, maxItems: 3,
      item: { type: 'text', maxLength: 90, placeholder: 'Nope. It’s the word only you would know.' },
      default: DEFAULT_HINTS,
      hint: 'Up to three playful lines, shown one at a time when he guesses wrong — they cycle in order. Nudge him, don’t tell him.',
    },

    /* ── step 3: the letter ── */
    {
      id: 'letterText', type: 'textarea', label: 'The letter', required: true,
      maxLength: 2000, rows: 8,
      default: 'You guessed it. Of course you did — you always know the things nobody else does.\n\nThat’s why this was locked. Anyone can open a link; only you could open this one. And now that you’re here: thank you for paying attention, for remembering the small things, for making me feel like the easiest person in the world to love.\n\nHappy Boyfriend’s Day. You earned every word of this.',
      hint: 'Handwritten-style, on the ivory paper after the gift pops.',
    },

    /* ── step 4: the sign-off ── */
    {
      id: 'signoff', type: 'text', label: 'The sign-off line',
      maxLength: 60, default: 'forever, and then some —',
      hint: 'The small line just above your name.',
    },

    /* ── step 5: the song ── */
    {
      id: 'songTitle', type: 'text', label: 'Song title', maxLength: 80,
      default: 'Tum Se Hi',
    },
    {
      id: 'songUrl', type: 'url', label: 'Paste a Spotify or YouTube link',
      maxLength: 300,
      hint: 'e.g. open.spotify.com/track/… or youtube.com/watch?v=… — YouTube links play right on the page, Spotify opens in a tap.',
    },

    /* ── step 6: the date chip ── */
    {
      id: 'chipLabel', type: 'text', label: 'The notification chip',
      maxLength: 60, default: 'Boyfriend’s Day • Sat, 3 Oct 2026',
      hint: 'Slides down like a phone notification the moment he unlocks it.',
    },
  ],

  steps: [
    {
      title: 'Who it’s for',
      heading: 'Who holds the secret?',
      intro: 'His name goes on the envelope and the letter. Yours signs it.',
      fields: ['recipientName', 'senderName'],
    },
    {
      title: 'The password',
      heading: 'Only he knows it',
      intro: 'Pick a word or phrase only he would know. Wrong guesses get your playful replies, one at a time.',
      fields: ['password', 'hints'],
    },
    {
      title: 'The letter',
      heading: 'What the gift holds',
      intro: 'The letter he reads once the box pops open. Take your time — this is the whole point.',
      fields: ['letterText'],
    },
    {
      title: 'The sign-off',
      heading: 'Sign it',
      intro: 'The last line before your name.',
      fields: ['signoff'],
    },
    {
      title: 'The song',
      heading: 'Your song',
      intro: 'Optional — a song card under the letter. YouTube links play right on the page.',
      fields: ['songTitle', 'songUrl'],
    },
    {
      title: 'The chip',
      heading: 'The notification',
      intro: 'The little banner that slides down the moment he unlocks it — like a phone notification.',
      fields: ['chipLabel'],
    },
  ],

  create: {
    eyebrow: 'Raaz · The Password Letter',
    headline: 'Locked. Until he proves he knows you.',
    intro: 'A dark screen, one password field, and a secret only he could know. The right answer plays a tiny ceremony — a captcha tick, a notification chip, a wax seal cracking, a gift box popping open — and then your letter, in your words. Six short steps and a live preview you can test the whole way through.',
    noun: 'letter',
    designHeading: 'He has to earn the reveal',
    designIntro: 'The password is the gift wrap. The letter is the gift.',
    scenes: [
      'a locked near-black screen: “Only he knows the password.”',
      'wrong guesses shake the field and play your teasing replies',
      'the unlock moment: “I’m not a robot” ticks itself, a notification slides down',
      'the wax seal cracks, the envelope opens, the gift box rattles and pops',
      '“GIFT FOR YOU!” — then your letter on ivory paper, with your song',
    ],
    previewCta: 'Test the whole ceremony — the preview shows you the password.',
    previewHelp: 'In the preview, the correct password is shown under the lock so you can walk the full unlock. Try a wrong guess first.',
    resultLine: 'Send him the link. Only he gets in.',
  },

  /** /raaz/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Aarav',
    senderName: 'Meera',
    password: 'cafe mocha',
    hints: DEFAULT_HINTS,
    letterText: 'You guessed it. Of course you did — you always know the things nobody else does.\n\nThat’s why this was locked. Anyone can open a link; only you could open this one. And now that you’re here: thank you for paying attention, for remembering the small things, for making me feel like the easiest person in the world to love.\n\nHappy Boyfriend’s Day. You earned every word of this.',
    signoff: 'forever, and then some —',
    songTitle: 'Tum Se Hi',
    songUrl: 'https://www.youtube.com/watch?v=mt9xg0mmt28',
    chipLabel: 'Boyfriend’s Day • Sat, 3 Oct 2026',
  },

  sections: ['lock', 'unlock', 'envelope', 'gift', 'letter'],
  theme: {
    bg: '#0F0D0C', ink: '#F3EDE2', accent: '#B3402F', soft: '#231B1F',
    accentOnDark: '#F3EDE2',
    motif: 'heart', ampersand: false, serifCase: 'upper', layout: 'cinematic',
  },
};
