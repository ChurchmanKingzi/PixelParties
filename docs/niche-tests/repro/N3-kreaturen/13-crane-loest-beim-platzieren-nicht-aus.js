'use strict';
// N3-13 · Scavenging Crane: der Einsatz-Effekt läuft nicht, wenn die Kreatur PLATZIERT statt aus der Hand beschworen wird – Frolake, Festive Werz und Gangster Angel (gleicher Wortlaut) schon (Stufe C)
// Kartentext (Crane): „When you summon this Creature, look at the top 5 cards of your deck and put them back in any order. You may shuffle your deck afterwards. Then, draw 1 card."
// Kartentext (Frolake): „When you summon this Creature, draw 2 cards." · (Festive Werz) „When you summon this Creature, pay your opponent any amount of Gold …"
// Ruling Welle 9 / Q9 (A02-deepsea-10, Al): „‚place' ist eine Unterform von ‚summon' für Trigger und Reaktionen, die auf Beschwörungen reagieren."  Welle 10 / Q47: jede Platzierung zählt als Beschwörung.
//   Gegenläufig: der Kopfkommentar von scavenging-crane.js („Beschwörung, keine Platzierung", Muster Knight of Kings/Wire Hatchling, Vorgabe 2.10.) – `counters.isPlacement` als Riegel (`scavenging-crane.js` Z. 37).
// Aufbau: Drill Sergeant platziert (Effekt, „place") Frolake bzw. Crane aus der Hand.
// Beobachtet (vor Welle 25): Frolake zieht 2 Karten; Crane tut nichts (kein Ordnen, kein Ziehen).
// ENTSCHIEDEN (Al, Welle 25: „ja, definitiv! … place triggert On-Summon"): auch beim PLATZIEREN löst „When you summon this Creature, …" aus. Das Repro prüft diese Regel (Exit 0 = Crane zieht
//   beim Platzieren wie Frolake); die allgemeine Regel samt Platzierer-Liste steht in CARD_API.md („Platzieren triggert On-Summon"), weitere Repros: docs/niche-tests/repro/W25/c-place-triggert-on-summon.js.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(karte) {
    const t = await H.fresh({ hand: [[karte], []], deck: [Array(20).fill(H.INERT.creature), []] });
    t.put(0, 0, 0, 'Drill Sergeant').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Drill Sergeant', answer: () => ({ cardName: karte }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const deck0 = t.pile(0, 'mainDeck').length;
    await t.activateCreature(0, 0, 0);
    return { liegt: !!t.find(karte, 'support'), gezogen: deck0 - t.pile(0, 'mainDeck').length, errors: t.errors };
  }
  const f = await lauf('Frolake');
  R.check('Vergleich: Frolake (platziert) zieht ihre 2 Karten', f.liegt && f.gezogen === 2, f);
  const c = await lauf('Scavenging Crane');
  R.check('Scavenging Crane (platziert) zieht ihre 1 Karte wie Frolake ihre 2 (Einsatz-Effekt feuert)', c.liegt && c.gezogen === 1, c);
  R.check('keine Engine-Fehler', f.errors.length + c.errors.length === 0);
  R.finish();
})();
