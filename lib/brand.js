'use strict';
/**
 * Official Paigaam brand marks (real logo, cropped from the supplied asset).
 * Use these everywhere instead of the hand-drawn SVG dove.
 *
 * Assets (in /public/brand/):
 *   logo-full.png / logo-full@2x.png  — PAIGAAM wordmark + dove (horizontal)
 *   dove.png / dove@2x.png            — the dove carrying an envelope (mark)
 *   favicon-512.png                   — dove on ivory square (app icon)
 *
 * The PNGs have transparent backgrounds (ivory bg removed 2026-09-06), so
 * they blend on ANY surface. public/brand/*.png are boot-restored placeholders;
 * the real bytes live base64-embedded in lib/brand-assets.js (ensureBrandAssets
 * writes them at boot — binaries can't survive text-only git APIs).
 */

/** Full lockup (wordmark + dove). width sets the rendered width in px. */
function logoFull(width = 150, alt = 'Paigaam') {
  const h = Math.round(width / 2); // lockup aspect ~2:1
  return `<img src="/brand/logo-full.png" srcset="/brand/logo-full@2x.png 2x" width="${width}" height="${h}" alt="${alt}" style="display:block;height:auto" loading="lazy" decoding="async">`;
}

/** Dove mark only. width sets the rendered width in px. */
function doveMark(width = 90, alt = "Paigaam dove carrying an envelope") {
  const h = Math.round(width * 0.645); // dove aspect ~1.55:1
  return `<img src="/brand/dove.png" srcset="/brand/dove@2x.png 2x" width="${width}" height="${h}" alt="${alt}" style="display:block;height:auto" loading="lazy" decoding="async">`;
}

module.exports = { logoFull, doveMark };
