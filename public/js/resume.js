'use strict';
/**
 * "Begin where you left off" — shared by every bespoke wizard.
 *
 * The create route finds the sender's most recent draft of this template
 * (creator cookie, younger than an hour) and embeds it as
 * <script id="wizardBoot" type="application/json"> { draftId, data } </script>.
 * This script applies the saved values to the wizard's inputs and offers a
 * resume popup. Start-fresh simply ignores the payload (the server deletes
 * nothing; a stale draft expires on its own).
 *
 * Wizards that keep their own state (photo pickers, list rows, bgm) receive a
 * per-field apply hook: window.wizardApplyField = function (id, value) {}.
 * Returning false from the hook means "this field applies itself later" —
 * the default apply is skipped for it.
 */
(function () {
  var node = document.getElementById('wizardBoot');
  if (!node) return;
  var boot;
  try { boot = JSON.parse(node.textContent); } catch (e) { return; }
  if (!boot || !boot.draftId || !boot.data) return;
  // The live draft state the wizard maintains (set by the wizard script).
  var wizard = window.wizardState;
  if (!wizard || typeof wizard.draftId !== 'undefined') {
    // Wizards expose their draft holder indirectly; the common shape is a
    // module-scoped variable we can't reach — so we drive the DOM directly
    // and let the wizard's next saveDraft() adopt the draft id via a global.
  }
  if (!window.wizardResume) window.wizardResume = boot;

  function applyValues() {
    var applied = 0;
    Object.keys(boot.data).forEach(function (id) {
      var v = boot.data[id];
      if (v == null || v === '') return;
      var hook = window.wizardApplyField;
      if (typeof hook === 'function' && hook(id, v) === false) return;
      var node = document.getElementById(id) || document.getElementById('f-' + id) || document.getElementById('f_' + id);
      if (node && typeof node.value !== 'undefined' && node.value !== v) {
        node.value = v;
        node.dispatchEvent(new Event('input', { bubbles: true }));
        applied++;
      }
    });
    return applied;
  }

  // Only offer the popup once, on first paint, before the sender types anything.
  if (document.getElementById('resumeAsk')) return;
  var firstField = document.querySelector('.step:not([hidden]) input, .step:not([hidden]) textarea');
  if (firstField && firstField.value && firstField.value !== '') return; // already has typing — don't nag

  var ask = document.createElement('div');
  ask.id = 'resumeAsk';
  ask.setAttribute('role', 'dialog');
  ask.setAttribute('aria-label', 'Resume your draft');
  ask.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(36,22,16,.55);padding:20px';
  var when = boot.at ? new Date(boot.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
  ask.innerHTML = '<div style="background:#fff;max-width:420px;width:100%;border-radius:16px;padding:28px 26px;box-shadow:0 24px 60px rgba(0,0,0,.25);text-align:center;font-family:inherit">'
    + '<p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8F1018;margin:0 0 10px">Welcome back</p>'
    + '<h2 style="font-size:24px;margin:0 0 10px;font-weight:600">Begin where you left off?</h2>'
    + '<p style="font-size:15px;color:#6b5d54;margin:0 0 22px">We saved this ' + (boot.noun || 'Paigaam') + ' while you were working'
    + (when ? ' (around ' + when + ')' : '') + '. Continue editing, or start fresh — nothing is lost either way.</p>'
    + '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">'
    + '<button type="button" id="resumeYes" style="background:#8F1018;color:#fff;border:0;border-radius:999px;padding:12px 26px;font-size:15px;font-weight:600;cursor:pointer">Continue editing</button>'
    + '<button type="button" id="resumeNo" style="background:transparent;color:#8F1018;border:1.5px solid #8F1018;border-radius:999px;padding:12px 26px;font-size:15px;font-weight:600;cursor:pointer">Start fresh</button>'
    + '</div></div>';
  document.body.appendChild(ask);

  document.getElementById('resumeYes').addEventListener('click', function () {
    applyValues();
    // Adopt the server draft so the next save updates it instead of forking.
    if (window.wizardAdoptDraft) window.wizardAdoptDraft(boot.draftId, boot.previewUrl || null);
    ask.remove();
  });
  document.getElementById('resumeNo').addEventListener('click', function () {
    ask.remove();
    if (window.wizardDiscardDraft) window.wizardDiscardDraft(boot.draftId);
  });
})();
