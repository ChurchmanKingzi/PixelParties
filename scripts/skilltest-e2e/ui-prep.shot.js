'use strict';
// Visueller Test der Vorbereitungs-Oberfläche: Server starten, als Gast einloggen,
// Skill-Test-Raum anlegen, CPUs hinzufügen, starten, Screenshot der Basis.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-prep.shot.js /pfad/shot.png
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount } = require('./lib');
const fs = require('fs');
const path = require('path');
// Der Client lädt React von unpkg; ohne Internet liefern wir lokale Kopien aus (npm i react@18 react-dom@18 neben socket.io-client).
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
(async () => {
  const out = process.argv[2] || '/tmp/st-prep.png';
  const acc = await createAccount('UiTester' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const r = await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (!r.ok()) throw new Error('login failed ' + r.status());
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[browser ' + m.type() + ']', m.text().slice(0, 300)); });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto(BASE + '/');
    await sleep(4000);
    await page.screenshot({ path: out.replace('.png', '-start.png') });
    console.log('body:', (await page.innerText('body')).slice(0, 300).replace(/\n/g, ' | '));
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.click('text=PLAY ONLINE');
    await page.waitForSelector('text=+ CREATE GAME');
    await page.click('text=+ CREATE GAME');
    await page.click('text=SKILL TEST');
    await page.screenshot({ path: out.replace('.png', '-create.png') });
    await page.click('.modal button:has-text("CREATE")', { timeout: 5000 }).catch(async () => { await page.click('text=CREATE >> nth=-1'); });
    await page.waitForSelector('text=SKILL TEST LOBBY');
    for (let i = 0; i < (+process.env.CPUS || 7); i++) { await page.click("text=ADD CPU"); await sleep(150); }
    await page.screenshot({ path: out.replace('.png', '-lobby.png') });
    await page.click('button:has-text("START (")');
    await sleep(2500);
    await page.screenshot({ path: out.replace('.png', '-afterstart.png') });
    console.log('after start body:', (await page.innerText('body')).slice(0, 200).replace(/\n/g, ' | '));
    await page.waitForSelector('.st-base', { timeout: 15000 });
    await sleep(1200);
    await page.screenshot({ path: out });
    console.log('Screenshots:', out);
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  srv.child.kill();
  process.exit(process.exitCode || 0);
})();
