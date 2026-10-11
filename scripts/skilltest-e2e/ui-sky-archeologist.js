'use strict';
// UI-Test: Sky Archeologist im ECHTEN Browser.
//   • Lauf A (Client): die Brett-Animation `sky_dig` (Pixelart-Canvas, Hülle `ppSalve`) wird wie ein Server-Ereignis eingespeist — Ursprung und Ziel ist das
//     DECK (`originDeck`, `{ deck: true }`): der Canvas wird bemalt UND liegt mittig auf dem Deck, die Klänge starten (`slash`, `heavy_impact`, `ping`),
//     nach ~1,3 s ist er weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg): in der Main Phase liegen der Archäologe und ein Artifact mit Cost ≥ 10 (Coffee) auf der Hand — `play_creature` verlangt
//     den Abwurf (Hand-Karte anklicken), der Archäologe landet auf dem Brett (Zusatzaktion). Dann deckt der Archäologe auf dem Brett die oberste Deckkarte
//     auf (ein Equipment): die Karte liegt in der Bildmitte (`kf-in`), die Frage „kostenlos spielen?“, die Zonenwahl (Karte bleibt liegen), danach fliegt
//     sie auf den Platz (`kf-out`) und das Equipment liegt am gewählten Helden, das Log nennt es; ein zweiter Einsatz im selben Zug geschieht nicht.
//   • Lauf D (echter Spielweg): oben liegt Golden Bananas — „Ja“ wirkt SOFORT (+12 Gold, 0 Gold gezahlt), die Karte liegt danach in der Ablage, NICHT auf der Hand.
//   • Lauf C (echter Spielweg): oben liegt ein Spell — keine Spielfrage, nur „oben oder unten?“; „Bottom“ legt ihn unter das Deck (Log).
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-sky-archeologist.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

async function seite(browser, name, bauen) {
  const acc = await createAccount('UiSa' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
    for (const n of ['slash', 'heavy_impact', 'ping']) {
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
      return { bemalt: n, w: Math.round(q.width), h: Math.round(q.height), cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2) };
    });
    if (m) { spur = spur || m; maximum = Math.max(maximum, m.bemalt); }
    if (maximum > grenze && k > 8) break;
  }
  if (spur) spur.bemalt = maximum;
  return spur;
}

