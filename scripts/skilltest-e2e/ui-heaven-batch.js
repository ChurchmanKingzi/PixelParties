'use strict';
// UI-Test (echter Browser) für den Batch vom 10.10.: Spearman, The Creepy Clown of Heaven, Super Fan, The Oracle of Heaven, Cute Crown.
//   • Lauf A (Client): die fünf Pixelart-Animationen (`spearman_thrust`, `clown_pop`, `fan_cheer`, `oracle_vision`, `crown_flutter`) werden wie Server-Ereignisse eingespeist —
//     Canvas bemalt, an der richtigen Stelle (Deck bzw. Brettplatz), Klänge starten, nach ~1,4 s weg, keine JS-Fehler.
//   • Lauf B (echter Spielweg): Super Fan — Abwurf von ZWEI Abilities (`handPick`), Aufdecken: die Ability liegt in der Mitte, Heldenwahl, Flug in die ABILITY ZONE, zusätzliche Anlage
//     (das Anlegen des Helden bleibt frei), Spell oben → „oben oder unten?".
//   • Lauf C (echter Spielweg): The Oracle of Heaven — Namenswahl, Treffer (Karte + 2 gezogen) und Fehlschlag (drei Karten in die Ablage).
//   • Lauf D (echter Spielweg): The Creepy Clown — Aura (abgeleitetes „Negated"-Abzeichen, nicht aktivierbar), Besitzer besiegt ihn mit einer Aktion, Nachwirkung; der GEGNER-Clown wird per
//     echtem Klick auf das Brett besiegt („either player may spend an Action").
//   • Lauf E (echter Spielweg): Cute Crown — Cute Creature in der Main Phase per Zusatzaktion (kein Auslösen), zweite geht nicht; Action Phase: die Aktion des Helden bleibt frei, Nicht-Cute
//     beim Träger gesperrt.
//   NODE_PATH=…uitools/node_modules:/tmp/st-tools/node_modules:/opt/node22/lib/node_modules node scripts/skilltest-e2e/ui-heaven-batch.js [/pfad/ordner]
const { chromium } = require('playwright');
const { startServer, BASE, sleep, createAccount, check, finish } = require('./lib');
const fs = require('fs');
const path = require('path');
const toolsDir = (process.env.NODE_PATH || '').split(path.delimiter).find(d => fs.existsSync(path.join(d, 'react', 'umd')));
const outDir = process.argv[2];
const DB = require('../../cards/effects/_card-db').getCardDB();
const { loadCardEffect } = require('../../cards/effects/_loader');
const ABIL = Object.values(DB).filter(c => c.cardType === 'Ability' && !loadCardEffect(c.name)?.restrictedAttachment && !loadCardEffect(c.name)?.customPlacement).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 4).map(c => c.name);
const [AB1, AB2, AB3] = ABIL;

async function seite(browser, bauen) {
  const acc = await createAccount('UiHv' + Date.now().toString(36) + Math.floor(Math.random() * 1e4));
  const ctx = await browser.newContext({ viewport: { width: 1652, height: 900 } });
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
  await page.evaluate(bauen.fn, bauen.arg);
  await page.waitForSelector('.board-center', { timeout: 30000 });
  await sleep(2500);
  return { ctx, page, fehler };
}

