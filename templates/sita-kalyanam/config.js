'use strict';
// Personal sample data belongs only to demo. Blank customer lists stay empty.
const text = (id, label, value = '', maxLength = 120, type = 'text') => ({ id, type, label, default: value, maxLength });
const copy = (id, label, value, maxLength = 800) => text(id, label, value, maxLength, 'textarea');
const name = (id, label, required = false) => ({ id, type: 'text', label, required, maxLength: 80 });
const date = (id, label, required = false) => ({ id, type: 'date', label, required });
const time = (id, label, required = false) => ({ id, type: 'text', label, required, maxLength: 5, placeholder: 'HH:mm', hint: '24-hour local time, for example 06:45 or 19:00.' });
const photo = (id, label) => ({ id, type: 'image', label, tapToPick: true, hint: 'Optional customer upload. Leave blank to use the ornamental layout.' });
const sections = ['opening', 'cover', 'family', 'muhurtham', 'events', 'reception', 'venue', 'moments', 'countdown'];
const fields = [
  text('openingHeading', 'Opening blessing', 'Shree Ganeshaya Namah'),
  copy('openingMessage', 'Opening invitation line', 'With divine blessings, two hearts begin one beautiful journey.'),
  text('openingButton', 'Open invitation button', 'Open our invitation', 60),
  text('coverEyebrow', 'Cover eyebrow', 'Together with our families', 100),
  text('coverHeading', 'Cover heading', 'We are getting married', 100),
  name('groomName', 'Groom’s name', true), name('brideName', 'Bride’s name', true),
  text('coupleJoiner', 'Word between names', '&', 20),
  copy('invitationMessage', 'Invitation message', 'We joyfully invite you to celebrate our wedding and bless the beginning of our life together.'),
  text('scrollHint', 'Scroll invitation hint', 'Scroll to discover our celebration', 100),
  photo('couplePhoto', 'Couple portrait'),
  text('familyHeading', 'Family heading', 'With the Blessings Of'),
  copy('familyMessage', 'Family invitation line', 'Your love and blessings make this union complete.'),
  text('groomFamilyHeading', 'Groom’s family heading', 'The groom’s family'),
  name('groomFather', 'Groom’s father'), name('groomMother', 'Groom’s mother'),
  photo('groomFamilyPhoto', 'Optional groom’s family photograph'),
  text('brideFamilyHeading', 'Bride’s family heading', 'The bride’s family'),
  name('brideFather', 'Bride’s father'), name('brideMother', 'Bride’s mother'),
  photo('brideFamilyPhoto', 'Optional bride’s family photograph'),
  text('parentsJoiner', 'Word between parents’ names', '&', 20),
  text('muhurthamHeading', 'Wedding ceremony heading', 'Muhurtham'),
  copy('muhurthamMessage', 'Wedding ceremony invitation', 'Join us as we exchange sacred vows and begin our forever.'),
  date('weddingDate', 'Wedding date', true), time('weddingTime', 'Wedding time', true),
  { ...text('utcOffset', 'Local UTC offset', '+05:30', 6), hint: 'Signed HH:mm offset from −14:00 to +14:00. India is +05:30. Dates and times use this offset; weekday is derived from the selected date.' },
  text('dateLabel', 'Date label', 'Date', 40), text('timeLabel', 'Time label', 'Time', 40),
  text('eventsHeading', 'Celebrations heading', 'Wedding Events'),
  copy('eventsMessage', 'Celebrations introduction', 'A little colour, a little music, and a lifetime of memories.'),
  copy('eventsEmptyMessage', 'Message when the event list is empty', 'We look forward to celebrating with you.'),
  { id: 'events', type: 'list', label: 'Wedding events', itemLabel: 'Event', addLabel: 'Add an event', minItems: 0, maxItems: 20, default: [],
    hint: 'Add, edit, remove or reorder with the arrows. You may remove every event. Choose Main wedding or Reception to keep a card’s date and time linked automatically. For a custom schedule, enter that event’s date and time. Blank venue and address follow the main venue.',
    shape: [
      { id: 'kind', type: 'select', label: 'Event kind', required: true, options: [
        { value: 'haldi', label: 'Haldi' }, { value: 'mehendi', label: 'Mehendi' }, { value: 'sangeet', label: 'Sangeet' },
        { value: 'wedding', label: 'Wedding' }, { value: 'reception', label: 'Reception' }, { value: 'other', label: 'Other celebration' },
      ] },
      name('name', 'Event name', true),
      { id: 'schedule', type: 'select', label: 'Date and time source', default: 'custom', options: [{ value: 'custom', label: 'Custom event schedule' }, { value: 'wedding', label: 'Follow main wedding' }, { value: 'reception', label: 'Follow reception' }] },
      date('date', 'Custom event date'), time('time', 'Custom event time'),
      name('venue', 'Event venue'), copy('address', 'Event address', '', 500),
    ] },
  text('receptionHeading', 'Reception heading', 'Reception'),
  copy('receptionMessage', 'Reception invitation', 'Please join us for dinner, laughter and a joyful celebration of our new beginning.'),
  date('receptionDate', 'Reception date', true), time('receptionTime', 'Reception time', true),
  text('receptionVenue', 'Reception venue (blank uses main venue)', '', 160),
  copy('receptionAddress', 'Reception address (blank uses main address)', '', 500),
  text('venueHeading', 'Venue heading', 'Venue'),
  copy('venueMessage', 'Venue introduction', 'We cannot wait to welcome you here.'),
  text('venueName', 'Main venue name', '', 160), copy('venueAddress', 'Main venue address', '', 500),
  photo('venuePhoto', 'Optional venue photograph'),
  { id: 'mapsUrl', type: 'url', label: 'Optional directions link', maxLength: 1000, hint: 'HTTPS link. Leave blank to search Google Maps using the main venue and address.' },
  text('mapsLabel', 'Directions button', 'Get directions', 60),
  { id: 'qrUrl', type: 'url', label: 'Optional QR destination URL', maxLength: 500, hint: 'HTTPS link. Leave blank to hide the QR code. This is the destination, not an uploaded QR image.' },
  text('qrLabel', 'QR caption', 'Scan for more details', 100),
  text('momentsHeading', 'Photo gallery heading', 'Our Moments'),
  copy('momentsMessage', 'Photo gallery introduction', 'A few memories from our journey together.'),
  { id: 'gallery', type: 'list', label: 'Couple gallery', itemLabel: 'Photograph', addLabel: 'Add a photograph', minItems: 0, maxItems: 12, default: [],
    hint: 'Upload your photographs, add optional captions, and reorder with the arrows. You may remove every photograph.',
    shape: [{ ...photo('image', 'Photograph'), required: true }, text('caption', 'Caption', '', 240)] },
  text('countdownHeading', 'Countdown heading', 'Our New Beginning Starts In'),
  date('countdownDate', 'Optional countdown date override'), time('countdownTime', 'Optional countdown time override'),
  text('daysLabel', 'Countdown days label', 'Days', 30), text('hoursLabel', 'Countdown hours label', 'Hours', 30),
  text('minutesLabel', 'Countdown minutes label', 'Minutes', 30), text('secondsLabel', 'Countdown seconds label', 'Seconds', 30),
  copy('celebrationMessage', 'Message after the countdown', 'Our celebration has begun!'),
  text('closingHeading', 'Closing heading', 'With love and gratitude'),
  copy('closingMessage', 'Closing message', 'Your presence is our greatest gift. We look forward to celebrating with you.'),
  { id: 'musicUpload', type: 'audio', label: 'Upload background music', hint: 'MP3, M4A, OGG or WAV, up to 15 MB. Plays only after a guest gesture. An upload takes priority over a link.' },
  { id: 'musicLink', type: 'url', label: 'Or a direct audio / YouTube link', maxLength: 500, hint: 'HTTPS MP3, M4A, OGG or WAV file, or a YouTube video URL. Spotify and Apple Music pages do not play directly. YouTube embedding may be restricted.' },
  text('musicLabel', 'Music button accessible label', 'Play or pause wedding music', 100),
];
const step = (title, heading, intro, ids) => ({ title, heading, intro, fields: ids.split(' ') });
const config = {
  slug: 'sita-kalyanam', family: 'bfday', name: 'Sita Kalyanam', category: 'Wedding', price: 99, currency: 'INR', version: 1,
  editable: true, backgroundMusic: false, displayField: 'groomName',
  description: 'A sacred Hindu wedding story in nine scrolling sections, with family blessings, an auspicious muhurtham, joyful celebrations and your own photographs.',
  thumbnail_url: '/sita-kalyanam/thumbnail.webp', ogImage: '/sita-kalyanam/thumbnail.webp', fields,
  steps: [
    step('Opening & couple', 'Begin your invitation', 'Personalise the blessing, names, invitation and optional portrait.', 'openingHeading openingMessage openingButton coverEyebrow coverHeading groomName brideName coupleJoiner invitationMessage scrollHint couplePhoto'),
    step('Family blessings', 'Honour your families', 'Add parents’ names and optional family photographs.', 'familyHeading familyMessage groomFamilyHeading groomFather groomMother groomFamilyPhoto brideFamilyHeading brideFather brideMother brideFamilyPhoto parentsJoiner'),
    step('Wedding & celebrations', 'Set your sacred moment', 'Use 24-hour local times. Weekdays follow your selected dates automatically.', 'muhurthamHeading muhurthamMessage weddingDate weddingTime utcOffset dateLabel timeLabel eventsHeading eventsMessage eventsEmptyMessage events'),
    step('Reception', 'An evening together', 'Reception venue and address can be left blank to use your main venue.', 'receptionHeading receptionMessage receptionDate receptionTime receptionVenue receptionAddress'),
    step('Venue & directions', 'Help guests find you', 'Add your venue, an optional photo and optional directions or QR links.', 'venueHeading venueMessage venueName venueAddress venuePhoto mapsUrl mapsLabel qrUrl qrLabel'),
    step('Your moments', 'A gallery of your story', 'Customer-uploaded photographs with captions, in your chosen order.', 'momentsHeading momentsMessage gallery'),
    step('Closing & music', 'The final blessing', 'Leave countdown overrides blank to follow the wedding date and time. Each override replaces only that part. Background music is optional.', 'countdownHeading countdownDate countdownTime daysLabel hoursLabel minutesLabel secondsLabel celebrationMessage closingHeading closingMessage musicUpload musicLink musicLabel'),
  ],
  create: {
    eyebrow: 'Sita Kalyanam · Hindu wedding invitation', headline: 'A sacred beginning. A story to share.',
    intro: 'Create a warm, devotional wedding invitation with nine flowing sections, family blessings and your most cherished moments.', noun: 'wedding invitation',
    designHeading: 'Nine moments, one beautiful beginning', designIntro: 'A scrolling wedding story, personalised from opening blessing to closing gratitude.',
    scenes: ['A sacred opening blessing', 'The couple’s invitation', 'Family blessings', 'The auspicious muhurtham', 'Wedding celebrations', 'Reception invitation', 'Venue and directions', 'Your gallery of moments', 'Countdown and closing gratitude'],
    previewCta: 'Open the invitation, then scroll.', previewHelp: 'Scroll at your own pace. Music begins only after your tap.', resultLine: 'One heartfelt invitation link to share.',
  },
  sections,
  theme: { bg: '#FFF7E8', ink: '#532E27', accent: '#A34430', soft: '#E8CC8C', motif: 'temple', ampersand: true, serifCase: 'title', layout: 'story' },
};
// Fictional sample identities, dates and location — never renderer fallbacks.
const venue = 'Shree Venkateshwara Celebration Gardens';
const address = '42 Lakeview Road,\nKothrud, Pune,\nMaharashtra – 411038';
config.demo = {
  ...Object.fromEntries(fields.filter(f => f.default !== undefined).map(f => [f.id, f.default])),
  groomName: 'Aarav Mehta', brideName: 'Ananya Desai',
  groomFather: 'Mr. Rajesh Mehta', groomMother: 'Mrs. Sunita Mehta',
  brideFather: 'Mr. Prakash Desai', brideMother: 'Mrs. Nandini Desai',
  weddingDate: '2027-08-15', weddingTime: '06:45', receptionDate: '2027-08-15', receptionTime: '19:00',
  venueName: venue, venueAddress: address, receptionVenue: '', receptionAddress: '',
  gallery: [1,2,3].map(i => ({ image: `/assets/bfday-demo/sita-kalyanam-couple-${i}.webp`, caption: '' })),
  events: [
    { kind: 'haldi', name: 'Haldi', schedule: 'custom', date: '2027-08-14', time: '10:00', venue: '', address: '' },
    { kind: 'mehendi', name: 'Mehendi', schedule: 'custom', date: '2027-08-14', time: '16:00', venue: '', address: '' },
    { kind: 'wedding', name: 'Wedding Ceremony', schedule: 'wedding', date: '', time: '', venue: '', address: '' },
  ],
};
module.exports = config;
