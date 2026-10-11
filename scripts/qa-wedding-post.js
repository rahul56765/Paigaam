'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3000/wedding-post/demo', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const sizes = [];
  for (let i = 0; i < 5; i++) {
    const pageNode = page.locator('.wp-page.is-active');
    await pageNode.screenshot({ path: `/tmp/wedding-post-page-${i + 1}.png` });
    sizes.push(await page.evaluate(() => {
      const book = document.querySelector('.wp-book').getBoundingClientRect();
      const active = document.querySelector('.wp-page.is-active').getBoundingClientRect();
      const node = document.querySelector('.wp-page.is-active');
      return { page: Number(node.dataset.page) + 1, pageWidth: Math.round(active.width), pageHeight: Math.round(active.height), ratio: +(active.width / active.height).toFixed(4), pageContentOverhang: node.scrollHeight - node.clientHeight, viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth, book: [Math.round(book.width), Math.round(book.height)] };
    }));
    if (i < 4) await page.click('#wpNext');
  }
  const wordResult = await page.evaluate(() => {
    const grid = document.querySelector('#wpWordGrid');
    const n = Number(getComputedStyle(grid).getPropertyValue('--grid-size').trim()) || Math.round(Math.sqrt(grid.children.length));
    const letters = Array.from(grid.querySelectorAll('.wp-letter')).map(x => x.textContent);
    const target = 'LOVE';
    const dirs = [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]];
    let path = null;
    for (let r=0; r<n && !path; r++) for (let c=0; c<n && !path; c++) for (const [dr,dc] of dirs) {
      const arr=[]; for (let k=0;k<target.length;k++){ const rr=r+dr*k,cc=c+dc*k; if(rr<0||cc<0||rr>=n||cc>=n)break; arr.push(rr*n+cc); }
      if(arr.length===target.length && arr.map(i=>letters[i]).join('')===target) path=arr;
    }
    const rect = i => { const b=grid.children[i].getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2}; };
    return { n, path, start: path && rect(path[0]), end: path && rect(path[path.length-1]) };
  });
  if (!wordResult.path) throw new Error('The generated word grid did not contain LOVE.');
  await page.mouse.move(wordResult.start.x, wordResult.start.y);
  await page.mouse.down();
  await page.mouse.move(wordResult.end.x, wordResult.end.y, { steps: 12 });
  await page.mouse.up();
  const wordFound = await page.locator('.wp-word').filter({ hasText: 'Love' }).evaluate(el => el.classList.contains('found'));
  if (!wordFound) throw new Error('Drag selection did not find LOVE.');
  const mazePath = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.wp-maze-cell')).map(e => ({ n: e.style.getPropertyValue('--wall-top') === 'transparent', e: e.style.getPropertyValue('--wall-right') === 'transparent', s: e.style.getPropertyValue('--wall-bottom') === 'transparent', w: e.style.getPropertyValue('--wall-left') === 'transparent' }));
    const q = [{i:0,route:[]}], seen=new Set([0]), dirs=[['up','n',-10],['right','e',1],['down','s',10],['left','w',-1]];
    while(q.length){const cur=q.shift(); if(cur.i===99)return cur.route; for(const [name,wall,step] of dirs){const j=cur.i+step; if(!cells[cur.i][wall]||j<0||j>=100||(name==='right'&&cur.i%10===9)||(name==='left'&&cur.i%10===0)||seen.has(j))continue;seen.add(j);q.push({i:j,route:cur.route.concat(name)});}}
    return [];
  });
  if (!mazePath.length) throw new Error('No path through the generated maze.');
  for (const move of mazePath) await page.locator(`[data-move="${move}"]`).click();
  const mazeWon = await page.locator('#wpMazeWin').isVisible();
  if (!mazeWon) throw new Error('Maze did not reach the bride after following the open path.');
  const responsive = [];
  for (const viewport of [{ width: 320, height: 640 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-page-go="${i}"]`).evaluate(el => el.click());
      const measure = await page.evaluate(() => {
        const book = document.querySelector('.wp-book').getBoundingClientRect();
        const node = document.querySelector('.wp-page.is-active'), rect = node.getBoundingClientRect();
        return { page: Number(node.dataset.page) + 1, width: Math.round(rect.width), height: Math.round(rect.height), ratio: +(rect.width / rect.height).toFixed(4), overhang: node.scrollHeight - node.clientHeight, documentWidth: document.documentElement.scrollWidth };
      });
      if (Math.abs(measure.ratio - 5 / 7) > 0.003 || measure.documentWidth > viewport.width || measure.overhang > 0) throw new Error('Responsive page overflow: ' + JSON.stringify({ viewport, ...measure }));
      responsive.push({ viewport: [viewport.width, viewport.height], ...measure });
    }
  }
  await page.goto('http://localhost:3000/create/wedding-post', { waitUntil: 'domcontentloaded' });
  await page.locator('#f-groomName').fill('Raghav');
  await page.locator('#f-brideName').fill('Ragini');
  await page.locator('#next').click();
  await page.locator('#f-weddingDate').fill('2027-02-21');
  for (let i = 0; i < 3; i++) await page.locator('#next').click();
  const eventsBefore = await page.locator('[data-list="timeline"] .bf-row').count();
  await page.locator('[data-add="timeline"]').click();
  const eventsAfterAdd = await page.locator('[data-list="timeline"] .bf-row').count();
  await page.locator('[data-list="timeline"] .bf-row button[aria-label="Remove"]').last().click();
  const eventsAfterRemove = await page.locator('[data-list="timeline"] .bf-row').count();
  if (eventsAfterAdd !== eventsBefore + 1 || eventsAfterRemove !== eventsBefore) throw new Error('Timeline add/remove controls failed.');
  if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
  console.log(JSON.stringify({ sizes, responsive, wordResult: { length: wordResult.path.length, found: wordFound }, maze: { moves: mazePath.length, won: mazeWon }, timelineEditor: { before: eventsBefore, afterAdd: eventsAfterAdd, afterRemove: eventsAfterRemove }, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e.stack || e); process.exit(1); });
