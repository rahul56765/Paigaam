'use strict';
/**
 * Love Awaits — the proposal that refuses to take no for an answer.
 *
 * A port of github.com/ft976/97 ("Love Awaits"): a tap-to-start page with a
 * 7,000-particle heart condensing out of stardust, floating hearts and roses,
 * and a question card backed by a cat companion. Every "No" walks the ladder —
 * sad, pleading, grumpy, knife, gun — and at the last rung the No button
 * literally runs away. "Yes, Forever" bursts the screen in confetti and keeps
 * the answer (a full-bleed "Forever & Always" card) for every return visit.
 *
 * The original runs React + Babel + three.js + GSAP from CDNs; this port is
 * the same choreography on a hand-rolled canvas 2D heart field, a DOM scene
 * machine and a generative Web Audio score — zero libraries, like every
 * Paigaam template.
 *
 * Media: the seven cat images are the template's own artwork, restored to
 * public/love-awaits/media/ at boot by lib/loveAwaitsMedia.js. The original's
 * soundtrack was a copyrighted commercial MP3 (Ed Sheeran, "Perfect") which
 * cannot be redistributed — the port replaces it with a synthesised score,
 * per the Saalgirah precedent.
 *
 * Editable: the sender personalises the opening title, the question, its
 * subtitle, the two buttons and the finale card. The plea ladder, the cat
 * reactions and the timing are fixed — they are the template.
 */
module.exports = {
  slug: 'love-awaits',
  name: 'Love Awaits',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'A universe of stardust gathers into a heart, a cat pleads their case, and the No button learns to run. One tap to begin, one answer to keep forever.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'introTitle',    label: 'The opening title', type: 'text', placeholder: 'Love Awaits', group: 'message' },
    { id: 'question',      label: 'The big question', type: 'text', placeholder: 'Will You Be My Forever?', group: 'message' },
    { id: 'questionNote',  label: 'The line beneath it', type: 'text', placeholder: 'In a universe of billions, my heart chose you…', group: 'message' },
    { id: 'yesLabel',      label: 'The yes button', type: 'text', placeholder: 'Yes, Forever', group: 'message' },
    { id: 'noLabel',       label: 'The no button', type: 'text', placeholder: 'No', group: 'message' },
    { id: 'finaleTitle',   label: 'The celebration heading', type: 'text', placeholder: 'Forever & Always', group: 'message' },
    { id: 'finaleLine',    label: 'The celebration line', type: 'text', placeholder: 'You are my today and all of my tomorrows.', group: 'message' },
  ],
  sections: ['question', 'celebration'],
  theme: {
    bg: '#0a0206', ink: '#ffffff', accent: '#ff0060', soft: '#2a0e18',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
