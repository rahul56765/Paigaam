'use strict';
/**
 * Vivah — Shubh Vivah, a divine-sky wedding invitation. (bfday family.)
 *
 * "Vivah" (विवाह) — the wedding. A single scrolling page: a golden divine sky
 * with a henna hand reaching into the light ("Save the Date"), a toran-draped
 * blessings section with both families, the ask, the three ceremonies
 * (Mehendi · Muhurtham · Reception), a couple photo, a live countdown to the
 * Muhurtham, and the venue with RSVP — closed with शुभ विवाह.
 *
 * First member of the Wedding family on the shared engine. Free, no price.
 * Background music comes from the family's shared bgmSong field (last wizard
 * step); this template adds no song field of its own.
 */

const EVENTS = [
  { name: 'Mehendi', date: '2027-02-12', time: '11:00 AM onwards', venue: 'The bride’s home, Jaipur', caption: 'An afternoon of henna, haldi and old songs.' },
  { name: 'Muhurtham', date: '2027-02-14', time: '7:00 PM', venue: 'Rambagh Palace, Jaipur', caption: 'The sacred ceremony — we wed as the lamps are lit.' },
  { name: 'Reception', date: '2027-02-15', time: '7:30 PM onwards', venue: 'The Palace Lawns, Jaipur', caption: 'Dinner, dancing and every story you have about us.' },
];

