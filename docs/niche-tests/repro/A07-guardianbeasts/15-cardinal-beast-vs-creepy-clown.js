'use strict';
// A07-15 · Cardinal Beasts sind „unaffected by all cards and effects" – The Creepy Clown of Heaven negiert sie trotzdem
//
// Kartentexte:
//   Cardinal Beast Zhuque (alle vier): „This Creature is unaffected by all cards and effects. …"
//   The Creepy Clown of Heaven: „While you control this Creature, negate the effects of all other Creatures on the board. …"
// Erwartung: Die Aura des Clowns wirkt nicht auf Cardinal Beasts (sie sind von allen Karten/Effekten unberührt); Zhuque
//   bleibt aktivierbar.
// Beobachtet: `creatureAuraNegiert` (_engine.js:18781-18805, Teil von `isCreatureEffectSuppressed`) kennt `isOmniImmune` nicht;
//   die Beast ist „negiert", `doActivateCreatureEffect` lehnt ab. (Alle statusbasierten Wege – Freeze, Stun, Negate – sind
//   über `canApplyCreatureStatus`/`isOmniImmune` korrekt gesperrt; die abgeleitete Aura-Negation ist die Lücke.)
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const t = await H.fresh({ deckSize: 10 });
  const res = await t.engine.summonCreatureWithHooks('Cardinal Beast Zhuque', 0, 0, 0, { source: 'test' });
  const z = res.inst; z.turnPlayed = 1;
  const clown = t.put(1, 0, 0, 'The Creepy Clown of Heaven'); clown.turnPlayed = 1;
  R.check('Zhuque ist von der Clown-Aura nicht unterdrückt', t.engine.isCreatureEffectSuppressed(z) === false, t.engine.creatureAuraInfo(z));
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1).id];
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.activateCreature(0, 0, 0);
  R.check('Zhuque kann ihren aktiven Effekt benutzen', r === true && !!t.hero(1, 0).statuses.burned, { r, burned: !!t.hero(1, 0).statuses.burned });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
