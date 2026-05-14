// ═══════════════════════════════════════════
//  CARD EFFECT: "Shiny Slime"
//  Creature — On summon: Draw 1 card for each
//  unique lv 0 Creature (by original level) you
//  control, including this one. Cards drawn 1 by
//  1 with delay.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════


module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = ctx.players[pi];

      // Count unique level-0 Creature names across our Support Zones.
      // Delegate enumeration to `engine.getCreatureTargets` — it
      // already iterates every Support Zone regardless of host-Hero
      // state (creatures are independent of their Hero) and filters
      // down to actual Creatures, so we only need to layer the
      // level-0 condition on top.
      const cardDB = engine._getCardDB();
      const uniqueNames = new Set();
      for (const t of engine.getCreatureTargets(pi)) {
        const c = cardDB[t.cardName];
        if (c && (c.level || 0) === 0) uniqueNames.add(t.cardName);
      }

      const count = uniqueNames.size;
      if (count === 0) return;

      engine.log('shiny_draw', { player: ps.username, count, creatures: [...uniqueNames] });

      // Draw cards
      await engine.actionDrawCards(pi, count);
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
