// Per-transition styles for the outgoing (exit) and incoming (enter) scenes.
// a = 0..1 progress through the overlap. geo = focal geometry supplied by the
// outgoing scene (where the camera dives in) and story focus points.
import { C, cameraInto, growFrom, easeInCubic, easeOutCubic, easeInOutCubic, seg, lerp } from './anim.js';

const none = {};

export function exitStyles(type, a, geo = {}) {
  switch (type) {
    case 'stampZoom': {
      const e = easeInOutCubic(a);
      return { wrap: cameraInto(geo.focal, geo.zoom, e) };
    }
    case 'sunZoom':
    case 'propsZoom': {
      // exponential zoom with linear progress reads as a constant-speed dive
      const e = easeInOutCubic(a) * 0.35 + a * 0.65;
      return { wrap: { ...cameraInto(geo.focal, geo.zoom, e, easeOutCubic(seg(a, 0, 0.7))), filter: `blur(${seg(a, 0.4, 1) * 6}px)` } };
    }
    case 'closingZoom': {
      // the stamp empties first, then the camera dives into its paper
      const e = easeInOutCubic(seg(a, 0.15, 1));
      return { wrap: cameraInto(geo.focal, geo.zoom, e), detail: { opacity: 1 - seg(a, 0, 0.3) } };
    }
    case 'shrinkRise': {
      const e = easeInOutCubic(a);
      return { wrap: { transform: `scale(${1 - 0.93 * e})`, opacity: 1 - seg(a, 0.75, 1) } };
    }
    case 'slideSwap': {
      const e = easeInCubic(seg(a, 0, 0.55));
      return { content: { transform: `translate(${-700 * e}px, ${-1100 * e}px) scale(${1 - 0.4 * e})`, transformOrigin: '50% 50%', opacity: a < 0.6 ? 1 : 0 } };
    }
    case 'fabricZoom': {
      const e = easeInCubic(seg(a, 0, 0.55));
      return { wrap: { ...cameraInto(geo.focal || C, 4.2, e), opacity: 1 - seg(a, 0.4, 0.6), filter: `blur(${e * 3}px)` } };
    }
    case 'liftAway': {
      const sc = easeOutCubic(seg(a, 0, 0.55));
      const up = easeInCubic(seg(a, 0.45, 1));
      return {
        content: { transform: `translateY(${-200 * sc - 1300 * up}px) scale(${1 - 0.56 * sc})`, transformOrigin: '50% 50%' },
        bg: { opacity: 0 },
      };
    }
    case 'shrinkExit': {
      const s = easeInOutCubic(seg(a, 0, 0.5));
      const x = easeInCubic(seg(a, 0.38, 1));
      return {
        content: { transform: `translateX(${1150 * x}px) scale(${1 - 0.58 * s})`, transformOrigin: '50% 50%' },
        bg: { opacity: 1 - seg(a, 0.2, 0.75) },
      };
    }
    case 'leafWipe':
      return { wrap: { opacity: a < 0.5 ? 1 : 0 } };
    case 'fadeToPaper':
      return { wrap: { opacity: 1 - easeInOutCubic(a) } };
    default:
      return none;
  }
}

export function enterStyles(type, a, geo = {}) {
  switch (type) {
    case 'stampZoom': {
      const e = easeInOutCubic(a);
      return { wrap: growFrom(geo.focal, geo.s0, e, geo.rot0 || 0) };
    }
    case 'closingZoom': {
      const b = seg(a, 0.3, 1);
      const e = easeInOutCubic(b);
      return { wrap: { ...growFrom(geo.focal, 0.14, e), opacity: a < 0.3 ? 0 : 1 } };
    }
    case 'sunZoom':
      return { wrap: { opacity: seg(a, 0.72, 0.95) } };
    case 'propsZoom':
      return { wrap: { opacity: seg(a, 0.62, 0.92) } };
    case 'slideSwap': {
      const b = seg(a, 0.42, 1);
      const e = easeOutCubic(b);
      return {
        content: { transform: `translate(${lerp(620, 0, e)}px, ${lerp(1000, 0, e)}px) scale(${lerp(0.3, 1, e)})`, transformOrigin: '50% 50%', opacity: b > 0 ? 1 : 0 },
        bg: { opacity: seg(a, 0.7, 1) },
      };
    }
    case 'fabricZoom': {
      const b = easeInOutCubic(seg(a, 0.4, 1));
      const z = Math.pow(4.2, 1 - b);
      const F = geo.focal || C;
      return { wrap: { transform: `scale(${z})`, transformOrigin: `${F.x}px ${F.y}px`, opacity: seg(a, 0.4, 0.6), filter: `blur(${(1 - b) * 3}px)` } };
    }
    case 'leafWipe':
      return { wrap: { opacity: a < 0.5 ? 0 : 1 } };
    default:
      return none; // shrinkRise, liftAway, shrinkExit, fadeToPaper: incoming sits beneath
  }
}

// When the incoming scene's own foreground entrance starts/how long it lasts (frames),
// relative to the scene start. mode: grow | rise | none.
export function entrancePlan(kind, enter, fps) {
  const L = enter ? enter.len : 0;
  const s = (x) => Math.round(x * fps);
  const type = enter ? enter.type : null;
  if (kind === 'event') {
    switch (type) {
      case 'liftAway': return { mode: 'rise', start: Math.round(L * 0.45), len: Math.round(L * 0.5), reveal: Math.round(L * 0.9) };
      case 'leafWipe': return { mode: 'grow', start: Math.round(L * 0.55), len: s(2.0), reveal: L };
      case 'shrinkExit': return { mode: 'grow', start: Math.round(L * 0.25), len: Math.round(L * 0.75) + s(0.3), reveal: L + s(0.9) };
      case 'sunZoom': return { mode: 'grow', start: Math.round(L * 0.74), len: s(2.2), reveal: L + s(0.6) };
      default: return { mode: 'grow', start: L, len: s(2.2), reveal: L + s(0.7) };
    }
  }
  if (kind === 'story') {
    switch (type) {
      case 'shrinkRise': return { mode: 'rise', start: L, len: s(2.3) };
      case 'slideSwap':
      case 'fabricZoom': return { mode: 'none', start: 0, len: 0 };
      default: return { mode: 'grow', start: Math.round(L * 0.8), len: s(type === 'propsZoom' ? 1.9 : 2.5) };
    }
  }
  if (kind === 'main') return { mode: 'none', reveal: Math.round(L * 0.6) };
  if (kind === 'closing') return { mode: 'none', reveal: L };
  return { mode: 'none', reveal: L };
}
