'use strict';
// A02-deepsea-13 · Cosmic Malfunction schützt nur die ERSTE "Cosmic Depths"-Kreatur, die derselbe Gegnereffekt trifft
//
// Kartentext (Cosmic Malfunction): „Play this card immediately when a "Cosmic Depths" Creature you control would be moved from your side of the board to anywhere else
// by an opponent's card or effect. Negate all effects that card or effect would have on "Cosmic Depths" Creatures you control this turn, and your opponent cannot
// activate cards with the same name as the negated card for the rest of the turn. Delete this card."
// Szene: Gegner spielt Trial of Dominance („Defeat all Creatures your opponent controls and delete them"). Ich habe Analyzer + Gatherer (beide Cosmic Depths) und einen Fremdling.
// Erwartung: BEIDE Cosmic-Depths-Kreaturen bleiben stehen (alle Wirkungen der Karte auf sie sind negiert), nur die Fremdkreatur wird besiegt.
// Beobachtet: Die Reaktion rettet nur den Analyzer; der Gatherer wird im selben Durchlauf besiegt und gelöscht (die Karte ist verbraucht, kein zweites Fenster).
// Ursache: `cosmic-malfunction.js` `cdMovementReactionResolve` bricht nur die laufende Entfernung dieses einen Opfers ab (Kommentar im Skript: „we rely on the source-name lock …");
//   für weitere Opfer desselben Effekts gibt es keine Markierung (`_inCdMovementReaction`-Fenster ist nach dem ersten Opfer zu, die Karte weg).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths';
  const t = await H.fresh({ hand: [['Cosmic Malfunction'], ['Trial of Dominance']] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
  const a = t.put(0, 0, 0, AN), g = t.put(0, 1, 0, GA), d = t.put(0, 2, 0, H.INERT.creature);
  a.turnPlayed = g.turnPlayed = d.turnPlayed = 1;
  await t.play(1, 'Trial of Dominance', { hero: 0 });
  const board = t.gs.players[0].supportZones.map(h => h[0] && h[0][0] || null);
  R.note('Brett Seat 0', board);
  R.check('Analyzer steht noch', board.includes(AN), board);
  R.check('Gatherer steht noch (ebenfalls Cosmic Depths, derselbe Effekt)', board.includes(GA), { board, geloescht: t.pile(0, 'deletedPile') });
  R.check('Die Fremdkreatur wurde besiegt (nicht geschützt)', !board.includes(H.INERT.creature), board);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
