// Theme library for event cards. Every preset keeps the reference's structure:
// watercolour backdrop, perforated stamp with the rose block-print band, a date
// written inside the stamp, a prop group overlapping the stamp's lower-right edge,
// optional ornaments above/inside the stamp, and a centred text block below.
//
// Layout units are px on the 1080x1920 canvas. Prop boxes are relative to the
// canvas, positioned around the stamp (STAMP box below).

export const STAMP = { x: 337, y: 470, w: 450, h: 705 };

const P = (src, x, y, w, extra = {}) => ({ src, x, y, w, ...extra });

export const THEMES = {
  haldi: {
    label: 'Haldi (turmeric yellow)',
    bg: 'art/bg_yellow.jpg',
    edge: '#7d8a4a',
    date: '#7d8a4a',
    title: '#6e5a1e',
    sub: '#6e5a1e',
    body: '#5f4c17',
    inner: [P('art/flower.webp', 0, 0, 0, { hidden: true })],
    sun: { x: 690, y: 595, r: 56, color: '#f6b54a' },
    props: [P('art/haldi_props.webp', 545, 815, 470, { focus: [0.2, 0.62] })],
    deco: [P('art/banana.webp', 760, -120, 420, { sway: true, origin: '50% 100%' })],
    icon: 'art/icon_marigold.webp',
  },
  sangeet: {
    label: 'Sangeet (navy night)',
    bg: 'art/bg_navy.jpg',
    edge: '#7a9ad8',
    date: '#4767b5',
    title: '#c9d4f2',
    sub: '#c9d4f2',
    body: '#e8ecf8',
    sun: null,
    innerOrnament: P('art/discoball.webp', 650, 500, 120, { spin: true }),
    props: [P('art/gramophone.webp', 660, 880, 360, { focus: [0.32, 0.3] })],
    deco: [P('art/clouds.webp', 280, 300, 640, { drift: true })],
    stars: true,
    icon: 'art/icon_dragonfly.webp',
  },
  mayra: {
    label: 'Mayra / Bhaat (peach)',
    bg: 'art/bg_peach.jpg',
    edge: '#e48e8e',
    date: '#c95f62',
    title: '#b6474e',
    sub: '#b6474e',
    body: '#a8484e',
    innerOrnament: P('art/bells.webp', 640, 470, 120, { swing: true, origin: '50% 0%' }),
    props: [P('art/mayra_props.webp', 560, 800, 460, { focus: [0.3, 0.2] })],
    deco: [],
    icon: 'art/icon_marigold.webp',
  },
  baraat: {
    label: 'Baraat / Wedding (maroon & gold)',
    bg: 'art/bg_maroon_stars.jpg',
    edge: '#d4a33b',
    date: '#c9952b',
    title: '#d8ad55',
    sub: '#e9cf9a',
    body: '#f1dfb8',
    innerOrnament: P('art/bells.webp', 640, 470, 120, { swing: true, origin: '50% 0%' }),
    props: [P('art/elephant.webp', 660, 900, 360), P('art/icon_stars.webp', 600, 1110, 140)],
    deco: [P('art/jasmine.webp', -30, -40, 520, { sway: true, origin: '0% 0%' })],
    icon: 'art/icon_stars.webp',
  },
  varmala: {
    label: 'Varmala / Jaimala (rose blush)',
    bg: 'art/bg_rose.jpg',
    edge: '#d97a8c',
    date: '#c05a6e',
    title: '#a83c55',
    sub: '#a83c55',
    body: '#94404f',
    innerOrnament: P('art/icon_chrysanthemum.webp', 660, 500, 100),
    props: [P('art/varmala_props.webp', 640, 800, 360)],
    deco: [],
    icon: 'art/icon_chrysanthemum.webp',
  },
  pheras: {
    label: 'Pheras (saffron fire)',
    bg: 'art/bg_saffron.jpg',
    edge: '#d9792b',
    date: '#c0601c',
    title: '#8c3a12',
    sub: '#8c3a12',
    body: '#7a3210',
    innerOrnament: P('art/icon_diya.webp', 655, 505, 110),
    props: [P('art/pheras_props.webp', 590, 900, 430)],
    deco: [],
    icon: 'art/icon_diya.webp',
  },
  reception: {
    label: 'Reception (teal & gold)',
    bg: 'art/bg_teal.jpg',
    edge: '#c9a55a',
    date: '#3f7468',
    title: '#efe0b8',
    sub: '#efe0b8',
    body: '#f5ecd6',
    innerOrnament: P('art/icon_stars.webp', 650, 500, 110),
    props: [P('art/reception_props.webp', 680, 760, 300)],
    deco: [],
    stars: true,
    icon: 'art/icon_stars.webp',
  },
  cocktail: {
    label: 'Cocktail (emerald)',
    bg: 'art/bg_emerald.jpg',
    edge: '#b9c98a',
    date: '#3f6b4a',
    title: '#e9efd6',
    sub: '#e9efd6',
    body: '#f2f5e6',
    innerOrnament: P('art/icon_stars.webp', 650, 500, 110),
    props: [P('art/cocktail_props.webp', 600, 880, 420)],
    deco: [],
    icon: 'art/icon_stars.webp',
  },
};

