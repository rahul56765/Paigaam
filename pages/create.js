'use strict';
const { page, esc } = require('../lib/layout');
const { fieldGroups } = require('../templates/registry');

function fieldInput(f) {
  const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const reqAttr = f.required ? ' required' : '';
  const common = `id="f_${esc(f.id)}" name="${esc(f.id)}" data-field="${esc(f.id)}"${reqAttr}`;
  let control;
  switch (f.type) {
    case 'textarea':
      control = `<textarea class="textarea" ${common} placeholder="${esc(f.placeholder || '')}"></textarea>`; break;
    case 'date':
      control = `<input class="input" type="date" ${common}>`; break;
    case 'time':
      control = `<input class="input" type="time" ${common}>`; break;
    case 'number':
      control = `<input class="input" type="number" min="0" max="200" ${common} placeholder="${esc(f.placeholder || '')}">`; break;
    case 'image':
      control = `<input class="input--file" type="file" accept="image/*" ${common} data-kind="image">
        <p class="hint">A photograph makes it unmistakably yours. Optional — a soft, light image works best.</p>`; break;
    default:
      control = `<input class="input" type="text" ${common} placeholder="${esc(f.placeholder || '')}">`;
  }
  return `<div class="field"><label for="f_${esc(f.id)}">${esc(f.label)}${req}</label>${control}</div>`;
}

function createPage(tpl, draft, draftId) {
  const groups = fieldGroups({ fields: tpl.config.fields || [] });
  const totalSteps = groups.length;

  const stepsHTML = groups.map((g, gi) => `
  <fieldset class="create__step" data-step="${gi}" ${gi > 0 ? 'hidden' : ''}>
    <span class="kicker">Step ${esc(g.step)}</span>
    <h2 style="font-size:34px;margin-bottom:36px">${esc(g.title)}</h2>
    ${g.fields.map(fieldInput).join('')}
  </fieldset>`).join('');

  return page(`Personalize ${tpl.name}`, `
<main>
  <div class="wrap">
    <div class="create">
      <div>
        <span class="kicker">Make it yours</span>
        <h1 style="font-size:clamp(34px,5vw,48px);margin-bottom:8px;letter-spacing:0.12em">${esc(tpl.name.toUpperCase())}</h1>
        <p style="color:var(--ink-soft);font-family:var(--serif);font-style:italic;font-size:18px;margin-bottom:50px">A few details, and it's yours.</p>

        <div class="stepbar" role="list" aria-label="Progress">
          ${groups.map((g, i) => `<div class="stepbar__item ${i === 0 ? 'active' : ''}" data-stepbar="${i}" role="listitem">
            <span class="stepbar__step">${esc(g.step)}</span><span class="stepbar__label">${esc(g.title)}</span>
          </div>`).join('')}
        </div>

        <form id="createForm" novalidate data-total="${totalSteps}" data-template="${esc(tpl.slug)}" data-draft="${esc(draftId || '')}">
          ${stepsHTML}
          <div class="create__nav">
            <button type="button" class="btn btn--ghost" id="btnBack">Back</button>
            <button type="button" class="btn btn--primary" id="btnNext">Continue</button>
          </div>
          <p id="formError" class="form-error" hidden>Please fill in the fields marked with *.</p>
        </form>
      </div>

      <div class="create__preview" id="previewCol">
        <span class="kicker kicker--muted" style="text-align:center;display:block;margin-bottom:20px">Your Paigaam, as they’ll see it</span>
        <div class="phone">
          <div class="phone__screen">
            <iframe id="liveFrame" title="Live preview" style="width:100%;height:100%;border:0"></iframe>
          </div>
        </div>
      </div>
    </div>
    <div style="text-align:center;padding-bottom:80px">
      <button type="button" class="btn preview-toggle" id="previewToggle">Preview my Paigaam</button>
    </div>
  </div>
</main>
<script>
window.PAIGAAM_BOOT = ${JSON.stringify({ slug: tpl.slug, draftId: draftId || null, initial: draft || {} })};
</script>
<script src="/js/create.js" defer></script>`);
}

module.exports = { createPage };
