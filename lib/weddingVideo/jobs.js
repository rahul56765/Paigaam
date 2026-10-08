'use strict';
/**
 * Background jobs for wedding videos.
 *  - render: runs wedding-video/scripts/render-job.mjs in a child process (one at a time,
 *    so the web process stays responsive), streaming progress over stdout.
 *  - story:  photo -> painted keyframe -> Veo clip (up to 2 at a time).
 */
const { spawn, execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const store = require('./store');
const veo = require('./veo');

const RENDER_SCRIPT = path.join(__dirname, '..', '..', 'wedding-video', 'scripts', 'render-job.mjs');
const LIMITS = { render: 1, story: 2 };
const running = { render: 0, story: 0 };
let baseUrl = '';

function start(opts = {}) {
  baseUrl = (opts.baseUrl || '').replace(/\/$/, '');
  store.recoverInterrupted();
  setInterval(pump, 3000).unref();
  setImmediate(pump);
}

function enqueue(inviteId, kind, params) {
  const id = store.createJob(inviteId, kind, params);
  setImmediate(pump);
  return id;
}

function pump() {
  for (const kind of Object.keys(LIMITS)) {
    while (running[kind] < LIMITS[kind]) {
      const next = store.nextQueued(kind);
      if (!next) break;
      store.updateJob(next.id, { status: 'running', stage: 'starting', progress: 0 });
      running[kind]++;
      const run = kind === 'render' ? runRender : runStory;
      run(store.getJob(next.id))
        .then((result) => store.updateJob(next.id, { status: 'done', stage: 'done', progress: 1, result }))
        .catch((e) => { console.error(`[wedding-video] ${kind} job ${next.id} failed:`, e.message); store.updateJob(next.id, { status: 'failed', error: String(e.message || e).slice(0, 500) }); })
        .finally(() => { running[kind]--; setImmediate(pump); });
    }
  }
}

function probe(file) {
  return new Promise((resolve) => execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], (e, out) => resolve(e ? 0 : Number(String(out).trim()) || 0)));
}

/* ---------- render ---------- */
function runRender(job) {
  return new Promise((resolve, reject) => {
    const inv = store.getInvite(job.invite_id);
    if (!inv) return reject(new Error('invite_missing'));
    const format = job.params.format === '16x9' ? '16x9' : '9x16';
    const data = JSON.parse(JSON.stringify(inv.data));
    data.meta = data.meta || {};
    data.meta.rsvpUrl = data.meta.rsvpOnEndCard && baseUrl ? `${baseUrl}/w/${inv.id}` : '';
    const outName = `${inv.id}-${job.id}-${format}.mp4`;
    const spec = {
      data,
      out: path.join(store.RENDER_DIR, outName),
      composition: format === '16x9' ? 'InviteLandscape' : 'Invite',
      mediaDir: store.MEDIA_DIR,
      tmpDir: path.join(store.ROOT, 'tmp'),
    };
    fs.mkdirSync(spec.tmpDir, { recursive: true });
    const specFile = path.join(spec.tmpDir, `${job.id}.json`);
    fs.writeFileSync(specFile, JSON.stringify(spec));
    const child = spawn(process.execPath, [RENDER_SCRIPT, specFile], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let err = '';
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        const m = /^PROGRESS (\w+) ([\d.]+)$/.exec(line.trim());
        if (m) {
          const weights = { prepare: [0, 0.05], frames: [0.05, 0.9], encode: [0.9, 0.99], done: [1, 1] };
          const [a, b] = weights[m[1]] || [0, 1];
          store.updateJob(job.id, { stage: m[1], progress: a + (b - a) * Number(m[2]) });
        }
      }
    });
    child.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    child.on('close', (code) => {
      fs.rmSync(specFile, { force: true });
      if (code === 0 && fs.existsSync(spec.out)) resolve({ file: outName, url: `/w/${inv.id}/video-${format}.mp4`, format, bytes: fs.statSync(spec.out).size });
      else reject(new Error(`render_failed: ${err.split('\n').filter(Boolean).slice(-3).join(' | ')}`));
    });
  });
}

/* ---------- story clip ---------- */
async function runStory(job) {
  if (!veo.configured()) throw new Error('gemini_not_configured');
  const p = job.params;
  const media = store.mediaByFile(String(p.photo || '').replace('/wedding-video/media/', ''));
  if (!media || media.invite_id !== job.invite_id || media.kind !== 'photo') throw new Error('photo_missing');
  const photo = fs.readFileSync(store.mediaPath(media.filename));
  let keyframe;
  let keyMime;
  let keyUrl = p.reuseKeyframe || '';
  const reuse = keyUrl ? store.mediaByFile(keyUrl.replace('/wedding-video/media/', '')) : null;
  if (reuse && reuse.invite_id === job.invite_id && reuse.kind === 'keyframe') {
    keyframe = fs.readFileSync(store.mediaPath(reuse.filename));
    keyMime = reuse.mime;
  } else {
    store.updateJob(job.id, { stage: 'painting', progress: 0.05 });
    const k = await veo.paintKeyframe({ photo, photoMime: media.mime, caption: p.caption, extraPrompt: p.extraPrompt });
    keyframe = k.buffer;
    keyMime = k.mime;
    const ext = /png/.test(keyMime) ? 'png' : /webp/.test(keyMime) ? 'webp' : 'jpg';
    keyUrl = store.addMedia(job.invite_id, 'keyframe', ext, keyMime, keyframe).url;
  }
  store.updateJob(job.id, { stage: 'animating', progress: 0.25, result: { keyframeUrl: keyUrl } });
  const mp4 = await veo.animate({ keyframe, keyframeMime: keyMime, caption: p.caption, extraPrompt: p.extraPrompt, onProgress: (x) => store.updateJob(job.id, { progress: 0.25 + 0.7 * x }) });
  const clip = store.addMedia(job.invite_id, 'clip', 'mp4', 'video/mp4', mp4);
  const clipSec = await probe(store.mediaPath(clip.filename));
  return { keyframeUrl: keyUrl, clipUrl: clip.url, clipSec: clipSec || 8, storyId: p.storyId };
}

module.exports = { start, enqueue, running };
