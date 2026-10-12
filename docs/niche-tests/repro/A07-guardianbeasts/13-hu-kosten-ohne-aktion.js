'use strict';
// A07-13 · Guardian Beast Hu: 5 Karten werden gelöscht, auch wenn die Zusatzaktion unmöglich ist oder abgebrochen wird
//
// Kartentext Hu: „… You may once per turn delete 5 cards total from both discard piles to immediately perform an additional
//   Action with any Hero you control."
// Konvention: „Zielende Karten sind immer abbrechbar (Abbruch = nichts ist passiert)" (CARD_API.md); Ruling „Tuscan Artist" 16.8.
//   (Triceras/Techno Harpyformer): ist die Wirkung unmöglich, ist der Effekt nicht aktivierbar und verbraucht nichts.
// Beobachtet: `canActivateCreatureEffect` (guardian-beast-hu.js:61) prüft nur „≥5 Karten in den Ablagen + ein lebender Held".
//   `onCreatureEffect` löscht zuerst die 5 Karten und ruft dann `performImmediateActionAnyHero`, das bei nichts Spielbarem
//   still endet bzw. abgebrochen werden kann – die Kosten und die Einmal-pro-Zug-Sperre sind weg.
// Erwartung (Frage an Al, Stufe C): Soll Hu nur aktivierbar sein, wenn eine Handkarte spielbar ist, und soll der Abbruch der
//   Aktionswahl die Kosten zurückgeben? Dieses Skript prüft diese Lesart (✗ = Beobachtung tritt auf).
const H = require('../../lib/h.js');
const F = H.INERT.filler;

async function lauf(hand, grant, abbrechen) {
  const t = await H.fresh({ hand: [hand, []], discard: [Array(5).fill(F), []], deckSize: 20 });
  const hu = t.put(0, 0, 0, 'Guardian Beast Hu'); hu.turnPlayed = 1;
  if (grant) t.grantFor(0, 0, 'Fireball');
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = d.cards.map((c, i) => i).slice(0, 5); return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  if (abbrechen) t.script.push({ match: d => d && d.type === 'heroAction', answer: () => null });
  t.gs.activePlayer = 0; t.phase(2);
  const kann = H.loadCardEffect('Guardian Beast Hu').canActivateCreatureEffect(t.engine._createContext(hu, { event: 'canCreatureEffectCheck' }));
  const r = await t.activateCreature(0, 0, 0);
  return { t, kann, r };
}

(async () => {
  const R = H.runner();
  R.section('Hand leer: nichts spielbar');
  let o = await lauf([], false, false);
  R.check('Hu ist bei leerer Hand nicht aktivierbar / verbraucht keine Karten', !o.kann || o.t.pile(0, 'deletedPile').length === 0, { kann: o.kann, geloescht: o.t.pile(0, 'deletedPile').length });

  R.section('spielbare Karte, Aktionswahl abgebrochen');
  o = await lauf(['Fireball'], true, true);
  R.check('Abbruch der Aktionswahl gibt die 5 Karten zurück (nichts gelöscht)', o.t.pile(0, 'deletedPile').length === 0, { geloescht: o.t.pile(0, 'deletedPile').length, ablage: o.t.pile(0, 'discardPile').length });
  R.check('keine Engine-Fehler', o.t.errors.length === 0, o.t.errors);
  R.finish();
})();
