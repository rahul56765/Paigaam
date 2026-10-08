'use strict';
/**
 * Personalised story clips: customer photo -> painted keyframe (Gemini image model)
 * -> 5-8s image-to-video clip (Veo 3.1). Uses the Gemini API REST surface directly.
 * Env (names only): GEMINI_API_KEY (required), WEDDING_IMAGE_MODEL, WEDDING_VEO_MODEL,
 *   WEDDING_VEO_RESOLUTION (720p|1080p), GEMINI_API_BASE (tests only).
 */
const API = () => (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const KEY = () => process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = () => process.env.WEDDING_IMAGE_MODEL || 'gemini-nano-banana-2.1';
const VEO_MODEL = () => process.env.WEDDING_VEO_MODEL || 'veo-3.1-generate-preview';
const POLL_MS = () => Number(process.env.WEDDING_VEO_POLL_MS || 10000);
const TIMEOUT_MS = () => Number(process.env.WEDDING_VEO_TIMEOUT_MS || 8 * 60 * 1000);

const configured = () => !!KEY();

// Style direction: describe the look, never a specific studio, film or character.
const STYLE = [
  'Repaint this photograph as an original hand-painted illustration for a luxury Indian wedding invitation film.',
  'Look: soft anime-inspired watercolour and gouache, painterly brush texture, delicate linework only where needed,',
  'warm natural golden-hour light, gentle atmospheric depth, a calm romantic mood, rich but soft colour.',
  'Keep every person exactly recognisable: same face shape and features, same skin tone, same hairstyle,',
  'same outfit, colours, jewellery and patterns, same pose and number of people. Do not beautify or change ethnicity or age.',
  'Simplify the background into a painted version of the same place. Vertical 9:16 framing with headroom.',
  'No text, no letters, no borders, no frames, no watermarks. Not in the style of any specific studio, film or artist.',
].join(' ');

const MOTION = [
  'A gentle cinematic moment from a hand-painted wedding invitation film.',
  'Slow parallax camera push-in, subtle natural motion only: hair and fabric moving softly in a breeze,',
  'leaves and a few flower petals drifting across the frame, warm light flickering softly.',
  'The people stay perfectly consistent and recognisable in every frame; no morphing, no flicker, no new people,',
  'no text. Preserve the painterly watercolour look throughout. Soft ambient sound only.',
].join(' ');

async function call(url, body, { method = 'POST' } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'x-goog-api-key': KEY(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  if (!res.ok) {
    const msg = (json && json.error && json.error.message) || text.slice(0, 300);
    const err = new Error(`gemini_http_${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Photo -> painted keyframe. Returns { mime, buffer }. */
async function paintKeyframe({ photo, photoMime, caption, extraPrompt }) {
  const prompt = [STYLE, caption ? `The moment: ${caption}.` : '', extraPrompt ? `Additional direction: ${extraPrompt}` : ''].filter(Boolean).join(' ');
  const out = await call(`${API()}/models/${IMAGE_MODEL()}:generateContent`, {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: photoMime, data: photo.toString('base64') } }, { text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
  });
  const parts = (((out || {}).candidates || [])[0] || {}).content?.parts || [];
  const img = parts.find((p) => p.inlineData && p.inlineData.data);
  if (!img) {
    const reason = (((out || {}).candidates || [])[0] || {}).finishReason || (out && out.promptFeedback && out.promptFeedback.blockReason) || 'no_image';
    throw new Error(`keyframe_failed: ${reason}`);
  }
  return { mime: img.inlineData.mimeType || 'image/png', buffer: Buffer.from(img.inlineData.data, 'base64') };
}

/** Keyframe -> clip. Returns mp4 Buffer. */
async function animate({ keyframe, keyframeMime, caption, extraPrompt, onProgress }) {
  const prompt = [MOTION, caption ? `Scene: ${caption}.` : '', extraPrompt ? `Direction: ${extraPrompt}` : ''].filter(Boolean).join(' ');
  const res = (process.env.WEDDING_VEO_RESOLUTION === '1080p') ? '1080p' : '720p';
  const op = await call(`${API()}/models/${VEO_MODEL()}:predictLongRunning`, {
    instances: [{ prompt, image: { bytesBase64Encoded: keyframe.toString('base64'), mimeType: keyframeMime } }],
    parameters: { aspectRatio: '9:16', durationSeconds: 8, resolution: res, sampleCount: 1 },
  });
  if (!op || !op.name) throw new Error('veo_no_operation');
  const started = Date.now();
  let status = op;
  while (!status.done) {
    if (Date.now() - started > TIMEOUT_MS()) throw new Error('veo_timeout');
    await new Promise((r) => setTimeout(r, POLL_MS()));
    status = await call(`${API()}/${op.name}`, null, { method: 'GET' });
    onProgress && onProgress(Math.min(0.95, (Date.now() - started) / (90 * 1000)));
  }
  if (status.error) throw new Error(`veo_failed: ${status.error.message || 'unknown'}`);
  const sample = status.response?.generateVideoResponse?.generatedSamples?.[0];
  const uri = sample?.video?.uri;
  if (!uri) {
    const filtered = status.response?.generateVideoResponse?.raiMediaFilteredReasons;
    throw new Error(`veo_no_video${filtered ? ': ' + [].concat(filtered).join('; ') : ''}`);
  }
  const vid = await fetch(uri, { headers: { 'x-goog-api-key': KEY() }, redirect: 'follow' });
  if (!vid.ok) throw new Error(`veo_download_${vid.status}`);
  return Buffer.from(await vid.arrayBuffer());
}

module.exports = { configured, paintKeyframe, animate, STYLE, MOTION };
