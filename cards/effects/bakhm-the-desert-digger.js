// ═══════════════════════════════════════════
//  CARD EFFECT: "Bakhm, the Desert Digger"
//  Hero — PACMAN archetype
//
//  Effect 1: Whenever ANY Surprise is activated,
//  Bakhm chains: prompt owner to deal 100 damage
//  to a single target.
//
//  Effect 2: Bakhm's own Support Zones can also
//  hold face-down Surprise Creatures (acting as
//  extra Surprise Zones). Handled by engine via
//  the bakhmSurpriseSlots system.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  // CPU threat assessment (damage supporter). 100 damage per Surprise
  // activation; rough per-turn yield scales with the owner's current
  // Surprise count (face-down Creatures in surprise zones + bakhm slots).
  supportYield(ctx) {
    const { engine, pi } = ctx;
    const ps = engine.gs.players[pi];
    let surprises = 0;
    for (const zone of (ps?.surpriseZones || [])) surprises += (zone || []).length;
    return { damagePerTurn: 50 * surprises };
  },

  hooks: {
    /**
     * After any Surprise is activated (by any player),
     * Bakhm prompts its owner to deal 100 damage to a target.
     */
    onSurpriseActivated: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];

      // Bakhm must be alive and not incapacitated
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Sand twister animation on Bakhm
      engine._broadcastEvent('play_zone_animation', {
        type: 'sand_twister', owner: pi,
        heroIdx, zoneSlot: -1,
      });
      await engine._delay(300);

      // Prompt for damage target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: 100,
        title: 'Bakhm, the Desert Digger',
        description: 'A Surprise was activated! Deal 100 damage to a target.',
        confirmLabel: '🌪️ Strike! (100)',
        confirmClass: 'btn-danger',
        cancellable: false,
        noSpellCancel: true,
      });

      if (!target) return;

      // Sand twister animation on the target
      if (target.type === 'hero') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'sand_twister', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: -1,
        });
      } else if (target.type === 'equip') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'sand_twister', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
      }
      await engine._delay(400);

      // Deal damage
      if (target.type === 'hero') {
        const targetHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (targetHero && targetHero.hp > 0) {
          await ctx.dealDamage(targetHero, 100, 'other');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Bakhm, the Desert Digger', owner: pi, heroIdx },
            inst, 100, 'other',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.sync();
      await engine._delay(200);
    },
  },

  /**
   * Check if a hero is Bakhm and can use support zones as surprise zones.
   * Called by the engine to determine if a support zone can hold face-down surprises.
   */
  isBakhmHero: true,
};
