'use strict';
const note = 'To My Dearest, I am writing this little note just because you have been on my mind all day long, which is nothing new since you pretty much live there anyway. Every single time I think about your smile, my heart does a tiny happy dance. I cannot wait until the next time I get to see you❤️';
const photos = [1, 2, 3, 7].map(n => ({ photo: `/assets/bfday-demo/couple-${n}.jpg`, caption: 'a little moment, forever ours' }));
module.exports = {
  slug: 'little-love', family: 'bfday', name: 'Little Love', category: 'Love', price: 99, currency: 'INR',
  description: 'Five chocolate-brown scrapbook pages: a tulip bouquet, your love letter, a photo strip and voice note, a playable song card, and a hand-doodled farewell. Flip through a keepsake made just for them.',
  thumbnail_url: '/little-love/thumbnail.webp', version: 1, editable: true, backgroundMusic: false, displayField: 'senderName',
  fields: [
    { id: 'senderName', type: 'text', label: 'Your name', required: true, maxLength: 40, placeholder: 'Rahul' },
    { id: 'recipientName', type: 'text', label: 'Their name', required: true, maxLength: 40, placeholder: 'Neha' },
    { id: 'coverTitle', type: 'text', label: 'Bouquet page title', maxLength: 50, default: 'to my love <3' },
    { id: 'openLabel', type: 'text', label: 'Opening invitation', maxLength: 42, default: 'explore your card →' },
    { id: 'letterHeading', type: 'text', label: 'Letter page heading', maxLength: 55, default: 'i love you' },
    { id: 'loveLetter', type: 'textarea', label: 'Your love letter', maxLength: 900, rows: 8, default: note },
    { id: 'portrait', type: 'image', label: 'The framed photo', hint: 'A vertical photograph works best. Leave blank for the sample image.' },
    { id: 'memoryHeading', type: 'text', label: 'Memories heading', maxLength: 55, default: 'my favorite memories' },
    { id: 'memoryPhoto', type: 'image', label: 'Your favourite night', hint: 'The photograph on the left of the memories page.' },
    { id: 'memoryCaption', type: 'text', label: 'Above the memory photograph', maxLength: 55, default: 'remember this night? <3' },
    { id: 'memoryNote', type: 'text', label: 'Below the voice note', maxLength: 95, default: 'you bring me so much joy every day❤️' },
    { id: 'photoStrip', type: 'list', label: 'The four photo-booth pictures', itemLabel: 'Photo', minItems: 4, maxItems: 4, shape: [
      { id: 'photo', type: 'image', label: 'Photo' }, { id: 'caption', type: 'text', label: 'Photo description', maxLength: 100 }
    ], default: Array.from({ length: 4 }, () => ({ caption: 'a little moment, forever ours' })) },
    { id: 'musicUpload', type: 'audio', label: 'Upload your memory voice note', hint: 'MP3, M4A, OGG or WAV, up to 15 MB. Plays in the waveform player. Blank uses the original instrumental demo, not a recorded voice.' },
    { id: 'songHeading', type: 'text', label: 'Song page heading', maxLength: 55, default: 'my love <3' },
    { id: 'songTitle', type: 'text', label: 'Song card caption', maxLength: 65, default: 'listen to this :)' },
    { id: 'songCover', type: 'image', label: 'Song cover photograph' },
    { id: 'musicLink', type: 'url', label: 'Your song link', maxLength: 500, hint: 'A direct HTTPS MP3/M4A/OGG/WAV link or YouTube video URL. Plays here, without opening another app. Blank uses our original demo instrumental.' },
    { id: 'playlist', type: 'list', label: 'More songs in your playlist (optional)', itemLabel: 'Song', addLabel: 'Add a song', minItems: 0, maxItems: 4, default: [], shape: [
      { id: 'title', type: 'text', label: 'Song title', required: true, maxLength: 65 },
      { id: 'url', type: 'url', label: 'HTTPS audio or YouTube URL', required: true, maxLength: 500 }
    ] },
    { id: 'songNote', type: 'text', label: 'Under the song', maxLength: 100, default: 'i can’t wait to see you <3' },
    { id: 'closingTitle', type: 'text', label: 'Final page heading', maxLength: 60, default: 'i love you❤️' },
    { id: 'closingNote', type: 'text', label: 'Pink handwritten note', maxLength: 35, default: 'my love <3' },
  ],
  steps: [
    { title: 'For your love', heading: 'A little card, just for them', intro: 'The tulips, paper, stickers and five-page design stay as shown.', fields: ['senderName', 'recipientName', 'coverTitle', 'openLabel'] },
    { title: 'The letter', heading: 'Say it in your own words', intro: 'Your photograph and message sit in the reference’s original scrapbook composition.', fields: ['letterHeading', 'loveLetter', 'portrait'] },
    { title: 'The memories', heading: 'Your favourite little moments', intro: 'Add four photo-booth pictures, a favourite night, and an optional voice recording.', fields: ['memoryHeading', 'memoryPhoto', 'memoryCaption', 'memoryNote', 'photoStrip', 'musicUpload'] },
    { title: 'Your song', heading: 'Something to listen to', intro: 'Choose a song link and cover photograph. No music starts without a tap.', fields: ['songHeading', 'songTitle', 'songCover', 'musicLink', 'playlist', 'songNote'] },
    { title: 'The last page', heading: 'End with a little love', intro: 'Your words, surrounded by the familiar hand-drawn hearts and doodles.', fields: ['closingTitle', 'closingNote'] },
  ],
  create: {
    eyebrow: 'Little Love · An interactive scrapbook', headline: 'A bouquet, a letter, a little us.',
    intro: 'Five chocolate-brown pages filled with tulips, photographs, your own words and music. A faithful scrapbook experience, personalised in PAIGAAM.', noun: 'love card',
    designHeading: 'Five pages, nothing left out', designIntro: 'The card shrinks, turns in three dimensions, and opens to the next page.',
    scenes: ['A pink tulip bouquet and floating hearts', 'A framed photograph, a letter and lipstick-paper corner', 'A four-picture photo strip, penguin sticker and playable voice note', 'A song card between two kitten stickers', 'A page of hand-drawn hearts and love doodles'],
    previewCta: 'Tap the bouquet, then use the arrows or swipe.', previewHelp: 'Tap play to hear the audio. Every page can be revisited.', resultLine: 'One personal keepsake, one shareable PAIGAAM link.'
  },
  demo: { senderName: 'Rahul', recipientName: 'Neha', coverTitle: 'to my love <3', openLabel: 'explore your card →', letterHeading: 'i love you', loveLetter: note, portrait: '/assets/bfday-demo/couple-1.jpg', memoryHeading: 'my favorite memories', memoryPhoto: '/assets/bfday-demo/couple-7.jpg', memoryCaption: 'remember this night? <3', memoryNote: 'you bring me so much joy every day❤️', photoStrip: photos, musicUpload: '', songHeading: 'my love <3', songTitle: 'listen to this :)', songCover: '', musicLink: '', playlist: [], songNote: 'i can’t wait to see you <3', closingTitle: 'i love you❤️', closingNote: 'my love <3' },
  sections: ['bouquet', 'letter', 'memories', 'song', 'doodles'],
  theme: { bg: '#584233', ink: '#FFF0D2', accent: '#B92437', soft: '#EEEAE1', motif: 'heart', ampersand: false, serifCase: 'lower', layout: 'flipbook' }
};
