'use strict';
/**
 * Canva Connect REST client (server-side only). OAuth Authorization Code + PKCE (S256),
 * refresh-token rotation behind a mutex, timeouts, 429 Retry-After handling, safe errors.
 * Tokens are sealed at rest and never logged or returned to callers.
 */
const crypto = require('node:crypto');
const cfg = require('./config');
const store = require('./store');
const box = require('./secretbox');

const SAFE_MESSAGES = {
  canva_not_connected: 'The Canva account is not connected. An admin needs to reconnect it.',
  canva_reauth_required: 'Canva access expired. An admin needs to reconnect the Canva account.',
  canva_auth: 'Canva refused the request. An admin should check the Canva connection and permissions.',
  canva_not_found: 'Canva could not find the magazine template.',
  canva_rejected: 'Canva rejected the request.',
  canva_rate_limited: 'Canva is busy right now. Please try again in a minute.',
  canva_timeout: 'Canva took too long to respond. Please try again.',
  canva_unavailable: 'Canva is temporarily unavailable. Please try again shortly.',
  canva_job_failed: 'Canva could not finish this step. Please try again.',
  canva_job_timeout: 'Canva is taking longer than usual. Please try again in a moment.',
  download_failed: 'The finished file could not be saved. Please try again.',
  template_mismatch: 'This magazine design is being updated. Please try again later.',
  template_unavailable: 'This magazine is not available right now.',
  interrupted: 'The server restarted while generating. Please try again.',
};
const safeMessage = (code) => SAFE_MESSAGES[code] || 'Something went wrong while creating your magazine. Please try again.';

class CanvaError extends Error {
  constructor(code, opts = {}) {
    super(code);
    this.code = code;
    this.status = opts.status || 0;
    this.retryable = opts.retryable !== false;
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function timedFetch(url, init, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(timer); }
}

/* ---------------- OAuth ---------------- */
function newPkce() {
  const verifier = b64url(crypto.randomBytes(48));
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}
function beginAuthorization({ baseUrl, adminId }) {
  const { verifier, challenge } = newPkce();
  const state = store.newOAuthState(verifier, adminId);
  const q = new URLSearchParams({
    code_challenge: challenge, code_challenge_method: 's256', scope: cfg.SCOPES.join(' '),
    response_type: 'code', client_id: cfg.clientId(), state, redirect_uri: cfg.redirectUri(baseUrl),
  });
  return `${cfg.authorizeUrl()}?${q}`;
}
async function tokenRequest(params) {
  const basic = Buffer.from(`${cfg.clientId()}:${cfg.clientSecret()}`).toString('base64');
  let res;
  try {
    res = await timedFetch(cfg.apiBase() + '/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    }, 20000);
  } catch (e) { throw new CanvaError(e.name === 'AbortError' ? 'canva_timeout' : 'canva_unavailable'); }
  let json = null; try { json = await res.json(); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json };
}
async function completeAuthorization({ code, state, baseUrl, adminId }) {
  const saved = store.takeOAuthState(state, cfg.OAUTH_STATE_TTL_MS);
  if (!saved) throw new CanvaError('oauth_state_invalid', { retryable: false });
  if (saved.adminId && String(saved.adminId) !== String(adminId)) throw new CanvaError('oauth_state_invalid', { retryable: false });
  const r = await tokenRequest({ grant_type: 'authorization_code', code, code_verifier: saved.verifier, redirect_uri: cfg.redirectUri(baseUrl) });
  if (!r.ok || !r.json || !r.json.access_token || !r.json.refresh_token) throw new CanvaError('canva_auth', { status: r.status, retryable: false });
  store.saveTokens({ access: r.json.access_token, refresh: r.json.refresh_token, expiresIn: r.json.expires_in, scope: r.json.scope });
  try { store.setAccountLabel(await fetchAccountLabel()); } catch { /* label is cosmetic */ }
}
let refreshing = null;
async function getAccessToken(force = false) {
  const row = store.getConnection();
  if (!row || !row.refresh_enc) throw new CanvaError('canva_not_connected', { retryable: false });
  if (!force && row.access_enc && row.expires_at > Date.now() + 60000) return box.open(row.access_enc);
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}
async function doRefresh() {
  const row = store.getConnection();
  if (!row || !row.refresh_enc) throw new CanvaError('canva_not_connected', { retryable: false });
  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: box.open(row.refresh_enc) });
  if (!r.ok || !r.json || !r.json.access_token) {
    if (r.json && r.json.error === 'invalid_grant') { store.clearTokens(); throw new CanvaError('canva_reauth_required', { retryable: false }); }
    throw new CanvaError(r.status === 429 ? 'canva_rate_limited' : 'canva_unavailable', { status: r.status });
  }
  // Canva rotates refresh tokens: the new one MUST replace the old one atomically.
  store.saveTokens({ access: r.json.access_token, refresh: r.json.refresh_token || box.open(row.refresh_enc), expiresIn: r.json.expires_in, scope: r.json.scope });
  return r.json.access_token;
}
async function revokeConnection() {
  const row = store.getConnection();
  if (row && row.refresh_enc) {
    try { await tokenRequest2('/oauth/revoke', { token: box.open(row.refresh_enc) }); } catch { /* best effort; local delete still happens */ }
  }
  store.deleteConnection();
}
async function tokenRequest2(pathname, params) {
  const basic = Buffer.from(`${cfg.clientId()}:${cfg.clientSecret()}`).toString('base64');
  return timedFetch(cfg.apiBase() + pathname, {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  }, 15000);
}

