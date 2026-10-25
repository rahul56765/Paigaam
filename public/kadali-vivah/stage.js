/* Kadali Vivah: photographic art placed on depth-separated WebGL surfaces.
 * Image planes provide material realism; camera, occlusion, photo frames and
 * parallax remain genuinely spatial. No generated customer faces are used. */
(function(global){
 'use strict';
 function create(host,options){
  options=options||{};const T=global.THREE;
  const noop=()=>{};const fallback={setProgress:noop,setPalette:noop,setPhotos:noop,resize:noop,dispose:noop,stats:()=>({ready:false,webgl:false,photoCount:0})};
  if(!T||!host)return fallback;
  let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'default'});}catch(error){options.onReady?.({webgl:false});return fallback;}
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,1,.1,150);
  renderer.setPixelRatio(Math.min(global.devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.setClearColor(0x000000,0);renderer.domElement.style.cssText='display:block;width:100%;height:100%;pointer-events:none';renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
  const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set(),photoGroup=new T.Group(),actors=[];scene.add(photoGroup);
  const reduced=!!options.reduced;let alive=true,raf=0,progress=0,ready=false,loaded=0,failed=0,width=1,height=1,photoGeneration=0,photoKey='',photoCount=0,pendingPhotos=0,photoErrors=0,renderCount=0;
  let portraitAssets=null,photoData={couplePhoto:null,photos:[],showPhotos:true},primary=null;
  const geometry=g=>(geometries.add(g),g),material=m=>(materials.add(m),m),texture=t=>(textures.add(t),t);
  const assetURL=p=>global.KVPreviewAssets?.[p]||p;
  const photoURL=p=>global.KVPreviewMedia?.[p]||p;
  const asset=p=>'/kadali-vivah/art/'+p+'.webp';
  const plane=geometry(new T.PlaneGeometry(1,1));
  const pale=material(new T.MeshStandardMaterial({color:'#d9be80',metalness:.35,roughness:.6}));
  scene.add(new T.HemisphereLight('#fff2d9','#91704b',2));const sun=new T.DirectionalLight('#fff1d3',2);sun.position.set(-8,14,12);scene.add(sun);
  function image(url){return new Promise((resolve,reject)=>{const img=new Image();images.add(img);img.crossOrigin='anonymous';img.onload=()=>{images.delete(img);if(alive)resolve(img);else reject(Error('disposed'));};img.onerror=()=>{images.delete(img);reject(Error('Image could not load'));};img.src=url;});}
  function imageTexture(img){const t=texture(new T.Texture(img));t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;}
  function surface(tex,transparent){return material(new T.MeshBasicMaterial({map:tex,transparent:!!transparent,alphaTest:transparent ? .025 : 0,depthWrite:!transparent,side:T.DoubleSide,toneMapped:false}));}
  function card(tex,w,h,x,y,z,transparent){const mesh=new T.Mesh(plane,surface(tex,transparent));mesh.scale.set(w,h,1);mesh.position.set(x,y,z);mesh.renderOrder=transparent?2:0;scene.add(mesh);return mesh;}
  function dropShadow(x,z,s){const cv=document.createElement('canvas');cv.width=128;cv.height=128;const cx=cv.getContext('2d'),g=cx.createRadialGradient(64,64,8,64,64,62);g.addColorStop(0,'rgba(58,36,13,.3)');g.addColorStop(1,'rgba(58,36,13,0)');cx.fillStyle=g;cx.fillRect(0,0,128,128);const tex=texture(new T.CanvasTexture(cv));const mesh=new T.Mesh(plane,material(new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:.65})));mesh.rotation.x=-Math.PI/2;mesh.scale.set(s,s*.65,1);mesh.position.set(x,.02,z);mesh.renderOrder=1;scene.add(mesh);return mesh;}
  // All source pictures share the same warm natural light. RGBA edges are real alpha.
  const environment=image(assetURL(asset('env-real'))).then(img=>{if(!alive)return;card(imageTexture(img),94,52,0,11,-35,false);loaded++;request();}).catch(()=>{failed++;request();});
  image(assetURL(asset('portal-real'))).then(img=>{if(!alive)return;const tex=imageTexture(img);card(tex,30,20.1,0,8,-12,true);card(tex,37,24.8,0,10,-24,true);loaded++;request();}).catch(()=>{failed++;request();});
  image(assetURL(asset('canopy-real'))).then(img=>{if(!alive)return;const tex=imageTexture(img);card(tex,25,14,0,10,-3,true);card(tex,25,14,0,10,-16,true);loaded++;request();}).catch(()=>{failed++;request();});
  image(assetURL(asset('kalash-real'))).then(img=>{if(!alive)return;const tex=imageTexture(img);[[-6,6,4.8],[6,6,4.8],[-7,-8,4.2],[7,-8,4.2]].forEach(([x,z,h])=>{const m=card(tex,h*.747,h,x,h*.45,z,true);m.rotation.y=x>0?-.08:.08;dropShadow(x,z,h*.75);});loaded++;request();}).catch(()=>{failed++;request();});
  Promise.all([image(assetURL(asset('portrait-frame'))),image(assetURL(asset('portrait-aperture')))]).then(([frame,mask])=>{if(!alive)return;portraitAssets={frame,mask};loaded++;rebuildPhotos();request();}).catch(()=>{failed++;request();});
  // Foreground petals are textured photographic fragments, not low-poly balls.
  const floorLine=geometry(new T.BoxGeometry(1,1,1));[-1,1].forEach(side=>{const line=new T.Mesh(floorLine,pale);line.scale.set(.04,.03,34);line.position.set(side*8,-.15,-8);scene.add(line);});
  const curve=new T.CatmullRomCurve3([new T.Vector3(1.3,4.4,25),new T.Vector3(-1.4,4.6,21),new T.Vector3(1.2,4.4,16),new T.Vector3(-1.3,4.5,12),new T.Vector3(1.4,5,9),new T.Vector3(.4,4.3,6)],false,'centripetal');
  const target=new T.Vector3(0,4,-24),photoPositions=[4.7,-4.7,4.7,-4.7,-4.7,4.7,-4.7];
  function placeholder(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#f8ebcb');g.addColorStop(1,'#d1b87e');c.fillStyle=g;c.fillRect(0,0,w,h);c.fillStyle='#76522a';c.textAlign='center';c.font=Math.round(w*.034)+'px Georgia';c.fillText('YOUR COUPLE PHOTO',w*.5,h*.48);c.font=Math.round(w*.021)+'px Arial';c.fillText('Add your portrait in the editor',w*.5,h*.53);return cv;}
  function composite(img,photo,size){
   const {frame,mask}=portraitAssets;const w=size,h=Math.round(w*frame.height/frame.width),cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');
   // Aperture measured from the generated frame; mask clips the exact arch/flowers.
   const rect={x:w*372/1344,y:h*407/1800,w:w*596/1344,h:h*954/1800};
   if(img){const fx=Math.max(0,Math.min(100,Number(photo?.fx??50)))/100,fy=Math.max(0,Math.min(100,Number(photo?.fy??50)))/100;const cover=Math.max(rect.w/img.width,rect.h/img.height);c.save();c.filter='blur(12px)';c.drawImage(img,rect.x-(img.width*cover-rect.w)*fx,rect.y-(img.height*cover-rect.h)*fy,img.width*cover,img.height*cover);c.restore();const fit=Math.min(rect.w/img.width,rect.h/img.height);c.drawImage(img,rect.x+(rect.w-img.width*fit)*fx,rect.y+(rect.h-img.height*fit)*fy,img.width*fit,img.height*fit);}else c.drawImage(placeholder(w,h),0,0);
   c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0,w,h);c.globalCompositeOperation='source-over';c.drawImage(frame,0,0,w,h);
   const tex=texture(new T.CanvasTexture(cv));tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());tex.needsUpdate=true;return tex;
  }
  function clearPhotos(){
   photoGroup.children.slice().forEach(group=>{group.traverse(o=>{if(o.userData.photoTexture){o.userData.photoTexture.dispose();textures.delete(o.userData.photoTexture);}if(o.userData.photoMaterial){o.userData.photoMaterial.dispose();materials.delete(o.userData.photoMaterial);}});photoGroup.remove(group);});primary=null;photoCount=0;
  }
  function framedPhoto(tex,index,isPrimary){
   const group=new T.Group(),front=new T.Mesh(plane,surface(tex,true));front.renderOrder=2;front.scale.set(isPrimary?6:3.9,isPrimary?8.04:5.23,1);front.userData.photoTexture=tex;front.userData.photoMaterial=front.material;group.add(front);
   // Narrow gilt side rail gives a physical edge when the portrait turns.
   if(isPrimary){[-1,1].forEach(side=>{const cord=new T.Mesh(floorLine,pale);cord.scale.set(.012,3,.012);cord.position.set(side*.8,4.1,-.07);group.add(cord);});}
   group.userData.primary=isPrimary;group.userData.index=index;group.userData.front=front;photoGroup.add(group);
   if(isPrimary){primary=group;group.position.set(4.7,4.2,11);}else{const side=index%2?1:-1;group.position.set(side*5.3,3.3,-1-Math.floor(index/2)*8);group.rotation.y=side*-.12;}
   return group;
  }
  function rebuildPhotos(){
   if(!alive||!portraitAssets)return;const generation=++photoGeneration;clearPhotos();photoErrors=0;
   const extra=photoData.showPhotos===false?[]:(photoData.photos||[]).slice(0,4);
   const first=photoData.couplePhoto||extra[0]||null;pendingPhotos=(first?1:0)+extra.length;
   if(!first)framedPhoto(composite(null,null,640),0,true);
   function load(p,index,isPrimary){image(photoURL(p.url)).then(img=>{if(!alive||generation!==photoGeneration)return;framedPhoto(composite(img,p,isPrimary?768:512),index,isPrimary);photoCount++;pendingPhotos--;request();}).catch(()=>{if(!alive||generation!==photoGeneration)return;pendingPhotos--;photoErrors++;if(isPrimary)framedPhoto(composite(null,null,640),index,true);request();});}
   if(first)load(first,0,true);extra.forEach((p,n)=>load(p,n,false));request();
  }
  function setPhotos(value){const next={couplePhoto:value?.couplePhoto||null,photos:value?.photos||[],showPhotos:value?.showPhotos!==false};const key=JSON.stringify([next,[next.couplePhoto,...next.photos].filter(Boolean).map(p=>photoURL(p.url))]);if(key===photoKey)return;photoKey=key;photoData=next;if(portraitAssets)rebuildPhotos();}
  function positionPhotos(){if(!primary)return;const n=progress*(photoPositions.length-1),i=Math.min(photoPositions.length-2,Math.floor(n)),f=n-i;const x=photoPositions[i]+(photoPositions[i+1]-photoPositions[i])*f;primary.position.set(width<700?0:x,width<700?6.4:4.4,camera.position.z-14.5);primary.userData.front.scale.set(width<700?4.4:6,width<700?5.9:8.04,1);primary.rotation.y=width<700?.025:-(x/4.7)*.10;}
  function draw(){raf=0;if(!alive||document.hidden)return;camera.position.copy(curve.getPoint(progress));camera.lookAt(target);positionPhotos();renderer.render(scene,camera);renderCount++;if(!ready){ready=true;options.onReady?.({webgl:true});}}
  function request(){if(alive&&!document.hidden&&!raf)raf=requestAnimationFrame(draw);}
  function resize(){if(!alive)return;const r=host.getBoundingClientRect();width=Math.max(1,r.width||innerWidth);height=Math.max(1,r.height||innerHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=width<700?46:43;camera.updateProjectionMatrix();request();}
  function setPalette(p){if(p?.accent)pale.color.set(p.accent);request();}
  function visibility(){if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else request();}
  const ro=global.ResizeObserver?new ResizeObserver(resize):null;ro?.observe(host);global.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);
  function contextLost(e){e.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;}
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  resize();setPalette(options.palette);setPhotos(options.photos||{});request();
  return {setProgress:p=>{progress=Number.isFinite(p)?Math.min(1,Math.max(0,p)):0;request();},setPalette,setPhotos,resize,
   stats:()=>({ready,webgl:true,progress,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),reduced,assetLayersLoaded:loaded,assetLayersFailed:failed,photoCount,pendingPhotos,photoErrors,renderCount,photographic:true}),
   dispose:()=>{if(!alive)return;alive=false;photoGeneration++;cancelAnimationFrame(raf);ro?.disconnect();global.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',contextLost);images.forEach(img=>{img.onload=null;img.onerror=null;img.src='';});images.clear();clearPhotos();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();scene.clear();}
  };
 }
 global.KadaliStage={create};
})(window);