module.exports = {
  slug: 'vivah',
  family: 'bfday',
  name: 'Vivah',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'Shubh Vivah — a divine-sky wedding invitation. A henna hand reaches into golden light, the families bless, three ceremonies unfold, and a live countdown ticks to the Muhurtham.',
  thumbnail_url: '',
  ogImage: '/vivah/og.jpg',
  version: 1,
  editable: true,
  displayField: 'brideName',

  fields: [
    /* 1 · the couple */
    { id: 'brideName', type: 'text', label: 'The bride', required: true, maxLength: 40, placeholder: 'Ananya',
      hint: 'Her name opens the sky: “Save the Date — Ananya & Arjun”.' },
    { id: 'groomName', type: 'text', label: 'The groom', required: true, maxLength: 40, placeholder: 'Arjun' },

    /* 2 · the blessings */
    { id: 'brideParents', type: 'textarea', label: 'The bride’s parents', maxLength: 80, rows: 2,
      placeholder: 'Mr. Rajesh Sharma\n& Mrs. Sunita Sharma',
      hint: 'Two lines, as they should appear on the blessing card.' },
    { id: 'groomParents', type: 'textarea', label: 'The groom’s parents', maxLength: 80, rows: 2,
      placeholder: 'Mr. Vikram Verma\n& Mrs. Meena Verma' },

    /* 3 · the ceremonies (+ when the countdown ends) */
    { id: 'events', type: 'list', label: 'The ceremonies', itemLabel: 'Ceremony', addLabel: 'Add a ceremony',
      minItems: 1, maxItems: 3,
      shape: [
        { id: 'name', type: 'text', label: 'Ceremony', required: true, maxLength: 30, placeholder: 'Muhurtham' },
        { id: 'date', type: 'date', label: 'Date', required: true },
        { id: 'time', type: 'text', label: 'Time', maxLength: 30, placeholder: '7:00 PM' },
        { id: 'venue', type: 'text', label: 'Venue', maxLength: 80, placeholder: 'Rambagh Palace, Jaipur' },
        { id: 'caption', type: 'text', label: 'A line beneath', maxLength: 90, placeholder: 'The sacred ceremony, as the lamps are lit.' },
      ],
      default: EVENTS,
      hint: 'Up to three — Mehendi, Muhurtham, Reception is the classic order. The countdown ends at the Muhurtham unless you set another day below.' },
    { id: 'countdownDate', type: 'date', label: 'The countdown ends on',
      hint: 'Optional. Leave it blank and it counts down to the Muhurtham (or the first ceremony).' },

    /* 4 · the photograph */
    { id: 'photo', type: 'image', label: 'A photograph of the two of you',
      hint: 'Optional. A watercolor couple holds the frame until you add your own.' },
    { id: 'photoCaption', type: 'text', label: 'A line under the photograph', maxLength: 60,
      default: '…and so, our new beginning.' },

    /* 5 · venue & RSVP */
    { id: 'venueName', type: 'text', label: 'The venue', maxLength: 60, placeholder: 'Rambagh Palace' },
    { id: 'address', type: 'text', label: 'The address', maxLength: 100, placeholder: 'Bhawani Singh Road, Jaipur' },
    { id: 'mapsUrl', type: 'url', label: 'A Google Maps link', maxLength: 300, placeholder: 'https://maps.google.com/…',
      hint: 'Optional. Guests get a “Find your way” button.' },
    { id: 'rsvpPhone', type: 'text', label: 'RSVP on WhatsApp', maxLength: 20, placeholder: '+91 98765 43210',
      hint: 'Optional. A “Bless us with your presence” button opens a chat with this number.' },
  ],

  steps: [
    { title: 'The couple', heading: 'The two of you', intro: 'Your names carry the whole invitation — in the sky, in the ask, in the countdown.', fields: ['brideName', 'groomName'] },
    { title: 'The blessings', heading: 'With the blessings of', intro: 'A Hindu invitation begins with the families. Two lines for each set of parents.', fields: ['brideParents', 'groomParents'] },
    { title: 'The ceremonies', heading: 'The ceremonies', intro: 'Up to three cards, in order. The countdown ends at the Muhurtham unless you choose another day.', fields: ['events', 'countdownDate'] },
    { title: 'The photograph', heading: 'One photograph', intro: 'A framed photo of the two of you, slightly tilted, with a line beneath.', fields: ['photo', 'photoCaption'] },
    { title: 'Venue, RSVP & song', heading: 'Where, and how to reach you', intro: 'The address, a Maps link, a WhatsApp number guests can RSVP to — and the song, if you like one.', fields: ['venueName', 'address', 'mapsUrl', 'rsvpPhone'] },
  ],

  create: {
    eyebrow: 'Vivah · A divine-sky wedding invitation',
    headline: 'A wedding invitation that opens in the clouds.',
    intro: 'A golden sky, a henna hand reaching into the light, and your names. Then the families’ blessings, the three ceremonies, a photograph, and a live countdown to the Muhurtham. Six short steps; the link is ready before the haldi dries.',
    noun: 'invitation',
    designHeading: 'Seven quiet beats',
    designIntro: 'It reads like the invitation reels: one continuous scroll, each section a full screen.',
    scenes: [
      'a golden divine sky — a henna hand, a small blue bird, and your names in ivory',
      'a toran of marigold and banana leaf, then both families’ blessings',
      'the ask: “Together with our families’ blessings…”',
      'the three ceremonies, each a card with its own motif and an add-to-calendar link',
      'one framed photograph of the two of you',
      '“Our New Beginning Starts In” — a live days · hours · minutes · seconds countdown',
      'the venue, a Maps link, and an RSVP on WhatsApp — closed with शुभ विवाह',
    ],
    previewCta: 'Scroll it exactly as your guests will.',
    previewHelp: 'The countdown is live; the petals drift. Try the add-to-calendar links.',
    resultLine: 'Send the link in the family group. It opens like a blessing.',
  },

  /** /vivah/demo, the collection thumbnail and the detail page. */
  demo: {
    brideName: 'Ananya',
    groomName: 'Arjun',
    brideParents: 'Mr. Rajesh Sharma\n& Mrs. Sunita Sharma',
    groomParents: 'Mr. Vikram Verma\n& Mrs. Meena Verma',
    events: EVENTS,
    countdownDate: '2027-02-14',
    photo: '',
    photoCaption: '…and so, our new beginning.',
    venueName: 'Rambagh Palace',
    address: 'Bhawani Singh Road, Jaipur, Rajasthan',
    mapsUrl: 'https://maps.google.com/?q=Rambagh+Palace+Jaipur',
    rsvpPhone: '',
    bgmSong: 'https://www.youtube.com/watch?v=HSlw8bUqNa8',
  },

  sections: ['hero', 'blessings', 'invitation', 'events', 'couple', 'countdown', 'venue'],
  theme: {
    bg: '#FCF9F3', ink: '#3D3229', accent: '#8E3B46', soft: '#FFFFFF',
    motif: 'dove', ampersand: true, serifCase: 'title', layout: 'cinematic',
  },
};
