'use strict';
/**
 * Birthday Paigaam — a love-letter scrapbook birthday surprise.
 *
 * Seven screens behind a passcode: unlock → "wanna see it?" → a wax-sealed
 * letter → a voice note → our song → a scrapbook of polaroids, sticky notes
 * and reasons → the grand finale with a cake to blow out. Every visual is
 * original inline SVG/CSS; every sound effect is synthesised in the browser.
 * The sender's own photos, voice note and song are uploaded in the wizard.
 *
 * Editable: everything — names, passcode, all copy, photos, audio, palette,
 * fonts and which screens appear. Routes: lib/birthdayPaigaamRoutes.js.
 */
module.exports = {
  slug: 'birthday-paigaam',
  name: 'Birthday Paigaam',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'A secret birthday surprise behind a passcode — a wax-sealed letter, your voice note, your song, a scrapbook of your photos, and a cake to blow out. Soft, dreamy, made by hand.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName', label: 'Your name', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'letter', label: 'Your letter', type: 'textarea', placeholder: 'Happy birthday, my favourite human…', group: 'message' },
    { id: 'mainPhoto', label: 'Their photo', type: 'image', group: 'photos' },
  ],
  sections: ['unlock', 'question', 'letter', 'voice', 'song', 'scrapbook', 'finale'],
  theme: {
    bg: '#FFF4D6', ink: '#5B2A3C', accent: '#C2185B', soft: '#F9C6D4',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
