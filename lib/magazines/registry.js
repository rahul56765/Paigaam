'use strict';
/**
 * Magazine catalogue: Paigaam slug -> Canva Brand Template mapping.
 *
 * Canva dataset field names (canvaName) and types MUST match the live Brand Template's
 * dataset; admin "Validate" compares them and blocks publishing on any mismatch.
 *
 * PROVISIONAL values (not dictated by Canva — product decisions to confirm per design):
 *   fields[].maxLength, limits.maxImageBytes, limits.minImageSide.
 */
const IMAGE_LIMITS = { maxImageBytes: 8 * 1024 * 1024, minImageSide: 400, mimes: ['image/jpeg', 'image/png', 'image/webp'] };

const MAGAZINES = [
  {
    slug: 'birthday-collage',
    name: 'Birthday Collage Poster',
    tagline: 'A torn-paper scrapbook collage of your favourite birthday photos.',
    canvaTemplateId: 'EAHXVxrdrCk',
    pageCount: 1,
    fields: [
      { key: 'headline', canvaName: 'headline', type: 'text', label: 'Headline', required: false,
        maxLength: 24, defaultValue: 'HAPPY BIRTHDAY', help: 'Leave blank to keep “HAPPY BIRTHDAY”.' },
    ],
    images: [
      ['photo_1', 'Photo 1', 'Heart frame, top-left'],
      ['photo_2', 'Photo 2', 'Top-middle'],
      ['photo_3', 'Photo 3', 'Top-right'],
      ['photo_4', 'Photo 4', 'Left side'],
      ['photo_5', 'Photo 5', 'Right circle'],
      ['photo_6', 'Photo 6', 'Bottom-left circle'],
      ['photo_7', 'Photo 7', 'Large, bottom-centre'],
      ['photo_8', 'Photo 8', 'Bottom-left corner'],
      ['photo_9', 'Photo 9', 'Bottom-right'],
    ].map(([key, label, hint]) => ({ key, canvaName: key, type: 'image', label, hint, required: true })),
    limits: IMAGE_LIMITS,
  },
];

const bySlug = (slug) => MAGAZINES.find(m => m.slug === slug) || null;
module.exports = { MAGAZINES, bySlug, IMAGE_LIMITS };
