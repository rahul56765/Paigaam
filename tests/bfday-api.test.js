'use strict';
// Run via: node scripts/test-bfday.js   (boots an isolated server)
// API + as-served HTML checks for EVERY Boyfriend Day family member
// (templates/bfday.js, plus the test-only all-field-types fixture). Modelled
// on tests/maafi-api.test.js: ownership, CSRF, generic-endpoint refusals,
// validation, escape audit, the stateless live preview, idempotent publish,
// photo uploads. New templates are covered without touching this file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const family = require('../lib/bfday/family');
const { resolve, maxImages } = require('../lib/bfday/fields');
const { request, draft, hostileFor, png, firstText } = require('./bfday-helpers');

assert.ok(family.list.length, 'no family members loaded');

/** Put an upload URL into the first photo slot the template has. */
function withImage(t, data, url) {
  const out = JSON.parse(JSON.stringify(data));
  const top = t.fields.find(f => f.type === 'image');
  if (top) { out[top.id] = url; return out; }
  const list = t.fields.find(f => f.type === 'list' && ((f.item && f.item.type === 'image') || (f.shape && f.shape.some(s => s.type === 'image'))));
  if (!list) return null;
  const items = resolve(t.config, data, t.schema)[list.id];
  if (list.item) out[list.id] = [url, ...items.filter(x => typeof x === 'string' && x).slice(1)].slice(0, list.maxItems);
  else {
    const slot = list.shape.find(s => s.type === 'image').id;
    const rows = items.length ? items : [{}];
    rows[0] = { ...rows[0], [slot]: url };
    for (const s of list.shape) if (s.required && !rows[0][s.id]) rows[0][s.id] = 'x';
    out[list.id] = rows;
  }
  return out;
}

