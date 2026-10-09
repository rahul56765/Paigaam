# Paigaam wedding invitation films

A fixed, template-driven animated wedding invitation (1080×1920, 30fps, H.264) with a customer
editor, live preview and server-side rendering. Customers change words, events, scene order
and music only. The four hand-painted story scenes (`public/stories/`) were produced once
at template-build time with an original cast; there is no per-customer AI generation and no API key.

```
wedding-video/
  src/                 Remotion composition (shared by the editor preview and the renderer)
    lib/schema.js      data model, the reference sample, normalize()/validate()
    lib/timeline.js    scene list + transition plan; durations follow the data
    lib/transitions.js per-transition exit/enter styles and entrance plans
    lib/themes.js      event themes, presets, landmarks, prop sets
    lib/i18n.js        fonts and template words per language/script
    scenes/            Opener, MainCard, EventCard, StoryClip, Closing (+ EndScene)
  editor/              React editor (form + @remotion/player), built to dist/editor.js
  scripts/
    render-lib.mjs     Chrome frames (renderFrames) -> system ffmpeg H.264 + music mix
    render-job.mjs     child-process entry used by the Paigaam server
    render.mjs         CLI: node scripts/render.mjs --sample [--landscape] [--ref-audio]
    stills.mjs         QA stills: node scripts/stills.mjs 9 17 26
    compare.py         side-by-side QA sheet vs the reference recording
  public/              art, fonts, brand (generated from assets/wedding-video by
                       scripts/prepare-wedding-video.js), music/library.json
  tests/timeline.test.js
```

Server side lives in `lib/weddingVideoRoutes.js` and `lib/weddingVideo/` (store, jobs).

To add or replace a story scene: paint a 9:16 keyframe, animate it to an 8s clip, encode to
900×1600 H.264 (CRF 24) as `public/stories/storyN.mp4` + a poster `.jpg`, register it in
`STORY_LIBRARY` (src/lib/themes.js), then run `node scripts/pack-wedding-video-assets.js`.

## Routes
- `/wedding-video` editor · `/w/:id` share page (film, MP4 downloads, RSVP + wishes)
- `POST /api/wedding-video/invites` · `GET|PUT /api/wedding-video/invites/:id` (owner cookie)
- `POST /api/wedding-video/invites/:id/media?kind=music` (raw body, magic-byte sniffed)
- `POST /api/wedding-video/invites/:id/render {format:'9x16'|'16x9'}` → job · `GET /api/wedding-video/jobs/:id`
- `POST /api/wedding-video/w/:id/rsvp` · `GET /api/wedding-video/invites/:id/rsvps(.csv)` (owner)

## Environment (names only)
| Variable | Purpose |
|---|---|
| `WEDDING_RENDER_CONCURRENCY` | Chrome tabs per render (default = CPUs, max 4) |
| `WEDDING_X264_PRESET` | default `slow` (CRF 16, High profile) |
| `DATA_DIR` | must be a persistent volume on Railway: invites, uploads, clips and renders live under `DATA_DIR/wedding-video` |

## Setup
```
npm ci && npm run wedding-video:setup     # deps, editor bundle, headless Chrome
node --test wedding-video/tests/timeline.test.js && node --test tests/wedding-video.test.js
WV_RENDER_TEST=1 node --test tests/wedding-video.test.js   # adds a real MP4 render (~5 min)
```
Railway: `nixpacks.toml` installs Chrome's shared libraries, builds the editor and fetches the
headless shell. A 92s film takes ~11 min on 2 vCPU; renders run one at a time in a child process.

## Licences to confirm before launch
- **Remotion**: free for individuals and companies of up to 3 people; larger companies need a company licence.
- **Music**: the library ships empty. Add only tracks you hold a licence for (`public/music/*.mp3` + `library.json`).
- Template art, fonts (OFL: Italiana, Bellefair, Josefin Sans, Pinyon Script, Noto) and code are Paigaam's own.

## Fidelity note: what could not be matched exactly
See `FIDELITY.md`.
