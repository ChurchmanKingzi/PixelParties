'use strict';
// A03-futuretech-17 · Future Tech Database: Abbruch der ersten Wahl verbraucht Karte und 10 Gold
//
// Kartentext: „Choose as many "Future Tech" cards with different names from your deck as there are "Future Tech Database" cards in your discard pile, except
//   "Future Tech Database", reveal them and add them to your hand."
// Regel (CARD_API.md Z. 367-390, „Zielende Karten sind immer abbrechbar" – Galerie/Zielwahl, Abbruch heißt: nichts ist passiert, Karte bleibt auf der Hand):
//   Bricht der Spieler die ERSTE Galerie ab, sollte die Database wieder auf der Hand liegen und das Gold unverändert sein (Gegenprobe: Blueprints, Mysterious Core).
// Beobachtet: Die Database wird ausgespielt (liegt in der Ablage), 10 Gold sind bezahlt, nichts wurde geholt, die Karte zählt als ausgespielt.
// Ursache: cards/effects/future-tech-database.js `resolve`: `if (!name) break;` → am Ende `return { ok: true }` statt `{ cancelled: true }`, wenn noch nichts gewählt wurde.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DB = 'Future Tech Database';
  const deck = ['Future Tech Gun', 'Future Tech Jetpack', 'Future Tech Lamp', DB, H.INERT.creature];
  const cancel = (t) => t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cancelled: true }) });

  let t = await H.fresh({ hand: [[DB], []], discard: [[DB, DB], []], deck: [deck, []], gold: [100, 100] });
  cancel(t);
  const r = await t.play(0, DB);
  const gold = t.gs.players[0].gold;
  R.check('Database: Abbruch der ersten Galerie -> Karte wieder auf der Hand', t.pile(0, 'hand').includes(DB), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('Database: Abbruch der ersten Galerie -> Gold unverändert (100)', gold === 100, { gold });

  // Gegenprobe Mysterious Core (gleiche Konvention „Galerie abbrechen")
  t = await H.fresh({ hand: [['Mysterious Core'], []], deck: [[...deck, 'Mysterious Core'], []], gold: [100, 100] });
  cancel(t);
  await t.play(0, 'Mysterious Core');
  R.check('Gegenprobe Mysterious Core: Abbruch -> Karte auf der Hand, Gold 100', t.pile(0, 'hand').includes('Mysterious Core') && t.gs.players[0].gold === 100, { hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
