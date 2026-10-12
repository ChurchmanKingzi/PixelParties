'use strict';
// A01-pollution-15 · Magic Mirror: die „Kopie“ des Zaubers landet als echte Karte in der Ablage des Spiegel-Besitzers (Kartenvermehrung)
// Kartentext: „Activate this Surprise when the user would be hit by a Spell. Negate that Spell. Additionally, the user immediately performs a copy of it as an
//   additional Action, ignoring its level. Place a number of Pollution Tokens into your free Support Zones equal to the negated Spell's level.“
// Erwartung: der negierte Original-Zauber geht in die Ablage seines Spielers, die Magic Mirror in die Ablage des Spiegel-Besitzers; die KOPIE ist keine Karte und
//   verschwindet nach der Ausführung (Kartenbilanz: +0 für den gespielten Zauber, Token +n).
// Beobachtet: nach der Ausführung der Kopie liegt der Zaubername zusätzlich in der Ablage des Spiegel-Besitzers (Kartenbilanz: der Zauber +1). Der Spiegel-Besitzer
//   hat damit eine zweite „Eraser Beam/Pyroblast/…“ in der Ablage, die er z. B. mit Spontaneous Reappearance / Mass Multiplication wieder auf die Hand holen kann.
// Ursache: cards/effects/magic-mirror.js, `finally`-Block in `onSurpriseActivate`: `if (!gs._spellPlacedOnBoard) { ps.discardPile.push(sourceCard); … }`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/15-magic-mirror-kopie-landet-als-karte-in-ablage.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pyroblast'], []] });
  t.putSurprise(1, 0, 'Magic Mirror'); t.grantFor(1, 0, 'Magic Mirror');
  t.put(0, 0, 0, 'Soul Shard Ba');
  let n = 0;
  t.targetFn = (v) => { n++; return [v.find(x => x.type === 'hero' && x.owner === (n === 1 ? 1 : 0) && x.heroIdx === 0).id]; };   // 1. Wahl: Spiegel-Träger; 2. Wahl (die Kopie): der Angreifer
  const vorher = t.census();
  const r = await t.play(0, 'Pyroblast', { hero: 0 });
  const diff = t.censusDiff(vorher, t.census()).filter(x => !/^(Destruction Magic|Magic Arts|Pollution Token)/.test(x));   // Schulen: Harness-Grant; Tokens: Kosten/Mirror-Preis
  R.check('Pyroblast negiert und gespiegelt (Angreifer-Held 0 verliert 100 HP durch die Kopie)', r === true && t.hp(0, 0) === 700 && t.hp(1, 0) === 800, [t.hp(0, 0), t.hp(1, 0)]);
  R.check('Pyroblast liegt genau einmal in der Ablage (nur das Original); die Kopie ist keine Karte', t.pile(0, 'discardPile').filter(x => x === 'Pyroblast').length + t.pile(1, 'discardPile').filter(x => x === 'Pyroblast').length === 1, { ablage0: t.pile(0, 'discardPile'), ablage1: t.pile(1, 'discardPile') });
  R.check('Kartenbilanz ausgeglichen (ohne Tokens/Schul-Grant)', diff.length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
