'use strict';
/**
 * Admin pages for the Boyfriend Day template studio (lib/bfday/studio.js).
 *
 *   listPage(members, flash)      every Boyfriend Day template, its kind and status
 *   editPage(view, state)         the copy form for one template, plus clone / reset / delete
 */
const { esc } = require('../lib/layout');
const { adminShell } = require('./admin');

const WIZARD_LABELS = [
  ['eyebrow', 'Small line above the headline', 'text'],
  ['headline', 'Headline', 'text'],
  ['intro', 'Intro paragraph', 'textarea'],
  ['noun', 'What the gift is called (for example “website”)', 'text'],
  ['designHeading', 'Heading above the design notes', 'text'],
  ['designIntro', 'Design notes intro', 'textarea'],
  ['previewCta', 'Preview button text', 'text'],
  ['previewHelp', 'Preview help text', 'textarea'],
  ['resultLine', 'Line on the finished screen', 'text'],
];

const STATUS_BADGE = s => `<span class="badge badge--${esc(s === 'published' ? 'published' : 'draft')}">${s === 'published' ? 'Published' : (s === 'missing' ? 'No record' : 'Draft')}</span>`;
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const linesOf = v => (Array.isArray(v) ? v.map(x => String(x == null ? '' : x)).join('\n') : (v == null ? '' : String(v)));
const textOf = v => (v == null ? '' : String(v));

function kindLabel(m) {
  if (m.clone) return 'Studio clone';
  if (m.customised) return 'Built-in · copy edited';
  return 'Built-in';
}

