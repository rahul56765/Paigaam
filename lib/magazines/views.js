'use strict';
/** HTML for the magazine catalogue, create flow, result page and admin panel. Uses the site shell + paigaam.css. */
const { page, esc } = require('../layout');
const { safeMessage } = require('./canvaClient');

const STAGES = [['preparing', 'Preparing'], ['uploading', 'Uploading photos'], ['generating', 'Designing'], ['exporting', 'Exporting']];
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028|\u2029/g, '');

const CSS = `<style>
.mag{max-width:1040px;margin:0 auto;padding:128px 24px 96px;color:var(--ink)}
.mag h1{font-size:clamp(2.2rem,5vw,3.4rem);margin:.2em 0 .3em;line-height:1.05}
.mag .lede{color:var(--ink-soft);max-width:60ch;font-size:1.05rem;line-height:1.6}
.mag-eyebrow{font:600 11px/1 var(--sans);letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.mag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px;margin-top:36px}
.mag-card{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;color:inherit;transition:transform .3s var(--ease),box-shadow .3s var(--ease)}
.mag-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(59,36,32,.12)}
.mag-card__main{display:block;flex:1;text-decoration:none;color:inherit}
.mag-card__actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 20px 18px}
.mag-card__sample{display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border-radius:24px;background:#3b2420;color:#fff;text-decoration:none;font:600 12px/1.2 var(--sans);letter-spacing:.02em;transition:background .2s,transform .2s}
.mag-card__sample:hover{background:#8f1018;transform:translateY(-1px)}
.mag-card__sample.is-pending{background:#f2e7dc;color:#674d3d;cursor:wait}
.mag-card__open{color:var(--accent);font:600 13px var(--sans);text-decoration:none}
.mag-card__art{aspect-ratio:3/4;background:linear-gradient(160deg,#241610,#5a2a24 60%,#8F1018);display:flex;align-items:flex-end;padding:20px;color:#FBF4ED;font:600 1.5rem/1.1 var(--serif)}
.mag-card__art img{width:100%;height:100%;object-fit:cover;display:block;margin:-20px;padding:0}
.mag-card__art.has-img{padding:0;background:#f4eadd;align-items:stretch}.mag-card__art.has-img img{margin:0}
.mag-hero{display:block;max-width:360px;width:100%;border-radius:16px;border:1px solid var(--line);margin:22px 0 4px;box-shadow:0 14px 34px rgba(59,36,32,.12)}
.mag-result-img{display:block;max-width:560px;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);margin:8px auto;background:#fff}
.mag-bulk{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 18px}.mag-bulk .btn{position:relative;overflow:hidden;cursor:pointer}.mag-bulk input{position:absolute;inset:0;opacity:0;cursor:pointer;font-size:0}
.mag-bulk small{color:var(--ink-soft)}
.mag-card__body{padding:18px 20px 22px}.mag-card__body p{margin:.3em 0 0;color:var(--ink-soft);font-size:.92rem;line-height:1.5}
.mag-panel{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px;margin-top:22px}
.mag-panel h2{font-size:1.5rem;margin:0 0 14px}
.mag-field{display:block;margin:0 0 16px}.mag-field span{display:block;font:600 12px/1 var(--sans);letter-spacing:.06em;margin-bottom:8px}
.mag-field input[type=text],.mag-field textarea{width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid var(--line);border-radius:10px;font:inherit;background:var(--bg)}
.mag-field textarea{min-height:160px;resize:vertical;line-height:1.55}
.mag-field small{display:block;margin-top:6px;color:var(--ink-soft)}
.mag-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.mag-slot{position:relative;border:1.5px dashed var(--taupe);border-radius:14px;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;cursor:pointer;background:var(--bg);overflow:hidden;font-size:.82rem;color:var(--ink-soft)}
.mag-slot strong{display:block;color:var(--ink);font-size:.9rem}
.mag-slot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mag-slot.is-done{border-style:solid;border-color:var(--accent)}
.mag-slot.is-busy{opacity:.6}.mag-slot.is-bad{border-color:#b00020}
.mag-slot input{position:absolute;inset:0;opacity:0;cursor:pointer}
.mag-slot__tag{position:absolute;left:6px;bottom:6px;background:rgba(36,22,16,.78);color:#fff;border-radius:6px;padding:3px 7px;font-size:.72rem}
.mag-msg{margin:14px 0 0;min-height:1.3em;color:#b00020;font-size:.92rem}
.mag-steps{list-style:none;padding:0;margin:26px 0;display:grid;gap:10px}
.mag-steps li{display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink-soft)}
.mag-steps li.is-now{border-color:var(--accent);color:var(--ink);font-weight:600}
.mag-steps li.is-done{color:var(--ink)}
.mag-dot{width:12px;height:12px;border-radius:50%;background:var(--beige)}
.is-now .mag-dot{background:var(--accent);animation:magPulse 1s infinite}.is-done .mag-dot{background:#2e7d32}
@keyframes magPulse{50%{transform:scale(1.5);opacity:.5}}
.mag-preview{width:100%;height:min(78vh,820px);border:1px solid var(--line);border-radius:14px;background:#fff}
.mag-reader{max-width:780px;margin:18px auto 8px;padding:16px;background:linear-gradient(150deg,#241712,#3c251f 62%,#1d1411);border:1px solid rgba(255,255,255,.14);border-radius:18px;box-shadow:0 22px 52px rgba(36,22,16,.24);color:#fbf4ed}
.mag-reader__top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 4px 12px;font:600 11px/1.2 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:#e8d8c7}
.mag-reader__stage{height:min(68vh,720px);min-height:360px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;perspective:1800px;perspective-origin:50% 48%;touch-action:pan-y;background:radial-gradient(ellipse at 50% 45%,rgba(255,239,214,.12),transparent 72%);border-radius:12px}
.mag-reader__surface{position:relative;z-index:1;display:block;max-width:100%;max-height:100%;background:#fff;box-shadow:0 14px 36px rgba(0,0,0,.46)}
.mag-reader__leaf{position:absolute;z-index:2;display:none;transform-style:preserve-3d;backface-visibility:hidden;filter:drop-shadow(0 5px 8px rgba(0,0,0,.2));will-change:transform,filter}
.mag-reader__leaf.is-turning{display:block}
.mag-reader__face{position:absolute;inset:0;overflow:hidden;background:#fff;backface-visibility:hidden;box-shadow:0 8px 20px rgba(0,0,0,.2)}
.mag-reader__face canvas{display:block;max-width:none;max-height:none;background:#fff}
.mag-reader__face--front{transform:rotateY(0deg)}.mag-reader__face--back{transform:rotateY(180deg)}
.mag-reader__face--front::after,.mag-reader__face--back::after{content:"";position:absolute;inset:0;pointer-events:none}
.mag-reader__face--front::after{background:linear-gradient(90deg,transparent 72%,rgba(0,0,0,.06) 84%,rgba(0,0,0,.22) 96%,rgba(255,255,255,.7) 99%,rgba(0,0,0,.14) 100%)}
.mag-reader__face--back::after{background:linear-gradient(270deg,transparent 72%,rgba(0,0,0,.08) 86%,rgba(0,0,0,.24) 97%,rgba(255,255,255,.55) 99%,rgba(0,0,0,.12) 100%)}
.mag-reader__leaf.turn-next{transform-origin:left center;animation:magPageForward .92s cubic-bezier(.58,.02,.24,1) both}
.mag-reader__leaf.turn-prev{transform-origin:right center;animation:magPageBackward .92s cubic-bezier(.58,.02,.24,1) both}
@keyframes magPageForward{0%{transform:rotateY(0deg) scaleX(1);filter:drop-shadow(0 5px 5px rgba(0,0,0,.14)) brightness(1)}18%{transform:rotateY(-28deg) scaleX(.99);filter:drop-shadow(8px 8px 9px rgba(0,0,0,.22)) brightness(.94)}42%{transform:rotateY(-78deg) scaleX(.965);filter:drop-shadow(16px 8px 12px rgba(0,0,0,.3)) brightness(.84)}58%{transform:rotateY(-111deg) scaleX(.97);filter:drop-shadow(13px 7px 10px rgba(0,0,0,.26)) brightness(.88)}82%{transform:rotateY(-158deg) scaleX(.99);filter:drop-shadow(5px 6px 8px rgba(0,0,0,.18)) brightness(.96)}100%{transform:rotateY(-180deg) scaleX(1);filter:drop-shadow(0 4px 6px rgba(0,0,0,.12)) brightness(1)}}
@keyframes magPageBackward{0%{transform:rotateY(0deg) scaleX(1);filter:drop-shadow(0 5px 5px rgba(0,0,0,.14)) brightness(1)}18%{transform:rotateY(28deg) scaleX(.99);filter:drop-shadow(-8px 8px 9px rgba(0,0,0,.22)) brightness(.94)}42%{transform:rotateY(78deg) scaleX(.965);filter:drop-shadow(-16px 8px 12px rgba(0,0,0,.3)) brightness(.84)}58%{transform:rotateY(111deg) scaleX(.97);filter:drop-shadow(-13px 7px 10px rgba(0,0,0,.26)) brightness(.88)}82%{transform:rotateY(158deg) scaleX(.99);filter:drop-shadow(-5px 6px 8px rgba(0,0,0,.18)) brightness(.96)}100%{transform:rotateY(180deg) scaleX(1);filter:drop-shadow(0 4px 6px rgba(0,0,0,.12)) brightness(1)}}
.mag-reader__status{position:absolute;inset:auto 16px 14px;text-align:center;color:#fff;font-size:.9rem;text-shadow:0 1px 6px #000;pointer-events:none}
.mag-reader__controls{display:flex;align-items:center;justify-content:center;gap:18px;padding:12px 4px 2px}
.mag-reader__controls button{min-height:42px;padding:8px 14px;border:1px solid rgba(255,255,255,.28);border-radius:24px;background:rgba(255,255,255,.08);color:#fff;font:500 14px var(--sans);cursor:pointer}
.mag-reader__controls button:hover:not(:disabled){background:rgba(255,255,255,.17)}.mag-reader__controls button:disabled{opacity:.4;cursor:default}
.mag-reader__count{min-width:90px;text-align:center;font:600 12px var(--sans);letter-spacing:.1em;color:#f1dfc8}
.mag-reader__hint{margin:4px 0 0;text-align:center;color:#d7c7b8;font-size:.82rem}
.mag-reader__error{margin:12px 0 0;padding:12px 14px;border-radius:10px;background:#fff7e0;color:#3b2420;font-size:.92rem}.mag-reader__error a{color:inherit;font-weight:600}
@media(max-width:600px){.mag-reader{padding:10px;border-radius:14px;margin-top:12px}.mag-reader__stage{height:min(66svh,680px);min-height:300px}.mag-reader__controls{gap:8px}.mag-reader__controls button{padding:8px 10px;font-size:13px}.mag-reader__hint{font-size:.78rem}}
@media(prefers-reduced-motion:reduce){.mag-reader__leaf.turn-next,.mag-reader__leaf.turn-prev{animation:none}}
.mag-actions{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}
.mag-note{background:var(--blush);border-radius:12px;padding:14px 16px;color:var(--ink);font-size:.92rem}
.mag table{width:100%;border-collapse:collapse;font-size:.88rem}.mag th,.mag td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.mag-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:.75rem;font-weight:600;background:var(--beige)}
.mag-pill.ok{background:#dff3e2;color:#1b5e20}.mag-pill.bad{background:#fde3e6;color:#8F1018}
.mag form.inline{display:inline}.mag-flash{background:#fff7e0;border:1px solid #e6cf8a;border-radius:10px;padding:12px 14px;margin:0 0 18px}
</style>`;

