'use strict';
/**
 * Shaadi Paigaam routes — the wedding invitation website + its customizer.
 *
 *   GET  /create/shaadi-paigaam[?id=]            the step-by-step editor (pages/shaadiPaigaamCreate.js)
 *   GET  /shaadi-paigaam/demo[?palette=&lang=&skip=1]  public sample (Aarav & Ananya)
 *   GET  /shaadi-paigaam/frame                   editor live-preview frame (data arrives by postMessage)
 *   GET  /shaadi-paigaam/preview/:id             owner-only preview (badge)
 *   GET  /shaadi-paigaam/manage/:token           private dashboard link (works on any device)
 *   GET  /shaadi-paigaam/media/<file>            uploads: public once published, else owner/admin
 *   GET  /shaadi-paigaam/card/:id.jpg[?kind=og|story]  WhatsApp/OG card and Instagram-story cover
 *   GET  /shaadi-paigaam/qr/:id.(svg|png)        QR code of the short link
 *   GET  /shaadi-paigaam/rsvps/:id.csv           owner CSV export
 *   POST /shaadi-paigaam/unlock/:id              passcode gate
 *   GET  /<short-link>                           a published invitation (paigaam.cc/aarav-ananya)
 *   GET  /p/<short-link>                         → 301 to /<short-link>
 *   API  /api/shaadi-paigaam/{draft,upload,publish,slug,places,reverse,translate,versions,restore,rsvps,rsvp/:id,me}
 *
 * Ownership: the shared paigaam_creator cookie (this device) OR the secret
 * manage token (any device). Published invitations are edited through a
 * pending copy; "Update live invitation" validates and applies it instantly
 * (same link), snapshotting a version for restore.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db, q, DATA_DIR, PERSISTENT } = require('../db');
const C = require('../public/shaadi-paigaam/core.js');
const { renderInvitation, renderGate, renderEnded, names } = require('../templates/shaadi-paigaam/render');
const { checkImage, sniffImage } = require('./bfday/image');
const { streamFile } = require('./streamFile');

const SLUG = 'shaadi-paigaam';
const COOKIE = 'paigaam_creator';
const uploadDir = path.join(DATA_DIR, 'shaadi-paigaam-uploads');
const cardDir = path.join(DATA_DIR, 'shaadi-paigaam-cards');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(cardDir, { recursive: true });

db.exec(`CREATE TABLE IF NOT EXISTS sp_owners (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE,
 owner_hash TEXT NOT NULL, manage_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sp_owner_idx ON sp_owners(owner_hash);
CREATE INDEX IF NOT EXISTS sp_manage_idx ON sp_owners(manage_hash);
CREATE TABLE IF NOT EXISTS sp_pending (
 paigaam_id TEXT PRIMARY KEY REFERENCES paigaams(id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sp_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 data TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sp_versions_idx ON sp_versions(paigaam_id, id);
CREATE TABLE IF NOT EXISTS sp_uploads (
 filename TEXT PRIMARY KEY, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sp_upload_inv ON sp_uploads(paigaam_id);
CREATE TABLE IF NOT EXISTS sp_rsvps (
 id INTEGER PRIMARY KEY AUTOINCREMENT, paigaam_id TEXT NOT NULL REFERENCES paigaams(id) ON DELETE CASCADE,
 name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', attending TEXT NOT NULL,
 guests INTEGER NOT NULL DEFAULT 0, meal TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT '',
 ip_hash TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sp_rsvp_inv ON sp_rsvps(paigaam_id);`);

class InputError extends Error { constructor(code = 'validation', status = 400, extra) { super(code); this.code = code; this.status = status; this.extra = extra; } }
const LIMITS = { photo: 2.5 * 1024 * 1024, music: 10 * 1024 * 1024 };
const PER_DRAFT = { photo: 40, music: 8 };
const POOL_BYTES = (Number(process.env.SP_UPLOAD_POOL_MB) || 4096) * 1024 * 1024;
const DRAFTS_PER_DAY = 12;
const LOCAL = ['localhost', '127.0.0.1', '::1'];
const IMAGE_MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const AUDIO_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', aac: 'audio/aac' };
const SECRET = (() => {
  if (process.env.SP_SECRET) return process.env.SP_SECRET;
  const f = path.join(DATA_DIR, '.shaadi-paigaam-secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch {}
  const s = crypto.randomBytes(32).toString('hex'); try { fs.writeFileSync(f, s, { mode: 0o600 }); } catch {} return s;
})();
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = s => crypto.createHmac('sha256', SECRET).update(String(s)).digest('hex').slice(0, 40);

/* ------------------------------------------------------------ reserved short links */
const RESERVED = new Set(['create', 'p', 'preview', 'api', 'admin', 'templates', 'template-view', 'occasions', 'contact', 'privacy', 'terms', 'refund',
  'sitemap', 'robots', 'go', 'pay', 'recover', 'health', 'healthz', 'magazines', 'magazine', 'login', 'logout', 'signup', 'account', 'dashboard', 'help', 'about',
  'blog', 'static', 'assets', 'media', 'public', 'css', 'js', 'brand', 'favicon', 'shaadi', 'wedding', 'weddings', 'invite', 'invitation', 'paigaam', 'support', 'www', 'mail', 'app']);
function reservedNames() {
  const s = new Set(RESERVED);
  try { for (const f of fs.readdirSync(path.join(__dirname, '../public'))) s.add(f.replace(/\.[a-z0-9]+$/i, '').toLowerCase()); } catch {}
  try { for (const t of require('../templates/registry').TEMPLATES) s.add(t.slug); } catch {}
  try { for (const o of require('./occasions').OCCASIONS) s.add(o.slug); } catch {}
  return s;
}
let reservedCache = null;
const isReserved = slug => (reservedCache = reservedCache || reservedNames()).has(slug);

