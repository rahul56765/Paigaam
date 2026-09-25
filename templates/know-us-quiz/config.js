'use strict';
/**
 * Pehchaan — How Well Do You Know Us? (Boyfriend Day family, template 6.)
 *
 * "Pehchaan" (पहचान / پہچان) means recognition or knowing — the same root
 * as "identify". Chosen because the whole quiz is about how well two people
 * know each other.
 *
 * The experience: an opening card with the sender's name and a Start button.
 * Then one question at a time with a film-strip progress bar along the top.
 * After tapping an answer the card flips (3D) to reveal the verdict, a little
 * story, and a gradient photo placeholder captioned by the sender. A final
 * score ring shows the result with a message in the sender's words.
 *
 * Fonts: Fraunces + Caveat (Google Fonts). Zero external images — all photo
 * placeholders are inline SVG gradients. Reduced motion: animations collapse
 * to instant cuts.
 *
 * Editable: sender name, intro subtitle, 1–8 questions (each with four answer
 * options, the correct answer, a reveal story and a moment caption), four score
 * band messages, and the screenshot call-to-action.
 */

const QUESTIONS = [
  {
    q: "what's the first thing i said to you, word for word?",
    a1: '“you look like trouble”',
    a2: '“have we met before?”',
    a3: '“is this seat taken?”',
    a4: '“nice socks”',
    correct: '1',
    story: "you pretended to be calm but you rechecked your hair twice in the window reflection.",
    caption: "that tuesday, 6:42 pm",
  },
  {
    q: "which song do i always but always get wrong?",
    a1: "the one about the rain",
    a2: "that song from the long drive",
    a3: "the kitchen dancing song",
    a4: "anything by that one band",
    correct: '2',
    story: "i have confidently sung the wrong lyrics 31 times. you’ve corrected me 31 times. i remain loyal to my version.",
    caption: "window seat, vol. 4",
  },
  {
    q: "what is my emergency comfort food?",
    a1: "maggi at 11 pm",
    a2: "your mum’s khichdi",
    a3: "double aloo tikki, extra chutney",
    a4: "cold pizza, obviously",
    correct: '3',
    story: "the aunty at the cart knows my order, my name, and now yours too. we’re a package deal.",
    caption: "our spot, stall #3",
  },
  {
    q: "when i say “i’m five minutes away”, how late am i actually?",
    a1: "five minutes, i’m honest",
    a2: "12 minutes, give or take",
    a3: "22 minutes. every time.",
    a4: "i’m the early one",
    correct: '3',
    story: "you’ve started lying back — telling me things are 20 minutes earlier than they are. we have a whole timezone.",
    caption: "my five minutes",
  },
  {
    q: "what did i say i’d name a pet someday?",
    a1: "momo",
    a2: "sir chonkington III",
    a3: "gulab (like jamun)",
    a4: "wifi",
    correct: '3',
    story: "you said no, then immediately suggested “paigam” for a parrot. we’re getting the parrot.",
    caption: "future family member",
  },
];

