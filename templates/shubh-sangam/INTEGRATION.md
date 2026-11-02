# Shubh Sangam integration and data contract

This directory provides a bfday config, schema, renderer and local tests. The renderer uses `/shubh-sangam/` frontend assets. The template is registered in `templates/bfday.js` and its config points to the local catalog thumbnail. This checkout's registration does not establish deployment or completion of end-to-end release checks; see [README.md](./README.md) for current usage and status.

## Data and rendering

- Sample people are fictional and their parent names include Mr./Mrs. The demo location is The Royal Orchid Palace, 27 Emerald Avenue, Wakad, Pune, Maharashtra – 411057; its accuracy has not been independently verified. The sample announcement uses neutral wording so changing names does not leave stale names in the copy. No phone number or map URL is invented.
- Couple and parents have individual text fields; `brideFamily` and `groomFamily` allow additional family details. `bridePhoto`, `groomPhoto` and `venuePhoto` are optional bfday uploads; so are event and gallery photos. `musicUpload` is optional, with playback initiated by the guest.
- `schema.deriveWedding(data)` uses a single `weddingDate` and `weddingTime` in Asia/Kolkata to derive the weekday, date label, time label and UTC countdown instant. Wedding time is also displayed as the entered muhurat; no auspicious time is calculated or recommended. `schema.deriveEvent(event, data)` uses that instant for `timing: wedding` or the event's own date and time for `timing: custom`.
- An event without a venue or address inherits the current wedding venue and address; it also inherits the wedding maps link unless it has its own. An event with its own venue or address uses its own location fields as a group (provide both when needed) and does not inherit an unrelated wedding address or map. Event maps links are restricted by `parseFamilyMapLink`; if no recognized link exists, the renderer searches Google Maps for the effective address or venue. Editing the wedding location changes inherited locations, not independent overrides.
- RSVP is optional. A WhatsApp RSVP and `tel:` link require an explicit `+`, a recognized international calling code and a plausible 8–15 digit number. This checks format, not whether a number is assigned or on WhatsApp; customers must verify the recipient. Without a valid number, no WhatsApp form is rendered and the invitation says online RSVP is unavailable. Email is optional and separately validated.
- Images and audio use the shared bfday upload allowlists and need normal upload ownership checks at the API boundary. Output values are escaped; maps links and media URLs are checked before use. Gallery captions supply alt text. Twelve event and twelve gallery rows are supported, with three additional individual photo fields.

## Draft and editor behavior

Event name and timing are checked in template schema at strict publish rather than marked required in the list shape. This preserves named or otherwise partial event rows in draft and lenient modes instead of letting the shared list validator silently discard them. Strict publication still requires both fields and, for custom timing, a valid event date and time. Completely blank rows are discarded. Gallery rows retain shared incomplete-row behavior. The generic editor may not provide specific error messages for these conditional requirements.

The shared editor includes regression tests for restoring lists, preserving uploads and respecting row bounds in `tests/bfday-list-editor.test.js`. The generic photo picker may still refer to a logo in its accessible label. Upload ownership, actual image presentation, responsive layout, accessibility, RSVP client behavior and the full save/publish path require end-to-end testing.

## Local test

Run `node --test templates/shubh-sangam/schema.test.js` from the repository root. It covers config validity, validation modes and partial draft preservation, date/time derivation and rendered labels, venue inheritance and overrides, contacts, media allowlists, and sample rendering. It is not a browser or upload ownership test.
