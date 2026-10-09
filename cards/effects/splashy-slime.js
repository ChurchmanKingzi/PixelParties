// ═══════════════════════════════════════════
//  CARD EFFECT: "Splashy Slime"
//  Creature — On summon: Gain 4 Gold × number
//  of unique lv 0 Creatures (by original level)
//  you control.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════


const { hasCardType, isArtifactCreature } = require('./_hooks');

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
        // Wirksame Kartendaten (Biomancy-Token tragen den Namen einer Potion).
        // Puppets (nur „waehlbar als Creature") und Artifact Creatures (kein
        // Level — Als Ruling 9.10.) zaehlen nicht als „Creature mit Level 0".
        const c = (t.cardInstance ? engine.getEffectiveCardData(t.cardInstance) : null) || cardDB[t.cardName];
        if (c && hasCardType(c, 'Creature') && !isArtifactCreature(c) && (c.level || 0) === 0) uniqueNames.add(t.cardName);
      }

      const count = uniqueNames.size;
      if (count === 0) return; // Shouldn't happen since Splashy Slime itself is lv 0

      const goldAmount = 4 * count;
      engine.log('splashy_gold', { player: ps.username, count, amount: goldAmount, creatures: [...uniqueNames] });

      // Use standard gold gain action — triggers the +X animation automatically
      await engine.actionGainGold(pi, goldAmount);
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
