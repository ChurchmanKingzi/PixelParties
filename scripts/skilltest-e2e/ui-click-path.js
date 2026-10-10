'use strict';
// UI-Test: Im KLICK-PFAD einer Handkarte (Ausruestung/Creature per Klick platzieren) sind ALLE On-Klick-Trigger auf dem Brett tot
// (Als Befund 10.10.: Klick auf ein Race Boat in der Hand, Klick auf Pinta — und ihr Effekt loeste aus).
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-click-path.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));

(async () => {
  const acc = await createAccount('UiClk' + Date.now().toString(36));
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1652, height: 760 } });
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
    // Held 0: Burning Skeleton (aktiver Creature-Effekt) in Zone 0; Held 1 traegt schon ein Race Boat; Held 2 ist frei. Hand: Frog Race Boat.
    await page.evaluate(() => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      window.__emits = []; const orig = window.socket.emit.bind(window.socket);
      window.socket.emit = (ev, ...a) => { window.__emits.push(ev); return orig(ev, ...a); };
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const seite = (off, mine) => {
        const sup = [0, 1, 2].map(() => [[], [], []]);
        if (mine) { sup[0][0] = ['Burning Skeleton']; sup[1][2] = ['Snake Race Boat']; } else sup[0][0] = [kre[0]];
        return { heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 900, maxHp: 900, atk: 10, baseAtk: 10, statuses: {} })),
          abilityZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []], supportZones: sup, mainDeck: kre.slice(), potionDeck: [], sideDeck: [],
          discardPile: [], deletedPile: [], gold: 30, islandZoneCount: [0, 0, 0], permanents: [] };
      };
      window.socket.emit('start_puzzle', { players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0], hand: ['Frog Race Boat'], oppHand: [], playerDebuffs: [[], []] });
    });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const aktiv = async () => page.evaluate(() => ({
      glow: document.querySelectorAll('.zone-creature-activatable').length,
      ziel: document.querySelectorAll('[data-hero-zone][data-hero-owner="me"].board-zone-play-target').length,
      emits: window.__emits.filter(e => /^activate_|^play_|^use_/.test(e)),
      targeting: !!(window.__gs && (window.__gs.potionTargeting || window.__gs.effectPrompt)),
    }));
    const vorher = await aktiv();
    check('Ausgangslage: der Skeleton ist aktivierbar (leuchtet)', vorher.glow >= 1, vorher);

    // Klick-Pfad: die Handkarte anklicken (kein Ziehen)
    await page.evaluate(() => { window.__emits.length = 0; });
    await page.locator('.game-hand-me [data-hand-idx="0"]').first().click();
    await sleep(600);
    const imPfad = await aktiv();
    check('Klick-Pfad offen: die freien Helden sind Ziele (2 — der Held mit Race Boat nicht)', imPfad.ziel === 2, imPfad);
    check('…und nichts auf dem Brett leuchtet mehr als aktivierbar', imPfad.glow === 0, imPfad);

    // der Klick auf den Skeleton darf seinen Effekt NICHT ausloesen
    await page.locator('[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="0"]').click();
    await sleep(900);
    const nachSkeleton = await aktiv();
    check('Klick auf die Creature im Klick-Pfad: kein Effekt, keine Zielabfrage', !nachSkeleton.emits.includes('activate_creature_effect') && !nachSkeleton.targeting, nachSkeleton);

    // der Klick auf den Held MIT Race Boat (ungueltiges Ziel) tut ebenfalls nichts
    await page.locator('[data-hero-zone][data-hero-owner="me"][data-hero-idx="1"]').click();
    await sleep(900);
    const nachHeld = await aktiv();
    check('Klick auf den Helden mit Race Boat: nichts passiert (kein Equip, kein Effekt)', !nachHeld.emits.some(e => e === 'play_artifact' || e.startsWith('activate_')), nachHeld);

    // Gegenprobe: ein gueltiges Ziel nimmt die Ausruestung an
    await page.locator('[data-hero-zone][data-hero-owner="me"][data-hero-idx="2"]').click();
    await sleep(1500);
    const equipt = await page.evaluate(() => (window.__gs.players[window.__gs.myIndex].supportZones[2] || []).flat().includes('Frog Race Boat'));
    check('Gegenprobe: ein gültiges Ziel (Held 2) nimmt das Race Boat an', equipt === true);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
