'use strict';
/**
 * Background jobs for Vivah videos.
 *  - render: runs vivah-video/scripts/render-job.mjs in a child process (one at a time,
 *    so the web process stays responsive), streaming progress over stdout.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const store = require('./store');

const RENDER_SCRIPT = path.join(__dirname, '..', '..', 'vivah-video', 'scripts', 'render-job.mjs');
const LIMITS = { render: 1 };
const running = { render: 0 };
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
      runRender(store.getJob(next.id))
        .then((result) => store.updateJob(next.id, { status: 'done', stage: 'done', progress: 1, result }))
        .catch((e) => { console.error(`[vivah-video] ${kind} job ${next.id} failed:`, e.message); store.updateJob(next.id, { status: 'failed', error: String(e.message || e).slice(0, 500) }); })
        .finally(() => { running[kind]--; setImmediate(pump); });
    }
  }
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
    // Remotion's headless Chrome needs nss/nspr from the Nix profile (see nixpacks.toml).
    const libDirs = ['/nix/var/nix/profiles/default/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    const child = spawn(process.execPath, [RENDER_SCRIPT, specFile], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LD_LIBRARY_PATH: libDirs } });
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
      if (code !== 0) console.error(`[vivah-video] render ${job.id} exited ${code}:\n${err.slice(-3000)}`);
      if (code === 0 && fs.existsSync(spec.out)) resolve({ file: outName, url: `/v/${inv.id}/video-${format}.mp4`, format, bytes: fs.statSync(spec.out).size });
      else reject(new Error(`render_failed: ${(err.split('\n').find((l) => /error|cannot|failed/i.test(l)) || err.split('\n').filter(Boolean).slice(-1)[0] || 'unknown').slice(0, 400)}`));
    });
  });
}

module.exports = { start, enqueue, running };
