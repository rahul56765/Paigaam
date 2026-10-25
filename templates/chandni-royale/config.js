'use strict';
module.exports = {
  slug: 'chandni-royale',
  name: 'Chandni Royale',
  category: 'Wedding',
  status: 'draft',
  price: 0,
  currency: 'INR',
  description: 'A moonlit royal wedding invitation with palace gates, family blessings, up to twenty wedding functions, venue directions and simple WhatsApp RSVP. Original artwork, optional creator-uploaded music, and a future cinematic opener.',
  thumbnail_url: '/assets/chandni-royale/gates-closed.webp',
  version: 1,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['doors', 'hero', 'welcome', 'scratch', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#F5F0E6', ink: '#51463C', accent: '#B79B64', soft: '#E6DED0', motif: 'palace', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
