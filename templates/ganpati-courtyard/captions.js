'use strict';
/**
 * Ganpati Courtyard — caption engine.
 *
 * Single source of truth for the four caption cues laid over the untouched
 * 10-second courtyard video. Both the server (ASS subtitles burned in by
 * ffmpeg) and the browser editor (HTML overlay driven by the same timings)
 * consume this module, so what you preview is exactly what renders.
 *
 * Safe area: the source frame's upper ~45% is clear cream sky. Every cue is
 * centre-anchored inside a middle column (x 90..630 of 720) between
 * y 150..545, clear of the floral corners and far above the procession,
 * drums, faces and the Ganesha idol.
 */

const PLAY_W = 720;
const PLAY_H = 1280;

/** Marathi defaults — an untouched form still sends the designed card. */
const DEFAULTS = {
  greeting: '॥ श्री गणेशाय नमः ॥',
  mainTitle: 'बाप्पा येत आहेत…',
  familyName: 'आपले नाव',
  eventDate: 'गणपती आगमन तारीख',
  eventTime: 'आगमनाची वेळ',
  venueName: 'ठिकाण',
  city: 'शहर',
};

/** ASS colour helper — &HBBGGRR& */
const col = (hex) => {
  const h = hex.replace('#', '');
  const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
  return `&H${b}${g}${r}`.toUpperCase() + '&';
};

const PALETTE = {
  ink: '#4a2c14',        // deep warm brown
  maroon: '#7a2d0c',     // hero line
  saffron: '#b45a12',    // accent details
  cream: '#f7efe1',      // soft outline / halo
};

/** The family line wraps the editable family name into fixed Marathi copy. */
function familyLine(name) {
  const n = (name || '').trim() || DEFAULTS.familyName;
  return `आमच्या ${n} परिवारातर्फे`;
}

/** Blank fields fall back to the designed defaults (matches the editor's live overlay). */
function withDefaults(data) {
  const d = { ...DEFAULTS, ...(data || {}) };
  for (const k of Object.keys(DEFAULTS)) {
    if (!String(d[k] || '').trim()) d[k] = DEFAULTS[k];
  }
  return d;
}

/**
 * Resolve the four cues from customer data.
 * Every returned event: { start, end, lines: [{text, size, colour, y, weight}], }
 * y values are centre anchors in 720x1280 script space.
 */
function buildCues(data) {
  const d = withDefaults(data);
  const closeLines = [
    { text: 'गणपती आगमन', size: 54, colour: PALETTE.maroon, y: 218 },
    { text: [d.eventDate, d.eventTime].filter(Boolean).join('  •  '), size: 33, colour: PALETTE.ink, y: 318 },
    { text: [d.venueName, d.city].filter(Boolean).join(', '), size: 31, colour: PALETTE.ink, y: 402 },
  ];

  return [
    { // 0–2s greeting
      start: 0.05, end: 2.0,
      lines: [{ text: d.greeting, size: 46, colour: PALETTE.ink, y: 300 }],
    },
    { // 2–5s hero
      start: 2.0, end: 5.0,
      lines: [{ text: d.mainTitle, size: 68, colour: PALETTE.maroon, y: 300, hero: true }],
    },
    { // 5–8s family
      start: 5.0, end: 8.0,
      lines: [{ text: familyLine(d.familyName), size: 41, colour: PALETTE.ink, y: 300 }],
    },
    { // 8–10s details
      start: 8.0, end: 9.9,
      lines: closeLines,
    },
  ];
}

/** ASS reads better with gently shrunk long text; libass wraps the rest. */
function fitSize(text, base, maxChars) {
  const t = String(text || '');
  if (t.length <= maxChars) return base;
  return Math.max(20, Math.round(base * (maxChars / t.length) ** 0.85));
}

const MAXCHARS = { // measured against the 540px safe column
  greeting: 24,
  hero: 13,
  family: 26,
  closeBig: 18,
  closeSmall: 38,
};

/** Fonts whose absence must not crash rendering: ASS escapes are stripped. */
function assSafe(text) {
  return String(text || '')
    .replace(/[{}\\]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function assTime(sec) {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** Complete ASS document for the given personalisation. */
function assFor(data) {
  const cues = buildCues(data);
  const header = [
    '[Script Info]',
    '; Ganpati Aagman — Traditional Courtyard (Paigaam)',
    `ScriptType: v4.00+`,
    `PlayResX: ${PLAY_W}`,
    `PlayResY: ${PLAY_H}`,
    `WrapStyle: 0`,
    `ScaledBorderAndShadow: yes`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Base,Tiro Devanagari Marathi,46,${col(PALETTE.ink)},${col(PALETTE.ink)},${col(PALETTE.cream)},&H80000000,0,0,0,0,100,100,0,0,1,2.2,0,5,90,90,0,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const events = [];
  for (const cue of cues) {
    for (const line of cue.lines) {
      let size = line.size;
      if (line.hero) size = fitSize(line.text, line.size, MAXCHARS.hero);
      else if (cue === cues[0]) size = fitSize(line.text, line.size, MAXCHARS.greeting);
      else if (cue === cues[2]) size = fitSize(line.text, line.size, MAXCHARS.family);
      else size = fitSize(line.text, line.size, line === cue.lines[0] ? MAXCHARS.closeBig : MAXCHARS.closeSmall);
      const text = assSafe(line.text).replace(/\n/g, ' ');
      if (!text) continue;
      events.push(
        `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Base,,0,0,0,,` +
        `{\\an5\\pos(${PLAY_W / 2},${line.y})\\c${col(line.colour)}\\fs${size}\\fad(420,380)}${text}`
      );
    }
  }
  return [...header, ...events, ''].join('\n');
}

/** JSON payload for the browser editor overlay (same timings, same copy). */
function timelineForClient(data) {
  return {
    playW: PLAY_W,
    playH: PLAY_H,
    palette: PALETTE,
    cues: buildCues(data),
  };
}

module.exports = { DEFAULTS, PALETTE, buildCues, assFor, timelineForClient, familyLine, withDefaults, assSafe, PLAY_W, PLAY_H };
