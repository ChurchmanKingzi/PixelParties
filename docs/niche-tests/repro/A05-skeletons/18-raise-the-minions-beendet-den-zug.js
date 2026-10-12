'use strict';
// A05-skeletons-18 · Raise the Minions! beendet den Zug des Spielers, der Kartentext sagt davon nichts (Regelfrage)
// Kartentext (data/cards.json): „Choose up to 3 "Skeleton" Creatures from your discard pile and place them into free Support Zones of the user."
// Skript: `raise-the-minions.js` setzt am Ende `gs._spellEndsTurn = true` („Card text: this Spell ends the caster's turn after resolving"); CARD_API v673
//   zählt „Raise the Minions" unter die Karten mit „diese Karte beendet den Zug". Im Kartentext steht die Zeile „Immediately end your turn afterwards" NICHT
//   (anders als bei Tanuki Escape/Premonition).
// Beobachtet: Nach dem Wirken ist der Gegner am Zug (Zug 5 → 6, activePlayer 1).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Raise the Minions!'], []], discard: [['Skeleton Archer'], []] });
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Skeleton Archer'] }) });
  const turn0 = t.gs.turn;
  await t.play(0, 'Raise the Minions!', { hero: 0 });
  R.check('Kontrolle: Skelett wurde gelegt', t.gs.players[0].supportZones[0].some(z => z[0] === 'Skeleton Archer'), t.gs.players[0].supportZones[0]);
  R.check('Text-Lesart: der Zug des Wirkers endet NICHT automatisch', t.gs.activePlayer === 0 && t.gs.turn === turn0, { turn: t.gs.turn, aktiv: t.gs.activePlayer });
  R.finish();
})();
