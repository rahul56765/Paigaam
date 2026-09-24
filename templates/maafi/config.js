'use strict';
/**
 * Maafi — the apology that refuses to be refused.
 *
 * A port of ThisWasAryan/interactive-apology-page (MIT): one page, one plea,
 * two buttons. The "No" button runs away from the cursor, shrinks with every
 * attempt and sparkles as it escapes, while the main message cycles through a
 * ladder of increasingly desperate pleas. Giving in — pressing the "Yes"
 * button, which grows with every failed attempt — bursts the screen in
 * floating hearts and bouncing emoji.
 *
 * Zero media assets: every visual — the animated gradient, the floating
 * background hearts, the sparkles, the heart rain — is hand-rolled CSS/JS
 * with no library dependencies, exactly like the original.
 *
 * Editable: the sender personalises the plea, the yes/no labels, the message
 * ladder and the celebration; the mechanic, the animation and the timing are
 * fixed (they are the template).
 */
module.exports = {
  slug: 'maafi',
  name: 'Maafi',
  category: 'Personal',
  price: 0,
  currency: 'INR',
  description: 'The apology that refuses to be refused. The No button runs away, shrinks and sparkles with every attempt — while Yes grows more tempting until there is only one way out.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  fields: [
    { id: 'recipientName', label: 'Their name', type: 'text', required: true, placeholder: 'Meher', group: 'people' },
    { id: 'senderName',    label: 'Your name (for the signature)', type: 'text', placeholder: 'Rahul', group: 'people' },
    { id: 'headline',      label: 'The opening plea', type: 'text', placeholder: 'I’m really sorry ❤️', group: 'message' },
    { id: 'yesLabel',      label: 'The yes button', type: 'text', placeholder: 'Okay baby, I forgive you 💖', group: 'message' },
    { id: 'noLabel',       label: 'The no button', type: 'text', placeholder: 'No, I’m still angry 😠', group: 'message' },
    { id: 'celebration',   label: 'The celebration message', type: 'text', placeholder: 'Yay! You forgave me! 😍💖🥳', group: 'message' },
  ],
  sections: ['apology', 'celebration'],
  theme: {
    bg: '#FF8AC5', ink: '#E73C7E', accent: '#E73C7E', soft: '#FFE8F2',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
