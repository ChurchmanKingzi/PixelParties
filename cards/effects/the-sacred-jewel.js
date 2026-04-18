// ═══════════════════════════════════════════
//  CARD EFFECT: "The Sacred Jewel"
//  Artifact (cost 0)
//
//  IN-BATTLE EFFECT:
//    When played, the caster may choose to make
//    both players draw 1 card. Choosing to do so
//    locks the caster's hand for the rest of the
//    turn (no further draws of any kind).
//
//    Reuses the engine's existing `ps.handLocked`
//    flag — actionDrawCards short-circuits when
//    set, and the flag is reset during turn-start
//    housekeeping.
//
//  Artifacts go through `script.resolve(engine,
//  pi, ...)` rather than onPlay hooks. No
//  targeting, so we skip isTargetingArtifact and
//  let the server route us to the no-targeting
//  branch of use_artifact_effect.
//
//  Returning `{ cancelled: true }` keeps the card
//  in hand when the player declines the confirm
//  — matches the Alchemic Journal pattern (click
//  to consider, back out without discarding).
//
//  DECK-BUILDER EFFECT (handled in the deck
//  builder, not here):
//    If the deck contains ≥ 4 copies of this
//    Artifact, all Artifacts (including this one)
//    may be included up to 5 copies instead of 4.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Sacred Jewel';

module.exports = {
  // Greys out the card in hand when the caster is hand-locked — the
  // draw effect would fizzle with nothing happening, so the server's
  // use_artifact_effect handler refuses activation in that state.
  blockedByHandLock: true,

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    const oi = 1 - pi;

    const choice = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: 'Make both players draw 1 card? If you do, you cannot draw any more cards for the rest of this turn.',
      confirmLabel: '💎 Yes, draw',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!choice || choice.cancelled) return { cancelled: true };

    // Caster draws 1, opponent draws 1. Lock is set AFTER both draws
    // so the caster's own draw isn't blocked by the lock we're about
    // to apply.
    await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
    await engine.actionDrawCards(oi, 1, { source: CARD_NAME });
    ps.handLocked = true;

    engine.log('sacred_jewel_draw', {
      player: gs.players[pi]?.username,
      note: 'both drew 1, caster hand locked for rest of turn',
    });
    engine.sync();
  },
};
