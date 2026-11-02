'use strict';

// Sample people are fictional. Dates and times are
// local to Asia/Kolkata; renderers must use schema.deriveWedding/deriveEvent.
const text = (id, label, maxLength, extra = {}) => ({ id, type: 'text', label, maxLength, ...extra });
const textarea = (id, label, maxLength, extra = {}) => ({ id, type: 'textarea', label, maxLength, rows: 3, ...extra });
const SAMPLE_VENUE = 'The Royal Orchid Palace';
const SAMPLE_ADDRESS = '27 Emerald Avenue, Wakad, Pune, Maharashtra – 411057';
const event = (name, date, time, description) => ({
  name, timing: 'custom', date, time, description, venue: '',
  address: '', mapsLink: '', photo: '',
});
const EVENTS = [
  event('Haldi', '2027-02-20', '10:00', 'A joyful morning of turmeric and blessings.'),
  event('Mehendi', '2027-02-20', '16:00', 'An afternoon of henna, laughter and music.'),
  event('Sangeet', '2027-02-20', '19:00', 'An evening of music and dancing.'),
  { ...event('Wedding', '', '', 'Join us as we begin our new chapter.'), timing: 'wedding' },
  event('Reception', '2027-02-22', '19:00', 'Celebrate with us over dinner and good wishes.'),
];

