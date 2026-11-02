'use strict';
// Isolated QA adapter for the real family routes, not an alternative app.
// Avoids loading unrelated creator-photo/sharp routes. Uses a fresh temporary DB.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
if (!process.env.DATA_DIR) process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vaidehi-qa-'));
const { q } = require('../db');
const config = require('../templates/vaidehi/config');
require('./prepare-vaidehi').prepare();
const routes = require('../lib/bfdayRoutes');
const { render } = require('../templates/vaidehi/render');
if (!q.templateBySlug(config.slug)) q.templateInsert({...config,config,status:'published'});
const publicDir = path.resolve(__dirname,'../public');
const mime = {'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.mp3':'audio/mpeg','.wav':'audio/wav'};
const port = Number(process.env.PORT || 3010);
const baseUrl = 'http://127.0.0.1:' + port;
const server = http.createServer(async (req,res) => {
  try {
    const u = new URL(req.url,baseUrl);
    if (await routes.handle(req,res,u,{baseUrl})) return;
    if (u.pathname.startsWith('/p/')) {
      const pg=q.paigaamBySlug(decodeURIComponent(u.pathname.slice(3)));
      if (pg && pg.template_slug==='vaidehi' && pg.status==='published') { res.writeHead(200,{'content-type':'text/html'});res.end(render(pg,{baseUrl}));return; }
    }
    const file=path.resolve(publicDir,'.'+decodeURIComponent(u.pathname));
    if (file.startsWith(publicDir+path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);return;}
    res.writeHead(404);res.end('Not found');
  } catch(e) { console.error(e.message);res.writeHead(500);res.end('QA adapter error'); }
});
server.listen(port,'127.0.0.1',()=>console.log('Vaidehi isolated family QA: '+baseUrl));
