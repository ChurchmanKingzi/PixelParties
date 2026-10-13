'use strict';
// F02-14 · Poisoned Meat (und jede Karte auf `engine.getCreatureTargets`): die Instanz-Suche ignoriert die Brettseite – eine fremd beschworene Kreatur verdrängt die eigene an derselben (Held, Slot)-Stelle
// Kartentext Poisoned Meat: „Choose a Creature any player controls. Deal 20 damage to it and inflict 1 Stack of Poison to it."
// Aufbau: Sitz 0 beschwört Plant Golem (landet in Sitz 1, Held 0, Slot 0: owner 0, controller 1), außerdem eigene „ZZ Dummy" bei Sitz 0, Held 0, Slot 0.
// Schritte: 1. Poisoned Meat spielen, Zielliste ansehen. 2. Den Eintrag „ZZ Dummy" (meine eigene Kreatur) wählen.
// Erwartet: Die Liste enthält zwei verschiedene Kreaturen (ZZ Dummy, Plant Golem); die Wahl „ZZ Dummy" trifft die ZZ Dummy (−20 HP, 1 Gift).
// Beobachtet: beide Einträge tragen dieselbe `cardInstance` (den Golem) und dieselbe ID `equip-1-0-0`; die Wahl „ZZ Dummy" schädigt den Golem, die ZZ Dummy bleibt unberührt.
// Vermutete Ursache: `_engine.js getCreatureTargets` (~Z. 40263): `cardInstances.find(c => (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si)` – ohne Brettseiten-Bedingung (`physicalSide(c) === playerIdx`). Der Golem (owner 0) passt für Spalte 0 UND (controller 1) für Spalte 1.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Plant Golem', 'Poisoned Meat'], []], gold: [100, 100] });
  await t.play(0, 'Plant Golem', { hero: 0 });
  const golem = t.inst(c => c.name === 'Plant Golem' && c.zone === 'support')[0];
  const dummy = t.put(0, 0, 0, H.INERT.creature);
  const hp = (i) => i.counters.currentHp ?? i.baseHp ?? 200;
  const dummyHp0 = hp(dummy), golemC0 = JSON.stringify(golem.counters), dummyC0 = JSON.stringify(dummy.counters);
  await t.play(0, 'Poisoned Meat', { noAutoConfirm: true });
  const pt = t.gs.potionTargeting;
  const valid = (pt && pt.validTargets || []).filter(v => !v.ineligible);
  const insts = valid.map(v => v.cardInstance && v.cardInstance.id);
  R.check('Zielliste führt zwei verschiedene Kreaturen', new Set(insts).size === 2, valid.map(v => [v.id, v.cardName, v.cardInstance && v.cardInstance.name]));
  const wahl = valid.find(v => v.cardName === H.INERT.creature);
  const c = await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: [wahl.id] }));
  R.check('Wahl „ZZ Dummy" trifft die ZZ Dummy (−20 HP)', hp(dummy) === dummyHp0 - 20, { c, dummy: hp(dummy), dummyCounters: dummy.counters, golemCounters: golem.counters });
  R.check('der Golem bleibt unberührt', JSON.stringify(golem.counters) === golemC0, { vorher: golemC0, nachher: golem.counters });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
