// ═══════════════════════════════════════════
//  CARD EFFECT: "Ingo, Investor of Evil"
//  Hero — 400 HP, 40 ATK — BANNED
//  Starting abilities: Summoning Magic, Wealth
//
//  Whenever a Creature is placed into one of
//  your Heroes' Support Zones, gain 4 Gold.
//
//  Trigger: onCardEnterZone, filtered to
//  Creatures entering this player's own support
//  zones (enteringCard.owner === cardOwner).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      if (ctx.toZone !== 'support') return;

      // Only trigger for creatures entering this player's own support zones
      const entering = ctx.enteringCard;
      if (!entering || entering.owner !== pi) return;

      const cd = engine.getEffectiveCardData(entering) || engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Ingo must be alive
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Coin burst on Ingo's gold display
      engine._broadcastEvent('play_gold_coins', { owner: pi });

      await ctx.gainGold(4);

      engine.log('ingo_gold', {
        player: gs.players[pi].username, creature: entering.name,
      });
      engine.sync();
    },
  },
};
