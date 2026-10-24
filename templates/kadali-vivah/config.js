'use strict';
/**
 * Kadali Vivah — a three-dimensional Indian wedding website with a tap-to-open banana leaf welcome.
 * Sculptural banana leaves part to reveal a personalized wedding invitation website.
 * It shares the established seven-step customizer, validation, RSVP, and publishing flow.
 */
module.exports = {
  slug: 'kadali-vivah',
  name: 'Kadali Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A sculptural banana-leaf welcome: tap to open a 3D Indian wedding invitation website with live countdown, events, venue, website RSVP and guest dashboard. Eight palettes, four type styles and eight languages.',
  thumbnail_url: '/kadali-vivah/art/kalash.webp',
  version: 1,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['doors', 'hero', 'welcome', 'scratch', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'pre', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#FBF3E8', ink: '#5A2914', accent: '#9C4E2B', soft: '#EFD8BF', motif: 'banana-leaf', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
