# ✉ Paigaam

**Beautiful greetings, made personal.**

Paigaam is a premium digital greeting / invitation platform. Customers pick a template, personalize it with their names, dates and words, preview it live, purchase through WhatsApp, and receive a unique shareable webpage — e.g. `paigaam.in/p/rahul-neha`.

Built with **zero npm dependencies** — Node's built-in HTTP server and SQLite (`node:sqlite`). One file is the whole database.

---

## Run it

Requires **Node 22.5+** (22.5 for `node:sqlite`; developed on Node 24).

```bash
cd paigaam
node server.js
```

Open **http://localhost:3000**

Admin: **http://localhost:3000/admin/login**
- Email: `admin@paigaam.in`
- Password: `paigaam-admin`

> Override with env vars before first run (they seed the admin):
> `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PAIGAAM_WHATSAPP` (e.g. `919876543210`), `PORT`, `BASE_URL`

---

## The customer journey

```
/                     Home
/templates            Gallery (filter by occasion)
/templates/noor       Template preview (live phone frame)
/create/noor          Personalize — multi-step form + live preview
/preview/:id          "Your Paigaam is ready" → Continue on WhatsApp
/p/:slug              The published Paigaam (public, shareable)
```

1. Customer personalizes → a **draft Paigaam** is saved continuously.
2. "Continue on WhatsApp" → an **order** is created, then a `wa.me` chat opens with a pre-filled message (names, occasion, date, preview link, order id). The number comes from **Admin → Settings**.
3. Admin confirms payment → **Mark paid** → **Publish** → unique slug (`rahul-neha`, `-2` on collision).
4. The Paigaam is live at `/p/:slug` with dynamic Open Graph metadata for WhatsApp link previews, plus a branded downloadable **QR card**.

## Admin

```
/admin/login          Sign in (scrypt-hashed, 7-day session cookie)
/admin                Dashboard — stats + recent Paigaams
/admin/templates      List / new / edit / duplicate / publish / delete
/admin/paigaams       Every personalized Paigaam; mark paid, publish, QR
/admin/orders         Orders from WhatsApp handoffs; mark paid / cancel
/admin/settings       WhatsApp number, business name, currency
```

Statuses: `draft → payment_pending → paid → published` (+ `active`, `archived`).

---

## Template architecture

Templates are **data-driven** — a template is config, not code:

```js
{
  slug: 'noor',
  fields:   [ { id, label, type, required, group, placeholder }, … ],
  sections: [ 'hero', 'message', 'details', 'photo', 'countdown', 'closing' ],
  theme:    { bg, ink, accent, soft, motif, serifCase, ampersand },
}
```

- **fields** generate the personalization form (types: `text`, `textarea`, `date`, `time`, `number`, `image`; groups: `people`, `occasion`, `message`, `photos` become form steps).
- **sections** render the published page in order.
- **theme** recolors the experience.

Three templates ship seeded: **Noor** (wedding, editorial uppercase), **Meher** (birthday, romantic italic), **Aashi** (anniversary, minimal). Adding #4 = one more entry in `templates/registry.js` (or via Admin → New template — fields/sections/theme are editable in the UI).

Concepts stay separate: **Template** (reusable design) → **Paigaam** (personalized instance) → **Order** (purchase).

## Project layout

```
server.js               router + all routes + seed
db.js                   node:sqlite schema + queries (data/paigaam.db)
templates/registry.js   template configs + display helpers
lib/renderPaigaam.js    published-page renderer (immersive, animated)
lib/layout.js           site shell (nav/footer/error pages)
lib/qrcode.js           pure-JS QR generator (SVG)
lib/logo.js             the dove, as inline SVG
pages/                  home, gallery, templateDetail, create, preview, contact, admin
public/css/             paigaam.css (site) + paigaam-pages.css (published)
public/js/create.js     multi-step form + live preview + autosave
```

## Notes

- Image uploads are stored base64 in `customer_data` (MVP-simple; move to object storage later).
- All admin routes are session-gated; user content is HTML-escaped everywhere; bodies capped at 12 MB.
- Animations respect `prefers-reduced-motion`.
- Set `BASE_URL=https://paigaam.in` in production so share links, OG tags and QR codes point at the real domain.

*Some moments deserve more than a message.* 🕊
