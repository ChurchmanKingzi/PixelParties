'use strict';
// M01-06 · Friendship Lv1: Zusatzaktion ist gesperrt, wenn VORHER schon ein Support-Magic-Spell gewirkt wurde (Text sperrt nur „andere" Support Spells)
// Kartentext Friendship 1): „You may once per turn use a Support Magic Spell as an additional Action with this Hero. If you do, you cannot use any other Support Magic Spells this turn."
// Skript: friendship.js `buildFilter`: „Lv1 restriction: no Support Spells used yet this turn" (`ps.supportSpellUsedThisTurn`); die Nach-Sperre `supportSpellLocked` setzt server.js (~Z. 8560).
// Aufbau: Held 0 mit Support Magic Lv1 (Spell: Haste, Lv1) und Friendship (Lv1/2); Hand: 3× Haste; Zugbeginn-Hook (Zusatzaktion bereitstellen).
// Schritte: 1. Normale Aktion: Haste. 2. Mit der Friendship-Zusatzaktion ein zweites Haste.
// Lesart A (Skript): Lv1: das zweite Haste wird abgelehnt (die Sperre gilt rückwirkend). Lesart B (Wortlaut „cannot use any other … this turn" = nur danach): erlaubt, danach gesperrt.
// Beobachtet: Lv1 lehnt ab (false); Lv2 erlaubt (wie Lv2-Text: „use … as an additional Action, then draw 1").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const lvl of [1, 2]) {
    const t = await H.fresh({ hand: [['Haste', 'Haste', 'Haste'], []], hp: 800, deckSize: 30, abilities: { 0: { 0: [['Support Magic'], Array(lvl).fill('Friendship'), []] } } });
    await t.run(() => t.engine.runHooks('onTurnStart', { turn: t.gs.turn, activePlayer: 0 }));
    const r1 = await t.play(0, 'Haste', { hero: 0, noGrant: true });
    const r2 = await t.play(0, 'Haste', { hero: 0, noGrant: true, keepActions: true });
    R.note(`Lv${lvl}: 1. Haste (normale Aktion) = ${r1}, 2. Haste (Friendship-Zusatz) = ${r2}`);
    if (lvl === 1) R.check('Lesart B (Wortlaut): Lv1 erlaubt das zweite Support-Spell als Zusatzaktion, wenn das erste schon gewirkt war', r2 === true, { r1, r2 });
    else R.check('Lv2: zweites Haste erlaubt', r2 === true, { r1, r2 });
  }
  R.finish();
})();
