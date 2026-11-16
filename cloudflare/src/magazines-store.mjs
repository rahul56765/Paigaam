/** Internal D1 foundation, NOT HTTP endpoints. Caller authenticates the shared
 * paigaam_creator cookie via security.identity(), passes its SHA-256 hash, and
 * never exposes internal rows. Trusted operator alone may install versions;
 * caller must verify live Canva dataset/publishing, and verify Razorpay signature,
 * captured state, exact order, amount and currency BEFORE settlePaid(). No
 * Canva tokens, OAuth/PKCE, rendering or R2 byte operations are implemented.
 * Amounts are paise. R2 caller must sniff images, enforce limits, authorize
 * before writes AND use the conditional metadata commit, compensating orphaned
 * objects on failure; never delete a referenced object on a racing request.
 */
const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const rand = () => [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
const ident = (v, name) => { if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(v)) throw new TypeError(`invalid ${name}`); return v; };
const owner = v => { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw new TypeError('invalid owner hash'); return v; };
const object = v => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('expected object'); const s=JSON.stringify(v); if (!s || s.length>200000) throw new TypeError('object too large'); return s; };
const noCredentialKeys = value => {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(token|secret|password|authorization|verifier)/i.test(key)) throw new TypeError('credential fields not supported');
    noCredentialKeys(nested);
  }
};
const decode = row => row ? {...row, ...(row.mapping_json ? {mapping:JSON.parse(row.mapping_json)} : {}), ...(row.fields_json ? {fields:JSON.parse(row.fields_json)} : {}), ...(row.result_json ? {result:JSON.parse(row.result_json)} : {})} : null;

/** Trusted-only: append an immutable version; never accept admin config from a reader. */
export async function installTemplateVersion(db, {id, mapping, amountPaise, currency='INR'}) {
  ident(id,'version'); noCredentialKeys(mapping);
  if (!mapping || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(mapping.slug || '') || !/^[A-Za-z0-9_-]{4,80}$/.test(mapping.canvaTemplateId || '') || !Number.isInteger(mapping.pageCount) || mapping.pageCount<1 || mapping.pageCount>200 || !Array.isArray(mapping.fields) || !Array.isArray(mapping.images) || mapping.fields.length>80 || mapping.images.length>100 || !mapping.fields.length && !mapping.images.length) throw new TypeError('invalid mapping');
  const seen=new Set();
  for (const field of [...mapping.fields,...mapping.images]) {
    if (!field || !/^[a-z][a-z0-9_]{0,23}$/.test(field.key || '') || seen.has(field.key)) throw new TypeError('invalid mapping key');
    seen.add(field.key);
  }
  for (const f of mapping.fields) if (!Number.isInteger(f.maxLength) || f.maxLength<1 || f.maxLength>2000 || typeof f.required !== 'boolean') throw new TypeError('invalid field');
  for (const f of mapping.images) if (typeof f.required !== 'boolean') throw new TypeError('invalid image');
  if (!Number.isSafeInteger(amountPaise) || amountPaise<0 || amountPaise>1e12 || currency!=='INR') throw new TypeError('invalid price');
  await q(db,'INSERT INTO magazine_template_versions(id,slug,mapping_json,amount_paise,currency) VALUES(?,?,?,?,?)',id,mapping.slug,object(mapping),amountPaise,currency).run();
}
/** Caller selects only an authorized, live-validated published version. */
export async function createDraft(db, versionId, ownerHash) {
  const id=rand(); await q(db,`INSERT INTO magazine_drafts(id,owner_hash,template_version_id) SELECT ?,?,id FROM magazine_template_versions WHERE id=?`,id,owner(ownerHash),ident(versionId,'version')).run();
  return getDraft(db,id,ownerHash);
}
export async function getDraft(db,id,ownerHash) {
  return decode(await q(db,`SELECT d.*,t.slug,t.mapping_json,t.amount_paise,t.currency FROM magazine_drafts d JOIN magazine_template_versions t ON t.id=d.template_version_id WHERE d.id=? AND d.owner_hash=?`,ident(id,'draft'),owner(ownerHash)).first());
}
export async function latestDraft(db,slug,ownerHash) {
  return decode(await q(db,`SELECT d.*,t.slug,t.mapping_json,t.amount_paise,t.currency FROM magazine_drafts d JOIN magazine_template_versions t ON t.id=d.template_version_id WHERE t.slug=? AND d.owner_hash=? ORDER BY d.created_at DESC,d.id DESC LIMIT 1`,slug,owner(ownerHash)).first());
}
/** Replace only known fields. Normalization mirrors legacy; incomplete drafts allowed. */
export async function saveFields(db,id,ownerHash,fields) {
  object(fields); const draft=await getDraft(db,id,ownerHash); if (!draft || draft.status!=='draft') return null;
  const values={};
  for (const f of draft.mapping.fields) {
    const raw=fields[f.key]; const v=typeof raw==='string'?raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g,'').replace(/\s+/g,' ').trim():'';
    if ([...v].length>f.maxLength) throw new TypeError('field too long'); values[f.key]=v;
  }
  const row=await q(db,`UPDATE magazine_drafts SET fields_json=?,updated_at=${now} WHERE id=? AND owner_hash=? AND status='draft' RETURNING id`,object(values),id,ownerHash).first();
  return row ? getDraft(db,id,ownerHash) : null;
}
/** Conditional metadata commit uses owner's hash and slot from frozen mapping.
 * objectKey must be a new random opaque object in the draft's private prefix. */
