'use strict';
/** In-process fake of the Canva Connect API surface Paigaam uses. No real credentials or network. */
const http = require('node:http');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

function crc32(buf) { let c, crc = 0xFFFFFFFF; for (const b of buf) { c = (crc ^ b) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function pngBuffer(w, h, rgb = [200, 80, 90]) {
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

function goodDataset(mapping) {
  const ds = {};
  for (const f of mapping.fields) ds[f.canvaName] = { type: f.type };
  for (const i of mapping.images) ds[i.canvaName] = { type: i.type };
  return ds;
}

function createCanvaMock({ dataset }) {
  const st = {
    dataset, challenge: null, tokens: { access: 'AT-1', refresh: 'RT-1', n: 1 }, validRefresh: new Set(),
    assets: 0, autofills: [], exports: [], uploads: [], refreshCalls: 0, authFailures: 0,
    jobPolls: {}, failNext: {}, rateLimitNext: 0, pages: 1, exportUrls: null, calls: [],
  };
  const jobs = {};
  const readBody = (req) => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
  const json = (res, code, obj, h = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(obj)); };
  let base = '';

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname.replace('/rest/v1', '');
    st.calls.push(`${req.method} ${p}`);
    const body = await readBody(req);

    if (req.method === 'POST' && p === '/oauth/token') {
      const basic = Buffer.from(String(req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString();
      if (basic !== 'test-client:test-secret') return json(res, 401, { error: 'invalid_client' });
      const f = new URLSearchParams(body.toString());
      if (f.get('grant_type') === 'authorization_code') {
        const ok = st.challenge && crypto.createHash('sha256').update(f.get('code_verifier') || '').digest('base64url') === st.challenge && f.get('code') === 'good-code';
        if (!ok) return json(res, 400, { error: 'invalid_grant' });
        st.validRefresh = new Set([st.tokens.refresh]);
        return json(res, 200, { access_token: st.tokens.access, refresh_token: st.tokens.refresh, expires_in: st.shortLived ? 30 : 14400, scope: 'asset:read asset:write' });
      }
      if (f.get('grant_type') === 'refresh_token') {
        st.refreshCalls++;
        if (!st.validRefresh.has(f.get('refresh_token'))) return json(res, 400, { error: 'invalid_grant' });
        st.validRefresh.delete(f.get('refresh_token')); // rotation: old refresh token is single-use
        st.tokens.n++; st.tokens.access = 'AT-' + st.tokens.n; st.tokens.refresh = 'RT-' + st.tokens.n; st.validRefresh.add(st.tokens.refresh);
        return json(res, 200, { access_token: st.tokens.access, refresh_token: st.tokens.refresh, expires_in: 14400 });
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    if (req.method === 'POST' && p === '/oauth/revoke') { st.revoked = true; return json(res, 200, {}); }

    if (req.method === 'GET' && p.startsWith('/files/')) { // unauthenticated signed-URL download
      if (st.failNext.download) { st.failNext.download--; res.writeHead(500); return res.end(); }
      if (p.endsWith('.pdf')) { res.writeHead(200, { 'Content-Type': 'application/pdf' }); return res.end(PDF); }
      res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(pngBuffer(40, 40));
    }

    if (req.headers.authorization !== `Bearer ${st.tokens.access}`) { st.authFailures++; return json(res, 401, { code: 'invalid_access_token', message: 'x' }); }
    if (st.rateLimitNext > 0) { st.rateLimitNext--; return json(res, 429, { code: 'too_many_requests' }, { 'Retry-After': '1' }); }

    if (req.method === 'GET' && p === '/users/me/profile') return json(res, 200, { profile: { display_name: 'Paigaam Studio' } });
    let m;
    if (req.method === 'GET' && (m = p.match(/^\/brand-templates\/([^/]+)\/dataset$/))) return json(res, 200, { dataset: st.dataset });
    if (req.method === 'POST' && p === '/asset-uploads') {
      if (req.headers['content-type'] !== 'application/octet-stream' || !req.headers['asset-upload-metadata']) return json(res, 400, { code: 'bad_request' });
      st.uploads.push({ bytes: body.length, magic: body.slice(0, 4).toString('hex') });
      const id = 'job-up-' + (++st.assets); jobs[id] = { kind: 'asset', n: st.assets };
      return json(res, 200, { job: { id, status: 'in_progress' } });
    }
    if (req.method === 'GET' && (m = p.match(/^\/asset-uploads\/([^/]+)$/))) {
      const j = jobs[m[1]]; if (!j) return json(res, 404, { code: 'not_found' });
      if (st.failNext.assetJob) { st.failNext.assetJob--; return json(res, 200, { job: { id: m[1], status: 'failed', error: { code: 'import_failed', message: 'private details' } } }); }
      return json(res, 200, { job: { id: m[1], status: 'success', asset: { id: 'ASSET' + j.n, type: 'image' } } });
    }
    if (req.method === 'POST' && p === '/autofills') {
      const b = JSON.parse(body.toString());
      st.autofills.push(b);
      const id = 'job-af-' + st.autofills.length; jobs[id] = { kind: 'autofill', n: st.autofills.length };
      return json(res, 200, { job: { id, status: 'in_progress' } });
    }
    if (req.method === 'GET' && (m = p.match(/^\/autofills\/([^/]+)$/))) {
      const j = jobs[m[1]]; if (!j) return json(res, 404, { code: 'not_found' });
      st.jobPolls[m[1]] = (st.jobPolls[m[1]] || 0) + 1;
      if (st.failNext.autofillJob) { st.failNext.autofillJob--; return json(res, 200, { job: { id: m[1], status: 'failed', error: { code: 'autofill_error', message: 'x' } } }); }
      if (st.jobPolls[m[1]] < 2) return json(res, 200, { job: { id: m[1], status: 'in_progress' } });
      return json(res, 200, { job: { id: m[1], status: 'success', result: { type: 'create_design', design: { id: 'DESIGN' + j.n } } } });
    }
    if (req.method === 'POST' && p === '/exports') {
      const b = JSON.parse(body.toString());
      st.exports.push(b);
      const id = 'job-ex-' + st.exports.length; jobs[id] = { kind: 'export', type: b.format.type, design: b.design_id };
      return json(res, 200, { job: { id, status: 'in_progress' } });
    }
    if (req.method === 'GET' && (m = p.match(/^\/exports\/([^/]+)$/))) {
      const j = jobs[m[1]]; if (!j) return json(res, 404, { code: 'not_found' });
      const n = Array.from({ length: st.pages }, (_, i) => `${base}/files/${j.design}-${i + 1}.${j.type}`);
      return json(res, 200, { job: { id: m[1], status: 'success', urls: j.type === 'pdf' ? [n[0]] : n } });
    }
    json(res, 404, { code: 'not_found' });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve({ st, server, base, apiBase: base + '/rest/v1', close: () => new Promise(r => server.close(r)) });
  }));
}
module.exports = { createCanvaMock, pngBuffer, goodDataset, PDF };
