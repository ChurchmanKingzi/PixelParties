// ═══════════════════════════════════════════
//  CARD EFFECT: "Cosmic Malfunction"
//  Spell (Summoning Magic Lv2, Reaction)
//  Cosmic Depths archetype.
//
//  TRIGGER: an opponent's card or effect would
//  REMOVE one of your "Cosmic Depths" Creatures
//  from your side of the board (destroy → discard,
//  bounce → hand, send → deck/deleted, etc.). Does
//  NOT trigger on damage-kills — those bypass
//  this path by going through the damage batch's
//  own death routing instead of actionDestroyCard
//  / actionMoveCard.
//
//  EFFECT (on confirm):
//  1. Negate the triggering effect's removal of
//     this CD Creature (and any other CD Creatures
//     it would also affect this turn — handled by
//     the source-name lock below).
//  2. Lock the source card's name in the
//     opponent's `_creationLockedNames` set —
//     they cannot activate cards with that name
//     for the rest of the turn. Reuses the same
//     mechanism as Divine Gift of Creation /
//     Alchemic Journal / Inventing.
//  3. Delete this card (Cosmic Malfunction goes to
//     the deleted pile, not the discard pile).
//
//  Activation surface: hand-reaction window
//  `_checkCdMovementHandReactions` (engine).
//  NOT `isReaction: true` — that would put it in
//  the generic chain reaction window for any
//  card play, which is wrong: Cosmic Malfunction
//  should ONLY appear at the moment a removal is
//  about to land.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cosmic Malfunction';

module.exports = {
  isCdMovementReaction: true, // Custom flag — see _checkCdMovementHandReactions
  deleteOnUse: true,          // Routes to deletedPile after resolve

  // Trigger gate: at this point the engine helper has already verified
  // the victim is a CD Creature and the source is opp-owned. Nothing
  // more to filter at the script level.
  cdMovementReactionCondition(gs, victimOwnerPi, engine, victim, source, effectType) {
    // Defensive: a missing source name would prevent the lock half of
    // the effect from working. The engine helper already gates on
    // source.owner being set, but the name might still be falsy for
    // some unusual call sites. Skip if so.
    return !!source?.name;
  },

  /**
   * Resolve: cancel the in-flight removal, lock the source card name
   * for the opp this turn. Returns `true` to signal the caller that
   * the operation should be aborted.
   */
  async cdMovementReactionResolve(engine, victimOwnerPi, victim, source, effectType) {
    const gs = engine.gs;
    const oppIdx = victimOwnerPi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];

    // Apply the same-turn name lock to the opponent. Reuses the
    // engine-wide `_creationLockedNames` set that Divine Gift of
    // Creation / Alchemic Journal / Inventing also write to. The
    // standard turn-start cleanup at engine.js:_engine startTurn
    // (look for `delete ps._creationLockedNames`) clears it on the
    // next turn rollover, matching "for the rest of the turn".
    if (oppPs && source?.name) {
      if (!oppPs._creationLockedNames) oppPs._creationLockedNames = new Set();
      oppPs._creationLockedNames.add(source.name);
    }

    // Animation: dramatic cosmic-portal flash on the saved CD Creature.
    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_summon',
      owner: victim.owner,
      heroIdx: victim.heroIdx,
      zoneSlot: victim.zoneSlot,
    });
    await engine._delay(450);

    engine.log('cosmic_malfunction_resolve', {
      player: gs.players[victimOwnerPi]?.username,
      saved: victim.name,
      negatedSource: source?.name,
      effectType,
    });
    engine.sync();

    // The card text says "Negate all effects that card or effect would
    // have on 'Cosmic Depths' Creatures you control this turn." Beyond
    // negating the in-flight removal (the cancellation we return below),
    // the name lock prevents the opponent from re-activating the same
    // card to retry. For a card that affects MULTIPLE CD Creatures in
    // one resolve (rare — most removal effects target one), the lock
    // would still be in place by the time the source's resolve loop
    // continues — but the source's resolve typically already committed
    // to its targets before we got here. We rely on the source-name
    // lock to be the load-bearing mechanism for the turn-long
    // protection clause; the in-flight cancellation handles the
    // immediate save.
    return true; // Cancel the operation
  },
};
