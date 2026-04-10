// ═══════════════════════════════════════════
//  CARD EFFECT: "Venom Infusion"
//  Spell (Decay Magic Lv1)
//
//  Apply 1 stack of Poison to a target Hero.
//  If the caster has Decay Magic Lv3, the
//  Poison becomes "Unhealable Poison" — it
//  cannot be removed by any effect (cleanse,
//  status removal, blanket purge, etc.).
//  Only the afflicted Hero dying or leaving
//  the game removes it.
//
//  Animation: thick sickly green fog.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Prompt for target hero
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero'],
        damageType: null,
        title: 'Venom Infusion',
        description: 'Apply 1 stack of Poison to a Hero.',
        confirmLabel: '☠️ Infuse!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (!tgtHero || tgtHero.hp <= 0) return;

      // Green fog animation on target
      engine._broadcastEvent('play_zone_animation', {
        type: 'venom_fog', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: -1,
      });
      await engine._delay(500);

      // Check for Decay Magic Lv3 on the caster
      const abZones = ps.abilityZones[heroIdx] || [];
      const decayLevel = engine.countAbilitiesForSchool('Decay Magic', abZones);
      const isUnhealable = decayLevel >= 3;

      // Apply poison
      await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
        addStacks: 1,
        appliedBy: pi,
        unhealable: isUnhealable || undefined,
      });

      engine.log('venom_infusion', {
        player: ps.username, hero: hero.name,
        target: tgtHero.name,
        unhealable: isUnhealable,
      });

      if (isUnhealable) {
        engine._broadcastEvent('play_skull_burst', {
          owner: tgtOwner, heroIdx: tgtHeroIdx,
        });
        await engine._delay(1200);
      }

      engine.sync();
    },
  },
};
