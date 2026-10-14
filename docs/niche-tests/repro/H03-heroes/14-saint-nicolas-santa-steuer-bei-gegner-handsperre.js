'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-14 · Saint Nicolas / Santa Klaus: ist der Gegner hand-gesperrt, wird die Pflicht-Abgabe nie fällig – die Aktion ist gratis
//
//  Karten: Saint Nicolas (`saint-nicolas.js`, `commitHeroActionCost`), Santa Klaus (`santa-klaus.js`, `afterSpellResolved`: „if (!ok) break; // Gegenseite kann nicht annehmen (handLocked)")
//  Kartentext Saint Nicolas: „You must add a Potion from your hand to your opponent's hand to perform an Action with this Hero."
//  Kartentext Santa: „Whenever this Hero uses an Attack or Spell, you must add 2 cards from your hand to your opponent's hand."
//  Engine: `handLocked` „sperrt ALLES: Draws UND Suchen/Tutoren/Adds" (_engine.js ~10627); `actionTransferCardToOppHand` gibt dann `false` zurück.
//  Beide Skripte behandeln die Pflicht-Abgabe sonst als Spielbarkeits-Voraussetzung (Saint Nicolas `canPerformAction`: ohne Trank keine Aktion; Santa `canPlayCard`:
//  Al 14.9. „He cannot act while the player has fewer than 2 cards in hand"). Ist die Abgabe unmöglich, weil der Gegner nichts annehmen kann, greift diese Sperre nicht.
//  Beobachtung (✗): Die Aktion läuft, der Gegner-Hand bleibt leer, der Wirker behält Trank bzw. beide Karten – die „Steuer" entfällt vollständig.
//  Entscheidung Al (Welle 7, 14.10.2026): die Aktion ist gesperrt, solange der Gegner die Pflicht-Karten nicht annehmen kann (Hand-/Such-Sperre).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/14-saint-nicolas-santa-steuer-bei-gegner-handsperre.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  for (const [held, hand, karten] of [['Saint Nicolas', ['Attack', 'Elixir of Quickness'], 1], ['Santa Klaus', ['Attack', 'Heal', 'Heal'], 2]]) {
    for (const gesperrt of [false, true]) {
      const t = await H.fresh({ heroes: [[held, ...fill], null], hp: 600, hand: [hand, []], deck: [Array(20).fill('Heal'), Array(20).fill('Heal')] });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
      t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => ({ handIndex: d.eligibleIndices[d.eligibleIndices.length - 1] }) });   // nie die laufende Karte (vgl. 12)
      if (gesperrt) t.gs.players[1].handLocked = true;
      const r = await t.play(0, 'Attack', { hero: 0 });
      const abgegeben = hand.length - 1 - t.pile(0, 'hand').length;
      R.note(`${held}, Gegner handLocked=${gesperrt}`, { r, hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand'), abgegeben });
      if (!gesperrt) R.check(`${held}: Kontrolle ohne Sperre – ${karten} Karte(n) abgegeben`, r === true && abgegeben === karten, { r, abgegeben });
      else R.check(`${held}: mit Gegner-Handsperre ist die Aktion gesperrt (Welle 7, Al 14.10.: kein Preis ohne Wirkung, Karten bleiben auf der Hand)`, r === false && t.pile(0, 'hand').length === hand.length && t.pile(1, 'hand').length === 0, { r, abgegeben, hand0: t.pile(0, 'hand') });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})();