/* ------------------------------------------------------------ helpers */
function cookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }
  return out;
}
function owner(req) { const v = cookies(req)[COOKIE] || ''; return /^[a-f0-9]{64}$/.test(v) ? sha(v) : null; }
function owned(req, id) {
  const row = db.prepare('SELECT owner_hash, manage_hash FROM sp_owners WHERE paigaam_id=?').get(id);
  if (!row) return false;
  const h = owner(req);
  if (h && row.owner_hash === h) return true;
  const m = cookies(req)['sp_m_' + id];
  return !!m && /^[a-f0-9]{48}$/.test(m) && sha(m) === row.manage_hash;
}
function secure(baseUrl) { return new URL(baseUrl).protocol === 'https:' ? '; Secure' : ''; }
function reply(res, status, value, headers = {}) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, headers));
  res.end(JSON.stringify(value));
}
function html(res, body, cache = 'private, no-store', status = 200, extra = {}) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }, extra));
  res.end(body);
}
async function read(req, limit) {
  const declared = Number(req.headers['content-length']);
  if (declared > limit) { req.resume(); throw new InputError('too_large', 413); }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new InputError('too_large', 413); chunks.push(c); }
  return Buffer.concat(chunks);
}
async function jsonBody(req, limit = 262144) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new InputError();
  try { return JSON.parse((await read(req, limit)).toString('utf8')); } catch (e) { if (e instanceof InputError) throw e; throw new InputError(); }
}
async function formBody(req) {
  const raw = (await read(req, 4096)).toString('utf8'); const out = {};
  for (const pair of raw.split('&')) { const i = pair.indexOf('='); if (i > 0) out[decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' ')); }
  return out;
}
function csrf(req, base) {
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== new URL(base).origin)) throw new InputError('forbidden', 403);
}
const ip = req => String((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown');
const buckets = new Map();
function limit(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 20000) buckets.clear();
  let b = buckets.get(key);
  if (!b || b.until < now) b = { n: 0, until: now + windowMs };
  b.n++; buckets.set(key, b);
  if (b.n > max) throw new InputError('limit', 429);
}

function sniffAudio(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
  if (buf.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  if (buf[0] === 0xFF && (buf[1] & 0xF6) === 0xF0) return 'aac';
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return 'mp3';
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'm4a';
  if (buf.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return 'wav';
  return null;
}
function mediaIn(d) {
  const out = d.photos.map(p => p.url);
  if (d.couplePhoto) out.push(d.couplePhoto.url);
  if (d.music.url) out.push(d.music.url);
  return out.filter(u => u.startsWith('/' + SLUG + '/media/'));
}
function assertOwnMedia(d, id) {
  for (const url of mediaIn(d)) {
    const row = db.prepare('SELECT paigaam_id FROM sp_uploads WHERE filename=?').get(path.basename(url));
    if (!row || row.paigaam_id !== id) throw new InputError('validation');
  }
}
/** Strip media this request isn't allowed to reference (instead of failing a whole autosave). */
function dropForeignMedia(d, id) {
  const ok = url => { if (!url.startsWith('/' + SLUG + '/media/')) return true; const row = db.prepare('SELECT paigaam_id FROM sp_uploads WHERE filename=?').get(path.basename(url)); return !!row && row.paigaam_id === id; };
  d.photos = d.photos.filter(p => ok(p.url));
  if (d.couplePhoto && !ok(d.couplePhoto.url)) d.couplePhoto = null;
  if (d.music.url && !ok(d.music.url)) { d.music.url = ''; if (d.music.track === 'upload') d.music.track = 'shehnai-dawn'; }
  return d;
}
function sweepUploads(id, keepData, minAgeMs) {
  const keep = new Set();
  for (const d of keepData) for (const u of mediaIn(d)) keep.add(path.basename(u));
  for (const v of db.prepare('SELECT data FROM sp_versions WHERE paigaam_id=?').all(id)) { try { for (const u of mediaIn(C.validate(JSON.parse(v.data), { allowPast: true }).data)) keep.add(path.basename(u)); } catch {} }
  const cutoff = Date.now() - minAgeMs;
  for (const row of db.prepare('SELECT filename, created_at FROM sp_uploads WHERE paigaam_id=?').all(id)) {
    if (!keep.has(row.filename) && row.created_at < cutoff) { fs.rmSync(path.join(uploadDir, row.filename), { force: true }); db.prepare('DELETE FROM sp_uploads WHERE filename=?').run(row.filename); }
  }
}
function sweepOrphans() {
  try { for (const f of fs.readdirSync(uploadDir)) if (!db.prepare('SELECT 1 FROM sp_uploads WHERE filename=?').get(f)) fs.rmSync(path.join(uploadDir, f), { force: true }); }
  catch (e) { console.error('[shaadi-paigaam] orphan sweep:', e.message); }
}
sweepOrphans();
setInterval(sweepOrphans, 6 * 3600 * 1000).unref();

const isLive = pg => !!pg && ['published', 'active'].includes(pg.status);
const clean = (raw, opts) => C.validate(raw || {}, Object.assign({ allowPast: true }, opts)).data;
function pendingOf(id) { const r = db.prepare('SELECT data FROM sp_pending WHERE paigaam_id=?').get(id); try { return r ? JSON.parse(r.data) : null; } catch { return null; } }
function workingData(pg) { return (isLive(pg) && pendingOf(pg.id)) || pg.customer_data || {}; }
function snapshot(id, data, note) {
  db.prepare('INSERT INTO sp_versions (paigaam_id, data, note, created_at) VALUES (?,?,?,?)').run(id, JSON.stringify(data), note || '', Date.now());
  const ids = db.prepare('SELECT id FROM sp_versions WHERE paigaam_id=? ORDER BY id DESC LIMIT -1 OFFSET 40').all(id);
  for (const r of ids) db.prepare('DELETE FROM sp_versions WHERE id=?').run(r.id);
}
function shortUrl(baseUrl, slug) { return baseUrl.replace(/\/$/, '') + '/' + slug; }
function weddingEndMs(d) { return d.wedding.date ? C.zonedToUtc(d.wedding.date, d.wedding.time || '00:00', d.wedding.tz) : 0; }

/* ------------------------------------------------------------ short links */
function slugStatus(s, id) {
  const slug = String(s || '').toLowerCase().trim();
  if (!C.SLUG_RE.test(slug)) return { slug, available: false, reason: 'format' };
  if (isReserved(slug)) return { slug, available: false, reason: 'reserved' };
  const pg = q.paigaamBySlug(slug);
  if (pg && pg.id !== id) return { slug, available: false, reason: 'taken' };
  return { slug, available: true };
}
function suggest(data, id, wanted) {
  const base = C.slugSuggestions(data);
  if (wanted && C.SLUG_RE.test(wanted)) base.unshift(wanted);
  const out = [];
  for (const s of base) { if (slugStatus(s, id).available) out.push(s); if (out.length >= 4) break; }
  for (let n = 2; out.length < 4 && n < 60; n++) { const s = (base[0] || 'our-wedding') + '-' + n; if (slugStatus(s, id).available) out.push(s); }
  return Array.from(new Set(out)).filter(s => s !== wanted).slice(0, 4);
}

/* ------------------------------------------------------------ maps provider (OSM now, Google with a key) */
const GKEY = () => process.env.GOOGLE_MAPS_API_KEY || '';
const geoCache = new Map(); let lastNominatim = 0;
async function nominatim(url) {
  const wait = Math.max(0, lastNominatim + 1100 - Date.now()); lastNominatim = Date.now() + wait;
  if (wait) await new Promise(r => setTimeout(r, wait));
  const r = await fetch(url, { headers: { 'User-Agent': 'Paigaam/1.0 (+https://paigaam.cc; hello@paigaam.cc)', 'Accept-Language': 'en-IN,en' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('geocoder ' + r.status);
  return r.json();
}
function fromNominatim(x) {
  const a = x.address || {};
  const city = a.city || a.town || a.village || a.suburb || a.county || a.state_district || '';
  const name = x.name || (x.display_name || '').split(',')[0];
  const street = [a.house_number, a.road, a.neighbourhood || a.suburb].filter(Boolean).filter(v => v !== city && v !== name).join(', ');
  return { id: 'osm:' + x.osm_type + x.osm_id, name, address: street || (x.display_name || '').split(',').slice(1, 3).join(',').trim(), city, state: a.state || '', pin: (a.postcode || '').replace(/\s/g, ''), country: (a.country_code || 'in').toUpperCase(), lat: +(+x.lat).toFixed(6), lng: +(+x.lon).toFixed(6), label: x.display_name };
}
function fromPhoton(f) {
  const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
  const city = p.city || p.town || p.village || p.county || '';
  const street = [p.housenumber, p.street, p.district || p.locality].filter(Boolean).filter(x => x !== city && x !== p.name).join(', ');
  return { id: 'ph:' + p.osm_type + p.osm_id, name: p.name || p.street || city, address: street, city, state: p.state || '', pin: String(p.postcode || '').replace(/\s/g, ''), country: String(p.countrycode || '').toUpperCase(), lat: c[1] != null ? +c[1].toFixed(6) : null, lng: c[0] != null ? +c[0].toFixed(6) : null, label: [p.name, street, city, p.state].filter(Boolean).join(', ') };
}
function fromGoogle(p) {
  const comp = t => ((p.addressComponents || []).find(c => (c.types || []).includes(t)) || {});
  return { id: 'g:' + p.id, name: (p.displayName && p.displayName.text) || '', address: (p.formattedAddress || '').split(',').slice(0, -3).join(',').trim() || p.formattedAddress || '', city: comp('locality').longText || comp('administrative_area_level_2').longText || '', state: comp('administrative_area_level_1').longText || '', pin: (comp('postal_code').longText || '').replace(/\s/g, ''), country: (comp('country').shortText || 'IN').toUpperCase(), lat: p.location ? +p.location.latitude.toFixed(6) : null, lng: p.location ? +p.location.longitude.toFixed(6) : null, label: p.formattedAddress };
}
async function placesSearch(qs, country) {
  const key = (country || 'in') + '|' + qs.toLowerCase();
  const hit = geoCache.get(key); if (hit && hit.until > Date.now()) return hit.v;
  let v;
  if (GKEY()) {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY(), 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents' }, body: JSON.stringify({ textQuery: qs, regionCode: country === 'all' ? undefined : (country || 'in').toUpperCase(), maxResultCount: 6, languageCode: 'en' }), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('places ' + r.status);
    v = ((await r.json()).places || []).map(fromGoogle);
  } else {
    // Photon (OSM data, typo-tolerant, good at venues) first; Nominatim as the fallback.
    try {
      const bias = country === 'all' ? '' : '&lat=21&lon=78&location_bias_scale=0.2';
      const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(qs)}&limit=10&lang=en${bias}`, { headers: { 'User-Agent': 'Paigaam/1.0 (+https://paigaam.cc)' }, signal: AbortSignal.timeout(7000) });
      if (r.ok) v = ((await r.json()).features || []).map(fromPhoton).filter(x => country === 'all' || x.country === String(country || 'in').toUpperCase()).slice(0, 6);
    } catch (e) { v = null; }
    if (!v || !v.length) {
      const cc = country === 'all' ? '' : '&countrycodes=' + encodeURIComponent(country || 'in');
      v = (await nominatim(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6${cc}&q=${encodeURIComponent(qs)}`)).map(fromNominatim);
    }
  }
  if (geoCache.size > 2000) geoCache.clear();
  geoCache.set(key, { v, until: Date.now() + 864e5 });
  return v;
}
async function reverseGeocode(lat, lng) {
  if (GKEY()) {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GKEY()}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json(); const x = (j.results || [])[0]; if (!x) return null;
    const comp = t => ((x.address_components || []).find(c => c.types.includes(t)) || {});
    return { address: x.formatted_address.split(',').slice(0, -3).join(',').trim(), city: comp('locality').long_name || '', state: comp('administrative_area_level_1').long_name || '', pin: comp('postal_code').long_name || '', country: (comp('country').short_name || 'IN') };
  }
  const x = await nominatim(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
  if (!x || x.error) return null;
  const v = fromNominatim(x); return { address: v.address, city: v.city, state: v.state, pin: v.pin, country: v.country };
}

/* ------------------------------------------------------------ translation (MyMemory free, Google with a key) */
async function translateOne(text, from, to) {
  const protect = s => s.replace(/\{groom\}/g, 'XQGROOMQX').replace(/\{bride\}/g, 'XQBRIDEQX');
  const restore = s => s.replace(/XQGROOMQX/gi, '{groom}').replace(/XQBRIDEQX/gi, '{bride}');
  const src = protect(text);
  if (process.env.GOOGLE_TRANSLATE_API_KEY) {
    const r = await fetch('https://translation.googleapis.com/language/translate/v2?key=' + process.env.GOOGLE_TRANSLATE_API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: src, source: from, target: to, format: 'text' }), signal: AbortSignal.timeout(10000) });
    const j = await r.json(); return restore(((j.data || {}).translations || [])[0].translatedText || '');
  }
  const de = process.env.MYMEMORY_EMAIL ? '&de=' + encodeURIComponent(process.env.MYMEMORY_EMAIL) : '';
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(src)}&langpair=${from}|${to}${de}`, { signal: AbortSignal.timeout(10000) });
  const j = await r.json();
  if (j.responseStatus !== 200 && j.responseStatus !== '200') throw new Error('translate ' + j.responseStatus);
  return restore(String((j.responseData || {}).translatedText || '')).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

/* ------------------------------------------------------------ share card (sharp, optional) */
let sharp = null; try { sharp = require('sharp'); } catch { sharp = null; }
const FONT_DIR = path.join(__dirname, '../public/shaadi-paigaam/fonts');
async function shareCard(d, kind, baseUrl) {
  if (!sharp) throw new InputError('unavailable', 503);
  const W = kind === 'story' ? 1080 : 1200, H = kind === 'story' ? 1920 : 630;
  const b = C.buildPalette(d.palette).palette;
  const lang = d.lang.base;
  const nm = names(d, lang);
  const date = C.fmtDate(d.wedding.date, lang, 'full');
  const place = [d.venue.name, d.venue.city].filter(Boolean).join(', ');
  const xml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const photo = d.couplePhoto ? d.couplePhoto.url : (d.photos[0] && d.photos[0].url);
  const photoFile = photo ? (photo.startsWith('/' + SLUG + '/media/') ? path.join(uploadDir, path.basename(photo)) : path.join(__dirname, '../public', photo)) : '';
  const layers = [];
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="${b.bg}"/><stop offset="1" stop-color="${b.champagne}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${b.accent}" stroke-width="2"/><rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${b.accent}" stroke-width=".8"/></svg>`);
  let photoW = 0;
  if (photoFile && fs.existsSync(photoFile)) {
    if (kind === 'story') { photoW = 760; const ph = await sharp(photoFile).resize(760, 950, { fit: 'cover' }).composite([{ input: Buffer.from(`<svg width="760" height="950"><rect width="760" height="950" rx="380" ry="380" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer(); layers.push({ input: ph, left: 160, top: 260 }); }
    else { photoW = 470; const ph = await sharp(photoFile).resize(470, 582, { fit: 'cover' }).png().toBuffer(); layers.push({ input: ph, left: 24 + 0, top: 24 }); }
  }
  const text = async (markup, font, file, width, size) => sharp({ text: { text: markup, font: `${font} ${size}`, fontfile: path.join(FONT_DIR, file), width, align: 'centre', rgba: true, wrap: 'word', dpi: 72 } }).png().toBuffer();
  const colA = `color="${b.heading}"`, colB = `color="${b.body}"`;
  const centred = async (buf, x0, w, top) => { const m = await sharp(buf).metadata(); layers.push({ input: buf, top: Math.round(top), left: Math.round(x0 + Math.max(0, (w - m.width) / 2)) }); return m.height; };
  const divider = (w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20"><path d="M0 10 H${w / 2 - 14} M${w / 2 + 14} 10 H${w}" stroke="${b.accent}" stroke-width="1.4"/><path d="M${w / 2} 16 s-7-4.3-7-9a3.9 3.9 0 0 1 7-2.3a3.9 3.9 0 0 1 7 2.3c0 4.7-7 9-7 9z" fill="${b.accent}"/></svg>`);
  try {
    if (kind === 'story') {
      const x0 = 80, tw = W - 160;
      await centred(await text(`<span ${colB}>${xml(C.I18N.t(lang, 'gettingMarried'))}</span>`, 'Cormorant Garamond', 'cormorant.ttf', tw, 52), x0, tw, 150);
      let y = photoW ? 1250 : 560;
      y += await centred(await text(`<span ${colA}>${xml(nm)}</span>`, 'Great Vibes', 'great-vibes.ttf', tw, nm.length > 22 ? 104 : 136), x0, tw, y) + 20;
      layers.push({ input: divider(260), top: y, left: (W - 260) / 2 }); y += 50;
      await centred(await text(`<span ${colB}>${xml(date)}\n${xml(place)}</span>`, 'Cormorant Garamond', 'cormorant.ttf', tw, 50), x0, tw, y);
    } else {
      const x0 = photoW ? 494 : 60, tw = W - x0 - 60;
      const t1 = await text(`<span ${colB}>${xml(C.I18N.t(lang, 'gettingMarried'))}</span>`, 'Cormorant Garamond', 'cormorant.ttf', tw, 36);
      const t2 = await text(`<span ${colA}>${xml(nm)}</span>`, 'Great Vibes', 'great-vibes.ttf', tw, nm.length > 22 ? 70 : 96);
      const t3 = await text(`<span ${colB}>${xml(date)}\n${xml(place)}</span>`, 'Cormorant Garamond', 'cormorant.ttf', tw, 33);
      const hs = await Promise.all([t1, t2, t3].map(t => sharp(t).metadata().then(m => m.height)));
      let y = Math.max(40, (H - (hs[0] + hs[1] + hs[2] + 70)) / 2);
      y += await centred(t1, x0, tw, y) + 8;
      y += await centred(t2, x0, tw, y) + 10;
      layers.push({ input: divider(200), top: Math.round(y), left: Math.round(x0 + (tw - 200) / 2) }); y += 34;
      await centred(t3, x0, tw, y);
    }
  } catch (e) { console.error('[shaadi-paigaam] card text:', e.message); }
  return sharp(bg).composite(layers).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}

/* ------------------------------------------------------------ RSVP notification (optional email) */
async function notifyHost(pg, d, r) {
  if (!process.env.RESEND_API_KEY || !d.rsvp.email) return;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({
      from: process.env.RSVP_FROM_EMAIL || 'Paigaam RSVP <rsvp@paigaam.cc>', to: [d.rsvp.email],
      subject: `RSVP: ${r.name} ${r.attending === 'yes' ? 'is coming (' + r.guests + ')' : 'cannot come'}`,
      text: `${r.name} replied to your invitation.\n\nAttending: ${r.attending === 'yes' ? 'Yes, ' + r.guests + ' guest(s)' : 'No'}\n${r.meal ? 'Meal: ' + r.meal + '\n' : ''}${r.email ? 'Email: ' + r.email + '\n' : ''}${r.phone ? 'Phone: ' + r.phone + '\n' : ''}${r.message ? '\nMessage: ' + r.message + '\n' : ''}\nSee every response in your dashboard.` }) });
  } catch (e) { console.error('[shaadi-paigaam] notify:', e.message); }
}

/* ------------------------------------------------------------ demo */
function demoData(u) {
  const d = JSON.parse(JSON.stringify(C.SAMPLE));
  const pal = u.searchParams.get('palette');
  if (pal && C.PALETTE_BY_ID[pal]) d.palette.id = pal;
  const font = u.searchParams.get('font'); if (font && C.FONT_BY_ID[font]) d.font = font;
  const l = u.searchParams.get('lang'); if (l && d.lang.enabled.includes(l)) d.lang.default = l;
  return clean(d);
}

/* ------------------------------------------------------------ the published page */
function servePublished(req, res, pg, baseUrl, u) {
  const d = clean(pg.customer_data);
  const url = shortUrl(baseUrl, pg.slug);
  const end = weddingEndMs(d);
  if (d.access.expireDays > 0 && end && Date.now() > end + d.access.expireDays * 864e5) { html(res, renderEnded(d, { url }), 'public, max-age=600', 410); return true; }
  if (d.access.passcode) {
    const ok = cookies(req)['sp_pass_' + pg.id] === hmac(pg.id + ':' + d.access.passcode);
    if (!ok) { html(res, renderGate(d, { action: '/' + SLUG + '/unlock/' + pg.id, wrong: u.searchParams.get('wrong') === '1', url }), 'private, no-store'); return true; }
  }
  const og = `${baseUrl}/${SLUG}/card/${pg.id}.jpg?v=${hmac(pg.updated_at || '').slice(0, 8)}`;
  html(res, renderInvitation(d, { mode: 'guest', id: pg.id, slug: pg.slug, url, rsvpUrl: '/api/' + SLUG + '/rsvp/' + pg.id, ogImage: og, noindex: !!d.access.passcode, mapsKey: process.env.GOOGLE_MAPS_EMBED_KEY || GKEY() }), d.access.passcode ? 'private, no-store' : 'public, max-age=60');
  try { q.eventInsert('paigaam_view', { template: SLUG }, '/' + pg.slug); } catch {}
  return true;
}

/* ------------------------------------------------------------ routes */
async function handle(req, res, u, { baseUrl, isAdmin = false } = {}) {
  const p = u.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;

  // Root short links: only for this template's published pages (existing routes always win:
  // the server tries this handler first, so reserved names can never be claimed).
  if ((method === 'GET' || method === 'HEAD') && /^\/[a-z0-9-]{3,40}$/.test(p) && !isReserved(p.slice(1))) {
    const pg = q.paigaamBySlug(p.slice(1));
    if (pg && pg.template_slug === SLUG && isLive(pg)) return servePublished(req, res, pg, baseUrl, u);
    return false;
  }
  let m = p.match(/^\/p\/([a-z0-9-]+)$/);
  if (method === 'GET' && m) {
    const pg = q.paigaamBySlug(m[1]);
    if (pg && pg.template_slug === SLUG) { res.writeHead(301, { Location: '/' + m[1] }); res.end(); return true; }
    return false;
  }
  if ((method === 'GET' || method === 'HEAD') && /^\/shaadi-paigaam\/([a-z0-9-]+\.(js|css)|(art|music|fonts)\/[a-z0-9-]+\.(webp|png|jpg|mp3|ttf))$/.test(p)) return false;   // static assets
  const handles = p === '/create/' + SLUG || p.startsWith('/' + SLUG + '/') || p.startsWith('/api/' + SLUG + '/');
  if (!handles) return false;

  try {
    if (method === 'POST') { csrf(req, baseUrl); limit('all:' + ip(req), p.includes('/upload') ? 300 : 900, 600000); }

    if (method === 'GET' && p === '/create/' + SLUG) {
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
      const { shaadiPaigaamCreatePage } = require('../pages/shaadiPaigaamCreate');
      let open = null;
      const id = u.searchParams.get('id');
      if (id) { const pg = q.paigaamById(id); if (pg && pg.template_slug === SLUG && (owned(req, id) || isAdmin)) open = { id, status: pg.status, slug: pg.slug, data: clean(workingData(pg)), live: isLive(pg), pending: !!pendingOf(id) }; }
      const resume = !open ? q.recentDraftForOwner('sp_owners', owner(req), tpl.id, 30 * 864e5) : null;
      html(res, shaadiPaigaamCreatePage({ price: Number(tpl.price) || 0, listPrice: Number(tpl.list_price) || 0, open, resume: resume ? { id: resume.id, names: resume.customer_name, at: resume.updated_at } : null, mapsProvider: GKEY() ? 'google' : 'osm' }));
      return true;
    }

    if (method === 'GET' && p === '/' + SLUG + '/demo') {
      const d = demoData(u);
      html(res, renderInvitation(d, { mode: 'demo', id: 'demo', url: baseUrl + '/' + SLUG + '/demo', ogImage: baseUrl + '/' + SLUG + '/card/demo.jpg', autoOpen: u.searchParams.get('skip') === '1', mapsKey: process.env.GOOGLE_MAPS_EMBED_KEY || GKEY() }), 'public, max-age=300');
      return true;
    }
    if (method === 'GET' && p === '/' + SLUG + '/frame') {
      const d = demoData(u);
      html(res, renderInvitation(d, { mode: u.searchParams.get('guest') === '1' ? 'demo' : 'live', id: 'live', noindex: true, mapsKey: process.env.GOOGLE_MAPS_EMBED_KEY || GKEY() }), 'private, no-store', 200, { 'X-Frame-Options': 'SAMEORIGIN' });
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/preview\/([A-Za-z0-9_-]+)$/);
    if (method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!isAdmin && !owned(req, pg.id)) throw new InputError('forbidden', 403);
      html(res, renderInvitation(clean(workingData(pg)), { mode: 'preview', id: pg.id, noindex: true, mapsKey: process.env.GOOGLE_MAPS_EMBED_KEY || GKEY() }));
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/manage\/([a-f0-9]{48})$/);
    if (method === 'GET' && m) {
      const row = db.prepare('SELECT paigaam_id FROM sp_owners WHERE manage_hash=?').get(sha(m[1]));
      if (!row) throw new InputError('not_found', 404);
      res.setHeader('Set-Cookie', `sp_m_${row.paigaam_id}=${m[1]}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure(baseUrl)}`);
      res.writeHead(303, { Location: '/create/' + SLUG + '?id=' + encodeURIComponent(row.paigaam_id) + '&tab=dashboard', 'Cache-Control': 'no-store' }); res.end();
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/media\/([a-f0-9]{48}\.(jpg|png|webp|mp3|m4a|ogg|wav|aac))$/);
    if ((method === 'GET' || method === 'HEAD') && m) {
      const row = db.prepare('SELECT * FROM sp_uploads WHERE filename=?').get(m[1]);
      if (!row) throw new InputError('not_found', 404);
      const pg = q.paigaamById(row.paigaam_id);
      const pub = isLive(pg) && !clean(pg.customer_data).access.passcode;
      if (!pub && !isAdmin && !owned(req, row.paigaam_id) && !(isLive(pg) && cookies(req)['sp_pass_' + pg.id])) throw new InputError('not_found', 404);
      if (!streamFile(req, res, path.join(uploadDir, row.filename), row.mime, pub ? 'public, max-age=604800, immutable' : 'private, no-store')) throw new InputError('not_found', 404);
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/card\/([A-Za-z0-9_-]+)\.(?:jpg|png)$/);
    if (method === 'GET' && m) {
      const kind = u.searchParams.get('kind') === 'story' ? 'story' : 'og';
      let d, key, pg = null;
      if (m[1] === 'demo') { d = clean(C.SAMPLE); key = 'demo'; }
      else {
        pg = q.paigaamById(m[1]);
        if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
        if (!isLive(pg) && !owned(req, pg.id) && !isAdmin) throw new InputError('not_found', 404);
        d = clean(isLive(pg) ? pg.customer_data : workingData(pg)); key = pg.id;
        if (d.access.passcode && !owned(req, pg.id) && !isAdmin) { d = Object.assign({}, d, { photos: [], couplePhoto: null }); }
      }
      const h = sha(JSON.stringify([d.couple, d.wedding, d.venue.name, d.venue.city, d.palette, d.couplePhoto, d.photos[0], d.lang.base, kind, d.access.passcode ? 1 : 0])).slice(0, 16);
      const file = path.join(cardDir, `${key}-${kind}-${h}.jpg`);
      if (!fs.existsSync(file)) { const buf = await shareCard(d, kind, baseUrl); fs.writeFileSync(file, buf); }
      const dl = u.searchParams.get('download') === '1';
      if (dl) res.setHeader('Content-Disposition', `attachment; filename="${C.slugify(names(d)) || 'invitation'}-${kind === 'story' ? 'story' : 'card'}.jpg"`);
      streamFile(req, res, file, 'image/jpeg', 'public, max-age=3600');
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/qr\/([A-Za-z0-9_-]+)\.(svg|png)$/);
    if (method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG || !pg.slug) throw new InputError('not_found', 404);
      if (!owned(req, pg.id) && !isAdmin) throw new InputError('not_found', 404);
      const b = C.buildPalette(clean(pg.customer_data).palette).palette;
      const svg = require('./qrcode').qrSVG(shortUrl(baseUrl, pg.slug), { module: 10, margin: 4, dark: b.deep, light: '#FFFFFF' });
      const fname = `${pg.slug}-qr.${m[2]}`;
      if (m[2] === 'svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="${fname}"`, 'Cache-Control': 'private, no-store' }); res.end(svg); return true; }
      if (!sharp) throw new InputError('unavailable', 503);
      const png = await sharp(Buffer.from(svg)).resize(1024, 1024, { kernel: 'nearest' }).png().toBuffer();
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${fname}"`, 'Cache-Control': 'private, no-store' }); res.end(png);
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/rsvps\/([A-Za-z0-9_-]+)\.csv$/);
    if (method === 'GET' && m) {
      if (!owned(req, m[1]) && !isAdmin) throw new InputError('not_found', 404);
      const pg = q.paigaamById(m[1]);
      const rows = db.prepare('SELECT * FROM sp_rsvps WHERE paigaam_id=? ORDER BY created_at').all(m[1]);
      const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
      const csv = '﻿' + [['Name', 'Attending', 'Guests', 'Meal', 'Email', 'Phone', 'Message', 'Language', 'Replied at']].concat(rows.map(r => [r.name, r.attending === 'yes' ? 'Yes' : 'No', r.guests, r.meal, r.email, r.phone, r.message, r.lang, new Date(r.updated_at).toISOString().replace('T', ' ').slice(0, 16)])).map(r => r.map(cell).join(',')).join('\r\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${(pg && pg.slug) || 'rsvps'}-rsvps.csv"`, 'Cache-Control': 'no-store' });
      res.end(csv);
      return true;
    }
    m = p.match(/^\/shaadi-paigaam\/unlock\/([A-Za-z0-9_-]+)$/);
    if (method === 'POST' && m) {
      limit('unlock:' + ip(req), 12, 600000);
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG || !isLive(pg)) throw new InputError('not_found', 404);
      const d = clean(pg.customer_data);
      const f = await formBody(req);
      const ok = d.access.passcode && crypto.timingSafeEqual(Buffer.from(sha(String(f.passcode || '').trim())), Buffer.from(sha(d.access.passcode)));
      if (ok) res.setHeader('Set-Cookie', `sp_pass_${pg.id}=${hmac(pg.id + ':' + d.access.passcode)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure(baseUrl)}`);
      res.writeHead(303, { Location: '/' + pg.slug + (ok ? '' : '?wrong=1') }); res.end();
      return true;
    }

    /* ----------------------------------------------- API */
    if (method === 'GET' && p === '/api/' + SLUG + '/me') {
      const id = u.searchParams.get('id') || '';
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG || !owned(req, id)) throw new InputError('not_found', 404);
      reply(res, 200, { id, status: pg.status, slug: pg.slug, live: isLive(pg), url: pg.slug && isLive(pg) ? shortUrl(baseUrl, pg.slug) : '', data: clean(workingData(pg)), pending: !!pendingOf(id) });
      return true;
    }

    if (method === 'POST' && p === '/api/' + SLUG + '/draft') {
      const body = await jsonBody(req);
      const result = C.validate(body.data || {});
      let d = result.data;
      let id = typeof body.id === 'string' ? body.id : '';
      let manageToken;
      if (id) {
        const pg = q.paigaamById(id);
        if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
        if (!owned(req, id)) throw new InputError('forbidden', 403);
        d = dropForeignMedia(d, id);
        if (isLive(pg)) db.prepare('INSERT INTO sp_pending VALUES (?,?,?) ON CONFLICT(paigaam_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').run(id, JSON.stringify(d), Date.now());
        else if (['draft', 'payment_pending'].includes(pg.status)) q.paigaamUpdate(id, { customer_data: d, customer_name: names(d) || 'Wedding invitation' });
        else throw new InputError('forbidden', 403);
      } else {
        d = dropForeignMedia(d, '__none__');
        const tpl = q.templateBySlug(SLUG);
        if (!tpl || tpl.status !== 'published') throw new InputError('not_found', 404);
        let hash = owner(req);
        if (!hash) {
          const token = crypto.randomBytes(32).toString('hex');
          hash = sha(token);
          res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure(baseUrl)}`);
        }
        const n = db.prepare('SELECT COUNT(*) n FROM sp_owners WHERE owner_hash=? AND created_at>?').get(hash, Date.now() - 864e5).n;
        if (n >= DRAFTS_PER_DAY) throw new InputError('limit', 429);
        const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: d, customer_name: names(d) || 'Wedding invitation' });
        id = pg.id;
        manageToken = crypto.randomBytes(24).toString('hex');
        db.prepare('INSERT INTO sp_owners VALUES (?,?,?,?)').run(id, hash, sha(manageToken), Date.now());
      }
      const pg = q.paigaamById(id);
      reply(res, 200, { id, manageToken, manageUrl: manageToken ? `${baseUrl}/${SLUG}/manage/${manageToken}` : undefined, savedAt: Date.now(), status: pg.status, live: isLive(pg), slug: pg.slug, errors: C.validate(d).errors, warnings: result.warnings, translations: result.translations.length });
      return true;
    }

    if (method === 'POST' && p === '/api/' + SLUG + '/upload') {
      const id = u.searchParams.get('id') || '', kind = u.searchParams.get('kind') || '';
      if (!LIMITS[kind]) throw new InputError('validation');
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!owned(req, id)) throw new InputError('forbidden', 403);
      limit('up:' + id, 120, 3600000);
      if (db.prepare('SELECT COUNT(*) n FROM sp_uploads WHERE paigaam_id=? AND kind=?').get(id, kind).n >= PER_DRAFT[kind] * 3) sweepUploads(id, [clean(pg.customer_data), pendingOf(id) ? clean(pendingOf(id)) : clean({})], 0);
      if (db.prepare('SELECT COUNT(*) n FROM sp_uploads WHERE paigaam_id=? AND kind=?').get(id, kind).n >= PER_DRAFT[kind] * 3) throw new InputError('limit', 429);
      if (db.prepare('SELECT COALESCE(SUM(bytes),0) n FROM sp_uploads').get().n > POOL_BYTES) throw new InputError('storage_full', 507);
      const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const buf = await read(req, LIMITS[kind]);
      if (!buf.length) throw new InputError('validation');
      let ext, mime;
      if (kind === 'photo') {
        const info = sniffImage(buf);
        if (!info || info.format !== type) throw new InputError('invalid_image');
        if (Math.min(info.width, info.height) < 360) throw new InputError('low_resolution');
        if (buf.length > 2 * 1024 * 1024) throw new InputError('too_large', 413);
        const bad = checkImage(buf, type); if (bad) throw new InputError(bad === 'too_large' ? 'too_large' : 'invalid_image', bad === 'too_large' ? 413 : 400);
        ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type]; mime = IMAGE_MIME[ext];
      } else {
        ext = sniffAudio(buf);
        if (!ext) throw new InputError('invalid_audio');
        mime = AUDIO_MIME[ext];
      }
      const filename = crypto.randomBytes(24).toString('hex') + '.' + ext;
      fs.writeFileSync(path.join(uploadDir, filename), buf, { flag: 'wx', mode: 0o600 });
      db.prepare('INSERT INTO sp_uploads VALUES (?,?,?,?,?,?)').run(filename, id, kind, mime, buf.length, Date.now());
      reply(res, 200, { url: '/' + SLUG + '/media/' + filename, kind, bytes: buf.length });
      return true;
    }

    if (method === 'GET' && p === '/api/' + SLUG + '/slug') {
      limit('slug:' + ip(req), 240, 600000);
      const id = u.searchParams.get('id') || '';
      const st = slugStatus(u.searchParams.get('s'), id);
      let data = C.SAMPLE;
      const pg = id && q.paigaamById(id);
      if (pg && pg.template_slug === SLUG && owned(req, id)) data = clean(workingData(pg));
      reply(res, 200, Object.assign(st, { suggestions: st.available ? [] : suggest(data, id, st.slug) }));
      return true;
    }

    if (method === 'GET' && (p === '/api/' + SLUG + '/places' || p === '/api/' + SLUG + '/reverse')) {
      limit('geo:' + ip(req), 120, 600000);
      try {
        if (p.endsWith('/places')) {
          const qs = String(u.searchParams.get('q') || '').trim().slice(0, 140);
          if (qs.length < 3) { reply(res, 200, { results: [], provider: GKEY() ? 'google' : 'osm' }); return true; }
          reply(res, 200, { results: await placesSearch(qs, u.searchParams.get('country') || 'in'), provider: GKEY() ? 'google' : 'osm' });
        } else {
          const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new InputError();
          reply(res, 200, { result: await reverseGeocode(lat.toFixed(6), lng.toFixed(6)) });
        }
      } catch (e) { if (e instanceof InputError) throw e; console.error('[shaadi-paigaam] geo:', e.message); reply(res, 502, { error: 'geocoder_unavailable' }); }
      return true;
    }

    if (method === 'POST' && p === '/api/' + SLUG + '/translate') {
      limit('tr:' + ip(req), 30, 3600000);
      const body = await jsonBody(req, 65536);
      const L = C.I18N.LANGS;
      if (!L[body.from] || !L[body.to] || body.from === body.to) throw new InputError();
      const texts = body.texts && typeof body.texts === 'object' ? Object.entries(body.texts).slice(0, 60) : [];
      let chars = 0; const out = {}; const failed = [];
      for (const [k, v] of texts) {
        const s = C.cleanText(v, 700, true); if (!s) continue;
        chars += s.length; if (chars > 9000) { failed.push(k); continue; }
        try { out[k] = C.cleanText(await translateOne(s, body.from, body.to), 900, true); } catch (e) { failed.push(k); }
      }
      reply(res, 200, { texts: out, failed, provider: process.env.GOOGLE_TRANSLATE_API_KEY ? 'google' : 'mymemory' });
      return true;
    }

    if (method === 'GET' && p === '/api/' + SLUG + '/versions') {
      const id = u.searchParams.get('id') || '';
      if (!owned(req, id)) throw new InputError('not_found', 404);
      reply(res, 200, { versions: db.prepare('SELECT id, note, created_at FROM sp_versions WHERE paigaam_id=? ORDER BY id DESC LIMIT 40').all(id) });
      return true;
    }
    if (method === 'POST' && p === '/api/' + SLUG + '/restore') {
      const { id, version } = await jsonBody(req);
      if (!owned(req, id)) throw new InputError('not_found', 404);
      const v = db.prepare('SELECT data FROM sp_versions WHERE paigaam_id=? AND id=?').get(id, Number(version));
      if (!v) throw new InputError('not_found', 404);
      const d = dropForeignMedia(clean(JSON.parse(v.data)), id);
      const pg = q.paigaamById(id);
      if (isLive(pg)) db.prepare('INSERT INTO sp_pending VALUES (?,?,?) ON CONFLICT(paigaam_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at').run(id, JSON.stringify(d), Date.now());
      else q.paigaamUpdate(id, { customer_data: d });
      reply(res, 200, { data: d });
      return true;
    }
    if (method === 'GET' && p === '/api/' + SLUG + '/rsvps') {
      const id = u.searchParams.get('id') || '';
      if (!owned(req, id) && !isAdmin) throw new InputError('not_found', 404);
      const rows = db.prepare('SELECT id, name, email, phone, attending, guests, meal, message, lang, created_at, updated_at FROM sp_rsvps WHERE paigaam_id=? ORDER BY updated_at DESC').all(id);
      const yes = rows.filter(r => r.attending === 'yes');
      const meals = {}; for (const r of yes) if (r.meal) meals[r.meal] = (meals[r.meal] || 0) + r.guests;
      reply(res, 200, { rows, totals: { responses: rows.length, attending: yes.length, guests: yes.reduce((a, r) => a + r.guests, 0), declined: rows.length - yes.length, meals } });
      return true;
    }

    m = p.match(/^\/api\/shaadi-paigaam\/rsvp\/([A-Za-z0-9_-]+)$/);
    if (method === 'POST' && m) {
      limit('rsvp:' + ip(req) + ':' + m[1], 20, 600000);   // a whole family may reply from one home Wi-Fi
      limit('rsvp:' + ip(req), 60, 3600000);
      const pg = q.paigaamById(m[1]);
      if (!pg || pg.template_slug !== SLUG || !isLive(pg)) throw new InputError('not_found', 404);
      const d = clean(pg.customer_data);
      if (!d.sections.rsvp) throw new InputError('closed', 410);
      if (d.access.passcode && cookies(req)['sp_pass_' + pg.id] !== hmac(pg.id + ':' + d.access.passcode)) throw new InputError('forbidden', 403);
      if (d.rsvp.deadline && Date.now() > C.zonedToUtc(d.rsvp.deadline, '23:59', d.wedding.tz) + 60000) throw new InputError('closed', 410);
      const b = await jsonBody(req, 8192);
      if (b.website) { reply(res, 200, { ok: true }); return true; }               // honeypot: bots get a silent 200
      if (!(Number(b.t) >= 2500)) { reply(res, 200, { ok: true }); return true; }  // filled faster than a human
      const name = C.cleanText(b.name, 60), email = C.cleanText(b.email, 120).toLowerCase(), ph = C.cleanPhone(b.phone);
      const attending = b.attending === 'yes' ? 'yes' : b.attending === 'no' ? 'no' : '';
      if (!name || !attending || (!email && !ph.value)) throw new InputError('validation');
      if (email && !C.EMAIL_RE.test(email)) throw new InputError('validation');
      if (b.phone && !ph.ok) throw new InputError('validation');
      const guests = attending === 'yes' ? Math.max(1, Math.min(d.rsvp.maxGuests, Math.round(Number(b.guests) || 1))) : 0;
      const meal = d.rsvp.meal && attending === 'yes' && d.rsvp.mealOptions.includes(String(b.meal || '')) ? String(b.meal) : '';
      const message = C.cleanText(b.message, 500, true);
      const langCode = C.I18N.LANGS[b.lang] ? b.lang : '';
      const dup = db.prepare(`SELECT id FROM sp_rsvps WHERE paigaam_id=? AND ((email<>'' AND email=?) OR (phone<>'' AND phone=?)) ORDER BY id DESC LIMIT 1`).get(pg.id, email || '\u0000', ph.value || '\u0000');
      if (dup && !b.confirmUpdate) throw new InputError('duplicate', 409);
      const now = Date.now();
      if (dup) db.prepare('UPDATE sp_rsvps SET name=?, email=?, phone=?, attending=?, guests=?, meal=?, message=?, lang=?, updated_at=? WHERE id=?').run(name, email, ph.value, attending, guests, meal, message, langCode, now, dup.id);
      else {
        if (db.prepare('SELECT COUNT(*) n FROM sp_rsvps WHERE paigaam_id=?').get(pg.id).n > 3000) throw new InputError('limit', 429);
        db.prepare('INSERT INTO sp_rsvps (paigaam_id,name,email,phone,attending,guests,meal,message,lang,ip_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(pg.id, name, email, ph.value, attending, guests, meal, message, langCode, hmac(ip(req)), now, now);
      }
      notifyHost(pg, d, { name, email, phone: ph.value, attending, guests, meal, message });
      reply(res, 200, { ok: true, updated: !!dup });
      return true;
    }

    if (method === 'POST' && p === '/api/' + SLUG + '/publish') {
      const body = await jsonBody(req);
      const id = String(body.id || '');
      const pg = q.paigaamById(id);
      if (!pg || pg.template_slug !== SLUG) throw new InputError('not_found', 404);
      if (!owned(req, id)) throw new InputError('forbidden', 403);
      if (!body.confirmed) throw new InputError('confirm_required', 422);
      const tpl = q.templateBySlug(SLUG);
      if (!tpl || tpl.status !== 'published') throw new InputError('forbidden', 403);
      const result = C.validate(workingData(pg), { publish: true });
      if (result.errors.length) throw new InputError('incomplete', 422, { errors: result.errors });
      const d = dropForeignMedia(result.data, id);
      assertOwnMedia(d, id);
      const host = new URL(baseUrl).hostname;
      if (!PERSISTENT && process.env.SHAADI_PAIGAAM_ALLOW_EPHEMERAL_PUBLISH !== '1' && !LOCAL.includes(host)) throw new InputError('storage_unavailable', 503);

      if (isLive(pg)) {   // edit of a live invitation: same link, instantly
        q.paigaamUpdate(id, { customer_data: d, customer_name: names(d) });
        db.prepare('DELETE FROM sp_pending WHERE paigaam_id=?').run(id);
        snapshot(id, d, 'Updated');
        sweepUploads(id, [d], 3600000);
        reply(res, 200, { url: shortUrl(baseUrl, pg.slug), slug: pg.slug, updated: true });
        return true;
      }
      const st = slugStatus(body.slug, id);
      if (!st.available) throw new InputError('slug_' + st.reason, 409, { suggestions: suggest(d, id, st.slug) });
      q.paigaamUpdate(id, { slug: st.slug, customer_data: d, customer_name: names(d) });
      if (Number(tpl.price) > 0 && pg.payment_status !== 'paid') {
        const razorpay = require('./razorpay');
        if (!razorpay.ENABLED) throw new InputError('payments_offline', 503);
        const settings = q.settings();
        let order;
        try { order = await razorpay.createOrder(q.paigaamById(id), settings); }
        catch (e) { console.error('[razorpay] order create failed:', e.message); throw new InputError('gateway_unreachable', 502); }
        if (!q.ordersAll().find(o => o.paigaam_id === id && o.razorpay_order_id === order.id)) q.orderInsert({ paigaam_id: id, customer_name: names(d), whatsapp: d.rsvp.whatsapp || '', amount: tpl.price, currency: tpl.currency || settings.currency || 'INR', razorpay_order_id: order.id });
        q.paigaamUpdate(id, { status: 'payment_pending' });
        q.eventInsert('purchase_started', { template: SLUG, via: 'razorpay', rzp_order: order.id }, '/api/' + SLUG + '/publish');
        reply(res, 200, { razorpay: true, slug: st.slug, keyId: razorpay.KEY_ID, orderId: order.id, amount: Number(tpl.price) * 100, currency: tpl.currency || settings.currency || 'INR', name: settings.business_name || 'Paigaam', description: tpl.name, prefillName: names(d) });
        return true;
      }
      q.paigaamUpdate(id, { status: 'published', payment_status: 'paid', published_at: new Date().toISOString() });
      snapshot(id, d, 'Published');
      sweepUploads(id, [d], 0);
      q.eventInsert('paigaam_generated', { template: SLUG, paid: false }, '/api/' + SLUG + '/publish');
      reply(res, 200, { url: shortUrl(baseUrl, st.slug), slug: st.slug });
      return true;
    }

    throw new InputError('not_found', 404);
  } catch (e) {
    if (!(e instanceof InputError)) console.error('[shaadi-paigaam]', e.stack || e.message);
    if (method === 'GET' && (e.status === 404 || e.status === 403) && !p.startsWith('/api/') && !p.includes('/media/') && !p.includes('/card/')) {
      html(res, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Not here</title><p style="font:18px Georgia,serif;padding:60px 24px;text-align:center;color:#4A0E1A">This invitation has wandered away.<br><br><a href="/templates" style="color:#5C1020">Back to Paigaam</a></p>', 'no-store', e.status);
      return true;
    }
    reply(res, e.status || 500, Object.assign({ error: e.code || 'server_error' }, e.extra || {}));
    return true;
  }
}

/** Settled payment (server.js publishPaigaam) → snapshot the first version. */
function afterPaidPublish(pg) {
  if (!pg || pg.template_slug !== SLUG) return;
  try { if (!db.prepare('SELECT 1 FROM sp_versions WHERE paigaam_id=?').get(pg.id)) snapshot(pg.id, clean(pg.customer_data), 'Published'); } catch {}
}
/** Gallery-card miniature. */
function renderThumb(baseUrl) { return renderInvitation(clean(C.SAMPLE), { mode: 'thumb', id: 'demo', noindex: true }); }
function renderPublishedForP(pg, opts) { return renderInvitation(clean(pg.customer_data), { mode: 'guest', id: pg.id, slug: pg.slug, url: shortUrl(opts.baseUrl || '', pg.slug), rsvpUrl: '/api/' + SLUG + '/rsvp/' + pg.id }); }

module.exports = { handle, owned, SLUG, renderThumb, renderPublishedForP, afterPaidPublish, slugStatus, isReserved };
