/**
 * UNROUTED, read-only Shaadi Paigaam sample adapter.
 *
 * Do not import shaadiPaigaamRoutes.js: loading it opens SQLite, creates
 * directories/secrets and starts a timer. These original modules are pure.
 * The original editor and frame are deliberately unavailable: editor.js
 * autosaves, uploads and publishes; invite.js accepts postMessage data even
 * in demo mode and can construct real WhatsApp RSVP links. Serving them as a
 * customer preview without an audited isolation layer would be misleading.
 */
import core from '../../public/shaadi-paigaam/core.js';
import renderer from '../../templates/shaadi-paigaam/render.js';

const STATIC = /^\/shaadi-paigaam\/([a-z0-9-]+\.(?:js|css)|(?:art|music|fonts)\/[a-z0-9-]+\.(?:webp|png|jpg|mp3|ttf))$/;
const unavailable = 'Shaadi Paigaam is available as a sample only. Editing, previews of customer data, drafts, uploads, publishing, payments and RSVP are unavailable.';

function sample(url) {
  const d = JSON.parse(JSON.stringify(core.SAMPLE));
  const palette = url.searchParams.get('palette');
  if (palette && Object.hasOwn(core.PALETTE_BY_ID, palette)) d.palette.id = palette;
  const font = url.searchParams.get('font');
  if (font && Object.hasOwn(core.FONT_BY_ID, font)) d.font = font;
  const lang = url.searchParams.get('lang');
  if (lang && d.lang.enabled.includes(lang)) d.lang.default = lang;
  return core.validate(d, { allowPast: true }).data;
}

/** Returns null for unrelated requests and for static GET/HEAD asset handling. */
export async function handleShaadiPreview(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;
  if (STATIC.test(path) && (method === 'GET' || method === 'HEAD')) return null;
  if (!(path === '/create/shaadi-paigaam' || path === '/shaadi-paigaam' || path.startsWith('/shaadi-paigaam/') || path === '/api/shaadi-paigaam' || path.startsWith('/api/shaadi-paigaam/'))) return null;
  if (method === 'GET' && path === '/shaadi-paigaam/demo') {
    // Identical to the original route with no Google Maps key. Card URL is
    // retained for fidelity, but the card route remains unavailable.
    const html = renderer.renderInvitation(sample(url), {
      mode: 'demo', id: 'demo', url: url.origin + '/shaadi-paigaam/demo',
      ogImage: url.origin + '/shaadi-paigaam/card/demo.jpg',
      autoOpen: url.searchParams.get('skip') === '1', mapsKey: '',
      simpleWhatsAppRsvp: true, lazyMusic: true,
    });
    return new Response(html, { headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    } });
  }
  return new Response(JSON.stringify({ error: 'shaadi_preview_unavailable', message: unavailable }), {
    status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
