import React from 'react';
import { StampFrame, Art, FitText, FadeUp, WriteOn, useCtx, Layers, Watercolour } from '../components/core.jsx';
import { LANDMARKS } from '../lib/themes.js';
import { t } from '../lib/i18n.js';
import { W, H, prog } from '../lib/anim.js';

// Full-screen card geometry (shared with the opener stamp and the closing card).
export const CARD = { edgeW: 72, bandW: 70, perfR: 22, perfGap: 64, edge: '#e07a8f' };
export const PAPER_INSET = CARD.edgeW + CARD.bandW; // 142
export const LM_BOX = (() => {
  const w = W - PAPER_INSET * 2; // 796
  const h = Math.round(w / 1.6);
  return { x: PAPER_INSET, y: H - PAPER_INSET - h, w, h };
})();

export function sunFocal(landmark) {
  const lm = LANDMARKS[landmark] || LANDMARKS.taj;
  // the image is drawn object-fit: cover, anchored bottom-centre
  const imgW = Math.max(LM_BOX.w, LM_BOX.h * lm.aspect);
  const imgH = imgW / lm.aspect;
  const offX = (imgW - LM_BOX.w) / 2;
  const offY = imgH - LM_BOX.h;
  return { x: LM_BOX.x + lm.sun[0] * imgW - offX, y: LM_BOX.y + lm.sun[1] * imgH - offY };
}

/** The card itself: perforated pink frame, paper, landmark at the bottom. Children = text layer. */
export function CardFace({ landmark, children, flowerOpacity = 0 }) {
  const lm = LANDMARKS[landmark] || LANDMARKS.taj;
  return (
    <StampFrame w={W} h={H} edge={CARD.edge} edgeW={CARD.edgeW} bandW={CARD.bandW} perfR={CARD.perfR} perfGap={CARD.perfGap}>
      <div style={{ position: 'absolute', left: LM_BOX.x - PAPER_INSET, top: LM_BOX.y - PAPER_INSET, width: LM_BOX.w, height: LM_BOX.h, mixBlendMode: 'multiply' }}>
        <Art src={lm.src} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 100%' }} />
      </div>
      {/* saturated watercolour sun over the painted one: the sun zoom dives into it */}
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'multiply' }}>
        <Watercolour x={sunFocal(landmark).x - PAPER_INSET} y={sunFocal(landmark).y - PAPER_INSET} r={38} color="#f5be58" />
      </div>
      {flowerOpacity > 0 ? (
        <div style={{ position: 'absolute', left: (W - PAPER_INSET * 2) / 2 - 150, top: 330, width: 300, opacity: flowerOpacity }}>
          <Art src="art/flower.webp" style={{ width: '100%' }} />
        </div>
      ) : null}
      {children}
    </StampFrame>
  );
}

const OLIVE = '#7d7b44';
const ROSE = '#cf4f69';

