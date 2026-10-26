'use strict';
const kinds = ['wedding', 'haldi', 'mehndi', 'sangeet', 'reception'];
const titles = ['Wedding Ceremony', 'Haldi', 'Mehndi', 'Sangeet', 'Reception'];
const EVENTS = kinds.map((kind, i) => ({ kind, visible: 'yes', heading: titles[i], lead: 'Join us to celebrate our', hostLine: i === 0 ? 'Honouring our Bride & Groom' : '', date: `2027-07-${[28,26,25,27,29][i]}`, time: ['3:00 PM','5:00 PM','8:00 PM','7:00 PM','5:00 PM'][i], address: 'The Lotus Courtyard\nJaipur, Rajasthan', panelColor: '' }));
const text = (id, label, value, maxLength = 100, type = 'text') => ({ id, type, label, maxLength, ...(value === undefined ? {} : { default: value }) });
const crop = prefix => [
  { id: prefix + 'Zoom', type: 'number', label: 'Zoom / crop', min: 100, max: 220, default: 100, slider: true, unit: '%' },
  { id: prefix + 'X', type: 'number', label: 'Move left / right', min: 0, max: 100, default: 50, slider: true, unit: '%' },
  { id: prefix + 'Y', type: 'number', label: 'Move up / down', min: 0, max: 100, default: 50, slider: true, unit: '%' },
];
module.exports = {
  slug: 'lotus-vivah', family: 'bfday', name: 'Lotus Vivah', category: 'Wedding', price: 0, currency: 'INR', version: 1,
  editable: true, backgroundMusic: false, displayField: 'brideName',
  description: 'A lotus-sealed invitation in eight portrait cards: white paisley, deep pink scallops, yellow Haldi, green Mehndi and a ribbon-tied thank you. Every word, panel colour and celebration is yours.',
  thumbnail_url: '/lotus-vivah/thumbnail.webp', ogImage: '/lotus-vivah/thumbnail.webp',
  fields: [
    { id: 'brideName', type: 'text', label: "Bride’s name", required: true, maxLength: 50, placeholder: 'Prerna' },
    { id: 'groomName', type: 'text', label: "Groom’s name", required: true, maxLength: 50, placeholder: 'Sumit' },
    text('coupleJoiner', 'Word between names', '&', 16),
    text('coverHint', 'Cover opening hint', 'tap to open', 40),
    text('sealText', 'Seal initials (blank uses your names)', '', 8),
    { id: 'monogramLogo', type: 'image', label: 'Logo or monogram on the white seal', preserveTransparency: true, tapToPick: true, hint: 'Optional. PNG transparency is preserved; removing the upload restores your initials.' },
    ...crop('logo'),
    { id: 'couplePhoto', type: 'image', label: 'Optional couple photo on Save the Date', tapToPick: true, hint: 'Adds a small portrait above the heading, within a reserved safe space. Leave blank for the reference layout.' },
    ...crop('photo'),
    text('saveHeading', 'Save-the-date heading', 'Save the Date', 60),
    { id: 'saveDate', type: 'date', label: 'Save-the-date date', default: '2027-07-28', required: true },
    text('saveTime', 'Save-the-date time', '8:00 AM', 50),
    text('atLabel', 'Word before time', 'at', 16),
    text('addressLead', 'Word before address', 'at', 16),
    {
      id: 'events', type: 'list', label: 'Celebration pages', itemLabel: 'Event page', addLabel: 'Add a celebration', minItems: 0, maxItems: 5, default: EVENTS,
      hint: 'Use the arrows to reorder pages. Choose Hidden to hide any celebration and Shown to restore it. Remove an event if you do not need it.',
      shape: [
        { id: 'kind', type: 'select', label: 'Card design', required: true, options: kinds.map((value,i) => ({value,label:titles[i]})) },
        { id: 'visible', type: 'select', label: 'Show this page', default: 'yes', options: [{value:'yes',label:'Shown'},{value:'no',label:'Hidden'}] },
        text('heading', 'Heading', undefined, 60), text('lead', 'Invitation line', undefined, 100), text('hostLine', 'Host line', undefined, 120),
        { id: 'date', type: 'date', label: 'Date', required: true }, text('time', 'Time', undefined, 50),
        text('address', 'Venue and address', undefined, 180, 'textarea'),
        { ...text('panelColor', 'This panel colour (optional hex)', '', 7), hint: 'Leave blank for its theme colour, or enter a colour such as #D94D79.' },
      ],
    },
    text('thanksHeading', 'Closing heading', 'Thank You', 60),
    text('thanksMessage', 'Thank-you message', 'We cannot wait to share a new chapter in our lives with you.\n\nThank you for your love, blessings and warm wishes. Your presence will make our celebration all the more beautiful.', 450, 'textarea'),
    text('pinkColor', 'Deep pink panel colour', '#D94D79', 7),
    text('yellowColor', 'Haldi yellow panel colour', '#F3DF8B', 7),
    text('greenColor', 'Mehndi green panel colour', '#8AB440', 7),
    text('paperColor', 'Paper / white panel colour', '#FFFEF9', 7),
    { id: 'musicUpload', type: 'audio', label: 'Upload your background song', hint: 'MP3, M4A, OGG or WAV, up to 15 MB. Starts after the first cover tap. An uploaded song takes priority over a link.' },
    { id: 'musicLink', type: 'url', label: 'Or paste a direct audio / YouTube link', maxLength: 500, hint: 'Use an HTTPS MP3, M4A, OGG or WAV file URL, or a YouTube link. Spotify and Apple Music share pages cannot play as background audio. Some YouTube songs restrict embedding or require another tap.' },
  ],
  steps: [
    { title: 'The couple', heading: 'Your names and lotus seal', intro: 'Your logo replaces the editable initials in the white seal.', fields: ['brideName','groomName','coupleJoiner','coverHint','sealText','monogramLogo','logoZoom','logoX','logoY'] },
    { title: 'Save the Date', heading: 'The first card', intro: 'Keep the original white-paisley layout, or add an optional portrait.', fields: ['saveHeading','saveDate','saveTime','atLabel','addressLead','couplePhoto','photoZoom','photoX','photoY'] },
    { title: 'Celebrations', heading: 'Your celebration cards', intro: 'Every event has its own editable words, date, time, address and panel colour. Hide or reorder any event.', fields: ['events'] },
    { title: 'Thank you', heading: 'The ribbon-tied farewell', intro: 'A personal note and your names, framed only by the reference lotuses.', fields: ['thanksHeading','thanksMessage'] },
    { title: 'Colours & music', heading: 'Make the finishing touches yours', intro: 'Use six-digit hex colours. Music begins only after your guest taps the cover.', fields: ['pinkColor','yellowColor','greenColor','paperColor','musicUpload','musicLink'] },
  ],
  create: { eyebrow: 'Lotus Vivah · Wedding invitation', headline: 'A lotus opens. Your story unfolds.', intro: 'Eight botanical paper cards, delicate paisley and a white seal. Personalise every word, celebration and panel colour while the original lotus compositions stay intact.', noun: 'wedding invitation', designHeading: 'Eight reference-guided cards', designIntro: 'A complete 9:16 portrait composition, always fitted rather than cropped.', scenes: ['Oversized pink lotus petals open around a white seal','Save the Date on paisley paper with a deep pink side strip','Wedding Ceremony in a deep pink scalloped arch','A soft yellow arched Haldi card','A green scalloped Mehndi card','Sangeet on a white card over deep pink','Reception on a white card over deep pink','A deep pink thank-you with a grey ribbon and lotuses'], previewCta: 'Tap the lotus seal, then swipe or use the arrows.', previewHelp: 'Every card stays fully visible. Use previous, next or page dots.', resultLine: 'Share one graceful invitation link.' },
  demo: { brideName: 'Prerna', groomName: 'Sumit', coupleJoiner: '&', coverHint: 'tap to open', sealText: '', saveHeading: 'Save the Date', saveDate: '2027-07-28', saveTime: '8:00 AM', atLabel: 'at', addressLead: 'at', events: EVENTS, thanksHeading: 'Thank You', thanksMessage: 'We cannot wait to share a new chapter in our lives with you.\n\nThank you for your love, blessings and warm wishes. Your presence will make our celebration all the more beautiful.', pinkColor: '#D94D79', yellowColor: '#F3DF8B', greenColor: '#8AB440', paperColor: '#FFFEF9', logoZoom: 100, logoX:50, logoY:50, photoZoom:100, photoX:50, photoY:50 },
  sections: ['cover','save','events','thanks'],
  theme: { bg:'#FFFEF9', ink:'#873B55', accent:'#D94D79', soft:'#F3DF8B', motif:'lotus', ampersand:true, serifCase:'title', layout:'story' },
};
