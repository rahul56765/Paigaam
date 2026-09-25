'use strict';
/**
 * TEST-ONLY Boyfriend Day family member. Loaded only when
 * BFDAY_TEST_FIXTURE=1 (scripts/test-bfday.js sets it), so every field type
 * the engine supports — text, textarea, number, url, select, image, scalar
 * lists and object lists with photos — is exercised end to end before any
 * real template uses it. Never registered in templates/bfday.js.
 */
module.exports = {
  slug: 'bfday-fixture',
  family: 'bfday',
  name: 'Engine Fixture',
  category: 'Love',
  price: 0,
  currency: 'INR',
  description: 'Test fixture for the Boyfriend Day engine.',
  thumbnail_url: '',
  version: 1,
  editable: true,
  displayField: 'toName',
  fields: [
    { id: 'toName', type: 'text', label: 'Their name', required: true, maxLength: 30, placeholder: 'Arjun' },
    { id: 'note', type: 'textarea', label: 'A note', maxLength: 300, default: 'Default note.' },
    { id: 'days', type: 'number', label: 'Days together', min: 1, max: 99999, default: 365 },
    { id: 'song', type: 'url', label: 'Our song', maxLength: 200 },
    { id: 'mood', type: 'select', label: 'Mood', options: [{ value: 'soft', label: 'Soft' }, { value: 'loud', label: 'Loud' }], default: 'soft' },
    { id: 'cover', type: 'image', label: 'Cover photo' },
    { id: 'reasons', type: 'list', label: 'Reasons', itemLabel: 'Reason', minItems: 2, maxItems: 5,
      item: { type: 'text', maxLength: 80 }, default: ['default reason one', 'default reason two'] },
    { id: 'moments', type: 'list', label: 'Moments', itemLabel: 'Moment', minItems: 0, maxItems: 3,
      shape: [
        { id: 'photo', type: 'image', label: 'Photo' },
        { id: 'caption', type: 'text', label: 'Caption', required: true, maxLength: 60 },
        { id: 'when', type: 'text', label: 'When', maxLength: 40, default: 'someday' },
      ],
      default: [{ caption: 'default moment' }] },
  ],
  steps: [
    { title: 'People', fields: ['toName', 'note', 'days'] },
    { title: 'Things', fields: ['song', 'mood', 'cover', 'reasons', 'moments'] },
  ],
  create: { headline: 'Fixture', intro: 'Fixture intro.' },
  demo: { toName: 'Arjun' },
  sections: [],
  theme: { bg: '#FBF3E4', ink: '#2B2118', accent: '#B85C48', soft: '#EADCC0', motif: 'heart', ampersand: false, serifCase: 'title', layout: 'cinematic' },
};
