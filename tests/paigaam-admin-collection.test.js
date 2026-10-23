'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../pages/admin');
const { templateCard } = require('../pages/homeCards');
const { gallery } = require('../pages/gallery');

test('Paigaam admin shows the generated date and time in the list and details', () => {
  const paigaam = {
    id: 'p1', template_name: 'Noor', template_slug: 'noor', customer_name: 'Ayesha',
    created_at: '2026-10-24 03:23:00', status: 'draft', payment_status: 'pending',
    customer_data: { brideName: 'Ayesha', groomName: 'Imran' }, template_price: 499,
    template_currency: 'INR', template_config: {},
  };
  const list = admin.paigaamsAdmin([paigaam]);
  const detail = admin.paigaamDetail(paigaam, 'https://paigaam.cc');
  assert.match(list, /24 Oct 2026/);
  assert.match(list, /08:53 am/); // 03:23 UTC → 08:53 India time
  assert.match(detail, /Created/);
  assert.match(detail, /08:53 am/);
});

test('template editor supports frame capture and image uploads for collection art', () => {
  const html = admin.templateForm({
    id: 't1', name: 'Noor', slug: 'noor', category: 'Wedding', price: 499,
    thumbnail_url: '', status: 'published', config: { fields: [], sections: [], theme: { bg: '#FBF4ED' } },
  }, false);
  assert.match(html, /Use current preview frame/);
  assert.match(html, /template-view\/noor/);
  assert.match(html, /type="file" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /html2canvas-1\.4\.1\.min\.js/);
  assert.match(html, /Captured or uploaded image/);
});

test('collection cards use saved thumbnails, while live preview iframes cannot autoplay audio', () => {
  const common = { slug: 'noor', name: 'Noor', category: 'Wedding', price: 499, config: { theme: { bg: '#fff', accent: '#900' } } };
  const withThumb = templateCard({ ...common, thumbnail_url: 'data:image/jpeg;base64,abc' });
  assert.match(withThumb, /class="tcard__poster"/);
  assert.match(withThumb, /data:image\/jpeg;base64,abc/);
  assert.doesNotMatch(withThumb, /class="tcard__live"/);
  const withoutThumb = templateCard({ ...common, thumbnail_url: '' });
  assert.match(withoutThumb, /class="tcard__live"/);
  assert.match(withoutThumb, /allow="autoplay 'none'"/);
  const collection = gallery([{ ...common, thumbnail_url: '' }]);
  assert.match(collection, /allow="autoplay &#39;none&#39;"/);
});
