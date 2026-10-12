'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-03 · Madaga unter Such-Sperre: Nachteil („Forsaken") greift, obwohl die Suche nichts bringt
//
//  Karte: Madaga, the Forsaken Seafarer (`cards/effects/madaga-the-forsaken-seafarer.js`)
//  Kartentext: „You may once per turn reveal a card from your hand to search your deck for a copy of that card, reveal it
//  and add it to your hand. For the rest of the turn, all cards that would go to your discard pile are deleted instead."
//  Ruling (CARD_API.md „Such-Sperre: die vier Gruppen", 14.9.): Karten, die im Deck suchen und daneben einen Nachteil haben,
//  sind unter der Such-Sperre UNSPIELBAR – „unter der Sperre zahlt man und bekommt nichts" soll nicht möglich sein.
//  Erwartung: Mit `ps.searchLocked` (Cats of the Pharaoh) ist Madagas Effekt nicht aktivierbar (wie unter `handLocked`,
//  das `canActivateHeroEffect` prüft) – jedenfalls entsteht kein Nachteil ohne Ertrag.
//  Beobachtung (✗): Der Effekt läuft, `actionAddCardFromDeckToHand` fügt nichts hinzu, aber `enableDiscardToDelete` wird
//  trotzdem gesetzt (Ablage-Umleitung aktiv) und das HOPT ist verbraucht.
//  Ursache: `canActivateHeroEffect` prüft nur `ps.handLocked`; Heldenskripte tragen weder `blockedBySearchLock` noch eine eigene Prüfung,
//  und `onHeroEffect` wertet das Ergebnis von `actionAddCardFromDeckToHand` nicht aus (Zeile ~100).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/03-madaga-suchsperre.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const lock of ['handLocked', 'searchLocked']) {
    const t = await H.fresh({ heroes: [['Madaga, the Forsaken Seafarer', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null],
      hp: 400, hand: [['Heal', 'Heal', 'Fireball'], []], deck: [['Heal', 'Fireball', 'Heal', 'ZZ Dummy'], null] });
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: [{ cardName: 'Heal', handIndex: d.eligibleIndices[0] }] }) });
    t.gs.players[0][lock] = true;
    const r = await t.activateHero(0, 0, { effect: 'Madaga, the Forsaken Seafarer' });
    const nachteil = !!t.gs.players[0]._discardToDeleteActive;
    R.note(`${lock}: aktivierbar=${r}, Hand=${t.pile(0, 'hand').length}, Nachteil aktiv=${nachteil}`);
    R.check(`${lock}: kein Nachteil ohne Ertrag (Hand unverändert ⇒ Ablage-Umleitung darf nicht laufen)`, !(nachteil && t.pile(0, 'hand').length === 3), { r, nachteil, hand: t.pile(0, 'hand') });
    R.check(`${lock}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
