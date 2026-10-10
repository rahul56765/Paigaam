let worker;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./magazine-face-detector-worker.js', import.meta.url));
    worker.addEventListener('message', (event) => {
      const { id, faces, error } = event.data || {};
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(new Error(error)); else request.resolve(faces || []);
    });
    worker.addEventListener('error', () => {
      const current = worker; worker = null;
      if (current) current.terminate();
      for (const request of pending.values()) request.reject(new Error('detector_unavailable'));
      pending.clear();
    });
  }
  return worker;
}

/** Detection only; no face embeddings, labels, or identity recognition are computed. */
export async function getFaces(image) {
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const bitmap = await createImageBitmap(image, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
  const factor = 1 / scale;
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (faces) => resolve(faces.map((f) => ({ x: f.x * factor, y: f.y * factor, width: f.width * factor, height: f.height * factor }))), reject });
    try { getWorker().postMessage({ id, bitmap }, [bitmap]); }
    catch (error) { pending.delete(id); bitmap.close(); reject(error); }
  });
}
