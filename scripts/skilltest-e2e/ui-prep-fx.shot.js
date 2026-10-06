'use strict';
// Sichtprüfung der Vorbereitung: Helden stehen animiert auf dem Brett, Recycler frisst und spuckt (Bildfolge), Drag-Ziehbild.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-prep-fx.shot.js /pfad/ordner
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const outDir = process.argv[2] || '/tmp';
  const acc = await createAccount('UiFx' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: +process.env.VW || 1600, height: +process.env.VH || 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.click('text=PLAY ONLINE');
    await page.click('text=+ CREATE GAME');
    await page.click('button:has-text("SKILL TEST")');
    await page.click('.modal button:has-text("CREATE")');
    await page.waitForSelector('text=SKILL TEST LOBBY');
    for (let i = 0; i < 3; i++) { await page.click('text=ADD CPU'); await sleep(150); }
    await page.click('button:has-text("START (")');
    await page.waitForSelector('.st-base');
    await sleep(800);
    const q = (n) => `[data-st-card="${n.replace(/"/g, '\\"')}"]`;
    const info = await page.evaluate(() => [...document.querySelectorAll('[data-st-card]')].map(e => { const n = e.getAttribute('data-st-card'); return { n, t: (window.CARDS_BY_NAME[n] || {}).cardType }; }));
    const heroes = info.filter(x => x.t === 'Hero').map(x => x.n);
    for (let hi = 0; hi < 3; hi++) { await page.locator(q(heroes[hi])).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`)); await sleep(350); }
    await sleep(1500);
    await page.screenshot({ path: path.join(outDir, 'fx-heroes.png') });
    const nSprites = await page.locator('.hero-idle-steher').count();
    console.log('Helden-Sprites auf dem Brett:', nSprites);

    // Ziehbild: Maus halten, Screenshot mitten im Zug
    const fillers = info.filter(x => x.t !== 'Hero' && x.t !== 'Ability').map(x => x.n);
    const src = await page.locator(q(fillers[0])).boundingBox();
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
    await page.mouse.down();
    await page.mouse.move(src.x + 200, src.y - 150, { steps: 8 });
    await page.mouse.move(760, 520, { steps: 8 });
    await sleep(150);
    await page.screenshot({ path: path.join(outDir, 'fx-dragging.png') });
    await page.mouse.up();
    await sleep(300);

    // Recycler: erste Karte (kein Auswurf), dann zweite (Auswurf) — Bildfolge
    const rec = page.locator('[data-st-ziel="recycler"]');
    await page.locator(q(fillers[1])).dragTo(rec, { force: true });
    await sleep(1800);
    await page.locator(q(fillers[2])).dragTo(rec, { force: true });
    const t0 = Date.now();
    const shots = [];
    for (let i = 0; i < 16; i++) { const t = Date.now() - t0; await page.screenshot({ path: path.join(outDir, `fx-seq-${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 70 }); shots.push(t); }
    console.log('Bildfolge (ms nach dem Drop):', shots.join(', '));
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(process.exitCode || 0);
})();
