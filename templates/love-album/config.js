'use strict';
/**
 * Love Album — a draggable 3D memory gallery.
 *
 * Port of ziddi-shop/love-you (MIT): a romantic intro page ("Hey Pookie…")
 * that opens into a three-dimensional gallery of draggable photo cards.
 * Drag a card far enough and it flips to its back; cards are photos the
 * sender uploads, interleaved with little message cards. Once most cards
 * have been touched, a final love-letter button appears.
 *
 * Ziddi branding replaced with Paigaam throughout; "Pookie"/"Madam jii"
 * copy became editable fields (defaults keep the playful spirit without
 * assuming the recipient's gender).
 *
 * The sender MUST upload photos — between 3 and 9 — because the gallery
 * is the photos. Message cards are interleaved automatically from the
 * sender's three editable notes. The two MP3s and the demo photos of the
 * original are NOT ported (they are the original author's personal
 * content); Paigaam's brand precedent is that personal media never ships
 * with a template.
 */
module.exports = {
  slug: 'love-album',
  name: 'Love Album',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'A little intro, then a gallery of draggable photo cards that flip when you slide them — with hidden messages on the backs and a love letter waiting at the end.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name (or nickname)', type: 'text', required: true, placeholder: 'Pookie', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'introLine',     label: 'The intro message', type: 'textarea', placeholder: 'Hey Pookie, I made something special just for you! A little surprise is waiting—wrapped in love and magic.', group: 'message' },
    { id: 'continueLabel', label: 'The intro button says', type: 'text', placeholder: "Let's Go!", group: 'message' },
    { id: 'message1',      label: 'Hidden message · one', type: 'text', placeholder: 'You make my heart smile every day! ❤️', group: 'message' },
    { id: 'message2',      label: 'Hidden message · two', type: 'text', placeholder: 'I love the way your eyes crinkle when you laugh! 😊', group: 'message' },
    { id: 'message3',      label: 'Hidden message · three', type: 'text', placeholder: 'Every moment with you is a gift I cherish! 💝', group: 'message' },
    { id: 'letterTitle',   label: 'The love letter title', type: 'text', placeholder: 'To My Dearest', group: 'message' },
    { id: 'letterBody',    label: 'The love letter', type: 'textarea', placeholder: "Thank you for being the most incredible person in my world. Every moment with you is a treasure…", group: 'message' },
    { id: 'finalLabel',    label: 'The final button says', type: 'text', placeholder: 'One last thing for you! 💕 Click here!', group: 'message' },
  ],
  sections: ['intro', 'gallery', 'letter'],
  theme: {
    bg: '#FFD1E3', ink: '#674A7A', accent: '#FF4D8D', soft: '#F8C1FF',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
