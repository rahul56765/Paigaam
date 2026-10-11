'use strict';

/**
 * The Wedding Post — a five-page, editable newspaper wedding invitation.
 * The composition stays fixed; names, family lines, copy, times, photos,
 * timeline events, word-search words, tribute and map URL are personalisable.
 */
const EVENTS = [
  { time: '8:00 PM', name: 'Couple Entry', icon: 'rings' },
  { time: '8:30 PM', name: 'Photos With All of You', icon: 'camera' },
  { time: '9:00 PM', name: 'Dinner & Drinks', icon: 'dinner' },
  { time: '9:30 PM', name: 'Cake Cutting & Dance', icon: 'cake' },
  { time: '10:30 PM', name: 'Sparkler Send-off', icon: 'sparkler' },
];

const STATS = [
  { icon: 'meet', value: '1,386', label: 'days since their first date' },
  { icon: 'rings', value: '390', label: 'days engaged' },
  { icon: 'travel', value: '15', label: 'road trips taken together' },
  { icon: 'coffee', value: '100', label: 'cups of coffee together' },
  { icon: 'pizza', value: '42', label: 'pizzas shared (and counting!)' },
];

const STORY_PHOTOS = [
  { photo: '/assets/bfday-demo/couple-1.jpg', caption: 'FIRST MEETING', date: '15.09.2022' },
  { photo: '/assets/bfday-demo/couple-2.jpg', caption: 'FIRST “I LOVE YOU”', date: '03.02.2023' },
  { photo: '/assets/bfday-demo/couple-3.jpg', caption: 'THE PROPOSAL', date: '14.06.2025' },
];

const THANK_PHOTOS = [
  { photo: '/assets/bfday-demo/couple-4.jpg', caption: 'A favourite moment' },
  { photo: '/assets/bfday-demo/couple-5.jpg', caption: 'Together, always' },
];

