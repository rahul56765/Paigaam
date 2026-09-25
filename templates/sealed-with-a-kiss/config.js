'use strict';
/**
 * Mohar — Sealed With A Kiss. (Boyfriend Day family, template 1.)
 *
 * "Mohar" (मोहर / مہر) is a seal: a kraft envelope closed with a wax seal
 * pressed with the sender's initial. One tap lifts the flap, the letter rises
 * out of the envelope, and the whole handwritten letter is revealed line by
 * line — salutation, every paragraph, then an ink flourish that draws itself
 * under the sign-off. "Read it again" folds it all back into the envelope.
 *
 * Zero media: the paper grain is an inline SVG turbulence filter, the
 * envelope and the wax are CSS. Fonts: Fraunces + Caveat (Google Fonts).
 * Reduced motion: every transition collapses to an instant cut.
 *
 * Editable: who it's from (and the seal's initial), the salutation, the
 * letter's paragraphs (1–8), the sign-off, signature and date line. Every
 * field defaults to the original copy, so an untouched form still sends the
 * designed letter. The mechanic and the motion are the template.
 */
const PARAGRAPHS = [
  'Happy Boyfriend Day, my love. I keep thinking about how lucky I am that the universe, in all its chaos, decided to hand me you.',
  'Thank you for the way you listen — really listen — even when I’m rambling about nothing at all. For the coffee you make without being asked, and the way you find my hand in a crowd without ever looking.',
  'You make ordinary Tuesdays feel like small celebrations. With you, even waiting in line becomes my favourite part of the day.',
  'So whatever this year brings, I want to face it beside you — laughing at the same silly things, building the same quiet little life, one ordinary miracle at a time.',
];

module.exports = {
  slug: 'sealed-with-a-kiss',
  family: 'bfday',
  name: 'Mohar',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Sealed With A Kiss — a kraft envelope closed with a wax seal. One tap breaks it, and your handwritten letter unfolds line by line, signed off with a flourish of ink.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  displayField: 'senderName',

  fields: [
    { id: 'senderName', type: 'text', label: 'Your name', required: true, maxLength: 40, placeholder: 'Rahul',
      hint: 'On the envelope (“from Rahul”) and beside the date at the end.' },
    { id: 'sealInitial', type: 'text', label: 'The initial pressed into the wax', maxLength: 2, placeholder: 'R',
      hint: 'One or two letters (or an emoji). Leave it blank to use the first letter of your name.' },
    { id: 'salutation', type: 'text', label: 'How the letter opens', maxLength: 60, default: 'My dearest,' },
    { id: 'paragraphs', type: 'list', label: 'The letter', itemLabel: 'Paragraph', addLabel: 'Add a paragraph',
      minItems: 1, maxItems: 8, item: { type: 'textarea', maxLength: 600, rows: 4, placeholder: 'Write a paragraph…' },
      default: PARAGRAPHS,
      hint: 'Each paragraph appears on its own, one after another. Edit ours, or write your own.' },
    { id: 'closing', type: 'text', label: 'The sign-off', maxLength: 40, default: 'Forever yours,' },
    { id: 'signature', type: 'text', label: 'Under the sign-off', maxLength: 60, default: '— your favourite person' },
    { id: 'dateLine', type: 'text', label: 'The date', maxLength: 40, default: 'October 3',
      hint: 'Printed beside your name at the very end. Boyfriend Day is October 3.' },
  ],

  steps: [
    { title: 'Who it’s from', heading: 'Who is it from?', intro: 'Your name goes on the envelope; its first letter is pressed into the wax seal.', fields: ['senderName', 'sealInitial'] },
    { title: 'The letter', heading: 'The letter', intro: 'Leave our words as they are if they already sound like you — the preview follows every keystroke.', fields: ['salutation', 'paragraphs'] },
    { title: 'The sign-off', heading: 'Sign it', intro: 'The flourish of ink draws itself under these lines.', fields: ['closing', 'signature', 'dateLine'] },
  ],

  create: {
    eyebrow: 'Mohar · Sealed With A Kiss',
    headline: 'A letter, sealed with a kiss.',
    intro: 'A kraft envelope, closed with wax and your initial. They tap to break the seal, the letter rises out, and your words appear one line at a time. Three short steps, one required field, and a preview that follows every word you type.',
    noun: 'letter',
    designHeading: 'One envelope, one letter',
    designIntro: 'It opens on a sealed envelope that says who it is from. Everything after that is your letter.',
    scenes: [
      'the envelope, sealed in wax with your initial — “tap to open”',
      'the flap lifts and the letter slides up out of the envelope',
      'your letter, revealed line by line, with an ink flourish under the sign-off',
    ],
    previewCta: 'Break the seal exactly as they will.',
    previewHelp: 'Tap the envelope to open it — then “read it again” to seal it back up.',
    resultLine: 'Send them the link. The envelope is sealed and waiting.',
  },

  /** /sealed-with-a-kiss/demo, the collection thumbnail and the detail page. */
  demo: {
    senderName: 'Rahul',
    salutation: 'My dearest,',
    paragraphs: PARAGRAPHS,
    closing: 'Forever yours,',
    signature: '— your favourite person',
    dateLine: 'October 3',
  },

  sections: ['envelope', 'letter'],
  theme: {
    bg: '#FBF3E4', ink: '#2B2118', accent: '#B85C48', soft: '#EADCC0',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
