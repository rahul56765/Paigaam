'use strict';
/**
 * Magazine feature configuration. Env var NAMES only — never values.
 *   CANVA_CLIENT_ID, CANVA_CLIENT_SECRET   Canva Developer Portal integration credentials
 *   CANVA_TOKEN_ENCRYPTION_KEY             >=32 chars; encrypts stored OAuth tokens (AES-256-GCM)
 *   CANVA_REDIRECT_URI                     optional; defaults to BASE_URL + /admin/canva/callback
 * Test-only (ignored unless CANVA_TEST_MODE=1): CANVA_API_BASE, CANVA_AUTHORIZE_URL,
 *   CANVA_POLL_MS, CANVA_JOB_TIMEOUT_MS, CANVA_RETRY_AFTER_CAP_MS
 */
const path = require('node:path');
const { DATA_DIR } = require('../../db');

const TEST = process.env.CANVA_TEST_MODE === '1';
const num = (name, fallback) => (TEST && Number(process.env[name])) || fallback;

module.exports = {
  TEST,
  ROOT: path.join(DATA_DIR, 'magazines'),
  apiBase: () => (TEST && process.env.CANVA_API_BASE ? process.env.CANVA_API_BASE : 'https://api.canva.com/rest/v1').replace(/\/$/, ''),
  authorizeUrl: () => (TEST && process.env.CANVA_AUTHORIZE_URL) || 'https://www.canva.com/api/oauth/authorize',
  // Least privilege for: dataset read, asset upload, autofill create, export, connected-account label.
  SCOPES: ['asset:read', 'asset:write', 'brandtemplate:meta:read', 'brandtemplate:content:read',
    'design:meta:read', 'design:content:read', 'design:content:write', 'profile:read'],
  pollMs: () => num('CANVA_POLL_MS', 1500),
  jobTimeoutMs: () => num('CANVA_JOB_TIMEOUT_MS', 120000),
  retryAfterCapMs: () => num('CANVA_RETRY_AFTER_CAP_MS', 30000),
  MAX_PDF_BYTES: 100 * 1024 * 1024,
  MAX_PNG_BYTES: 40 * 1024 * 1024,
  DRAFTS_PER_DAY: 20,
  CONCURRENCY: 2,
  DRAFT_TTL_MS: 24 * 3600 * 1000,
  FAILED_TTL_MS: 14 * 24 * 3600 * 1000,
  OAUTH_STATE_TTL_MS: 10 * 60 * 1000,
  redirectUri: (baseUrl) => process.env.CANVA_REDIRECT_URI || (baseUrl.replace(/\/$/, '') + '/admin/canva/callback'),
  clientId: () => process.env.CANVA_CLIENT_ID || '',
  clientSecret: () => process.env.CANVA_CLIENT_SECRET || '',
  configured: () => !!(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET && (process.env.CANVA_TOKEN_ENCRYPTION_KEY || '').length >= 32),
};