const EQ = 'Ancient Tech Infinite Energy Core';
const AUFBAU = (extra) => ({
  fn: ({ extra }) => {
    window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && n !== 'Sky Archeologist').slice(0, 12);
    const leer = () => [[], [], []];
    const mk = (off, eigene) => ({
      heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
      abilityZones: [leer(), leer(), leer()],
      surpriseZones: [[], [], []],
      supportZones: [leer(), eigene && extra.aufBrett ? [['Sky Archeologist'], [], []] : [[kre[eigene ? 1 : 2]], [], []], leer()],
      mainDeck: eigene ? extra.deck.slice() : kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [],
      gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
    });
    window.socket.emit('start_puzzle', {
      players: [mk(0, true), mk(3, false)], areaZones: [[], []], doomCounters: [0, 0],
      hand: extra.hand || [], oppHand: [], playerDebuffs: [[], []],
    });
  },
  arg: { extra },
});

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);
const warteAufPrompt = async (page, typ, teil) => {
  let ep = null;
  for (let k = 0; k < 50 && !ep; k++) {
    ep = await page.evaluate(({ typ, teil }) => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === typ && (!teil || new RegExp(teil).test(e.message || '')) ? { id: e.promptId, titel: e.title, msg: e.message, zones: (e.zones || []).map(z => z.heroIdx + ':' + z.slotIdx), elig: e.eligibleIndices || null } : null; }, { typ, teil });
    if (!ep) await sleep(100);
  }
  return ep;
};
const antwort = (page, id, response) => page.evaluate(([id, response]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response, promptId: id }), [id, response]);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: die Brett-Animation im Client');
    {
      const s = await seite(browser, 'A', AUFBAU({ deck: ['Fireball'], aufBrett: true }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(({ my }) => {
          const ev = { type: 'sky_dig', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1200,
            targets: [{ owner: my, deck: true }], originOwner: my, originDeck: true };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my });
        const spur = await messen(page, 500);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'sky-archeologist-A.png') }); } catch { /* egal */ } }
        await sleep(2000);
        const klaenge = await page.evaluate(() => window.__snd.slice());
        const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
        check('die Pixelart-Animation (Canvas) ist bemalt', !!spur && spur.bemalt > 100, spur);
        const deck = await page.evaluate(() => { const q = document.querySelector('[data-my-deck]').getBoundingClientRect(); return { cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2) }; });
        check('…und liegt MITTIG AUF DEM DECK (nicht auf einer Creature)', !!spur && Math.abs(spur.cx - deck.cx) <= 6 && Math.abs(spur.cy - deck.cy) <= 6, { spur, deck });
        check('die Klänge starten: Schläge (`slash`, `heavy_impact`) und Fund (`ping`)', hat(klaenge, s.dauern.slash) && hat(klaenge, s.dauern.heavy_impact) && hat(klaenge, s.dauern.ping), [s.dauern, klaenge]);
        check('nach ~1,3 s ist die Animation wieder weg', weg === true);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: echter Spielweg — Abwurf-Beschwörung und Aufdecken mit kostenlosem Equipment');
    {
      const s = await seite(browser, 'B', AUFBAU({ deck: [EQ, 'Fireball', 'Fireball'], hand: ['Sky Archeologist', 'Coffee', 'Fireball'], aufBrett: true }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
        // Teil 1: Beschwörung mit Abwurf (Main Phase: einziger Weg)
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Sky Archeologist', handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
        const kosten = await warteAufPrompt(page, 'forceDiscardCancellable');
        check('die Abwurf-Abfrage öffnet sich und markiert NUR das Artifact mit Cost ≥ 10 (Coffee, Handplatz 1)', !!kosten && kosten.titel === 'Sky Archeologist' && kosten.elig && kosten.elig.length === 1 && kosten.elig[0] === 1, kosten);
        if (outDir && kosten) { try { await page.screenshot({ path: path.join(outDir, 'sky-archeologist-abwurf.png') }); } catch { /* egal */ } }
        if (kosten) await antwort(page, kosten.id, { cardName: 'Coffee', handIndex: 1 });
        await sleep(2500);
        const z1 = await page.evaluate((my) => { const p = window.__gs.players[my]; return { hand: p.hand.slice(), abl: p.discardPile.slice(), zonen: p.supportZones.map(h => h.map(z => (z || [])[0] || null)) }; }, my);
        check('Coffee liegt in der Ablage, der Archäologe steht in Held 0 / Platz 0, Fireball bleibt auf der Hand', z1.abl.includes('Coffee') && z1.zonen[0][0] === 'Sky Archeologist' && z1.hand.length === 1 && z1.hand[0] === 'Fireball', z1);
        // Teil 2: der Archäologe auf dem Brett (Held 1, Platz 0) deckt auf
        await page.evaluate(() => { window.__snd.length = 0; window.__anims = []; window.socket.on('play_zone_animation', (e) => { window.__anims.push(e && e.type); }); });
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const spiel = await warteAufPrompt(page, 'confirm', 'Play it right now');
        check('die Frage „kostenlos spielen?“ erscheint mit dem aufgedeckten Equipment', !!spiel && /Ancient Tech/.test(spiel.msg), spiel);
        await sleep(1200);
        const mitte = await page.evaluate(() => {
          const k = document.querySelector('.kassaran-flip-card.kf-in');
          const pn = document.querySelector('.first-choice-panel');
          if (!k) return null;
          const q = k.getBoundingClientRect();
          const pq = pn ? pn.getBoundingClientRect() : null;
          return { cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2), unten: Math.round(q.bottom), oben: Math.round(q.top), W: window.innerWidth / 2, H: window.innerHeight / 2, panelOben: pq ? Math.round(pq.top) : null, z: getComputedStyle(k).zIndex };
        });
        check('die aufgedeckte Karte LIEGT mittig (waagerecht in der Bildmitte), solange gefragt wird', !!mitte && Math.abs(mitte.cx - mitte.W) <= 8 && mitte.oben >= 0, mitte);
        check('…und sie liegt OBERHALB der Abfrage: das Fragefenster verdeckt sie nicht', !!mitte && mitte.panelOben != null && mitte.unten <= mitte.panelOben + 2, mitte);
        if (outDir && spiel) { try { await page.screenshot({ path: path.join(outDir, 'sky-archeologist-frage.png') }); } catch { /* egal */ } }
        if (spiel) await antwort(page, spiel.id, { confirmed: true });
        const zp = await warteAufPrompt(page, 'zonePick');
        check('die Zonenwahl bietet freie Plätze mehrerer Helden an', !!zp && zp.zones.length > 1, zp);
        const nochDa = await page.evaluate(() => !!document.querySelector('.kassaran-flip-card.kf-in'));
        check('…und die Karte liegt auch während der Zonenwahl noch in der Mitte', nochDa === true);
        if (outDir && zp) { try { await page.screenshot({ path: path.join(outDir, 'sky-archeologist-zonenwahl.png') }); } catch { /* egal */ } }
        if (zp) await antwort(page, zp.id, { heroIdx: 0, slotIdx: 1 });
        let flug = false;
        for (let k = 0; k < 20 && !flug; k++) { flug = await page.evaluate(() => !!document.querySelector('.kassaran-flip-card.kf-out')); if (!flug) await sleep(50); }
        check('nach der Wahl fliegt sie aus der Mitte weiter (`kf-out`)', flug === true);
        await sleep(3000);
        const r = await page.evaluate((my) => ({
          zonen: window.__gs.players[my].supportZones.map(h => h.map(z => (z || [])[0] || null)),
          anims: window.__anims,
          log: [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => /Sky Archeologist/.test(t)),
        }), my);
        check('das Equipment liegt am gewählten Helden (Held 0, Platz 1)', r.zonen[0][1] === EQ, r.zonen);
        check('die Grab-Animation `sky_dig` kam vom Server (vor den Fragen; bemalt wird sie in Lauf A geprüft)', r.anims.includes('sky_dig'), r.anims);
        check('das Aktionslog nennt Archäologe und Equipment', r.log.some(t => /Sky Archeologist/.test(t) && /equips it for 0 Gold/.test(t)), r.log);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        await sleep(2000);
        const zweit = await page.evaluate(() => ({ prompt: !!(window.__gs.effectPrompt && window.__gs.effectPrompt.type === 'confirm') }));
        check('ein zweiter Einsatz im selben Zug öffnet keine Frage', zweit.prompt === false, zweit);
        const haengt = await page.evaluate(() => !!document.querySelector('.kassaran-flip-card'));
        check('es bleibt keine Karte in der Bildmitte liegen', haengt === false);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf D: echter Spielweg — oben liegt Golden Bananas: sofort für 0 Gold gespielt');
    {
      const s = await seite(browser, 'D', AUFBAU({ deck: ['Golden Bananas', 'Fireball', 'Fireball'], aufBrett: true }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
        const gold0 = await page.evaluate((my) => window.__gs.players[my].gold, my);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const spiel = await warteAufPrompt(page, 'confirm', 'Play it right now');
        check('die Frage „für 0 Gold spielen?“ erscheint', !!spiel && /Golden Bananas/.test(spiel.msg) && /0 Gold/.test(spiel.msg), spiel);
        if (outDir && spiel) { try { await page.screenshot({ path: path.join(outDir, 'sky-archeologist-bananen-frage.png') }); } catch { /* egal */ } }
        if (spiel) await antwort(page, spiel.id, { confirmed: true });
        await sleep(4500);
        const r = await page.evaluate((my) => { const p = window.__gs.players[my]; return { gold: p.gold, hand: p.hand.slice(), abl: p.discardPile.slice(), deck: p.mainDeck ? p.mainDeck.length : null,
          log: [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => /Sky Archeologist/.test(t)) }; }, my);
        check('Golden Bananas wirkte SOFORT: +12 Gold, nichts bezahlt', r.gold === gold0 + 12, { gold0, gold: r.gold });
        check('…die Karte liegt in der Ablage und NICHT auf der Hand', r.abl.includes('Golden Bananas') && !r.hand.includes('Golden Bananas'), r);
        check('…das Log: „plays it right away for 0 Gold“', r.log.some(t => /Golden Bananas/.test(t) && /plays it right away for 0 Gold/.test(t)), r.log);
        const haengt = await page.evaluate(() => !!document.querySelector('.kassaran-flip-card'));
        check('es bleibt keine Karte in der Bildmitte liegen', haengt === false);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf C: echter Spielweg — oben liegt ein Spell: oben oder unten?');
    {
      const s = await seite(browser, 'C', AUFBAU({ deck: ['Fireball', 'Cool Repair', 'Acid Vial'], aufBrett: true }));
      try {
        const { page } = s;
        try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const tb = await warteAufPrompt(page, 'confirm', 'top or on the bottom');
        check('keine Spielfrage — direkt „oben oder unten?“ (Fireball ist kein Artifact), Knöpfe Top/Bottom', !!tb && /Fireball/.test(tb.msg), tb);
        if (outDir && tb) { try { await page.screenshot({ path: path.join(outDir, 'sky-archeologist-oben-unten.png') }); } catch { /* egal */ } }
        if (tb) await antwort(page, tb.id, { cancelled: true });                 // „Bottom“
        await sleep(2500);
        const log = await page.evaluate(() => [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => /Sky Archeologist/.test(t)));
        check('das Log meldet: Fireball liegt unten im Deck', log.some(t => /Fireball/.test(t) && /bottom/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
