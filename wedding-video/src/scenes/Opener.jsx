import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Art, FadeUp, WriteOn, useCtx, Layers } from '../components/core.jsx';
import { CardFace } from './MainCard.jsx';
import { W, H, prog, easeInOutCubic, easeInCubic, sway, lerp } from '../lib/anim.js';

// Scroll card geometry (card-local px) and placement on screen.
const CARD_W = 960;
const CARD_H = 1500;
const CARD_CX = 590;
const CARD_CY = 1000;
const ROT = -7; // degrees
// Inner-page stamp: a miniature of the main card (same aspect), so the zoom is seamless.
const STAMP_W = 230;
const STAMP_H = Math.round((STAMP_W * H) / W);
const STAMP_X = 640;
const STAMP_Y = 230;

// Camera keyframes (seconds): settle push at 2.3-2.8s, slow drift after the page flip.
function camera(tSec) {
  const k1 = easeInOutCubic(prog(tSec, 2.3, 0.5));
  const k2 = prog(tSec, 6.0, 5.2);
  const scale = 1 + 0.1 * k1 + 0.05 * k2;
  const tx = -20 * k1 - 25 * k2;
  const ty = -40 * k1 + 10 * k2;
  return { scale, tx, ty };
}

/** Screen-space geometry of the inner-page stamp at time tSec (used by the stamp zoom). */
export function openerStampGeometry(tSec) {
  const cam = camera(tSec);
  const th = (ROT * Math.PI) / 180;
  const lx = STAMP_X + STAMP_W / 2 - CARD_W / 2;
  const ly = STAMP_Y + STAMP_H / 2 - CARD_H / 2;
  const px = CARD_CX + lx * Math.cos(th) - ly * Math.sin(th);
  const py = CARD_CY + lx * Math.sin(th) + ly * Math.cos(th);
  const sx = (px - W / 2) * cam.scale + W / 2 + cam.tx;
  const sy = (py - H / 2) * cam.scale + H / 2 + cam.ty;
  return { focal: { x: sx, y: sy }, s0: (STAMP_W * cam.scale) / W, rot0: ROT + 2, zoom: W / (STAMP_W * cam.scale) };
}

const ROSE = '#cf4f69';
const OLIVE = '#8b8656';

