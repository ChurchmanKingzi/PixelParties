// ═══════════════════════════════════════════
//  CARD EFFECT: "Rusting Crystal"
//  Artifact (Normal, cost 15) — Crystals
//
//  When you draw or add this card to your hand,
//  you must immediately reveal it. While this card
//  is in your hand, the Costs of all your other
//  Artifacts are doubled. This effect does not
//  stack with itself.
//
//  Implementation:
//   • `revealOnEnterHand: true` — engine auto-
//     stamps `_permanentlyRevealedHandIndices` on
//     every canonical add-to-hand path.
//   • Cost-doubling — applied centrally in
//     `applyRustingCrystalCostMultiplier(gs, pi,
//     cardName, baseCost, engine)` in server.js.
//     The helper short-circuits when:
//       (a) `cardName === 'Rusting Crystal'` — the
//           Crystal's own cost is never doubled;
//       (b) no Rusting Crystal in the hand;
//       (c) Big Gwen Guard suppression is active.
//     Idempotent — multiple Rusting Crystals still
//     produce a single ×2 (matches "does not stack
//     with itself").
//   • The Artifact has no Spell-style payoff —
//     using it pays its (current) gold cost and
//     discards. The mere presence in hand is the
//     threat.
// ═══════════════════════════════════════════

const CARD_NAME = 'Rusting Crystal';

module.exports = {
  isTargetingArtifact: true,
  revealOnEnterHand: true,

  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Rusting Crystal has no effect when played from hand. Pay 15 Gold to discard it.',
    confirmLabel: '🔮 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    engine.log('rusting_crystal_discarded', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },
};
