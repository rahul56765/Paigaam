import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { list } from '../src/catalog.generated.mjs';
import { seedTemplates } from '../src/store.mjs';
import { D1 } from './d1-shim.mjs';
import { TEST_RATE_KEY } from './rate-fixtures.mjs';
const origin = 'https://preview.example';
async function fixture(t) {
  const DB = new D1(); t.after(() => DB.raw.close());
  await seedTemplates(DB, list.map(x => ({ slug: x.slug, name: x.config.name, price: Math.round((x.config.price || 0) * 100), config: x.config, currency: 'INR' })));
  return { DB, MEDIA: {}, DRAFTS_ENABLED: 'true', FREE_PUBLISH_ENABLED: 'true', RATE_LIMIT_HMAC_KEY: TEST_RATE_KEY };
}
async function page(slug, env, query = '') {
  const r = await worker.fetch(new Request(`${origin}/create/${slug}${query}`), env);
  assert.equal(r.status, 200); return r.text();
}
const isLocked = html => /id="publish" class="button publish" disabled aria-disabled="true"/.test(html) && html.includes('function lock()');
const isEnabled = html => /id="publish" class="button publish" aria-describedby="free-publish-hint"/.test(html) && !html.includes('function lock()');

test('only exact storage, flags and authoritative D1 zero price unlock the staged free builder', async t => {
  const env = await fixture(t);
  assert.ok(isEnabled(await page('sealed-with-a-kiss', env)));
  const cases = [
    { DRAFTS_ENABLED: undefined }, { DRAFTS_ENABLED: true }, { DRAFTS_ENABLED: 'TRUE' },
    { FREE_PUBLISH_ENABLED: undefined }, { FREE_PUBLISH_ENABLED: true }, { FREE_PUBLISH_ENABLED: 'TRUE' },
    { MEDIA: undefined }, { DB: undefined }, { RATE_LIMIT_HMAC_KEY: undefined }, { RATE_LIMIT_HMAC_KEY: 'not-a-key' },
  ];
  for (const patch of cases) assert.ok(isLocked(await page('sealed-with-a-kiss', { ...env, ...patch }, '?enableFreeBuilder=true&price=0')));
  assert.ok(isLocked(await page('little-love', env)), 'server-owned paid price stays locked');
  env.DB.raw.prepare('UPDATE templates SET price=1 WHERE slug=?').run('sealed-with-a-kiss');
  assert.ok(isLocked(await page('sealed-with-a-kiss', env)), 'one paise is not free');
  env.DB.raw.prepare('DELETE FROM templates WHERE slug=?').run('sealed-with-a-kiss');
  assert.ok(isLocked(await page('sealed-with-a-kiss', env)), 'missing D1 row is never treated as a free quote');
});

test('server-owned D1 price, not stale source config, controls the staged free view', async t => {
  const env = await fixture(t);
  env.DB.raw.prepare('UPDATE templates SET price=0 WHERE slug=?').run('little-love');
  const body = await page('little-love', env);
  assert.ok(isEnabled(body)); assert.doesNotMatch(body, /paigaam-pay\.js|pc-inline-checkout/);
});
