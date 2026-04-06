// ═══════════════════════════════════════════
//  CARD EFFECT: "Supply Chain"
//  Spell (Support Magic Lv2, Normal)
//  Draw until you have 7 cards in hand.
//  Cards are drawn one by one.
//  Can only be used while player has <7 cards.
// ═══════════════════════════════════════════

module.exports = {
  spellPlayCondition(gs, pi) {
    return (gs.players[pi]?.hand || []).length < 8;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];

      const handSize = (ps.hand || []).length;
      // Draw to 8 (not 7) because Supply Chain itself is still in hand during resolution
      const drawCount = 8 - handSize;
      if (drawCount <= 0) return;

      // Confirm
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Supply Chain',
        message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''} (to 7 in hand).`,
        confirmLabel: `📦 Deliver! (+${drawCount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // Draw cards one by one
      for (let i = 0; i < drawCount; i++) {
        if ((ps.mainDeck || []).length === 0) break;
        await engine.actionDrawCards(pi, 1);
        engine.sync();
        if (i < drawCount - 1) await engine._delay(200);
      }

      engine.log('supply_chain', { player: ps.username, drawn: drawCount });
      engine.sync();
    },
  },
};
