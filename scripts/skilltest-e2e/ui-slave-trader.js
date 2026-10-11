'use strict';
// UI-Test: Slave Trader im ECHTEN Browser.
//   • Lauf A (Client): die Brett-Animation `slave_chains` (Pixelart-Canvas, Hülle `ppSalve`) wird wie ein Server-Ereignis eingespeist: der Canvas wird
//     bemalt, die Klänge starten (`elem_wind`, `placement`, `ping`, `heavy_impact`), nach ~1,3 s ist er weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg): in der Main Phase liegen der Händler und eine Lv-3-Creature (3-Headed Giant) auf der Hand — `play_creature` verlangt den
//     Abwurf (Hand-Karte anklicken), der Händler landet auf dem Brett (Zusatzaktion). Dann deckt der Händler auf dem Brett die oberste Deckkarte auf (eine
//     Creature): Zonenwahl mit Kartenvorschau, die Creature steht in der gewählten Zone, das Log nennt es; ein zweiter Einsatz im selben Zug geschieht nicht.
//   • Lauf C (echter Spielweg): oben liegt ein Spell — keine Beschwörung, nur „oben oder unten?“; „Bottom“ legt ihn unter das Deck (Log).
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-slave-trader.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

async function seite(browser, name, bauen) {
  const acc = await createAccount('UiSt' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
    for (const n of ['elem_wind', 'placement', 'ping', 'heavy_impact']) {
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

const LV3 = '3-Headed Giant';
const KRE = 'Aggressive Town Guard';
const AUFBAU = (extra) => ({
  fn: ({ extra }) => {
    window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && n !== 'Slave Trader' && n !== 'Aggressive Town Guard').slice(0, 12);
    const leer = () => [[], [], []];
    const mk = (off, eigene) => ({
      heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
      abilityZones: [leer(), leer(), leer()],
      surpriseZones: [[], [], []],
      supportZones: [leer(), eigene && extra.aufBrett ? [['Slave Trader'], [], []] : [[kre[eigene ? 1 : 2]], [], []], leer()],
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
          const ev = { type: 'slave_chains', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1200,
            targets: [{ owner: my, heroIdx: 1, zoneSlot: 0, cardName: 'Slave Trader' }], originOwner: my, originHeroIdx: 1, originZoneSlot: 0 };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my });
        const spur = await messen(page, 500);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'slave-trader-A.png') }); } catch { /* egal */ } }
        await sleep(2000);
        const klaenge = await page.evaluate(() => window.__snd.slice());
        const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
        check('die Pixelart-Animation (Canvas) ist bemalt', !!spur && spur.bemalt > 100, spur);
        check('die Klänge starten: Rasseln (`elem_wind`, `placement`) und Klirren (`ping`, `heavy_impact`)', hat(klaenge, s.dauern.elem_wind) && hat(klaenge, s.dauern.placement) && hat(klaenge, s.dauern.ping) && hat(klaenge, s.dauern.heavy_impact), [s.dauern, klaenge]);
        check('nach ~1,3 s ist die Animation wieder weg', weg === true);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: echter Spielweg — Abwurf-Beschwörung und Aufdecken mit sofortiger Beschwörung');
    {
      const s = await seite(browser, 'B', AUFBAU({ deck: [KRE, 'Fireball', 'Fireball'], hand: ['Slave Trader', LV3, 'Fireball'], aufBrett: true }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
        // Teil 1: Beschwörung mit Abwurf (Main Phase: einziger Weg)
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Slave Trader', handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
        const kosten = await warteAufPrompt(page, 'forceDiscardCancellable');
        check('die Abwurf-Abfrage öffnet sich und markiert NUR die Lv-3-Creature (3-Headed Giant, Handplatz 1)', !!kosten && kosten.titel === 'Slave Trader' && kosten.elig && kosten.elig.length === 1 && kosten.elig[0] === 1, kosten);
        if (outDir && kosten) { try { await page.screenshot({ path: path.join(outDir, 'slave-trader-abwurf.png') }); } catch { /* egal */ } }
        if (kosten) await antwort(page, kosten.id, { cardName: LV3, handIndex: 1 });
        await sleep(2500);
        const z1 = await page.evaluate((my) => { const p = window.__gs.players[my]; return { hand: p.hand.slice(), abl: p.discardPile.slice(), zonen: p.supportZones.map(h => h.map(z => (z || [])[0] || null)) }; }, my);
        check('die Lv-3-Creature liegt in der Ablage, der Händler steht in Held 0 / Platz 0, Fireball bleibt auf der Hand', z1.abl.includes(LV3) && z1.zonen[0][0] === 'Slave Trader' && z1.hand.length === 1 && z1.hand[0] === 'Fireball', z1);
        // Teil 2: der Händler auf dem Brett (Held 1, Platz 0) deckt auf
        await page.evaluate(() => { window.__snd.length = 0; window.__anims = []; window.socket.on('play_zone_animation', (e) => { window.__anims.push(e && e.type); }); });
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const zp = await warteAufPrompt(page, 'zonePick');
        check('die Zonenwahl (nach dem Aufdecken) bietet freie Plätze mehrerer Helden an', !!zp && zp.titel === 'Slave Trader' && zp.zones.length > 3, zp);
        if (outDir && zp) { try { await page.screenshot({ path: path.join(outDir, 'slave-trader-zonenwahl.png') }); } catch { /* egal */ } }
        if (zp) await antwort(page, zp.id, { heroIdx: 2, slotIdx: 1 });
        await sleep(3500);
        const r = await page.evaluate((my) => ({
          zonen: window.__gs.players[my].supportZones.map(h => h.map(z => (z || [])[0] || null)),
          anims: window.__anims,
          log: [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => /Slave Trader/.test(t)),
        }), my);
        check('die aufgedeckte Creature steht in der gewählten Zone (Held 2, Platz 1)', r.zonen[2][1] === KRE, r.zonen);
        check('die Ketten-Animation `slave_chains` kam vom Server', r.anims.includes('slave_chains'), r.anims);
        check('das Aktionslog nennt Händler und Beschwörung', r.log.some(t => /Slave Trader/.test(t) && /summons it as an additional Action/.test(t)), r.log);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        await sleep(2000);
        const zweit = await page.evaluate(() => ({ prompt: !!(window.__gs.effectPrompt && (window.__gs.effectPrompt.type === 'zonePick' || window.__gs.effectPrompt.type === 'confirm')) }));
        check('ein zweiter Einsatz im selben Zug öffnet keine Frage', zweit.prompt === false, zweit);
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
        check('keine Beschwörung — direkt „oben oder unten?“ (Fireball ist keine Creature)', !!tb && /Fireball/.test(tb.msg), tb);
        if (outDir && tb) { try { await page.screenshot({ path: path.join(outDir, 'slave-trader-oben-unten.png') }); } catch { /* egal */ } }
        if (tb) await antwort(page, tb.id, { cancelled: true });                 // „Bottom“
        await sleep(2500);
        const log = await page.evaluate(() => [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => /Slave Trader/.test(t)));
        check('das Log meldet: Fireball geht unter das Deck', log.some(t => /Fireball/.test(t) && /bottom/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