module.exports = {
  slug: 'shubh-sangam', family: 'bfday', name: 'Shubh Sangam', category: 'Wedding',
  price: 0, currency: 'INR', version: 1, editable: true, backgroundMusic: false,
  displayField: 'brideName',
  description: 'A scrolling wedding invitation with your families, celebration schedule, photographs and RSVP details.',
  thumbnail_url: '/shubh-sangam/thumbnail.webp', ogImage: '/shubh-sangam/thumbnail.webp',
  fields: [
    text('brideName', 'Bride’s name', 60, { required: true, placeholder: 'Meera Joshi' }),
    text('groomName', 'Groom’s name', 60, { required: true, placeholder: 'Vivaan Kapoor' }),
    { id: 'bridePhoto', type: 'image', label: 'Bride’s photo', tapToPick: true },
    { id: 'groomPhoto', type: 'image', label: 'Groom’s photo', tapToPick: true },
    text('brideMother', 'Bride’s mother', 60), text('brideFather', 'Bride’s father', 60),
    text('groomMother', 'Groom’s mother', 60), text('groomFather', 'Groom’s father', 60),
    textarea('brideFamily', 'Bride’s additional family', 300, { hint: 'Optional names or family details.' }),
    textarea('groomFamily', 'Groom’s additional family', 300, { hint: 'Optional names or family details.' }),
    textarea('announcement', 'Announcement', 300, { placeholder: 'Together with their families, we joyfully announce our wedding.' }),
    textarea('invitationMessage', 'Invitation message', 600, { placeholder: 'We warmly invite you to celebrate with us.' }),
    { id: 'weddingDate', type: 'date', label: 'Wedding date', required: true },
    text('weddingTime', 'Wedding time / muhurat (24-hour HH:MM)', 5, { required: true, placeholder: '19:15', hint: 'Use 24-hour time, for example 19:15. Times are in Asia/Kolkata (IST).' }),
    text('venue', 'Wedding venue', 100),
    { id: 'venuePhoto', type: 'image', label: 'Wedding venue photo', tapToPick: true },
    textarea('venueAddress', 'Wedding venue address', 250),
    text('venueMapsLink', 'Wedding venue Google Maps link', 500, { hint: 'Optional HTTPS Google Maps link. Unsupported links are saved but must not be made clickable.' }),
    {
      id: 'events', type: 'list', label: 'Celebration events', itemLabel: 'Event', addLabel: 'Add an event', minItems: 0, maxItems: 12,
      // No default list: an intentionally empty schedule must stay empty.
      hint: 'Add, reorder or remove events. Select “Wedding date and time” to keep that event synced to the main wedding date and time; otherwise enter its own date and 24-hour time. Leave event venue and address blank to use the wedding venue; if either is entered, enter the complete event location. Leave a completely blank row for no events.',
      shape: [
        text('name', 'Event name', 60),
        { id: 'timing', type: 'select', label: 'Use date and time', options: [
          { value: 'custom', label: 'Event date and time' }, { value: 'wedding', label: 'Wedding date and time' },
        ] },
        { id: 'date', type: 'date', label: 'Event date (custom timing only)' },
        text('time', 'Event time, HH:MM (custom timing only)', 5, { placeholder: '19:15' }),
        textarea('description', 'Event description', 300),
        text('venue', 'Event venue', 100), textarea('address', 'Event address', 250),
        text('mapsLink', 'Event Google Maps link', 500),
        { id: 'photo', type: 'image', label: 'Event photo', tapToPick: true },
      ],
    },
    {
      id: 'gallery', type: 'list', label: 'Gallery photos', itemLabel: 'Photo', addLabel: 'Add a photo', minItems: 0, maxItems: 12,
      hint: 'Add, reorder or remove photographs; captions are optional. Leave a blank row for an empty gallery.',
      shape: [ { id: 'photo', type: 'image', label: 'Photo', required: true, tapToPick: true }, text('caption', 'Caption', 120) ],
    },
    { id: 'musicUpload', type: 'audio', label: 'Upload background music', hint: 'Optional MP3, M4A, OGG or WAV up to 15 MB. Guests must start audio with a tap.' },
    text('rsvpName', 'RSVP contact name', 80),
    text('rsvpPhone', 'RSVP phone number', 30, { placeholder: '+91 98765 43210', hint: 'Optional. Include + and an international country code, for example +91. Without a valid number the WhatsApp RSVP form is not available.' }),
    text('rsvpEmail', 'RSVP email address', 254),
  ],
  steps: [
    { title: 'The couple', heading: 'The couple and families', fields: ['brideName', 'groomName', 'bridePhoto', 'groomPhoto', 'brideMother', 'brideFather', 'brideFamily', 'groomMother', 'groomFather', 'groomFamily'] },
    { title: 'Your words', heading: 'An invitation from the heart', fields: ['announcement', 'invitationMessage'] },
    { title: 'The wedding', heading: 'Date, time and venue', fields: ['weddingDate', 'weddingTime', 'venue', 'venueAddress', 'venueMapsLink', 'venuePhoto'] },
    { title: 'Celebrations', heading: 'Your celebration schedule', fields: ['events'] },
    { title: 'Gallery', heading: 'Your photographs', fields: ['gallery'] },
    { title: 'Music & RSVP', heading: 'Finishing touches', fields: ['musicUpload', 'rsvpName', 'rsvpPhone', 'rsvpEmail'] },
  ],
  create: {
    eyebrow: 'Shubh Sangam · Wedding invitation', headline: 'Two families, one beautiful beginning.',
    intro: 'Create a scrolling invitation for your wedding and celebrations.', noun: 'wedding invitation',
    designHeading: 'A celebration that unfolds', designIntro: 'Share the couple, your families, schedule, gallery and RSVP in one invitation.',
    scenes: ['The couple and families', 'Wedding date and countdown', 'Celebration events', 'Photo gallery', 'Venue and RSVP'],
    previewCta: 'Scroll to explore.', previewHelp: 'Scroll through the invitation.', resultLine: 'Share your wedding invitation link.',
  },
  demo: {
    brideName: 'Meera Joshi', groomName: 'Vivaan Kapoor', brideMother: 'Mrs. Kavita Joshi', brideFather: 'Mr. Sanjay Joshi',
    groomMother: 'Mrs. Pooja Kapoor', groomFather: 'Mr. Amit Kapoor',
    announcement: 'Together with their families, we joyfully announce our wedding.',
    invitationMessage: 'With love in our hearts, we invite you to celebrate this joyful new beginning with us.',
    weddingDate: '2027-02-21', weddingTime: '19:15', venue: SAMPLE_VENUE, venueAddress: SAMPLE_ADDRESS, venueMapsLink: '',
    events: EVENTS, gallery: [], musicUpload: '', rsvpName: '', rsvpPhone: '', rsvpEmail: '',
  },
  sections: ['hero', 'families', 'announcement', 'countdown', 'events', 'gallery', 'venue', 'rsvp'],
  theme: { bg: '#FBF5EA', ink: '#47342D', accent: '#9A4F3E', soft: '#EBDCCB', motif: 'floral', ampersand: true, serifCase: 'title', layout: 'story' },
};
