'use strict';
// Additive registry entry. Seed as draft: the owner decides when to publish.
module.exports = {
  slug: 'aasmaan', name: 'Aasmaan — A Celestial Wedding', category: 'Wedding',
  status: 'draft', price: 0, currency: 'INR', version: 1, editable: true,
  description: 'An invitation written in the stars: a celestial wedding celebration with your story, photographs, events and venue. Guests reply directly to your organiser on WhatsApp. Optional music is your own upload, played only on request.',
  thumbnail_url: '/aasmaan/hero.webp',
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['hero', 'welcome', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'pre', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#080E22', ink: '#F8F0D9', accent: '#D9B96F', soft: '#192342', motif: 'stars', ampersand: true, serifCase: 'title', layout: 'celestial' },
};
