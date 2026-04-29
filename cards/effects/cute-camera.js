// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Camera"
//  Artifact (Reaction) — When your opponent
//  plays a Reaction, negate it.
//  Pay 3G extra to close the chain (prevent
//  further reactions).
//  Camera itself is a Reaction, so another
//  Camera can negate it.
// ═══════════════════════════════════════════

module.exports = {
  isReaction: true,
  isTargetingArtifact: true,

  /**
   * Camera only reacts to opponent's reactions in the chain.
   * chainCtx.chain must have a non-initial link owned by the opponent.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    // Must be a non-initial card owned by the opponent
    return !lastLink.isInitialCard && lastLink.owner !== pi;
  },

  // Not proactively activatable (reaction only)
  canActivate: () => false,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Cute Camera can only be activated as a Reaction.',
    confirmLabel: 'OK',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  /**
   * Called after Camera is added to the chain but before resolution.
   * Prompts owner to pay 3G extra to close the chain.
   */
  onChainAdd: async (engine, pi, chain, myLink) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Check if player can afford the 3G chain-close cost
    if ((ps.gold || 0) >= 3) {
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Cute Camera',
        message: 'Spend 3 Gold extra to prevent further reactions?',
        confirmLabel: '📸 Close it! (3G)',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in 3G chain close.
      });

      if (confirmed) {
        ps.gold -= 3;
        myLink.chainClosed = true;
        engine.log('chain_closed', { card: 'Cute Camera', player: ps.username, extraCost: 3 });
        engine.sync();
      }
    }
  },

  /**
   * Resolve: negate the chain link directly below this one.
   * Also plays the camera flash animation.
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;

    // Play camera flash on all screens
    engine._broadcastEvent('camera_flash', { owner: pi });
    await engine._delay(600);

    // Negate the link below me
    if (myIndex > 0) {
      engine.negateChainLink(chain, myIndex - 1);
      engine.log('reaction_negated', {
        negator: 'Cute Camera',
        negated: chain[myIndex - 1]?.cardName,
        owner: pi,
      });
    }
  },
};
