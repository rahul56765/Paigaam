'use strict';
// Sharing is progressive enhancement: the readonly tracked link always works.
document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-copy]');
  if (!button) return;
  const value = button.dataset.copy;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      copied = true;
    } else {
      const input = button.closest('.pc-template').querySelector('.pc-tracked-link');
      input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
      copied = document.execCommand('copy');
    }
  } catch {}
  const status = document.querySelector('.pc-copy-status');
  if (status) status.textContent = copied ? 'Your tracked link has been copied.' : 'Copy unavailable. Select and copy the tracked link above.';
  button.textContent = copied ? 'Copied ✓' : 'Select link above';
  setTimeout(() => { button.textContent = 'Copy link'; }, 2500);
});
document.addEventListener('focusin', event => {
  if (event.target.matches('.pc-tracked-link')) event.target.select();
});
