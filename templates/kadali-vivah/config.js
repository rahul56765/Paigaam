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
  description: 'Your original ceremonial film opens into an immersive 3D wedding journey: carved temple colonnades, marigold garlands, a copper kalash and a scroll-directed mandap. Personalise with Paigaam’s seven-step editor; guests RSVP directly to your organiser on WhatsApp.',
  thumbnail_url: '/kadali-vivah/art/kalash.webp',
  version: 2,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['doors', 'hero', 'welcome', 'scratch', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'pre', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#FBF3E8', ink: '#5A2914', accent: '#9C4E2B', soft: '#EFD8BF', motif: 'banana-leaf', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
