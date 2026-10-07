'use strict';
// UI-Klangtest der Vorbereitung in echtem Chromium: Aufnehmen, Platzieren, Zurücknehmen, Recycler (Mund, Kauen, Gold, Auswurf), Bereit.
//   NODE_PATH=/tmp/st-tools/node_modules node scripts/skilltest-e2e/ui-prep-sounds.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const acc = await createAccount('UiSnd' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react', 'umd', 'react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom', 'umd', 'react-dom.production.min.js')) }));
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
    // Klänge mitschreiben (der echte Klang spielt weiter). `playSFX` ruft sich bei verzögerten Klängen selbst über `window` neu auf (mit delay: 0) — diese Wiederaufrufe zählen nicht.
    await page.evaluate(() => {
      window.__sfx = [];
      const orig = window.playSFX;
      window.playSFX = (n, o) => { if (!(o && o.delay === 0)) window.__sfx.push({ n, t: Math.round(performance.now()), o: o || {} }); return orig && orig(n, o); };
    });
    const sfx = async (fn, wait = 450) => { await page.evaluate(() => { window.__sfx = []; }); await fn(); await sleep(wait); return page.evaluate(() => window.__sfx.map(x => x.n)); };
    const sel = (n) => `[data-st-card="${n.replace(/"/g, '\\"')}"]`;

    const info = await page.evaluate(() => [...document.querySelectorAll('[data-st-card]')].map(e => { const n = e.getAttribute('data-st-card'); const c = window.CARDS_BY_NAME[n] || {}; return { n, t: c.cardType, sub: c.subtype }; }));
    const heroes = info.filter(x => x.t === 'Hero').map(x => x.n);

    let s = await sfx(() => page.locator(sel(heroes[0])).dragTo(page.locator('[data-st-zone="hero:0:"]')));
    console.log('  Held platziert:', s.join(', '));
    check('Held aufnehmen und aufstellen: draw (Aufnehmen), summon (Aufgestellt)', s.includes('draw') && s.includes('summon'), s);
    for (let hi = 1; hi < 3; hi++) { await page.locator(sel(heroes[hi])).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`)); await sleep(350); }

    const supp = info.find(x => x.t === 'Creature' && (x.sub || '').toLowerCase() === 'normal') || info.find(x => x.t === 'Artifact');
    if (supp) {
      s = await sfx(() => page.locator(sel(supp.n)).dragTo(page.locator('[data-st-zone^="support:0:"]').first()));
      console.log('  Support:', s.join(', '));
      check('Karte in die Support Zone: placement', s.includes('placement'), s);
      s = await sfx(async () => { await page.locator('[data-st-zone^="support:0:"] .board-card').first().click({ button: 'right' }); });
      console.log('  Zurück:', s.join(', '));
      check('Rechtsklick nimmt die Karte zurück: draw', s.includes('draw'), s);
    }

    // Recycler: Mund öffnen beim Darüberziehen, Kauen, Gold, Auswurf (jede 2. Karte)
    const fillers = info.filter(x => x.t !== 'Hero' && x.t !== 'Ability' && x.n !== (supp && supp.n)).slice(0, 2).map(x => x.n);
    s = await sfx(() => page.locator(sel(fillers[0])).dragTo(page.locator('[data-st-ziel="recycler"]')), 1200);
    console.log('  Recycler 1:', s.join(', '));
    check('Recycler (1. Karte): Mund auf (shuffle), Deckel schnappt (discard, placement), kaut (heavy_impact), Gold (gold_gain)',
      ['shuffle', 'discard', 'placement', 'heavy_impact', 'gold_gain'].every(x => s.includes(x)), s);
    check('Ohne Auswurf kein summon/ping', !s.includes('summon') && !s.includes('ping'), s);
    check('Jeder Recycler-Klang genau einmal (kein Doppelabspielen)', s.filter(x => x === 'gold_gain').length === 1 && s.filter(x => x === 'discard').length === 1, s);
    s = await sfx(() => page.locator(sel(fillers[1])).dragTo(page.locator('[data-st-ziel="recycler"]')), 2300);
    console.log('  Recycler 2:', s.join(', '));
    check('Recycler (2. Karte, Auswurf): zusätzlich summon, ping und draw bei der Landung in der Hand', ['summon', 'ping', 'draw'].every(x => s.includes(x)), s);

    s = await sfx(async () => { await page.click('.st-ready-btn'); }, 500);
    console.log('  Bereit:', s.join(', '));
    check('Bereit: buff (oder der Kampf startet sofort)', s.includes('buff') || (await page.locator('.st-ready-btn').count()) === 0, s);
    check('Keine JS-Fehler', errors.length === 0, errors);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(finish() ? 1 : (process.exitCode || 0));
})();
