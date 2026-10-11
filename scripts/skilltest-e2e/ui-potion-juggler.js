'use strict';
// UI-Test: Potion Juggler im ECHTEN Browser, über den echten Spielweg (Puzzle-Spiel, kein Scripting der Engine).
//   Held 0 hat Summoning Magic Lv1; auf der Hand liegen der Juggler und zwei Potions, in der Ablage eine dritte; ein zweiter Juggler steht
//   schon auf dem Brett (Held 1), das Potion Deck hat fünf Karten.
//   • Teil A (Beschwörung in der Main Phase): die Galerie bietet die Potions aus HAND und ABLAGE an, die gewählte Hand-Potion wird GELÖSCHT,
//     der Juggler landet auf dem Brett (Zusatzaktion — in der Main Phase geht es nur so).
//   • Teil B (Effekt des Jonglierers auf dem Brett): die Pixelart-Jonglage (Canvas) erscheint, ihre Klänge starten, die obersten 2 Karten des Potion
//     Decks sind gelöscht und eine Karte ist gezogen (die dritte); das Log nennt den Effekt; ein zweiter Einsatz im selben Zug geschieht nicht.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-potion-juggler.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];
const JUG = 'Potion Juggler';
const HAND_POTIONS = ['Acid Vial', 'Bottled Flame'];
const ABLAGE_POTION = 'Elixir of Cold';
const DECK = ['Bottled Lightning', 'Boulder in a Bottle', 'Acid Vial', 'Bottled Flame', 'Elixir of Cold'];

async function spiele(browser) {
  const acc = await createAccount('UiPj' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
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
      for (const n of ['shuffle', 'elem_biomancy', 'draw']) {
        const buf = await (await fetch('/sounds/' + n + '.ogg')).arrayBuffer();
        out[n] = +(await ac.decodeAudioData(buf)).duration.toFixed(3);
      }
      return out;
    });
    await page.evaluate(({ JUG, HAND_POTIONS, ABLAGE_POTION, DECK }) => {
      window.__gs = null; window.socket.on('game_state', (g) => { window.__gs = g; });
      const C = window.CARDS_BY_NAME;
      const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris/.test(n));
      const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal').slice(0, 12);
      const leer = () => [[], [], []];
      const seite = (off, eigene) => ({
        heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
        abilityZones: [eigene ? [['Summoning Magic'], [], []] : leer(), leer(), leer()],
        surpriseZones: [[], [], []], supportZones: eigene ? [leer(), [[JUG], [], []], leer()] : [leer(), leer(), leer()],
        mainDeck: kre.slice(), potionDeck: eigene ? DECK.slice() : [], sideDeck: [], discardPile: eigene ? [ABLAGE_POTION] : [], deletedPile: [],
        gold: 10, islandZoneCount: [0, 0, 0], permanents: [],
      });
      window.socket.emit('start_puzzle', {
        players: [seite(0, true), seite(3, false)], areaZones: [[], []], doomCounters: [0, 0],
        hand: [JUG, ...HAND_POTIONS], oppHand: [], playerDebuffs: [[], []],
      });
    }, { JUG, HAND_POTIONS, ABLAGE_POTION, DECK });
    await page.waitForSelector('.board-center', { timeout: 30000 });
    await sleep(2500);
    const my = await page.evaluate(() => window.__gs.myIndex);
    try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ }
    const r = { dauern, fehler, my };

    // ── Teil A: Beschwörung (Main Phase) ──
    await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Potion Juggler', handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
    let gal = null;
    for (let k = 0; k < 40 && !gal; k++) {
      gal = await page.evaluate(() => { const e = window.__gs && window.__gs.effectPrompt; return e && e.type === 'cardGallery' ? { id: e.promptId, titel: e.title, karten: (e.cards || []).map(c => c.name + '@' + c.source) } : null; });
      if (!gal) await sleep(100);
    }
    r.galerie = gal;
    if (outDir && gal) { try { await page.screenshot({ path: path.join(outDir, 'potion-juggler-galerie.png') }); } catch { /* egal */ } }
    if (gal) await page.evaluate(([id, name]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response: { cardName: name, source: 'hand' }, promptId: id }), [gal.id, HAND_POTIONS[0]]);
    await sleep(2500);
    const zustand = () => page.evaluate((my) => { const p = window.__gs.players[my]; return { hand: p.hand.slice(), abl: p.discardPile.slice(), gel: p.deletedPile.slice(), zonen: p.supportZones.map(h => h.map(z => (z || [])[0] || null)) }; }, my);
    r.nachA = await zustand();

    // ── Teil B: Effekt des Jonglierers auf dem Brett (Held 1, Platz 0) ──
    await page.evaluate(() => window.__snd.length = 0);
    await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
    let spur = null;
    for (let k = 0; k < 40 && !(spur && spur.bemalt > 0); k++) {
      await sleep(60);
      spur = await page.evaluate(() => {
        const cv = document.querySelector('[data-pp-px="aus"] canvas');
        if (!cv) return null;
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return { bemalt: n };
      });
    }
    // Die Flaschen blenden ein (~150 ms): der erste Treffer ist ein Teilbild — das Maximum über die nächsten Bilder zählt.
    for (let k = 0; k < 8 && spur; k++) {
      await sleep(70);
      const n = await page.evaluate(() => { const cv = document.querySelector('[data-pp-px="aus"] canvas'); if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) c++; return c; });
      if (n > spur.bemalt) spur.bemalt = n;
    }
    r.spur = spur;
    if (outDir && spur) { await sleep(300); try { await page.screenshot({ path: path.join(outDir, 'potion-juggler-juggle.png') }); } catch { /* egal */ } }
    await sleep(3000);
    r.klaenge = await page.evaluate(() => window.__snd.slice());
    r.nachB = await zustand();
    r.weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
    r.log = await page.evaluate(() => [...document.querySelectorAll('.log-status')].map(e => e.textContent).filter(t => /Potion Juggler/.test(t)));
    // zweiter Einsatz im selben Zug
    await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
    await sleep(2200);
    r.nachZweitem = await zustand();
    return r;
  } finally { await ctx.close(); }
}

