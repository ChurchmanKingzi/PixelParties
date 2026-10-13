'use strict';
// R01-09 · Corpse Explosion reagiert nicht auf Tod durch Butterfly Cloud (Zauber mit Schadenstyp 'other')
// Kartentext: „Play this card immediately when a target is defeated by an Attack or Spell. Deal 50 damage to all targets the opponent of the defeated target controls."
// Verwandt: S01-03 (Butterfly Cloud schadet unter Dark Ocean nicht – gleiche Ursache: `butterfly-cloud.js:82` schlägt mit `damageType: 'other'` zu).
// Aufbau: Sitz 0: Butterfly Cloud bzw. Boiling Oil (Kontrolle) auf der Hand; Sitz 1: Corpse Explosion (Destruction Magic 2 per grantFor) und eine 10-HP-Kreatur auf dem Brett; Sitz 0 hat eine Kreatur als Ziel.
// Schritte: 1. Sitz 0 wirkt den Zauber (alle Gegnerziele). 2. Die 10-HP-Kreatur stirbt.
// Erwartet: In beiden Fällen Fenster „Corpse Explosion", Sitz 0 verliert 50 je Held.
// Beobachtet: Boiling Oil ✓ (750/750/750); Butterfly Cloud: kein Fenster, Sitz 0 bleibt bei 800 (`corpse-explosion.js` `defeatedByAttackOrSpell(type)`: nur 'attack' oder Typ mit „spell").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const spell of ['Boiling Oil', 'Butterfly Cloud']) {
    const t = await H.fresh({ hand: [[spell], ['Corpse Explosion']] });
    t.grantFor(1, 0, 'Corpse Explosion');
    t.put(1, 1, 0, H.INERT.frail); t.put(0, 2, 0, H.INERT.creature);
    await t.play(0, spell, { hero: 0 });
    R.check(spell + ': die 10-HP-Kreatur ist gestorben', !t.inst(c => c.zone === 'support' && c.owner === 1).length);
    R.check(spell + ': Corpse Explosion wurde angeboten', t.prompts.some(p => p.d.title === 'Corpse Explosion'), t.prompts.map(p => p.d.title));
    R.check(spell + ': Sitz 0 verliert 50 je Held', [0, 1, 2].every(h => t.hp(0, h) === 750), [0, 1, 2].map(h => t.hp(0, h)));
    R.check(spell + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
