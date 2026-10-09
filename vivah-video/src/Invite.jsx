import React, { useMemo, useState, useEffect } from 'react';
import { AbsoluteFill, Audio, Img, Video, Freeze, Sequence, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender, interpolate } from 'remotion';
import { loadFont } from '@remotion/fonts';
import { Ctx, Art, FitText, useCtx, useAsset } from './components/core.jsx';
import { normalize } from './lib/schema.js';
import { buildTimeline, FPS } from './lib/timeline.js';
import { fonts as fontStacks, FONT_FILES } from './lib/i18n.js';
import { W, H, prog, lerp, easeOutCubic } from './lib/anim.js';
import { STORY_LIBRARY } from './lib/themes.js';

const PALETTES = {
  soft: { bg: 'art/vivah_arch_soft.jpg', paper: '#fffaf3', ink: '#453a39', rose: '#a95c73', sage: '#788a79', gold: '#c6a45e', edge: '#d7c18c' },
  maroon_gold: { bg: 'art/vivah_arch_maroon.jpg', paper: '#fff8ed', ink: '#4b1d2b', rose: '#821f3b', sage: '#71806b', gold: '#c8a04d', edge: '#c8a04d' },
};
const COLORS = (key) => PALETTES[key] || PALETTES.soft;
const loadedFonts = new Map();
function useFonts(base) {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading Vivah video fonts'));
  useEffect(() => {
    const resolve = (p) => base ? `${base.replace(/\/$/, '')}/${p}` : staticFile(p);
    Promise.all(FONT_FILES.map(([family, file, weight]) => {
      const key = `${family}|${weight}`;
      if (!loadedFonts.has(key)) loadedFonts.set(key, loadFont({ family, url: resolve(file), weight }).catch(() => null));
      return loadedFonts.get(key);
    })).then(() => { setReady(true); continueRender(handle); });
  }, []);
  return ready;
}

function Paper({ palette, children }) {
  const c = COLORS(palette);
  return <AbsoluteFill style={{ overflow: 'hidden', background: c.paper }}>
    <Art src={c.bg} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    {children}
  </AbsoluteFill>;
}

function Ornament({ palette, top = 250 }) {
  const c = COLORS(palette);
  return <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', justifyContent: 'center', alignItems: 'center', color: c.gold, fontSize: 35, letterSpacing: 12 }}><span>✦  ❧  ✦</span></div>;
}

function IntroScene({ data, frame, fps, palette }) {
  const c = COLORS(palette);
  const reveal = easeOutCubic(prog(frame, 2, Math.round(.8 * fps)));
  const drift = .025 * Math.min(1, frame / (5.5 * fps));
  return <Paper palette={palette}>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 760, height: 760, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: reveal, transform: `scale(${lerp(.94, 1, reveal) + drift})` }}>
        <Art src="art/ganesha_vivah.jpg" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'absolute', top: 1330, left: 0, right: 0, textAlign: 'center', color: c.rose, fontFamily: "'PG Script', cursive", fontSize: 64 }}>{data.blessing.invocations[0] || 'Shree Ganeshaya Namah'}</div>
      <div style={{ position: 'absolute', top: 1435, left: 100, right: 100, textAlign: 'center', color: c.ink, fontFamily: "'PG Sans', sans-serif", fontSize: 27, letterSpacing: 2 }}>{data.opener.coverLine}</div>
      <div style={{ position: 'absolute', top: 1480, left: 100, right: 100, textAlign: 'center', color: c.sage, fontFamily: "'PG Sans', sans-serif", fontSize: 24, letterSpacing: 1 }}>{data.opener.coverVenue}</div>
      <Ornament palette={palette} top={1550} />
    </AbsoluteFill>
  </Paper>;
}

