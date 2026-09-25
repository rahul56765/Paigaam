'use strict';
/**
 * Meri Duniya — A Whole Website, Made For You. (Boyfriend Day family.)
 *
 * "Meri duniya" (मेरी दुनिया / میری دنیا) — my whole world. The flagship of the
 * family: one private link that opens on a dark screen, a single heartbeat,
 * "Hey {Name}…", and then a guided journey through a website that is entirely
 * about him — a sealed letter, your story, the reasons, your numbers, your
 * photos, and one last question.
 *
 * Seven wizard steps, one per section. Every section except the opening and
 * the question is optional: a section left empty (or switched off) is not
 * rendered at all, and the journey renumbers itself so there are never gaps.
 *
 * Personal material (milestones, numbers, photos) has no invented defaults —
 * a gift must never ship somebody else's first date. Generic copy (the letter,
 * the reasons, the question) is pre-written so an untouched form still sends
 * something beautiful.
 */

const LETTER = [
  'Pata nahi kahan se shuru karun, so I’ll start with the simplest true thing: you make my days better. Not in a grand, movie way — in the quiet way. The good-morning texts. The way you remember how I take my chai. The way you listen, even when I’m going on about nothing at all.',
  'I made you this little corner of the internet because a card felt too small. Everything here is ours — the moments I keep replaying, the reasons I could list forever, the silly numbers that somehow add up to us.',
  'Thank you for choosing me, on the easy days and especially on the hard ones. I don’t say it enough, so I’m writing it down where you can come back to it: you are my favourite person, and this whole world is yours.',
].join('\n\n');

const REASONS = [
  'The way you laugh at your own jokes before you finish telling them.',
  'You always save me the last bite, even when you pretend you won’t.',
  'You make ordinary Tuesdays feel like small celebrations.',
  'Your hugs fix things that words can’t.',
  'You remember the tiny things I mention only once.',
  'You believe in me a little more than I believe in myself.',
  'Long drives, bad songs, and you singing every one of them.',
  'With you, even waiting in line becomes my favourite part of the day.',
];

const INCLUDE = [
  { value: 'show', label: 'Include this section' },
  { value: 'hide', label: 'Leave it out' },
];

