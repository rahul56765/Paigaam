'use strict';
/**
 * Occasion registry — the single source of truth for occasion discovery.
 * Used by: homepage occasion grid, /occasions index, /templates/<occasion>
 * landing pages, /templates filtering, sitemap.
 *
 * `slugs` lists template-category values (case-insensitive) that map to this
 * occasion. `aliases` are extra search terms for the template search.
 */
const OCCASIONS = [
  {
    slug: 'wedding',
    name: 'Weddings',
    title: 'Digital Wedding Invitations & Personalized Wedding Paigaams | Paigaam',
    description: 'Create beautiful personalized digital wedding invitations and experiences with Paigaam. Choose a design, personalize it and share it instantly.',
    heroLine: 'For two hearts becoming one',
    intro: 'A wedding invitation that feels like the day itself. Choose a design, add your names, date and venue, and share a link your guests will remember.',
    slugs: ['wedding', 'weddings'],
    aliases: ['shaadi', 'vivah', 'marriage', 'bride', 'groom'],
  },
  {
    slug: 'birthday',
    name: 'Birthdays',
    title: 'Digital Birthday Cards, Letters & Experiences | Paigaam',
    description: 'Make their day unforgettable with a personalized digital birthday card or letter from Paigaam. Choose a design, add your message and share it instantly.',
    heroLine: 'Make their day a little more unforgettable',
    intro: 'From quiet letters to celebration pages — birthday Paigaams carry your wishes in a form they will keep long after the candles are out.',
    slugs: ['birthday', 'birthdays'],
    aliases: ['birthday letter', 'bday', 'happy birthday', 'cake'],
  },
  {
    slug: 'anniversary',
    name: 'Anniversaries',
    title: 'Digital Anniversary Cards & Keepsakes | Paigaam',
    description: 'Celebrate the years with a personalized digital anniversary keepsake from Paigaam. Two names, one story — shared as a beautiful link.',
    heroLine: 'For memories worth celebrating',
    intro: 'Mark the years with something quieter and more lasting than a forwarded card — a keepsake made of the two of you.',
    slugs: ['anniversary', 'anniversaries'],
    aliases: ['anniversary letter', 'years together'],
  },
  {
    slug: 'proposal',
    name: 'Proposals',
    title: 'Digital Proposal & Will-You-Be-Mine Experiences | Paigaam',
    description: 'Ask the question with a personalized digital proposal from Paigaam. Interactive, playful and made to be answered with a smile.',
    heroLine: 'Ask the question, beautifully',
    intro: 'Games, letters and little experiences that end in one word. Pop the question in a way they will replay for years.',
    slugs: ['proposal', 'proposals', 'love', 'romance'],
    aliases: ['will you be mine', 'ask out', 'propose', 'crush', 'yes or no'],
  },
  {
    slug: 'festival',
    name: 'Festivals',
    title: 'Digital Festival Greetings — Ganpati, Diwali & More | Paigaam',
    description: 'Send beautiful personalized festival greetings — Ganpati, Diwali and more — made in minutes and shared instantly on WhatsApp.',
    heroLine: 'Share the joy of the season',
    intro: 'Festival greetings with your family\'s name on them. Cinematic, warm and ready for the family WhatsApp group.',
    slugs: ['festival', 'festivals', 'ganpati', 'ganesh', 'diwali'],
    aliases: ['ganpati', 'ganesh chaturthi', 'diwali', 'aagman', 'bappa'],
  },
  {
    slug: 'baby',
    name: 'Baby',
    title: 'Digital Baby Announcements & Naming Invitations | Paigaam',
    description: 'Announce a beautiful new beginning with a personalized digital baby announcement or naming ceremony invitation from Paigaam.',
    heroLine: 'For a beautiful new beginning',
    intro: 'Welcome the newest member of the family with an announcement as soft and warm as the moment itself.',
    slugs: ['baby', 'newborn', 'naming'],
    aliases: ['baby shower', 'newborn', 'naming ceremony'],
  },
  {
    slug: 'personal',
    name: 'Just Because',
    title: 'Personal Digital Letters, Apologies & Surprises | Paigaam',
    description: 'Sometimes a message deserves more than a text. Send a personal digital letter, apology, quiz or surprise with Paigaam.',
    heroLine: 'Because some Paigaams need no occasion',
    intro: 'Apologies, letters, quizzes and little surprises for no reason at all — the moments that need no occasion, only feeling.',
    slugs: ['personal', 'apology', 'gift', 'friendship', 'quiz', 'letter', 'surprise'],
    aliases: ['sorry', 'apology', 'gift', 'just because', 'letter', 'surprise', 'quiz', 'friendship day'],
  },
];

const bySlug = Object.fromEntries(OCCASIONS.map(o => [o.slug, o]));

/** Map a template category (any case) to an occasion, or null. */
function occasionForCategory(category) {
  const c = String(category || '').toLowerCase();
  for (const o of OCCASIONS) if (o.slugs.includes(c)) return o;
  return null;
}

module.exports = { OCCASIONS, bySlug, occasionForCategory };
