// ═══════════════════════════════════════════
//  CARD EFFECT: "Tool Freezer"
//  Artifact (Reaction) — When your opponent
//  plays ANY Artifact (including Equipment and
//  Reaction Artifacts), negate it. The opponent
//  does not pay the negated Artifact's cost.
//  This card's cost becomes 2× the negated
//  Artifact's current cost.
//
//  Can only react if the Artifact's current cost
//  is ≤ floor(player's gold / 2) — i.e., player
//  can afford 2× the cost.
//
//  Uses ice negation animation on the chain card.
// ═══════════════════════════════════════════

/**
 * Find the most recent Artifact link in the chain owned by the opponent.
 * This is the artifact Tool Freezer will negate.
 */
function getTargetArtifactLink(chain, pi) {
  if (!chain || chain.length === 0) return null;
  // Search from the end — the most recently played card
  for (let i = chain.length - 1; i >= 0; i--) {
    const link = chain[i];
    if (link.cardType === 'Artifact' && link.owner !== pi && !link.negated) {
      return { link, index: i };
    }
  }
  return null;
}

module.exports = {
  isReaction: true,
  isTargetingArtifact: true,

  /**
   * Reacts when an opponent plays ANY Artifact (initial or reaction),
   * and its current cost is affordable (≤ floor(gold / 2)).
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;

    // Don't prompt if this player already has a Tool Freezer in the chain
    if (chainCtx.chain.some(l => l.cardName === 'Tool Freezer' && l.owner === pi)) return false;

    const target = getTargetArtifactLink(chainCtx.chain, pi);
    if (!target) return false;

    // Check affordability: artifact cost ≤ floor(player's gold / 2)
    const artifactCost = target.link.goldCost || 0;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (artifactCost > Math.floor((ps.gold || 0) / 2)) return false;

    return true;
  },

  /**
   * Dynamic cost: 2× the target artifact's current cost.
   * Overrides the base card cost (1G in cards.json).
   */
  dynamicCost: (gs, pi, engine, chainCtx) => {
    const target = getTargetArtifactLink(chainCtx?.chain, pi);
    if (!target) return 0;
    return (target.link.goldCost || 0) * 2;
  },

  // Not proactively activatable (reaction only)
  canActivate: () => false,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Tool Freezer can only be activated as a Reaction to an Artifact.',
    confirmLabel: 'OK',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  /**
   * Resolve: negate the target artifact link.
   * Refund the opponent's gold cost (they don't pay for negated artifacts).
   * Ice negation animation (no flash).
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;

    // Find the target artifact to negate
    const target = getTargetArtifactLink(chain, pi);
    if (!target) return;

    engine.negateChainLink(chain, target.index, { negationStyle: 'ice' });

    // Refund gold for reaction artifacts (their cost was already deducted when chained).
    // Initial artifacts don't need refund — their gold is deferred until after chain resolution.
    const artifactCost = target.link.goldCost || 0;
    if (artifactCost > 0 && !target.link.isInitialCard) {
      const oppPs = engine.gs.players[target.link.owner];
      if (oppPs) {
        oppPs.gold = (oppPs.gold || 0) + artifactCost;
        engine.log('gold_refund', { player: oppPs.username, amount: artifactCost, reason: 'Tool Freezer negation' });
        engine._broadcastEvent('gold_change', { owner: target.link.owner, amount: artifactCost });
      }
    }

    engine.log('tool_freezer', {
      negated: target.link.cardName,
      owner: pi,
      artifactCost,
      toolFreezerCost: artifactCost * 2,
    });
  },
};
