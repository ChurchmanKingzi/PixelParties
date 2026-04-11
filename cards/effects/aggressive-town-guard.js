// ═══════════════════════════════════════════
//  CARD EFFECT: "Aggressive Town Guard"
//  Creature (Summoning Magic Lv0) — If this is
//  the first creature summoned this turn, it
//  counts as an additional Action. Active once
//  per turn: deal 50 damage to any target.
// ═══════════════════════════════════════════

module.exports = {
  // Inherent additional action ONLY if no creatures have been summoned this turn
  inherentAction: (gs, pi, heroIdx, engine) => {
    const ps = gs.players[pi];
    return ps && (ps._creaturesSummonedThisTurn || 0) === 0;
  },

  // Active creature effect
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return true; // Always activatable (HOPT handled generically)
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const heroIdx = ctx.cardHeroIdx;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'normal',
      baseDamage: 50,
      title: 'Aggressive Town Guard',
      description: 'Deal 50 damage to a target.',
      confirmLabel: '👊 50 Damage!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) return false;

    // Punch impact animation
    const slot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('punch_impact', {
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot,
    });
    await engine._delay(400);

    // Deal damage
    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, 50, 'normal');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: 'Aggressive Town Guard', owner: pi, heroIdx },
        target.cardInstance, 50, 'normal',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.sync();
  },
};
