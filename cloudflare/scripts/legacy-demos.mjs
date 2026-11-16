/**
 * Offline, build-time ONLY prototype. Never import in a Worker.
 *
 * The returned bytes are not written anywhere. A future build integration must
 * decide where/how to install them, enforce static-only GET routes, and must
 * not overwrite pre-existing assets. There is deliberately no build hook.
 *
 * The exact audited sources below are pinned: vm is NOT a security boundary
 * for arbitrary code. Refuse any changed source until it is re-audited. The
 * only executed renderer has no imports, I/O, timers, environment, or network.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fs.realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const FILES = Object.freeze({
  'lib/maafiRoutes.js': '38b5ce2811d609b6309608f03f9b0f352fb49e53fcf4569c1f562db11fb0513f',
  'templates/maafi/render.js': '9680159411ec26a4d7bd682a0c2427e6c3052d0c627ef253a19d7b73bd51f8df',
  'public/maafi/maafi.css': 'dab580c3709e3fe1f3ea8c7f7396069d2b20833b330f978dcc6ab6de5db0f33c',
  'public/maafi/maafi.js': '68c0cdd3060cfaa7823535c78d0272008b9644c46ecc26b87b3c45106046cea6',
  'public/brand/favicon-512.png': 'c7850497a2446f2e9a1390560adeb1afb986a33b1d76357bdb5cf9b289ec8986',
});
const assetFiles = Object.freeze(['maafi/maafi.css', 'maafi/maafi.js', 'brand/favicon-512.png']);

// No caller-supplied paths: a pinned allowlist, symlink rejection at each
// component, no-follow final open and digest check. No writes, ever.
function readPinned(relative) {
  if (!Object.hasOwn(FILES, relative)) throw new Error('Unapproved source');
  let current = ROOT;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink rejected: ' + relative);
  }
  const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('Not a regular file: ' + relative);
    const bytes = fs.readFileSync(fd);
    if (createHash('sha256').update(bytes).digest('hex') !== FILES[relative]) throw new Error('Source changed; re-audit required: ' + relative);
    return bytes;
  } finally { fs.closeSync(fd); }
}

/** Supported means exact default demo + explicit local asset inventory only. */
export const legacyDemoReport = Object.freeze({
  supported: Object.freeze([{ slug: 'maafi', demoPath: '/maafi/demo', aliases: Object.freeze([]), assets: assetFiles }]),
  unsupported: Object.freeze({
    'saalgirah': 'External Google Fonts require an explicit offline/preview network policy.',
    'birthday-paigaam': 'Demo media restoration and lock/interaction audit outstanding.',
    'shaadi-paigaam': 'Shared sample cleaning, card/media and RSVP/network behavior not isolated.',
    'suvarna-vivah': 'Shared sample cleaning, media/video and RSVP/network behavior not isolated.',
    'ganapati-aagman': 'Route is /ganapati/demo; language sample and packed media need isolation.',
    'ganpati-courtyard': 'Demo serves a create/editor page, not a standalone read-only video.',
    'lavender-tic-tac-toe-bloom': 'Route is /lavender-bloom/demo; external Google Fonts require policy.',
    'valentine-say-yes': 'Packed image media and external Google Fonts need restoration and policy.',
    'love-album': 'Demo photo generator writes DATA_DIR; must isolate and audit.',
    'love-awaits': 'Packed image media, external fonts and browser localStorage need audit.',
    'sau-wajah': 'Demo photo generator writes DATA_DIR and media require restoration.',
    'sawaal': 'Date-dependent demo and generated media need isolated restoration.',
    'noor': 'Classic renderer and existing fictional sample not yet verified.',
    'meher': 'Classic renderer and existing fictional sample not yet verified.',
    'aashi': 'Classic renderer and seeded sample not yet isolated from database.',
    'apology': 'Static Next bundle has not been fully audited for network behavior/asset closure.',
  }),
  scope: 'Build-only offline prototype; not routed, deployed, published, or production-ready.',
});

/**
 * Build exact original /maafi/demo using only the repository's pinned fictional
 * DEMO and original renderer. Returns assets as bytes with root-relative names;
 * does not accept customer data, an origin, filesystem paths or options.
 */
export function buildLegacyDemo(slug) {
  if (slug !== 'maafi') throw new Error('Unsupported legacy demo');
  const route = readPinned('lib/maafiRoutes.js').toString('utf8');
  const match = route.match(/const DEMO = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error('Pinned demo data not found');
  const demo = vm.runInNewContext('(' + match[1] + ')', Object.create(null), { timeout: 1000 });
  const rendererSource = readPinned('templates/maafi/render.js').toString('utf8');
  const context = vm.createContext({ module: { exports: {} }, URL }, { codeGeneration: { strings: false, wasm: false } });
  new vm.Script(rendererSource, { filename: 'maafi-render.js' }).runInContext(context, { timeout: 1000 });
  context.demo = demo;
  const html = new vm.Script('module.exports.renderMaafi({customer_data: demo}, {baseUrl: "", isPreview: true})').runInContext(context, { timeout: 1000 });
  if (typeof html !== 'string' || !html.startsWith('<!DOCTYPE html>')) throw new Error('Renderer failed');
  const assets = Object.create(null);
  for (const file of assetFiles) assets['/' + file] = readPinned('public/' + file);
  return { slug, demoPath: '/maafi/demo', aliases: [], html, assets };
}
