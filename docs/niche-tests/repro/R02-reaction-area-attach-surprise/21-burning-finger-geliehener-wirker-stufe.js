'use strict';
// R02-21 (Nebenbefund, nicht aus der Kartenliste) · Burning Finger: die Stufe eines GELIEHENEN Wirkers wird an der Heldenreihe des Kontrolleurs gelesen
// Kartentext: „Choose a target and deal 100/160/240 damage to it." (Staffel nach Destruction-Magic-Stufe des Wirkers)
// Engine-Vorgabe (_engine.js ~43281, Styx 28.9.): „Wirkt ein GELIEHENER Held, lesen Stufenabfragen (`effectiveSchoolLevelForCaster`) seine Zonen, nicht die des gleich nummerierten eigenen Helden" – über `gs._wirkerSeite`.
// Aufbau: Held 1 von Sitz 1 ist von Sitz 0 gecharmt (`charmedBy = 0`) und hat Destruction Magic 1. Der gleichindizierte eigene Held 1 von Sitz 0 hat Destruction Magic 3. Sitz 0 spielt Burning Finger
//   mit dem geliehenen Helden (`charmedOwner: 1`) auf Held 0 von Sitz 1.
// Erwartet: DM-Stufe des Wirkers = 1 ⇒ 100 Schaden.
// Beobachtet: 240 Schaden (Stufe 3 des gleichindizierten eigenen Helden). Kontrolle Heal (Support Magic 1 geliehen / 3 eigen) liefert korrekt 150.
// Ursache: `server.js` doPlaySpell stempelt `gs._wirkerSeite` nur um `executeCardWithChain` (finally ~Z. 8313), `runHooks('onPlay')` (~Z. 8397) läuft danach OHNE Stempel;
//   `burning-finger.js` Z. 27 ruft `engine.effectiveSchoolLevelForCaster('Destruction Magic', pi, heroIdx)` ohne 4. Argument (`heroOwner`), der Rückgriff auf `_wirkerSeite` greift nicht mehr.
//   Eine ähnliche Aufrufform (`effectiveSchoolLevelForCaster(…, pi, heroIdx)`) steht in 24 weiteren Skripten (anti-magic, aurora-borealis, barrier-of-faith, big-oopsie, create-secret-room, demon-s-gate, dive-down, draw, fire-bolts, frost-breaker, mass-routing,
//   masterpiece, nieht-the-blitz-blade, old-couple, phoenix-tackle, slow, soul-transmigration-ritual, surprise-party, test-flight, the-melting, the-warlord-s-bite, venom-infusion, victory-phoenix-cannon, weapon-storm) – ob sie das 4. Argument anders übergeben, ist nicht einzeln geprüft.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Burning Finger'], []], hp: 800 });
  t.hero(1, 1).charmedBy = 0;
  t.setAbilities(1, 1, [['Destruction Magic'], [], []]);
  t.setAbilities(0, 1, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0) || valid[0]).id];
  t.policy.confirm = true;
  await t.play(0, 'Burning Finger', { hero: 1, charmedOwner: 1, noGrant: true });
  R.check('der geliehene Wirker (Destruction Magic 1) verursacht 100 Schaden', 800 - t.hp(1, 0) === 100, 800 - t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
