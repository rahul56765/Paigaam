// Builds the scene list and transition plan from normalised data.
// Segments overlap by their transition length; total = sum(durations) - sum(overlaps).
// Transition lengths and the alternation order reproduce the reference edit exactly
// when the sample data is used; adding/removing events or stories re-plans everything.

export const FPS = 30;

// overlap (s) and which side is drawn on top during the overlap
export const TRANSITIONS = {
  stampZoom: { len: 2.2, incomingOnTop: true },
  sunZoom: { len: 1.8, incomingOnTop: true },
  propsZoom: { len: 1.5, incomingOnTop: true },
  shrinkRise: { len: 0.7, incomingOnTop: false },
  slideSwap: { len: 2.8, incomingOnTop: true },
  fabricZoom: { len: 3.6, incomingOnTop: true },
  liftAway: { len: 2.2, incomingOnTop: false },
  shrinkExit: { len: 1.4, incomingOnTop: false },
  leafWipe: { len: 2.4, incomingOnTop: true },
  closingZoom: { len: 1.6, incomingOnTop: true },
  fadeToPaper: { len: 0.8, incomingOnTop: false },
};

function flowOf(data) {
  const flow = [];
  const storiesAfter = (key) => data.stories.filter((s) => s.after === key).map((s) => ({ kind: 'story', story: s }));
  flow.push(...storiesAfter('main'));
  data.events.forEach((e) => {
    flow.push({ kind: 'event', event: e });
    flow.push(...storiesAfter(e.id));
  });
  return flow;
}

export function pickTransition(prev, next, counters) {
  const a = prev.kind;
  const b = next.kind;
  if (a === 'opener') return 'stampZoom';
  if (b === 'end') return 'fadeToPaper';
  if (b === 'closing') return 'closingZoom';
  if (a === 'main') return 'sunZoom';
  if (a === 'event' && b === 'event') return 'leafWipe';
  if (a === 'event' && b === 'story') return ['propsZoom', 'shrinkRise'][counters.es++ % 2];
  if (a === 'story' && b === 'story') return ['slideSwap', 'fabricZoom'][counters.ss++ % 2];
  if (a === 'story' && b === 'event') return ['liftAway', 'shrinkExit'][counters.se++ % 2];
  return 'stampZoom';
}

// Stories sit on the backdrop of the event that follows them (as in the reference),
// otherwise the one before, otherwise the wedding theme.
function storyBackdrops(flow) {
  flow.forEach((item, i) => {
    if (item.kind !== 'story') return;
    const next = flow.slice(i + 1).find((x) => x.kind === 'event');
    const prev = flow.slice(0, i).reverse().find((x) => x.kind === 'event');
    item.backdrop = (next || prev) ? (next || prev).event.theme : 'baraat';
  });
}

export function buildTimeline(data, fps = FPS) {
  const f = (s) => Math.round(s * fps);
  const flow = flowOf(data);
  storyBackdrops(flow);
  const items = [{ kind: 'opener', hold: data.timing.openerHoldSec }, { kind: 'main', hold: data.timing.mainHoldSec }];
  flow.forEach((x) => items.push({ ...x, hold: x.kind === 'event' ? x.event.holdSec : x.story.holdSec }));
  items.push({ kind: 'closing', hold: data.closing.holdSec });
  items.push({ kind: 'end', hold: data.timing.endHoldSec });

  const counters = { es: 0, ss: 0, se: 0 };
  const trans = [];
  for (let i = 0; i < items.length - 1; i++) {
    const type = pickTransition(items[i], items[i + 1], counters);
    trans.push({ type, len: f(TRANSITIONS[type].len), incomingOnTop: TRANSITIONS[type].incomingOnTop });
  }

  const segments = [];
  let cursor = 0;
  items.forEach((item, i) => {
    const enter = i > 0 ? trans[i - 1] : null;
    const exit = i < trans.length ? trans[i] : null;
    const enterLen = enter ? enter.len : 0;
    const exitLen = exit ? exit.len : 0;
    const start = i === 0 ? 0 : cursor - enterLen;
    const duration = enterLen + f(item.hold) + exitLen;
    segments.push({ ...item, index: i, start, duration, enter, exit, prevKind: i > 0 ? items[i - 1].kind : null, nextKind: items[i + 1] ? items[i + 1].kind : null });
    cursor = start + duration;
  });
  return { segments, durationInFrames: cursor, fps };
}

export function durationSeconds(data, fps = FPS) {
  return buildTimeline(data, fps).durationInFrames / fps;
}
