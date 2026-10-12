'use strict';
// A01-pollution-06 · Doom Clock: die Niederlage eines HELDEN löst keinen Counter aus
// Kartentext: „The first 4 times every turn 1 or more targets are defeated, their controller must place 1 Doom Counter onto this card.“
//   (Der Text sagt „targets“, nicht „Creatures“: in diesem Spiel sind Helden und Kreaturen gleichermaßen Ziele.)
// Erwartung (wahrscheinliche Lesart): auch das Besiegen eines Helden ist eine Besiegung → 1 Counter, den der Kontrolleur des Helden legt.
// Beobachtet: das Skript hört nur auf `onCreatureDeath`; ein besiegter Held lässt die Uhr unberührt (die Kommentare erwähnen
//   „onTargetsDefeated“ und „Ziele BEIDER Spieler“, umgesetzt ist nur der Kreaturen-Weg).
// Ursache: cards/effects/doom-clock.js – kein Hook für Heldenniederlagen (onHeroKO o. ä.).
// Aufruf: node docs/niche-tests/repro/A01-pollution/06-doom-clock-heldenniederlage-zaehlt-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball'], []], hp: 100 });
  const clock = t.putArea(0, 'Doom Clock');
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const r = await t.play(0, 'Fireball', { hero: 0 });
  R.check('Fireball gespielt, gegnerischer Held 0 besiegt (HP 0)', r === true && t.hp(1, 0) <= 0, t.hp(1, 0));
  R.check('Besiegung eines Helden = Besiegung eines Ziels → 1 Doom Counter', (clock.counters.doom || 0) === 1, clock.counters.doom || 0);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
