'use strict';
// UI-Test: Big Oopsie im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 (Destruction Magic 1) wirkt Big Oopsie; der Gegner (CPU) wählt ein Ziel auf SEINER Seite, das 150 Schaden nimmt.
//   • Lauf A (Action Phase, gewöhnlicher Held): die Pixelart-Pilzwolke (Canvas) sitzt auf dem gewählten Ziel, ihre drei Klänge starten
//     (`heavy_impact`, `elem_fire`, `damage`), genau ein Held des Gegners hat 150 HP verloren, Big Oopsie liegt in der Ablage, das
//     Aktionslog nennt den Zug; ein zweites Big Oopsie desselben Zuges wird abgelehnt („only 1 per turn“).
//   • Lauf B (MAIN Phase, Held 0 ist ein Ascended Hero): spielbar — die Zusatzaktion.
//   • Lauf C (MAIN Phase, gewöhnlicher Held): vom Server abgelehnt — die Karte bleibt auf der Hand.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-big-oopsie.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

/** Ein Puzzle. `phase` 3 = Action Phase, 2 = Main Phase; `ascended` = Held 0 ist ein Ascended Hero; `zweites` = zwei Big Oopsie auf der Hand. */
async function spiele(browser, { phase, ascended, zweites, name }) {
  const acc = await createAccount('UiBo' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 760 } });
  try {
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom.production.min.js')) }));
    }
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__snd = [];
      const ABSN = window.AudioBufferSourceNode;
      const orig = ABSN.prototype.start;
      ABSN.prototype.start = function (...a) {
        try { window.__snd.push({ t: Math.round(performance.now()), dur: this.buffer ? +this.buffer.duration.toFixed(3) : 0 }); } catch { /* egal */ }
        return orig.apply(this, a);
      };
    });
    const fehler = [];
    page.on('pageerror', (e) => { fehler.push(e.message); console.log('[pageerror]', e.message); });
    await page.goto(BASE + '/');
    await page.waitForSelector('text=PLAY ONLINE', { timeout: 20000 });
    await page.waitForFunction(() => window.socket && window.CARDS_BY_NAME, null, { timeout: 20000 });
    await page.click('button:has-text("ATTEMPT PUZZLE")');          // die Puzzle-Bibliothek haengt den `game_state`-Hoerer ein
    await sleep(800);
    const dauern = await page.evaluate(async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const out = {};
      for (const n of ['heavy_impact', 'elem_fire', 'damage']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate(({ ascended, zweites }) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
      const asc = Object.keys(C).find(n => C[n].cardType === 'Ascended Hero' && n === '???, the Throne Robber') || Object.keys(C).find(n => C[n].cardType === 'Ascended Hero');
      const deck = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, eigene) => ({
        heroes: [0, 1, 2].map(i => { const nm = (eigene && ascended && i === 0) ? asc : helden[off + i]; return { name: nm, hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} }; }),
        abilityZones: [eigene ? [['Destruction Magic'], [], []] : leer(), leer(), leer()],
        surpriseZones: [[], [], []], supportZones: [leer(), leer(), leer()],
        mainDeck: deck.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0],
        hand: zweites ? ['Big Oopsie', 'Big Oopsie'] : ['Big Oopsie'], oppHand: [], playerDebuffs: [[], []],
      });
    }, { ascended, zweites });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const opp = 1 - my;
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
    await page.evaluate((phase) => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: phase }), phase);
    await sleep(1200);
    const hpVorher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    await page.evaluate(() => window.__snd.length = 0);
    await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Big Oopsie', handIndex: 0, heroIdx: 0 }));

    const r = { dauern, my, opp, fehler, name, hpVorher };
    // Pixelart-Canvas der Wolke
    let spur = null;
    for (let k = 0; k < 50 && !(spur && spur.bemalt > 0); k++) {
      await sleep(80);
      spur = await page.evaluate(() => {
        const cv = document.querySelector('[data-pp-px="aus"] canvas');
        if (!cv) return null;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return { bemalt: n };
      });
    }
    r.spur = spur;
    if (outDir && spur) { await sleep(500); try { await page.screenshot({ path: path.join(outDir, 'big-oopsie-' + name + '.png') }); } catch { /* egal */ } }
    await sleep(3000);
    r.klaenge = await page.evaluate(() => window.__snd.slice());
    r.hpNachher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    r.eigeneHp = await page.evaluate((my) => window.__gs.players[my].heroes.map(h => h.hp), my);
    r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
    r.ablage = await page.evaluate((my) => window.__gs.players[my].discardPile, my);
    r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status')].map(e => e.textContent).filter(t => /Big Oopsie/.test(t)));
    if (zweites) {
      // zweites Big Oopsie im selben Zug
      await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Big Oopsie', handIndex: 0, heroIdx: 0 }));
      await sleep(2500);
      r.handNachZweitem = await page.evaluate((my) => window.__gs.players[my].hand, my);
      r.hpNachZweitem = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    }
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);
const verloren = (vor, nach) => vor.map((v, i) => v - nach[i]);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: Action Phase, gewöhnlicher Held');
    const a = await spiele(browser, { phase: 3, ascended: false, zweites: true, name: 'A' });
    check('die Pixelart-Pilzwolke (Canvas) ist bemalt', !!a.spur && a.spur.bemalt > 40, a.spur);
    check('alle drei Klänge starten: Schlag (`heavy_impact`), Feuer (`elem_fire`), Schadens-Nachschlag (`damage`)', !!a.klaenge && hat(a.klaenge, a.dauern.heavy_impact) && hat(a.klaenge, a.dauern.elem_fire) && hat(a.klaenge, a.dauern.damage), [a.dauern, a.klaenge]);
    const v = verloren(a.hpVorher, a.hpNachher);
    check('genau EIN Held des Gegners verliert 150 HP, die anderen nichts (der Gegner wählt)', v.filter(x => x === 150).length === 1 && v.filter(x => x === 0).length === 2, v);
    check('der Wirker verliert nichts', a.eigeneHp.every(h => h === 500), a.eigeneHp);
    check('die Wolke ist nach ~1,5 s wieder weg', a.weg === true);
    check('Big Oopsie liegt in der Ablage, das zweite noch auf der Hand', a.ablage.includes('Big Oopsie') && a.hand.length === 1 && a.hand[0] === 'Big Oopsie', { hand: a.hand, ablage: a.ablage });
    check('das Aktionslog nennt den Zug („chooses … takes 150 damage“)', a.log.some(t => /chooses/.test(t) && /150/.test(t)), a.log);
    check('„only 1 per turn“: das zweite Big Oopsie wird abgelehnt (bleibt auf der Hand, kein weiterer Schaden)', a.handNachZweitem.length === 1 && JSON.stringify(a.hpNachZweitem) === JSON.stringify(a.hpNachher), { hand: a.handNachZweitem, hp: a.hpNachZweitem });
    check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);

    console.log('Lauf B: MAIN Phase, Held 0 ist ein Ascended Hero');
    const b = await spiele(browser, { phase: 2, ascended: true, zweites: false, name: 'B' });
    check('in der Main Phase spielbar (Zusatzaktion für den Ascended Hero): die Wolke erscheint, 150 Schaden, Karte in der Ablage',
      !!b.spur && b.spur.bemalt > 40 && verloren(b.hpVorher, b.hpNachher).includes(150) && b.ablage.includes('Big Oopsie'), { spur: b.spur, v: verloren(b.hpVorher, b.hpNachher), ablage: b.ablage });
    check('keine JS-Fehler im Browser', b.fehler.length === 0, b.fehler);

    console.log('Lauf C: MAIN Phase, gewöhnlicher Held');
    const c = await spiele(browser, { phase: 2, ascended: false, zweites: false, name: 'C' });
    check('vom Server abgelehnt: keine Wolke, kein Schaden, die Karte bleibt auf der Hand', !c.spur && verloren(c.hpVorher, c.hpNachher).every(x => x === 0) && c.hand.includes('Big Oopsie') && !c.ablage.includes('Big Oopsie'), { spur: c.spur, hand: c.hand });
    check('keine JS-Fehler im Browser', c.fehler.length === 0, c.fehler);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
