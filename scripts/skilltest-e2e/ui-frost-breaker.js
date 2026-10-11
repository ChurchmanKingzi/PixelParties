'use strict';
// UI-Test: Frost Breaker im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 (Decay Magic 1) wirkt Frost Breaker auf ein GEFRORENES Ziel des Gegners: das Eis wird getaut und das Ziel nimmt 100 Schaden.
//   • Lauf A (Action Phase, Freeze „von früher": im Puzzle-Aufbau ohne bekannten Zeitpunkt): die Zielwahl bietet NUR die gefrorenen Ziele, die
//     Pixelart-Animation (Canvas) sitzt auf dem gewählten Held, ihre Klänge starten, der Held ist aufgetaut und hat 100 HP verloren; es ist eine
//     ZUSATZAKTION — die Action Phase bleibt offen (Held 0 hat nicht gehandelt).
//   • Lauf B (Action Phase, Freeze aus DIESEM Zug, `appliedTurn` = Puzzle-Zug): derselbe Zauber, aber er kostet die Aktion (die Phase springt weiter).
//   • Lauf C (Action Phase, nichts gefroren): vom Server abgelehnt — die Karte bleibt auf der Hand, keine Zielwahl.
//   • Lauf D (gefrorene KREATUR): die Animation sitzt auf der Kreatur-Zone und taut sie.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-frost-breaker.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

