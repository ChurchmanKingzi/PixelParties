'use strict';
// UI-Test (W64a): Klick-Beschwörung mit Alice — der Slot-Picker bietet die geteilte Zone UND ALLE freien Zonen an; der Spieler darf eine FREIE Zone wählen,
//   ohne dass etwas erzwungen wird (Al, 23.10.2026: „Der Spieler darf auch auf eine freie Zone klicken und so den Alice-Effekt quasi 'verschwenden'").
//   Szene: Alice = Held 0, Zone 0 = [Cute Bunny], Zonen 1 und 2 frei, Hand = [Cute Bunny]; Klick auf die Handkarte → Picker.
//   Szene 'frei': Klick auf die freie Zone 2 → die Kopie liegt in Zone 2, Zone 0 bleibt bei einer Karte.  Szene 'geteilt': Klick auf Zone 0 → Stapel ×2.
//   NODE_PATH=/tmp/claude-0/sio/node_modules:/opt/node-tools/node_modules node scripts/skilltest-e2e/ui-slot-picker-alice.js
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const sel = (s) => `[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="${s}"]`;

async function szene(browser, name) {
  const acc = await createAccount('UiSp' + name + Date.now().toString(36));
  const srv = await startServer();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1652, height: 900 } });
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
    await page.click('button:has-text("ATTEMPT PUZZLE")');
    await sleep(800);
    await page.evaluate(() => {
      const C = window.CARDS_BY_NAME, SL = 'Cute Bunny';
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      window.__emits = []; const orig = window.socket.emit.bind(window.socket);
      window.socket.emit = (ev, ...a) => { window.__emits.push({ ev, a }); return orig(ev, ...a); };
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Alice, the Transfer|Pinta/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && n !== SL).slice(0, 12);
      const seite = (mine) => {
        const names = mine ? ['Alice, the Transfer Student', helden[1], helden[2]] : [helden[3], helden[4], helden[5]];
        const sup = [0, 1, 2].map(h => [0, 1, 2].map(z => [kre[(h * 3 + z) % kre.length]]));
        if (mine) { sup[0][0] = [SL]; sup[0][1] = []; sup[0][2] = []; }
        return { heroes: names.map(n => ({ name: n, hp: 900, maxHp: 900, atk: 10, baseAtk: 10, statuses: {} })),
          abilityZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []], supportZones: sup,
          mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 30, islandZoneCount: [0, 0, 0], permanents: [] };
      };
      window.socket.emit('start_puzzle', { players: [seite(true), seite(false)], areaZones: [[], []], doomCounters: [0, 0], hand: [SL], oppHand: [], playerDebuffs: [[], []] });
    });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(800);
    await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs && window.__gs.roomId, targetPhase: 3 }));
    await sleep(1500);
    await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs && window.__gs.roomId, targetPhase: 3 }));
    await sleep(1500);
    await page.locator('.game-hand-me [data-hand-idx="0"]').first().click();
    await sleep(600);
    const picker = await page.evaluate(() => [0, 1, 2].map(s => !!document.querySelector(`[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="${s}"].zone-bounce-place-target`)));
    const zielKlick = name === 'frei' ? 2 : 0;
    await page.locator(sel(zielKlick)).first().click();
    await sleep(2500);
    const zonen = await page.evaluate(() => [0, 1, 2].map(s => {
      const z = document.querySelector(`[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="${s}"]`);
      return { imgs: z ? z.querySelectorAll('img').length : -1, badge: z ? [...z.querySelectorAll('.head-counter-num')].map(e => e.textContent.trim()).join(',') : '' };
    }));
    const server = await page.evaluate(() => { const g = window.__gs; const me = g && g.players && g.players[g.myIdx != null ? g.myIdx : 0]; return me ? me.supportZones[0].map(z => z.length) : null; });
    const emits = await page.evaluate(() => window.__emits.filter(e => e.ev === 'play_creature').map(e => e.a[0]));
    return { picker, zonen, server, emits };
  } finally { srv.child.kill(); await sleep(600); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    console.log('Szene frei: Klick auf eine FREIE Zone (Zone 2) trotz geteilter Zone (Zone 0)');
    const f = await szene(browser, 'frei');
    check('der Slot-Picker markiert die geteilte Zone 0 UND beide freien Zonen 1 und 2', f.picker.join() === 'true,true,true', f.picker);
    check('es wurde genau die geklickte Zone 2 gesendet', f.emits.length === 1 && f.emits[0].zoneSlot === 2 && f.emits[0].heroIdx === 0, f.emits);
    check('Zone 2 trägt die neue Kopie, Zone 0 bleibt bei EINER Karte (kein Zwang zur geteilten Zone)', f.server && f.server.join() === '1,0,1', f.server);
    console.log('Szene geteilt: Klick auf die geteilte Zone (Zone 0)');
    const g = await szene(browser, 'geteilt');
    check('der Slot-Picker markiert alle drei Zonen', g.picker.join() === 'true,true,true', g.picker);
    check('es wurde Zone 0 gesendet, der Stapel wächst auf ×2, die freien Zonen bleiben leer', g.emits.length === 1 && g.emits[0].zoneSlot === 0 && g.server && g.server.join() === '2,0,0', { emits: g.emits, server: g.server });
    check('das Stapel-Abzeichen zeigt ×2', /2/.test((g.zonen[0] || {}).badge || ''), g.zonen);
  } finally { await browser.close(); }
  process.exit(finish() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
