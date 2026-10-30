/* Patra-only, non-destructive family frame and soft Maps feedback. */
(function () {
  'use strict';
  window.PaigaamFamilyEditor = function (form, controls) {
    var host = form.querySelector('[data-image="familyPhoto"]');
    var link = form.querySelector('#f-familyMapsLink');
    if (!host || !link || !window.PaigaamFamilyMaps) return;
    var section = host.closest('.step');
    if (section) section.classList.add('bf-family-editor');
    var thumb = host.querySelector('.bf-photo__thumb');
    var image = host.querySelector('img');
    if (thumb) {
      thumb.classList.add('bf-family-frame');
      thumb.setAttribute('aria-label', 'Tap the family photo frame to choose or replace your photo');
    }
    var empty = host.querySelector('.bf-photo__empty');
    if (empty) empty.textContent = 'Tap to choose your family photo';
    // Match the guest frame: the image crops inside its own window, never over the gold/red border.
    if (thumb && image) {
      var viewport = document.createElement('div');
      viewport.className = 'bf-family-photo-window';
      viewport.appendChild(image);
      if (empty) viewport.appendChild(empty);
      thumb.appendChild(viewport);
    }
    var zoom = form.querySelector('#f-familyPhotoZoom');
    var x = form.querySelector('#f-familyPhotoX');
    var y = form.querySelector('#f-familyPhotoY');
    function bounded(input, fallback, min, max) {
      var value = input && input.value !== '' ? Number(input.value) : fallback;
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    }
    function paintFrame() {
      if (!image) return;
      var px = bounded(x, 50, 0, 100), py = bounded(y, 50, 0, 100);
      image.style.objectPosition = px + '% ' + py + '%';
      image.style.transformOrigin = px + '% ' + py + '%';
      image.style.transform = 'scale(' + bounded(zoom, 100, 100, 250) / 100 + ')';
    }
    var status = document.createElement('p');
    status.className = 'hint bf-family-map-status';
    status.id = 'f-familyMapsLink-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    link.parentNode.appendChild(status);
    var described = link.getAttribute('aria-describedby');
    link.setAttribute('aria-describedby', (described ? described + ' ' : '') + status.id);
    function paintMap() {
      var state = window.PaigaamFamilyMaps.familyMapState(link.value);
      status.textContent = state.message;
      status.hidden = !state.invalid;
      // This is advisory, not a constraint validation error or navigation target.
    }
    [zoom, x, y].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', paintFrame);
      input.addEventListener('change', paintFrame);
    });
    link.addEventListener('input', paintMap);
    link.addEventListener('change', paintMap);
    // Restore/draft adoption uses control.set(), not DOM input events.
    ['familyPhotoZoom', 'familyPhotoX', 'familyPhotoY', 'familyMapsLink'].forEach(function (id) {
      var control = controls[id];
      if (!control) return;
      var set = control.set;
      control.set = function (value) { set(value); paintFrame(); paintMap(); };
    });
    paintFrame(); paintMap();
  };
})();
