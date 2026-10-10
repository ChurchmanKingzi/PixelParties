'use strict';
// UI-Test: Brett mit Flying-Island-Zonen (Puzzle-Spiel mit `islandZoneCount`).
//   1. Die Sprites der animierten Helden stehen AUF den Heldenzonen (`lageInEbene` rechnet die Mittelung
//      `translateX(--center-offset)` der Seiten mit), und die unverzerrte Perspektivachse liegt auf dem Mittelhelden.
//   2. Das Brett waechst nach LINKS: mit Inseln endet der Inhalt vor der Tooltip-Spalte (`--tt-col-w`, rechtsbuendig),
//      der Mittelheld rueckt dafuer aus der Fenstermitte. Ohne Inseln bleibt alles mittig wie bisher.
//   3. Der Bereich unter dem Tooltip ist fuer das Feld GESPERRT (`--tt-reserve`): der Brettkasten endet an der Tooltip-Spalte und
//      scrollt frueher horizontal, statt Zonen abzuschneiden oder unter den Tooltip zu legen.
//   4. Die Figuren liegen ueber der Phasenleiste; faehrt der Zeiger auf die Leiste, ziehen sich die darueber ragenden ein.
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

/** Ein Puzzle mit `islMe` / `islOpp` Inselzonen je Held starten und warten, bis das Brett steht. */
async function starteBrett(page, islMe, islOpp) {
  {
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
  }
}

/** Ein Puzzle mit `islMe` / `islOpp` Inselzonen je Held starten und das Brett vermessen. */
async function vermiss(browser, viewport, islMe, islOpp) {
  const { ctx, page } = await neueSeite(browser, viewport);
  try {
    await starteBrett(page, islMe, islOpp);
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
      const br = bc.getBoundingClientRect();
      return {
        sprites: sprites.length, heroes: zonen.length, maxAbstand: Math.max(...abst),
        achse: clip.getBoundingClientRect().left + ax, heldMitte: rd(mid).x,
        ttW: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tt-col-w')) || 0,
        vw: window.innerWidth, rechts: zr, scroll: bc.classList.contains('can-scroll'),
        kastenRechts: br.right, kastenLinks: br.left,
        zonenLinks: Math.min(...[...document.querySelectorAll('.board-plane .board-zone')].map(z => z.getBoundingClientRect().left)),
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

    console.log('Tooltip-Bereich gesperrt (1652 breit, Chat eingeklappt)');
    check('der Brettkasten endet an der Tooltip-Spalte (nicht darunter)', a.kastenRechts <= a.vw - a.ttW + 1, [a.kastenRechts, a.vw - a.ttW]);
    check('…ohne Inseln liegt alles darin (kein Scrollmodus)', a.scroll === false && a.rechts <= a.kastenRechts, [a.scroll, a.rechts, a.kastenRechts]);

    console.log('Schmales Fenster (1280): ein gewöhnliches Brett passt, mit Inseln scrollt der schmalere Kasten');
    const n1 = await vermiss(browser, { width: 1280, height: 720 }, [0, 0, 0], [0, 0, 0]);
    check('Kasten endet an der Tooltip-Spalte', n1.kastenRechts <= n1.vw - n1.ttW + 1, [n1.kastenRechts, n1.vw - n1.ttW]);
    check('ein Brett ohne Inseln passt in den schmaleren Kasten: kein Scrollmodus, nichts abgeschnitten', n1.scroll === false && n1.rechts <= n1.kastenRechts + 1 && n1.zonenLinks >= n1.kastenLinks - 1, n1);
    check('Figuren auf den Zonen (≤ 3 px)', n1.maxAbstand <= 3, n1.maxAbstand);
    const n2 = await vermiss(browser, { width: 1280, height: 720 }, [0, 1, 2], [0, 1, 1]);
    check('mit Inseln passt der Inhalt nicht mehr: der Kasten wird früh horizontal scrollbar (nichts mehr abgeschnitten)', n2.scroll === true, n2);
    check('…die Figuren stehen auch im Scrollmodus auf den Zonen (≤ 3 px)', n2.maxAbstand <= 3, n2.maxAbstand);

    console.log('Eine einzelne Insel am rechten Helden (passt noch fast)');
    const c = await vermiss(browser, vp, [0, 0, 1], [0, 0, 0]);
    check('Figuren auf den Zonen (≤ 3 px)', c.maxAbstand <= 3, c.maxAbstand);
    check('Inhalt vor der Tooltip-Spalte', c.rechts <= c.vw - c.ttW + 1, [c.rechts, c.vw - c.ttW]);
    check('Perspektivachse auf dem Mittelhelden (±2 px)', Math.abs(c.achse - c.heldMitte) <= 2, [c.achse, c.heldMitte]);

    console.log('Phasenleiste: Figuren liegen darüber, Hover auf der Leiste fährt sie ein');
    const { ctx, page } = await neueSeite(browser, { width: 1280, height: 720 });
    try {
      await starteBrett(page, [0, 0, 0], [0, 0, 0]);
      const lage = () => page.evaluate(() => {
        const bar = document.querySelector('.phase-column'); const b = bar.getBoundingClientRect();
        const z = (e) => Math.round(parseFloat(getComputedStyle(e).zIndex) || 0);
        const sprites = [...document.querySelectorAll('.hero-idle-platz')].map(p => {
          const s = p.querySelector('.hero-idle-steher').getBoundingClientRect();
          return { ueber: s.right > b.left && s.left < b.right && s.bottom > b.top && s.top < b.bottom, weg: p.classList.contains('hero-idle-weg') };
        });
        return { barZ: z(bar), spriteZ: z(document.querySelector('.hero-sprite-ebene')), ragen: sprites.filter(x => x.ueber).length,
          eingefahrenUeber: sprites.filter(x => x.ueber && x.weg).length, eingefahrenAndere: sprites.filter(x => !x.ueber && x.weg).length };
      });
      const v = await lage();
      check('die Sprite-Ebene liegt über der Phasenleiste (z-index)', v.spriteZ > v.barZ, [v.spriteZ, v.barZ]);
      check('mindestens eine Figur ragt über die Leiste (Testaufbau)', v.ragen >= 1, v);
      check('ohne Hover bleiben sie ausgefahren', v.eingefahrenUeber === 0, v);
      const ziel = await page.evaluate(() => { const r = document.querySelector('.phase-column').getBoundingClientRect(); return [r.left + 30, r.top + r.height / 2]; });
      await page.mouse.move(ziel[0], ziel[1]); await sleep(900);
      const h = await lage();
      check('Hover auf der Leiste: ALLE darüber ragenden Figuren fahren ein', h.eingefahrenUeber === h.ragen && h.ragen >= 1, h);
      check('…andere Figuren bleiben stehen', h.eingefahrenAndere === 0, h);
      await page.mouse.move(900, 90); await sleep(900);
      const w = await lage();
      check('Zeiger weg: sie fahren wieder aus', w.eingefahrenUeber === 0, w);
    } finally { await ctx.close(); }
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
