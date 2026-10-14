'use strict';
// Run: node --test tests/bfday-studio.test.js
// Template studio (lib/bfday/studio.js): editing a Boyfriend Day template's copy,
// cloning it as a new occasion, reload after restart, and the rules that keep
// a saved copy from breaking a layout. Runs against an isolated temp database.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-studio-'));

const family = require('../lib/bfday/family');
const studio = require('../lib/bfday/studio');
const { q } = require('../db');

const GIFT = 'bfday-gift';

/** A complete, valid form for bfday-gift, as the studio page would post it. */
function giftForm(overrides = {}) {
  return {
    f_recipientName: 'Aarav', f_senderName: 'Meera', f_occasionLine: 'happy Anniversary, my love',
    f_wordsHeading: 'you are my…', l_words: 'my forever,\nmy home,\nmy yes.',
    f_galleryHeading: 'a few of our favourites', f_songTitle: 'Tum Hi Ho', f_songArtist: 'a song for ten years', f_songUrl: '',
    f_bouquetHeading: 'open a bouquet', f_letterText: 'happy anniversary. thank you for every year.', f_letterDate: 'may 4, always',
    s_photos_0_caption: 'the day we met', s_photos_0_hidden: 'still my favourite day',
    s_photos_1_caption: 'our first trip', s_photos_1_hidden: '',
    s_photos_2_caption: '', s_photos_2_hidden: '',
    s_bouquetNotes_0_label: 'roses', s_bouquetNotes_0_note: 'for ten years of roses',
    s_bouquetNotes_1_label: 'tulips', s_bouquetNotes_1_note: 'tulips for the laughs',
    s_bouquetNotes_2_label: 'daisies', s_bouquetNotes_2_note: 'daisies for the quiet days',
    w_headline: 'Not a card. Our year.', w_intro: 'An anniversary keepsake.',
    price: '0', status: 'draft', ...overrides,
  };
}

const CLONE = { new_name: 'Anniversary Tohfa', new_slug: 'anniversary-tohfa', new_category: 'Anniversary',
  new_description: 'A candy keepsake site for anniversaries.', new_price: '199' };

let shippedBefore;
before(() => {
  // The row server.js seeds for every built-in, so the studio can see a listing.
  for (const t of family.list) {
    if (t.slug === 'bfday-fixture' || q.templateBySlug(t.slug)) continue;
    q.templateInsert({ name: t.config.name, slug: t.slug, category: t.config.category, description: t.config.description, price: 0, status: 'published', config: { fields: t.config.fields } });
  }
  shippedBefore = JSON.stringify(family.shippedConfig(GIFT));
});

const renderDemo = slug => family.bySlug(slug).render({ customer_data: family.bySlug(slug).config.demo }, { baseUrl: 'https://paigaam.cc', isPreview: true });

/* ----------------------------------------------------------- rules */

test('studio: every shipped Boyfriend Day member has editable specs, and the test fixture is hidden', () => {
  assert.deepEqual(family.errors, []);
  for (const t of family.list.filter(x => x.slug !== 'bfday-fixture')) {
    assert.ok(studio.specsOf(t.config).length > 0, t.slug + ' has editable copy');
  }
  assert.ok(!studio.members().some(m => m.slug === 'bfday-fixture'));
});

