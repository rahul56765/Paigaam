# Shubh Sangam

Shubh Sangam is an editable, scrolling wedding invitation in the bfday family. It is registered in `templates/bfday.js`; its config currently marks it editable and free (INR 0). The shared family routes provide the creator, preview, draft, uploads and publication flow. Registration in this checkout is not evidence of deployment or a completed release review.

## Usage

- Open `/shubh-sangam/demo` for the fictional sample and `/create/shubh-sangam` to personalise it. The family also provides `/shubh-sangam/preview-frame`, `/shubh-sangam/preview/:id`, `/api/shubh-sangam/draft`, `/api/shubh-sangam/upload`, `/api/shubh-sangam/upload-audio`, `/api/shubh-sangam/publish` and published `/p/<slug>` pages. Draft and upload operations require the usual creator ownership and state checks; publishing follows the shared storage and environment requirements.
- Edit the couple, family, invitation copy, wedding date and time, venue, events, gallery, optional music and RSVP details in the creator. Both preview and published HTML expose `data-preview` on the body, with the preview badge supplied by the family renderer helper.
- Uploads use the shared bfday image/audio handling. Up to 12 event photos, 12 gallery photos and three individual photos are supported; optional MP3, M4A, OGG or WAV audio is limited to 15 MiB and requires a guest gesture to play.

## Data and behaviour

The sample uses fictional Meera Joshi and Vivaan Kapoor, and **The Royal Orchid Palace**, 27 Emerald Avenue, Wakad, Pune, Maharashtra – 411057. The address has not been independently verified. No demo phone number or map URL is invented; the announcement does not hardcode the sample names.

`weddingDate` and 24-hour `weddingTime` are interpreted in Asia/Kolkata (IST). The displayed weekday, date, entered muhurat and countdown derive from the same instant; no auspicious time is calculated. Events with `timing: wedding` follow it; `timing: custom` events have their own date and time. Up to 12 events and 12 gallery entries may be reordered or removed, including an empty list. Event art follows the name, not its list position; customer event photos are shown separately.

An event without its own venue/address inherits the wedding venue and address, plus its map link unless the event supplies one. An event with its own venue or address uses its own location as a group. Recognized HTTPS Google Maps links are allowlisted; otherwise event directions search the effective address or venue. A valid international phone number with a `+` enables WhatsApp RSVP and a telephone link; the format check cannot verify the recipient or WhatsApp availability. Without it online RSVP is unavailable. Email is independent and optional. Responses are prepared for the guest to review and send in WhatsApp, not stored by this template.

Strict publication requires event name and timing, and custom events require a valid date and time. Draft mode preserves partial named events; blank rows are discarded. Schema, output escaping and upload allowlists are in `schema.js`, `render.js` and the shared bfday engine. See [INTEGRATION.md](./INTEGRATION.md) for the detailed contract.

## Files and checks

- `config.js`, `schema.js`, `render.js`: data, validation, and server rendering.
- `public/shubh-sangam/`: scoped frontend, local artwork and thumbnail. The family startup restores missing or corrupt packed WebP artwork from checksummed `assets/shubh-sangam/` via `lib/bfday/assets-shubh-sangam.js`.
- From the repository root run:

  ```sh
  node --test templates/shubh-sangam/schema.test.js tests/bfday-engine.test.js tests/bfday-list-editor.test.js tests/shubh-sangam-art.test.js
  ```

These checks cover validation, render contracts, list-editor regressions and art recovery, but are not a substitute for end-to-end browser, upload ownership, accessibility, responsive layout or deployed save/publish checks.

## Release blockers

This is a draft, not a production-ready release. End-to-end customer draft, image/audio upload, save/resume, publication and real payment testing have not been completed. Full integration tests were blocked by an HTTP 403 downloading sharp. If an administrator changes the price above zero, the shared paid checkout path does not currently perform Shubh Sangam's strict schema validation before creating an order; do not enable paid sales until that is fixed and tested. The WhatsApp RSVP is a guest-initiated handoff, not a stored response form. The reconstruction uses original generated approximation artwork, not the reference source artwork; the envelope motifs and event card layout still differ visibly from the filmed reference. The demo omits RSVP contact and couple photographs because real contact and photographs were not provided. Demo directions search a fictional address and are not verified.
