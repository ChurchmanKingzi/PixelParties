'use strict';
// UI-Test: Mimic im ECHTEN Browser.
//   • Lauf A (Client): die Brett-Animation `mimic_chomp` (Pixelart-Canvas, Hülle `ppSalve`) wird wie ein Server-Ereignis eingespeist, mit der Mimic
//     als Ursprung UND Ziel: der Canvas wird bemalt, die Klänge starten (`slash`, `heavy_impact`), nach ~1,2 s ist er weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg, Puzzle-Spiel): ein Puzzle feuert beim Start `onTurnStart` — die Mimic des Menschen stiehlt 10 Gold: mein Gold steigt, das des Gegners
//     sinkt, das Log nennt den Diebstahl, das Kiefer-Schnappen wird bemalt. Zweite Partie: der Gegner ist im Minus → nichts wird gestohlen, nichts umgekehrt.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-mimic.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

async function seite(browser, name, bauen) {
  const acc = await createAccount('UiMi' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 800 } });
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
    for (const n of ['slash', 'heavy_impact']) {
      const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
      out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
    }
    return out;
  });
  await page.evaluate(bauen.fn, bauen.arg);
  await page.waitForSelector('.board-center', { timeout: 30000 });
  await sleep(2500);
  return { ctx, page, fehler, dauern, name };
}

async function messen(page, grenze = 400) {
  let spur = null, maximum = 0;
  for (let k = 0; k < 40; k++) {
    await sleep(60);
    const m = await page.evaluate(() => {
      const cv = document.querySelector('[data-pp-px="aus"] canvas');
      if (!cv) return null;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      const q = cv.getBoundingClientRect();
      return { bemalt: n, w: Math.round(q.width), h: Math.round(q.height) };
    });
    if (m) { spur = spur || m; maximum = Math.max(maximum, m.bemalt); }
    if (maximum > grenze && k > 8) break;
  }
  if (spur) spur.bemalt = maximum;
  return spur;
}

const AUFBAU = (extra) => ({
  fn: ({ extra }) => {
    window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
    window.__anims = []; window.socket.on('play_zone_animation', (e) => { window.__anims.push(e && e.type); });
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && n !== 'Mimic').slice(0, 12);
    const leer = () => [[], [], []];
    const mk = (off, eigene) => ({
      heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
      abilityZones: [leer(), leer(), leer()],
      surpriseZones: [[], [], []],
      supportZones: [eigene ? [['Mimic'], [], []] : leer(), [[kre[eigene ? 1 : 2]], [], []], leer()],
      mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [],
      gold: eigene ? extra.meinGold : extra.gegnerGold, islandZoneCount: [0, 0, 0], permanents: [],
    });
    window.socket.emit('start_puzzle', {
      players: [mk(0, true), mk(3, false)], areaZones: [[], []], doomCounters: [0, 0],
      hand: [], oppHand: [], playerDebuffs: [[], []],
    });
  },
  arg: { extra },
});

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: die Brett-Animation im Client');
    {
      const s = await seite(browser, 'A', AUFBAU({ meinGold: 5, gegnerGold: 0 }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(({ my }) => {
          const ev = { type: 'mimic_chomp', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1150,
            targets: [{ owner: my, heroIdx: 0, zoneSlot: 0, cardName: 'Mimic' }],
            originOwner: my, originHeroIdx: 0, originZoneSlot: 0 };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my });
        const spur = await messen(page, 500);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'mimic-A.png') }); } catch { /* egal */ } }
        await sleep(1800);
        const klaenge = await page.evaluate(() => window.__snd.slice());
        const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
        check('die Pixelart-Animation (Canvas) ist bemalt', !!spur && spur.bemalt > 400, spur);
        check('die Klänge starten: Bisse (`slash`) und Aufschlag (`heavy_impact`)', hat(klaenge, s.dauern.slash) && hat(klaenge, s.dauern.heavy_impact), [s.dauern, klaenge]);
        check('nach ~1,2 s ist die Animation wieder weg', weg === true);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: echter Spielweg — die Mimic stiehlt beim Zugbeginn (Puzzle-Start)');
    {
      const s = await seite(browser, 'B', AUFBAU({ meinGold: 5, gegnerGold: 50 }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex), opp = 1 - my;
        try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
        await sleep(600);
        const r = await page.evaluate(({ my, opp }) => {
          const gs = window.__gs;
          return { mein: gs.players[my].gold, gegner: gs.players[opp].gold, anims: window.__anims,
            log: [...document.querySelectorAll('.log-status, .log-info, .log-entry, [class*="log"]')].map(e => e.textContent).filter(t => /Mimic/.test(t)) };
        }, { my, opp });
        check('mein Gold 5 → 15, das des Gegners 50 → 40', r.mein === 15 && r.gegner === 40, r);
        check('das Aktionslog nennt den Diebstahl der Mimic', r.log.some(t => /Mimic/.test(t) && /steals/.test(t) && /10/.test(t)), r.log);
        check('der Server hat das Kiefer-Schnappen (`mimic_chomp`) an den Client geschickt', r.anims.includes('mimic_chomp'), r.anims);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf C: der Gegner ist im Minus — nichts gestohlen, nichts umgekehrt');
    {
      const s = await seite(browser, 'C', AUFBAU({ meinGold: 5, gegnerGold: -20 }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex), opp = 1 - my;
        await sleep(2500);
        const r = await page.evaluate(({ my, opp }) => ({ mein: window.__gs.players[my].gold, gegner: window.__gs.players[opp].gold, canvas: !!document.querySelector('[data-pp-px="aus"] canvas') }), { my, opp });
        check('mein Gold bleibt 5, die Schulden des Gegners bleiben -20', r.mein === 5 && r.gegner === -20, r);
        check('kein Schnappen ohne Beute', r.canvas === false, r);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
