'use strict';
// UI-Test: Puzzle-Editor, Karten in einem Stapel (Deck, Ablage …) per Drag & Drop UMSORTIEREN klingt (Als Befund 10.10.: „Wenn man im Puzzle-Editor Karten
// im Deck per Drag/Drop umsortiert, gibt es kein Geräusch!"). Der Klang ist derselbe wie beim Umsortieren der Hand (`playCardDragSFX('reorder')`: `draw`
// mit Tonhöhe 1,12). Geprüft wird in ECHTEM Chromium: drei Karten ins Deck ziehen, Stapel öffnen, eine Karte über eine andere ziehen — Reihenfolge ändert
// sich UND der Umsortier-Klang kommt; dasselbe in der Ablage.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-puzzle-pile-sounds.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

(async () => {
  const acc = await createAccount('UiPz' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1652, height: 900 } });
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react', 'umd', 'react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom', 'umd', 'react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', (e) => { fehler.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME && window.playSFX, null, { timeout: 20000 });
    await page.click('button:has-text("CREATE PUZZLE")');
    await page.waitForSelector('.pz-search-card', { timeout: 30000 });
    await sleep(800);
    // Klänge mitschreiben (der echte Klang spielt weiter); verzögerte Wiederaufrufe (`delay: 0`) zählen nicht.
    await page.evaluate(() => {
      window.__sfx = [];
      const orig = window.playSFX;
      window.playSFX = (n, o) => { if (!(o && o.delay === 0)) window.__sfx.push({ n, rate: o && o.rate }); return orig && orig(n, o); };
    });
    const namen = await page.evaluate(() => [...document.querySelectorAll('.pz-search-card')].slice(0, 3).map(e => e.getAttribute('data-card-name')));
    check('der Editor zeigt Karten zum Ziehen', namen.length === 3 && namen.every(Boolean), namen);

    const stapelInhalt = (zielMarke) => page.evaluate((m) => {
      const z = document.querySelector(`[data-pz-ziel="${m}"]`);
      const l = z && z.querySelector('.board-card-label');
      return l ? parseInt(l.textContent) : 0;
    }, zielMarke);
    const inStapel = async (marke, ziel) => {
      for (const n of namen) {
        await page.locator(`.pz-search-card[data-card-name="${n.replace(/"/g, '\\"')}"]`).dragTo(page.locator(`[data-pz-ziel="${marke}-0"]`));
        await sleep(250);
      }
      return stapelInhalt(`${marke}-0`);
    };
    const reihenfolge = () => page.evaluate(() => [...document.querySelectorAll('.pz-pile-card')].map(e => {
      const i = e.querySelector('img'); return i ? i.getAttribute('src') : e.textContent.trim().slice(0, 30);
    }));
    const umsortieren = async () => {
      const vorher = await reihenfolge();
      await page.evaluate(() => { window.__sfx = []; });
      await page.locator('.pz-pile-card').nth(0).dragTo(page.locator('.pz-pile-card').nth(2));
      await sleep(500);
      const klaenge = await page.evaluate(() => window.__sfx.slice());
      const nachher = await reihenfolge();
      return { vorher, nachher, klaenge };
    };

    for (const [marke, bez] of [['deck', 'Deck'], ['discard', 'Ablage']]) {
      const n = await inStapel(marke);
      check(`${bez}: drei Karten liegen im Stapel`, n === 3, n);
      await page.click(`[data-pz-ziel="${marke}-0"]`);
      await page.waitForSelector('.pz-pile-card', { timeout: 5000 });
      await sleep(300);
      const r = await umsortieren();
      check(`${bez}: das Umsortieren per Drag & Drop ändert die Reihenfolge`, JSON.stringify(r.vorher) !== JSON.stringify(r.nachher), r);
      check(`${bez}: …und es KLINGT (Umsortier-Klang: \`draw\`, Tonhöhe 1,12 wie in der Hand)`, r.klaenge.some(k => k.n === 'draw' && k.rate === 1.12), r.klaenge);
      await page.keyboard.press('Escape');
      await sleep(300);
    }
    check('keine JS-Fehler im Browser', fehler.length === 0, fehler);
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
