'use strict';
// UI-Test: Capture im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 (Fighting 1) wirkt Capture gegen die Kreaturen des Gegners (Lv1 und Lv2 am Helden 0).
//   • Lauf A (Action Phase, kein Auge): die Lv2-Kreatur steht AUSGEGRAUT in der Zielwahl, die Lv1-Kreatur ist wählbar; danach fragt die
//     Zonenwahl nach den drei freien Zonen von Held 0; das Lasso (Pixelart-Canvas) sitzt auf der Zielzone, beide Klänge starten; die
//     Kreatur wechselt dauerhaft in die gewählte Zone, Capture liegt in der Ablage, das Aktionslog nennt den Zug.
//   • Lauf B (MAIN Phase, Held 0 trägt das Truth-Seeing Eye): spielbar — die Zusatzaktion; die Kreatur wechselt die Seite.
//   • Lauf C (MAIN Phase, kein Auge): vom Server abgelehnt — die Karte bleibt auf der Hand, nichts bewegt sich.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-capture.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

/** Ein Puzzle. `phase` 3 = Action Phase, 2 = Main Phase; `auge` = Held 0 trägt das Truth-Seeing Eye. */
async function spiele(browser, { phase, auge, name }) {
  const acc = await createAccount('UiCa' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 760 } });
  try {
    await ctx.request.post(BASE + '/api/auth/login', { data: { username: acc.username, password: acc.password } });
    if (toolsDir) {
      await ctx.route(/unpkg\.com\/react@18\/umd\/react\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react/umd/react.production.min.js')) }));
      await ctx.route(/unpkg\.com\/react-dom@18\/umd\/react-dom\.production\.min\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(toolsDir, 'react-dom/umd/react-dom\.production\.min\.js')) }));
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
      for (const n of ['elem_wind', 'placement']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    const karten = await page.evaluate(({ auge }) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
      const kre = (lvl) => Object.values(C).filter(c => c.cardType === 'Creature' && c.subtype === 'Normal' && c.level === lvl && !/Token|Race Boat/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name))[0].name;
      const K1 = kre(1), K2 = kre(2);
      const deck = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, eigene) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [eigene ? [['Fighting'], [], []] : leer(), leer(), leer()],
        surpriseZones: [[], [], []],
        supportZones: [eigene ? [[], [], auge ? ['Truth-Seeing Eye'] : []] : [[K1], [K2], []], leer(), leer()],
        mainDeck: deck.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0],
        hand: ['Capture'], oppHand: [], playerDebuffs: [[], []],
      });
      return { K1, K2 };
    }, { auge });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const opp = 1 - my;
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
    await page.evaluate((phase) => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: phase }), phase);
    await sleep(1200);
    await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Capture', handIndex: 0, heroIdx: 0 }));

    const r = { dauern, karten, my, opp, fehler, name };
    // Zielwahl: Lv1 wählbar, Lv2 ausgegraut
    let wahl = null;
    for (let k = 0; k < 25 && !wahl; k++) {
      wahl = await page.evaluate(() => {
        const t = window.__gs && window.__gs.potionTargeting;
        if (!t || !t.validTargets || !t.validTargets.length) return null;
        return { titel: t.potionName, ziele: t.validTargets.map(v => ({ id: v.id, owner: v.owner, heroIdx: v.heroIdx, slotIdx: v.slotIdx, cardName: v.cardName, ineligible: !!v.ineligible })) };
      });
      if (!wahl) await sleep(120);
    }
    r.wahl = wahl;
    if (wahl) {
      const k1 = wahl.ziele.find(z => z.cardName === karten.K1 && !z.ineligible);
      if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'capture-' + name + '-wahl.png') }); } catch { /* egal */ } }
      if (k1) await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [k1.id]);
      // Zonenwahl (nur wenn mehr als eine Zone frei ist)
      let zp = null;
      for (let k = 0; k < 25 && !zp; k++) {
        zp = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === 'zonePick' ? { id: e.promptId, zones: (e.zones || []).map(z => z.heroIdx + ':' + z.slotIdx) } : null; });
        if (!zp) await sleep(100);
      }
      r.zonenwahl = zp;
      if (zp) {
        await page.evaluate(() => window.__snd.length = 0);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'capture-' + name + '-zone.png') }); } catch { /* egal */ } }
        // die zweite freie Zone wählen (nicht die erste): beweist, dass die Wahl ankommt
        const z = zp.zones[1] || zp.zones[0];
        const [hi, si] = z.split(':').map(Number);
        await page.evaluate(([hi, si, id]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response: { heroIdx: hi, slotIdx: si }, promptId: id }), [hi, si, zp.id]);
        r.gewaehlteZone = z;
      } else {
        await page.evaluate(() => window.__snd.length = 0);
      }
      // Lasso: Pixelart-Canvas auf der Zielzone der Kreatur
      let spur = null;
      for (let k = 0; k < 40 && !(spur && spur.bemalt > 0); k++) {
        await sleep(60);
        spur = await page.evaluate(() => {
          const cv = document.querySelector('[data-pp-px="aus"] canvas');
          if (!cv) return null;
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
          const q = cv.getBoundingClientRect();
          return { bemalt: n, cx: q.left + q.width / 2, cy: q.top + q.height / 2 };
        });
      }
      r.spur = spur;
      if (outDir && spur) { try { await page.screenshot({ path: path.join(outDir, 'capture-' + name + '-lasso.png') }); } catch { /* egal */ } }
      await sleep(2600);
      r.klaenge = await page.evaluate(() => window.__snd.slice());
    }
    await sleep(1500);
    r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
    r.meineAblage = await page.evaluate((my) => window.__gs.players[my].discardPile, my);
    r.meineZonen = await page.evaluate((my) => window.__gs.players[my].supportZones[0].map(z => z.slice()), my);
    r.gegnerZonen = await page.evaluate((opp) => window.__gs.players[opp].supportZones.slice(0, 2).map(h => h.map(z => z.slice())), opp);
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status')].map(e => e.textContent).filter(t => /Capture/.test(t)));
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: Action Phase, kein Auge');
    const a = await spiele(browser, { phase: 3, auge: false, name: 'A' });
    const { K1, K2 } = a.karten;
    check('die Zielwahl öffnet sich mit Capture als Titel', !!a.wahl && a.wahl.titel === 'Capture', a.wahl);
    check('die Lv1-Kreatur des Gegners ist wählbar, die Lv2-Kreatur steht AUSGEGRAUT (Fighting 1)',
      !!a.wahl && a.wahl.ziele.some(z => z.cardName === K1 && !z.ineligible && z.owner === a.opp) && a.wahl.ziele.some(z => z.cardName === K2 && z.ineligible), a.wahl);
    check('die Zonenwahl bietet genau die drei freien Zonen von Held 0 an', !!a.zonenwahl && a.zonenwahl.zones.join() === '0:0,0:1,0:2', a.zonenwahl);
    check('das Lasso (Pixelart-Canvas) ist bemalt', !!a.spur && a.spur.bemalt > 40, a.spur);
    check('beide Klänge starten: Seil (`elem_wind`) und Zuziehen (`placement`)', !!a.klaenge && hat(a.klaenge, a.dauern.elem_wind) && hat(a.klaenge, a.dauern.placement), [a.dauern, a.klaenge]);
    check('die Kreatur liegt in der GEWÄHLTEN (zweiten) Zone von Held 0, nicht mehr beim Gegner', a.meineZonen[1][0] === K1 && a.meineZonen[0].length === 0 && !a.gegnerZonen.flat().flat().includes(K1), { meine: a.meineZonen, gegner: a.gegnerZonen });
    check('die Lv2-Kreatur bleibt beim Gegner', a.gegnerZonen.flat().flat().includes(K2), a.gegnerZonen);
    check('Capture liegt in der Ablage, nicht mehr auf der Hand', a.meineAblage.includes('Capture') && !a.hand.includes('Capture'), { hand: a.hand, ablage: a.meineAblage });
    check('das Aktionslog nennt den Zug („takes permanent control of …“)', a.log.some(t => /takes permanent control of/.test(t) && t.includes(K1)), a.log);
    check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);

    console.log('Lauf B: MAIN Phase, Held 0 trägt das Truth-Seeing Eye');
    const b = await spiele(browser, { phase: 2, auge: true, name: 'B' });
    check('in der Main Phase öffnet sich die Zielwahl (Zusatzaktion durch das Auge)', !!b.wahl && b.wahl.titel === 'Capture', b.wahl);
    check('zwei freie Zonen (die dritte trägt das Auge) werden zur Wahl gestellt', !!b.zonenwahl && b.zonenwahl.zones.join() === '0:0,0:1', b.zonenwahl);
    check('die Kreatur wechselt die Seite (zweite Zone), Capture liegt in der Ablage', b.meineZonen[1][0] === b.karten.K1 && b.meineAblage.includes('Capture'), { meine: b.meineZonen, ablage: b.meineAblage });
    check('keine JS-Fehler im Browser', b.fehler.length === 0, b.fehler);

    console.log('Lauf C: MAIN Phase, kein Auge');
    const c = await spiele(browser, { phase: 2, auge: false, name: 'C' });
    check('vom Server abgelehnt: keine Zielwahl', !c.wahl, c.wahl);
    check('die Karte bleibt auf der Hand, nichts bewegt sich', c.hand.includes('Capture') && c.gegnerZonen.flat().flat().includes(c.karten.K1) && c.meineZonen.flat().length === 0, { hand: c.hand, gegner: c.gegnerZonen, meine: c.meineZonen });
    check('keine JS-Fehler im Browser', c.fehler.length === 0, c.fehler);
  } finally {
    await browser.close(); srv.child.kill();
  }
  process.exit(finish() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
