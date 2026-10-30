'use strict';
const text = (id, label, value, maxLength) => ({ id, type: 'text', label, maxLength, ...(value === undefined ? {} : { default: value }) });
const DAYS = [
  { heading: 'TUESDAY | August 18, 2026', events: [
    { time: '2:00 PM', event: 'Lodging Check-in', venue: 'Golden Bloom Inn, Bliss Lane, Rosewood' },
  ] },
  { heading: 'WEDNESDAY | August 19, 2026', events: [
    { time: '12:00 PM', event: 'Pool Party', venue: 'Golden Bloom Inn' },
    { time: '6:00 PM', event: 'Mehndi and Sangeet', venue: 'Azure Cove Retreat, 45 Lagoon Drive' },
    { time: '7:00 PM', event: 'Cocktail Party', venue: 'Azure Cove Retreat' },
  ] },
  { heading: 'SATURDAY | August 22, 2026', events: [
    { time: '3:00 PM', event: 'Baraat', venue: 'Silver Meadow Inn, 89 Harmony Road' },
    { time: '4:00 PM', event: 'Wedding Ceremony', venue: 'Silver Meadow Inn' },
    { time: '7:00 PM', event: 'Reception', venue: 'Silver Meadow Inn' },
  ] },
];
module.exports = {
  slug: 'patra-vivah', family: 'bfday', name: 'Patra Vivah', category: 'Wedding', price: 0, currency: 'INR', version: 1,
  editable: true, backgroundMusic: false, displayField: 'brideName',
  description: 'A banana-leaf wedding invitation in exactly three portrait pages: a botanical cover, Save the Date and your complete wedding itinerary.',
  thumbnail_url: '/patra-vivah/thumbnail.webp', ogImage: '/patra-vivah/thumbnail.webp',
  fields: [
    { ...text('brideName', 'Bride’s name', undefined, 40), required: true, placeholder: 'Ananya' },
    { ...text('groomName', 'Groom’s name', undefined, 40), required: true, placeholder: 'Arjun' },
    text('coupleJoiner', 'Word between names', '&', 16),
    text('coverHint', 'Cover opening hint', 'tap to open', 40),
    { id: 'couplePhoto', type: 'image', label: 'Optional couple photo', preserveTransparency: true, tapToPick: true, hint: 'Optional. Transparent PNG images keep their transparency.' },
    { id: 'monogramLogo', type: 'image', label: 'Optional monogram or logo', preserveTransparency: true, tapToPick: true, hint: 'Optional. Use a transparent PNG to keep the leaf artwork visible.' },
    text('saveHeading', 'Save-the-date heading', 'Save the Date', 50),
    { id: 'saveDate', type: 'date', label: 'Wedding date', required: true, default: '2026-08-22' },
    text('itineraryHeading', 'Itinerary heading', 'Wedding Itinerary', 50),
    { id: 'days', type: 'list', editor: 'nested-itinerary', label: 'Itinerary days', itemLabel: 'Day', addLabel: 'Add a day', minItems: 1, maxItems: 4, default: DAYS,
      hint: 'One itinerary page: up to 4 days and 10 entries in total. Add, remove or reorder days and entries. Keep each time, event and venue short so all three portrait pages stay readable.',
      shape: [
        { ...text('heading', 'Day and date', undefined, 44), required: true, placeholder: 'TUESDAY | July 15, 2026' },
        { id: 'events', type: 'list', label: 'Day entries', itemLabel: 'Entry', addLabel: 'Add an entry', minItems: 1, maxItems: 10,
          shape: [
            { ...text('time', 'Time', undefined, 16), required: true },
            { ...text('event', 'Event', undefined, 44), required: true },
            { ...text('venue', 'Venue', undefined, 80), required: true },
          ],
        },
      ],
    },
    { id: 'musicUpload', type: 'audio', label: 'Upload your background song', hint: 'MP3, M4A, OGG or WAV, up to 15 MB. Starts after the first cover tap. An uploaded song takes priority over a link.' },
    { id: 'musicLink', type: 'url', label: 'Or paste a direct audio / YouTube link', maxLength: 500, hint: 'Use a direct HTTPS MP3, M4A, OGG or WAV URL, or an HTTPS YouTube link. Music starts after the first cover tap; some YouTube songs restrict embedding.' },
  ],
  steps: [
    { title: 'The couple', heading: 'Your botanical invitation', fields: ['brideName', 'groomName', 'coupleJoiner', 'coverHint', 'monogramLogo'] },
    { title: 'Save the Date', heading: 'Your wedding date', fields: ['saveHeading', 'saveDate', 'couplePhoto'] },
    { title: 'Itinerary', heading: 'All your plans on one page', fields: ['itineraryHeading', 'days'] },
    { title: 'Music', heading: 'A song for your celebration', fields: ['musicUpload', 'musicLink'] },
  ],
  create: { eyebrow: 'Patra Vivah · Wedding invitation', headline: 'A leaf unfolds. A new chapter begins.', intro: 'Personalise a banana-leaf invitation in exactly three 9:16 pages, with your names, wedding date and a day-by-day itinerary.', noun: 'wedding invitation', designHeading: 'Three botanical portrait pages', designIntro: 'Your cover, Save the Date and itinerary stay in one fixed three-page composition.', scenes: ['Banana-leaf cover', 'Save the Date', 'Wedding itinerary'], previewCta: 'Tap the cover to open your invitation.', previewHelp: 'Swipe or use the arrows to see all three pages.', resultLine: 'Share one beautiful wedding invitation link.' },
  demo: { brideName: 'Sowjanya', groomName: 'Pavan Kalyan', coupleJoiner: '&', coverHint: 'tap to open', saveHeading: 'Save the Date', saveDate: '2026-08-22', itineraryHeading: 'Wedding Itinerary', days: DAYS },
  sections: ['cover', 'save', 'itinerary'],
  theme: { bg: '#F7F4E8', ink: '#23462D', accent: '#4D7138', soft: '#DFE7CE', motif: 'leaf', ampersand: true, serifCase: 'title', layout: 'story' },
};
