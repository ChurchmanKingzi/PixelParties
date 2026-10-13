'use strict';
// R02-12 · Rioting Village: „when a Hero deals damage with an Attack, it takes half the damage dealt as recoil" – trifft der Attack eine KREATUR, gibt es keinen Rückstoß
// Kartentext: „While this Area Spell remains on the board, all Heroes have their Attack stats doubled, but no player can use more than 1 Attack per turn and when a Hero deals damage with an Attack, it takes half the damage dealt as recoil (rounded up). This recoil damage cannot be reduced or negated."
// Aufbau: Rioting Village liegt (Area von Sitz 0); Held 0 von Sitz 0 (ATK 80 nach Verdopplung) spielt „Attack" („Choose a target and deal damage equal to the attacker's Attack stat to it").
//   (a) Ziel: Held 0 von Sitz 1  (b) Ziel: eine Kreatur (ZZ Dummy 1000 HP) in Support Zone 0 von Held 0 von Sitz 1.
// Erwartet: in beiden Fällen 80 Schaden am Ziel und 40 Rückstoß am Angreifer (Held 0 von Sitz 0: 760 HP). Der Text nennt keine Einschränkung auf Heldenziele.
// Beobachtet: (a) ✓ 720 / 760. (b) Kreatur verliert 80 (920 HP), der Angreifer bleibt bei 800 HP – kein Rückstoß.
// Ursache: `rioting-village.js` `afterDamage` hängt nur am Heldenschaden-Hook; es gibt keinen Zweig für `afterCreatureDamage` (o. ä.) – Schaden an Kreaturen löst `afterDamage` nicht aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const ziel of ['(a) Held', '(b) Kreatur']) {
    const t = await H.fresh({ hand: [['Attack'], []], hp: 800 });
    t.putArea(0, 'Rioting Village');
    await t.engine.syncAlleAtkAuren?.();
    let cre = null;
    if (ziel.startsWith('(b)')) cre = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => {
      const v = ziel.startsWith('(a)') ? valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0) : valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 0);
      return [(v || valid[0]).id];
    };
    t.policy.confirm = true;
    R.check(`${ziel}: Aufbau – ATK von Held 0 (Sitz 0) ist verdoppelt (80)`, t.gs.players[0].heroes[0].atk === 80, t.gs.players[0].heroes[0].atk);
    const r = await t.play(0, 'Attack', { hero: 0 });
    const getroffen = ziel.startsWith('(a)') ? 800 - t.hp(1, 0) : 1000 - (cre.counters.currentHp ?? 1000);
    R.check(`${ziel}: das Ziel verliert 80`, getroffen === 80, { r, getroffen });
    R.check(`${ziel}: der Angreifer erleidet 40 Rückstoß (760 HP)`, t.hp(0, 0) === 760, t.hp(0, 0));
    R.check(`${ziel}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
