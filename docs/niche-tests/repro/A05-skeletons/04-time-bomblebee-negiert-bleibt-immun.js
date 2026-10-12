'use strict';
// A05-skeletons-04 · Negierte Time Bomblebee bleibt trotz negierter Effekte schadens- und zerstörungsimmun
// Kartentext (Time Bomblebee): „While this Creature has Bomb Counters on it, it cannot take damage or be defeated."
// Das ist ein statischer Effekt der Karte. Vorbild im Code: CARD_API (v1357, The Egg of God, `negatesOwnDamage`): „… ebenso bei negiertem/stummem
//   Effekt der Kreatur" → eine negierte Kreatur verliert ihre Schadensimmunität. Hier nicht: `_damageDestroyImmune` wird beim Auflegen des Counters
//   gesetzt und danach von der Engine ohne Negationsprüfung gelesen.
// Erwartung: negierte Time Bomblebee (mit Counter) nimmt Schaden/kann besiegt werden.
// Beobachtet: bleibt unversehrt und auf dem Brett (Schaden 500 → hp bleibt, zone 'support').
// Ursache: `_engine.js` ~12285 (actionDestroyCard) und ~46191 (Schadens-Batch) prüfen `counters._damageDestroyImmune` ohne `isCreatureEffectSuppressed`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const tb = t.put(0, 0, 0, 'Time Bomblebee'); tb.turnPlayed = 1;
  const opfer = t.put(1, 2, 2, H.INERT.frail);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
  R.check('Aufbau: Time Bomblebee hat 1 Bomb Counter', tb.counters.bombCounters === 1, tb.counters);
  await t.run(() => t.engine.actionNegateCreature(tb, 'test'));
  R.check('Aufbau: Time Bomblebee ist negiert', !!tb.counters.negated, tb.counters);
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1 }, tb, 500, 'creature', { sourceOwner: 1 }));
  R.check('negierte Time Bomblebee mit Counter wird durch 500 Schaden besiegt (nicht mehr getrackt)', !t.engine.cardInstances.includes(tb), { getrackt: t.engine.cardInstances.includes(tb), currentHp: tb.counters.currentHp });
  R.finish();
})();