test('studio: a blank required field, short lines, partial photo rows and bad price are refused with readable errors', () => {
  const r = studio.save(GIFT, giftForm({ f_recipientName: '', l_words: '', s_bouquetNotes_0_note: '', price: 'abc' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('Their name is required.'));
  assert.ok(r.errors.some(e => /needs at least 1 line/.test(e)), 'words need a line');
  assert.ok(r.errors.some(e => /row 1: The hidden note is required/.test(e)), 'row note required');
  assert.ok(r.errors.some(e => /Price must be a whole number/.test(e)));
  // partial photo row: caption required when a hidden caption is typed
  const partial = studio.save(GIFT, giftForm({ s_photos_2_caption: '', s_photos_2_hidden: 'only the back' }));
  assert.ok(partial.errors.some(e => /row 3: Caption on the front is required/.test(e)), partial.errors.join(' | '));
});

test('studio: over-long text, control characters and wizard copy beyond the limit are refused', () => {
  const r = studio.save(GIFT, giftForm({ f_occasionLine: 'x'.repeat(200), w_intro: 'y'.repeat(700), f_letterText: 'ok\u0007bell' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /Occasion line|occasionLine|occasion line/i.test(e) && /characters/.test(e)), r.errors.join(' | '));
  assert.ok(r.errors.some(e => /"intro" is 700/.test(e)));
  assert.ok(r.errors.some(e => /control character/.test(e)));
});

test('studio: refused edits change nothing — the shipped layout and the live member stay as they were', () => {
  studio.save(GIFT, giftForm({ f_recipientName: '' }));
  assert.equal(JSON.stringify(family.shippedConfig(GIFT)), shippedBefore, 'shipped config untouched');
  assert.equal(family.bySlug(GIFT).config.name, 'Tohfa');
});

test('studio: slugs must be well-formed, unreserved and unused', () => {
  assert.match(studio.slugProblem('Bad Slug'), /lowercase/);
  assert.match(studio.slugProblem('admin'), /reserved/);
  assert.match(studio.slugProblem(GIFT), /already exists/);
  assert.equal(studio.slugProblem('fresh-occasion-x'), '');
});

/* ---------------------------------------------------------- built-in copy */

test('studio: saving a sample never pre-fills the wizard for a field the shipped layout leaves blank', () => {
  const r = studio.save(GIFT, giftForm({ f_songUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }));
  assert.equal(r.ok, true, r.errors.join(' | '));
  assert.equal(family.bySlug(GIFT).config.fields.find(f => f.id === 'songUrl').default, undefined, 'no default written');
  assert.ok(renderDemo(GIFT).includes('abcdefghijk') || family.bySlug(GIFT).config.demo.songUrl.includes('abcdefghijk'), 'the sample has the new link');
  assert.equal(studio.resetBuiltIn(GIFT).ok, true);
});

test('studio: editing a built-in copy changes what it shows, and reset puts the shipped copy back', () => {
  const r = studio.save(GIFT, giftForm({ f_occasionLine: 'happy Gifting Day', f_recipientName: 'Aarav' }));
  assert.equal(r.ok, true, r.errors.join(' | '));
  assert.ok(renderDemo(GIFT).includes('Gifting Day'), 'demo shows the saved copy');
  assert.equal(family.bySlug(GIFT).config.name, 'Tohfa', 'a built-in keeps its shipped name');
  assert.equal(family.bySlug(GIFT).config.fields.find(f => f.id === 'occasionLine').default, 'happy Gifting Day');
  
  const reset = studio.resetBuiltIn(GIFT);
  assert.equal(reset.ok, true);
  assert.equal(JSON.stringify(family.shippedConfig(GIFT)), shippedBefore);
  assert.ok(!renderDemo(GIFT).includes('Gifting Day'));
  assert.ok(renderDemo(GIFT).includes('Boyfriend’s Day'), 'shipped copy is back');
});

/* ------------------------------------------------------------- clones */

test('studio: a clone keeps the layout and takes its own copy, name, category and listing', () => {
  const made = studio.createClone(GIFT, { ...CLONE });
  assert.equal(made.ok, true, made.errors.join(' | '));
  const saved = studio.save('anniversary-tohfa', giftForm({ meta_name: 'Anniversary Tohfa', meta_category: 'Anniversary', meta_description: 'A candy keepsake site for anniversaries.', price: '199', status: 'published' }));
  assert.equal(saved.ok, true, saved.errors.join(' | '));

  const entry = family.bySlug('anniversary-tohfa');
  assert.ok(entry, 'clone is live in the family');
  assert.equal(entry.config.name, 'Anniversary Tohfa');
  assert.equal(entry.config.category, 'Anniversary');
  assert.equal(entry.config.family, 'bfday');
  assert.deepEqual(entry.config.fields.find(f => f.id === 'words').default, ['my forever,', 'my home,', 'my yes.']);
  const tpl = q.templateBySlug('anniversary-tohfa');
  assert.equal(tpl.status, 'published');
  assert.equal(tpl.price, 199);
  assert.equal(tpl.name, 'Anniversary Tohfa');

  const html = renderDemo('anniversary-tohfa');
  assert.ok(html.includes('Anniversary, my love'));
  assert.ok(html.includes('my forever,'));
  // same layout as the shipped template; the empty third polaroid row was dropped, so two polaroids show
  assert.equal((html.match(/class="flip"/g) || []).length, 2);
  assert.equal((html.match(/class="bqt"/g) || []).length, 3);
  // the layout's own images are kept for the sample
  assert.equal(entry.config.demo.photos[0].photo, family.bySlug(GIFT).config.demo.photos[0].photo);
  assert.equal(family.bySlug(GIFT).config.name, 'Tohfa', 'the built-in is untouched by its clone');
});

test('studio: the clone’s own defaults fill a blank buyer form through the wrapper', () => {
  const entry = family.bySlug('anniversary-tohfa');
  const blank = entry.render({ customer_data: {} }, { baseUrl: 'https://paigaam.cc' });
  assert.ok(blank.includes('Anniversary, my love'), 'blank occasion line falls back to the clone copy');
  assert.ok(blank.includes('my forever,'));
});

test('studio: hostile copy is escaped in the clone, and never reaches the page raw', () => {
  const r = studio.save('anniversary-tohfa', giftForm({ f_letterText: 'thanks <script>alert(1)</script>', f_occasionLine: 'happy <img src=x onerror=alert(1)>', meta_name: 'Anniversary Tohfa', meta_category: 'Anniversary', meta_description: 'd', price: '199', status: 'published' }));
  assert.equal(r.ok, true, r.errors.join(' | '));
  const html = renderDemo('anniversary-tohfa');
  assert.ok(!html.includes('<script>alert(1)'), 'no raw script');
  assert.ok(!html.includes('<img src=x'), 'no raw img');
  assert.ok(html.includes('&lt;script&gt;'), 'escaped script');
});

test('studio: a clone survives a restart — removed from memory, then rebuilt from storage', () => {
  studio.save('anniversary-tohfa', giftForm({ meta_name: 'Anniversary Tohfa Deluxe', meta_category: 'Anniversary', meta_description: 'd', price: '199', status: 'published', f_occasionLine: 'happy Anniversary, Deluxe' }));
  family.remove('anniversary-tohfa');
  assert.equal(family.has('anniversary-tohfa'), false);
  const restored = studio.loadSaved();
  assert.ok(restored.loaded.includes('anniversary-tohfa'), JSON.stringify(restored));
  assert.equal(family.bySlug('anniversary-tohfa').config.name, 'Anniversary Tohfa Deluxe');
  assert.ok(renderDemo('anniversary-tohfa').includes('Anniversary, Deluxe'));
});

test('studio: a clone with paigaams cannot be deleted; an unused one can', () => {
  const tpl = q.templateBySlug('anniversary-tohfa');
  const paid = q.paigaamInsert({ template_id: tpl.id, customer_data: {}, customer_name: 'Aarav' });
  assert.match(studio.deleteClone('anniversary-tohfa').errors[0], /already has paigaams/);
  assert.equal(family.has('anniversary-tohfa'), true);
  q.paigaamDelete(paid.id);
  assert.equal(studio.deleteClone('anniversary-tohfa').ok, true);
  assert.equal(family.has('anniversary-tohfa'), false);
  assert.ok(!q.templateBySlug('anniversary-tohfa'), 'template row removed');
});

test('studio: built-ins cannot be deleted and clones cannot be reset', () => {
  assert.equal(studio.deleteClone(GIFT).ok, false);
  studio.createClone(GIFT, { ...CLONE, new_slug: 'reset-check-tohfa' });
  assert.equal(studio.resetBuiltIn('reset-check-tohfa').ok, false);
  assert.equal(studio.deleteClone('reset-check-tohfa').ok, true);
});

test('studio: after all of this, every family member still passes the contract check', () => {
  assert.deepEqual(family.errors, []);
  for (const t of family.list) {
    assert.ok(t.render({ customer_data: t.config.demo }, { baseUrl: 'https://paigaam.cc', isPreview: true }).includes('</html>'), t.slug);
  }
  assert.equal(JSON.stringify(family.shippedConfig(GIFT)), shippedBefore, 'shipped layout never mutated');
});
