(() => {
'use strict';
const $ = s => document.querySelector(s);
const data = JSON.parse($('#dv-data').textContent);
const main = $('#dv-main'), gate = $('#dv-gate'), video = $('#dv-video'), glow = $('#dv-glow'), open = $('#dv-open'), skip = $('#dv-skip'), status = $('#dv-video-status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let phase = 'idle', finishTimer, safetyTimer;
let lastVolume = 1;
const setTimer = (fn, delay) => window.setTimeout(fn, reduced ? Math.min(delay, 120) : delay);
function fitText() {
 const fitted = [...document.querySelectorAll('[data-fit]')];
 fitted.forEach(el => { el.style.fontSize = ''; });
 fitted.forEach(el => {
  const start = parseFloat(getComputedStyle(el).fontSize);
  // Devanagari conjuncts remain whole: size the actual shaped DOM, never slice letters.
  const limit = el.classList.contains('dv-name') ? .3 : .4;
  for (let ratio=1; ratio >= limit; ratio-=.025) {
   el.style.fontSize = (start * ratio) + 'px';
   if (el.scrollWidth <= el.clientWidth + 1 && (!el.classList.contains('dv-copy') || el.scrollHeight <= el.clientHeight + 1)) break;
  }
 });
}
function loadMap() {
 const frame = $('#dv-map');
 if (!frame.src && frame.dataset.src) frame.src = frame.dataset.src;
}
function showInvitation() {
 if (phase === 'done') return;
 phase = 'done'; clearTimeout(finishTimer);clearTimeout(safetyTimer);
 video.pause();video.muted=true;
 gate.hidden = true;gate.style.display='none';
 main.inert = false; main.classList.add('is-visible');
 document.documentElement.style.overflow = '';document.body.style.overflow='';
 window.scrollTo({top:0,behavior:'instant'});fitText();
 $('#dv-invitation').focus({preventScroll:true});
 requestAnimationFrame(()=>requestAnimationFrame(()=>{glow.classList.remove('is-bright');glow.classList.add('is-fading');}));
 setTimer(()=>{glow.style.display='none';},1800);
 if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loadMap();io.disconnect();}},{rootMargin:'200px'});io.observe($('#dv-details'));
 } else loadMap();
}
function reveal() {
 if (phase === 'revealing' || phase === 'done') return;
 phase='revealing'; clearTimeout(safetyTimer);glow.classList.add('is-bright');
 lastVolume=video.volume;
 const began=performance.now();
 function fadeAudio(now){if(phase==='done')return;const p=Math.min(1,(now-began)/850);video.volume=Math.max(0,lastVolume*(1-p));if(p<1)requestAnimationFrame(fadeAudio);}
 requestAnimationFrame(fadeAudio);
 finishTimer=setTimer(showInvitation,900);
}
function failed() {
 if(phase==='done'||phase==='revealing')return;
 status.textContent='व्हिडिओ उपलब्ध नाही. आमंत्रण उघडण्यासाठी खालील बटण दाबा.';
 skip.hidden=false;open.disabled=false;gate.classList.remove('is-playing');phase='failed';
}
async function start() {
 if(phase==='failed'){reveal();return;}
 if(phase!=='idle')return;
 phase='playing';open.disabled=true;gate.classList.add('is-playing');skip.hidden=false;
 if(reduced){reveal();return;}
 try { await video.play(); }
 catch { if(phase==='done'||phase==='revealing')return; video.muted=true;try{await video.play();}catch{failed();return;} }
 safetyTimer=window.setTimeout(()=>{if(phase==='playing'){status.textContent='व्हिडिओ लोड होत आहे. हवे असल्यास आमंत्रण थेट उघडा.';skip.hidden=false;}},15000);
}
open.addEventListener('click',start);
skip.addEventListener('click',reveal);
video.addEventListener('timeupdate',()=>{if(phase==='playing'&&video.currentTime>=9.05)reveal();});
video.addEventListener('ended',reveal);
video.addEventListener('error',failed);
video.addEventListener('playing',()=>{status.textContent='';});
video.addEventListener('waiting',()=>{if(phase==='playing')status.textContent='व्हिडिओ लोड होत आहे…';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&phase!=='done')reveal();});
document.documentElement.style.overflow='hidden';
const target = Date.parse(data.date+'T'+data.time+':00+05:30');
const digits=n=>String(n).padStart(2,'0').replace(/\d/g,c=>'०१२३४५६७८९'[Number(c)]);
const formatter = new Intl.DateTimeFormat('mr-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata'});
if(Number.isFinite(target)) $('.dv-target').textContent=formatter.format(new Date(target))+' · IST';
function tick(){
 if(!Number.isFinite(target))return;
 const remaining=Math.max(0,Math.floor((target-Date.now())/1000));
 const units={days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
 for(const [key,value] of Object.entries(units))document.querySelector('[data-unit="'+key+'"]').textContent=digits(value);
 const sameDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())===data.date;
 const message=remaining===0?(sameDay?data.dayMessage:data.afterMessage):'';
 if($('#dv-count-status').textContent!==message)$('#dv-count-status').textContent=message;
}
tick();const ticker=window.setInterval(tick,1000);
window.addEventListener('pagehide',()=>{video.pause();clearInterval(ticker);});
window.addEventListener('pageshow',e=>{if(e.persisted){tick();window.setInterval(tick,1000);if(phase==='playing')video.play().catch(failed);}});
window.addEventListener('resize',()=>requestAnimationFrame(fitText));
if(document.fonts)document.fonts.ready.then(fitText);fitText();
if(data.preview && new URLSearchParams(location.search).get('skip')==='1')reveal();
})();
