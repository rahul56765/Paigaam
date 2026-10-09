# Shaadi Paigaam: wedding invitation website + customizer

**Customers:** `/create/shaadi-paigaam` (editor) · **Sample:** `/shaadi-paigaam/demo` · **Published:** `paigaam.cc/<their-link>`

## How it is built
- **One data object** per invitation (schema, defaults, validation and palette engine in
  `public/shaadi-paigaam/core.js`, shared by the server, the invitation and the editor).
  Nothing a customer can edit is hard-coded in the design.
- **The invitation** (`invite.js` + `invite.css`) renders everything from that data:
  embossed doors with a medallion, curtains that tie back over the courtyard, names and parents,
  the welcome message, the scratch-to-reveal heart with .ics and glitter, the photo carousel, the
  live countdown, the program timeline, the venue map, dress code, pre-wedding cards, transport,
  stay, gifts, RSVP and the closing. Plus the language pill and the music button.
- **Recolouring:** door relief and courtyard are neutral layers tinted live with CSS variables
  and blend modes (roses are a separate mask). The medallion, curtains, icons, heart and confetti are
  SVG or canvas reading the same variables. A palette change never regenerates an image.
- **The editor** (`editor.js`) has 7 steps with a live phone, tablet or laptop preview (the real
  invitation in an iframe, fed by postMessage). It autosaves to the device instantly and to the
  server every few seconds, with undo/redo, reset step and preview as guest.
- **Routes:** `lib/shaadiPaigaamRoutes.js`. Media is packed by `scripts/pack-shaadi-media.js` into
  `assets/shaadi-paigaam/*.b64` and restored at boot by `lib/shaadiPaigaamMedia.js`.

## Managing it (admin)
- **Price:** Admin › Templates › Shaadi Paigaam. It is free (price 0). If you set a price, customers still
  create and preview free and pay through the normal inline Razorpay checkout when they publish.
- **Hide or unhide:** set the template status to draft or published in Admin.
- **Invitations:** Admin › Paigaams lists every draft and published invitation (mark paid,
  unpublish, archive) as for every other template.
- **Short links:** `paigaam.cc/<link>` only ever serves Shaadi Paigaam invitations. Every existing
  route, template slug, occasion slug and public folder name is reserved automatically.

## Optional settings (environment variables)
| Variable | Effect |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Switches venue search from OpenStreetMap (Photon + Nominatim) to Google Places, and the map embed to Google. No code change needed. |
| `GOOGLE_MAPS_EMBED_KEY` | Optional separate, browser-restricted key for the map embed. |
| `GOOGLE_TRANSLATE_API_KEY` | Uses Google Translate for "Auto-translate" (default: MyMemory, free). |
| `MYMEMORY_EMAIL` | Raises the free MyMemory daily limit. |
| `RESEND_API_KEY` + `RSVP_FROM_EMAIL` | Emails the couple when a guest RSVPs (needs a verified sending domain). |
| `SP_SECRET` | Fixed secret for passcode cookies (otherwise generated once in DATA_DIR). |

## Music library
Ten original instrumental tracks (shehnai, sitar, santoor, bansuri, veena, piano, piano and strings,
guitar, harp and sarangi), synthesised for Paigaam, so there are no third-party rights. To replace one, drop an
MP3 with the same file name into `public/shaadi-paigaam/music/`, run
`node scripts/pack-shaadi-media.js` and commit `assets/shaadi-paigaam/`.

## Tests
`node scripts/test-shaadi-paigaam.js` runs 53 end-to-end checks: drafts, ownership, sanitising,
uploads, short links, paid and free publish, RSVP spam and duplicates, the dashboard, CSV, the manage
link, live edits, versions, the passcode and expiry.
