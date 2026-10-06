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
    const heroes = await page.evaluate((names) => names.filter(n => (window.CARDS_BY_NAME[n] || {}).cardType === 'Hero' && !/^(Zhigao|Quetzahuitl)/.test(n)), handNames);
    for (let hi = 0; hi < 3; hi++) {
      await page.locator(`[data-st-card="${heroes[hi].replace(/"/g, '\\"')}"]`).dragTo(page.locator(`[data-st-zone="hero:${hi}:"]`));
      await sleep(300);
    }
    await page.click('.st-ready-btn');
    await page.waitForSelector('.st-turn-panel', { timeout: 20000 });
    // Bildfolge der ersten Bot-Züge (ST_SEQ0): Anzeige folgt dem Geschehen, der Handelnde leuchtet, danach ergraut er
    for (let k = 0; k < (parseInt(process.env.ST_SEQ0 || '0', 10)); k++) {
      await page.screenshot({ path: out.replace('.png', '-start-' + String(k).padStart(2, '0') + '.png') });
      console.log('start', k, 'acting:', await page.locator('.st-actor-acting').count(), 'exhausted:', await page.locator('.st-actor-exhausted').count(), '|', (await page.innerText('.st-turn-panel')).replace(/\n/g, ' ').replace(/[^\x20-\x7E▶⏹]/g, '').slice(0, 110));
      if (await page.locator('.st-actor-acting').count()) { try { const bb = await page.locator('.st-actor-acting').first().boundingBox(); if (bb) await page.screenshot({ path: out.replace('.png', '-acting-' + k + '.png'), clip: { x: Math.max(0, bb.x - 80), y: Math.max(0, bb.y - 120), width: bb.width + 160, height: bb.height + 200 } }); } catch { /* egal */ } }
      await sleep(350);
    }
    await sleep(2500);
    await page.screenshot({ path: out });
    console.log('turn panel:', (await page.innerText('.st-turn-panel')).replace(/\n/g, ' | '));
    // Spielerwahl (ST_PICKER=1): ein vorgetäuschter Prompt wie bei Chain Lightning/Qinglong — der gezeigte Gegner muss markiert sein
    if (process.env.ST_PICKER) {
      await page.evaluate(() => {
        const sock = window.socket;
        sock.on('game_state', (g) => { window.__lastGs = g; });
      });
      await sleep(3000);
      const info = await page.evaluate(() => {
        const g = window.__lastGs; if (!g) return null;
        const others = g.players.map((_, i) => i).filter(i => i !== g.myIndex);
        const fake = { ...g, effectPrompt: { type: 'playerPicker', ownerIdx: g.myIndex, title: 'Chain Lightning', description: 'Choose the player you want to strike.', allowedPlayers: others, cancellable: false, promptId: 'fake-1' } };
        window.socket.listeners('game_state').forEach(f => { try { f(fake); } catch (e) { console.log('listener', e.message); } });
        return others;
      });
      console.log('Picker-Kandidaten:', JSON.stringify(info));
      await sleep(600);
      console.log('Markierte Einträge:', await page.locator('.st-picker-viewed').count(), 'Plaketten:', await page.locator('.st-picker-badge').count());
      await page.screenshot({ path: out.replace('.png', '-picker.png') });
      // Mit dem Zeiger über einem anderen Eintrag wechselt das Hauptfeld und die Markierung wandert mit
      const btns = page.locator('.first-choice-panel button.btn');
      const n = await btns.count();
      if (n >= 2) { await btns.nth(n - 1).hover(); await sleep(500); console.log('Nach Hover — markiert:', await page.locator('.st-picker-viewed').count(), '| Text:', (await page.locator('.st-picker-viewed').first().innerText().catch(() => '')).replace(/\n/g, ' ')); await page.screenshot({ path: out.replace('.png', '-picker2.png') }); }
      await browser.close(); srv.child.kill();
      process.exit(0);
    }
    // Spielzug: erst auf den eigenen Zug warten (bereit leuchten nur die Akteure des Spielers am Zug), dann Hero anklicken, gegnerischen Hero wählen.
    await page.waitForSelector('.st-turn-yours', { timeout: 90000 });
    await sleep(500);
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
    // Die Bots sind dran: Bildfolge — die Anzeige folgt dem Geschehen, der Handelnde leuchtet, danach ergraut er
    for (let k = 0; k < (parseInt(process.env.ST_SEQ || '0', 10)); k++) {
      await page.screenshot({ path: out.replace('.png', '-seq-' + String(k).padStart(2, '0') + '.png') });
      console.log('seq', k, 'acting:', await page.locator('.st-actor-acting').count(), 'exhausted:', await page.locator('.st-actor-exhausted').count(), '|', (await page.innerText('.st-turn-panel')).replace(/\n/g, ' ').slice(0, 90));
      await sleep(500);
    }
    console.log('exhausted:', await page.locator('.st-actor-exhausted').count());
    console.log('Fehler:', errors.length);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(process.exitCode || 0);
})();
