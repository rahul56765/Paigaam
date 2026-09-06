'use strict';
/**
 * Lavender Bloom Surprise — a "miss you" Paigaam that is also a tiny game.
 *
 * Four stages, one continuous scene: a sealed envelope ("Open when you miss
 * me"), a tic-tac-toe board the visitor always wins (the game is rigged — the
 * bot never blocks the first column and never completes its own line), a gift
 * box that bursts, and a lavender sprout that grows three stems and blooms.
 *
 * Every visual is hand-drawn SVG/CSS and the confetti is a hand-rolled canvas
 * simulation, so the template carries no image, audio or video assets.
 *
 * Editable: the sender personalises the name, the final title, the message and
 * the flower colour; the choreography, the rig and the artwork are fixed (they
 * are the template).
 */
module.exports = {
  slug: 'lavender-tic-tac-toe-bloom',
  name: 'Lavender Bloom Surprise',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'For the days you miss them. A sealed envelope, a game of tic-tac-toe they are guaranteed to win, and a lavender bloom that grows just for them.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Yashika', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'title',         label: 'The final title', type: 'text', placeholder: 'For You!', group: 'message' },
    { id: 'message',       label: 'The message underneath', type: 'textarea', placeholder: 'Because you make every day as bright as a blooming flower. I miss you more than words can say!', group: 'message' },
    { id: 'flowerColor',   label: 'Flower colour', type: 'select', options: ['lavender', 'rose', 'sunbeam'], placeholder: 'lavender', group: 'design' },
  ],
  sections: ['envelope', 'game', 'gift', 'bloom'],
  theme: {
    bg: '#F0F7FF', ink: '#1E293B', accent: '#8A5CF5', soft: '#C2DCF9',
    motif: 'bloom', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
