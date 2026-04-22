// ═══════════════════════════════════════════
//  CARD EFFECT: "Alchemy"
//  Ability — Free activation during Main Phase
//  (no action cost). Hard once per turn (by name).
//
//  Lv1: Pay 8 Gold → draw 1 from Potion Deck.
//  Lv2: Pay 4 Gold → draw 1 from Potion Deck.
//  Lv3: Free → draw 1 from Potion Deck.
//
//  Cannot activate if not enough gold or potion
//  deck is empty. When unusable, the zone is NOT
//  highlighted but also NOT grayed out.
// ═══════════════════════════════════════════

module.exports = {
  blockedByHandLock: true,
  activeIn: ['ability'],
  freeActivation: true,

  // CPU threat assessment. Potion draw per turn at all levels; net gold cost
  // varies. Returning numbers lets the CPU rank hero supporters dynamically
  // (see _cpu.js heroSupportUnits).
  supportYield(level) {
    const cost = level >= 3 ? 0 : level >= 2 ? 4 : 8;
    return { potionDrawsPerTurn: 1, goldPerTurn: -cost };
  },

  /**
   * Check if Alchemy can be activated right now.
   * Requires enough gold and at least 1 card in potion deck.
   */
  canFreeActivate(ctx, level) {
    const ps = ctx.players[ctx.cardOwner];
    const goldCost = level >= 3 ? 0 : level >= 2 ? 4 : 8;
    if ((ps.gold || 0) < goldCost) return false;
    if ((ps.potionDeck || []).length === 0) return false;
    return true;
  },

  /**
   * Execute: pay gold, draw 1 from potion deck.
   * Returns true to claim HOPT.
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    const goldCost = level >= 3 ? 0 : level >= 2 ? 4 : 8;

    // Confirmation prompt
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Alchemy',
      message: goldCost > 0
        ? `Spend ${goldCost} Gold to draw 1 card from your Potion Deck?`
        : 'Draw 1 card from your Potion Deck for free?',
    });
    if (!confirmed) return false; // Cancelled — don't claim HOPT

    // Pay gold
    if (goldCost > 0) {
      if ((ps.gold || 0) < goldCost) return false; // Safety
      ps.gold -= goldCost;
      engine.log('gold_spent', { player: ps.username, amount: goldCost, reason: 'Alchemy' });
      engine._broadcastEvent('gold_change', { owner: pi, amount: -goldCost });
    }

    // Draw 1 from potion deck
    if ((ps.potionDeck || []).length === 0) return false; // Safety
    await engine.actionDrawFromPotionDeck(pi, 1);

    engine.sync();
    return true;
  },
};
