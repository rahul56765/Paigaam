'use strict';
const { page, esc, head } = require('../lib/layout');
const { doveSVG } = require('../lib/logo');
const { logoFull } = require('../lib/brand');
const { displayNames, displayDate } = require('../templates/registry');
const { qrSVG } = require('../lib/qrcode');

const STATUS_LABEL = {
  draft: 'Draft', payment_pending: 'Payment pending', paid: 'Paid',
  published: 'Published', active: 'Active', archived: 'Archived',
};
const badge = (s) => `<span class="badge badge--${esc(String(s || '').toLowerCase())}">${esc(STATUS_LABEL[s] || s || '—')}</span>`;
const money = (n, cur) => (cur === 'INR' ? '₹' : '') + Number(n || 0).toLocaleString('en-IN');
const fmtDT = (s) => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ADMIN_ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><path d="M3 10h18"/>',
  templates: '<rect x="4" y="4" width="12" height="15" rx="1.5"/><path d="M8 8h7M8 11h7M8 14h4M16 7h4v13a1 1 0 0 1-1 1H8"/>',
  paigaams: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  orders: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.3 1-1.5 2.6-1.6-.7a8 8 0 0 1-1.6.9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.6-.9l-1.6.7-1.5-2.6 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.5-2.6 1.6.7a8 8 0 0 1 1.6-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 1.6.9l1.6-.7 1.5 2.6-1.4 1.1a7 7 0 0 1 0 1.9Z" transform="translate(-1.2 -1.2) scale(1.1)"/>',
  magazine: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20M8 7h8M8 10h8"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  exit: '<path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const adminIcon = (name) => `<svg class="admin__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ADMIN_ICONS[name] || ADMIN_ICONS.home}</svg>`;

function adminShell(current, title, inner, opts = {}) {
  const link = (href, label, icon) => `<a href="${href}" aria-label="${esc(label)}" ${current === href || (href !== '/admin' && current.startsWith(href + '/')) ? 'aria-current="page"' : ''}>${adminIcon(icon)}<span>${label}</span></a>`;
  return page(title, `
<div class="admin">
  <aside class="admin__side">
    <div class="admin__brand-row">
      <a href="/" class="nav__brand" aria-label="Paigaam home">${logoFull(120, 'Paigaam')}</a>
      <span class="admin__brand-note">STUDIO CONSOLE</span>
    </div>
    <nav class="admin__navigation" aria-label="Admin navigation">
      <div class="admin__nav-caption">Workspace</div>
      <ul class="admin__nav">
        <li>${link('/admin', 'Overview', 'home')}</li>
        <li>${link('/admin/templates', 'Templates', 'templates')}</li>
        <li>${link('/admin/paigaams', 'Paigaams', 'paigaams')}</li>
        <li>${link('/admin/orders', 'Orders', 'orders')}</li>
        <li class="admin__nav-label">Creative studio</li>
        <li>${link('/admin/magazines', 'Magazines', 'magazine')}</li>
        <li>${link('/wedding-video', 'Video templates', 'video')}</li>
        <li class="admin__nav-label">Configuration</li>
        <li>${link('/admin/settings', 'Settings', 'settings')}</li>
      </ul>
    </nav>
    <div class="admin__side-bottom"><div class="admin__side-foot"><span class="admin__status-dot"></span><span><b>Paigaam</b><small>STUDIO ADMIN</small></span></div><a class="admin__signout" href="/admin/logout">${adminIcon('exit')}<span>Sign out</span></a></div>
  </aside>
  <nav class="admin__mobile-nav" aria-label="Quick admin navigation">
    ${link('/admin', 'Home', 'home')}
    ${link('/admin/templates', 'Templates', 'templates')}
    ${link('/admin/paigaams', 'Paigaams', 'paigaams')}
    ${link('/admin/orders', 'Orders', 'orders')}
    <details class="admin__more">
      <summary>${adminIcon('more')}<span>More</span></summary>
      <div class="admin__more-panel">
        ${link('/admin/magazines', 'Magazines', 'magazine')}
        ${link('/wedding-video', 'Video templates', 'video')}
        ${link('/admin/settings', 'Settings', 'settings')}
        <a href="/admin/logout">${adminIcon('exit')}<span>Sign out</span></a>
      </div>
    </details>
  </nav>
  <main class="admin__main">${inner}</main>
