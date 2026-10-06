'use strict';
// UI-Test: Idej Lord aufstellen → Karten erscheinen aus dem Nichts; Rechtsklick löscht; nicht ziehbar/recycelbar; Hero zurück → alles weg.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-idej.js /pfad/ordner
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const outDir = process.argv[2] || '/tmp';
  const acc = await createAccount('UiIdej' + Date.now().toString(36));
  const srv = await startServer({ PP_ST_TEST_HAND: 'Idej Lord Nobunakin' });
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

    const lord = 'Idej Lord Nobunakin';
    await page.locator(`[data-st-card="${lord}"]`).dragTo(page.locator('[data-st-zone="hero:0:"]'));
    await sleep(500);
    check('Idej Lord steht auf dem Brett', (await page.locator('.board-zone-hero .board-card').count()) === 1);
    const spawned = page.locator('.board-zone-support.st-spawned');
    check('3 Support Zones tragen erschienene Karten', (await spawned.count()) === 3, await spawned.count());
    const names = await page.evaluate(() => [...document.querySelectorAll('.board-zone-support.st-spawned img')].map(i => (i.getAttribute('src') || '').split('/').pop()));
    console.log('  erschienen:', names.join(', '));
    check('Zwei Projections + ein Blade (Bilddateien)', names.filter(n => /projection/i.test(n)).length === 2 && names.filter(n => /blade/i.test(n)).length === 1, names);
    check('Erschienene Karten sind nicht ziehbar', (await page.locator('.board-zone-support.st-spawned[draggable="true"]').count()) === 0);
    await page.screenshot({ path: path.join(outDir, 'idej-1-spawned.png') });

    // Recycler: Drag ist gar nicht erst möglich → Zähler bleibt 0
    const before = (await page.locator('.st-recycler-count').innerText()).trim();
    await spawned.first().dragTo(page.locator('[data-st-ziel="recycler"]')).catch(() => {});
    await sleep(500);
    check('Recycler-Zähler unverändert (kein Recyceln)', (await page.locator('.st-recycler-count').innerText()).trim() === before, before);
    check('…Karten noch da', (await spawned.count()) === 3);

    // Rechtsklick löscht
    await spawned.first().click({ button: 'right' });
    await sleep(500);
    check('Rechtsklick löscht eine erschienene Karte', (await page.locator('.board-zone-support.st-spawned').count()) === 2, await page.locator('.board-zone-support.st-spawned').count());
    const handNow = await page.locator('[data-st-card]').count();
    check('…und sie landet nicht auf der Hand (19 − 1 Lord = 18)', handNow === 18, handNow);

    // Zone leer → Sword/Equipment auf freie Zone? (nur prüfen, dass die Zone wieder leer ist)
    check('Gelöschte Zone ist leer', (await page.locator('.board-zone-support:not(.st-spawned) .board-zone-empty').count()) >= 1);

    // Hero zurück auf die Hand: alles verschwindet
    await page.locator('.board-zone-hero .board-card').first().dragTo(page.locator('[data-st-ziel="hand"]'));
    await sleep(500);
    check('Hero zurück auf der Hand: keine erschienenen Karten mehr', (await page.locator('.board-zone-support.st-spawned').count()) === 0);
    check('…auch keine Projection auf der Hand', (await page.locator('[data-st-card="Idej Projection"]').count()) === 0);
    check('Hand zählt wieder 19', (await page.locator('[data-st-card]').count()) === 19, await page.locator('[data-st-card]').count());
    await page.screenshot({ path: path.join(outDir, 'idej-2-gone.png') });
    check('Keine JS-Fehler', errors.length === 0, errors);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
