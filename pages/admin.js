'use strict';
const { page, esc, head } = require('../lib/layout');
const { doveSVG } = require('../lib/logo');
const { displayNames, displayDate } = require('../templates/registry');
const { qrSVG } = require('../lib/qrcode');

const STATUS_LABEL = {
  draft: 'Draft', payment_pending: 'Payment pending', paid: 'Paid',
  published: 'Published', active: 'Active', archived: 'Archived',
};
const badge = (s) => `<span class="badge badge--${esc(String(s || '').toLowerCase())}">${esc(STATUS_LABEL[s] || s || '—')}</span>`;
const money = (n, cur) => (cur === 'INR' ? '₹' : '') + Number(n || 0).toLocaleString('en-IN');
const fmtDT = (s) => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function adminShell(current, title, inner, opts = {}) {
  const link = (href, label) => `<a href="${href}" ${current === href ? 'aria-current="page"' : ''}>${label}</a>`;
  return page(title, `
<div class="admin">
  <aside class="admin__side">
    <a href="/" class="nav__brand" aria-label="Paigaam home">
      <span style="width:34px;display:inline-block">${doveSVG('#8F1018', 'width="100%"')}</span>
      <span class="nav__word" style="font-size:19px">PAIGAAM</span>
    </a>
    <ul class="admin__nav">
      <li>${link('/admin', 'Dashboard')}</li>
      <li>${link('/admin/templates', 'Templates')}</li>
      <li>${link('/admin/paigaams', 'Paigaams')}</li>
      <li>${link('/admin/orders', 'Orders')}</li>
      <li>${link('/admin/settings', 'Settings')}</li>
      <li><a href="/admin/logout">Sign out</a></li>
    </ul>
  </aside>
  <main class="admin__main">${inner}</main>
</div>`, { noNav: true, noFooter: true, scripts: opts.scripts || '' });
}

/* ---------- login ---------- */
function loginPage(error) {
  return head('Admin sign in') + `
<body>
<main class="login">
  <div class="login__card">
    ${doveSVG('#8F1018', 'width="100%" style="max-width:120px;margin:0 auto 22px;display:block"')}
    <h1>Welcome back.</h1>
    <p class="sub">The quiet room where Paigaams are kept.</p>
    ${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ''}
    <form method="POST" action="/admin/login">
      <div class="field"><label for="email">Email</label>
        <input class="input" style="font-size:19px" type="email" id="email" name="email" required autocomplete="email"></div>
      <div class="field"><label for="password">Password</label>
        <input class="input" style="font-size:19px" type="password" id="password" name="password" required autocomplete="current-password"></div>
      <button class="btn btn--primary" type="submit">Sign in</button>
    </form>
    <p style="margin-top:28px"><a href="/" style="font-size:13px;color:var(--taupe)">← Back to Paigaam</a></p>
  </div>
</main>
</body></html>`;
}

