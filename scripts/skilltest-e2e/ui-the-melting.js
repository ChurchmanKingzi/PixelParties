'use strict';
// UI-Test: The Melting im ECHTEN Browser.
//   • Lauf A (Client): die Brett-Animation `the_melting` (Pixelart-Canvas, Hülle `ppSalve`) wird wie ein Server-Ereignis eingespeist — mit einem
//     Helden und zwei Kreaturen als Zielen: der Canvas wird bemalt, die Klänge starten (`elem_fire`, `elem_water`, `elem_ice`, `status_remove`),
//     nach ~1,5 s ist er weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg, Puzzle-Spiel): der Mensch friert mit „Instant Cryo Stasis" eine Gegner-Kreatur ein; die CPU hält The Melting (ihr Held hat
//     Support Magic 1 und Destruction Magic 1) und spielt sie als Reaktion: alles taut, die Karte liegt in ihrer Ablage, das Log nennt sie — und weil es
//     der Effekt ihres GEGNERS im Zug ihres Gegners war und ihr Nutzer Destruction Magic 1 hat, endet der Zug des Menschen sofort (Partie vorbei).
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-the-melting.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];

async function seite(browser, name, bauen) {
  const acc = await createAccount('UiMe' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
    for (const n of ['elem_fire', 'elem_water', 'elem_ice', 'status_remove']) {
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
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
    const leer = () => [[], [], []];
    const mk = (off, eigene) => {
      const frozen = (i) => (extra.frieren === 'sichtbar' && ((eigene && i === 2) || (!eigene && i === 1))) ? { frozen: { duration: 1, appliedTurn: 0 } } : {};
      return {
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: frozen(i) })),
        abilityZones: [
          eigene ? (extra.eigeneFaehigkeiten || leer()) : (extra.gegnerFaehigkeiten || leer()),
          leer(), leer(),
        ],
        surpriseZones: [[], [], []],
        supportZones: [leer(), [[kre[eigene ? 1 : 2]], [], []], eigene ? leer() : [[kre[3]], [], []]],
        ...(extra.frieren === 'sichtbar' ? { _creatureStatuses: eigene ? { '1-0': { frozen: true } } : { '2-0': { frozen: true } } } : {}),
        mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      };
    };
    window.socket.emit('start_puzzle', {
      players: [mk(0, true), mk(3, false)], areaZones: [[], []], doomCounters: [0, 0],
      hand: extra.hand || [], oppHand: extra.oppHand || [], playerDebuffs: [[], []],
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
      const s = await seite(browser, 'A', AUFBAU({ frieren: 'sichtbar' }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex), opp = 1 - my;
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(({ my, opp }) => {
          const ev = { type: 'the_melting', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1450, regionAll: true,
            originOwner: my, originHeroIdx: 0,
            targets: [{ owner: opp, heroIdx: 1, zoneSlot: -1 }, { owner: opp, heroIdx: 2, zoneSlot: 0 }, { owner: my, heroIdx: 2, zoneSlot: -1 }, { owner: my, heroIdx: 1, zoneSlot: 0 }] };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my, opp });
        const spur = await messen(page, 600);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'the-melting-A.png') }); } catch { /* egal */ } }
        await sleep(2400);
        const klaenge = await page.evaluate(() => window.__snd.slice());
        const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
        check('die Pixelart-Brett-Animation (Canvas) ist bemalt — ein Vielfaches einer Zonen-Animation', !!spur && spur.bemalt > 600, spur);
        check('alle Klänge starten: Feuer (`elem_fire`), Wasser (`elem_water`), Eis (`elem_ice`), Auftauen (`status_remove`)', hat(klaenge, s.dauern.elem_fire) && hat(klaenge, s.dauern.elem_water) && hat(klaenge, s.dauern.elem_ice) && hat(klaenge, s.dauern.status_remove), [s.dauern, klaenge]);
        check('nach ~1,5 s ist die Animation wieder weg', weg === true);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: echter Spielweg — die CPU spielt The Melting auf mein Eis');
    {
      const s = await seite(browser, 'B', AUFBAU({
        hand: ['Instant Cryo Stasis'],
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
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(() => window.socket.emit('play_spell', { roomId: window.__gs.roomId, cardName: 'Instant Cryo Stasis', handIndex: 0, heroIdx: 0 }));
        let ziele = null;
        for (let k = 0; k < 30 && !(ziele && ziele.length); k++) {
          ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => ({ id: t.id, owner: t.owner, type: t.type, heroIdx: t.heroIdx, slotIdx: t.slotIdx })));
          if (!ziele || !ziele.length) await sleep(100);
        }
        const ziel = (ziele || []).find(z => z.type === 'equip' && z.owner === opp);
        check('die Zielwahl von Instant Cryo Stasis bietet eine Gegner-Kreatur an', !!ziel, ziele);
        if (ziel) await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [ziel.id]);
        const spur = await messen(page, 300);
        if (outDir) { await sleep(300); try { await page.screenshot({ path: path.join(outDir, 'the-melting-B.png') }); } catch { /* egal */ } }
        await sleep(4500);
        const r = await page.evaluate(({ opp }) => {
          const gs = window.__gs;
          return {
            ablageGegner: gs.players[opp].discardPile, handGegner: gs.players[opp].hand,
            gefroren: JSON.stringify(gs.players[opp].creatureCounters || null),
            log: [...document.querySelectorAll('.log-status, .log-info')].map(e => e.textContent).filter(t => /The Melting/.test(t)),
            ergebnis: gs.result || null, phase: gs.currentPhase, aktiv: gs.activePlayer, myIndex: gs.myIndex,
          };
        }, { opp });
        check('die CPU spielt The Melting als Reaktion: die Karte liegt in ihrer Ablage', r.ablageGegner.includes('The Melting') && !r.handGegner.includes('The Melting'), r);
        check('das Aktionslog nennt The Melting', r.log.some(t => /The Melting/.test(t)), r.log);
        check('die Pixelart-Brett-Animation wurde bemalt', !!spur && spur.bemalt > 100, spur);
        check('mein Zug endet sofort (Destruction Magic 1, mein Eis im Zug des Gegners der CPU): Partie vorbei bzw. Zug gewechselt', !!r.ergebnis || r.aktiv !== r.myIndex || r.phase >= 5, r);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
