'use strict';
/**
 * Aakhri Sawaal — One Question. Your Answer. (Boyfriend Day family.)
 *
 * "Aakhri sawaal" (आख़िरी सवाल / آخری سوال) — the last question. Candlelight
 * on ink navy: a few short cards tap through ("I have a question." → "Take
 * your time." → a heartbeat), then one question in huge candle-gold type,
 * signed by you. Then the mic is his: he writes his answer, can frame a photo
 * with it, and it comes straight back to you on WhatsApp.
 *
 * Nothing he writes is stored on Paigaam — the answer travels as a WhatsApp
 * message (to your number if you add it, otherwise he picks the chat), and
 * the framed photo card is made on his phone.
 */

const BUILD_UP = ['I have a question.', 'Take your time.'];

module.exports = {
  slug: 'aakhri-sawaal',
  family: 'bfday',
  name: 'Aakhri Sawaal',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'One Question. Your Answer. — a few candlelit cards build up to one question in huge gold type, signed by you. He answers, frames a photo with it if he likes, and his reply comes straight back to you on WhatsApp.',
  thumbnail_url: '',
  ogImage: '/aakhri-sawaal/og.jpg',
  version: 1,
  editable: true,
  displayField: 'senderName',

  fields: [
    { id: 'senderName', type: 'text', label: 'Your name', required: true, maxLength: 40, placeholder: 'Ananya',
      hint: 'Signed under the question, and in his reply: “Reply to Ananya’s question”.' },
    { id: 'recipientName', type: 'text', label: 'His name', maxLength: 40, placeholder: 'Kabir',
      hint: 'Optional. The first card greets him by name.' },
    { id: 'question', type: 'textarea', label: 'The question', maxLength: 180, rows: 3,
      default: 'Will you be mine — this Boyfriend Day, and every day after?',
      hint: 'One question. Big, gold, and all his. Kuch aisa poocho jo sirf woh samjhe.' },

    { id: 'buildUp', type: 'list', label: 'The cards before it', itemLabel: 'Card', addLabel: 'Add a card',
      minItems: 1, maxItems: 2, item: { type: 'text', maxLength: 70, placeholder: 'I have a question.' },
      default: BUILD_UP,
      hint: 'One or two short lines he taps through. A heartbeat always comes last, then the question.' },

    { id: 'whatsapp', type: 'text', label: 'Your WhatsApp number', maxLength: 20, placeholder: '+91 98765 43210',
      hint: 'Optional. With it, his answer opens straight in a chat with you. Without it, he chooses who to send it to. It’s only used in the link on his screen.' },
    { id: 'songTitle', type: 'text', label: 'A song for the moment', maxLength: 60, placeholder: 'Tum Hi Ho' },
    { id: 'songUrl', type: 'url', label: 'A link to it', maxLength: 300, placeholder: 'https://open.spotify.com/…',
      hint: 'Optional. It plays only if he taps it.' },
  ],

  steps: [
    { title: 'The question', heading: 'The question', intro: 'One question, signed by you. It appears in huge candle-gold letters.', fields: ['senderName', 'recipientName', 'question'] },
    { title: 'The build-up', heading: 'The build-up', intro: 'A card or two before the question — he taps through them, then a heartbeat.', fields: ['buildUp'] },
    { title: 'His reply', heading: 'How his answer reaches you', intro: 'His reply comes back to you on WhatsApp. Add a song if you want one playing in the background of the moment.', fields: ['whatsapp', 'songTitle', 'songUrl'] },
  ],

  create: {
    eyebrow: 'Aakhri Sawaal · One Question. Your Answer.',
    headline: 'One question. Then it’s his turn.',
    intro: 'A few candlelit cards, a heartbeat, and then one question in huge gold type, signed by you. He writes his answer, frames a photo with it if he likes, and it comes straight back to you on WhatsApp. Two minutes to make.',
    noun: 'question',
    designHeading: 'A question, and his answer',
    designIntro: 'It builds up slowly, asks once, and then hands him the mic.',
    scenes: [
      'a short card or two he taps through — “I have a question.” “Take your time.”',
      'a heartbeat',
      'your question, huge and gold, with your name signed below it',
      'his answer — and a photo, framed, if he wants to add one',
      'one tap, and his reply is on its way to you on WhatsApp',
    ],
    previewCta: 'Ask it exactly as he will see it.',
    previewHelp: 'Tap through the cards, then try answering — the WhatsApp button shows the message he will send.',
    resultLine: 'Send him the link. Then keep your phone close.',
  },

  /** /aakhri-sawaal/demo, the collection thumbnail and the detail page. */
  demo: {
    senderName: 'Ananya',
    recipientName: 'Kabir',
    question: 'Will you be mine — this Boyfriend Day, and every day after?',
    buildUp: BUILD_UP,
    whatsapp: '',
    songTitle: '',
    songUrl: '',
  },

  sections: ['build-up', 'question', 'reply'],
  theme: {
    bg: '#F5EFE4', ink: '#101820', accent: '#8A6418', soft: '#FFFBF3',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
