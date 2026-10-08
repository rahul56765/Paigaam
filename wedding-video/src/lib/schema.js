// Invitation data model: defaults, the reference sample, and normalisation.
// normalize() is the single gate used by the composition, the editor and the
// server, so every render sees clean, length-limited data.

import { PRESETS, THEMES, LANDMARKS } from './themes.js';
import { LANGUAGES } from './i18n.js';

export const LIMITS = {
  name: 40, initial: 3, line: 120, block: 600, tagline: 60, title: 50, timing: 60, venue: 80, address: 160,
  events: 12, stories: 6, families: 6, rsvp: 6, timings: 5, greeting: 6,
};

export const SAMPLE = {
  version: 1,
  meta: { lang: 'en', order: 'bride_first', landmark: 'taj', music: { src: '', volume: 0.9 }, rsvpUrl: '', rsvpOnEndCard: false, brandLogo: '' },
  couple: { bride: 'Shravi', groom: 'Lakshya', brideInitial: 'S', groomInitial: 'L' },
  opener: {
    coverLine: '1st & 2nd November 2025',
    coverVenue: 'Jaypee Palace, Agra',
    greeting: [
      { text: 'Pyar ke lambe', style: 'sans' },
      { text: 'match mein', style: 'display' },
      { text: 'Donon clean', style: 'sans' },
      { text: 'bowled.', style: 'display' },
    ],
  },
  blessing: {
    icons: ['ganesha', 'kalash'],
    invocations: ['|| श्री गणेशाय नमः ||', '|| शुभ विवाह ||'],
    text: 'With the divine blessings of our beloved elders,\nLate Smt. Kevda Rani & Late Shri Kamal Chand Ji Jadia',
  },
  hosts: {
    request: 'request the honour of your presence at\nthe wedding celebrations of their',
    relationWord: 'beloved daughter',
  },
  brideFamily: { parents: 'Mrs. Anju & Mr. Deepak Jain', relation: 'Daughter of Mrs. Anju & Mr. Deepak Jain', address: '' },
  groomFamily: { parents: 'Mrs. Kamlesh & Mr. Chanan Dawra', relation: 'Son of Mrs. Kamlesh & Mr. Chanan Dawra', address: '' },
  mainCard: { dateLine: '1st & 2nd November 2025', venueLine: 'Jaypee Palace, Agra' },
  events: [
    { id: 'e1', preset: 'haldi', theme: 'haldi', title: 'Haldi & Mehendi', tagline: 'Rang Chadeya Sajna Te', date: '2025-11-01',
      timings: [{ label: '', time: '10:30 AM onwards' }], venue: 'Swiss Hills', address: 'Jaypee Palace, Agra', dressCode: '', holdSec: 6.7 },
    { id: 'e2', preset: 'sangeet', theme: 'sangeet', title: 'Engagement & Sangeet', tagline: 'Nach De Ne Saare', date: '2025-11-01',
      timings: [{ label: 'Godhbharai & Tilak', time: '6:00 PM' }, { label: 'Ring Ceremony', time: '7:30 PM' }, { label: 'Sangeet', time: '8:00 PM onwards' }],
      venue: 'Tennis Court', address: 'Jaypee Palace, Agra', dressCode: '', holdSec: 6.6 },
    { id: 'e3', preset: 'mayra', theme: 'mayra', title: 'Myraa', tagline: 'Bhaat Bharan Ne Aayo', date: '2025-11-02',
      timings: [{ label: '', time: '11:00 AM onwards' }], venue: 'Diwan-E-Aam', address: 'Jaypee Palace, Agra', dressCode: '', holdSec: 8.0 },
    { id: 'e4', preset: 'wedding', theme: 'baraat', title: 'Wedding', tagline: 'Taaron Ki Baraat', date: '2025-11-02',
      timings: [{ label: 'Baraat Swagat', time: '7:00 PM' }, { label: 'Reception', time: '7:30 PM' }, { label: 'Pheras', time: '11:00 PM' }],
      venue: 'Green Valley', address: 'Jaypee Palace, Agra', dressCode: '', holdSec: 6.0 },
  ],
  // Stories play after the event named in `after` ('main' = before the first event).
  stories: [
    { id: 's1', clipSec: 3.2, after: 'e1', src: 'sample/story1.mp4', caption: 'First bike ride', holdSec: 4.8, focus: [0.5, 0.6] },
    { id: 's2', clipSec: 4.1, after: 'e1', src: 'sample/story2.mp4', caption: 'The proposal', holdSec: 4.2, focus: [0.5, 0.6] },
    { id: 's3', clipSec: 3.6, after: 'e3', src: 'sample/story3.mp4', caption: "Maa's blessing", holdSec: 5.8, focus: [0.62, 0.7] },
    { id: 's4', clipSec: 2.8, after: 'e3', src: 'sample/story4.mp4', caption: 'Walking with Papa', holdSec: 2.9, focus: [0.5, 0.72] },
  ],
  closing: {
    title: 'Sharing the Joy',
    blessing: 'Together with their love & blessings:\nMrs. Vandana & Mr. Alok Jain',
    celebrating: 'Looking forward to celebrating:\nSimoni & Prakhar',
    families: [
      { heading: 'Nanihal Paksh', names: 'Smt. Saran Kumari Jindani &\nLate Shri Navratan Singh Ji Jindani\nMrs. Shelly & Mr. Neeraj Jain\nNandini & Naman' },
    ],
    rsvp: [{ name: 'Anju Jain', phone: '8957136625' }, { name: 'Deepak Jain', phone: '9415785393' }],
    mapLink: '',
    holdSec: 5.8,
  },
  timing: { openerHoldSec: 11.2, mainHoldSec: 6.6, endHoldSec: 2.43 },
};