const shell = (title, body, opts = {}) => page(title, `${CSS}<main class="mag">${body}</main>`, { current: '/magazines', ...opts });

function catalogue(items) {
  const waitingSamples = items.some(m => m.pageCount > 1 && !m.hasSample);
  const cards = items.map(m => `<article class="mag-card">
    <a class="mag-card__main" href="/magazines/${esc(m.slug)}">
      <div class="mag-card__art${m.hasPreview ? ' has-img' : ''}">${m.hasPreview ? `<img src="/magazines/preview/${esc(m.slug)}" alt="Sample cover of ${esc(m.name)}" loading="lazy">` : esc(m.name)}</div>
      <div class="mag-card__body"><strong>${esc(m.name)}</strong><p>${esc(m.tagline)}</p>
      <p>${m.pageCount === 1 ? 'Single page · PDF + PNG' : m.pageCount + ' pages · PDF'}</p></div>
    </a>
    <div class="mag-card__actions"><a class="mag-card__open" href="/magazines/${esc(m.slug)}">View design →</a>
      ${m.pageCount > 1 && m.hasSample ? `<a class="mag-card__sample" href="/magazines/sample/${esc(m.slug)}" aria-label="Flip through all ${m.pageCount} pages of the ${esc(m.name)} sample">Flip through sample <span aria-hidden="true">↗</span></a>` : m.pageCount > 1 ? `<span class="mag-card__sample is-pending" data-sample-check="${esc(m.slug)}" role="status">Preparing sample…</span>` : ''}
    </div>
  </article>`).join('');
  return shell('Paigaam Magazines — your photos, beautifully designed', `
    <div class="mag-eyebrow">Paigaam Magazines</div><h1>Turn your photos into a keepsake.</h1>
    <p class="lede">Pick a design, add your photos, and we’ll lay it out for you — preview it here and download a print-ready PDF.</p>
    ${items.length ? `<div class="mag-grid">${cards}</div>` : '<p class="mag-note" style="margin-top:30px">New magazine designs are on the way. Check back soon.</p>'}`,
    { description: 'Create a personalised photo magazine on Paigaam: choose a design, add your photos, preview and download.', canonical: '/magazines', scripts: waitingSamples ? `<script>(function(){document.querySelectorAll('[data-sample-check]').forEach(function(el){var slug=el.getAttribute('data-sample-check'),tries=0;function check(){if(document.hidden)return setTimeout(check,2500);fetch('/magazines/sample/'+encodeURIComponent(slug)+'/sample.pdf',{method:'HEAD',cache:'no-store'}).then(function(r){if(r.ok){var a=document.createElement('a');a.className='mag-card__sample';a.href='/magazines/sample/'+encodeURIComponent(slug);a.setAttribute('aria-label','Flip through the fictional '+slug+' sample');a.innerHTML='Flip through sample <span aria-hidden="true">↗</span>';el.replaceWith(a);return}if(++tries<20)setTimeout(check,2000);else el.textContent='Sample preview will be available soon.'}).catch(function(){if(++tries<20)setTimeout(check,2000);else el.textContent='Sample preview will be available soon.'})}setTimeout(check,1200)})})();</script>` : '' });
}

