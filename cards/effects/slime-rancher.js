// ═══════════════════════════════════════════
//  CARD EFFECT: "Slime Rancher"
//  Creature Lv1 — Two passive effects:
//
//  1) BEFORE_LEVEL_CHANGE: When another Slime's
//     level increases via effect, increase by 1
//     more. Multiple Ranchers stack (+1 each).
//     Non-chaining (modifies delta, not new action).
//
//  2) Additional Action: Controller may summon 1
//     "Slime" Creature (except "Slime Rancher")
//     per turn as an additional action. Once ANY
//     non-Rancher Slime is summoned, ALL Rancher
//     additionals for that player expire.
//     Restored at Start Phase.
// ═══════════════════════════════════════════

const ADDITIONAL_TYPE = 'summon_slime_not_rancher';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;

      // Register the additional action type (idempotent — OK to call multiple times)
      engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: 'Slime Rancher',
        actionType: 'Creature',
        filter: (cardData) => {
          return cardData.cardType === 'Creature'
            && cardData.archetype === 'Slimes'
            && cardData.name !== 'Slime Rancher';
        },
      });

      // Check if a non-Rancher Slime was already summoned this turn
      const cardDB = engine._getCardDB();
      const currentTurn = engine.gs.turn || 0;
      const alreadySummoned = engine.cardInstances.some(inst => {
        if (inst.owner !== ctx.cardOwner) return false;
        if (inst.zone !== 'support') return false;
        if (inst.turnPlayed !== currentTurn) return false;
        if (inst.id === ctx.card.id) return false; // Skip self
        const data = cardDB[inst.name];
        return data && data.archetype === 'Slimes' && data.name !== 'Slime Rancher';
      });

      // Only grant additional action if no non-Rancher Slime was summoned yet
      if (!alreadySummoned) {
        ctx.grantAdditionalAction(ADDITIONAL_TYPE);
      }
      engine.sync();
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;

      const engine = ctx._engine;

      // Re-register type each turn (in case engine was reset)
      engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: 'Slime Rancher',
        actionType: 'Creature',
        filter: (cardData) => {
          return cardData.cardType === 'Creature'
            && cardData.archetype === 'Slimes'
            && cardData.name !== 'Slime Rancher';
        },
      });

      // Restore this Rancher's additional action
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);
    },

    // Passive 1: Boost Slime level-ups by +1
    beforeLevelChange: (ctx) => {
      // Only boost if the target is a Slime (not Rancher) owned by same player
      const target = ctx.targetCard;
      if (!target) return;
      if (target.owner !== ctx.cardOwner) return;
      if (target.name === 'Slime Rancher') return;
      if (ctx.delta <= 0) return; // Only boost increases

      // Check if target card is a Slime by archetype
      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const targetData = cardDB[target.name];
      if (!targetData || targetData.archetype !== 'Slimes') return;

      // Add +1 to the delta (stacks with other Ranchers)
      ctx.delta += 1;
    },

    // Passive 2: When a non-Rancher Slime enters a support zone, expire all Rancher additionals
    onCardEnterZone: (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (entering.owner !== ctx.cardOwner) return;
      if (ctx.toZone !== 'support') return;

      // Check if it's a non-Rancher Slime
      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const cardData = cardDB[entering.name];
      if (!cardData || cardData.archetype !== 'Slimes') return;
      if (cardData.name === 'Slime Rancher') return;

      // Expire ALL Rancher additional actions for this player
      ctx.expireAllAdditionalActions(ADDITIONAL_TYPE);
    },
  },
};
