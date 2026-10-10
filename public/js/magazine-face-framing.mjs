import { getFaces } from './magazine-face-worker-client.mjs?v=3';
import { faceCropRect } from './magazine-face-geometry.mjs?v=3';

export { faceCropRect };

function loadBitmap(file) {
  if (typeof createImageBitmap !== 'function') return Promise.reject(new Error('image_decode_unavailable'));
  return createImageBitmap(file);
}

function detectFaces(bitmap) {
  return getFaces(bitmap).catch(() => []);
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function fillCanvas(canvas, bitmap, aspect, faces) {
  const longest = 1600;
  const width = Math.round(aspect >= 1 ? longest : longest * aspect);
  const height = Math.round(aspect >= 1 ? longest / aspect : longest);
  canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return false;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  const crop = faceCropRect(faces, bitmap.width, bitmap.height, aspect);
  if (crop) {
    ctx.drawImage(bitmap, crop.left, crop.top, crop.width, crop.height, 0, 0, width, height);
    return true;
  }
  // Extreme aspect ratios or groups of faces that cannot fit together: keep every face visible.
  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale, drawHeight = bitmap.height * scale;
  ctx.save(); ctx.filter = 'blur(20px)';
  const cover = Math.max(width / bitmap.width, height / bitmap.height);
  const coverWidth = bitmap.width * cover, coverHeight = bitmap.height * cover;
  ctx.drawImage(bitmap, (width - coverWidth) / 2, (height - coverHeight) / 2, coverWidth, coverHeight);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return true;
}

/** Return a face-centered image blob, or the original file unchanged on any detector/canvas failure. */
export async function framePhoto(file, aspect, maxBytes) {
  let bitmap;
  try {
    bitmap = await loadBitmap(file);
    const faces = await detectFaces(bitmap);
    if (!faces.length) return file;
    const canvas = document.createElement('canvas');
    if (!fillCanvas(canvas, bitmap, Number(aspect) || 1, faces)) return file;
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';
    const blob = await canvasBlob(canvas, type, type === 'image/png' ? undefined : 0.92);
    if (!blob || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > maxBytes) return file;
    return blob;
  } catch {
    return file;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}

export function previewAspect(aspect) {
  const value = Number(aspect);
  return Number.isFinite(value) && value > 0.35 && value < 3 ? value : 1;
}
