'use strict';
/**
 * Sawaal — the date questionnaire.
 *
 * A port of ShamsAli-fathi/ask-me-on-a-date (MIT): a playable, multi-scene
 * date invitation. The visitor agrees to a date, survives the "do you like
 * me" trap, picks the vibe (or types their own idea), chooses a day from the
 * sender's real availability, sits through a cheeky four-question quiz that
 * is actually scored, surrenders a selfie and answers the final kiss
 * question — which decides the ending.
 *
 * The original recorded every answer to a local file; Paigaam keeps that
 * spirit: the visitor's choices (and their selfie) collect on a private,
 * creator-gated responses page the sender can read after sending.
 *
 * Media: the eleven Flork-style scene illustrations ship as checksummed
 * base64 sources in assets/sawaal/ and are boot-healed into
 * public/sawaal/media/ by lib/sawaalMedia.js — same pattern as the Valentine
 * GIFs. The original's meme MP3s are deliberately not shipped; the small
 * sound effects are synthesised in Web Audio (public/sawaal/sfx.js).
 *
 * Editable: the sender personalises the names, the scene copy, the quiz,
 * the available days and the outcome lines; the scene flow, the mechanics
 * and the timing are fixed (they are the template).
 */
module.exports = {
  slug: 'sawaal',
  name: 'Sawaal',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'A date invitation they play through: choices, a scored quiz, a selfie demand and the final kiss question — every answer lands back on your private responses page.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName',    label: 'Your name', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'inviteTitle',   label: 'The invitation headline', type: 'text', placeholder: 'Let’s schedule a date!', group: 'message' },
    { id: 'inviteIntro',   label: 'The invitation line under it', type: 'text', placeholder: 'Be a good girl & answer all the questions. I’ll worry about the rest.', group: 'message' },
    { id: 'likeTitle',     label: 'The “do you like me” question', type: 'text', placeholder: 'Do you like Rahul?!?!', group: 'message' },
    { id: 'vibeTitle',     label: 'The vibe question', type: 'text', placeholder: 'How do you like it?', group: 'message' },
    { id: 'vibeOptions',   label: 'Vibe options (comma-separated, first is primary)', type: 'text', placeholder: 'Dinner & Chill, Coffee & Walking', group: 'message' },
    { id: 'availableDays', label: 'Days you’re free (comma-separated YYYY-MM-DD, up to 8)', type: 'text', placeholder: '2026-10-01, 2026-10-02, 2026-10-03', group: 'message' },
    { id: 'quizTitle',     label: 'The quiz intro headline', type: 'text', placeholder: 'So you know us, huh?', group: 'message' },
    { id: 'quizIntro',     label: 'The quiz intro line', type: 'text', placeholder: 'Answer the following questions. They should be easy, I swear!', group: 'message' },
    { id: 'kissTitle',     label: 'The final question headline', type: 'text', placeholder: 'What if...?', group: 'message' },
    { id: 'kissIntro',     label: 'The final question line', type: 'text', placeholder: 'What if I couldn’t handle your cuteness and kissed you on the first date...', group: 'message' },
    { id: 'yesOutcome',    label: 'The sweet ending headline', type: 'text', placeholder: 'I USED TO PRAY FOR TIMES LIKE THIS', group: 'message' },
    { id: 'shyOutcome',    label: 'The shy ending headline', type: 'text', placeholder: 'Pfff fine. I had to try it anyway', group: 'message' },
    { id: 'shyOutcomeLine', label: 'The shy ending line', type: 'text', placeholder: 'But I will be holding your hands, no questions asked!', group: 'message' },
  ],
  sections: ['invitation', 'questions', 'quiz', 'outcome'],
  theme: {
    bg: '#F8EEF7', ink: '#251B31', accent: '#FF4EAD', soft: '#FFE3F0',
    motif: 'sparkle', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