// Event presets -> default title, tagline and theme. Combined titles are free text.
export const PRESETS = {
  haldi: { title: 'Haldi', tagline: 'Rang Chadeya Sajna Te', theme: 'haldi' },
  mehendi: { title: 'Mehendi', tagline: 'Mehendi Hai Rachne Wali', theme: 'haldi' },
  sangeet: { title: 'Sangeet', tagline: 'Nach De Ne Saare', theme: 'sangeet' },
  cocktail: { title: 'Cocktail', tagline: 'Cheers to Forever', theme: 'cocktail' },
  engagement: { title: 'Engagement', tagline: 'A Ring, A Promise', theme: 'sangeet' },
  tilak: { title: 'Tilak', tagline: 'Shubh Aarambh', theme: 'pheras' },
  mayra: { title: 'Mayra', tagline: 'Bhaat Bharan Ne Aayo', theme: 'mayra' },
  baraat: { title: 'Baraat', tagline: 'Taaron Ki Baraat', theme: 'baraat' },
  varmala: { title: 'Varmala', tagline: 'Do Dil, Ek Mala', theme: 'varmala' },
  pheras: { title: 'Pheras', tagline: 'Saat Phere, Saat Vachan', theme: 'pheras' },
  wedding: { title: 'Wedding', tagline: 'Taaron Ki Baraat', theme: 'baraat' },
  reception: { title: 'Reception', tagline: 'An Evening of Love', theme: 'reception' },
  custom: { title: 'Celebration', tagline: 'Together With Love', theme: 'haldi' },
};

// Landmarks for the main and closing cards. sun = position of the painted sun in
// the image as a fraction of its box (used as the focal point of the sun zoom).
export const LANDMARKS = {
  taj: { label: 'Taj Mahal, Agra', src: 'art/lm_taj.jpg', sun: [0.6, 0.233], aspect: 1.79 },
  hawamahal: { label: 'Hawa Mahal, Jaipur', src: 'art/lm_hawamahal.jpg', sun: [0.744, 0.207], aspect: 1.79 },
  indiagate: { label: 'India Gate, Delhi', src: 'art/lm_indiagate.jpg', sun: [0.741, 0.219], aspect: 1.79 },
  gateway: { label: 'Gateway of India, Mumbai', src: 'art/lm_gateway.jpg', sun: [0.771, 0.234], aspect: 1.79 },
  goldentemple: { label: 'Golden Temple, Amritsar', src: 'art/lm_goldentemple.jpg', sun: [0.70, 0.22], aspect: 1.79 },
  udaipur: { label: 'Lake Palace, Udaipur', src: 'art/lm_udaipur.jpg', sun: [0.761, 0.205], aspect: 1.79 },
};

// Custom events pick a colourway and a prop set independently.
export const PROP_SETS = {
  haldi: ['art/haldi_props.webp'], sangeet: ['art/gramophone.webp'], mayra: ['art/mayra_props.webp'],
  baraat: ['art/elephant.webp'], varmala: ['art/varmala_props.webp'], pheras: ['art/pheras_props.webp'],
  reception: ['art/reception_props.webp'], cocktail: ['art/cocktail_props.webp'],
};

export function themeFor(event) {
  const base = THEMES[event.theme] || THEMES[(PRESETS[event.preset] || PRESETS.custom).theme] || THEMES.haldi;
  if (event.preset === 'custom' && event.propSet && PROP_SETS[event.propSet] && event.propSet !== event.theme) {
    const other = THEMES[event.propSet];
    return { ...base, props: other.props, innerOrnament: other.innerOrnament };
  }
  return base;
}

// Fixed, pre-produced story scenes (painted once at template-build time with an original
// cast; never generated per customer). focus = where the fabric/stamp transitions dive in.
export const STORY_LIBRARY = {
  cycling: { label: 'First ride together', src: 'stories/story1.mp4', poster: 'stories/story1.jpg', clipSec: 8, focus: [0.5, 0.6] },
  proposal: { label: 'The proposal', src: 'stories/story2.mp4', poster: 'stories/story2.jpg', clipSec: 8, focus: [0.5, 0.6] },
  blessing: { label: "Grandmother's blessing", src: 'stories/story3.mp4', poster: 'stories/story3.jpg', clipSec: 8, focus: [0.5, 0.74] },
  walk: { label: 'Walking to the mandap', src: 'stories/story4.mp4', poster: 'stories/story4.jpg', clipSec: 8, focus: [0.5, 0.72] },
};
