// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Skeleton"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn gain 6 Gold.
// ═══════════════════════════════════════════

const CARD_NAME = 'Treasure Skeleton';
const GOLD = 6;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    await ctx.gainGold(GOLD);
    ctx._engine.log('treasure_skeleton', {
      player: ctx._engine.gs.players[ctx.cardOwner]?.username, gold: GOLD,
    });
    return true;
  },
};