function samplePage(mapping, { pdfUrl }) {
  return shell(`${mapping.name} sample — Paigaam Magazines`, `
    <a href="/magazines" class="mag-eyebrow" style="text-decoration:none">← All designs</a>
    <h1>${esc(mapping.name)} · sample</h1>
    <p class="lede">A fictional example of the finished ${esc(mapping.name)}. Your own photos and words replace these in the magazine you create.</p>
    <section class="mag-reader" id="magReader" data-pdf="${esc(pdfUrl)}" aria-label="Flip through the fictional ${esc(mapping.name)} sample">
      <div class="mag-reader__top"><span>Fictional sample</span><span id="magReaderTotal">Loading…</span></div>
      <div class="mag-reader__stage" id="magReaderStage" aria-live="polite">
        <canvas class="mag-reader__surface" id="magReaderCanvas" aria-label="Magazine page"></canvas>
        <div class="mag-reader__leaf" id="magReaderLeaf" aria-hidden="true">
          <div class="mag-reader__face mag-reader__face--front"><canvas id="magReaderFront"></canvas></div>
          <div class="mag-reader__face mag-reader__face--back"><canvas id="magReaderBack"></canvas></div>
        </div>
        <div class="mag-reader__status" id="magReaderStatus">Opening the sample…</div>
      </div>
      <div class="mag-reader__controls"><button type="button" id="magReaderPrev" aria-label="Previous sample page" disabled>← Previous</button><span class="mag-reader__count" id="magReaderCount" aria-live="polite">— / —</span><button type="button" id="magReaderNext" aria-label="Next sample page" disabled>Next →</button></div>
      <p class="mag-reader__hint">Swipe or use the arrows to turn pages</p>
      <div class="mag-reader__error" id="magReaderError" role="status" hidden>Sample preview could not load. <a href="${esc(pdfUrl)}" target="_blank" rel="noopener">Open the sample PDF</a>.</div>
    </section>
    <div class="mag-actions"><a class="btn btn--primary" href="/create/${esc(mapping.slug)}">Create your own</a><a class="btn btn--ghost" href="/magazines/${esc(mapping.slug)}">See the design</a></div>`,
    { description: `Flip through a fictional ${mapping.name} sample.`, canonical: `/magazines/${mapping.slug}`, robots: 'noindex,follow', scripts: '<script type="module" src="/js/magazine-preview.mjs"></script>' });
}

