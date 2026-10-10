'use strict';
// UI-Test: Brett mit Flying-Island-Zonen (Puzzle-Spiel mit `islandZoneCount`).
//   1. Die Sprites der animierten Helden stehen AUF den Heldenzonen (`lageInEbene` rechnet die Mittelung
//      `translateX(--center-offset)` der Seiten mit), und die unverzerrte Perspektivachse liegt auf dem Mittelhelden.
//   2. Das Brett waechst nach LINKS: mit Inseln endet der Inhalt vor der Tooltip-Spalte (`--tt-col-w`, rechtsbuendig),
//      der Mittelheld rueckt dafuer aus der Fenstermitte. Ohne Inseln bleibt alles mittig wie bisher.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-board-island.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

async function neueSeite(browser, viewport) {
  const acc = await createAccount('UiIsl' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport });
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
  await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
  await page.click('button:has-text("ATTEMPT PUZZLE")');          // die Puzzle-Bibliothek haengt den `game_state`-Hoerer ein
  await sleep(800);
  return { ctx, page };
}

/** Ein Puzzle mit `islMe` / `islOpp` Inselzonen je Held starten und das Brett vermessen. */
async function vermiss(browser, viewport, islMe, islOpp) {
  const { ctx, page } = await neueSeite(browser, viewport);
  try {
    await page.evaluate(([me, opp]) => {
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl/.test(n));
      const kreaturen = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const seite = (off, isl) => {
        const hs = [0, 1, 2].map(i => { const n = helden[off + i]; return { name: n, hp: C[n].hp || 400, maxHp: C[n].hp || 400, atk: C[n].atk || 0, baseAtk: C[n].atk || 0, statuses: {} }; });
        const sup = [0, 1, 2].map(i => { const z = [[], [], []]; for (let k = 0; k < isl[i]; k++) z.push([]); return z; });
        sup.forEach((z, hi) => { z[0] = [kreaturen[hi]]; if (z.length > 3) z[3] = [kreaturen[3 + hi]]; });
        return { heroes: hs, abilityZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []], supportZones: sup,
          mainDeck: kreaturen.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: isl.slice(), permanents: [] };
      };
      window.socket.emit('start_puzzle', { players: [seite(0, me), seite(3, opp)], areaZones: [[], []], doomCounters: [0, 0],
        hand: kreaturen.slice(0, 5), oppHand: kreaturen.slice(5, 9), playerDebuffs: [[], []] });
    }, [islMe, islOpp]);
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(3000);
    const r = await page.evaluate(() => {
      const rd = (e) => { const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; };
      const zonen = [...document.querySelectorAll('[data-hero-zone]')].map(rd);
      const sprites = [...document.querySelectorAll('.hero-idle-platz')].map(rd);
      const abst = zonen.map(z => Math.min(...sprites.map(p => Math.hypot(p.x - z.x, p.y - z.y))));
      const bc = document.querySelector('.board-center');
      const clip = document.querySelector('.board-plane-clip');
      const mid = document.querySelector('[data-hero-zone][data-hero-owner="me"][data-hero-idx="1"]');
      const ax = parseFloat(bc.style.getPropertyValue('--board-anchor-x'));
      const zr = Math.max(...[...document.querySelectorAll('.board-plane .board-zone')].map(z => z.getBoundingClientRect().right));
      return {
        sprites: sprites.length, heroes: zonen.length, maxAbstand: Math.max(...abst),
        achse: clip.getBoundingClientRect().left + ax, heldMitte: rd(mid).x,
        ttW: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tt-col-w')) || 0,
        vw: window.innerWidth, rechts: zr, scroll: bc.classList.contains('can-scroll'),
      };
    });
    return r;
  } finally { await ctx.close(); }
}

(async () => {
  const outDir = process.argv[2] || '/tmp';
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const vp = { width: 1652, height: 636 };

    console.log('Ohne Inseln');
    const a = await vermiss(browser, vp, [0, 0, 0], [0, 0, 0]);
    check('alle sechs Helden haben ihre Figur (Sprites geladen)', a.sprites >= 6 && a.heroes === 6, [a.sprites, a.heroes]);
    check('Figuren stehen auf den Heldenzonen (≤ 3 px)', a.maxAbstand <= 3, a.maxAbstand);
    check('Brett mittig: Mittelheld in der Fenstermitte (±2 px)', Math.abs(a.heldMitte - a.vw / 2) <= 2, [a.heldMitte, a.vw / 2]);
    check('Perspektivachse liegt auf dem Mittelhelden (±2 px)', Math.abs(a.achse - a.heldMitte) <= 2, [a.achse, a.heldMitte]);

    console.log('Mit Inseln (eigene Seite 0/1/2, Gegner 0/1/1)');
    const b = await vermiss(browser, vp, [0, 1, 2], [0, 1, 1]);
    check('Figuren stehen auch bei verschobenem Brett auf den Heldenzonen (≤ 3 px)', b.maxAbstand <= 3, b.maxAbstand);
    check('Perspektivachse liegt auf dem Mittelhelden (±2 px)', Math.abs(b.achse - b.heldMitte) <= 2, [b.achse, b.heldMitte]);
    check('kein Scroll-Modus bei zwei Inseln', b.scroll === false);
    check('Tooltip-Spalte gemessen', b.ttW > 100, b.ttW);
    check('der Inhalt endet VOR der Tooltip-Spalte (nichts liegt unter dem Hover-Tooltip)', b.rechts <= b.vw - b.ttW + 1, [b.rechts, b.vw - b.ttW]);
    check('das Brett wuchs nach LINKS: der Mittelheld liegt links der Fenstermitte', b.heldMitte < b.vw / 2 - 20, [b.heldMitte, b.vw / 2]);

    console.log('Eine einzelne Insel am rechten Helden (passt noch fast)');
    const c = await vermiss(browser, vp, [0, 0, 1], [0, 0, 0]);
    check('Figuren auf den Zonen (≤ 3 px)', c.maxAbstand <= 3, c.maxAbstand);
    check('Inhalt vor der Tooltip-Spalte', c.rechts <= c.vw - c.ttW + 1, [c.rechts, c.vw - c.ttW]);
    check('Perspektivachse auf dem Mittelhelden (±2 px)', Math.abs(c.achse - c.heldMitte) <= 2, [c.achse, c.heldMitte]);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