const hat = (klaenge, dauer) => klaenge.some(k => Math.abs(k.dur - dauer) < 0.005);

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const r = await spiele(browser);
    console.log('Teil A: Beschwörung in der Main Phase (Potion löschen)');
    check('die Galerie öffnet sich und bietet die Potions aus HAND und ABLAGE an', !!r.galerie && r.galerie.titel === JUG
      && HAND_POTIONS.every(n => r.galerie.karten.includes(n + '@hand')) && r.galerie.karten.includes(ABLAGE_POTION + '@discard'), r.galerie);
    check('die gewählte Potion ist GELÖSCHT (nicht in der Ablage), die andere bleibt auf der Hand', r.nachA.gel.includes(HAND_POTIONS[0]) && !r.nachA.abl.includes(HAND_POTIONS[0]) && r.nachA.hand.includes(HAND_POTIONS[1]) && !r.nachA.hand.includes(HAND_POTIONS[0]), r.nachA);
    check('der Juggler steht auf dem Brett (Held 0, Platz 0) und ist von der Hand', r.nachA.zonen[0][0] === JUG && !r.nachA.hand.includes(JUG), r.nachA);
    check('die Ablage-Potion ist unberührt', r.nachA.abl.includes(ABLAGE_POTION), r.nachA.abl);

    console.log('Teil B: Effekt (oberste 2 Karten löschen, 1 ziehen)');
    check('die Pixelart-Jonglage (Canvas) ist bemalt', !!r.spur && r.spur.bemalt > 40, r.spur);
    check('Klänge starten: Mischen (`shuffle`), Biomancy-Ton, Ziehen (`draw`)', !!r.klaenge && hat(r.klaenge, r.dauern.shuffle) && hat(r.klaenge, r.dauern.elem_biomancy) && hat(r.klaenge, r.dauern.draw), [r.dauern, r.klaenge]);
    const neuGeloescht = r.nachB.gel.filter(n => !r.nachA.gel.includes(n) || r.nachB.gel.filter(x => x === n).length > r.nachA.gel.filter(x => x === n).length);
    check('die obersten 2 Karten des Potion Decks sind zusätzlich gelöscht (Bottled Lightning, Boulder in a Bottle)', r.nachB.gel.length === r.nachA.gel.length + 2 && r.nachB.gel.slice(-2).join() === DECK.slice(0, 2).join(), { vorher: r.nachA.gel, nachher: r.nachB.gel, neu: neuGeloescht });
    check('…und die dritte (Acid Vial) ist auf der Hand', r.nachB.hand.length === r.nachA.hand.length + 1 && r.nachB.hand.includes(DECK[2]), { vorher: r.nachA.hand, nachher: r.nachB.hand });
    check('die Jonglage ist nach ~1,2 s wieder weg', r.weg === true);
    check('das Aktionslog nennt den Effekt („deletes the top 2 cards … draws“)', r.log.some(t => /deletes the top 2 cards/.test(t) && /draws/.test(t)), r.log);
    check('ein zweiter Einsatz im selben Zug ändert nichts (einmal pro Zug)', JSON.stringify(r.nachZweitem) === JSON.stringify(r.nachB), { vorher: r.nachB, nachher: r.nachZweitem });
    check('keine JS-Fehler im Browser', r.fehler.length === 0, r.fehler);
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
