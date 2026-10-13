'use strict';
// A06-rebelliokai-31 · Bear Rider: Handstufen-Senkung gilt nur für Sitz 0 und 1 (Mehrspieler-Partien)
// Kartentext Mischief Militia - Bear Rider: „This card's level in your hand is reduced by 1 for every Frozen target on the board. While this Creature's level
//   is 0, you may summon it as an additional Action."
// Regel (CARD_API.md): Gegner-/Sitz-Index nie hart verdrahten; die Engine kennt 2-4 Sitze (`engine.playerCount()`).
// Beobachtung: `recomputeBearRiderHandLevelAllPlayers` (_mischief-militia-shared.js:325) ruft nur `recomputeBearRiderHandLevel(engine, 0)` und `(engine, 1)`.
//   Die Bear Rider in der Hand von Sitz 2/3 bekommen die Senkung bei Frost-Ereignissen nie; die Karte bleibt Stufe 2 und nicht als Zusatzaktion spielbar.
// Erwartung: bei 2 gefrorenen Zielen ist die Karte in der Hand jedes Sitzes Stufe 0 und ohne Summoning Magic spielbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, BR = 'Mischief Militia - Bear Rider';
  for (const seat of [1, 2]) {
    const hands = [['Snowstorm Mischief'], [], []]; hands[seat].push(BR);
    const t = await H.fresh({ seats: 3, hand: hands });
    t.put(1, 0, 0, D); t.put(2, 0, 0, D);
    // Sitz 0 friert per Snowstorm Mischief alle Kreaturen ein (2 gefrorene Ziele)
    const r = await t.play(0, 'Snowstorm Mischief', { hero: 0 });
    const frozen = t.inst(c => c.zone === 'support' && c.counters.frozen).length;
    const eff = t.engine.effectiveCardLevel(t.engine._getCardDB()[BR], seat, { handIdx: 0 });
    R.check('Sitz ' + seat + ': Bear Rider in der Hand ist bei ' + frozen + ' gefrorenen Zielen Stufe 0', r === true && frozen === 2 && eff === 0, { r, frozen, eff, offsets: t.gs.players[seat]._handLevelOffsetsTransient });
    R.check('Sitz ' + seat + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
