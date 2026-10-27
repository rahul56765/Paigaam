'use strict';
// A self-contained, review-only rendering of the actual Suvarna guest renderer.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),C=require('../public/shaadi-paigaam/core'),R=require('../templates/suvarna-vivah/render');
const data=JSON.parse(JSON.stringify(C.SAMPLE));data.palette={id:'custom',custom:{primary:'#70501F',accent:'#BA8A31',bg:'#FBF4DE'}};data.font='royal';
const names=['opening.mp4','opening-poster.jpg','film-end.webp','sanctum.webp','banana-leaves.webp','toran.webp','mandap.webp'];
const assets={};for(const name of names){const mime=name.endsWith('.mp4')?'video/mp4':name.endsWith('.jpg')?'image/jpeg':'image/webp';assets[name]='data:'+mime+';base64,'+fs.readFileSync(path.join(root,'public/suvarna-vivah',name)).toString('base64');}
let html=R.renderInvitation(data,{mode:'demo',openingVideo:true,noindex:true});
html=html.replace(/<link rel="icon"[^>]*>/,'');
html=html.replace(/<script src="\/suvarna-vivah\/opening.js[^>]*><\/script>/,'');
for(const file of ['site.css','opening.css']){
 let css=fs.readFileSync(path.join(root,'public/suvarna-vivah',file),'utf8');
 for(const [name,url] of Object.entries(assets))css=css.split('/suvarna-vivah/'+name).join(url);
 html=html.replace(new RegExp('<link rel="stylesheet" href="/suvarna-vivah/'+file.replace('.','\\.')+'[^>]*>'),'<style>'+css+'</style>');
}
for(const file of ['shaadi-paigaam/i18n.js','shaadi-paigaam/core.js','suvarna-vivah/site.js']){
 let js=fs.readFileSync(path.join(root,'public',file),'utf8');
 if(file.endsWith('site.js'))js=js.replace('src="/suvarna-vivah/${name}.webp"','src="${window.__SV_REVIEW_ASSETS[name+\'.webp\']}"');
 html=html.replace(new RegExp('<script src="/'+file.replaceAll('.','\\.')+'[^>]*><\\/script>'),()=>'<script>'+js.replaceAll('</script','<\\/script')+'</script>');
}
html=html.replace('<script id="sp-boot"','<script>window.__SV_REVIEW_ASSETS='+JSON.stringify(assets).replaceAll('<','\\u003c')+';</script><script id="sp-boot"');
let opener=fs.readFileSync(path.join(root,'public/suvarna-vivah/opening.js'),'utf8');
for(const [name,url]of Object.entries(assets)){html=html.split('/suvarna-vivah/'+name).join(url);opener=opener.split('/suvarna-vivah/'+name).join(url);}
html=html.replace('</body>','<script>'+opener.replaceAll('</script','<\\/script')+'</script></body>');
fs.writeFileSync(path.join(root,'review-preview.html'),html);console.log('Review bytes',Buffer.byteLength(html));
