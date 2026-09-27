'use strict';
/**
 * The interactive Paigaam builder — generic /create/:slug for every template
 * without a bespoke wizard. One question at a time; the phone preview follows
 * each keystroke and drifts to the section being personalised.
 *
 * Steps are generated from the template's actual field schema (one field per
 * step — never a wall of form). Autosave: localStorage instantly, server
 * draft (existing /api/drafts) as it lands. Final step hands to the existing
 * /preview/:id publish flow — nothing about publishing changes.
 */
const { page, esc } = require('../lib/layout');

/* One friendly question per field. Labels come from the template schema;
   these prompts frame them conversationally, keyed by field id. */
const PROMPTS = {
  recipientName: 'Who is this Paigaam for?',
  senderName: "What's your name?",
  message: 'Write a little something for them.',
  photo: 'Add a photograph — optional, but it makes it yours.',
  eventDate: 'When is the big day?',
  eventTime: 'What time should everyone arrive?',
  venue: 'Where is it happening?',
  address: 'Add the address so nobody gets lost.',
  brideName: "What's the bride's name?",
  groomName: "What's the groom's name?",
  partnerOne: "What's your name?",
  partnerTwo: "What's their name?",
  years: 'How many years are we celebrating?',
  yourName: "What's your name?",
  theirName: 'Who is this for?',
  age: 'How old are they turning?',
  occasion: "What's the occasion?",
};

/* Fallback prompt for fields without a specific one: use the schema label. */
const promptFor = (f) => PROMPTS[f.id] || f.label || 'A few details';

function fieldInput(f) {
  const common = `id="f_${esc(f.id)}" name="${esc(f.id)}" data-field="${esc(f.id)}" autocomplete="off"`;
  let control;
  switch (f.type) {
    case 'textarea':
      control = `<textarea class="input input--area" ${common} rows="3" placeholder="${esc(f.placeholder || '')}"></textarea>`; break;
    case 'date':
      control = `<input class="input" type="date" ${common}>`; break;
    case 'time':
      control = `<input class="input" type="time" ${common}>`; break;
    case 'number':
      control = `<input class="input" type="number" min="0" max="200" ${common} placeholder="${esc(f.placeholder || '')}">`; break;
    case 'image':
      control = `<label class="uploadbox" for="f_${esc(f.id)}">
          <input class="input--file" type="file" accept="image/*" ${common} data-kind="image">
          <span class="uploadbox__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 17.5 9.5 12l5 5 3-3 2.5 2.5"/><circle cx="9" cy="8.5" r="1.8"/><rect x="2.5" y="4" width="19" height="16" rx="2.5"/></svg>
          </span>
          <span class="uploadbox__label">Choose a photo</span>
          <span class="uploadbox__file" id="uploadName" hidden></span>
        </label>
        <p class="hint">Optional — a soft, light image works best.</p>`; break;
    default:
      control = `<input class="input" type="text" ${common} placeholder="${esc(f.placeholder || '')}" ${f.maxLength ? `maxlength="${esc(f.maxLength)}"` : ''}>`;
  }
  return control;
}

function createPage(tpl, draft, draftId) {
  const fields = tpl.config.fields || [];
  const totalSteps = fields.length; // one field per step

  const stepsHTML = fields.map((f, fi) => `
  <fieldset class="bstep" data-step="${fi}" ${fi > 0 ? 'hidden' : ''} data-field-id="${esc(f.id)}">
    <span class="bstep__no">STEP ${String(fi + 1).padStart(2, '0')} OF ${String(totalSteps).padStart(2, '0')}</span>
    <h2 class="bstep__q">${esc(promptFor(f))}${f.required ? '' : ' <span class="bstep__opt">(optional)</span>'}</h2>
    ${fieldInput(f)}
    <p class="bstep__err" id="err_${esc(f.id)}" hidden></p>
  </fieldset>`).join('');

  return page(`Make your ${tpl.name} Paigaam`, `
<main class="builder">
  <div class="wrap">
    <div class="builder__grid">
      <div class="builder__panel">
        <a class="builder__back-crumb" href="/templates/${esc(tpl.slug)}">&larr; ${esc(tpl.name)}</a>

        <div class="builder__phone-wrap">
          <div class="phone phone--builder">
            <div class="phone__screen">
              <iframe id="liveFrame" title="Live preview" style="width:100%;height:100%;border:0"></iframe>
            </div>
          </div>
        </div>

        <form id="createForm" novalidate data-total="${totalSteps}" data-template="${esc(tpl.slug)}" data-draft="${esc(draftId || '')}">
          ${stepsHTML}
          <div class="builder__nav">
            <button type="button" class="btn btn--ghost" id="btnBack" hidden>Back</button>
            <button type="button" class="btn btn--primary" id="btnNext">Next &rarr;</button><!-- label becomes "Preview my Paigaam →" on the final step (builder.js) -->
          </div>
        </form>
      </div>
    </div>
  </div>
</main>
<script>
window.PAIGAAM_BOOT = ${JSON.stringify({
    slug: tpl.slug,
    draftId: draftId || null,
    initial: draft || {},
    fields: fields.map(f => ({ id: f.id, type: f.type, required: !!f.required, label: f.label })),
  }).replace(/</g, '\\u003c')};
</script>
<script src="/js/builder.js" defer></script>`);
}

module.exports = { createPage, promptFor };
