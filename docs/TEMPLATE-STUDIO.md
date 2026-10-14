# Template studio (Boyfriend Day copy and clones)

The admin page **Admin → Template studio** (`/admin/studio`) edits the words of every
Boyfriend Day layout and clones a layout as a new occasion.

## What you can do

- **Edit a built-in layout's copy.** Occasion line, word lists, headings, polaroid captions and
  hidden notes, the letter and its date, the wizard wording, and the sample shown in the preview.
  The saved copy replaces the shipped copy on the live template. **Reset copy** puts the shipped
  wording back. Price and status are kept.
- **Make a new occasion from any layout.** Give it a name, a slug (the address, for example
  `anniversary-tohfa`), a category, a description and a price. It starts as a **draft** with the
  same layout and the copy you had. Publish it from the same page when it is ready.
- **Delete a clone** while no paigaam has been made from it. Once paid or draft paigaams exist,
  set it to draft instead.

What stays as designed: the layout itself, photos, colours, motifs, number of scenes, and the
background-music field. Built-in names, categories and descriptions come from code, because the
server re-syncs them on every boot.

## How it works

- `lib/bfday/studio.js` owns the `bfday_studio` table. Each row holds a full snapshot of the
  editable copy for one member (built-in or clone), plus the clone's name, category and description.
- At boot, `loadSaved()` rebuilds every member from its shipped `templates/<slug>/config.js`
  plus its snapshot, and registers it with `lib/bfday/family.js`. A saved copy that no longer
  passes is logged (`[studio] NOT LOADED`) and left out, so boot never fails on it.
- Every save runs the family contract check (demo strict validation, the defaults in draft mode,
  the step and field rules). Nothing is stored unless the check passes.
- A studio member's renderer wraps the layout's own renderer. Blank fields are first filled from
  the member's copy, then the untouched layout renders. So a clone uses the same HTML, CSS and
  scripts as its layout, with only the words changed.
- Clone rows also get a `templates` row (status `draft`), which is what `/create/<slug>` and the
  gallery read.

## Rules for copy

- Required fields (names) have no pre-filled default; their sample shows in the preview only.
- A default is only written where the shipped layout pre-fills the field. Fields the layout leaves
  blank (the song link) never pre-fill every buyer's wizard.
- A list keeps its shipped limits: words 1–12, polaroids up to 6, bouquet notes exactly 3 with
  both label and note. An empty row is dropped; a partly filled row is an error.
- Text is HTML-escaped at render time, as for every family member. Control characters are refused.
- Blank wizard wording keeps the shipped wording.

## Routes (admin only)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/studio` | list of members |
| GET | `/admin/studio/:slug` | edit form |
| POST | `/admin/studio/:slug` | save copy, listing and status |
| POST | `/admin/studio/:slug/clone` | create a draft clone from this member |
| POST | `/admin/studio/:slug/reset` | built-in: back to the shipped copy |
| POST | `/admin/studio/:slug/delete` | clone: delete when no paigaams exist |

## Not in v1

Theme colours, photos, numbers, selects, dates, and layout structure. Adding a field or a scene
needs a code change to the layout.

## Tests

`node --test tests/bfday-studio.test.js` (also `npm run test:bfday-studio`). The Boyfriend Day
suites (`scripts/test-bfday.js`, `tests/bfday-*.test.js`) cover the layouts themselves.
