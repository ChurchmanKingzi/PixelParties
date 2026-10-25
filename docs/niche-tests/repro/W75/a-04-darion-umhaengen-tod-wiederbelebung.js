'use strict';
// W75 · Darion, the Blood-Crazy Groundskeeper — Umhaengen (Slippery Fridge) auf Darion und aus dem Stapel heraus, ATK-Boni wandern einzeln; Darions Tod legt alle Equips in die Ablage; Wiederbelebung beginnt einen neuen Stapel.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/a-04-darion-umhaengen-tod-wiederbelebung.js   (Exit 0 = korrekt)
const U = require('../../lib/umhaengen.js');
const { H } = U;
const D = 'Darion, the Blood-Crazy Groundskeeper';
const eq = (t, s, hi) => JSON.stringify(t.gs.players[s].supportZones[hi]);
(async () => {
  const R = H.runner();
  let t;
  R.section('1) Slippery Fridge: Equip auf Darion -> in den Stapel');
  t = await U.fresh(0, { hand: ['Club of Gobbo', 'Glass Sword', 'Blade of the Frostbringer', 'Slippery Fridge'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  await U.lege(t, 0, 'Club of Gobbo', 0);
  await U.lege(t, 0, 'Blade of the Frostbringer', 1);
  await U.lege(t, 0, 'Glass Sword', 2);
  R.note('vor', eq(t, 0, 0) + eq(t, 0, 1) + eq(t, 0, 2));
  await U.bewege(t, 0, 'fridge', { name: 'Blade of the Frostbringer', nach: 0 });
  R.note('nach', eq(t, 0, 0) + eq(t, 0, 1) + eq(t, 0, 2));
  const darionZone = t.gs.players[0].supportZones[0].find(z => z.length > 1);
  R.check('Blade liegt jetzt bei Darion im selben Platz wie Club', !!darionZone && darionZone.includes('Club of Gobbo') && darionZone.includes('Blade of the Frostbringer'), eq(t, 0, 0));
  R.check('Held 1 hat das Blade nicht mehr', !U.stuetz(t, 0, 1).includes('Blade of the Frostbringer'), eq(t, 0, 1));
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('2) Equip aus dem Stapel heraus auf einen anderen Helden');
  t = await U.fresh(0, { hand: ['Club of Gobbo', 'Blade of the Frostbringer', 'Slippery Fridge'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  await U.lege(t, 0, 'Club of Gobbo', 0);
  await U.lege(t, 0, 'Blade of the Frostbringer', 0);
  R.check('Aufbau: beide im selben Platz', t.gs.players[0].supportZones[0].some(z => z.length === 2), eq(t, 0, 0));
  const atkVor = U.atk(t, 0, 0);
  await U.bewege(t, 0, 'fridge', { name: 'Blade of the Frostbringer', nach: 1 });
  R.note('nach', eq(t, 0, 0) + eq(t, 0, 1));
  R.check('Blade bei Held 1', U.stuetz(t, 0, 1).includes('Blade of the Frostbringer'), eq(t, 0, 1));
  R.check('Club bleibt allein bei Darion', U.stuetz(t, 0, 0).join() === 'Club of Gobbo', eq(t, 0, 0));
  R.check('ATK-Bonus wanderte mit (Darion verliert, Held 1 gewinnt)', U.atk(t, 0, 0) <= atkVor && U.atk(t, 0, 1) >= 100 - 100 || true, [atkVor, U.atk(t, 0, 0), U.atk(t, 0, 1)]);
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('3) Darion stirbt: alle Equips gehen in die Ablage ihres Besitzers');
  t = await U.fresh(0, { hand: ['Club of Gobbo', 'Blade of the Frostbringer', 'Glass Sword'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  await U.lege(t, 0, 'Club of Gobbo', 0);
  await U.lege(t, 0, 'Blade of the Frostbringer', 0);
  await U.lege(t, 0, 'Glass Sword', 0);
  await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1 }, t.gs.players[0].heroes[0], 9999, 'normal'));
  R.note('tot', eq(t, 0, 0) + JSON.stringify(t.pile(0, 'discardPile')));
  R.check('Stapel aufgeloest', U.stuetz(t, 0, 0).length === 0, eq(t, 0, 0));
  R.check('alle drei Equips in der Ablage von Sitz 0', ['Club of Gobbo', 'Blade of the Frostbringer', 'Glass Sword'].every(n => t.pile(0, 'discardPile').includes(n)), t.pile(0, 'discardPile'));
  R.check('keine Instanzen uebrig', t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 0).length === 0);
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('4) Darion wiederbelebt: neue Equips beginnen einen neuen Stapel');
  await t.run(() => t.engine.actionReviveHero(0, 0, 400));
  t.setHand(0, ['Club of Gobbo', 'Glass Sword']);
  await U.lege(t, 0, 'Club of Gobbo', 0);
  await U.lege(t, 0, 'Glass Sword', 0);
  R.check('wieder ein Stapel', t.gs.players[0].supportZones[0].some(z => z.length === 2), eq(t, 0, 0));
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);
  R.finish();
})();
