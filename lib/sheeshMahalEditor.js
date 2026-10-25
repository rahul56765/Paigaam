'use strict';
// Reuse the maintained seven-step editor without touching Shaadi/Suvarna behavior.
// Changes are strictly template-local: device store and WhatsApp-only dashboard.
const fs = require('node:fs');
const path = require('node:path');
const original = fs.readFileSync(path.join(__dirname, '../public/shaadi-paigaam/editor.js'), 'utf8');
const marker = "const STORE = boot.slug === 'suvarna-vivah' ? 'sv-ed' : 'sp-ed';";
const start = original.indexOf('  async function guestsHtml(box) {');
const end = original.indexOf('\n  async function versionsHtml', start);
if (!original.includes(marker) || start < 0 || end < start) throw new Error('Sheesh Mahal editor adapter needs updating');
const replies = `  async function guestsHtml(box) {
    box.innerHTML = '<section class="card"><h2>WhatsApp RSVP</h2><p>Guests choose attending or not attending and send their reply directly to your organiser WhatsApp number. Paigaam does not collect or store guest replies for this invitation.</p></section>';
  }
`;
module.exports = (original.slice(0, start) + replies + original.slice(end))
  .replace(marker, "const STORE = 'sm-ed';")
  .replace("simpleWhatsAppRsvp ? 'Website replies' : 'Guests (RSVP)'", "'WhatsApp RSVP'")
  .replace('req: d.sections.rsvp, optional: !d.sections.rsvp', 'req: true, optional: false')
  .replace("toggle: tgl('sections.rsvp', 'Show RSVP'), off: d.sections.rsvp === false, focus: 'rsvp'", "toggle: tgl('sections.rsvp', 'Show RSVP'), focus: 'rsvp'")
  .replace('Older website replies, if any, remain in the reply history.', 'The organiser number is required to publish, even if RSVP is hidden.')
  .replace('It opens your editor and guest list on any phone or computer.', 'It opens your private editor on any phone or computer.');
