'use strict';
// C05-creatures-03 · The Creepy Clown of Heaven negiert den „unaffected by all other cards and effects"-Stowaway
// Kartentext (Stowaway): „This Creature is unaffected by all other cards and effects, but if the status effect it inflicted is removed
//   from the corresponding Hero, it is deleted."  Kartentext (Clown): „While you control this Creature, negate the effects of all other
//   Creatures on the board."
// Erwartung: Der Stowaway ist von fremden Karten unbeeinflusst (Spezialtext gewinnt gegen die allgemeine Aura): `isCreatureEffectSuppressed`
//   ist false, und stirbt sein Wirt, wird er gelöscht („status removed -> deleted"), auch wenn ein Clown auf dem Brett liegt.
// Beobachtet: `isCreatureEffectSuppressed(stowaway)` = true (die Aura kennt `counters._cardinalImmune` nicht); sein `onHeroKO` läuft nicht,
//   der Stowaway bleibt als Leiche in der Zone des toten Wirts liegen (der Wirt hat keinen Status mehr).
// Ursache: `_engine.js` creatureAuraInfo ~18797 / isCreatureEffectSuppressed ~18826 prüfen `_cardinalImmune` nicht (Stowaway.js setzt es, Z. 172);
//   der Hook-Verteiler stellt `onHeroKO` des vermeintlich negierten Stowaway daher stumm.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Stowaway'], []] });
  await t.play(0, 'Stowaway', { hero: 0, slot: 0 });
  t.put(1, 2, 2, 'The Creepy Clown of Heaven');
  const sw = t.find('Stowaway', 'support');
  R.check('Aufbau: Stowaway liegt, ist „unaffected" (_cardinalImmune)', !!sw && sw.counters._cardinalImmune === true, sw && sw.counters);
  R.check('Clown-Aura negiert den Stowaway NICHT', t.engine.isCreatureEffectSuppressed(sw) === false, t.engine.isCreatureEffectSuppressed(sw));
  await t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.gs.players[0].heroes[0], 99999, 'spell');
  R.check('Wirt tot -> Stowaway gelöscht (Status weg)', !t.find('Stowaway', 'support'), { stowawayNochDa: !!t.find('Stowaway', 'support'), hostStatuses: Object.keys(t.gs.players[0].heroes[0].statuses || {}) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
