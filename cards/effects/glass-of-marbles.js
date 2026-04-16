// ═══════════════════════════════════════════
//  CARD EFFECT: "Glass of Marbles"
//  Artifact (Normal, Cost 0) — BANNED
//
//  When this card is discarded or deleted from
//  your hand BY AN EFFECT, draw 2 cards.
//  Once per turn (HOPT keyed on card name +
//  player, shared across all copies).
//
//  Trigger: onDiscard / onDelete hooks.
//  Guard: ctx._fromHand must be true (set by
//  the engine on all effect-forced discards
//  from hand — not on voluntary plays).
// ═══════════════════════════════════════════

const CARD_NAME = 'Glass of Marbles';

module.exports = {
  // Active in hand so the hook fires while in hand,
  // and in discard/deleted so it still fires after
  // the zone update (engine sets zone before hook).
  activeIn: ['hand', 'discard', 'deleted'],
  neverPlayable: true, // Never played from hand; triggers only on effect discards

  hooks: {
    onDiscard: async (ctx) => {
      // Must have been discarded from hand by an effect
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      // HOPT shared across all copies (keyed by name + player)
      const hoptKey = `glass-of-marbles:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      engine.log('glass_of_marbles', { player: gs.players[pi]?.username });
      await engine.actionDrawCards(pi, 2);
      engine.sync();
    },

    onDelete: async (ctx) => {
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      const hoptKey = `glass-of-marbles:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      engine.log('glass_of_marbles', { player: gs.players[pi]?.username });
      await engine.actionDrawCards(pi, 2);
      engine.sync();
    },
  },
};
