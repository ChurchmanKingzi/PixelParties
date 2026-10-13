'use strict';
// F03-artifacts-14 · Warhorse, The Master's Sword, Vampiric Sword: die Angriffs-Boni gelten nur gegen Helden, nicht gegen Kreaturen als Ziel
// Kartentexte: Warhorse „When the equipped Hero hits exactly 1 target with an Attack, that Attack's damage is increased by 50."
//              The Master's Sword „… as long as the Hero's HP are greater than or equal to their maximum, the Hero deals additional damage equal to its Attack stat when it hits a single target with an Attack."
//              Vampiric Sword „… whenever the equipped Hero deals damage to a target with an Attack, it heals for half the amount (rounded up)."
// Aufbau: Sitz 0 rüstet die Waffe an Held 0 (ATK 40 Basis) und greift mit der Karte „Attack" (Basisschaden = ATK) ein einzelnes Ziel an: (a) Gegner-Held, (b) Gegner-Kreatur (1000 HP).
// Erwartung: gleicher Bonus bei (b) wie bei (a) – eine Kreatur ist ein Ziel (Warhorse +50, Master's Sword doppelt, Vampiric heilt die Hälfte des Schadens).
// Beobachtet (✗): gegen die Kreatur wirkt nichts (Schaden nur ATK, kein Heilen); gegen den Helden wirken alle drei (Kontrolle ✓).
// Ursache: `warhorse.js` und `the-master-s-sword.js` hängen am `beforeDamage`-Hook (nur Heldenziele), `vampiric-sword.js` an `afterDamage`; Kreaturenschaden läuft über die Kreaturen-Hooks
//   (`beforeCreatureDamage`/`afterCreatureDamageBatch`), die diese Skripte nicht implementieren. Das Gegenstück Hands of Big Gwen (F03-… ✓) und das Knife lesen den Kreaturen-Batch.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const tgt = (type, o, h, s) => (valid) => { const v = valid.find(v => v.type === type && v.owner === o && v.heroIdx === h && (s == null || v.slotIdx === s)); return v ? [v.id] : undefined; };
  const faelle = [
    ['Warhorse', 90, 0],            // erwarteter Schaden bei ATK 40: +50
    ["The Master's Sword", 100, 0], // ATK 50 → doppelt
    ['Vampiric Sword', 50, 25],     // ATK 50 → Heilung ⌈50/2⌉
  ];
  for (const [waffe, erwSchaden, erwHeilung] of faelle) {
    for (const ziel of ['hero', 'creature']) {
      const t = await H.fresh({ hand: [[waffe, 'Attack'], []], hp: 800 });
      const big = t.put(1, 0, 0, H.INERT.big, { counters: { currentHp: 1000, maxHp: 1000 } });
      await t.play(0, waffe, { hero: 0, slot: 0 });
      if (waffe === 'Vampiric Sword') t.hero(0, 0).hp = 400;
      const eigen0 = t.hp(0, 0);
      const vor = ziel === 'hero' ? t.hp(1, 0) : big.counters.currentHp;
      t.targetFn = ziel === 'hero' ? tgt('hero', 1, 0) : tgt('equip', 1, 0, 0);
      await t.play(0, 'Attack', { hero: 0 });
      const schaden = vor - (ziel === 'hero' ? t.hp(1, 0) : big.counters.currentHp);
      const heil = t.hp(0, 0) - eigen0;
      R.check(`${waffe} gegen ${ziel === 'hero' ? 'Held' : 'Kreatur'}: Schaden ${erwSchaden}${erwHeilung ? `, Heilung ${erwHeilung}` : ''}`, schaden === erwSchaden && heil === erwHeilung, { schaden, heil });
    }
  }
  R.finish();
})();
