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
const photos = (rows) => rows.map(([key, label, hint, frameAspect = 1]) => ({ key, canvaName: key, type: 'image', label, hint, frameAspect, required: true }));

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
      ['photo_1', 'Photo 1', 'Heart frame, top-left', 1.1], ['photo_2', 'Photo 2', 'Top-middle', 0.8],
      ['photo_3', 'Photo 3', 'Top-right', 0.8], ['photo_4', 'Photo 4', 'Left side', 0.8],
      ['photo_5', 'Photo 5', 'Right circle', 0.9], ['photo_6', 'Photo 6', 'Bottom-left circle', 1],
      ['photo_7', 'Photo 7', 'Large, bottom-centre', 0.9], ['photo_8', 'Photo 8', 'Bottom-left corner', 1.1],
      ['photo_9', 'Photo 9', 'Bottom-right', 0.9],
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
      ['photo_1', 'Page 1 · Polaroid', 'Birthday cover, upper photo', 0.95],
      ['photo_2', 'Page 1 · Polaroid', 'Birthday cover, middle-left photo', 1.25],
      ['photo_3', 'Page 1 · Polaroid', 'Birthday cover, lower-left photo', 1.15],
      ['photo_4', 'Page 1 · Film strip', 'Birthday cover, film frame 1', 0.95],
      ['photo_5', 'Page 1 · Film strip', 'Birthday cover, film frame 2', 0.95],
      ['photo_6', 'Page 1 · Film strip', 'Birthday cover, film frame 3', 0.95],
      ['photo_7', 'Page 1 · Camera screen', 'Birthday cover, camera screen', 1.55],
      ['photo_8', 'Page 2 · Film strip', '“Tu Chaiye”, film frame 1', 1.25],
      ['photo_9', 'Page 2 · Film strip', '“Tu Chaiye”, film frame 2', 1.25],
      ['photo_10', 'Page 2 · Film strip', '“Tu Chaiye”, film frame 3', 1.25],
      ['photo_11', 'Page 2 · Camera screen', '“Tu Chaiye”, camera screen', 1.55],
      ['photo_12', 'Page 4 · Photo', 'Chat collage, upper-right photo', 1.2],
      ['photo_13', 'Page 4 · Photo', 'Chat collage, lower-left photo', 1.05],
      ['photo_14', 'Page 5 · Camera screen', '“Favorite person”, camera screen', 1.55],
      ['photo_15', 'Page 6 · Film strip', 'Memory collage, film frame 1', 1.1],
      ['photo_16', 'Page 6 · Film strip', 'Memory collage, film frame 2', 1.1],
      ['photo_17', 'Page 6 · Film strip', 'Memory collage, film frame 3', 1.1],
      ['photo_18', 'Page 6 · Polaroid', 'Memory collage, large polaroid', 1.1],
      ['photo_19', 'Page 6 · Camera screen', 'Memory collage, camera screen', 1.55],
    ]),
    limits: IMAGE_LIMITS,
  },
  {
    slug: 'little-love-story',
    name: 'A Little Love Story',
    tagline: 'A 12-page photo book for the moments you share.',
    canvaTemplateId: 'EAHXm76f8Ik',
    pageCount: 12,
    fields: [],
    images: photos(Array.from({ length: 12 }, (_, index) => {
      const n = index + 1;
      return [`photo_${n}`, `Photo ${n}`, `Page ${n} photo`, 1.2];
    })).map((slot, index) => ({ ...slot, canvaName: `Photo_${index + 1}` })),
    limits: IMAGE_LIMITS,
    adminManaged: true,
  },
];

const bySlug = (slug) => MAGAZINES.find(m => m.slug === slug) || null;
module.exports = { MAGAZINES, bySlug, IMAGE_LIMITS };
