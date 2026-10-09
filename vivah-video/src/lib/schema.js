import { PRESETS, THEMES, STORY_LIBRARY } from './themes.js';
import { LANGUAGES } from './i18n.js';

export const LIMITS = { name: 40, initial: 3, line: 120, block: 600, tagline: 60, title: 50, timing: 60, venue: 80, address: 160, events: 12, stories: 6, families: 6, rsvp: 6, timings: 5, greeting: 6 };
export const SAMPLE = {
  version: 1,
  meta: { lang: 'en', order: 'bride_first', palette: 'soft', logoUpload: '', music: { src: '', volume: 0.85 } },
  couple: { bride: 'Meera', groom: 'Arjun', brideInitial: '', groomInitial: '' },
  opener: { coverLine: '12 December 2026', coverVenue: 'Jaipur, Rajasthan', greeting: [{ text: 'A celebration of two families', style: 'sans' }, { text: 'Meera & Arjun', style: 'display' }] },
  blessing: { icons: ['ganesha'], invocations: ['॥ श्री गणेशाय नमः ॥'], text: 'With the blessings of our elders' },
  hosts: { request: 'request the honour of your presence\nat the wedding celebrations of', relationWord: 'their beloved children' },
  brideFamily: { parents: 'The Sharma Family', relation: 'Daughter of the Sharma Family', address: 'Jaipur, Rajasthan' },
  groomFamily: { parents: 'The Verma Family', relation: 'Son of the Verma Family', address: 'Jaipur, Rajasthan' },
  mainCard: { dateLine: '12 December 2026', venueLine: 'The Riwaayat Haveli · Jaipur' },
  events: [
    { id: 'e1', preset: 'mehendi', theme: 'mayra', title: 'Mehendi', tagline: 'A garden of new beginnings', date: '2026-12-11', timings: [{ label: 'Gathering', time: '4:00 PM' }], venue: 'The Riwaayat Haveli', address: 'Jaipur, Rajasthan', dressCode: '', holdSec: 4.8 },
    { id: 'e2', preset: 'sangeet', theme: 'sangeet', title: 'Haldi & Sangeet', tagline: 'Music, colour and joy', date: '2026-12-11', timings: [{ label: 'Haldi', time: '10:00 AM' }, { label: 'Sangeet', time: '7:00 PM' }], venue: 'The Riwaayat Haveli', address: 'Jaipur, Rajasthan', dressCode: '', holdSec: 4.8 },
    { id: 'e3', preset: 'wedding', theme: 'varmala', title: 'Wedding Ceremony', tagline: 'Two hearts, one beautiful beginning', date: '2026-12-12', timings: [{ label: 'Baraat', time: '5:30 PM' }, { label: 'Pheras', time: '8:00 PM' }], venue: 'The Riwaayat Haveli', address: 'Jaipur, Rajasthan', dressCode: '', holdSec: 5.2 },
  ],
  stories: [
    { id: 's1', scene: 'mandap', after: 'e2', holdSec: 5.4 },
    { id: 's2', scene: 'couple', after: 'e3', holdSec: 5.4 },
  ],
  closing: { title: 'With joy', blessing: 'The Sharma & Verma Families', celebrating: 'Look forward to celebrating with you', families: [], rsvp: [], mapLink: '', qrCode: '', holdSec: 6.05 },
  timing: { openerHoldSec: 4.9, logoHoldSec: 4.8, mainHoldSec: 6.0, endHoldSec: 2.2 },
};
const str = (v, max, fallback = '') => typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').slice(0, max) : fallback;
const num = (v, min, max, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const arr = (v, max) => Array.isArray(v) ? v.slice(0, max) : [];
const validId = (v, i, prefix) => typeof v === 'string' && /^[a-z0-9_-]{1,24}$/i.test(v) ? v : `${prefix}${i + 1}`;
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
  const m = d.meta || {}, c = d.couple || {}, o = d.opener || {}, b = d.blessing || {}, h = d.hosts || {};
  const bf = d.brideFamily || {}, gf = d.groomFamily || {}, mc = d.mainCard || {}, cl = d.closing || {}, tm = d.timing || {};
  const events = arr(d.events, LIMITS.events).map((e, i) => {
    const preset = PRESETS[e?.preset] ? e.preset : 'custom';
    return { id: validId(e?.id, i, 'e'), preset, theme: THEMES[e?.theme] ? e.theme : PRESETS[preset].theme, propSet: '', title: str(e?.title, LIMITS.title, PRESETS[preset].title), tagline: str(e?.tagline, LIMITS.tagline), date: /^\d{4}-\d{2}-\d{2}$/.test(e?.date) ? e.date : '', timings: arr(e?.timings, LIMITS.timings).map((x) => ({ label: str(x?.label, LIMITS.timing), time: str(x?.time, LIMITS.timing) })).filter((x) => x.label || x.time), venue: str(e?.venue, LIMITS.venue), address: str(e?.address, LIMITS.address), dressCode: str(e?.dressCode, LIMITS.venue), holdSec: num(e?.holdSec, 2.5, 15, 5) };
  });
  const eventIds = new Set(events.map((e) => e.id));
  const stories = arr(d.stories, LIMITS.stories).filter((s) => s && STORY_LIBRARY[s.scene]).map((s, i) => {
    const lib = STORY_LIBRARY[s.scene];
    return { id: validId(s.id, i, 's'), scene: s.scene, after: s.after === 'main' || eventIds.has(s.after) ? s.after : (events[0]?.id || 'main'), src: lib.src, poster: lib.poster, clipSec: lib.clipSec, holdSec: num(s.holdSec, 2.5, 12, 5), focus: lib.focus, frameSeq: s.frameSeq && media(s.frameSeq.base) ? { base: media(s.frameSeq.base), count: num(s.frameSeq.count, 0, 2000, 0), fps: num(s.frameSeq.fps, 1, 60, 30) } : null };
  });
  return {
    version: 1,
    meta: { lang: LANGUAGES[m.lang] ? m.lang : 'en', order: m.order === 'groom_first' ? 'groom_first' : 'bride_first', palette: m.palette === 'maroon_gold' ? 'maroon_gold' : 'soft', logoUpload: media(m.logoUpload), music: { src: media(m.music?.src), volume: num(m.music?.volume, 0, 1, .85) } },
    couple: { bride: str(c.bride, LIMITS.name, 'Bride'), groom: str(c.groom, LIMITS.name, 'Groom'), brideInitial: str(c.brideInitial, LIMITS.initial) || (str(c.bride, LIMITS.name) || 'B').trim().charAt(0), groomInitial: str(c.groomInitial, LIMITS.initial) || (str(c.groom, LIMITS.name) || 'G').trim().charAt(0) },
    opener: { coverLine: str(o.coverLine, LIMITS.line), coverVenue: str(o.coverVenue, LIMITS.line), greeting: arr(o.greeting, LIMITS.greeting).map((g) => ({ text: str(g?.text, 40), style: g?.style === 'display' ? 'display' : 'sans' })).filter((g) => g.text) },
    blessing: { icons: arr(b.icons, 2).filter((x) => x === 'ganesha' || x === 'kalash'), invocations: arr(b.invocations, 2).map((x) => str(x, 60)).filter(Boolean), text: str(b.text, LIMITS.block) },
    hosts: { request: str(h.request, LIMITS.block), relationWord: str(h.relationWord, LIMITS.line) },
    brideFamily: { parents: str(bf.parents, LIMITS.line), relation: str(bf.relation, LIMITS.line), address: str(bf.address, LIMITS.address) },
    groomFamily: { parents: str(gf.parents, LIMITS.line), relation: str(gf.relation, LIMITS.line), address: str(gf.address, LIMITS.address) },
    mainCard: { dateLine: str(mc.dateLine, LIMITS.line), venueLine: str(mc.venueLine, LIMITS.line) },
    events, stories,
    closing: { title: str(cl.title, LIMITS.title), blessing: str(cl.blessing, LIMITS.block), celebrating: str(cl.celebrating, LIMITS.block), families: arr(cl.families, LIMITS.families).map((f) => ({ heading: str(f?.heading, LIMITS.line), names: str(f?.names, LIMITS.block) })).filter((f) => f.heading || f.names), rsvp: arr(cl.rsvp, LIMITS.rsvp).map((r) => ({ name: str(r?.name, LIMITS.name), phone: str(r?.phone, 20).replace(/[^\d+\-\s()]/g, '') })).filter((r) => r.name || r.phone), mapLink: /^https:\/\//i.test(cl.mapLink || '') ? str(cl.mapLink, 300) : '', qrCode: media(cl.qrCode), holdSec: num(cl.holdSec, 3, 15, 4.6) },
    timing: { openerHoldSec: num(tm.openerHoldSec, 3, 12, 4.9), logoHoldSec: num(tm.logoHoldSec, 3, 12, 4.8), mainHoldSec: num(tm.mainHoldSec, 3, 15, 6), endHoldSec: num(tm.endHoldSec, 1.5, 6, 2.2) },
  };
}
export function validate(input) {
  const errors = [], d = input || {};
  if (!String(d.couple?.bride || '').trim()) errors.push('Bride name is required.');
  if (!String(d.couple?.groom || '').trim()) errors.push('Groom name is required.');
  (d.events || []).forEach((e, i) => { if (!String(e.title || '').trim()) errors.push(`Event ${i + 1}: title is required.`); if (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.push(`Event ${i + 1}: date must be YYYY-MM-DD.`); });
  if ((d.stories || []).length > LIMITS.stories) errors.push(`At most ${LIMITS.stories} story scenes.`);
  return errors;
}
