'use strict';
// UI-Test: Embodiment of Biseria im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Biseria steht auf Held 0, der Gegner kontrolliert drei Kreaturen; der Spieler aktiviert den Effekt (einmal pro Zug).
//   • Lauf A (ODER-Wahl „300 Schaden“): Zielwahl → die Pixelart-EISFAUST (Canvas) sitzt auf dem Ziel, ihre Klänge starten (`elem_wind`,
//     `heavy_impact`, `elem_ice`), genau ein Held des Gegners verliert 300 HP, das Aktionslog nennt den Schlag, ein zweiter Einsatz im
//     selben Zug öffnet keine Frage mehr.
//   • Lauf B (ODER-Wahl „alle Gegnerkreaturen einfrieren“): der Pixelart-BLIZZARD (Canvas) über der Gegnerhälfte, Klänge, alle drei
//     Kreaturen des Gegners tragen den Frost, die eigenen Karten nicht, Helden nicht; Log.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-embodiment-of-biseria.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];
const BIS = 'Embodiment of Biseria';

/** Ein Puzzle; `modus` 'damage' | 'freeze'. */
async function spiele(browser, { modus, name }) {
  const acc = await createAccount('UiBis' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
    await page.click('button:has-text("ATTEMPT PUZZLE")');          // die Puzzle-Bibliothek haengt den `game_state`-Hoerer ein
    await sleep(800);
    const dauern = await page.evaluate(async () => {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const out = {};
      for (const n of ['elem_wind', 'heavy_impact', 'elem_ice']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    const karten = await page.evaluate((BIS) => {
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
      const meine = seite(0, [[[BIS], [], []], [[kre[0]], [], []], leer()]);
      const gegner = seite(3, [[[kre[1]], [], []], [[kre[2]], [], []], [[], [kre[3]], []]]);
      window.socket.emit('start_puzzle', { players: [meine, gegner], areaZones: [[], []], doomCounters: [0, 0], hand: [], oppHand: [], playerDebuffs: [[], []] });
      return { eigene: kre[0], feinde: [kre[1], kre[2], kre[3]] };
    }, BIS);
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const opp = 1 - my;
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
    const hpVorher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    await page.evaluate(() => window.__snd.length = 0);
    await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 0, zoneSlot: 0 }));

    const r = { dauern, karten, my, opp, fehler, name, hpVorher };
    // ODER-Wahl
    let wahl = null;
    for (let k = 0; k < 30 && !wahl; k++) {
      wahl = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === 'optionPicker' ? { id: e.promptId, titel: e.title, optionen: (e.options || []).map(o => o.id) } : null; });
      if (!wahl) await sleep(100);
    }
    r.wahl = wahl;
    if (!wahl) return r;
    if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'biseria-' + name + '-wahl.png') }); } catch { /* egal */ } }
    await page.evaluate(([id, m]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response: { optionId: m }, promptId: id }), [wahl.id, modus]);

    if (modus === 'damage') {
      let ziele = null;
      for (let k = 0; k < 30 && !(ziele && ziele.length); k++) {
        ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => ({ id: t.id, owner: t.owner, type: t.type, heroIdx: t.heroIdx })));
        if (!ziele || !ziele.length) await sleep(100);
      }
      r.ziele = ziele;
      const held = (ziele || []).find(z => z.type === 'hero' && z.owner === opp && z.heroIdx === 1);
      await page.evaluate(() => window.__snd.length = 0);
      if (held) await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [held.id]);
    } else {
      await page.evaluate(() => window.__snd.length = 0);
    }
    // Pixelart-Canvas
    let spur = null;
    for (let k = 0; k < 60 && !(spur && spur.bemalt > 0); k++) {
      await sleep(70);
      spur = await page.evaluate(() => {
        const cv = document.querySelector('[data-pp-px="aus"] canvas');
        if (!cv) return null;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return { bemalt: n };
      });
    }
    r.spur = spur;
    if (outDir && spur) { await sleep(modus === 'damage' ? 380 : 900); try { await page.screenshot({ path: path.join(outDir, 'biseria-' + name + '.png') }); } catch { /* egal */ } }
    await sleep(3600);
    r.klaenge = await page.evaluate(() => window.__snd.slice());
    r.hpNachher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    r.eigeneHp = await page.evaluate((my) => window.__gs.players[my].heroes.map(h => h.hp), my);
    r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    r.frostGegner = await page.evaluate(() => document.querySelectorAll('.board-side-opp .status-frozen-overlay').length);
    r.frostEigene = await page.evaluate(() => document.querySelectorAll('.board-side-me .status-frozen-overlay').length);
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status')].map(e => e.textContent).filter(t => /Embodiment of Biseria/.test(t)));
    // zweiter Einsatz im selben Zug: keine neue Frage
    await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 0, zoneSlot: 0 }));
    await sleep(1500);
    r.zweiteFrage = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; const t = window.__gs && window.__gs.potionTargeting; return !!((e && e.type === 'optionPicker') || (t && t.validTargets && t.validTargets.length)); });
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);
const verloren = (vor, nach) => vor.map((v, i) => v - nach[i]);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: 300 Schaden (Eisfaust)');
    const a = await spiele(browser, { modus: 'damage', name: 'A' });
    check('die ODER-Wahl öffnet sich mit beiden Zweigen', !!a.wahl && a.wahl.optionen.join() === 'damage,freeze', a.wahl);
    check('die Zielwahl bietet Helden und Kreaturen beider Seiten an', !!a.ziele && a.ziele.some(z => z.owner === a.opp) && a.ziele.some(z => z.owner === a.my), a.ziele);
    check('die Pixelart-Eisfaust (Canvas) ist bemalt', !!a.spur && a.spur.bemalt > 40, a.spur);
    check('alle drei Klänge starten: Sausen (`elem_wind`), Aufprall (`heavy_impact`), Eis (`elem_ice`)', !!a.klaenge && hat(a.klaenge, a.dauern.elem_wind) && hat(a.klaenge, a.dauern.heavy_impact) && hat(a.klaenge, a.dauern.elem_ice), [a.dauern, a.klaenge]);
    const v = verloren(a.hpVorher, a.hpNachher);
    check('genau der gewählte Held des Gegners (Held 1) verliert 300 HP', v[1] === 300 && v[0] === 0 && v[2] === 0, v);
    check('die eigenen Helden bleiben unberührt', a.eigeneHp.every(h => h === 500), a.eigeneHp);
    check('die Faust ist nach ~1,5 s wieder weg', a.weg === true);
    check('das Aktionslog nennt den Schlag („smashes … 300 damage“)', a.log.some(t => /smashes/.test(t) && /300/.test(t)), a.log);
    check('ein zweiter Einsatz im selben Zug öffnet keine Frage mehr (einmal pro Zug)', a.zweiteFrage === false, a.zweiteFrage);
    check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);

    console.log('Lauf B: alle Kreaturen des Gegners einfrieren (Blizzard)');
    const b = await spiele(browser, { modus: 'freeze', name: 'B' });
    check('die ODER-Wahl öffnet sich', !!b.wahl && b.wahl.optionen.join() === 'damage,freeze', b.wahl);
    check('der Pixelart-Blizzard (Canvas) ist bemalt', !!b.spur && b.spur.bemalt > 40, b.spur);
    check('die Klänge starten: Wind (`elem_wind`) und Eis (`elem_ice`)', !!b.klaenge && hat(b.klaenge, b.dauern.elem_wind) && hat(b.klaenge, b.dauern.elem_ice), [b.dauern, b.klaenge]);
    check('niemand nimmt Schaden', verloren(b.hpVorher, b.hpNachher).every(x => x === 0) && b.eigeneHp.every(h => h === 500), { v: verloren(b.hpVorher, b.hpNachher), eigene: b.eigeneHp });
    check('die drei Kreaturen des Gegners tragen den Frost, die eigenen Karten nicht', b.frostGegner >= 3 && b.frostEigene === 0, { gegner: b.frostGegner, eigene: b.frostEigene });
    check('der Blizzard ist nach ~2,4 s wieder weg', b.weg === true);
    check('das Aktionslog nennt den Frost („3 of 3 Creatures Frozen“)', b.log.some(t => /Frozen/.test(t) && /3 of 3/.test(t)), b.log);
    check('derselbe Einsatz ist für den Zug verbraucht (keine zweite Frage)', b.zweiteFrage === false, b.zweiteFrage);
    check('keine JS-Fehler im Browser', b.fehler.length === 0, b.fehler);
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
