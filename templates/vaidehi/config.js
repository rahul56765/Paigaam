'use strict';

// Personal examples belong only to demo, never scalar defaults. A partly
// completed customer's invitation must not acquire another couple's identity.
const ADDRESS = '18 Gulmohar Lane, Baner, Pune, Maharashtra – 411045';
const EVENTS = [
  { kind: 'haldi', name: 'Haldi', date: '', dayOffset: -1, time: '10:00', venueName: '', venueAddress: '', mapsUrl: '' },
  { kind: 'mehendi', name: 'Mehendi', date: '', dayOffset: -1, time: '16:00', venueName: '', venueAddress: '', mapsUrl: '' },
  { kind: 'wedding', name: 'Wedding Ceremony', date: '', dayOffset: 0, time: '', venueName: '', venueAddress: '', mapsUrl: '' },
  { kind: 'reception', name: 'Reception', date: '', dayOffset: 0, time: '20:30', venueName: '', venueAddress: '', mapsUrl: '' },
];
const INVITATION = 'Your presence is a cherished part of our celebration. Join us as we gather with love, joy and blessings to celebrate the beginning of our beautiful journey together.';
const BLESSING = 'With the blessings of our families, we begin a new chapter together. Please join us with your love and good wishes.';
const text = (id, label, maxLength, extra = {}) => ({ id, type: 'text', label, maxLength, ...extra });