export function MainCardText({ data, reveal, frame }) {
  const { fonts, lang } = useCtx();
  const brideFirst = data.meta.order === 'bride_first';
  const first = brideFirst ? data.couple.bride : data.couple.groom;
  const second = brideFirst ? data.couple.groom : data.couple.bride;
  const hostFam = brideFirst ? data.brideFamily : data.groomFamily;
  const otherFam = brideFirst ? data.groomFamily : data.brideFamily;
  const maxW = W - PAPER_INSET * 2 - 70;
  const s = 7; // stagger (frames)
  let k = 0;
  const at = () => reveal + s * k++;
  const icons = data.blessing.icons;
  const inv = data.blessing.invocations;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 262 - PAPER_INSET, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: fonts.sans }}>
      {icons.length || inv.length ? (
        <FadeUp at={at()} style={{ display: 'flex', gap: 48, alignItems: 'flex-end', height: 150 }}>
          {[0, 1].map((i) => (icons[i] || inv[i]) ? (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {icons[i] ? <Art src={`art/bless_${icons[i]}.webp`} style={{ height: 112, width: 'auto' }} /> : null}
              {inv[i] ? <div style={{ fontFamily: fonts.sans, fontSize: 18, color: ROSE, whiteSpace: 'nowrap' }}>{inv[i]}</div> : null}
            </div>
          ) : null)}
        </FadeUp>
      ) : null}
      {data.blessing.text ? (
        <FadeUp at={at()} style={{ marginTop: 40 }}>
          <FitText text={data.blessing.text} font={fonts.sans} size={26.5} color={OLIVE} maxWidth={maxW} lineHeight={1.7} />
        </FadeUp>
      ) : null}
      {hostFam.parents ? (
        <FadeUp at={at()} style={{ marginTop: 30 }}>
          <FitText text={hostFam.parents} font={fonts.sans} size={31} color={ROSE} maxWidth={maxW} />
        </FadeUp>
      ) : null}
      {data.hosts.request || data.hosts.relationWord ? (
        <FadeUp at={at()} style={{ marginTop: 8 }}>
          <FitText text={[data.hosts.request, data.hosts.relationWord].filter(Boolean).join('\n')} font={fonts.sans} size={26.5} color={OLIVE} maxWidth={maxW} lineHeight={1.45} />
        </FadeUp>
      ) : null}
      <WriteOn at={at() + 4} dur={30} style={{ marginTop: 34 }}>
        <FitText text={first} font={fonts.display} size={122} color={ROSE} maxWidth={maxW} minScale={0.5} lineHeight={1.15} style={{ fontWeight: 400, WebkitTextStroke: `1.3px ${ROSE}` }} />
      </WriteOn>
      <FadeUp at={(k += 3, at())} style={{ marginTop: 2 }}>
        <div style={{ fontSize: 21, color: OLIVE, margin: '6px 0' }}>{t(lang, 'with')}</div>
      </FadeUp>
      <WriteOn at={at()} dur={30} style={{ marginTop: 4 }}>
        <FitText text={second} font={fonts.display} size={122} color={ROSE} maxWidth={maxW} minScale={0.5} lineHeight={1.15} style={{ WebkitTextStroke: `1.3px ${ROSE}` }} />
      </WriteOn>
      {otherFam.relation ? (
        <FadeUp at={(k += 3, at())} style={{ marginTop: 10 }}>
          <FitText text={otherFam.relation} font={fonts.sans} size={26.5} color={OLIVE} maxWidth={maxW} />
        </FadeUp>
      ) : null}
      <FadeUp at={at()} style={{ marginTop: 30 }}>
        <Art src="art/icon_chrysanthemum.webp" style={{ width: 56, height: 'auto' }} />
      </FadeUp>
      {data.mainCard.dateLine ? (
        <FadeUp at={at()} style={{ marginTop: 28 }}>
          <FitText text={data.mainCard.dateLine} font={fonts.sans} size={33} color={OLIVE} maxWidth={maxW} />
        </FadeUp>
      ) : null}
      {data.mainCard.venueLine ? (
        <FadeUp at={at()} style={{ marginTop: 4 }}>
          <FitText text={data.mainCard.venueLine} font={fonts.sans} size={28} color={OLIVE} maxWidth={maxW} />
        </FadeUp>
      ) : null}
      {hostFam.address ? (
        <FadeUp at={at()} style={{ marginTop: 6 }}>
          <FitText text={hostFam.address} font={fonts.sans} size={20} color={OLIVE} maxWidth={maxW} lineHeight={1.35} />
        </FadeUp>
      ) : null}
    </div>
  );
}

export function MainCardScene({ data, frame, plan, styles, push }) {
  const flower = 1 - prog(frame, plan.reveal, 18);
  return (
    <Layers wrap={styles.wrap} push={push} bgStyle={styles.bg} contentStyle={styles.content} bg={<div style={{ position: 'absolute', inset: 0, background: '#efe5d0' }} />}>
      <CardFace landmark={data.meta.landmark} flowerOpacity={flower}>
        <MainCardText data={data} reveal={plan.reveal} frame={frame} />
      </CardFace>
    </Layers>
  );
}