</div>`, { noNav: true, noFooter: true, scripts: opts.scripts || '' });
}

/* ---------- login ---------- */
function loginPage(error) {
  return head('Paigaam Studio — Admin sign in') + `
<body class="admin-login">
<main class="admin-login__layout">
  <section class="admin-login__story" aria-label="Paigaam Studio">
    <a href="/" class="admin-login__brand" aria-label="Paigaam home">${logoFull(138, 'Paigaam')}</a>
    <p class="admin__eyebrow">PRIVATE STUDIO · EST. IN CARE</p>
    <div class="admin-login__story-copy"><span class="admin-login__seal" aria-hidden="true">P</span><h1>Meaningful things,<br>beautifully made.</h1><p>A quieter place to tend every note, keepsake and celebration.</p></div>
    <div class="admin-login__story-foot"><span>PAIGAAM · STUDIO ADMIN</span><span aria-hidden="true">✳</span></div>
  </section>
  <section class="admin-login__form" aria-labelledby="adminLoginTitle">
    <div class="admin-login__form-inner">
      <p class="admin__eyebrow">YOUR WORKSPACE</p><h2 id="adminLoginTitle">Welcome back.</h2><p class="admin-login__lede">Sign in to manage the studio.</p>
      ${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ''}
      <form method="POST" action="/admin/login" class="admin-login__fields">
        <div class="field"><label for="email">Email</label><input class="input" type="email" id="email" name="email" required autocomplete="username" inputmode="email"></div>
        <div class="field"><label for="password">Password</label><input class="input" type="password" id="password" name="password" required autocomplete="current-password"></div>
        <button class="btn btn--primary" type="submit">Enter the studio <span aria-hidden="true">→</span></button>
      </form>
      <a class="admin-login__back" href="/">← Back to Paigaam</a>
    </div>
  </section>
