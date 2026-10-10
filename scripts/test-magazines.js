'use strict';
// End-to-end over HTTP against a real server process + mocked Canva. Run: node scripts/test-magazines.js
const { spawn } = require('node:child_process'), { once } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const assert = require('node:assert/strict');
const { createCanvaMock, pngBuffer, goodDataset } = require('../tests/helpers/canvaMock');
const registry = require('../lib/magazines/registry');
const root = path.join(__dirname, '..');

(async () => {
  const sock = net.createServer(); sock.listen(0, '127.0.0.1'); await once(sock, 'listening');
  const port = sock.address().port; await new Promise(r => sock.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paigaam-mag-e2e-')), base = 'http://127.0.0.1:' + port;
  // Start from the pre-dynamic schema to verify additive migration and order-config backfill.
  const legacyDb = new (require('node:sqlite').DatabaseSync)(path.join(dir, 'paigaam.db'));
  legacyDb.exec(`CREATE TABLE magazine_templates (slug TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'draft', canva_template_id TEXT NOT NULL DEFAULT '', validation_json TEXT NOT NULL DEFAULT '{}', validated_at INTEGER, published_at INTEGER, updated_at INTEGER);
    CREATE TABLE magazine_orders (id TEXT PRIMARY KEY, template_slug TEXT NOT NULL, owner_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', fields_json TEXT NOT NULL DEFAULT '{}', design_id TEXT, autofill_job_id TEXT, pdf_job_id TEXT, png_job_id TEXT, pdf_file TEXT, png_file TEXT, error_code TEXT, error_stage TEXT, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ready_at INTEGER);
    INSERT INTO magazine_templates (slug,status,canva_template_id,validation_json,updated_at) VALUES ('birthday-collage','draft','EAHXVxrdrCk','{}',${Date.now()});
    INSERT INTO magazine_orders (id,template_slug,owner_hash,status,created_at,updated_at) VALUES ('${'f'.repeat(32)}','birthday-collage','${'a'.repeat(64)}','draft',${Date.now()},${Date.now()});`);
  legacyDb.close();
  const mock = await createCanvaMock({ dataset: {} });
  const m = registry.bySlug('birthday-collage');
  let server;
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', BASE_URL: base, DATA_DIR: dir, ADMIN_EMAIL: 'admin@test.local', ADMIN_PASSWORD: 'e2e-admin-pass',
    CANVA_TEST_MODE: '1', CANVA_API_BASE: mock.apiBase, CANVA_AUTHORIZE_URL: mock.base + '/authorize', CANVA_POLL_MS: '10', CANVA_JOB_TIMEOUT_MS: '5000', CANVA_RETRY_AFTER_CAP_MS: '20',
    CANVA_CLIENT_ID: 'test-client', CANVA_CLIENT_SECRET: 'test-secret', CANVA_TOKEN_ENCRYPTION_KEY: 'e2e-key-' + 'k'.repeat(40) };
  async function start() {
    server = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', x => { const t = x.toString(); if (!/ExperimentalWarning|trace-warnings/.test(t)) process.stderr.write(t); });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server start timeout')), 20000);
      server.stdout.on('data', c => { if (c.toString().includes('admin →')) { clearTimeout(timer); resolve(); } });
      server.on('exit', code => { clearTimeout(timer); reject(new Error('server exited ' + code)); });
    });
  }
  const stop = async () => { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } };

  const jar = () => { const c = {}; return { c, header: () => Object.entries(c).map(([k, v]) => k + '=' + v).join('; '), eat(res) { for (const s of res.headers.getSetCookie?.() || []) { const [kv] = s.split(';'); const i = kv.indexOf('='); if (/Max-Age=0/i.test(s)) delete c[kv.slice(0, i)]; else c[kv.slice(0, i)] = kv.slice(i + 1); } } }; };
  async function req(j, method, url, { body, headers = {}, raw = false } = {}) {
    const res = await fetch(base + url, { method, redirect: 'manual', headers: { ...(j ? { Cookie: j.header() } : {}), ...headers }, body });
    if (j) j.eat(res);
    return res;
  }
  const jsonReq = async (j, method, url, obj) => { const r = await req(j, method, url, { body: obj === undefined ? undefined : JSON.stringify(obj), headers: obj === undefined ? {} : { 'Content-Type': 'application/json' } }); let b = {}; try { b = await r.json(); } catch { /* none */ } return { status: r.status, body: b, res: r }; };
  const put = (j, id, slot, buf, type) => req(j, 'PUT', `/api/magazines/drafts/${id}/photos/${slot}`, { body: buf, headers: { 'Content-Type': type } });
  const waitFor = async (fn, ms = 10000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('timeout'); await new Promise(r => setTimeout(r, 40)); } };
  let pass = 0; const ok = (name) => { pass++; console.log('  ✓ ' + name); };

  try {
    await start();
    console.log('magazines e2e');

    /* --- existing flows are untouched --- */
    for (const url of ['/', '/templates', '/healthz', '/contact']) assert.equal((await req(null, 'GET', url)).status, 200, url + ' still serves');
    ok('existing public pages and health check unaffected');
    const migrated = new (require('node:sqlite').DatabaseSync)(path.join(dir, 'paigaam.db'));
    const templateColumns = migrated.prepare('PRAGMA table_info(magazine_templates)').all().map(c => c.name);
    const orderColumns = migrated.prepare('PRAGMA table_info(magazine_orders)').all().map(c => c.name);
    assert.ok(templateColumns.includes('mapping_json') && orderColumns.includes('mapping_json'));
    const legacyTemplate = JSON.parse(migrated.prepare("SELECT mapping_json FROM magazine_templates WHERE slug='birthday-collage'").get().mapping_json);
    const legacyOrder = JSON.parse(migrated.prepare("SELECT mapping_json FROM magazine_orders WHERE id=?").get('f'.repeat(32)).mapping_json);
    assert.equal(legacyTemplate.canvaTemplateId, 'EAHXVxrdrCk');
    assert.equal(legacyOrder.slug, 'birthday-collage');
    migrated.close();
    ok('additive migration seeds existing mapping and snapshots legacy orders without losing their config');

    /* --- nothing public until admin connects + validates + publishes --- */
    assert.equal((await req(null, 'GET', '/magazines')).status, 200);
    assert.ok(!(await (await req(null, 'GET', '/magazines')).text()).includes('Birthday Collage Poster'));
    assert.equal((await req(null, 'GET', '/magazines/birthday-collage')).status, 404);
    assert.equal((await req(null, 'GET', '/magazines/birthday-story')).status, 404);
    assert.equal((await jsonReq(jar(), 'POST', '/api/magazines/drafts', { slug: 'birthday-collage' })).status, 404);
    assert.equal((await jsonReq(jar(), 'POST', '/api/magazines/drafts', { slug: 'birthday-story' })).status, 404);
    assert.equal((await req(null, 'GET', '/admin/magazines')).status, 302);
    assert.equal((await req(null, 'POST', '/admin/magazines/birthday-collage/publish')).status, 302); // anonymous => login redirect
    ok('unpublished magazines are invisible; admin routes require login');

    /* --- admin login + Canva OAuth (PKCE) --- */
    const admin = jar();
    const login = await req(admin, 'POST', '/admin/login', { body: 'email=admin%40test.local&password=e2e-admin-pass', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    assert.ok([302, 303].includes(login.status));
    const page0 = await (await req(admin, 'GET', '/admin/magazines')).text();
    assert.match(page0, /Not connected/); assert.ok(!/CANVA_CLIENT_SECRET.{0,40}test-secret/.test(page0));
    assert.match(page0, /Birthday Story/); assert.match(page0, /EAHXVwHhiXs/); assert.match(page0, /Draft/);
    const csrf = await req(admin, 'POST', '/admin/canva/disconnect', { headers: { Origin: 'https://evil.example' } });
    assert.equal(csrf.status, 403); // cross-origin admin POST rejected
    const conn = await req(admin, 'GET', '/admin/canva/connect');
    assert.equal(conn.status, 302);
    const authUrl = new URL(conn.headers.get('location'));
    assert.equal(authUrl.origin + authUrl.pathname, mock.base + '/authorize');
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 's256');
    assert.equal(authUrl.searchParams.get('redirect_uri'), base + '/admin/canva/callback');
    mock.st.challenge = authUrl.searchParams.get('code_challenge');
    const forged = await req(admin, 'GET', '/admin/canva/callback?code=good-code&state=forged');
    assert.match(decodeURIComponent(forged.headers.get('location')), /expired or was invalid/);
    const done = await req(admin, 'GET', `/admin/canva/callback?code=good-code&state=${authUrl.searchParams.get('state')}`);
    assert.match(decodeURIComponent(done.headers.get('location')), /connected/i);
    const anonCb = await req(null, 'GET', `/admin/canva/callback?code=good-code&state=x`);
    assert.equal(anonCb.status, 302); assert.match(anonCb.headers.get('location'), /\/admin\/login/);
    assert.match(await (await req(admin, 'GET', '/admin/magazines')).text(), /Paigaam Studio/);
    const sqlite = new (require('node:sqlite').DatabaseSync)(path.join(dir, 'paigaam.db'));
    const row = sqlite.prepare('SELECT access_enc, refresh_enc FROM canva_connection').get(); sqlite.close();
    assert.ok(row.access_enc.startsWith('v1:') && row.refresh_enc.startsWith('v1:') && !/AT-|RT-/.test(row.access_enc + row.refresh_enc));
    ok('OAuth connect: PKCE, state forgery rejected, admin-only, CSRF origin check, tokens sealed at rest');

    /* --- admin imports and configures a new magazine without changing source code --- */
    assert.equal((await req(null, 'GET', '/admin/magazines/new')).status, 302);
    assert.match(await (await req(admin, 'GET', '/admin/magazines')).text(), /Add magazine from Canva/);
    const adminDataset = { cover_photo: { type: 'image' }, reader_title: { type: 'text' } };
    mock.st.dataset = adminDataset;
    const imported = await req(admin, 'POST', '/admin/magazines/import', { body: 'canvaTemplateId=ADMINTEST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    assert.equal(imported.status, 200);
    const editorHtml = await imported.text();
    assert.match(editorHtml, /Mock template ADMINTEST/); assert.match(editorHtml, /cover_photo/); assert.match(editorHtml, /reader_title/);
    const configBuilder = require('../lib/magazines/templateConfig');
    const newMapping = configBuilder.fromDataset({ slug: 'admin-created-story', name: 'Admin Created Story', tagline: 'A new story.', canvaTemplateId: 'ADMINTEST', pageCount: 1, dataset: adminDataset });
    const saved = await jsonReq(admin, 'POST', '/admin/magazines/save', newMapping);
    assert.equal(saved.status, 200); assert.equal(saved.body.slug, 'admin-created-story');
    assert.equal((await req(null, 'GET', '/magazines/admin-created-story')).status, 404);
    const draftAdmin = await (await req(admin, 'GET', '/admin/magazines')).text();
    assert.match(draftAdmin, /Admin Created Story/); assert.match(draftAdmin, /Not validated/);
    const validation = await req(admin, 'POST', '/admin/magazines/admin-created-story/validate', {});
    assert.match(decodeURIComponent(validation.headers.get('location')), /fields match the live Canva/);
    const publication = await req(admin, 'POST', '/admin/magazines/admin-created-story/publish', {});
    assert.match(decodeURIComponent(publication.headers.get('location')), /now live/);
    const newForm = await req(null, 'GET', '/magazines/admin-created-story');
    assert.equal(newForm.status, 200); const newHtml = await newForm.text();
    assert.match(newHtml, /Photo 1/); assert.match(newHtml, /reader_title/);
    const edit = await (await req(admin, 'GET', '/admin/magazines/admin-created-story/edit')).text();
    assert.match(edit, /Unpublish before editing/);
    await req(admin, 'POST', '/admin/magazines/admin-created-story/unpublish', {});
    const editable = await (await req(admin, 'GET', '/admin/magazines/admin-created-story/edit')).text();
    assert.match(editable, /Save draft/);
    const reconfigured = { ...newMapping, tagline: 'Updated copy from admin.' };
    const savedEdit = await jsonReq(admin, 'POST', '/admin/magazines/save', reconfigured);
    assert.equal(savedEdit.status, 200);
    const afterEdit = await (await req(admin, 'GET', '/admin/magazines')).text();
    assert.match(afterEdit, /Admin Created Story[\s\S]{0,1500}Not validated[\s\S]{0,300}Draft/);
    const revalidated = await req(admin, 'POST', '/admin/magazines/admin-created-story/validate', {});
    assert.match(decodeURIComponent(revalidated.headers.get('location')), /match the live Canva/);
    const republished = await req(admin, 'POST', '/admin/magazines/admin-created-story/publish', {});
    assert.match(decodeURIComponent(republished.headers.get('location')), /now live/);
    ok('admin imports Canva title/dataset, configures a draft, validates, publishes, and protects published mappings');

    /* --- validate against the live dataset; mismatch blocks publish --- */
    mock.st.dataset = { ...goodDataset(m), photo_9: { type: 'text' }, rogue: { type: 'image' } };
    let r = await req(admin, 'POST', '/admin/magazines/birthday-collage/validate', {});
    assert.match(decodeURIComponent(r.headers.get('location')), /mismatch/i);
    const mismatchPage = await (await req(admin, 'GET', '/admin/magazines')).text();
    assert.match(mismatchPage, /type mismatch/); assert.match(mismatchPage, /unmapped in canva/);
    r = await req(admin, 'POST', '/admin/magazines/birthday-collage/publish', {});
    assert.match(decodeURIComponent(r.headers.get('location')), /Validate against Canva successfully/);
    assert.equal((await req(null, 'GET', '/magazines/birthday-collage')).status, 404);
    mock.st.dataset = goodDataset(m);
    r = await req(admin, 'POST', '/admin/magazines/birthday-collage/validate', {});
    assert.match(decodeURIComponent(r.headers.get('location')), /match the live Canva/);
    r = await req(admin, 'POST', '/admin/magazines/birthday-collage/publish', {});
    assert.match(decodeURIComponent(r.headers.get('location')), /now live/);
    assert.match(await (await req(null, 'GET', '/magazines')).text(), /Birthday Collage Poster/);
    const detail = await req(null, 'GET', '/magazines/birthday-collage');
    assert.equal(detail.status, 200); const detailHtml = await detail.text(); assert.match(detailHtml, /photo_1|Photo 1/);
    assert.match(detailHtml, /id="magBulk"[^>]*multiple/); // select-all-at-once picker
    assert.match(detailHtml, /class="mag-hero" src="\/magazines\/preview\/birthday-collage"/); // sample image on the design page
    const cat = await (await req(null, 'GET', '/magazines')).text(); assert.match(cat, /<img src="\/magazines\/preview\/birthday-collage"/); // sample on the catalogue card
    const prev = await req(null, 'GET', '/magazines/preview/birthday-collage');
    assert.equal(prev.status, 200); assert.equal(prev.headers.get('content-type'), 'image/png'); assert.ok((await prev.arrayBuffer()).byteLength > 50);
    for (const asset of ['/js/magazine-face-framing.mjs', '/js/magazine-face-detector-worker.js', '/vendor/mediapipe/vision_bundle.js', '/vendor/mediapipe/wasm/vision_wasm_internal.wasm', '/vendor/mediapipe/models/blaze_face_full_range_sparse.tflite']) {
      const response = await req(null, 'HEAD', asset);
      assert.equal(response.status, 200, `face-framing asset is served: ${asset}`);
      assert.ok(Number(response.headers.get('content-length')) > 1000, `asset is not empty: ${asset}`);
    }
    assert.equal((await req(null, 'GET', '/magazines/preview/nope')).status, 404);
    assert.equal((await req(null, 'GET', '/magazines/preview/..%2F..%2Fpaigaam')).status, 404);
    ok('publish is gated on a clean live-dataset validation; mismatch shows admin-facing detail');

    /* --- reader flow: ownership + upload validation --- */
    const alice = jar(), bob = jar();
    const created = await jsonReq(alice, 'POST', '/api/magazines/drafts', { slug: 'birthday-collage' });
    assert.equal(created.status, 201); const id = created.body.id; assert.match(id, /^[a-f0-9]{32}$/);
    assert.ok(alice.c.paigaam_mag && alice.c.paigaam_mag.length === 64);
    assert.equal((await put(null, id, 'photo_1', pngBuffer(500, 500), 'image/png')).status, 403); // no cookie
    assert.equal((await put(bob, id, 'photo_1', pngBuffer(500, 500), 'image/png')).status, 403); // someone else
    assert.equal((await put(alice, id, 'photo_1', Buffer.from('<?php echo 1; ?> not an image at all, definitely just text'), 'image/png')).status, 415); // content != type
    assert.equal((await put(alice, id, 'photo_1', pngBuffer(500, 500), 'image/jpeg')).status, 415); // claimed jpeg, real png
    assert.equal((await put(alice, id, 'photo_1', pngBuffer(500, 500), 'application/pdf')).status, 415);
    assert.equal((await put(alice, id, 'photo_1', pngBuffer(100, 100), 'image/png')).status, 422); // below minimum side
    assert.equal((await put(alice, id, 'nope_slot', pngBuffer(500, 500), 'image/png')).status, 404);
    assert.equal((await put(alice, id, '..%2F..%2Fetc', pngBuffer(500, 500), 'image/png')).status, 404); // traversal attempt
    assert.equal((await put(alice, id, 'photo_1', Buffer.alloc(9 * 1024 * 1024, 1), 'image/png')).status, 413); // over size limit
    assert.equal((await put(alice, id, 'photo_1', pngBuffer(500, 500), 'image/png')).status, 200);
    assert.equal((await req(alice, 'GET', `/api/magazines/drafts/${id}/photos/photo_1`)).status, 200); // owner sees own draft photo
    assert.equal((await req(bob, 'GET', `/api/magazines/drafts/${id}/photos/photo_1`)).status, 403);
    assert.equal((await req(null, 'GET', `/api/magazines/drafts/${id}/photos/photo_1`)).status, 403); // draft uploads are private
    ok('uploads: ownership enforced, MIME checked against contents, size/dimension limits, no traversal, drafts private');

    /* --- generation guards --- */
    let g = await jsonReq(alice, 'POST', `/api/magazines/drafts/${id}/generate`, {});
    assert.equal(g.status, 409); assert.equal(g.body.error, 'missing_photos'); assert.equal(g.body.details.length, 8);
    assert.equal((await jsonReq(alice, 'PUT', `/api/magazines/drafts/${id}`, { fields: { headline: 'x'.repeat(30) } })).status, 422);
    assert.equal((await jsonReq(bob, 'POST', `/api/magazines/drafts/${id}/generate`, {})).status, 403);
    for (let i = 2; i <= 9; i++) assert.equal((await put(alice, id, 'photo_' + i, pngBuffer(480, 480, [i * 20, 90, 120]), 'image/png')).status, 200);
    assert.equal((await jsonReq(alice, 'PUT', `/api/magazines/drafts/${id}`, { fields: { headline: 'Happy 30th', script: '<b>x</b>' } })).status, 200);
    assert.equal((await jsonReq(alice, 'GET', '/api/magazines/drafts/current?slug=birthday-collage')).body.order.slots.length, 9); // resumable draft
    ok('generation guards: missing photos, field limits, owner-only');

    /* --- generate (double submit) + status + downloads --- */
    const [g1, g2] = await Promise.all([jsonReq(alice, 'POST', `/api/magazines/drafts/${id}/generate`, {}), jsonReq(alice, 'POST', `/api/magazines/drafts/${id}/generate`, {})]);
    assert.ok([g1.status, g2.status].every(s => s === 202));
    const final = await waitFor(async () => { const s = (await jsonReq(null, 'GET', `/api/magazines/${id}/status`)).body; return s.status === 'ready' ? s : null; });
    assert.equal(mock.st.autofills.length, 1, 'double submit created exactly one design');
    assert.equal(mock.st.autofills[0].data.headline.text, 'Happy 30th'); assert.ok(!('script' in mock.st.autofills[0].data));
    assert.equal(final.files.pdf, `/magazines/m/${id}/magazine.pdf`); assert.equal(final.files.png, `/magazines/m/${id}/magazine.png`);
    assert.equal((await jsonReq(bob, 'PUT', `/api/magazines/drafts/${id}`, { fields: {} })).status, 403);
    assert.equal((await put(alice, id, 'photo_1', pngBuffer(500, 500), 'image/png')).status, 409); // locked once generated
    const result = await req(null, 'GET', `/magazines/m/${id}`);
    assert.equal(result.status, 200); const html = await result.text();
    assert.match(html, /class="mag-result-img" src="\/magazines\/m\/[a-f0-9]{32}\/magazine\.png"/); assert.ok(!html.includes('<object')); assert.match(html, /Download PDF/); assert.match(html, /Download PNG/);
    assert.match(result.headers.get('x-robots-tag') || '', /noindex/);
    const pdf = await req(null, 'GET', `/magazines/m/${id}/magazine.pdf`);
    assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.match(pdf.headers.get('content-disposition'), /^inline/);
    assert.equal((await pdf.arrayBuffer()).byteLength > 20, true);
    const dl = await req(null, 'GET', `/magazines/m/${id}/magazine.pdf?download=1`); assert.match(dl.headers.get('content-disposition'), /^attachment/);
    const rng = await req(null, 'GET', `/magazines/m/${id}/magazine.pdf`, { headers: { Range: 'bytes=0-4' } });
    assert.equal(rng.status, 206); assert.equal(Buffer.from(await rng.arrayBuffer()).toString(), '%PDF-');
    const png = await req(null, 'GET', `/magazines/m/${id}/magazine.png?download=1`); assert.equal(png.status, 200); assert.equal(png.headers.get('content-type'), 'image/png');
    assert.equal((await req(null, 'GET', `/magazines/m/${'0'.repeat(32)}/magazine.pdf`)).status, 404);
    assert.equal((await req(null, 'GET', `/magazines/m/${id}/..%2F..%2Fpaigaam.db`)).status, 404);
    assert.ok(fs.existsSync(path.join(dir, 'magazines', 'output', id, 'magazine.pdf')), 'file stored durably under DATA_DIR');
    assert.equal(fs.existsSync(path.join(dir, 'magazines', 'uploads', id)), false);
    assert.equal((await req(null, 'GET', `/api/magazines/drafts/${id}/photos/photo_1`)).status, 403); // private photos stay private after completion
    ok('double submit => one design; preview/download served from stored files; PNG offered (single page); capability links; ranges');

    /* --- failure + retry through the API --- */
    const carol = jar(); const c2 = (await jsonReq(carol, 'POST', '/api/magazines/drafts', { slug: 'birthday-collage' })).body.id;
    for (let i = 1; i <= 9; i++) await put(carol, c2, 'photo_' + i, pngBuffer(450, 450), 'image/png');
    mock.st.failNext.download = 1; const a0 = mock.st.autofills.length;
    await jsonReq(carol, 'POST', `/api/magazines/drafts/${c2}/generate`, {});
    const failed = await waitFor(async () => { const s = (await jsonReq(carol, 'GET', `/api/magazines/${c2}/status`)).body; return s.status === 'failed' ? s : null; });
    assert.equal(failed.error.code, 'download_failed'); assert.ok(failed.error.message && !/http|token|Bearer|AT-/.test(JSON.stringify(failed)));
    assert.match(await (await req(carol, 'GET', `/magazines/m/${c2}`)).text(), /Try again/);
    assert.ok(!/Try again/.test(await (await req(bob, 'GET', `/magazines/m/${c2}`)).text())); // retry is owner-only
    assert.equal((await jsonReq(bob, 'POST', `/api/magazines/drafts/${c2}/generate`, {})).status, 403);
    assert.equal((await req(null, 'GET', `/magazines/m/${c2}/magazine.pdf`)).status, 404); // nothing downloadable until ready
    assert.equal((await jsonReq(carol, 'GET', '/api/magazines/drafts/current?slug=birthday-collage')).body.order.slots.length, 9); // inputs preserved
    await jsonReq(carol, 'POST', `/api/magazines/drafts/${c2}/generate`, {});
    await waitFor(async () => (await jsonReq(carol, 'GET', `/api/magazines/${c2}/status`)).body.status === 'ready');
    assert.equal(mock.st.autofills.length - a0, 1, 'retry reused the saved design');
    ok('Canva failure is recoverable: data preserved, owner-only retry, no duplicate design, safe error text');

    /* --- admin sees orders; retry route; restart persistence --- */
    const adminPage = await (await req(admin, 'GET', '/admin/magazines')).text();
    assert.match(adminPage, new RegExp(c2.slice(0, 8))); assert.ok(!adminPage.includes(mock.st.tokens.access));
    await stop(); await start();
    assert.equal((await req(null, 'GET', `/magazines/m/${id}/magazine.pdf`)).status, 200);
    const admin2 = jar(); await req(admin2, 'POST', '/admin/login', { body: 'email=admin%40test.local&password=e2e-admin-pass', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    assert.match(await (await req(admin2, 'GET', '/admin/magazines')).text(), /Connected/);
    ok('state survives a restart (files, connection, orders)');

    /* --- disconnect blocks new generation --- */
    const dis = await req(admin2, 'POST', '/admin/canva/disconnect', {}); assert.match(decodeURIComponent(dis.headers.get('location')), /disconnected/i); assert.ok(mock.st.revoked);
    assert.equal((await req(null, 'GET', '/magazines/birthday-collage')).status, 404);
    assert.equal((await req(null, 'GET', `/magazines/m/${id}/magazine.pdf`)).status, 200); // finished magazines stay downloadable
    ok('disconnect revokes at Canva, hides creation, keeps finished downloads');

    console.log(`\nAll ${pass} magazine e2e groups passed.`);
  } catch (e) { console.error('\nFAILED:', e); process.exitCode = 1; }
  finally { await stop(); await mock.close(); fs.rmSync(dir, { recursive: true, force: true }); }
})();
