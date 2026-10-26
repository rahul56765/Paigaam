(function(){
  'use strict';
  var app=document.getElementById('lvApp'),stage=document.getElementById('lvStage'),card=document.getElementById('lvCard');
  if(!app||!card)return;
  var pages=Array.from(card.querySelectorAll('[data-lv-page]')),dots=Array.from(app.querySelectorAll('[data-lv-go]'));
  var prev=app.querySelector('[data-lv-prev]'),next=app.querySelector('[data-lv-next]'),counter=app.querySelector('[data-lv-current]'),open=app.querySelector('[data-lv-open]');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)'),index=0,locked=false,opened=false,timer=0,touch=null;
  function layout(){
    var w=Math.max(1,Math.min(stage.clientWidth,stage.clientHeight*9/16,480));
    card.style.setProperty('--card-w',w+'px');card.style.setProperty('--card-h',(w*16/9)+'px');
    pages.forEach(fit);
  }
  function fit(page){
    var box=page.querySelector('[data-lv-fit]');if(!box)return;
    var inner=box.querySelector('.lv-copy-inner');
    box.style.setProperty('--fit','1');
    // Solve typography inside the reference's reserved copy zone, never crop live text.
    var scale=1;
    while((inner.scrollHeight>box.clientHeight+1||inner.scrollWidth>box.clientWidth+1)&&scale>.40){scale-=.025;box.style.setProperty('--fit',scale.toFixed(3));}
    page.dataset.fit=scale.toFixed(3);
  }
  function sync(){
    pages.forEach(function(p,i){var active=i===index;p.classList.toggle('is-current',active);p.classList.toggle('is-before',i<index);p.setAttribute('aria-hidden',String(!active));p.inert=!active;});
    dots.forEach(function(dot,i){if(i===index)dot.setAttribute('aria-current','page');else dot.removeAttribute('aria-current');});
    prev.disabled=index===0;next.disabled=index===pages.length-1;counter.textContent=String(index+1);
    if(index===0){pages[0].classList.remove('is-opening');open.disabled=false;}
    fit(pages[index]);
  }
  function move(n){
    if(locked||n<0||n>=pages.length||n===index)return;
    if(index===0&&n>0&&!opened){openCover(n);return;}
    locked=true;index=n;sync();clearTimeout(timer);timer=setTimeout(function(){locked=false;},reduce.matches?0:1100);
  }
  function openCover(target){
    if(locked)return;locked=true;startMusic();pages[0].classList.add('is-opening');open.disabled=true;
    clearTimeout(timer);timer=setTimeout(function(){opened=true;locked=false;index=target||1;sync();locked=true;timer=setTimeout(function(){locked=false;},reduce.matches?0:1100);},reduce.matches?0:2800);
    // A phone's orientation permission is optional; never interrupt the seal opening with a prompt.
    if(window.DeviceOrientationEvent&&typeof window.DeviceOrientationEvent.requestPermission==='function'&&!reduce.matches){app.querySelector('[data-lv-motion]').hidden=false;}
  }
  open.addEventListener('click',function(){openCover(1);});
  prev.addEventListener('click',function(){move(index-1);});next.addEventListener('click',function(){move(index+1);});
  dots.forEach(function(dot){dot.addEventListener('click',function(){move(Number(dot.dataset.lvGo));});});
  document.addEventListener('keydown',function(e){if(e.target.matches('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowRight'){e.preventDefault();move(index+1);}if(e.key==='ArrowLeft'){e.preventDefault();move(index-1);}});
  stage.addEventListener('pointerdown',function(e){if(e.isPrimary===false||e.target.closest('button'))return;touch={x:e.clientX,y:e.clientY,id:e.pointerId};});
  stage.addEventListener('pointerup',function(e){if(!touch||e.pointerId!==touch.id)return;var dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)move(index+(dx<0?1:-1));resetTilt();});
  stage.addEventListener('pointercancel',function(){touch=null;resetTilt();});
  var raf=0,pendingX=0,pendingY=0;
  function tilt(x,y){if(reduce.matches)return;pendingX=Math.max(-1.2,Math.min(1.2,x));pendingY=Math.max(-1.2,Math.min(1.2,y));if(raf)return;raf=requestAnimationFrame(function(){card.style.setProperty('--tilt-x',pendingX+'deg');card.style.setProperty('--tilt-y',pendingY+'deg');raf=0;});}
  function resetTilt(){tilt(0,0);}
  stage.addEventListener('pointermove',function(e){if(e.pointerType==='touch'&&!touch)return;var r=card.getBoundingClientRect();tilt(-(e.clientY-r.top-r.height/2)/r.height*2,(e.clientX-r.left-r.width/2)/r.width*2);});
  stage.addEventListener('pointerleave',resetTilt);
  function orientation(e){if(document.hidden)return;if(e.beta==null||e.gamma==null)return;tilt((e.beta-40)/35,e.gamma/25);}
  if(window.DeviceOrientationEvent&&typeof window.DeviceOrientationEvent.requestPermission!=='function')window.addEventListener('deviceorientation',orientation,{passive:true});
  app.querySelector('[data-lv-motion]').addEventListener('click',function(){var button=this;window.DeviceOrientationEvent.requestPermission().then(function(s){if(s==='granted')window.addEventListener('deviceorientation',orientation,{passive:true});button.hidden=true;}).catch(function(){button.hidden=true;});});
  reduce.addEventListener('change',function(){card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');});
  // Uploads and direct media URLs use native audio, synchronously played in the cover gesture.
  // YouTube is an explicitly supported fallback; provider restrictions may require a retry.
  var music=app.querySelector('[data-lv-music]'),audio=document.getElementById('lvAudio'),playing=false,frame=null,musicStarted=false;
  var musicButton=music&&music.querySelector('button'),status=music&&music.querySelector('[role=status]');
  function musicState(on){playing=on;if(musicButton){musicButton.setAttribute('aria-pressed',String(on));musicButton.setAttribute('aria-label',on?'Pause music':'Play music');}}
  function playNative(){audio.play().then(function(){musicState(true);status.textContent='';}).catch(function(){musicState(false);status.textContent='Tap ♪ to play your song.';});}
  function startMusic(){
    if(!music||musicStarted)return;musicStarted=true;
    if(audio){playNative();return;}
    if(music.dataset.youtube){frame=document.createElement('iframe');frame.title='Background song';frame.allow='autoplay; encrypted-media';frame.id='lvYouTube';frame.src='https://www.youtube-nocookie.com/embed/'+music.dataset.youtube+'?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist='+music.dataset.youtube+'&origin='+encodeURIComponent(location.origin);frame.addEventListener('load',function(){frame.contentWindow.postMessage(JSON.stringify({event:'listening',id:'lvYouTube'}),'https://www.youtube-nocookie.com');frame.contentWindow.postMessage(JSON.stringify({event:'command',func:'addEventListener',args:['onStateChange']}),'https://www.youtube-nocookie.com');});music.querySelector('[data-lv-player]').appendChild(frame);musicState(false);status.textContent='If the song is silent, tap ♪ to play.';}
  }
  if(audio){audio.addEventListener('playing',function(){musicState(true);status.textContent='';});audio.addEventListener('pause',function(){musicState(false);});audio.addEventListener('error',function(){musicState(false);status.textContent='This song could not be loaded. The invitation is still available.';});}
  if(musicButton)musicButton.addEventListener('click',function(){if(!musicStarted){startMusic();return;}if(audio){if(playing)audio.pause();else playNative();}else if(frame){frame.contentWindow.postMessage(JSON.stringify({event:'command',func:playing?'pauseVideo':'playVideo',args:[]}), 'https://www.youtube-nocookie.com');if(!playing)status.textContent='Playback depends on this song’s YouTube availability.';}});
  window.addEventListener('message',function(e){if(!frame||e.source!==frame.contentWindow||e.origin!=='https://www.youtube-nocookie.com')return;var d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch(_){return;}if(d){var state=d.event==='onStateChange'?d.info:d.info&&d.info.playerState;if(typeof state==='number'){musicState(state===1);if(playing)status.textContent='';}}});
  document.addEventListener('visibilitychange',function(){app.classList.toggle('lv-paused',document.hidden);if(document.hidden&&audio&&playing)audio.pause();});
  pages.forEach(function(p){p.querySelectorAll('.lv-reveal').forEach(function(n,i){n.style.setProperty('--line',i);});});
  window.addEventListener('resize',layout);if(window.ResizeObserver)new ResizeObserver(layout).observe(stage);
  if(document.fonts)document.fonts.ready.then(layout);
  layout();sync();
})();
