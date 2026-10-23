'use strict';
/**
 * Suvarna Vivah — a premium wedding invitation with a click-to-play ceremonial opener.
 * The uploaded kalash film gives way to the full Shaadi Paigaam wedding experience.
 * It shares the established seven-step customizer, validation, RSVP, and publishing flow.
 */
module.exports = {
  slug: 'suvarna-vivah',
  name: 'Suvarna Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A golden, ceremonial welcome: tap to play the kalash-and-marigold opening film, then discover your own full wedding invitation with live countdown, events, venue, RSVP and guest dashboard. Eight palettes, four type styles and eight languages.',
  thumbnail_url: '/suvarna-vivah/opening-poster.jpg',
  version: 1,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['doors', 'hero', 'welcome', 'scratch', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'pre', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#F6F3E9', ink: '#0A3A2C', accent: '#0F5440', soft: '#E6DCC2', motif: 'kalash', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
