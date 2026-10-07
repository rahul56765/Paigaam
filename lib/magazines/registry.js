'use strict';
/**
 * Magazine catalogue: Paigaam slug -> Canva Brand Template mapping.
 * Canva dataset field names and types must match exactly; admin validation compares
 * every dataset entry before a template may be published.
 *
 * Image/text limits are Paigaam UI policy, not asserted Canva constraints. Per-design
 * values should be adjusted after reviewing the actual artwork and smoke testing.
 */
const IMAGE_LIMITS = { maxImageBytes: 8 * 1024 * 1024, minImageSide: 400, mimes: ['image/jpeg', 'image/png', 'image/webp'] };
const photos = (rows) => rows.map(([key, label, hint]) => ({ key, canvaName: key, type: 'image', label, hint, required: true }));

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
    images: photos([
      ['photo_1', 'Photo 1', 'Heart frame, top-left'], ['photo_2', 'Photo 2', 'Top-middle'],
      ['photo_3', 'Photo 3', 'Top-right'], ['photo_4', 'Photo 4', 'Left side'],
      ['photo_5', 'Photo 5', 'Right circle'], ['photo_6', 'Photo 6', 'Bottom-left circle'],
      ['photo_7', 'Photo 7', 'Large, bottom-centre'], ['photo_8', 'Photo 8', 'Bottom-left corner'],
      ['photo_9', 'Photo 9', 'Bottom-right'],
    ]),
    limits: IMAGE_LIMITS,
  },
  {
    slug: 'birthday-story',
    name: 'Birthday Story',
    tagline: 'A seven-page photo story for their birthday, with your wish and letters.',
    canvaTemplateId: 'EAHXVwHhiXs',
    pageCount: 7,
    fields: [
      {
        key: 'wish', type: 'text', label: 'Birthday wish', required: false, maxLength: 90,
        canvaNames: ['wish_line_1', 'wish_line_2', 'wish_line_3'], segmentMaxLength: 32,
        defaultValue: 'I hope this year brings growth, happiness, and everything your heart wishes for.',
        help: 'Optional. We’ll wrap your wish across the three lines on page 1 (up to 90 characters).',
      },
      {
        key: 'letter_page3', canvaName: 'letter_page3', type: 'text', label: 'Love letter (page 3)',
        required: true, maxLength: 450, multiline: true,
        help: 'Replace the sample letter with your own. Up to 450 characters.',
      },
      {
        key: 'letter_page7', canvaName: 'letter_page7', type: 'text', label: 'Love letter (page 7)',
        required: true, maxLength: 900, multiline: true,
        help: 'Replace the sample letter with your own. Up to 900 characters.',
      },
    ],
    images: photos([
      ['photo_1', 'Page 1 · Polaroid', 'Birthday cover, upper photo'],
      ['photo_2', 'Page 1 · Polaroid', 'Birthday cover, middle-left photo'],
      ['photo_3', 'Page 1 · Polaroid', 'Birthday cover, lower-left photo'],
      ['photo_4', 'Page 1 · Film strip', 'Birthday cover, film frame 1'],
      ['photo_5', 'Page 1 · Film strip', 'Birthday cover, film frame 2'],
      ['photo_6', 'Page 1 · Film strip', 'Birthday cover, film frame 3'],
      ['photo_7', 'Page 1 · Camera screen', 'Birthday cover, camera screen'],
      ['photo_8', 'Page 2 · Film strip', '“Tu Chaiye”, film frame 1'],
      ['photo_9', 'Page 2 · Film strip', '“Tu Chaiye”, film frame 2'],
      ['photo_10', 'Page 2 · Film strip', '“Tu Chaiye”, film frame 3'],
      ['photo_11', 'Page 2 · Camera screen', '“Tu Chaiye”, camera screen'],
      ['photo_12', 'Page 4 · Photo', 'Chat collage, upper-right photo'],
      ['photo_13', 'Page 4 · Photo', 'Chat collage, lower-left photo'],
      ['photo_14', 'Page 5 · Camera screen', '“Favorite person”, camera screen'],
      ['photo_15', 'Page 6 · Film strip', 'Memory collage, film frame 1'],
      ['photo_16', 'Page 6 · Film strip', 'Memory collage, film frame 2'],
      ['photo_17', 'Page 6 · Film strip', 'Memory collage, film frame 3'],
      ['photo_18', 'Page 6 · Polaroid', 'Memory collage, large polaroid'],
      ['photo_19', 'Page 6 · Camera screen', 'Memory collage, camera screen'],
    ]),
    limits: IMAGE_LIMITS,
  },
];

const bySlug = (slug) => MAGAZINES.find(m => m.slug === slug) || null;
module.exports = { MAGAZINES, bySlug, IMAGE_LIMITS };
