/** Worker views: original family builder, original family demo/render modules. */
import createPages from '../../pages/bfdayCreate.js';
import pageHelpers from '../../lib/bfday/page.js';
const { bfdayCreatePage } = createPages;
const { escape: esc } = pageHelpers;

const unsupported = 'Not available in this Cloudflare pilot: classic template families, magazines, creator studio, collaboration, and generated wedding videos.';
const pilotNotice = '<aside role="status" style="position:relative;z-index:10000;padding:12px 24px;background:#5b1725;color:#fff;text-align:center;font:14px/1.5 system-ui">Setup preview only · New orders and payments are not enabled here. Existing Railway invitations have not been imported.</aside>'; 
function shell(title, content) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Paigaam</title><meta name="description" content="Personal greetings, made with care. Explore the shared-family Paigaam collection."><link rel="icon" href="/brand/favicon-512.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box}body{margin:0;background:#f7f1e6;color:#33231d;font:15px/1.65 Inter,system-ui,sans-serif}a{color:inherit}header,main,footer{max-width:1280px;margin:auto;padding:28px clamp(24px,5vw,72px)}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #33231d20}header img{width:155px;height:auto}nav a{text-decoration:none;font-size:13px}.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:11px;color:#8f1018;font-weight:600}h1,h2,h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;line-height:1.06}h1{font-size:clamp(48px,6vw,84px);margin:20px 0;max-width:840px}h2{font-size:38px}h3{font-size:29px;margin:8px 0 14px}.intro{max-width:650px;color:#6d5d54;font-size:17px}.collection{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:30px 24px;margin:48px 0}.card{background:#fffaf2;border:1px solid #ddcec0;border-radius:6px;overflow:hidden}.card-art{aspect-ratio:4/3;background:var(--soft,#ecdcca);display:flex;align-items:center;justify-content:center;overflow:hidden;text-decoration:none}.card-art img{width:100%;height:100%;object-fit:cover}.card-art span{font:60px 'Cormorant Garamond',Georgia,serif;color:var(--accent,#8f1018)}.card-copy{padding:24px}.card-copy p{font-size:13px;color:#6d5d54}.actions{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.button{display:inline-block;text-decoration:none;background:#8f1018;border:1px solid #8f1018;border-radius:3px;padding:11px 19px;color:#fffaf2;font-size:13px}.button.secondary{background:transparent;color:#8f1018}.split{display:grid;grid-template-columns:1fr 1fr;gap:54px;align-items:start;margin-top:32px}.demo{width:100%;height:680px;border:1px solid #d8c7b7;border-radius:8px;background:white}.scenes{padding-left:20px;color:#6d5d54}.availability{font-size:12px;color:#77665a;border-top:1px solid #33231d20;padding-top:24px}footer{font-size:12px;color:#77665a}@media(max-width:800px){.split{grid-template-columns:1fr;gap:28px}.demo{height:650px}header img{width:125px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body>${pilotNotice}<header><a href="/" aria-label="Paigaam home"><img src="/brand/logo-full.png" alt="Paigaam" width="155" height="78"></a><nav><a href="/templates">The collection ↗</a></nav></header><main>${content}</main><footer>Paigaam · because some things deserve more<p class="availability">${unsupported}</p></footer></body></html>`;
}
function artwork(t) {
  const c = t.config;
  return c.thumbnail_url ? `<img src="${esc(c.thumbnail_url)}" alt="${esc(c.name)} design" loading="lazy" width="600" height="450">` : `<span aria-hidden="true">${esc(c.name.charAt(0))}</span>`;
}
export function catalogPage(templates) {
  return shell('The collection', `<p class="eyebrow">Personal by design</p><h1>Some things deserve<br>more than a message.</h1><p class="intro">A little love. A big celebration. A moment worth keeping. Choose a design, make it yours, and send something they can feel.</p><section class="collection" aria-label="Shared-family templates">${templates.map(t => `<article class="card" style="--soft:${esc(t.config.theme.soft)};--accent:${esc(t.config.theme.accent)}"><a class="card-art" href="/templates/${esc(t.slug)}" aria-label="Explore ${esc(t.config.name)}">${artwork(t)}</a><div class="card-copy"><p class="eyebrow">${esc(t.config.category)}</p><h3>${esc(t.config.name)}</h3><p>${esc(t.config.description)}</p><div class="actions"><a class="button" href="/create/${esc(t.slug)}">Make it yours</a><a class="button secondary" href="/templates/${esc(t.slug)}">Explore</a></div></div></article>`).join('')}</section>`);
}
export function detailPage(template) {
  const t = template, c = t.config;
  return shell(c.name, `<a href="/templates">← All designs</a><div class="split"><section><p class="eyebrow">${esc(c.category)} · A Paigaam keepsake</p><h1>${esc(c.name)}</h1><p class="intro">${esc(c.description)}</p><div class="actions"><a class="button" href="/create/${esc(t.slug)}">Make it yours</a><a class="button secondary" href="/${esc(t.slug)}/demo" target="_blank" rel="noopener noreferrer">Open demo ↗</a></div><h2>${esc(c.create.designHeading || 'Made for your moment')}</h2><p>${esc(c.create.designIntro || c.create.intro)}</p><ul class="scenes">${(c.create.scenes || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul><p class="availability">Demo content is fictional. The original design opens in the preview; you personalise its words, photos and supported media in the builder.</p></section><iframe class="demo" src="/${esc(t.slug)}/demo" title="${esc(c.name)} interactive demo" loading="lazy" allow="autoplay; fullscreen"></iframe></div>`);
}
/** Original wizard markup, step engine, field controls, crop tools and shell.
 * Optional third argument lets the Worker supply tested server-side prices or
 * resumeDraft. A cloned config avoids the legacy page's price mutation leaking.
 */
export function builderPage(template, baseUrl = '', options = {}) {
  // Also accept the original page's options-object calling convention.
  if (baseUrl && typeof baseUrl === 'object') { options = baseUrl; baseUrl = options.baseUrl || ''; }
  const t = { ...template, config: { ...template.config } };
  let html = bfdayCreatePage(t, options);
  // Creator/collaboration coupon flows are not ported. Keep checkout's own
  // PaigaamPay script, but never load the unrelated legacy creator campaign.
  html = html.replace(/<link[^>]+href="\/css\/creator-coupon\.css[^>]*>\s*/g, '')
    .replace(/<script[^>]+src="\/js\/creator-coupon\.js[^>]*><\/script>\s*/g, '');
  let origin = '';
  try { origin = new URL(baseUrl).origin; } catch { /* relative preview is fine */ }
  if (origin) html = html.replace(/https:\/\/paigaam\.cc(?=[\/"<])/g, () => esc(origin));
  return html.replace(/(<body\b[^>]*>)/i, '$1' + pilotNotice);
}
