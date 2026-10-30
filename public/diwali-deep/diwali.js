(function(){
  'use strict';
  var app=document.getElementById('ddApp'),stage=document.getElementById('ddStage'),card=document.getElementById('ddCard'),frame=document.getElementById('ddFrame');
  if(!app||!stage||!card)return;
  var pages=Array.from(card.querySelectorAll('[data-dd-page]')),dots=Array.from(app.querySelectorAll('[data-dd-go]'));
  var prev=app.querySelector('[data-dd-prev]'),next=app.querySelector('[data-dd-next]'),light=app.querySelector('[data-dd-light]'),statusPage=app.querySelector('[data-dd-status]');
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)'),index=0,locked=false,opened=false,progress=0,drag=null,navDrag=null,timer=0,raf=0,pending=0;
  function fit(box){
    var inner=box.querySelector('.dd-fit-inner');if(!inner)return;
    // The art never moves. Solve font size independently within each reserved safe zone.
    box.style.setProperty('--fit','1');var lo=.15,hi=1;
    for(var i=0;i<9;i++){
      var n=(lo+hi)/2;box.style.setProperty('--fit',n);
      if(inner.scrollHeight>box.clientHeight-2||inner.scrollWidth>box.clientWidth+1)hi=n;else lo=n;
    }
    box.style.setProperty('--fit',lo.toFixed(4));
  }
  function layout(){
    var w=Math.max(1,Math.min(stage.clientWidth,stage.clientHeight*9/16,480));
    frame.style.setProperty('--width',w+'px');frame.style.setProperty('--height',w*16/9+'px');card.style.setProperty('--scale',w/360);
    card.querySelectorAll('[data-dd-fit]').forEach(fit);
  }
  function setProgress(n){
    progress=Math.max(0,Math.min(1,n));light.style.setProperty('--progress',progress.toFixed(4));pages[0].style.setProperty('--light',progress.toFixed(4));light.dataset.progress=progress.toFixed(3);
  }
  function queueProgress(n){pending=n;if(!raf)raf=requestAnimationFrame(function(){raf=0;setProgress(pending);});}
  function flushProgress(){if(raf){cancelAnimationFrame(raf);raf=0;setProgress(pending);}}
  function sync(){
    var hadFocus=pages.some(function(p){return p.contains(document.activeElement);});
    pages.forEach(function(p,i){var on=i===index;p.classList.toggle('is-current',on);p.classList.toggle('is-before',i<index);p.setAttribute('aria-hidden',String(!on));p.inert=!on;});
    dots.forEach(function(b,i){if(i===index)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    prev.disabled=index===0;next.disabled=index===pages.length-1;statusPage.textContent='Page '+(index+1)+' of 3: '+['Light the diya','Party invitation','Family welcome'][index];
    if(hadFocus)pages[index].focus({preventScroll:true});
  }
  function show(n){
    if(locked||n<0||n>=pages.length||n===index)return;
    if(index===0&&n>0&&!opened){ignite(n);return;}
    locked=true;index=n;sync();clearTimeout(timer);timer=setTimeout(function(){locked=false;},reduced.matches?0:900);
  }
  function ignite(target){
    if(locked)return;
    flushProgress();locked=true;opened=true;drag=null;light.classList.remove('is-cooling');setProgress(1);startMusic();
    app.classList.add('dd-opening');light.setAttribute('aria-label','Diya lit — tap to open invitation');
    clearTimeout(timer);timer=setTimeout(function(){
      index=target||1;sync();timer=setTimeout(function(){app.classList.remove('dd-opening');locked=false;},reduced.matches?0:1000);
    },reduced.matches?0:950);
  }
  light.addEventListener('pointerdown',function(e){
    if(locked||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();startMusic();light.classList.remove('is-cooling');
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,max:0,initial:opened?1:0};
    try{light.setPointerCapture(e.pointerId);}catch(_){}
  });
  light.addEventListener('pointermove',function(e){
    if(!drag||drag.id!==e.pointerId||locked)return;e.preventDefault();
    var dy=drag.y-e.clientY;drag.max=Math.max(drag.max,Math.hypot(e.clientX-drag.x,e.clientY-drag.y));
    var n=Math.max(0,dy/(card.getBoundingClientRect().height*.22));queueProgress(n);
    if(n>=1)ignite(1);
  });
  function release(e,cancelled){
    if(!drag||drag.id!==e.pointerId)return;
    var tap=!cancelled&&drag.max<10;drag=null;flushProgress();
    if(tap){ignite(1);return;}
    if(!locked&&!opened){light.classList.add('is-cooling');setProgress(0);}
  }
  light.addEventListener('pointerup',function(e){release(e,false);});
  light.addEventListener('pointercancel',function(e){release(e,true);});
  light.addEventListener('lostpointercapture',function(e){release(e,true);});
  // Pointer taps are handled above; keyboard and assistive-technology clicks use this backup.
  light.addEventListener('click',function(e){if(e.detail===0&&!locked)ignite(1);});
  prev.addEventListener('click',function(){show(index-1);});next.addEventListener('click',function(){show(index+1);});
  dots.forEach(function(b){b.addEventListener('click',function(){show(Number(b.dataset.ddGo));});});
  document.addEventListener('keydown',function(e){
    if(e.target.matches('input,textarea,select,[contenteditable]'))return;
    if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();show(index+1);}
    if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();show(index-1);}
  });
  stage.addEventListener('pointerdown',function(e){
    if(e.isPrimary===false||e.target.closest('button,a'))return;
    if(index===0){startMusic();return;}
    navDrag={id:e.pointerId,x:e.clientX,y:e.clientY};try{stage.setPointerCapture(e.pointerId);}catch(_){}
  });
  stage.addEventListener('pointerup',function(e){
    if(!navDrag||navDrag.id!==e.pointerId)return;
    var dx=e.clientX-navDrag.x,dy=e.clientY-navDrag.y;navDrag=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<45)return;
    show(index+(Math.abs(dx)>Math.abs(dy)?(dx<0?1:-1):(dy<0?1:-1)));
  });
  stage.addEventListener('pointercancel',function(){navDrag=null;});
  var motion=app.querySelector('[data-dd-motion]');
  motion.addEventListener('click',function(){var paused=app.classList.toggle('dd-paused');motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'Resume decorative animations':'Pause decorative animations');motion.textContent=paused?'▷':'Ⅱ';});
  pages.forEach(function(p){p.querySelectorAll('.dd-reveal').forEach(function(n,i){n.style.setProperty('--line',Math.min(i,8));});});
  window.addEventListener('resize',layout);if(window.ResizeObserver)new ResizeObserver(layout).observe(stage);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
  if(document.fonts)document.fonts.ready.then(layout);
  layout();sync();
  // Uploads and direct media URLs use native audio, synchronously played in the cover gesture.
  // YouTube is an explicitly supported fallback; provider restrictions may require a retry.
  var music=app.querySelector('[data-dd-music]'),audio=document.getElementById('ddAudio'),playing=false,ytFrame=null,musicStarted=false;
  var musicButton=music&&music.querySelector('button'),status=music&&music.querySelector('[role=status]');
  function musicState(on){playing=on;if(musicButton){musicButton.setAttribute('aria-pressed',String(on));musicButton.setAttribute('aria-label',on?'Pause music':'Play music');}}
  function playNative(){audio.play().then(function(){musicState(true);status.textContent='';}).catch(function(){musicState(false);status.textContent='Tap ♪ to play your song.';});}
  function startMusic(){
    if(!music||musicStarted)return;musicStarted=true;
    if(audio){playNative();return;}
    if(music.dataset.youtube){ytFrame=document.createElement('iframe');ytFrame.title='Background song';ytFrame.allow='autoplay; encrypted-media';ytFrame.id='ddYouTube';ytFrame.src='https://www.youtube-nocookie.com/embed/'+music.dataset.youtube+'?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist='+music.dataset.youtube+'&origin='+encodeURIComponent(location.origin);ytFrame.addEventListener('load',function(){ytFrame.contentWindow.postMessage(JSON.stringify({event:'listening',id:'ddYouTube'}),'https://www.youtube-nocookie.com');ytFrame.contentWindow.postMessage(JSON.stringify({event:'command',func:'addEventListener',args:['onStateChange']}),'https://www.youtube-nocookie.com');});music.querySelector('[data-dd-player]').appendChild(ytFrame);musicState(false);status.textContent='If the song is silent, tap ♪ to play.';}
  }
  if(audio){audio.addEventListener('playing',function(){musicState(true);status.textContent='';});audio.addEventListener('pause',function(){musicState(false);});audio.addEventListener('error',function(){musicState(false);status.textContent='This song could not be loaded. The invitation is still available.';});}
  if(musicButton)musicButton.addEventListener('click',function(){if(!musicStarted){startMusic();return;}if(audio){if(playing)audio.pause();else playNative();}else if(ytFrame){ytFrame.contentWindow.postMessage(JSON.stringify({event:'command',func:playing?'pauseVideo':'playVideo',args:[]}), 'https://www.youtube-nocookie.com');if(!playing)status.textContent='Playback depends on this song’s YouTube availability.';}});
  window.addEventListener('message',function(e){if(!ytFrame||e.source!==ytFrame.contentWindow||e.origin!=='https://www.youtube-nocookie.com')return;var d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch(_){return;}if(d){var state=d.event==='onStateChange'?d.info:d.info&&d.info.playerState;if(typeof state==='number'){musicState(state===1);if(playing)status.textContent='';}}});
  document.addEventListener('visibilitychange',function(){app.classList.toggle('dd-hidden',document.hidden);if(document.hidden&&audio&&playing)audio.pause();});

})();
