'use strict';
// M01-12 · Elixir of Strength feuert auch bei einer Attack mit MEHREREN Zielen und wird dabei verbraucht
// Kartentext: „Choose a Hero you control. The next time that Hero hits EXACTLY 1 target with an Attack, that Attack's damage is increased by 100 and cannot be reduced or negated."
// Aufbau: Seed 1234, Zug 5; Held 0 (ATK 40) trinkt Elixir of Strength; Gegner hat 3 Helden (800 HP) und zwei Kreaturen; Held 0 spielt Whirlwind Strike
// („Inflict damage equal to the attacker's Attack stat to those [up to 2] Heroes and all Creatures in their Support Zones") auf 2 Helden → trifft 4 Ziele.
// Erwartet: kein Bonus (nicht „exactly 1 target"): jeder Treffer = 40; der Buff „empowered_strike" bleibt für die nächste Ein-Ziel-Attack stehen.
// Beobachtet: der erste Treffer erhält +100 (140), der Buff ist danach weg.
// Ursache: `_engine.js` `_applyEmpoweredStrikeIfApplicable` (~Z. 35515) zählt die Ziele der Attack nicht, es feuert am ersten 'attack'-Schaden (der Kommentar dort: „avoid double-firing on multi-target attack splits").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Elixir of Strength', 'Whirlwind Strike', 'Attack'], []], hp: 800 });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  await t.play(0, 'Elixir of Strength');
  t.put(1, 0, 0, H.INERT.creature); t.put(1, 1, 0, H.INERT.creature);
  t.targetFn = (valid) => valid.filter(v => v.type === 'hero' && v.owner === 1).slice(0, 2).map(v => v.id);
  const before = [t.hp(1, 0), t.hp(1, 1)];
  const r = await t.play(0, 'Whirlwind Strike', { hero: 0 });
  const dmg = [before[0] - t.hp(1, 0), before[1] - t.hp(1, 1)];
  R.note(`Whirlwind r=${r}, Schaden an den zwei Helden = ${dmg}, Buff danach = ${JSON.stringify(Object.keys(t.hero(0, 0).buffs || {}))}`);
  R.check('Mehrfachziel-Attack: kein +100 (Text: exactly 1 target)', dmg[0] === 40 && dmg[1] === 40, dmg);
  R.check('Buff „empowered_strike" bleibt für die nächste Ein-Ziel-Attack erhalten', !!t.hero(0, 0).buffs?.empowered_strike, Object.keys(t.hero(0, 0).buffs || {}));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
