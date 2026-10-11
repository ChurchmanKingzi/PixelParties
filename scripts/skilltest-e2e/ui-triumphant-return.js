'use strict';
// UI-Test: Triumphant Return im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 hat Magic Arts Lv1 (der Wirker), Held 1 liegt tot da und hat Destruction Magic Lv1; auf der Hand: Golden Ankh (belebt Held 1
//   wieder), Triumphant Return und Burning Finger.
//   • Golden Ankh → Held 1 lebt → das Hand-Fenster bietet Triumphant Return an (der Wirker ist Held 0, „except the user")
//   • „Activate" → die Pixelart-Fanfare (Canvas) erscheint am WIEDERBELEBTEN Helden, ihre Klänge starten
//   • SOFORT öffnet sich das Aktionsfenster für Held 1 (nicht für den Wirker) mit Burning Finger als wählbarer Karte
//   • Abbruch: nichts wird gespielt, die Bonus-Aktion verfällt, das Log meldet es
//   • Lauf B: ohne spielbare Karte öffnet sich KEIN Aktionsfenster, die Bonus-Aktion verfällt still (Log)
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-triumphant-return.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];
const TR = 'Triumphant Return';

async function spiele(browser, { mitZauber, name }) {
  const acc = await createAccount('UiTr' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
      for (const n of ['revive', 'elem_holy', 'gold_gain']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate(({ TR, mitZauber }) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, eigene) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: (eigene && i === 1) ? 0 : 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: eigene ? [[['Magic Arts'], [], []], [['Destruction Magic'], [], []], leer()] : [leer(), leer(), leer()],
        surpriseZones: [[], [], []], supportZones: [leer(), leer(), leer()],
        mainDeck: kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [], gold: 99, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0],
        hand: mitZauber ? ['Golden Ankh', TR, 'Burning Finger'] : ['Golden Ankh', TR], oppHand: [], playerDebuffs: [[], []],
      });
    }, { TR, mitZauber });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
    const r = { dauern, fehler, my, name };

    // Golden Ankh: den toten Held 1 wählen
    await page.evaluate(() => window.socket.emit('use_artifact_effect', { roomId: window.__gs.roomId, cardName: 'Golden Ankh', handIndex: 0 }));
    let ziele = null;
    for (let k = 0; k < 40 && !(ziele && ziele.length); k++) {
      ziele = await page.evaluate(() => window.__gs && window.__gs.potionTargeting && (window.__gs.potionTargeting.validTargets || []).map(t => ({ id: t.id, owner: t.owner, heroIdx: t.heroIdx, type: t.type })));
      if (!ziele || !ziele.length) await sleep(100);
    }
    const held1 = (ziele || []).find(z => z.type === 'hero' && z.heroIdx === 1);
    r.ziele = ziele;
    if (held1) await page.evaluate(([id]) => window.socket.emit('confirm_potion', { roomId: window.__gs.roomId, selectedIds: [id] }), [held1.id]);

    // Angebot der Reaktion
    let angebot = null;
    for (let k = 0; k < 60 && !angebot; k++) {
      angebot = await page.evaluate((TR) => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === 'confirm' && e.title === TR ? { msg: e.message, links: e.showCardLeft } : null; }, TR);
      if (!angebot) await sleep(100);
    }
    r.angebot = angebot;
    if (outDir && angebot) { try { await page.screenshot({ path: path.join(outDir, 'triumphant-return-' + name + '-angebot.png') }); } catch { /* egal */ } }
    if (!angebot) return r;
    r.hpImFenster = await page.evaluate((my) => window.__gs.players[my].heroes.map(h => h.hp), my);
    await page.evaluate(() => { window.__snd.length = 0; });
    await page.click('button:has-text("Activate")');

    // Pixelart-Fanfare
    let spur = null;
    for (let k = 0; k < 40 && !(spur && spur.bemalt > 0); k++) {
      await sleep(50);
      spur = await page.evaluate(() => {
        const cv = document.querySelector('[data-pp-px="aus"] canvas');
        if (!cv) return null;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return { bemalt: n };
      });
    }
    for (let k = 0; k < 8 && spur; k++) {                            // Einblenden: das Maximum über die nächsten Bilder zählt
      await sleep(70);
      const n = await page.evaluate(() => { const cv = document.querySelector('[data-pp-px="aus"] canvas'); if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) c++; return c; });
      if (n > spur.bemalt) spur.bemalt = n;
    }
    r.spur = spur;
    if (outDir && spur) { try { await page.screenshot({ path: path.join(outDir, 'triumphant-return-' + name + '-fanfare.png') }); } catch { /* egal */ } }

    // SOFORT: das Aktionsfenster des Wiederbelebten?
    let aktion = null;
    for (let k = 0; k < 40 && !aktion; k++) {
      aktion = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === 'heroAction' ? { id: e.promptId, heroIdx: e.heroIdx, heroName: e.heroName, karten: e.eligibleCards || [], titel: e.title } : null; });
      if (!aktion) await sleep(100);
    }
    r.aktion = aktion;
    r.heldNamen = await page.evaluate((my) => window.__gs.players[my].heroes.map(h => h.name), my);
    if (outDir && aktion) { try { await page.screenshot({ path: path.join(outDir, 'triumphant-return-' + name + '-aktion.png') }); } catch { /* egal */ } }
    r.klaenge = await page.evaluate(() => window.__snd.slice());
    if (aktion) await page.evaluate(([id]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response: { cancelled: true }, promptId: id }), [aktion.id]);
    await sleep(1800);
    r.hpDanach = await page.evaluate((my) => window.__gs.players[my].heroes.map(h => h.hp), my);
    r.hand = await page.evaluate((my) => window.__gs.players[my].hand, my);
    r.ablage = await page.evaluate((my) => window.__gs.players[my].discardPile, my);
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status')].map(e => e.textContent).filter(t => /Triumphant Return/.test(t)));
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: der Wiederbelebte hat eine spielbare Karte');
    const a = await spiele(browser, { mitZauber: true, name: 'A' });
    check('Golden Ankh bietet den toten Helden 1 als Ziel an', !!a.ziele && a.ziele.some(z => z.type === 'hero' && z.heroIdx === 1), a.ziele);
    check('nach der Wiederbelebung wird Triumphant Return angeboten (Held 1 steht links im Angebot)', !!a.angebot && /revived/.test(a.angebot.msg), a.angebot);
    check('der Held lebt im Angebotsfenster schon wieder (100 HP)', !!a.hpImFenster && a.hpImFenster[1] === 100, a.hpImFenster);
    check('die Pixelart-Fanfare (Canvas) ist bemalt', !!a.spur && a.spur.bemalt > 40, a.spur);
    check('alle drei Klänge starten: Wiederbelebung (`revive`), Glanz (`elem_holy`), Gold (`gold_gain`)', !!a.klaenge && hat(a.klaenge, a.dauern.revive) && hat(a.klaenge, a.dauern.elem_holy) && hat(a.klaenge, a.dauern.gold_gain), [a.dauern, a.klaenge]);
    check('SOFORT öffnet sich das Aktionsfenster — für Held 1 (den Wiederbelebten), nicht für den Wirker (Held 0)', !!a.aktion && a.aktion.heroIdx === 1 && a.aktion.titel === TR && a.aktion.heroName === (a.heldNamen || [])[1], a.aktion);
    check('…und es bietet Burning Finger als wählbare Karte an', !!a.aktion && a.aktion.karten.includes('Burning Finger'), a.aktion);
    check('Abbruch: nichts gespielt (Burning Finger bleibt auf der Hand), die Karte Triumphant Return liegt in der Ablage', a.hand.includes('Burning Finger') && !a.hand.includes(TR) && a.ablage.includes(TR), { hand: a.hand, abl: a.ablage });
    check('das Aktionslog meldet die verfallene Aktion', a.log.some(t => /lapses|performs an additional Action/.test(t)), a.log);
    check('keine JS-Fehler im Browser', a.fehler.length === 0, a.fehler);

    console.log('Lauf B: der Wiederbelebte hat keine spielbare Karte');
    const b = await spiele(browser, { mitZauber: false, name: 'B' });
    check('Triumphant Return wird trotzdem angeboten', !!b.angebot, b.angebot);
    check('es öffnet sich KEIN Aktionsfenster (keine legitime Aktion), die Bonus-Aktion verfällt', b.aktion === null, b.aktion);
    check('die Karte ist verbraucht, das Log meldet den Verfall', b.ablage.includes(TR) && b.log.some(t => /lapses/.test(t)), { abl: b.ablage, log: b.log });
    check('keine JS-Fehler im Browser', b.fehler.length === 0, b.fehler);
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
