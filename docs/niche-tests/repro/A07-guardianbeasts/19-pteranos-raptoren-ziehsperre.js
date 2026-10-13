'use strict';
// A07-19 · Pteranos und Raptoren prüfen die Ziehsperre (Tuscan Artist) nicht – Kosten/Once-per-turn verbrannt, nichts gezogen
//
// Kartentexte (data/cards.json):
//   Tuscan Artist: „While you control this Creature, any effect that would allow your opponent to draw 2 or 3 cards is negated."
//   Gigantisaur Pteranos: „You may once per turn discard any number of "Gigantisaur" Creatures with different names from your hand
//     (min 1) to draw twice that many cards."
//   Gigantisaur Raptoren: „… You may once per turn draw cards equal to the number of "Gigantisaur" Creatures you control."
//   Ruling CARD_API.md / `_draw-block-shared.js` (16.8.): „Ist der Zug der einzige Nutzen — auch wenn dafür Kosten anfallen — dann ist
//     der aktive Effekt GESPERRT und wird ausgegraut. Ein Effekt, der so nicht feuern kann, verbraucht auch sein Once-per-turn NICHT."
//
// Erwartung: Pteranos (nur ein Gigantisaurier-Name auf der Hand ⇒ Zug von genau 2) und Raptoren (genau 2 Gigantisaurier ⇒ Zug von genau 2)
//   sind bei gegnerischem Tuscan Artist nicht aktivierbar (wie Gigantisaur Triceras, Techno Harpyformer u. a., die `drawWouldBeBlocked` fragen).
// Beobachtet: beide lassen sich aktivieren; Pteranos legt die Karte ab, Raptoren verbraucht den Zug; es wird nichts gezogen (Artist negiert).
//   Triceras (Gegenprobe) ist korrekt gesperrt.
// Vermutete Ursache: `gigantisaur-pteranos.js canActivateCreatureEffect` und `gigantisaur-raptoren.js canActivateCreatureEffect` rufen
//   `drawWouldBeBlocked` (`_draw-block-shared.js`) nicht auf; `gigantisaur-triceras.js:19` tut es.
const H = require('../../lib/h.js');
const D = H.INERT.creature, F = H.INERT.filler;

async function aktivieren(t, seat, hi, slot) { t.gs.activePlayer = seat; t.phase(2); return t.activateCreature(seat, hi, slot); }
function dino(t, seat, hi, slot, name) { const i = t.put(seat, hi, slot, name); i.turnPlayed = 1; return i; }

(async () => {
  const R = H.runner();

  R.section('Gegenprobe: Triceras + Tuscan Artist (Zug von genau 3)');
  {
    const t = await H.fresh({ hand: [[F], []], deckSize: 10 });
    dino(t, 0, 0, 0, 'Gigantisaur Triceras'); dino(t, 1, 0, 0, 'Tuscan Artist');
    const r = await aktivieren(t, 0, 0, 0);
    R.check('Triceras ist bei gegnerischem Tuscan Artist gesperrt (Karte bleibt auf der Hand)', t.pile(0, 'hand').length === 1, { r, hand: t.pile(0, 'hand') });
  }

  R.section('Pteranos mit genau einem Gigantisaurier-Namen auf der Hand + gegnerischer Tuscan Artist');
  {
    const t = await H.fresh({ hand: [['Gigantisaur Spinor'], []], deckSize: 10 });
    dino(t, 0, 0, 0, 'Gigantisaur Pteranos'); dino(t, 1, 0, 0, 'Tuscan Artist');
    t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
    const r = await aktivieren(t, 0, 0, 0);
    R.check('Pteranos ist gesperrt (Spinor bleibt auf der Hand, Once-per-turn nicht verbraucht)',
      t.pile(0, 'hand').includes('Gigantisaur Spinor') && Object.keys(t.gs.hoptUsed || {}).length === 0,
      { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile'), hopt: t.gs.hoptUsed });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('Raptoren mit genau 2 Gigantisauriern (Zug von genau 2) + gegnerischer Tuscan Artist');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 10 });
    dino(t, 0, 0, 0, 'Gigantisaur Raptoren'); dino(t, 0, 1, 0, 'Gigantisaur Spinor'); dino(t, 1, 0, 0, 'Tuscan Artist');
    const r = await aktivieren(t, 0, 0, 0);
    R.check('Raptoren ist gesperrt (Once-per-turn nicht verbraucht)', Object.keys(t.gs.hoptUsed || {}).length === 0,
      { r, hand: t.pile(0, 'hand').length, hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
