// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloud in a Bottle"
//  Potion (Reaction) — After-damage reaction.
//  When any target you control takes damage
//  (any source), halve the damage (rounded up)
//  and apply the Cloudy buff (halves all future
//  damage this turn).
//
//  Since the after-damage system fires AFTER
//  damage is dealt, the "halving" is implemented
//  by restoring floor(damage/2) HP after the
//  damage resolves.
//
//  The Cloudy buff expires at end of turn
//  (start of the next player's turn).
// ═══════════════════════════════════════════

module.exports = {
  isAfterDamageReaction: true,
  isPotion: true,

  // Not proactively usable — grayed out in hand
  canActivate: () => false,

  /**
   * Triggers on ANY damage to our hero (any source, any type).
   */
  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    if (amount <= 0) return false;
    // Don't trigger if the hero already has the cloudy buff (no stacking)
    if (target?.buffs?.cloudy) return false;
    return true;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Restore floor(amount/2) HP — effectively halving the damage (rounded up)
    const halfDmg = Math.ceil(amount / 2);
    const restoreAmount = amount - halfDmg; // = floor(amount / 2)
    if (restoreAmount > 0 && target.hp > 0) {
      target.hp = Math.min(target.hp + restoreAmount, target.maxHp);
      engine.log('cloud_bottle_restore', {
        player: ps.username, hero: target.name,
        originalDamage: amount, effectiveDamage: halfDmg, restored: restoreAmount,
      });
    }

    // Cloud gather animation on the protected hero
    engine._broadcastEvent('play_zone_animation', {
      type: 'cloud_gather', owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
    });
    await engine._delay(600);

    // Apply Cloudy buff — expires at start of next turn (= end of this turn)
    const nextPlayer = gs.activePlayer === 0 ? 1 : 0;
    await engine.actionAddBuff(target, pi, targetHeroIdx, 'cloudy', {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: nextPlayer,
      source: 'Cloud in a Bottle',
      addAnim: 'cloud_gather',
      removeAnim: 'cloud_disperse',
    });

    engine.log('cloud_bottle', {
      player: ps.username, hero: target.name,
    });

    engine.sync();
  },
};
