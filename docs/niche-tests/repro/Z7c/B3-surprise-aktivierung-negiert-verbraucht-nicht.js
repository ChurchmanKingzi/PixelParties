'use strict';
// Z7c-B3 · Wird die AKTIVIERUNG einer „once per game"-Surprise komplett negiert (Boots of Hermes: „Negate that Surprise and draw a card"), bleibt die Grenze unverbraucht (Z7b-Regel).
// Aufbau: Sitz 1 hat Tharxian Horse (Held 0) + eine zweite Kopie (Held 1); Sitz 0 hat Boots of Hermes + 2 Fireballs. Der 1. Fireball löst das Horse an Held 0 aus, Boots negiert die Aktivierung.
// Erwartung: Horse #1 negiert (Fireball trifft Held 0 mit 150), Grenze NICHT verbraucht; 2. Fireball auf Held 1 löst das zweite Horse noch aus (Held 1 unversehrt), jetzt ist die Grenze verbraucht.
// Kontrolle (ohne Boots): siehe B2 – die nicht negierte Aktivierung verbraucht.
// Aufruf: node docs/niche-tests/repro/Z7c/B3-surprise-aktivierung-negiert-verbraucht-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Boots of Hermes', 'Fireball', 'Fireball'], []] });
  t.putSurprise(1, 0, 'Tharxian Horse'); t.grantFor(1, 0, 'Tharxian Horse');
  t.putSurprise(1, 1, 'Tharxian Horse'); t.grantFor(1, 1, 'Tharxian Horse');
  t.policy.confirm = true;
  const ziel = (hi) => (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === hi).id];
  t.targetFn = ziel(0);
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Boots of Hermes wurde gespielt (nicht mehr auf der Hand)', !t.pile(0, 'hand').includes('Boots of Hermes'), t.pile(0, 'hand'));
  R.check('Horse #1 negiert → Fireball trifft Held 0 (−150)', t.hp(1, 0) === 650, t.hp(1, 0));
  R.check('negierte Aktivierung verbraucht die Grenze NICHT', !t.gs.players[1]._oncePerGameUsed?.has('Tharxian Horse'), [...(t.gs.players[1]._oncePerGameUsed || [])]);

  t.reset();
  t.targetFn = ziel(1);
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('zweites Horse (Held 1) löst noch aus → Fireball negiert (Held 1 unversehrt)', t.hp(1, 1) === 800, t.hp(1, 1));
  R.check('jetzt ist die Grenze verbraucht', !!t.gs.players[1]._oncePerGameUsed?.has('Tharxian Horse'), [...(t.gs.players[1]._oncePerGameUsed || [])]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})();
