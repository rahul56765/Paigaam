'use strict';

const EVENT_OPTIONS = [
  { value: 'haldi', label: 'Haldi Ceremony' },
  { value: 'sangeet', label: 'Sangeet Night' },
  { value: 'wedding', label: 'Wedding Ceremony' },
  { value: 'reception', label: 'Wedding Reception' },
];

const EVENTS = [
  { kind: 'haldi', pageTitle: 'Haldi Ceremony', themeLine: 'A sunlit afternoon of turmeric & laughter', date: '2027-02-12', time: '11:00 AM', baraatTime: '', pheraTime: '', venue: 'Suryagarh Courtyard, Jaipur', dressCode: 'Yellow and ivory' },
  { kind: 'sangeet', pageTitle: 'Sangeet Night', themeLine: 'An evening of music, dance & celebration', date: '2027-02-13', time: '7:00 PM', baraatTime: '', pheraTime: '', venue: 'Suryagarh Courtyard, Jaipur', dressCode: 'Jewel tones' },
  { kind: 'wedding', pageTitle: 'Wedding Ceremony', themeLine: 'Together, beneath the mandap', date: '2027-02-14', time: '', baraatTime: '4:30 PM', pheraTime: '7:15 PM', venue: 'Suryagarh Courtyard, Jaipur', dressCode: 'Traditional festive' },
  { kind: 'reception', pageTitle: 'Wedding Reception', themeLine: 'A celebration of love', date: '2027-02-14', time: '8:30 PM', baraatTime: '', pheraTime: '', venue: 'Suryagarh Courtyard, Jaipur', dressCode: 'Evening attire' },
];

