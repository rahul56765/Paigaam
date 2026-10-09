// Child-process entry used by the Paigaam server: node render-job.mjs <spec.json>
// spec = { data, out, composition, mediaDir, tmpDir }. Progress is printed as "PROGRESS <stage> <0..1>".
import fs from 'node:fs';
import path from 'node:path';
import { renderInvite } from './render-lib.mjs';

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const resolveMedia = (src) => {
  const m = /^\/vivah-video\/media\/([a-f0-9]{32}\.(?:mp3|m4a|mp4|png))$/.exec(src || '');
  if (m) { const f = path.join(spec.mediaDir, m[1]); return fs.existsSync(f) ? f : null; }
  return null;
};
let last = '';
try {
  await renderInvite({
    data: spec.data, out: spec.out, composition: spec.composition, tmpDir: spec.tmpDir, resolveMedia,
    onProgress: ({ stage, progress }) => { const s = `PROGRESS ${stage} ${progress.toFixed(3)}`; if (s !== last) { last = s; process.stdout.write(s + '\n'); } },
  });
  process.exit(0);
} catch (e) {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
}
