'use strict';
/**
 * Shaadi Paigaam — a royal wedding invitation website.
 *
 * Sealed embossed doors with a gold "tap to open" medallion → silk curtains
 * part and tie back over a garden courtyard → names & families → welcome →
 * scratch-to-reveal heart (save the date, .ics) → photos → live countdown →
 * program timeline → venue map → dress code → pre-wedding events →
 * transport → stay → gifts → RSVP (private dashboard) → closing.
 *
 * Everything the couple writes is data (public/shaadi-paigaam/core.js schema);
 * the art is layered & recoloured live from 8 palettes or 3 custom colours.
 * Free (price 0, set in Admin). If priced later, publishing goes through the
 * same inline Razorpay checkout as every bespoke template).
 * Routes: lib/shaadiPaigaamRoutes.js · Editor: pages/shaadiPaigaamCreate.js
 */
module.exports = {
  slug: 'shaadi-paigaam',
  name: 'Shaadi Paigaam',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A royal wedding invitation website: embossed doors that open on a silk-draped garden courtyard, a scratch-to-reveal date, live countdown, maps, events, RSVP with your own guest dashboard, and Hindi, Marathi & 6 more languages. Eight palettes or your own colours.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'groom', label: 'Groom', type: 'text', required: true, group: 'couple' },
    { id: 'bride', label: 'Bride', type: 'text', required: true, group: 'couple' },
    { id: 'date', label: 'Wedding date', type: 'date', required: true, group: 'details' },
  ],
  sections: ['doors', 'hero', 'welcome', 'scratch', 'photos', 'countdown', 'timeline', 'venue', 'dress', 'pre', 'transport', 'stay', 'gifts', 'rsvp', 'closing'],
  theme: { bg: '#FBF3E6', ink: '#4A0E1A', accent: '#5C1020', soft: '#EBD3B5', motif: 'heart', ampersand: true, serifCase: 'title', layout: 'cinematic' },
};
