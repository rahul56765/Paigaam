'use strict';
/**
 * Saalgirah — a birthday Paigaam for someone you love.
 *
 * A 1:1 cinematic microsite in four scenes: a wax-sealed envelope, a quiet
 * three-line confession, a cake whose candles you blow out, and a closing
 * declaration. Every visual is hand-drawn SVG and every sound is synthesised
 * in the browser, so the template carries no image, audio or video assets.
 *
 * Editable: the sender personalises the names and the words; the choreography,
 * artwork and sound design are fixed (they are the template).
 */
module.exports = {
  slug: 'saalgirah',
  name: 'Saalgirah',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'Some birthdays deserve more than a text. A little wax-sealed letter that opens into candlelight — four scenes, a small white bear, and the words you never quite say out loud.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'line1',         label: 'Opening line', type: 'text', placeholder: 'I was going to write something normal…', group: 'message' },
    { id: 'line2',         label: 'Second line', type: 'text', placeholder: 'but you’re not exactly a normal person to me.', group: 'message' },
    { id: 'line3',         label: 'Third line', type: 'text', placeholder: 'So… I made you this.', group: 'message' },
    { id: 'attentionLine', label: 'Before the cake', type: 'text', placeholder: 'Okay… now that I have your attention.', group: 'message' },
    { id: 'wishLine',      label: 'The birthday wish', type: 'text', placeholder: 'HAPPY BIRTHDAY, MEHER.', group: 'message' },
    { id: 'closingLine',   label: 'The last words', type: 'text', placeholder: 'I LOVE YOU.', group: 'message' },
    { id: 'note',          label: 'A small note at the end (optional)', type: 'textarea', placeholder: 'Thank you for every ordinary day.', group: 'message' },
  ],
  sections: ['envelope', 'reveal', 'birthday', 'closing'],
  theme: {
    bg: '#FBF6EE', ink: '#7a4538', accent: '#9C3B3B', soft: '#F7E2DD',
    motif: 'flame', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
