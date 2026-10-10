'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const admin = require('../pages/admin');
const magazineViews = require('../lib/magazines/views');

const stats = { templates: 1, paigaams: 2, orders: 3, published: 1 };
const pages = [
  admin.dashboard(stats, []),
  admin.templatesAdmin([]),
  admin.paigaamsAdmin([]),
  admin.ordersAdmin([]),
  admin.settingsAdmin({ whatsapp_number: '', business_name: '', currency: 'INR', contact_message: '' }, false),
];

test('admin navigation exposes core pages and Paigaam tools from every admin screen', () => {
  for (const html of pages) {
    assert.match(html, /aria-label="Admin navigation"/);
    assert.match(html, /href="\/admin\/magazines"[^>]*>Magazines<\/a>/);
    assert.match(html, /href="\/wedding-video"[^>]*>Video templates<\/a>/);
    assert.match(html, /href="\/admin\/logout"[^>]*>Sign out<\/a>/);
  }
});

test('admin navigation marks the current screen and nested admin paths', () => {
  const templates = admin.templatesAdmin([]);
  assert.match(templates, /href="\/admin\/templates" aria-current="page"/);
  const dashboard = admin.dashboard(stats, []);
  assert.match(dashboard, /href="\/admin" aria-current="page"/);
});

test('magazine admin shares mobile-ready navigation back to the dashboard and video templates', () => {
  const html = magazineViews.adminPage({ configured: false, connection: null, templates: [], orders: [], flash: '' });
  assert.match(html, /aria-label="Admin navigation"/);
  assert.match(html, /href="\/admin"[^>]*>Admin home<\/a>/);
  assert.match(html, /href="\/admin\/magazines" aria-current="page">Magazines<\/a>/);
  assert.match(html, /href="\/wedding-video">Video templates<\/a>/);
  assert.match(html, /class="mag-table-wrap"/);
});

test('admin tables have a responsive horizontal scrolling container', () => {
  const dashboard = admin.dashboard(stats, [{
    customer_name: 'Test User', template_name: 'Sample', status: 'draft', payment_status: 'pending', created_at: '2026-10-11 00:00:00', id: 'test-id',
  }]);
  const templates = admin.templatesAdmin([{ name: 'Sample', category: 'Wedding', price: 0, currency: 'INR', status: 'draft', created_at: '2026-10-11 00:00:00', slug: 'sample', id: 'test-id' }]);
  const paigaams = admin.paigaamsAdmin([{ customer_name: 'Test User', template_name: 'Sample', created_at: '2026-10-11 00:00:00', payment_status: 'pending', status: 'draft', slug: '', id: 'test-id' }]);
  const orders = admin.ordersAdmin([{ id: '12345678', customer_name: 'Test User', template_name: 'Sample', amount: 0, currency: 'INR', status: 'pending', created_at: '2026-10-11 00:00:00', paigaam_id: 'test-id' }]);
  for (const html of [dashboard, templates, paigaams, orders]) assert.match(html, /class="admin__table-wrap"/);

  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'paigaam.css'), 'utf8');
  assert.match(css, /\.admin__table-wrap\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*1020px\)/);
});
