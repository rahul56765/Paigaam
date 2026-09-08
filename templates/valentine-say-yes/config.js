'use strict';
/**
 * Valentine "Say Yes" — the question that cannot be refused.
 *
 * A port of CodeKageHQ/Ask-out-your-Valentine (MIT): one page, one question.
 * Every "No" swaps the kitten GIF for a sadder one and grows the "Yes" button
 * while the "No" button pleads harder — until saying yes is the only sensible
 * thing left to do. "Yes" earns a celebration GIF and a burst of heart confetti.
 *
 * Media: the seven kitten GIFs are the template's own artwork, restored to
 * public/valentine-say-yes/media/ at boot by lib/valentineMedia.js. Everything
 * else — layout, animation, confetti — is hand-rolled CSS/SVG/canvas with no
 * library dependencies.
 *
 * Editable: the sender personalises the question, the yes/no pleas and the
 * celebration message; the mechanic, the artwork and the timing are fixed
 * (they are the template).
 */
module.exports = {
  slug: 'valentine-say-yes',
  name: 'Valentine Say Yes',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'The question that cannot be refused. Every “No” makes the “Yes” button bigger and the pleading harder to resist — until there is only one answer left.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'question',      label: 'The big question', type: 'text', placeholder: 'Will you be my Valentine?', group: 'message' },
    { id: 'yesLabel',      label: 'The yes button', type: 'text', placeholder: 'Yes', group: 'message' },
    { id: 'noLabel',       label: 'The no button’s first word', type: 'text', placeholder: 'No', group: 'message' },
    { id: 'celebration',   label: 'The celebration message', type: 'text', placeholder: 'Yayyy!! :3', group: 'message' },
  ],
  sections: ['question', 'celebration'],
  theme: {
    bg: '#FFD0E5', ink: '#BD1E59', accent: '#BD1E59', soft: '#FFE8F2',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
