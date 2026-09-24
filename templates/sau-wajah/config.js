'use strict';
/**
 * Sau Wajah — "a hundred reasons", a birthday Paigaam.
 *
 * Port of felisaans/cute-birthday-website (MIT): a pastel four-scene
 * microsite — a hero with a floating hearts-and-stars background, an
 * interactive polaroid gallery, a clothesline of hanging photos above a
 * slowly auto-scrolling "100 reasons why I love you" list, and a typewriter
 * birthday letter that ends in a confetti burst. A persistent song and a
 * little note the recipient can write back in follow them across every
 * scene.
 *
 * The original shipped as four static HTML pages; here the four scenes are
 * one document (no page reloads), so the music and the note persist by
 * construction instead of via sessionStorage hacks. The original's placeholder
 * GIFs (pastel "replace me" boxes) are NOT ported — every visual is inline
 * SVG or drawn in the browser. The sender may upload their own photos
 * (0–9); without them the gallery and clothesline still play with hand-drawn
 * placeholder polaroids.
 */
module.exports = {
  slug: 'sau-wajah',
  name: 'Sau Wajah',
  category: 'Birthday',
  price: 0,
  currency: 'INR',
  description: 'A hundred reasons, one song, and a letter that types itself — floating hearts, a polaroid gallery, a clothesline of little photos, and confetti at the end.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'heroTitle',     label: 'The big line', type: 'text', placeholder: 'happy birthday my girlfriend!!', group: 'message' },
    { id: 'heroSubtitle',  label: 'The line under it', type: 'text', placeholder: 'yess, this is your special day <3', group: 'message' },
    { id: 'galleryHeading',   label: 'The gallery heading', type: 'text', placeholder: 'our little moments', group: 'message' },
    { id: 'reasonsHeading',   label: 'The reasons heading', type: 'text', placeholder: '100 reasons why i love you', group: 'message' },
    { id: 'reasons',          label: 'The reasons — one per line', type: 'textarea', placeholder: 'the way you laugh at your own jokes\nhow you scrunch your nose when you smile\n…', group: 'message' },
    { id: 'letterTitle',      label: 'The letter title', type: 'text', placeholder: 'Happy Birthday My Girl!!! <33', group: 'message' },
    { id: 'letterBody',       label: 'The letter', type: 'textarea', placeholder: 'My love,\n\nHappy birthday to the most wonderful person I know…', group: 'message' },
    { id: 'signature',        label: 'The signature line', type: 'text', placeholder: '— your biggest fan', group: 'message' },
  ],
  sections: ['hero', 'gallery', 'reasons', 'letter'],
  theme: {
    bg: '#FFFAF9', ink: '#5B4A5A', accent: '#FF9FC7', soft: '#FFD6E8',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
