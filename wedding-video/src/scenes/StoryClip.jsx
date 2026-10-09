import React from 'react';
import { AbsoluteFill, OffthreadVideo, Video, Img, Freeze, getRemotionEnvironment, useCurrentFrame } from 'remotion';
import { StampFrame, Art, useAsset, Layers } from '../components/core.jsx';
import { THEMES } from '../lib/themes.js';
import { W, H, prog, easeOutCubic, lerp } from '../lib/anim.js';

const FRAME = { edgeW: 40, bandW: 56, perfR: 13, perfGap: 40 };

function Clip({ src, clipSec, frameSeq, visibleFrames, fps }) {
  const a = useAsset();
  const frame = useCurrentFrame();
  const url = a(src);
  if (/\.(png|jpe?g|webp)$/i.test(src)) return <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  // Painted clips are 5-8s. Slow them gently (never below 0.6x) to cover the scene, then hold the last frame.
  const visibleSec = visibleFrames / fps;
  const rate = Math.max(0.6, Math.min(1, clipSec / visibleSec));
  const lastFrame = Math.max(0, Math.floor((clipSec / rate) * fps) - 2);
  if (frameSeq && frameSeq.count > 0) {
    // Server renders use a pre-extracted JPEG sequence (frame-exact, no video seeking).
    const n = Math.min(frameSeq.count, Math.max(1, Math.floor(Math.min(frame, lastFrame) * rate * (frameSeq.fps || 30) / fps) + 1));
    return <Img src={a(`${frameSeq.base}/${String(n).padStart(5, '0')}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  const env = getRemotionEnvironment();
  const V = env.isRendering ? OffthreadVideo : Video;
  const el = <V src={url} muted playbackRate={rate} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return frame >= lastFrame ? <Freeze frame={lastFrame}>{el}</Freeze> : el;
}

export function storyGeometry(story) {
  return { focal: { x: story.focus[0] * W, y: story.focus[1] * H } };
}

export function StoryScene({ story, backdrop, frame, fps, plan, styles, push, durationInFrames }) {
  const th = THEMES[backdrop] || THEMES.baraat;
  let t = '';
  if (plan.mode === 'grow') {
    const g = easeOutCubic(prog(frame, plan.start, plan.len));
    t = `scale(${lerp(0.14, 1, g)})`;
  } else if (plan.mode === 'rise') {
    const g = easeOutCubic(prog(frame, plan.start, plan.len));
    t = `translateY(${lerp(1960, 0, g)}px)`;
  }
  const bg = (
    <AbsoluteFill>
      <Art src={th.bg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  );
  return (
    <Layers wrap={styles.wrap} push={push} bgStyle={styles.bg} contentStyle={styles.content} bg={bg}>
      <AbsoluteFill style={{ transform: t, transformOrigin: '50% 50%' }}>
        <StampFrame w={W} h={H} edge={th.edge} paper="" paperTone="#000" {...FRAME}>
          <Clip src={story.src} clipSec={story.clipSec} frameSeq={story.frameSeq} visibleFrames={durationInFrames} fps={fps} />
        </StampFrame>
      </AbsoluteFill>
    </Layers>
  );
}
