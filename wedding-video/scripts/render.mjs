// CLI: node scripts/render.mjs [--sample] [--data file.json] [--landscape] [--out out/x.mp4] [--ref-audio]
import { renderInvite } from './render-lib.mjs';
import { SAMPLE } from '../src/lib/schema.js';
import fs from 'node:fs';
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
let data = opt('--data') ? JSON.parse(fs.readFileSync(opt('--data'), 'utf8')) : structuredClone(SAMPLE);
// Internal side-by-side comparison only: lay the reference soundtrack under the sample.
if (args.includes('--ref-audio')) data.meta.music = { src: 'sample/ref-audio.m4a', volume: 1 };
const out = opt('--out') || 'out/sample.mp4';
const t0 = Date.now();
let last = '';
const r = await renderInvite({ data, out, composition: args.includes('--landscape') ? 'InviteLandscape' : 'Invite',
  onProgress: ({ stage, progress }) => { const s = `${stage} ${Math.round(progress * 100)}%`; if (s !== last && (progress === 1 || Math.round(progress * 100) % 10 === 0)) { last = s; console.log(s, `${((Date.now() - t0) / 1000).toFixed(0)}s`); } } });
console.log('rendered', r, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
