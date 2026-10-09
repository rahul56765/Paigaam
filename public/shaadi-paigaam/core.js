/* Shaadi Paigaam — shared core (browser + Node).
 *
 * One source of truth for: the invitation data schema and its defaults, the
 * sample couple, validation / sanitising (the server runs exactly this code
 * before anything is stored), the palette engine (8 presets + derive-from-3
 * with WCAG contrast repair), font pairings, the music library list, date &
 * time-zone maths for the countdown, and the event → timeline grouping.
 *
 * UMD: window.SPCore in the browser, module.exports in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./i18n.js'));
  else root.SPCore = factory(root.SPI18N);
})(typeof self !== 'undefined' ? self : this, function (I18N) {
  'use strict';

  /* ======================================================== colour maths */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const hexToHsl = hex => { const c = hexToRgb(hex); return rgbToHsl(c[0], c[1], c[2]); };
  const hslHex = (h, s, l) => rgbToHex(...hslToRgb(h, clamp(s), clamp(l)));
  function mix(a, b, t) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  }
  function luminance(hex) {
    const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /** Move `fg` lighter/darker (keeping hue) until it reaches `ratio` on `bg`. */
  function ensureContrast(fg, bg, ratio) {
    if (contrast(fg, bg) >= ratio) return { color: fg, adjusted: false, ok: true };
    const [h, s, l0] = hexToHsl(fg);
    const darker = luminance(bg) > 0.18;
    for (let i = 1; i <= 100; i++) {
      const l = darker ? l0 - (l0 * i) / 100 : l0 + ((1 - l0) * i) / 100;
      const c = hslHex(h, s, l);
      if (contrast(c, bg) >= ratio) return { color: c, adjusted: true, ok: true };
    }
    const best = darker ? '#000000' : '#FFFFFF';
    return { color: best, adjusted: true, ok: contrast(best, bg) >= ratio };
  }
  const isDark = hex => luminance(hex) < 0.2;

  /* ============================================================ palettes */
  // Explicit, hand-tuned presets. Anything not listed is derived.
  const PALETTES = [
    { id: 'royal-maroon', name: 'Royal Maroon', primary: '#5C1020', deep: '#3E0A15', mid: '#7A1B2D', bg: '#FBF3E6', champagne: '#EBD3B5', accent: '#B8924A', flower: '#E8B8B0', heading: '#4A0E1A', body: '#6B5A55' },
    { id: 'sage-green', name: 'Sage Green', primary: '#6E7D58', deep: '#3D4733', mid: '#879673', bg: '#F7F4EC', champagne: '#E9DFCB', accent: '#B49B6C', flower: '#EFD6C4', heading: '#2F3826', body: '#66655A', button: '#34412C' },
    { id: 'navy-gold', name: 'Navy & Gold', primary: '#1E2B4F', deep: '#111A33', mid: '#2C3D6B', bg: '#F8F5EE', champagne: '#E8DCC4', accent: '#BF9C55', flower: '#E9E1D2', heading: '#17213F', body: '#5E5C64' },
    { id: 'dusty-rose', name: 'Dusty Rose', primary: '#9A5662', deep: '#6B3540', mid: '#B06E79', bg: '#FBF1EE', champagne: '#EFD7CF', accent: '#BE9B76', flower: '#EBC0C2', heading: '#56262F', body: '#6E5A5B' },
    { id: 'emerald-gold', name: 'Emerald & Gold', primary: '#0F5440', deep: '#083528', mid: '#1A6E55', bg: '#F6F3E9', champagne: '#E6DCC2', accent: '#C2A057', flower: '#F1E3D1', heading: '#0A3A2C', body: '#5B6159' },
    { id: 'royal-purple', name: 'Royal Purple', primary: '#4A2364', deep: '#2E1340', mid: '#623182', bg: '#F8F3F6', champagne: '#E9DCD8', accent: '#BE9C5E', flower: '#D9C3E3', heading: '#321745', body: '#655B66' },
    { id: 'terracotta-cream', name: 'Terracotta & Cream', primary: '#9C4E2B', deep: '#6A3119', mid: '#B4643C', bg: '#FBF3E8', champagne: '#EFD8BF', accent: '#C1945A', flower: '#EDBF9F', heading: '#5A2914', body: '#6E5B4E' },
    { id: 'midnight-gold', name: 'Midnight Black & Gold', primary: '#1C1B20', deep: '#0B0A0D', mid: '#2C2A31', bg: '#121115', champagne: '#3A3226', accent: '#C9A45C', flower: '#D9BE8A', heading: '#EBD8AE', body: '#C3B8A6', button: '#C9A45C', buttonText: '#17140F', card: '#1C1A20' },
  ];
  const PALETTE_BY_ID = Object.fromEntries(PALETTES.map(p => [p.id, p]));

  /**
   * Build the full CSS-variable palette from either a preset id or 3 custom
   * colours. Returns { vars, warnings[], errors[] } — `errors` means the
   * combination cannot be made readable and must be blocked.
   */
  function buildPalette(choice) {
    const warnings = [], errors = [];
    const id = choice && choice.id;
    let p;
    if (id && id !== 'custom' && PALETTE_BY_ID[id]) p = Object.assign({}, PALETTE_BY_ID[id]);
    else {
      const c = (choice && choice.custom) || {};
      const primary = hexToRgb(c.primary) ? c.primary.toUpperCase() : PALETTES[0].primary;
      const accent = hexToRgb(c.accent) ? c.accent.toUpperCase() : PALETTES[0].accent;
      const bg = hexToRgb(c.bg) ? c.bg.toUpperCase() : PALETTES[0].bg;
      const [ph, ps, pl] = hexToHsl(primary);
      const dark = isDark(bg);
      p = {
        id: 'custom', name: 'My palette', primary, accent, bg,
        deep: hslHex(ph, ps, pl * 0.66),
        mid: hslHex(ph, Math.min(1, ps * 1.05), Math.min(0.9, pl + 0.08)),
        champagne: dark ? mix(bg, accent, 0.28) : mix(bg, accent, 0.3),
        flower: dark ? mix(accent, '#FFFFFF', 0.25) : hslHex(ph, clamp(ps * 0.55, 0.18, 0.5), 0.8),
        heading: dark ? mix(accent, '#FFFFFF', 0.45) : hslHex(ph, clamp(ps, 0.2, 0.75), clamp(pl * 0.8, 0.12, 0.26)),
        body: dark ? mix(bg, '#FFFFFF', 0.72) : mix(hslHex(ph, 0.12, 0.33), bg, 0.08),
      };
      if (dark) { p.button = accent; p.card = mix(bg, '#FFFFFF', 0.06); }
    }
    const dark = isDark(p.bg);
    p.card = p.card || mix(p.bg, '#FFFFFF', 0.55);
    p.tint = mix(p.bg, p.primary, dark ? 0.16 : 0.07);   // countdown boxes, inputs
    p.line = p.accent;
    p.button = p.button || p.primary;
    // Readability repair.
    const head = ensureContrast(p.heading, p.bg, 4.5);
    if (head.adjusted) { p.heading = head.color; warnings.push('heading'); }
    if (!head.ok) errors.push('heading');
    const body = ensureContrast(p.body, p.bg, 4.5);
    if (body.adjusted) { p.body = body.color; warnings.push('body'); }
    if (!body.ok) errors.push('body');
    if (!p.buttonText) {
      const w = contrast('#FFFFFF', p.button), k = contrast('#1A1414', p.button);
      p.buttonText = w >= k ? '#FFFFFF' : '#1A1414';
    }
    if (contrast(p.buttonText, p.button) < 4.5) {
      const fix = ensureContrast(p.button, p.buttonText, 4.5);
      if (fix.ok) { p.button = fix.color; warnings.push('button'); } else errors.push('button');
    }
    // A button must stand out from the page.
    if (contrast(p.button, p.bg) < 1.9) {
      const fix = ensureContrast(p.button, p.bg, 1.9);
      if (fix.ok) { p.button = fix.color; p.buttonText = contrast('#FFFFFF', p.button) >= contrast('#1A1414', p.button) ? '#FFFFFF' : '#1A1414'; warnings.push('button'); }
      else errors.push('button');
    }
    // Gold lines/icons must be visible on the page (decorative: 1.6).
    if (contrast(p.accent, p.bg) < 1.6) { const fix = ensureContrast(p.accent, p.bg, 1.6); p.line = fix.color; warnings.push('accent'); }
    // Tap-to-open medallion & doors: keep the medallion legible on the door.
    p.medallionText = isDark(p.champagne) ? mix(p.accent, '#FFFFFF', 0.4) : p.deep;
    p.doorLine = p.accent;
    p.dark = dark;
    p.onDark = dark;
    p.scene = dark ? 'night' : 'day';
    const vars = {
      '--sp-primary': p.primary, '--sp-deep': p.deep, '--sp-mid': p.mid, '--sp-bg': p.bg, '--sp-champagne': p.champagne,
      '--sp-accent': p.accent, '--sp-line': p.line, '--sp-flower': p.flower, '--sp-heading': p.heading, '--sp-body': p.body,
      '--sp-button': p.button, '--sp-button-text': p.buttonText, '--sp-card': p.card, '--sp-tint': p.tint,
      '--sp-medallion-text': p.medallionText, '--sp-door-line': p.doorLine,
      '--sp-champagne-light': mix(p.champagne, '#FFFFFF', dark ? 0.12 : 0.5), '--sp-champagne-dark': mix(p.champagne, dark ? '#000000' : p.deep, dark ? 0.35 : 0.16),
      '--sp-accent-deep': mix(p.accent, '#2A1A08', 0.38), '--sp-shade': hexA(mix(p.champagne, '#3A2610', 0.6), dark ? 0.5 : 0.3),
      '--sp-glow': hexA(p.accent, 0.35), '--sp-shadow': hexA(p.deep, dark ? 0.6 : 0.22), '--sp-veil': hexA(p.bg, 0.86),
    };
    return { palette: p, vars, warnings: Array.from(new Set(warnings)), errors: Array.from(new Set(errors)) };
  }
  function hexA(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

  /* =============================================================== fonts */
  const FONTS = [
    { id: 'classic', name: 'Classic Script', script: "'Great Vibes'", serif: "'Cormorant Garamond'", scriptScale: 1, google: 'Great+Vibes&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500' },
    { id: 'modern', name: 'Modern Elegant', script: "'Playfair Display'", serif: "'Lora'", scriptScale: 0.78, scriptStyle: 'italic', google: 'Playfair+Display:ital,wght@1,400;1,500&family=Lora:ital,wght@0,400;0,500;0,600;1,400' },
    { id: 'royal', name: 'Royal Calligraphy', script: "'Pinyon Script'", serif: "'EB Garamond'", amp: "'EB Garamond'", ampStyle: 'italic', scriptScale: 0.95, google: 'Pinyon+Script&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400' },
    { id: 'minimal', name: 'Minimal', script: "'Marcellus'", serif: "'Jost'", scriptScale: 0.7, scriptUpper: true, google: 'Marcellus&family=Jost:ital,wght@0,300;0,400;0,500;1,300' },
  ];
  const FONT_BY_ID = Object.fromEntries(FONTS.map(f => [f.id, f]));
  // Non-Latin scripts: loaded only when that language is enabled.
  const SCRIPT_FONTS = {
    deva: { family: "'Tiro Devanagari Hindi'", google: 'Tiro+Devanagari+Hindi:ital@0;1' },
    'deva-mr': { family: "'Tiro Devanagari Marathi'", google: 'Tiro+Devanagari+Marathi:ital@0;1' },
    gujr: { family: "'Noto Serif Gujarati'", google: 'Noto+Serif+Gujarati:wght@400;600' },
    taml: { family: "'Noto Serif Tamil'", google: 'Noto+Serif+Tamil:wght@400;600' },
    telu: { family: "'Noto Serif Telugu'", google: 'Noto+Serif+Telugu:wght@400;600' },
    'arab-ur': { family: "'Noto Nastaliq Urdu'", google: 'Noto+Nastaliq+Urdu:wght@400;600' },
    arab: { family: "'Amiri'", google: 'Amiri:ital,wght@0,400;0,700;1,400' },
  };
  function scriptFontFor(lang) {
    if (lang === 'mr') return SCRIPT_FONTS['deva-mr'];
    const L = I18N.LANGS[lang]; return L ? SCRIPT_FONTS[L.script] || null : null;
  }
  function googleFontsHref(fontId, langs) {
    const f = FONT_BY_ID[fontId] || FONTS[0];
    const fam = [f.google];
    const seen = new Set();
    for (const l of langs || []) { const s = scriptFontFor(l); if (s && !seen.has(s.google)) { seen.add(s.google); fam.push(s.google); } }
    return 'https://fonts.googleapis.com/css2?family=' + fam.join('&family=') + '&display=swap';
  }

  /* =============================================================== music */
  // Original compositions made for Paigaam (no third-party rights).
  const MUSIC = [
    { id: 'shehnai-dawn', title: 'Shehnai at Dawn', instrument: 'Shehnai', category: 'Shehnai' },
    { id: 'sitar-sandhya', title: 'Sitar Sandhya', instrument: 'Sitar', category: 'Indian classical' },
    { id: 'santoor-mehendi', title: 'Santoor for Mehendi', instrument: 'Santoor', category: 'Indian classical' },
    { id: 'bansuri-mist', title: 'Bansuri Mist', instrument: 'Bansuri', category: 'Indian classical' },
    { id: 'veena-temple', title: 'Temple Veena', instrument: 'Veena', category: 'Indian classical' },
    { id: 'piano-vows', title: 'Piano Vows', instrument: 'Piano', category: 'Piano' },
    { id: 'piano-strings-forever', title: 'Forever, Piano & Strings', instrument: 'Piano & Strings', category: 'Piano' },
    { id: 'acoustic-courtyard', title: 'Courtyard Guitar', instrument: 'Acoustic guitar', category: 'Acoustic' },
    { id: 'harp-garden', title: 'Harp in the Garden', instrument: 'Harp', category: 'Acoustic' },
    { id: 'sarangi-reception', title: 'Sarangi Evening', instrument: 'Sarangi', category: 'Indian classical' },
  ];
  const MUSIC_IDS = new Set(MUSIC.map(m => m.id));

  /* ============================================================ sections */
  const TOGGLES = ['photos', 'dressCode', 'preWedding', 'transport', 'accommodation', 'gifts', 'rsvp', 'music'];
  const TOGGLE_LABELS = { photos: 'Photos', dressCode: 'Dress Code', preWedding: 'Pre-Wedding Events', transport: 'Transportation', accommodation: 'Accommodation', gifts: 'Gifts', rsvp: 'RSVP', music: 'Music' };

  /* ======================================================== sample data */
  const SAMPLE = {
    v: 1,
    couple: {
      groom: { first: 'Aarav', last: 'Deshmukh', fatherTitle: 'mr', father: 'Rajendra', motherTitle: 'mrs', mother: 'Sunita' },
      bride: { first: 'Ananya', last: 'Kulkarni', fatherTitle: 'mr', father: 'Prakash', motherTitle: 'mrs', mother: 'Meera' },
      showParents: true,
      order: 'groom',
    },
    welcome: { style: 'traditional', text: 'With the blessings of our elders and the grace of the Almighty, we joyfully invite you to the wedding of {groom} and {bride}. Your presence will make this sacred day complete, as two families come together in love.' },
    wedding: { date: '2026-12-11', time: '11:30', tz: 'Asia/Kolkata' },
    events: [
      { id: 'ev-mehendi', type: 'mehendi', name: 'Mehendi', date: '2026-12-09', start: '18:30', end: '', venue: "Bride's Residence", address: 'Kothrud, Pune', note: 'An evening of henna, music and chai.', dress: 'Shades of green' },
      { id: 'ev-haldi', type: 'haldi', name: 'Haldi', date: '2026-12-10', start: '11:00', end: '', venue: "Groom's Residence", address: 'Andheri West, Mumbai', note: 'Come ready to get a little yellow!', dress: 'Yellow or white' },
      { id: 'ev-arrival', type: 'arrival', name: 'Guest Arrival', date: '2026-12-11', start: '10:00', end: '', venue: '', address: '', note: 'We welcome you with love', dress: '' },
      { id: 'ev-wedding', type: 'wedding', name: 'Wedding Ceremony', date: '2026-12-11', start: '11:30', end: '', venue: '', address: '', note: 'Your presence means the world to us', dress: '', main: true },
      { id: 'ev-reception', type: 'reception', name: 'Reception', date: '2026-12-12', start: '19:30', end: '', venue: '', address: '', note: 'Dinner, dancing and blessings', dress: '' },
    ],
    venue: { name: 'Shree Palace Lawns', address: 'North Main Road, Koregaon Park', city: 'Pune', state: 'Maharashtra', pin: '411001', country: 'IN', lat: 18.5362, lng: 73.8940, verified: true },
    reception: { enabled: false, name: '', address: '', city: '', state: '', pin: '', country: 'IN', lat: null, lng: null, verified: false },
    dress: { women: 'Elegant traditional wear: sarees or lehengas in pastel or jewel tones.', men: 'Sherwani, kurta or a smart Indo-western outfit.', common: '' },
    transport: 'A complimentary shuttle will run from Pune Railway Station to the venue, leaving at 9:00 AM and 9:45 AM. Look for the Paigaam welcome desk at the main exit.',
    accommodation: { text: 'Rooms are held for our guests at The Westin Pune, Koregaon Park (5 minutes from the venue). Mention our code when you book.', code: 'AARAVANANYA26' },
    gifts: 'Your love, blessings and presence are the greatest gifts we could ask for. If you wish to bless us further, a contribution towards our new home would be cherished.',
    closing: '',
    photos: [
      { url: '/shaadi-paigaam/art/demo-1.webp', alt: 'Floral mandap decor', fx: 50, fy: 50 },
      { url: '/shaadi-paigaam/art/demo-2.webp', alt: 'Hands with mehendi', fx: 50, fy: 50 },
      { url: '/shaadi-paigaam/art/demo-3.webp', alt: 'The couple walking through a palace courtyard', fx: 50, fy: 50 },
      { url: '/shaadi-paigaam/art/demo-4.webp', alt: 'Reception table with roses', fx: 50, fy: 50 },
      { url: '/shaadi-paigaam/art/demo-5.webp', alt: 'Haldi decor with marigolds', fx: 50, fy: 50 },
    ],
    couplePhoto: null,
    music: { track: 'shehnai-dawn', url: '', title: '', startMuted: false, rightsOk: false },
    palette: { id: 'royal-maroon', custom: { primary: '#5C1020', accent: '#B8924A', bg: '#FBF3E6' } },
    font: 'classic',
    lang: { enabled: ['en', 'hi', 'mr'], default: 'en', base: 'en' },
    i18n: {
      hi: {
        'couple.groom.first': 'आरव', 'couple.groom.last': 'देशमुख', 'couple.groom.father': 'राजेंद्र', 'couple.groom.mother': 'सुनीता',
        'couple.bride.first': 'अनन्या', 'couple.bride.last': 'कुलकर्णी', 'couple.bride.father': 'प्रकाश', 'couple.bride.mother': 'मीरा',
        'welcome.text': 'बड़ों के आशीर्वाद और ईश्वर की कृपा से, हम आपको {groom} और {bride} के शुभ विवाह में सादर आमंत्रित करते हैं। जब दो परिवार प्रेम से एक होंगे, उस पावन दिन आपकी उपस्थिति हमारी ख़ुशी को पूर्ण करेगी।',
        'venue.name': 'श्री पैलेस लॉन्स', 'venue.address': 'नॉर्थ मेन रोड, कोरेगाँव पार्क', 'venue.city': 'पुणे', 'venue.state': 'महाराष्ट्र',
        'events.ev-mehendi.name': 'मेहंदी', 'events.ev-mehendi.venue': 'वधू का निवास', 'events.ev-mehendi.address': 'कोथरूड, पुणे', 'events.ev-mehendi.note': 'मेहंदी, संगीत और चाय की एक शाम।', 'events.ev-mehendi.dress': 'हरे रंग की छटाएँ',
        'events.ev-haldi.name': 'हल्दी', 'events.ev-haldi.venue': 'वर का निवास', 'events.ev-haldi.address': 'अंधेरी पश्चिम, मुंबई', 'events.ev-haldi.note': 'थोड़ा पीला होने के लिए तैयार होकर आइए!', 'events.ev-haldi.dress': 'पीला या सफ़ेद',
        'events.ev-arrival.name': 'अतिथि आगमन', 'events.ev-arrival.note': 'प्रेम से आपका स्वागत है',
        'events.ev-wedding.name': 'विवाह समारोह', 'events.ev-wedding.note': 'आपकी उपस्थिति हमारे लिए अनमोल है',
        'events.ev-reception.name': 'स्वागत समारोह', 'events.ev-reception.note': 'भोजन, नृत्य और आशीर्वाद',
        'dress.women': 'सुरुचिपूर्ण पारंपरिक परिधान: हल्के या रत्न-रंगों में साड़ी या लहंगा।', 'dress.men': 'शेरवानी, कुर्ता या आकर्षक इंडो-वेस्टर्न परिधान।',
        'transport': 'पुणे रेलवे स्टेशन से स्थल तक निःशुल्क शटल सुबह 9:00 और 9:45 बजे चलेगी। मुख्य निकास पर Paigaam स्वागत डेस्क देखें।',
        'accommodation.text': 'हमारे अतिथियों के लिए द वेस्टिन पुणे, कोरेगाँव पार्क (स्थल से 5 मिनट) में कमरे आरक्षित हैं। बुकिंग के समय हमारा कोड बताएँ।',
        'gifts': 'आपका प्रेम, आशीर्वाद और उपस्थिति ही हमारे लिए सबसे बड़ा उपहार है। यदि आप और आशीर्वाद देना चाहें, तो हमारे नए घर के लिए योगदान अनमोल होगा।',
      },
      mr: {
        'couple.groom.first': 'आरव', 'couple.groom.last': 'देशमुख', 'couple.groom.father': 'राजेंद्र', 'couple.groom.mother': 'सुनीता',
        'couple.bride.first': 'अनन्या', 'couple.bride.last': 'कुलकर्णी', 'couple.bride.father': 'प्रकाश', 'couple.bride.mother': 'मीरा',
        'welcome.text': 'वडीलधाऱ्यांच्या आशीर्वादाने आणि ईश्वराच्या कृपेने, {groom} आणि {bride} यांच्या शुभविवाहास आपणास सप्रेम निमंत्रण. दोन कुटुंबे प्रेमाने एकत्र येत असताना, आपली उपस्थिती हा मंगल दिवस पूर्ण करेल.',
        'venue.name': 'श्री पॅलेस लॉन्स', 'venue.address': 'नॉर्थ मेन रोड, कोरेगाव पार्क', 'venue.city': 'पुणे', 'venue.state': 'महाराष्ट्र',
        'events.ev-mehendi.name': 'मेहंदी', 'events.ev-mehendi.venue': 'वधूचे निवासस्थान', 'events.ev-mehendi.address': 'कोथरूड, पुणे', 'events.ev-mehendi.note': 'मेहंदी, संगीत आणि चहाची एक संध्याकाळ.', 'events.ev-mehendi.dress': 'हिरव्या रंगछटा',
        'events.ev-haldi.name': 'हळद', 'events.ev-haldi.venue': 'वराचे निवासस्थान', 'events.ev-haldi.address': 'अंधेरी पश्चिम, मुंबई', 'events.ev-haldi.note': 'थोडे पिवळे होण्याच्या तयारीने या!', 'events.ev-haldi.dress': 'पिवळा किंवा पांढरा',
        'events.ev-arrival.name': 'पाहुण्यांचे आगमन', 'events.ev-arrival.note': 'प्रेमाने आपले स्वागत',
        'events.ev-wedding.name': 'विवाह सोहळा', 'events.ev-wedding.note': 'आपली उपस्थिती आमच्यासाठी अनमोल आहे',
        'events.ev-reception.name': 'स्वागत समारंभ', 'events.ev-reception.note': 'भोजन, नृत्य आणि आशीर्वाद',
        'dress.women': 'सुरेख पारंपरिक पोशाख: फिकट किंवा रत्नरंगी साडी किंवा लेहेंगा.', 'dress.men': 'शेरवानी, कुर्ता किंवा देखणा इंडो-वेस्टर्न पोशाख.',
        'transport': 'पुणे रेल्वे स्थानकापासून स्थळापर्यंत मोफत शटल सकाळी 9:00 आणि 9:45 वाजता सुटेल. मुख्य प्रवेशद्वाराजवळ Paigaam स्वागत कक्ष पाहा.',
        'accommodation.text': 'आमच्या पाहुण्यांसाठी द वेस्टिन पुणे, कोरेगाव पार्क (स्थळापासून 5 मिनिटे) येथे खोल्या राखीव आहेत. बुकिंग करताना आमचा कोड सांगा.',
        'gifts': 'आपले प्रेम, आशीर्वाद आणि उपस्थिती हाच आमच्यासाठी सर्वात मोठा आहेर. आणखी आशीर्वाद द्यायचे असल्यास, आमच्या नव्या घरासाठी दिलेले योगदान मोलाचे ठरेल.',
      },
    },
    sections: { photos: true, dressCode: true, preWedding: true, transport: true, accommodation: true, gifts: true, rsvp: true, music: true },
    rsvp: { deadline: '2026-11-30', maxGuests: 4, meal: true, mealOptions: ['Vegetarian', 'Jain', 'Non-vegetarian'], email: '', whatsapp: '' },
    access: { passcode: '', expireDays: 30 },
  };

  const BLANK_VENUE = { name: '', address: '', city: '', state: '', pin: '', country: 'IN', lat: null, lng: null, verified: false };

  /* ============================================== field limits & labels */
  const LIMITS = {
    first: 40, last: 30, parent: 40, welcome: 600, eventName: 40, eventVenue: 70, eventAddress: 140, eventNote: 140, eventDress: 80,
    venueName: 70, venueAddress: 160, city: 40, state: 40, pin: 10, dress: 220, transport: 500, accommodation: 500, code: 24, gifts: 500, closing: 120,
    photos: 8, events: 20, alt: 120, passcode: 24, mealOption: 30, mealOptions: 6,
  };

  // Every customer string that can be translated, as "path" → label.
  function translatableFields(data) {
    const out = [
      ['couple.groom.first', "Groom's first name"], ['couple.groom.last', "Groom's family name"], ['couple.groom.father', "Groom's father"], ['couple.groom.mother', "Groom's mother"],
      ['couple.bride.first', "Bride's first name"], ['couple.bride.last', "Bride's family name"], ['couple.bride.father', "Bride's father"], ['couple.bride.mother', "Bride's mother"],
      ['welcome.text', 'Welcome message'], ['venue.name', 'Venue name'], ['venue.address', 'Venue address'], ['venue.city', 'City'], ['venue.state', 'State'],
    ];
    if (data && data.reception && data.reception.enabled) out.push(['reception.name', 'Reception venue name'], ['reception.address', 'Reception venue address'], ['reception.city', 'Reception city']);
    for (const ev of (data && data.events) || []) {
      out.push([`events.${ev.id}.name`, `${ev.name || 'Event'}: name`]);
      if (ev.venue) out.push([`events.${ev.id}.venue`, `${ev.name || 'Event'}: venue`]);
      if (ev.address) out.push([`events.${ev.id}.address`, `${ev.name || 'Event'}: address`]);
      if (ev.note) out.push([`events.${ev.id}.note`, `${ev.name || 'Event'}: note`]);
      if (ev.dress) out.push([`events.${ev.id}.dress`, `${ev.name || 'Event'}: dress code`]);
    }
    if (data) {
      const s = data.sections || {};
      if (s.dressCode !== false) { if (data.dress && data.dress.women) out.push(['dress.women', 'Dress code: women']); if (data.dress && data.dress.men) out.push(['dress.men', 'Dress code: men']); if (data.dress && data.dress.common) out.push(['dress.common', 'Dress code: everyone']); }
      if (s.transport !== false && data.transport) out.push(['transport', 'Transportation']);
      if (s.accommodation !== false && data.accommodation && data.accommodation.text) out.push(['accommodation.text', 'Accommodation']);
      if (s.gifts !== false && data.gifts) out.push(['gifts', 'Gifts']);
      if (data.closing) out.push(['closing', 'Closing line']);
    }
    // Only fields that actually have base text need a translation.
    return out.filter(([path]) => !!String(getPath(data, path) || '').trim());
  }

  function getPath(obj, path) {
    if (!obj) return undefined;
    const parts = path.split('.');
    if (parts[0] === 'events') {
      const ev = (obj.events || []).find(e => e.id === parts[1]);
      return ev ? ev[parts[2]] : undefined;
    }
    let cur = obj;
    for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }

  /* ========================================================= sanitising */
  const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u2028\u2029\uFEFF]/g;
  const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}]/gu;
  const NAME_OK = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;

  /** Any free text: no control chars, no angle brackets (never HTML), squashed spaces, capped. */
  function cleanText(v, max, multiline = false) {
    if (v == null) return '';
    let s = String(v).normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL, '').replace(/[<>]/g, '');
    s = multiline ? s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
    s = s.trim();
    const cps = Array.from(s);
    return cps.length > max ? cps.slice(0, max).join('').trim() : s;
  }
  /** Proper-case a Latin word only if typed ALL lower / ALL UPPER; leave "McDonald" alone. */
  function properCase(s) {
    return s.split(/(\s+|-)/).map(part => {
      if (!/[a-zA-Z]/.test(part)) return part;
      if (part !== part.toLowerCase() && part !== part.toUpperCase()) return part;
      return part.toLowerCase().replace(/(^|['’])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    }).join('');
  }
  function cleanName(v, max) {
    let s = cleanText(v, max * 2).replace(EMOJI, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return { value: '', ok: true };
    const ok = NAME_OK.test(s);
    s = properCase(s);
    const cps = Array.from(s);
    return { value: cps.length > max ? cps.slice(0, max).join('') : s, ok, tooLong: cps.length > max };
  }
  const EMAIL_RE = /^[^\s@<>()[\],;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;
  function cleanPhone(v) {
    const s = String(v || '').replace(/[\s().-]/g, '');
    if (!s) return { value: '', ok: true };
    if (/^[6-9]\d{9}$/.test(s)) return { value: '+91' + s, ok: true };
    if (/^0[6-9]\d{9}$/.test(s)) return { value: '+91' + s.slice(1), ok: true };
    if (/^\+?91[6-9]\d{9}$/.test(s)) return { value: '+' + s.replace(/^\+/, ''), ok: true };
    if (/^\+[1-9]\d{7,14}$/.test(s)) return { value: s, ok: true };
    return { value: s.slice(0, 16), ok: false };
  }
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/, TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  function validDate(s) { const m = DATE_RE.exec(s || ''); if (!m) return false; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCDate() === +m[3] && +m[1] >= 2020 && +m[1] <= 2100; }
  const validTime = s => TIME_RE.test(s || '');
  function validTz(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return /^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+){0,2}$/.test(tz); } catch { return false; } }
  const MEDIA_RE = /^\/shaadi-paigaam\/(media\/[a-f0-9]{48}\.(jpg|png|webp|mp3|m4a|ogg|aac|wav)|art\/demo-[1-5]\.webp)$/;
  const isImage = u => MEDIA_RE.test(u || '') && /\.(jpg|png|webp)$/.test(u);
  const isAudio = u => MEDIA_RE.test(u || '') && /\.(mp3|m4a|ogg|aac|wav)$/.test(u);
  const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
  const idOk = s => /^[a-z0-9-]{2,40}$/.test(s || '');

  /**
   * Validate + sanitise. Never throws for content problems: returns
   *   { data, errors: [{path,msg}], warnings: [{path,msg}], translations: [{lang,path,label}] }
   * `errors` block publishing; `warnings` are shown but allowed.
   * opts.now (ms) for tests; opts.publish adds publish-only requirements.
   */
  function validate(input, opts = {}) {
    const now = opts.now || Date.now();
    const src = (input && typeof input === 'object') ? input : {};
    const E = [], W = [];
    const err = (path, msg) => E.push({ path, msg }), warn = (path, msg) => W.push({ path, msg });
    const d = { v: 1 };

    // ---- couple
    const c = src.couple || {};
    d.couple = { showParents: c.showParents !== false, order: c.order === 'bride' ? 'bride' : 'groom' };
    for (const side of ['groom', 'bride']) {
      const s = c[side] || {}, o = {};
      const label = side === 'groom' ? "groom's" : "bride's";
      for (const [k, max] of [['first', LIMITS.first], ['last', LIMITS.last], ['father', LIMITS.parent], ['mother', LIMITS.parent]]) {
        const r = cleanName(s[k], max);
        o[k] = r.value;
        if (!r.ok) err(`couple.${side}.${k}`, 'Please use letters only. Spaces, hyphens and apostrophes are fine, but numbers, emojis and symbols are not.');
        if (r.tooLong) warn(`couple.${side}.${k}`, `We shortened this to ${max} characters.`);
      }
      o.fatherTitle = ['mr', 'dr', 'late', 'none'].includes(s.fatherTitle) ? s.fatherTitle : 'mr';
      o.motherTitle = ['mrs', 'dr', 'late', 'none'].includes(s.motherTitle) ? s.motherTitle : 'mrs';
      if (!o.first) err(`couple.${side}.first`, `Please add the ${label} first name.`);
      d.couple[side] = o;
    }
    if (d.couple.showParents) {
      for (const side of ['groom', 'bride']) if (!d.couple[side].father && !d.couple[side].mother) warn(`couple.${side}.father`, "No parents' names yet. Add them, or switch off the parents' lines.");
    }

    // ---- welcome
    const wl = src.welcome || {};
    d.welcome = { style: I18N.WELCOME[wl.style] ? wl.style : 'traditional', text: cleanText(wl.text, LIMITS.welcome, true) };
    if (!d.welcome.text) warn('welcome.text', 'Your welcome message is empty, so the section will be skipped.');

    // ---- wedding date
    const wd = src.wedding || {};
    d.wedding = { date: validDate(wd.date) ? wd.date : '', time: validTime(wd.time) ? wd.time : '', tz: validTz(wd.tz) ? wd.tz : 'Asia/Kolkata' };
    if (!d.wedding.date) err('wedding.date', 'Please choose the wedding date.');
    if (!d.wedding.time) err('wedding.time', 'Please choose the wedding time.');
    if (d.wedding.date && d.wedding.time && !opts.allowPast) {
      const at = zonedToUtc(d.wedding.date, d.wedding.time, d.wedding.tz);
      if (at <= now) err('wedding.date', 'The wedding date has to be in the future.');
      else if (at - now > 3 * 365 * 864e5) warn('wedding.date', 'That date is more than 3 years away. Is the year right?');
    }

    // ---- events
    const evIn = Array.isArray(src.events) ? src.events.slice(0, LIMITS.events) : [];
    if (Array.isArray(src.events) && src.events.length > LIMITS.events) warn('events', `You can add up to ${LIMITS.events} events.`);
    const seen = new Set();
    d.events = [];
    let hasMain = false;
    for (const e of evIn) {
      if (!e || typeof e !== 'object') continue;
      let id = idOk(e.id) ? e.id : 'ev-' + Math.random().toString(36).slice(2, 9);
      while (seen.has(id)) id += 'x';
      seen.add(id);
      const type = I18N.EVENT_TYPES[e.type] ? e.type : 'custom';
      const ev = {
        id, type,
        name: cleanText(e.name, LIMITS.eventName) || I18N.eventTypeName(type, 'en'),
        date: validDate(e.date) ? e.date : '', start: validTime(e.start) ? e.start : '', end: validTime(e.end) ? e.end : '',
        venue: cleanText(e.venue, LIMITS.eventVenue), address: cleanText(e.address, LIMITS.eventAddress),
        note: cleanText(e.note, LIMITS.eventNote), dress: cleanText(e.dress, LIMITS.eventDress),
      };
      if (e.main && !hasMain) { ev.main = true; hasMain = true; }
      d.events.push(ev);
    }
    if (!hasMain) {
      d.events.push({ id: 'ev-wedding', type: 'wedding', name: 'Wedding Ceremony', date: d.wedding.date, start: d.wedding.time, end: '', venue: '', address: '', note: '', dress: '', main: true });
    }
    // The main ceremony always follows the wedding date & time.
    for (const ev of d.events) if (ev.main) { ev.date = d.wedding.date; ev.start = d.wedding.time; }
    const wDay = d.wedding.date;
    d.events.forEach((ev, i) => {
      const p = `events.${ev.id}`;
      if (!ev.main) {
        if (!ev.date) err(p + '.date', `Please choose a date for ${ev.name}.`);
        if (!ev.start) err(p + '.start', `Please choose a start time for ${ev.name}.`);
      }
      if (ev.end && ev.start && ev.end <= ev.start) warn(p + '.end', `${ev.name} ends before it starts. If it runs past midnight, that is fine.`);
      if (ev.date && wDay) {
        if (['mehendi', 'haldi', 'sangeet', 'engagement'].includes(ev.type) && ev.date > wDay) warn(p + '.date', `${ev.name} is after the wedding day. Is that right?`);
        if (ev.type === 'reception' && ev.date < wDay) warn(p + '.date', 'The reception is before the wedding day. Is that right?');
        if (ev.date < wDay) {
          const days = (Date.parse(wDay) - Date.parse(ev.date)) / 864e5;
          if (days > 60) warn(p + '.date', `${ev.name} is ${Math.round(days)} days before the wedding. Is the date right?`);
        }
      }
      if (ev.date && !opts.allowPast && zonedToUtc(ev.date, ev.start || '23:59', d.wedding.tz) < now) warn(p + '.date', `${ev.name} is in the past.`);
    });
    // Overlaps at the same place on the same day.
    const placeOf = ev => (ev.venue || ev.address || (ev.date === wDay || !ev.venue ? '__main__' : '')).toLowerCase().trim();
    for (let i = 0; i < d.events.length; i++) for (let j = i + 1; j < d.events.length; j++) {
      const a = d.events[i], b = d.events[j];
      if (!a.date || a.date !== b.date || !a.start || !b.start) continue;
      if (placeOf(a) !== placeOf(b)) continue;
      const aEnd = a.end && a.end > a.start ? a.end : addMinutes(a.start, 60), bEnd = b.end && b.end > b.start ? b.end : addMinutes(b.start, 60);
      if (a.start === b.start || (a.start < bEnd && b.start < aEnd)) {
        if (a.start === b.start) warn(`events.${b.id}.start`, `${a.name} and ${b.name} start at the same time at the same place.`);
        else if ((a.end && a.end > a.start) || (b.end && b.end > b.start)) warn(`events.${b.id}.start`, `${a.name} and ${b.name} overlap in time at the same place.`);
      }
    }

    // ---- venues
    d.venue = cleanVenue(src.venue, 'venue', true);
    d.reception = Object.assign(cleanVenue(src.reception, 'reception', !!(src.reception && src.reception.enabled)), { enabled: !!(src.reception && src.reception.enabled) });
    function cleanVenue(v, path, required) {
      v = v || {};
      const o = {
        name: cleanText(v.name, LIMITS.venueName), address: cleanText(v.address, LIMITS.venueAddress),
        city: cleanText(v.city, LIMITS.city), state: cleanText(v.state, LIMITS.state), pin: String(v.pin || '').replace(/\s/g, '').slice(0, LIMITS.pin),
        country: /^[A-Z]{2}$/.test(v.country || '') ? v.country : 'IN',
        lat: Number.isFinite(+v.lat) && v.lat !== null && v.lat !== '' && Math.abs(+v.lat) <= 90 ? +(+v.lat).toFixed(6) : null,
        lng: Number.isFinite(+v.lng) && v.lng !== null && v.lng !== '' && Math.abs(+v.lng) <= 180 ? +(+v.lng).toFixed(6) : null,
        verified: !!v.verified,
      };
      if (o.lat === null || o.lng === null) { o.lat = null; o.lng = null; o.verified = false; }
      if (required) {
        if (!o.name) err(path + '.name', 'Please add the venue name.');
        if (!o.address && !o.city) err(path + '.address', 'Please add the venue address.');
        if (o.lat === null) err(path + '.map', 'Please pick the address from the suggestions, or place the pin on the map, so guests get the right directions.');
        if (o.country === 'IN' && o.pin && !/^[1-9]\d{5}$/.test(o.pin)) err(path + '.pin', 'An Indian PIN code has 6 digits and does not start with 0.');
        if (o.country === 'IN' && !o.pin) warn(path + '.pin', 'Adding the 6-digit PIN code helps guests find the place.');
      }
      return o;
    }

    // ---- info sections
    const dr = src.dress || {};
    d.dress = { women: cleanText(dr.women, LIMITS.dress), men: cleanText(dr.men, LIMITS.dress), common: cleanText(dr.common, LIMITS.dress) };
    d.transport = cleanText(src.transport, LIMITS.transport, true);
    const ac = src.accommodation || {};
    d.accommodation = { text: cleanText(ac.text, LIMITS.accommodation, true), code: cleanText(ac.code, LIMITS.code).replace(/\s/g, '') };
    d.gifts = cleanText(src.gifts, LIMITS.gifts, true);
    d.closing = cleanText(src.closing, LIMITS.closing);

    // ---- media
    d.photos = [];
    for (const ph of (Array.isArray(src.photos) ? src.photos : []).slice(0, LIMITS.photos)) {
      if (!ph || !isImage(ph.url)) continue;
      d.photos.push({ url: ph.url, alt: cleanText(ph.alt, LIMITS.alt), fx: num(ph.fx, 0, 100, 50), fy: num(ph.fy, 0, 100, 50) });
    }
    if (Array.isArray(src.photos) && src.photos.length > LIMITS.photos) warn('photos', `Up to ${LIMITS.photos} photos. We kept the first ${LIMITS.photos}.`);
    if (d.photos.some(p => /\/art\/demo-/.test(p.url))) warn('photos', 'Some sample photos are still in your gallery. Replace them with your own, or remove them.');
    d.couplePhoto = src.couplePhoto && isImage(src.couplePhoto.url) ? { url: src.couplePhoto.url, fx: num(src.couplePhoto.fx, 0, 100, 50), fy: num(src.couplePhoto.fy, 0, 100, 50) } : null;
    const mu = src.music || {};
    d.music = { track: mu.track === 'upload' ? 'upload' : (MUSIC_IDS.has(mu.track) ? mu.track : 'shehnai-dawn'), url: isAudio(mu.url) ? mu.url : '', title: cleanText(mu.title, 60), startMuted: !!mu.startMuted, rightsOk: !!mu.rightsOk };
    if (d.music.track === 'upload' && !d.music.url) { d.music.track = 'shehnai-dawn'; }
    if (d.music.track === 'upload' && !d.music.rightsOk) err('music.rightsOk', 'Please confirm you have the right to use this song.');

    // ---- style
    const pa = src.palette || {};
    const cu = pa.custom || {};
    d.palette = { id: pa.id === 'custom' || PALETTE_BY_ID[pa.id] ? pa.id : 'royal-maroon', custom: {
      primary: hexToRgb(cu.primary) ? String(cu.primary).toUpperCase() : PALETTES[0].primary,
      accent: hexToRgb(cu.accent) ? String(cu.accent).toUpperCase() : PALETTES[0].accent,
      bg: hexToRgb(cu.bg) ? String(cu.bg).toUpperCase() : PALETTES[0].bg } };
    if (d.palette.id === 'custom') {
      const built = buildPalette(d.palette);
      const cu2 = d.palette.custom;
      if (contrast(cu2.primary, cu2.bg) < 1.35) err('palette', 'Your main colour and background are almost the same, so the doors and buttons would disappear. Please pick a deeper main colour.');
      else if (built.errors.length) err('palette', 'These colours make text or buttons hard to read. Please choose a lighter background or a stronger main colour.');
      else if (built.warnings.length) warn('palette', 'We adjusted the text colour slightly so everything stays easy to read.');
    }
    d.font = FONT_BY_ID[src.font] ? src.font : 'classic';

    // ---- languages & translations
    const lg = src.lang || {};
    const enabled = (Array.isArray(lg.enabled) ? lg.enabled : ['en']).filter((l, i, a) => I18N.LANGS[l] && a.indexOf(l) === i).slice(0, 8);
    d.lang = { enabled: enabled.length ? enabled : ['en'] };
    d.lang.base = I18N.LANGS[lg.base] ? lg.base : 'en';
    if (!d.lang.enabled.includes(d.lang.base)) d.lang.enabled.unshift(d.lang.base);
    d.lang.default = d.lang.enabled.includes(lg.default) ? lg.default : d.lang.base;
    d.i18n = {};
    const allowed = new Set(translatableFieldsAll(d));
    const srcI = src.i18n && typeof src.i18n === 'object' ? src.i18n : {};
    for (const l of d.lang.enabled) {
      if (l === d.lang.base || !srcI[l] || typeof srcI[l] !== 'object') continue;
      const out = {};
      for (const [k, v] of Object.entries(srcI[l])) {
        if (!allowed.has(k)) continue;
        const max = k.endsWith('.text') || k === 'transport' || k === 'gifts' ? 700 : 200;
        const cv = cleanText(v, max, /welcome|transport|gifts|accommodation/.test(k));
        if (cv) out[k] = cv;
      }
      if (Object.keys(out).length) d.i18n[l] = out;
    }
    const translations = [];
    const need = translatableFields(d);
    for (const l of d.lang.enabled) {
      if (l === d.lang.base) continue;
      // Names are optional to translate: untranslated names simply show as typed.
      for (const [path, label] of need) if (!/^couple\./.test(path) && !(d.i18n[l] && d.i18n[l][path])) translations.push({ lang: l, path, label });
    }

    // ---- sections
    const se = src.sections || {};
    d.sections = {};
    for (const k of TOGGLES) d.sections[k] = se[k] !== false;

    // ---- rsvp
    const rv = src.rsvp || {};
    d.rsvp = {
      deadline: validDate(rv.deadline) ? rv.deadline : '', maxGuests: Math.round(num(rv.maxGuests, 1, 20, 4)), meal: !!rv.meal,
      mealOptions: (Array.isArray(rv.mealOptions) ? rv.mealOptions : []).map(x => cleanText(x, LIMITS.mealOption)).filter(Boolean).slice(0, LIMITS.mealOptions),
      email: cleanText(rv.email, 120).toLowerCase(), whatsapp: '',
    };
    if (d.rsvp.meal && !d.rsvp.mealOptions.length) d.rsvp.mealOptions = ['Vegetarian', 'Non-vegetarian'];
    if (d.rsvp.email && !EMAIL_RE.test(d.rsvp.email)) err('rsvp.email', 'That email address does not look right. It should look like name@example.com.');
    const ph = cleanPhone(rv.whatsapp);
    d.rsvp.whatsapp = ph.value;
    if (!ph.ok) err('rsvp.whatsapp', 'That number does not look right. Use a 10-digit Indian mobile number or +country code and number.');
    if (d.sections.rsvp && d.rsvp.deadline && d.wedding.date) {
      if (d.rsvp.deadline > d.wedding.date) err('rsvp.deadline', 'The RSVP deadline should be on or before the wedding day.');
      if (!opts.allowPast && Date.parse(d.rsvp.deadline + 'T23:59:59Z') < now) err('rsvp.deadline', 'The RSVP deadline has already passed.');
    }

    // ---- access
    const acc = src.access || {};
    d.access = { passcode: cleanText(acc.passcode, LIMITS.passcode).replace(/\s/g, ''), expireDays: Math.round(num(acc.expireDays, 0, 365, 30)) };
    if (d.access.passcode && d.access.passcode.length < 4) err('access.passcode', 'A passcode needs at least 4 characters.');

    if (opts.publish && E.length === 0 && translations.length) { /* allowed: falls back to the main language */ }
    return { data: d, errors: E, warnings: W, translations };
  }
  function translatableFieldsAll(d) {
    // Allowed i18n keys (independent of whether base text exists).
    const keys = ['couple.groom.first', 'couple.groom.last', 'couple.groom.father', 'couple.groom.mother', 'couple.bride.first', 'couple.bride.last', 'couple.bride.father', 'couple.bride.mother',
      'welcome.text', 'venue.name', 'venue.address', 'venue.city', 'venue.state', 'reception.name', 'reception.address', 'reception.city', 'reception.state',
      'dress.women', 'dress.men', 'dress.common', 'transport', 'accommodation.text', 'gifts', 'closing'];
    for (const ev of d.events || []) for (const f of ['name', 'venue', 'address', 'note', 'dress']) keys.push(`events.${ev.id}.${f}`);
    return keys;
  }

  /* ======================================================== time & dates */
  function addMinutes(t, m) { const [h, mi] = t.split(':').map(Number); const x = Math.min(23 * 60 + 59, h * 60 + mi + m); return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); }
  function tzOffsetMs(tz, utcMs) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {}; for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
  }
  /** Local wall-clock date+time in an IANA zone → UTC ms (DST-correct). */
  function zonedToUtc(date, time, tz) {
    const [y, mo, d] = date.split('-').map(Number); const [h, mi] = (time || '00:00').split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    let off = tzOffsetMs(tz, guess);
    let t = guess - off;
    const off2 = tzOffsetMs(tz, t);
    if (off2 !== off) t = guess - off2;
    return t;
  }
  function locale(lang) { return (I18N.LANGS[lang] || I18N.LANGS.en).locale; }
  function fmtDate(date, lang, style = 'long') {
    if (!validDate(date)) return '';
    const [y, m, d] = date.split('-').map(Number);
    const o = style === 'full' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } : style === 'short' ? { year: 'numeric', month: 'short', day: 'numeric' } : style === 'weekday' ? { weekday: 'long' } : style === 'daymonth' ? { weekday: 'long', month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric' };
    try { return new Intl.DateTimeFormat(locale(lang), Object.assign({ timeZone: 'UTC' }, o)).format(new Date(Date.UTC(y, m - 1, d, 12))); }
    catch { return date; }
  }
  function fmtTime(time, lang) {
    if (!validTime(time)) return '';
    const [h, mi] = time.split(':').map(Number);
    try { return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, h, mi))); }
    catch { return time; }
  }
  function fmtNum(n, lang) { try { return new Intl.NumberFormat(locale(lang), { minimumIntegerDigits: 2, useGrouping: false }).format(n); } catch { return String(n).padStart(2, '0'); } }

  /* ============================================================= content */
  /** Resolve a customer string in `lang`, falling back to the base text. */
  function txt(data, lang, path) {
    const tr = data.i18n && data.i18n[lang] && data.i18n[lang][path];
    if (tr && lang !== data.lang.base) return tr;
    const v = getPath(data, path);
    return v == null ? '' : String(v);
  }
  function eventName(data, lang, ev) {
    const tr = data.i18n && data.i18n[lang] && data.i18n[lang][`events.${ev.id}.name`];
    if (tr && lang !== data.lang.base) return tr;
    // If the customer kept the default English name, show the built-in translation.
    if (lang !== data.lang.base && ev.name === I18N.eventTypeName(ev.type, data.lang.base)) return I18N.eventTypeName(ev.type, lang);
    return ev.name;
  }
  function fillNames(text, data, lang) {
    return String(text || '').replace(/\{groom\}/g, txt(data, lang, 'couple.groom.first')).replace(/\{bride\}/g, txt(data, lang, 'couple.bride.first'));
  }
  function parentLine(data, lang, side) {
    const s = data.couple[side];
    const t = k => I18N.t(lang, k + '_');
    const title = (k, v) => v === 'none' ? '' : t(v);
    const fa = txt(data, lang, `couple.${side}.father`), mo = txt(data, lang, `couple.${side}.mother`), fam = txt(data, lang, `couple.${side}.last`);
    const parts = [];
    if (fa) parts.push([title('f', s.fatherTitle), fa].filter(Boolean).join(' '));
    if (mo) parts.push([title('m', s.motherTitle), mo].filter(Boolean).join(' '));
    if (!parts.length) return '';
    const who = parts.join(' ' + I18N.t(lang, 'and') + ' ') + (fam ? ' ' + fam : '');
    const S = I18N.STRINGS[lang] || {};
    const suffix = S[side === 'groom' ? 'sonOfSuffix' : 'daughterOfSuffix'];
    if (suffix) return who + ' ' + suffix;
    return I18N.t(lang, side === 'groom' ? 'sonOf' : 'daughterOf') + ' ' + who;
  }

  /** Program timeline (wedding day onwards, grouped by day) and pre-wedding cards (before). */
  function schedule(data) {
    const wDay = data.wedding.date;
    const sorted = data.events.filter(e => e.date).slice().sort((a, b) => (a.date + (a.start || '99:99')).localeCompare(b.date + (b.start || '99:99')));
    const pre = sorted.filter(e => wDay && e.date < wDay);
    const main = sorted.filter(e => !wDay || e.date >= wDay);
    const days = [];
    for (const e of main) { let d = days.find(x => x.date === e.date); if (!d) days.push(d = { date: e.date, events: [] }); d.events.push(e); }
    return { pre, days };
  }

  function mapsLinks(v, provider) {
    const q = [v.name, v.address, v.city, v.state, v.pin].filter(Boolean).join(', ');
    const hasPt = v.lat != null && v.lng != null;
    const google = hasPt ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    const apple = hasPt ? `https://maps.apple.com/?ll=${v.lat},${v.lng}&q=${encodeURIComponent(v.name || q)}` : `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
    const d = 0.006;
    const osmEmbed = hasPt ? `https://www.openstreetmap.org/export/embed.html?bbox=${v.lng - d},${v.lat - d * 0.7},${v.lng + d},${v.lat + d * 0.7}&layer=mapnik&marker=${v.lat},${v.lng}` : '';
    return { google, apple, osmEmbed, query: q };
  }

  function icsFor(data, lang, url) {
    const start = zonedToUtc(data.wedding.date, data.wedding.time, data.wedding.tz);
    const end = start + 4 * 3600e3;
    const f = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const v = data.venue;
    const title = `${txt(data, lang, 'couple.groom.first')} & ${txt(data, lang, 'couple.bride.first')}: ${I18N.eventTypeName('wedding', lang)}`;
    const ordered = data.couple.order === 'bride' ? `${txt(data, lang, 'couple.bride.first')} & ${txt(data, lang, 'couple.groom.first')}: ${I18N.eventTypeName('wedding', lang)}` : title;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Paigaam//Shaadi Paigaam//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${f(start)}-${Math.abs(hash(ordered))}@paigaam.cc`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:${esc(ordered)}`, `LOCATION:${esc([v.name, v.address, v.city, v.state, v.pin].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${esc(url || 'https://paigaam.cc')}`, url ? `URL:${url}` : '', 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ordered)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  /* ========================================================== short links */
  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }
  const SLUG_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;
  function slugSuggestions(data) {
    const g = slugify(data.couple.groom.first), b = slugify(data.couple.bride.first);
    const y = (data.wedding.date || '').slice(0, 4), yy = y.slice(2);
    const gl = slugify(data.couple.groom.last), bl = slugify(data.couple.bride.last);
    const pair = data.couple.order === 'bride' ? [b, g] : [g, b];
    const base = pair.filter(Boolean).join('-') || 'our-wedding';
    const list = [base, pair.join('-weds-'), base + '-' + y, base + yy, pair[0] + '-and-' + pair[1], [g, gl, b, bl].filter(Boolean).slice(0, 3).join('-'), 'the-' + base, base + '-wedding'];
    return Array.from(new Set(list.map(slugify).filter(s => SLUG_RE.test(s))));
  }

  /** Publish checklist: what is still missing, in friendly language. */
  function checklist(result) {
    const items = [];
    const steps = { couple: 1, welcome: 1, wedding: 2, events: 2, venue: 3, reception: 3, dress: 3, transport: 3, accommodation: 3, gifts: 3, photos: 4, music: 4, palette: 5, font: 5, lang: 6, i18n: 6, rsvp: 7, access: 7 };
    for (const e of result.errors) items.push({ kind: 'error', path: e.path, msg: e.msg, step: steps[e.path.split('.')[0]] || 1 });
    const byLang = {};
    for (const t of result.translations) (byLang[t.lang] = byLang[t.lang] || []).push(t);
    for (const [l, list] of Object.entries(byLang)) items.push({ kind: 'translation', path: 'i18n.' + l, msg: `${I18N.LANGS[l].name}: ${list.length} ${list.length === 1 ? 'item is' : 'items are'} not translated yet. Guests will see your main language there.`, step: 6 });
    return items;
  }

  return {
    PALETTES, PALETTE_BY_ID, buildPalette, contrast, ensureContrast, mix, hexToRgb, isDark,
    FONTS, FONT_BY_ID, scriptFontFor, googleFontsHref, MUSIC, TOGGLES, TOGGLE_LABELS, LIMITS,
    SAMPLE, BLANK_VENUE, validate, cleanText, cleanName, cleanPhone, properCase, EMAIL_RE, SLUG_RE, slugify, slugSuggestions,
    zonedToUtc, fmtDate, fmtTime, fmtNum, txt, eventName, fillNames, parentLine, schedule, mapsLinks, icsFor, getPath,
    translatableFields, checklist, validDate, validTime, validTz, isImage, isAudio, I18N,
  };
});
