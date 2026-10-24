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
  stay, gifts, RSVP and the closing. RSVP is a two-choice WhatsApp handoff. Shaadi Paigaam has no music controls or playback.
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
  unpublish, archive) as for every other template. New RSVP messages go directly to the organiser's WhatsApp; older website-submitted replies remain available in the private reply history and CSV.
- **Short links:** `paigaam.cc/<link>` only ever serves Shaadi Paigaam invitations. Every existing
  route, template slug, occasion slug and public folder name is reserved automatically.

## Optional settings (environment variables)
| Variable | Effect |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Switches venue search from OpenStreetMap (Photon + Nominatim) to Google Places, and the map embed to Google. No code change needed. |
| `GOOGLE_MAPS_EMBED_KEY` | Optional separate, browser-restricted key for the map embed. |
| `GOOGLE_TRANSLATE_API_KEY` | Uses Google Translate for "Auto-translate" (default: MyMemory, free). |
| `MYMEMORY_EMAIL` | Raises the free MyMemory daily limit. |
| `RESEND_API_KEY` + `RSVP_FROM_EMAIL` | Legacy website RSVP API email notifications only; the new guest flow opens WhatsApp. |
| `SP_SECRET` | Fixed secret for passcode cookies (otherwise generated once in DATA_DIR). |

## Music compatibility
Shaadi Paigaam no longer exposes music controls or plays background audio. Older saved music selections are retained but ignored for compatibility. The shared audio library remains available to Suvarna Vivah, which uses the same renderer.

## Tests
`node scripts/test-shaadi-paigaam.js` runs end-to-end checks for: drafts, ownership, sanitising,
uploads, short links, paid and free publish, RSVP spam and duplicates, the dashboard, CSV, the manage
link, live edits, versions, the passcode and expiry.


## Recent updates
- 24 Oct 2026: Replaced Shaadi Paigaam's multi-field guest RSVP form with attending / not attending WhatsApp handoffs to the organiser's configured number. Publishing now requires that number when RSVP is enabled. Removed Shaadi music controls and playback from the editor and guest invitation. Historical website RSVP records and the legacy API remain intact. Suvarna Vivah shares this renderer/editor but retains its existing RSVP and music behavior.