/* ---------------- REST ---------------- */
function mapHttpError(status, data) {
  const providerCode = data && typeof data.code === 'string' && /^[a-z_]{1,40}$/.test(data.code) ? data.code : '';
  if (status === 401 || status === 403) return new CanvaError('canva_auth', { status, retryable: false });
  if (status === 404) return new CanvaError('canva_not_found', { status, retryable: false });
  if (status === 429) return new CanvaError('canva_rate_limited', { status });
  if (status >= 500) return new CanvaError('canva_unavailable', { status });
  const e = new CanvaError('canva_rejected', { status, retryable: false });
  e.providerCode = providerCode;
  return e;
}
/** opts.transientRetry only for idempotent reads — never for job-creating POSTs (would risk duplicate designs). */
async function api(method, pathname, { json, body, headers = {}, timeoutMs = 30000, transientRetry = false } = {}) {
  let forced = false, rateTries = 0, transientTries = 0;
  for (;;) {
    const token = await getAccessToken(forced);
    let res;
    try {
      res = await timedFetch(cfg.apiBase() + pathname, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: json ? JSON.stringify(json) : body,
      }, timeoutMs);
    } catch (e) {
      if (transientRetry && transientTries++ < 2) { await sleep(300 * transientTries); continue; }
      throw new CanvaError(e.name === 'AbortError' ? 'canva_timeout' : 'canva_unavailable');
    }
    if (res.status === 401 && !forced) { forced = true; continue; }
    if (res.status === 429 && rateTries++ < 3) {
      const wait = Math.min((Number(res.headers.get('retry-after')) || 2) * 1000, cfg.retryAfterCapMs());
      await sleep(wait); continue;
    }
    if (res.status >= 500 && transientRetry && transientTries++ < 2) { await sleep(300 * transientTries); continue; }
    let data = null;
    try { const text = await res.text(); data = text ? JSON.parse(text) : null; } catch { /* leave null */ }
    if (!res.ok) throw mapHttpError(res.status, data);
    return data;
  }
}
const enc = encodeURIComponent;
const getDataset = async (templateId) => ((await api('GET', `/brand-templates/${enc(templateId)}/dataset`, { transientRetry: true })) || {}).dataset || {};
const getBrandTemplate = async (id) => ((await api('GET', `/brand-templates/${enc(id)}`, { transientRetry: true })) || {}).brand_template || {};
async function uploadAsset(buffer, name) {
  const nameB64 = Buffer.from(String(name).slice(0, 50)).toString('base64');
  return (await api('POST', '/asset-uploads', {
    body: buffer, timeoutMs: 90000,
    headers: { 'Content-Type': 'application/octet-stream', 'Asset-Upload-Metadata': JSON.stringify({ name_base64: nameB64 }) },
  })).job;
}
const getAssetUpload = async (id) => (await api('GET', `/asset-uploads/${enc(id)}`, { transientRetry: true })).job;
const createAutofill = async ({ templateId, data, title }) => (await api('POST', '/autofills', { json: { brand_template_id: templateId, title: String(title).slice(0, 200), data } })).job;
const getAutofill = async (id) => (await api('GET', `/autofills/${enc(id)}`, { transientRetry: true })).job;
const createExport = async (designId, type) => (await api('POST', '/exports', { json: { design_id: designId, format: { type } } })).job;
const getExport = async (id) => (await api('GET', `/exports/${enc(id)}`, { transientRetry: true })).job;
async function fetchAccountLabel() {
  const r = await api('GET', '/users/me/profile', { transientRetry: true });
  return String((r && r.profile && r.profile.display_name) || '').slice(0, 80);
}

/** Poll a Canva async job until success/failure; throws CanvaError otherwise. */
async function pollJob(fetchJob, jobId) {
  const deadline = Date.now() + cfg.jobTimeoutMs();
  for (;;) {
    const job = await fetchJob(jobId);
    if (job && job.status === 'success') return job;
    if (job && job.status === 'failed') {
      const e = new CanvaError('canva_job_failed');
      e.jobFailed = true;
      e.providerCode = job.error && typeof job.error.code === 'string' && /^[a-z_]{1,40}$/.test(job.error.code) ? job.error.code : '';
      throw e;
    }
    if (Date.now() > deadline) throw new CanvaError('canva_job_timeout');
    await sleep(cfg.pollMs());
  }
}
/** Download a Canva export URL (signed, expires in 24h). No auth header; https only (http allowed in test mode). */
async function downloadExport(url, maxBytes) {
  let u;
  try { u = new URL(url); } catch { throw new CanvaError('download_failed'); }
  if (u.protocol !== 'https:' && !(cfg.TEST && u.protocol === 'http:')) throw new CanvaError('download_failed', { retryable: true });
  let res;
  try { res = await timedFetch(u, {}, 90000); } catch { throw new CanvaError('download_failed'); }
  if (!res.ok) throw new CanvaError('download_failed');
  const declared = Number(res.headers.get('content-length')) || 0;
  if (declared > maxBytes) throw new CanvaError('download_failed', { retryable: false });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes || buf.length === 0) throw new CanvaError('download_failed');
  return buf;
}

module.exports = {
  CanvaError, safeMessage, beginAuthorization, completeAuthorization, revokeConnection, getAccessToken,
  getDataset, getBrandTemplate, uploadAsset, getAssetUpload, createAutofill, getAutofill, createExport, getExport,
  fetchAccountLabel, pollJob, downloadExport,
};
