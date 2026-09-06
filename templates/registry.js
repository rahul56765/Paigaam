'use strict';
/**
 * Paigaam template registry.
 *
 * A TEMPLATE is a reusable design: fields (personalization form schema),
 * sections (rendered page structure), theme (palette/typography/motif).
 * A PAIGAAM is a personalized instance: template + customer_data.
 *
 * Adding Template #4 = append one object to TEMPLATES and (optionally)
 * add a themed CSS block. No route or flow changes required.
 */

const NOOR_FIELDS = [
  { id: 'brideName',  label: "Bride's name",  type: 'text', required: true,  placeholder: 'Ayesha', group: 'people' },
  { id: 'groomName',  label: "Groom's name",  type: 'text', required: true,  placeholder: 'Zoya’s beloved — e.g. Imran', group: 'people' },
  { id: 'eventDate',  label: 'Wedding date',  type: 'date', required: true, group: 'occasion' },
  { id: 'eventTime',  label: 'Time',          type: 'time', required: false, group: 'occasion' },
  { id: 'venue',      label: 'Venue',         type: 'text', required: true,  placeholder: 'The Roseate, New Delhi', group: 'occasion' },
  { id: 'address',    label: 'Address',       type: 'text', required: false, placeholder: 'Street, city', group: 'occasion' },
  { id: 'message',    label: 'Your message',  type: 'textarea', required: false, placeholder: 'Together with their families, we invite you to celebrate…', group: 'message' },
  { id: 'photo',      label: 'A photograph (optional)', type: 'image', required: false, group: 'photos' },
];

const MEHER_FIELDS = [
  { id: 'personName', label: "Celebrant's name", type: 'text', required: true, placeholder: 'Meher', group: 'people' },
  { id: 'age',        label: 'Turning',          type: 'number', required: false, placeholder: '30', group: 'people' },
  { id: 'eventDate',  label: 'Date of celebration', type: 'date', required: true, group: 'occasion' },
  { id: 'eventTime',  label: 'Time',             type: 'time', required: false, group: 'occasion' },
  { id: 'venue',      label: 'Venue',            type: 'text', required: false, placeholder: 'Home, or somewhere beautiful', group: 'occasion' },
  { id: 'message',    label: 'Your message',     type: 'textarea', required: false, placeholder: 'Come raise a toast…', group: 'message' },
  { id: 'photo',      label: 'A photograph (optional)', type: 'image', required: false, group: 'photos' },
];

const AASHI_FIELDS = [
  { id: 'partnerOne', label: 'Your name',        type: 'text', required: true, placeholder: 'Aashi', group: 'people' },
  { id: 'partnerTwo', label: "Partner's name",   type: 'text', required: true, placeholder: 'Raghav', group: 'people' },
  { id: 'years',      label: 'Years together',   type: 'number', required: false, placeholder: '10', group: 'people' },
  { id: 'eventDate',  label: 'Anniversary date', type: 'date', required: true, group: 'occasion' },
  { id: 'message',    label: 'A note for them',  type: 'textarea', required: false, placeholder: 'Ten years, and still my favourite hello…', group: 'message' },
  { id: 'photo',      label: 'A photograph (optional)', type: 'image', required: false, group: 'photos' },
];

const GROUPS = [
  { id: 'people',   step: '01', title: 'The people' },
  { id: 'occasion', step: '02', title: 'The occasion' },
  { id: 'message',  step: '03', title: 'Your message' },
  { id: 'photos',   step: '04', title: 'A photograph' },
];

