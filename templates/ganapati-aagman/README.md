# Ganapati Aagman · Paigaam

An editable cinematic invitation, integrated with Paigaam's Node/SQLite app. No embedded external app, GIF animation, or autoplaying film.

## Routes and flow

- Collection: `/templates/ganapati-aagman`
- Customer wizard: `/create/ganapati-aagman`
- Full interactive demo: `/ganapati/demo?lang=en` (`en`, `hi`, `mr` only)
- Private real preview: `/ganapati/preview/:id` — same-origin creator cookie or administrator required
- Published invitation: `/p/ganapati-<random-id>`
- Draft, upload, publish: `/api/ganapati/draft`, `/api/ganapati/upload?id=:id`, `/api/ganapati/publish`
- Calendar: `/api/ganapati/calendar/:id` — published invitations only

Customer fields: familyName, optional fatherName/motherName/familyMembers/customMessage, eventDate, eventTime, venueName, address, photos. The language enum, timezone (Asia/Kolkata), and templateVersion are validated. Template name/price remains Ganapati Aagman/free for this MVP; other prices are unchanged.

Creator ownership is an HttpOnly SameSite cookie whose SHA-256 hash is associated with the invitation in an additive table. Public IDs are not edit credentials. Draft previews are private and nonindexable. The old generic draft/free-publish/preview APIs cannot bypass the new template's validation or ownership. Public routes respect existing admin deactivate/archive state.

## Template boundaries

- `config.js`: identity, fields, theme, assets and verified festival dates.
- `translations.js`: visitor text and eight story caption cues per language.
- `schema.js`: server-side typed validation.
- `render.js`: shared preview/public renderer with escaped text.
- `public/ganapati/invitation.js` and `.css`: native-scroll film timeline and visitor presentation.
- `pages/ganapatiCreate.js` and `public/ganapati/create.*`: separate customer wizard.
- `lib/ganapatiRoutes.js`: storage/ownership, uploads, publishing and calendar.
- `lib/streamFile.js`: streamed static responses including HEAD, Range/206/416 and ETags.

The existing protected admin already lists records, dates and public URLs and can preview, publish, unpublish and archive them. Advanced edit/search and asset-management UI are intentionally deferred. Default calendar duration is two hours; time is explicitly IST, not an automatically chosen muhurat.

## Media

Original supplied files: VID_20260905_133235_119.mp4 (formation), VID_20260905_133235_649.mp4 (letter/boat journey), ReelAudio-66212.mp3 (music).

Production videos: H.264 720×1280, 24fps, 240 frames, 10s; CRF24, GOP12, fast-start. Both were produced with audio removal and verified to contain ZERO audio streams. Client additionally enforces muted/defaultMuted/volume zero and keeps films paused while seeking currentTime. Native scroll is retained. Reduced-motion visitors see static imagery; media errors leave images/details usable.

Separate supplied MP3 is unchanged, 10.057s, loops after a gesture and remains independent of film seeking. The short original loop boundary may be audible; no new audio was synthesized. Music loading/error and manual-mute preference are handled. Captions occupy their own band, not the idol's face, and fade through nonoverlapping cue ranges.

Total generated media: 6,102,415 bytes; films approximately 2.53MB and 3.02MB. Posters/first-frame metadata load ahead of each scene and gallery images are lazy. The text-only GitHub integration cannot write binary blobs; therefore source assets are stored losslessly under `assets/ganapati/*.b64` with SHA-256 checksums. `npm run build` decodes them to ordinary files in ignored `public/ganapati/media/`. Browser delivery is NOT base64. Postinstall also prepares media; corrupted asset input fails the build.

## Photo safety and persistence

Browser accepts JPEG/PNG/WebP, maximum 8MiB original, 10 images, scales longest edge to1600 and produces JPEG. Server accepts at most2MiB each, checks actual format/dimensions/decoded pixels, rejects animated or mismatched input, strips metadata and re-encodes WebP using pinned Sharp0.35.4. Stored names are random; each photo belongs to one invitation. Draft and unreferenced images are private; publication exposes only referenced photos. Per-invitation upload churn limit30, 500MiB application upload quota, 20 drafts per owner/day and an in-process coarse request limiter protect the MVP. Multi-instance rate limiting and stronger anti-abuse controls would need an external shared store later.

Uploads live in DATA_DIR/ganapati-uploads, with references in SQLite. Removing photos from a draft removes references; unreferenced files older than7days are cleaned on subsequent uploads. Deletion of entire invitations can leave orphan files after FK cascades; periodic filesystem reconciliation is a later maintenance task. Existing records are never wiped/migrated destructively by this module.

## Festival date defaults

2026: September14; 2027: September4; 2028: August23.
Sources checked September5,2026:
- https://www.drikpanchang.com/festivals/ganesh-chaturthi/ganesh-chaturthi-date-time.html
- https://www.prokerala.com/when-is/ganesh-chaturthi.html

Years2026–2100 are accepted; unverified years require manual date entry. Date can always be overridden. The wizard preserves an override until the customer explicitly changes the year. Do not imply a generic festival date is the correct muhurat for every location.

## Local verification

Node24 recommended. `npm ci`, `npx playwright install chromium`, `npm test`.

The test command creates an isolated server/database, runs51 assertions/subtests across API and real Chromium, then verifies the published URL, text and photo survive a complete process restart. Test artifacts go to ignored test-output. Tests cover en/hi/mr wizard including photo/real preview/audio/publication, seeking/reversal, letter unlock, WhatsApp URLs, reduced motion, malicious input, ownership bypasses, validation, image spoofing, media ranges and calendar UTF-8/timezone. Chromium uses mobile-sized viewports, not real Android/iOS devices. Actual Safari, WhatsApp embedded-browser and slow-cellular hardware testing remain release checks. npm audit reported zero vulnerabilities at build time.

## PRODUCTION LAUNCH GATE — do not merge until resolved

On September5,2026, https://paigaam.cc/healthz reported storage=ephemeral despite DATA_DIR=/var/data. Deploying/restarting that service can erase the current SQLite data. The application cannot attach a Render disk by setting an env var.

1. Back up the CURRENT running database consistently (SQLite online backup, not just copying the WAL-less DB) and existing uploads before redeploy or host-plan changes.
2. Owner must approve/configure a persistent Render disk on a paid instance, mounted at /var/data, or explicitly choose another durable store. Do not silently change hosting, billing or database.
3. Restore the backed-up DB and uploads to the persistent mount and retain off-instance backups. Verify actual disk attachment in Render, not just healthz's env/path heuristic.
4. Set Render build command to `npm ci --omit=dev && npm run build`; start `node server.js`; NODE_VERSION=24, DATA_DIR=/var/data, BASE_URL=https://paigaam.cc. Existing admin/music/business env settings remain.
5. Only after the above, merge this feature branch into main and allow the existing Render auto-deploy. A blueprint file does not automatically modify a dashboard-managed service. Its pre-existing plan:free is incompatible with persistent disks; owner must change the service plan deliberately.
6. Verify the template listing, full English/Hindi/Marathi flows, real devices, MP4 byte ranges, public photo loading, admin deactivate, and stable URL after a controlled restart. Roll back code if regressions appear; preserve data and additive tables.

The new self-publish endpoint refuses non-local publication when the existing persistence flag is false. This is an extra safeguard, NOT proof that a configured path is a real persistent mount. Local restart tests are not a production durability claim.
