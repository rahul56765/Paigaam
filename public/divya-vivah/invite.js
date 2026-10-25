(() => {
'use strict';
const $ = s => document.querySelector(s);
const data = JSON.parse($('#dv-data').textContent);
const main = $('#dv-main'), gate = $('#dv-gate'), video = $('#dv-video'), glow = $('#dv-glow'), open = $('#dv-open'), skip = $('#dv-skip'), status = $('#dv-video-status');
const languageDialog = $('#dv-language'), languageChange = $('#dv-language-change'), languageClose = $('#dv-language-close');
const languageNames = {mr:'मराठी',hi:'हिन्दी',en:'English'};
let language = 'mr', languageChosen = false, statusKey = '';
const mapFrame = $('#dv-map'), baseMap = mapFrame.dataset.src;
const directionLinks = [...document.querySelectorAll('.dv-directions'), $('#dv-map-link')];
const baseDirections = directionLinks.map(link => link.getAttribute('href'));
const currentCopy = () => data.copies[language];
const currentUI = () => data.ui[language];
const toDigits = value => String(value).replace(/[0-9०-९]/g, char => {
 const number = /[0-9]/.test(char) ? Number(char) : '०१२३४५६७८९'.indexOf(char);
 return language === 'en' ? String(number) : '०१२३४५६७८९'[number];
});
function setStatus(key) {statusKey=key;status.textContent=key?currentUI()[key]:'';}
function applyLanguage(next) {
 if (!Object.hasOwn(languageNames,next)) return;
 language=next;
 document.documentElement.lang=next;document.body.setAttribute('lang',next);
 const copy=currentCopy(),ui=currentUI();
 document.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=copy[el.dataset.copy] || '';});
 document.title=copy.groomName+' '+copy.joiner+' '+copy.brideName+' · '+copy.weddingHeading;
 $('#dv-invitation').setAttribute('aria-label',copy.weddingHeading);
 $('#dv-details').setAttribute('aria-label',copy.countdownHeading);
 $('.dv-countdown').setAttribute('aria-label',copy.countdownHeading);
 $('#dv-art').setAttribute('alt',ui.artAlt);
 mapFrame.setAttribute('title',copy.locationHeading+' — '+copy.venueName);
 mapFrame.dataset.src=baseMap+'&hl='+next;
 if(mapFrame.src)mapFrame.src=mapFrame.dataset.src;
 directionLinks.forEach((link,i)=>link.setAttribute('href',baseDirections[i]+'&hl='+next));
 $('#dv-map-link').textContent=ui.mapsLabel+' ↗';
 $('#dv-language-current').textContent=languageNames[next];
 languageChange.setAttribute('aria-label',ui.changeLanguageLabel+' — '+languageNames[next]);
 languageChange.setAttribute('title',ui.changeLanguageLabel);
 $('#dv-language-title').textContent=ui.languageDialogTitle;
 $('#dv-language-description').textContent=ui.languageDialogSubtitle;
 languageClose.setAttribute('aria-label',ui.closeLabel);
 document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===next)));
 if(statusKey)setStatus(statusKey);
 tick();fitText();
 if(document.fonts)document.fonts.ready.then(fitText);
}
function chooseLanguage(next) {
 if(!Object.hasOwn(languageNames,next))return;
 const first=!languageChosen;applyLanguage(next);languageChosen=true;
 languageDialog.close();gate.inert=false;languageChange.hidden=false;languageClose.hidden=false;
 (first?open:languageChange).focus({preventScroll:true});
 if(first && data.preview && new URLSearchParams(location.search).get('skip')==='1')reveal();
}
function closeLanguage() {if(!languageChosen)return;languageDialog.close();languageChange.focus({preventScroll:true});}
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>chooseLanguage(button.dataset.language)));
languageChange.addEventListener('click',()=>languageDialog.showModal());
languageClose.addEventListener('click',closeLanguage);
languageDialog.addEventListener('cancel',event=>{event.preventDefault();closeLanguage();});
gate.inert=true;
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
  const limit = el.classList.contains('dv-name') ? .075 : .4;
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
 phase = 'done'; languageChange.hidden=false; clearTimeout(finishTimer);clearTimeout(safetyTimer);
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
 setStatus('videoFailed');languageChange.hidden=false;
 skip.hidden=false;open.disabled=false;gate.classList.remove('is-playing');phase='failed';
}
async function start() {
 if(!languageChosen)return;
 if(phase==='failed'){reveal();return;}
 if(phase!=='idle')return;
 phase='playing';languageChange.hidden=true;open.disabled=true;gate.classList.add('is-playing');skip.hidden=false;
 if(reduced){reveal();return;}
 try { await video.play(); }
 catch { if(phase==='done'||phase==='revealing')return; video.muted=true;try{await video.play();}catch{failed();return;} }
 safetyTimer=window.setTimeout(()=>{if(phase==='playing'){setStatus('videoSlow');skip.hidden=false;}},15000);
}
open.addEventListener('click',start);
skip.addEventListener('click',reveal);
video.addEventListener('timeupdate',()=>{if(phase==='playing'&&video.currentTime>=9.05)reveal();});
video.addEventListener('ended',reveal);
video.addEventListener('error',failed);
video.addEventListener('playing',()=>{setStatus('');});
video.addEventListener('waiting',()=>{if(phase==='playing')setStatus('videoLoading');});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(languageDialog.open){e.preventDefault();closeLanguage();return;}if(languageChosen&&phase!=='done')reveal();});
document.documentElement.style.overflow='hidden';
const target = Date.parse(data.date+'T'+data.time+':00+05:30');
const digits=n=>toDigits(String(n).padStart(2,'0'));

function tick(){
 if(!Number.isFinite(target))return;
 const formatter = new Intl.DateTimeFormat(language+'-IN',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kolkata',numberingSystem:language==='en'?'latn':'deva',...(language!=='en'?{hourCycle:'h23'}:{})});
 $('.dv-target').textContent=formatter.format(new Date(target))+' · '+currentUI().timezoneLabel;
 const remaining=Math.max(0,Math.floor((target-Date.now())/1000));
 const units={days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
 for(const [key,value] of Object.entries(units))document.querySelector('[data-unit="'+key+'"]').textContent=digits(value);
 const sameDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())===data.date;
 const message=remaining===0?(sameDay?currentCopy().weddingDayMessage:currentCopy().afterWeddingMessage):'';
 if($('#dv-count-status').textContent!==message)$('#dv-count-status').textContent=message;
}
tick();const ticker=window.setInterval(tick,1000);
window.addEventListener('pagehide',()=>{video.pause();clearInterval(ticker);});
window.addEventListener('pageshow',e=>{if(e.persisted){tick();window.setInterval(tick,1000);if(phase==='playing')video.play().catch(failed);}});
window.addEventListener('resize',()=>requestAnimationFrame(fitText));
if(document.fonts)document.fonts.ready.then(fitText);fitText();
languageDialog.showModal();
})();
