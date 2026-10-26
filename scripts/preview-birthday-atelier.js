'use strict';
// Produce a portable sample, without API calls or production-only asset paths.
const fs=require('node:fs'),path=require('node:path');
const {render}=require('../templates/birthday-atelier/render');
const config=require('../templates/birthday-atelier/config');
const target=process.argv[2]||'/agent/workspace/birthday-atelier-demo.html';
let html=render({customer_data:config.demo},{isPreview:true});
html=html.replace('<link rel="stylesheet" href="/birthday-atelier/experience.css">',()=>'<style>'+fs.readFileSync(path.join(__dirname,'../public/birthday-atelier/experience.css'),'utf8')+'</style>')
 .replace('<link rel="stylesheet" href="/bfday/bgm.css">','')
 .replace('<script src="/birthday-atelier/experience.js" defer></script>','')
 .replace('<link rel="icon" href="/brand/favicon-512.png" type="image/png">','')
 .replace('</body>',()=>'<script>'+fs.readFileSync(path.join(__dirname,'../public/birthday-atelier/experience.js'),'utf8')+'</script></body>');
fs.writeFileSync(target,html);console.log(target);
