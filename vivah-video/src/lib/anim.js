// Small animation toolkit shared by all scenes.
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInCubic = (t) => t * t * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/** progress of `frame` through [start, start+len] (0..1, clamped) */
export const prog = (frame, start, len) => (len <= 0 ? (frame >= start ? 1 : 0) : clamp01((frame - start) / len));
/** map a over [a0,a1] -> [0,1] */
export const seg = (a, a0, a1) => clamp01((a - a0) / (a1 - a0));

export const W = 1080;
export const H = 1920;
export const C = { x: W / 2, y: H / 2 };

/** Camera that zooms into focal point F (exponential zoom) while bringing F to the centre. */
export function cameraInto(F, zMax, e, panE = e) {
  const z = Math.pow(zMax, e);
  return {
    transform: `translate(${(C.x - F.x) * panE}px, ${(C.y - F.y) * panE}px) scale(${z})`,
    transformOrigin: `${F.x}px ${F.y}px`,
  };
}

/** Full-frame layer that starts as a small stamp at F (scale s0, rotation rot0) and grows to fill the frame. */
export function growFrom(F, s0, e, rot0 = 0) {
  const s = s0 * Math.pow(1 / s0, e);
  const px = F.x + (C.x - F.x) * e;
  const py = F.y + (C.y - F.y) * e;
  return {
    transform: `translate(${px - C.x}px, ${py - C.y}px) rotate(${rot0 * (1 - e)}deg) scale(${s})`,
    transformOrigin: '50% 50%',
  };
}

export const sway = (frame, amp = 1.5, period = 150, phase = 0) => Math.sin(((frame / period) * 2 + phase) * Math.PI) * amp;
