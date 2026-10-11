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
  const sizes = [], turnMetrics = [];
  for (let i = 0; i < 5; i++) {
    const pageNode = page.locator('.wp-page.is-active');
    await pageNode.screenshot({ path: `/tmp/wedding-post-page-${i + 1}.png` });
    sizes.push(await page.evaluate(() => {
      const book = document.querySelector('.wp-book').getBoundingClientRect();
      const active = document.querySelector('.wp-page.is-active').getBoundingClientRect();
      const node = document.querySelector('.wp-page.is-active');
      return { page: Number(node.dataset.page) + 1, pageWidth: Math.round(active.width), pageHeight: Math.round(active.height), ratio: +(active.width / active.height).toFixed(4), pageContentOverhang: node.scrollHeight - node.clientHeight, viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth, book: [Math.round(book.width), Math.round(book.height)] };
    }));
    if (i < 4) {
      await page.click('#wpNext');
      const turn = await page.locator('.wp-page.wp-turning-forward').count();
      if (turn !== 1) throw new Error('Forward navigation did not start a 3D turn.');
      if (i === 0) {
        await page.waitForFunction(() => {
          const leaf = document.querySelector('.wp-page.wp-turning-forward');
          if (!leaf) return false;
          const transform = getComputedStyle(leaf).transform;
          return transform !== 'none' && Math.abs(new DOMMatrixReadOnly(transform).m11) < .6;
        }, undefined, { timeout: 1200 });
        turnMetrics.push(await page.evaluate(() => {
          const leaf = document.querySelector('.wp-page.wp-turning-forward');
          return { transform: getComputedStyle(leaf).transform, shadow: getComputedStyle(leaf).boxShadow };
        }));
        await page.locator('#wpBook').screenshot({ path: '/tmp/wedding-post-turn-midway.png' });
      }
      await page.waitForFunction(nextPage => document.querySelector('.wp-page.is-active')?.dataset.page === String(nextPage), i + 1, { timeout: 2000 });
    }
  }
  await page.click('#wpPrev');
  if (await page.locator('.wp-page.wp-turning-backward').count() !== 1) throw new Error('Backward navigation did not start a reverse 3D turn.');
  await page.waitForFunction(() => document.querySelector('.wp-page.is-active')?.dataset.page === '3', undefined, { timeout: 2000 });
  await page.locator('[data-page-go="4"]').click();
  if (await page.locator('.wp-page.wp-turning-forward').count() !== 1) throw new Error('Page dots did not use the 3D turn.');
  await page.waitForFunction(() => document.querySelector('.wp-page.is-active')?.dataset.page === '4', undefined, { timeout: 2000 });
  const timelineLayout = await page.evaluate(() => {
    const track = document.querySelector('.wp-timeline-track'), line = document.querySelector('.wp-timeline-line').getBoundingClientRect();
    const lineY = line.top + line.height / 2;
    return Array.from(track.querySelectorAll('.wp-event')).map(event => {
      const copy = event.querySelector('.wp-event-copy').getBoundingClientRect();
      const icon = event.querySelector('.wp-event-icon').getBoundingClientRect();
      const heart = event.querySelector('.wp-event-heart').getBoundingClientRect();
      const copyAbove = event.classList.contains('wp-event--copy-top');
      const iconAbove = event.classList.contains('wp-event--icon-top');
      return { name: event.querySelector('.wp-event-name').textContent.trim(), copyGap: copyAbove ? lineY - copy.bottom : copy.top - lineY, iconGap: iconAbove ? lineY - icon.bottom : icon.top - lineY, heartOffset: heart.top + heart.height / 2 - lineY, copyFits: copy.left >= event.getBoundingClientRect().left && copy.right <= event.getBoundingClientRect().right };
    });
  });
  if (timelineLayout.length !== 5 || timelineLayout.some(event => event.copyGap < 2 || event.iconGap < 2 || Math.abs(event.heartOffset) > 2 || !event.copyFits)) throw new Error('Timeline items collide or overlap the heart line: ' + JSON.stringify(timelineLayout));
  // A real horizontal swipe uses the same page curl as the arrow controls.
  await page.locator('[data-page-go="1"]').evaluate(el => el.click());
  await page.waitForFunction(() => document.querySelector('.wp-page.is-active')?.dataset.page === '1', undefined, { timeout: 2000 });
  await page.evaluate(() => {
    const book = document.getElementById('wpBook');
    const start = new Event('touchstart', { bubbles: true }), end = new Event('touchend', { bubbles: true });
    Object.defineProperty(start, 'changedTouches', { value: [{ clientX: 300, clientY: 200 }] });
    Object.defineProperty(end, 'changedTouches', { value: [{ clientX: 120, clientY: 202 }] });
    book.dispatchEvent(start); book.dispatchEvent(end);
  });
  if (await page.locator('.wp-page.wp-turning-forward').count() !== 1) throw new Error('Horizontal touch swipe did not start a page curl.');
  await page.waitForFunction(() => document.querySelector('.wp-page.is-active')?.dataset.page === '2', undefined, { timeout: 2000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#wpNext').click();
  if (await page.locator('.wp-page.wp-turning-forward').count() !== 0 || await page.locator('.wp-page.is-active').getAttribute('data-page') !== '3') throw new Error('Reduced-motion navigation should change pages without an animation.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('[data-page-go="4"]').evaluate(el => el.click());
  await page.waitForFunction(() => document.querySelector('.wp-page.is-active')?.dataset.page === '4', undefined, { timeout: 2000 });
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
      await page.waitForFunction(pageIndex => document.querySelector('.wp-page.is-active')?.dataset.page === String(pageIndex), i, { timeout: 2000 });
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
  await page.locator('#f-groomName').fill('Aarav Sharma');
  await page.locator('#f-brideName').fill('Ananya Joshi');
  await page.locator('#next').click();
  await page.locator('#f-weddingDate').fill('2027-02-21');
  for (let i = 0; i < 3; i++) await page.locator('#next').click();
  await page.waitForFunction(() => {
    const frame = document.querySelector('#liveFrame');
    const words = frame && frame.contentDocument && frame.contentDocument.querySelector('#wpWordList');
    return words && words.textContent.includes('Aarav') && words.textContent.includes('Ananya');
  }, undefined, { timeout: 5000 });
  const editorNamesUpdated = await page.evaluate(() => {
    const payload = document.querySelector('#liveFrame').contentDocument.querySelector('#wpGameData').textContent;
    return payload.includes('Aarav') && payload.includes('Ananya') && !payload.includes('Raghav') && !payload.includes('Ragini');
  });
  if (!editorNamesUpdated) throw new Error('Changing the couple fields did not rebuild the editable word-search names.');
  await page.locator('[data-add="wordList"]').click();
  await page.locator('[data-list="wordList"] .bf-row').last().locator('input').fill('Reception');
  await page.waitForFunction(() => document.querySelector('#liveFrame')?.contentDocument?.querySelector('#wpGameData')?.textContent.includes('Reception'), undefined, { timeout: 5000 });
  const customWordUpdated = await page.evaluate(() => document.querySelector('#liveFrame').contentDocument.querySelector('#wpWordList').textContent.includes('Reception'));
  if (!customWordUpdated) throw new Error('Editing a custom word did not regenerate the preview grid/list.');
  const eventsBefore = await page.locator('[data-list="timeline"] .bf-row').count();
  await page.locator('[data-add="timeline"]').click();
  const eventsAfterAdd = await page.locator('[data-list="timeline"] .bf-row').count();
  await page.locator('[data-list="timeline"] .bf-row button[aria-label="Remove"]').last().click();
  const eventsAfterRemove = await page.locator('[data-list="timeline"] .bf-row').count();
  if (eventsAfterAdd !== eventsBefore + 1 || eventsAfterRemove !== eventsBefore) throw new Error('Timeline add/remove controls failed.');
  if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
  console.log(JSON.stringify({ sizes, responsive, turnMetrics, timelineLayout, wordResult: { length: wordResult.path.length, found: wordFound }, maze: { moves: mazePath.length, won: mazeWon }, timelineEditor: { before: eventsBefore, afterAdd: eventsAfterAdd, afterRemove: eventsAfterRemove }, editorNamesUpdated, customWordUpdated, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e.stack || e); process.exit(1); });
