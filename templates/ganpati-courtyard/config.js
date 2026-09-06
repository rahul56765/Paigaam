'use strict';
/**
 * Ganpati Aagman — Traditional Courtyard.
 *
 * The customer's invitation is a real, shareable MP4: the original 10-second
 * courtyard procession video plays untouched while four caption cues fade in
 * and out inside the clear upper sky — greeting, hero line, family line, then
 * the when-and-where. The video (and its original sound) are never altered;
 * captions complement, never cover.
 *
 * The source video ships as a checksummed base64 asset and is decoded to
 * /ganpati-courtyard/media/ at boot; the export pipeline burns the captions
 * in server-side with ffmpeg so the download is a true MP4, not a recording.
 */
module.exports = {
  slug: 'ganpati-courtyard',
  name: 'Ganpati Aagman — Traditional Courtyard',
  category: 'Festival',
  price: 0,
  currency: 'INR',
  description: 'Bappa comes home. The original 10-second courtyard procession plays untouched while your names, date and venue fade in over the morning sky — a personalised MP4, ready for WhatsApp.',
  thumbnail_url: '/ganpati-courtyard/media/courtyard-poster.jpg',
  version: 1,
  editable: true,
  fields: [
    { id: 'greeting',   label: 'Greeting (शुभ संधिपान)', type: 'text', placeholder: '॥ श्री गणेशाय नमः ॥', group: 'message' },
    { id: 'mainTitle',  label: 'Main title', type: 'text', placeholder: 'बाप्पा येत आहेत…', group: 'message' },
    { id: 'familyName', label: 'Family / host name', type: 'text', required: true, placeholder: 'आपले नाव', group: 'people' },
    { id: 'eventDate',  label: 'Aagman date', type: 'text', placeholder: 'गणपती आगमन तारीख', group: 'occasion' },
    { id: 'eventTime',  label: 'Aagman time', type: 'text', placeholder: 'आगमनाची वेळ', group: 'occasion' },
    { id: 'venueName',  label: 'Venue', type: 'text', placeholder: 'ठिकाण', group: 'occasion' },
    { id: 'city',       label: 'City', type: 'text', placeholder: 'शहर', group: 'occasion' },
  ],
  sections: ['video'],
  theme: { bg: '#f7efe1', ink: '#4a2c14', accent: '#b45a12', soft: '#efe3cd', motif: 'dove', layout: 'cinematic' },
  assets: {
    video: '/ganpati-courtyard/media/courtyard.mp4',
    poster: '/ganpati-courtyard/media/courtyard-poster.jpg',
    font: '/ganpati-courtyard/media/TiroDevanagariMarathi-Regular.ttf',
  },
};
