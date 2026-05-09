// ═══════════════════════════════════════════
//  SPELL: "Cool Rescue"
//  Add the top card of your Coolness Stack to your
//  hand. This counts as an additional Action.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cool Rescue';

module.exports = {
  inherentAction: true,

  spellPlayCondition(gs, pi) {
    return Array.isArray(gs.players[pi]?.coolnessStack) && gs.players[pi].coolnessStack.length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (!engine.hasCoolnessStack(pi)) {
        engine.gs._spellCancelled = true;
        return;
      }
      await ctx.popCoolnessStackTo(pi, 'hand', { source: CARD_NAME });
      engine.gs._spellFreeAction = true;
    },
  },
};
