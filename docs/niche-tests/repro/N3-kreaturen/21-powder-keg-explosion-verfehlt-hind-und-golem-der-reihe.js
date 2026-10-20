'use strict';
// N3-21 · Powder Keg: die Todes-Explosion trifft eine Elusive Hind / einen Plant Golem in der Reihe nicht
// Kartentext: „Place this card into an opponent's Hero's Support Zone. When this Creature is defeated, deal 150 damage to all Creatures in the corresponding Hero's other Support Zones."
// Aufbau: Sitz 0 legt zuerst Hind bzw. Golem (liegen automatisch beim Gegner, Held 0: `inst.owner` bleibt der Beschwörer = Sitz 0, `controller` = Sitz 1 – der dokumentierte „Plant-Golem-Weg", `physicalSide` = Kontrolleur),
//   dann das Powder Keg in dieselbe Reihe; Sitz 1 hat außerdem eine eigene Kreatur in der Reihe. Das Keg wird zerstört.
// Erwartet: alle Kreaturen der anderen Zonen der Reihe nehmen 150: die eigene Kreatur (850) UND die Hind (tot bzw. Hind-Abfrage) bzw. der Golem (50 HP → tot).
// Beobachtet: nur die eigene Kreatur wird getroffen; Hind (1 HP) und Golem (50 HP) bleiben unversehrt in der Reihe.
// Ursache: cards/effects/powder-keg.js `onCreatureDeath` (Z. 368): `if (inst.owner !== hostOwner) continue;` – für Hind/Golem ist `inst.owner` die Seite des Beschwörers; richtig wäre `engine.physicalSide(inst)` bzw. `kreaturAnBrett`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const fremd of ['Elusive Hind', 'Plant Golem']) {
    const t = await H.fresh({ hand: [['Powder Keg', fremd], []], gold: [30, 30] });
    const eigene = t.put(1, 0, 2, H.INERT.big);
    t.targetFn = (valid) => [valid.find(x => x.owner === 1 && x.heroIdx === 0).id];
    await t.play(0, fremd, { hero: 0 });
    const f = t.find(fremd, 'support'); f.turnPlayed = 1;
    t.phase(2);
    await t.play(0, 'Powder Keg', { hero: 0 });
    const keg = t.find('Powder Keg', 'support');
    R.check(`${fremd}: Aufbau – Hind/Golem, Keg und die eigene Kreatur teilen sich die Reihe von Sitz 1 / Held 0`,
      !!keg && t.gs.players[1].supportZones[0].filter(z => z.length > 0).length === 3, t.gs.players[1].supportZones[0]);
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => null });   // Hind: kein Abwurf zum Negieren
    t.reset();
    await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, controller: 1 }, keg));
    R.check(`${fremd}: Gegenprobe – die eigene Kreatur der Reihe nimmt 150`, t.engine.creatureCurrentHp(eigene) === 850, t.engine.creatureCurrentHp(eigene));
    const gefallen = !t.gs.players[1].supportZones[0].some(z => z[0] === fremd);
    R.check(`${fremd}: wird von der Explosion getroffen (150 Schaden ≥ ihre HP) und fällt`, gefallen, { reihe: t.gs.players[1].supportZones[0], hp: t.engine.creatureCurrentHp(f) });
    R.check(`${fremd}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