module.exports = {
  slug: 'know-us-quiz',
  family: 'bfday',
  name: 'Pehchaan',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'How Well Do You Know Us? — a film-strip quiz with a 3D flip reveal after every answer and a score ring at the end. Made for them to screenshot.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  displayField: 'senderName',

  fields: [
    {
      id: 'senderName',
      type: 'text',
      label: 'Your name',
      required: true,
      maxLength: 40,
      placeholder: 'your favourite person',
      hint: 'Shown on the opening card and in the page title.',
    },
    {
      id: 'introLine',
      type: 'text',
      label: 'Subtitle under your name',
      maxLength: 80,
      default: 'no pressure — (some pressure)',
      hint: 'The small note below your name on the opening card, after the question count.',
    },
    {
      id: 'questions',
      type: 'list',
      label: 'The questions',
      itemLabel: 'Question',
      addLabel: 'Add a question',
      minItems: 1,
      maxItems: 8,
      shape: [
        { id: 'q',       type: 'text',     label: 'The question',   required: true, maxLength: 180 },
        { id: 'a1',      type: 'text',     label: 'Option 1',       required: true, maxLength: 100 },
        { id: 'a2',      type: 'text',     label: 'Option 2',       required: true, maxLength: 100 },
        { id: 'a3',      type: 'text',     label: 'Option 3',       required: true, maxLength: 100 },
        { id: 'a4',      type: 'text',     label: 'Option 4',       required: true, maxLength: 100 },
        {
          id: 'correct', type: 'select',   label: 'Correct option',
          options: [
            { value: '1', label: 'Option 1' },
            { value: '2', label: 'Option 2' },
            { value: '3', label: 'Option 3' },
            { value: '4', label: 'Option 4' },
          ],
          default: '1',
        },
        { id: 'story',   type: 'textarea', label: 'The reveal story', maxLength: 400, rows: 3,
          placeholder: 'The little moment behind the answer…' },
        { id: 'caption', type: 'text',     label: 'Moment caption',   maxLength: 60,
          placeholder: 'a moment in time' },
      ],
      default: QUESTIONS,
    },
    {
      id: 'bandZero',
      type: 'text',
      label: 'Score message: 0 correct',
      maxLength: 80,
      default: 'certified: here for the snacks',
    },
    {
      id: 'bandLow',
      type: 'text',
      label: 'Score message: getting there',
      maxLength: 80,
      default: 'certified: very good, occasionally lucky',
      hint: 'Shown when they get between 1 and half the questions correct.',
    },
    {
      id: 'bandHigh',
      type: 'text',
      label: 'Score message: most correct',
      maxLength: 80,
      default: 'certified: knows me better than i admit',
      hint: 'Shown when they get more than half but not all correct.',
    },
    {
      id: 'bandPerfect',
      type: 'text',
      label: 'Score message: all correct',
      maxLength: 80,
      default: 'certified: knows me better than i know myself',
    },
    {
      id: 'screenshotCta',
      type: 'text',
      label: 'Screenshot call-to-action',
      maxLength: 80,
      default: 'screenshot this & send it to me 📸',
      hint: 'Shown on the score card. The & will render correctly.',
    },
  ],

  steps: [
    {
      title: 'Who it’s from',
      heading: 'Who is it from?',
      intro: 'Your name goes on the opening card and in the page title they see before they tap Start.',
      fields: ['senderName', 'introLine'],
    },
    {
      title: 'The questions',
      heading: 'The questions',
      intro: 'Edit our defaults or write your own. Every question needs four options and the right answer. The story appears on the flip-reveal after they pick.',
      fields: ['questions'],
    },
    {
      title: 'The score',
      heading: 'Score messages',
      intro: 'Four short labels for the verdict card — from zero to perfect. Keep them short and in your voice.',
      fields: ['bandZero', 'bandLow', 'bandHigh', 'bandPerfect', 'screenshotCta'],
    },
  ],

  create: {
    eyebrow: 'Pehchaan · How Well Do You Know Us?',
    headline: 'A quiz, just for the two of you.',
    intro: 'Questions about you — your first words, your comfort food, your five-minute problem. They pick answers, a card flips to reveal the truth (and a little story), and a score ring tells them the verdict. Three steps, one required field, defaults they can keep or customise.',
    noun: 'quiz',
    designHeading: 'One quiz, five reveals, one score',
    designIntro: 'It opens with your name and a Start button. Then one question at a time, with a film-strip progress bar.',
    scenes: [
      'the opening card with your name and a Start button',
      'each question on its own card with a film-strip progress bar at the top',
      'a 3D flip reveal after every answer — verdict, story, and a gradient moment',
      'the score ring at the end, with a message in your own words',
    ],
    previewCta: 'Take it exactly as they will.',
    previewHelp: 'Tap through the quiz — pick any answer to see the flip reveal.',
    resultLine: 'Send them the link. The quiz is waiting.',
  },

  demo: {
    bgmSong: 'kPa7bsKwL-c',
    senderName: 'Priya',
    questions: QUESTIONS,
  },

  sections: ['intro', 'quiz', 'reveal', 'score'],
  theme: {
    bg: '#FFFDF8',
    ink: '#2B2118',
    accent: '#6F8163',
    soft: '#DDE8D5',
    motif: 'heart',
    ampersand: false,
    serifCase: 'lower',
    layout: 'cinematic',
  },
};
