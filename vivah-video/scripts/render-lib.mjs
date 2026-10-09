// Render pipeline used by the CLI and the Paigaam server.
// Chrome (via Remotion renderFrames) draws every frame; system ffmpeg encodes H.264 and mixes music.
// No dependency on Remotion's native compositor, so it runs on any glibc and on Railway.
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition, ensureBrowser } from '@remotion/renderer';
import { spawn, execFile } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalize } from '../src/lib/schema.js';
import { buildTimeline, FPS } from '../src/lib/timeline.js';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');

let bundlePromise = null;
/** Bundle once per process (≈30-60s); reuse VIVAH_BUNDLE_DIR if prebuilt. */
export function getBundle() {
  if (process.env.VIVAH_BUNDLE_DIR && fs.existsSync(path.join(process.env.VIVAH_BUNDLE_DIR, 'index.html'))) {
    return Promise.resolve(process.env.VIVAH_BUNDLE_DIR);
  }
  if (!bundlePromise) {
    bundlePromise = bundle({ entryPoint: path.join(ROOT, 'src/index.js'), publicDir: PUBLIC_DIR, outDir: process.env.VIVAH_BUNDLE_OUT || undefined });
  }
  return bundlePromise;
}

const run = (cmd, args, opts = {}) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
  p.on('error', reject);
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-1500)}`))));
});

/** System Chromium (from the Nix package on Railway) if present, else Remotion's own headless shell.
 *  VIVAH_CHROME_PATH overrides. */
export function findChrome() {
  if (process.env.VIVAH_CHROME_PATH && fs.existsSync(process.env.VIVAH_CHROME_PATH)) return process.env.VIVAH_CHROME_PATH;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const name of ['chromium', 'chromium-browser', 'google-chrome-stable']) {
      const f = path.join(dir, name);
      try { if (fs.statSync(f).isFile()) return f; } catch { /* not here */ }
    }
  }
  return null;
}

export function probeDuration(file) {
  return new Promise((resolve) => {
    execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], (e, out) => resolve(e ? 0 : Number(String(out).trim()) || 0));
  });
}

/** Tiny static server so Chrome can read story frame sequences from the work dir. */
export function serveDir(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
      const file = path.resolve(dir, rel);
      if (!file.startsWith(path.resolve(dir) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'max-age=3600' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}` }));
  });
}

