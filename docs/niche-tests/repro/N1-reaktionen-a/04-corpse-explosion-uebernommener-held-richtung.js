'use strict';
// N1-04 · Corpse Explosion: Stirbt ein dauerhaft übernommener Held (Brettseite ≠ Kontrolleur), trifft die Explosion die FALSCHE Seite
// Kartentext: „Play this card immediately when a target is defeated by an Attack or Spell. Deal 50 damage to all targets the opponent of the defeated target controls."
// Regel (CARD_API „Kontrolle statt Seite", Styx 28.9.; W19–W22): Ein Held gehört zu dem, der ihn kontrolliert; „Gegner des Ziels" = Gegner des KONTROLLEURS.
// Aufbau: Sitz 0 besitzt Corpse Explosion (Destruction Magic 2) und hat Held 1:0 dauerhaft übernommen (Paraseed-Art `actionTakeHeroPermanently`), Held 1:0 hat 100 HP.
//         Sitz 1 beschießt ihn (Quelle gehört Sitz 1, Typ destruction_spell, 200 Schaden) → der Held fällt, Sitz 0 spielt Corpse Explosion.
// Erwartet: Der Gegner des gefallenen Ziels (kontrolliert von Sitz 0) ist Sitz 1 → die übrigen Helden von Sitz 1 verlieren je 50 (750/750), Sitz 0 bleibt bei 800.
// Beobachtet: Die Explosion richtet sich nach der PHYSISCHEN Brettseite des Gefallenen (Sitz 1) und trifft daher Sitz 0 – die eigenen Helden des Spielers verlieren je 50.
// Gegenprobe: derselbe Aufbau ohne Übernahme (Held 1:0 gehört und untersteht Sitz 1, Sitz 1 hat die Karte): trifft korrekt Sitz 0.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  // Gegenprobe: Normalspiel
  {
    const t = await H.fresh({ hand: [[], ['Corpse Explosion']] });
    t.grantFor(1, 1, 'Corpse Explosion'); t.setHero(1, 0, t.hero(1, 0).name, 100);
    const src = { name: 'Fireball', owner: 0, heroIdx: 0, controller: 0, zone: 'hand', counters: {} };
    await t.run(() => t.engine.actionDealDamage(src, t.hero(1, 0), 200, 'destruction_spell'));
    R.check('Gegenprobe: Corpse Explosion wurde angeboten', t.prompts.some(p => p.d.title === 'Corpse Explosion'), t.prompts.map(p => p.d.title));
    R.check('Gegenprobe: Sitz 0 verliert je 50 (750/750/750), Sitz 1 unverändert', [0, 1, 2].every(h => t.hp(0, h) === 750) && t.hp(1, 1) === 800 && t.hp(1, 2) === 800, [0, 1, 2].map(h => t.hp(0, h)));
    R.check('Gegenprobe: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // Befund: dauerhaft übernommener Held
  {
    const t = await H.fresh({ hand: [['Corpse Explosion'], []] });
    t.grantFor(0, 1, 'Corpse Explosion'); t.setHero(1, 0, t.hero(1, 0).name, 100);
    await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250);
    const src = { name: 'Fireball', owner: 1, heroIdx: 1, controller: 1, zone: 'hand', counters: {} };
    await t.run(() => t.engine.actionDealDamage(src, t.hero(1, 0), 200, 'destruction_spell'));
    R.check('der übernommene Held ist gefallen', t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check('Corpse Explosion wurde Sitz 0 angeboten', t.prompts.some(p => p.pi === 0 && p.d.title === 'Corpse Explosion'), t.prompts.map(p => p.pi + p.d.title));
    R.check('Sitz 1 (Gegner des Kontrolleurs) verliert je 50 an den übrigen Helden', t.hp(1, 1) === 750 && t.hp(1, 2) === 750, [t.hp(1, 1), t.hp(1, 2)]);
    R.check('Sitz 0 (Kontrolleur/Spieler der Karte) bleibt unversehrt', [0, 1, 2].every(h => t.hp(0, h) === 800), [0, 1, 2].map(h => t.hp(0, h)));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
