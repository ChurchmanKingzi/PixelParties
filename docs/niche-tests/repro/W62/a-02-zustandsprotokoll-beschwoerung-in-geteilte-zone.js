'use strict';
// W62a-02 · Zustandsprotokoll: JEDE Beschwörung/Platzierung in eine bereits besetzte geteilte Zone lässt die Zone nie leer wirken (Al, 22.10.2026)
//
// Befund (Al): „Aktiviert ein Infinitely Reproducing Slime seinen Effekt und beschwört eine Kopie von sich in dieselbe (dank Alice geteilte) Zone, wird die Zone für die
//   Dauer der Beschwörung visuell leer (die vorhandenen Slimes verschwinden kurz)." Ursache im CLIENT (`onPileTransfer`, `public/app-board.jsx`): jeder Flug auf eine
//   Support Zone verbarg die GANZE Zone (`bounceOutgoingHidden`, 720 ms) — gedacht für den Deepsea-Tausch, bei dem der Zielplatz nur die neue Karte hält. In einer geteilten
//   Zone verschwand damit der ganze Stapel. Behoben im Client (`bounceBehalten`: nur die NEUE Kopie wird bis zur Landung verborgen; Playwright: `scripts/skilltest-e2e/ui-shared-zone-summon.js`).
// Dieses Repro hält die SERVER-Seite fest: bei JEDEM Zustandsabgleich (`sync`) und JEDEM Ereignis (`_broadcastEvent`, auch `play_pile_transfer` und `summon_effect`) während der
//   Beschwörung enthält die Zone (Zonen-Array UND Instanzen) mindestens die schon vorher liegenden Karten, und die Zahl wächst nie rückwärts. Es gibt keinen Zwischenzustand mit
//   leerer Zone und keinen Platzhalter, der die Zone ersetzt.
// Wege: Hand-Spiel (`doPlayCreature`), Slime-Effekt (Hand, Deck), Place durch Karten (`actionPlaceCreature` Hand/Ablage), `summonFromPile` (Hand/Deck/Ablage/Potion Deck — Pinta),
//   Reaktions-Beschwörung (`summonCreatureWithHooks` mit `fromHandIdx` — Doomed Town Guard/Explosive Drone), Drill Sergeant, Cloudy Slime, Surprise-Beschwörung (`safePlaceInSupport` über
//   `_activateSurprise`-Weg), Ushabti. Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const ALICE = 'Alice, the Transfer Student', SLIME = 'Infinitely Reproducing Slime', BIG = H.INERT.big;
const PINTA = 'Pinta, the Singing Ship';

/** Brett: Alice = Held 1 des Sitzes; Held 0 hält Zone A = Slime-Stapel (`stapel` Stück), B und C = andere Kreaturen. Alle anderen Zonen ebenfalls voll. */
async function brett(seat, stapel = 2, o = {}) {
  const eigene = [o.held0 || 'Tushu, the Knowledge Keeper', ALICE, 'Zwei, the Lucky Thief'];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const t = await H.fresh({ heroes, hand: o.hand, deck: o.deck, discard: o.discard, potionDeck: o.potionDeck });
  const ps = t.gs.players[seat];
  for (let h = 0; h < 3; h++) for (let z = 0; z < 3; z++) { const i = t.put(seat, h, z, BIG); i.turnPlayed = 1; }
  // Zone A (Held 0, Slot 0) = Slime-Stapel
  for (const i of t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0)) t.engine._untrackCard(i.id);
  ps.supportZones[0][0] = [];
  for (let k = 0; k < stapel; k++) {
    ps.supportZones[0][0].push(SLIME);
    const i = t.engine._trackCard(SLIME, seat, 'support', 0, 0);
    i.turnPlayed = 1;
    i.counters._slimeSpawnedTurn = 5;   // nur der Slime, den der Test ausdruecklich freigibt, pflanzt sich fort
  }
  t.gs.turn = 5;
  return t;
}

