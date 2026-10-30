(function(){
'use strict';
var app=document.getElementById('pvApp'),stage=document.getElementById('pvStage'),card=document.getElementById('pvCard');
if(!app||!stage||!card)return;
var pages=Array.from(card.querySelectorAll('[data-pv-page]')),dots=Array.from(app.querySelectorAll('[data-pv-go]')),prev=app.querySelector('[data-pv-prev]'),next=app.querySelector('[data-pv-next]'),open=app.querySelector('[data-pv-open]'),counter=app.querySelector('[data-pv-current]');
var reduce=window.matchMedia('(prefers-reduced-motion: reduce)'),index=0,locked=false,timer=0,touch=null,layoutFrame=0;
var video=document.getElementById('pvOpeningVideo'),light=app.querySelector('.pv-white-light'),coverStatus=app.querySelector('.pv-cover-status'),openingPending=false,openingTarget=1,openingFrame=0,openingWatchdog=0;
function fit(box){
 var inner=box.querySelector('.pv-fit-inner');if(!inner)return;
 var low=.15,high=1;box.style.setProperty('--fit','1');
 if(inner.scrollHeight<=box.clientHeight+1&&inner.scrollWidth<=box.clientWidth+1){box.dataset.fit='1';return;}
 for(var i=0;i<12;i++){var mid=(low+high)/2;box.style.setProperty('--fit',mid.toFixed(4));if(inner.scrollHeight>box.clientHeight||inner.scrollWidth>box.clientWidth)high=mid;else low=mid;}
 box.style.setProperty('--fit',Math.max(.15,low-.008).toFixed(4));box.dataset.fit=low.toFixed(4);
}
function layout(){
 layoutFrame=0;var scale=Math.max(.01,Math.min(stage.clientWidth/720,stage.clientHeight/1280, .75));
 card.style.setProperty('--pv-scale',String(scale));pages.forEach(function(p){p.querySelectorAll('[data-pv-fit]').forEach(fit);});
}
function queueLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(layout);}
function sync(){
 pages.forEach(function(p,i){var current=i===index;p.classList.toggle('is-current',current);p.setAttribute('aria-hidden',String(!current));p.inert=!current;});
 dots.forEach(function(dot,i){if(i===index)dot.setAttribute('aria-current','page');else dot.removeAttribute('aria-current');});
 prev.disabled=index===0;next.disabled=index===pages.length-1;counter.textContent=String(index+1);app.classList.toggle('pv-at-cover',index===0);
 open.disabled=index!==0;
 if(index===0&&!openingPending){if(video){video.pause();try{video.currentTime=0;}catch(_){}}app.classList.remove('pv-video-playing');if(light){light.style.transition='none';light.style.opacity='0';}}

}
function finishOpening(failed){
 if(!openingPending)return;openingPending=false;clearTimeout(openingWatchdog);if(openingFrame)cancelAnimationFrame(openingFrame);openingFrame=0;if(video)video.pause();
 if(coverStatus)coverStatus.textContent=failed?'The opening could not play. Continuing to your invitation.':'';
 if(light){light.style.transition='opacity .16s ease';light.style.opacity='1';}
 timer=setTimeout(function(){index=openingTarget;sync();requestAnimationFrame(function(){if(light){light.style.transition='opacity .75s ease';light.style.opacity='0';}});timer=setTimeout(function(){app.classList.remove('pv-opening','pv-video-playing');locked=false;},850);},160);
}
function openingProgress(){
 if(!openingPending||!video)return;
 var time=video.currentTime||0,amount=Math.max(0,Math.min(1,(time-3.85)/.5));amount=amount*amount*(3-2*amount);
 if(light){light.style.transition='none';light.style.opacity=String(amount);}
 if(time>=4.43){finishOpening(false);return;}
 openingFrame=requestAnimationFrame(openingProgress);
}
function openCover(target){
 if(locked||index!==0)return;locked=true;startMusic();openingTarget=target||1;app.classList.add('pv-has-opened');open.disabled=true;
 if(reduce.matches){index=openingTarget;sync();locked=false;return;}
 openingPending=true;app.classList.add('pv-opening');if(coverStatus)coverStatus.textContent='';if(light){light.style.transition='none';light.style.opacity='0';}
 if(!video){finishOpening(true);return;}
 try{video.currentTime=0;video.muted=true;var playback=video.play();if(playback&&playback.catch)playback.catch(function(){finishOpening(true);});}catch(_){finishOpening(true);}
 if(openingPending){openingFrame=requestAnimationFrame(openingProgress);openingWatchdog=setTimeout(function(){finishOpening(true);},15000);}
}
if(video){
 video.addEventListener('playing',function(){if(openingPending){app.classList.add('pv-video-playing');if(coverStatus)coverStatus.textContent='';}});
 video.addEventListener('waiting',function(){if(openingPending&&coverStatus)coverStatus.textContent='Your invitation is loading…';});
 video.addEventListener('ended',function(){finishOpening(false);});video.addEventListener('error',function(){finishOpening(true);});
}

function move(n){
 if(locked||n<0||n>=pages.length||n===index)return;
 if(index===0&&n>0){openCover(n);return;}
 index=n;locked=true;sync();timer=setTimeout(function(){locked=false;},reduce.matches?0:900);
}
open.addEventListener('click',function(){openCover(1);});
prev.addEventListener('click',function(){move(index-1);});next.addEventListener('click',function(){move(index+1);});dots.forEach(function(dot){dot.addEventListener('click',function(){move(Number(dot.dataset.pvGo));});});
document.addEventListener('keydown',function(e){if(e.target.matches('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowRight'){e.preventDefault();move(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();move(index-1);}});
stage.addEventListener('pointerdown',function(e){if(e.isPrimary===false||e.target.closest('button,a'))return;touch={id:e.pointerId,x:e.clientX,y:e.clientY};});
stage.addEventListener('pointerup',function(e){if(!touch||e.pointerId!==touch.id)return;var dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.3)move(index+(dx<0?1:-1));});
stage.addEventListener('pointercancel',function(){touch=null;});
  var music=app.querySelector('[data-pv-music]'),audio=document.getElementById('pvAudio'),playing=false,frame=null,musicStarted=false;
  var musicButton=music&&music.querySelector('button'),status=music&&music.querySelector('[role=status]');
  function musicState(on){playing=on;if(musicButton){musicButton.setAttribute('aria-pressed',String(on));musicButton.setAttribute('aria-label',on?'Pause music':'Play music');}}
  function playNative(){audio.play().then(function(){musicState(true);status.textContent='';}).catch(function(){musicState(false);status.textContent='Tap ♪ to play your song.';});}
  function startMusic(){
    if(!music||musicStarted)return;musicStarted=true;
    if(audio){playNative();return;}
    if(music.dataset.youtube){frame=document.createElement('iframe');frame.title='Background song';frame.allow='autoplay; encrypted-media';frame.id='pvYouTube';frame.src='https://www.youtube-nocookie.com/embed/'+music.dataset.youtube+'?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist='+music.dataset.youtube+'&origin='+encodeURIComponent(location.origin);frame.addEventListener('load',function(){frame.contentWindow.postMessage(JSON.stringify({event:'listening',id:'pvYouTube'}),'https://www.youtube-nocookie.com');frame.contentWindow.postMessage(JSON.stringify({event:'command',func:'addEventListener',args:['onStateChange']}),'https://www.youtube-nocookie.com');});music.querySelector('[data-pv-player]').appendChild(frame);musicState(false);status.textContent='If the song is silent, tap ♪ to play.';}
  }
  if(audio){audio.addEventListener('playing',function(){musicState(true);status.textContent='';});audio.addEventListener('pause',function(){musicState(false);});audio.addEventListener('error',function(){musicState(false);status.textContent='This song could not be loaded. The invitation is still available.';});}
  if(musicButton)musicButton.addEventListener('click',function(){if(!musicStarted){startMusic();return;}if(audio){if(playing)audio.pause();else playNative();}else if(frame){frame.contentWindow.postMessage(JSON.stringify({event:'command',func:playing?'pauseVideo':'playVideo',args:[]}), 'https://www.youtube-nocookie.com');if(!playing)status.textContent='Playback depends on this song’s YouTube availability.';}});
  window.addEventListener('message',function(e){if(!frame||e.source!==frame.contentWindow||e.origin!=='https://www.youtube-nocookie.com')return;var d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch(_){return;}if(d){var state=d.event==='onStateChange'?d.info:d.info&&d.info.playerState;if(typeof state==='number'){musicState(state===1);if(playing)status.textContent='';}}});
  document.addEventListener('visibilitychange',function(){app.classList.toggle('pv-paused',document.hidden);if(document.hidden&&audio&&playing)audio.pause();});
pages.forEach(function(p){p.querySelectorAll('.pv-reveal').forEach(function(n,i){n.style.setProperty('--line',i);});});
window.addEventListener('resize',queueLayout);if(window.visualViewport)window.visualViewport.addEventListener('resize',queueLayout);
if(window.ResizeObserver)new ResizeObserver(queueLayout).observe(stage);
if(document.fonts)document.fonts.ready.then(queueLayout);
layout();sync();
})();
