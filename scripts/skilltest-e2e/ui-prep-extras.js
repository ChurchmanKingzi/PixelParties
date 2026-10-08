'use strict';
// Recycler spuckt einen Hero samt mitgebrachter Karten aus: ALLE Karten fliegen nacheinander aus dem Recycler zur Hand
// (keine erscheint vorher in der Hand). Der Server-Zustand wird dafür im Browser nachgestellt (ein Auswurf lässt sich nicht erzwingen).
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-prep-extras.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };
(async () => {
  const acc = await createAccount('UiEx' + Date.now().toString(36));
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
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.click('text=PLAY ONLINE');
    await page.click('text=+ CREATE GAME');
    await page.click('button:has-text("SKILL TEST")');
    await page.click('.modal button:has-text("CREATE")');
    await page.waitForSelector('text=SKILL TEST LOBBY');
    for (let i = 0; i < 3; i++) { await page.click('text=ADD CPU'); await sleep(150); }
    await page.evaluate(() => { window.__last = null; socket.on('st_prep_state', (st) => { window.__last = st; }); });
    await page.click('button:has-text("START (")');
    await page.waitForSelector('.st-base');
    await sleep(800);

    // letzten echten Zustand merken und daraus einen Auswurf mit zwei Zusatzkarten bauen
    const hand0 = await page.evaluate(() => [...document.querySelectorAll('.st-hand .pz-hand-card')].map(e => e.getAttribute('data-st-card')));
    check('Hand vorhanden', hand0.length >= 4, hand0);
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__last)); i++) await sleep(100);
    check('Zustand des Servers abgegriffen', !!(await page.evaluate(() => window.__last)));

    // Hero „Cute Cat“ kommt mit „Cute Dog“ und einem weiteren „Cute Cat“; ein altes „Cute Cat“ liegt schon in der Hand und muss sichtbar bleiben
    await page.evaluate((eaten) => {
      const st = JSON.parse(JSON.stringify(window.__last));
      st.me.hand = [...st.me.hand.slice(1), 'Cute Cat', 'Cute Cat', 'Cute Dog', 'Cute Cat'];
      st.event = { type: 'recycle', card: eaten, ejected: 'Cute Cat', extras: ['Cute Dog', 'Cute Cat'] };
      st.serverNow = Date.now();
      socket.listeners('st_prep_state').forEach(f => f(st));
    }, hand0[0]);

    const sample = () => page.evaluate(() => {
      const cards = [...document.querySelectorAll('.st-hand .pz-hand-card')];
      const hid = cards.filter(c => c.style.visibility === 'hidden').map(c => c.getAttribute('data-st-card'));
      return { cats: hid.filter(n => n === 'Cute Cat').length, dogs: hid.filter(n => n === 'Cute Dog').length, others: hid.filter(n => n !== 'Cute Cat' && n !== 'Cute Dog').length, flying: document.querySelectorAll('.st-fly-card').length, total: cards.length };
    });
    const t0 = Date.now();
    await sleep(100);
    const s100 = await sample();
    check('direkt nach dem Auswurf sind alle drei Karten verborgen (2 × Cat, 1 × Dog), die alte Cat bleibt sichtbar', s100.cats === 2 && s100.dogs === 1 && s100.others === 0, s100);
    await sleep(Math.max(0, 1750 - (Date.now() - t0)));
    const s1750 = await sample();
    check('nach dem ersten Flug (≈ 1,6 s): der Hero ist gelandet, Dog und die zweite Cat sind noch unterwegs', s1750.cats === 1 && s1750.dogs === 1 && s1750.others === 0, s1750);
    await sleep(Math.max(0, 2700 - (Date.now() - t0)));
    const s2700 = await sample();
    check('nach allen Flügen sind alle Karten sichtbar, nichts fliegt mehr', s2700.cats === 0 && s2700.dogs === 0 && s2700.others === 0 && s2700.flying === 0, s2700);
  } catch (e) { console.error(e); fails++; }
  await browser.close();
  srv.child.kill();
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Recycler-Extras-Test grün');
  process.exit(fails ? 1 : 0);
})();
