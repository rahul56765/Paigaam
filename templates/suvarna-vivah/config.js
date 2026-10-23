'use strict';
/**
 * Suvarna Vivah — a premium wedding invitation with a click-to-play ceremonial opener.
 * The uploaded kalash film gives way to an original ceremony-led wedding invitation.
 * It shares Paigaam's seven-step customizer, validation, RSVP, and publishing flow—not the Shaadi page design.
 */
module.exports = {
  slug: 'suvarna-vivah',
  name: 'Suvarna Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A cinematic kalash opening gives way to an original, editorial wedding invitation: family blessing, ceremony itinerary, venue, memories and RSVP. Made in emerald, antique gold and marigold, with eight palettes and eight languages.',
  thumbnail_url: '/suvarna-vivah/ceremony-still-life.webp',
  version: 1,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['hero', 'welcome', 'families', 'timeline', 'venue', 'photos', 'details', 'rsvp', 'closing'],
  theme: { bg: '#F6F3E9', ink: '#0A3A2C', accent: '#0F5440', soft: '#E6DCC2', motif: 'kalash', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
