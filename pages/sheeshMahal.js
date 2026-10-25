'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderSheeshMahalPage(data,options={}){
 const json=JSON.stringify(data||{}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const names=[data?.couple?.groom?.first,data?.couple?.bride?.first].filter(Boolean).join(' & ')||'Sheesh Mahal';
 return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#082e2c"><title>${esc(names)} · A Palace Wedding</title>${options.noindex||options.preview?'<meta name="robots" content="noindex,nofollow">':''}<meta name="description" content="You are invited. A cinematic palace wedding invitation."><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500;600&family=Noto+Serif+Devanagari:wght@400;500&display=swap" rel="stylesheet"><link rel="stylesheet" href="/sheesh-mahal/sheesh.css?v=1"></head><body>
 <div id="world" aria-hidden="true"><img class="environment sunset" src="/sheesh-mahal/sunset.webp" alt=""><img class="environment night" src="/sheesh-mahal/night.webp" alt=""><canvas id="palace"></canvas><div class="world-shade"></div></div>
 <a class="skip" href="#invitation">Skip to invitation</a><header class="chrome"><a href="#arrival" class="seal" aria-label="Back to arrival">S<span>M</span></a><span class="edition">A PALACE WEDDING</span><button id="motion" class="icon-button" aria-pressed="false">Still mode</button></header>
 <main id="story"></main><nav id="chapters" aria-label="Invitation chapters"></nav><div id="progress" aria-hidden="true"></div><button id="music" class="music" hidden aria-pressed="false">♫ Play your song</button><p id="sound-status" class="sr" aria-live="polite"></p>
 <noscript><section class="nojs"><h1>${esc(names)}</h1><p>You are warmly invited to celebrate our wedding.</p><p>Please enable JavaScript to explore the cinematic invitation and event details.</p></section></noscript>
 <script id="sm-data" type="application/json">${json}</script><script src="/shaadi-paigaam/i18n.js"></script><script src="/sheesh-mahal/core.js?v=1"></script><script src="/sheesh-mahal/three.min.js"></script><script src="/sheesh-mahal/scene.js?v=1"></script></body></html>`;
}
module.exports={renderSheeshMahalPage};
