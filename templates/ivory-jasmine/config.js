'use strict';
/** Ivory Jasmine uses the proven wedding editor with its own stationery renderer. */
module.exports = {
  slug: 'ivory-jasmine',
  name: 'Ivory Jasmine',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A long-form Indian wedding invitation in ivory paper, white jasmine and torn stationery. Personalise your families, up to twenty celebrations, venues, photographs and languages, with simple Yes / No RSVP directly to your organiser’s WhatsApp.',
  thumbnail_url: '/ivory-jasmine/art/hero-florals.webp',
  version: 1,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['hero', 'welcome', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#FFFCF5', ink: '#37412F', accent: '#A78B59', soft: '#EBE9DF', motif: 'jasmine', ampersand: true, serifCase: 'title', layout: 'stationery' },
};
