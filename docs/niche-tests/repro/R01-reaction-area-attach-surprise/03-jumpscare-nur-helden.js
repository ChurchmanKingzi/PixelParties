'use strict';
// R01-03 · Jumpscare bietet als „any target on the board" nur Helden an (Kreaturen fehlen)
// Kartentext: „Activate this Surprise when the user is chosen by an opponent's Attack, Spell or Creature effect. After the Attack, Spell or effect resolves,
//   choose any target on the board and Stun it for 2 turns."
// Vergleich: Thunderstruck Waflav („Choose any target on the board … Stun it") – dort ausdrücklich Held UND Kreatur (thunderstruck-waflav.js Z. 21-24, Z. 70-75).
// Aufbau: Sitz 1 hat verdeckt Jumpscare auf Held 0; je eine „ZZ Dummy"-Kreatur auf dem Brett von Sitz 0 und Sitz 1.
// Schritte: 1. Sitz 0 wirkt Fireball auf Held 0 von Sitz 1. 2. Jumpscare annehmen, das Zielfenster ansehen.
// Erwartet: Die Kreaturen beider Seiten stehen unter den Zielen und eine Kreatur lässt sich betäuben.
// Beobachtet: Es werden nur die 6 Helden angeboten; `picked.type !== 'hero'` → return (jumpscare.js Z. ~78).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball'], []] });
  t.putSurprise(1, 0, 'Jumpscare'); t.grantFor(1, 0, 'Jumpscare');
  const c0 = t.put(0, 0, 0, H.INERT.creature), c1 = t.put(1, 1, 0, H.INERT.creature);
  t.targetFn = (valid, cfg) => {
    if (cfg && cfg.title === 'Jumpscare') { const v = valid.find(x => x.type === 'equip' && x.owner === 0) || valid[0]; return [v.id]; }
    const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return [v.id];
  };
  await t.play(0, 'Fireball', { hero: 0 });
  const js = t.targets.find(x => x.config && x.config.title === 'Jumpscare');
  R.check('Jumpscare-Zielwahl wurde geöffnet', !!js, t.targets.map(x => x.config && x.config.title));
  R.check('unter den Zielen sind Kreaturen', !!js && js.valid.some(v => v.type === 'equip'), js && js.valid.map(v => v.type));
  R.check('die gewählte Kreatur ist betäubt', !!c0.counters.stunned, c0.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
