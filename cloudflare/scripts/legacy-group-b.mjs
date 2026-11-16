/** Offline, read-only build helper. No routing or publication is performed.
 * Audited SHA-256 pins are mandatory: vm is not a sandbox for arbitrary code.
 * Outputs preserve original Google Fonts links; a caller must choose a browser
 * CSP/network policy before serving them (blocking fonts changes typography).
 * Love Awaits is deliberately unsupported because its original JS writes to
 * localStorage; replacing it would not be a faithful read-only preview.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const PINS = Object.freeze({
  "lib/saalgirahRoutes.js": "9ae5fe86fe527aeac50ffe1e039795ce19e771ef0bcd42773102d994b3f810b7",
  "lib/lavenderRoutes.js": "358dd15d63f4fdc156bd064d1e3fa223f1530b74485b6bd9211f2120077180b9",
  "lib/valentineRoutes.js": "a61b525fa8b7d6f75970662a8a3d04e9be10ff7cc23cc4a3e10f0babeceb76e1",
  "templates/saalgirah/render.js": "45cc60ed64935b764456ef671d0cfc45823af04015c8d233b5c466b5a92cdda1",
  "templates/lavender-bloom/render.js": "e99908b5216f05e937d743e596bf46ad1d8e688fbfbb667b33638cda166e8a0f",
  "templates/valentine-say-yes/render.js": "e967553fa2c8929df6b28badecca4cace8965a809930d3b2d64fc1865f09b264",
  "public/brand/favicon-512.png": "c7850497a2446f2e9a1390560adeb1afb986a33b1d76357bdb5cf9b289ec8986",
  "public/saalgirah/letter.css": "cefeec86cdbcf1a42c19f2534038bce4ce019610e9384515d7c29845215b5424",
  "public/saalgirah/letter.js": "769c283f188e01d0642a24fd4091873bfc8d94d1e0f12c628e3f0088e66574ae",
  "public/saalgirah/audio.js": "5174de3c9041abafcd3a8dc6350a9fe860932387f02dd219fdb38458665e27fc",
  "public/lavender-bloom/bloom.css": "e7fb130f286e4319c14588d65b1dbb531ab2ef009b1ca22db2190b2d91f9d0e3",
  "public/lavender-bloom/bloom.js": "586c942e69ec665f07d59a5b3dc1a1e7164dab737349bf75504ea8c9318aaaa5",
  "public/valentine-say-yes/ask.css": "bab3c7a18a795d29674630a864adc57d7c1828eef7827766dceab6f0673acc97",
  "public/valentine-say-yes/ask.js": "70707ba0d998cf74b4781067f59dda79b5d59468ed4b90193d3aedb811d48ff3",
  "assets/valentine/manifest.json": "ee03e68c6e0defb856f9747faa00c41c1552148bbaacc16142daa70d3748788d",
  "assets/valentine/valentine-1.gif.b64": "bbdb8e98bb8b230e6d480d1ad4887081f9d1a5f0194b506591666220e17b0b9f",
  "assets/valentine/valentine-2.gif.b64": "073f0acbe4e5a25c94d16443328134c5ecb5c63ad9f0bae5c6a3e5fad7250971",
  "assets/valentine/valentine-3.gif.b64": "80414725fe50c1fe26dd1a676ea53836f9fce85c90077696fb3ff87dec3da258",
  "assets/valentine/valentine-4.gif.b64": "7839bf9a8ab7881c41b0b639da650807808c9400a28d399ee87e25ce6f6c3404",
  "assets/valentine/valentine-5.gif.b64": "6811c159c7458904e18769a2169c2b0c8f6e0d154fc4560d2d28ddf139cc6a5f",
  "assets/valentine/valentine-6.gif.b64": "9b2398c00aabb4c3276f4f99af873bea9052453024f1387ea52d348cf08527e6",
  "assets/valentine/valentine-7.gif.b64": "76459f1c2725421b95f84eedd495eb5c80cd1c8fad517386a0c5cedbec4e9519"
});
const SPECS = Object.freeze({
  'saalgirah': { route: 'lib/saalgirahRoutes.js', renderer: 'templates/saalgirah/render.js', fn: 'renderLetter', demoPath: '/saalgirah/demo', aliases: [], files: ['brand/favicon-512.png', 'saalgirah/letter.css', 'saalgirah/audio.js', 'saalgirah/letter.js'], fonts: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Quicksand:wght@300;400;500;600&display=swap' },
  'lavender-tic-tac-toe-bloom': { route: 'lib/lavenderRoutes.js', renderer: 'templates/lavender-bloom/render.js', fn: 'renderBloom', demoPath: '/lavender-tic-tac-toe-bloom/demo', aliases: ['/lavender-bloom/demo'], files: ['brand/favicon-512.png', 'lavender-bloom/bloom.css', 'lavender-bloom/bloom.js'], fonts: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap' },
  'valentine-say-yes': { route: 'lib/valentineRoutes.js', renderer: 'templates/valentine-say-yes/render.js', fn: 'renderValentine', demoPath: '/valentine-say-yes/demo', aliases: [], files: ['brand/favicon-512.png', 'valentine-say-yes/ask.css', 'valentine-say-yes/ask.js'], fonts: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap' },
});
const mediaNames = Object.freeze(Array.from({ length: 7 }, (_, i) => `valentine-${i + 1}.gif`));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Reject all paths except pinned literals, all symlinks, non-files and changed
// content. No caller controls a path. Static repository only; no concurrent
// untrusted writers may replace path components during this offline operation.
function readPinned(relative) {
  if (!Object.hasOwn(PINS, relative)) throw new Error('Unapproved source');
  let current = ROOT;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink rejected: ' + relative);
  }
  const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Not a regular file: ' + relative);
    const bytes = fs.readFileSync(fd);
    if (sha(bytes) !== PINS[relative]) throw new Error('Source changed; re-audit required: ' + relative);
    return bytes;
  } finally { fs.closeSync(fd); }
}

export const legacyGroupBReport = Object.freeze({
  supported: Object.freeze(Object.keys(SPECS)),
  unsupported: Object.freeze({ 'love-awaits': 'Original browser interaction writes and removes localStorage; read-only faithful preview cannot be provided.' }),
  warning: 'Original output includes Google Fonts network references. No network is used at build time; serving requires an explicit browser policy. Not production-ready.',
});

/** Return exact preview HTML and packed bytes in memory. No paths/data/options. */
export function buildLegacyGroupB(slug) {
  if (typeof slug !== 'string' || !Object.hasOwn(SPECS, slug)) throw new Error('Unsupported legacy demo');
  const spec = SPECS[slug];
  const route = readPinned(spec.route).toString('utf8');
  const match = route.match(/const DEMO = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error('Pinned demo data not found');
  const context = vm.createContext({ module: { exports: {} }, URL }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(readPinned(spec.renderer).toString('utf8'), { filename: 'pinned-render.js' }).runInContext(context, { timeout: 1000 });
  // Both the sample literal and renderer are pinned, audited source; never run route modules.
  context.demo = new vm.Script('(' + match[1] + ')').runInContext(context, { timeout: 1000 });
  const html = new vm.Script(`module.exports.${spec.fn}({customer_data: demo}, {baseUrl: "", isPreview: true})`).runInContext(context, { timeout: 1000 });
  if (typeof html !== 'string' || !html.startsWith('<!DOCTYPE html>')) throw new Error('Renderer failed');
  const assets = Object.create(null);
  for (const file of spec.files) assets['/' + file] = readPinned('public/' + file);
  if (slug === 'valentine-say-yes') {
    const manifest = JSON.parse(readPinned('assets/valentine/manifest.json').toString('utf8'));
    if (Object.keys(manifest).sort().join('\n') !== [...mediaNames].sort().join('\n')) throw new Error('Unexpected media manifest');
    for (const name of mediaNames) {
      const text = readPinned('assets/valentine/' + name + '.b64').toString('ascii').trim();
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) throw new Error('Invalid packed media');
      const bytes = Buffer.from(text, 'base64');
      if (bytes.toString('base64') !== text || sha(bytes) !== manifest[name]) throw new Error('Media checksum mismatch: ' + name);
      assets['/valentine-say-yes/media/' + name] = bytes;
    }
  }
  // Reject unexpected HTML references (including protocol-relative URLs), even
  // if a future source update is mistakenly re-pinned without URL review.
  const allowedExternal = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com', spec.fonts]);
  for (const [, ref] of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) {
    if (!Object.hasOwn(assets, ref) && !allowedExternal.has(ref) && !ref.startsWith('#')) throw new Error('Unsafe or unprovided URL: ' + ref);
  }
  return { slug, demoPath: spec.demoPath, aliases: [...spec.aliases], html, assets };
}
