import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Art, FitText, FadeUp, WriteOn, useCtx, Layers } from '../components/core.jsx';
import { CardFace, PAPER_INSET } from './MainCard.jsx';
import { t } from '../lib/i18n.js';
import { W, prog, easeOutCubic } from '../lib/anim.js';

const ROSE = '#cf4f69';
const OLIVE = '#7d7b44';

export function ClosingScene({ data, frame, fps, plan, styles, push }) {
  const { fonts, lang } = useCtx();
  const c = data.closing;
  const maxW = W - PAPER_INSET * 2 - 80;
  const s = (x) => Math.round(x * fps);
  let k = 0;
  const at = () => plan.reveal + s(0.7) + s(0.2) * k++;
  // Many family blocks: shrink the body a little so everything stays above the landmark.
  const bodyLines = [c.blessing, c.celebrating, ...c.families.map((f) => `${f.heading}\n${f.names}`), c.rsvp.length ? 'x\n'.repeat(c.rsvp.length + 1) : '']
    .join('\n').split('\n').length;
  const fit = Math.min(1, 20 / Math.max(14, bodyLines));
  const size = 36 * fit;
  const block = (text, color = OLIVE) => <FitText text={text} font={fonts.sans} size={size} color={color} maxWidth={maxW} lineHeight={1.38} letterSpacing={0.4} />;
  return (
    <Layers wrap={styles.wrap} push={push} bgStyle={styles.bg} contentStyle={styles.content} bg={<div style={{ position: 'absolute', inset: 0, background: '#efe5d0' }} />}>
      <CardFace landmark={data.meta.landmark}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300 - PAPER_INSET, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: fonts.sans }}>
          <WriteOn at={plan.reveal} dur={s(0.9)}>
            <FitText text={c.title || t(lang, 'sharing')} font={fonts.display} size={112} color={ROSE} maxWidth={maxW} style={{ WebkitTextStroke: `1.2px ${ROSE}` }} />
          </WriteOn>
          {c.blessing ? <FadeUp at={at()} style={{ marginTop: 36 }}>{block(c.blessing)}</FadeUp> : null}
          {c.celebrating ? <FadeUp at={at()} style={{ marginTop: 26 * fit }}>{block(c.celebrating)}</FadeUp> : null}
          {c.families.map((f, i) => (
            <FadeUp key={i} at={at()} style={{ marginTop: 26 * fit }}>
              {block([f.heading, f.names].filter(Boolean).join('\n'))}
            </FadeUp>
          ))}
          {c.rsvp.length ? (
            <FadeUp at={at()} style={{ marginTop: 26 * fit }}>
              {block([t(lang, 'rsvp'), ...c.rsvp.map((r) => [r.name, r.phone].filter(Boolean).join(' - '))].join('\n'))}
            </FadeUp>
          ) : null}
          {c.mapLink ? (
            <FadeUp at={at()} style={{ marginTop: 18 * fit }}>
              <div style={{ fontSize: size * 0.9, color: ROSE, letterSpacing: 3 }}>⌖ {t(lang, 'directions').toUpperCase()}</div>
            </FadeUp>
          ) : null}
        </div>
      </CardFace>
    </Layers>
  );
}

export function EndScene({ data, frame, fps, durationInFrames, plan, styles }) {
  const { fonts, lang } = useCtx();
  const inP = easeOutCubic(prog(frame, plan.reveal + Math.round(0.2 * fps), Math.round(0.6 * fps)));
  const outP = prog(frame, durationInFrames - 8, 8);
  const logo = data.meta.brandLogo || 'brand/logo.png';
  return (
    <Layers wrap={styles.wrap} bgStyle={styles.bg} contentStyle={styles.content} bg={<Art src="art/bg_cream.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: inP * (1 - outP) }}>
        <Art src={logo} style={{ width: 480, height: 'auto' }} />
        {data.meta.rsvpUrl ? (
          <div style={{ position: 'absolute', top: 1140, left: 0, right: 0, textAlign: 'center', fontFamily: fonts.sans, color: '#8b7a5a' }}>
            <div style={{ fontSize: 26, letterSpacing: 2 }}>{t(lang, 'wishes')}</div>
            <div style={{ fontSize: 24, marginTop: 8, opacity: 0.85 }}>{data.meta.rsvpUrl.replace(/^https?:\/\//, '')}</div>
          </div>
        ) : null}
      </AbsoluteFill>
    </Layers>
  );
}
