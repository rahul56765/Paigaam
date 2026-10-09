// Second Paigaam wedding film template: Ganesha, required logo/monogram beat,
// family invitation, event cards, fixed illustrated stories and QR-led close.
export const FPS = 30;
export const TRANSITIONS = {
  stampZoom: { len: 0.9, incomingOnTop: true },
  paperReveal: { len: 0.7, incomingOnTop: true },
  slideSwap: { len: 0.9, incomingOnTop: true },
  fabricZoom: { len: 1.2, incomingOnTop: true },
  liftAway: { len: 0.8, incomingOnTop: false },
  fadeToPaper: { len: 0.75, incomingOnTop: false },
  closingZoom: { len: 1.0, incomingOnTop: true },
};

function flowOf(data) {
  const flow = [];
  for (const event of data.events) {
    flow.push({ kind: 'event', event });
    flow.push(...data.stories.filter((s) => s.after === event.id).map((story) => ({ kind: 'story', story })));
  }
  return flow;
}
function pickTransition(a, b, counters) {
  if (a === 'opener') return 'paperReveal';
  if (a === 'logo') return 'stampZoom';
  if (b === 'closing') return 'closingZoom';
  if (b === 'end') return 'fadeToPaper';
  if (a === 'event' && b === 'story') return 'fabricZoom';
  if (a === 'story' && b === 'event') return 'liftAway';
  if (a === 'event' && b === 'event') return 'slideSwap';
  if (a === 'story' && b === 'story') return counters.story++ % 2 ? 'fabricZoom' : 'slideSwap';
  return 'slideSwap';
}
export function buildTimeline(data, fps = FPS) {
  const f = (s) => Math.round(s * fps);
  const flow = flowOf(data);
  const items = [
    { kind: 'opener', hold: data.timing.openerHoldSec },
    { kind: 'logo', hold: data.timing.logoHoldSec },
    { kind: 'main', hold: data.timing.mainHoldSec },
    ...flow.map((x) => ({ ...x, hold: x.kind === 'event' ? x.event.holdSec : x.story.holdSec })),
    { kind: 'closing', hold: data.closing.holdSec },
    { kind: 'end', hold: data.timing.endHoldSec },
  ];
  const counters = { story: 0 };
  const transitions = items.slice(0, -1).map((x, i) => {
    const type = pickTransition(x.kind, items[i + 1].kind, counters);
    return { type, len: f(TRANSITIONS[type].len), incomingOnTop: TRANSITIONS[type].incomingOnTop };
  });
  const segments = [];
  let cursor = 0;
  items.forEach((item, i) => {
    const enter = i > 0 ? transitions[i - 1] : null;
    const exit = i < transitions.length ? transitions[i] : null;
    const start = i === 0 ? 0 : cursor - enter.len;
    const duration = (enter ? enter.len : 0) + f(item.hold) + (exit ? exit.len : 0);
    segments.push({ ...item, index: i, start, duration, enter, exit, prevKind: items[i - 1]?.kind || null, nextKind: items[i + 1]?.kind || null });
    cursor = start + duration;
  });
  return { segments, durationInFrames: cursor, fps };
}
export function durationSeconds(data, fps = FPS) { return buildTimeline(data, fps).durationInFrames / fps; }
