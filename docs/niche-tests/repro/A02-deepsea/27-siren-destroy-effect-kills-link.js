'use strict';
// A02-deepsea-27 · Deepsea Siren: „defeated by an opponent's card or effect" löst nur bei tödlichem Schaden aus, nicht bei Besiegen-Effekten
//
// Kartentext (Siren): „… Any damage this Creature takes is also applied to that target. When this Creature is defeated by an
// opponent's card or effect, also defeat the chosen target."
// Kartentext (Deepsea Reaper, Gegner): „… you may choose any Creature on the board and defeat it."
// Skript (`deepsea-siren.js` onCardLeaveZone, ~Z. 254): „Fires only for non-damage destruction paths … cleans up the linked-target flags" – es räumt nur die
// Abzeichen auf; besiegt wird das Ziel nur im Schadenspfad (`beforeCreatureDamageBatch`, wenn der Treffer die Siren tötet).
//
// Aufbau: Seat 0: Siren (verknüpft mit Dummy Big in Held 1), Seat 1: Deepsea Reaper / Besiegen-Effekt.
// Erwartung: Wird die Siren durch eine gegnerische Karte (hier Reaper bzw. einen Zerstörungseffekt) besiegt, wird auch das verknüpfte Ziel besiegt.
// Beobachtet: Siren in der Ablage, Ziel bleibt unverletzt auf dem Brett. (Kontrolle: tödlicher Schaden → Ziel stirbt mit.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const how of ['Deepsea Reaper (Gegner)', 'actionDestroyCard (Gegner)', 'Kontrolle: tödlicher Schaden (Gegner)']) {
    R.section(how);
    const t = await H.fresh({ hand: [['Deepsea Siren'], ['Deepsea Reaper']] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
    t.setAbilities(1, 0, [['Summoning Magic', 'Summoning Magic']]);
    const x = t.put(0, 1, 0, H.INERT.big); x.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 1).id];
    await t.play(0, 'Deepsea Siren', { hero: 0, slot: 0 });
    const siren = t.find('Deepsea Siren', 'support');
    if (how.startsWith('Deepsea Reaper')) {
      t.targetFn = (valid) => [valid.find(v => v.cardName === 'Deepsea Siren').id];
      await t.play(1, 'Deepsea Reaper', { hero: 0, slot: 0 });
    } else if (how.startsWith('actionDestroyCard')) {
      await t.run(() => t.engine.actionDestroyCard({ name: 'Src', owner: 1 }, siren));
    } else {
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Src', owner: 1 }, siren, 500, 'creature', { sourceOwner: 1 }));
    }
    R.check('Siren ist besiegt (Ablage)', t.pile(0, 'discardPile').includes('Deepsea Siren'), t.pile(0, 'discardPile'));
    const ziel_lebt = t.engine.cardInstances.includes(x) && x.zone === 'support';
    R.check('Das verknüpfte Ziel wird mit besiegt', !ziel_lebt, { zone: x.zone, getrackt: t.engine.cardInstances.includes(x), ablage: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
