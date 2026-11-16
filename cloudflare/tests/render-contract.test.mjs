import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import { bySlug, list } from '../src/catalog.generated.mjs';
import * as store from '../src/store.mjs';
import { D1 } from './d1-shim.mjs';

const origin = 'https://preview.example';
async function fixture(t) {
  const DB = new D1(); t.after(() => DB.raw.close());
  await store.seedTemplates(DB, list.map(t => ({ slug: t.slug, name: t.config.name,
    price: Math.round((t.config.price || 0) * 100), currency: 'INR', config: t.config })));
  return { DB, MEDIA: {} };
}
test('published instances retain distinct renderer keys and canonical URLs; previews never persist', async t => {
  const env = await fixture(t);
  for (const slug of ['khulta', 'meri-duniya']) {
    const template = bySlug(slug);
    const data = template.schema.validate(template.config.demo, { mode: 'draft' });
    const keys = [];
    for (const suffix of ['a', 'b']) {
      const pg = await store.createInvite(env.DB, slug, 'synthetic-owner', data,
        { maxPerOwnerTemplate24h: 20, maxGlobal24h: 100 });
      const publicSlug = slug + '-free-' + suffix.repeat(48);
      assert.ok(await store.publishFree(env.DB, pg.id, 'synthetic-owner', slug, data, publicSlug));
      const response = await worker.fetch(new Request(origin + '/p/' + publicSlug), env);
      assert.equal(response.status, 200);
      const html = await response.text();
      const payload = JSON.parse(html.match(new RegExp('<script[^>]+id="' + (slug === 'khulta' ? 'khData' : 'mdData') + '"[^>]*>([\\s\\S]*?)</script>'))[1]);
      assert.equal(payload.key, publicSlug);
      assert.ok(html.includes('href="' + origin + '/p/' + publicSlug + '"'));
      keys.push(payload.key);
    }
    assert.notEqual(keys[0], keys[1]);
    const demo = await (await worker.fetch(new Request(origin + '/' + slug + '/demo'), env)).text();
    assert.ok(demo.includes('"key":""'));
    assert.ok(!demo.includes('rel="canonical"'));
  }
});
test('only stateless keepsake editor frames enable photo-edit messages; demos and public pages remain reader views', async t => {
  const env = await fixture(t);
  for (const slug of ['love-letter', 'anniversary-blue']) {
    for (const method of ['GET', 'POST']) {
      const r = await worker.fetch(new Request(origin + '/' + slug + '/preview-frame', {
        method, ...(method === 'POST' ? { headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_data: {} }) } : {}),
      }), env);
      assert.equal(r.status, 200); assert.match(await r.text(), /data-editor="true"/);
    }
    const demo = await worker.fetch(new Request(origin + '/' + slug + '/demo'), env);
    assert.match(await demo.text(), /data-editor="false"/);
    const data = bySlug(slug).schema.validate({}, { mode: 'draft' });
    const pg = await store.createInvite(env.DB, slug, 'synthetic-owner', data,
      { maxPerOwnerTemplate24h: 20, maxGlobal24h: 100 });
    const publicSlug = slug + '-free-' + 'c'.repeat(48);
    assert.ok(await store.publishFree(env.DB, pg.id, 'synthetic-owner', slug, data, publicSlug));
    const page = await worker.fetch(new Request(origin + '/p/' + publicSlug), env);
    assert.match(await page.text(), /data-editor="false"/);
  }
});
