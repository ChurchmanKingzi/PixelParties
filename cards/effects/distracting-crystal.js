// ═══════════════════════════════════════════
//  CARD EFFECT: "Distracting Crystal"
//  Artifact (Normal, cost 15) — Crystals
//
//  When you draw or add this card to your hand,
//  you must immediately reveal it. While this
//  card is in your hand, you cannot activate
//  effects that include adding cards from your
//  hand or discard pile to your deck.
//
//  Implementation:
//   • `revealOnEnterHand: true` — engine auto-
//     reveals on every add-to-hand path.
//   • Effect lock — server.js's
//     `isShuffleIntoDeckBlockedByDistractingCrystal`
//     gate runs at the top of every `doPlay*` /
//     `doActivate*` / `doConfirmPotion` /
//     `doUseArtifactEffect` handler and rejects
//     a play whose script declares
//     `shufflesFromHandOrDiscardIntoDeck: true` while the
//     activator's hand still contains a copy.
//     Same set of cards "No Retreat!" can negate.
// ═══════════════════════════════════════════

const CARD_NAME = 'Distracting Crystal';

module.exports = {
  isTargetingArtifact: true,
  revealOnEnterHand: true,

  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Distracting Crystal has no effect when played from hand. Pay 15 Gold to discard it.',
    confirmLabel: '🔮 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    engine.log('distracting_crystal_discarded', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },
};