module.exports = {
  slug: 'meri-duniya',
  family: 'bfday',
  name: 'Meri Duniya',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'A Whole Website, Made For You — one private link, his name on the first screen, and a guided journey through your letter, your story, the reasons, your numbers and your photos, ending with one last question.',
  thumbnail_url: '',
  ogImage: '/meri-duniya/og.jpg',
  version: 1,
  editable: true,
  displayField: 'recipientName',

  fields: [
    /* 1 · the opening */
    { id: 'recipientName', type: 'text', label: 'His name', required: true, maxLength: 40, placeholder: 'Aarav',
      hint: 'The first thing he sees: “Hey Aarav, I made something for you.”' },
    { id: 'nickname', type: 'text', label: 'What you call him', maxLength: 30, placeholder: 'Jaan, Babu, Chotu…',
      hint: 'Optional. If you add one, the opening uses it instead of his name.' },
    { id: 'senderName', type: 'text', label: 'Your name', maxLength: 40, placeholder: 'Riya',
      hint: 'Optional. Signs the letter and the last page.' },

    /* 2 · the letter */
    { id: 'letterOn', type: 'select', label: 'The letter', options: INCLUDE, default: 'show' },
    { id: 'letter', type: 'textarea', label: 'Your letter', maxLength: 4000, rows: 10, default: LETTER,
      hint: 'Kuch baat likho jo dil tak jaye. Leave a blank line between paragraphs. It types itself out when he opens the envelope.' },
    { id: 'letterClosing', type: 'text', label: 'The sign-off', maxLength: 40, default: 'Hamesha tumhare saath,' },

    /* 3 · our story */
    { id: 'story', type: 'list', label: 'Your milestones', itemLabel: 'Milestone', addLabel: 'Add a milestone',
      minItems: 0, maxItems: 8,
      shape: [
        { id: 'date', type: 'text', label: 'When', maxLength: 30, placeholder: 'March 2023' },
        { id: 'title', type: 'text', label: 'What happened', required: true, maxLength: 60, placeholder: 'Pehli chai, pehli baat' },
        { id: 'caption', type: 'textarea', label: 'The story', maxLength: 400, rows: 3, placeholder: 'You were twenty minutes late and I didn’t mind at all.' },
        { id: 'photo', type: 'image', label: 'A photo' },
      ],
      hint: 'Three to eight moments work best. Leave this empty and the section is skipped.' },

    /* 4 · reasons */
    { id: 'reasonsOn', type: 'select', label: 'The reasons', options: INCLUDE, default: 'show' },
    { id: 'reasons', type: 'list', label: 'Reasons I love you', itemLabel: 'Reason', addLabel: 'Add a reason',
      minItems: 1, maxItems: 30, item: { type: 'text', maxLength: 140, placeholder: 'The way you…' },
      default: REASONS,
      hint: 'Each one is a sticky note he taps to flip. Edit ours, or write your own.' },

    /* 5 · in numbers */
    { id: 'together', type: 'date', label: 'The day it all started',
      hint: 'Optional. Shows a live “days together” counter.' },
    { id: 'stats', type: 'list', label: 'Your own numbers', itemLabel: 'Number', addLabel: 'Add a number',
      minItems: 0, maxItems: 4,
      shape: [
        { id: 'value', type: 'text', label: 'The number', required: true, maxLength: 12, placeholder: '1,284' },
        { id: 'label', type: 'text', label: 'Of what', required: true, maxLength: 40, placeholder: 'cups of chai' },
      ],
      hint: 'Messages sent, songs shared, cups of chai… Leave the date and these empty and the section is skipped.' },

    /* 6 · the gallery */
    { id: 'gallery', type: 'list', label: 'Your photos', itemLabel: 'Photo', addLabel: 'Add a photo',
      minItems: 0, maxItems: 10,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', maxLength: 90, placeholder: 'Goa, the trip we almost missed' },
      ],
      hint: 'Four to ten photos. He swipes through them full-screen. Leave this empty and the section is skipped.' },
    { id: 'songTitle', type: 'text', label: 'Your song', maxLength: 60, placeholder: 'Tum Se Hi — Mohit Chauhan' },
    { id: 'songUrl', type: 'url', label: 'A link to it', maxLength: 300, placeholder: 'https://open.spotify.com/…',
      hint: 'Optional. Spotify, YouTube or any link. It plays only when he taps it.' },

    /* 7 · the question */
    { id: 'questionLead', type: 'text', label: 'Before the question', maxLength: 60, default: 'One last thing…' },
    { id: 'question', type: 'textarea', label: 'The question', maxLength: 160, rows: 2, default: 'Will you stay my favourite person, for all the days after this one?' },
    { id: 'yesLabel', type: 'text', label: 'The button he taps', maxLength: 30, default: 'Haan, hamesha' },
    { id: 'promise', type: 'textarea', label: 'The promise it reveals', maxLength: 400, rows: 3, default: 'Then here’s mine: I’ll keep choosing you — on the good days, the boring days and the hard ones. This little world will always be yours.' },
  ],

  steps: [
    { title: 'The opening', heading: 'Who is this world for?', intro: 'It opens on a dark screen, one heartbeat, and his name.', fields: ['recipientName', 'nickname', 'senderName'] },
    { title: 'The letter', heading: 'The letter', intro: 'Sealed in an envelope with a wax heart. He tears it open and your words type themselves out.', fields: ['letterOn', 'letter', 'letterClosing'] },
    { title: 'Our story', heading: 'Your story', intro: 'A timeline of the moments that made you — dates, a line or two, and a photo if you have one.', fields: ['story'] },
    { title: 'The reasons', heading: 'Reasons I love you', intro: 'A wall of sticky notes. He taps each one to flip it.', fields: ['reasonsOn', 'reasons'] },
    { title: 'In numbers', heading: 'Us, in numbers', intro: 'Counters that tick up as he scrolls to them.', fields: ['together', 'stats'] },
    { title: 'The gallery', heading: 'The gallery', intro: 'Full-screen photos he swipes through, and your song if you like.', fields: ['gallery', 'songTitle', 'songUrl'] },
    { title: 'The question', heading: 'One last question', intro: 'The end of the journey: a question, one button, and a promise behind it.', fields: ['questionLead', 'question', 'yesLabel', 'promise'] },
  ],

  create: {
    eyebrow: 'Meri Duniya · A Whole Website, Made For You',
    headline: 'A whole website, made just for him.',
    intro: 'One private link. He opens it, his name appears, and every page after that is about the two of you — your letter, your story, the reasons, your numbers, your photos, and one last question. Seven short steps; skip any section you like and the rest close up neatly.',
    noun: 'website',
    designHeading: 'Seven sections, one journey',
    designIntro: 'Every section after the opening is optional. Leave one empty and it simply isn’t there — the numbering closes up.',
    scenes: [
      'a dark screen, one heartbeat, then “Hey Aarav, I made something for you” — with his name',
      'a sealed envelope — he tears it open and your letter types itself out',
      'your story as a timeline, with photos and dates',
      'a wall of sticky notes, each one a reason, tap to flip',
      'your numbers, counting up as he scrolls — days together, cups of chai',
      'your photos, full-screen, with your song one tap away',
      'one last question, and the promise behind the button',
    ],
    previewCta: 'Walk through it exactly as he will.',
    previewHelp: 'Tap to enter, open the envelope, and scroll all the way down.',
    resultLine: 'Send him the link. His whole world is waiting behind it.',
  },

  /** /meri-duniya/demo, the collection thumbnail and the detail page. */
  demo: {
    recipientName: 'Aarav',
    nickname: '',
    senderName: 'Riya',
    letterOn: 'show',
    letter: LETTER,
    letterClosing: 'Hamesha tumhare saath,',
    story: [
      { date: 'March 2023', title: 'Pehli chai, pehli baat', caption: 'You were twenty minutes late, and I pretended to be annoyed for exactly two of them.', photo: '' },
      { date: 'June 2023', title: 'The first long drive', caption: 'Wrong turn, right playlist. We got lost for an hour and it was the best hour of the month.', photo: '' },
      { date: 'December 2023', title: 'Meeting the family', caption: 'You brought my mother flowers and my brother a cricket bat. Both of them still ask about you.', photo: '' },
      { date: 'Today', title: 'Still my favourite person', caption: 'And somehow, a little more every day.', photo: '' },
    ],
    reasonsOn: 'show',
    reasons: REASONS,
    together: '2023-03-11',
    stats: [
      { value: '48,210', label: 'messages sent' },
      { value: '312', label: 'songs shared' },
      { value: '1,284', label: 'cups of chai' },
    ],
    gallery: [
      { photo: '', caption: 'Goa, the trip we almost missed' },
      { photo: '', caption: 'Your birthday cake disaster' },
      { photo: '', caption: 'Marine Drive at midnight' },
      { photo: '', caption: 'Us, being us' },
    ],
    songTitle: 'Tum Se Hi',
    songUrl: '',
    questionLead: 'One last thing…',
    question: 'Will you stay my favourite person, for all the days after this one?',
    yesLabel: 'Haan, hamesha',
    promise: 'Then here’s mine: I’ll keep choosing you — on the good days, the boring days and the hard ones. This little world will always be yours.',
  },

  sections: ['opening', 'letter', 'story', 'reasons', 'numbers', 'gallery', 'question'],
  theme: {
    bg: '#FBF3EC', ink: '#1C1420', accent: '#9C2A5C', soft: '#FFFAFC',
    motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic',
  },
};
