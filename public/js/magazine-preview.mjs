/* Multi-page magazine PDF reader. Pages are fetched lazily from the finished PDF and turned as a layered paper leaf. */
import * as pdfjsLib from '/vendor/pdfjs/pdf.min.mjs';

const root = document.getElementById('magReader');
if (root) {
  const stage = document.getElementById('magReaderStage');
  const surface = document.getElementById('magReaderCanvas');
  const leaf = document.getElementById('magReaderLeaf');
  const front = document.getElementById('magReaderFront');
  const back = document.getElementById('magReaderBack');
  const status = document.getElementById('magReaderStatus');
  const totalEl = document.getElementById('magReaderTotal');
  const count = document.getElementById('magReaderCount');
  const prev = document.getElementById('magReaderPrev');
  const next = document.getElementById('magReaderNext');
  const err = document.getElementById('magReaderError');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

  let pdf = null, pageNo = 1, turning = false, unavailable = false, downX = null, downY = null;
  let resizeTimer = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TURN_MS = reduced ? 0 : 940;

  function sizeCanvas(source, target) {
    target.width = source.width;
    target.height = source.height;
    target.style.width = source.style.width;
    target.style.height = source.style.height;
    const ctx = target.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0);
  }

  function drawLeafFace(source, target, frameW, frameH) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const sourceW = parseFloat(source.style.width) || frameW;
    const sourceH = parseFloat(source.style.height) || frameH;
    const fit = Math.min(frameW / sourceW, frameH / sourceH);
    const w = sourceW * fit, h = sourceH * fit;
    target.width = Math.ceil(frameW * ratio);
    target.height = Math.ceil(frameH * ratio);
    target.style.width = `${frameW}px`;
    target.style.height = `${frameH}px`;
    const ctx = target.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(source, (frameW - w) * ratio / 2, (frameH - h) * ratio / 2, w * ratio, h * ratio);
  }

  function prepareLeaf(current, target) {
    const currentW = parseFloat(current.style.width) || stage.clientWidth;
    const currentH = parseFloat(current.style.height) || stage.clientHeight;
    const targetW = parseFloat(target.style.width) || currentW;
    const targetH = parseFloat(target.style.height) || currentH;
    const frameW = Math.max(currentW, targetW);
    const frameH = Math.max(currentH, targetH);
    leaf.style.width = `${frameW}px`;
    leaf.style.height = `${frameH}px`;
    drawLeafFace(current, front, frameW, frameH);
    drawLeafFace(target, back, frameW, frameH);
  }

  function updateControls() {
    count.textContent = pdf ? `${pageNo} / ${pdf.numPages}` : '— / —';
    totalEl.textContent = pdf ? `${pdf.numPages} pages` : 'Loading…';
    prev.disabled = !pdf || unavailable || pageNo <= 1 || turning;
    next.disabled = !pdf || unavailable || pageNo >= pdf.numPages || turning;
    surface.setAttribute('aria-label', pdf ? `Page ${pageNo} of ${pdf.numPages}` : 'Magazine page');
  }

  async function renderToCanvas(number) {
    const page = await pdf.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const pad = 24;
    const scale = Math.min((stage.clientWidth - pad) / base.width, (stage.clientHeight - pad) / base.height, 1.8);
    const viewport = page.getViewport({ scale: Math.max(0.1, scale) });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: ctx,
      viewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      background: '#ffffff',
    }).promise;
    return canvas;
  }

  async function renderPage(number) {
    if (!pdf || turning || number < 1 || number > pdf.numPages) return;
    try {
      status.hidden = false;
      status.textContent = `Opening page ${number}…`;
      const rendered = await renderToCanvas(number);
      sizeCanvas(rendered, surface);
      leaf.style.width = rendered.style.width;
      leaf.style.height = rendered.style.height;
      status.hidden = true;
      updateControls();
    } catch (e) {
      fail();
    }
  }

  function waitForTurn() {
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        leaf.removeEventListener('animationend', done);
        resolve();
      };
      const timer = setTimeout(done, TURN_MS + 120);
      leaf.addEventListener('animationend', done, { once: true });
    });
  }

  async function turn(delta) {
    if (!pdf || unavailable || turning) return;
    const targetPage = Math.max(1, Math.min(pdf.numPages, pageNo + delta));
    if (targetPage === pageNo) return;
    turning = true;
    updateControls();
    status.hidden = false;
    status.textContent = `Turning to page ${targetPage}…`;
    try {
      // Prepare the back of the turning leaf and the page underneath before the animation starts.
      const target = await renderToCanvas(targetPage);
      prepareLeaf(surface, target);
      sizeCanvas(target, surface);
      leaf.classList.remove('turn-next', 'turn-prev', 'is-turning');
      if (reduced) {
        pageNo = targetPage;
      } else {
        leaf.classList.add('is-turning');
        void leaf.offsetWidth;
        leaf.classList.add(delta > 0 ? 'turn-next' : 'turn-prev');
        await waitForTurn();
        pageNo = targetPage;
      }
      leaf.classList.remove('turn-next', 'turn-prev', 'is-turning');
      status.hidden = true;
    } catch (e) {
      fail();
    } finally {
      turning = false;
      updateControls();
    }
  }

  function fail() {
    unavailable = true;
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
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderPage(pageNo), 160);
  }, { passive: true });

  pdfjsLib.getDocument({ url: root.dataset.pdf, withCredentials: true }).promise.then((doc) => {
    pdf = doc;
    updateControls();
    return renderPage(1);
  }).catch(fail);
}
