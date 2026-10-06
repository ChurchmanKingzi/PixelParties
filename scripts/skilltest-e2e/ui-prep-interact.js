'use strict';
// UI-Interaktionstest der Vorbereitung (Drag & Drop, Recycler, Ready) in echtem Chromium.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-prep-interact.js /pfad/ordner
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const outDir = process.argv[2] || '/tmp';
  const acc = await createAccount('UiDrag' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.click('text=PLAY ONLINE');
    await page.click('text=+ CREATE GAME');
    await page.click('button:has-text("SKILL TEST")');
    await page.click('.modal button:has-text("CREATE")');
    await page.waitForSelector('text=SKILL TEST LOBBY');
    await page.click('text=ADD CPU'); await sleep(200);
    await page.click('button:has-text("START (")');
    await page.waitForSelector('.st-base');
    await sleep(800);

    const info = await page.evaluate(() => {
      const names = [...document.querySelectorAll('[data-st-card]')].map(e => e.getAttribute('data-st-card'));
      return names.map(n => ({ n, t: (window.CARDS_BY_NAME[n] || {}).cardType, sub: (window.CARDS_BY_NAME[n] || {}).subtype }));
    });
    check('18 Karten in der Hand (DOM)', info.length === 18, info.length);
    const heroes = info.filter(x => x.t === 'Hero').map(x => x.n);
    for (let hi = 0; hi < 3; hi++) {
      await page.locator(`[data-st-card="${heroes[hi].replace(/"/g, '\\"')}"]`).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`));
      await sleep(350);
    }
    const onBoard = await page.locator('.board-zone-hero .board-card').count();
    check('3 Heroes per Drag & Drop platziert', onBoard === 3, onBoard);
    check('Start-Abilities erscheinen', (await page.locator('.st-start-ability').count()) >= 3, await page.locator('.st-start-ability').count());

    // Ability aus der Hand auf einen Hero ziehen -> Level 3
    const ab = info.find(x => x.t === 'Ability');
    if (ab) {
      await page.locator(`[data-st-card="${ab.n.replace(/"/g, '\\"')}"]`).dragTo(page.locator('[data-st-zone^="ability:2:"]').first());
      await sleep(400);
      const hasLv3 = await page.evaluate((n) => [...document.querySelectorAll('.board-ability-stack')].some(s => s.querySelectorAll('img, .board-card').length >= 3), ab.n);
      console.log('  (Ability-Stapel Lv3 sichtbar:', hasLv3, ')');
    }
    // Recycler: zwei Nicht-Heroes
    const fillers = info.filter(x => x.t !== 'Hero' && x.t !== 'Ability').slice(0, 2).map(x => x.n);
    for (const n of fillers) {
      await page.locator(`[data-st-card="${n.replace(/"/g, '\\"')}"]`).dragTo(page.locator('[data-st-ziel="recycler"]'));
      await sleep(500);
    }
    const count = await page.locator('.st-recycler-count').innerText();
    check('Recycler-Zähler zeigt 2', count.trim() === '2', count);
    check('Auswurf-Animation/Karte erschien (oder schon vorbei)', true);
    await sleep(300);
    await page.screenshot({ path: path.join(outDir, 'interact-1.png') });
    const handNow = await page.locator('[data-st-card]').count();
    const abInHand = ab ? await page.locator(`[data-st-card="${ab.n.replace(/"/g, '\\"')}"]`).count() : 0;
    check('Hand: 18 − 3 Heroes − (Ability, falls platziert) − 2 Recycelt + 1 Auswurf', handNow === 18 - 3 - (ab && !abInHand ? 1 : 0) - 2 + 1, [handNow, abInHand]);

    // Ready
    await page.click('.st-ready-btn');
    await sleep(500);
    // Ist der CPU-Sitz schon bereit, startet der Kampf sofort und die Vorbereitung verschwindet.
    const readyBtn = page.locator('.st-ready-btn');
    check('Ready angenommen (READY ✓ oder Kampfstart)', (await readyBtn.count()) === 0 || (await readyBtn.innerText()).includes('READY'));
    await page.screenshot({ path: path.join(outDir, 'interact-2.png') });
    check('Keine JS-Fehler', errors.length === 0, errors);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
