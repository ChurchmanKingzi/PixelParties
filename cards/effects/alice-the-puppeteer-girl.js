// ═══════════════════════════════════════════
//  CARD EFFECT: "Alice, the Puppeteer Girl"
//  Hero — Active effect (once per turn, Main Phase).
//  Choose a target the opponent controls and deal
//  50 × (number of Creatures you control that were
//  NOT summoned this turn) damage to it.
//  Treated as a Destruction Magic Spell.
//  Animation: red laser beam from Alice to target.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Can activate if the player controls at least 1 Creature
   * that was NOT summoned during this turn.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const currentTurn = engine.gs.turn || 0;

    return engine.cardInstances.some(inst =>
      inst.owner === pi &&
      inst.zone === 'support' &&
      inst.turnPlayed !== currentTurn
    );
  },

  /**
   * Execute: prompt a damage target on the opponent's side,
   * fire laser beam, deal 50 × qualifying creature count.
   * Returns true if resolved, false if cancelled.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const currentTurn = engine.gs.turn || 0;

    // Count qualifying creatures (not summoned this turn)
    const qualifyingCreatures = engine.cardInstances.filter(inst =>
      inst.owner === pi &&
      inst.zone === 'support' &&
      inst.turnPlayed !== currentTurn
    );
    const creatureCount = qualifyingCreatures.length;
    if (creatureCount === 0) return false; // Shouldn't happen (canActivate guards this)

    const damage = 50 * creatureCount;

    // Prompt: select an enemy target (hero or creature)
    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: 'destruction_spell',
      baseDamage: damage,
      title: 'Alice, the Puppeteer Girl',
      description: `Deal ${damage} damage (50 × ${creatureCount} Creature${creatureCount !== 1 ? 's' : ''}) to an enemy target.`,
      confirmLabel: `⚡ ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!target) return false; // Cancelled

    // Play laser beam animation from Alice to target
    const targetZoneSlot = target.type === 'equip' ? target.slotIdx : -1;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: ctx.cardHeroOwner,
      sourceHeroIdx: heroIdx,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot,
      color: '#ff2222',
      duration: 1500,
    });
    await engine._delay(400); // Let beam draw before damage numbers appear

    // Deal the damage
    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) {
        await ctx.dealDamage(hero, damage, 'destruction_spell');
      }
    } else if (target.type === 'equip') {
      // Creature damage via generic batch system
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          { name: 'Alice, the Puppeteer Girl', heroIdx }, inst, damage, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true }
        );
      }
    }

    engine.sync();
    await engine._delay(800); // Let beam + explosion finish
    return true;
  },
};
