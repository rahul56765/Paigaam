import React, { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Sequence, Audio, useCurrentFrame, useVideoConfig, delayRender, continueRender, interpolate, staticFile } from 'remotion';
import { loadFont } from '@remotion/fonts';
import { Ctx, useAsset, Art } from './components/core.jsx';
import { normalize } from './lib/schema.js';
import { buildTimeline } from './lib/timeline.js';
import { exitStyles, enterStyles, entrancePlan } from './lib/transitions.js';
import { fonts as fontStacks, FONT_FILES } from './lib/i18n.js';
import { OpenerScene, openerStampGeometry } from './scenes/Opener.jsx';
import { MainCardScene, sunFocal } from './scenes/MainCard.jsx';
import { EventScene, eventGeometry } from './scenes/EventCard.jsx';
import { StoryScene, storyGeometry } from './scenes/StoryClip.jsx';
import { ClosingScene, EndScene } from './scenes/Closing.jsx';
import { prog, lerp, W } from './lib/anim.js';

const loaded = new Map();
function useFonts(base) {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Loading fonts'));
  const resolve = (p) => (base ? `${base.replace(/\/$/, '')}/${p}` : null);
  useEffect(() => {
    let cancelled = false;
    Promise.all(FONT_FILES.map(([family, file, weight]) => {
      const key = `${family}|${weight}`;
      if (!loaded.has(key)) {
        // staticFile is resolved lazily so the editor can pass its own asset base
        const url = resolve(file) || staticFile(file);
        loaded.set(key, loadFont({ family, url, weight }).catch(() => null));
      }
      return loaded.get(key);
    })).then(() => { if (!cancelled) setReady(true); continueRender(handle); });
    return () => { cancelled = true; };
  }, []);
  return ready;
}

/** Geometry the outgoing scene hands to a transition (where the camera dives). */
function exitGeometry(s, data, fps) {
  if (!s.exit) return {};
  switch (s.kind) {
    case 'opener': return openerStampGeometry((s.duration - s.exit.len) / fps);
    case 'main': return { focal: sunFocal(data.meta.landmark), zoom: 40 };
    case 'event': return eventGeometry(s.event, s.exit.type);
    case 'story': return storyGeometry(s.story);
    default: return {};
  }
}

function Scene({ s, data, geoIn, geoOut, fps }) {
  const frame = useCurrentFrame(); // local to the Sequence
  const enterA = s.enter ? prog(frame, 0, s.enter.len) : 1;
  const exitStart = s.duration - (s.exit ? s.exit.len : 0);
  const exitA = s.exit ? prog(frame, exitStart, s.exit.len) : 0;
  const ein = s.enter && frame < s.enter.len ? enterStyles(s.enter.type, enterA, geoIn) : {};
  const eout = s.exit && frame >= exitStart ? exitStyles(s.exit.type, exitA, geoOut) : {};
  const styles = {
    wrap: merge(ein.wrap, eout.wrap),
    bg: merge(ein.bg, eout.bg),
    content: merge(ein.content, eout.content),
    detail: merge(ein.detail, eout.detail),
  };
  const plan = entrancePlan(s.kind, s.enter, fps);
  // gentle camera push through the hold (frozen during the exit so focal points stay put)
  const push = 1 + 0.035 * Math.min(1, Math.min(frame, exitStart) / Math.max(1, exitStart));
  const common = { data, frame, fps, plan, styles, push, durationInFrames: s.duration };
  switch (s.kind) {
    case 'opener': return <OpenerScene {...common} exitStart={exitStart} />;
    case 'main': return <MainCardScene {...common} push={1 + 0.02 * Math.min(1, Math.min(frame, exitStart) / Math.max(1, exitStart))} />;
    case 'event': return <EventScene {...common} event={s.event} />;
    case 'story': return <StoryScene {...common} story={s.story} backdrop={s.backdrop} push={1} />;
    case 'closing': return <ClosingScene {...common} />;
    case 'end': return <EndScene {...common} />;
    default: return null;
  }
}

// Compose two partial style objects (transforms chain, opacities multiply).
function merge(a, b) {
  if (!a) return b || undefined;
  if (!b) return a;
  const out = { ...a, ...b };
  if (a.transform && b.transform) out.transform = `${b.transform} ${a.transform}`;
  if (a.opacity != null && b.opacity != null) out.opacity = a.opacity * b.opacity;
  if (a.filter && b.filter) out.filter = `${a.filter} ${b.filter}`;
  return out;
}

