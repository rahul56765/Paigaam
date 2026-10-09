// Compact vocabulary used by the invitation editor. The current film has two
// global palettes; event presets only supply sensible text labels and defaults.
export const THEMES = {
  haldi: { label: 'Haldi' }, sangeet: { label: 'Sangeet' }, mayra: { label: 'Mehendi / Mayra' },
  baraat: { label: 'Baraat' }, varmala: { label: 'Varmala' }, pheras: { label: 'Pheras' },
  reception: { label: 'Reception' }, cocktail: { label: 'Cocktail' },
};
export const PRESETS = {
  haldi: { title: 'Haldi', tagline: 'A little sunshine, a lot of joy', theme: 'haldi' },
  mehendi: { title: 'Mehendi', tagline: 'A garden of new beginnings', theme: 'mayra' },
  sangeet: { title: 'Sangeet', tagline: 'Music, colour and joy', theme: 'sangeet' },
  cocktail: { title: 'Cocktail', tagline: 'Cheers to forever', theme: 'cocktail' },
  engagement: { title: 'Engagement', tagline: 'A ring, a promise', theme: 'sangeet' },
  tilak: { title: 'Tilak', tagline: 'A joyful beginning', theme: 'pheras' },
  mayra: { title: 'Mayra', tagline: 'A family celebration', theme: 'mayra' },
  baraat: { title: 'Baraat', tagline: 'The wedding procession', theme: 'baraat' },
  varmala: { title: 'Varmala', tagline: 'Two hearts, one garland', theme: 'varmala' },
  pheras: { title: 'Pheras', tagline: 'Seven vows, one journey', theme: 'pheras' },
  wedding: { title: 'Wedding', tagline: 'Two hearts, one beautiful beginning', theme: 'varmala' },
  reception: { title: 'Reception', tagline: 'An evening of love', theme: 'reception' },
  custom: { title: 'Celebration', tagline: 'Together with love', theme: 'haldi' },
};

// Original, fixed clips only. These sources can never be supplied by customers.
export const STORY_LIBRARY = {
  mandap: { label: 'Together to the mandap', src: 'stories/mandap.mp4', poster: 'stories/mandap-poster.jpg', clipSec: 8, focus: [0.5, 0.68] },
  couple: { label: 'A moment together', src: 'stories/couple.mp4', poster: 'stories/couple-poster.jpg', clipSec: 8, focus: [0.5, 0.58] },
};
