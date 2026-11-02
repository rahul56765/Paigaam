'use strict';
(() => {
  const one = (s, root=document) => root.querySelector(s);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const envelope = one('[data-envelope]');
  const open = one('[data-open]');
  if (open) open.addEventListener('click', () => {
    envelope.classList.add('is-open');
    open.disabled = true;
    const go = () => { const target = one('#invitation'); target.scrollIntoView({behavior:reduced.matches?'auto':'smooth'}); };
    setTimeout(go, reduced.matches ? 0 : 600);
  });
  const countdown = one('[data-countdown]');
  if (countdown) {
    const target = Date.parse(countdown.dataset.countdown);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((target-Date.now())/1000));
      const values = {days:Math.floor(remaining/86400), hours:Math.floor(remaining/3600)%24, minutes:Math.floor(remaining/60)%60, seconds:remaining%60};
      Object.entries(values).forEach(([k,v]) => { const node = one(`[data-unit="${k}"]`, countdown); if (node) node.textContent = String(v).padStart(2,'0'); });
      const ended = one('[data-count-ended]');
      if (ended) ended.hidden = remaining > 0;
      if (!remaining) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000); tick();
  }
  const scratch = one('[data-scratch]'), canvas = one('[data-scratch-canvas]'), reveal = one('[data-reveal]');
  if (scratch && canvas && reveal) {
    let ctx;
    try { ctx = canvas.getContext('2d', {willReadFrequently:true}); } catch (_) {}
    if (ctx) {
      const help = one('[data-scratch-help]');
      let done = false, drawing = false, last = null, strokes = 0;
      const finish = () => { done = true; canvas.hidden = true; reveal.hidden = true; if (help) help.hidden = true; };
      const setup = () => {
        if (done) return;
        const rect = scratch.getBoundingClientRect(); if (!rect.width || !rect.height) return;
        const scale = Math.min(window.devicePixelRatio || 1,2);
        canvas.width = Math.round(rect.width*scale); canvas.height = Math.round(rect.height*scale);
        ctx.setTransform(scale,0,0,scale,0,0); ctx.globalCompositeOperation='source-over';
        const gradient = ctx.createLinearGradient(0,0,rect.width,rect.height);
        gradient.addColorStop(0,'#9c691f'); gradient.addColorStop(.25,'#f8e4a3'); gradient.addColorStop(.48,'#c49643'); gradient.addColorStop(.72,'#fae7ad'); gradient.addColorStop(1,'#a27226');
        ctx.fillStyle=gradient; ctx.fillRect(0,0,rect.width,rect.height);
        ctx.fillStyle='rgba(103,62,19,.8)'; ctx.font='16px Georgia, serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Scratch to reveal',rect.width/2,rect.height/2);
      };
      canvas.hidden=false; reveal.hidden=false; if(help) help.hidden=false; setup();
      reveal.addEventListener('click',finish);
      const draw = ev => {
        if (!drawing || done) return;
        const r=canvas.getBoundingClientRect(); const x=ev.clientX-r.left,y=ev.clientY-r.top;
        ctx.globalCompositeOperation='destination-out'; ctx.lineWidth=38; ctx.lineCap='round'; ctx.lineJoin='round';
        ctx.beginPath(); ctx.moveTo(last ? last.x : x, last ? last.y : y); ctx.lineTo(x+.01,y+.01); ctx.stroke(); last={x,y};
        if (++strokes % 12 === 0) {
          const data=ctx.getImageData(0,0,canvas.width,canvas.height).data; let clear=0, samples=0;
          for(let i=3;i<data.length;i+=64){ samples++; if(data[i]<128) clear++; }
          if(clear/samples > .42) finish();
        }
      };
      canvas.addEventListener('pointerdown', ev => { drawing=true; last=null; canvas.setPointerCapture(ev.pointerId); draw(ev); });
      canvas.addEventListener('pointermove', draw);
      ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,()=>{drawing=false;last=null;}));
      let resize; window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(setup,200);});
    }
  }
  const gallery = one('[data-gallery]'), controls = one('[data-gallery-controls]');
  if (gallery && controls) {
    const slides = Array.from(gallery.querySelectorAll('[data-slide]')); let index=0, startX=null, startY=null;
    const update=()=>{ slides.forEach((slide,i)=>{slide.hidden=i!==index;}); one('[data-gallery-count]',controls).textContent=`${index+1} / ${slides.length}`; };
    one('[data-prev]',controls).addEventListener('click',()=>{index=(index-1+slides.length)%slides.length;update();});
    one('[data-next]',controls).addEventListener('click',()=>{index=(index+1)%slides.length;update();});
    gallery.addEventListener('touchstart',ev=>{startX=ev.touches[0].clientX;startY=ev.touches[0].clientY;},{passive:true});
    gallery.addEventListener('touchend',ev=>{if(startX===null)return; const dx=ev.changedTouches[0].clientX-startX,dy=ev.changedTouches[0].clientY-startY; if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.3){index=(index+(dx<0?1:-1)+slides.length)%slides.length;update();}startX=null;},{passive:true});
    controls.hidden=false; update();
  }
  const form=one('[data-rsvp]');
  if(form){ one('[data-rsvp-submit]',form).hidden=false; form.addEventListener('submit',()=>{
    const f=form.elements; const parts=[`Name: ${f.guestName.value.trim()}`,`Response: ${f.attendance.value}`,`Guests: ${f.guests.value || '1'}`];
    if(f.message.value.trim())parts.push(`Message: ${f.message.value.trim()}`);
    f.text.value=`RSVP\n${parts.join('\n')}`;
  }); }
  const audio=one('[data-audio]'), toggle=one('[data-audio-toggle]');
  if(audio&&toggle){
    const status=one('[data-audio-status]');
    const update=()=>{ const playing=!audio.paused;toggle.setAttribute('aria-pressed',String(playing));toggle.setAttribute('aria-label',playing?'Pause music':'Play music');toggle.textContent=playing?'❚❚':'♪'; };
    toggle.addEventListener('click',async()=>{ if(!audio.paused){audio.pause();return;} try{await audio.play();status.textContent='';}catch(_){status.textContent='Music could not be played.';} });
    audio.addEventListener('play',update); audio.addEventListener('pause',update); audio.addEventListener('error',()=>{status.textContent='Music could not be loaded.';update();});
  }
})();
