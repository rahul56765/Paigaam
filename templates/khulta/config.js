'use strict';
/**
 * Khulta — One Door Opens Every Day. (Boyfriend Day family.)
 *
 * "Khulta" (खुलता / کھلتا) — it opens. Seven little doors on a warm plaster
 * wall. Each day, starting on the day you choose, one more door unlocks; he
 * taps it, it swings open, and that day's surprise is inside — a photo, a
 * mini letter, a voice-note card, an "open when you miss me" note, a song, a
 * promise. Door seven is the big reveal. When all seven are open the heart
 * above the wall fills, and the reveal is one tap away.
 *
 * Unlocking is client-side from the start date, in the timezone you pick
 * (Asia/Kolkata by default) — no backend needed. The doors are pure CSS.
 * Opened doors are remembered per link (localStorage).
 */

const KINDS = [
  { value: 'photo', label: 'A photo + caption' },
  { value: 'letter', label: 'A mini letter' },
  { value: 'voice', label: 'A voice-note card' },
  { value: 'missyou', label: '“Open when you miss me”' },
  { value: 'song', label: 'Today’s song' },
  { value: 'promise', label: 'A one-line promise' },
  { value: 'reveal', label: 'The big reveal (a full letter)' },
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'Europe/Berlin', label: 'Central Europe' },
  { value: 'America/New_York', label: 'New York (US East)' },
  { value: 'America/Chicago', label: 'Chicago (US Central)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (US West)' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

const DOORS = [
  { kind: 'letter', heading: 'Day one', text: 'Seven days, seven doors. Every morning one more opens, and behind each one is a little piece of how much you mean to me. No peeking ahead — main dekh rahi hoon.', photo: '/assets/bfday-demo/couple-4.jpg', link: '' },
  { kind: 'photo', heading: 'This one', text: 'I look at this photo more often than I’ll ever admit.', photo: '/assets/bfday-demo/couple-4.jpg', link: '' },
  { kind: 'voice', heading: 'A voice note', text: 'Hi, it’s me. I just wanted you to hear this in my voice: you’re doing so much better than you think. I’m proud of you. That’s it. That’s the voice note.', photo: '', link: '' },
  { kind: 'missyou', heading: 'Open when you miss me', text: 'Close your eyes. I’m holding your hand, I’m stealing your fries, I’m laughing at something only we find funny. See? Not that far away.', photo: '', link: '' },
  { kind: 'song', heading: 'Today’s song', text: 'Put this on for the drive home. Every line of it is you.', photo: '', link: 'https://www.youtube.com/watch?v=pezrS5OBBs4' },
  { kind: 'promise', heading: 'A promise', text: 'I will always save you the last bite.', photo: '', link: '' },
  { kind: 'reveal', heading: 'The big reveal', text: 'You opened every single door. So here’s the last thing, the biggest one.\n\nYou are the best part of my every day — the first person I want to tell things to, the one I want beside me for all of it. Seven doors could never hold all of that, but I hope they held enough for you to know.\n\nHappy Boyfriend Day. You have my whole heart.', photo: '', link: '' },
];

module.exports = {
  slug: 'khulta',
  family: 'bfday',
  name: 'Khulta',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'One Door Opens Every Day — seven little doors on a warm wall. Each day one more unlocks with a surprise behind it, and on day seven the heart fills and the big reveal opens.',
  thumbnail_url: '',
  ogImage: '/khulta/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    { id: 'recipientName', type: 'text', label: 'His name', required: true, maxLength: 40, placeholder: 'Kabir',
      hint: 'On the wall: “seven doors for Kabir”.' },
    { id: 'senderName', type: 'text', label: 'Your name', maxLength: 40, placeholder: 'Ananya',
      hint: 'Optional. Signs the doors and the big reveal.' },
    { id: 'startDate', type: 'date', label: 'The day the first door opens', required: true,
      hint: 'Door one opens on this day, door two the next, and so on. Boyfriend Day is October 3 — start on September 27 to end on it.' },
    { id: 'timezone', type: 'select', label: 'Whose midnight?', options: TIMEZONES, default: 'Asia/Kolkata',
      hint: 'A new door unlocks at midnight in his timezone.' },

    { id: 'doors', type: 'list', label: 'The seven doors', itemLabel: 'Door', addLabel: 'Add a door',
      minItems: 7, maxItems: 7,
      shape: [
        { id: 'kind', type: 'select', label: 'What’s behind it', options: KINDS, default: 'letter' },
        { id: 'heading', type: 'text', label: 'Title', maxLength: 50, placeholder: 'Day one' },
        { id: 'text', type: 'textarea', label: 'Words', maxLength: 1500, rows: 4, placeholder: 'Kuch baat likho jo dil tak jaye…' },
        { id: 'photo', type: 'image', label: 'Photo (for a photo door)' },
        { id: 'link', type: 'url', label: 'Song link (for a song door)', maxLength: 300, placeholder: 'https://open.spotify.com/…' },
      ],
      default: DOORS,
      hint: 'Door 1 opens on the start date, door 7 six days later. Ours are already written — change any of them.' },

    { id: 'revealUrl', type: 'url', label: 'Link the big reveal', maxLength: 300, placeholder: 'https://paigaam.cc/p/…',
      hint: 'Optional. Made him a Meri Duniya website too? Paste its link and the full heart opens it. Otherwise it opens door seven.' },
    { id: 'revealLabel', type: 'text', label: 'The button on the full heart', maxLength: 40, default: 'Open the big reveal' },
  ],

  steps: [
    { title: 'Who & when', heading: 'Who, and when?', intro: 'Pick the day the first door opens. Each midnight after that, one more unlocks.', fields: ['recipientName', 'senderName', 'startDate', 'timezone'] },
    { title: 'The doors', heading: 'Behind the doors', intro: 'Choose what waits behind each door. Leave a field blank and the design fills in gently.', fields: ['doors'] },
    { title: 'The big reveal', heading: 'The full heart', intro: 'When all seven doors are open, the heart above the wall fills and this button appears.', fields: ['revealUrl', 'revealLabel'] },
  ],

  create: {
    eyebrow: 'Khulta · One Door Opens Every Day',
    headline: 'Seven doors. One opens every day.',
    intro: 'A surprise that lasts a week, not five minutes. Seven little doors on a warm wall; each midnight one more unlocks, and behind it is a photo, a note, a song or a promise from you. On day seven the heart fills and the big reveal opens.',
    noun: 'doors',
    designHeading: 'A week of small surprises',
    designIntro: 'He gets the link once. It unfolds over seven days, by itself.',
    scenes: [
      'a wall of seven doors — only today’s is glowing; the rest say when they open',
      'he taps today’s door and it swings open on its hinge',
      'the surprise inside: a photo, a mini letter, a voice-note card, a song or a promise',
      'opened doors stay openable, and a little heart fills in each doorframe',
      'day seven: the big heart fills and the reveal is one tap away',
    ],
    previewCta: 'Open every door — in the preview they are all unlocked.',
    previewHelp: 'In the preview every door is open. Use “Preview as day…” to see exactly what he sees on each day.',
    resultLine: 'Send him the link today. Tomorrow, another door.',
  },

  /** /khulta/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Kabir',
    senderName: 'Ananya',
    startDate: '2026-09-27',
    timezone: 'Asia/Kolkata',
    doors: DOORS,
    revealUrl: '',
    revealLabel: 'Open the big reveal',
  },

  sections: ['wall', 'doors', 'heart'],
  theme: {
    bg: '#F6E7D7', ink: '#2B2118', accent: '#3F7D6B', soft: '#FBF3EA',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
