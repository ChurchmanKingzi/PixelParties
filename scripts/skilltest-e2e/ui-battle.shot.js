'use strict';
// Visueller Test des Kampfes: Raum mit 1 Mensch + 1 CPU, Vorbereitung abschließen, Screenshot des Boards.
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const out = process.argv[2] || '/tmp/st-battle.png';
  const acc = await createAccount('UiBattle' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: parseInt(process.env.ST_W || '1700', 10), height: parseInt(process.env.ST_H || '950', 10) } });
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
    for (let c = 0; c < parseInt(process.env.ST_CPUS || '1', 10); c++) { await page.click('text=ADD CPU'); await sleep(200); }
    await page.click('button:has-text("START (")');
    await page.waitForSelector('.st-base');
    await sleep(600);
    // Heroes platzieren
    const handNames = await page.evaluate(() => [...document.querySelectorAll('[data-st-card]')].map(e => e.getAttribute('data-st-card')));
    const heroes = await page.evaluate((names) => names.filter(n => (window.CARDS_BY_NAME[n] || {}).cardType === 'Hero'), handNames);
    for (let hi = 0; hi < 3; hi++) {
      await page.locator(`[data-st-card="${heroes[hi].replace(/"/g, '\\"')}"]`).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`));
      await sleep(300);
    }
    await page.click('.st-ready-btn');
    await page.waitForSelector('.st-turn-panel', { timeout: 20000 });
    await sleep(2500);
    await page.screenshot({ path: out });
    console.log('turn panel:', (await page.innerText('.st-turn-panel')).replace(/\n/g, ' | '));
    // Spielzug: eigenen bereiten Hero anklicken und einen gegnerischen Hero als Ziel wählen.
    const mine = page.locator('.board-zone-hero.st-actor-ready[data-hero-owner="me"]').first();
    console.log('bereite eigene Heroes:', await page.locator('.board-zone-hero.st-actor-ready[data-hero-owner="me"]').count());
    await mine.click();
    await sleep(1200);
    await page.screenshot({ path: out.replace('.png', '-clicked.png') });
    console.log('nach Klick:', (await page.innerText('.st-turn-panel')).replace(/\n/g, ' | '));
    const target = process.env.ST_TARGET === 'mini'
      ? page.locator('.st-mini .board-zone-hero[data-hero-owner^="mini"]').nth(1)
      : page.locator('.board-zone-hero[data-hero-owner="opp"]').first();
    console.log('Mini-Helden:', await page.locator('.st-mini .board-zone-hero').count());
    await target.click({ force: true });
    await sleep(800);
    await page.screenshot({ path: out.replace('.png', '-picked.png') });
    console.log('Bestätigen-Button:', await page.locator('button:has-text("ATTACK!")').count(), await page.locator('button:has-text("ATTACK!")').first().isDisabled().catch(() => 'n/a'));
    const confirmBtn = page.locator('button:has-text("ATTACK!")');
    if (await confirmBtn.count()) await confirmBtn.first().click();
    await sleep(4000);
    await page.screenshot({ path: out.replace('.png', '-after.png') });
    console.log('nach Ziel:', (await page.innerText('.st-turn-panel')).replace(/\n/g, ' | '));
    console.log('exhausted:', await page.locator('.st-actor-exhausted').count());
    console.log('Fehler:', errors.length);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(process.exitCode || 0);
})();
