import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import core from '../../public/shaadi-paigaam/core.js';
import renderer from '../../templates/shaadi-paigaam/render.js';
import { handleShaadiPreview } from '../src/shaadi-preview.mjs';

const origin = 'https://example.test';
const run = (path, init) => handleShaadiPreview(new Request(origin + path, init));
function original(path) {
  const url = new URL(origin + path);
  const d = JSON.parse(JSON.stringify(core.SAMPLE));
  const p = url.searchParams.get('palette'), f = url.searchParams.get('font'), l = url.searchParams.get('lang');
  if (p && core.PALETTE_BY_ID[p]) d.palette.id = p;
  if (f && core.FONT_BY_ID[f]) d.font = f;
  if (l && d.lang.enabled.includes(l)) d.lang.default = l;
  return renderer.renderInvitation(core.validate(d, { allowPast: true }).data, {
    mode: 'demo', id: 'demo', url: origin + '/shaadi-paigaam/demo',
    ogImage: origin + '/shaadi-paigaam/card/demo.jpg', autoOpen: url.searchParams.get('skip') === '1',
    mapsKey: '', simpleWhatsAppRsvp: true, lazyMusic: true,
  });
}
function boot(html) { return JSON.parse(html.match(/<script id="sp-boot" type="application\/json">([\s\S]*?)<\/script>/)[1]); }

test('source demo rendering, options and original assets are byte-identical', async () => {
  const paths = ['/shaadi-paigaam/demo', '/shaadi-paigaam/demo?skip=1&palette=sage-green&lang=hi',
    '/shaadi-paigaam/demo?palette=midnight-gold&font=' + encodeURIComponent(core.FONTS[1].id),
    '/shaadi-paigaam/demo?palette=INVALID&font=bogus&lang=xx&skip=true'];
  for (const p of paths) {
    const r = await run(p), html = await r.text();
    assert.equal(r.status, 200); assert.equal(html, original(p));
    for (const asset of ['/shaadi-paigaam/invite.css', '/shaadi-paigaam/invite.js', '/shaadi-paigaam/art.js', '/shaadi-paigaam/art/door-relief.webp', 'fonts.googleapis.com']) assert.ok(html.includes(asset));
    const b = boot(html); assert.equal(b.mode, 'demo'); assert.equal(b.simpleWhatsAppRsvp, true); assert.equal(b.rsvpUrl, ''); assert.equal(b.data.rsvp.whatsapp, '');
    assert.doesNotMatch(html, /paigaam-pay|razorpay|checkout|payment/i);
  }
});

test('untrusted query cannot inject boot data or options', async () => {
  const html = await (await run('/shaadi-paigaam/demo?palette=%3Cscript%3Eevil%3C%2Fscript%3E&font=%22x&lang=xx&data=%7B%22rsvp%22%3A%7B%22whatsapp%22%3A%2212345%22%7D%7D')).text();
  assert.equal(html, original('/shaadi-paigaam/demo'));
  assert.ok(!html.includes('<script>evil</script>'));
  assert.deepEqual(boot(html).data, core.validate(core.SAMPLE, { allowPast: true }).data);
  // The source route's truthy object lookups accidentally accept inherited keys.
  // The adapter must reject them rather than crash during palette/font rendering.
  for (const key of ['__proto__', 'constructor', 'toString']) {
    const response = await run('/shaadi-paigaam/demo?palette=' + key + '&font=' + key);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), original('/shaadi-paigaam/demo'));
  }
});

test('mutations, editor, customer frame and all sensitive routes fail closed', async () => {
  const cases = [
    ['/create/shaadi-paigaam', 'GET'], ['/create/shaadi-paigaam?id=existing', 'GET'], ['/shaadi-paigaam/frame', 'GET'],
    ['/shaadi-paigaam/frame?guest=1', 'GET'], ['/shaadi-paigaam/preview/abc', 'GET'], ['/shaadi-paigaam/manage/token', 'GET'],
    ['/shaadi-paigaam/media/x.jpg', 'GET'], ['/shaadi-paigaam/card/demo.jpg', 'GET'], ['/shaadi-paigaam/qr/abc.svg', 'GET'],
    ...['draft', 'upload', 'publish', 'rsvp/abc', 'slug', 'me', 'places', 'translate'].map(p => ['/api/shaadi-paigaam/' + p, 'POST']),
    ['/shaadi-paigaam/demo', 'POST'], ['/shaadi-paigaam/invite.js', 'POST'], ['/shaadi-paigaam/unlock/id', 'POST'],
  ];
  for (const [path, method] of cases) {
    const r = await run(path, { method }); assert.equal(r.status, 503, path);
    const j = await r.json(); assert.equal(j.error, 'shaadi_preview_unavailable'); assert.match(j.message, /payments and RSVP are unavailable/);
  }
});

test('only static reads and unrelated requests fall through', async () => {
  for (const path of ['/shaadi-paigaam/invite.js?v=4', '/shaadi-paigaam/art/door-relief.webp', '/shaadi-paigaam/fonts/cormorant.ttf', '/other']) assert.equal(await run(path), null);
  assert.equal((await run('/shaadi-paigaam/media/abcd.jpg')).status, 503);
});

test('all original packed art, music and fonts match their source manifest', async () => {
  const dir = new URL('../../assets/shaadi-paigaam/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', dir), 'utf8'));
  for (const required of ['art/door-relief.webp', 'art/scene-base.webp', 'art/scene-rose.webp', 'fonts/cormorant.ttf', 'fonts/great-vibes.ttf', 'fonts/tiro-deva.ttf', ...core.SAMPLE.photos.map(p => p.url.replace('/shaadi-paigaam/', ''))]) assert.ok(manifest[required], required);
  for (const [name, expected] of Object.entries(manifest)) {
    assert.match(name, /^(art|music|fonts)\/[a-z0-9-]+\.(webp|jpg|png|mp3|ttf)$/);
    const b64 = await readFile(new URL(name.replace('/', '__') + '.b64', dir), 'utf8');
    assert.equal(createHash('sha256').update(Buffer.from(b64.trim(), 'base64')).digest('hex'), expected, name);
  }
});

test('pure source modules bundle for the Worker without Node builtins', async () => {
  const result = await build({ entryPoints: [new URL('../src/shaadi-preview.mjs', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(inputs.some(p => p.endsWith('templates/shaadi-paigaam/render.js')));
  assert.ok(!inputs.some(p => /shaadiPaigaamRoutes|(?:^|\/)db\.js/.test(p)));
});
