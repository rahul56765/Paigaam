'use strict';
/**
 * PAIGAAM — beautiful greetings, made personal.
 * Zero-dependency Node server (built-in http + node:sqlite).
 * Run: node server.js   (PORT env, default 3000)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { q } = require('./db');
const { TEMPLATES, getTemplateConfig, displayNames, displayDate } = require('./templates/registry');
const { renderPaigaamPage, shareTitle } = require('./lib/renderPaigaam');
const { templateSampleView } = require('./lib/templateView');
const { page, errorPage, esc } = require('./lib/layout');
const { home } = require('./pages/home');
const { gallery } = require('./pages/gallery');
const { templateDetail } = require('./pages/templateDetail');
const { createPage } = require('./pages/create');
const { previewPage } = require('./pages/preview');
const { contactPage } = require('./pages/contact');
const { fixedPage } = require('./pages/fixed');
const admin = require('./pages/admin');
const { qrSVG } = require('./lib/qrcode');
const { ensureBrandAssets } = require('./lib/brand-assets');
const { ensureGanapatiMedia } = require('./lib/ganapatiMedia');
const { ensureCourtyardMedia } = require('./lib/courtyardMedia');
const ganapati = require('./lib/ganapatiRoutes');
const saalgirah = require('./lib/saalgirahRoutes');
const courtyard = require('./lib/courtyardRoutes');
const { streamFile } = require('./lib/streamFile');

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------------- helpers ---------------- */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function getAdmin(req) {
  const token = parseCookies(req)['paigaam_session'];
  const s = q.sessionGet(token);
  return s ? q.adminById(s.admin_id) : null;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 12e6) { req.destroy(); reject(new Error('Body too large')); } });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
