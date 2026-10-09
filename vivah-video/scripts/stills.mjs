// Render stills at given seconds for visual QA: node scripts/stills.mjs 1 9 17 ...
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { getBundle, serveDir, prepareStories, defaultResolver, ROOT } from './render-lib.mjs';
import { SAMPLE, normalize } from '../src/lib/schema.js';
const secs = process.argv.slice(2).map(Number);
const comp = process.env.COMP || 'Invite';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'wvs-'));
const { srv, base } = await serveDir(work);
const data = normalize(process.env.DATA ? JSON.parse(fs.readFileSync(process.env.DATA, 'utf8')) : SAMPLE);
await prepareStories(data, work, base, defaultResolver());
const inputProps = { data: normalize(data, { allowLocal: true }), allowLocal: true };
const serveUrl = await getBundle();
const composition = await selectComposition({ serveUrl, id: comp, inputProps });
fs.mkdirSync(path.join(ROOT, 'out/stills'), { recursive: true });
for (const s of secs) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
  const output = path.join(ROOT, `out/stills/${process.env.PREFIX || comp}-${String(s).replace('.', '_')}.png`);
  await renderStill({ composition, serveUrl, output, frame, scale: 0.5, inputProps });
  console.log('ok', s);
}
srv.close(); fs.rmSync(work, { recursive: true, force: true });
