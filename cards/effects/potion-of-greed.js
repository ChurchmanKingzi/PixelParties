// ═══════════════════════════════════════════
//  CARD EFFECT: "Potion of Greed"
//  Potion (Normal)
//
//  Draw 2 cards from your Potion Deck. Skip your
//  Action Phase this turn.
//
//  The Action-Phase skip is set as a per-turn
//  flag on the controller (`_skipActionPhaseTurn
//  = gs.turn`); the engine's `runPhase(ACTION)`
//  branch reads it and routes ACTION → MAIN2
//  immediately, forfeiting the Action slot.
// ═══════════════════════════════════════════

const CARD_NAME = 'Potion of Greed';

module.exports = {
  isPotion: true,

  // No targeting — Potion of Greed always resolves on activation.
  // Main Phase 1 ONLY (PHASES.MAIN1 === 2): the Action-Phase skip is
  // only meaningful when the Action Phase is still ahead. Drinking it
  // in Action Phase or Main Phase 2 would either be a no-op skip (the
  // Action slot was already used or never going to fire) or a
  // confusing retroactive lock — the card text reads "Skip your
  // Action Phase", which presupposes the phase hasn't started yet.
  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;
    if (gs.currentPhase !== 2) return false;
    return true;
  },
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Draw 2 cards from your Potion Deck. Your Action Phase is skipped.',
    confirmLabel: '🪙 Drink!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'gold_sparkle',

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    if (!ps.handLocked) {
      await engine.actionDrawFromPotionDeck(pi, 2);
    }

    // Skip Action Phase this turn — read by `runPhase(ACTION)`.
    ps._skipActionPhaseTurn = gs.turn;

    engine.log('greed_used', {
      player: ps.username, drew: 2,
    });
    engine.sync();
  },
};
