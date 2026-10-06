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
  const accB = await createAccount('UiSpec' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1700, height: 950 } });
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
    await sleep(1500);
    // Zuschauer
    const ctxB = await browser.newContext({ viewport: { width: 1500, height: 900 } });
    await ctxB.request.post(BASE + '/api/auth/login', { data: { username: accB.username, password: accB.password } });
    if (toolsDir) {
      await ctxB.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctxB.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctxB.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const pageB = await ctxB.newPage();
    const errorsB = [];
    pageB.on('pageerror', (e) => { errorsB.push(e.message); console.log('[pageerror B]', e.message); });
    await pageB.goto(BASE + '/');
    await pageB.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await pageB.click('text=PLAY ONLINE');
    await pageB.waitForSelector('.room-card', { timeout: 15000 });
    await pageB.click('.room-card:has-text("spectate")');
    let ok = true;
    try { await pageB.waitForSelector('.st-turn-panel', { timeout: 15000 }); } catch { ok = false; }
    console.log('Zuschauer sieht Turn-Panel:', ok, '| Mini-Kacheln:', await pageB.locator('.st-mini').count());
    await sleep(1500);
    await pageB.screenshot({ path: out.replace('.png', '-spectator.png') });
    // Wiederverbinden des Spielers
    await page.reload();
    let ok2 = true;
    try { await page.waitForSelector('.st-turn-panel', { timeout: 20000 }); } catch { ok2 = false; }
    console.log('Nach Neuladen: Turn-Panel wieder da:', ok2);
    await sleep(1500);
    await page.screenshot({ path: out.replace('.png', '-reconnect.png') });
    console.log('Fehler A:', errors.length, 'Fehler B:', errorsB.length);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(process.exitCode || 0);
})();
