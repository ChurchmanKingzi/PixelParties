// ═══════════════════════════════════════════
//  CARD EFFECT: "Wheels"
//  Artifact — Draw 3 cards (one by one),
//  then force discard 1 card from hand.
//  Hard once per turn.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `wheels:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    return true;
  },

  // No targets needed — self-targeting effect
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Hop in! Draw 3 cards, then discard 1.',
    confirmLabel: '🛒 Drive!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Claim HOPT
    if (!engine.claimHOPT('wheels', pi)) return;

    // Draw 3 cards one by one
    for (let i = 0; i < 3; i++) {
      await engine.actionDrawCards(pi, 1);
      engine.sync();
      if (i < 2) await engine._delay(250);
    }

    // Force discard 1 — prompt the player to pick a card from hand
    if ((ps.hand || []).length === 0) return; // Nothing to discard

    const result = await engine.promptGeneric(pi, {
      type: 'forceDiscard',
      count: 1,
      title: 'Wheels',
      description: 'You must discard 1 card from your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    // Use the exact hand index the player clicked (validated)
    const handIdx = result.handIndex;
    if (handIdx == null || handIdx < 0 || handIdx >= ps.hand.length || ps.hand[handIdx] !== result.cardName) return;
    ps.hand.splice(handIdx, 1);
    ps.discardPile.push(result.cardName);
    engine.log('force_discard', { player: ps.username, card: result.cardName, by: 'Wheels' });
    engine.sync();
  },
};
