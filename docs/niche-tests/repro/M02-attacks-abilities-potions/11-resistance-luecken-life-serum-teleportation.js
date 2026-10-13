'use strict';
// M02-11 · Resistance schützt nicht vor Life Serum (+150 Max-HP) und Teleportation Powder (Entfernen aus dem Spiel)
// Kartentext Resistance: Lv1 „The first card or effect every turn that would affect this Hero, except damage, doesn't affect it." ·
//   Lv3 „This Hero is unaffected by all cards and effects, except damage."
// Kartentexte: Life Serum „Choose any target on the board and increase its current and max HP by 150." ·
//   Teleportation Powder „Choose an undefeated Hero your opponent controls and remove it … from the game completely."
// Erwartung: Lv3 – beide Karten wirken nicht auf den Helden; Lv1 – die erste Karte dieses Zuges wirkt nicht. Kontrolle: Poison Vial (Status) wird abgewehrt.
// Beobachtet: Poison Vial wird abgewehrt, aber Life Serum erhöht Max-HP/HP (800 → 950) und Teleportation Powder entfernt den Helden (Name leer, HP 0) –
//   in Lv1 UND Lv3. `resistance.js` fängt nur Status-Anwendungen (onStatusApplied) und `beforeHeroEffect` ab (feuert nur in `actionHealHero`);
//   `engine.increaseMaxHp` (_engine.js:10484) und der Entfernen-Weg von teleportation-powder.js fragen den Hook nie.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroT = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
  for (const lv of [1, 3]) {
    const mk = async (karte) => {
      const t = await H.fresh({ hand: [[], []], hp: 800 });
      t.setAbilities(1, 0, [Array(lv).fill('Resistance'), [], []]);
      t.targetFn = heroT;
      const r = await t.play(0, karte, { hero: 1 });
      return { t, r };
    };
    const pv = await mk('Poison Vial');
    R.check(`Lv${lv} Kontrolle: Poison Vial wird abgewehrt (kein Poison)`, !pv.t.hero(1, 0).statuses.poisoned, pv.t.hero(1, 0).statuses);
    const ls = await mk('Life Serum');
    R.check(`Lv${lv}: Life Serum wirkt nicht (Max-HP bleibt 800)`, ls.t.hero(1, 0).maxHp === 800, { maxHp: ls.t.hero(1, 0).maxHp, hp: ls.t.hero(1, 0).hp });
    const tp = await mk('Teleportation Powder');
    R.check(`Lv${lv}: Teleportation Powder entfernt den Helden nicht`, !!tp.t.hero(1, 0).name && tp.t.hero(1, 0).hp > 0, { name: tp.t.hero(1, 0).name, hp: tp.t.hero(1, 0).hp });
  }
  R.finish();
})();
