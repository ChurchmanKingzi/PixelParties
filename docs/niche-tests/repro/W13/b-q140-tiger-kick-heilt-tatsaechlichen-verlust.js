'use strict';
// W13 / Q140 (M01-19) · Ferocious Tiger Kick (2. Attack): „the user is healed for any damage this Attack dealt" (Al: „Den tatsächlichen Verlust")
// Erwartung: Overkill zählt nicht (Ziel mit 10 HP → Heilung 10), bei ausreichend HP heilt der volle Angriffswert (40). Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [label, onCreature, zielHp, erwartet] of [['Held 10 HP', false, 10, 410], ['Kreatur 10 HP', true, 10, 410], ['Held 800 HP', false, 800, 440], ['Kreatur 200 HP', true, 200, 440]]) {
    const t = await H.fresh({ hand: [['Ferocious Tiger Kick'], []], hp: 800 });
    t.grantFor(0, 0, 'Ferocious Tiger Kick');
    t.hero(0, 0).hp = 400;
    if (onCreature) { t.put(1, 0, 0, zielHp === 10 ? H.INERT.frail : H.INERT.creature); t.targetFn = (valid) => [valid.find(v => v.type === 'equip').id]; }
    else { t.hero(1, 0).hp = zielHp; t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; }
    t.gs.players[0].attacksPlayedThisTurn = 1;
    const r = await t.play(0, 'Ferocious Tiger Kick', { hero: 0, keepActions: true });
    R.check(`${label}: gespielt, Heilung → ${erwartet - 400}`, r === true && t.hp(0, 0) === erwartet, { r, hp: t.hp(0, 0) });
    R.check(`${label}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