module.exports = {
  slug: 'vaidehi', family: 'bfday', name: 'Vaidehi', category: 'Wedding',
  price: 0, currency: 'INR', version: 1, editable: true,
  backgroundMusic: false, displayField: 'groomName',
  description: 'Ivory wedding stationery, marigold garlands, banana-leaf corners, tilted Polaroids and a golden temple welcome, with a venue QR and a live countdown.',
  thumbnail_url: '/vaidehi/thumbnail.webp', ogImage: '/vaidehi/thumbnail.webp',
  fields: [
    text('groomName', 'Groom’s name', 80, { required: true, placeholder: 'Rohan Malhotra' }),
    text('brideName', 'Bride’s name', 80, { required: true, placeholder: 'Kiara Shah' }),
    { id: 'weddingDate', type: 'date', label: 'Wedding date', required: true },
    text('weddingTime', 'Wedding time (24-hour)', 5, { required: true, placeholder: '19:00', hint: 'Use HH:mm, for example 19:00.' }),
    text('weddingDay', 'Day-of-week wording (optional)', 50, { hint: 'Leave blank to calculate the actual weekday from your wedding date.' }),
    text('venueName', 'Wedding venue', 150, { required: true, placeholder: 'Aarohi Gardens' }),
    { id: 'venueAddress', type: 'textarea', label: 'Wedding venue address', required: true, maxLength: 500, rows: 3, placeholder: ADDRESS },
    { id: 'mapsUrl', type: 'url', label: 'Google Maps / directions link (optional)', maxLength: 1500, hint: 'HTTPS only. Leave blank to search Google Maps for your venue address.' },
    text('groomFamily', 'Groom’s family / parents', 250, { placeholder: 'Ananya & Vikram Malhotra', hint: 'Optional. Enter the family names exactly as you want them printed.' }),
    text('brideFamily', 'Bride’s family / parents', 250, { placeholder: 'Meera & Sanjay Shah' }),
    { id: 'invitationMessage', type: 'textarea', label: 'Personal invitation note', maxLength: 2000, rows: 6, default: INVITATION },
    { id: 'blessingMessage', type: 'textarea', label: 'Blessings and closing message', maxLength: 1200, rows: 4, default: BLESSING },
    { id: 'events', type: 'list', label: 'Wedding celebrations', itemLabel: 'Celebration', addLabel: 'Add a celebration', minItems: 0, maxItems: 20, default: EVENTS,
      hint: 'Add, remove or reorder celebrations. Blank event dates follow the wedding date plus their day offset; blank venue fields follow the main venue. Clear any old override to restore inheritance.',
      shape: [
        { id: 'kind', type: 'select', label: 'Event kind', options: ['other', 'wedding', 'reception', 'haldi', 'mehendi'], default: 'other' },
        text('name', 'Event name', 100, { required: true }),
        { id: 'date', type: 'date', label: 'Event date override (optional)', hint: 'Blank means the wedding date plus this event’s day offset. Enter a date to override both.' },
        { id: 'dayOffset', type: 'number', label: 'Days before / after the wedding', min: -365, max: 365, default: 0, hint: 'Use -1 for the day before, 0 for the wedding day, or 1 for the day after. Ignored when an event date override is entered.' },
        text('time', 'Event time override (24-hour)', 5, { hint: 'HH:mm, for example 20:30. Blank follows the main wedding time.' }),
        text('venueName', 'Venue name override (optional)', 150, { hint: 'Blank means the main wedding venue name.' }),
        { id: 'venueAddress', type: 'textarea', label: 'Venue address override (optional)', maxLength: 500, rows: 3, hint: 'Blank means the main wedding venue address.' },
        { id: 'mapsUrl', type: 'url', label: 'Directions override (optional)', maxLength: 1500, hint: 'HTTPS only. Blank uses the main directions link for the inherited venue, or a Google Maps address search for an overridden venue.' },
      ],
    },
    { id: 'couplePhoto', type: 'image', label: 'Couple portrait', tapToPick: true, hint: 'Optional. Upload your own portrait; no sample couple is used for a customer invitation.' },
    { id: 'gallery', type: 'list', label: 'Photo gallery', itemLabel: 'Photo', addLabel: 'Add a photo', minItems: 0, maxItems: 12,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo', required: true },
        text('caption', 'Caption (optional)', 180),
      ],
    },
    { id: 'countdownPhoto', type: 'image', label: 'Countdown background photo', tapToPick: true, hint: 'Optional. Leave blank for the designed background.' },
    { id: 'countdownDate', type: 'date', label: 'Countdown date override (optional)', hint: 'Leave blank to follow your wedding date.' },
    text('countdownTime', 'Countdown time override (optional)', 5, { hint: 'HH:mm. Leave blank to follow your wedding time.' }),
    text('utcOffset', 'Wedding time-zone UTC offset', 6, { default: '+05:30', hint: 'Use ±HH:mm, for example +05:30 for India. Maximum magnitude is 14:00. This keeps the countdown correct for guests anywhere.' }),
    { id: 'qrDestination', type: 'url', label: 'QR destination override (optional)', maxLength: 1500, hint: 'HTTPS only. Blank uses your wedding directions link (or the derived address search).' },
    { id: 'musicUpload', type: 'audio', label: 'Optional background music upload', hint: 'Upload MP3, M4A, OGG or WAV (up to 15 MB). Music starts only after a guest interacts with the invitation. Leave blank for silence.' },
  ],
  steps: [
    { title: 'The couple', heading: 'Your names and families', fields: ['groomName', 'brideName', 'groomFamily', 'brideFamily'] },
    { title: 'Wedding details', heading: 'When and where', fields: ['weddingDate', 'weddingTime', 'weddingDay', 'venueName', 'venueAddress', 'mapsUrl'] },
    { title: 'Your invitation', heading: 'A personal welcome', fields: ['invitationMessage', 'blessingMessage'] },
    { title: 'Celebrations', heading: 'Your wedding itinerary', fields: ['events'] },
    { title: 'Photographs', heading: 'Your story in pictures', fields: ['couplePhoto', 'gallery', 'countdownPhoto'] },
    { title: 'Finishing touches', heading: 'Countdown, directions and music', fields: ['countdownDate', 'countdownTime', 'utcOffset', 'qrDestination', 'musicUpload'] },
  ],
  create: {
    eyebrow: 'Vaidehi · Wedding invitation', headline: 'A beautiful beginning, shared with everyone you love.',
    intro: 'Personalise your wedding welcome, family names, celebrations and memories in one graceful invitation.',
    noun: 'wedding invitation', scenes: ['PAIGAAM opening', 'The illustrated wedding announcement', 'Wedding date, time and venue', 'Our Moments — scrolling Polaroids', 'Dear Friends and Family — temple welcome', 'Family blessings and venue QR', 'The alternating celebration timeline', 'Wedding hands and live countdown'],
    previewCta: 'Open your invitation', previewHelp: 'Personalise the details and preview your invitation.', resultLine: 'Share your wedding in one invitation link.',
  },
  demo: {
    groomName: 'Rohan Malhotra', brideName: 'Kiara Shah', weddingDate: '2027-02-18', weddingTime: '19:00', weddingDay: '',
    venueName: 'Aarohi Gardens', venueAddress: ADDRESS,
    mapsUrl: '',
    groomFamily: 'Ananya & Vikram Malhotra', brideFamily: 'Meera & Sanjay Shah',
    invitationMessage: INVITATION, blessingMessage: BLESSING, events: EVENTS,
    couplePhoto: '/assets/bfday-demo/vaidehi-demo-3.webp', countdownPhoto: '',
    gallery: [
      { photo: '/assets/bfday-demo/vaidehi-demo-1.webp', caption: 'The beginning of forever' },
      { photo: '/assets/bfday-demo/vaidehi-demo-2.webp', caption: 'Our favourite moments' },
      { photo: '/assets/bfday-demo/vaidehi-demo-3.webp', caption: 'Together is a beautiful place' },
      { photo: '/assets/bfday-demo/vaidehi-demo-4.webp', caption: 'A lifetime of memories ahead' },
    ],
    countdownDate: '', countdownTime: '', utcOffset: '+05:30', qrDestination: '', musicUpload: '',
  },
  sections: ['opening', 'cover', 'details', 'moments', 'welcome', 'blessings', 'schedule', 'countdown'],
  theme: { bg: '#FFF9EE', ink: '#3F392D', accent: '#927338', soft: '#EAE2CF', motif: 'botanical', ampersand: true, serifCase: 'title', layout: 'wedding' },
};
