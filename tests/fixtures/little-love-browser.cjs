'use strict';
// QA ONLY. Real PAIGAAM family routes + renderer, isolated from unrelated optional modules.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const data = path.resolve(process.env.DATA_DIR || '.');
if (process.env.PAIGAAM_LITTLE_LOVE_QA !== '1' || !data.startsWith(os.tmpdir() + path.sep) || !path.basename(data).startsWith('little-love-browser-')) throw Error('QA fixture requires a fresh disposable DATA_DIR');
const root = path.resolve(__dirname, '../..');
require(root + '/scripts/prepare-little-love').prepare();
const { q, db } = require(root + '/db');
const family = require(root + '/lib/bfday/family');
const member = family.bySlug('little-love');
q.templateInsert({ name: member.config.name, slug: 'little-love', category: 'Love', status: 'published', config: member.config });
const routes = require(root + '/lib/bfdayRoutes');
const { streamFile } = require(root + '/lib/streamFile');
const mime = { '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };
let base;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, base);
    if (await routes.handle(req, res, url, { baseUrl: base, isAdmin: false })) return;
    if (url.pathname.startsWith('/p/')) {
      const row = q.paigaamBySlug(decodeURIComponent(url.pathname.slice(3)));
      if (row && row.template_slug === 'little-love' && row.status === 'published') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(member.render(row, { baseUrl: base })); }
    }
    const file = path.resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
    if (file.startsWith(root + '/public/') && fs.existsSync(file) && fs.statSync(file).isFile()) { streamFile(req, res, file, mime[path.extname(file)] || 'application/octet-stream'); return; }
    res.writeHead(404); res.end('Not found');
  } catch (e) { res.writeHead(500); res.end(e.message); }
});
server.listen(Number(process.env.PORT) || 4002, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; console.log('LITTLE_LOVE_QA_READY ' + base); });
process.on('SIGTERM', () => { server.closeAllConnections(); server.close(() => { db.close(); process.exit(0); }); });