/* ---------- dashboard ---------- */
function dashboard(stats, recent) {
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning.' : hr < 17 ? 'Good afternoon.' : 'Good evening.';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const inner = `
  <p class="admin__greet">${greet}</p>
  <p class="admin__date">${esc(today)}</p>
  <div class="stats">
    <div class="stat"><div class="stat__num">${stats.templates}</div><div class="stat__label">Templates</div></div>
    <div class="stat"><div class="stat__num">${stats.paigaams}</div><div class="stat__label">Paigaams</div></div>
    <div class="stat"><div class="stat__num">${stats.orders}</div><div class="stat__label">Orders</div></div>
    <div class="stat"><div class="stat__num">${stats.published}</div><div class="stat__label">Published</div></div>
  </div>
  <div class="admin__head"><h1>Recent Paigaams</h1><a class="btn btn--small" href="/admin/paigaams">View all</a></div>
  ${recent.length ? `<table class="table"><thead><tr>
    <th>Customer</th><th>Template</th><th>Status</th><th>Payment</th><th>Created</th><th></th>
  </tr></thead><tbody>
    ${recent.map(p => `<tr>
      <td class="serif">${esc(p.customer_name || '—')}</td>
      <td>${esc(p.template_name)}</td>
      <td>${badge(p.status)}</td>
      <td>${badge(p.payment_status)}</td>
      <td style="color:var(--taupe)">${fmtDT(p.created_at)}</td>
      <td><a class="link-btn" href="/admin/paigaams/${esc(p.id)}">Open</a></td>
    </tr>`).join('')}
  </tbody></table>` : `
  <div class="empty" style="padding:70px 20px">
    <h1 style="font-size:34px">No Paigaams yet.</h1>
    <p>They'll appear here the moment a customer personalizes one.</p>
  </div>`}`;
  return adminShell('/admin', 'Dashboard', inner);
}

/* ---------- templates ---------- */
function templatesAdmin(templates) {
  const inner = `
  <div class="admin__head"><h1>Templates</h1><a class="btn btn--primary btn--small" href="/admin/templates/new">New template</a></div>
  <table class="table"><thead><tr>
    <th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Created</th><th>Actions</th>
  </tr></thead><tbody>
  ${templates.map(t => `<tr>
    <td class="serif">${esc(t.name)}</td>
    <td>${esc(t.category)}</td>
    <td>${money(t.price, t.currency)}</td>
    <td>${badge(t.status)}</td>
    <td style="color:var(--taupe)">${fmtDT(t.created_at)}</td>
    <td><div class="table-actions">
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
  </tbody></table>`;
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
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 36px">
      <div class="field"><label for="name">Template name <span class="req">*</span></label>
        <input class="input" style="font-size:19px" id="name" name="name" value="${esc(tpl.name || '')}" required></div>
      <div class="field"><label for="slug">Slug <span class="req">*</span></label>
        <input class="input" style="font-size:19px" id="slug" name="slug" value="${esc(tpl.slug || '')}" required pattern="[a-z0-9\\-]+" title="lowercase letters, numbers, hyphens"></div>
      <div class="field"><label for="category">Category <span class="req">*</span></label>
        <select class="input" style="font-size:17px" id="category" name="category" required>
          ${['Wedding', 'Birthday', 'Anniversary', 'Baby', 'Festival', 'Personal'].map(c => `<option ${tpl.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select></div>
      <div class="field"><label for="price">Price (₹) <span class="req">*</span></label>
        <input class="input" style="font-size:19px" type="number" min="0" id="price" name="price" value="${esc(tpl.price ?? 499)}" required></div>
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
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0 36px">
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
  ${paigaams.length ? `<table class="table"><thead><tr>
    <th>Customer</th><th>Template</th><th>Created</th><th>Payment</th><th>Status</th><th>Published</th><th>Actions</th>
  </tr></thead><tbody>
  ${paigaams.map(p => `<tr>
    <td class="serif">${esc(p.customer_name || '—')}</td>
    <td>${esc(p.template_name)}</td>
    <td style="color:var(--taupe)">${fmtDT(p.created_at)}</td>
    <td>${badge(p.payment_status)}</td>
    <td>${badge(p.status)}</td>
    <td>${p.slug ? `<a class="link-btn link-btn--muted" href="/p/${esc(p.slug)}" target="_blank" rel="noopener">/p/${esc(p.slug)}</a>` : '—'}</td>
    <td><div class="table-actions"><a class="link-btn" href="/admin/paigaams/${esc(p.id)}">Open</a></div></td>
  </tr>`).join('')}
  </tbody></table>` : `
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

  <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:44px;align-items:start" class="pg-detail-grid">
    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:34px">
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
      var img = new Image();
      img.onload = function () {
        ctx.fillStyle = '#FBF4ED'; ctx.fillRect(0, 0, 1080, 1350);
        ctx.strokeStyle = '#E9DCC3'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, 1000, 1270);
        ctx.fillStyle = '#8F1018'; ctx.textAlign = 'center';
        ctx.font = '600 64px Georgia, serif'; ctx.fillText('PAIGAAM', 540, 210);
        ctx.font = 'italic 44px Georgia, serif'; ctx.fillStyle = '#3B2420';
        ctx.fillText('Scan to open', 540, 330); ctx.fillText('our Paigaam', 540, 390);
        ctx.drawImage(img, 240, 470, 600, 600);
        ctx.font = '32px Inter, sans-serif'; ctx.fillStyle = '#A8917E';
        ctx.fillText('${esc(url.replace(/^https?:\/\//, ''))}', 540, 1180);
        var a = document.createElement('a');
        a.download = 'paigaam-${esc(p.slug || 'qr')}.png';
        a.href = card.toDataURL('image/png');
        a.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
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
    <div style="font-family:var(--serif);letter-spacing:0.3em;text-indent:0.3em;color:var(--accent);font-size:20px;font-weight:600;margin-bottom:16px">PAIGAAM</div>
    <p class="qr-line">Scan to open<br>our Paigaam</p>
    ${svg}
    <p class="qr-url">${esc(short)}</p>
  </div>`;
}

/* ---------- orders ---------- */
function ordersAdmin(orders) {
  const inner = `
  <div class="admin__head"><h1>Orders</h1></div>
  ${orders.length ? `<table class="table"><thead><tr>
    <th>Order</th><th>Customer</th><th>Paigaam</th><th>Amount</th><th>Status</th><th>Created</th><th></th>
  </tr></thead><tbody>
  ${orders.map(o => `<tr>
    <td style="font-family:ui-monospace,monospace;font-size:12.5px">#${esc(o.id.slice(0, 8).toUpperCase())}</td>
    <td class="serif">${esc(o.customer_name || '—')}</td>
    <td>${esc(o.template_name || '—')}</td>
    <td>${money(o.amount, o.currency)}</td>
    <td>${badge(o.status)}</td>
    <td style="color:var(--taupe)">${fmtDT(o.created_at)}</td>
    <td><div class="table-actions">
      ${o.status === 'pending' ? `
      <form method="POST" action="/admin/orders/${esc(o.id)}/status" style="display:inline"><input type="hidden" name="status" value="paid"><button class="link-btn" type="submit">Mark paid</button></form>
      <form method="POST" action="/admin/orders/${esc(o.id)}/status" style="display:inline"><input type="hidden" name="status" value="cancelled"><button class="link-btn link-btn--danger" type="submit">Cancel</button></form>` : ''}
      <a class="link-btn link-btn--muted" href="/admin/paigaams/${esc(o.paigaam_id)}">Paigaam</a>
    </div></td>
  </tr>`).join('')}
  </tbody></table>` : `
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