export function defaultResolver(extra) {
  return (src) => {
    if (extra) { const r = extra(src); if (r) return r; }
    if (!/^(https?:)?\/\//.test(src) && !src.startsWith('/')) { const f = path.join(PUBLIC_DIR, src); if (fs.existsSync(f)) return f; }
    return null;
  };
}

/** Extract every video story to a JPEG sequence served from `base` (mutates data.stories). */
export async function prepareStories(data, work, base, resolveMedia, onP) {
  const clips = data.stories.map((story, i) => ({ story, key: `story${i}` }));
  for (const [i, item] of clips.entries()) {
    const st = item.story;
    if (/\.(png|jpe?g|webp)$/i.test(st.src)) continue;
    const file = resolveMedia(st.src);
    if (!file) throw new Error(`Story clip not found: ${st.src}`);
    const dir = path.join(work, item.key);
    fs.mkdirSync(dir, { recursive: true });
    await run('ffmpeg', ['-v', 'error', '-i', file, '-vf', `fps=${FPS},scale=1000:-2:flags=lanczos`, '-q:v', '2', path.join(dir, '%05d.jpg')]);
    const count = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
    st.clipSec = count / FPS;
    st.frameSeq = { base: `${base}/${item.key}`, count, fps: FPS };
    onP && onP((i + 1) / Math.max(1, clips.length));
  }
  return data;
}

/**
 * Render an invitation to MP4.
 * @param {object} o
 * @param {object} o.data             invitation JSON (will be normalised)
 * @param {string} o.out              output .mp4 path
 * @param {'Invite'|'InviteLandscape'} [o.composition]
 * @param {(rel:string)=>string|null} [o.resolveMedia] maps a media path/URL to a local file
 * @param {(p:{stage:string, progress:number})=>void} [o.onProgress]
 */
export async function renderInvite(o) {
  const comp = o.composition || 'Invite';
  const work = fs.mkdtempSync(path.join(o.tmpDir || os.tmpdir(), 'wv-'));
  const progress = (stage, p) => o.onProgress && o.onProgress({ stage, progress: Math.max(0, Math.min(1, p)) });
  const resolveMedia = defaultResolver(o.resolveMedia);
  const { srv, base } = await serveDir(work);
  try {
    const data = normalize(o.data);
    // Customer-uploaded logo and QR are copied into the same local render server so
    // Chrome sees stable, same-origin image URLs without changing their fixed geometry.
    for (const [section, field, filename] of [['meta', 'logoUpload', 'customer-logo.png'], ['closing', 'qrCode', 'customer-qr.png']]) {
      const src = data[section]?.[field];
      if (!src) continue;
      const file = resolveMedia(src);
      if (!file) throw new Error(`Uploaded ${field} could not be found`);
      fs.copyFileSync(file, path.join(work, filename));
      data[section][field] = `${base}/${filename}`;
    }
    const withLocal = () => normalize(data, { allowLocal: true });
    progress('prepare', 0);
    // 1. fixed story scenes + Ganesh opener -> frame sequences
    await prepareStories(data, work, base, resolveMedia, (p) => progress('prepare', p));
    // 2. frames via Chrome
    const browserExecutable = findChrome();
    if (!browserExecutable) await ensureBrowser();
    const serveUrl = await getBundle();
    const inputProps = { data: withLocal(), assetBase: '', allowLocal: true };
    const composition = await selectComposition({ serveUrl, id: comp, inputProps, browserExecutable });
    const framesDir = path.join(work, 'frames');
    fs.mkdirSync(framesDir);
    if (browserExecutable) console.log('[render] using', browserExecutable);
    await renderFrames({
      composition, serveUrl, inputProps, outputDir: framesDir, imageFormat: 'jpeg', jpegQuality: 94, browserExecutable,
      concurrency: Number(process.env.VIVAH_RENDER_CONCURRENCY || Math.max(1, Math.min(4, os.cpus().length))),
      onStart: () => progress('frames', 0),
      onFrameUpdate: (done) => progress('frames', done / composition.durationInFrames),
      timeoutInMilliseconds: 120000,
      chromiumOptions: { gl: 'swangle' },
    });
    const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpeg')).sort();
    const listPattern = files[0].replace(/\d+(?=\.jpeg$)/, (m) => `%0${m.length}d`);
    const firstNum = Number(files[0].match(/(\d+)\.jpeg$/)[1]);
    // 3. encode
    progress('encode', 0);
    const dur = composition.durationInFrames / composition.fps;
    const args = ['-v', 'error', '-y', '-framerate', String(composition.fps), '-start_number', String(firstNum), '-i', path.join(framesDir, listPattern)];
    const music = data.meta.music.src ? resolveMedia(data.meta.music.src) : null;
    if (music) {
      const vol = data.meta.music.volume;
      args.push('-i', music, '-filter_complex', `[1:a:0]atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(3)}:d=1.5,volume=${vol}[a]`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
    }
    args.push('-c:v', 'libx264', '-preset', process.env.VIVAH_X264_PRESET || 'slow', '-crf', '16', '-maxrate', '24M', '-bufsize', '48M',
      '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-r', String(composition.fps), '-movflags', '+faststart', '-t', dur.toFixed(3), o.out);
    fs.mkdirSync(path.dirname(o.out), { recursive: true });
    await run('ffmpeg', args);
    progress('done', 1);
    return { out: o.out, durationSec: dur, frames: composition.durationInFrames };
  } finally {
    srv.close();
    if (!process.env.VIVAH_KEEP_WORK) fs.rmSync(work, { recursive: true, force: true });
  }
}

export function totalSeconds(data) {
  return buildTimeline(normalize(data), FPS).durationInFrames / FPS;
}
