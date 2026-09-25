'use strict';
/**
 * Kashf — Reasons I Love You (Scratch Edition). (Boyfriend Day family, template 3.)
 *
 * "Kashf" (کشف / कश्फ) means discovery or revelation in Urdu/Arabic — the
 * perfect word for a scratch-to-reveal experience. Seven gold-foil scratch
 * cards, each hiding one reason. Drag or scratch away the foil to uncover
 * the reason underneath; the card pops with a sparkle burst when 55 % of
 * the foil is cleared. A counter in the header ticks up with each reveal.
 * After the second card a "reveal all" button fades in. All cards cleared →
 * the finale letter rises in. "Scratch them again" replays in place.
 *
 * Zero media: the gold foil is drawn on a <canvas> each time (gradient,
 * diagonal streaks, noise dots). Fonts: Fraunces + Inter + Caveat (Google).
 * Reduced motion: animations collapse to instant cuts; sparkle particles
 * are hidden; the canvas transition is removed.
 *
 * Editable: sender name, each reason (3–12), and the finale letter. Every
 * field defaults to the original copy, so an untouched form renders the
 * full designed experience.
 */

const REASONS = [
  'the way you laugh at your own jokes',
  'how you text me "made it home safe" every single time',
  'the face you make when the coffee is exactly right',
  'the way you remember the small things I mentioned once',
  'how your hand finds mine in a crowded room',
  'the way you sing in the kitchen like no one\'s listening',
  'how you make ordinary Tuesdays feel like a plan',
];

module.exports = {
  slug: 'scratch-reasons',
  family: 'bfday',
  name: 'Kashf',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Reasons I Love You (Scratch Edition) — gold-foil scratch cards, each hiding one reason. Scratch away the foil to reveal them one by one, or tap "reveal all" once you\'ve started.',
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
      hint: 'Signs off the finale letter and appears in the page description.',
    },
    {
      id: 'reasons',
      type: 'list',
      label: 'The reasons',
      itemLabel: 'Reason',
      addLabel: 'Add a reason',
      minItems: 3,
      maxItems: 12,
      item: { type: 'text', maxLength: 140, placeholder: 'the way you…' },
      default: REASONS,
      hint: 'Each reason is hidden under a gold-foil card. Edit ours or write your own — at least 3, up to 12.',
    },
    {
      id: 'finaleText',
      type: 'textarea',
      label: 'The closing message',
      maxLength: 300,
      rows: 3,
      default: 'and about a million more reasons…\nhappy boyfriend day ❤️',
      hint: 'Shown in a letter after all cards are revealed. Your name signs it off below.',
    },
  ],

  steps: [
    {
      title: 'Who it’s from',
      heading: 'Who is it from?',
      intro: 'Your name appears at the end of the finale letter.',
      fields: ['senderName'],
    },
    {
      title: 'The reasons',
      heading: 'The reasons',
      intro: 'Each reason hides under a gold-foil card. Edit ours or write your own.',
      fields: ['reasons'],
    },
    {
      title: 'The finale',
      heading: 'The closing message',
      intro: 'Shown after all cards are revealed. Your name signs it off automatically.',
      fields: ['finaleText'],
    },
  ],

  create: {
    eyebrow: 'Kashf · Reasons I Love You',
    headline: 'Every reason, hidden in gold.',
    intro: 'Gold-foil scratch cards, each hiding one reason you love him. He scratches them away one by one — or taps “reveal all” once he’s started. Three short steps, one required field, and a preview that follows every word you type.',
    noun: 'scratch cards',
    designHeading: 'Gold foil, then your words',
    designIntro: 'Each card is sealed in brushed gold. Scratch or drag to reveal the reason beneath.',
    scenes: [
      'gold-foil cards, one per reason — “scratch me”',
      'drag to scratch the foil away; the reason appears at 55 % cleared',
      'a sparkle burst and a counter tick on every reveal',
      '“reveal all” fades in after the second card — skip to the finale at any time',
      'a closing letter appears once every card is cleared',
    ],
    previewCta: 'Scratch the cards exactly as he will.',
    previewHelp: 'Drag across a card to scratch the foil away.',
    resultLine: 'Send him the link. The gold foil is sealed and waiting.',
  },

  demo: {
    senderName: 'Priya',
    reasons: REASONS,
    finaleText: 'and about a million more reasons…\nhappy boyfriend day ❤️',
  },

  sections: ['cards', 'finale'],
  theme: {
    bg: '#FBF3E4', ink: '#2B2118', accent: '#B85C48', soft: '#EADCC0',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
