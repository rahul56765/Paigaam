import React, { createContext, useContext, useId } from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { measureText } from '@remotion/layout-utils';
import { prog, easeOutCubic, sway } from '../lib/anim.js';

/* ---------- asset + render context ---------- */
export const Ctx = createContext({ base: '', fonts: {}, lang: 'en', fontsReady: false });
export const useCtx = () => useContext(Ctx);

/** Resolve an asset path. Absolute/https URLs pass through; relative paths use the
 *  editor's asset base when given, otherwise Remotion's public folder. */
export function useAsset() {
  const { base } = useCtx();
  return (p) => {
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p) || p.startsWith('/') || p.startsWith('data:') || p.startsWith('blob:')) return p;
    return base ? `${base.replace(/\/$/, '')}/${p}` : staticFile(p);
  };
}

export function Art({ src, style, className }) {
  const a = useAsset();
  if (!src) return null;
  return <Img src={a(src)} style={{ display: 'block', ...style }} className={className} />;
}

/** Layer set used by every scene so transitions can address the whole scene,
 *  just the backdrop, or just the foreground. */
export function Layers({ wrap, push = 1, bgStyle, contentStyle, bg, children }) {
  return (
    <AbsoluteFill style={{ overflow: 'hidden', ...(wrap || {}) }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 50%' }}>
        <AbsoluteFill style={bgStyle}>{bg}</AbsoluteFill>
        <AbsoluteFill style={contentStyle}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/* ---------- perforated stamp with the rose block-print band ---------- */
export function StampFrame({ w, h, edge = '#e07a8f', edgeW, bandW, perfR, perfGap, paper = 'art/bg_cream.jpg', paperTone, children, style, rule = true }) {
  const a = useAsset();
  const ew = edgeW ?? Math.round(w * 0.066);
  const bw = bandW ?? Math.round(w * 0.06);
  const r = perfR ?? Math.max(4, Math.round(ew * 0.33));
  const gap = perfGap ?? r * 2.9;
  const maskId = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const holes = [];
  const nx = Math.max(2, Math.round(w / gap));
  const ny = Math.max(2, Math.round(h / gap));
  for (let i = 0; i <= nx; i++) { const x = (i * w) / nx; holes.push([x, 0], [x, h]); }
  for (let j = 1; j < ny; j++) { const y = (j * h) / ny; holes.push([0, y], [w, y]); }
  const inset = ew;
  const inner = ew + bw;
  return (
    <div style={{ position: 'absolute', width: w, height: h, ...style }}>
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={w} height={h} fill="#fff" />
            {holes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill="#000" />)}
          </mask>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill={edge} mask={`url(#${maskId})`} />
      </svg>
      {/* block-print band: top/bottom horizontal tile, sides rotated tile */}
      <div style={{ position: 'absolute', left: inset, right: inset, top: inset, height: bw, backgroundImage: `url(${a('art/band_h.jpg')})`, backgroundSize: `auto ${bw}px`, backgroundRepeat: 'repeat-x' }} />
      <div style={{ position: 'absolute', left: inset, right: inset, bottom: inset, height: bw, backgroundImage: `url(${a('art/band_h.jpg')})`, backgroundSize: `auto ${bw}px`, backgroundRepeat: 'repeat-x', transform: 'scaleY(-1)' }} />
      <div style={{ position: 'absolute', top: inset + bw, bottom: inset + bw, left: inset, width: bw, backgroundImage: `url(${a('art/band_v.jpg')})`, backgroundSize: `${bw}px auto`, backgroundRepeat: 'repeat-y' }} />
      <div style={{ position: 'absolute', top: inset + bw, bottom: inset + bw, right: inset, width: bw, backgroundImage: `url(${a('art/band_v.jpg')})`, backgroundSize: `${bw}px auto`, backgroundRepeat: 'repeat-y', transform: 'scaleX(-1)' }} />
      <div style={{ position: 'absolute', left: inner, right: inner, top: inner, bottom: inner, overflow: 'hidden', background: paperTone || '#f4ecdb' }}>
        {paper ? <Img src={a(paper)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        {rule ? <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 0 ${Math.max(1, Math.round(w / 540))}px ${edge}55` }} /> : null}
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      </div>
    </div>
  );
}
StampFrame.innerInset = (w, edgeW, bandW) => (edgeW ?? Math.round(w * 0.066)) + (bandW ?? Math.round(w * 0.06));

/* ---------- text ---------- */

/** Fit each line within maxWidth by shrinking (down to minScale), then wrap. */
export function FitText({ text, font, size, maxWidth, minScale = 0.62, weight = 400, letterSpacing = 0, color, lineHeight = 1.25, align = 'center', style, upper }) {
  const { fontsReady } = useCtx();
  const content = upper ? String(text || '').toUpperCase() : String(text || '');
  const lines = content.split('\n');
  let scale = 1;
  if (fontsReady && maxWidth) {
    let widest = 0;
    for (const ln of lines) {
      if (!ln) continue;
      try {
        const m = measureText({ text: ln, fontFamily: font, fontSize: size, fontWeight: String(weight), letterSpacing: `${letterSpacing}px` });
        widest = Math.max(widest, m.width);
      } catch { /* measure unavailable */ }
    }
    if (widest > maxWidth) scale = Math.max(minScale, maxWidth / widest);
  }
  return (
    <div style={{ fontFamily: font, fontSize: size * scale, fontWeight: weight, letterSpacing: letterSpacing * scale, color, lineHeight, textAlign: align, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth, margin: align === 'center' ? '0 auto' : undefined, ...style }}>
      {content}
    </div>
  );
}

/** Fade + rise in at frame `at` (scene-local). */
export function FadeUp({ at, dur = 14, dy = 16, children, style }) {
  const f = useCurrentFrame();
  const p = easeOutCubic(prog(f, at, dur));
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, ...style }}>{children}</div>;
}

/** Left-to-right handwritten "write-on" reveal with a soft leading edge. */
export function WriteOn({ at, dur = 28, children, style }) {
  const f = useCurrentFrame();
  const p = prog(f, at, dur);
  const e = p * 118 - 14;
  const mask = `linear-gradient(90deg, #000 ${e}%, transparent ${e + 14}%)`;
  return <div style={{ WebkitMaskImage: mask, maskImage: mask, opacity: p > 0 ? 1 : 0, ...style }}>{children}</div>;
}

/** Pop-in for props (scale + fade). */
export function PopIn({ at, dur = 16, from = 0.86, children, style, origin = '50% 100%' }) {
  const f = useCurrentFrame();
  const p = easeOutCubic(prog(f, at, dur));
  return <div style={{ transform: `scale(${from + (1 - from) * p})`, transformOrigin: origin, ...style, opacity: p * (style && style.opacity != null ? style.opacity : 1) }}>{children}</div>;
}

/** Positioned prop with optional ambient motion. */
export function Prop({ p, frame, z, style }) {
  if (!p || p.hidden) return null;
  let t = '';
  if (p.sway) t = `rotate(${sway(frame, 1.6, 170)}deg)`;
  if (p.swing) t = `rotate(${sway(frame, 2.4, 110)}deg)`;
  if (p.spin) t = `rotate(${sway(frame, 6, 200)}deg)`;
  if (p.drift) t = `translateX(${sway(frame, 14, 260)}px)`;
  return (
    <div style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, zIndex: z, transform: t, transformOrigin: p.origin || '50% 50%', ...style }}>
      <Art src={p.src} style={{ width: '100%', height: 'auto' }} />
    </div>
  );
}

/** Soft twinkling stars over dark backdrops. Deterministic positions. */
export function Stars({ frame, count = 9, color = '#f3d36b', area = { x: 120, y: 160, w: 840, h: 520 } }) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const rx = ((i * 7919) % 1000) / 1000;
    const ry = ((i * 104729) % 1000) / 1000;
    const tw = 0.55 + 0.45 * Math.sin((frame / 30) * 2 + i * 1.7);
    pts.push(<div key={i} style={{ position: 'absolute', left: area.x + rx * area.w, top: area.y + ry * area.h, fontSize: 26 + (i % 3) * 6, color, opacity: tw, lineHeight: 1 }}>★</div>);
  }
  return <>{pts}</>;
}

export function Watercolour({ x, y, r, color }) {
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle at 40% 38%, ${color}ee 0%, ${color}cc 55%, ${color}88 80%, ${color}00 100%)`, filter: 'blur(0.6px)' }} />;
}
