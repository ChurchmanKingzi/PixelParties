// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Skeleton"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn gain 6 Gold.
// ═══════════════════════════════════════════

// Als Ruling 17.8. ("Tuscan Aristocrat"), analog zum Zieh-Riegel:
// ist der Gold-Gewinn der EINZIGE Nutzen, wird die Karte gesperrt
// statt wirkungslos zu feuern. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

const CARD_NAME = 'Treasure Skeleton';
const GOLD = 6;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  // "You may once per turn gain 6 Gold" — kein anderer Ertrag.
  // Gesperrt heisst hier auch: das Once-per-turn bleibt unverbraucht.
  canActivateCreatureEffect(ctx) {
    return !goldGainWouldBeBlocked(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    await ctx.gainGold(GOLD);
    ctx._engine.log('treasure_skeleton', {
      player: ctx._engine.gs.players[ctx.cardOwner]?.username, gold: GOLD,
    });
    return true;
  },
};
