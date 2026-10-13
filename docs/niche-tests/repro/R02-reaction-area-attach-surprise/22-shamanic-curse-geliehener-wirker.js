'use strict';
// R02-22 · Shamanic Curse prüft bei einem GELIEHENEN Wirker die Stufe am gleichindizierten Helden des Kontrolleurs
// Kartentext: „Play this card immediately when an opponent's Hero uses a Spell. Increase that Spell's level by 1. If the Spell's level is now too high for that Hero to use it, it is negated and sent to the discard pile."
// Aufbau: Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`) und hat Destruction Magic 1. Der gleichindizierte eigene Held 1 von Sitz 0 hat Destruction Magic 3 (Falle). Sitz 0 spielt mit dem geliehenen Helden
//   (`charmedOwner: 1`) Burning Finger (Lv1) auf Held 0 von Sitz 1. Sitz 1 hält Shamanic Curse (Held 0 mit Decay Magic 3) und sagt Ja.
// Erwartet: Der Wirker (geliehener Held, Destruction Magic 1) kann einen Lv-2-Spell nicht wirken ⇒ der Spell wird negiert, Held 0 von Sitz 1 bleibt bei 800 HP.
// Beobachtet: Der Spell „überlebt" und trifft. `shamanic-curse.js` liest `oppPs = players[targetLink.owner]` (= Kontrolleur, Sitz 0) und `oppPs.heroes[targetLink.heroIdx]` – bei einem geliehenen Wirker die falsche Heldenreihe
//   (`heroOwner`/`casterOwner` des Kettenglieds wird nicht verwendet); dort steht Destruction Magic 3, der Zauber gilt als wirkbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Burning Finger'], ['Shamanic Curse']], hp: 800 });
  t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);
  t.hero(1, 1).charmedBy = 0;
  t.setAbilities(1, 1, [['Destruction Magic'], [], []]);
  t.setAbilities(0, 1, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
  t.policy.confirm = true;
  await t.play(0, 'Burning Finger', { hero: 1, charmedOwner: 1, noGrant: true });
  R.check('Aufbau – Shamanic Curse wurde angeboten', t.prompts.some(p => p.d.title === 'Shamanic Curse'), t.prompts.map(p => p.d.title));
  R.check('Burning Finger wird negiert (Held 0 von Sitz 1 unversehrt)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
