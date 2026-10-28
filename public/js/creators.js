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

// Binary body (not multipart): only the photo endpoint accepts this CSRF header.
document.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-photo-upload]');
  if (!form) return;
  event.preventDefault();
  const panel = form.closest('.pc-photo-editor');
  const status = panel.querySelector('.pc-photo-status');
  const file = form.querySelector('input[type=file]').files[0];
  const button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { status.textContent = 'Choose a still JPG, PNG or WebP image.'; return; }
  if (file.size > 5 * 1024 * 1024) { status.textContent = 'Photo exceeds 5 MB. Choose a smaller image.'; return; }
  button.disabled = true;
  status.textContent = 'Uploading and preparing your private photo…';
  try {
    const response = await fetch(form.action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type, 'X-CSRF-Token': form.dataset.csrf }, body: file });
    if (!response.ok) {
      const errors = { 400: 'Image could not be read. Choose a still JPG, PNG or WebP under 16 megapixels.', 403: 'Your admin session or form expired. Reload the page and sign in again.', 404: 'Partner not found. Reload the page.', 413: 'Photo exceeds 5 MB. Choose a smaller image.', 415: 'Choose a JPG, PNG or WebP image.', 429: 'Photo upload is busy or the upload limit was reached. Try again later.' };
      throw new Error(errors[response.status] || 'Photo could not be saved. Please try again.');
    }
    const result = await response.json();
    if (!/^\/creator\/photos\/[a-zA-Z0-9_-]{1,128}\/[a-f0-9]{64}\.jpg$/.test(result.profile_image)) throw new Error('Photo response was unexpected. Reload the page to check.');
    status.textContent = 'Photo saved. Refreshing your partner account…';
    window.location.reload();
  } catch (error) {
    status.textContent = error instanceof TypeError ? 'Upload interrupted. Check your connection and try again.' : error.message;
    button.disabled = false;
  }
});
