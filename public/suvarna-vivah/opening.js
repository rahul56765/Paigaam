/* Film first. Its final gold frame dissolves into the botanical invitation. */
(() => {
  'use strict';
  let activeClose=null;
  function create(){
  const bootEl=document.getElementById('sp-boot');if(!bootEl||document.getElementById('sv-opener'))return;
  let boot;try{boot=JSON.parse(bootEl.textContent||'{}');}catch{return;}
  const C=window.SPCore,I=window.SPI18N,d=window.SVCurrentData||boot.data||{},lang=document.documentElement.lang||d.lang?.default||'en';
  const text=k=>I?I.t(lang,k):k;
  const sides=d.couple?.order==='bride'?['bride','groom']:['groom','bride'];
  const names=sides.map(side=>C?C.txt(d,lang,`couple.${side}.first`):d.couple?.[side]?.first).filter(Boolean).join(' & ');
  const root=document.createElement('section');root.id='sv-opener';root.className='sv-opener';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Suvarna Vivah opening film');
  root.innerHTML=`<video class="sv-opener__video" id="svOpeningVideo" playsinline webkit-playsinline preload="metadata" poster="/suvarna-vivah/opening-poster.jpg"><source src="/suvarna-vivah/opening.mp4" type="video/mp4"></video><div class="sv-opener__veil" aria-hidden="true"></div><div class="sv-opener__copy"><p class="sv-opener__kicker">SUVARNA VIVAH</p><p class="sv-opener__names" id="svOpenerNames"></p><p class="sv-opener__title"></p><button class="sv-opener__play" id="svPlay" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16l12-8z"/></svg><span></span></button><p class="sv-opener__duration">00:10 · A CEREMONIAL BEGINNING</p></div><p class="sv-opener__status" id="svOpenerStatus" role="status" aria-live="polite"></p><button class="sv-opener__skip" id="svSkip" type="button"></button>`;
  document.body.appendChild(root);document.documentElement.classList.add('sv-opening-lock');document.body.classList.add('sv-opening-lock');
  const app=document.getElementById('sv-app');if(app)app.inert=true;
  root.querySelector('#svOpenerNames').textContent=names;root.querySelector('.sv-opener__title').textContent=text('gettingMarried');root.querySelector('#svPlay span').textContent=text('tapToOpen');root.querySelector('#svSkip').textContent=text('skipIntro')+' ↗';
  const video=root.querySelector('video'),play=root.querySelector('#svPlay'),skip=root.querySelector('#svSkip'),status=root.querySelector('#svOpenerStatus');
  let started=false,leaving=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function keydown(e){
    if(leaving)return;
    if(e.key==='Escape'){e.preventDefault();reveal();}
    if(e.key==='Tab'){e.preventDefault();if(started){skip.focus();}else{(document.activeElement===play?skip:play).focus();}}
  }
  function reveal(){
    if(leaving)return;leaving=true;video.pause();
    window.scrollTo({top:0,behavior:'instant'});window.SPInvite?.reveal();root.classList.add('is-leaving');
    // Scroll remains locked until the final film frame has dissolved, avoiding a jump on phones.
    setTimeout(()=>{root.remove();document.documentElement.classList.remove('sv-opening-lock');document.body.classList.remove('sv-opening-lock');if(app)app.inert=false;document.removeEventListener('keydown',keydown);const heading=document.querySelector('.sv-hero__names');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}},reduced?30:1250);
  }
  activeClose=reveal;
  async function start(){
    if(started||leaving)return;started=true;root.classList.add('is-playing');status.textContent='';video.currentTime=0;
    try{await video.play();skip.focus({preventScroll:true});}
    catch{started=false;root.classList.remove('is-playing');status.textContent=text('errGeneric');play.focus({preventScroll:true});}
  }
  root.addEventListener('click',e=>{if(!e.target.closest('#svSkip'))start();});skip.addEventListener('click',reveal);
  video.addEventListener('ended',reveal,{once:true});video.addEventListener('error',()=>{status.textContent=text('errGeneric');root.classList.remove('is-playing');started=false;});
  document.addEventListener('keydown',keydown);play.focus({preventScroll:true});
  }
  window.SVOpening={show:create,close:()=>activeClose?.()};
  let initial={};try{initial=JSON.parse(document.getElementById('sp-boot')?.textContent||'{}');}catch{}
  if(!initial.autoOpen)create();
})();
