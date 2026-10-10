import { FaceDetector, FilesetResolver } from '/vendor/mediapipe/vision_bundle.mjs';

let detector;
async function getDetector() {
  if (!detector) {
    const vision = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
    detector = await FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/vendor/mediapipe/models/blaze_face_full_range_sparse.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.55,
      minSuppressionThreshold: 0.3,
    });
  }
  return detector;
}

self.addEventListener('message', async (event) => {
  const { id, bitmap } = event.data || {};
  if (!Number.isSafeInteger(id) || !bitmap) return;
  try {
    const result = await (await getDetector()).detect(bitmap);
    const faces = (result.detections || []).filter((d) => {
      const score = d.categories && d.categories[0] && d.categories[0].score;
      return Number.isFinite(score) && score >= 0.55 && d.boundingBox;
    }).map((d) => ({
      x: d.boundingBox.originX,
      y: d.boundingBox.originY,
      width: d.boundingBox.width,
      height: d.boundingBox.height,
    }));
    self.postMessage({ id, faces });
  } catch {
    self.postMessage({ id, error: 'detection_failed' });
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close();
  }
});