module.exports = {
  slug: 'aangan-vivah',
  family: 'bfday',
  name: 'Aangan Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'An eight-page illustrated wedding invitation: carved golden doors open onto a flower-ringed monogram, family invitation, four editable celebration pages, and a peacock garden farewell.',
  thumbnail_url: '/aangan-vivah/monogram.webp',
  ogImage: '/aangan-vivah/monogram.webp',
  version: 1,
  editable: true,
  backgroundMusic: false,
  displayField: 'brideName',

  fields: [
    { id: 'brideName', type: 'text', label: "Bride's name", required: true, maxLength: 50, placeholder: 'Ananya' },
    { id: 'groomName', type: 'text', label: "Groom's name", required: true, maxLength: 50, placeholder: 'Rohan' },
    { id: 'brideInitial', type: 'text', label: "Bride's monogram initial", maxLength: 2, placeholder: 'A', hint: 'Used when no custom logo is uploaded; leave blank to use the first letter of her name.' },
    { id: 'groomInitial', type: 'text', label: "Groom's monogram initial", maxLength: 2, placeholder: 'R', hint: 'Used when no custom logo is uploaded; leave blank to use the first letter of his name.' },
    { id: 'monogramLogo', type: 'image', label: 'Upload a logo or monogram (optional)', alt: 'Couple logo or monogram', preserveTransparency: true, tapToPick: true, hint: 'Tap the preview tile or Choose photo. PNG transparency is preserved. Remove it anytime to return to the editable initials.' },
    { id: 'monogramZoom', type: 'number', label: 'Logo zoom / crop', min: 100, max: 220, default: 100, slider: true, unit: '%', hint: '100% fits the full logo; increase to zoom and crop. The live invitation preview updates as you adjust it.' },
    { id: 'monogramPositionX', type: 'number', label: 'Move logo left / right', min: 20, max: 80, default: 50, slider: true, unit: '%', hint: '50% centers the logo; lower moves it left, higher moves it right.' },
    { id: 'monogramPositionY', type: 'number', label: 'Move logo up / down', min: 20, max: 80, default: 50, slider: true, unit: '%', hint: '50% centers the logo; lower moves it up, higher moves it down.' },


    { id: 'brideParents', type: 'text', label: "Bride's parents", maxLength: 100, placeholder: 'Meera & Vikram Sharma' },
    { id: 'groomParents', type: 'text', label: "Groom's parents", maxLength: 100, placeholder: 'Naina & Amit Mehra' },
    { id: 'invitationLine', type: 'text', label: 'Invitation line', maxLength: 110, default: 'Together with their families' },
    { id: 'invitationRequest', type: 'textarea', label: 'Invitation message', maxLength: 190, rows: 3, default: 'request the pleasure of your company\nas they celebrate their wedding' },
    { id: 'weddingDate', type: 'date', label: 'Wedding date', required: true, default: '2027-02-14' },
    { id: 'mainVenue', type: 'text', label: 'Venue shown on the monogram page', maxLength: 110, default: 'Suryagarh Courtyard, Jaipur' },

    {
      id: 'events', type: 'list', label: 'Celebration pages', itemLabel: 'Event page', addLabel: 'Add an event page',
      minItems: 2, maxItems: 4,
      hint: 'Use the up/down controls to change page order. Remove Haldi or Sangeet if you do not need those pages. Wedding Ceremony and Wedding Reception stay in the invitation.',
      shape: [
        { id: 'kind', type: 'select', label: 'Page type', required: true, options: EVENT_OPTIONS },
        { id: 'pageTitle', type: 'text', label: 'Page heading', maxLength: 48 },
        { id: 'themeLine', type: 'text', label: 'Theme line', maxLength: 110 },
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'text', label: 'Time', maxLength: 50, placeholder: '7:00 PM onwards' },
        { id: 'baraatTime', type: 'text', label: 'Baraat timing', maxLength: 45, placeholder: '4:30 PM' },
        { id: 'pheraTime', type: 'text', label: 'Phera timing', maxLength: 45, placeholder: '7:15 PM' },
        { id: 'venue', type: 'text', label: 'Venue', required: true, maxLength: 110 },
        { id: 'dressCode', type: 'text', label: 'Dress code', maxLength: 70, placeholder: 'Traditional festive' },
      ],
      default: EVENTS,
    },
    { id: 'closingLine', type: 'text', label: 'Thank-you line', maxLength: 100, default: 'Thank you for being part of our beginning' },
    { id: 'familyName', type: 'text', label: 'Host family name', maxLength: 110, default: 'The Sharma & Mehra Families' },
  ],

  steps: [
    { title: 'The couple', heading: 'The names in your invitation', intro: 'Upload a transparent logo or edit the initials. Zoom and move controls update the live preview.', fields: ['brideName', 'groomName', 'brideInitial', 'groomInitial', 'monogramLogo', 'monogramZoom', 'monogramPositionX', 'monogramPositionY'] },
    { title: 'The invitation', heading: 'The families and the day', intro: 'Personalise the invitation copy, parents, wedding date and courtyard venue.', fields: ['brideParents', 'groomParents', 'invitationLine', 'invitationRequest', 'weddingDate', 'mainVenue'] },
    { title: 'Celebrations', heading: 'Your event pages', intro: 'Edit the celebration details. Use the row arrows to reorder pages and remove Haldi or Sangeet when not needed.', fields: ['events'] },
    { title: 'The farewell', heading: 'A final thank-you', intro: 'The closing page keeps the peacocks, fence, lawn and flowers while your words remain editable.', fields: ['closingLine', 'familyName'] },
  ],

  create: {
    eyebrow: 'Aangan Vivah · An illustrated wedding invitation',
    headline: 'Eight painted pages, one family invitation.',
    intro: 'A carved golden door opens to a floral monogram, a family invitation, your celebration pages and a peacock-garden farewell. Names, dates and every event detail stay editable in a live preview.',
    noun: 'wedding invitation',
    designHeading: 'A keepsake in eight scenes',
    designIntro: 'The order follows the reference: door, monogram, family invitation, Haldi, Sangeet, wedding, reception and closing.',
    scenes: [
      'The carved golden double doors open with a soft 3D swing',
      'A floral monogram, two peacocks, the date and courtyard venue',
      'The Ganesh mark, couple names and parents over the courtyard',
      'Haldi with wisteria, marigold garlands and the sunflower sofa',
      'Sangeet beneath chandeliers, mirrored disco balls and a checkerboard floor',
      'The wedding ceremony within its floral arch and pink-draped mandap',
      'The reception with pink curtains and a champagne tower',
      'Two white peacocks beside the fence, lawn and flowers',
    ],
    previewCta: 'Tap the doors, then swipe or use the page arrows.',
    previewHelp: 'Use the page controls to move through the invitation.',
    resultLine: 'Share the invitation as one graceful, mobile-ready link.',
  },

  demo: {
    brideName: 'Ananya', groomName: 'Rohan', brideInitial: 'A', groomInitial: 'R',
    monogramLogo: '', monogramZoom: 100, monogramPositionX: 50, monogramPositionY: 50,
    brideParents: 'Meera & Vikram Sharma', groomParents: 'Naina & Amit Mehra',
    invitationLine: 'Together with their families',
    invitationRequest: 'request the pleasure of your company\nas they celebrate their wedding',
    weddingDate: '2027-02-14', mainVenue: 'Suryagarh Courtyard, Jaipur',
    events: EVENTS,
    closingLine: 'Thank you for being part of our beginning',
    familyName: 'The Sharma & Mehra Families',
  },

  sections: ['door', 'monogram', 'invitation', 'celebrations', 'closing'],
  theme: { bg: '#EAF0F3', ink: '#51384A', accent: '#A87865', soft: '#F5E9E8', motif: 'peacock', ampersand: true, serifCase: 'title', layout: 'story' },
};