const AUFBAU = (extra) => ({
  fn: ({ extra }) => {
    window.__gs = null; window.__anims = []; window.__events = [];
    window.socket.on('game_state', (g) => { window.__gs = g; });
    window.socket.on('play_zone_animation', (e) => { window.__anims.push(e && e.type); });
    for (const ev of ['hand_to_board_fly', 'mill_center_release', 'mill_center_reveal']) window.socket.on(ev, (d) => { window.__events.push({ ev, d }); });
    const C = window.CARDS_BY_NAME;
    const helden = Object.keys(C).filter(n => C[n].cardType === 'Hero' && !/Zhigao|Quetzahuitl|Kerthwack|Boris|Codumbus/.test(n));
    const kre = Object.keys(C).filter(n => C[n].cardType === 'Creature' && C[n].level === 0 && C[n].subtype === 'Normal' && !/Token|Race Boat|Spearman|Super Fan|Oracle|Creepy|Slave Trader|Aggressive Town Guard|Sky Shaman|Cute/.test(n)).slice(0, 12);
    const leer = () => [[], [], []];
    const mk = (off, eigene) => ({
      heroes: [0, 1, 2].map(i => ({ name: helden[off + i], hp: 500, maxHp: 500, atk: 10, baseAtk: 10, statuses: {} })),
      abilityZones: [leer(), leer(), leer()],
      surpriseZones: [[], [], []],
      supportZones: (eigene ? extra.eigeneZonen : extra.gegnerZonen) || [leer(), [[kre[eigene ? 1 : 2]], [], []], leer()],
      mainDeck: eigene ? extra.deck.slice() : kre.slice(), potionDeck: [], sideDeck: [], discardPile: [], deletedPile: [],
      gold: eigene ? (extra.gold ?? 10) : 10, islandZoneCount: [0, 0, 0], permanents: [],
    });
    window.socket.emit('start_puzzle', {
      players: [mk(0, true), mk(3, false)], areaZones: [[], []], doomCounters: [0, 0],
      hand: extra.hand || [], oppHand: [], playerDebuffs: [[], []],
    });
  },
  arg: { extra },
});
const L = () => [[], [], []];
/** supportZones mit einzelnen Karten: z. B. zonen({ '1:0': 'Super Fan' }) */
const zonen = (karten) => { const z = [L(), L(), L()]; for (const [k, n] of Object.entries(karten)) { const [h, s] = k.split(':').map(Number); z[h][s] = [n]; } return z; };

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
      return { bemalt: n, w: Math.round(q.width), h: Math.round(q.height), cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2), l: Math.round(q.left), t: Math.round(q.top), r: Math.round(q.right), b: Math.round(q.bottom) };
    });
    if (m) { spur = spur || m; maximum = Math.max(maximum, m.bemalt); }
    if (maximum > grenze && k > 8) break;
  }
  if (spur) spur.bemalt = maximum;
  return spur;
}
const mitte = (sel) => `(() => { const e = document.querySelector('${sel}'); if (!e) return null; const q = e.getBoundingClientRect(); return { cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2) }; })()`;
const warteAufPrompt = async (page, typ, teil) => {
  let ep = null;
  for (let k = 0; k < 60 && !ep; k++) {
    ep = await page.evaluate(({ typ, teil }) => {
      const e = window.__gs && window.__gs.effectPrompt;
      return e && e.type === typ && (!teil || new RegExp(teil).test(e.message || e.description || '')) ? { id: e.promptId, titel: e.title, msg: e.message || e.description, elig: e.eligibleIndices || null, helden: e.eligibleHeroIdxs || null, min: e.minSelect, max: e.maxSelect, abbruch: e.cancellable, namen: (e.cardNames || []).length } : null;
    }, { typ, teil });
    if (!ep) await sleep(100);
  }
  return ep;
};
const antwort = (page, id, response) => page.evaluate(([id, response]) => window.socket.emit('effect_prompt_response', { roomId: window.__gs.roomId, response, promptId: id }), [id, response]);
const zustand = (page, fn, arg) => page.evaluate(fn, arg);
const logZeilen = (page, muster) => page.evaluate((m) => [...document.querySelectorAll('.log-status, .log-info, [class*="log"]')].map(e => e.textContent).filter(t => new RegExp(m).test(t)), muster);
const oeffneLog = async (page) => { try { await page.click('button[title="Show Log & Chat"]', { timeout: 3000 }); } catch { /* Seitenleiste schon offen */ } };

