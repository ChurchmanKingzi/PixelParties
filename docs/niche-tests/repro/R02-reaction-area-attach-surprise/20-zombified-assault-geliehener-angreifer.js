'use strict';
// R02-20 · Zombified Assault: der Rückschlag trifft bei einem GELIEHENEN Angreifer den gleichindizierten Helden des Kontrolleurs statt den Angreifer
// Kartentext: „… After that, deal damage equal to 50 times the revived Creature's level to the attacking Hero."
// Aufbau: Sitz 1: Zombified Assault auf der Hand (Held 0 mit Decay Magic 2), Elven Archer (Lv1, 50 HP) in Support Zone 0 von Held 0. Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`, Destruction Magic 2).
//   Sitz 0 spielt mit diesem geliehenen Helden (`charmedOwner: 1`) Burning Finger auf den Elven Archer (50 HP ⇒ besiegt). Zombified Assault wird gespielt (Ja).
// Erwartet: Der Archer wird wiederbelebt und der ANGREIFENDE Held (Sitz 1, Held 1 – der geliehene) erleidet 50 Schaden (750 HP). Alle anderen Helden bleiben unversehrt.
// Beobachtet: Der Archer kommt zurück; der Schaden trifft Held 1 von SITZ 0 (S0 [800, 750, 800]); der Angreifer (Sitz 1, Held 1) bleibt bei 800 HP.
// Ursache: `zombified-assault.js` `schlageZurueck`: `seite = quellSeite(quelle)` (= `src.controller ?? src.owner` = Kontrolleur) und `heroes[quelle.heroIdx]` – `heroIdx` gilt aber in der Heldenreihe von `source.heroOwner`.
//   Gleiches Muster wie R02-13 (Rioting Village).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Burning Finger'], ['Zombified Assault']], hp: 800 });
  t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic'], [], []]);
  t.setAbilities(1, 1, [['Destruction Magic', 'Destruction Magic'], [], []]);
  t.hero(1, 1).charmedBy = 0;
  const archer = t.put(1, 0, 0, 'Elven Archer');
  t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && v.slotIdx === 0) || valid[0]).id];
  t.policy.confirm = true;
  await t.play(0, 'Burning Finger', { hero: 1, charmedOwner: 1, noGrant: true });
  const hp = { s0: t.gs.players[0].heroes.map(h => h.hp), s1: t.gs.players[1].heroes.map(h => h.hp) };
  R.check('Aufbau – Zombified Assault wurde gespielt, der Archer steht wieder auf dem Brett', t.prompts.some(p => p.d.title === 'Zombified Assault') && t.gs.players[1].supportZones[0][0] && t.gs.players[1].supportZones[0][0][0] === 'Elven Archer', { zone: t.gs.players[1].supportZones[0] });
  R.check('der angreifende (geliehene) Held 1 von Sitz 1 erleidet 50 Schaden', hp.s1[1] === 750, hp);
  R.check('die Helden von Sitz 0 bleiben unversehrt', hp.s0.every(x => x === 800), hp);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
