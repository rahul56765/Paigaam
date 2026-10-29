# Lotus Vivah

An isolated, reference-guided eight-card wedding invitation in Paigaam’s existing family engine. The supplied flattened photographs guide its botanical illustrations, paisley paper, pink/white panels, yellow Haldi arch, green Mehndi scallops and a lotus-framed closing card. Artwork and typefaces are close recreations, not original source layers or a claim of pixel-identical reproduction.

## Cards and editing

Cover → Save the Date → Wedding Ceremony → Haldi → Mehndi → Sangeet → Reception → Thank You. The event list can be reordered, removed or hidden individually, including all events. An explicitly empty event array stays empty. Fixed opening, date and closing cards remain. Each event type may appear once, up to five events.

All authored text is editable: names, joining word, optional monogram text, opening hint, headings, invitation and host lines, dates, times, address lead, addresses and thank-you message. Calendar month, weekday and year derive from the chosen date. Panel colours accept validated six-digit hex values, including per-event overrides. Decorative references are not customer-editable artworks.

Optional transparent logo/monogram and optional photo in reserved Save-the-Date areas each expose zoom/crop and X/Y position sliders. At 100% the logo is fully contained; increasing zoom intentionally crops within its frame, without cropping the invitation itself. Removing optional images restores the reference-led layout.

## Screen and interaction

The entire 9:16 card is contained within the available viewport, with reserved safe-area space for navigation and a small tilt margin. Narrow, short and landscape viewports show the complete card rather than a stretched/cropped fill. Wider screens use surrounding space. Text uses relative type and shrinks inside dedicated safe zones. Input lengths are bounded; excessive content reduces type size rather than drawing over illustrations. Arbitrarily long text on arbitrarily small screens cannot remain both large and fully visible.

A first tap lifts the plain white seal and unfolds painted lotus petal layers in an approximately two-second sequence, including the crossfade. Two complete, naturally cupped lotus flowers replace the earlier detached cover shapes. No initials, text or uploaded logo can appear on the cover seal. Existing logo crop controls remain available on Save the Date; explicit optional monogram text also appears there, with no automatically generated initials. Previous/next buttons, dots, keyboard arrows and horizontal swipe navigate slow fade/slide transitions; repeated input is bounded by a transition lock and timer fallback. Current page is announced and inactive cards are inert. Reduced motion disables tilt, decorative animation and opening delays. A no-JavaScript fallback reveals the cards for scrolling.

Five faint CSS petals drift slowly, unchanged from the first version. Flowers sway and float gently without any input. Thin gold/pink strokes follow alpha-traced flower silhouettes and selected cover-petal seams, with a softly pulsing halo and a short moving highlight. Gold paths follow the exact existing panel silhouettes. Divider rules shimmer, and a very low-opacity shine crosses the card. Raised paper shadows and flower shadows add depth. Flower parallax is bounded to 3.4 px and moves more than the panel layer; the background stays still. Pointer tilt is capped at 2 degrees, separate from a slow ambient paper tilt. Device-orientation tilt is progressive enhancement only when the browser already permits readings. No Enable tilt button or permission prompt is needed for ambient motion or touch response; the invitation does not request or bypass OS motion permissions. Decorative animations pause when the tab is hidden.

## Music

The template opts into a new family audio field, musicUpload. Creator-owned raw uploads go through /api/lotus-vivah/upload-audio?id=draft with the shared origin, ownership, state, size/pool and publication checks. MP3, M4A, OGG and WAV header/container validation is in lib/bfday/audio.js; limit 15 MiB. Files use secure random names in the existing persistent upload volume and are private until referenced by a published invitation. Upload/remove/replace works through the wizard and saved drafts. Uploaded audio takes precedence over a music link.

Links accept HTTPS direct MP3/M4A/OGG/WAV files or supported YouTube URLs. Native playback begins synchronously in the first cover gesture. Playback failure leaves a retry button and does not block the invitation. YouTube playback depends on provider embedding/autoplay availability; Spotify/Apple Music page links are rejected rather than pretending they are audio files. No provider media is downloaded. Use music you have rights to share.

## Files and routes

- templates/lotus-vivah: config, schema and escaped server renderer.
- public/lotus-vivah: scoped stylesheet, interaction script and vector paisley.
- assets/lotus-vivah: checksummed base64 botanical assets including the full cover lotus, restored at startup by lib/bfday/assets-lotus-vivah.js.
- /lotus-vivah/demo, /create/lotus-vivah, /lotus-vivah/preview-frame, /api/lotus-vivah/draft, /api/lotus-vivah/publish and /p/published-slug use the shared family routes.

No wedding-video feature code, deployment settings or other invitation designs are changed.

## Changelog

- 2026-10-26 — Added Lotus Vivah, contained 9:16 card composition, customisable copy/colours/events, optional logo/photo crop controls, lotus opening, paper-depth effects, restrained motion, and opt-in secure background audio uploads with direct-audio/YouTube link support.

- 2026-10-26 — Targeted visual revision: natural full cover blooms with sequential masked petal opening, plain seal, richer Save-the-Date corners, larger type centred on exact event-panel centres, silhouette-following flower/panel light, deeper paper shadows and bounded foreground parallax. Page flow, palette, editable field IDs, event controls, music and falling-petal settings retained.

- 2026-10-26 — Reference-style final polish: fuller tall lotus side composition and corner flowers for Sangeet/Reception; centred green Mehndi panel with balanced paper margins; grey closing ribbon removed completely; Thank You pink/white balance refined. Permanent gold-pink outlines now pulse above a visible brightness floor, edge highlights loop continuously, and the card shine repeats every 6.8 seconds. Added visible paper-thickness edges, raised floral shadows, automatic CSS paper/flower float, touch parallax and already-permitted phone orientation. The approved closed-cover markup/art, text values, field IDs and page flow remain unchanged. Opening timing shortened to about two seconds; typography is fitted on layout/font readiness rather than during navigation to avoid crossfade reflow.

- 2026-10-29 — Production-release integration on current main: retained creator attribution/coupons, direct guide handoff, Anniversary Blue custom editor and its private audio contract. Updated shared wizard cache key for the audio-upload control. Approved Lotus artwork, page copy, fields, layout and motion are unchanged.