</main>
</body></html>`;
}

/* ---------- dashboard ---------- */
function dashboard(stats, recent, opts = {}) {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const storageWarn = opts.persistent === false ? `
  <div style="border:1px solid #E4C08B;background:#FBF3E2;color:#8A6A2B;padding:18px 22px;margin:22px 0 0;border-radius:4px;font-size:14px;line-height:1.5">
    <strong>⚠ Storage is not persistent.</strong> No <code style="font-size:12px">DATA_DIR</code> volume detected, so Paigaams, orders and logins are <strong>erased on every redeploy/restart</strong> (this is why links go to 404).
    Attach a disk at <code style="font-size:12px">/var/data</code> (Render: Settings → Disks → Add Disk) and set <code style="font-size:12px">DATA_DIR=/var/data</code> to fix it permanently.
  </div>` : '';
  const inner = `
  <section class="admin__welcome" aria-labelledby="adminWelcome">
    <div class="admin__welcome-copy"><p class="admin__eyebrow">OVERVIEW · ${esc(today)}</p><h1 id="adminWelcome">Your Paigaam, in good order.</h1><p>One calm place to tend every greeting, keepsake and invitation.</p></div>
    <span class="admin__welcome-mark" aria-hidden="true">P<span>✳</span></span>
  </section>
  ${storageWarn}
  <section class="admin__metrics" aria-label="Paigaam activity">
    <div class="admin__metric"><span class="admin__metric-label">Templates</span><strong>${stats.templates}</strong><span class="admin__metric-note">Ready to personalize</span></div>
    <div class="admin__metric"><span class="admin__metric-label">Paigaams</span><strong>${stats.paigaams}</strong><span class="admin__metric-note">Created with care</span></div>
    <div class="admin__metric"><span class="admin__metric-label">Orders</span><strong>${stats.orders}</strong><span class="admin__metric-note">Across your studio</span></div>
    <div class="admin__metric"><span class="admin__metric-label">Published</span><strong>${stats.published}</strong><span class="admin__metric-note">Out in the world</span></div>
  </section>
  <section class="admin__studio" aria-labelledby="adminStudioTitle">
    <div class="admin__section-head"><div><p class="admin__eyebrow">CREATIVE STUDIO</p><h2 id="adminStudioTitle">Make something memorable</h2></div><span>Two ways to begin</span></div>
    <div class="admin__tool-cards">
      <a class="admin__tool-card admin__tool-card--magazine" href="/admin/magazines">
        <span class="admin__tool-icon">${adminIcon('magazine')}</span><span class="admin__tool-index">01 / PRINT</span><h3>Magazines</h3><p>Shape photo stories, manage Canva designs and check generation.</p><span class="admin__tool-link">Open studio <b aria-hidden="true">↗</b></span>
      </a>
      <a class="admin__tool-card admin__tool-card--video" href="/wedding-video">
        <span class="admin__tool-icon">${adminIcon('video')}</span><span class="admin__tool-index">02 / MOTION</span><h3>Video invitations</h3><p>Open the Remotion editor and compose a wedding invitation film.</p><span class="admin__tool-link">Open editor <b aria-hidden="true">↗</b></span>
      </a>
    </div>
  </section>
  <section class="admin__activity" aria-labelledby="adminActivityTitle">
    <div class="admin__section-head"><div><p class="admin__eyebrow">THE LATEST</p><h2 id="adminActivityTitle">Recent Paigaams</h2></div><a class="admin__text-link" href="/admin/paigaams">View all <span aria-hidden="true">↗</span></a></div>
  ${recent.length ? `<div class="admin__table-wrap"><table class="table"><thead><tr>
    <th>Customer</th><th>Template</th><th>Status</th><th>Payment</th><th>Created</th><th></th>
  </tr></thead><tbody>
    ${recent.map(p => `<tr>
      <td data-label="Customer" class="serif">${esc(p.customer_name || '—')}</td>
      <td data-label="Template">${esc(p.template_name)}</td>
      <td data-label="Status">${badge(p.status)}</td>
      <td data-label="Payment">${badge(p.payment_status)}</td>
      <td data-label="Created" style="color:var(--taupe)">${fmtDT(p.created_at)}</td>
      <td data-label="Open"><a class="link-btn" href="/admin/paigaams/${esc(p.id)}">Open <span aria-hidden="true">↗</span></a></td>
    </tr>`).join('')}
  </tbody></table></div>` : `
  <div class="empty" style="padding:70px 20px">
    <h1 style="font-size:34px">No Paigaams yet.</h1>
    <p>They'll appear here the moment a customer personalizes one.</p>
  </div>`}
  </section>`;
  return adminShell('/admin', 'Dashboard', inner);
}

/* ---------- templates ---------- */
function templatesAdmin(templates) {
  const inner = `
  <div class="admin__head"><h1>Templates</h1><a class="btn btn--primary btn--small" href="/admin/templates/new">New template</a></div>
  <div class="admin__table-wrap"><table class="table"><thead><tr>
    <th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Created</th><th>Actions</th>
  </tr></thead><tbody>
  ${templates.map(t => `<tr>
    <td data-label="Template" class="serif">${esc(t.name)}</td>
    <td data-label="Category">${esc(t.category)}</td>
    <td data-label="Price">${money(t.price, t.currency)}</td>
    <td data-label="Status">${badge(t.status)}</td>
    <td data-label="Created" style="color:var(--taupe)">${fmtDT(t.created_at)}</td>
    <td data-label="Actions"><div class="table-actions">
      <a class="link-btn link-btn--muted" href="/templates/${esc(t.slug)}" target="_blank" rel="noopener">View</a>
      <a class="link-btn" href="/admin/templates/${esc(t.id)}">Edit</a>
      <form method="POST" action="/admin/templates/${esc(t.id)}/duplicate" style="display:inline"><button class="link-btn link-btn--muted" type="submit">Duplicate</button></form>
      <form method="POST" action="/admin/templates/${esc(t.id)}/status" style="display:inline">
        <input type="hidden" name="status" value="${t.status === 'published' ? 'draft' : 'published'}">
        <button class="link-btn" type="submit">${t.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      </form>
      <form method="POST" action="/admin/templates/${esc(t.id)}/delete" style="display:inline" onsubmit="return confirm('Delete ${esc(t.name)}? Paigaams made with it will also be removed.')"><button class="link-btn link-btn--danger" type="submit">Delete</button></form>
    </div></td>
  </tr>`).join('')}
  </tbody></table></div>`;
  return adminShell('/admin/templates', 'Templates', inner);
}

/* ---------- template form (new/edit) ---------- */
function templateForm(tpl, isNew) {
  const cfg = tpl.config || {};
  const fields = cfg.fields || [];
  const sections = cfg.sections || [];
  const theme = cfg.theme || {};
  const action = isNew ? '/admin/templates/new' : `/admin/templates/${tpl.id}`;
  const inner = `
  <div class="admin__head"><h1>${isNew ? 'New template' : 'Edit — ' + esc(tpl.name)}</h1></div>
  <form method="POST" action="${action}" style="max-width:760px">
    <div class="admin__form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px">
      <div class="field"><label for="name">Template name <span class="req">*</span></label>
        <input class="input" style="font-size:19px" id="name" name="name" value="${esc(tpl.name || '')}" required></div>
      <div class="field"><label for="slug">Slug <span class="req">*</span></label>
        <input class="input" style="font-size:19px" id="slug" name="slug" value="${esc(tpl.slug || '')}" required pattern="[a-z0-9\\-]+" title="lowercase letters, numbers, hyphens"></div>
      <div class="field"><label for="category">Category <span class="req">*</span></label>
        <select class="input" style="font-size:17px" id="category" name="category" required>
          ${['Wedding', 'Birthday', 'Anniversary', 'Baby', 'Festival', 'Personal'].map(c => `<option ${tpl.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select></div>
      <div class="field"><label for="price">Sale price (₹) <span class="req">*</span></label>
        <input class="input" style="font-size:19px" type="number" min="0" id="price" name="price" value="${esc(tpl.price ?? 499)}" required>
        <p class="hint">What the customer actually pays.</p></div>
      <div class="field"><label for="list_price">Listing price (₹)</label>
        <input class="input" style="font-size:19px" type="number" min="0" id="list_price" name="list_price" value="${esc(tpl.list_price ?? 0)}">
        <p class="hint">Shown struck-through above the sale price (the "was" price). 0 = none.</p></div>
    </div>
    <div class="field"><label for="description">Description</label>
      <textarea class="textarea" style="font-size:18px" id="description" name="description">${esc(tpl.description || '')}</textarea></div>
    <div class="field"><label for="thumbnail_url">Thumbnail URL</label>
      <input class="input" style="font-size:17px" id="thumbnail_url" name="thumbnail_url" value="${esc(tpl.thumbnail_url || '')}" placeholder="https://… (optional)"></div>
    <div class="field"><label for="status">Status</label>
      <select class="input" style="font-size:17px" id="status" name="status">
        <option value="draft" ${tpl.status !== 'published' ? 'selected' : ''}>Draft</option>
        <option value="published" ${tpl.status === 'published' ? 'selected' : ''}>Published</option>
      </select></div>

    <h2 style="font-size:26px;margin:46px 0 8px">Theme</h2>
    <p class="hint" style="margin-bottom:22px">Palette and motif for the published experience.</p>
    <div class="admin__form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px">
      ${[['bg', 'Background', '#FBF4ED'], ['ink', 'Ink', '#3B2420'], ['accent', 'Accent', '#8F1018'], ['soft', 'Soft section', '#EFE3D6']].map(([k, lbl, dflt]) => `
      <div class="field"><label for="theme_${k}">${lbl}</label>
        <input class="input" style="font-size:17px" id="theme_${k}" name="theme_${k}" value="${esc(theme[k] || dflt)}"></div>`).join('')}
      <div class="field"><label for="theme_motif">Motif</label>
        <select class="input" style="font-size:17px" id="theme_motif" name="theme_motif">
          ${['dove', 'flame', 'ring'].map(mo => `<option value="${mo}" ${theme.motif === mo ? 'selected' : ''}>${mo}</option>`).join('')}
        </select></div>
      <div class="field"><label for="theme_serifCase">Name style</label>
        <select class="input" style="font-size:17px" id="theme_serifCase" name="theme_serifCase">
          <option value="uppercase" ${theme.serifCase !== 'title' ? 'selected' : ''}>Uppercase editorial</option>
          <option value="title" ${theme.serifCase === 'title' ? 'selected' : ''}>Title case</option>
        </select></div>
    </div>

    <h2 style="font-size:26px;margin:46px 0 8px">Fields</h2>
    <p class="hint" style="margin-bottom:16px">The personalization form is generated from these. One field per line as JSON, e.g.
      <code style="font-size:12px">{"id":"brideName","label":"Bride's name","type":"text","required":true,"group":"people"}</code><br>
      Types: text, textarea, date, time, number, image. Groups: people, occasion, message, photos.</p>
    <div class="field"><textarea class="textarea" id="fields" name="fields" style="font-family:ui-monospace,monospace;font-size:13px;min-height:220px;border:1px solid var(--line);padding:16px;border-radius:3px">${esc(JSON.stringify(fields, null, 2))}</textarea></div>

    <h2 style="font-size:26px;margin:40px 0 8px">Sections</h2>
    <p class="hint" style="margin-bottom:16px">Rendered in order. Available: hero, message, details, photo, years, countdown, closing.</p>
    <div class="field"><input class="input" style="font-family:ui-monospace,monospace;font-size:14px" id="sections" name="sections" value="${esc(sections.join(', '))}"></div>

    <div style="display:flex;gap:14px;margin-top:44px">
      <button class="btn btn--primary" type="submit">${isNew ? 'Create template' : 'Save changes'}</button>
      <a class="btn btn--ghost" href="/admin/templates">Cancel</a>
    </div>
  </form>`;
  return adminShell('/admin/templates', isNew ? 'New template' : 'Edit template', inner);
}

/* ---------- paigaams list ---------- */
function paigaamsAdmin(paigaams) {
  const inner = `
  <div class="admin__head"><h1>Paigaams</h1></div>
  ${paigaams.length ? `<div class="admin__table-wrap"><table class="table"><thead><tr>
    <th>Customer</th><th>Template</th><th>Created</th><th>Payment</th><th>Status</th><th>Published</th><th>Actions</th>
  </tr></thead><tbody>
  ${paigaams.map(p => `<tr>
    <td data-label="Customer" class="serif">${esc(p.customer_name || '—')}</td>
    <td data-label="Template">${esc(p.template_name)}</td>
    <td data-label="Created" style="color:var(--taupe)">${fmtDT(p.created_at)}</td>
    <td data-label="Payment">${badge(p.payment_status)}</td>
    <td data-label="Status">${badge(p.status)}</td>
    <td data-label="Published">${p.slug ? `<a class="link-btn link-btn--muted" href="/p/${esc(p.slug)}" target="_blank" rel="noopener">/p/${esc(p.slug)}</a>` : '—'}</td>
    <td data-label="Actions"><div class="table-actions"><a class="link-btn" href="/admin/paigaams/${esc(p.id)}">Open <span aria-hidden="true">↗</span></a></div></td>
  </tr>`).join('')}
  </tbody></table></div>` : `
  <div class="empty" style="padding:70px 20px">
    <h1 style="font-size:34px">No Paigaams yet.</h1>
    <p>Share your templates, and they'll begin to arrive.</p>
    <a class="btn" href="/templates" target="_blank" rel="noopener">View gallery</a>
  </div>`}`;
  return adminShell('/admin/paigaams', 'Paigaams', inner);
}

/* ---------- paigaam detail ---------- */
function paigaamDetail(p, baseUrl) {
  const d = p.customer_data || {};
  const names = displayNames(p.template_slug, d).join(' & ');
  const url = p.slug ? `${baseUrl}/p/${p.slug}` : null;
  const dataRows = Object.entries(d).filter(([k, v]) => v && !String(v).startsWith('data:'))
    .map(([k, v]) => `<div style="margin-bottom:14px"><span style="display:block;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:var(--taupe);font-weight:700;margin-bottom:4px">${esc(k)}</span><span class="serif" style="font-size:18px">${esc(v)}</span></div>`).join('');
  const hasPhoto = Object.values(d).some(v => typeof v === 'string' && v.startsWith('data:image'));

  const inner = `
  <div class="admin__head">
    <h1>${esc(names)}</h1>
    <a class="btn btn--ghost btn--small" href="/admin/paigaams">← All Paigaams</a>
  </div>

  ${p.status === 'published' && url ? `
  <div style="border:1px solid #C8DCC6;background:#EDF4EC;padding:22px 26px;margin-bottom:36px;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap">
    <div>
      <strong class="serif" style="font-size:22px">Your Paigaam is live.</strong>
      <div style="font-size:14px;color:var(--ink-soft);margin-top:4px">${esc(url)}</div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn--small" data-copy="${esc(url)}">Copy link</button>
      <a class="btn btn--small" href="/p/${esc(p.slug)}" target="_blank" rel="noopener">Open</a>
    </div>
  </div>` : ''}

  ${p.recovery_token ? `
  <div style="border:1px solid var(--line);background:var(--paper,#fff);padding:16px 22px;margin-bottom:30px;font-size:13.5px;color:var(--ink-soft)">
    <strong style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase">Recovery link</strong> — give this to the sender if they lost their link (no account needed):
    <div style="margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <a style="word-break:break-all" href="/recover/${esc(p.recovery_token)}">${esc(baseUrl)}/recover/${esc(p.recovery_token)}</a>
      <button class="btn btn--small" data-copy="${esc(baseUrl)}/recover/${esc(p.recovery_token)}">Copy</button>
    </div>
  </div>` : ''}

  <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:44px;align-items:start" class="pg-detail-grid">
    <div>
      <div class="admin__detail-stats" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-bottom:34px">
        <div class="stat"><div class="stat__label" style="margin-bottom:8px">Template</div><div class="serif" style="font-size:24px">${esc(p.template_name)}</div></div>
        <div class="stat"><div class="stat__label" style="margin-bottom:8px">Amount</div><div class="serif" style="font-size:24px">${money(p.template_price, p.template_currency)}</div></div>
        <div class="stat"><div class="stat__label" style="margin-bottom:8px">Payment</div>${badge(p.payment_status)}</div>
        <div class="stat"><div class="stat__label" style="margin-bottom:8px">Status</div>${badge(p.status)}</div>
      </div>

      <h2 style="font-size:24px;margin-bottom:22px">Their details</h2>
      <div style="border:1px solid var(--line);padding:28px;margin-bottom:34px">
        ${dataRows || '<p style="color:var(--taupe)">No details yet.</p>'}
        ${hasPhoto ? '<p style="font-size:13px;color:var(--taupe)">+ a photograph, held within the Paigaam</p>' : ''}
      </div>

      <div class="table-actions" style="gap:12px;flex-wrap:wrap">
        ${p.payment_status !== 'paid' ? `<form method="POST" action="/admin/paigaams/${esc(p.id)}/mark-paid"><button class="btn btn--small" type="submit">Mark payment received</button></form>` : ''}
        ${p.status !== 'published' ? `<form method="POST" action="/admin/paigaams/${esc(p.id)}/publish" onsubmit="return confirm('Publish this Paigaam? It will become publicly accessible.')"><button class="btn btn--primary btn--small" type="submit">Publish Paigaam</button></form>` : `<form method="POST" action="/admin/paigaams/${esc(p.id)}/unpublish"><button class="btn btn--small" type="submit">Unpublish</button></form>`}
        ${p.status !== 'archived' ? `<form method="POST" action="/admin/paigaams/${esc(p.id)}/archive"><button class="btn btn--small btn--ghost" type="submit">Archive</button></form>` : ''}
        <form method="POST" action="/admin/paigaams/${esc(p.id)}/delete" onsubmit="return confirm('Delete this Paigaam permanently?')"><button class="link-btn link-btn--danger" type="submit">Delete</button></form>
      </div>
    </div>

    <div>
      <h2 style="font-size:24px;margin-bottom:22px">Share card</h2>
      <div id="qrWrap">
        ${url ? qrCardHTML(url, names) : `
        <div class="qr-card"><p style="font-family:var(--serif);font-style:italic;font-size:18px;color:var(--taupe)">Publish this Paigaam to receive its QR card.</p></div>`}
      </div>
      ${url ? `<div style="text-align:center;margin-top:20px"><button class="btn btn--small" id="downloadQR">Download QR</button></div>` : ''}
    </div>
  </div>

  <style>@media (max-width: 900px) { .pg-detail-grid { grid-template-columns: 1fr !important; } }</style>`;

  const scripts = url ? `<script>
  (function () {
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(function () {
          b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy link'; }, 1600);
        });
      });
    });
    var dl = document.getElementById('downloadQR');
    if (dl) dl.addEventListener('click', function () {
      var svg = document.querySelector('#qrWrap svg[data-qr]');
      if (!svg) return;
      var card = document.createElement('canvas');
      card.width = 1080; card.height = 1350;
      var ctx = card.getContext('2d');
      var xml = new XMLSerializer().serializeToString(svg);
      var img = new Image();          // QR
      var logo = new Image();         // real Paigaam logo
      var shortUrl = '${esc(url.replace(/^https?:\/\//, ''))}';
      function draw() {
        ctx.fillStyle = '#FBF4ED'; ctx.fillRect(0, 0, 1080, 1350);
        ctx.strokeStyle = '#E9DCC3'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, 1000, 1270);
        // logo (1200x600 → 2:1), centered
        var lw = 460, lh = lw * (logo.height / logo.width);
        ctx.drawImage(logo, (1080 - lw) / 2, 120, lw, lh);
        ctx.fillStyle = '#3B2420'; ctx.textAlign = 'center';
        ctx.font = 'italic 44px Georgia, serif';
        ctx.fillText('Scan to open', 540, 470); ctx.fillText('our Paigaam', 540, 528);
        ctx.drawImage(img, 240, 590, 600, 600);
        ctx.font = '32px Inter, sans-serif'; ctx.fillStyle = '#A8917E';
        ctx.fillText(shortUrl, 540, 1260);
        var a = document.createElement('a');
        a.download = 'paigaam-${esc(p.slug || 'qr')}.png';
        a.href = card.toDataURL('image/png');
        a.click();
      }
      var loaded = 0;
      function ready() { if (++loaded === 2) draw(); }
      img.onload = ready; logo.onload = ready;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      logo.src = '/brand/logo-full.png';
    });
  })();
  </script>` : '';

  return adminShell('/admin/paigaams', names, inner, { scripts });
}

function qrCardHTML(url, names) {
  const svg = qrSVG(url, { module: 5, margin: 3, dark: '#3B2420', light: '#FBF4ED' })
    .replace('<svg ', '<svg data-qr="1" class="qr-img" ');
  const short = url.replace(/^https?:\/\//, '');
  return `<div class="qr-card">
    <div style="display:flex;justify-content:center;margin-bottom:16px">${logoFull(120, 'Paigaam')}</div>
    <p class="qr-line">Scan to open<br>our Paigaam</p>
    ${svg}
    <p class="qr-url">${esc(short)}</p>
  </div>`;
}

/* ---------- orders ---------- */
function ordersAdmin(orders) {
  const inner = `
  <div class="admin__head"><h1>Orders</h1></div>
  ${orders.length ? `<div class="admin__table-wrap"><table class="table"><thead><tr>
    <th>Order</th><th>Customer</th><th>Paigaam</th><th>Amount</th><th>Status</th><th>Created</th><th></th>
  </tr></thead><tbody>
  ${orders.map(o => `<tr>
    <td data-label="Order" style="font-family:ui-monospace,monospace;font-size:12.5px">#${esc(o.id.slice(0, 8).toUpperCase())}${o.razorpay_payment_id ? `<br><span style="font-size:10.5px;color:var(--taupe)">rzp pay: ${esc(String(o.razorpay_payment_id).slice(0, 18))}</span>` : ''}</td>
    <td data-label="Customer" class="serif">${esc(o.customer_name || '—')}</td>
    <td data-label="Paigaam">${esc(o.template_name || '—')}</td>
    <td data-label="Amount">${money(o.amount, o.currency)}</td>
    <td data-label="Status">${badge(o.status)}</td>
    <td data-label="Created" style="color:var(--taupe)">${fmtDT(o.created_at)}</td>
    <td data-label="Actions"><div class="table-actions">
      ${o.status === 'pending' ? `
      <form method="POST" action="/admin/orders/${esc(o.id)}/status" style="display:inline"><input type="hidden" name="status" value="paid"><button class="link-btn" type="submit">Mark paid</button></form>
      <form method="POST" action="/admin/orders/${esc(o.id)}/status" style="display:inline"><input type="hidden" name="status" value="cancelled"><button class="link-btn link-btn--danger" type="submit">Cancel</button></form>` : ''}
      <a class="link-btn link-btn--muted" href="/admin/paigaams/${esc(o.paigaam_id)}">Paigaam</a>
    </div></td>
  </tr>`).join('')}
  </tbody></table></div>` : `
  <div class="empty" style="padding:70px 20px">
    <h1 style="font-size:34px">No orders yet.</h1>
    <p>When a customer continues on WhatsApp, their order waits here for your confirmation.</p>
  </div>`}`;
  return adminShell('/admin/orders', 'Orders', inner);
}

/* ---------- settings ---------- */
function settingsAdmin(s, saved) {
  const inner = `
  <div class="admin__head"><h1>Settings</h1></div>
  ${saved ? '<p style="background:#EDF4EC;border:1px solid #C8DCC6;color:#3E6B40;padding:12px 18px;margin-bottom:26px;font-size:14px">Saved. Your changes are live.</p>' : ''}
  <form method="POST" action="/admin/settings" style="max-width:640px">
    <div class="field"><label for="whatsapp_number">WhatsApp number <span class="req">*</span></label>
      <input class="input" style="font-size:19px" id="whatsapp_number" name="whatsapp_number" value="${esc(s.whatsapp_number)}" required placeholder="919876543210">
      <p class="hint">Include country code, digits only. Every "Continue on WhatsApp" leads here.</p></div>
    <div class="field"><label for="business_name">Business name</label>
      <input class="input" style="font-size:19px" id="business_name" name="business_name" value="${esc(s.business_name)}"></div>
    <div class="field"><label for="currency">Default currency</label>
      <select class="input" style="font-size:17px" id="currency" name="currency">
        <option value="INR" ${s.currency === 'INR' ? 'selected' : ''}>INR (₹)</option>
        <option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
      </select></div>
    <div class="field"><label for="contact_message">Default contact message</label>
      <textarea class="textarea" style="font-size:18px" id="contact_message" name="contact_message">${esc(s.contact_message)}</textarea></div>
    <button class="btn btn--primary" type="submit" style="margin-top:10px">Save settings</button>
  </form>`;
  return adminShell('/admin/settings', 'Settings', inner);
}

module.exports = { loginPage, dashboard, templatesAdmin, templateForm, paigaamsAdmin, paigaamDetail, ordersAdmin, settingsAdmin, qrCardHTML };
