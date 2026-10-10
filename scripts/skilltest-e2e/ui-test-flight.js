'use strict';
// UI-Test: Test Flight im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 wirkt Burning Finger (Destruction Magic, Stufe 1) auf den EIGENEN Helden 1; Test Flight liegt auf der Hand.
//   • Held 1 mit Magic Arts 2 (Stufe 1 < 2): das Fenster fragt, „✨ Activate!" wehrt den Zauber ab — der Held verliert keine HP, die Karte
//     liegt in der Ablage, die Pixelart-Animation `test_flight` sitzt auf seiner Zone und bemalt ihr Canvas, ihre beiden Klänge
//     (`elem_fire`, `elem_wind`) starten, und sie ist nach ~1 s wieder weg.
//   • Held 1 mit Magic Arts 1 (Stufe 1 ist NICHT niedriger): kein Angebot, der Zauber trifft.
//   NODE_PATH=/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-test-flight.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

/** Ein Puzzle: eigene Seite mit `ma` Magic Arts auf Held 1, Hand = Burning Finger + Test Flight. */
async function spiele(browser, ma) {
  const acc = await createAccount('UiTf' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 700 } });
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
      for (const n of ['elem_fire', 'elem_wind', 'slash']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate((ma) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const seite = (off, magic) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 800, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [[['Destruction Magic'], [], []], [Array.from({ length: magic }, () => 'Magic Arts'), [], []], [[], [], []]],
        surpriseZones: [[], [], []], supportZones: [0, 1, 2].map(() => [[], [], []]), mainDeck: kre.slice(), potionDeck: [], sideDeck: [],
        discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', { players: [seite(0, ma), seite(3, 0)], areaZones: [[], []], doomCounters: [0, 0], hand: ['Burning Finger', 'Test Flight'], oppHand: [], playerDebuffs: [[], []] });
    }, ma);
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));   // Action Phase
    await sleep(1200);
    const hpVorher = await page.evaluate((my) => window.__gs.players[my].heroes[1].hp, my);
    await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Burning Finger', handIndex: 0, heroIdx: 0 }));
    // Ziel: der EIGENE Held 1
    let gewaehlt = false;
    for (let k = 0; k < 40 && !gewaehlt; k++) {
      const ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => [t.id, t.owner, t.heroIdx]));
      if (ziele && ziele.length) {
        const z = ziele.find(x => x[1] === my && x[2] === 1);
        if (z) { await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [z[0]]); gewaehlt = true; }
        else break;
      } else await sleep(150);
    }
    // Wurde das Fenster angeboten?
    let angebot = false;
    for (let k = 0; k < 30 && !angebot; k++) {
      angebot = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; return !!e && e.type === 'confirm' && e.title === 'Test Flight'; });
      if (!angebot) await sleep(100);
    }
    const r = { dauern, gewaehlt, angebot, my, hpVorher, fehler, page };
    if (angebot) {
      await page.evaluate(() => { window.__snd.length = 0; });
      const t0 = Date.now();
      await page.click('button:has-text("Activate")');
      // Canvas der Animation: sitzt auf der Zone von Held 1, ist bemalt
      let spur = null;
      for (let k = 0; k < 20 && !(spur && spur.bemalt > 0); k++) {
        await sleep(60);
        spur = await page.evaluate(([my]) => {
          const cv = document.querySelector('[data-pp-px="aus"] canvas');
          if (!cv) return null;
          const q = cv.getBoundingClientRect();
          const zone = [...document.querySelectorAll('[data-hero-zone][data-hero-idx="1"]')].find(z => z.getAttribute('data-hero-owner') === 'me');
          const zr = zone && zone.getBoundingClientRect();
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
          return { bemalt: n, cx: q.left + q.width / 2, oben: q.top, unten: q.bottom, zx: zr ? zr.left + zr.width / 2 : null, zy: zr ? zr.top + zr.height / 2 : null, w: q.width, h: q.height };
        }, [my]);
      }
      r.spur = spur;
      if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'test-flight-' + ma + '.png') }); } catch { /* egal */ } }
      await sleep(700);
      r.klaenge = await page.evaluate(() => window.__snd.slice());
      r.nachAktivieren = Date.now() - t0;
      await sleep(1400);
      r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    }
    await sleep(2500);       // der Zauber loest auf
    r.hpNachher = await page.evaluate((my) => window.__gs.players[my].heroes[1].hp, my);
    r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
    r.ablage = await page.evaluate((my) => window.__gs.players[my].discardPile, my);
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Held 1 mit Magic Arts 2: Burning Finger (Stufe 1) wird abgewehrt');
    const a = await spiele(browser, 2);
    check('Burning Finger auf den eigenen Helden 1 gewählt', a.gewaehlt);
    check('das Fenster fragt nach Test Flight (Bestätigungs-Abfrage mit dem Kartennamen)', a.angebot);
    check('die Pixelart-Animation sitzt auf der Zone von Held 1 (waagerecht mittig ±6 px; die Zonenmitte liegt im oberen Teil des Canvas, darunter Platz für Rauch)', !!a.spur && a.spur.zx != null && Math.abs(a.spur.cx - a.spur.zx) <= 6 && a.spur.zy > a.spur.oben + 40 && a.spur.zy < a.spur.oben + (a.spur.unten - a.spur.oben) * 0.5, a.spur);
    check('…ihr Canvas ist bemalt (Flammen, Rauch, Wind)', !!a.spur && a.spur.bemalt > 40, a.spur);
    check('beide Klänge starten kurz nach dem Aktivieren: Feuer (`elem_fire`) und Luftstrom (`elem_wind`)', !!a.klaenge && hat(a.klaenge, a.dauern.elem_fire) && hat(a.klaenge, a.dauern.elem_wind), [a.dauern, a.klaenge]);
    check('die Animation ist nach ~1 s wieder weg', a.weg === true);
    check('Held 1 verliert KEINE HP (der Schaden wird negiert)', a.hpNachher === a.hpVorher, [a.hpVorher, a.hpNachher]);
    check('Test Flight liegt in der Ablage, nicht mehr auf der Hand', !a.hand.includes('Test Flight') && a.ablage.includes('Test Flight'), { hand: a.hand, ablage: a.ablage });
    check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);

    console.log('Held 1 mit Magic Arts 1: Stufe 1 ist nicht niedriger — kein Angebot, der Zauber trifft');
    const b = await spiele(browser, 1);
    check('Burning Finger auf den eigenen Helden 1 gewählt', b.gewaehlt);
    check('KEIN Angebot von Test Flight', b.angebot === false);
    check('Held 1 verliert HP', b.hpNachher < b.hpVorher, [b.hpVorher, b.hpNachher]);
    check('Test Flight bleibt auf der Hand', b.hand.includes('Test Flight'), b.hand);
    check('keine JS-Fehler im Browser', b.fehler.length === 0, b.fehler);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
