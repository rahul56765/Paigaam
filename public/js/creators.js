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

// Admin-only controls apply solely to newly entered initial/reset passwords.
function maskAdminPasswords() {
  document.querySelectorAll('[data-password-toggle]').forEach(button => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    input.type = 'password';
    button.textContent = 'Show'; button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/^Hide/, 'Show'));
  });
}
document.querySelectorAll('[data-password-toggle]').forEach(button => {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', button.getAttribute('aria-label').replace(/^(Show|Hide)/, show ? 'Hide' : 'Show'));
  });
  input.addEventListener('blur', maskAdminPasswords);
  button.addEventListener('blur', maskAdminPasswords);
});
window.addEventListener('blur', maskAdminPasswords);
window.addEventListener('pagehide', maskAdminPasswords);

// Settings use the native POST/303 flow, with the same double-submit guard.
document.querySelectorAll('form:not([data-creator-onboarding])').forEach(form => {
  if (!form.querySelector('[data-password-toggle]')) return;
  const submit = form.querySelector('button[type=submit]');
  let submitting = false;
  form.addEventListener('submit', event => {
    if (submitting) { event.preventDefault(); return; }
    submitting = true; submit.disabled = true; maskAdminPasswords();
  });
  window.addEventListener('pageshow', () => { submitting = false; submit.disabled = false; });
});

const onboarding = document.querySelector('form[data-creator-onboarding]');
if (onboarding) {
  const picker = onboarding.querySelector('[name=photo]');
  const preview = onboarding.querySelector('[data-photo-preview]');
  const clear = onboarding.querySelector('[data-clear-photo]');
  const selection = onboarding.querySelector('[data-photo-selection]');
  const status = onboarding.querySelector('[data-onboarding-status]');
  const submit = onboarding.querySelector('button[type=submit]');
  let previewUrl;
  let pending = false;
  function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined; preview.removeAttribute('src'); preview.hidden = true;
  }
  function photoError(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a still JPG, PNG or WebP image.';
    if (file.size > 5 * 1024 * 1024) return 'Photo exceeds 5 MB. Choose a smaller image.';
    return '';
  }
  picker.addEventListener('change', () => {
    revokePreview();
    const file = picker.files[0];
    clear.hidden = !file;
    selection.textContent = file ? photoError(file) || 'Photo selected. It will be uploaded when you create the partner.' : '';
    if (file && !photoError(file)) {
      previewUrl = URL.createObjectURL(file); preview.src = previewUrl; preview.hidden = false;
    }
  });
  clear.addEventListener('click', () => { picker.value = ''; picker.dispatchEvent(new Event('change')); });
  window.addEventListener('pagehide', revokePreview);
  // No-photo and no-JS submissions retain the ordinary server 303 flow.
  onboarding.addEventListener('submit', async event => {
    const file = picker.files[0];
    if (pending) { event.preventDefault(); return; }
    if (!file) { pending = true; submit.disabled = true; maskAdminPasswords(); return; }
    event.preventDefault();
    const invalid = photoError(file);
    if (invalid) { selection.textContent = invalid; picker.focus(); return; }
    pending = true; submit.disabled = true; maskAdminPasswords();
    status.textContent = 'Creating the partner account…';
    const fields = new URLSearchParams();
    for (const [key, value] of new FormData(onboarding)) if (typeof value === 'string') fields.append(key, value);
    const csrf = fields.get('csrf');
    let result;
    try {
      const response = await fetch(onboarding.action, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: fields });
      // Clear entered plaintext as soon as account creation is confirmed.
      if (response.status === 201) onboarding.querySelector('[name=password]').value = '';
      fields.delete('password');
      if (!response.ok) {
        let message = 'Account was not created. Check your entries, or reload if your admin session expired.';
        if (response.headers.get('content-type')?.includes('application/json')) {
          const rejected = await response.json();
          if (typeof rejected.error === 'string') message = rejected.error;
        }
        status.textContent = message;
        pending = false; submit.disabled = false; return;
      }
      result = await response.json();
      const id = typeof result.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(result.id) ? result.id : '';
      if (response.status !== 201 || !id || result.url !== `/admin/creators/${id}?saved=1` || result.photo_upload_url !== `/admin/creators/${id}/photo`) throw new Error('Unexpected response');
    } catch {
      fields.delete('password');
      onboarding.querySelector('[name=password]').value = '';
      status.textContent = 'Creation outcome is uncertain: the connection or response was interrupted. Do not submit again. Check existing partners before creating another account. ';
      const link = document.createElement('a'); link.href = '/admin/creators'; link.textContent = 'Check existing partners'; status.append(link);
      return; // Never retry a possibly persisted account POST.
    }
    status.textContent = 'Partner account created. Uploading the private profile photo…';
    try {
      const uploaded = await fetch(result.photo_upload_url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type, 'X-CSRF-Token': csrf }, body: file });
      if (!uploaded.ok) throw new Error('Photo not confirmed');
      const photo = await uploaded.json();
      if (!new RegExp(`^/creator/photos/${result.id}/[a-f0-9]{64}\\.jpg$`).test(photo.profile_image)) throw new Error('Photo response unexpected');
      window.location.assign(result.url);
    } catch {
      status.textContent = 'Partner account created, but the photo could not be confirmed. Opening the saved account; do not create it again.';
      window.location.assign(result.url + '&photo=failed#profile-photo');
    }
  });
  window.addEventListener('pageshow', () => {
    // A restored native form is editable again; never unlock uncertain AJAX outcomes.
    if (!picker.files.length) { pending = false; submit.disabled = false; }
  });
}
