'use strict';

/**
 * Royal Vivah — fixed-art, editable-copy invitation. The five user-supplied
 * images remain the visual source; customer text is rendered in HTML so the
 * ornate artwork, borders and layout never depend on customer content.
 */
const EVENTS = [
  { name: 'HALDI CEREMONY', date: '2nd December 2025', time: '10:00 AM', venue: 'At Gulmohar Courtyard', address: 'Baner, Pune' },
  { name: 'MEHENDI & SANGEET', date: '2nd December 2025', time: '6:30 PM', venue: 'At The Marigold Haveli', address: 'Aundh, Pune' },
  { name: 'WEDDING CEREMONY', date: '4th December 2025', time: '11:00 AM', venue: 'At Shree Rajwada Gardens', address: 'Koregaon Park, Pune' },
  { name: 'WEDDING RECEPTION', date: '4th December 2025', time: '7:00 PM', venue: 'At The Saffron Palace', address: 'Kalyani Nagar, Pune' },
];

module.exports = {
  slug: 'royal-vivah',
  family: 'bfday',
  name: 'Royal Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A vintage rose-and-gold wedding invitation: a sealed envelope opens into a four-scene illustrated keepsake with editable family, event and venue details.',
  thumbnail_url: '',
  ogImage: '/royal-vivah/invitation.webp',
  version: 1,
  editable: true,
  backgroundMusic: false,
  displayField: 'brideName',

  fields: [
    { id: 'brideName', type: 'text', label: "Bride's name", required: true, maxLength: 36, placeholder: 'Vatsala' },
    { id: 'coupleJoiner', type: 'text', label: 'Word between your names', maxLength: 12, default: '&' },
    { id: 'groomName', type: 'text', label: "Groom's name", required: true, maxLength: 36, placeholder: 'Siddhant' },
    { id: 'saveWeds', type: 'text', label: 'Small line beneath names', maxLength: 24, default: 'weds' },
    { id: 'familyWith', type: 'text', label: 'Word between names on family page', maxLength: 20, default: 'with' },
    { id: 'brideFamilyLine', type: 'text', label: "Bride's family line", maxLength: 120, default: 'Mrs. Meenal & Mr. Rajendra Deshmukh' },
    { id: 'groomFamilyLine', type: 'text', label: "Groom's family line", maxLength: 120, default: 'Son of Mrs. Kavita & Mr. Aniruddh Kulkarni' },
    { id: 'weddingDate', type: 'date', label: 'Wedding date', required: true, default: '2025-12-04' },
    { id: 'weddingTime', type: 'text', label: 'Final event time', maxLength: 40, default: '7:00 PM onwards' },
    { id: 'weddingCity', type: 'text', label: 'Wedding city / region', maxLength: 80, default: 'Pune, Maharashtra' },

    { id: 'blessingsHeading', type: 'text', label: 'Family-page heading', maxLength: 70, default: 'WITH THE BLESSINGS OF OUR ELDERS' },
    { id: 'familyRequest', type: 'textarea', label: 'Family-page invitation copy', maxLength: 220, rows: 3, default: 'request the pleasure of your gracious presence\nat the wedding celebrations of their beloved daughter' },
    { id: 'eventsHeading', type: 'text', label: 'Events-page heading', maxLength: 70, default: 'THE WEDDING FESTIVITIES' },
    { id: 'invitationHeading', type: 'text', label: 'Final-page heading', maxLength: 50, default: 'A FEAST OF LOVE' },
    { id: 'invitationLead', type: 'text', label: 'Final-page greeting', maxLength: 100, default: 'Your presence is our greatest gift.' },
    { id: 'finalEventTitle', type: 'text', label: 'Final-page event title', maxLength: 70, default: 'DINNER & RECEPTION' },
    { id: 'invitationMessage', type: 'textarea', label: 'Final-page invitation', maxLength: 360, rows: 5, default: 'Join us to celebrate a beautiful new beginning\nfilled with love, laughter and blessings.\n\nCome for the celebrations,\nstay for the memories,\nand join us for a delightful feast!' },
    { id: 'closingLine', type: 'text', label: 'Closing sign-off', maxLength: 90, default: 'With love,' },
    { id: 'familySignoff', type: 'text', label: 'Family sign-off', maxLength: 120, default: 'THE DESHMUKH & KULKARNI FAMILIES' },

    {
      id: 'events', type: 'list', label: 'Wedding events', itemLabel: 'Event', addLabel: 'Add an event',
      minItems: 1, maxItems: 4,
      shape: [
        { id: 'name', type: 'text', label: 'Event title', required: true, maxLength: 54 },
        { id: 'date', type: 'text', label: 'Date', required: true, maxLength: 44 },
        { id: 'time', type: 'text', label: 'Time', required: true, maxLength: 36 },
        { id: 'venue', type: 'text', label: 'Venue', required: true, maxLength: 96 },
        { id: 'address', type: 'text', label: 'Venue locality', maxLength: 96 },
      ],
      default: EVENTS,
      hint: 'The four illustrated schedule rows keep their original fixed positions and artwork.',
    },
    { id: 'venueName', type: 'text', label: 'Main venue name', maxLength: 100, default: 'The Saffron Palace' },
    { id: 'venueAddress', type: 'text', label: 'Main venue address', maxLength: 140, default: 'Kalyani Nagar, Pune' },
    { id: 'mapLink', type: 'url', label: 'Google Maps directions link', maxLength: 500, default: 'https://www.google.com/maps/search/?api=1&query=The+Saffron+Palace%2C+Kalyani+Nagar%2C+Pune', hint: 'Paste a Google Maps URL. The venue text on the final page will open directions.' },
  ],

  steps: [
    { title: 'The couple', heading: 'The names on your invitation', intro: 'These names appear on the Save the Date and both invitation pages.', fields: ['brideName', 'coupleJoiner', 'groomName', 'saveWeds', 'weddingDate', 'weddingCity'] },
    { title: 'The families', heading: 'Family names & blessing', intro: 'Personalise the family-page heading and both family lines.', fields: ['blessingsHeading', 'brideFamilyLine', 'groomFamilyLine', 'familyRequest', 'familyWith'] },
    { title: 'The celebrations', heading: 'Your event schedule', intro: 'Edit the schedule copy while the four original illustrations and dividers stay fixed.', fields: ['eventsHeading', 'events'] },
    { title: 'The invitation', heading: 'The final card', intro: 'Every line on the final invitation is editable; paste a venue link so guests can open directions.', fields: ['invitationHeading', 'invitationLead', 'finalEventTitle', 'invitationMessage', 'weddingTime', 'venueName', 'venueAddress', 'closingLine', 'familySignoff', 'mapLink'] },
  ],

  create: {
    eyebrow: 'Royal Vivah · A Wedding Invitation',
    headline: 'A sealed envelope. A keepsake invitation.',
    intro: 'Open the heart seal to reveal the Save the Date, family invitation, celebration schedule and final details. The reference artwork stays fixed while the names, dates, family copy, event schedule and venue link are yours to edit.',
    noun: 'wedding invitation',
    designHeading: 'Four illustrated scenes',
    designIntro: 'Scroll from the rose envelope through the original invitation artwork, ending with the venue directions.',
    scenes: ['A heart-sealed envelope opens to the Save the Date', 'The families’ invitation and full couple names', 'Four illustrated wedding celebrations with editable times and venues', 'The final invitation and tappable Google Maps venue link'],
    previewCta: 'Open the envelope and scroll through the invitation.',
    previewHelp: 'Tap the heart seal, then scroll to continue.',
    resultLine: 'Share one beautiful wedding invitation link with every guest.',
  },

  demo: {
    brideName: 'Vatsala',
    coupleJoiner: '&',
    groomName: 'Siddhant',
    saveWeds: 'weds',
    familyWith: 'with',
    brideFamilyLine: 'Mrs. Meenal & Mr. Rajendra Deshmukh',
    groomFamilyLine: 'Son of Mrs. Kavita & Mr. Aniruddh Kulkarni',
    weddingDate: '2025-12-04',
    weddingTime: '7:00 PM onwards',
    weddingCity: 'Pune, Maharashtra',
    blessingsHeading: 'WITH THE BLESSINGS OF OUR ELDERS',
    familyRequest: 'request the pleasure of your gracious presence\nat the wedding celebrations of their beloved daughter',
    eventsHeading: 'THE WEDDING FESTIVITIES',
    invitationHeading: 'A FEAST OF LOVE',
    invitationLead: 'Your presence is our greatest gift.',
    finalEventTitle: 'DINNER & RECEPTION',
    invitationMessage: 'Join us to celebrate a beautiful new beginning\nfilled with love, laughter and blessings.\n\nCome for the celebrations,\nstay for the memories,\nand join us for a delightful feast!',
    closingLine: 'With love,',
    familySignoff: 'THE DESHMUKH & KULKARNI FAMILIES',
    events: EVENTS,
    venueName: 'The Saffron Palace',
    venueAddress: 'Kalyani Nagar, Pune',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=The+Saffron+Palace%2C+Kalyani+Nagar%2C+Pune',
  },

  sections: ['envelope', 'save-date', 'families', 'events', 'invitation'],
  theme: { bg: '#f6e8dc', ink: '#5b202b', accent: '#9a2e45', soft: '#ead1c1', motif: 'rose', ampersand: true, serifCase: 'title', layout: 'story' },
};
