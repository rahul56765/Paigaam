# Vivah — Paigaam wedding invitation film

An independent second animated wedding-film template for Paigaam, built on the same Remotion 4 / React 19 render pipeline as the original wedding film but with its own editor route, tables, cookie, media directory and template assets.

## Film flow

1. Original watercolor Ganesha opening clip.
2. Logo reveal: one fixed-size frame uses a customer transparent PNG or falls back to the couple’s initials in elegant script.
3. Family invitation and couple card.
4. Editable event cards interleaved with fixed original Jaipur wedding clips.
5. Closing invitation card with an optional uploaded QR PNG.
6. Paigaam end card.

The sample is Meera and Arjun, with the Sharma and Verma families and a fictional venue in Jaipur. The template starts in ivory, dusty rose, sage and gold; customers may switch to deep maroon and antique gold. It ships without music. Customers may upload an MP3 or an MP4 that contains audio; MP4 video is ignored and only its first audio stream is mixed into the render.

## Output and runtime

- Main output: 1080×1920, 30fps H.264, optimized for phones.
- Landscape option: the same vertical film centred in 16:9.
- Customer-editable: names, family details, events, timing, colourway, logo, QR and customer-provided audio.
- Story art and clips are fixed template assets, created once; there are no per-customer AI calls or runtime AI credentials.
- Entrypoint: `/vivah-video`; API prefix: `/api/vivah-video`; share pages use `/v/:id`.
- Uploaded media is stored under `DATA_DIR/vivah-video`; SQLite tables use the `vv_` prefix and the owner cookie is `paigaam_vv`.

## Setup

```
npm --prefix vivah-video ci
npm --prefix vivah-video run build:editor
(cd vivah-video && npx remotion browser ensure)
node --test vivah-video/tests/timeline.test.js
node --test tests/vivah-video.test.js
```

Assets are checksum-verified base64 chunks in `assets/vivah-video` for the text-only GitHub integration. Run `node scripts/pack-vivah-video-assets.js` after changing `vivah-video/public`; `node scripts/prepare-vivah-video.js` decodes them at install/build time.

See `FIDELITY.md` for the reference mapping and known differences.
