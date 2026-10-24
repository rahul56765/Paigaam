/* Kadali Vivah — original procedural ceremonial courtyard. Three.js r160. */
(function (global) {
  'use strict';
  function create(host, options) {
    options = options || {};
    var T = global.THREE, renderer, alive = true, frame = 0, progress = 0, hidden = document.hidden;
    var geometries = new Set(), materials = new Set(), textures = new Set(), buckets = new Map();
    var reduced = !!options.reduced, lastTime = 0, elapsed = 0;
    var palette = options.palette || {}, scene, camera, environment, pmrem, shadowLight;
    var fallback = { setProgress:function(){}, setPalette:function(){}, resize:function(){}, dispose:function(){}, stats:function(){return {ready:false,webgl:false};} };
    if (!T || !host) return fallback;
    function geo(g) { geometries.add(g); return g; }
    function mat(m) { materials.add(m); return m; }
    function standard(color, metalness, roughness) { return mat(new T.MeshStandardMaterial({color:color,metalness:metalness||0,roughness:roughness === undefined ? .55 : roughness})); }
    try {
      renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    } catch (error) {
      if (options.onReady) setTimeout(function(){options.onReady({webgl:false,error:'WebGL unavailable'});},0);
      return fallback;
    }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
    renderer.domElement.setAttribute('aria-hidden','true');
    host.appendChild(renderer.domElement);
    scene = new T.Scene();
    scene.background = new T.Color('#eadcc7');
    scene.fog = new T.FogExp2('#eadcc7', .012);
    camera = new T.PerspectiveCamera(43,1,.1,160);
    var ivory = standard('#e5d5b7',.04,.68), pale = standard('#f4e9d3',.02,.54);
    var gold = standard('#b88a3c',.78,.29), darkGold = standard('#77501d',.75,.4);
    var copper = standard('#ae5b36',.78,.3), stone = standard('#d7c3a1',.07,.76);
    var rose = standard('#a94f43',.12,.66), silk = standard('#d9a25b',.15,.67);
    var green = standard('#397044',.12,.48), leafLight = standard('#6a853a',.08,.57);
    green.side = leafLight.side = T.DoubleSide;
    var leafCanvas=document.createElement('canvas');leafCanvas.width=256;leafCanvas.height=512;
    var lc=leafCanvas.getContext('2d');var lg=lc.createLinearGradient(0,0,256,0);lg.addColorStop(0,'#739049');lg.addColorStop(.48,'#a4ad5b');lg.addColorStop(.5,'#d8c984');lg.addColorStop(.52,'#96a752');lg.addColorStop(1,'#4c7338');lc.fillStyle=lg;lc.fillRect(0,0,256,512);
    for(var vein=0;vein<60;vein++){var ly=vein*9;lc.strokeStyle=vein%3?'rgba(30,63,17,.18)':'rgba(233,228,151,.25)';lc.lineWidth=1;lc.beginPath();lc.moveTo(128,ly);lc.lineTo(0,ly-40);lc.moveTo(128,ly);lc.lineTo(256,ly-40);lc.stroke();}
    var leafTexture=new T.CanvasTexture(leafCanvas);leafTexture.colorSpace=T.SRGBColorSpace;textures.add(leafTexture);green.map=leafLight.map=leafTexture;

    var orange = standard('#e69b20',.02,.83), saffron = standard('#cc5f1d',.02,.83), creamFlower = standard('#f3d99d',.02,.82);
    var water = standard('#567b74',.53,.18), coconutMat = standard('#6d4930',.02,.98);
    var flameMat = mat(new T.MeshBasicMaterial({color:'#fff0b0',transparent:true,opacity:.92,depthWrite:false}));
    var flameOuter = mat(new T.MeshBasicMaterial({color:'#f6a837',transparent:true,opacity:.42,depthWrite:false}));
    var box = geo(new T.BoxGeometry(1,1,1)), ball = geo(new T.IcosahedronGeometry(1,0));
    var sphere = geo(new T.SphereGeometry(1,8,5)), torus = geo(new T.TorusGeometry(1,.065,4,24));
    var cylinder = geo(new T.CylinderGeometry(1,1,1,16)), cone = geo(new T.ConeGeometry(1,1,20));
    var tmp = new T.Object3D();
    function instance(g,m,x,y,z,sx,sy,sz,rx,ry,rz) {
      tmp.position.set(x||0,y||0,z||0); tmp.rotation.set(rx||0,ry||0,rz||0); tmp.scale.set(sx === undefined ? 1:sx,sy === undefined ? 1:sy,sz === undefined ? 1:sz); tmp.updateMatrix();
      var key = g.uuid+'|'+m.uuid, b = buckets.get(key);
      if (!b) {b={geometry:g,material:m,matrices:[]};buckets.set(key,b);}
      b.matrices.push(tmp.matrix.clone());
    }
    function block(m,x,y,z,sx,sy,sz,ry) {instance(box,m,x,y,z,sx,sy,sz,0,ry||0,0);}
    function ring(m,x,y,z,r,thickness,rx) {instance(torus,m,x,y,z,r,r,r,rx === undefined ? Math.PI/2:rx,0,0);}
    function lathe(points,segments) {return geo(new T.LatheGeometry(points.map(function(p){return new T.Vector2(p[0],p[1]);}),segments||28));}
    var pillar = lathe([[.7,0],[.7,.18],[.52,.25],[.52,.42],[.68,.52],[.68,.7],[.48,.82],[.42,1.05],[.34,1.3],[.34,5.35],[.43,5.58],[.43,5.8],[.59,5.95],[.66,6.15],[.56,6.32],[.82,6.48],[.82,6.72]]);
    var urn = lathe([[.01,0],[.35,0],[.42,.1],[.49,.25],[.65,.5],[.7,.8],[.62,1.04],[.4,1.19],[.35,1.32],[.46,1.38],[.46,1.5],[.33,1.5]]);
    var bellGeo = lathe([[.07,0],[.35,.04],[.37,.12],[.27,.2],[.22,.42],[.12,.54],[.08,.6]],20);
    var diyaGeo = lathe([[.03,0],[.25,.04],[.43,.18],[.48,.25],[.4,.28],[.33,.16],[.05,.11]],20);
    var leafGeos = [];
    for(var variant=0;variant<3;variant++) {
      var vertices=[],uvs=[],indices=[], n=18, across=6;
      for(var j=0;j<=n;j++) {
        var t=j/n, width=Math.pow(Math.sin(Math.PI*t),.72)*(.48+variant*.06), yy=t*3.7, zz=Math.sin(t*Math.PI*.77)*(1.1+variant*.2);
        for(var k=0;k<=across;k++) {var side=k/across*2-1;vertices.push(side*width,yy-side*side*.11*Math.sin(t*Math.PI),zz+side*side*.21*Math.sin(t*Math.PI));uvs.push(k/across,t);}
        if(j<n) for(k=0;k<across;k++){var a=j*(across+1)+k;indices.push(a,a+across+1,a+1,a+1,a+across+1,a+across+2);}
      }
      var lg=geo(new T.BufferGeometry());lg.setAttribute('position',new T.Float32BufferAttribute(vertices,3));lg.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));lg.setIndex(indices);lg.computeVertexNormals();leafGeos.push(lg);
    }
    // Soft procedural reflection field: no network assets and no visible image backdrop.
    try {
      var envScene = new T.Scene();envScene.background = new T.Color('#e8ddca');
      var eg=geo(new T.SphereGeometry(1,12,8));
      [[8,7,0,6,'#fff1cc'],[-7,3,-4,5,'#b78b51'],[0,10,-8,5,'#ffffff'],[0,-6,0,8,'#877354']].forEach(function(a){var em=mat(new T.MeshBasicMaterial({color:a[4]}));var e=new T.Mesh(eg,em);e.position.set(a[0],a[1],a[2]);e.scale.setScalar(a[3]);envScene.add(e);});
      pmrem = new T.PMREMGenerator(renderer);environment = pmrem.fromScene(envScene,.06);scene.environment=environment.texture;pmrem.dispose();pmrem=null;
    } catch(e) { /* Environment is decorative; the lit scene remains complete. */ }
    scene.add(new T.HemisphereLight('#fff4d7','#9c8569',1.6));
    shadowLight=new T.DirectionalLight('#fff0c6',3.0);shadowLight.position.set(-12,25,14);shadowLight.castShadow=true;
    var shadowSize=global.innerWidth<700?512:1024;shadowLight.shadow.mapSize.set(shadowSize,shadowSize);Object.assign(shadowLight.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:75});shadowLight.shadow.bias=-.0003;shadowLight.shadow.normalBias=.05;scene.add(shadowLight);
    var fill=new T.DirectionalLight('#eeeaff',1.1);fill.position.set(15,8,-15);scene.add(fill);
    var warm=new T.PointLight('#ffb749',70,35,2);warm.position.set(0,6,-18);scene.add(warm);
    // Raised courtyard and repeated stone joints give scale and real perspective.
    block(stone,0,-.58,-5,42,1,62);
    block(pale,0,-.05,-5,27,.14,48);
    for(var x=-12;x<=12;x+=3) for(var z=-27;z<=18;z+=3) {
      block((Math.round(x+z)%2===0)?ivory:pale,x,.025,z,2.96,.05,2.96);
      if(Math.abs(x)>3 && Math.abs(x)<10) block(gold,x,.058,z,.14,.018,.14,Math.PI/4);
    }
    for(var zz=-28;zz<20;zz+=1.6) for(var sign=-1;sign<=1;sign+=2) {
      block(gold,sign*3.6,.062,zz,.055,.025,1.5);block(rose,sign*3.9,.06,zz,.22,.02,.75,Math.PI/4);
    }
    // Long colonnades, carved capitals, individual gilded flutes, and inset friezes.
    function column(x,z,height) {
      var sc=height/6.72;instance(pillar,ivory,x,0,z,1,sc,1);
      block(pale,x,.17,z,1.8,.34,1.8);block(gold,x,.37,z,1.42,.07,1.42);
      [1.1,1.4,5.38,5.72,6.32].forEach(function(y){ring(gold,x,y*sc,z,y>5?.52:.39);});
      for(var a=0;a<12;a++){var angle=a*Math.PI/6;instance(cylinder,pale,x+Math.sin(angle)*.337,3.3*sc,z+Math.cos(angle)*.337,.028,3.7*sc,.028);}
      for(a=0;a<8;a++){angle=a*Math.PI/4;instance(sphere,gold,x+Math.sin(angle)*.53,6.08*sc,z+Math.cos(angle)*.53,.11,.2*sc,.11);}
      block(pale,x,height+.04,z,1.8,.32,1.8);
    }
    [-1,1].forEach(function(s){for(var z=8;z>=-22;z-=6){column(s*9,z,8);block(ivory,s*9,8.4,z-2.4,1.6,.65,6);block(gold,s*9,8.76,z-2.4,1.75,.1,6.2);}
      block(stone,s*12.5,2,-7,1.2,4,42);block(gold,s*12.5,4.05,-7,1.45,.12,42);
      for(var z2=11;z2>-28;z2-=3) {block(ivory,s*12.5,4.35,z2,1.5,.5,1.5);instance(sphere,pale,s*12.5,4.8,z2,.35,.45,.35);}
    });
    function archGeometry(radius, spring, depth) {
      var sh=new T.Shape(), inner=radius-.52;sh.moveTo(-radius,0);sh.lineTo(-radius,spring);
      for(var i=0;i<=64;i++){var a=Math.PI-i/64*Math.PI;sh.lineTo(Math.cos(a)*radius,spring+Math.sin(a)*radius);}
      sh.lineTo(radius,0);sh.lineTo(inner,0);sh.lineTo(inner,spring);
      for(i=0;i<=96;i++){a=i/96*Math.PI;var r=inner-.19*Math.pow(Math.sin(a*9),2);sh.lineTo(Math.cos(a)*r,spring+Math.sin(a)*r);}
      sh.lineTo(-inner,0);sh.closePath();return geo(new T.ExtrudeGeometry(sh,{depth:depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:4}));
    }
    var arch=archGeometry(5.5,5.1,.65), archTrim=archGeometry(5.58,5.1,.08);
    [8,-5].forEach(function(z){instance(archTrim,gold,0,0,z-.08);instance(arch,ivory,0,0,z);column(-5.5,z+.3,7);column(5.5,z+.3,7);
      block(pale,0,10.8,z+.3,12.6,.38,1.25);block(gold,0,11.03,z+.3,12.9,.1,1.35);
      for(var xx=-5;xx<=5;xx+=.7) instance(sphere,gold,xx,11.25,z+.3,.11,.16,.11);
      instance(sphere,gold,0,11.6,z+.3,.38,.5,.38);
    });
    // Gold chain strands and dense instanced marigold torans.
    function flower(x,y,z,scale,index) {
      instance(ball,index%5===0?creamFlower:(index%3===0?saffron:orange),x,y,z,scale,scale*.95,scale);
    }
    function garland(x1,y1,z1,x2,y2,z2,sag,count) {
      for(var i=0;i<=count;i++) {var t=i/count;flower(x1+(x2-x1)*t,y1+(y2-y1)*t-Math.sin(t*Math.PI)*sag,z1+(z2-z1)*t,.12,i);}
    }
    [8,-5].forEach(function(z){for(var xx=-5;xx<5;xx+=2.5){garland(xx,9.5,z+.8,xx+2.5,9.5,z+.8,.8,19);}for(var side=-1;side<=1;side+=2){for(var y=1;y<7;y+=.23)flower(side*5.15,y,z+.75,.15,Math.round(y*10));}});
    function hangingBell(x,y,z,size,length) {
      instance(cylinder,darkGold,x,y+length*.5,z,.024,length,.024);
      for(var j=0;j<length/.22;j++)ring(gold,x,y+j*.22,z,.055);
      instance(bellGeo,gold,x,y-.58*size,z,size,size,size);
      instance(sphere,darkGold,x,y-.55*size,z,.07*size,.12*size,.07*size);
      instance(cylinder,gold,x,y-.77*size,z,.02,.45*size,.02);
    }
    [-3.6,0,3.6].forEach(function(x){hangingBell(x,7.8,8.4,x===0?1.5:1,1.5);});
    // Banana leaf surfaces are curved, ridged three-column meshes, not sprites.
    function banana(x,z,scale,turn) {
      instance(cylinder,leafLight,x,1.25*scale,z,.11*scale,2.5*scale,.11*scale);
      for(var i=0;i<8;i++){var a=i*2.399+turn;instance(leafGeos[i%3],i%2?green:leafLight,x,1.55*scale+(i%3)*.16,z,scale,scale,scale,1.05+(i%3)*.16,a,(i%2?.12:-.12));}
      instance(urn,copper,x,.05,z,.8*scale,.8*scale,.8*scale);
    }
    [[-7,11,1.3],[7,11,1.3],[-10,-6,1.25],[10,-6,1.25],[-7,-15,1.4],[7,-15,1.4],[-10,-23,1.7],[10,-23,1.7]].forEach(function(a,i){banana(a[0],a[1],a[2],i);});
    function flame(x,y,z,s) {
      instance(sphere,flameMat,x,y+s*.3,z,s*.10,s*.32,s*.1,0,0,.1);
      instance(sphere,flameOuter,x,y+s*.23,z,s*.17,s*.39,s*.17,0,0,.1);
    }
    function diya(x,y,z,scale) {instance(diyaGeo,gold,x,y,z,scale,scale,scale);flame(x,y+.25*scale,z,scale);}
    function lamp(x,z,h) {
      instance(cylinder,gold,x,h*.46,z,.065,h*.9,.065);instance(sphere,gold,x,.2,z,.4,.2,.4);
      instance(diyaGeo,gold,x,h,z,1.35,1.1,1.35);ring(gold,x,h+.25,z,.5);
      for(var i=0;i<5;i++){var a=i*Math.PI*2/5;flame(x+Math.sin(a)*.42,h+.29,z+Math.cos(a)*.42,.8);}
    }
    [-1,1].forEach(function(s){[11,4,-8,-15,-23].forEach(function(z){lamp(s*6.8,z,1.7);});});
    // Copper kalash groups at the threshold, with radial mango leaves and coconut ridges.
    function kalash(x,z,s) {
      block(pale,x,.12,z,1.9*s,.22,1.9*s);ring(gold,x,.245,z,.83*s);
      instance(urn,copper,x,.26,z,s,s,s);
      [.39,.43,.78,1.1,1.6].forEach(function(y){ring(gold,x,.26+y*s,z,(y>1.4?.44:y>.6?.66:.48)*s);});
      instance(sphere,coconutMat,x,1.94*s+.26,z,.34*s,.55*s,.34*s,0,0,.15);
      for(var a=0;a<10;a++){var ang=a*Math.PI/5;instance(cylinder,darkGold,x+Math.sin(ang)*.3*s,1.95*s+.26,z+Math.cos(ang)*.3*s,.008*s,.67*s,.008*s,0,0,.15);}
      for(a=0;a<7;a++)instance(leafGeos[a%3],green,x,1.63*s,z,.23*s,.24*s,.26*s,.9,a*Math.PI*2/7,0);
      for(a=0;a<16;a++){ang=a*Math.PI/8;flower(x+Math.sin(ang)*.85*s,.28,z+Math.cos(ang)*.85*s,.13*s,a);}
    }
    kalash(4.4,14.3,1.35);kalash(-4.4,14.3,1.1);kalash(-4,-20,1);kalash(4,-20,1);
    // A carved lotus reflecting pool: each petal is a solid double-curved radial surface.
    var petalVertices=[], petalIndices=[];
    for(var j=0;j<=10;j++){var t=j/10;for(var k=0;k<=6;k++){var u=k/6*2-1;petalVertices.push(u*Math.sin(Math.PI*t)*.62,Math.sin(t*Math.PI*.75)*.72+u*u*.2*Math.sin(t*Math.PI),t*2.0);if(j<10&&k<6){var id=j*7+k;petalIndices.push(id,id+1,id+7,id+1,id+8,id+7);}}}
    var petal=geo(new T.BufferGeometry());petal.setAttribute('position',new T.Float32BufferAttribute(petalVertices,3));petal.setIndex(petalIndices);petal.computeVertexNormals();
    var petalMat=standard('#dfad8b',.2,.45);petalMat.side=T.DoubleSide;
    instance(cylinder,stone,0,.18,-1,3.0,.4,3.0);instance(cylinder,water,0,.405,-1,2.8,.04,2.8);ring(gold,0,.43,-1,2.86);
    instance(cylinder,gold,0,.52,-1,.6,.3,.6);
    for(var layer=0;layer<3;layer++)for(var p=0;p<12;p++)instance(petal,layer===2?gold:petalMat,0,.52+layer*.13,-1,1-layer*.22,1,1-layer*.22,-.14*layer,p*Math.PI/6+(layer%2)*Math.PI/12,0);
    instance(sphere,gold,0,.9,-1,.4,.18,.4);
    for(var i=0;i<12;i++){var a=i*Math.PI/6;diya(Math.sin(a)*2.7,.47,-1+Math.cos(a)*2.7,.48);}
    // Main mandap: stepped plinth, richly dressed pavilion, silk roof, tiered central crown.
    block(stone,0,.14,-20,14,.3,12);block(ivory,0,.4,-20,12.8,.3,10.8);block(gold,0,.58,-20,12.9,.06,10.9);
    block(pale,0,.7,-20,11.8,.2,9.8);block(rose,0,.815,-20,7,.025,6.5);
    for(var i=0;i<4;i++){block(ivory,0,.08+i*.12,-13-i*.5,7-i*.25,.2,1.4);block(gold,0,.185+i*.12,-12.4-i*.5,7-i*.25,.025,.055);}
    [-5,5].forEach(function(x){[-16,-24].forEach(function(z){column(x,z,8.8);});});
    [-5,5].forEach(function(x){block(ivory,x,9.15,-20,1.35,.65,9.5);block(gold,x,9.53,-20,1.5,.12,9.8);});
    [-16,-24].forEach(function(z){block(ivory,0,9.15,z,11.5,.65,1.35);block(gold,0,9.53,z,11.8,.12,1.5);for(var x=-5;x<5;x+=2){garland(x,8.85,z+.75,x+2,8.85,z+.75,.55,17);}});
    // Sculpted silk canopy with radial fold geometry.
    var cv=[],ci=[],segs=64,rings=10;
    for(var r=0;r<=rings;r++){var t=r/rings;for(var a=0;a<=segs;a++){var theta=a/segs*Math.PI*2,edge=5.6/Math.max(Math.abs(Math.cos(theta)),Math.abs(Math.sin(theta)))*.92;cv.push(Math.cos(theta)*t*edge,10.0+2.4*Math.pow(1-t,1.35)+Math.sin(theta*16)*.12*t, -20+Math.sin(theta)*t*edge*.78);if(r<rings&&a<segs){var idx=r*(segs+1)+a;ci.push(idx,idx+1,idx+segs+1,idx+1,idx+segs+2,idx+segs+1);}}}
    var canopy=geo(new T.BufferGeometry());canopy.setAttribute('position',new T.Float32BufferAttribute(cv,3));canopy.setIndex(ci);canopy.computeVertexNormals();silk.side=T.DoubleSide;instance(canopy,silk,0,0,0);
    for(var a=0;a<16;a++){var theta=a*Math.PI/8,edge=5.6/Math.max(Math.abs(Math.cos(theta)),Math.abs(Math.sin(theta)))*.92;for(var rr=0;rr<15;rr++){var t=rr/14;instance(sphere,gold,Math.cos(theta)*t*edge,10+2.4*Math.pow(1-t,1.35),-20+Math.sin(theta)*t*edge*.78,.055,.055,.055);}}
    var crown=lathe([[.01,0],[1.1,0],[1.12,.15],[.9,.24],[.9,.4],[.7,.5],[.74,.65],[.55,.78],[.58,.95],[.32,1.1],[.26,1.45],[.01,1.9]],32);instance(crown,gold,0,12.25,-20,1,1,1);
    [-3.3,0,3.3].forEach(function(x){hangingBell(x,7.5,-16,x===0?1.4:.9,1.5);});
    // Back screen, inset jaali lattice, and ceremonial seating.
    block(ivory,0,3.4,-25.2,11,5.2,.45);block(gold,0,6.05,-25.2,11.3,.12,.6);
    for(var x=-4.8;x<5;x+=.65)for(var y=1.5;y<5.8;y+=.65){block(gold,x,y,-24.93,.45,.045,.06,0);block(gold,x,y,-24.91,.045,.45,.06,0);instance(sphere,rose,x,y,-24.86,.07,.07,.045);}
    block(gold,0,1.1,-22.4,4.2,.5,1.7);block(rose,0,1.42,-22.4,4.05,.16,1.6);block(rose,0,2,-23.1,4,1.2,.25);ring(gold,0,2.65,-23.05,1.2,.1,0);
    for(var s=-1;s<=1;s+=2){instance(sphere,gold,s*2.1,1.7,-22.4,.22,.28,.22);diya(s*2, .86,-18.4,.9);}
    // Focal havan altar and ceremonial scattered petals.
    block(copper,0,1,-18.6,1.5,.35,1.5);block(darkGold,0,1.2,-18.6,1.2,.1,1.2);
    for(var i=0;i<7;i++) flame(Math.sin(i*2.4)*.25,1.3,-18.6+Math.cos(i*2.4)*.25,.8+(i%3)*.18);
    var seed=92;function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
    for(var i=0;i<170;i++){var x=(random()-.5)*14,z=13-random()*39;if(Math.abs(x)<2.8&&z>-10)continue;instance(ball,i%3?orange:creamFlower,x,.11,z,.045,.025,.065,0,random()*6,0);}
    // Remote pavilion silhouettes create courtyard depth in elevated chapters.
    [-1,1].forEach(function(s){for(var z=-22;z<12;z+=12){block(ivory,s*17,2.8,z,4,5.6,5);block(gold,s*17,5.7,z,4.5,.2,5.5);instance(cone,pale,s*17,7,z,3,2.6,3,0,Math.PI/4,0);instance(sphere,gold,s*17,8.5,z,.19,.4,.19);}});
    buckets.forEach(function(b){var mesh=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach(function(matrix,i){mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=b.material!==water&&b.material!==flameMat&&b.material!==flameOuter;mesh.receiveShadow=true;mesh.frustumCulled=true;mesh.computeBoundingSphere();scene.add(mesh);});
    buckets.clear();
    var camPoints=[new T.Vector3(10,5.3,22),new T.Vector3(3.1,4.6,13),new T.Vector3(-2,4.8,4),new T.Vector3(-4.3,5.7,-7),new T.Vector3(0,9.3,-6),new T.Vector3(6.3,6,-9),new T.Vector3(0,4.5,-12)];
    var targetPoints=[new T.Vector3(0,4,2),new T.Vector3(0,4,-7),new T.Vector3(-1,2,-4),new T.Vector3(0,5,-20),new T.Vector3(0,2,-10),new T.Vector3(0,4,-20),new T.Vector3(0,3.5,-21)];
    var path=new T.CatmullRomCurve3(camPoints,false,'centripetal'),lookPath=new T.CatmullRomCurve3(targetPoints,false,'centripetal'),target=new T.Vector3();
    var width=0,height=0, ready=false;
    function resize(){if(!alive)return;var rect=host.getBoundingClientRect();width=Math.max(1,rect.width||global.innerWidth);height=Math.max(1,rect.height||global.innerHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=width<700?55:43;camera.updateProjectionMatrix();}
    function setPalette(p){if(!p)return;palette=p;try{if(p.primary)rose.color.set(p.primary);if(p.accent){gold.color.set(p.accent);silk.color.set(p.accent).lerp(new T.Color('#d9a25b'),.65);}if(p.bg){scene.background.set(p.bg).lerp(new T.Color('#eadcc7'),.55);scene.fog.color.copy(scene.background);}}catch(e){} }
    function render(time){if(!alive)return;frame=0;if(hidden)return;var dt=Math.min(.05,Math.max(0,(time-lastTime)/1000));lastTime=time;elapsed+=dt;
      var p=Math.max(0,Math.min(1,progress));camera.position.copy(path.getPoint(p));target.copy(lookPath.getPoint(p));
      if(width<700){camera.position.x*=.74;camera.position.y+=.6;}
      if(!reduced){camera.position.x+=Math.sin(elapsed*.14)*.09;camera.position.y+=Math.sin(elapsed*.23)*.045;flameOuter.opacity=.38+Math.sin(elapsed*4.7)*.05;}
      camera.lookAt(target);renderer.render(scene,camera);
      if(!ready){ready=true;if(options.onReady)try{options.onReady({webgl:true});}catch(e){}}
      // The camera is scroll-directed; idle frames waste battery and delay video playback.
      // setProgress, resize and palette updates request a new render when needed.
    }
    function requestRender(){if(alive&&!hidden&&!frame)frame=global.requestAnimationFrame(render);}
    function visibility(){hidden=document.hidden;if(hidden&&frame){global.cancelAnimationFrame(frame);frame=0;}else{lastTime=performance.now();requestRender();}}
    document.addEventListener('visibilitychange',visibility);global.addEventListener('resize',resize);
    var observer=global.ResizeObserver?new ResizeObserver(function(){resize();requestRender();}):null;if(observer)observer.observe(host);
    function contextLost(event){event.preventDefault();hidden=true;if(frame)global.cancelAnimationFrame(frame);frame=0;}
    function contextRestored(){hidden=document.hidden;requestRender();}
    renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
    resize();setPalette(palette);requestRender();
    return {
      setProgress:function(p){progress=Number.isFinite(p)?Math.max(0,Math.min(1,p)):0;requestRender();},
      setPalette:function(p){setPalette(p);requestRender();},resize:function(){resize();requestRender();},
      stats:function(){return {ready:ready,webgl:true,progress:progress,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),reduced:reduced};},
      dispose:function(){if(!alive)return;alive=false;if(frame)global.cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);global.removeEventListener('resize',resize);if(observer)observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);scene.traverse(function(o){if(o.isInstancedMesh)o.dispose();});geometries.forEach(function(g){g.dispose();});materials.forEach(function(m){m.dispose();});textures.forEach(function(t){t.dispose();});if(shadowLight&&shadowLight.shadow)shadowLight.shadow.dispose();if(environment)environment.dispose();if(pmrem)pmrem.dispose();renderer.dispose();renderer.forceContextLoss();if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);scene.clear();}
    };
  }
  global.KadaliStage = {create:create};
})(window);