/** Ein Puzzle. `eis`: 'alt' | 'jung' | 'keins' | 'kreatur'. Gegner-Held 1 bzw. (bei 'kreatur') die Kreatur in Held 2 / Slot 0 ist gefroren. */
async function spiele(browser, { eis, name }) {
  const acc = await createAccount('UiFb' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
      for (const n of ['elem_fire', 'elem_ice', 'damage', 'status_remove', 'elem_water']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate(({ eis }) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, eigene) => ({
        heroes: [0, 1, 2].map(i => {
          const h = { name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} };
          if (!eigene && i === 1 && (eis === 'alt' || eis === 'jung')) h.statuses = { frozen: eis === 'jung' ? { duration: 1, appliedTurn: 1 } : { duration: 1 } };
          return h;
        }),
        abilityZones: [eigene ? [['Decay Magic'], [], []] : leer(), leer(), leer()],
        surpriseZones: [[], [], []],
        supportZones: [leer(), leer(), !eigene && eis === 'kreatur' ? [[kre[1]], [], []] : leer()],
        ...(!eigene && eis === 'kreatur' ? { _creatureStatuses: { '2-0': { frozen: true } } } : {}),
        mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0],
        hand: ['Frost Breaker'], oppHand: [], playerDebuffs: [[], []],
      });
    }, { eis });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    const opp = 1 - my;
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
    await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
    await sleep(1200);
    const r = { dauern, my, opp, fehler, name };
    r.hpVorher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    r.heldStatusVorher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => !!(h.statuses && h.statuses.frozen)), opp);
    r.phaseVorher = await page.evaluate(() => window.__gs.currentPhase);
    await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Frost Breaker', handIndex: 0, heroIdx: 0 }));

    // Zielwahl
    let ziele = null;
    for (let k = 0; k < 30 && !(ziele && ziele.length); k++) {
      ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => ({ id: t.id, owner: t.owner, type: t.type, heroIdx: t.heroIdx, slotIdx: t.slotIdx, ineligible: !!t.ineligible })));
      if (!ziele || !ziele.length) await sleep(100);
    }
    r.ziele = ziele;
    if (!ziele || !ziele.length) {
      r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
      return r;
    }
    const waehlbar = ziele.filter(z => !z.ineligible);
    const gewaehlt = eis === 'kreatur' ? waehlbar.find(z => z.type === 'equip' && z.owner === opp) : waehlbar.find(z => z.type === 'hero' && z.owner === opp && z.heroIdx === 1);
    r.gewaehlt = gewaehlt;
    await page.evaluate(() => window.__snd.length = 0);
    if (gewaehlt) await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [gewaehlt.id]);

    // Pixelart-Canvas
    let spur = null, maximum = 0;
    for (let k = 0; k < 40; k++) {
      await sleep(60);
      const m = await page.evaluate(() => {
        const cv = document.querySelector('[data-pp-px="aus"] canvas');
        if (!cv) return null;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return { bemalt: n };
      });
      if (m) { spur = spur || m; maximum = Math.max(maximum, m.bemalt); }
      if (maximum > 300 && k > 6) break;
    }
    if (spur) spur.bemalt = maximum;
    r.spur = spur;
    if (outDir && spur) { await sleep(450); try { await page.screenshot({ path: path.join(outDir, 'frost-breaker-' + name + '.png') }); } catch { /* egal */ } }
    await sleep(3200);
    r.klaenge = await page.evaluate(() => window.__snd.slice());
    r.hpNachher = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => h.hp), opp);
    r.heldStatus = await page.evaluate((opp) => window.__gs.players[opp].heroes.map(h => !!(h.statuses && h.statuses.frozen)), opp);
    r.kreaturGefroren = await page.evaluate((opp) => { const cc = window.__gs.players[opp].creatureCounters; return JSON.stringify(cc || null); }, opp);
    r.phaseNachher = await page.evaluate(() => window.__gs.currentPhase);
    r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
    r.ablage = await page.evaluate((my) => window.__gs.players[my].discardPile, my);
    r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status, .log-info')].map(e => e.textContent).filter(t => /Frost Breaker/.test(t)));
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);
const verloren = (vor, nach) => vor.map((v, i) => v - nach[i]);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: gefrorener Held, Freeze „von früher“ → Zusatzaktion');
    const a = await spiele(browser, { eis: 'alt', name: 'A' });
    check('die Zielwahl bietet NUR den gefrorenen Held an (nichts Ungefrorenes)', !!a.ziele && a.ziele.filter(z => !z.ineligible).length === 1 && a.ziele[0].type === 'hero' && a.ziele[0].owner === a.opp && a.ziele[0].heroIdx === 1, a.ziele);
    check('die Pixelart-Animation (Canvas) ist bemalt', !!a.spur && a.spur.bemalt > 40, a.spur);
    check('alle Klänge starten: Feuer (`elem_fire`), Eis (`elem_ice`), `damage`, Auftauen (`status_remove`), Tropfen (`elem_water`)', !!a.klaenge && hat(a.klaenge, a.dauern.elem_fire) && hat(a.klaenge, a.dauern.elem_ice) && hat(a.klaenge, a.dauern.damage) && hat(a.klaenge, a.dauern.status_remove) && hat(a.klaenge, a.dauern.elem_water), [a.dauern, a.klaenge]);
    const v = a.hpVorher && a.hpNachher ? verloren(a.hpVorher, a.hpNachher) : [];
    check('genau der gewählte Held (Held 1) verliert 100 HP (Decay Magic 1)', v[1] === 100 && v[0] === 0 && v[2] === 0, v);
    check('der Held war gefroren und ist jetzt aufgetaut', a.heldStatusVorher && a.heldStatusVorher[1] === true && a.heldStatus && a.heldStatus[1] === false, { vor: a.heldStatusVorher, nach: a.heldStatus });
    check('Zusatzaktion: die Action Phase bleibt offen (Phase unverändert)', a.phaseVorher === 3 && a.phaseNachher === 3, [a.phaseVorher, a.phaseNachher]);
    check('Frost Breaker liegt in der Ablage, nicht mehr auf der Hand', a.ablage.includes('Frost Breaker') && a.hand.length === 0, { hand: a.hand, ablage: a.ablage });
    check('die Animation ist nach ~1,5 s wieder weg', a.weg === true);
    check('das Aktionslog nennt den Zug („break the ice … 100 damage … additional Action“)', a.log.some(t => /break the ice/.test(t) && /100/.test(t) && /additional Action/.test(t)), a.log);
    check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);

    console.log('Lauf B: Freeze aus DIESEM Zug → kostet die Aktion');
    const b = await spiele(browser, { eis: 'jung', name: 'B' });
    const vb = b.hpVorher && b.hpNachher ? verloren(b.hpVorher, b.hpNachher) : [];
    check('derselbe Zauber wirkt: Held 1 aufgetaut, 100 HP verloren', vb[1] === 100 && b.heldStatus && b.heldStatus[1] === false, { vb, heldStatus: b.heldStatus });
    check('…aber die Aktion ist verbraucht: die Phase springt von der Action Phase weiter', b.phaseVorher === 3 && b.phaseNachher !== 3, [b.phaseVorher, b.phaseNachher]);
    check('das Aktionslog nennt den Zug — ohne „additional Action“', b.log.some(t => /break the ice/.test(t) && /100/.test(t)) && !b.log.some(t => /additional Action/.test(t)), b.log);
    check('keine JS-Fehler im Browser', b.fehler.length === 0, b.fehler);

    console.log('Lauf C: nichts gefroren → nicht spielbar');
    const c = await spiele(browser, { eis: 'keins', name: 'C' });
    check('keine Zielwahl, die Karte bleibt auf der Hand, nichts verliert HP', (!c.ziele || c.ziele.length === 0) && c.hand && c.hand.includes('Frost Breaker'), { ziele: c.ziele, hand: c.hand });
    check('keine JS-Fehler im Browser', c.fehler.length === 0, c.fehler);

    console.log('Lauf D: gefrorene Kreatur');
    const d = await spiele(browser, { eis: 'kreatur', name: 'D' });
    check('die Zielwahl bietet die gefrorene Kreatur an', !!d.ziele && d.ziele.some(z => z.type === 'equip' && z.owner === d.opp && z.heroIdx === 2 && z.slotIdx === 0), d.ziele);
    check('die Animation (Canvas) ist bemalt', !!d.spur && d.spur.bemalt > 40, d.spur);
    check('keine JS-Fehler im Browser', d.fehler.length === 0, d.fehler);
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
