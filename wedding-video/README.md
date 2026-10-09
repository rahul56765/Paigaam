# Paigaam wedding invitation films

> **Maintenance rule.** This README is the source of truth for the wedding video feature.
> Any change to code, config, deployment, env vars, routes, scenes, tests or known issues must update
> this file in the same PR. Each entry in the *Changelog* says what changed and why. Read this file
> before changing the feature.

## Status (keep current)

| Item | State |
|---|---|
| Live | https://paigaam.cc/wedding-video (editor) · `/w/:id` (share page) |
| Production deploy | Railway project `paigaam`, service `paigaam-web`, auto-deploys from `main` |
| Last verified | 2026-10-10 on production: a 31.6 s 9:16 render completed, 1080×1920 H.264, 30 fps, 66 MB |
| Story scenes | 4 fixed hand-painted clips, in `public/stories/` (no per-customer AI) |
| Render speed | ≈ 9–10 min for the 31.6 s test film on Railway. A full 92 s film is estimated at 25–30 min. Not yet measured on production |
| Open items | see *Known issues* |

## What it is

A fixed, template-driven animated wedding invitation (1080×1920, 30 fps, H.264). The reference
edit is 92.03 s long, with every cut point and transition matched (`FIDELITY.md` lists what differs).

Customers change words, events, the order of story scenes, and music. Everything else (cards,
artwork, motion, timing) is fixed. The four story scenes were painted once, with an original cast,
during template build. Nothing is generated per customer, and there is no AI API key at runtime.

## Layout

```
wedding-video/
  src/                   Remotion composition (shared by the editor preview and the renderer)
    lib/schema.js        data model, SAMPLE (the reference text), normalize(), validate()
    lib/timeline.js      scene list and transition plan; durations follow the data (FPS = 30)
    lib/transitions.js   exit/enter styles per transition, entrance plans
    lib/themes.js        event themes, presets, landmarks, prop sets, STORY_LIBRARY
    lib/anim.js          easing and camera helpers (cameraInto, growFrom, prog, seg)
    lib/i18n.js          fonts and template words per script; month names
    components/core.jsx  StampFrame, FitText, WriteOn, FadeUp, PopIn, Prop, Stars, Art
    scenes/              Opener, MainCard, EventCard, StoryClip, Closing (+ EndScene)
    Invite.jsx           composes the timeline; InviteLandscape = 9:16 film on paper (16:9)
  editor/                React editor (form + @remotion/player); built to dist/editor.js
  scripts/
    render-lib.mjs       renderInvite(): frames via Remotion, encode via system ffmpeg
    render-job.mjs       child-process entry used by the server (PROGRESS lines on stdout)
    render.mjs           CLI: node scripts/render.mjs --sample [--landscape] [--ref-audio]
    build-editor.mjs     esbuild bundle for the editor
    stills.mjs           QA stills at given seconds (half scale)
    compare.py           side-by-side vs the reference recording (needs the reference file)
  public/
    art/ fonts/ brand/   generated from assets/wedding-video by scripts/prepare-wedding-video.js
    stories/             4 story clips (900×1600, H.264) and posters
    music/library.json   music library (empty; see Known issues)
    sample/              reference-derived files for internal comparison only (gitignored)
  tests/timeline.test.js unit tests (6)
  FIDELITY.md            what matches the reference and what does not
```

Server side (outside this folder): `lib/weddingVideoRoutes.js` (HTTP, pages, owner cookie, rate
limits), `lib/weddingVideo/store.js` (SQLite tables `wv_*`, media on disk), `lib/weddingVideo/jobs.js`
(one render at a time, spawned as a child process with `LD_LIBRARY_PATH` set to the Nix profile).

## Routes

- `GET /wedding-video` editor · `GET /w/:id` share page (film, MP4 downloads, RSVP, wishes)
- `GET /wedding-video/assets/...` template art, fonts, stories · `GET /wedding-video/static/editor.js`
- `GET /api/wedding-video/config` sample data, music library, story library
- `POST /api/wedding-video/invites` create (owner cookie is set) · `GET|PUT /api/wedding-video/invites/:id`
- `POST /api/wedding-video/invites/:id/media?kind=music` raw body, magic-byte checked, MP3/M4A only
- `POST /api/wedding-video/invites/:id/render` body `{format:'9x16'|'16x9'}` → `{jobId}`
- `GET /api/wedding-video/jobs/:id` status, stage, progress, result or error
- `POST /api/wedding-video/w/:id/rsvp` guest RSVP · `GET /api/wedding-video/invites/:id/rsvps(.csv)` owner only

## Configuration

| Name | Where | Default | Notes |
|---|---|---|---|
| `DATA_DIR` | Railway (existing) | — | Points at the persistent volume `/var/data`. Invites, uploads and renders live under `DATA_DIR/wedding-video` |
| `WEDDING_RENDER_CONCURRENCY` | Railway | `min(4, CPUs)` | Set to `2` in production. Chrome tabs per render |
| `WEDDING_X264_PRESET` | Railway | `slow` | Set to `medium` in production |
| `WEDDING_CHROME_PATH` | optional | — | Force a Chrome binary (used for local tests) |
| `RAILPACK_DEPLOY_APT_PACKAGES` | Railway | — | Present on the service but **not used** (the live build is Nixpacks). Safe to remove |