function formPage(mapping, { preview = false, hasPreview = false } = {}) {
  const data = { slug: mapping.slug, fields: mapping.fields.map(f => ({ key: f.key, maxLength: f.maxLength, required: f.required })),
    images: mapping.images.map(i => ({ key: i.key, required: i.required, frameAspect: i.frameAspect || 1 })), maxBytes: mapping.limits.maxImageBytes, minSide: mapping.limits.minImageSide, mimes: mapping.limits.mimes };
  const fields = mapping.fields.map(f => `<label class="mag-field"><span>${esc(f.label)}${f.required ? '' : ' (optional)'}</span>
    ${f.multiline ? `<textarea data-field="${esc(f.key)}" maxlength="${f.maxLength}" placeholder="${esc(f.placeholder || '')}" rows="6" autocomplete="off"></textarea>` : `<input type="text" data-field="${esc(f.key)}" maxlength="${f.maxLength}" placeholder="${esc(f.placeholder || '')}" autocomplete="off">`}
    <small>${esc(f.help || '')} Up to ${f.maxLength} characters.</small></label>`).join('');
  const slots = mapping.images.map(s => `<label class="mag-slot" data-slot="${esc(s.key)}" data-aspect="${esc(s.frameAspect || 1)}" style="aspect-ratio:${esc(s.frameAspect || 1)}"><strong>${esc(s.label)}</strong>${esc(s.hint)}
    <input type="file" accept="image/jpeg,image/png,image/webp"><span class="mag-slot__tag" hidden>Added</span></label>`).join('');
  const maxMb = Math.round(mapping.limits.maxImageBytes / 1048576);
  return shell(`${mapping.name} — Paigaam Magazines`, `
    <a href="/magazines" class="mag-eyebrow" style="text-decoration:none">← All designs</a><h1>${esc(mapping.name)}</h1>
    <p class="lede">${esc(mapping.tagline)}</p>
    ${hasPreview ? `<img class="mag-hero" src="/magazines/preview/${esc(mapping.slug)}" alt="Sample of ${esc(mapping.name)} — your photos will replace the ones shown">` : ''}
    ${preview ? '<p class="mag-note">Admin preview — this design is not published, so readers cannot see or generate it yet.</p>' : ''}
    ${fields ? `<div class="mag-panel"><h2>1 · Your words</h2>${fields}</div>` : ''}
    <div class="mag-panel"><h2>${fields ? '2' : '1'} · Your photos</h2>
      <p class="lede" style="margin-top:0">Add all ${mapping.images.length} photos (JPG, PNG or WebP, up to ${maxMb} MB each, at least ${mapping.limits.minImageSide}px on the short side). We automatically frame detected faces for each photo slot on your device; we don’t identify anyone.</p>
      <div class="mag-bulk"><span class="btn btn--primary btn--small">Select all photos at once<input type="file" id="magBulk" accept="image/jpeg,image/png,image/webp" multiple aria-label="Select up to ${mapping.images.length} photos at once"></span>
        <small>Pick up to ${mapping.images.length} photos together — they fill the empty frames in order. You can still change any one below.</small></div>
      <div class="mag-slots">${slots}</div></div>
    <div class="mag-panel"><button class="btn btn--primary" id="magGo" disabled>Create my magazine</button>
      <p class="mag-msg" id="magMsg" role="alert"></p>
      <p style="color:var(--ink-soft);font-size:.85rem">Your photos are used only to build this magazine and are deleted from our servers once it’s ready.</p></div>`,
    { description: mapping.tagline, canonical: '/magazines/' + mapping.slug, scripts: `<script>window.__MAG=${json(data)};${FORM_JS}</script>` });
}

