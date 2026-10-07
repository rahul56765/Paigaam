'use strict';
/**
 * Birthday Paigaam — the designed copy, palette and fonts.
 *
 * Every text field falls back to these words, so an untouched form still
 * sends a complete, lovely surprise. Placeholders in square brackets are
 * swapped at render time:
 *   [NAME]    the birthday person   (recipientName)
 *   [SENDER]  the person sending it (senderName)
 *   [AGE]     the age they are turning (age, when given)
 * Shared by the renderer, the schema and the wizard (which shows these as
 * placeholders), so the three can never drift apart.
 */

const TEXT = {
  recipientName: 'you',
  senderName: 'Someone who loves you',
  passcode: '1234',
  passcodeHint: 'Psst… it’s 1 2 3 4',
  question: 'I have a little surprise for you. Wanna see it?',
  yesLabel: 'YES',
  noLabel: 'NO',
  tryAgainLabel: 'TRY AGAIN',
  letterGreeting: 'Dear [NAME],',
  letter: 'Happy birthday, my favourite human.\n\nI wanted to give you something you can open again and again — so I made you this little corner of the internet, full of us.\n\nThank you for the laughs that make my stomach hurt, the late-night talks, and for being exactly, wonderfully you. I hope this year is soft on you, and full of everything you wish for.\n\nNow keep going — there’s more.',
  signoff: 'Forever yours,',
  voiceTitle: 'Press play, I have something to say',
  songTitle: 'Happy Birthday',
  songArtist: 'a little music box',
  memoriesTitle: 'Our memories',
  loveTitle: 'Things I love about you',
  reasonsTitle: 'Reasons you’re special',
  finaleTitle: 'Happy Birthday, [NAME]!',
  finaleLine: 'Here’s to you — today, and every day after.',
  thankYouText: 'I just opened my birthday surprise 🥹💕 Thank you, [SENDER]!',
};

const NO_MESSAGES = [
  'How dare you click NO!',
  'Excuse me?? Try that again 😤',
  'Wrong button, birthday star 🙄',
  'I’m telling everyone you said no 😭',
  'My heart just did a tiny crack 💔',
  'The YES button is getting lonely…',
  'Okay now you’re just being silly 🙈',
  'Fine. NO is officially out of order.',
];

const LOVE_NOTES = [
  'Your laugh (especially the snort)',
  'How you remember the tiny things',
  'Your terrible-but-perfect dance moves',
  'The way you make everyone feel at home',
  'Your 2am thoughts',
  'How brave you are, even when you’re scared',
];

const REASONS = [
  'You make ordinary days feel like little adventures.',
  'You are kind even when nobody is watching.',
  'You turn my bad days around without even trying.',
  'You are the first person I want to tell everything.',
  'The world is softer with you in it.',
];

/** Demo memories (the renderer uses them only for the public demo). */
const DEMO_PHOTOS = [
  { url: '/birthday-paigaam/demo-media/bp-memory-1.jpg', caption: 'sunset ice-creams 🍦', back: 'You stole a bite of mine and pretended you didn’t.' },
  { url: '/birthday-paigaam/demo-media/bp-memory-2.jpg', caption: 'our cafe ☕', back: 'Same table, same order, every single time.' },
  { url: '/birthday-paigaam/demo-media/bp-memory-3.jpg', caption: 'rain walk ☔', back: 'Best soggy shoes of my life.' },
  { url: '/birthday-paigaam/demo-media/bp-memory-4.jpg', caption: 'the road trip!', back: 'We got lost three times and it was perfect.' },
  { url: '/birthday-paigaam/demo-media/bp-memory-5.jpg', caption: 'picnic day 🌸', back: 'The cat chose you. Obviously.' },
  { url: '/birthday-paigaam/demo-media/bp-memory-6.jpg', caption: 'movie night', back: 'You fell asleep in 12 minutes. A record.' },
];

/** Palette presets. The first is the template's own. */
const PALETTES = {
  dreamy:   { blush: '#F9C6D4', cream: '#FFF4D6', peach: '#FFD9B8', lavender: '#D9C8F5', accent: '#C2185B' },
  lilac:    { blush: '#E3D4FA', cream: '#FFF6CF', peach: '#FCE3C0', lavender: '#C9B5F2', accent: '#6A3FB5' },
  peach:    { blush: '#FFCFBF', cream: '#FFF6E8', peach: '#FFC59E', lavender: '#F5D0E6', accent: '#D9480F' },
  mint:     { blush: '#CDEFE2', cream: '#FFFBEA', peach: '#FFE0C7', lavender: '#D5E4FF', accent: '#1F7A63' },
};

/**
 * Font presets: heading (bold, cute serif) · script (elegant accent) · hand (captions).
 * `css` is the Google Fonts family query for a single request.
 */
const FONTS = {
  dreamy: {
    label: 'Dreamy',
    heading: "'Fraunces', Georgia, serif", script: "'Great Vibes', cursive", hand: "'Caveat', 'Comic Sans MS', cursive",
    css: 'family=Fraunces:opsz,wght,SOFT@9..144,600..900,100&family=Great+Vibes&family=Caveat:wght@500;700',
  },
  storybook: {
    label: 'Storybook',
    heading: "'DM Serif Display', Georgia, serif", script: "'Dancing Script', cursive", hand: "'Patrick Hand', 'Comic Sans MS', cursive",
    css: 'family=DM+Serif+Display&family=Dancing+Script:wght@600;700&family=Patrick+Hand',
  },
  vintage: {
    label: 'Vintage',
    heading: "'Playfair Display', Georgia, serif", script: "'Pinyon Script', cursive", hand: "'Gaegu', 'Comic Sans MS', cursive",
    css: 'family=Playfair+Display:wght@700;900&family=Pinyon+Script&family=Gaegu:wght@400;700',
  },
};

/** Screens in play order. Unlock and finale are always on. */
const SCREENS = ['unlock', 'question', 'letter', 'voice', 'song', 'scrapbook', 'finale'];
const TOGGLES = { question: true, letter: true, voice: true, song: true, scrapbook: true, notes: true, reasons: true, cake: true, countdown: true };

module.exports = { TEXT, NO_MESSAGES, LOVE_NOTES, REASONS, DEMO_PHOTOS, PALETTES, FONTS, SCREENS, TOGGLES };