for (const t of family.list) {
  const S = t.slug;
  const demo = t.config.demo;
  const name = firstText(t);

  test(`${S} · routes: wizard, demo, detail page, thumbnail, gallery card, assets`, async () => {
    const create = await request('/create/' + S);
    assert.equal(create.status, 200);
    assert.match(create.text, /id="bfForm"/);
    assert.match(create.text, /id="liveFrame"/);
    assert.match(create.text, /id="bfSpec"/);
    assert.match(create.text, /\/js\/qr-card\.js/);
    assert.match(create.text, /id="publishedUrl"/);
    assert.match(create.text, /<figure class="qr">/);
    for (const f of t.fields) {
      if (f.type === 'list') assert.match(create.text, new RegExp(`data-list="${f.id}"`), f.id);
      else if (f.type === 'image') assert.match(create.text, new RegExp(`data-image="${f.id}"`), f.id);
      else assert.match(create.text, new RegExp(`id="f-${f.id}"`), f.id);
    }
    const demoPage = await request(`/${S}/demo`);
    assert.equal(demoPage.status, 200);
    assert.match(demoPage.text, /data-preview="true"/);
    assert.match(demoPage.text, /noindex/);
    const detail = await request('/templates/' + S);
    assert.equal(detail.status, 200);
    assert.match(detail.text, new RegExp(`src="/${S}/demo"`));
    assert.match(detail.text, new RegExp(`href="/create/${S}"`));
    assert.equal((await request('/template-view/' + S)).status, 200);
    const gallery = await request('/templates');
    assert.match(gallery.text, new RegExp(`href="/templates/${S}"`));
    for (const asset of ['/bfday/create.js', '/bfday/create.css']) assert.equal((await request(asset)).status, 200, asset);
    for (const m of demoPage.text.matchAll(new RegExp(`(?:href|src)="(/${S}/[^"]+)"`, 'g'))) {
      assert.equal((await request(m[1])).status, 200, m[1]);
    }
  });

  test(`${S} · API: draft → owner preview → publish → live page with OG → QR; publish is idempotent`, async () => {
    const a = await draft(S, demo);
    assert.match(a.cookie, /^paigaam_creator=[a-f0-9]{64}$/);
    const own = await request(a.previewUrl, { cookie: a.cookie });
    assert.equal(own.status, 200);
    assert.match(own.text, /data-preview="true"/);
    assert.match(own.text, /noindex/);
    const redirect = await request('/preview/' + a.id, { cookie: a.cookie });
    assert.equal(redirect.status, 303);
    assert.match(redirect.headers.get('location'), new RegExp(`/${S}/preview/${a.id}$`));

    const pub = await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: { id: a.id } });
    assert.equal(pub.status, 200, pub.text);
    assert.match(pub.json.slug, new RegExp(`^${S}-[a-f0-9]{18}$`));
    const live = await request('/p/' + pub.json.slug);
    assert.equal(live.status, 200);
    assert.match(live.text, /data-preview="false"/);
    assert.doesNotMatch(live.text, /noindex/);
    assert.match(live.text, /<meta property="og:title" content="[^"]+">/);
    assert.match(live.text, /<meta property="og:description" content="[^"]+">/);
    assert.match(live.text, /<meta property="og:image" content="https?:\/\/[^"]+">/);
    assert.ok(live.text.includes(`<meta property="og:url" content="${pub.json.url}">`), 'og:url is the public link');
    if (name && demo[name.id]) assert.ok(live.text.includes(demo[name.id]), 'sender text on the live page');

    const qr = await request('/api/qr?url=' + encodeURIComponent(pub.json.url));
    assert.equal(qr.status, 200);
    assert.match(qr.text, /<svg/);

    const again = await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: { id: a.id } });
    assert.equal(again.status, 200);
    assert.equal(again.json.slug, pub.json.slug);
    // Published is final: no more edits.
    const edit = await request(`/api/${S}/draft`, { method: 'POST', cookie: a.cookie, body: { id: a.id, customer_data: demo } });
    assert.equal(edit.status, 403);
  });

  test(`${S} · API: strangers cannot preview, edit, upload to or publish another creator's draft`, async () => {
    const a = await draft(S, demo);
    for (const stranger of [undefined, 'paigaam_creator=' + 'f'.repeat(64), a.cookie + 'x', 'paigaam_creator=nothex']) {
      for (const path of [a.previewUrl, '/preview/' + a.id]) {
        assert.equal((await request(path, { cookie: stranger })).status, 403, `${path} as ${stranger}`);
      }
      assert.equal((await request(`/api/${S}/draft`, { method: 'POST', cookie: stranger, body: { id: a.id, customer_data: demo } })).status, 403);
      assert.equal((await request(`/api/${S}/publish`, { method: 'POST', cookie: stranger, body: { id: a.id } })).status, 403);
      assert.equal((await request(`/api/${S}/upload?id=${a.id}`, { method: 'POST', cookie: stranger, raw: png(), type: 'image/png' })).status, 403);
    }
    // Unknown ids and ids of other templates are simply not found.
    assert.equal((await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: { id: 'nope' } })).status, 404);
    assert.equal((await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: {} })).status, 404);
    assert.equal((await request(`/${S}/preview/nope`, { cookie: a.cookie })).status, 404);
  });

  test(`${S} · API: cross-site writes are refused`, async () => {
    const a = await draft(S, demo);
    for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
      assert.equal((await request(`/api/${S}/draft`, { method: 'POST', cookie: a.cookie, headers, body: { id: a.id, customer_data: demo } })).status, 403);
      assert.equal((await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, headers, body: { id: a.id } })).status, 403);
      assert.equal((await request(`/${S}/preview-frame`, { method: 'POST', headers, body: { customer_data: demo } })).status, 403);
    }
  });

  test(`${S} · API: the generic template endpoints cannot touch a family draft`, async () => {
    const a = await draft(S, demo);
    for (const body of [{ template: S, customer_data: demo }, { template: 'noor', id: a.id, customer_data: { brideName: 'OVERWRITE' } }]) {
      assert.equal((await request('/api/drafts', { method: 'POST', body })).status, 403);
    }
    assert.equal((await request('/api/free-publish', { method: 'POST', body: { id: a.id } })).status, 403);
    assert.equal((await request('/api/render-preview', { method: 'POST', body: { template: S, customer_data: demo } })).status, 403);
    assert.equal((await request('/go/whatsapp/' + a.id)).status, 403);
    const after = await request(a.previewUrl, { cookie: a.cookie });
    assert.doesNotMatch(after.text, /OVERWRITE/);
  });

  test(`${S} · API: validation — shapes, lengths, newlines, control characters, required-on-publish`, async () => {
    const invalid = [['missing data', undefined], ['null data', null], ['array data', []], ['string data', 'x']];
    for (const f of t.fields) {
      if (f.type === 'text' || f.type === 'textarea') {
        invalid.push([`${f.id} overlong`, { ...demo, [f.id]: 'x'.repeat(f.maxLength + 1) }]);
        invalid.push([`${f.id} control char`, { ...demo, [f.id]: 'a\u0007' }]);
        invalid.push([`${f.id} wrong type`, { ...demo, [f.id]: 12 }]);
      }
      if (f.type === 'text') invalid.push([`${f.id} newline`, { ...demo, [f.id]: 'a\nb' }]);
      if (f.type === 'image') invalid.push([`${f.id} data url`, { ...demo, [f.id]: 'data:image/png;base64,AAAA' }]);
      if (f.type === 'list') {
        invalid.push([`${f.id} not a list`, { ...demo, [f.id]: 'x' }]);
        invalid.push([`${f.id} too many`, { ...demo, [f.id]: Array.from({ length: f.maxItems + 1 }, () => (f.item ? 'x' : {})) }]);
        if (f.item && (f.item.type === 'text' || f.item.type === 'textarea')) invalid.push([`${f.id} overlong item`, { ...demo, [f.id]: ['x'.repeat(f.item.maxLength + 1)] }]);
      }
    }
    for (const [label, customer_data] of invalid) {
      const r = await request(`/api/${S}/draft`, { method: 'POST', body: customer_data === undefined ? {} : { customer_data } });
      assert.equal(r.status, 400, label);
      assert.equal(r.json.error, 'validation', label);
    }
    // Not JSON at all.
    assert.equal((await request(`/api/${S}/draft`, { method: 'POST', raw: 'id=1', type: 'application/x-www-form-urlencoded' })).status, 400);
    assert.equal((await request(`/api/${S}/draft`, { method: 'POST', raw: '{broken', type: 'application/json' })).status, 400);
    assert.equal((await request(`/api/${S}/draft`, { method: 'POST', raw: JSON.stringify({ customer_data: { x: 'y'.repeat(70000) } }), type: 'application/json' })).status, 413);

    // Drafts may be saved with required fields blank (so photos can upload early) — but never published.
    const required = t.fields.filter(f => f.required);
    if (required.length) {
      const blank = { ...demo };
      for (const f of required) blank[f.id] = '';
      const a = await draft(S, blank);
      const pub = await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: { id: a.id } });
      assert.equal(pub.status, 400);
      assert.equal(pub.json.error, 'validation');
    }

    // Unknown keys never persist.
    const a = await draft(S, { ...demo, evilKey: '<script>alert(1)</script>' });
    const own = await request(a.previewUrl, { cookie: a.cookie });
    assert.doesNotMatch(own.text, /evilKey/);
    assert.doesNotMatch(own.text, /<script>alert/);
  });

  test(`${S} · HTML: every piece of sender text is escaped — preview, live page, preview frame`, async () => {
    const hostile = { ...demo, ...hostileFor(t.fields) };
    const a = await draft(S, hostile);
    const pages = [(await request(a.previewUrl, { cookie: a.cookie })).text];
    const pub = await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: { id: a.id } });
    assert.equal(pub.status, 200, pub.text);
    pages.push((await request('/p/' + pub.json.slug)).text);
    pages.push((await request(`/${S}/preview-frame`, { method: 'POST', body: { customer_data: hostile } })).text);
    for (const html of pages) {
      assert.doesNotMatch(html, /<script>alert|<img src=x|"><script>/);
    }
  });

  test(`${S} · live preview: renders typed data (GET and POST), defaults on garbage, never 500, read-only`, async () => {
    if (name) {
      const typed = { ...demo, [name.id]: 'अनोखा' };
      const get = await request(`/${S}/preview-frame?d=` + encodeURIComponent(JSON.stringify(typed)));
      assert.equal(get.status, 200);
      assert.match(get.text, /अनोखा/);
      const post = await request(`/${S}/preview-frame`, { method: 'POST', body: { customer_data: typed } });
      assert.equal(post.status, 200);
      assert.match(post.text, /अनोखा/);
      assert.equal(post.headers.get('x-frame-options'), 'SAMEORIGIN');
      assert.match(post.text, /noindex/);
    }
    for (const d of ['%7Bbroken', encodeURIComponent('[1,2]'), encodeURIComponent('null'), encodeURIComponent('{"' + (name ? name.id : 'x') + '":{"a":1}}')]) {
      const r = await request(`/${S}/preview-frame?d=` + d);
      assert.equal(r.status, 200, d);
      assert.match(r.text, /<!DOCTYPE html>/i);
    }
    for (const body of [{}, { customer_data: 'x' }, { customer_data: [1] }]) {
      assert.equal((await request(`/${S}/preview-frame`, { method: 'POST', body })).status, 200, JSON.stringify(body));
    }
    const put = await fetch(require('./bfday-helpers').BASE + `/${S}/preview-frame`, { method: 'PUT' });
    assert.equal(put.status, 404);
    // Nothing was stored by previewing.
    const count = await request('/p/' + S + '-000000000000000000');
    assert.equal(count.status, 404);
  });

  const cap = maxImages(t.fields);
  test(`${S} · photos: ${cap ? 'upload → owner-only until published → public, replaced photos swept' : 'this template takes none — uploads refused'}`, async () => {
    const a = await draft(S, demo);
    const up = (cookie, raw = png(), type = 'image/png', id = a.id) => request(`/api/${S}/upload?id=${encodeURIComponent(id)}`, { method: 'POST', cookie, raw, type });
    if (!cap) {
      assert.equal((await up(a.cookie)).status, 404);
      return;
    }
    // Rejections: wrong declared type, svg, tiny, not an image, mismatched type, no draft.
    assert.equal((await up(a.cookie, png(), 'image/svg+xml')).json.error, 'invalid_image');
    assert.equal((await up(a.cookie, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'.padEnd(80)), 'image/png')).json.error, 'invalid_image');
    assert.equal((await up(a.cookie, png(10, 10))).json.error, 'invalid_image');
    assert.equal((await up(a.cookie, png(), 'image/jpeg')).json.error, 'invalid_image');
    assert.equal((await up(a.cookie, Buffer.alloc(2.5 * 1024 * 1024), 'image/png')).status, 413);
    assert.equal((await up(a.cookie, png(), 'image/png', 'nope')).status, 404);

    const first = await up(a.cookie);
    assert.equal(first.status, 200, first.text);
    assert.match(first.json.url, /^\/bfday\/uploads\/[a-f0-9]{48}\.png$/);
    const second = await up(a.cookie, png(80, 80, [10, 200, 30]));
    assert.equal(second.status, 200);

    // Owner sees it; strangers do not, even with the exact URL.
    assert.equal((await request(first.json.url, { cookie: a.cookie })).status, 200);
    assert.equal((await request(first.json.url)).status, 404);
    assert.equal((await request('/bfday/uploads/' + 'a'.repeat(48) + '.png')).status, 404);
    assert.equal((await request('/bfday/uploads/../../db.js')).status, 404);

    // A brand-new draft cannot smuggle in upload references…
    const smuggle = withImage(t, demo, first.json.url);
    assert.equal((await request(`/api/${S}/draft`, { method: 'POST', body: { customer_data: smuggle } })).status, 400);
    // …and another creator's draft cannot reference this draft's photo.
    const b = await draft(S, demo);
    assert.equal((await request(`/api/${S}/draft`, { method: 'POST', cookie: b.cookie, body: { id: b.id, customer_data: smuggle } })).status, 403);

    // Use the second photo, publish: it becomes public and the og:image; the replaced first photo is swept.
    const saved = await request(`/api/${S}/draft`, { method: 'POST', cookie: a.cookie, body: { id: a.id, customer_data: withImage(t, demo, second.json.url) } });
    assert.equal(saved.status, 200, saved.text);
    const pub = await request(`/api/${S}/publish`, { method: 'POST', cookie: a.cookie, body: { id: a.id } });
    assert.equal(pub.status, 200, pub.text);
    const live = await request('/p/' + pub.json.slug);
    assert.ok(live.text.includes(second.json.url), 'the photo renders on the live page');
    assert.equal((await request(second.json.url)).status, 200, 'published photos are public');
    assert.equal((await request(first.json.url, { cookie: a.cookie })).status, 404, 'unused photos are swept at publish');
    assert.equal((await up(a.cookie)).status, 403, 'no uploads to a published page');
  });
}

test('family · a family draft id is refused by every other member\'s endpoints', async () => {
  if (family.list.length < 2) return;
  const [x, y] = family.list;
  const a = await draft(x.slug, x.config.demo);
  assert.equal((await request(`/api/${y.slug}/publish`, { method: 'POST', cookie: a.cookie, body: { id: a.id } })).status, 404);
  assert.equal((await request(`/api/${y.slug}/draft`, { method: 'POST', cookie: a.cookie, body: { id: a.id, customer_data: y.config.demo } })).status, 404);
  assert.equal((await request(`/${y.slug}/preview/${a.id}`, { cookie: a.cookie })).status, 404);
});

test('family · unregistered slugs are not claimed by the engine', async () => {
  assert.equal((await request('/not-a-template/demo')).status, 404);
  assert.equal((await request('/api/not-a-template/draft', { method: 'POST', body: {} })).status, 404);
  // Existing templates keep their own routes.
  assert.equal((await request('/maafi/demo')).status, 200);
  assert.equal((await request('/create/maafi')).status, 200);
});
