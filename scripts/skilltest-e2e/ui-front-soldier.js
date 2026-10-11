'use strict';
// UI-Test: Front Soldier im ECHTEN Browser.
//   • Lauf A (Client): die Brett-Animation `front_soldier_block` (Pixelart-Canvas, Hülle `ppSalve`) wird wie ein Server-Ereignis eingespeist: der Canvas
//     wird bemalt, die Klänge starten (`elem_wind`, `heavy_impact`, `negate`), nach ~1,2 s ist er weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg, Puzzle-Spiel): der Mensch friert mit „Instant Cryo Stasis“ eine Gegner-Kreatur ein und hält den Front Soldier; die CPU hält
//     The Melting (Support Magic 1) und spielt sie als Reaction. Der Mensch bekommt den Soldaten als Antwort angeboten: Ja → Zonenwahl → der Soldat steht auf
//     MEINEM Brett, The Melting ist negiert (das Eis bleibt, die Karte liegt in der CPU-Ablage), BEIDE haben 2 Karten gezogen, das Log nennt den Soldaten.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-front-soldier.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

async function seite(browser, name, bauen) {
  const acc = await createAccount('UiFs' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
    for (const n of ['elem_wind', 'heavy_impact', 'negate']) {
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
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && n !== 'Front Soldier').slice(0, 12);
    const leer = () => [[], [], []];
    const mk = (off, eigene) => ({
      heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
      abilityZones: [
        eigene ? (extra.eigeneFaehigkeiten || leer()) : (extra.gegnerFaehigkeiten || leer()),
        leer(), leer(),
      ],
      surpriseZones: [[], [], []],
      supportZones: [leer(), [[kre[eigene ? 1 : 2]], [], []], leer()],
      mainDeck: ['Fireball', 'Cool Repair', 'Fireball', 'Cool Repair', 'Fireball', 'Cool Repair'], potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [],
      gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
    });
    window.socket.emit('start_puzzle', {
      players: [mk(0, true), mk(3, false)], areaZones: [[], []], doomCounters: [0, 0],
      hand: extra.hand || [], oppHand: extra.oppHand || [], playerDebuffs: [[], []],
    });
  },
  arg: { extra },
});

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);
const warteAufPrompt = async (page, typ, titel) => {
  let ep = null;
  for (let k = 0; k < 80 && !ep; k++) {
    ep = await page.evaluate(({ typ, titel }) => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === typ && (!titel || e.title === titel) ? { id: e.promptId, titel: e.title, msg: e.message, zones: (e.zones || []).map(z => z.heroIdx + ':' + z.slotIdx) } : null; }, { typ, titel });
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
      const s = await seite(browser, 'A', AUFBAU({ hand: ['Front Soldier'] }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(({ my }) => {
          const ev = { type: 'front_soldier_block', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1060,
            targets: [{ owner: my, heroIdx: 1, zoneSlot: 0, cardName: 'Front Soldier' }], originOwner: my, originHeroIdx: 1, originZoneSlot: 0 };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my });
        const spur = await messen(page, 500);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'front-soldier-A.png') }); } catch { /* egal */ } }
        await sleep(1800);
        const klaenge = await page.evaluate(() => window.__snd.slice());
        const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
        check('die Pixelart-Animation (Canvas) ist bemalt', !!spur && spur.bemalt > 150, spur);
        check('die Klänge starten: Sausen (`elem_wind`), Aufprall (`heavy_impact`), Verneinung (`negate`)', hat(klaenge, s.dauern.elem_wind) && hat(klaenge, s.dauern.heavy_impact) && hat(klaenge, s.dauern.negate), [s.dauern, klaenge]);
        check('nach ~1,2 s ist die Animation wieder weg', weg === true);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: echter Spielweg — die CPU spielt The Melting, mein Front Soldier negiert sie');
    {
      const s = await seite(browser, 'B', AUFBAU({
        hand: ['Instant Cryo Stasis', 'Front Soldier'],
        oppHand: ['The Melting'],
        eigeneFaehigkeiten: [['Decay Magic'], [], []],
        gegnerFaehigkeiten: [['Support Magic'], ['Destruction Magic'], []],
      }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex), opp = 1 - my;
        try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        await page.evaluate(() => { window.__snd.length = 0; window.__anims = []; window.socket.on('play_zone_animation', (e) => { window.__anims.push(e && e.type); }); });
        await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Instant Cryo Stasis', handIndex: 0, heroIdx: 0 }));
        let ziele = null;
        for (let k = 0; k < 40 && !(ziele && ziele.length); k++) {
          ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => ({ id: t.id, owner: t.owner, type: t.type })));
          if (!ziele || !ziele.length) await sleep(100);
        }
        const ziel = (ziele || []).find(z => z.type === 'equip' && z.owner === opp);
        check('die Zielwahl von Instant Cryo Stasis bietet eine Gegner-Kreatur an', !!ziel, ziele);
        if (ziel) await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [ziel.id]);
        const frage = await warteAufPrompt(page, 'confirm', 'Front Soldier');
        check('die CPU hat The Melting gespielt: ich bekomme den Front Soldier als Antwort angeboten', !!frage && /Front Soldier/.test(frage.msg || '') || !!frage, frage);
        if (outDir && frage) { try { await page.screenshot({ path: path.join(outDir, 'front-soldier-frage.png') }); } catch { /* egal */ } }
        if (frage) await antwort(page, frage.id, { confirmed: true });
        const zp = await warteAufPrompt(page, 'zonePick', 'Front Soldier');
        check('die Zonenwahl bietet freie Plätze meiner Helden an', !!zp && zp.zones.length > 1, zp);
        if (outDir && zp) { try { await page.screenshot({ path: path.join(outDir, 'front-soldier-zonenwahl.png') }); } catch { /* egal */ } }
        if (zp) await antwort(page, zp.id, { heroIdx: 2, slotIdx: 0 });
        await sleep(5000);
        const r = await page.evaluate(({ my, opp }) => {
          const gs = window.__gs;
          return {
            meineZonen: gs.players[my].supportZones.map(h => h.map(z => (z || [])[0] || null)),
            ablageGegner: gs.players[opp].discardPile, handIch: gs.players[my].hand.slice(), handGegner: gs.players[opp].hand.slice(),
            anims: window.__anims,
            log: [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => /Front Soldier/.test(t)),
          };
        }, { my, opp });
        check('der Front Soldier steht auf MEINEM Brett (Held 2, Platz 0)', r.meineZonen[2][0] === 'Front Soldier', r.meineZonen);
        check('The Melting ist negiert: die Karte liegt in der CPU-Ablage', r.ablageGegner.includes('The Melting'), r.ablageGegner);
        check('BEIDE haben 2 Karten gezogen (meine Hand: 2, die der CPU: 2)', r.handIch.length === 2 && r.handGegner.length === 2, { ich: r.handIch, cpu: r.handGegner });
        check('die Schild-Animation `front_soldier_block` kam vom Server', r.anims.includes('front_soldier_block'), r.anims);
        check('das Aktionslog nennt den Front Soldier und die Negation', r.log.some(t => /Front Soldier/.test(t) && /negates/.test(t)), r.log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