function listPage(members, flash = '') {
  const rows = members.map(m => `<tr>
    <td data-label="Template" class="serif">${esc(m.name)}<br><small style="color:var(--taupe)">/${esc(m.slug)}</small></td>
    <td data-label="Kind">${esc(kindLabel(m))}</td>
    <td data-label="Category">${esc(m.category)}</td>
    <td data-label="Status">${STATUS_BADGE(m.status)}</td>
    <td data-label="Price">${money(m.price)}</td>
    <td data-label="Paigaams">${m.paigaams}</td>
    <td data-label="Actions"><div class="table-actions">
      <a class="link-btn" href="/admin/studio/${esc(m.slug)}">Edit</a>
      <a class="link-btn link-btn--muted" href="/${esc(m.slug)}/demo" target="_blank" rel="noopener">Preview</a>
    </div></td>
  </tr>`).join('');
  const inner = `
  <div class="admin__head"><h1>Template studio</h1></div>
  <p class="hint" style="max-width:720px;margin-bottom:26px">Edit the words of the Boyfriend Day layouts, and clone any layout as a new occasion. Layouts, photos and colours stay as designed; only the copy, the listing and the status change here.</p>
  ${flash ? `<p class="notice" role="status">${esc(flash)}</p>` : ''}
  <div class="admin__table-wrap"><table class="table"><thead><tr>
    <th>Template</th><th>Kind</th><th>Category</th><th>Status</th><th>Price</th><th>Paigaams</th><th>Actions</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
  return adminShell('/admin/studio', 'Template studio', inner);
}

function field(id, label, control, hint = '') {
  return `<div class="field"><label for="${esc(id)}">${esc(label)}</label>${control}${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
}

function renderSpec(spec, value) {
  if (spec.kind === 'text') {
    const control = spec.type === 'textarea'
      ? `<textarea class="textarea" id="f_${esc(spec.id)}" name="f_${esc(spec.id)}" rows="${Math.min(spec.rows + 2, 8)}" maxlength="${spec.max}"${spec.required ? ' required' : ''} placeholder="${esc(spec.placeholder)}">${esc(textOf(value))}</textarea>`
      : `<input class="input" id="f_${esc(spec.id)}" name="f_${esc(spec.id)}" value="${esc(textOf(value))}" maxlength="${spec.max}"${spec.required ? ' required' : ''} placeholder="${esc(spec.placeholder)}"${spec.type === 'url' ? ' type="url"' : ''}>`;
    return field(`f_${spec.id}`, spec.label + (spec.required ? ' *' : ''), control, `${spec.hint ? spec.hint + ' ' : ''}Up to ${spec.max} characters.`);
  }
  if (spec.kind === 'lines') {
    const control = `<textarea class="textarea" id="l_${esc(spec.id)}" name="l_${esc(spec.id)}" rows="${Math.min(spec.maxItems, 12) + 1}">${esc(linesOf(value))}</textarea>`;
    return field(`l_${spec.id}`, spec.label, control,
      `One ${spec.itemLabel.toLowerCase()} per line. ${spec.minItems ? `At least ${spec.minItems}. ` : ''}At most ${spec.maxItems}. Up to ${spec.max} characters each.`);
  }
  // rows: one labelled block per row, up to the form's row count
  const items = Array.isArray(value) ? value : [];
  const blocks = Array.from({ length: spec.rowCount }, (_, i) => {
    const item = items[i] || {};
    return `<div class="admin__row-block" style="border:1px solid var(--line, #e6dccb);border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--taupe);margin:0 0 10px">${esc(spec.itemLabel)} ${i + 1}</p>
      ${spec.subs.map(sub => {
        const name = `s_${spec.id}_${i}_${sub.id}`;
        const attrs = `name="${esc(name)}" id="${esc(name)}" maxlength="${sub.max}" placeholder="${esc(sub.placeholder)}"`;
        const control = sub.rows > 2 || sub.max > 120
          ? `<textarea class="textarea" rows="${Math.min(sub.rows + 1, 6)}" ${attrs}>${esc(textOf(item[sub.id]))}</textarea>`
          : `<input class="input" ${attrs} value="${esc(textOf(item[sub.id]))}">`;
        return field(name, sub.label + (sub.required ? ' *' : ''), control);
      }).join('')}
    </div>`;
  }).join('');
  return `<div class="field"><p style="font-size:17px;margin:0 0 6px"><strong>${esc(spec.label)}</strong></p>
    <p class="hint">${esc(spec.hint ? spec.hint + ' ' : '')}${spec.minItems ? `At least ${spec.minItems} filled in. ` : ''}At most ${spec.maxItems}. A block left empty is dropped.</p>
    ${blocks}</div>`;
}

function editPage(view, state = {}) {
  const { member: m, specs, root, rootName, tpl, paigaams } = view;
  const values = state.values || view.values;
  const errors = state.errors || [];
  const meta = values.meta || {};
  const wizard = values.wizard || {};
  const listingPrice = values.price != null ? values.price : (tpl ? tpl.price : 0);
  const listingStatus = values.status || (tpl ? tpl.status : 'draft');
  const isClone = m.clone;
  const scenesValue = Array.isArray(wizard.scenes) ? wizard.scenes.join('\n') : (wizard.scenes || '');

  const inner = `
  <div class="admin__head"><h1>${esc(m.name)}</h1></div>
  <p class="hint" style="margin:-6px 0 18px">${STATUS_BADGE(m.status)} &nbsp;${esc(kindLabel(m))}${isClone ? '' : ` · layout: ${esc(rootName || root)}`} · <a href="/${esc(m.slug)}/demo" target="_blank" rel="noopener">Preview</a>${m.status === 'published' ? ` · <a href="/create/${esc(m.slug)}" target="_blank" rel="noopener">Open the wizard</a>` : ''}</p>
  ${state.saved ? '<p class="notice" role="status">Saved. The template now shows this copy.</p>' : ''}
  ${errors.length ? `<div class="notice notice--error" role="alert" style="border:1px solid #E4CFCB;background:#F9EFEC;color:#7A3A32;padding:14px 18px;border-radius:10px;margin-bottom:22px"><strong>Not saved yet — please fix:</strong><ul style="margin:8px 0 0 18px">${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}

  <form method="POST" action="/admin/studio/${esc(m.slug)}" style="max-width:820px">
    <h2 style="font-size:24px;margin:8px 0 14px">Listing</h2>
    <div class="admin__form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px">
      ${field('price', 'Sale price (₹)', `<input class="input" type="number" min="0" max="100000" step="1" id="price" name="price" value="${esc(listingPrice)}" required>`, 'What the customer pays. 0 = free.')}
      ${field('status', 'Status', `<select class="input" id="status" name="status">
        <option value="draft" ${listingStatus !== 'published' ? 'selected' : ''}>Draft (hidden from the gallery)</option>
        <option value="published" ${listingStatus === 'published' ? 'selected' : ''}>Published</option>
      </select>`)}
    </div>
    ${isClone ? `
    <div class="admin__form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px">
      ${field('meta_name', 'Template name *', `<input class="input" id="meta_name" name="meta_name" value="${esc(meta.name || '')}" maxlength="60" required>`)}
      ${field('meta_category', 'Category *', `<input class="input" id="meta_category" name="meta_category" value="${esc(meta.category || '')}" maxlength="40" required>`)}
    </div>
    ${field('meta_description', 'Description *', `<textarea class="textarea" id="meta_description" name="meta_description" rows="3" maxlength="300" required>${esc(meta.description || '')}</textarea>`, 'Shown on the gallery card.')}` : `
    <p class="hint" style="margin:0 0 6px">Name, category and description come from the shipped layout and are not edited here. Clone it to make a new occasion with its own name.</p>`}

    <h2 style="font-size:24px;margin:36px 0 8px">Wizard wording</h2>
    <p class="hint" style="margin-bottom:18px">What the buyer reads while filling it in. A box left blank keeps the shipped wording.</p>
    <div class="admin__form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px">
      ${WIZARD_LABELS.map(([key, label, kind]) => field(`w_${key}`, label, kind === 'textarea'
        ? `<textarea class="textarea" id="w_${key}" name="w_${key}" rows="3" maxlength="600">${esc(textOf(wizard[key]))}</textarea>`
        : `<input class="input" id="w_${key}" name="w_${key}" value="${esc(textOf(wizard[key]))}" maxlength="600">`)).join('')}
    </div>
    ${field('w_scenes', 'Scenes (one per line)', `<textarea class="textarea" id="w_scenes" name="w_scenes" rows="6" maxlength="4000">${esc(scenesValue)}</textarea>`, 'The short descriptions of each scene on the create page. Blank keeps the shipped scenes.')}

    <h2 style="font-size:24px;margin:36px 0 8px">Words, samples and defaults</h2>
    <p class="hint" style="margin-bottom:18px">These fill the wizard by default and show in the preview. Fields the shipped layout leaves blank (names, the song link) show their sample in the preview only, so buyers still start empty.</p>
    ${specs.map(spec => renderSpec(spec, values.fields[spec.id])).join('')}

    <div style="margin:34px 0 10px;display:flex;gap:12px;flex-wrap:wrap">
      <button class="btn btn--primary" type="submit">Save copy</button>
      <a class="btn btn--ghost" href="/admin/studio">Back to the studio</a>
    </div>
  </form>

  <section style="max-width:820px;margin-top:46px;border-top:1px solid var(--line, #e6dccb);padding-top:28px">
    <h2 style="font-size:24px;margin:0 0 8px">Make a new occasion from this</h2>
    <p class="hint" style="margin-bottom:18px">Clones keep this layout and the copy above, with a new name, slug, listing and status. The clone starts as a draft.</p>
    <form method="POST" action="/admin/studio/${esc(m.slug)}/clone" style="max-width:820px">
      <div class="admin__form-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 36px">
        ${field('new_name', 'New template name *', '<input class="input" id="new_name" name="new_name" maxlength="60" required placeholder="Anniversary Tohfa">')}
        ${field('new_slug', 'New slug *', '<input class="input" id="new_slug" name="new_slug" maxlength="40" required pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" placeholder="anniversary-tohfa" title="lowercase words joined by hyphens">', 'Becomes the address: /anniversary-tohfa.')}
        ${field('new_category', 'Category *', `<input class="input" id="new_category" name="new_category" maxlength="40" required value="${esc(isClone ? (meta.category || '') : '')}" placeholder="Anniversary">`)}
        ${field('new_price', 'Sale price (₹)', `<input class="input" type="number" min="0" max="100000" step="1" id="new_price" name="new_price" value="${esc(listingPrice)}">`)}
      </div>
      ${field('new_description', 'Description', `<textarea class="textarea" id="new_description" name="new_description" rows="2" maxlength="300">${esc(isClone ? (meta.description || '') : '')}</textarea>`)}
      <button class="btn btn--primary btn--small" type="submit">Create as draft</button>
    </form>
  </section>

  ${isClone ? `<section style="max-width:820px;margin-top:40px">
    <h2 style="font-size:20px;margin:0 0 8px">Delete this clone</h2>
    ${paigaams > 0
      ? `<p class="hint">${paigaams} paigaam${paigaams === 1 ? ' has' : 's have'} been made from it, so it cannot be deleted. Set it to Draft to hide it.</p>`
      : `<form method="POST" action="/admin/studio/${esc(m.slug)}/delete" onsubmit="return confirm('Delete this clone? This cannot be undone.')"><button class="btn btn--ghost btn--small" type="submit">Delete clone</button></form>`}
  </section>` : (m.customised ? `<section style="max-width:820px;margin-top:40px">
    <h2 style="font-size:20px;margin:0 0 8px">Reset to the shipped copy</h2>
    <p class="hint" style="margin-bottom:12px">Puts back the words that shipped with the layout. Price and status are kept.</p>
    <form method="POST" action="/admin/studio/${esc(m.slug)}/reset" onsubmit="return confirm('Reset the copy to the shipped wording?')"><button class="btn btn--ghost btn--small" type="submit">Reset copy</button></form>
  </section>` : '')}`;
  return adminShell('/admin/studio', `Studio — ${m.name}`, inner);
}

module.exports = { listPage, editPage, WIZARD_LABELS };
