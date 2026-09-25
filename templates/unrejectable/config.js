'use strict';
/**
 * Lajja — The Unrejectable Card. (Boyfriend Day family, t4.)
 *
 * "Lajja" (लज्जा) means shyness or modesty — the perfect word for a No
 * button that shies away from every tap. The card opens on a blush-and-cream
 * arch with an inline heart illustration (or your own photo) and a big
 * romantic question. The No button dodges up to five times — shrinking a
 * little each time while Yes quietly grows — then gives up and sits still
 * with a resigned caption. If they tap the tired button anyway, a soft
 * message appears; if they tap Yes, confetti bursts across the screen and
 * the card flips to a celebration.
 *
 * Zero media: placeholder art is inline SVG. Fonts: Fraunces + Caveat
 * (Google Fonts). Reduced motion: the button teleports instantly (no CSS
 * transition), confetti is skipped, and the screen change is immediate.
 *
 * Editable: the sender's name, an optional photo for the arch, the
 * question, both button labels, the give-up caption, the gentle no-message,
 * and the celebration headline + message. All fields default to the
 * designed copy, so an untouched form renders the original experience.
 */

module.exports = {
  slug: 'unrejectable',
  family: 'bfday',
  name: 'Lajja',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'The Unrejectable Card — the No button is shy. It dodges up to five times, then gives up. Yes bursts confetti across the screen.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  displayField: 'senderName',

  fields: [
    {
      id: 'senderName',
      type: 'text',
      label: 'Your name',
      required: true,
      maxLength: 40,
      placeholder: 'Priya',
      hint: 'Shown in the celebration message so they know it\'s from you.',
    },
    {
      id: 'photo',
      type: 'image',
      label: 'Photo for the arch (optional)',
      alt: 'Our photo',
      hint: 'Replaces the heart illustration with your own photo. Leave blank to keep the designed art.',
    },
    {
      id: 'question',
      type: 'text',
      label: 'The question',
      maxLength: 100,
      default: 'Will you be my boyfriend, always?',
    },
    {
      id: 'yesLabel',
      type: 'text',
      label: 'Yes button',
      maxLength: 30,
      default: 'Yes 💛',
      hint: 'The button they tap to say yes.',
    },
    {
      id: 'noLabel',
      type: 'text',
      label: 'No button',
      maxLength: 20,
      default: 'No',
      hint: 'This button will try to dodge every tap.',
    },
    {
      id: 'giveUpCaption',
      type: 'text',
      label: 'Give-up caption',
      maxLength: 60,
      default: 'fine, i\'ll just be here',
      hint: 'Shown under the No button after it exhausts its five dodges.',
    },
    {
      id: 'noMessage',
      type: 'text',
      label: 'If they tap the tired No button',
      maxLength: 120,
      default: 'that\'s okay. i\'ll ask again tomorrow 🌼',
      hint: 'A gentle message if they tap No after it has given up.',
    },
    {
      id: 'celebHeadline',
      type: 'text',
      label: 'Celebration headline',
      maxLength: 60,
      default: 'he said yes',
      hint: 'Shown big on the celebration screen. A ❤️ is added automatically.',
    },
    {
      id: 'celebMessage',
      type: 'textarea',
      label: 'Celebration message',
      maxLength: 400,
      rows: 4,
      default: 'you just made my whole year.\nevery ordinary day with you is my favourite day.\n— always, me',
    },
    {
      id: 'shareHint',
      type: 'text',
      label: 'Hint at the bottom',
      maxLength: 80,
      default: 'screenshot this & send it back to me 📸',
    },
  ],

  steps: [
    {
      title: 'Who it’s from',
      heading: 'Who is it from?',
      intro: 'Your name and an optional photo to make it unmistakably yours.',
      fields: ['senderName', 'photo'],
    },
    {
      title: 'The question',
      heading: 'The question',
      intro: 'Customise the question, both buttons, and what happens when No gives up.',
      fields: ['question', 'yesLabel', 'noLabel', 'giveUpCaption', 'noMessage'],
    },
    {
      title: 'The celebration',
      heading: 'When they say yes',
      intro: 'What they’ll see after the confetti.',
      fields: ['celebHeadline', 'celebMessage', 'shareHint'],
    },
  ],

  create: {
    eyebrow: 'Lajja · The Unrejectable Card',
    headline: 'The No button is shy.',
    intro: 'A blush-and-cream card with your question and two buttons. The No button dodges every tap — up to five times, shrinking each time while Yes quietly grows — then gives up. Yes fires confetti across the screen. Three steps, one required field, live preview as you type.',
    noun: 'card',
    designHeading: 'One question, one shy button',
    designIntro: 'The card opens on your question. Every tap at No sends it somewhere new. After five attempts it retires gracefully.',
    scenes: [
      'your question, Yes in coral, No in the corner — tap Yes or try to catch No',
      'No dodges up to five times, shrinking with every escape, Yes growing bigger',
      'No gives up; tap Yes to burst confetti and flip to the celebration',
    ],
    previewCta: 'Try to tap No. See what happens.',
    previewHelp: 'Click No a few times to watch it dodge, then tap Yes for the celebration.',
    resultLine: 'Send them the link. They’ll have to find a way to say yes.',
  },

  /** /unrejectable/demo, the gallery thumbnail and the detail page. */
  demo: {
    bgmSong: 'zm4OWfvnP0M',
    senderName: 'Priya',
    question: 'Will you be my boyfriend, always?',
    yesLabel: 'Yes 💛',
    noLabel: 'No',
    giveUpCaption: 'fine, i\'ll just be here',
    noMessage: 'that\'s okay. i\'ll ask again tomorrow 🌼',
    celebHeadline: 'he said yes',
    celebMessage: 'you just made my whole year.\nevery ordinary day with you is my favourite day.\n— always, me',
    shareHint: 'screenshot this & send it back to me 📸',
  },

  sections: ['question', 'celebration'],
  theme: {
    bg: '#FFFDF8',
    ink: '#2B2118',
    accent: '#B85C48',
    soft: '#F2C4BC',
    motif: 'heart',
    ampersand: false,
    serifCase: 'title',
    layout: 'cinematic',
  },
};