export function OpenerScene({ data, frame, fps, styles, exitStart }) {
  const { fonts } = useCtx();
  const tSec = Math.min(frame, exitStart ?? frame) / fps;
  const cam = camera(tSec);
  const flip = easeInCubic(prog(frame / fps, 5.4, 0.6)); // cover rolls up
  const showCover = flip < 1;
  const birdT = prog(frame / fps, 0.2, 4.2);
  const s = (x) => Math.round(x * fps);
  const c = data.couple;
  const firstName = data.meta.order === 'bride_first' ? c.bride : c.groom;
  const secondName = data.meta.order === 'bride_first' ? c.groom : c.bride;
  const firstI = data.meta.order === 'bride_first' ? c.brideInitial : c.groomInitial;
  const secondI = data.meta.order === 'bride_first' ? c.groomInitial : c.brideInitial;

  const bg = (
    <AbsoluteFill>
      <Art src="art/bg_maroon.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.25) brightness(1.05) hue-rotate(-6deg)' }} />
    </AbsoluteFill>
  );

  return (
    <Layers wrap={styles.wrap} bgStyle={styles.bg} contentStyle={styles.content} bg={bg}>
      <AbsoluteFill style={{ transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})`, transformOrigin: '50% 50%' }}>
        {/* the scroll card */}
        <div style={{ position: 'absolute', left: CARD_CX - CARD_W / 2, top: CARD_CY - CARD_H / 2, width: CARD_W, height: CARD_H, transform: `rotate(${ROT}deg)`, filter: 'drop-shadow(0 26px 40px rgba(30,0,8,0.45))' }}>
          {/* inner page */}
          <div style={{ position: 'absolute', inset: 0, background: '#f3ead6', borderRadius: 10, overflow: 'hidden' }}>
            <Art src="art/bg_cream.jpg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 34, border: '2px solid rgba(186,160,110,0.45)', borderRadius: 6 }} />
            <div style={{ position: 'absolute', inset: 46, border: '1px solid rgba(186,160,110,0.35)', borderRadius: 4 }} />
            {/* stamp = miniature of the main card */}
            <div style={{ position: 'absolute', left: STAMP_X, top: STAMP_Y, width: STAMP_W, height: STAMP_H, transform: `rotate(2deg)` }}>
              <div style={{ width: W, height: H, transform: `scale(${STAMP_W / W})`, transformOrigin: '0 0', position: 'relative' }}>
                <CardFace landmark={data.meta.landmark} flowerOpacity={1} />
              </div>
            </div>
            {/* greeting lines */}
            <div style={{ position: 'absolute', left: 100, top: 640, width: 600 }}>
              {data.opener.greeting.map((g, i) => (
                <WriteOn key={i} at={s(6.2) + i * s(0.55)} dur={s(0.7)} style={{ marginLeft: g.style === 'display' ? 70 : 0, marginTop: g.style === 'display' ? -6 : 10 }}>
                  <div style={{ fontFamily: g.style === 'display' ? fonts.display : fonts.sans, fontSize: g.style === 'display' ? 78 : 34, color: g.style === 'display' ? OLIVE : ROSE, lineHeight: 1.1, WebkitTextStroke: g.style === 'display' ? `0.8px ${OLIVE}` : undefined, whiteSpace: 'nowrap' }}>{g.text}</div>
                </WriteOn>
              ))}
            </div>
            {/* Ganesha medallion and parrots */}
            <FadeUp at={s(6.0)} dur={s(0.5)} style={{ position: 'absolute', left: 610, top: 960, width: 380 }}>
              <Art src="art/ganesha.webp" style={{ width: '100%' }} />
            </FadeUp>
            <FadeUp at={s(6.1)} dur={s(0.5)} style={{ position: 'absolute', left: 290, top: 1140, width: 280 }}>
              <Art src="art/parrots.webp" style={{ width: '100%', transform: `rotate(${sway(frame, 1.2, 120)}deg)` }} />
            </FadeUp>
          </div>
          {/* cover page (rolls up at 5.4-6.0s) */}
          {showCover ? (
            <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 0%', transform: `scaleY(${1 - flip})`, borderRadius: 10, overflow: 'hidden', background: '#efe4cc' }}>
              <Art src="art/bg_cream.jpg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.97)' }} />
              <div style={{ position: 'absolute', inset: 34, border: '2px solid rgba(186,160,110,0.55)', borderRadius: 6 }} />
              <div style={{ position: 'absolute', inset: 46, border: '1px solid rgba(186,160,110,0.4)', borderRadius: 4 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <FadeUp at={s(1.7)} dur={s(0.7)} style={{ position: 'relative', width: 260, height: 300 }}>
                  <Art src="art/flower.webp" style={{ position: 'absolute', left: 80, top: 0, height: 290, width: 'auto' }} />
                  <div style={{ position: 'absolute', left: 18, top: 150, fontFamily: fonts.display, fontSize: 64, color: OLIVE }}>{firstI}</div>
                  <div style={{ position: 'absolute', right: 18, top: 150, fontFamily: fonts.display, fontSize: 64, color: OLIVE }}>{secondI}</div>
                </FadeUp>
                <WriteOn at={s(2.1)} dur={s(0.8)} style={{ marginTop: 18 }}>
                  <div style={{ fontFamily: fonts.display, fontSize: 66, color: ROSE, WebkitTextStroke: `0.8px ${ROSE}`, whiteSpace: 'nowrap' }}>{firstName} &amp; {secondName}</div>
                </WriteOn>
                <FadeUp at={s(2.5)} dur={s(0.5)} style={{ marginTop: 14 }}>
                  <div style={{ fontFamily: fonts.sans, fontSize: 27, color: OLIVE, textAlign: 'center' }}>{data.opener.coverLine}</div>
                </FadeUp>
                <FadeUp at={s(2.7)} dur={s(0.5)} style={{ marginTop: 6 }}>
                  <div style={{ fontFamily: fonts.sans, fontSize: 25, color: OLIVE, textAlign: 'center' }}>{data.opener.coverVenue}</div>
                </FadeUp>
              </div>
              {/* rolling edge shading */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 140, background: `linear-gradient(0deg, rgba(120,90,50,${0.35 * flip}), rgba(0,0,0,0))` }} />
            </div>
          ) : null}
          {/* brass rod with rope */}
          <div style={{ position: 'absolute', left: 30, top: 70 - 60 * flip, width: CARD_W - 60 }}>
            <Art src="art/rod.webp" style={{ width: '100%' }} />
          </div>
        </div>

        {/* hanging diyas (top-right), leaves (bottom-left), bird */}
        <div style={{ position: 'absolute', left: 720, top: -260, width: 340, transformOrigin: '50% 0%', transform: `rotate(${sway(frame, 2.2, 140)}deg)` }}>
          <Art src="art/diyas.webp" style={{ width: '100%' }} />
        </div>
        <div style={{ position: 'absolute', left: -170, top: 1330, width: 760, transformOrigin: '0% 100%', transform: `rotate(${sway(frame, 1.2, 190, 0.3)}deg)` }}>
          <Art src="art/leaves.webp" style={{ width: '100%' }} />
        </div>
        {birdT > 0 && birdT < 1 ? (
          <div style={{ position: 'absolute', left: lerp(-120, 1180, birdT), top: 150 - Math.sin(birdT * Math.PI) * 70, width: 90, transform: `rotate(${sway(frame, 6, 12)}deg)` }}>
            <Art src="art/icon_sparrow.webp" style={{ width: '100%' }} />
          </div>
        ) : null}
      </AbsoluteFill>
    </Layers>
  );
}