const str = (v, max, fallback = '') => {
  if (typeof v !== 'string') return fallback;
  // strip control chars except newlines; collapse >3 consecutive newlines
  const s = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n');
  return s.slice(0, max);
};
const num = (v, min, max, fallback) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const id = (v, i, p) => (typeof v === 'string' && /^[a-z0-9_-]{1,24}$/i.test(v) ? v : `${p}${i + 1}`);
// Media may be a relative asset path, a same-origin /path, or an https URL.
// allowLocal is only set by the render worker for files it serves itself.
let ALLOW_LOCAL = false;
const media = (v) => {
  const s = str(v, 500);
  if (!s) return '';
  if (ALLOW_LOCAL && /^http:\/\/127\.0\.0\.1:\d+\/[\w\-./]*$/.test(s)) return s;
  if (/^https:\/\//i.test(s) || /^\/[\w\-./%]+$/.test(s) || /^[\w\-]+\/[\w\-./]+$/.test(s)) return s;
  return '';
};

export function normalize(input, opts = {}) {
  ALLOW_LOCAL = !!opts.allowLocal;
  try { return normalizeInner(input); } finally { ALLOW_LOCAL = false; }
}

function normalizeInner(input) {
  const d = input && typeof input === 'object' ? input : {};
  const m = d.meta || {};
  const c = d.couple || {};
  const o = d.opener || {};
  const b = d.blessing || {};
  const h = d.hosts || {};
  const bf = d.brideFamily || {};
  const gf = d.groomFamily || {};
  const mc = d.mainCard || {};
  const cl = d.closing || {};
  const tm = d.timing || {};
  const L = LIMITS;

  const events = arr(d.events, L.events).map((e, i) => {
    const preset = PRESETS[e && e.preset] ? e.preset : 'custom';
    const theme = THEMES[e && e.theme] ? e.theme : PRESETS[preset].theme;
    return {
      id: id(e && e.id, i, 'e'),
      preset,
      theme,
      propSet: THEMES[e && e.propSet] ? e.propSet : '',
      title: str(e && e.title, L.title, PRESETS[preset].title),
      tagline: str(e && e.tagline, L.tagline, ''),
      date: /^\d{4}-\d{2}-\d{2}$/.test(e && e.date) ? e.date : '',
      timings: arr(e && e.timings, L.timings).map((x) => ({ label: str(x && x.label, L.timing), time: str(x && x.time, L.timing) })).filter((x) => x.label || x.time),
      venue: str(e && e.venue, L.venue),
      address: str(e && e.address, L.address),
      dressCode: str(e && e.dressCode, L.venue),
      holdSec: num(e && e.holdSec, 2.5, 15, 6.0),
    };
  });
  const eventIds = new Set(events.map((e) => e.id));

  const stories = arr(d.stories, L.stories)
    .map((s, i) => ({
      id: id(s && s.id, i, 's'),
      after: s && (s.after === 'main' || eventIds.has(s.after)) ? s.after : events.length ? events[events.length - 1].id : 'main',
      src: media(s && s.src),
      poster: media(s && s.poster),
      caption: str(s && s.caption, L.line),
      holdSec: num(s && s.holdSec, 2.5, 12, 6.0),
      clipSec: num(s && s.clipSec, 1, 30, 8),
      frameSeq: s && s.frameSeq && media(s.frameSeq.base) ? { base: media(s.frameSeq.base), count: num(s.frameSeq.count, 0, 2000, 0), fps: num(s.frameSeq.fps, 1, 60, 30) } : null,
      focus: Array.isArray(s && s.focus) && s.focus.length === 2 ? [num(s.focus[0], 0, 1, 0.5), num(s.focus[1], 0, 1, 0.6)] : [0.5, 0.6],
    }))
    .filter((s) => s.src);

  return {
    version: 1,
    meta: {
      lang: LANGUAGES[m.lang] ? m.lang : 'en',
      order: m.order === 'groom_first' ? 'groom_first' : 'bride_first',
      landmark: LANDMARKS[m.landmark] ? m.landmark : 'taj',
      music: { src: media(m.music && m.music.src), volume: num(m.music && m.music.volume, 0, 1, 0.9) },
      rsvpUrl: /^https?:\/\//i.test(m.rsvpUrl || '') ? str(m.rsvpUrl, 300) : '',
      rsvpOnEndCard: !!m.rsvpOnEndCard,
      brandLogo: media(m.brandLogo),
    },
    couple: {
      bride: str(c.bride, L.name, 'Bride'),
      groom: str(c.groom, L.name, 'Groom'),
      brideInitial: str(c.brideInitial, L.initial) || (str(c.bride, L.name) || 'B').trim().charAt(0),
      groomInitial: str(c.groomInitial, L.initial) || (str(c.groom, L.name) || 'G').trim().charAt(0),
    },
    opener: {
      coverLine: str(o.coverLine, L.line),
      coverVenue: str(o.coverVenue, L.line),
      greeting: arr(o.greeting, L.greeting).map((g) => ({ text: str(g && g.text, 40), style: g && g.style === 'display' ? 'display' : 'sans' })).filter((g) => g.text),
    },
    blessing: {
      icons: arr(b.icons, 2).filter((x) => x === 'ganesha' || x === 'kalash'),
      invocations: arr(b.invocations, 2).map((x) => str(x, 60)).filter(Boolean),
      text: str(b.text, L.block),
    },
    hosts: { request: str(h.request, L.block), relationWord: str(h.relationWord, L.line) },
    brideFamily: { parents: str(bf.parents, L.line), relation: str(bf.relation, L.line), address: str(bf.address, L.address) },
    groomFamily: { parents: str(gf.parents, L.line), relation: str(gf.relation, L.line), address: str(gf.address, L.address) },
    mainCard: { dateLine: str(mc.dateLine, L.line), venueLine: str(mc.venueLine, L.line) },
    events,
    stories,
    closing: {
      title: str(cl.title, L.title, ''),
      blessing: str(cl.blessing, L.block),
      celebrating: str(cl.celebrating, L.block),
      families: arr(cl.families, L.families).map((f) => ({ heading: str(f && f.heading, L.line), names: str(f && f.names, L.block) })).filter((f) => f.heading || f.names),
      rsvp: arr(cl.rsvp, L.rsvp).map((r) => ({ name: str(r && r.name, L.name), phone: str(r && r.phone, 20).replace(/[^\d+\-\s()]/g, '') })).filter((r) => r.name || r.phone),
      mapLink: /^https:\/\//i.test(cl.mapLink || '') ? str(cl.mapLink, 300) : '',
      holdSec: num(cl.holdSec, 3, 15, 5.8),
    },
    timing: {
      openerHoldSec: num(tm.openerHoldSec, 6, 16, 11.2),
      mainHoldSec: num(tm.mainHoldSec, 3, 15, 6.6),
      endHoldSec: num(tm.endHoldSec, 1.5, 6, 2.43),
    },
  };
}

// Human-readable problems for the editor (normalize() already made data safe).
export function validate(input) {
  const errors = [];
  const d = input || {};
  if (!d.couple || !String(d.couple.bride || '').trim()) errors.push('Bride name is required.');
  if (!d.couple || !String(d.couple.groom || '').trim()) errors.push('Groom name is required.');
  (d.events || []).forEach((e, i) => {
    if (!String(e.title || '').trim()) errors.push(`Event ${i + 1}: title is required.`);
    if (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`Event ${i + 1}: date must be YYYY-MM-DD.`);
  });
  if ((d.stories || []).length > LIMITS.stories) errors.push(`At most ${LIMITS.stories} story clips.`);
  return errors;
}
