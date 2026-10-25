/* Aasmaan: original celestial theatre. Real-time geometry + generated cutout art.
 * No third-party invitation renderer. Readable semantic HTML is the fallback.
 */
(function(){'use strict';
 const boot=JSON.parse(document.getElementById('aasmaan-boot').textContent), C=window.SPCore;
 let data=boot.data, lang=data.lang.default, chapters=[], sceneAPI=null, audio=null, timer=null, localPhoto=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches;
 const $=s=>document.querySelector(s), asset=n=>'/aasmaan/'+n+'.webp';
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=p=>C.txt(data,lang,p)||'';
 const ui=(en,hi,mr)=>lang==='hi'?hi:lang==='mr'?(mr||hi):en;
 const external=(url,label,cls='outline-button')=>'<a class="'+cls+'" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>';
 const fmtDate=d=>d?C.fmtDate(d,lang,'long'):'';
 const fmtTime=t=>t?C.fmtTime(t,lang):'';
 const couple=()=>{const keys=data.couple.order==='bride'?['bride','groom']:['groom','bride'];return keys.map(k=>text('couple.'+k+'.first'))};
 function part(id,kind,label,html,attrs=''){return '<section class="chapter '+kind+'" id="'+id+'" data-kind="'+kind+'" data-label="'+esc(label)+'" '+attrs+'>'+html+'</section>'}
 function inner(html){return '<div class="chapter-inner">'+html+'</div>'}
 function fallback(name){return '<img class="fallback-art" src="'+asset(name)+'" alt="" aria-hidden="true">'}
 function dateTime(d,t){return [fmtDate(d),fmtTime(t)].filter(Boolean).join(' · ')}
 function render(){
  const names=couple(), combined=names.join(' & '), sec=data.sections;
  document.documentElement.lang=lang;document.documentElement.dir=C.I18N.LANGS[lang]?.dir||'ltr';
  const face=C.FONT_BY_ID[data.font]||C.FONTS[0];document.documentElement.style.setProperty('--aasmaan-serif',face.serif);document.documentElement.style.setProperty('--aasmaan-name',data.font==='classic'?face.serif:face.script);let fontLink=document.getElementById('aasmaan-fonts');if(!fontLink){fontLink=document.createElement('link');fontLink.id='aasmaan-fonts';fontLink.rel='stylesheet';document.head.appendChild(fontLink)}const fontHref=C.googleFontsHref(data.font,data.lang.enabled);if(fontLink.getAttribute('href')!==fontHref)fontLink.href=fontHref;
  $('#lang-switch').innerHTML=data.lang.enabled.map(l=>'<option value="'+esc(l)+'" '+(l===lang?'selected':'')+'>'+esc(C.I18N.LANGS[l]?.native||l)+'</option>').join('');$('#lang-switch').hidden=data.lang.enabled.length<2;
  document.title=combined+' · Aasmaan';
  $('.monogram').textContent=(Array.from(names[0]||'A')[0]||'A');
  let html=part('beginning','hero',ui('The beginning','शुभारंभ'),inner('<p class="eyebrow">'+ui('Together with our families','अपने परिवारों के साथ')+'</p><h1><span class="name">'+esc(names[0])+'</span><span class="and">&</span><span class="name">'+esc(names[1])+'</span></h1><p class="hero-date">'+esc(fmtDate(data.wedding.date))+'</p>')+fallback('hero')+'<a class="scroll-prompt" href="#our-sky">'+ui('A love written in the stars','सितारों में लिखी एक प्रेम कहानी')+'<b>↓</b></a>');
  html+=part('our-sky','journey',ui('Our sky','हमारा आसमान'),inner('<p class="eyebrow">'+ui('Some things are written above','कुछ कहानियाँ आसमान लिखता है')+'</p><h2>'+ui('One sky.<br>Two souls.<br><em>A thousand forevers.</em>','एक आसमान।<br>दो दिल।<br><em>साथ जन्मों-जन्मों का।</em>')+'</h2>')+fallback('palace')+'<div class="bottom-copy">'+ui('And somewhere between the stars,<br>we found our way to each other.','सितारों के बीच कहीं,<br>हमने एक-दूसरे को पा लिया।')+'</div>');
  html+=part('the-date','promise',ui('The promise','शुभ तिथि'),fallback('moon')+inner('<p class="eyebrow">'+ui('Save a little space in your heart','अपने दिल में हमारे लिए थोड़ी जगह रखना')+'</p><h2>'+esc(fmtDate(data.wedding.date))+'</h2><p class="fine">'+esc([fmtTime(data.wedding.time),text('venue.city')].filter(Boolean).join(' · '))+'</p><div class="countdown" aria-label="'+ui('Wedding countdown','विवाह की उलटी गिनती')+'"></div>'));
  let parents='';if(data.couple.showParents){parents='<div class="parents"><div>'+esc(C.parentLine(data,lang,'groom'))+'<small>'+ui('Family of the groom','वर पक्ष')+'</small></div><div class="line"></div><div>'+esc(C.parentLine(data,lang,'bride'))+'<small>'+ui('Family of the bride','वधू पक्ष')+'</small></div></div>'}
  html+=part('with-blessings','family',ui('With blessings','आशीर्वाद सहित'),inner('<img class="blessing" src="'+asset('blessing')+'" alt="'+ui('Ganesha blessing medallion','श्री गणेश आशीर्वाद पदक')+'"><p class="eyebrow">'+ui('With love & blessings','प्रेम और आशीर्वाद के साथ')+'</p><h2>'+ui('Two families.<br><em>One beautiful beginning.</em>','दो परिवार।<br><em>एक सुंदर शुरुआत।</em>')+'</h2><p class="lede">'+esc(C.fillNames(text('welcome.text'),data,lang))+'</p>'+parents+(data.couplePhoto?'<img class="couple-portrait" src="'+esc(data.couplePhoto.url)+'" style="object-position:'+data.couplePhoto.fx+'% '+data.couplePhoto.fy+'%" alt="'+esc(combined)+'">':'')));
  html+=part('celebrations','celebrate',ui('The celebrations','समारोह'),inner('<p class="eyebrow">'+ui('A constellation of celebrations','खुशियों के सितारे')+'</p><h2>'+ui('A little colour.<br>A little magic.<br><em>All our favourite people.</em>','थोड़े रंग।<br>थोड़ा जादू।<br><em>और हमारे सारे अपने।</em>')+'</h2><span class="divider"></span><p class="fine">'+ui('Come for the rituals. Stay for the memories.','रस्मों में शामिल हों। यादों में बस जाएँ।')+'</p>'));
  const events=data.events.filter(e=>sec.preWedding!==false||e.main||!['mehendi','haldi','sangeet','cocktail'].includes(e.type));
  events.forEach((e,i)=>{const art=e.type==='haldi'?'haldi':/mehendi|sangeet/.test(e.type)?'mehendi':/reception|cocktail/.test(e.type)?'reception':'pheras';
   const ep='events.'+e.id+'.', name=text(ep+'name')||C.eventName(e,lang), venue=text(ep+'venue')||text('venue.name'), address=text(ep+'address')||[text('venue.address'),text('venue.city')].filter(Boolean).join(', ');
   const maps='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([venue,address].filter(Boolean).join(', '));
   html+=part('celebration-'+i,'event',name,fallback(art)+inner('<p class="eyebrow">'+ui('The celebrations','समारोह')+' / '+String(i+1).padStart(2,'0')+'</p><h2>'+esc(name)+'</h2><div class="divider"></div><p class="event-date">'+esc(dateTime(e.date,e.start))+'</p><p class="event-venue">'+esc(venue)+'</p><p class="event-note">'+esc(text(ep+'note'))+'</p>'+(e.dress?'<p class="fine">'+esc(text(ep+'dress'))+'</p>':'')+(venue?external(maps,ui('Find your way ↗','दिशा देखें ↗')):'')),'data-art="'+art+'"');
  });
  const venueAddress=[text('venue.address'),text('venue.city'),text('venue.state')].filter(Boolean).join(', ');
  const mapURL='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([text('venue.name'),venueAddress].join(', '));
  html+=part('a-place-in-the-stars','venue',ui('The venue','शुभ स्थल'),fallback('palace')+inner('<p class="eyebrow">'+ui('Where our forever begins','जहाँ से हमारा साथ शुरू होगा')+'</p><h2>'+esc(text('venue.name'))+'</h2><p class="lede">'+esc(venueAddress)+'</p>'+external(mapURL,ui('Open directions ↗','दिशा देखें ↗'))));
  let details='';const detail=(eyebrow,title,body)=>'<article class="details-item"><p class="eyebrow">'+eyebrow+'</p><h3>'+title+'</h3><p>'+body+'</p></article>';
  if(sec.dressCode&&[data.dress.common,data.dress.women,data.dress.men].some(Boolean))details+=detail('01 / '+ui('Dress code','परिधान'),ui('Dress for a memory','खास पल के लिए'),[text('dress.common'),text('dress.women'),text('dress.men')].filter(Boolean).map(esc).join('<br>'));
  if(sec.transport&&data.transport)details+=detail('02 / '+ui('Getting here','कैसे पहुँचें'),ui('Every road leads to us','हर राह हम तक'),esc(text('transport')));
  if(sec.accommodation&&data.accommodation.text)details+=detail('03 / '+ui('Your stay','आपका ठहरना'),ui('Make yourself at home','अपना ही घर समझें'),esc(text('accommodation.text'))+(data.accommodation.code?'<br><span class="code">'+esc(data.accommodation.code)+'</span>':''));
  if(sec.gifts&&data.gifts)details+=detail('04 / '+ui('Gifts & blessings','उपहार और आशीर्वाद'),ui('You are our gift','आपका आना ही उपहार है'),esc(text('gifts')));
  if(details)html+=part('little-details','details',ui('Little details','कुछ ज़रूरी बातें'),'<div class="details-grid">'+details+'</div>');
  const photos=sec.photos?data.photos:[];
  if(photos.length)html+=part('our-moments','photos',ui('Our moments','हमारे पल'),inner('<p class="eyebrow">'+ui('Little moments. Infinite meaning.','छोटे पल। अनंत मायने।')+'</p><h2>'+ui('Our kind of <em>magic.</em>','हमारा अपना <em>जादू।</em>')+'</h2>')+'<div class="photo-grid">'+photos.map((p,i)=>'<button class="photo-button" type="button" data-photo="'+i+'" aria-label="'+esc(ui('Open photograph ','तस्वीर देखें ')+(i+1))+'"><img loading="lazy" src="'+esc(p.url)+'" alt="'+esc(p.alt||combined)+'" style="object-position:'+p.fx+'% '+p.fy+'%"><span>'+esc(p.alt||ui('A moment to keep','यादों का एक पल'))+'</span></button>').join('')+'</div>');
  let buttons='';if(sec.rsvp){const yes=C.whatsappRsvpLink(data,true,lang),no=C.whatsappRsvpLink(data,false,lang);buttons='<div class="buttons">'+(yes?external(yes,ui('Joyfully attending ↗','खुशी से शामिल होंगे ↗'),'gold-button'):'<button class="gold-button" type="button" aria-disabled="true">'+ui('Joyfully attending','खुशी से शामिल होंगे')+'</button>')+(no?external(no,ui('Sending our love ↗','शुभकामनाएँ भेज रहे हैं ↗')):'<button class="outline-button" type="button" aria-disabled="true">'+ui('Sending our love','शुभकामनाएँ भेज रहे हैं')+'</button>')+'</div><p class="rsvp-note">'+(yes?ui('Your choice opens a WhatsApp draft to our organiser. Tap Send in WhatsApp to share your reply.','आपका जवाब आयोजक के WhatsApp चैट में खुलेगा। जवाब भेजने के लिए WhatsApp में Send दबाएँ।'):ui('Preview only. These choices become active when the organiser adds their WhatsApp number.','यह प्रीव्यू है। आयोजक का WhatsApp नंबर जुड़ने पर ये विकल्प सक्रिय होंगे।'))+'</p>'}
  html+=part('under-the-same-sky','rsvp',ui('Be our guest','हमारे मेहमान बनें'),inner('<p class="eyebrow">'+ui('The stars have aligned','सितारे मिल चुके हैं')+'</p><h2>'+ui('Now all we need<br><em>is you.</em>','अब बस<br><em>आपका इंतज़ार है।</em>')+'</h2><p class="lede">'+esc(text('closing')||ui('Join us, under the same sky.','उसी आसमान के नीचे, हमारे साथ आइए।'))+'</p>'+buttons+'<div class="closing-names">'+esc(combined)+'</div><p class="footer-note">'+ui('With love, always','प्यार के साथ, हमेशा')+'</p>'+(boot.mode==='review'?'<details class="try-photos"><summary>Try your own couple photo</summary><p>Local preview only. Your photo stays in this browser and is not uploaded.</p><input id="local-photo" type="file" accept="image/jpeg,image/png,image/webp"></details><p class="review-note">AASMAAN · ORIGINAL ART & REAL-TIME 3D<br>Private design review · Not live on Paigaam</p>':'')+'<p class="footer-note" style="margin-top:25px">Made with <a href="https://paigaam.cc" target="_blank" rel="noopener noreferrer">Paigaam</a></p>'));
  $('#invitation').innerHTML=html;
  $('.hero').classList.toggle('long-names',names.some(n=>Array.from(n).length>14));
  chapters=Array.from(document.querySelectorAll('.chapter'));
  // A compact chapter rail rather than 30+ tiny links on a long programme.
  const rail=chapters.filter(e=>!['event','details','photos'].includes(e.dataset.kind));
  $('#chapter-nav').innerHTML=rail.map(e=>'<a href="#'+e.id+'" aria-label="'+esc(e.dataset.label)+'"></a>').join('');
  $('#music').hidden=!(sec.music&&data.music.track==='upload'&&data.music.url);
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;$('#music').setAttribute('aria-pressed','false')}
  $('.photo-grid')?.addEventListener('click',ev=>{const b=ev.target.closest('[data-photo]');if(!b)return;const p=photos[+b.dataset.photo];$('#lightbox img').src=p.url;$('#lightbox img').alt=p.alt||combined;$('#lightbox p').textContent=p.alt||'';$('#lightbox').showModal()});
  const input=$('#local-photo');if(input)input.addEventListener('change',()=>{const f=input.files[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024){$('#live-status').textContent='Choose a JPG, PNG or WebP under 8 MB.';return}if(localPhoto)URL.revokeObjectURL(localPhoto);localPhoto=URL.createObjectURL(f);data.couplePhoto={url:localPhoto,fx:50,fy:50};render()});
  sceneAPI?.rebuild();countdown();clearInterval(timer);timer=setInterval(countdown,60000);
 }
 function countdown(){const el=$('.countdown');if(!el)return;const target=C.zonedToUtc(data.wedding.date,data.wedding.time,data.wedding.tz);let delta=Math.max(0,(Number(target)-Date.now())/1000);const values=[Math.floor(delta/86400),Math.floor(delta%86400/3600),Math.floor(delta%3600/60)];el.innerHTML=values.map((v,i)=>'<div><strong>'+String(v).padStart(2,'0')+'</strong><small>'+[ui('Days','दिन'),ui('Hours','घंटे'),ui('Minutes','मिनट')][i]+'</small></div>').join('')}
 $('#lang-switch').addEventListener('change',e=>{lang=e.target.value;render()});
 $('#close-lightbox').addEventListener('click',()=>$('#lightbox').close());$('#lightbox').addEventListener('click',ev=>{if(ev.target===$('#lightbox'))$('#lightbox').close()});
 $('#motion').setAttribute('aria-pressed',String(paused));$('#motion').addEventListener('click',()=>{paused=!paused;document.body.classList.toggle('paused',paused);$('#motion').setAttribute('aria-pressed',String(paused));$('#motion').firstChild.textContent=paused?'▷ ':'Ⅱ ';sceneAPI?.request()});
 $('#music').addEventListener('click',async()=>{if(audio&&!audio.paused){audio.pause();$('#music').setAttribute('aria-pressed','false');$('#music span').textContent=ui('Play your song','संगीत सुनें');return}if(!audio){audio=new Audio();audio.preload='none';audio.loop=true;audio.volume=.55;audio.src=data.music.url}try{await audio.play();$('#music').setAttribute('aria-pressed','true');$('#music span').textContent=ui('Pause your song','संगीत रोकें')}catch{$('#live-status').textContent=ui('Could not play this song. Tap to try again.','संगीत नहीं चल सका। फिर कोशिश करें।')}});
 render();
 function init3D(){
  const T=window.THREE;if(!T)throw new Error('WebGL library unavailable');
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;$('#world').appendChild(renderer.domElement);
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);camera.position.set(0,0,17);
  const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;const ec=envCanvas.getContext('2d');const gr=ec.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#b0cff3');gr.addColorStop(.3,'#335e91');gr.addColorStop(.48,'#ffe6a0');gr.addColorStop(.55,'#1e3158');gr.addColorStop(1,'#09132c');ec.fillStyle=gr;ec.fillRect(0,0,512,256);ec.fillStyle='#fff6dc';ec.fillRect(70,55,80,75);ec.fillStyle='#a9cff9';ec.fillRect(330,40,40,100);const envTex=new T.CanvasTexture(envCanvas);envTex.mapping=T.EquirectangularReflectionMapping;envTex.colorSpace=T.SRGBColorSpace;const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromEquirectangular(envTex);scene.environment=env.texture;envTex.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xe4edff,0x0c1839,2));const key=new T.DirectionalLight(0xffe3a1,3);key.position.set(-4,7,10);scene.add(key);const fill=new T.DirectionalLight(0xa9d4ff,2.4);fill.position.set(5,-2,8);scene.add(fill);
  const gold=new T.MeshStandardMaterial({color:0xe5c079,metalness:.86,roughness:.25}),ivory=new T.MeshStandardMaterial({color:0xfff1c8,metalness:.15,roughness:.4}),blue=new T.MeshStandardMaterial({color:0x113b79,metalness:.65,roughness:.3});
  const loader=new T.TextureLoader(), textures=new Map();const disposableTextures=new Set();
  function tex(url){if(textures.has(url))return textures.get(url);const t=loader.load(url,()=>request(),undefined,()=>{document.body.classList.add('art-error')});t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);textures.set(url,t);disposableTextures.add(t);return t}
  const marble=tex(asset('marble'));marble.wrapS=marble.wrapT=T.RepeatWrapping;ivory.map=marble;ivory.bumpMap=marble;ivory.bumpScale=.035;ivory.needsUpdate=true;
  const root=new T.Group();scene.add(root);let groups=[],floaters=[],stars=[],frame=0,visible=true,desired=scrollY,smoothed=scrollY,mouse={x:0,y:0},last=0;
  const vh=()=>2*Math.tan(T.MathUtils.degToRad(43/2))*17;
  const vw=()=>vh()*innerWidth/innerHeight;
  function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m}
  function art(parent,name,w,h,x,y,z=0){const p=mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex(asset(name)),transparent:true,depthWrite:false,alphaTest:.015,side:T.DoubleSide}),parent,x,y,z);p.renderOrder=2;return p}
  function starShape(r=1){const s=new T.Shape();for(let i=0;i<16;i++){const a=Math.PI/2+i*Math.PI/8,rad=i%2===0?(i%4===0?r:r*.6):r*.16;const x=Math.cos(a)*rad,y=Math.sin(a)*rad;i?s.lineTo(x,y):s.moveTo(x,y)}s.closePath();return s}
  const starGeo=new T.ExtrudeGeometry(starShape(.15),{depth:.055,bevelEnabled:true,bevelThickness:.025,bevelSize:.012,bevelSegments:1,steps:1});
  function star(parent,x,y,z,scale=1){const s=mesh(starGeo,gold,parent,x,y,z);s.scale.setScalar(scale);s.rotation.z=(x+y)*.2;stars.push(s);return s}
  // Solid extruded cusped architecture, behind generated goldsmith relief.
  function archGeometry(w,h,depth=.25){const shape=new T.Shape();const outline=(path,width,height,reverse=false)=>{const pts=[];pts.push([-width/2,-height/2],[-width/2,0]);for(let i=0;i<=64;i++){const t=Math.PI-i*Math.PI/64;const ripple=1+.022*Math.cos(t*16);pts.push([Math.cos(t)*width/2*ripple,Math.sin(t)*height/2*ripple])}pts.push([width/2,-height/2]);if(reverse)pts.reverse();pts.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath()};outline(shape,w,h);const hole=new T.Path();outline(hole,w-.4,h-.4,true);shape.holes.push(hole);return new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.05,bevelThickness:.045,bevelSegments:2,curveSegments:48})}
  function portal(parent,w,h,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);art(g,'portal',w,h,0,0,-.26);art(g,'portal',w,h,0,0,0);for(const dir of [-1,1]){mesh(new T.CylinderGeometry(.055,.075,h*.65,16),gold,g,dir*w*.38,-h*.12,.05)}return g}
  function goldOrbit(parent,r,x,y,z,tilt=0){const g=mesh(new T.TorusGeometry(r,.018,8,100),gold,parent,x,y,z);g.rotation.x=tilt;return g}
  function ring(parent){const g=new T.Group();parent.add(g);mesh(new T.TorusGeometry(1.15,.1,16,80),gold,g,0,-.1,0);const gem=new T.MeshPhysicalMaterial({color:0xd6f0ff,metalness:.1,roughness:.08,transparent:true,opacity:.86,clearcoat:1,flatShading:true});const stone=mesh(new T.OctahedronGeometry(.62,0),gem,g,0,1.25,0);stone.scale.set(1,.85,.7);stone.rotation.z=Math.PI/4;for(let x of [-.37,.37]){const prong=mesh(new T.CylinderGeometry(.025,.035,.45,8),gold,g,x,.97,.22);prong.rotation.z=-x*.6}const halo=goldOrbit(g,2.2,0,.25,-.5,.2);return {g,halo,stone}}
  function palaceModel(parent){
   const g=new T.Group();parent.add(g);
   const block=(w,h,d,x,y,z,mat=ivory)=>mesh(new T.BoxGeometry(w,h,d),mat,g,x,y,z);
   const cyl=(r,h,x,y,z,mat=ivory)=>mesh(new T.CylinderGeometry(r,r,h,36),mat,g,x,y,z);
   const dome=(r,h,x,y,z)=>{const pts=[[0,1],[.08,.97],[.16,.88],[.42,.73],[.79,.54],[1,.29],[.93,.1],[.8,0]].map(([a,b])=>new T.Vector2(a*r,b*h)).reverse();const profile=new T.SplineCurve(pts).getPoints(64).map(p=>new T.Vector2(Math.max(0,p.x),p.y));mesh(new T.LatheGeometry(profile,64),ivory,g,x,y,z);cyl(r*.83,.09,x,y-.035,z,gold);cyl(.025,.3,x,y+h+.07,z,gold);mesh(new T.SphereGeometry(.07,12,8),gold,g,x,y+h+.24,z);for(let j=0;j<12;j++){const a=j/12*Math.PI*2;mesh(new T.SphereGeometry(.04,8,6),gold,g,x+Math.cos(a)*r*.8,y+.05,z+Math.sin(a)*r*.8)}};
   const windowAt=(x,y,z,s=1)=>{const s1=new T.Shape();s1.moveTo(-.2,-.3);s1.lineTo(.2,-.3);s1.lineTo(.2,.12);s1.absarc(0,.12,.2,0,Math.PI,false);s1.closePath();const edge=mesh(new T.ExtrudeGeometry(s1,{depth:.05,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:1}),gold,g,x,y,z);edge.scale.setScalar(s);const inset=mesh(new T.ShapeGeometry(s1,20),blue,g,x,y,z+.095);inset.scale.set(.78*s,.84*s,1);for(let k=-1;k<=1;k++)block(.012*s,.36*s,.015,x+k*.085*s,y-.03*s,z+.09,gold)};
   cyl(2.85,.26,0,-.2,0);cyl(2.88,.06,0,-.05,0,gold);cyl(2.7,.18,0,-.4,0,gold);
   block(3.4,.28,2.5,0,.12,0);block(3.5,.07,2.6,0,.28,0,gold);
   block(2.3,1.65,1.8,0,1.12,0);block(2.45,.12,1.95,0,1.98,0,gold);block(2.7,.1,2.1,0,2.1,0);
   for(let i=-1;i<=1;i++)windowAt(i*.7,1.13,.92,.95);
   block(1.5,1.2,1.35,0,2.74,0);block(1.8,.12,1.6,0,3.39,0,gold);windowAt(-.37,2.74,.69,.8);windowAt(.37,2.74,.69,.8);
   for(let side of [-1,1]){block(.7,1.15,1,side*1.84,.9,.02);block(.86,.1,1.16,side*1.84,1.52,.02,gold);dome(.5,.65,side*1.84,1.62,.02);windowAt(side*1.84,.93,.54,.8)}
   for(let x of [-1.12,1.12])for(let z of [-.82,.82]){cyl(.18,2.12,x,1.4,z);cyl(.24,.09,x,2.48,z,gold);for(let a=0;a<6;a++){const ang=a/6*Math.PI*2;cyl(.024,.52,x+Math.cos(ang)*.19,2.8,z+Math.sin(ang)*.19,gold)}dome(.35,.5,x,3.05,z)}
   for(let x of [-.65,.65])for(let z of [-.54,.54]){cyl(.045,.8,x,3.8,z,gold)}dome(1.03,1.25,0,4.21,0);
   // A dimensional front stair and miniature carved balustrades.
   for(let i=0;i<10;i++){const rise=(10-i)*.029;block(1.1+i*.055,.055,1.1-i*.07,0,-.01-rise,1.4+i*.09);}
   for(let side of [-1,1])for(let i=0;i<12;i++){const x=side*(.72+i*.14);cyl(.026,.32,x,.49,1.22);mesh(new T.SphereGeometry(.045,8,6),gold,g,x,.68,1.22)}
   block(3.2,.06,.08,0,.68,1.22,gold);
   for(let i=0;i<14;i++){const a=i/14*Math.PI*2;cyl(.034,.34,Math.cos(a)*2.68,.19,Math.sin(a)*2.68);mesh(new T.SphereGeometry(.05,8,6),gold,g,Math.cos(a)*2.68,.38,Math.sin(a)*2.68)}
   // Batch the miniature's hundreds of carved pieces into three material draws.
   const batches=new Map();for(const o of [...g.children]){o.updateMatrix();const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);o.geometry.dispose()}g.clear();for(const [material,pieces] of batches){const merged=new T.BufferGeometry();for(const attribute of ['position','normal','uv']){const size=attribute==='uv'?2:3,total=pieces.reduce((n,p)=>n+p.attributes[attribute].array.length,0),arr=new Float32Array(total);let offset=0;for(const p of pieces){arr.set(p.attributes[attribute].array,offset);offset+=p.attributes[attribute].array.length}merged.setAttribute(attribute,new T.BufferAttribute(arr,size))}pieces.forEach(p=>p.dispose());merged.computeBoundingSphere();mesh(merged,material,g)}
   g.rotation.y=-.34;g.rotation.x=.04;return g;
  }
  function ornamentBalloon(parent,x,y,z,s=1){const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(s);parent.add(g);const points=[];for(let i=0;i<=24;i++){const t=i/24*Math.PI;points.push(new T.Vector2(Math.sin(t)*(.7+.18*Math.cos(t)),Math.cos(t)*1.1+.3))}mesh(new T.LatheGeometry(points.reverse(),32),blue,g);for(let i=0;i<8;i++){const t=i/8*Math.PI*2;const curve=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI;curve.push(new T.Vector3(Math.sin(a)*(.705+.18*Math.cos(a))*Math.cos(t),Math.cos(a)*1.1+.3,Math.sin(a)*(.705+.18*Math.cos(a))*Math.sin(t)))}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(curve),24,.012,4,false),gold,g)}mesh(new T.CylinderGeometry(.2,.16,.28,12),gold,g,0,-1.12,0);for(let dir of [-1,1]){const s=mesh(new T.CylinderGeometry(.008,.008,.5,4),gold,g,dir*.17,-.8,0);s.rotation.z=-dir*.2}floaters.push({g,base:y,amp:.13,speed:.5});return g}
  let seed=43;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
  function build(){
   // Dispose GPU allocations on live editor updates/resizes. Shared immutable star geometry/materials stay.
   root.traverse(o=>{if(o.geometry&&o.geometry!==starGeo)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])if(![gold,ivory,blue].includes(m))m.dispose()}});root.clear();groups=[];floaters=[];stars=[];seed=43;
   const mobile=innerWidth<=700, W=vw(), H=vh(), unit=H/innerHeight;
   const used=new Set();
   chapters.forEach((el,idx)=>{const g=new T.Group();g.position.y=-el.offsetTop*unit;root.add(g);groups.push({g,el});
    const kind=el.dataset.kind;const half=W/2;
    for(let i=0;i<(mobile?17:30);i++){const x=(rand()-.5)*W*1.5,y=(rand()-.5)*H*1.2,z=-rand()*6-1;star(g,x,y,z,.3+rand()*.95)}
    const cloud=(x,y,z,w)=>{const a=art(g,'cloud',w,w*.46,x,y,z);floaters.push({g:a,base:y,amp:.08,speed:.3});return a};
    if(kind==='hero'){
     const pw=mobile?W*1.04:8.2,ph=pw*1.333,lower=el.classList.contains('long-names')?H*.08:0;portal(g,pw,ph,0,-H*.29-lower,-.2);
     const pal=art(g,'palace',mobile?W*.58:4.7,mobile?W*.77:6.27,0,-H*.33-lower,-2);floaters.push({g:pal,base:pal.position.y,amp:.1,speed:.5});
     const moon=art(g,'moon',1.1,1.65,half*.72,H*.26,1);moon.rotation.z=-.12;
     ornamentBalloon(g,-Math.min(half*.76,6),-H*.16,1,mobile?.43:.62);
     cloud(-half*.82,-H*.48,1.2,mobile?3:5);cloud(half*.77,-H*.44,.6,mobile?3.4:5);
     if(!mobile){art(g,'pavilion',2,2,-half*.68,-H*.33,-1);goldOrbit(g,5.7,0,-H*.35,-3,.2)}
    }else if(kind==='journey'){
     const w=mobile?W*.91:6.4;const p=palaceModel(g);p.position.set(0,-H*.3,-.3);p.scale.setScalar(mobile?.74:.98);floaters.push({g:p,base:p.position.y,amp:.1,speed:.4,model:true});
     cloud(-half*.75,-H*.27,1,mobile?3:5);cloud(half*.75,-H*.38,2,mobile?3.6:5.5);
     ornamentBalloon(g,half*.65,H*.05,1,mobile?.32:.6);
     goldOrbit(g,mobile?3.3:5,0,-H*.03,-3,.3);
    }else if(kind==='promise'){
     const r=ring(g);r.g.position.set(0,H*.17,1);r.g.scale.setScalar(mobile?1:1.3);r.g.rotation.set(.08,-.2,-.12);floaters.push({g:r.g,base:H*.17,amp:.12,speed:.45,spin:true});
     cloud(-half*.57,H*.01,-1,mobile?3.6:5);cloud(half*.68,H*.08,-.3,mobile?3:4);
     art(g,'moon',1,1.5,half*.75,H*.31,-1);
    }else if(kind==='family'){
     portal(g,mobile?W*1.4:12,mobile?W*1.85:16,0,0,-4);
     cloud(-half*.9,-H*.37,1,mobile?2.5:5);cloud(half*.85,-H*.35,1,mobile?2.7:5);
    }else if(kind==='celebrate'){
     goldOrbit(g,mobile?3.8:6.4,0,0,-3,.15);goldOrbit(g,mobile?4.3:7,0,0,-3,-.3);
     art(g,'moon',mobile?1.1:2,mobile?1.5:2.7,-half*.72,H*.25,1);
     art(g,'pavilion',mobile?1.5:2.6,mobile?1.5:2.6,half*.68,-H*.22,-1);
    }else if(kind==='event'){
     const name=el.dataset.art, x=mobile?0:W*.235,y=mobile?H*.205:0,w=mobile?W*.69:Math.min(W*.33,7),h=w*1.333;used.add(asset(name));
     const frameG=new T.Group();frameG.position.set(x,y,0);g.add(frameG);frameG.rotation.y=mobile?0:-.1;
     // Actual extruded gold arched surround with a textured sculptural diorama inside.
     const trim=new T.MeshStandardMaterial({color:0xe5c079,metalness:.86,roughness:.25});
     const geometry=new T.PlaneGeometry(w,h);const image=mesh(geometry,new T.MeshBasicMaterial({map:tex(asset(name)),side:T.DoubleSide}),frameG,0,0,0);
     // Rounded top crop via the same arched silhouette in geometry rather than CSS.
     const shp=new T.Shape();shp.moveTo(-w/2,-h/2);shp.lineTo(w/2,-h/2);shp.lineTo(w/2,h/2-w/2);shp.absarc(0,h/2-w/2,w/2,0,Math.PI,false);shp.lineTo(-w/2,-h/2);
     const backing=mesh(new T.ExtrudeGeometry(shp,{depth:.24,bevelEnabled:true,bevelSize:.055,bevelThickness:.035,bevelSegments:2,curveSegments:48}),trim,frameG,0,0,-.29);backing.scale.set(1.012,1.012,1);const geo=new T.ShapeGeometry(shp,48);const pos=geo.attributes.position;const uv=[];for(let j=0;j<pos.count;j++)uv.push((pos.getX(j)+w/2)/w,(pos.getY(j)+h/2)/h);geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));image.geometry.dispose();image.geometry=geo;
     const hoop=goldOrbit(frameG,w*.62,0,.1,-1,.18);hoop.scale.y=1.2;
     art(g,'moon',mobile?.75:1.3,mobile?1.05:1.8,x+w*.55,y+h*.31,1);
     art(g,'balloon',mobile?.85:1.5,mobile?1.7:3,x-w*.56,y+h*.12,1.3);
     cloud(x-w*.45,y-h*.46,1,mobile?1.6:3);cloud(x+w*.45,y-h*.45,.6,mobile?1.8:3.5);
     floaters.push({g:frameG,base:y,amp:.06,speed:.35,tilt:!mobile});
    }else if(kind==='venue'){
     const w=mobile?W*.83:6.8;art(g,'palace',w,w*1.333,0,H*.12,-1);cloud(-half*.75,0,1,mobile?2.5:4);cloud(half*.7,-H*.1,1,mobile?3:5);
    }else if(kind==='rsvp'){
     const w=mobile?W*1.42:13;portal(g,w,w*1.333,0,0,-5);
     ornamentBalloon(g,-half*.75,H*.23,0,mobile?.35:.65);art(g,'moon',mobile?1:1.6,mobile?1.4:2.2,half*.7,H*.25,1);
     cloud(-half*.6,-H*.37,1,mobile?2.8:5);cloud(half*.75,-H*.4,1,mobile?3.3:5);
    }
   });request();
  }
  function draw(now=0){frame=0;if(!visible)return;const dt=Math.min((now-last)/1000,.05)||.016;last=now;desired=scrollY;smoothed=paused?desired:smoothed+(desired-smoothed)*Math.min(1,dt*12);
   const unit=vh()/innerHeight;camera.position.y=-smoothed*unit;camera.position.x=paused?0:mouse.x*.2;const firstPass=Math.min(1,smoothed/innerHeight);const dolly=paused?0:Math.sin(firstPass*Math.PI)*1.65;camera.position.z=17-dolly+(paused?0:Math.sin(now*.00016)*.08);camera.lookAt(0,-smoothed*unit,-.3);
   const t=paused?0:now/1000;
   floaters.forEach((f,i)=>{f.g.position.y=f.base+(paused?0:Math.sin(t*f.speed+i)*f.amp);if(f.spin)f.g.rotation.y=-.2+(paused?0:Math.sin(t*.3)*.3);if(f.tilt)f.g.rotation.y=-.1+(paused?0:Math.sin(t*.3+i)*.035);if(f.model)f.g.rotation.y=-.34+(paused?0:Math.sin(t*.17)*.2)});
   stars.forEach((s,i)=>{if(i%3===0)s.rotation.y=paused?.15:Math.sin(t*.2+i)*.55});
   for(const o of groups){const distance=o.g.position.y-camera.position.y;o.g.visible=Math.abs(distance)<vh()*.78;o.g.rotation.y=paused?0:Math.max(-.14,Math.min(.14,distance/vh()*.16));o.g.rotation.z=paused?0:Math.max(-.015,Math.min(.015,distance/vh()*.022))}
   renderer.render(scene,camera);updateChapter();if(!paused||Math.abs(desired-smoothed)>.3)request();
  }
  function request(){if(!frame&&visible)frame=requestAnimationFrame(draw)}
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();build()}
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,180)});addEventListener('scroll',request,{passive:true});addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){mouse.x=e.clientX/innerWidth-.5;mouse.y=e.clientY/innerHeight-.5;request()}},{passive:true});
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible)request();else if(frame){cancelAnimationFrame(frame);frame=0}});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.body.classList.add('no-webgl');if(frame)cancelAnimationFrame(frame);frame=0;visible=false});
  build();return {rebuild:build,request,stats:()=>({meshes:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries})};
 }
 function updateChapter(){const y=scrollY+innerHeight*.45;let active=chapters[0];for(const c of chapters)if(c.offsetTop<=y)active=c;$('#chapter-label').textContent=active.dataset.label.toUpperCase();document.querySelectorAll('#chapter-nav a').forEach(a=>{const is=a.hash==='#'+active.id;a.classList.toggle('active',is);if(is)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}
 try{sceneAPI=init3D()}catch(e){console.warn('Aasmaan is using its illustrated fallback.',e);document.body.classList.add('no-webgl');addEventListener('scroll',updateChapter,{passive:true})}
 addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||!['live','preview'].includes(boot.mode))return;const m=e.data;if(!m||typeof m!=='object')return;if(m.type==='sp:data'&&m.data){data=C.validate(m.data,{mediaNamespace:'aasmaan'}).data;lang=m.lang||data.lang.default;render();const map={couple:'beginning',wedding:'the-date',events:'celebrations',venue:'a-place-in-the-stars',photos:'with-blessings',music:'under-the-same-sky',rsvp:'under-the-same-sky'};const id=map[m.focus];if(id)document.getElementById(id)?.scrollIntoView({behavior:'instant'})}if(m.type==='sp:replay')scrollTo({top:0,behavior:'instant'})});
 if(parent!==window&&/^https?:\/\//.test(location.origin))parent.postMessage({type:'sp:ready'},location.origin);
 window.Aasmaan={stats:()=>sceneAPI?.stats(),get chapter(){return $('#chapter-label').textContent},get mode(){return boot.mode}};
})();