const FORM_JS = `
(function(){var M=window.__MAG,id=null,have={},busy=0,$=function(s,r){return (r||document).querySelector(s)};
var ERR={invalid_image:'That file doesn\\u2019t look like a valid JPG, PNG or WebP photo.',too_large:'That photo is too large.',too_small:'That photo is too small \\u2014 please use a larger one.',limit:'Too many attempts today. Please try again tomorrow.',forbidden:'This draft isn\\u2019t available any more. Please reload the page.',locked:'Your magazine is already being created.',template_unavailable:'This magazine isn\\u2019t available right now.',canva_not_connected:'This magazine isn\\u2019t available right now.',missing_photos:'Please add every photo first.',invalid_fields:'Please check your text.'};
function msg(t){$('#magMsg').textContent=t||''}
function call(method,url,body,type){return fetch(url,{method:method,credentials:'same-origin',headers:type?{'Content-Type':type}:(body?{'Content-Type':'application/json'}:{}),body:body}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||'error');return j})})}
function ready(){var ok=M.images.every(function(i){return !i.required||have[i.key]});M.fields.forEach(function(f){var v=$('[data-field="'+f.key+'"]').value.trim();if(f.required&&!v)ok=false});$('#magGo').disabled=!ok||busy>0}
function ensure(){if(id)return Promise.resolve(id);return call('POST','/api/magazines/drafts',JSON.stringify({slug:M.slug})).then(function(j){id=j.id;return id})}
function show(slot,key){var el=$('[data-slot="'+key+'"]'),img=$('img',el);if(!img){img=document.createElement('img');img.alt='';el.appendChild(img)}img.src='/api/magazines/drafts/'+id+'/photos/'+key+'?v='+Date.now();el.classList.add('is-done');el.classList.remove('is-bad');$('.mag-slot__tag',el).hidden=false;have[key]=true}
var chain=Promise.resolve(),faceModule;
function framePhoto(f,aspect){if(!faceModule)faceModule=import('/js/magazine-face-framing.mjs?v=3');return faceModule.then(function(m){return m.framePhoto(f,aspect,M.maxBytes)}).catch(function(){return f})}
function uploadFile(el,key,f){msg('');
 if(M.mimes.indexOf(f.type)<0){el.classList.add('is-bad');msg(ERR.invalid_image);return Promise.resolve()}if(f.size>M.maxBytes){el.classList.add('is-bad');msg(ERR.too_large);return Promise.resolve()}
 busy++;el.classList.add('is-busy');ready();
 var job=chain.then(function(){return framePhoto(f,el.dataset.aspect)}).then(function(photo){return ensure().then(function(){return call('PUT','/api/magazines/drafts/'+id+'/photos/'+key,photo,photo.type||f.type)})}).then(function(){show(el,key)}).catch(function(e){el.classList.add('is-bad');msg(ERR[e.message]||'That photo couldn\\u2019t be uploaded. Please try again.')}).then(function(){busy--;el.classList.remove('is-busy');ready()});
 chain=job;return job}
document.querySelectorAll('.mag-slot').forEach(function(el){var key=el.dataset.slot,inp=$('input',el);inp.addEventListener('change',function(){var f=inp.files[0];if(!f)return;uploadFile(el,key,f).then(function(){inp.value=''})})});
var bulk=$('#magBulk');if(bulk)bulk.addEventListener('change',function(){var files=[].slice.call(bulk.files);bulk.value='';if(!files.length)return;msg('');
 var slots=[].slice.call(document.querySelectorAll('.mag-slot')),empty=slots.filter(function(el){return !have[el.dataset.slot]}),targets=empty.length?empty:slots;
 var use=files.slice(0,targets.length);if(files.length>targets.length)msg('You picked '+files.length+' photos but only '+targets.length+' frame'+(targets.length===1?' is':'s are')+' left \\u2014 the first '+targets.length+' were added.');
 use.forEach(function(f,n){var el=targets[n];uploadFile(el,el.dataset.slot,f)})});
document.querySelectorAll('[data-field]').forEach(function(i){i.addEventListener('input',ready)});
$('#magGo').addEventListener('click',function(){var b=this;b.disabled=true;msg('');var fields={};M.fields.forEach(function(f){fields[f.key]=$('[data-field="'+f.key+'"]').value});
 ensure().then(function(){return call('PUT','/api/magazines/drafts/'+id,JSON.stringify({fields:fields}))}).then(function(){return call('POST','/api/magazines/drafts/'+id+'/generate','{}')}).then(function(){location.href='/magazines/m/'+id}).catch(function(e){msg(ERR[e.message]||'Something went wrong. Your photos are saved \\u2014 please try again.');ready()})});
call('GET','/api/magazines/drafts/current?slug='+encodeURIComponent(M.slug)).then(function(j){var o=j.order;if(!o)return;id=o.id;if(o.status!=='draft'&&o.status!=='failed')return location.replace('/magazines/m/'+o.id);
 M.fields.forEach(function(f){var el=$('[data-field="'+f.key+'"]');if(o.fields&&o.fields[f.key])el.value=o.fields[f.key]});(o.slots||[]).forEach(function(k){show(null,k)});if(o.status==='failed')location.replace('/magazines/m/'+o.id);ready()}).catch(function(){});
ready()})();`;

