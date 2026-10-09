import React from 'react';
import { AbsoluteFill } from 'remotion';
import { StampFrame, Art, FitText, FadeUp, WriteOn, PopIn, Prop, Stars, Watercolour, useCtx, Layers } from '../components/core.jsx';
import { STAMP, themeFor } from '../lib/themes.js';
import { dateParts, t } from '../lib/i18n.js';
import { W, prog, easeOutCubic, lerp } from '../lib/anim.js';

export function eventGeometry(event, kind) {
  const th = themeFor(event);
  if (kind === 'closingZoom') {
    return { focal: { x: STAMP.x + STAMP.w / 2, y: STAMP.y + STAMP.h / 2 }, zoom: 2.7 };
  }
  const p = th.props[0];
  const f = (p && p.focus) || [0.5, 0.45];
  const focal = p ? { x: p.x + p.w * f[0], y: p.y + p.w * f[1] } : { x: STAMP.x + STAMP.w / 2, y: STAMP.y + STAMP.h * 0.8 };
  return { focal, zoom: 10 };
}

export function EventScene({ data, event, frame, fps, plan, styles, push }) {
  const { fonts, lang } = useCtx();
  const th = themeFor(event);
  const s = (x) => Math.round(x * fps);

  // stamp-group entrance
  let groupT = '';
  let groupO = 1;
  if (plan.mode === 'grow') {
    const g = easeOutCubic(prog(frame, plan.start, plan.len));
    const sc = lerp(0.07, 1, g);
    groupT = `scale(${sc})`;
    groupO = frame < plan.start ? 0 : 1;
  } else if (plan.mode === 'rise') {
    const g = easeOutCubic(prog(frame, plan.start, plan.len));
    groupT = `translateY(${lerp(1150, 0, g)}px)`;
  }
  const growEnd = plan.start + plan.len;
  const r = plan.reveal; // text/date reveal start
  const [dd, mm, yy] = dateParts(event.date, lang);
  const maxW = W - 150;
  let k = 0;
  const step = () => r + s(1.15) + s(0.22) * k++;

  const bg = (
    <AbsoluteFill>
      <Art src={th.bg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {th.deco.map((p, i) => <Prop key={i} p={p} frame={frame} />)}
      {th.stars ? <Stars frame={frame} /> : null}
    </AbsoluteFill>
  );

  return (
    <Layers wrap={styles.wrap} push={push} bgStyle={styles.bg} contentStyle={styles.content} bg={bg}>
      {/* stamp + props group */}
      <AbsoluteFill style={{ transform: groupT, transformOrigin: `${STAMP.x + STAMP.w / 2}px ${STAMP.y + STAMP.h / 2}px`, opacity: groupO }}>
        <StampFrame w={STAMP.w} h={STAMP.h} edge={th.edge} edgeW={22} bandW={22} perfR={7} perfGap={21} style={{ left: STAMP.x, top: STAMP.y }}>
          {th.sun ? <Watercolour x={th.sun.x - STAMP.x - 44} y={th.sun.y - STAMP.y - 44} r={th.sun.r} color={th.sun.color} /> : null}
          <div style={{ position: 'absolute', left: 36, top: 150, ...(styles.detail || {}), fontFamily: fonts.numerals, color: th.date, fontSize: 108, lineHeight: 1.3 }}>
            <WriteOn at={r} dur={s(0.45)}><div>{dd}</div></WriteOn>
            <WriteOn at={r + s(0.3)} dur={s(0.45)}><div>{mm}</div></WriteOn>
            <WriteOn at={r + s(0.6)} dur={s(0.5)}><div>{yy}</div></WriteOn>
          </div>
        </StampFrame>
        {th.innerOrnament ? (
          <PopIn style={styles.detail} at={r - s(0.2)} origin="50% 0%"><Prop p={th.innerOrnament} frame={frame} /></PopIn>
        ) : null}
        {th.props.map((p, i) => (
          <PopIn key={i} at={Math.max(plan.start, growEnd - s(0.9)) + i * 4} style={{ position: 'absolute', inset: 0 }}>
            <Prop p={p} frame={0} />
          </PopIn>
        ))}
      </AbsoluteFill>

      {/* text block */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1268, display: 'flex', flexDirection: 'column', alignItems: 'center', ...(styles.detail || {}) }}>
        {event.tagline ? (
          <WriteOn at={r + s(0.9)} dur={s(0.9)}>
            <FitText text={event.tagline} font={fonts.display} size={84} color={th.title} maxWidth={maxW} minScale={0.5} lineHeight={1.15} style={{ WebkitTextStroke: `1.1px ${th.title}` }} />
          </WriteOn>
        ) : null}
        <FadeUp at={step()} style={{ marginTop: 6 }}>
          <FitText text={event.title} upper font={fonts.sans} size={31} letterSpacing={11} color={th.sub} maxWidth={maxW} />
        </FadeUp>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {event.timings.map((x, i) => (
            <FadeUp key={i} at={step()}>
              <FitText text={x.label ? `${x.label}  -  ${x.time}` : x.time} font={fonts.sans} size={37} letterSpacing={1.5} color={th.body} maxWidth={maxW} />
            </FadeUp>
          ))}
        </div>
        {th.icon ? (
          <FadeUp at={step()} style={{ marginTop: 30 }}>
            <Art src={th.icon} style={{ width: 66, height: 'auto' }} />
          </FadeUp>
        ) : null}
        {event.venue ? (
          <FadeUp at={step()} style={{ marginTop: 22 }}>
            <FitText text={event.venue} font={fonts.sans} size={38} letterSpacing={1.5} color={th.body} maxWidth={maxW} />
          </FadeUp>
        ) : null}
        {event.address ? (
          <FadeUp at={step()} style={{ marginTop: 2 }}>
            <FitText text={event.address} font={fonts.sans} size={31} letterSpacing={1} color={th.body} maxWidth={maxW} lineHeight={1.3} />
          </FadeUp>
        ) : null}
        {event.dressCode ? (
          <FadeUp at={step()} style={{ marginTop: 14 }}>
            <FitText text={`${t(lang, 'dress')}: ${event.dressCode}`} font={fonts.sans} size={24} color={th.body} maxWidth={maxW} style={{ fontStyle: 'italic' }} />
          </FadeUp>
        ) : null}
      </div>
    </Layers>
  );
}