Build command on Railway: `bash scripts/build-wedding-video.sh`. It installs `wedding-video/`
dependencies, builds the editor and downloads Remotion's headless Chrome. It never fails the deploy.

## Deployment (how it works)

1. Build: Nixpacks reads `nixpacks.toml` (`nodejs_24`, `ffmpeg`, `nss`, `nspr`). The build command
   above then runs. `postinstall` runs `prepare-wedding-video.js`, which decodes the packed assets
   (`assets/wedding-video/*.b64`, `*.b64.partNN`) and checks each file against a sha256 manifest.
2. Runtime: the render child process gets `LD_LIBRARY_PATH=/nix/var/nix/profiles/default/lib`, so
   Remotion's headless shell can load `libnss3` and `libnspr4`.
3. Do **not** add `aptPkgs` or `apt-get` to `nixpacks.toml`. The apt step fails the image build (exit 100).
4. Do **not** use the Nix `chromium` package for renders. It is far too slow here, and it dropped the
   old headless mode Remotion uses.

## Rendering

- `renderInvite()` renders with Remotion (`renderFrames`, JPEG q94) and encodes with system ffmpeg
  (H.264 High, CRF 16, yuv420p, `+faststart`), mixing in the chosen music with fades.
- 16:9 is the identical 9:16 film centred on cream paper. Nothing is re-laid out.
- Story clips: the scene's pre-extracted JPEG frames are served from a local HTTP server during a
  render (frame-exact). A clip that runs longer than its scene is slowed to no less than 0.6× and holds its last frame.
- Failures: the child's full stderr is logged to the Railway deploy log (`[wedding-video] render ... exited`).
  The job reports the first error line.

## Story scenes

`STORY_LIBRARY` in `src/lib/themes.js` lists the scenes: `cycling`, `proposal`, `blessing`, `walk`.
`normalize()` derives each scene's `src` from the library, so a customer cannot inject a URL.

To add or replace a scene:
1. Paint a 9:16 keyframe and animate it to an 8 s clip (see the skill *Animated Invitation Video Template Builder*).
2. Encode to 900×1600 H.264, CRF 24, as `public/stories/storyN.mp4`, plus a poster `storyN.jpg`.
3. Register it in `STORY_LIBRARY` with `src`, `poster`, `clipSec` and `focus`.
4. Run `node scripts/pack-wedding-video-assets.js` and commit the changed `assets/wedding-video/` files.
5. Update this README (*Story scenes*, *Status*) and the timeline test if the sample changes.

## Tests

```
node --test wedding-video/tests/timeline.test.js          # unit: timing, normalisation (6)
node --test tests/wedding-video.test.js                    # HTTP end-to-end on a real server (6)
WV_RENDER_TEST=1 node --test tests/wedding-video.test.js   # adds a full MP4 render (slow)
```

Run the existing suites too when touching shared code: `npm test` (builder, Shaadi, magazines).
The Shaadi test *"a paid template asks for payment"* fails in the offline sandbox and on `main`. It is
not caused by this feature.

## Local development

```
npm ci && npm --prefix wedding-video ci
npm --prefix wedding-video run build:editor
cd wedding-video && npx remotion browser ensure      # headless Chrome for local renders
node scripts/render.mjs --sample --out out/sample-9x16.mp4
node scripts/stills.mjs 9 17 26                      # quick visual checks
```

## Known issues and open items

1. **Render time on Railway.** About 9–10 min for a 31.6 s film; a full 92 s film is estimated at
   25–30 min. Consider a longer job timeout, or measure a full run before selling.
2. **Volume growth.** Renders are never deleted (60–200 MB each for 9:16). The 5 GB volume will fill.
   A retention policy is needed.
3. **Test data on production.** Three test invitations and about 66 MB of test renders are still on the
   volume (created 2026-10-10). Remove them when convenient.
4. **Licences before selling.** Remotion is free for teams of 3 or fewer. Music must be licensed, and
   the library (`public/music/library.json`) is empty.
5. **End-card logo.** It is the Paigaam logo (`public/brand/logo.png`). Replace it if a different mark is intended.
6. **Unused variable.** `RAILPACK_DEPLOY_APT_PACKAGES` on Railway does nothing (see *Configuration*).
7. **Render output colour range.** ffprobe reports `yuvj420p` on the test output. Harmless in players
   tested so far, but worth checking on a phone.
8. **Fonts and art.** Font and illustration differences from the reference are listed in `FIDELITY.md`.

## Changelog

- **2026-10-10** Deployed to production (PR #19). Story scenes replace per-customer generation. The
  Railway build script and Nix packages were added (PRs #20, #21, #22). First production render verified
  at 31.6 s. README rewritten as the standing reference.
- **2026-10-08** Feature built on `feature/wedding-video`: template, editor, renderer, share page,
  RSVP and wishes, tests, `FIDELITY.md`.