const parseForm = (body) => {
  const out = {};
  for (const pair of body.split('&')) {
    const i = pair.indexOf('='); if (i < 0) continue;
    out[decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
  }
  return out;
};
const send = (res, code, body, type = 'text/html; charset=utf-8', headers = {}) => {
  res.writeHead(code, { 'Content-Type': type, ...headers });
  res.end(body);
};
const redirect = (res, to, headers = {}) => { res.writeHead(303, { Location: to, ...headers }); res.end(); };
const json = (res, code, obj) => send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');

const MIME = { '.mp4':'video/mp4', '.mp3':'audio/mpeg', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.txt':'text/plain', '.json':'application/json', '.html':'text/html; charset=utf-8', '.map':'application/json' };
function serveStatic(req, res, urlPath) {
  let rel; try { rel = decodeURIComponent(urlPath).replace(/^\/+/, ''); } catch { return false; }
  if (rel.includes('\0') || rel.includes('\\')) return false;
  let file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return false;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return false;
  if (!fs.realpathSync(file).startsWith(fs.realpathSync(PUBLIC_DIR) + path.sep)) return false;
  return streamFile(req, res, file, MIME[path.extname(file)] || 'application/octet-stream');
}

function slugifyNames(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'paigaam';
}
function uniquePaigaamSlug(base) {
  let slug = base, i = 2;
  while (q.paigaamSlugTaken(slug)) slug = `${base}-${i++}`;
  return slug;
}

/** Publish a paigaam: assign a unique slug (idempotent if already published). */
function publishPaigaam(pg) {
  const isCustom = !!(pg.template_config && pg.template_config.custom);
  const baseName = isCustom
    ? (pg.customer_name || (pg.customer_data && pg.customer_data.senderName) || 'paigaam')
    : displayNames(pg.template_slug, pg.customer_data).join('-');
  const slug = pg.slug || uniquePaigaamSlug(slugifyNames(baseName));
  q.paigaamUpdate(pg.id, { slug, status: 'published', payment_status: 'paid', published_at: pg.published_at || new Date().toISOString().replace('T', ' ').slice(0, 19) });
  q.ordersAll().filter(o => o.paigaam_id === pg.id && o.status === 'pending').forEach(o => q.orderUpdate(o.id, 'paid'));
  return q.paigaamById(pg.id);
}

/* ---------------- seed ---------------- */
function seed() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@paigaam.in';
  const adminPassword = process.env.ADMIN_PASSWORD || 'paigaam-admin';
  if (!q.adminByEmail(adminEmail)) {
    q.adminCreate(adminEmail, adminPassword);
    console.log('[seed] admin created:', adminEmail);
  } else if (process.env.ADMIN_PASSWORD && !q.adminVerify(adminEmail, process.env.ADMIN_PASSWORD)) {
    // keep the stored hash in sync with ADMIN_PASSWORD when it drifts (e.g. password rotation)
    q.adminUpdatePassword(adminEmail, process.env.ADMIN_PASSWORD);
    console.log('[seed] admin password updated from ADMIN_PASSWORD env for:', adminEmail);
  }
  q.settings();
  for (const t of TEMPLATES) {
    if (!q.templateBySlug(t.slug)) {
      q.templateInsert({
        name: t.name, slug: t.slug, category: t.category, description: t.description,
        price: t.price, currency: t.currency, thumbnail_url: t.thumbnail_url || '', status: 'published',
        config: { name: t.name, fields: t.fields, sections: t.sections, theme: t.theme, custom: !!t.custom, editable: t.editable !== false, appPath: t.appPath },
      });
      console.log('[seed] template:', t.name);
    } else if (t.custom) {
      // keep custom template config fresh on every boot (cheap, idempotent)
      const cur = q.templateBySlug(t.slug);
      if (cur && (!cur.config || !cur.config.custom)) {
        q.templateUpdate(cur.id, { ...cur, name: t.name, description: t.description, price: t.price, category: t.category,
          config: { fields: [], sections: [], theme: t.theme, custom: true, editable: false, appPath: t.appPath } });
      }
    } else {
      // native templates: keep name/description/price/category in sync with registry
      const cur = q.templateBySlug(t.slug);
      if (cur && (cur.price !== t.price || cur.name !== t.name || cur.description !== t.description || cur.category !== t.category)) {
        q.templateUpdate(cur.id, { ...cur, name: t.name, description: t.description, price: t.price, category: t.category });
      }
    }
  }
  // one demo published Paigaam so /p/… can be experienced immediately
  if (!q.paigaamBySlug('aashi-raghav')) {
    const tpl = q.templateBySlug('aashi');
    if (tpl) {
      q.paigaamInsert({
        template_id: tpl.id, slug: 'aashi-raghav', status: 'published', payment_status: 'paid',
        customer_name: 'Aashi & Raghav',
        customer_data: {
          partnerOne: 'Aashi', partnerTwo: 'Raghav', years: '10', eventDate: '2016-02-14',
          message: 'Ten years of ordinary mornings that somehow never felt ordinary. This one is for every cup of chai you made before I woke.',
        },
      });
      q.paigaamUpdate(q.paigaamBySlug('aashi-raghav').id, { published_at: new Date().toISOString() });
      console.log('[seed] demo paigaam: /p/aashi-raghav');
    }
  }
}

/* ---------------- router ---------------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, BASE_URL);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    const method = req.method;

    if (await ganapati.handle(req, res, u, { baseUrl: BASE_URL, isAdmin: !!getAdmin(req) })) return;
    if (await saalgirah.handle(req, res, u, { baseUrl: BASE_URL, isAdmin: !!getAdmin(req) })) return;
    if (await courtyard.handle(req, res, u, { baseUrl: BASE_URL, isAdmin: !!getAdmin(req) })) return;
    if (['GET', 'HEAD'].includes(method) && serveStatic(req, res, p)) return;

    /* ---------- health (checks storage persistence) ---------- */
    if (method === 'GET' && (p === '/healthz' || p === '/health')) {
      // Honest check: did the DB actually land in DATA_DIR, or fall back?
      const { DATA_DIR: resolved, PERSISTENT } = require('./db');
      return json(res, 200, {
        ok: true,
        storage: PERSISTENT ? 'persistent' : 'ephemeral',
        dataDir: resolved,
        envDataDir: process.env.DATA_DIR || null,
        note: PERSISTENT
          ? 'DB is on the DATA_DIR volume — data survives redeploys.'
          : 'DB is on the ephemeral filesystem — data is LOST on every restart/redeploy. Attach a persistent disk (paid plan) and set DATA_DIR to its mount path.',
      });
    }

    /* ---------- public ---------- */
    if (method === 'GET' && p === '/') {
      return send(res, 200, home(q.templatesPublished()));
    }
    if (method === 'GET' && p === '/templates') {
      return send(res, 200, gallery(q.templatesPublished(), u.searchParams.get('occasion') || 'All'));
    }
    let m = p.match(/^\/templates\/([a-z0-9-]+)$/);
    if (method === 'GET' && m) {
      const tpl = q.templateBySlug(m[1]);
      if (!tpl || tpl.status !== 'published') return send(res, 404, errorPage('404', 'This Paigaam seems to have wandered away.', "Let's take you back to the collection."));
      return send(res, 200, templateDetail(tpl));
    }
    // Bare, sample-data render of a template — powers live-scrolling card thumbnails.
    m = p.match(/^\/template-view\/([a-z0-9-]+)$/);
    if (method === 'GET' && m) {
      const tpl = q.templateBySlug(m[1]);
      if (!tpl || tpl.status !== 'published') return send(res, 404, errorPage('404', 'Nothing to show here.', 'This template view has wandered away.'));
      return send(res, 200, templateSampleView(tpl, BASE_URL), 'text/html; charset=utf-8', { 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    }
    m = p.match(/^\/create\/([a-z0-9-]+)$/);
    if (method === 'GET' && m) {
      const tpl = q.templateBySlug(m[1]);
      if (!tpl || tpl.status !== 'published') return send(res, 404, errorPage('404', 'This Paigaam seems to have wandered away.', "Let's take you back to the collection."));
      // Fully-fixed custom templates skip the personalization form.
      if (tpl.config && tpl.config.custom) return send(res, 200, fixedPage(tpl));
      let draft = null, draftId = null;
      const draftParam = u.searchParams.get('draft');
      if (draftParam) {
        const existing = q.paigaamById(draftParam);
        if (existing && existing.status === 'draft') { draft = existing.customer_data; draftId = existing.id; }
      }
      return send(res, 200, createPage(tpl, draft, draftId));
    }
    m = p.match(/^\/preview\/([A-Za-z0-9_-]+)$/);
    if (method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg) return send(res, 404, errorPage('404', 'This preview seems to have wandered away.', 'Perhaps it was never begun — or already published.'));
      if (pg.template_slug === ganapati.SLUG) {
        if (!getAdmin(req) && !ganapati.owned(req, pg.id)) return json(res, 403, { error: 'forbidden' });
        return redirect(res, '/ganapati/preview/' + pg.id);
      }
      if (pg.template_slug === saalgirah.SLUG) {
        if (!getAdmin(req) && !saalgirah.owned(req, pg.id)) return json(res, 403, { error: 'forbidden' });
        return redirect(res, '/saalgirah/preview/' + pg.id);
      }
      if (pg.template_slug === courtyard.SLUG) {
        if (!getAdmin(req) && !courtyard.owned(req, pg.id)) return json(res, 403, { error: 'forbidden' });
        return redirect(res, '/ganpati-courtyard/preview/' + pg.id);
      }
      return send(res, 200, previewPage(pg, q.settings(), { baseUrl: BASE_URL }));
    }
    m = p.match(/^\/p\/([a-z0-9-]+)$/);
    if (method === 'GET' && m) {
      const pg = q.paigaamBySlug(m[1]);
      if (!pg || !['published', 'active'].includes(pg.status)) {
        return send(res, 404, errorPage('404', 'This Paigaam seems to have wandered away.', "Let's take you back home."));
      }
      const tpl = { slug: pg.template_slug, category: pg.template_category, config: pg.template_config };
      return send(res, 200, renderPaigaamPage(tpl, pg, { baseUrl: BASE_URL }));
    }
    if (method === 'GET' && p === '/contact') {
      return send(res, 200, contactPage(q.settings()));
    }

    /* ---------- WhatsApp handoff ---------- */
    m = p.match(/^\/go\/whatsapp\/([A-Za-z0-9_-]+)$/);
    if (method === 'GET' && m) {
      const pg = q.paigaamById(m[1]);
      if (!pg) return send(res, 404, errorPage('404', 'This Paigaam seems to have wandered away.', "Let's take you back home."));
      if ([ganapati.SLUG, saalgirah.SLUG, courtyard.SLUG].includes(pg.template_slug)) return json(res, 403, { error: 'use_template_endpoint' });
      const settings = q.settings();
      const num = (settings.whatsapp_number || '').replace(/\D/g, '');
      const d = pg.customer_data || {};
      const names = displayNames(pg.template_slug, d).join(' & ');
      // create/refresh the order
      const order = q.orderInsert({
        paigaam_id: pg.id, customer_name: names,
        amount: pg.template_price, currency: pg.template_currency || settings.currency || 'INR',
      });
      if (pg.status === 'draft') q.paigaamUpdate(pg.id, { status: 'payment_pending', customer_name: names });
      const lines = [
        `Hi ${settings.business_name || 'Paigaam'}!`,
        `I'd like to purchase the '${pg.template_name}' Paigaam.`,
        ``,
        `Name: ${names}`,
        `Occasion: ${pg.template_category}`,
        d.eventDate ? `Date: ${displayDate(d.eventDate)}` : null,
        ``,
        `Preview: ${BASE_URL}/preview/${pg.id}`,
        `Order: #${order.id.slice(0, 8).toUpperCase()}`,
      ].filter(Boolean);
      return redirect(res, `https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`);
    }

    /* ---------- JSON API (customer) ---------- */
    // Branded QR SVG for any published Paigaam URL (used by free self-serve + admin).
    if (method === 'GET' && p === '/api/qr') {
      const url = u.searchParams.get('url');
      if (!url || !/^https?:\/\//.test(url)) return json(res, 400, { error: 'bad_url' });
      return send(res, 200, qrSVG(url, { module: 6, margin: 3, dark: '#3B2420', light: '#FBF4ED' }), 'image/svg+xml');
    }
    // Self-publish for FREE templates: no WhatsApp, no payment — publish instantly
    // and hand the customer their live link + QR.
    if (method === 'POST' && p === '/api/free-publish') {
      const body = JSON.parse(await readBody(req) || '{}');
      const pg = q.paigaamById(body.id);
      if (!pg) return json(res, 404, { error: 'not_found' });
      if ([ganapati.SLUG, saalgirah.SLUG, courtyard.SLUG].includes(pg.template_slug)) return json(res, 403, { error: 'use_template_endpoint' });
      if (Number(pg.template_price) > 0) return json(res, 403, { error: 'not_free' });
      const pub = publishPaigaam(pg);
      return json(res, 200, { slug: pub.slug, url: `${BASE_URL}/p/${pub.slug}` });
    }
    if (method === 'POST' && p === '/api/drafts') {
      const body = JSON.parse(await readBody(req) || '{}');
      const tpl = q.templateBySlug(body.template);
      if (!tpl) return json(res, 404, { error: 'template_not_found' });
      if ([ganapati.SLUG, saalgirah.SLUG, courtyard.SLUG].includes(tpl.slug) || [ganapati.SLUG, saalgirah.SLUG, courtyard.SLUG].includes(q.paigaamById(body.id)?.template_slug)) return json(res, 403, { error: 'use_template_endpoint' });
      const data = body.customer_data && typeof body.customer_data === 'object' ? body.customer_data : {};
      const isCustom = !!(tpl.config && tpl.config.custom);
      // For fixed templates, the sender's name is the display name; for native
      // templates, derive it from the template's name fields.
      const names = isCustom
        ? (body.customer_name || data.senderName || displayNames(tpl.slug, data).join(' & '))
        : displayNames(tpl.slug, data).join(' & ');
      if (body.id) {
        const existing = q.paigaamById(body.id);
        if (existing && ['draft', 'payment_pending'].includes(existing.status)) {
          q.paigaamUpdate(body.id, { customer_data: data, customer_name: names });
          return json(res, 200, { id: body.id });
        }
      }
      const pg = q.paigaamInsert({ template_id: tpl.id, customer_data: data, customer_name: names });
      return json(res, 200, { id: pg.id });
    }
    if (method === 'POST' && p === '/api/render-preview') {
      const body = JSON.parse(await readBody(req) || '{}');
      const tpl = q.templateBySlug(body.template);
      if (!tpl) return json(res, 404, { error: 'template_not_found' });
      if ([ganapati.SLUG, saalgirah.SLUG, courtyard.SLUG].includes(tpl.slug)) return json(res, 403, { error: 'use_template_endpoint' });
      const html = renderPaigaamPage(
        { slug: tpl.slug, category: tpl.category, config: tpl.config },
        { customer_data: body.customer_data || {}, slug: null },
        { isPreview: true }
      );
      return send(res, 200, html);
    }

    /* ---------- admin auth ---------- */
    if (method === 'GET' && p === '/admin/login') {
      if (getAdmin(req)) return redirect(res, '/admin');
      return send(res, 200, admin.loginPage());
    }
    if (method === 'POST' && p === '/admin/login') {
      const form = parseForm(await readBody(req));
      const a = q.adminVerify(form.email, form.password);
      if (!a) return send(res, 401, admin.loginPage('Those details don\'t match our records.'));
      const token = q.sessionCreate(a.id);
      return redirect(res, '/admin', { 'Set-Cookie': `paigaam_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}` });
    }
    if (method === 'GET' && p === '/admin/logout') {
      const token = parseCookies(req)['paigaam_session'];
      if (token) q.sessionDelete(token);
      return redirect(res, '/admin/login', { 'Set-Cookie': 'paigaam_session=; Path=/; HttpOnly; Max-Age=0' });
    }

    /* ---------- admin (protected) ---------- */
    if (p.startsWith('/admin')) {
      const me = getAdmin(req);
      if (!me) return redirect(res, '/admin/login');

      if (method === 'GET' && p === '/admin') {
        const templates = q.templatesAll();
        const paigaams = q.paigaamsAll();
        const stats = {
          templates: templates.length,
          paigaams: paigaams.length,
          orders: q.ordersAll().length,
          published: paigaams.filter(x => ['published', 'active'].includes(x.status)).length,
        };
        return send(res, 200, admin.dashboard(stats, paigaams.slice(0, 6), { persistent: !!process.env.DATA_DIR }));
      }

      if (method === 'GET' && p === '/admin/templates') return send(res, 200, admin.templatesAdmin(q.templatesAll()));
      if (method === 'GET' && p === '/admin/templates/new') {
        return send(res, 200, admin.templateForm({ name: '', slug: '', category: 'Wedding', price: 499, description: '', thumbnail_url: '', status: 'draft', config: { fields: getTemplateConfig('noor').fields, sections: ['hero', 'message', 'details', 'closing'], theme: {} } }, true));
      }
      if (method === 'POST' && p === '/admin/templates/new') {
        const form = parseForm(await readBody(req));
        try {
          const t = buildTemplateFromForm(form);
          if (q.templateBySlug(t.slug)) return send(res, 400, errorPage('400', 'That slug is taken.', 'Choose another — slugs must be unique.'));
          q.templateInsert(t);
        } catch (e) {
          return send(res, 400, errorPage('400', 'The fields JSON needs a second look.', String(e.message)));
        }
        return redirect(res, '/admin/templates');
      }
      m = p.match(/^\/admin\/templates\/([A-Za-z0-9_-]+)$/);
      if (method === 'GET' && m) {
        const tpl = q.templateById(m[1]);
        if (!tpl) return send(res, 404, errorPage('404', 'Template not found.', ''));
        return send(res, 200, admin.templateForm(tpl, false));
      }
      if (method === 'POST' && m) {
        const tpl = q.templateById(m[1]);
        if (!tpl) return send(res, 404, errorPage('404', 'Template not found.', ''));
        const form = parseForm(await readBody(req));
        try { q.templateUpdate(tpl.id, buildTemplateFromForm(form)); }
        catch (e) { return send(res, 400, errorPage('400', 'The fields JSON needs a second look.', String(e.message))); }
        return redirect(res, '/admin/templates');
      }
      m = p.match(/^\/admin\/templates\/([A-Za-z0-9_-]+)\/status$/);
      if (method === 'POST' && m) {
        const tpl = q.templateById(m[1]);
        if (!tpl) return send(res, 404, errorPage('404', 'Template not found.', ''));
        const form = parseForm(await readBody(req));
        q.templateUpdate(tpl.id, { ...tpl, status: form.status === 'published' ? 'published' : 'draft' });
        return redirect(res, '/admin/templates');
      }
      m = p.match(/^\/admin\/templates\/([A-Za-z0-9_-]+)\/duplicate$/);
      if (method === 'POST' && m) {
        const tpl = q.templateById(m[1]);
        if (!tpl) return send(res, 404, errorPage('404', 'Template not found.', ''));
        let slug = tpl.slug + '-copy', i = 2;
        while (q.templateBySlug(slug)) slug = `${tpl.slug}-copy-${i++}`;
        q.templateInsert({ ...tpl, name: tpl.name + ' (copy)', slug, status: 'draft' });
        return redirect(res, '/admin/templates');
      }
      m = p.match(/^\/admin\/templates\/([A-Za-z0-9_-]+)\/delete$/);
      if (method === 'POST' && m) { q.templateDelete(m[1]); return redirect(res, '/admin/templates'); }

      if (method === 'GET' && p === '/admin/paigaams') return send(res, 200, admin.paigaamsAdmin(q.paigaamsAll()));
      m = p.match(/^\/admin\/paigaams\/([A-Za-z0-9_-]+)$/);
      if (method === 'GET' && m) {
        const pg = q.paigaamById(m[1]);
        if (!pg) return send(res, 404, errorPage('404', 'Paigaam not found.', ''));
        return send(res, 200, admin.paigaamDetail(pg, BASE_URL));
      }
      m = p.match(/^\/admin\/paigaams\/([A-Za-z0-9_-]+)\/mark-paid$/);
      if (method === 'POST' && m) {
        const pg = q.paigaamById(m[1]);
        if (pg) {
          q.paigaamUpdate(pg.id, { payment_status: 'paid', status: pg.status === 'draft' || pg.status === 'payment_pending' ? 'paid' : pg.status });
          q.ordersAll().filter(o => o.paigaam_id === pg.id && o.status === 'pending').forEach(o => q.orderUpdate(o.id, 'paid'));
        }
        return redirect(res, `/admin/paigaams/${m[1]}`);
      }
      m = p.match(/^\/admin\/paigaams\/([A-Za-z0-9_-]+)\/publish$/);
      if (method === 'POST' && m) {
        const pg = q.paigaamById(m[1]);
        if (pg) {
          publishPaigaam(pg);
        }
        return redirect(res, `/admin/paigaams/${m[1]}`);
      }
      m = p.match(/^\/admin\/paigaams\/([A-Za-z0-9_-]+)\/unpublish$/);
      if (method === 'POST' && m) {
        const pg = q.paigaamById(m[1]);
        if (pg) q.paigaamUpdate(pg.id, { status: 'paid' });
        return redirect(res, `/admin/paigaams/${m[1]}`);
      }
      m = p.match(/^\/admin\/paigaams\/([A-Za-z0-9_-]+)\/archive$/);
      if (method === 'POST' && m) {
        const pg = q.paigaamById(m[1]);
        if (pg) q.paigaamUpdate(pg.id, { status: 'archived' });
        return redirect(res, `/admin/paigaams/${m[1]}`);
      }
      m = p.match(/^\/admin\/paigaams\/([A-Za-z0-9_-]+)\/delete$/);
      if (method === 'POST' && m) { q.paigaamDelete(m[1]); return redirect(res, '/admin/paigaams'); }

      if (method === 'GET' && p === '/admin/orders') return send(res, 200, admin.ordersAdmin(q.ordersAll()));
      m = p.match(/^\/admin\/orders\/([A-Za-z0-9_-]+)\/status$/);
      if (method === 'POST' && m) {
        const form = parseForm(await readBody(req));
        q.orderUpdate(m[1], ['paid', 'pending', 'cancelled'].includes(form.status) ? form.status : 'pending');
        if (form.status === 'paid') {
          const order = q.orderById(m[1]);
          if (order) {
            const pg = q.paigaamById(order.paigaam_id);
            if (pg && pg.payment_status !== 'paid') q.paigaamUpdate(pg.id, { payment_status: 'paid' });
          }
        }
        return redirect(res, '/admin/orders');
      }

      if (method === 'GET' && p === '/admin/settings') return send(res, 200, admin.settingsAdmin(q.settings(), u.searchParams.has('saved')));
      if (method === 'POST' && p === '/admin/settings') {
        const form = parseForm(await readBody(req));
        q.settingsUpdate(form);
        return redirect(res, '/admin/settings?saved=1');
      }

      return send(res, 404, errorPage('404', 'This page seems to have wandered away.', ''));
    }

    return send(res, 404, errorPage('404', 'This Paigaam seems to have wandered away.', "Let's take you back home."));
  } catch (err) {
    console.error('[error]', err);
    return send(res, 500, errorPage('500', 'Something quiet went wrong.', 'Please try again in a moment.'));
  }
});

