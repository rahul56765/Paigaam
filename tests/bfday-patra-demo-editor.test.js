'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=require('../templates/patra-vivah/config'),{render}=require('../templates/patra-vivah/render');
const html=(opts={},data={})=>render({customer_data:{...config.demo,...data}},opts);
test('Patra guest and normal private preview never expose the local demo editing panel',()=>{
 for(const opts of [{},{isPreview:true},{isPreview:false}]){const h=html(opts);assert.ok(!h.includes('id="pvDemoEditor"'));assert.ok(!h.includes('demo-editor.js'));assert.ok(!h.includes('data-pv-edit-family'));assert.ok(h.includes('data-editor-preview="false"'));}
});
test('Patra opt-in demo exposes photo upload plus all Family Welcome text, crop and Maps controls together',()=>{
 const h=html({previewEditor:true});assert.ok(h.includes('Edit Family Welcome'));assert.ok(h.includes('id="pvDemoPhoto"'));assert.ok(h.includes('accept="image/jpeg,image/png,image/webp"'));assert.ok(h.includes('data-pv-photo-remove'));assert.ok(h.includes('data-pv-photo-choose'));
 for(const id of ['familyPhotoZoom','familyPhotoX','familyPhotoY','regardsHeading','familyName','familyWelcome','familyVenue','familyAddress','familyMapsLink','familyMapsLabel'])assert.equal((h.match(new RegExp('data-pv-edit="'+id+'"','g'))||[]).length,1,id);
 assert.ok(h.includes('type="range" min="100" max="250"'));assert.ok(h.includes('saving and publishing happen in Paigaam'));
 assert.ok(h.includes('/bfday/family-maps.js?v=1'));assert.ok(h.includes('/patra-vivah/demo-editor.js?v=1'));assert.ok(h.includes('data-editor-preview="true"'));
});
test('Patra demo values are escaped both in inputs and JSON; malicious copy cannot break out of the editor',()=>{
 const value='</script><img src=x onerror=alert(1)>';const h=html({previewEditor:true},{familyName:value});assert.ok(!h.includes(value));assert.ok(h.includes('&lt;/script&gt;'));const raw=/<script type="application\/json" id="pvDemoData">([^]*?)<\/script>/.exec(h)[1];assert.equal(JSON.parse(raw).familyName,value);assert.ok(!raw.includes('<'));
});
test('Patra clean media replaces every active old cover reference, pack entry and thumbnail URL',()=>{
 const h=html({previewEditor:true});assert.ok(h.includes('opening-clean.mp4'));assert.ok(h.includes('opening-clean-poster.webp'));assert.ok(!h.includes('/opening.mp4'));assert.ok(!h.includes('/opening-poster.webp'));
 const root=path.join(__dirname,'..'),m=JSON.parse(fs.readFileSync(path.join(root,'assets/patra-vivah/manifest.json')));
 assert.ok(m['patra-vivah/opening-clean.mp4']);assert.ok(m['patra-vivah/opening-clean-poster.webp']);assert.ok(!m['patra-vivah/opening.mp4']);assert.ok(!m['patra-vivah/opening-poster.webp']);
 for(const name of ['opening.mp4.b64','opening-poster.webp.b64'])assert.equal(fs.existsSync(path.join(root,'assets/patra-vivah',name)),false);
 assert.equal(config.thumbnail_url,'/patra-vivah/opening-clean-poster.webp');assert.equal(config.ogImage,config.thumbnail_url);
});
test('Patra local editor uses non-destructive browser file preview and the shared Maps parser, never remote saving',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../public/patra-vivah/demo-editor.js'),'utf8');assert.ok(s.includes('FileReader'));assert.ok(s.includes('readAsDataURL'));assert.ok(s.includes('familyMapState'));assert.ok(s.includes('pointermove'));assert.ok(s.includes('readSerial'));
 for(const bad of ['fetch(','XMLHttpRequest','localStorage','innerHTML ='])assert.ok(!s.includes(bad));assert.ok(s.includes('textContent='));assert.ok(s.includes("removeAttribute('href')"));
});
test('Patra public demo is the only route opting into local controls; creator and guest flows retain their own UI',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../lib/bfdayRoutes.js'),'utf8');assert.equal((s.match(/previewEditor: true/g)||[]).length,1);assert.ok(s.includes("...(S === 'patra-vivah' ? { previewEditor: true } : {})"));
});
