'use strict';
// UI-Test: die Detonation von Point-Blank Annihilation im ECHTEN Browser (Client-Seite: Pixelart-Brett-Animation `point_blank_blast`).
//   Die Spiellogik (Fenster, Bedingungen, Besiegen vor dem Tod) prüft `point-blank-annihilation.test.js` mit den echten Engine-Wegen —
//   ein Gegner-Creature-Effekt lässt sich in einem Puzzle-Spiel nicht auf Knopfdruck auslösen. Hier wird das Server-Ereignis
//   `play_zone_animation` direkt in den Client eingespeist (wie `onZoneAnim` es bekommt) und geprüft:
//   • die Brett-Animation (Canvas über dem ganzen Brett, Mittelpunkt der Nutzer) wird bemalt — viele Pixel, weit größer als jede Zonen-Animation
//   • ihre Klänge starten (`heavy_impact`, `elem_fire`, `damage`, `creature_destroyed`)
//   • nach ~2,1 s ist der Canvas wieder weg; keine JS-Fehler
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-point-blank-annihilation.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

async function lauf(browser) {
  const acc = await createAccount('UiPb' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 800 } });
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
    await page.click('button:has-text("ATTEMPT PUZZLE")');
    await sleep(800);
    const dauern = await page.evaluate(async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const out = {};
      for (const n of ['heavy_impact', 'elem_fire', 'damage', 'creature_destroyed']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate(() => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, sup) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [leer(), leer(), leer()], surpriseZones: [[], [], []], supportZones: sup,
        mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, [leer(), leer(), leer()]), seite(3, [[[kre[1]], [], []], [[kre[2]], [kre[3]], []], [[], [kre[4]], []]])],
        areaZones: [[], []], doomCounters: [0, 0], hand: [], oppHand: [], playerDebuffs: [[], []],
      });
    });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const opp = 1 - my;
    await page.evaluate(() => { window.__snd.length = 0; });
    await page.evaluate(({ my, opp }) => {
      const ev = { type: 'point_blank_blast', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 2100, regionAll: true,
        originOwner: my, originHeroIdx: 1,
        targets: [{ owner: opp, heroIdx: 0, zoneSlot: 0 }, { owner: opp, heroIdx: 1, zoneSlot: 0 }, { owner: opp, heroIdx: 1, zoneSlot: 1 }, { owner: opp, heroIdx: 2, zoneSlot: 1 }] };
      window.socket.listeners('play_zone_animation').forEach(f => f(ev));
    }, { my, opp });
    const messen = () => page.evaluate(() => {
      const cv = document.querySelector('[data-pp-px="aus"] canvas');
      if (!cv) return null;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      const q = cv.getBoundingClientRect();
      return { bemalt: n, w: Math.round(q.width), h: Math.round(q.height) };
    });
    let spur = null, maximum = 0;
    for (let k = 0; k < 40; k++) {
      await sleep(60);
      const m = await messen();
      if (m) { spur = spur || m; maximum = Math.max(maximum, m.bemalt); if (m.w > spur.w) spur.w = m.w; }
      if (maximum > 5000 && k > 12) break;
    }
    if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'point-blank.png') }); } catch { /* egal */ } }
    await sleep(2800);
    const r = { dauern, fehler, spur, maximum };
    r.klaenge = await page.evaluate(() => window.__snd.slice());
    r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const r = await lauf(browser);
    console.log('Detonation im Browser');
    check('die Brett-Animation (Pixelart-Canvas) ist bemalt — ein Vielfaches einer Zonen-Animation', !!r.spur && r.maximum > 5000, { spur: r.spur, maximum: r.maximum });
    check('der Canvas überspannt das ganze Brett (weit breiter als eine Karte)', !!r.spur && r.spur.w > 800, r.spur);
    check('alle Klänge starten: Schlag (`heavy_impact`), Feuer (`elem_fire`), `damage`, Bersten (`creature_destroyed`)', !!r.klaenge && hat(r.klaenge, r.dauern.heavy_impact) && hat(r.klaenge, r.dauern.elem_fire) && hat(r.klaenge, r.dauern.damage) && hat(r.klaenge, r.dauern.creature_destroyed), [r.dauern, r.klaenge]);
    check('nach ~2,1 s ist die Detonation wieder weg', r.weg === true);
    check('keine JS-Fehler im Browser', r.fehler.length === 0, r.fehler);
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