export async function putUpload(db,id,ownerHash,{slot,objectKey,mime,bytes,width,height}) {
  ident(id,'draft'); owner(ownerHash);
  if (!/^[a-z][a-z0-9_]{0,23}$/.test(slot || '') || typeof objectKey!=='string' || !new RegExp(`^magazines/${id}/[a-f0-9]{32,64}$`).test(objectKey) || !['image/jpeg','image/png','image/webp'].includes(mime) || !Number.isSafeInteger(bytes) || bytes<1 || bytes>8*1024*1024 || !Number.isInteger(width) || !Number.isInteger(height) || Math.min(width,height)<400 || Math.max(width,height)>12000) throw new TypeError('invalid upload');
  return await q(db,`INSERT INTO magazine_uploads_v2(draft_id,slot,object_key,mime,bytes,width,height)
    SELECT d.id,?,?,?,?,?,? FROM magazine_drafts d JOIN magazine_template_versions t ON t.id=d.template_version_id
    WHERE d.id=? AND d.owner_hash=? AND d.status='draft' AND EXISTS(SELECT 1 FROM json_each(t.mapping_json,'$.images') i WHERE json_extract(i.value,'$.key')=?)
    ON CONFLICT(draft_id,slot) DO UPDATE SET object_key=excluded.object_key,mime=excluded.mime,bytes=excluded.bytes,width=excluded.width,height=excluded.height RETURNING *`,slot,objectKey,mime,bytes,width,height,id,ownerHash,slot).first();
}
export async function listUploads(db,id,ownerHash) {
  return (await q(db,`SELECT u.* FROM magazine_uploads_v2 u JOIN magazine_drafts d ON d.id=u.draft_id WHERE d.id=? AND d.owner_hash=? ORDER BY u.slot`,ident(id,'draft'),owner(ownerHash)).all()).results;
}
export async function deleteUpload(db,id,ownerHash,slot) {
  return await q(db,`DELETE FROM magazine_uploads_v2 WHERE draft_id=? AND slot=? AND EXISTS(SELECT 1 FROM magazine_drafts d WHERE d.id=magazine_uploads_v2.draft_id AND d.owner_hash=? AND d.status='draft') RETURNING *`,ident(id,'draft'),slot,owner(ownerHash)).first();
}
/** Single winner: returns checkout only to caller that acquired the lock. No
 * automatic gateway retries or unlocks after ambiguous failures. Required inputs
 * are checked in the SAME statement as lock acquisition. Free drafts queue too. */