function resultPage(order, mapping, { owner, ready }) {
  const idx = STAGES.findIndex(([k]) => k === order.status);
  const steps = STAGES.map(([k, label], i) => {
    const cls = order.status === 'ready' || i < idx ? 'is-done' : i === idx || (order.status === 'queued' && i === 0) ? 'is-now' : '';
    return `<li class="${cls}" data-step="${k}"><span class="mag-dot"></span>${label}</li>`;
  }).join('');
  let main;
  if (order.status === 'ready') {
    main = `<div class="mag-actions"><a class="btn btn--primary" href="/magazines/m/${order.id}/magazine.pdf?download=1">Download PDF</a>
      ${ready.png ? `<a class="btn" href="/magazines/m/${order.id}/magazine.png?download=1">Download PNG</a>` : ''}
      <a class="btn btn--ghost" href="/magazines">Make another</a></div>
      ${ready.png ? `<img class="mag-result-img" src="/magazines/m/${order.id}/magazine.png" alt="Your finished magazine">` : `<section class="mag-reader" id="magReader" data-pdf="/magazines/m/${order.id}/magazine.pdf" aria-label="Flip through your magazine">
        <div class="mag-reader__top"><span>Flip through every page</span><span id="magReaderTotal">Loading…</span></div>
        <div class="mag-reader__stage" id="magReaderStage" aria-live="polite">
          <canvas class="mag-reader__surface" id="magReaderCanvas" aria-label="Magazine page"></canvas>
          <div class="mag-reader__leaf" id="magReaderLeaf" aria-hidden="true">
            <div class="mag-reader__face mag-reader__face--front"><canvas id="magReaderFront"></canvas></div>
            <div class="mag-reader__face mag-reader__face--back"><canvas id="magReaderBack"></canvas></div>
          </div>
          <div class="mag-reader__status" id="magReaderStatus">Opening your magazine…</div>
        </div>
        <div class="mag-reader__controls"><button type="button" id="magReaderPrev" aria-label="Previous page" disabled>← Previous</button><span class="mag-reader__count" id="magReaderCount" aria-live="polite">— / —</span><button type="button" id="magReaderNext" aria-label="Next page" disabled>Next →</button></div>
        <p class="mag-reader__hint">Swipe or use the arrows to turn pages</p>
        <div class="mag-reader__error" id="magReaderError" role="status" hidden>Preview could not load here. <a href="/magazines/m/${order.id}/magazine.pdf" target="_blank" rel="noopener">Open the PDF in a new tab</a> or download it above.</div>
      </section>`}
      <p class="mag-note" style="margin-top:18px">Keep this page’s link — anyone with it can view this magazine, so share it only with people you choose.</p>`;
  } else if (order.status === 'failed') {
    main = `<div class="mag-note" role="alert"><strong>We couldn’t finish your magazine.</strong><br>${esc(safeMessage(order.error_code))}</div>
      ${owner ? `<div class="mag-actions"><button class="btn btn--primary" id="magRetry">Try again</button></div><p class="mag-msg" id="magMsg"></p>
      <p style="color:var(--ink-soft);font-size:.9rem">Your words and photos are saved — nothing needs to be re-entered.</p>` : '<p>Open this page on the device you used to create it to try again.</p>'}`;
  } else {
    main = `<ol class="mag-steps">${steps}</ol><p class="lede" id="magState">This usually takes under a minute. You can leave this page open.</p>`;
  }
  const js = `<script>(function(){var id=${json(order.id)},st=${json(order.status)};
function poll(){fetch('/api/magazines/'+id+'/status',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){if(j.status!==st&&(j.status==='ready'||j.status==='failed'))return location.reload();
 var order=['preparing','uploading','generating','exporting'],i=Math.max(0,order.indexOf(j.status));document.querySelectorAll('[data-step]').forEach(function(li,n){li.className=n<i?'is-done':n===i?'is-now':''})}).catch(function(){})}
if(st!=='ready'&&st!=='failed')setInterval(poll,2000);
var b=document.getElementById('magRetry');if(b)b.addEventListener('click',function(){b.disabled=true;fetch('/api/magazines/drafts/'+id+'/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(r){if(!r.ok)throw 0;location.reload()}).catch(function(){b.disabled=false;document.getElementById('magMsg').textContent='We couldn\\u2019t restart it just now. Please try again in a moment.'})})})();</script>`;
  const readerScript = order.status === 'ready' && !ready.png
    ? '<script type="module" src="/js/magazine-preview.mjs"></script>' : '';
  return shell(`${mapping.name} — your magazine`, `<div class="mag-eyebrow">${esc(mapping.name)}</div>
    <h1>${order.status === 'ready' ? 'Your magazine is ready.' : order.status === 'failed' ? 'Almost there…' : 'Creating your magazine…'}</h1>${main}`,
    { robots: 'noindex,nofollow', scripts: js + readerScript, canonical: '' });
}

