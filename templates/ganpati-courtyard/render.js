'use strict';
/**
 * Public page for a published Ganpati Courtyard paigaam (/p/ganpati-…).
 *
 * The video IS the invitation: autoplay muted (WhatsApp-in-app browsers
 * refuse anything else), a single tap unmutes, and prominent actions let the
 * recipient download the personalised MP4 — captions already burned in —
 * or share it onward. The Paigaam badge matches the other templates.
 */
const { logoFull } = require('../../lib/brand');
const { buildCues, PALETTE } = require('./captions');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderVideoPage(paigaam, opts = {}) {
  const d = paigaam.customer_data || {};
  const cues = buildCues(d);
  const cuesJson = JSON.stringify(cues).replace(/</g, '\\u003c');
  const videoUrl = '/ganpati-courtyard/media/courtyard.mp4';
  const poster = '/ganpati-courtyard/media/courtyard-poster.jpg';
  const exportUrl = paigaam.id ? `/ganpati-courtyard/video/${paigaam.id}.mp4` : '';
  const title = esc(`Ganpati Aagman — ${d.familyName || 'परिवार'} परिवार`);

  return `<!DOCTYPE html>
<html lang="mr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f7efe1">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="A Ganpati Aagman invitation from the ${esc(d.familyName || '')} family.">
<meta property="og:image" content="${opts.baseUrl || ''}${poster}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/brand/favicon-512.png" type="image/png">
<style>
@font-face{font-family:'Tiro Devanagari Marathi';src:url('/ganpati-courtyard/media/TiroDevanagariMarathi-Regular.ttf') format('truetype');font-display:swap;unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+0020-007E}
*{box-sizing:border-box}
body{margin:0;background:#f2e7d3;font-family:'Tiro Devanagari Marathi',Georgia,serif;color:#4a2c14;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 14px}
.wrap{width:100%;max-width:430px;display:grid;gap:16px}
.frame{position:relative;border-radius:24px;overflow:hidden;aspect-ratio:9/16;box-shadow:0 24px 60px -24px rgba(74,44,20,.55);background:#efe4cf}
.frame video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.captions{position:absolute;inset:0;pointer-events:none}
.cap{position:absolute;left:50%;transform:translate(-50%,-50%);width:82%;text-align:center;opacity:0;transition:opacity .4s ease;text-shadow:0 0 10px rgba(255,250,240,.9),0 1px 2px rgba(255,250,240,.7)}
.cap.on{opacity:1}
.sound{position:absolute;top:12px;right:12px;z-index:3;border:0;border-radius:999px;padding:8px 14px;font:inherit;font-size:.85rem;background:rgba(255,250,240,.92);color:#7a2d0c;cursor:pointer;box-shadow:0 4px 14px rgba(74,44,20,.3)}
.brand{display:flex;justify-content:center}
.brand a{color:#7a5a3a;text-decoration:none;font-size:.85rem;border-bottom:1px solid #e2d2b4;display:flex;align-items:center;gap:8px}
.actions{display:grid;gap:10px}
.btn{border:0;border-radius:999px;padding:14px 22px;font:inherit;font-size:1rem;cursor:pointer;text-align:center;text-decoration:none;transition:transform .15s ease}
.btn:active{transform:scale(.98)}
.btn--d{background:linear-gradient(135deg,#b45a12,#c9963c);color:#fffaf1;box-shadow:0 12px 28px -10px rgba(180,90,18,.6)}
.btn--s{background:#fffaf1;color:#7a2d0c;border:1px solid #e2d2b4}
@media (prefers-reduced-motion:reduce){.cap{transition:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="frame">
    <video id="v" src="${videoUrl}" poster="${poster}" playsinline autoplay muted loop preload="auto"></video>
    <div class="captions" id="caps" aria-hidden="true"></div>
    <button type="button" class="sound" id="sound">🔇 Sound on</button>
  </div>
  <div class="actions">
    <a class="btn btn--d" id="dl" href="${esc(exportUrl)}" download="ganpati-aagman-invitation.mp4">⬇ Download this video</a>
    <a class="btn btn--s" id="share" href="#" hidden>↗ Share onward</a>
  </div>
  <p style="text-align:center;margin:0;font-size:.8rem;color:#7a5a3a">Your personalized Ganpati Aagman video is ready to share ❤️</p>
  <div class="brand"><a href="/" target="_blank" rel="noopener">${logoFull(96)}</a></div>
</div>
<script>
(function(){
  var CUES=${cuesJson};
  var v=document.getElementById('v'),caps=document.getElementById('caps'),btn=document.getElementById('sound');
  var k=function(){return v.clientHeight/1280};
  var boxes=CUES.map(function(c){
    return c.lines.map(function(l){
      var d=document.createElement('div');d.className='cap';d.textContent=l.text;
      caps.appendChild(d);return {el:d,line:l,cue:c};
    });
  }).reduce(function(a,x){return a.concat(x)},[]);
  function paint(){
    var kk=k(),t=v.currentTime;
    boxes.forEach(function(b){
      b.el.style.fontSize=Math.round(b.line.size*kk*0.82)+'px';
      b.el.style.top=Math.round(b.line.y*kk)+'px';
      b.el.style.color=b.line.colour==='#7a2d0c'?'#7a2d0c':'#4a2c14';
      b.el.classList.toggle('on',t>=b.cue.start&&t<b.cue.end);
    });
  }
  v.addEventListener('timeupdate',paint);
  v.addEventListener('loadedmetadata',paint);
  window.addEventListener('resize',paint);
  paint();
  btn.addEventListener('click',function(){
    v.muted=false;v.loop=false;v.currentTime=0;v.play();
    btn.textContent='🔊 Sound on';btn.disabled=true;
  });
  var s=document.getElementById('share');
  if(navigator.share){s.hidden=false;s.addEventListener('click',function(e){
    e.preventDefault();
    navigator.share({title:document.title,url:location.href}).catch(function(){});
  });}
})();
</script>
</body>
</html>`;
}

module.exports = { renderVideoPage };
