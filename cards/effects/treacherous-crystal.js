// ═══════════════════════════════════════════
//  CARD EFFECT: "Treacherous Crystal"
//  Artifact (Normal, cost 15) — Crystals
//
//  When you draw or add this card to your hand,
//  you must immediately reveal it. While this card
//  is in your hand, your opponent MAY take control
//  of all Creatures you control during their turns
//  by clicking the Crystal.
//
//  Implementation:
//   • `revealOnEnterHand: true` — engine auto-
//     stamps `_permanentlyRevealedHandIndices`.
//   • Opt-in trigger — clicking the Crystal in
//     opp's hand emits `trigger_treacherous_crystal`,
//     handled by `doTriggerTreacherousCrystal` in
//     server.js. The handler walks every opp
//     Creature on the board and routes it through
//     `engine.actionStealCreature(pi, inst, …)`,
//     flipping `stolenBy` / `controller` to the
//     clicker for the rest of THIS turn. Stolen
//     state auto-reverts at next turn start via
//     the engine's `_revertStolenCreatures`
//     cleanup (same path Deepsea Succubus uses).
//   • Coverage: every Creature on opp's side
//     regardless of host Hero state (dead,
//     missing, Frozen, Stunned, Bound, …) — host
//     Hero status no longer gates the lend.
//     Cardinal Beasts and Golden-Wings wearers
//     (anything carrying `_cardinalImmune`) are
//     exempt. Big Gwen Guard's suppression aura
//     on opp's side disables the trigger.
//   • `engine.isTreacherousLent(activatorPi,
//     victimPi)` survives as a passive gate
//     helper for the client pulse affordance and
//     server-side trigger validation — it just
//     reports "the Crystal is currently lendable",
//     it does NOT auto-apply the steal anymore.
//   • The Artifact has no Spell-style payoff —
//     using it pays its (current) gold cost and
//     discards. The threat is purely the in-hand
//     trigger window.
// ═══════════════════════════════════════════

const CARD_NAME = 'Treacherous Crystal';

module.exports = {
  isTargetingArtifact: true,
  revealOnEnterHand: true,

  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Treacherous Crystal has no effect when played from hand. Pay 15 Gold to discard it.',
    confirmLabel: '🔮 Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    engine.log('treacherous_crystal_discarded', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },
};
