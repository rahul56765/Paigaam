'use strict';
const fs=require('node:fs'),path=require('node:path');
const {render}=require('../templates/anniversary-blue/render');
const root=path.join(__dirname,'..');
const target=process.argv[2]||'/agent/workspace/anniversary-blue-preview.html';
let html=render({}, {isPreview:true,isEditor:true});
html=html.replace('<link rel="stylesheet" href="/anniversary-blue/experience.css">',()=>'<style>'+fs.readFileSync(path.join(root,'public/anniversary-blue/experience.css'),'utf8')+'</style>').replace('<script src="/anniversary-blue/experience.js" defer></script>','').replace('<link rel="icon" href="/brand/favicon-512.png" type="image/png">','').replace('</body>',()=>['experience.js','crop.js','preview-tools.js'].map(name=>'<script>'+fs.readFileSync(path.join(root,'public/anniversary-blue',name),'utf8')+'</script>').join('')+'</body>');
fs.writeFileSync(target,html);console.log(target);
