// ═══════════════════════════════════════════
//  CARD EFFECT: "Weakening Crystal"
//  Artifact (Normal, cost 15) — Crystals
//
//  When you draw or add this card to your hand,
//  you must immediately reveal it. While this
//  card is in your hand, the effects of all your
//  Heroes are negated. This counts as a negative
//  status effect.
//
//  Implementation:
//   • `revealOnEnterHand: true` — engine auto-
//     stamps `_permanentlyRevealedHandIndices` on
//     every canonical add-to-hand path.
//   • Hero-effect negation — handled in the
//     engine's `getActiveHeroEffects` gate: it
//     short-circuits to `[]` when the
//     controller's hand contains a copy.
//   • The Artifact has no Spell-style "play me"
//     payoff — using it as an Artifact pays the
//     gold cost and discards. The mere presence
//     in hand is the threat.
// ═══════════════════════════════════════════

const CARD_NAME = 'Weakening Crystal';

module.exports = {
  // CPU: alwaysCommit — Dauer-Aura: Nutzen liegt in GEGNER-Zügen, für das Immediate-Gate unsichtbar (Equipment-Bugklasse).
  // planArtifactPlay filtert Bezahlbarkeit bereits; entspricht der
  // dokumentierten Artifact-Politik "played as soon as affordable".
  cpuMeta: { alwaysCommit: true },
  isTargetingArtifact: true,
  revealOnEnterHand: true,

  // No board targets — playing it just discards the Crystal for its
  // gold cost (handled by the engine as a normal Artifact play).
  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Weakening Crystal has no effect when played from hand. Pay 15 Gold to discard it.',
    confirmLabel: '🔮 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    // No-op: the gold cost is auto-deducted by the engine for the
    // play. The Crystal already left the hand by the time `resolve`
    // fires (Artifact plays splice the card before resolution), so
    // its hero-effect-negation aura naturally lifts when discarded.
    engine.log('weakening_crystal_discarded', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },
};
