'use strict';
// A07-18 · Mao zahlt 5 Karten und negiert die Bestie, auch wenn deren Effekt gar nicht feuern kann
//
// Kartentext Mao: „… choose a "Guardian Beast" Creature you control that was summoned this turn. Delete 5 cards total from both
//   discard piles to immediately activate that Creature's active effect. Negate that Creature's effects … afterwards."
// Beobachtet (mao-the-vengeful-guardian.js:162): Mao ruft `onCreatureEffect` direkt; weder `canActivateCreatureEffect` noch
//   die HOPT-Marke `creature-effect:<id>` der Bestie wird gelesen/gesetzt. Kann die Bestie gar nicht feuern (Zhu: eigene Ablage
//   < 8), zahlt Mao trotzdem 5 Karten und negiert die Bestie. (Die HOPT-Umgehung – Bestie hat schon selbst aktiviert – ist nur
//   mit Haste erreichbar und wird hier nicht gemeldet.)
// Frage an Al steht im Bericht (Stufe C); das Skript hält die Beobachtung fest (✗ = tritt auf).
const H = require('../../lib/h.js');
const F = H.INERT.filler;

(async () => {
  const R = H.runner();

  R.section('Zhu kann nicht feuern (eigene Ablage < 8)');
  const t = await H.fresh({ heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [Array(6).fill(F), Array(6).fill(F)], deckSize: 20 });
  const zhu = t.put(0, 0, 0, 'Guardian Beast Zhu');
  t.gs.activePlayer = 0; t.phase(2);
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => { const idx = [0,1,2,3,4]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  t.targetFn = (v) => [v.find(x => x.cardName === 'Guardian Beast Zhu').id];
  await t.activateHero(0, 0, {});
  R.check('Mao zahlt keine 5 Karten und negiert Zhu nicht, wenn Zhu gar nicht feuern kann', t.pile(0, 'deletedPile').length === 0 && !zhu.counters.negated, { geloescht: t.pile(0, 'deletedPile').length, zhuNegiert: !!zhu.counters.negated });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
