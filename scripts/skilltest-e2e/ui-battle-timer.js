'use strict';
// Zug-Timer im Kampf (Chromium): „YOUR TURN · Ns" startet bei der eingestellten Zeit und zählt herunter (kein Springen zwischen 90 und 91).
//   NODE_PATH=/tmp/st-tools/node_modules node scripts/skilltest-e2e/ui-battle-timer.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const acc = await createAccount('UiTimer' + Date.now().toString(36));
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
    await page.click('text=ADD CPU'); await sleep(200);
    await page.click('button:has-text("START (")');
    await page.waitForSelector('.st-base');
    await sleep(600);
    const handNames = await page.evaluate(() => [...document.querySelectorAll('[data-st-card]')].map(e => e.getAttribute('data-st-card')));
    const heroes = await page.evaluate((names) => names.filter(n => (window.CARDS_BY_NAME[n] || {}).cardType === 'Hero' && !/^(Zhigao|Quetzahuitl)/.test(n)), handNames);
    for (let hi = 0; hi < 3; hi++) {
      await page.locator(`[data-st-card="${heroes[hi].replace(/"/g, '\\"')}"]`).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`));
      await sleep(300);
    }
    await page.click('.st-ready-btn');
    await page.waitForSelector('.st-turn-panel', { timeout: 20000 });
    const secs = async () => { const t = await page.locator('.st-turn-yours').first().innerText().catch(() => ''); const m = t.match(/(\d+)s/); return m ? parseInt(m[1], 10) : null; };
    // Warten, bis der Mensch dran ist (die CPU spielt vielleicht zuerst)
    let first = null;
    for (let k = 0; k < 120 && first == null; k++) { first = await secs(); if (first == null) await sleep(500); }
    check('der Mensch kommt dran und der Timer ist sichtbar', first != null, first);
    const t0 = Date.now();
    const samples = [first];
    for (let k = 0; k < 3; k++) { await sleep(2000); samples.push(await secs()); }
    console.log('  Werte:', samples.join(' → '), `(${Math.round((Date.now() - t0) / 1000)} s vergangen)`);
    check('Start bei höchstens 90 s und nicht weit darunter', first <= 90 && first >= 84, first);
    check('zählt herunter (jeder Wert kleiner als der vorige)', samples.every((v, i) => i === 0 || v < samples[i - 1]), samples);
    check('nach ~6 s sind es rund 6 s weniger (±2)', Math.abs((first - samples[samples.length - 1]) - 6) <= 2, samples);
    check('Keine JS-Fehler', errors.length === 0, errors);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
