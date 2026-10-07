# Paigaam

**Beautiful greetings, made personal.**

Paigaam is a Node.js application for personalized digital invitations, greetings, letters, and interactive mini-experiences. A sender chooses a design, enters names and other details, previews the result, then publishes a shareable page with a link and QR card. Depending on the template, recipients may see a photo story, quiz, reveal, invitation, video, or other interactive experience.

## What is in the product

The current registry contains 34 templates, implemented in four patterns:

- **20 Boyfriend Day family experiences** share a configurable builder and route engine (`templates/bfday.js`, `lib/bfday/`). The family includes birthdays, proposals, letters, quizzes, and wedding designs; “BFday” is an implementation family, not an occasion category.
- **10 bespoke experiences** have their own route, validation, and builder/rendering code: Sawaal, Sau Wajah, Love Awaits, Maafi, Love Album, Valentine Say Yes, Lavender Bloom, Ganpati Courtyard, Saalgirah, and Ganapati Aagman.
- **Three classic templates** (Noor, Meher, Aashi) use the section-based renderer, and **Khaat** is a fixed, separately bundled apology experience.

The registry and data-driven page renderer live in `templates/registry.js` and `lib/renderPaigaam.js`. Not every template uses the same form or route flow; bespoke experiences should be extended through their own modules.

## Customer journey

- `/` — home page
- `/templates` — searchable/filterable template gallery
- `/occasions` and `/templates/:occasion` — occasion discovery pages
- `/templates/:slug` — template details/demo
- `/create/:slug` — personalization (some experiences have specialized routes and builders)
- `/preview/:id` — draft preview and publish (some specialized experiences use their own preview routes)
- `/p/:slug` — published, public, shareable Paigaam

Customer flows do not require a sender account. Depending on the experience, drafts are resumed using browser-cookie ownership, an opaque draft ID, or a recovery link; keep recovery links private. Free designs can be published immediately. Paid designs use Razorpay Checkout when payments are configured. After publication the sender can copy the link, share it (including via WhatsApp), or download a branded QR card. Some experiences also provide recipient responses, calendars, or downloadable personalized media.

## Requirements and local setup

Requires **Node.js 24** (the supported range is `>=22.5.0 <25`; `node:sqlite` requires Node 22.5 or later).

```sh
npm ci
npm start
```

Then open <http://localhost:3000>. For auto-restart during development, use `npm run dev`.

The admin interface is at `/admin/login`. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` explicitly before running or deploying the app. The source retains development fallbacks; do not expose an installation with those defaults to the public internet.

### Build and tests

```sh
npm run build
npm test
```

`build` runs `scripts/prepare-ganapati.js`, which reconstructs selected binary assets from checked-in base64 text files and validates their SHA-256 checksums. `postinstall` runs the same preparation script. Other media helpers restore their registered assets at server startup. The test script runs a suite of API, renderer/DOM, and browser-oriented harnesses; Playwright is a development dependency.

## Configuration

Set environment variables in the host’s secret/configuration manager; do not commit secrets.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `3000`). |
| `HOST` | Bind host (default `0.0.0.0`). |
| `BASE_URL` | Public origin used for share links, canonical/Open Graph metadata, QR links, and absolute application URLs. Set this to the deployed HTTPS origin. |
| `DATA_DIR` | Directory for SQLite and user-generated files. Use a persistent volume in production. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin seed/login credentials. Configure both explicitly. |
| `PAIGAAM_WHATSAPP` | WhatsApp number used when the initial settings row is created; manage the active value in Admin → Settings. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API and checkout credentials. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret used to validate Razorpay webhook signatures; configure it with the provider. |
| `RAZORPAY_ENABLED` | Set to `1` to enable paid checkout; valid key ID and secret are also required. |
| `FFMPEG_PATH` | Optional path to `ffmpeg` for personalized Ganpati Courtyard video exports (defaults to `ffmpeg` on `PATH`). |

Several family and bespoke publication handlers block production publishing when storage is not persistent. Their explicit `*_ALLOW_EPHEMERAL_PUBLISH=1` escape hatches are module-specific, not one global switch; check the relevant route module before setting one. Keep the database and upload/export directories on persistent storage for production.

## Data and publishing

SQLite is stored at `DATA_DIR/paigaam.db` (or `./data/paigaam.db` when `DATA_DIR` is not set). The schema is initialized and migrated additively at startup. Core records are templates, personalized Paigaams, orders, settings, admins, sessions, and anonymous funnel events (`db.js`). Experience modules add their own owner, upload, and response tables as needed.

`DATA_DIR` must be writable. If the configured directory is unavailable, the app logs a warning and falls back to the local `data/` directory so it can start; that fallback is not durable across redeploys. Different experiences store uploads differently: some keep image data with the saved personalization, while others write validated files under the data directory. Preserve both the database and related files, and restrict access to the mounted volume.

A paid Paigaam is published after a successful Razorpay signature check or a verified `payment.captured` / `order.paid` webhook. The application stores the order and payment references, then marks the Paigaam paid and publishes it. Free designs use the self-publish endpoint. Published pages receive unique slugs and public Open Graph metadata; sitemap and robots endpoints are also served by the app.

## Admin and lifecycle

- `/admin/login` — admin sign-in
- `/admin` — dashboard
- `/admin/templates` — create, edit, duplicate, publish/unpublish, or delete templates
- `/admin/paigaams` — review personalized pages; mark paid, publish, unpublish, archive, or delete
- `/admin/orders` — view/update orders
- `/admin/settings` — business details, WhatsApp number, and currency

The admin password is stored as a salted scrypt hash. Admin sessions are server-side and expire after seven days. Creator drafts are not user accounts: they are linked to an unguessable browser cookie and, for some flows, recovery links. Published pages are public by design. The general lifecycle is `draft` → `payment_pending` → `paid` → `published`; free and specialized experiences may use slightly different transitions, and `active` / `archived` statuses also exist.

## Repository map

```text
server.js                HTTP server, route dispatch, startup seeding, admin routes
db.js                    SQLite schema, migrations, and query layer
templates/registry.js    Product registry and display helpers
templates/<slug>/        Per-experience configuration, schema, and renderer
templates/bfday.js       Boyfriend Day family registration order
lib/                     Shared rendering, route families, validation, payments, media, QR
pages/                   Server-rendered public, admin, and builder pages
public/                  CSS, browser JavaScript, logos, and experience assets
assets/                  Base64-encoded source media and checksum manifests
scripts/                 Asset preparation and test harnesses
tests/                   API, DOM, renderer, and browser tests
render.yaml              Render service and persistent-disk blueprint
railway.json             Railway deployment settings
nixpacks.toml            Node 24 and ffmpeg build environment
```

Runtime uses Node built-ins for HTTP, SQLite, crypto, and HTTPS; `sharp` is the runtime npm dependency for image processing. `@playwright/test` is a development dependency. The database and uploaded files are not part of the Git repository.

## Deployment notes

- `render.yaml` configures Node 24, `DATA_DIR=/var/data`, a persistent disk, and `BASE_URL=https://paigaam.cc`; set the admin password, WhatsApp number, and payment secrets in Render’s environment settings.
- `railway.json` starts `node server.js`; `nixpacks.toml` installs Node 24 and `ffmpeg`.
- Ganpati Courtyard personalized MP4 exports require `ffmpeg` and bundled font/media files. The Render blueprint does not explicitly install `ffmpeg`; confirm it is available in that runtime or configure `FFMPEG_PATH`/the build environment before relying on exports there.
- Always set `BASE_URL` to the site’s actual HTTPS origin. The local fallback is for development only.

*Some moments deserve more than a message.*
