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
    const heroes = await page.evaluate((names) => names.filter(n => (window.CARDS_BY_NAME[n] || {}).cardType === 'Hero' && !/^(Zhigao|Quetzahuitl)/.test(n)), handNames);
    for (let hi = 0; hi < 3; hi++) {
      await page.locator(`[data-st-card="${heroes[hi].replace(/"/g, '\\"')}"]`).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`));
      await sleep(300);
    }
    await page.click('.st-ready-btn');
    await page.waitForSelector('.st-turn-panel', { timeout: 20000 });
    await sleep(2500);
    // Mensch passt jede Round; die CPUs spielen. Ende abwarten.
    const t0 = Date.now();
    let rounds = 0;
    while (Date.now() - t0 < 160000) {
      if (await page.locator('.st-rank-row').count()) break;
      const btn = page.locator('button:has-text("END MY ROUND")');
      if (await btn.count() && !(await btn.first().isDisabled().catch(() => true))) { await btn.first().click().catch(() => {}); rounds++; }
      await sleep(400);
    }
    await sleep(6000);
    await page.screenshot({ path: out });
    console.log('Rangliste:', (await page.locator('.st-ranking').innerText().catch(() => 'FEHLT')).replace(/\n/g, ' | '));
    console.log('Titel/Overlay:', (await page.locator('.pp-cer-titel, .pp-cer-title').first().innerText().catch(() => '?')));
    console.log('gepasst:', rounds, 'Fehler:', errors.length);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(process.exitCode || 0);
})();