/** Banana-leaf wipe that sweeps across event->event transitions. */
function LeafWipe({ len }) {
  const f = useCurrentFrame();
  const a = f / len;
  const x = lerp(-1700, 1500, a);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: x, top: -260, width: 1500, transform: `rotate(${lerp(-10, 6, a)}deg)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1050 }}><Art src="art/banana.webp" style={{ width: '100%' }} /></div>
        <div style={{ position: 'absolute', left: 420, top: 300, width: 1050 }}><Art src="art/banana.webp" style={{ width: '100%', transform: 'scaleX(-1)' }} /></div>
        <div style={{ position: 'absolute', left: 120, top: 1150, width: 1200 }}><Art src="art/leaves.webp" style={{ width: '100%' }} /></div>
      </div>
    </AbsoluteFill>
  );
}

export function Invite(props) {
  const { fps, durationInFrames } = useVideoConfig();
  const data = useMemo(() => normalize(props.data, { allowLocal: !!props.allowLocal }), [props.data, props.allowLocal]);
  const tl = useMemo(() => buildTimeline(data, fps), [data, fps]);
  const fontsReady = useFonts(props.assetBase);
  const ctx = useMemo(() => ({ base: props.assetBase || '', fonts: fontStacks(data.meta.lang), lang: data.meta.lang, fontsReady }), [props.assetBase, data.meta.lang, fontsReady]);
  const frame = useCurrentFrame();

  return (
    <Ctx.Provider value={ctx}>
      <AbsoluteFill style={{ background: '#efe5d0' }}>
        {tl.segments.map((s, i) => {
          const prev = tl.segments[i - 1];
          const geoIn = prev ? exitGeometry(prev, data, fps) : {};
          const geoOut = exitGeometry(s, data, fps);
          // z-order: during an overlap the transition decides which side is on top
          let z = 1;
          if (s.enter && frame < s.start + s.enter.len) z = s.enter.incomingOnTop ? 3 : 1;
          if (s.exit && frame >= s.start + s.duration - s.exit.len) z = s.exit.incomingOnTop ? 1 : 3;
          return (
            <Sequence key={`${s.kind}-${i}`} from={s.start} durationInFrames={s.duration} layout="none">
              <AbsoluteFill style={{ zIndex: z }}>
                <Scene s={s} data={data} geoIn={geoIn} geoOut={geoOut} fps={fps} />
              </AbsoluteFill>
            </Sequence>
          );
        })}
        {tl.segments.filter((s) => s.exit && s.exit.type === 'leafWipe').map((s, i) => (
          <Sequence key={`wipe-${i}`} from={s.start + s.duration - s.exit.len} durationInFrames={s.exit.len} layout="none">
            <AbsoluteFill style={{ zIndex: 5 }}><LeafWipe len={s.exit.len} /></AbsoluteFill>
          </Sequence>
        ))}
        {data.meta.music.src ? <Music src={data.meta.music.src} volume={data.meta.music.volume} total={durationInFrames} fps={fps} /> : null}
      </AbsoluteFill>
    </Ctx.Provider>
  );
}

function Music({ src, volume, total, fps }) {
  const a = useAsset();
  return <Audio src={a(src)} volume={(f) => volume * interpolate(f, [0, 10, total - fps * 1.5, total], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />;
}

/** 16:9 export: the identical 9:16 film centred on a paper backdrop. */
export function InviteLandscape(props) {
  const scale = 1080 / 1920;
  return (
    <AbsoluteFill style={{ background: '#efe5d0' }}>
      <Ctx.Provider value={{ base: props.assetBase || '', fonts: {}, lang: 'en', fontsReady: true }}>
        <Art src="art/bg_cream.jpg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.97)' }} />
      </Ctx.Provider>
      <div style={{ position: 'absolute', left: (1920 - W * scale) / 2, top: 0, width: W, height: 1920, transform: `scale(${scale})`, transformOrigin: '0 0', boxShadow: '0 0 60px rgba(80,50,20,0.25)' }}>
        <Invite {...props} />
      </div>
    </AbsoluteFill>
  );
}