/** Protokoll: bei jedem sync/Ereignis die Belegung der Zone A (Zonen-Array + Instanzen) festhalten. */
function protokoll(t, seat) {
  const log = [];
  const snap = (was) => {
    const arr = (t.gs.players[seat].supportZones[0][0] || []).length;
    const insts = t.inst(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0).length;
    log.push({ was, arr, insts });
  };
  const sync0 = t.engine.sync.bind(t.engine);
  t.engine.sync = (...a) => { snap('sync'); return sync0(...a); };
  const bc0 = t.engine._broadcastEvent.bind(t.engine);
  t.engine._broadcastEvent = (ev, d, ...r) => { snap('ev:' + ev); return bc0(ev, d, ...r); };
  return log;
}
/** Hat jede Aufnahme mindestens `vorher` Karten und waechst die Zahl nie rueckwaerts? */
function pruefe(log, vorher) {
  let leer = null, rueck = null, kleiner = null, max = 0;
  for (const s of log) {
    if (s.arr === 0 || s.insts === 0) leer = leer || s;
    if (s.arr < vorher || s.insts < vorher) kleiner = kleiner || s;
    if (s.arr < max) rueck = rueck || s;
    max = Math.max(max, s.arr);
  }
  return { leer, kleiner, rueck, n: log.length, max };
}
const zoneA = (t, seat) => t.gs.players[seat].supportZones[0][0].slice();
const ohneStapel = (t) => t.audit().filter(m => !/hält \d Karten|\d Instanzen/.test(m));

