'use strict';
// A07-16 · Pangaia, the Dino Domain erhöht die HP einer Cardinal Beast („unaffected by all cards and effects")
//
// Kartentexte: Cardinal Beasts (Lv5): „This Creature is unaffected by all cards and effects." (500 HP)
//   Pangaia: „The current and max HP of all level 3 or higher Creatures either player summons are increased by 200."
// Erwartung: Eine Cardinal Beast wird von Pangaia nicht erfasst (500/500).
// Beobachtet: 700/700 (pangaia-the-dino-domain.js `onCardEnterZone` → `engine.increaseMaxHp` ohne Immunitätsprüfung).
// Praktische Folge klein (die Bestie nimmt ohnehin keinen Schaden), aber beobachtbar (z. B. „max HP ≥ 400"-Prüfungen).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pangaia, the Dino Domain'], []], deckSize: 10 });
  await t.play(0, 'Pangaia, the Dino Domain', { hero: 0 });
  const res = await t.engine.summonCreatureWithHooks('Cardinal Beast Baihu', 0, 0, 0, { source: 'test' });
  const c = res.inst.counters;
  R.check('Cardinal Beast Baihu hat 500/500 HP (Pangaia wirkt nicht)', (c.maxHp ?? 500) === 500 && (c.currentHp ?? 500) === 500, { cur: c.currentHp, max: c.maxHp });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