function buildTemplateFromForm(form) {
  let fields;
  try {
    fields = JSON.parse(form.fields || '[]');
    if (!Array.isArray(fields)) throw new Error('Fields must be a JSON array.');
    for (const f of fields) {
      if (!f.id || !f.label || !f.type) throw new Error('Each field needs an id, label and type.');
      if (!['text', 'textarea', 'date', 'time', 'number', 'image'].includes(f.type)) throw new Error(`Unknown field type "${f.type}".`);
      if (!f.group) f.group = 'people';
    }
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('Fields must be valid JSON.');
    throw e;
  }
  const sections = String(form.sections || 'hero, message, details, closing').split(',').map(s => s.trim()).filter(Boolean);
  const theme = {
    bg: form.theme_bg || '#FBF4ED', ink: form.theme_ink || '#3B2420',
    accent: form.theme_accent || '#8F1018', soft: form.theme_soft || '#EFE3D6',
    motif: form.theme_motif || 'dove', serifCase: form.theme_serifCase || 'uppercase', ampersand: true,
  };
  return {
    name: (form.name || '').trim(), slug: (form.slug || '').trim().toLowerCase(),
    category: form.category || 'Personal', description: form.description || '',
    price: Math.max(0, parseInt(form.price, 10) || 0), currency: 'INR',
    thumbnail_url: form.thumbnail_url || '', status: form.status === 'published' ? 'published' : 'draft',
    config: { fields, sections, theme },
  };
}

/* ---------------- go ---------------- */
q.sessionsPrune();
const healed = ensureBrandAssets();
if (healed.length) console.log('[brand] restored corrupted/missing brand assets:', healed.join(', '));
const mediaHealed = ensureGanapatiMedia();
if (mediaHealed.length) console.log('[ganapati] restored missing media files:', mediaHealed.join(', '));
const courtyardHealed = ensureCourtyardMedia();
if (courtyardHealed.length) console.log('[ganpati-courtyard] restored missing media files:', courtyardHealed.join(', '));
seed();
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`\n  ✉  PAIGAAM — beautiful greetings, made personal.`);
  console.log(`     ${BASE_URL}`);
  console.log(`     admin → ${BASE_URL}/admin/login  (${process.env.ADMIN_EMAIL || 'admin@paigaam.in'})\n`);
});