function adminPage({ configured, connection, templates, orders, flash }) {
  const conn = connection && connection.refresh_enc
    ? `<span class="mag-pill ok">Connected</span> ${esc(connection.account_label || 'Canva account')} <small>· since ${new Date(connection.connected_at).toISOString().slice(0, 10)}</small>
       <form class="inline" method="post" action="/admin/canva/disconnect" onsubmit="return confirm('Disconnect Canva? Magazine generation will stop until you reconnect.')"><button class="btn btn--small">Disconnect</button></form>`
    : `<span class="mag-pill bad">Not connected</span> ${configured ? '<a class="btn btn--primary btn--small" href="/admin/canva/connect">Connect Canva account</a>'
      : '<small>Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET and CANVA_TOKEN_ENCRYPTION_KEY, then redeploy.</small>'}`;
  const rows = templates.map(({ mapping: m, row }) => {
    const v = row.validation || {};
    const problems = (v.problems || []).map(p => `<li>${esc(p.code.replace(/_/g, ' '))}: <code>${esc(p.field)}</code>${p.expected ? ` (expected ${esc(p.expected)}${p.actual ? ', found ' + esc(p.actual) : ''})` : p.actual ? ` (${esc(p.actual)})` : ''}</li>`).join('');
    return `<tr><td><strong>${esc(m.name)}</strong><br><small>${esc(m.slug)} · ${m.pageCount} page${m.pageCount > 1 ? 's' : ''}</small></td>
      <td><code>${esc(m.canvaTemplateId)}</code><br><small>${m.fields.length} text · ${m.images.length} photo fields</small></td>
      <td>${row.validated_at ? (v.ok ? '<span class="mag-pill ok">Matches Canva</span>' : '<span class="mag-pill bad">Mismatch</span>') + `<br><small>${new Date(row.validated_at).toISOString().slice(0, 16).replace('T', ' ')}</small>` : '<span class="mag-pill">Not validated</span>'}${problems ? `<ul>${problems}</ul>` : ''}</td>
      <td>${row.status === 'published' ? '<span class="mag-pill ok">Published</span>' : '<span class="mag-pill">Draft</span>'}</td>
      <td><form class="inline" method="post" action="/admin/magazines/${esc(m.slug)}/validate"><button class="btn btn--small">Validate vs Canva</button></form>
      ${row.status === 'published' ? `<form class="inline" method="post" action="/admin/magazines/${esc(m.slug)}/unpublish"><button class="btn btn--small">Unpublish</button></form>`
        : `<form class="inline" method="post" action="/admin/magazines/${esc(m.slug)}/publish"><button class="btn btn--primary btn--small" ${v.ok ? '' : 'disabled title="Validate successfully first"'}>Publish</button></form>`}
      <a class="btn btn--ghost btn--small" href="/magazines/${esc(m.slug)}">Open</a></td></tr>`;
  }).join('');
  const orderRows = orders.map(o => `<tr><td><a href="/magazines/m/${o.id}">${o.id.slice(0, 8)}</a></td><td>${esc(o.template_slug)}</td>
    <td><span class="mag-pill ${o.status === 'ready' ? 'ok' : o.status === 'failed' ? 'bad' : ''}">${esc(o.status)}</span>${o.error_code ? `<br><small>${esc(o.error_code)} @ ${esc(o.error_stage || '')}</small>` : ''}</td>
    <td>${o.attempts}</td><td>${new Date(o.created_at).toISOString().slice(0, 16).replace('T', ' ')}</td>
    <td>${o.status === 'failed' ? `<form class="inline" method="post" action="/admin/magazines/orders/${o.id}/retry"><button class="btn btn--small">Retry</button></form>` : ''}</td></tr>`).join('');
  return shell('Magazines — Admin', `<div class="mag-eyebrow">Admin</div><h1>Magazines</h1>
    ${flash ? `<div class="mag-flash" role="status">${esc(flash)}</div>` : ''}
    <div class="mag-panel"><h2>Canva connection</h2><p>${conn}</p></div>
    <div class="mag-panel"><h2>Designs</h2><table><thead><tr><th>Design</th><th>Canva template</th><th>Live check</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="mag-panel"><h2>Recent magazines</h2>${orders.length ? `<table><thead><tr><th>ID</th><th>Design</th><th>Status</th><th>Tries</th><th>Created (UTC)</th><th></th></tr></thead><tbody>${orderRows}</tbody></table>` : '<p>None yet.</p>'}</div>`,
    { robots: 'noindex,nofollow', current: '/admin' });
}

const notFound = () => shell('Not found', '<h1>We couldn’t find that.</h1><p class="lede"><a href="/magazines">Browse magazine designs</a></p>', { robots: 'noindex' });
module.exports = { catalogue, formPage, samplePage, resultPage, adminPage, notFound, STAGES };
