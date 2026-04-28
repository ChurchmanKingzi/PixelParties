// ═══════════════════════════════════════════
//  CARD EFFECT: "Heal"
//  Spell (Support Magic Lv1, Normal)
//  Choose any target (Hero or Creature, either
//  side) and heal it for 150/200/300 HP based
//  on the caster's total Support Magic level
//  (including Performance stacked on Support
//  Magic).
//
//  HP is capped at max HP unless Nao is the
//  caster — then overheal is allowed when
//  the target's HP <= max HP.
//
//  Animation: green laser beam rises up from
//  caster, then orbital-strikes down onto the
//  target with green sparkles on impact.
// ═══════════════════════════════════════════

module.exports = {
  includesHealing: true,
  // Heal scales with the caster's Support Magic level (150/200/300).
  // The CPU's ability-stacking scoring reads `cpuMeta.scalesWithSchool`
  // to keep Support Magic worth stacking even when no card in the deck
  // strictly requires it at the higher level.
  cpuMeta: { scalesWithSchool: 'Support Magic' },
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Calculate Support Magic level on this hero
      const abZones = ps.abilityZones[heroIdx] || [[], [], []];
      const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
      const healAmount = smLevel >= 3 ? 300 : smLevel >= 2 ? 200 : 150;

      // Prompt: select any target (hero or creature, either side)
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'support_spell',
        title: 'Heal',
        description: `Heal a target for ${healAmount} HP. (Support Magic Lv${smLevel})`,
        confirmLabel: `💚 Heal! (${healAmount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!target) return; // Cancelled

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // ── Phase 1: Green beam rises from caster ──
      engine._broadcastEvent('play_heal_beam', {
        phase: 'rise',
        sourceOwner: ctx.cardHeroOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner,
        targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
      });

      await engine._delay(500); // Beam rises off screen

      // ── Phase 2: Beam strikes down onto target ──
      engine._broadcastEvent('play_heal_beam', {
        phase: 'strike',
        sourceOwner: ctx.cardHeroOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner,
        targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
      });

      await engine._delay(350); // Beam arrives + sparkle delay

      // ── Phase 3: Heal sparkle impact ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle',
        owner: tgtOwner,
        heroIdx: tgtHeroIdx,
        zoneSlot: tgtZoneSlot,
      });

      await engine._delay(200);

      // ── Apply healing (turn-1-immune targets are unaffected by opponent heals) ──
      const isImmune = gs.firstTurnProtectedPlayer != null && tgtOwner === gs.firstTurnProtectedPlayer && tgtOwner !== pi;
      if (isImmune) {
        engine.log('heal_blocked', { target: target.cardName, reason: 'shielded' });
      } else if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.healHero(tgtHero, healAmount);
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await ctx.healCreature(inst, healAmount);
        }
      }

      engine.log('heal_spell', {
        player: ps.username,
        hero: hero.name,
        target: target.cardName,
        amount: healAmount,
        smLevel,
      });
      engine.sync();
    },
  },
};
