/* Multi-page magazine PDF reader. Pages are fetched/rendered lazily from the owner's final PDF. */
import * as pdfjsLib from '/vendor/pdfjs/pdf.min.mjs';

const root = document.getElementById('magReader');
if (root) {
  const stage = document.getElementById('magReaderStage');
  const sheet = document.getElementById('magReaderSheet');
  const canvas = document.getElementById('magReaderCanvas');
  const status = document.getElementById('magReaderStatus');
  const totalEl = document.getElementById('magReaderTotal');
  const count = document.getElementById('magReaderCount');
  const prev = document.getElementById('magReaderPrev');
  const next = document.getElementById('magReaderNext');
  const err = document.getElementById('magReaderError');
  const ctx = canvas.getContext('2d', { alpha: false });
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

  let pdf = null, pageNo = 1, drawSeq = 0, renderTask = null, turnSeq = 0;
  let downX = null, downY = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateControls() {
    count.textContent = pdf ? `${pageNo} / ${pdf.numPages}` : '— / —';
    totalEl.textContent = pdf ? `${pdf.numPages} pages` : 'Loading…';
    prev.disabled = !pdf || pageNo <= 1;
    next.disabled = !pdf || pageNo >= pdf.numPages;
    canvas.setAttribute('aria-label', pdf ? `Page ${pageNo} of ${pdf.numPages}` : 'Magazine page');
  }

  async function renderPage(number) {
    if (!pdf || number < 1 || number > pdf.numPages) return;
    const seq = ++drawSeq;
    try {
      if (renderTask) { try { renderTask.cancel(); } catch {} renderTask = null; }
      status.hidden = false;
      status.textContent = `Turning to page ${number}…`;
      const page = await pdf.getPage(number);
      if (seq !== drawSeq) return;
      const base = page.getViewport({ scale: 1 });
      const pad = 24;
      const scale = Math.min((stage.clientWidth - pad) / base.width, (stage.clientHeight - pad) / base.height, 1.8);
      const viewport = page.getViewport({ scale: Math.max(0.1, scale) });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * outputScale);
      canvas.height = Math.ceil(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      sheet.style.width = `${Math.floor(viewport.width)}px`;
      sheet.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = page.render({ canvasContext: ctx, viewport, transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0], background: '#ffffff' });
      await renderTask.promise;
      if (seq !== drawSeq) return;
      renderTask = null;
      status.hidden = true;
      updateControls();
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      fail();
    }
  }

  function turn(delta) {
    if (!pdf) return;
    const target = Math.max(1, Math.min(pdf.numPages, pageNo + delta));
    if (target === pageNo) return;
    pageNo = target;
    updateControls();
    if (!reduced) {
      const cls = delta > 0 ? 'turn-next' : 'turn-prev';
      sheet.classList.remove('turn-next', 'turn-prev');
      // Force style recalc to restart the brief curl/shadow motion.
      void sheet.offsetWidth;
      sheet.classList.add(cls);
      const seq = ++turnSeq;
      sheet.addEventListener('animationend', () => { if (seq === turnSeq) sheet.classList.remove(cls); }, { once: true });
    }
    renderPage(pageNo);
  }

  function fail() {
    status.hidden = true;
    err.hidden = false;
    totalEl.textContent = 'Preview unavailable';
    prev.disabled = true;
    next.disabled = true;
  }

  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  document.addEventListener('keydown', (e) => {
    if (!root.isConnected || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
  });
  stage.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; }, { passive: true });
  stage.addEventListener('pointerup', (e) => {
    if (downX == null) return;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    downX = downY = null;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.2) turn(dx < 0 ? 1 : -1);
  }, { passive: true });
  stage.addEventListener('pointercancel', () => { downX = downY = null; }, { passive: true });
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => renderPage(pageNo), 140); }, { passive: true });

  pdfjsLib.getDocument({ url: root.dataset.pdf, withCredentials: true }).promise.then((doc) => {
    pdf = doc;
    updateControls();
    return renderPage(1);
  }).catch(fail);
}
