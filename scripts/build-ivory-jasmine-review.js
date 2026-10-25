'use strict';
// Self-contained local review: no upload/API/storage dependency and no production writes.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'), C=require('../public/ivory-jasmine/core'),R=require('../templates/ivory-jasmine/render');
const d=C.validate(C.SAMPLE,{allowPast:true}).data;
let html=R.renderInvitation(d,{mode:'demo',noindex:true});
const assets={};for(const f of fs.readdirSync(path.join(root,'public/ivory-jasmine/art'))){if(f.endsWith('.webp'))assets[f.replace('.webp','')]='data:image/webp;base64,'+fs.readFileSync(path.join(root,'public/ivory-jasmine/art',f)).toString('base64');}
let css=fs.readFileSync(path.join(root,'public/ivory-jasmine/invite.css'),'utf8').replaceAll('/ivory-jasmine/art/paper.webp',assets.paper);
html=html.replace(/<link rel="stylesheet" href="\/ivory-jasmine\/invite.css[^>]+>/,'<style>'+css+'</style>');
for(const file of ['shaadi-paigaam/i18n.js','shaadi-paigaam/core.js','ivory-jasmine/core.js','ivory-jasmine/invite.js']){
 let js=fs.readFileSync(path.join(root,'public',file),'utf8');
 if(file.endsWith('invite.js')){
  js='const REVIEW_ASSETS='+JSON.stringify(assets)+';\n'+js;
  js=js.replace('${art+name}.webp','${REVIEW_ASSETS[name]}').replace(/\$\{art\}([a-z0-9-]+)\.webp/g,'${REVIEW_ASSETS["$1"]}');
  js=js.replace('src="${esc(p.url)}"','src="${esc(REVIEW_ASSETS[p.url.split("/").pop().replace(".webp","")]||p.url)}"');
 }
 html=html.replace(new RegExp('<script src="/'+file.replaceAll('.','\\.')+'[^>]*><\\/script>'),()=>'<script>'+js.replaceAll('</script','<\\/script')+'</script>');
}
html=html.replace('<body>','<body><div style="position:fixed;bottom:12px;left:12px;z-index:40;padding:9px 14px;border:1px solid #d4d9c5;background:#ffffffef;color:#4b563e;border-radius:6px;font:11px Georgia,serif;max-width:210px">IVORY JASMINE · Design review<br>Generated decorative artwork · sample data<br>Not deployed · no customer data saved</div>');
fs.writeFileSync(path.join(root,'../ivory-jasmine-review.html'),html);
console.log('Review written: '+Buffer.byteLength(html)+' bytes');