const TEMPLATES = [
  require('./lavender-bloom/config'),
  require('./ganpati-courtyard/config'),
  require('./saalgirah/config'),
  require('./ganapati-aagman/config'),
  {
    slug: 'noor',
    name: 'Noor',
    category: 'Wedding',
    description: 'An elegant celebration of two people becoming one — ivory silk, burgundy ink, and a single dove in flight.',
    price: 499,
    currency: 'INR',
    fields: NOOR_FIELDS,
    sections: ['hero', 'message', 'details', 'photo', 'countdown', 'closing'],
    theme: {
      bg: '#FBF4ED', ink: '#3B2420', accent: '#8F1018', soft: '#EFE3D6',
      motif: 'dove', ampersand: true, serifCase: 'uppercase', layout: 'editorial',
    },
  },
  {
    slug: 'meher',
    name: 'Meher',
    category: 'Birthday',
    description: 'A warm, romantic birthday greeting — soft blush, hand-lettered wishes, and candlelight in motion.',
    price: 349,
    currency: 'INR',
    fields: MEHER_FIELDS,
    sections: ['hero', 'message', 'details', 'photo', 'countdown', 'closing'],
    theme: {
      bg: '#F9EFE8', ink: '#4A2A28', accent: '#B0474B', soft: '#F3E0D8',
      motif: 'flame', ampersand: false, serifCase: 'title', layout: 'centered',
    },
  },
  {
    slug: 'aashi',
    name: 'Aashi',
    category: 'Anniversary',
    description: 'A minimal, intimate anniversary keepsake — two names, one line of years, and room for a quiet photograph.',
    price: 0,   // free → customers self-publish and get their link + QR instantly
    currency: 'INR',
    fields: AASHI_FIELDS,
    sections: ['hero', 'message', 'years', 'photo', 'closing'],
    theme: {
      bg: '#F7F1EA', ink: '#2E2622', accent: '#7A3E2F', soft: '#EAE0D4',
      motif: 'ring', ampersand: true, serifCase: 'title', layout: 'minimal',
    },
  },
  {
    slug: 'apology',
    name: 'Khaat',           // "khaat" — a letter/note; the apology arrives like a folded letter
    category: 'Personal',
    description: 'Some things deserve more than a text. A small interactive apology, folded like a letter — ten gentle scenes that mend a torn heart.',
    price: 299,
    currency: 'INR',
    // Custom template: an external webapp rendered full-screen. Uneditable — no fields.
    custom: true,
    editable: false,
    appPath: '/experiences/apology/',   // static bundle served from public/experiences/apology/
    fields: [],                          // fully fixed — nothing to personalize
    sections: [],
    theme: {
      bg: '#F7F1E6', ink: '#3B2E26', accent: '#8F1018', soft: '#EFE7D7',
      motif: 'dove', ampersand: false, serifCase: 'title', layout: 'custom',
    },
  },
];

function getTemplateConfig(slug) {
  return TEMPLATES.find(t => t.slug === slug) || null;
}

/** Group a template's fields into form steps. */
function fieldGroups(template) {
  return GROUPS
    .map(g => ({ ...g, fields: template.fields.filter(f => f.group === g.id) }))
    .filter(g => g.fields.length > 0);
}

/** Display helpers used across renderers. */
function displayNames(tplSlug, data) {
  const d = data || {};
  if (tplSlug === 'ganpati-courtyard') return [d.familyName || 'Your family'];
  if (tplSlug === 'ganapati-aagman') return [d.familyName || 'Your family'];
  if (tplSlug === 'lavender-tic-tac-toe-bloom') return [d.recipientName || 'You'];
  if (tplSlug === 'saalgirah') return [d.recipientName || 'You'];
  if (tplSlug === 'noor')  return [d.brideName || 'The Bride', d.groomName || 'The Groom'];
  if (tplSlug === 'meher') return [d.personName || 'Someone lovely'];
  if (tplSlug === 'aashi') return [d.partnerOne || 'You', d.partnerTwo || 'Yours'];
  return [d.name || 'You'];
}

function displayDate(iso) {
  if (!iso) return '';
  const dt = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(dt)) return iso;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

module.exports = { TEMPLATES, GROUPS, getTemplateConfig, fieldGroups, displayNames, displayDate };