export async function beginCheckout(db,id,ownerHash) {
  const r=await db.batch([q(db,`INSERT INTO magazine_checkouts(draft_id,amount_paise,currency,status)
    SELECT d.id,t.amount_paise,t.currency,CASE WHEN t.amount_paise=0 THEN 'paid' ELSE 'creating' END
    FROM magazine_drafts d JOIN magazine_template_versions t ON t.id=d.template_version_id
    WHERE d.id=? AND d.owner_hash=? AND d.status='draft'
    AND NOT EXISTS(SELECT 1 FROM json_each(t.mapping_json,'$.fields') f WHERE json_extract(f.value,'$.required')=1 AND
      (json_type(d.fields_json,'$.'||json_extract(f.value,'$.key')) IS NOT 'text' OR length(trim(json_extract(d.fields_json,'$.'||json_extract(f.value,'$.key'))))=0))
    AND NOT EXISTS(SELECT 1 FROM json_each(t.mapping_json,'$.images') i WHERE json_extract(i.value,'$.required')=1 AND NOT EXISTS(SELECT 1 FROM magazine_uploads_v2 u WHERE u.draft_id=d.id AND u.slot=json_extract(i.value,'$.key')))
    ON CONFLICT(draft_id) DO NOTHING`,ident(id,'draft'),owner(ownerHash)), q(db,'SELECT * FROM magazine_checkouts WHERE draft_id=?',id)]);
  return r[0].meta.changes===1 ? r[1].results[0] : null;
}
export async function getCheckout(db,id,ownerHash) {
  return await q(db,`SELECT c.* FROM magazine_checkouts c JOIN magazine_drafts d ON d.id=c.draft_id WHERE d.id=? AND d.owner_hash=?`,ident(id,'draft'),owner(ownerHash)).first();
}
/** Trusted gateway integration only. No public-facing auth in these calls. */
export async function attachGatewayOrder(db,id,gatewayOrderId) {
  return await q(db,`UPDATE magazine_checkouts SET status='pending',gateway_order_id=? WHERE draft_id=? AND status='creating' RETURNING *`,ident(gatewayOrderId,'gateway order'),ident(id,'draft')).first();
}
/** Caller MUST authenticate gateway and verify captured amount/currency; replay
 * succeeds only for the exact immutable pair and the same amount/currency. */
export async function settlePaid(db,{gatewayOrderId,gatewayPaymentId,amountPaise,currency}) {
  ident(gatewayOrderId,'gateway order'); ident(gatewayPaymentId,'gateway payment');
  if (!Number.isSafeInteger(amountPaise) || amountPaise<1 || currency!=='INR') throw new TypeError('invalid verified payment');
  const results=await db.batch([
    q(db,`UPDATE magazine_checkouts SET status='paid',gateway_payment_id=? WHERE gateway_order_id=? AND status='pending' AND amount_paise=? AND currency=?`,gatewayPaymentId,gatewayOrderId,amountPaise,currency),
    q(db,`SELECT * FROM magazine_checkouts WHERE gateway_order_id=? AND gateway_payment_id=? AND amount_paise=? AND currency=? AND status='paid'`,gatewayOrderId,gatewayPaymentId,amountPaise,currency)
  ]);
  return results[1].results[0] || null;
}
/** Worker-only CAS; never re-run terminal jobs. result must not contain secrets. */
export async function claimJob(db,id) {
  return decode(await q(db,`UPDATE magazine_jobs SET status='running',updated_at=${now} WHERE draft_id=? AND status='queued' RETURNING *`,ident(id,'draft')).first());
}
export async function finishJob(db,id,status,result) {
  if (!['ready','failed'].includes(status)) throw new TypeError('invalid terminal status');
  object(result); const allowed = status==='ready' ? ['pdfKey','pngKey'] : ['code','stage'];
  if (!Object.keys(result).length || Object.entries(result).some(([k,v]) => !allowed.includes(k) || typeof v!=='string' || !v || v.length>512)) throw new TypeError('invalid job result');
  const payload=object(result); const rows=await db.batch([
    q(db,`UPDATE magazine_jobs SET status=?,result_json=?,updated_at=${now} WHERE draft_id=? AND status='running'`,status,payload,ident(id,'draft')),
    q(db,`SELECT * FROM magazine_jobs WHERE draft_id=? AND status=? AND result_json=?`,id,status,payload)
  ]);
  return decode(rows[1].results[0] || null);
}
export async function getJob(db,id,ownerHash) {
  return decode(await q(db,`SELECT j.* FROM magazine_jobs j JOIN magazine_drafts d ON d.id=j.draft_id WHERE d.id=? AND d.owner_hash=?`,ident(id,'draft'),owner(ownerHash)).first());
}
