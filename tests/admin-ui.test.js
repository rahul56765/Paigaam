'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const admin = require('../pages/admin');
const magazineViews = require('../lib/magazines/views');
const { head } = require('../lib/layout');

const stats = { templates: 1, paigaams: 2, orders: 3, published: 1 };
const login = admin.loginPage();
const pages = [
  admin.dashboard(stats, []),
  admin.templatesAdmin([]),
  admin.paigaamsAdmin([]),
  admin.ordersAdmin([]),
  admin.settingsAdmin({ whatsapp_number: '', business_name: '', currency: 'INR', contact_message: '' }, false),
];

test('shared page shell cache-busts the updated stylesheet', () => {
  assert.match(head('Admin test'), /href="\/css\/paigaam\.css\?v=20261028-creator-qa"/);
});

test('sign-in uses the studio surface and a focused, responsive credential form', () => {
  assert.match(login, /class="admin-login__layout"/);
  assert.match(login, /class="admin-login__story"/);
  assert.match(login, /class="admin-login__form"/);
  assert.match(login, /name="email"[^>]*autocomplete="username"/);
  assert.match(login, /name="password"[^>]*autocomplete="current-password"/);
});

test('desktop and mobile navigation expose every core route and Paigaam tool', () => {
  for (const html of pages) {
    assert.match(html, /aria-label="Admin navigation"/);
    assert.match(html, /aria-label="Quick admin navigation"/);
    assert.match(html, /href="\/admin\/magazines"[^>]*>[\s\S]*?<span>Magazines<\/span>/);
    assert.match(html, /href="\/wedding-video"[^>]*>[\s\S]*?<span>Video templates<\/span>/);
    assert.match(html, /href="\/admin\/logout"[^>]*>[\s\S]*?<span>Sign out<\/span>/);
  }
});

test('admin navigation marks the current screen and nested admin paths', () => {
  const templates = admin.templatesAdmin([]);
  assert.match(templates, /href="\/admin\/templates"[^>]*aria-current="page"/);
  const dashboard = admin.dashboard(stats, []);
  assert.match(dashboard, /href="\/admin"[^>]*aria-current="page"/);
});

test('magazine admin shares mobile-ready navigation back to the dashboard and video templates', () => {
  const html = magazineViews.adminPage({ configured: false, connection: null, templates: [], orders: [], flash: '' });
  assert.match(html, /aria-label="Admin navigation"/);
  assert.match(html, /href="\/admin"[^>]*>Admin home<\/a>/);
  assert.match(html, /href="\/admin\/magazines" aria-current="page">Magazines<\/a>/);
  assert.match(html, /href="\/wedding-video">Video templates<\/a>/);
  assert.match(html, /class="mag-table-wrap"/);
});

test('magazine admin table cells expose labels for stacked phone cards', () => {
  const mapping = { name: 'Sample', slug: 'sample', canvaTemplateId: 'brand123', pageCount: 1, fields: [], images: [], adminManaged: false };
  const html = magazineViews.adminPage({ configured: false, connection: null, templates: [{ mapping, row: { status: 'draft', validation: {}, validated_at: null } }], orders: [], flash: '' });
  for (const label of ['Design', 'Canva template', 'Live check', 'Status', 'Actions']) assert.ok(html.includes(`data-label="${label}"`), label);
});

test('admin tables have a responsive horizontal scrolling container', () => {
  const dashboard = admin.dashboard(stats, [{
    customer_name: 'Test User', template_name: 'Sample', status: 'draft', payment_status: 'pending', created_at: '2026-10-11 00:00:00', id: 'test-id',
  }]);
  const templates = admin.templatesAdmin([{ name: 'Sample', category: 'Wedding', price: 0, currency: 'INR', status: 'draft', created_at: '2026-10-11 00:00:00', slug: 'sample', id: 'test-id' }]);
  const paigaams = admin.paigaamsAdmin([{ customer_name: 'Test User', template_name: 'Sample', created_at: '2026-10-11 00:00:00', payment_status: 'pending', status: 'draft', slug: '', id: 'test-id' }]);
  const orders = admin.ordersAdmin([{ id: '12345678', customer_name: 'Test User', template_name: 'Sample', amount: 0, currency: 'INR', status: 'pending', created_at: '2026-10-11 00:00:00', paigaam_id: 'test-id' }]);
  for (const html of [dashboard, templates, paigaams, orders]) assert.match(html, /class="admin__table-wrap"/);
  assert.match(dashboard, /class="admin__tool-card admin__tool-card--magazine" href="\/admin\/magazines"/);
  assert.match(dashboard, /class="admin__tool-card admin__tool-card--video" href="\/wedding-video"/);
  for (const html of [dashboard, templates, paigaams, orders]) assert.match(html, /data-label="/);

  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'paigaam.css'), 'utf8');
  assert.match(css, /\.admin__mobile-nav\s*\{/);
  assert.match(css, /\.admin__table-wrap \.table td::before\s*\{[^}]*content:\s*attr\(data-label\)/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'brand', 'admin-marble.svg')));
});
