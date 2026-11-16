// Disposable local-only verification. Never supplies Cloudflare credentials.
import { unstable_dev } from 'wrangler';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const state = mkdtempSync(join(tmpdir(), 'paigaam-ci-'));
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
function localSQL(file) {
  execFileSync(process.execPath, [cli, 'd1', 'execute', 'DB', '--local', '--persist-to', state, '--file', file], { stdio: 'inherit' });
}
let worker;
try {
  localSQL('migrations/0001_initial.sql');
  localSQL('migrations/0006_request_rate.sql');
  execFileSync(process.execPath, ['scripts/seed.mjs'], { stdio: 'inherit' });
  localSQL('seed.generated.sql');
  worker = await unstable_dev('src/worker.mjs', {
    config: 'wrangler.toml', ip: '127.0.0.1', port: 8899, local: true, persistTo: state,
    vars: { DRAFTS_ENABLED: 'true', FREE_PUBLISH_ENABLED: 'true',
      CHECKOUT_ENABLED: 'false', ALLOW_LIVE_PAYMENTS: 'false',
      RATE_LIMIT_HMAC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
    experimental: { disableExperimentalWarning: true },
  });
  const status = await (await worker.fetch('/status')).json();
  assert.equal(status.checkout, 'disabled');
  assert.equal(status.legacyDataImported, false);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/free-runtime-smoke.mjs', 'http://127.0.0.1:8899'], { stdio: 'inherit' });
    child.on('error', reject); child.on('exit', resolve);
  });
  assert.equal(code, 0, 'local runtime smoke must pass');
} finally {
  if (worker) await worker.stop();
  rmSync(state, { recursive: true, force: true });
}
