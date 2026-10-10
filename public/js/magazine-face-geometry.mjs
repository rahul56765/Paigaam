const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Find a target-ratio crop around all detected faces. Returns null when the faces
 * cannot fit without clipping, allowing the caller to use a contain composition.
 */
export function faceCropRect(faces, imageWidth, imageHeight, aspect, padding = 1.8) {
  if (!Array.isArray(faces) || !faces.length || !(imageWidth > 0) || !(imageHeight > 0) || !(aspect > 0)) return null;
  const boxes = faces.filter((f) => f && [f.x, f.y, f.width, f.height].every(Number.isFinite) && f.width > 0 && f.height > 0);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((f) => f.x));
  const top = Math.min(...boxes.map((f) => f.y));
  const right = Math.max(...boxes.map((f) => f.x + f.width));
  const bottom = Math.max(...boxes.map((f) => f.y + f.height));
  const groupWidth = right - left, groupHeight = bottom - top;
  const wantedWidth = Math.max(groupWidth * padding, groupHeight * padding * aspect);
  const maxWidth = Math.min(imageWidth, imageHeight * aspect);
  if (wantedWidth > maxWidth + 0.5) return null;
  const cropWidth = Math.min(wantedWidth, maxWidth), cropHeight = cropWidth / aspect;
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  return {
    left: clamp(cx - cropWidth / 2, 0, imageWidth - cropWidth),
    top: clamp(cy - cropHeight / 2, 0, imageHeight - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}