function LogoScene({ data, frame, fps, palette }) {
  const c = COLORS(palette);
  const p = easeOutCubic(prog(frame, Math.round(.18 * fps), Math.round(.95 * fps)));
  const initials = `${data.couple.brideInitial || (data.couple.bride || 'M').charAt(0)}${data.couple.groomInitial || (data.couple.groom || 'A').charAt(0)}`;
  const hasLogo = !!data.meta.logoUpload;
  return <Paper palette={palette}>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 335, left: 0, right: 0, textAlign: 'center', fontFamily: "'PG Sans', sans-serif", fontSize: 28, letterSpacing: 7, color: c.sage }}>A WEDDING CELEBRATION</div>
      <div style={{ width: 470, height: 470, position: 'absolute', top: 650, left: 305, borderRadius: '50%', border: `2px solid ${c.gold}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c.paper}b8`, boxShadow: `0 12px 50px ${c.rose}16`, transform: `scale(${lerp(.86, 1, p)})`, opacity: p }}>
        <div style={{ width: 365, height: 365, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasLogo
            ? <Art src={data.meta.logoUpload} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <div aria-label={`Monogram ${initials}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'PG Script', cursive", fontSize: 200, lineHeight: 1, color: c.rose, letterSpacing: -12, textShadow: `1px 1px 0 ${c.gold}` }}>{initials}</div>}
        </div>
      </div>
      <div style={{ position: 'absolute', top: 1190, left: 100, right: 100, textAlign: 'center', fontFamily: "'PG Display', serif", fontSize: 70, color: c.rose }}>{data.couple.bride} &amp; {data.couple.groom}</div>
      <Ornament palette={palette} top={1325} />
    </AbsoluteFill>
  </Paper>;
}

function MainScene({ data, frame, fps, palette }) {
  const c = COLORS(palette);
  const p = easeOutCubic(prog(frame, Math.round(.2 * fps), Math.round(1.2 * fps)));
  const order = data.meta.order === 'groom_first' ? ['groomFamily', 'brideFamily'] : ['brideFamily', 'groomFamily'];
  const families = order.map((k) => data[k]);
  return <Paper palette={palette}>
    <AbsoluteFill style={{ alignItems: 'center', textAlign: 'center', opacity: p, padding: '260px 120px 200px', boxSizing: 'border-box' }}>
      <Art src="art/ganesha_vivah.jpg" style={{ width: 190, height: 190, objectFit: 'contain', marginBottom: 18 }} />
      <div style={{ color: c.rose, letterSpacing: 5, fontFamily: "'PG Sans', sans-serif", fontSize: 28, textTransform: 'uppercase' }}>With the blessings of</div>
      <div style={{ color: c.ink, fontFamily: "'PG Display', serif", fontSize: 42, lineHeight: 1.4, marginTop: 12 }}>{families[0].parents}</div>
      <div style={{ color: c.sage, fontFamily: "'PG Sans', sans-serif", fontSize: 28, lineHeight: 1.5, marginTop: 58 }}>joyfully invite you to celebrate the wedding of</div>
      <div style={{ color: c.rose, fontFamily: "'PG Script', cursive", fontSize: 102, lineHeight: 1.15, marginTop: 30 }}>{data.meta.order === 'groom_first' ? data.couple.groom : data.couple.bride}</div>
      <div style={{ color: c.gold, fontFamily: "'PG Display', serif", fontSize: 34, margin: '5px 0' }}>with</div>
      <div style={{ color: c.rose, fontFamily: "'PG Script', cursive", fontSize: 102, lineHeight: 1.15 }}>{data.meta.order === 'groom_first' ? data.couple.bride : data.couple.groom}</div>
      <div style={{ color: c.ink, fontFamily: "'PG Display', serif", fontSize: 35, lineHeight: 1.4, marginTop: 36 }}>{families[1].relation}</div>
      <div style={{ color: c.sage, fontFamily: "'PG Sans', sans-serif", fontSize: 31, lineHeight: 1.55, marginTop: 54 }}>{data.mainCard.dateLine}</div>
      <div style={{ color: c.rose, fontFamily: "'PG Display', serif", fontSize: 38, marginTop: 10 }}>{data.mainCard.venueLine}</div>
      <div style={{ color: c.ink, fontFamily: "'PG Sans', sans-serif", fontSize: 25, marginTop: 5 }}>{families[0].address}</div>
    </AbsoluteFill>
  </Paper>;
}

function EventScene({ event, frame, fps, palette }) {
  const c = COLORS(palette);
  const p = easeOutCubic(prog(frame, Math.round(.2 * fps), Math.round(.8 * fps)));
  const parts = event.date ? event.date.split('-') : [];
  const dateLabel = parts.length === 3 ? `${parts[2]} · ${['','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][Number(parts[1])]} · ${parts[0]}` : '';
  return <Paper palette={palette}>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '300px 120px 220px', boxSizing: 'border-box', opacity: p }}>
      <div style={{ color: c.rose, fontFamily: "'PG Sans', sans-serif", fontSize: 34, letterSpacing: 6 }}>{dateLabel}</div>
      <Ornament palette={palette} top={690} />
      <div style={{ color: c.ink, fontFamily: "'PG Script', cursive", fontSize: 102, lineHeight: 1.2, marginTop: 42 }}>{event.title}</div>
      {event.tagline ? <div style={{ color: c.sage, fontFamily: "'PG Display', serif", fontSize: 45, marginTop: 10 }}>{event.tagline}</div> : null}
      <div style={{ marginTop: 58, width: 600, height: 2, background: c.gold }} />
      <div style={{ color: c.rose, fontFamily: "'PG Sans', sans-serif", fontSize: 34, letterSpacing: 3, marginTop: 48 }}>{event.timings.map((t) => [t.label, t.time].filter(Boolean).join(' · ')).join('\n')}</div>
      <div style={{ color: c.ink, fontFamily: "'PG Display', serif", fontSize: 43, lineHeight: 1.35, marginTop: 44 }}>{event.venue}</div>
      <div style={{ color: c.sage, fontFamily: "'PG Sans', sans-serif", fontSize: 27, lineHeight: 1.35, marginTop: 5 }}>{event.address}</div>
      {event.dressCode ? <div style={{ color: c.sage, fontFamily: "'PG Sans', sans-serif", fontSize: 24, marginTop: 18 }}>Attire · {event.dressCode}</div> : null}
      <Art src="art/ganesha_vivah.jpg" style={{ position: 'absolute', width: 240, height: 240, objectFit: 'contain', bottom: 300, left: 420, opacity: .76 }} />
    </AbsoluteFill>
  </Paper>;
}

function FilmClip({ src, clipSec, frameSeq, poster, visibleFrames, fps }) {
  const a = useAsset();
  const f = useCurrentFrame();
  const visibleSec = visibleFrames / fps;
  const rate = Math.max(.6, Math.min(1, clipSec / visibleSec));
  const lastFrame = Math.max(0, Math.floor((clipSec / rate) * fps) - 2);
  if (frameSeq?.count) {
    const n = Math.min(frameSeq.count, Math.max(1, Math.floor(Math.min(f, lastFrame) * rate * (frameSeq.fps || fps) / fps) + 1));
    return <Img src={a(`${frameSeq.base}/${String(n).padStart(5, '0')}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  const el = <Video src={a(src)} muted playbackRate={rate} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return f >= lastFrame ? <Freeze frame={lastFrame}>{el}</Freeze> : el;
}

function StoryScene({ story, frame, fps, durationInFrames, palette }) {
  const c = COLORS(palette);
  return <Paper palette={palette}>
    <AbsoluteFill style={{ inset: 74, border: `4px solid ${c.edge}`, boxSizing: 'border-box', overflow: 'hidden', borderRadius: 34, backgroundColor: c.paper }}>
      <FilmClip src={story.src} clipSec={story.clipSec} frameSeq={story.frameSeq} poster={story.poster} visibleFrames={durationInFrames} fps={fps} />
    </AbsoluteFill>
    <div style={{ position: 'absolute', left: 90, right: 90, top: 115, height: 3, background: c.gold }} />
  </Paper>;
}

function ClosingScene({ data, palette }) {
  const c = COLORS(palette);
  return <Paper palette={palette}>
    <AbsoluteFill style={{ alignItems: 'center', textAlign: 'center', padding: '275px 110px 190px', boxSizing: 'border-box' }}>
      <div style={{ color: c.rose, fontFamily: "'PG Script', cursive", fontSize: 94 }}>{data.closing.title || 'With joy'}</div>
      <Ornament palette={palette} top={530} />
      <div style={{ marginTop: 105, color: c.ink, fontFamily: "'PG Display', serif", fontSize: 38, lineHeight: 1.5 }}>{data.closing.blessing}</div>
      <div style={{ marginTop: 40, color: c.sage, fontFamily: "'PG Sans', sans-serif", fontSize: 30, lineHeight: 1.5 }}>{data.closing.celebrating}</div>
      {data.closing.qrCode ? <div style={{ position: 'absolute', top: 1000, left: 330, width: 420, height: 420, padding: 18, boxSizing: 'border-box', border: `2px solid ${c.gold}`, background: '#fff', borderRadius: 16 }}><Art src={data.closing.qrCode} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div> : null}
      <div style={{ position: 'absolute', left: 110, right: 110, bottom: 280, color: c.rose, fontFamily: "'PG Sans', sans-serif", fontSize: 25, letterSpacing: 4 }}>{data.closing.qrCode ? 'SCAN TO FIND YOUR WAY' : 'WITH LOVE FROM THE SHARMA & VERMA FAMILIES'}</div>
    </AbsoluteFill>
  </Paper>;
}

function EndScene({ data }) {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = easeOutCubic(prog(f, Math.round(.25 * fps), Math.round(.65 * fps)));
  const out = prog(f, durationInFrames - 10, 10);
  return <AbsoluteFill style={{ background: '#fbf8f1', alignItems: 'center', justifyContent: 'center', opacity: p * (1 - out) }}>
    <Art src="brand/paigaam-logo.png" style={{ width: 430, maxHeight: 220, objectFit: 'contain' }} />
    <div style={{ position: 'absolute', top: 1130, left: 100, right: 100, textAlign: 'center', fontFamily: "'PG Sans', sans-serif", fontSize: 27, color: '#71806b', letterSpacing: 4 }}>MADE FOR MOMENTS THAT MATTER</div>
  </AbsoluteFill>;
}

function transitionStyle(s, frame) {
  let opacity = 1;
  let transform = '';
  if (s.enter) {
    const p = prog(frame, 0, s.enter.len);
    if (s.enter.type === 'stampZoom' || s.enter.type === 'closingZoom') { transform = `scale(${lerp(.16, 1, easeOutCubic(p))})`; opacity = Math.max(opacity, lerp(0, 1, p)); }
    else if (s.enter.type === 'slideSwap') { transform = `translate(${lerp(760, 0, easeOutCubic(p))}px, ${lerp(930, 0, easeOutCubic(p))}px) scale(${lerp(.42, 1, p)})`; opacity = p; }
    else if (s.enter.type === 'fabricZoom' || s.enter.type === 'sunZoom' || s.enter.type === 'propsZoom') { transform = `scale(${lerp(2.8, 1, easeOutCubic(p))})`; opacity = prog(p, .45, .4); }
    else if (s.enter.type === 'shrinkRise' || s.enter.type === 'liftAway') { transform = `translateY(${lerp(550, 0, easeOutCubic(p))}px)`; opacity = prog(p, .15, .65); }
    else if (s.enter.type === 'fadeToPaper') opacity = p;
  }
  if (s.exit) {
    const start = s.duration - s.exit.len;
    const p = prog(frame, start, s.exit.len);
    if (s.exit.type === 'stampZoom' || s.exit.type === 'closingZoom' || s.exit.type === 'sunZoom' || s.exit.type === 'propsZoom' || s.exit.type === 'fabricZoom') transform += ` scale(${lerp(1, s.exit.type === 'stampZoom' ? 5 : 3.1, p)})`;
    else if (s.exit.type === 'slideSwap' || s.exit.type === 'shrinkExit') transform += ` translate(${lerp(0, -760, p)}px, ${lerp(0, -930, p)}px) scale(${lerp(1, .58, p)})`;
    else if (s.exit.type === 'liftAway') transform += ` translateY(${lerp(0, -1450, p)}px) scale(${lerp(1, .58, p)})`;
    else if (s.exit.type === 'shrinkRise') transform += ` scale(${lerp(1, .16, p)})`;
    else if (s.exit.type === 'fadeToPaper') opacity *= (1 - p);
    if (p > .3 && ['stampZoom','closingZoom','sunZoom','propsZoom','fabricZoom','slideSwap','shrinkExit','liftAway','shrinkRise'].includes(s.exit.type)) opacity *= 1 - prog(p, .72, .28);
  }
  return { transform: transform.trim() || 'none', transformOrigin: '50% 50%', opacity };
}

function Scene({ s, data, fps }) {
  const frame = useCurrentFrame();
  const palette = data.meta.palette;
  const common = { data, frame, fps, palette };
  let content;
  switch (s.kind) {
    case 'opener': content = <IntroScene {...common} />; break;
    case 'logo': content = <LogoScene {...common} />; break;
    case 'main': content = <MainScene {...common} />; break;
    case 'event': content = <EventScene {...common} event={s.event} />; break;
    case 'story': content = <StoryScene {...common} story={s.story} durationInFrames={s.duration} />; break;
    case 'closing': content = <ClosingScene {...common} />; break;
    case 'end': content = <EndScene data={data} />; break;
    default: content = <AbsoluteFill style={{ background: '#fff' }} />;
  }
  return <AbsoluteFill style={transitionStyle(s, frame)}>{content}</AbsoluteFill>;
}

export function Invite(props) {
  const { fps, durationInFrames } = useVideoConfig();
  const data = useMemo(() => normalize(props.data, { allowLocal: !!props.allowLocal }), [props.data, props.allowLocal]);
  const tl = useMemo(() => buildTimeline(data, fps), [data, fps]);
  const ready = useFonts(props.assetBase);
  const ctx = useMemo(() => ({ base: props.assetBase || '', fonts: fontStacks(data.meta.lang), lang: data.meta.lang, fontsReady: ready }), [props.assetBase, data.meta.lang, ready]);
  const frame = useCurrentFrame();
  return <Ctx.Provider value={ctx}>
    <AbsoluteFill style={{ background: COLORS(data.meta.palette).paper }}>
      {tl.segments.map((s, i) => <Sequence key={`${s.kind}-${i}`} from={s.start} durationInFrames={s.duration} layout="none"><Scene s={s} data={data} fps={fps} /></Sequence>)}
      {data.meta.music.src ? <Track src={data.meta.music.src} volume={data.meta.music.volume} duration={durationInFrames} fps={fps} /> : null}
    </AbsoluteFill>
  </Ctx.Provider>;
}

function Track({ src, volume, duration, fps }) {
  const a = useAsset();
  return <Audio src={a(src)} volume={(f) => volume * interpolate(f, [0, 10, duration - fps, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />;
}

export function InviteLandscape(props) {
  const scale = 1080 / 1920;
  return <AbsoluteFill style={{ background: '#f6f0e6' }}><div style={{ position: 'absolute', left: (1920 - W * scale) / 2, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}><Invite {...props} /></div></AbsoluteFill>;
}