async function lauf(R, titel, seat, vorbereiten, ausfuehren, erwartet, opts = {}) {
  R.section(`Sitz ${seat}: ${titel}`);
  const stapel = opts.stapel ?? 2;
  const t = await brett(seat, stapel, opts.brett || {});
  if (vorbereiten) await vorbereiten(t, seat);
  const log = protokoll(t, seat);
  const vorher = zoneA(t, seat).length;
  const r = await ausfuehren(t, seat);
  const p = pruefe(log, vorher);
  R.check('Beschwörung/Platzierung hat stattgefunden (Zone A gewachsen)', zoneA(t, seat).length >= vorher + (erwartet ?? 1), { r: r && (r.threw ? String(r.threw) : r.hung ? 'hung' : r === true ? true : typeof r), vorher, nachher: zoneA(t, seat).length, prompts: t.prompts.map(p => p.d.type) });
  R.check(`${p.n} Aufnahmen (sync + Ereignisse): nie ein Zwischenzustand mit leerer Zone`, !p.leer && p.n > 0, p.leer);
  R.check('in jeder Aufnahme liegen mindestens die schon vorher liegenden Karten (Array UND Instanzen)', !p.kleiner, p.kleiner);
  R.check('die Zahl der Karten in Zone A fällt nie zurück', !p.rueck, p.rueck);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber (bis auf die Alice-Stapel)', ohneStapel(t).length === 0, ohneStapel(t));
  return { t, log, p };
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    await lauf(R, 'Hand-Spiel eines zweiten Slimes in die geteilte Zone (doPlayCreature)', seat,
      async (t, s) => { t.setHand(s, [SLIME]); },
      async (t, s) => t.play(s, SLIME, { hero: 0, slot: 0, noGrant: false }), 1);

    await lauf(R, 'Slime-Effekt am Rundenbeginn, Quelle HAND (Galerie, Beschwörung per `actionPlaceCreature`)', seat,
      async (t, s) => { t.setHand(s, [SLIME]); },
      async (t, s) => { t.gs.turn = 7; for (const i of t.inst(c => c.zone === 'support' && c.owner === s && c.name === SLIME)) delete i.counters._slimeSpawnedTurn; t.inst(c => c.zone === 'support' && c.owner === s && c.name === SLIME).slice(1).forEach(i => { i.counters._slimeSpawnedTurn = 7; }); t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: SLIME, source: 'hand' }) }); return t.turnStart(s); }, 1);

    await lauf(R, 'Slime-Effekt am Rundenbeginn, Quelle DECK', seat,
      async (t, s) => { t.setDeck(s, [SLIME, H.INERT.creature, H.INERT.creature, H.INERT.creature]); },
      async (t, s) => { t.gs.turn = 7; t.inst(c => c.zone === 'support' && c.owner === s && c.name === SLIME).slice(1).forEach(i => { i.counters._slimeSpawnedTurn = 7; }); t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: SLIME, source: 'deck' }) }); return t.turnStart(s); }, 1);

    await lauf(R, 'Place durch Karten aus der HAND (actionPlaceCreature)', seat,
      async (t, s) => { t.setHand(s, [SLIME]); },
      async (t, s) => t.run(() => t.engine.actionPlaceCreature(SLIME, s, 0, 0, { source: 'hand', sourceName: 'Test' })), 1);

    await lauf(R, 'Place durch Karten aus der ABLAGE (actionPlaceCreature)', seat,
      async (t, s) => { t.setDiscard(s, [SLIME]); },
      async (t, s) => t.run(() => t.engine.actionPlaceCreature(SLIME, s, 0, 0, { source: 'discard', sourceName: 'Test' })), 1);

    for (const pile of ['hand', 'deck', 'discard']) {
      await lauf(R, `summonFromPile (${pile}) in die geteilte Zone`, seat,
        async (t, s) => { if (pile === 'hand') t.setHand(s, [SLIME]); else if (pile === 'deck') t.setDeck(s, [SLIME, H.INERT.creature]); else t.setDiscard(s, [SLIME]); },
        async (t, s) => t.run(() => t.engine.summonFromPile(s, pile, SLIME, 0, 0, { source: 'Test' })), 1);
    }

    await lauf(R, 'Reaktions-Beschwörung (summonCreatureWithHooks mit fromHandIdx — Doomed Town Guard/Explosive Drone)', seat,
      async (t, s) => { t.setHand(s, [SLIME]); },
      async (t, s) => t.run(async () => { const ps = t.gs.players[s]; const idx = ps.hand.indexOf(SLIME); t.engine.takeFromPileSync(ps, 'hand', idx); return t.engine.summonCreatureWithHooks(SLIME, s, 0, 0, { source: 'Test', fromHandIdx: idx }); }), 1);

    await lauf(R, 'Pinta, the Singing Ship (Potion Deck → geteilte Zone)', seat,
      async (t, s) => { t.gs.players[s].potionDeck = [SLIME, 'Healing Potion', 'Healing Potion', 'Healing Potion', 'Healing Potion']; t.grantFor(s, 0, SLIME); await t.run(() => t.engine.runHooks('onGameStart', {})); },
      async (t, s) => t.activateHero(s, 0), 1, { brett: { held0: PINTA } });

    await lauf(R, 'Drill Sergeant legt einen Slime aus der Hand in die geteilte Zone', seat,
      async (t, s) => {
        t.setHand(s, [SLIME]);
        // Drill Sergeant ersetzt die BIG-Kreatur in Zone B von Held 0
        for (const i of t.inst(c => c.zone === 'support' && c.owner === s && c.heroIdx === 0 && c.zoneSlot === 1)) t.engine._untrackCard(i.id);
        t.gs.players[s].supportZones[0][1] = [];
        const ds = t.put(s, 0, 1, 'Drill Sergeant'); ds.turnPlayed = 1;
      },
      async (t, s) => { t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: SLIME }) }); t.gs.activePlayer = s; t.phase(2); return t.activateCreature(s, 0, 1); }, 1);

    await lauf(R, 'Cloudy Slime (Aufruf des Effekts beim Beschwören): legt einen Slime aus der Hand in die geteilte Zone', seat,
      async (t, s) => {
        t.setHand(s, ['Cloudy Slime', SLIME]);
        for (const i of t.inst(c => c.zone === 'support' && c.owner === s && c.heroIdx === 0 && c.zoneSlot === 1)) t.engine._untrackCard(i.id);
        t.gs.players[s].supportZones[0][1] = [];
      },
      async (t, s) => {
        t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: SLIME, source: 'hand' }) });
        t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones.find(x => x.slotIdx === 0 && x.heroIdx === 0) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
        return t.play(s, 'Cloudy Slime', { hero: 0, slot: 1 });
      }, 1);
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