(async () => {
  const srv = await startServer();
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    console.log('Lauf A: die fünf Pixelart-Animationen im Client');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], eigeneZonen: zonen({ '1:0': 'Sky Shaman' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        const opp = 1 - my;
        const bretter = {
          clown_pop: { ev: { type: 'clown_pop', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1200, targets: [{ owner: my, heroIdx: 1, zoneSlot: 0 }], originOwner: my, originHeroIdx: 1, originZoneSlot: 0 }, ziel: '[data-support-zone][data-support-owner="me"][data-support-hero="1"][data-support-slot="0"]' },
          crown_flutter: { ev: { type: 'crown_flutter', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: my, heroIdx: 0, zoneSlot: 2 }], originOwner: my, originHeroIdx: 0, originZoneSlot: 2 }, ziel: '[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="2"]' },
          fan_cheer: { ev: { type: 'fan_cheer', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: my, deck: true }], originOwner: my, originDeck: true }, ziel: '[data-my-deck]' },
          oracle_vision: { ev: { type: 'oracle_vision', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1300, targets: [{ owner: my, deck: true }], originOwner: my, originDeck: true }, ziel: '[data-my-deck]' },
        };
        for (const [typ, b] of Object.entries(bretter)) {
          await page.evaluate(() => { window.__snd.length = 0; });
          await page.evaluate((ev) => { window.socket.listeners('play_zone_animation').forEach(f => f(ev)); }, b.ev);
          const spur = await messen(page, 200);
          if (outDir) { try { await page.screenshot({ path: path.join(outDir, `heaven-${typ}.png`) }); } catch { /* egal */ } }
          await sleep(1800);
          const klaenge = await page.evaluate(() => window.__snd.length);
          const weg = await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'));
          const ziel = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { cx: Math.round(q.left + q.width / 2), cy: Math.round(q.top + q.height / 2) }; }, b.ziel);
          check(`${typ}: der Pixelart-Canvas ist bemalt`, !!spur && spur.bemalt > 80, spur);
          check(`${typ}: …und liegt MITTIG auf dem Ziel (${b.ziel.startsWith('[data-my-deck') ? 'Deck' : 'Brettplatz'})`, !!spur && !!ziel && Math.abs(spur.cx - ziel.cx) <= 10 && Math.abs(spur.cy - ziel.cy) <= 10, { spur, ziel });
          check(`${typ}: Klänge starten (mindestens drei)`, klaenge >= 3, klaenge);
          check(`${typ}: nach ~1,4 s ist die Animation weg`, weg === true);
        }
        // Spearman: Ursprung = eigener Platz, Ziel = Gegnerplatz — der Canvas überspannt beide
        await page.evaluate(() => { window.__snd.length = 0; });
        await page.evaluate(({ my, opp }) => {
          const ev = { type: 'spearman_thrust', zoneType: 'board', owner: my, heroIdx: -1, zoneSlot: -1, duration: 1100, targets: [{ owner: opp, heroIdx: 1, zoneSlot: 0 }], originOwner: my, originHeroIdx: 1, originZoneSlot: 0 };
          window.socket.listeners('play_zone_animation').forEach(f => f(ev));
        }, { my, opp });
        const sp = await messen(page, 200);
        const von = await page.evaluate(`${mitte('[data-support-zone][data-support-owner="me"][data-support-hero="1"][data-support-slot="0"]')}`);
        const nach = await page.evaluate(`${mitte('[data-support-zone][data-support-owner="opp"][data-support-hero="1"][data-support-slot="0"]')}`);
        await sleep(1800);
        const kl = await page.evaluate(() => window.__snd.length);
        check('spearman_thrust: bemalt, der Canvas überspannt den Speerkämpfer UND das Ziel', !!sp && sp.bemalt > 80 && !!von && !!nach && sp.l <= Math.min(von.cx, nach.cx) && sp.r >= Math.max(von.cx, nach.cx) && sp.t <= Math.min(von.cy, nach.cy) && sp.b >= Math.max(von.cy, nach.cy), { sp, von, nach });
        check('spearman_thrust: Klänge starten (mindestens drei) und danach ist alles weg', kl >= 3 && (await page.evaluate(() => !document.querySelector('[data-pp-px="aus"] canvas'))), kl);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf B: Super Fan — Abwurf von zwei Abilities, Aufdecken, Ability als zusätzliche Anlage');
    {
      const s = await seite(browser, AUFBAU({ deck: [AB3, 'Fireball', 'Fireball'], hand: ['Super Fan', AB1, AB2, 'Fireball'], eigeneZonen: zonen({ '1:0': 'Super Fan' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await oeffneLog(page);
        // Teil 1: Beschwörung mit dem Abwurf von ZWEI Abilities
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Super Fan', handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
        const kosten = await warteAufPrompt(page, 'handPick');
        check('die Abwurf-Abfrage ist EINE Auswahl für genau zwei Karten und markiert NUR die zwei Abilities', !!kosten && kosten.titel === 'Super Fan' && kosten.min === 2 && kosten.max === 2 && kosten.abbruch === true && kosten.elig && kosten.elig.length === 2 && kosten.elig.includes(1) && kosten.elig.includes(2), kosten);
        if (outDir && kosten) { try { await page.screenshot({ path: path.join(outDir, 'super-fan-abwurf.png') }); } catch { /* egal */ } }
        if (kosten) await antwort(page, kosten.id, { selectedCards: [{ handIndex: 1, cardName: AB1 }, { handIndex: 2, cardName: AB2 }] });
        await sleep(2500);
        const z1 = await page.evaluate((my) => { const p = window.__gs.players[my]; return { hand: p.hand.slice(), abl: p.discardPile.slice(), zonen: p.supportZones.map(h => h.map(z => (z || [])[0] || null)) }; }, my);
        check('beide Abilities liegen in der Ablage, der Fan steht in Held 0 / Platz 0, Fireball bleibt auf der Hand', z1.abl.includes(AB1) && z1.abl.includes(AB2) && z1.zonen[0][0] === 'Super Fan' && z1.hand.length === 1 && z1.hand[0] === 'Fireball', z1);
        // Teil 2: der Fan auf dem Brett (Held 1, Platz 0) deckt auf
        await page.evaluate(() => { window.__snd.length = 0; window.__anims.length = 0; window.__events.length = 0; });
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const wahl = await warteAufPrompt(page, 'abilityAttachTarget');
        check('die Heldenwahl öffnet sich bei den drei tauglichen Helden (nicht abbrechbar)', !!wahl && wahl.titel === 'Super Fan' && wahl.helden && wahl.helden.length === 3, wahl);
        await sleep(800);
        const halt = await page.evaluate(() => {
          const k = document.querySelector('.kassaran-flip-card.kf-in');
          if (!k) return null;
          const q = k.getBoundingClientRect();
          return { cx: Math.round(q.left + q.width / 2), W: window.innerWidth / 2 };
        });
        check('die aufgedeckte Ability LIEGT währenddessen in der Bildmitte (waagerecht mittig)', !!halt && Math.abs(halt.cx - halt.W) <= 8, halt);
        if (outDir && wahl) { try { await page.screenshot({ path: path.join(outDir, 'super-fan-heldenwahl.png') }); } catch { /* egal */ } }
        if (wahl) await antwort(page, wahl.id, { heroIdx: 2, zoneSlot: 1 });
        // Flug in die Ability Zone: die Karte nähert sich dem Platz
        let nah = Infinity, flug = false;
        for (let k = 0; k < 40; k++) {
          const m = await page.evaluate(() => {
            const c = document.querySelector('.kassaran-flip-card.kf-out');
            const z = document.querySelector('[data-ability-zone][data-ability-owner="me"][data-ability-hero="2"][data-ability-slot="1"]');
            if (!c || !z) return null;
            const a = c.getBoundingClientRect(), b = z.getBoundingClientRect();
            return Math.hypot((a.left + a.width / 2) - (b.left + b.width / 2), (a.top + a.height / 2) - (b.top + b.height / 2));
          });
          if (m != null) { flug = true; nah = Math.min(nah, m); }
          await sleep(40);
        }
        check('nach der Wahl fliegt die Karte aus der Mitte (`kf-out`) in die gewählte ABILITY ZONE (Held 2, Platz 1) — sie kommt ihr bis auf eine Kartenbreite nahe', flug && nah < 90, { flug, nah });
        await sleep(2500);
        const r = await page.evaluate((my) => {
          const p = window.__gs.players[my];
          return { ab: p.abilityZones.map(h => h.map(z => (z || []).slice())), gegeben: (p.abilityGivenThisTurn || []).slice(), deck: (p.mainDeck || []).length, ankeranim: window.__events.filter(e => e.ev === 'hand_to_board_fly').length, rel: window.__events.filter(e => e.ev === 'mill_center_release').map(e => e.d && e.d.dest), anims: window.__anims.slice() };
        }, my);
        check('die Ability liegt bei Held 2 in der gewählten Zone 1 — das reguläre Anlegen des Helden bleibt FREI („additional attachment")', r.ab[2][1].join() === AB3 && !r.gegeben[2], r);
        check('Freigabe-Flug mit Ziel `ability`; KEIN zweiter Handflug; die Fan-Animation kam vom Server', r.rel.join() === 'ability' && r.ankeranim === 0 && r.anims.includes('fan_cheer'), r);
        const log = await logZeilen(page, 'Super Fan');
        check('das Aktionslog nennt den Fan und die zusätzliche Anlage', log.some(t => /Super Fan/.test(t) && /additional attachment/.test(t)), log);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        await sleep(1500);
        check('ein zweiter Einsatz im selben Zug öffnet keine Frage; es bleibt keine Karte in der Mitte liegen', !(await page.evaluate(() => !!(window.__gs.effectPrompt))) && !(await page.evaluate(() => !!document.querySelector('.kassaran-flip-card'))));
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball', AB3, 'Fireball'], eigeneZonen: zonen({ '1:0': 'Super Fan' }) }));
      try {
        const { page } = s;
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const tb = await warteAufPrompt(page, 'confirm', 'top or on the bottom');
        check('ein Spell oben: keine Anlage — direkt „oben oder unten?“', !!tb && /Fireball/.test(tb.msg), tb);
        await sleep(600);
        if (tb) await antwort(page, tb.id, { confirmed: true });                    // „Top"
        let zurueck = false;
        for (let k = 0; k < 30 && !zurueck; k++) { zurueck = await page.evaluate(() => !!document.querySelector('.kassaran-flip-card.kf-out.kf-zurueck')); if (!zurueck) await sleep(40); }
        check('die Karte fliegt RÜCKWÄRTS umgedreht zurück ins Deck (`kf-zurueck`)', zurueck === true);
        await sleep(2500);
        const log = await logZeilen(page, 'Super Fan');
        check('das Log meldet: Fireball bleibt oben', log.some(t => /Fireball/.test(t) && /top/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf C: The Oracle of Heaven — Treffer und Fehlschlag');
    for (const treffer of [true, false]) {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball', 'Cool Repair', 'Acid Vial', 'Fireball', 'Cool Repair'], eigeneZonen: zonen({ '1:0': 'The Oracle of Heaven' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const np = await warteAufPrompt(page, 'cardNamePicker');
        check(`${treffer ? 'Treffer' : 'Fehlschlag'}: die Namenswahl öffnet sich (alle Karten, abbrechbar)`, !!np && np.titel === 'The Oracle of Heaven' && np.namen > 100 && np.abbruch === true, np);
        if (outDir && np && treffer) { try { await page.screenshot({ path: path.join(outDir, 'oracle-namenswahl.png') }); } catch { /* egal */ } }
        if (np) await antwort(page, np.id, { cardName: treffer ? 'Fireball' : 'Acid Vial' });
        await sleep(7000);
        const r = await page.evaluate((my) => { const p = window.__gs.players[my]; return { hand: p.hand.slice(), abl: p.discardPile.slice(), deck: p.deckCount, anims: window.__anims.slice() }; }, my);
        if (treffer) check('Treffer: Fireball auf der Hand, dazu zwei gezogen (Cool Repair, Acid Vial), Deck um drei kürzer', r.hand.join() === ['Fireball', 'Cool Repair', 'Acid Vial'].join() && r.deck === 2 && r.abl.length === 0, r);
        else check('Fehlschlag: die oberste Karte und die zwei darunter liegen in der ABLAGE, nichts auf der Hand, Deck um drei kürzer', r.abl.join() === ['Fireball', 'Cool Repair', 'Acid Vial'].join() && r.hand.length === 0 && r.deck === 2, r);
        check('die Vision-Animation `oracle_vision` kam vom Server', r.anims.includes('oracle_vision'), r.anims);
        const log = await logZeilen(page, 'Oracle');
        check('das Log nennt Ansage und Ergebnis', log.some(t => /declared/.test(t)) && log.some(t => treffer ? /hit/.test(t) : /miss/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf D: The Creepy Clown of Heaven — Aura, Besiegen, Nachwirkung, Gegner-Clown');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], eigeneZonen: zonen({ '1:0': 'The Creepy Clown of Heaven', '2:0': 'Sky Shaman' }), gegnerZonen: zonen({ '2:0': 'Sky Shaman' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await oeffneLog(page);
        const aura = await page.evaluate(() => {
          const cc = window.__gs.creatureCounters || {};
          const gebunden = Object.entries(cc).filter(([k, v]) => v && v.negated && v.negatedSourceBound === 'The Creepy Clown of Heaven').map(([k]) => k);
          return { gebunden, schamanAktiv: (window.__gs.activatableCreatures || []).filter(c => c.cardName === 'Sky Shaman').length };
        });
        check('Aura: beide Sky Shaman (meiner UND der des Gegners) tragen das abgeleitete „Negated“ mit dem Clown als Quelle — der Clown selbst nicht', aura.gebunden.length === 2 && !aura.gebunden.some(k => /-1-0$/.test(k) && k.startsWith(String(my))), aura);
        check('…und mein Schamane taucht nicht unter den aktivierbaren Creatures auf', aura.schamanAktiv === 0, aura);
        const abz = await page.evaluate((my) => { const e = document.querySelector(`[data-support-zone][data-support-owner="me"][data-support-hero="2"][data-support-slot="0"]`); return e ? e.textContent : null; }, my);
        check('das Abzeichen „🚫“ steht an meinem Schamanen', typeof abz === 'string' && abz.includes('🚫'), abz);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, 'clown-aura.png') }); } catch { /* egal */ } }
        // Besiegen mit einer Aktion (Action Phase)
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        const lst = await page.evaluate(() => (window.__gs.activatableCreatures || []).filter(c => c.cardName === 'The Creepy Clown of Heaven').map(c => ({ canActivate: c.canActivate, actionCost: c.actionCost, anyPlayer: !!c.anyPlayer })));
        check('Action Phase: der Clown ist als aktivierbar angeboten (Aktionskosten)', lst.length === 1 && lst[0].canActivate === true && lst[0].actionCost === true, lst);
        await page.evaluate(() => window.socket.emit('activate_creature_effect', { roomId: window.__gs.roomId, heroIdx: 1, zoneSlot: 0 }));
        const cf = await warteAufPrompt(page, 'confirm', 'Spend your Action');
        check('die Rückfrage „Spend your Action to defeat …?“ erscheint', !!cf && cf.titel === 'The Creepy Clown of Heaven', cf);
        await page.evaluate(() => { window.__anims.length = 0; });
        if (cf) await antwort(page, cf.id, { confirmed: true });
        await sleep(3000);
        const r = await page.evaluate((my) => ({
          abl: window.__gs.players[my].discardPile.slice(), zonen: window.__gs.players[my].supportZones.map(h => h.map(z => (z || [])[0] || null)),
          acted: (window.__gs.players[my].heroesActedThisTurn || []).length, anims: window.__anims.slice(),
          negiert: Object.values(window.__gs.creatureCounters || {}).filter(v => v && v.negated).length,
          quelle: Object.values(window.__gs.creatureCounters || {}).filter(v => v && v.negatedSourceBound).length,
        }), my);
        check('der Clown ist besiegt (Ablage), die Aktion ist verbraucht, die Animation `clown_pop` kam vom Server', r.abl.includes('The Creepy Clown of Heaven') && r.zonen[1][0] === null && r.acted === 1 && r.anims.includes('clown_pop'), r);
        check('Nachwirkung: beide Schamanen bleiben negiert (jetzt rundengebunden, nicht mehr an den Clown gebunden)', r.negiert === 2 && r.quelle === 0, r);
        const log = await logZeilen(page, 'Clown');
        check('das Log meldet das Besiegen und die Nachwirkung', log.some(t => /spent an Action to defeat/.test(t)) && log.some(t => /stay.*negated|negated.*rest of the turn/i.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
    {
      // Der Clown des GEGNERS: echter Klick auf das Brett
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], gegnerZonen: zonen({ '1:0': 'The Creepy Clown of Heaven' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await oeffneLog(page);
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        const e = await page.evaluate(() => (window.__gs.activatableCreatures || []).filter(c => c.cardName === 'The Creepy Clown of Heaven').map(c => ({ owner: c.owner, canActivate: c.canActivate, anyPlayer: !!c.anyPlayer, charmedOwner: c.charmedOwner })));
        check('Action Phase: der Clown des GEGNERS ist für mich als aktivierbar angeboten (`anyPlayer`, Gegenseite)', e.length === 1 && e[0].canActivate === true && e[0].anyPlayer === true && e[0].owner === 1 - my, e);
        await page.click('[data-support-zone][data-support-owner="opp"][data-support-hero="1"][data-support-slot="0"]');
        const cf = await warteAufPrompt(page, 'confirm', 'Spend your Action');
        check('ein echter KLICK auf den Gegner-Clown öffnet die Rückfrage (an MICH, den Aktivierenden)', !!cf && cf.titel === 'The Creepy Clown of Heaven', cf);
        if (outDir && cf) { try { await page.screenshot({ path: path.join(outDir, 'clown-gegner.png') }); } catch { /* egal */ } }
        if (cf) await antwort(page, cf.id, { confirmed: true });
        await sleep(3000);
        const r = await page.evaluate((my) => ({
          oppAbl: window.__gs.players[1 - my].discardPile.slice(), acted: (window.__gs.players[my].heroesActedThisTurn || []).length,
          zonen: window.__gs.players[1 - my].supportZones.map(h => h.map(z => (z || [])[0] || null)),
        }), my);
        check('der Gegner-Clown liegt in der Ablage SEINES Besitzers, meine Aktion ist verbraucht', r.oppAbl.includes('The Creepy Clown of Heaven') && r.zonen[1][0] === null && r.acted === 1, r);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }

    console.log('Lauf E: Cute Crown — Zusatzaktion für Cute Creatures, Nachteil für den Träger');
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], hand: ['Cute Bunny', 'Cute Bunny', 'Sky Shaman'], eigeneZonen: zonen({ '0:2': 'Cute Crown' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await oeffneLog(page);
        const az = await page.evaluate(() => (window.__gs.additionalActions || []).filter(a => a.typeId === 'cute_crown_summon').map(a => ({ heroRestricted: a.heroRestricted, karten: a.eligibleHandCards })));
        check('die Zusatzaktion der Krone ist im Zustand (Anbieter am Träger, wählbar NUR die Cute Creatures)', az.length === 1 && az[0].heroRestricted === true && az[0].karten.join() === 'Cute Bunny', az);
        // Main Phase: Cute Creature per echtem Drag & Drop aus der Hand auf einen freien Platz des Trägers
        const hand = await page.evaluate(() => { const e = document.querySelector('[data-hand-idx="0"]'); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
        const ziel = await page.evaluate(() => { const e = document.querySelector('[data-support-zone][data-support-owner="me"][data-support-hero="0"][data-support-slot="0"]'); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
        let gespielt = false;
        if (hand && ziel) {
          await page.mouse.move(hand.x, hand.y); await page.mouse.down();
          await page.mouse.move((hand.x + ziel.x) / 2, (hand.y + ziel.y) / 2, { steps: 8 });
          await page.mouse.move(ziel.x, ziel.y, { steps: 8 }); await sleep(150);
          await page.mouse.up();
          await sleep(2200);
          gespielt = await page.evaluate((my) => window.__gs.players[my].supportZones[0][0].includes('Cute Bunny'), my);
        }
        if (!gespielt) {
          // Falls der Drag in der Headless-Umgebung nicht greift: derselbe Server-Weg per Socket (der Client-Weg wird dann im Bericht ausgewiesen)
          console.log('  (Drag & Drop griff nicht — Server-Weg per Socket)');
          await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Cute Bunny', handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
          await sleep(2200);
        }
        const r1 = await page.evaluate((my) => ({ zonen: window.__gs.players[my].supportZones[0].map(z => (z || [])[0] || null), acted: (window.__gs.players[my].heroesActedThisTurn || []).length, anims: window.__anims.slice(), az: (window.__gs.additionalActions || []).filter(a => a.typeId === 'cute_crown_summon').length }), my);
        check(`die Cute Creature steht auf dem Brett (${gespielt ? 'per echtem Drag & Drop' : 'per Socket'}), der Held gilt NICHT als gehandelt`, r1.zonen[0] === 'Cute Bunny' && r1.acted === 0, r1);
        check('die Ladung ist verbraucht (Zusatzaktion weg), die Animation `crown_flutter` kam vom Server', r1.az === 0 && r1.anims.includes('crown_flutter'), r1);
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Cute Bunny', handIndex: 0, heroIdx: 0, zoneSlot: 1 }));
        await sleep(1500);
        const r2 = await page.evaluate((my) => window.__gs.players[my].supportZones[0].map(z => (z || [])[0] || null), my);
        check('einmal pro Zug: die zweite Cute Creature geht in der Main Phase NICHT (Platz 1 bleibt leer)', r2[1] === null, r2);
        const log = await logZeilen(page, 'Cute Crown');
        check('das Aktionslog nennt die Krone', log.some(t => /Cute Crown/.test(t) && /additional Action/.test(t)), log);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
    {
      const s = await seite(browser, AUFBAU({ deck: ['Fireball'], hand: ['Cute Bunny', 'Sky Shaman', 'Cute Bunny'], eigeneZonen: zonen({ '0:2': 'Cute Crown' }) }));
      try {
        const { page } = s;
        const my = await page.evaluate(() => window.__gs.myIndex);
        await page.evaluate(() => window.socket.emit('advance_phase', { roomId: window.__gs.roomId, targetPhase: 3 }));
        await sleep(1200);
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Cute Bunny', handIndex: 0, heroIdx: 0, zoneSlot: 0 }));
        await sleep(2200);
        const a = await page.evaluate((my) => ({ zonen: window.__gs.players[my].supportZones[0].map(z => (z || [])[0] || null), acted: (window.__gs.players[my].heroesActedThisTurn || []).length, phase: window.__gs.currentPhase }), my);
        check('Action Phase: die Cute Creature wird mit der Ladung beschworen — die Aktion des Helden bleibt FREI, die Phase wird nicht weitergeschaltet', a.zonen[0] === 'Cute Bunny' && a.acted === 0 && a.phase === 3, a);
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Sky Shaman', handIndex: 0, heroIdx: 0, zoneSlot: 1 }));
        await sleep(1500);
        const b = await page.evaluate((my) => window.__gs.players[my].supportZones[0].map(z => (z || [])[0] || null), my);
        check('die Nicht-Cute-Creature (Sky Shaman) geht beim TRÄGER nicht (Platz 1 bleibt leer)', b[1] === null, b);
        await page.evaluate(() => window.socket.emit('play_creature', { roomId: window.__gs.roomId, cardName: 'Sky Shaman', handIndex: 0, heroIdx: 1, zoneSlot: 0 }));
        await sleep(2000);
        const c = await page.evaluate((my) => ({ z: window.__gs.players[my].supportZones[1].map(z => (z || [])[0] || null), acted: (window.__gs.players[my].heroesActedThisTurn || []).length, phase: window.__gs.currentPhase }), my);
        check('…ein ANDERER Held (ohne Krone) beschwört sie mit seiner normalen Aktion (die Phase geht weiter)', c.z[0] === 'Sky Shaman' && c.acted === 1 && c.phase === 4, c);
        check('keine JS-Fehler im Browser', s.fehler.length === 0, s.fehler);
      } finally { await s.ctx.close(); }
    }
  } finally { await browser.close(); srv.child.kill(); }
  finish();
})().catch(e => { console.error(e); process.exit(1); });