module.exports = {
  slug: 'wedding-post',
  family: 'bfday',
  name: 'The Wedding Post',
  category: 'Wedding',
  price: 0,
  currency: 'INR',
  description: 'A five-page vintage newspaper wedding invitation: a front-page announcement, save-the-date, love story, thank-you note, and a playful wedding-day timeline with games.',
  thumbnail_url: '',
  ogImage: '/assets/bfday-demo/couple-1.jpg',
  version: 1,
  editable: true,
  displayField: 'groomName',

  fields: [
    { id: 'groomName', type: 'text', label: 'Groom’s name', required: true, maxLength: 40, placeholder: 'Raghav', hint: 'The first name is included automatically in the Wedding Word Search; change it here to update the puzzle.' },
    { id: 'brideName', type: 'text', label: 'Bride’s name', required: true, maxLength: 40, placeholder: 'Ragini', hint: 'The first name is included automatically in the Wedding Word Search; change it here to update the puzzle.' },
    { id: 'groomParents', type: 'textarea', label: 'Groom’s parents', maxLength: 120, rows: 2, default: 'Mr. Suresh & Mrs. Meenakshi Kulkarni' },
    { id: 'brideParents', type: 'textarea', label: 'Bride’s parents', maxLength: 120, rows: 2, default: 'Mr. Anil & Mrs. Sunita Joshi' },

    { id: 'weddingDate', type: 'date', label: 'Wedding date', required: true, default: '2027-02-21' },
    { id: 'weddingTime', type: 'text', label: 'Ceremony time', maxLength: 30, default: '11:30 AM' },
    { id: 'venueName', type: 'text', label: 'Venue', maxLength: 80, default: 'Shubh Mangal Lawns' },
    { id: 'venueAddress', type: 'textarea', label: 'Venue address', maxLength: 180, rows: 2, default: 'Baner, Pune, Maharashtra 411045' },
    { id: 'joinMessage', type: 'textarea', label: 'Invitation message', maxLength: 300, rows: 3, default: 'Please join us for our Wedding Ceremony and Wedding Celebration. Your presence will make this day even more special.' },

    { id: 'storyText', type: 'textarea', label: 'The love story', maxLength: 900, rows: 7, default: 'We met by chance at a little coffee shop in Pune, both reaching for the last table by the window. One cup turned into a long conversation, then weekend walks, shared playlists and a friendship that felt like home. Somewhere along the way, ordinary days became our favourite story. Today, we are grateful to celebrate the next chapter with the people who have made every chapter brighter.' },
    { id: 'storyQuote', type: 'text', label: 'Short line beneath the story', maxLength: 120, default: 'One love, one heart, a lifetime of little moments.' },
    { id: 'stats', type: 'list', label: 'The five little statistics', itemLabel: 'Statistic', addLabel: 'Add a statistic', minItems: 3, maxItems: 5,
      shape: [
        { id: 'icon', type: 'select', label: 'Icon', options: ['meet', 'rings', 'travel', 'coffee', 'pizza'], default: 'meet' },
        { id: 'value', type: 'text', label: 'Number', required: true, maxLength: 12 },
        { id: 'label', type: 'text', label: 'Caption', required: true, maxLength: 64 },
      ], default: STATS },
    { id: 'funFacts', type: 'list', label: 'Fun facts about the couple', itemLabel: 'Fun fact', addLabel: 'Add a fun fact', minItems: 1, maxItems: 5,
      item: { type: 'text', label: 'Fact', maxLength: 170 },
      default: [
        'Raghav’s guilty pleasure: rewatching old comedy films.',
        'Ragini’s go-to snack: anything with a little extra chocolate.',
        'Raghav can’t start the morning without coffee.',
        'Ragini remembers the lyrics to every song after one listen.',
        'Their favourite trips begin with a playlist and a wrong turn.',
      ] },
    { id: 'storyPhotos', type: 'list', label: 'Three story photographs', itemLabel: 'Photo & caption', addLabel: 'Add a moment', minItems: 1, maxItems: 3,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', required: true, maxLength: 50 },
        { id: 'date', type: 'text', label: 'Date or date caption', required: true, maxLength: 24 },
      ], default: STORY_PHOTOS },

    { id: 'frontPhoto', type: 'image', label: 'Front-page photograph', alt: 'A couple photo for the wedding newspaper' },
    { id: 'frontDetailPhoto', type: 'image', label: 'Second front-page photograph', alt: 'A second couple photo for the wedding newspaper' },
    { id: 'saveDatePhoto', type: 'image', label: 'Save-the-date photograph', alt: 'A couple photo for the save-the-date page' },
    { id: 'thankYouMessage', type: 'textarea', label: 'Thank-you message', maxLength: 500, rows: 4, default: 'Thank you for being part of our Wedding Celebration. Your kindness, laughter and support have made this chapter brighter, and we are so grateful to share the day with you.' },
    { id: 'thankPhotos', type: 'list', label: 'Two thank-you photographs', itemLabel: 'Photo & caption', addLabel: 'Add a photograph', minItems: 1, maxItems: 2,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', maxLength: 56 },
      ], default: THANK_PHOTOS },

    { id: 'timeline', type: 'list', label: 'Wedding-day timeline', itemLabel: 'Event', addLabel: 'Add an event', minItems: 1, maxItems: 10,
      shape: [
        { id: 'time', type: 'text', label: 'Time', required: true, maxLength: 18 },
        { id: 'name', type: 'text', label: 'Event name', required: true, maxLength: 48 },
        { id: 'icon', type: 'select', label: 'Line icon', options: ['rings', 'camera', 'dinner', 'cake', 'sparkler'], default: 'rings' },
      ], default: EVENTS },
    { id: 'wordList', type: 'list', label: 'Wedding word-search words', itemLabel: 'Word', addLabel: 'Add a word', minItems: 4, maxItems: 12,
      hint: 'These words stay editable. The bride’s and groom’s first names are added automatically from the couple fields.',
      item: { type: 'text', label: 'Word (up to 20 letters)', maxLength: 20 },
      default: ['Wedding', 'Love', 'Cheers', 'Cake', 'Honeymoon', 'Anniversary'] },
    { id: 'memoryMessage', type: 'textarea', label: 'In Loving Memory message', maxLength: 220, rows: 3, default: 'For those we love who cannot be here today: you are with us in every memory and in our hearts.' },
    { id: 'mapLink', type: 'url', label: 'Reception Location map link', maxLength: 500, default: 'https://maps.google.com/?q=Shubh+Mangal+Lawns+Baner+Pune', hint: 'Paste a full Google Maps or other https:// map link. The QR code is made from this address.' },
  ],

  steps: [
    { title: 'The couple', heading: 'The two of you', intro: 'Add the names and family lines for the newspaper’s front page.', fields: ['groomName', 'brideName', 'groomParents', 'brideParents'] },
    { title: 'The invitation', heading: 'The date and place', intro: 'Your wedding details and the short invitation message.', fields: ['weddingDate', 'weddingTime', 'venueName', 'venueAddress', 'joinMessage', 'frontPhoto', 'frontDetailPhoto', 'saveDatePhoto'] },
    { title: 'The story', heading: 'Your story & little facts', intro: 'Add the sample story, five statistics, fun facts and three pictured moments.', fields: ['storyText', 'storyQuote', 'stats', 'funFacts', 'storyPhotos'] },
    { title: 'The thank-you', heading: 'A note of thanks', intro: 'One thank-you paragraph and two photos for the closing page.', fields: ['thankYouMessage', 'thankPhotos'] },
    { title: 'Wedding Day', heading: 'The timeline & games', intro: 'Set the editable events, choose the word-search words, add a remembrance message and paste a reception map link.', fields: ['timeline', 'wordList', 'memoryMessage', 'mapLink'] },
  ],

  create: {
    eyebrow: 'The Wedding Post · Special Edition',
    headline: 'Five pages, like a little newspaper made for your wedding.',
    intro: 'Personalise the front page, save-the-date, love story, thank-you page and a playable Wedding Day page. The layout stays faithful to the vintage newspaper design; your details make it yours.',
    noun: 'wedding newspaper',
    designHeading: 'Five pages to keep',
    designIntro: 'Turn the pages in order, from the invitation to the Wedding Day games.',
    scenes: ['The Wedding Post front page with your families, date, venue and invitation', 'Save the Date with one photograph and your names', 'The Love Story, five fun facts and three captioned moments', 'Our Wedding Post with one thank-you and two photographs', 'Wedding Day Timeline, Word Search, Maze, In Loving Memory and a Reception Location QR'],
    previewCta: 'Turn through all five pages.',
    previewHelp: 'Try the word search and guide the groom through the maze.',
    resultLine: 'Share your five-page Wedding Post with everyone you love.',
  },

  demo: {
    groomName: 'Raghav',
    brideName: 'Ragini',
    groomParents: 'Mr. Suresh & Mrs. Meenakshi Kulkarni',
    brideParents: 'Mr. Anil & Mrs. Sunita Joshi',
    weddingDate: '2027-02-21',
    weddingTime: '11:30 AM',
    venueName: 'Shubh Mangal Lawns',
    venueAddress: 'Baner, Pune, Maharashtra 411045',
    joinMessage: 'Please join us for our Wedding Ceremony and Wedding Celebration. Your presence will make this day even more special.',
    storyText: 'We met by chance at a little coffee shop in Pune, both reaching for the last table by the window. One cup turned into a long conversation, then weekend walks, shared playlists and a friendship that felt like home. Somewhere along the way, ordinary days became our favourite story. Today, we are grateful to celebrate the next chapter with the people who have made every chapter brighter.',
    storyQuote: 'One love, one heart, a lifetime of little moments.',
    stats: STATS,
    funFacts: [
      'Raghav’s guilty pleasure: rewatching old comedy films.',
      'Ragini’s go-to snack: anything with a little extra chocolate.',
      'Raghav can’t start the morning without coffee.',
      'Ragini remembers the lyrics to every song after one listen.',
      'Their favourite trips begin with a playlist and a wrong turn.',
    ],
    storyPhotos: STORY_PHOTOS,
    frontPhoto: '/assets/bfday-demo/couple-6.jpg',
    frontDetailPhoto: '/assets/bfday-demo/couple-7.jpg',
    saveDatePhoto: '/assets/bfday-demo/couple-8.jpg',
    thankYouMessage: 'Thank you for being part of our Wedding Celebration. Your kindness, laughter and support have made this chapter brighter, and we are so grateful to share the day with you.',
    thankPhotos: THANK_PHOTOS,
    timeline: EVENTS,
    wordList: ['Wedding', 'Love', 'Cheers', 'Cake', 'Honeymoon', 'Anniversary'],
    memoryMessage: 'For those we love who cannot be here today: you are with us in every memory and in our hearts.',
    mapLink: 'https://maps.google.com/?q=Shubh+Mangal+Lawns+Baner+Pune',
  },

  sections: ['front-page', 'save-the-date', 'love-story', 'thank-you', 'wedding-day'],
  theme: { bg: '#F1EDE5', ink: '#252320', accent: '#252320', soft: '#E4DED3', motif: 'ring', ampersand: true, serifCase: 'title', layout: 'editorial' },
};
