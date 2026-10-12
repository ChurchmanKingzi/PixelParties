'use strict';
// C03-creatures-05 · Golden Exploding Skull: unversehrte Kreaturen zählen beim Gold nicht mit („for each target hit")
// Kartentext: „When this Creature is defeated, deal 50 damage to all targets you control. You gain 5 Gold for each target hit by this effect."
// Aufbau: Sitz 0: 3 Helden (je 800 HP), zwei ZZ Dummy (über den echten Spielweg doPlayCreature beschworen, nie beschädigt) und der Skull; 100 Gold.
//   Der Skull wird zerstört (actionDestroyCard).
// Erwartung: 50 Schaden auf 3 Helden + 2 Kreaturen = 5 Ziele getroffen ⇒ +25 Gold (125).
// Beobachtet: Die Kreaturen verlieren 50 HP (200 → 150), aber das Gold steigt nur um 15 (3 Helden) ⇒ 115.
// Ursache: cards/effects/golden-exploding-skull.js zieleAufnehmen(): `const hp = inst.counters?.currentHp; if (!Number.isFinite(hp)) continue;` –
//   `counters.currentHp` ist bei einer unbeschädigten Kreatur NICHT gesetzt (die Engine setzt es erst beim ersten Treffer, _engine.js ~46382), die Kreatur fällt aus der
//   Zielliste und wird nie mitgezählt. Richtig: `inst.counters.currentHp ?? baseHp` (wie _engine.js:10142).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[H.INERT.creature, H.INERT.creature]] });
  await t.play(0, H.INERT.creature, { hero: 1, slot: 0 });
  await t.play(0, H.INERT.creature, { hero: 1, slot: 1 });
  const sk = t.put(0, 0, 0, 'Golden Exploding Skull'); sk.turnPlayed = 1;
  t.setGold(0, 100);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, sk));
  const hps = t.inst(c => c.zone === 'support').map(c => c.counters.currentHp);
  R.check('beide Kreaturen haben 50 Schaden genommen (200 → 150)', hps.length === 2 && hps.every(h => h === 150), hps);
  R.check('Gold = 100 + 5 × 5 Ziele (3 Helden + 2 Kreaturen) = 125', t.gs.players[0].gold === 125, t.gs.players[0].gold);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
