'use strict';
module.exports = {
  slug: 'sheesh-mahal', name: 'Sheesh Mahal', category: 'Wedding', price: 0, currency: 'INR',
  description: 'A Rajasthan sunset palace, a vintage teal Ambassador, an emerald invitation and a moonlit finale. Personalise your families, twenty wedding functions, photos, venues and WhatsApp RSVP.',
  thumbnail_url: '/sheesh-mahal/sunset.webp', version: 1, editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['hero', 'welcome', 'photos', 'countdown', 'timeline', 'venue', 'rsvp', 'closing'],
  theme: { bg: '#F7EDDA', ink: '#103F35', accent: '#B99A58', soft: '#DFCCAA', motif: 'palace', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
