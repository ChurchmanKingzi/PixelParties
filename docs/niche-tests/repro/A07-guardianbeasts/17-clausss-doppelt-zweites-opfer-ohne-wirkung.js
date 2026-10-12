'use strict';
// A07-17 · Zwei Clausss im selben Zug: das zweite Opfer bringt nichts (und ist erlaubt)
//
// Kartentext Clausss: „… While this Creature has "Klaus, the Cult Leader" attached to it, it gains 200 HP and this effect:
//   You may once per turn sacrifice a Creature you control that was not summoned this turn. If you do, you can perform a
//   second Action during this turn's Action Phase."
// Beobachtet: Beide Clausss lassen sich im selben Zug aktivieren; `ps._bonusMainActions = 1` wird nur GESETZT (nicht erhöht),
//   die zweite Aktivierung opfert also eine Kreatur ohne zusätzlichen Gewinn (`canActivateCreatureEffect` prüft den
//   Stand nicht). Hier festgehalten; die Frage (gesperrt wie Triceras beim gesperrten Ziehen, oder dritte Aktion?) steht im Bericht.
const H = require('../../lib/h.js');
const D = H.INERT.creature;

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Klaus, the Cult Leader', 'Klaus, the Cult Leader'], []], deckSize: 10 });
  const c1 = t.put(0, 0, 0, 'Clausss, the No-Nonsense Cultist'); c1.turnPlayed = 1;
  const c2 = t.put(0, 0, 1, 'Clausss, the No-Nonsense Cultist'); c2.turnPlayed = 1;
  for (let z = 0; z < 3; z++) t.put(0, 1, z, D).turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0); t.phase(2); await t.activateCreature(0, 0, 1);       // beide bekommen Klaus
  t.targetFn = (v) => [v.find(y => y.cardName === D).id];
  t.phase(2); await t.activateCreature(0, 0, 0);
  const nach1 = t.gs.players[0]._bonusMainActions;
  const vor = t.inst(c => c.zone === 'support' && c.owner === 0).length;
  t.phase(2); const r2 = await t.activateCreature(0, 0, 1);
  const nach = t.inst(c => c.zone === 'support' && c.owner === 0).length;
  R.check('zweite Clausss darf KEINE Kreatur opfern, wenn sie nichts zusätzlich bringt', !(r2 === true && nach === vor - 1 && t.gs.players[0]._bonusMainActions === nach1), { r2, bonus: t.gs.players[0]._bonusMainActions, kreaturen: [vor, nach] });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
