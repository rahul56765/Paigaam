(function(){
'use strict';
var app=document.getElementById('pvApp'),panel=document.getElementById('pvDemoEditor'),launch=document.querySelector('[data-pv-edit-family]'),dataEl=document.getElementById('pvDemoData');
if(!app||!panel||!launch||!dataEl||!window.PaigaamFamilyMaps)return;
var data;try{data=JSON.parse(dataEl.textContent);}catch(_){return;}
var family=app.querySelector('[data-kind="family"]'),inner=family.querySelector('.pv-family-copy .pv-fit-inner'),file=document.getElementById('pvDemoPhoto'),tile=panel.querySelector('[data-pv-crop]'),tileImage=tile.querySelector('img'),tileEmpty=tile.querySelector('span'),choose=panel.querySelector('[data-pv-photo-choose]'),remove=panel.querySelector('[data-pv-photo-remove]'),note=panel.querySelector('.pv-demo-upload-note'),mapNote=panel.querySelector('.pv-demo-map-note'),opened=false,photo=data.familyPhoto||'',drag=null,suppressClick=false,readSerial=0;
var inputs={};Array.from(panel.querySelectorAll('[data-pv-edit]')).forEach(function(input){inputs[input.dataset.pvEdit]=input;});
function create(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
var regards=inner.querySelector('.pv-family-regards'),name=inner.querySelector('.pv-family-name'),welcome=inner.querySelector('.pv-family-welcome'),venue=inner.querySelector('.pv-family-venue')||create('p','pv-family-venue pv-reveal'),address=inner.querySelector('.pv-family-address')||create('p','pv-family-address pv-reveal'),locationLink=inner.querySelector('.pv-family-location')||create('a','pv-family-location'),mapsButton=inner.querySelector('.pv-maps-button')||create('a','pv-maps-button pv-reveal'),guestNote=inner.querySelector('.pv-map-note')||create('p','pv-map-note pv-reveal');
locationLink.appendChild(venue);locationLink.appendChild(address);inner.appendChild(locationLink);inner.appendChild(mapsButton);inner.appendChild(guestNote);address.style.whiteSpace='pre-line';guestNote.setAttribute('role','status');
[locationLink,mapsButton].forEach(function(link){link.target='_blank';link.rel='noopener noreferrer';});
function bounded(id,fallback,min,max){var value=Number(inputs[id].value);return Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;}
function show(node,on,display){node.hidden=!on;node.style.display=on?(display||''):'none';}
function layout(){window.dispatchEvent(new Event('resize'));}
function selectPhoto(){if(!file.disabled)file.click();}
function cropStyles(image){var x=bounded('familyPhotoX',50,0,100),y=bounded('familyPhotoY',50,0,100),z=bounded('familyPhotoZoom',100,100,250)/100;image.style.objectPosition=x+'% '+y+'%';image.style.transformOrigin=x+'% '+y+'%';image.style.transform='scale('+z+')';}
function renderPhoto(){
 var frame=family.querySelector('.pv-family-photo');
 if(photo||opened){
  if(!frame){frame=create('div','pv-family-photo');frame.appendChild(create('div'));family.querySelector('.pv-family-copy').before(frame);frame.addEventListener('click',function(){if(opened)selectPhoto();});}
  var windowEl=frame.firstElementChild,image=windowEl.querySelector('img'),empty=windowEl.querySelector('button');
  if(photo){if(!image){image=create('img');image.alt='Family photograph';windowEl.appendChild(image);image.addEventListener('load',layout);}if(image.getAttribute('src')!==photo)image.src=photo;if(empty)empty.remove();}
  else{if(image)image.remove();if(!empty){empty=create('button','pv-demo-empty-photo','Tap to add your family photo');empty.type='button';windowEl.appendChild(empty);}}
  frame.style.setProperty('--family-zoom',String(bounded('familyPhotoZoom',100,100,250)/100));frame.style.setProperty('--family-x',bounded('familyPhotoX',50,0,100)+'%');frame.style.setProperty('--family-y',bounded('familyPhotoY',50,0,100)+'%');
  family.classList.add('pv-family-has-photo');
 }else{if(frame)frame.remove();family.classList.remove('pv-family-has-photo');}
 show(tileImage,!!photo);show(tileEmpty,!photo,'grid');if(photo&&tileImage.getAttribute('src')!==photo)tileImage.src=photo;cropStyles(tileImage);choose.textContent=photo?'Replace photo':'Choose photo';show(remove,!!photo);
 ['familyPhotoZoom','familyPhotoX','familyPhotoY'].forEach(function(id){panel.querySelector('[data-pv-output="'+id+'"]').textContent=inputs[id].value+'%';});
}
function paint(){
 regards.textContent=inputs.regardsHeading.value;name.textContent=inputs.familyName.value;welcome.textContent=inputs.familyWelcome.value;venue.textContent=inputs.familyVenue.value;address.textContent=inputs.familyAddress.value;show(venue,!!venue.textContent);show(address,!!address.textContent);
 var state=window.PaigaamFamilyMaps.familyMapState(inputs.familyMapsLink.value);mapNote.textContent=state.message;show(mapNote,state.invalid);
 if(state.href){locationLink.href=state.href;mapsButton.href=state.href;}else{locationLink.removeAttribute('href');mapsButton.removeAttribute('href');}
 mapsButton.textContent=inputs.familyMapsLabel.value||'Open in Google Maps';show(mapsButton,!!state.href,'inline-block');guestNote.textContent=state.invalid?'The map link needs a little correction. Please check with the family for directions.':'';show(guestNote,state.invalid);
 renderPhoto();layout();
}
function openEditor(){
 if(app.classList.contains('pv-opening')){launch.textContent='Please let the opening finish';setTimeout(function(){launch.textContent='Edit Family Welcome';},1500);return;}
 opened=true;panel.hidden=false;launch.hidden=true;document.body.classList.add('pv-demo-open');family.classList.add('pv-local-editing');window.dispatchEvent(new Event('pv:edit-family'));paint();panel.querySelector('[data-pv-photo-choose]').focus({preventScroll:true});
}
function closeEditor(){opened=false;panel.hidden=true;launch.hidden=false;document.body.classList.remove('pv-demo-open');family.classList.remove('pv-local-editing');renderPhoto();layout();launch.focus({preventScroll:true});}
launch.addEventListener('click',openEditor);panel.querySelector('[data-pv-editor-close]').addEventListener('click',closeEditor);document.addEventListener('keydown',function(e){if(e.key==='Escape'&&opened){e.preventDefault();closeEditor();}});
Object.keys(inputs).forEach(function(id){inputs[id].addEventListener('input',paint);inputs[id].addEventListener('change',paint);});
choose.addEventListener('click',selectPhoto);tile.addEventListener('click',function(){if(suppressClick){suppressClick=false;return;}selectPhoto();});tile.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPhoto();}});
remove.addEventListener('click',function(){readSerial++;photo='';file.value='';note.textContent='Photo removed from this preview.';paint();});
file.addEventListener('change',function(){
 var picked=file.files&&file.files[0];file.value='';if(!picked)return;var serial=++readSerial;
 if(['image/jpeg','image/png','image/webp'].indexOf(picked.type)<0||picked.size>15*1024*1024){note.textContent='Please choose a JPEG, PNG or WebP photo up to 15 MB.';return;}
 note.textContent='Preparing your photo…';var reader=new FileReader();
 reader.onerror=function(){if(serial===readSerial)note.textContent='That photo could not be read. Please choose another.';};
 reader.onload=function(){var image=new Image();image.onload=function(){if(serial!==readSerial)return;photo=String(reader.result);inputs.familyPhotoZoom.value='100';inputs.familyPhotoX.value='50';inputs.familyPhotoY.value='50';note.textContent='Photo added. Drag it or adjust the sliders; your original stays unchanged.';paint();};image.onerror=function(){if(serial===readSerial)note.textContent='That photo could not be opened. Please choose another.';};image.src=String(reader.result);};reader.readAsDataURL(picked);
});
tile.addEventListener('pointerdown',function(e){if(!photo||e.isPrimary===false)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:bounded('familyPhotoX',50,0,100),py:bounded('familyPhotoY',50,0,100),moved:false};tile.setPointerCapture(e.pointerId);});
tile.addEventListener('pointermove',function(e){if(!drag||drag.id!==e.pointerId)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;if(!drag.moved)return;e.preventDefault();var r=tile.getBoundingClientRect();inputs.familyPhotoX.value=String(Math.round(Math.max(0,Math.min(100,drag.px-dx/r.width*100))));inputs.familyPhotoY.value=String(Math.round(Math.max(0,Math.min(100,drag.py-dy/r.height*100))));paint();});
function endDrag(){if(drag&&drag.moved)suppressClick=true;drag=null;}
tile.addEventListener('pointerup',endDrag);tile.addEventListener('pointercancel',endDrag);
// Adopt existing demo data without exposing any upload or editing control to guest invitations.
paint();
})();
